/**
 * Blog Manager - Handles blog post listing and navigation
 * This script automatically manages blog posts without requiring server-side code
 */

// Blog posts configuration
// Add new posts to this array - they will automatically appear on the blog page
const blogPosts = [
  {
    id: 'azure-cognitive-services-network-monitoring',
    title: 'lorem ipsum',
    excerpt: 'lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    category: 'tech',
    categoryLabel: 'Technology',
    date: '2025-11-08',
    readTime: '5 min',
    author: 'Shivani Gowda KS',
    tags: ['Azure', 'AI', 'Networking', 'Cognitive Services'],
    featured: true
  }
//   {
//     id: 'continuous-learning-in-tech',
//     title: 'lorem ipsum',
//     excerpt: 'lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
//     category: 'life',
//     categoryLabel: 'Life & Thoughts',
//     date: '2025-11-05',
//     readTime: '3 min',
//     author: 'Shivani Gowda KS',
//     tags: ['Career', 'Learning', 'Personal Growth'],
//     featured: true
//   },
//   {
//     id: 'vnet-expressroute-optimization',
//     title: 'lorem ipsum',
//     excerpt: 'lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
//     category: 'tech',
//     categoryLabel: 'Technology',
//     date: '2025-11-02',
//     readTime: '7 min',
//     author: 'Shivani Gowda KS',
//     tags: ['Azure', 'Networking', 'Enterprise', 'Performance'],
//     featured: true
//   }
//   {
//     id: 'inspiration-everyday-problems',
//     title: 'Finding Inspiration in Everyday Problems',
//     excerpt: 'How everyday challenges in cloud engineering often lead to the most innovative solutions and personal growth opportunities. Sometimes the best ideas come from the most mundane tasks.',
//     category: 'life',
//     categoryLabel: 'Life & Thoughts',
//     date: '2025-10-30',
//     readTime: '4 min',
//     author: 'Shivani Gowda KS',
//     tags: ['Innovation', 'Problem Solving', 'Creativity'],
//     featured: false
//   },
//   {
//     id: 'ml-network-anomaly-detection',
//     title: 'Building ML-Powered Network Anomaly Detection',
//     excerpt: 'A deep dive into creating a machine learning prototype for network anomaly detection using Python and Azure ML services. From data collection to model deployment in production.',
//     category: 'tech',
//     categoryLabel: 'Technology',
//     date: '2025-10-28',
//     readTime: '6 min',
//     author: 'Shivani Gowda KS',
//     tags: ['Machine Learning', 'Python', 'Azure ML', 'Security'],
//     featured: false
//   },
//   {
//     id: 'work-life-balance-cloud-engineering',
//     title: 'Work-Life Balance in the Cloud Engineering World',
//     excerpt: 'Thoughts on maintaining sanity and personal relationships while working in the fast-paced world of cloud technology. How to disconnect from always-on infrastructure.',
//     category: 'life',
//     categoryLabel: 'Life & Thoughts',
//     date: '2025-10-25',
//     readTime: '3 min',
//     author: 'Shivani Gowda KS',
//     tags: ['Work Life Balance', 'Mental Health', 'Career'],
//     featured: false
//   }
];

// Blog Manager Class
class BlogManager {
  constructor() {
    this.posts = blogPosts;
    this.currentFilter = 'all';
    this.currentTag = null; // currently selected tag (null = no tag filter)
    this.init();
  }

  init() {
    this.renderPosts();
    this.renderCategoryFilters();
    this.renderSidebarCategories();
    this.renderTagCloud();
    this.setupEventListeners();
    this.updateCategoryCounts();
  }

  // Render blog posts based on current filter
  renderPosts(filter = 'all') {
    const postsContainer = document.getElementById('blog-posts');
    if (!postsContainer) return;

    const filteredPosts = this.filterPosts(filter);
    
    if (filteredPosts.length === 0) {
      postsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
          <h3>No posts found</h3>
          <p>No posts match the selected category.</p>
        </div>
      `;
      return;
    }

    postsContainer.innerHTML = filteredPosts.map(post => this.createPostHTML(post)).join('');
  }

  // Filter posts by category and tag (tag optional)
  filterPosts(filter) {
    let results = this.posts.slice();

    if (filter && filter !== 'all') {
      results = results.filter(post => post.category === filter);
    }

    if (this.currentTag) {
      // match tag case-insensitively
      const tag = this.currentTag.toLowerCase();
      results = results.filter(post => Array.isArray(post.tags) && post.tags.some(t => t.toLowerCase() === tag));
    }

    return results.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // Create HTML for a single post
  createPostHTML(post) {
    const formattedDate = this.formatDate(post.date);
    const categoryClass = post.category;
    const postUrl = `posts/${post.id}.html`;

    return `
      <article class="blog-post" data-category="${post.category}">
        <div class="post-meta">
          <span class="post-category ${categoryClass}">${post.categoryLabel}</span>
          <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
          <span><i class="fas fa-clock"></i> ${post.readTime} read</span>
        </div>
        <h3><a href="${postUrl}">${post.title}</a></h3>
        <p class="post-excerpt">${post.excerpt}</p>
        <div class="post-tags">
          ${Array.isArray(post.tags) ? post.tags.map(tag => `<a href="#" class="tag post-tag" data-tag="${tag}">#${tag}</a>`).join('') : ''}
        </div>
        <a href="${postUrl}" class="read-more">Read more →</a>
      </article>
    `;
  }

  // Format date for display
  formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  }

  // Setup event listeners for category filtering
  setupEventListeners() {
    // Category filter buttons (delegated)
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-btn');
        if (!btn) return;
        e.preventDefault();

        // Update active state
        categoryFilter.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Filter posts
        const category = btn.getAttribute('data-category');
        this.currentFilter = category;
        this.renderPosts(category);
      });
    }

    // Sidebar category links (delegated)
    const sidebarCategories = document.getElementById('sidebar-categories');
    if (sidebarCategories) {
      sidebarCategories.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-category]');
        if (!link) return;
        e.preventDefault();

        const category = link.getAttribute('data-category');
        this.currentFilter = category;

        // Update category filter buttons
        const categoryFilterEl = document.getElementById('category-filter');
        if (categoryFilterEl) {
          categoryFilterEl.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
          const targetButton = categoryFilterEl.querySelector(`.category-btn[data-category="${category}"]`);
          if (targetButton) targetButton.classList.add('active');
        }

        // clear tag selection when category changes
        this.currentTag = null;
        this.updateTagActiveState();

        this.renderPosts(category);
      });
    }

    // Tag clicks (delegated) - handles both sidebar tag cloud and post tag links
    const tagCloud = document.getElementById('tag-cloud');
    if (tagCloud) {
      tagCloud.addEventListener('click', (e) => {
        const tagEl = e.target.closest('[data-tag]');
        if (!tagEl) return;
        e.preventDefault();
        const tag = tagEl.getAttribute('data-tag');

        // Toggle tag selection
        if (this.currentTag && this.currentTag.toLowerCase() === tag.toLowerCase()) {
          this.currentTag = null;
        } else {
          this.currentTag = tag;
        }

        // Re-render posts with combined filters
        this.renderPosts(this.currentFilter || 'all');
        this.updateTagActiveState();
      });
    }

    // Post tag clicks inside posts (delegated from document)
    document.addEventListener('click', (e) => {
      const pt = e.target.closest('.post-tag');
      if (!pt) return;
      e.preventDefault();
      const tag = pt.getAttribute('data-tag');

      if (this.currentTag && this.currentTag.toLowerCase() === tag.toLowerCase()) {
        this.currentTag = null;
      } else {
        this.currentTag = tag;
      }

      // when selecting a tag from a post, clear category filter (or keep? choose to keep category)
      // We'll keep the current category so users can refine by both category and tag.
      this.renderPosts(this.currentFilter || 'all');
      this.updateTagActiveState();
    });
  }

  // Compute unique tags and counts
  computeTags() {
    const map = new Map();
    this.posts.forEach(post => {
      if (!Array.isArray(post.tags)) return;
      post.tags.forEach(t => {
        const key = (t || '').trim();
        if (!key) return;
        const lc = key.toLowerCase();
        if (!map.has(lc)) map.set(lc, { tag: key, key: lc, count: 0 });
        map.get(lc).count += 1;
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  // Render tags in the sidebar tag cloud
  renderTagCloud() {
    const container = document.getElementById('tag-cloud');
    if (!container) return;

    const tags = this.computeTags();
    if (tags.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">No tags yet.</p>';
      return;
    }

    container.innerHTML = tags.map(t => `
      <a href="#" class="tag" data-tag="${t.tag}">#${t.tag} <span class="post-count" style="margin-left:6px; opacity:0.85; font-size:0.8rem;">${t.count}</span></a>
    `).join('');
    this.updateTagActiveState();
  }

  // Update active visual state for tags
  updateTagActiveState() {
    const tagCloud = document.getElementById('tag-cloud');
    if (!tagCloud) return;
    tagCloud.querySelectorAll('[data-tag]').forEach(el => {
      const tag = el.getAttribute('data-tag');
      if (this.currentTag && tag && tag.toLowerCase() === this.currentTag.toLowerCase()) {
        el.classList.add('active');
        el.style.background = 'var(--gradient-accent)';
        el.style.color = 'var(--bg-primary)';
      } else {
        el.classList.remove('active');
        el.style.background = '';
        el.style.color = '';
      }
    });
  }

  // Compute unique categories and counts
  computeCategories() {
    const map = new Map();
    this.posts.forEach(post => {
      const key = post.category || 'uncategorized';
      if (!map.has(key)) map.set(key, { key, label: post.categoryLabel || post.category, count: 0 });
      map.get(key).count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  // Render category buttons in the filter area
  renderCategoryFilters() {
    const container = document.getElementById('category-filter');
    if (!container) return;

    const categories = this.computeCategories();
    const buttons = [
      { key: 'all', label: 'All Posts', count: this.posts.length }
    ].concat(categories.map(c => ({ key: c.key, label: c.label, count: c.count })));

    container.innerHTML = buttons.map((c, i) => `
      <a href="#" class="category-btn ${i === 0 ? 'active' : ''}" data-category="${c.key}">
        ${c.label} <span class="post-count" style="margin-left:8px; opacity:0.8; font-size:0.85rem;">${c.count}</span>
      </a>
    `).join('');
  }

  // Render sidebar category list
  renderSidebarCategories() {
    const container = document.getElementById('sidebar-categories');
    if (!container) return;

    const categories = this.computeCategories();
    container.innerHTML = categories.map(c => `
      <li>
        <a href="#" data-category="${c.key}">${c.label}</a>
        <span class="post-count">${c.count}</span>
      </li>
    `).join('');
  }

  // Update category post counts
  updateCategoryCounts() {
    const techCount = this.posts.filter(post => post.category === 'tech').length;
    const lifeCount = this.posts.filter(post => post.category === 'life').length;
    
    // Update sidebar counts
    const techCountEl = document.querySelector('[data-category="tech"]')?.parentNode?.querySelector('.post-count');
    const lifeCountEl = document.querySelector('[data-category="life"]')?.parentNode?.querySelector('.post-count');
    
    if (techCountEl) techCountEl.textContent = techCount;
    if (lifeCountEl) lifeCountEl.textContent = lifeCount;
  }

  // Get featured posts for homepage
  static getFeaturedPosts(limit = 3) {
    return blogPosts
      .filter(post => post.featured)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  // Get recent posts for sidebar
  static getRecentPosts(limit = 5) {
    return blogPosts
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  // Get post by ID
  static getPostById(id) {
    return blogPosts.find(post => post.id === id);
  }
}

// Initialize blog manager when DOM is loaded
if (typeof window !== 'undefined') {
  window.BlogManager = BlogManager;
  
  document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on blog page
    if (document.getElementById('blog-posts')) {
      new BlogManager();
    }
  });
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BlogManager, blogPosts };
}