/**
 * Blog Manager
 * Centralized blog post metadata and rendering
 */

(function() {
  'use strict';

  // Blog posts database
  const blogPosts = [
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
      id: 'example-post',
      title: 'Example Blog Post',
      date: '2025-11-18',
      category: 'tech',
      categoryLabel: 'Technology',
      excerpt: 'This is an example showing how to write blog posts in Markdown and automatically convert them to HTML with custom styling.',
      tags: ['Example', 'Markdown', 'Tutorial']
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