/**
 * Blog Manager — AUTO-GENERATED from posts.json
 * Do not edit manually. Run: python3 build-blog.py --rebuild-index
 */

(function() {
  'use strict';

  const blogPosts = [
    {
        "id": "docker-compose-networking-deep-dive",
        "title": "Docker Compose and Container Networking: How Linux Wires It All Together",
        "date": "2026-05-05",
        "category": "tech",
        "categoryLabel": "Technology",
        "excerpt": "A continuation of the Docker internals series — how Docker Compose differs from docker run, and what Linux actually does when Docker creates a network: bridges, veth pairs, IPAM, iptables, and the SDN on your laptop.",
        "tags": [
            "Docker",
            "Docker Compose",
            "Networking",
            "Linux",
            "Containers",
            "Systems Programming",
            "SDN",
            "iptables"
        ]
    },
    {
        "id": "containers-virtualization-deep-dive",
        "title": "From Bare Metal to Containers: A Deep Dive into Virtualization and Docker Internals",
        "date": "2026-04-21",
        "category": "tech",
        "categoryLabel": "Technology",
        "excerpt": "A deep dive into how chroot, namespaces, cgroups, and union filesystems combine to make containers work — and where the cloud, hypervisors, and VMware fit into the picture.",
        "tags": [
            "Docker",
            "Containers",
            "Virtualization",
            "Linux",
            "Kubernetes",
            "Cloud",
            "Azure",
            "VMware",
            "Systems Programming"
        ]
    },
    {
        "id": "libtorch-static-dynamic-linking-journey",
        "title": "LibTorch Journey: Static vs Dynamic Linking and Fixing Multi-GPU Model Initialization",
        "date": "2026-01-04",
        "category": "tech",
        "categoryLabel": "Technology",
        "excerpt": "A weekend deep dive into PyTorch internals, CUDA memory management, and contributing a 77x performance fix for multi-GPU model initialization.",
        "tags": [
            "C++",
            "PyTorch",
            "LibTorch",
            "CUDA",
            "Linking",
            "Systems Programming",
            "GPU Optimization"
        ]
    },
    {
        "id": "llm-inference",
        "title": "Building a High-Performance ONNX Inference Engine for Qwen LLMs",
        "date": "2025-11-20",
        "category": "tech",
        "categoryLabel": "Technology",
        "excerpt": "A deep dive into exporting Qwen language models to ONNX and building a production-ready C++ inference engine with GPU acceleration achieving 12+ tokens/sec.",
        "tags": [
            "LLM",
            "ONNX",
            "C++",
            "GPU",
            "Performance",
            "AI"
        ]
    },
    {
        "id": "kv-caching-llm-inference-optimization",
        "title": "KV Caching: The Hidden Engine Behind Fast LLM Inference",
        "date": "2025-11-17",
        "category": "tech",
        "categoryLabel": "Technology",
        "excerpt": "Deep dive into how Key-Value caching transforms LLM inference from impossibly slow to lightning fast, with practical examples and memory trade-offs.",
        "tags": [
            "LLM",
            "Caching",
            "Performance",
            "AI",
            "Optimization"
        ]
    },
    {
        "id": "grouped-query-attention-llm-efficiency",
        "title": "Understanding Grouped Query Attention: The Secret Behind Efficient LLM Inference",
        "date": "2025-11-17",
        "category": "tech",
        "categoryLabel": "Technology",
        "excerpt": "How reducing 32 KV heads to just 4 speeds up language models without breaking them. A deep dive into the memory optimization technique behind modern LLMs.",
        "tags": [
            "LLM",
            "MachineLearning",
            "Attention",
            "Optimization",
            "AI"
        ]
    },
    {
        "id": "distributed-training-parallelism",
        "title": "Distributed Training & Parallelism for Large Transformer Models",
        "date": "2024-12-01",
        "category": "tech",
        "categoryLabel": "Technology",
        "excerpt": "A deep dive into distributed training strategies for large transformer models - data parallelism, tensor parallelism, pipeline parallelism, ZeRO, FSDP, and how frameworks like DeepSpeed and Megatron-LM put it all together.",
        "tags": [
            "LLM",
            "Distributed Training",
            "Parallelism",
            "DeepSpeed",
            "Megatron-LM",
            "GPU",
            "AI"
        ]
    }
];

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
