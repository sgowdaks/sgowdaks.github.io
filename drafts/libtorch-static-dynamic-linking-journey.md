---
title: "LibTorch Journey: Static vs Dynamic Linking and Fixing Multi-GPU Model Initialization"
subtitle: "A weekend deep dive into PyTorch internals, CUDA memory management, and open-source contribution"
category: "Technology"
date: "January 4, 2026"
tags: C++, PyTorch, LibTorch, CUDA, Linking, Systems Programming, GPU Optimization
disclaimer: false
---

# LibTorch Journey: Static vs Dynamic Linking and Fixing Multi-GPU Model Initialization

**Status:** Completed - Weekend Challenge 1/3/2026  
**Category:** Technology  
**Tags:** C++, PyTorch, LibTorch, CUDA, Linking, Systems Programming, GPU Optimization

---

## Introduction

This weekend, I decided to take on a challenge that seemed straightforward on paper: get the [libtorch-starter](https://github.com/thammegowda/libtorch-starter) project running and contribute a fix for [PyTorch issue #145337](https://github.com/pytorch/pytorch/issues/145337) - a performance bug causing slow multi-GPU model initialization.

Spoiler alert: It wasn't straightforward at all, but I successfully contributed a fix that **reduced model initialization time from 10 seconds to ~130 milliseconds**!

What started as a simple "clone and build" exercise turned into a deep dive into:
- Understanding PyTorch's architecture and how LibTorch fits in
- CUDA version compatibility and static/dynamic linking
- Why tensor allocation location matters for GPU performance
- The CPU-to-GPU memory transfer bottleneck

This blog documents my complete journey - from understanding the problem to submitting a PR to PyTorch.

---

## Understanding PyTorch's Architecture: Where Does LibTorch Fit?

Before diving into the problem, let's understand how PyTorch is organized. This context is crucial for understanding why certain issues exist and how they can be fixed.

### PyTorch: More Than Just a Python Library

When most people think of PyTorch, they think of `import torch` in Python. But PyTorch is actually a sophisticated multi-layered system:

```
┌─────────────────────────────────────────────────────┐
│                   Python API                         │
│              (torch, torch.nn, etc.)                 │
├─────────────────────────────────────────────────────┤
│                    LibTorch                          │
│           (C++ Frontend - torch::nn)                 │
├─────────────────────────────────────────────────────┤
│                      ATen                            │
│     (Tensor Library - core tensor operations)        │
├─────────────────────────────────────────────────────┤
│                      C10                             │
│        (Core Library - memory, device mgmt)          │
├─────────────────────────────────────────────────────┤
│              Hardware Backends                       │
│          (CUDA, CPU, MPS, ROCm, etc.)               │
└─────────────────────────────────────────────────────┘
```

### What is LibTorch?

**LibTorch** is PyTorch's C++ API and runtime. It's not a separate project - it's the actual core of PyTorch that the Python bindings wrap around. LibTorch includes:

1. **torch::Tensor**: The C++ tensor class
2. **torch::nn**: Neural network modules (Linear, Conv2d, etc.)
3. **torch::optim**: Optimizers (SGD, Adam, etc.)
4. **TorchScript**: JIT compilation and serialization

**Why use LibTorch?**
- **Production deployment**: No Python runtime overhead
- **Embedded systems**: Smaller footprint than full Python
- **Real-time applications**: Lower latency, predictable performance
- **Integration**: Embed ML in C++ applications

### Key Components

| Component | Description |
|-----------|-------------|
| **C10** | Core utilities: memory allocators, device management, logging |
| **ATen** | "A Tensor Library" - all tensor operations live here |
| **LibTorch** | High-level C++ API wrapping ATen |
| **TorchScript** | JIT compiler for model optimization and serialization |

---

## The Challenge

### What I'm Trying to Do

This was a hands-on learning exercise to understand how PyTorch's internals work at the C++ level. My goals were:

1. **Build LibTorch from source** - Understand the build system, dependencies, and how PyTorch compiles
2. **Get the [libtorch-starter](https://github.com/thammegowda/libtorch-starter) project working** - A minimal C++ project for exploring LibTorch
3. **Investigate and fix a real issue** - Dive into [PyTorch issue #145337](https://github.com/pytorch/pytorch/issues/145337) to understand the problem and contribute a solution

This wasn't about running inference on a model - it was about getting my hands dirty with systems programming, understanding memory management, and contributing to open source.

### The Problem: Multi-GPU Model Initialization is Slow

The original issue reported that initializing models on multiple GPUs using LibTorch takes linear time instead of parallel time. Here's what was observed:

| GPUs | Expected Time | Actual Time | Slowdown |
|------|---------------|-------------|----------|
| 1    | 14s          | 14s         | 1x       |
| 2    | ~14s         | 24s         | 1.7x     |
| 4    | ~14s         | 54s         | 3.8x     |
| 8    | ~14s         | 97s         | 6.9x     |

**The code that exposed this:**
```cpp
// Each thread initializes a model on a different GPU
std::vector<std::jthread> threads;
for (int i = 0; i < n_threads; i++) {
    auto t = std::jthread([i, &dims, &devices] {
        auto device = devices[i];
        Timer timer(device.str());
        auto model = Net(dims, device);  // This should be parallel!
    });
    threads.push_back(std::move(t));
}
```

Even though each thread targets a different GPU, the initialization time scales linearly with GPU count. Something was serializing the parallel work.

---

## Deep Dive: The CPU-to-GPU Memory Transfer Bottleneck

### Understanding the Root Cause

After investigation (with help from the community), the culprit was found: **`nn::LinearImpl` doesn't accept a `device` argument**. 

Here's what happens internally when you create a Linear layer:

```cpp
// Current behavior in PyTorch's nn::Linear
LinearImpl::LinearImpl(const LinearOptions& options) {
    weight = register_parameter("weight", 
        torch::empty({out_features, in_features}));  // Created on CPU!
    bias = register_parameter("bias", 
        torch::empty({out_features}));  // Also on CPU!
}

// Then when you call .to(device):
model->to(torch::kCUDA);  // Transfers tensors from CPU to GPU
```

### The Memory Architecture Problem

```
┌─────────────────────────────────────────────────────────────┐
│                         CPU                                  │
│  ┌─────────────┐                                            │
│  │  System RAM │◄──────── Tensor created here first         │
│  │   (DDR4/5)  │                                            │
│  └──────┬──────┘                                            │
│         │                                                    │
│         │ PCIe Bus (Bottleneck!)                            │
│         │ ~32 GB/s theoretical                              │
│         │ ~12-15 GB/s practical                             │
│         ▼                                                    │
├─────────────────────────────────────────────────────────────┤
│                     GPU 0        GPU 1        GPU 2         │
│                   ┌──────┐     ┌──────┐     ┌──────┐        │
│                   │ HBM  │     │ HBM  │     │ HBM  │        │
│                   │~2TB/s│     │~2TB/s│     │~2TB/s│        │
│                   └──────┘     └──────┘     └──────┘        │
│                                                              │
│                   ◄──── Tensor transferred here             │
└─────────────────────────────────────────────────────────────┘
```

### Why Parallelization Doesn't Help

Even with multiple threads, they all compete for the **same PCIe bus** to transfer data from CPU to GPU:

1. **Thread 1**: Allocate tensor on CPU → Transfer to GPU0 via PCIe
2. **Thread 2**: Allocate tensor on CPU → Transfer to GPU1 via PCIe  
3. **Thread 3**: Allocate tensor on CPU → Transfer to GPU2 via PCIe

All three transfers share the same PCIe root complex, creating a serialization point. The PCIe bus becomes the bottleneck, not the GPU memory bandwidth.

### The Solution: Direct GPU Allocation

The fix is simple in concept: **create tensors directly on the target GPU**:

```cpp
// BEFORE: Tensors created on CPU, then moved
LinearImpl::LinearImpl(const LinearOptions& options) {
    weight = register_parameter("weight", 
        torch::empty({out, in}));  // CPU allocation
}
model->to(device);  // Slow PCIe transfer

// AFTER: Tensors created directly on GPU
LinearImpl::LinearImpl(const LinearOptions& options) {
    weight = register_parameter("weight", 
        torch::empty({out, in}, 
            torch::dtype(options.dtype()).device(options.device())));  // Direct GPU allocation
}
// No transfer needed!
```

This bypasses the PCIe bottleneck entirely. Each GPU allocates memory in its own HBM (High Bandwidth Memory) independently and in parallel.

---

## My Contribution: The Pull Request

### PR #171666: Add device, dtype opts to nn::Linear

I submitted [PR #171666](https://github.com/pytorch/pytorch/pull/171666) to PyTorch that adds `device` and `dtype` options to `nn::Linear`. This allows developers to specify where tensors should be allocated at creation time.

**The API Change:**
```cpp
// Old way (CPU allocation, then transfer)
auto linear = nn::Linear(nn::LinearOptions(in_features, out_features));
linear->to(device);

// New way (direct GPU allocation)
auto linear = nn::Linear(
    nn::LinearOptions(in_features, out_features)
        .device(torch::kCUDA)
        .dtype(torch::kFloat32)
);
```

### Performance Results

The results speak for themselves:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Model init time | ~10,000 ms | ~130 ms | **~77x faster** |
| Multi-GPU scaling | Linear (bad) | Parallel (good) | Fixed |
| PCIe transfers | Many | Zero | Eliminated |

### Benchmark Code

```cpp
#include <torch/torch.h>

struct NetImpl : nn::Module {
    nn::Sequential layers;

    NetImpl(std::vector<int64_t> sizes, torch::Device device)
    : layers{ register_module("layers", torch::nn::Sequential()) } 
    {
        for (size_t i = 0; i < sizes.size() - 1; i++) {
            // Use Linear with .device() to create tensors directly on GPU
            layers->push_back(nn::Linear(
                nn::LinearOptions(sizes[i], sizes[i + 1]).device(device)
            ));
            layers->push_back(nn::Functional(torch::relu));
        }
        // No need for this->to(device) - tensors already on device!
    }

    auto forward(Tensor x) -> Tensor {
        return layers->forward(x);
    }
};
TORCH_MODULE(Net);
```

---

## Key Concept: Static vs Dynamic Linking

While debugging my build issues, I kept seeing errors related to "shared libraries" and ".so files". This led me down the rabbit hole of understanding linking - something I'd glossed over in my CS education.

### What is Linking?

When you compile a C++ program, the compilation happens in two stages:
1. **Compilation**: Source code (.cpp) → Object files (.o)
2. **Linking**: Object files + Libraries → Executable

The linking stage is where you combine your code with external libraries (like LibTorch). There are two ways to do this:

### Dynamic Linking (Shared Libraries)

```
Your Program → Links to → libtorch.so (shared library)
                          ↓
                    Loaded at runtime
```

**How it works:**
- The executable contains references to external libraries
- Libraries (.so files on Linux, .dll on Windows) are loaded when the program runs
- Multiple programs can share the same library in memory

**Advantages:**
- Smaller executable size
- Can update libraries without recompiling the program
- Memory efficient (shared across processes)

**Disadvantages:**
- Need to distribute libraries with your executable
- "DLL hell" - version conflicts if the library changes
- Slightly slower startup (loading time)

**Example:**
```bash
# Build with dynamic linking (default)
g++ main.cpp -o myprogram -L/path/to/libtorch/lib -ltorch

# Check dependencies
ldd myprogram
# Output:
#   libtorch.so => /path/to/libtorch/lib/libtorch.so
#   libtorch_cpu.so => /path/to/libtorch/lib/libtorch_cpu.so
#   ...

# Run the program - needs .so files
LD_LIBRARY_PATH=/path/to/libtorch/lib ./myprogram
```

### Static Linking

```
Your Program + libtorch.a (static library) → Single Executable
                          ↓
              All code bundled together
```

**How it works:**
- Library code is copied directly into your executable
- No external dependencies at runtime
- Everything bundled into one binary

**Advantages:**
- Self-contained executable (easy deployment)
- No runtime dependency issues
- Slightly faster execution (no dynamic loading)

**Disadvantages:**
- Larger executable size (includes all library code)
- Must recompile to update libraries
- Memory inefficient (each program has its own copy)

**Example:**
```bash
# Build with static linking
g++ main.cpp -o myprogram -L/path/to/libtorch/lib -ltorch -static

# Check dependencies
ldd myprogram
# Output:
#   not a dynamic executable
# OR
#   linux-vdso.so.1 (only system libraries)

# Run the program - standalone!
./myprogram
```

### LibTorch and Linking

LibTorch provides both options:
- **libtorch-shared**: Dynamic linking (smaller binary, needs .so files)
- **libtorch-static**: Static linking (larger binary, standalone)

For my use case with the libtorch-starter project, I chose **static linking** because:
1. Self-contained executable for easy deployment
2. No runtime dependency headaches
3. Portable across similar Linux systems

The trade-off is a larger binary (~2.2GB with CUDA), but the deployment simplicity is worth it for production use cases.

---

## My Current Setup

### System Configuration
```bash
OS: Ubuntu Linux
GPU: NVIDIA GPU with CUDA support
CUDA: 13.0
cuDNN: 9.x
GCC: Latest available
CMake: 3.x
```

### The libtorch-starter Project

I forked the [libtorch-starter](https://github.com/sgowdaks/libtorch-starter/tree/sg/edit-cmake) project and found that some CUDA libraries were missing from the CMake configuration. After adding the missing pieces, the build worked smoothly.

**What was missing:**
- cuDNN 9 static libraries (`cudnn_graph_static`, `cudnn_adv_static`, `cudnn_heuristic_static`, etc.)
- NVRTC libraries required by cuDNN (`libnvrtc_static.a`, `libnvrtc-builtins_static.a`, `libnvptxcompiler_static.a`)
- Proper linker group handling for circular dependencies between static libraries

Once these were added, everything compiled and ran correctly.

> **Note:** I'm relatively new to C++ and CMake. I was able to identify and fix these issues with significant help from Copilot agents, which guided me through understanding the build system and debugging linker errors. This was a great learning experience!

---

## Key Learnings

### 1. Memory Location Matters for GPU Performance
The biggest lesson: **where you allocate tensors fundamentally affects performance**. CPU-to-GPU transfers over PCIe are orders of magnitude slower than GPU memory allocation:
- PCIe 4.0 x16: ~32 GB/s theoretical, ~12-15 GB/s practical
- GPU HBM: ~2 TB/s bandwidth

### 2. PCIe Bus is a Shared Resource
Even with multiple GPUs and multiple threads, all CPU-to-GPU transfers share the same PCIe root complex. This creates a serialization point that parallelization cannot overcome.

### 3. Static vs Dynamic Linking Trade-offs
| Aspect | Static | Dynamic |
|--------|--------|---------|
| Binary Size | Large (~2.2GB) | Small |
| Dependencies | None | Many .so files |
| Deployment | Easy | Complex |
| Updates | Recompile | Swap libraries |
| Memory Usage | High | Low (shared) |

For production ML systems, static linking provides deployment simplicity at the cost of larger binaries.

### 4. C++ Build Systems Are Complex
CMake, Make, pkg-config, LD_LIBRARY_PATH, RPATH... the C++ build ecosystem has a steep learning curve. Key lessons:
- Circular dependencies in static libraries require linker groups
- Order of libraries matters in static linking
- CUDA libraries need special handling for static builds

### 5. Contributing to Large Open Source Projects
The process of contributing to PyTorch taught me:
- Read the contribution guidelines carefully
- Start with a clear issue to reference
- Keep PRs focused and minimal
- Include benchmarks to demonstrate improvements

---

## Summary

### What Was Accomplished

1. ✅ **Identified the root cause**: `nn::Linear` creates tensors on CPU, causing PCIe bottleneck during multi-GPU initialization
2. ✅ **Submitted PR #171666**: Added `device` and `dtype` options to `nn::Linear` in PyTorch
3. ✅ **Achieved 77x speedup**: Model initialization from 10 seconds to 130ms
4. ✅ **Enhanced libtorch-starter**: Added comprehensive CMake configuration for static CUDA linking with cuDNN 9 support

### Pull Requests & Code

- **PyTorch PR**: [#171666 - Add device, dtype opts to nn::Linear](https://github.com/pytorch/pytorch/pull/171666)
- **libtorch-starter fork**: [sg/edit-cmake branch](https://github.com/sgowdaks/libtorch-starter/tree/sg/edit-cmake)

---

## Resources

### Documentation
- [LibTorch C++ API Documentation](https://pytorch.org/cppdocs/)
- [Building PyTorch from Source](https://github.com/pytorch/pytorch#from-source)
- [CUDA Installation Guide](https://docs.nvidia.com/cuda/cuda-installation-guide-linux/)

### Key GitHub Issues/Repos
- [libtorch-starter (original)](https://github.com/thammegowda/libtorch-starter)
- [PyTorch Issue #145337](https://github.com/pytorch/pytorch/issues/145337)
- [My PyTorch PR #171666](https://github.com/pytorch/pytorch/pull/171666)
- [My libtorch-starter fork](https://github.com/sgowdaks/libtorch-starter/tree/sg/edit-cmake)

### Understanding the Concepts
- [CUDA Memory Management](https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html#memory-management)
- [PCIe Performance Considerations](https://developer.nvidia.com/blog/how-optimize-data-transfers-cuda-cc/)

---

## Conclusion

This weekend challenge turned into an incredibly rewarding deep dive into systems programming and open-source contribution. What started as a simple build exercise led me to:

1. **Understand PyTorch's architecture** from Python bindings down to GPU memory allocation
2. **Identify a fundamental performance bottleneck** in multi-GPU model initialization
3. **Contribute a fix to a major open-source project** that will benefit the community
4. **Master static linking of CUDA libraries** for portable C++ deployments

The key takeaway: **in GPU programming, where you allocate memory matters as much as what you compute**. The PCIe bus can be an unexpected bottleneck, and understanding the memory hierarchy is essential for high-performance ML systems.

---

*Disclaimer: This blog was written for my understanding purposes only. Any mistakes found that need to be addressed, please feel free to reach out to me.*

**Last Updated:** January 4, 2026  
**Status:** Completed ✅
