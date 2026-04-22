# Building a High-Performance ONNX Inference Engine for Qwen LLMs: From PyTorch to C++ with GPU Acceleration

*A deep dive into exporting Qwen language models to ONNX and building a production-ready C++ inference engine*

---

## TL;DR

I built a high-performance ONNX inference engine for Qwen language models that achieves **12+ tokens/sec on GPU** with C++ and CUDA. This article covers the entire journey: from dealing with HuggingFace Transformers' dynamic cache limitations, to implementing a custom forward pass, exporting to ONNX, fixing ONNX Runtime API issues, and optimizing GPU inference with cuDNN 9.

**GitHub Repository:** [llm-inference](https://github.com/sgowdaks/llm-inference)

---

## The Challenge: Running LLMs Efficiently

Large Language Models (LLMs) are powerful but resource-intensive. While Python frameworks like HuggingFace Transformers make it easy to prototype, production deployments demand:

- **Faster inference** (lower latency)
- **Better resource utilization** (efficient GPU usage)
- **Lower deployment overhead** (no Python interpreter)
- **Cross-platform compatibility**

ONNX (Open Neural Network Exchange) promises to bridge this gap by providing a standardized format that can run on optimized runtimes. But getting there isn't straightforward, especially for complex models like Qwen.

---

## Part 1: The Dynamic Cache Problem

### Initial Attempt: Direct HuggingFace Export

My first attempt was to export Qwen directly using HuggingFace Transformers:

```python
from transformers import AutoModelForCausalLM
import torch

model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-8B")
dummy_input = torch.ones(1, 10, dtype=torch.long)

torch.onnx.export(
    model,
    dummy_input,
    "qwen.onnx",
    input_names=["input_ids"],
    output_names=["logits"],
    dynamic_axes={"input_ids": {0: "batch", 1: "seq_len"}}
)
```

**Result:** ❌ **Failed with Dynamic Cache Error**

```
RuntimeError: Trying to export a `DynamicCache` but the current version 
of ONNX doesn't support dynamic control flow. Please open an issue at 
https://github.com/pytorch/pytorch/issues
```

### The Root Cause

Modern transformer models use **KV-cache** (key-value cache) to avoid recomputing attention for previously processed tokens. HuggingFace's default implementation uses `DynamicCache`, which involves:

- Python dictionaries
- Dynamic list operations
- Runtime-dependent control flow

None of these translate cleanly to ONNX's static graph format.

### The Solution: Custom Forward Pass

The fix required implementing a custom `forward()` function that:
1. **Manages KV-cache explicitly** as input/output tensors
2. **Uses static operations** (no dynamic lists or dicts)
3. **Handles cache concatenation** manually

Here's the key insight - instead of letting HuggingFace manage the cache internally, we expose it as model inputs and outputs:

```python
class QWENWrapper(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model
        self.config = model.config
        
    def forward(
        self,
        input_ids,           # Current token(s)
        history_len,         # How many tokens already processed
        ids_len,             # Length of current input
        attention_mask,      # Mask type (0 or 1)
        *past_key_values     # Previous KV cache (72 tensors for 36 layers)
    ):
        # Reconstruct past_key_values for each layer
        num_layers = self.config.num_hidden_layers
        past_kvs = []
        
        for i in range(num_layers):
            key = past_key_values[i]           # past_key
            value = past_key_values[num_layers + i]  # past_value
            past_kvs.append((key, value))
        
        # Run the model
        outputs = self.model(
            input_ids=input_ids,
            past_key_values=past_kvs,
            use_cache=True,
            return_dict=True
        )
        
        # Extract new KV cache
        new_past_key_values = outputs.past_key_values
        
        # Get logits and compute max token
        logits = outputs.logits[:, -1, :]
        max_logit_id = torch.argmax(logits, dim=-1, keepdim=True)
        
        # Calculate new sequence length
        kv_seq_len = history_len + ids_len
        
        # Return: new KV caches (72 tensors) + token + seq_len
        output_list = []
        for key, value in new_past_key_values:
            output_list.append(key)
        for key, value in new_past_key_values:
            output_list.append(value)
        output_list.extend([max_logit_id, kv_seq_len])
        
        return tuple(output_list)
```

**Key Points:**
- **72 KV tensors** (36 layers × 2 for keys/values) + metadata = 74 outputs
- **Static graph structure** - no Python loops or conditionals
- **Explicit cache management** - client code handles passing cache between iterations

---

## Part 2: ONNX Export with Optimizations

### Export Configuration

With the custom forward pass, export becomes straightforward:

```python
def export_model(model, output_path):
    wrapped_model = QWENWrapper(model)
    
    # Prepare dummy inputs
    batch_size = 1
    seq_len = 8
    num_layers = model.config.num_hidden_layers
    num_kv_heads = model.config.num_key_value_heads
    head_dim = model.config.hidden_size // model.config.num_attention_heads
    
    dummy_input_ids = torch.ones(batch_size, seq_len, dtype=torch.int32)
    dummy_history_len = torch.tensor([0], dtype=torch.int64)
    dummy_ids_len = torch.tensor([seq_len], dtype=torch.int64)
    dummy_attention_mask = torch.tensor([1], dtype=torch.int8)
    
    # Empty KV caches
    dummy_past_kvs = []
    for _ in range(num_layers * 2):  # keys and values
        dummy_past_kvs.append(
            torch.zeros(num_kv_heads, batch_size, 0, head_dim, dtype=torch.float32)
        )
    
    inputs = (dummy_input_ids, dummy_history_len, dummy_ids_len, 
              dummy_attention_mask, *dummy_past_kvs)
    
    # Export with dynamic axes
    dynamic_axes = {
        "input_ids": {1: "seq_len"},
    }
    
    # Add dynamic axes for all KV caches
    for i in range(num_layers):
        dynamic_axes[f"past_key_{i}"] = {2: "past_seq_len"}
        dynamic_axes[f"past_value_{i}"] = {2: "past_seq_len"}
    
    torch.onnx.export(
        wrapped_model,
        inputs,
        output_path,
        export_params=True,
        opset_version=13,  # Important: 14+ has GPU compatibility issues
        do_constant_folding=True,
        input_names=["input_ids", "history_len", "ids_len", "attention_mask"] + 
                    [f"past_key_{i}" for i in range(num_layers)] +
                    [f"past_value_{i}" for i in range(num_layers)],
        output_names=[f"out_key_{i}" for i in range(num_layers)] +
                     [f"out_value_{i}" for i in range(num_layers)] +
                     ["max_logit_id", "kv_seq_len"],
        dynamic_axes=dynamic_axes,
    )
```

### Why Opset 13?

Initially, I used opset 17, but encountered:
```
Error: Could not find an implementation for Mul(14) node
```

**Issue:** ONNX Runtime's GPU builds don't include all CPU fallback kernels for newer opsets.

**Solution:** Use opset 13 for maximum compatibility.

---

## Part 3: Building the C++ Inference Engine

### Architecture Overview

The C++ engine uses:
- **ONNX Runtime 1.19.0** (GPU build)
- **tokenizers-cpp** for fast tokenization
- **nlohmann/json** for configuration
- **CUDA + cuDNN 9** for GPU acceleration

### Key Implementation Challenges

#### Challenge 1: ONNX Runtime API Compatibility

ONNX Runtime 1.19.0 changed several APIs:

```cpp
// ❌ Old API (pre-1.19)
session_options.AddSessionConfigEntry("key", "value");
session_options.SetLogVerbosityLevel(4);
Ort::ThrowOnError(OrtSessionOptionsAppendExecutionProvider_CUDA(options, 0));

// ✅ New API (1.19.0+)
session_options.AddConfigEntry("key", "value");
// SetLogVerbosityLevel removed - use session options
OrtCUDAProviderOptions cuda_options;
cuda_options.device_id = 0;
session_options.AppendExecutionProvider_CUDA(cuda_options);
```

#### Challenge 2: Tensor Lifecycle Management

**The Bug:** Generated tokens were garbage:
```
Output: "ĊĊĊĊ</think></think>and and and and..."
```

**Root Cause:** Data vectors went out of scope before tensor creation:

```cpp
// ❌ WRONG - vector destroyed after loop iteration
for (int i = 0; i < max_tokens; i++) {
    std::vector<int32_t> new_token = {token_id};  // Goes out of scope!
    input_tensors.push_back(
        Ort::Value::CreateTensor<int32_t>(memory_info, 
            new_token.data(), ...));  // Dangling pointer!
}
```

**Solution:** Maintain persistent buffers:

```cpp
// ✅ CORRECT - persistent across iterations
std::vector<int32_t> current_tokens(ids_vec.begin(), ids_vec.end());
std::vector<int64_t> history_len_data = {0};
std::vector<int64_t> ids_len_data = {static_cast<int64_t>(current_tokens.size())};
std::vector<int8_t> attention_mask_data = {1};

for (int i = 0; i < max_tokens; i++) {
    // Create tensors from persistent data
    input_tensors.push_back(
        Ort::Value::CreateTensor<int32_t>(memory_info, 
            current_tokens.data(), current_tokens.size(), ...));
    
    // ... run inference ...
    
    // Update buffers for next iteration
    current_tokens.clear();
    current_tokens.push_back(static_cast<int32_t>(token_id));
    history_len_data[0] += ids_len_data[0];
    ids_len_data[0] = 1;
    attention_mask_data[0] = 0;
}
```

#### Challenge 3: KV Cache Management

Each decode iteration:
1. Takes 76 input tensors: 72 KV caches + 4 metadata
2. Produces 74 output tensors: 72 new KV caches + 2 outputs
3. Must reconstruct inputs from outputs

```cpp
// Move KV caches from outputs to inputs (zero-copy)
input_tensors.clear();
for (size_t i = 0; i < num_layers_ * 2; i++) {
    input_tensors.push_back(std::move(output_tensors[i]));
}

// Create new metadata tensors
input_tensors.push_back(Ort::Value::CreateTensor<int32_t>(...));  // token
input_tensors.push_back(Ort::Value::CreateTensor<int64_t>(...));  // history_len
input_tensors.push_back(Ort::Value::CreateTensor<int64_t>(...));  // ids_len
input_tensors.push_back(Ort::Value::CreateTensor<int8_t>(...));   // attention_mask
```

---

## Part 4: GPU Acceleration with CUDA

### Setting Up GPU Inference

#### 1. Install cuDNN 9

```bash
# Via conda (recommended)
conda install -c conda-forge cudnn=9

# Set environment
export LD_LIBRARY_PATH=$CONDA_PREFIX/lib:$LD_LIBRARY_PATH
```

#### 2. Configure CUDA Provider

```cpp
OrtCUDAProviderOptions cuda_options;
cuda_options.device_id = 0;  // Use GPU 0
cuda_options.cudnn_conv_algo_search = OrtCudnnConvAlgoSearchExhaustive;
cuda_options.gpu_mem_limit = SIZE_MAX;  // No limit
cuda_options.arena_extend_strategy = 1;
cuda_options.do_copy_in_default_stream = 1;

session_options.AppendExecutionProvider_CUDA(cuda_options);
```

#### 3. Handle Library Conflicts

Created a wrapper script to resolve libstdc++ conflicts:

```bash
#!/bin/bash
# scripts/run_gpu_inference.sh

export LD_LIBRARY_PATH=$CONDA_PREFIX/lib:$LD_LIBRARY_PATH
export LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libstdc++.so.6

./build/bin/onnx_inference "$@"
```

---

## Part 5: Performance Results

### Benchmarks (Qwen3-8B)

| Configuration | Hardware | Tokens/sec | Notes |
|--------------|----------|------------|-------|
| Python (HF) | RTX A6000 | ~8-10 | Native PyTorch |
| C++ (CPU) | Xeon E5 | ~15-20 | ONNX Runtime CPU |
| **C++ (GPU)** | **RTX A6000** | **~12** | **ONNX Runtime + CUDA** |

### Why GPU Isn't Faster?

You might wonder why GPU is similar to CPU. Reasons:

1. **Small batch size** (1) - GPU underutilized
2. **KV cache overhead** - Memory bandwidth bound
3. **Model load time** - First token takes 45-60s
4. **8B model size** - Still fits in CPU cache reasonably well

**GPU shines with:**
- Larger batch sizes (2-8+)
- Continuous inference (amortized load time)
- Larger models (70B+)

---

## Part 6: Project Structure

After refactoring, the project is organized as:

```
llm-inference/
├── src/                    # Source code
│   ├── onnx_inference.cpp  # C++ inference engine
│   ├── onnx_inference.py   # Python inference
│   └── exporter.py         # Model export
├── scripts/                # Utility scripts
│   ├── run_gpu_inference.sh
│   └── test_inference.sh
├── configs/                # Configuration
│   └── config.json
├── docs/                   # Documentation
│   ├── BUILD.md
│   ├── CONTRIBUTING.md
│   └── FIXES_APPLIED.md
├── CMakeLists.txt         # Build system
└── requirements.txt       # Python deps
```

---

## Part 7: Lessons Learned

### 1. HuggingFace Abstractions Can Hide Complexity

The `DynamicCache` abstraction is great for research but a barrier for deployment. Understanding the underlying mechanism is crucial.

### 2. ONNX Opset Matters

Newer isn't always better. Opset compatibility with your runtime is more important than having the latest features.

### 3. Memory Management in C++ is Critical

Modern C++ with smart pointers helps, but ONNX Runtime's C API requires careful attention to:
- Tensor data lifetime
- Memory ownership
- Zero-copy operations

### 4. GPU Acceleration Isn't Automatic

Getting cuDNN working required:
- Correct library versions
- Environment variables
- Library path resolution
- Preload order

### 5. Debugging Requires Multiple Perspectives

When output was garbage, I had to check:
- Token IDs (valid range?)
- Tensor shapes (correct dimensions?)
- Data types (int32 vs int64?)
- Memory lifetimes (data still valid?)
- KV cache (properly passed?)

---

## Getting Started

### Quick Start

```bash
# Clone repository
git clone https://github.com/sgowdaks/llm-inference.git
cd llm-inference
git submodule update --init --recursive

# Install Python dependencies
pip install -r requirements.txt

# Download ONNX Runtime GPU
wget https://github.com/microsoft/onnxruntime/releases/download/v1.19.0/onnxruntime-linux-x64-gpu-1.19.0.tgz
tar -xzf onnxruntime-linux-x64-gpu-1.19.0.tgz

# Install cuDNN
conda install -c conda-forge cudnn=9

# Build C++ inference
mkdir build && cd build
cmake .. -DONNXRUNTIME_ROOT_DIR=/path/to/onnxruntime-linux-x64-gpu-1.19.0
make -j4

# Export model
cd ..
cp configs/config.example.json configs/config.json
# Edit configs/config.json with your paths
python src/exporter.py --config configs/config.json --mode export

# Run inference
./scripts/run_gpu_inference.sh "What is machine learning?"
```

### Expected Output

```
Using CUDA execution provider on GPU 0

Prompt: What is machine learning?
Qwen Answering:

Machine learning is a subset of artificial intelligence (AI) that 
focuses on the development of algorithms and statistical models that 
enable computers to learn from and make predictions or decisions based 
on data...

Decode: 12.28 token/s
```

---

## Future Improvements

### Planned Features

1. **Batch Inference** - Process multiple prompts simultaneously
2. **Quantization** - INT8/INT4 support for smaller memory footprint
3. **Multi-GPU** - Distribute inference across devices
4. **More Models** - Support Llama, Mistral, etc.
5. **Python Bindings** - PyBind11 wrapper for C++ engine
6. **Streaming API** - Token-by-token generation
7. **Request Batching** - Dynamic batching for throughput

### Performance Optimizations

- Flash Attention integration
- Continuous batching
- KV cache quantization
- Model parallelism
- Pipeline parallelism

---

## Conclusion

Building a production-ready inference engine for LLMs involves much more than just exporting a model. From understanding cache management, to navigating ONNX Runtime APIs, to optimizing GPU utilization - each step presents unique challenges.

The result? A system that:
- ✅ Runs 12+ tokens/sec on GPU
- ✅ Has no Python runtime overhead
- ✅ Supports both CPU and GPU
- ✅ Is production-ready and maintainable

The journey taught me that modern ML frameworks are powerful but sometimes you need to go lower-level to achieve your goals. The trade-off between convenience and control is real, and knowing when to make that trade is key.

---

## Resources

- **GitHub Repository:** [github.com/sgowdaks/llm-inference](https://github.com/sgowdaks/llm-inference)
- **ONNX Runtime Docs:** [onnxruntime.ai/docs](https://onnxruntime.ai/docs/)
- **Qwen Models:** [huggingface.co/Qwen](https://huggingface.co/Qwen)
- **ONNX Spec:** [github.com/onnx/onnx](https://github.com/onnx/onnx)

---

## Connect

If you found this helpful or have questions:
- ⭐ Star the [GitHub repo](https://github.com/sgowdaks/llm-inference)
- 🐛 Open an issue for bugs or questions
- 💬 Discussion section for ideas
- 🤝 PRs welcome!

---

**Tags:** #MachineLearning #LLM #ONNX #Cpp #CUDA #AI #DeepLearning #Inference #Optimization #Qwen

---

*Published on Medium - November 2025*
*Author: Shivani Gowda*
