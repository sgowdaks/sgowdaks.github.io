/**
 * Blog Manager
 * Centralized blog post metadata and rendering
 */

(function() {
  'use strict';

  // Blog posts database
  const blogPosts = [
    {
      id: 'libtorch-static-dynamic-linking-journey',
      title: 'LibTorch Journey: Static vs Dynamic Linking and Fixing Multi-GPU Model Initialization',
      date: '2026-01-04',
      category: 'tech',
      categoryLabel: 'Technology',
      excerpt: 'A weekend deep dive into PyTorch internals, CUDA memory management, and contributing a 77x performance fix for multi-GPU model initialization.',
      tags: ['C++', 'PyTorch', 'LibTorch', 'CUDA', 'Linking', 'Systems Programming', 'GPU Optimization']
    },
    // {
    //   id: 'cpu-gpu-npu-llm-inference',
    //   title: 'CPU vs GPU vs NPU: Running LLMs Across Different Hardware',
    //   date: '2024-12-03',
    //   category: 'tech',
    //   categoryLabel: 'Technology',
    //   excerpt: 'A deep dive into running LLM inference on CPUs, GPUs, and NPUs—understanding what hardware to use when, with practical examples on Intel and Qualcomm platforms.',
    //   tags: ['LLM', 'NPU', 'Hardware', 'Intel', 'Qualcomm', 'Performance', 'Edge AI']
    // },
    // {
    //   id: 'flash-attention-vs-kernel-fusion',
    //   title: 'Flash Attention vs Kernel Fusion: What\'s the Difference and Why It Matters',
    //   date: '2024-12-02',
    //   category: 'tech',
    //   categoryLabel: 'Technology',
    //   excerpt: 'Understanding two distinct optimization techniques that both make transformers faster—but in fundamentally different ways. Learn the key differences between algorithmic redesign and compiler optimization.',
    //   tags: ['LLM', 'Flash Attention', 'Optimization', 'GPU', 'Performance', 'Transformers']
    // },
    // {
    //   id: 'positional-embeddings-transformers',
    //   title: 'Positional Embeddings in Transformers',
    //   date: '2024-12-01',
    //   category: 'tech',
    //   categoryLabel: 'Technology',
    //   excerpt: 'A deep dive into exporting Qwen language models to ONNX and building a production-ready C++ inference engine with GPU acceleration achieving 12+ tokens/sec.',
    //   tags: ['LLM', 'ONNX', 'C++', 'GPU', 'Performance', 'AI']
    // },
    {
      id: 'llm-inference',
      title: 'Building a High-Performance ONNX Inference Engine for Qwen LLMs',
      date: '2025-11-20',
      category: 'tech',
      categoryLabel: 'Technology',
      excerpt: 'A deep dive into exporting Qwen language models to ONNX and building a production-ready C++ inference engine with GPU acceleration achieving 12+ tokens/sec.',
      tags: ['LLM', 'ONNX', 'C++', 'GPU', 'Performance', 'AI']
    },
    {
      id: 'kv-caching-llm-inference-optimization',
      title: 'KV Caching: The Hidden Engine Behind Fast LLM Inference',
      date: '2025-11-17',
      category: 'tech',
      categoryLabel: 'Technology',
      excerpt: 'Deep dive into how Key-Value caching transforms LLM inference from impossibly slow to lightning fast, with practical examples and memory trade-offs.',
      tags: ['LLM', 'Caching', 'Performance', 'AI', 'Optimization']
    },
    {
      id: 'grouped-query-attention-llm-efficiency',
      title: 'Understanding Grouped Query Attention: The Secret Behind Efficient LLM Inference',
      date: '2025-11-17',
      category: 'tech',
      categoryLabel: 'Technology',
      excerpt: 'How reducing 32 KV heads to just 4 speeds up language models without breaking them. A deep dive into the memory optimization technique behind modern LLMs.',
      tags: ['LLM', 'MachineLearning', 'Attention', 'Optimization', 'AI']
    }
  ];

  // Public API
  window.BlogManager = {
    getAllPosts: function() {
      return blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    
    getRecentPosts: function(count = 3) {
      return this.getAllPosts().slice(0, count);
    },
    
    getPostById: function(id) {
      return blogPosts.find(post => post.id === id);
    },
    
    getPostsByCategory: function(category) {
      return blogPosts.filter(post => post.category === category);
    },
    
    getPostsByTag: function(tag) {
      return blogPosts.filter(post => post.tags.includes(tag));
    }
  };
})();