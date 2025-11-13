/**
 * Blog Manager
 * Centralized blog post metadata and rendering
 */

(function() {
  'use strict';

  // Blog posts database
  const blogPosts = [
    {
      id: 'welcome-to-my-blog',
      title: 'Welcome to My Blog',
      date: '2024-01-15',
      category: 'tech',
      categoryLabel: 'Technology',
      excerpt: 'Starting my journey of sharing insights on cloud engineering, ML, and life experiences.',
      tags: ['introduction', 'blogging']
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