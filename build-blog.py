#!/usr/bin/env python3
"""
Blog Post Generator - Converts Markdown to HTML using the blog template
Usage: python3 build-blog.py path/to/post.md
"""

import sys
import os
import re
from datetime import datetime
import markdown
from pathlib import Path

# Blog post template
TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} - Shivani Gowda KS</title>
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  
  <!-- Common Styles -->
  <link rel="stylesheet" href="../css/common.css">
  <link rel="stylesheet" href="../css/blog-post.css">
  
  <style>
    :root {{
      --primary-color: #333333;
      --secondary-color: #555555;
      --accent-color: #666666;
      --text-color: #222222;
      --text-light: #666666;
      --bg-primary: #ffffff;
      --bg-secondary: #f8f9fa;
      --border-color: #dee2e6;
      --shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      --gradient: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    }}

    * {{
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }}

    body {{
      font-family: 'Source Sans 3', 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-color);
      line-height: 1.7;
    }}

    h1, h2, h3, h4, h5, h6 {{
      font-family: 'Source Serif 4', 'Georgia', serif;
      font-weight: 600;
      color: var(--text-color);
    }}

    .container {{
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }}

    .post-header {{
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border-color);
    }}

    .post-title {{
      font-size: 2.5rem;
      margin-bottom: 1rem;
      line-height: 1.2;
    }}

    .post-subtitle {{
      font-style: italic;
      color: var(--text-light);
      margin-bottom: 1.5rem;
      font-size: 1.1rem;
    }}

    .post-meta {{
      color: var(--text-light);
      font-size: 0.95rem;
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      flex-wrap: wrap;
    }}

    .post-category {{
      background: var(--accent-color);
      color: white;
      padding: 6px 14px;
      border-radius: 15px;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}

    .post-content {{
      font-size: 1.1rem;
      line-height: 1.8;
      margin-bottom: 3rem;
    }}

    .post-content h2 {{
      font-size: 1.8rem;
      margin: 2rem 0 1rem 0;
      color: var(--primary-color);
    }}

    .post-content h3 {{
      font-size: 1.4rem;
      margin: 1.5rem 0 0.8rem 0;
      color: var(--primary-color);
    }}

    .post-content p {{
      margin-bottom: 1.5rem;
    }}

    .post-content ul, .post-content ol {{
      margin: 1rem 0 1.5rem 2rem;
    }}

    .post-content li {{
      margin-bottom: 0.5rem;
    }}

    .post-content blockquote {{
      border-left: 4px solid var(--primary-color);
      padding-left: 1.5rem;
      margin: 1.5rem 0;
      font-style: italic;
      color: var(--text-light);
      background: var(--bg-secondary);
      padding: 1rem 1rem 1rem 2rem;
      border-radius: 4px;
    }}

    .post-content code {{
      background: var(--bg-secondary);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9em;
      color: #d73a49;
    }}

    .post-content pre {{
      background: #f6f8fa;
      padding: 1.5rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
      border: 1px solid var(--border-color);
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.85rem;
      line-height: 1.4;
    }}

    .post-content pre code {{
      background: none;
      padding: 0;
      color: #24292e;
    }}

    .post-tags {{
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }}

    .tag {{
      background: var(--bg-secondary);
      color: var(--text-color);
      padding: 6px 12px;
      border-radius: 15px;
      font-size: 0.8rem;
      border: 1px solid var(--border-color);
    }}

    .back-to-blog {{
      text-align: center;
      padding: 2rem 0;
      border-top: 1px solid var(--border-color);
    }}

    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 12px 24px;
      background: var(--gradient);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.3s ease;
    }}

    .btn:hover {{
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
    }}

    .highlight-box {{
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-left: 4px solid #f39c12;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1.5rem 0;
    }}

    .highlight-box.danger {{
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-left: 4px solid #dc3545;
    }}

    .highlight-box.success {{
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-left: 4px solid #28a745;
    }}

    .highlight-box p {{
      margin-bottom: 0.5rem;
    }}

    .highlight-box ul {{
      margin-bottom: 0;
    }}

    .post-content a {{
      color: var(--primary-color);
      text-decoration: underline;
      transition: color 0.3s ease;
    }}

    .post-content a:hover {{
      color: var(--accent-color);
    }}

    .table-container {{
      overflow-x: auto;
      margin: 1.5rem 0;
    }}

    .post-content table {{
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.95rem;
    }}

    .post-content table th,
    .post-content table td {{
      border: 1px solid var(--border-color);
      padding: 12px;
      text-align: left;
    }}

    .post-content table th {{
      background: var(--bg-secondary);
      font-weight: 600;
      color: var(--primary-color);
    }}

    .post-content table tbody tr:nth-child(even) {{
      background: #f9f9f9;
    }}

    .visual-box {{
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
      margin: 2rem 0;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9rem;
      line-height: 1.6;
    }}

    @media (max-width: 768px) {{
      .container {{
        padding: 1rem;
      }}
      
      .post-title {{
        font-size: 2rem;
      }}
      
      .post-meta {{
        flex-direction: column;
        align-items: center;
        gap: 0.8rem;
      }}
      
      .post-content {{
        font-size: 1rem;
      }}
      
      .post-content pre {{
        font-size: 0.8rem;
        padding: 1rem;
      }}
      
      .visual-box {{
        font-size: 0.8rem;
        padding: 1rem;
      }}
    }}
  </style>
</head>

<body>
  <!-- Header (auto-generated by common.js) -->
  <header></header>

  <div class="container">
    <div class="post-header">
      <h1 class="post-title">{title}</h1>
      <div class="post-subtitle">{subtitle}</div>
      <div class="post-meta">
        <span class="post-category">{category}</span>
        <span><i class="far fa-calendar"></i> {date}</span>
        <span><i class="far fa-clock"></i> {read_time} min read</span>
      </div>
    </div>

    <div class="post-content">
{content}
    </div>

    <div class="post-footer-nav">
{nav_prev}
{nav_next}
    </div>

    <div class="post-tags">
{tags}
    </div>

  </div>

  <!-- Footer (auto-generated by common.js) -->
  <footer></footer>

  <!-- Scripts -->
  <script src="../js/common.js"></script>
</body>
</html>
"""


def parse_frontmatter(content):
    """Parse YAML-style frontmatter from markdown"""
    frontmatter = {}
    
    # Check if content starts with ---
    if not content.startswith('---'):
        return frontmatter, content
    
    # Find the end of frontmatter
    end_match = re.search(r'\n---\n', content[3:])
    if not end_match:
        return frontmatter, content
    
    end_pos = end_match.end() + 3
    fm_text = content[3:end_pos-4]
    body = content[end_pos:]
    
    # Parse frontmatter
    for line in fm_text.strip().split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            
            # Handle tags as list
            if key == 'tags':
                frontmatter[key] = [t.strip() for t in value.split(',')]
            else:
                frontmatter[key] = value
    
    return frontmatter, body


def estimate_read_time(content):
    """Estimate reading time based on word count"""
    words = len(content.split())
    minutes = max(1, round(words / 200))  # Average reading speed: 200 words/min
    return minutes


def convert_markdown_to_html(md_file_path):
    """Convert a markdown file to HTML using the blog template"""
    
    # Read markdown file
    with open(md_file_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Parse frontmatter
    frontmatter, body = parse_frontmatter(md_content)
    
    # Get metadata with defaults
    title = frontmatter.get('title', 'Untitled Post')
    subtitle = frontmatter.get('subtitle', '')
    category = frontmatter.get('category', 'Technology')
    date = frontmatter.get('date', datetime.now().strftime('%B %d, %Y'))
    read_time = frontmatter.get('read_time', estimate_read_time(body))
    tags = frontmatter.get('tags', [])
    prev_post = frontmatter.get('prev_post', '')
    prev_title = frontmatter.get('prev_title', '')
    next_post = frontmatter.get('next_post', '')
    next_title = frontmatter.get('next_title', '')
    
    # Convert markdown to HTML
    md = markdown.Markdown(extensions=['extra', 'codehilite', 'fenced_code', 'tables'])
    html_content = md.convert(body)
    
    # Add disclaimer if specified
    if frontmatter.get('disclaimer', 'true').lower() == 'true':
        disclaimer = '<p style="font-size: 0.8rem; color: #666; font-style: italic; margin-bottom: 2rem;">[Disclaimer: This blog was written solely for my understanding purpose only. Any mistakes found that need to be addressed, please feel free to reach out to me.]</p>\n      '
        html_content = disclaimer + html_content
    
    # Generate tags HTML
    tags_html = '\n'.join([f'      <span class="tag">{tag}</span>' for tag in tags])
    
    # Generate navigation HTML
    nav_prev = ''
    if prev_post and prev_title:
        nav_prev = f'''      <a href="{prev_post}" class="nav-btn nav-btn-prev">
        <i class="fas fa-arrow-left"></i>
        <div class="nav-btn-text">
          <span class="nav-label">Previous Post</span>
          <span class="nav-title">{prev_title}</span>
        </div>
      </a>'''
    
    nav_next = ''
    if next_post and next_title:
        nav_next = f'''      <a href="{next_post}" class="nav-btn nav-btn-next">
        <div class="nav-btn-text">
          <span class="nav-label">Next Post</span>
          <span class="nav-title">{next_title}</span>
        </div>
        <i class="fas fa-arrow-right"></i>
      </a>'''
    
    # Fill template
    html = TEMPLATE.format(
        title=title,
        subtitle=subtitle,
        category=category,
        date=date,
        read_time=read_time,
        content=html_content,
        tags=tags_html,
        nav_prev=nav_prev,
        nav_next=nav_next
    )
    
    # Generate output filename
    md_path = Path(md_file_path)
    output_file = md_path.stem + '.html'
    output_path = Path('posts') / output_file
    
    # Create posts directory if it doesn't exist
    output_path.parent.mkdir(exist_ok=True)
    
    # Write HTML file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"✅ Successfully generated: {output_path}")
    return output_path


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 build-blog.py path/to/post.md")
        print("\nExample:")
        print("  python3 build-blog.py drafts/my-new-post.md")
        sys.exit(1)
    
    md_file = sys.argv[1]
    
    if not os.path.exists(md_file):
        print(f"❌ Error: File not found: {md_file}")
        sys.exit(1)
    
    if not md_file.endswith('.md'):
        print(f"❌ Error: File must be a Markdown file (.md)")
        sys.exit(1)
    
    convert_markdown_to_html(md_file)


if __name__ == '__main__':
    main()
