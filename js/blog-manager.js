/**
 * Blog Manager
 * Centralized blog post metadata and rendering
 */

(function() {
  'use strict';

  // Blog posts database
  const blogPosts = [
    {
      id: 'azure-cognitive-services-network-monitoring',
      title: 'Getting Started with Azure Cognitive Services in Network Monitoring',
      date: '2025-11-08',
      category: 'tech',
      categoryLabel: 'Technology',
      excerpt: 'Exploring how to integrate Azure Cognitive Services with network monitoring systems to create intelligent alerting and anomaly detection solutions.',
      tags: ['Azure', 'AI', 'Networking', 'CognitiveServices']
    },
    {
      id: 'vnet-expressroute-optimization',
      title: 'Optimizing VNet and ExpressRoute',
      date: '2025-11-02',
      category: 'tech',
      categoryLabel: 'Technology',
      excerpt: 'Best practices and strategies for optimizing Azure Virtual Network and ExpressRoute configurations for performance and cost efficiency.',
      tags: ['Azure', 'Networking', 'ExpressRoute', 'VNet']
    },
    {
      id: 'ml-network-anomaly-detection',
      title: 'Building ML-Powered Network Anomaly Detection',
      date: '2025-10-28',
      category: 'tech',
      categoryLabel: 'Technology',
      excerpt: 'A deep dive into creating machine learning models for detecting network anomalies and improving infrastructure reliability.',
      tags: ['MachineLearning', 'Networking', 'Azure', 'AnomalyDetection']
    },
    {
      id: 'continuous-learning-in-tech',
      title: 'The Art of Continuous Learning in Tech',
      date: '2025-10-20',
      category: 'life',
      categoryLabel: 'Life',
      excerpt: 'Reflections on staying current in the ever-evolving tech landscape and building sustainable learning habits.',
      tags: ['Career', 'Learning', 'Growth', 'Tech']
    },
    {
      id: 'work-life-balance-cloud-engineering',
      title: 'Work-Life Balance in Cloud Engineering',
      date: '2025-10-15',
      category: 'life',
      categoryLabel: 'Life',
      excerpt: 'Navigating the demands of cloud engineering while maintaining personal well-being and avoiding burnout.',
      tags: ['WorkLife', 'CloudEngineering', 'Wellness', 'Career']
    },
    {
      id: 'inspiration-everyday-problems',
      title: 'Finding Inspiration in Everyday Problems',
      date: '2025-10-10',
      category: 'life',
      categoryLabel: 'Life',
      excerpt: 'How everyday challenges can spark innovative solutions and drive personal growth in tech.',
      tags: ['Inspiration', 'ProblemSolving', 'Innovation', 'Growth']
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