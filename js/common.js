/**
 * Common Template Manager
 * Generates consistent header and footer across all pages
 */

(function() {
  'use strict';

  // ===== THEME — apply saved preference immediately to prevent FOUC =====
  var savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Determine the current page for active navigation
  function getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('blog.html')) return 'blog';
    if (path.includes('posts/')) return 'blog';
    if (path.includes('index.html') || path === '/' || path.endsWith('/')) return 'home';
    return 'home';
  }

  // Get the root path based on current location
  function getRootPath() {
    const path = window.location.pathname;
    if (path.includes('posts/')) return '../';
    return '';
  }

  // Generate header HTML
  function generateHeader() {
    const currentPage = getCurrentPage();
    const rootPath = getRootPath();
    
    return `
      <div class="header-content">
        <nav>
          <a href="${rootPath}index.html" class="${currentPage === 'home' ? 'active' : ''}">Home</a>
          <a href="${rootPath}blog.html" class="${currentPage === 'blog' ? 'active' : ''}">Blog</a>
        </nav>
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
          <i class="fas fa-moon icon-moon"></i>
          <i class="fas fa-sun icon-sun"></i>
        </button>
      </div>
    `;
  }

  // Generate footer HTML
  function generateFooter() {
    return `
      <p>&copy; 2025 Shivani Gowda KS. Built with passion for technology and continuous learning.</p>
    `;
  }

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', function() {
    // Insert header
    const header = document.querySelector('header');
    if (header && !header.querySelector('.header-content')) {
      header.innerHTML = generateHeader();
    }

    // Insert footer
    const footer = document.querySelector('footer');
    if (footer && !footer.querySelector('p')) {
      footer.innerHTML = generateFooter();
    }

    // Wire up dark mode toggle
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        if (isDark) {
          html.removeAttribute('data-theme');
          localStorage.setItem('theme', 'light');
        } else {
          html.setAttribute('data-theme', 'dark');
          localStorage.setItem('theme', 'dark');
        }
      });
    }
  });
})();