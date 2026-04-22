#!/usr/bin/env python3
"""
Blog Post Generator - Converts Markdown to HTML using the blog template.

Usage:
  python3 build-blog.py drafts/your-post.md    # Build a post and register it
  python3 build-blog.py --rebuild-index         # Regenerate blog-manager.js from posts.json
"""

import sys
import os
import re
import json
from datetime import datetime
import markdown
from pathlib import Path
from html.parser import HTMLParser

try:
    from sentence_transformers import SentenceTransformer
    HAS_ST = True
except ImportError:
    HAS_ST = False

# Path constants
SCRIPT_DIR = Path(__file__).resolve().parent
POSTS_JSON = SCRIPT_DIR / 'posts.json'
BLOG_MANAGER_JS = SCRIPT_DIR / 'js' / 'blog-manager.js'
EMBEDDINGS_JSON       = SCRIPT_DIR / 'embeddings.json'
CONTEXT_CHUNKS_JSON  = SCRIPT_DIR / 'context-chunks.json'
EMBEDDING_MODEL  = 'all-MiniLM-L6-v2'
CHUNK_WORDS      = 200
CHUNK_OVERLAP    = 40

# ── Portfolio context for Shimmy (edit when your bio or projects change) ────
# After editing, regenerate with: python3 build-blog.py --build-embeddings
BIO_TEXT = (
    # ── Identity ────────────────────────────────────────────────────────────
    "Shivani Gowda KS is a Cloud Engineer (via LTIMindtree, vendor to Microsoft) based in Bellevue, WA, USA. "
    "She works on AI/ML systems, LLM inference optimisation, GPU performance, and Microsoft Azure cloud "
    "infrastructure. She describes herself as an engineer who enjoys understanding why things work just as "
    "much as how they work, preferring to slow down, get the fundamentals solid, and then move fast with "
    "confidence. She loves the blend of research and engineering — building ML tools, experimenting with "
    "agents, and making complex ideas work in the real world. "

    # ── Work experience ──────────────────────────────────────────────────────
    "PROFESSIONAL EXPERIENCE: "

    "Cloud Engineer at LTIMindtree (vendor to Microsoft), Bellevue WA, March 2024 – Present. "
    "Working on Azure cloud infrastructure and AI/ML systems at Microsoft. "

    "Machine Learning Engineer (Contract) at Flavor, Remote USA, November 2023 – January 2024. "

    "Machine Learning Engineer (Intern then Full-time) at PixStory, Remote USA, January 2023 – December 2023. "
    "Tools: Python, Flask, SQLite, Apache Airflow, BERT, NLLB, Transformers. "
    "Built ETL pipelines with Airflow achieving a 31% performance boost. "
    "Built a Flask and SQLite annotation platform with RESTful APIs for real-time labeling, "
    "achieving a 15% increase in data collection efficiency. "
    "Fine-tuned multilingual transformer models for hate speech classification. "
    "Benchmarked embedding models for unstructured data indexing. "

    "Graduate Research Assistant at Loyola Marymount University, Los Angeles CA, June 2022 – December 2022. "
    "Tools: PyTorch, Transformers, Data Processing. "
    "Improved a diet tracking system's performance by 21.8% by replacing an RNN+LSTM architecture "
    "with a transformer architecture. "
    "Collected and analysed large datasets, identified bottlenecks, and boosted F1-score by 5.2%. "
    "Published a research paper at ICASSP 2023 on multi-modal food classification. "

    "Application Developer at IBM, India, December 2019 – May 2021. "
    "Tools: Java, Spring Boot, OpenShift, GitLab, Jenkins. "
    "Developed backend logic for a CPQ (Configure Price Quote) system using Java and Spring Boot. "
    "Assisted in migrating legacy services to cloud-native microservices on OpenShift. "
    "Used CI/CD pipelines with GitLab and Jenkins to execute deployments and run validation scripts. "

    # ── Education ────────────────────────────────────────────────────────────
    "EDUCATION: "

    "Master of Science in Computer Science, Loyola Marymount University, Los Angeles CA, August 2021 – May 2023. "
    "Received the Outstanding Graduate Award in Computer Science from the Frank R. Seaver College of "
    "Science and Engineering. "

    "Bachelor of Technology in Electrical and Electronics Engineering, "
    "Amrita School of Engineering, Bengaluru, India, June 2015 – May 2019. "

    # ── Skills ───────────────────────────────────────────────────────────────
    "SKILLS AND TECHNOLOGIES: "
    "Programming languages: Python, C, C++, Java, Bash/Shell scripting, SQL. "
    "AI and ML: PyTorch, Hugging Face Transformers, ONNX, LangChain, Pandas, scikit-learn, NumPy. "
    "Cloud and DevOps: Microsoft Azure, AWS, OpenShift, Docker, Jenkins, CI/CD pipelines. "
    "Tools and platforms: Linux, Git, Wireshark, Postman, Apache Spark, Grafana. "
    "Databases: SQLite, MySQL. "
    "Web development: Flask, FastAPI, Spring Boot, HTML, CSS, JavaScript, React. "
    "Additional: CUDA, TensorRT, distributed training, LLM inference optimisation, GPU performance tuning. "

    # ── Projects ─────────────────────────────────────────────────────────────
    "PROJECTS: "

    "Multi-Modal Food Classification in a Diet Tracking System. "
    "Tech: PyTorch, TensorFlow, Vision, Speech, Data Pipelines. "
    "Applied multi-modal deep learning (vision and speech inputs) to classify food items for a diet-tracking "
    "system. Built scalable data collection and preprocessing pipelines, created a web scraper to gather "
    "training data at scale. Improved F1 scores through dataset cleaning and augmentation. "
    "Published at ICASSP 2023. GitHub: github.com/sgowdaks/food-detection. "

    "Nichirin: Webcrawler and Retrieval-Augmented Generator. "
    "Tech: Apache Solr, Apache Spark, Python, Scrapy, Selenium. "
    "A multi-level web crawler combined with a retrieval-augmented generator using Apache Solr for text "
    "indexing and retrieval and Apache Spark for parallel processing and scalable indexing. "
    "Includes preprocessing pipelines to structure raw HTML and text for downstream embedding and retrieval. "
    "Published to PyPI (pip install nichirin) and open sourced on GitHub at github.com/sgowdaks/nichirin. "

    # ── Blog and research interests ──────────────────────────────────────────
    "BLOG AND RESEARCH INTERESTS: "
    "Shivani writes a technical blog on her portfolio site covering topics she has studied in depth: "
    "KV caching and LLM inference optimisation, flash attention vs kernel fusion, "
    "positional embeddings in transformers (RoPE, ALiBi, sinusoidal), "
    "distributed training parallelism (data, tensor, pipeline), "
    "CPU vs GPU vs NPU for LLM inference, grouped-query attention and LLM efficiency, "
    "LLM inference with quantisation and speculative decoding, "
    "and the libtorch static vs dynamic linking journey in C++. "
    "She is particularly passionate about making LLMs run faster and understanding inference at the systems level. "

    # ── Contact ───────────────────────────────────────────────────────────────
    "CONTACT: "
    "Website: sgowdaks.github.io. GitHub: github.com/sgowdaks. "
    "Contact via LinkedIn, GitHub, or email — all linked from the portfolio site."
)

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
  <link rel="stylesheet" href="../css/ai-agent.css">
  
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
  <script src="../js/ai-agent.js"></script>
</body>
</html>
"""


# ── HTML stripper (stdlib) ──────────────────────────────────────────────────
class _HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self._parts = []
    def handle_data(self, data):
        self._parts.append(data)
    def get_text(self):
        return ' '.join(self._parts)

def _strip_html(html_str):
    s = _HTMLStripper()
    s.feed(html_str)
    return s.get_text()

def _chunk_text(text, size=CHUNK_WORDS, overlap=CHUNK_OVERLAP):
    """Split text into overlapping word-based chunks."""
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = ' '.join(words[i:i + size])
        if len(chunk.split()) >= 20:
            chunks.append(chunk)
        i += size - overlap
    return chunks


def generate_embeddings():
    """Chunk bio + all blog posts and write embeddings.json for Shimmy RAG.

    Text chunks are always written (used for keyword search in the browser).
    If sentence-transformers is installed, embedding vectors are also added.
    """
    print('🔄 Generating RAG chunks...')
    records = []

    # --- Bio chunks ---
    for i, chunk in enumerate(_chunk_text(BIO_TEXT)):
        records.append({'id': f'bio-{i}', 'source': 'bio',
                        'title': 'About Shivani', 'text': chunk})

    # --- Blog post chunks ---
    posts_dir = SCRIPT_DIR / 'posts'
    if posts_dir.exists():
        title_map = {p['id']: p['title'] for p in load_posts_json()}
        for html_file in sorted(posts_dir.glob('*.html')):
            post_id    = html_file.stem
            post_title = title_map.get(post_id, post_id)
            html       = html_file.read_text(encoding='utf-8')
            m = re.search(
                r'<div class="post-content">(.*?)<div class="post-footer-nav">',
                html, re.DOTALL
            )
            raw = _strip_html(m.group(1) if m else html)
            text = re.sub(r'\s+', ' ', raw).strip()
            for j, chunk in enumerate(_chunk_text(text)):
                records.append({'id': f'{post_id}-{j}', 'source': 'blog',
                                'title': post_title, 'text': chunk})

    if HAS_ST:
        print(f'   Embedding {len(records)} chunks with sentence-transformers…')
        model = SentenceTransformer(EMBEDDING_MODEL)
        embeddings = model.encode(
            [r['text'] for r in records],
            normalize_embeddings=True, show_progress_bar=True
        )
        for record, emb in zip(records, embeddings):
            record['embedding'] = emb.tolist()
    else:
        print(f'   sentence-transformers not found — storing text chunks only (keyword search will be used).')
        print('   Install with: pip install sentence-transformers  to also store embedding vectors.')

    EMBEDDINGS_JSON.write_text(
        json.dumps(records, separators=(',', ':')), encoding='utf-8'
    )
    print(f'✅ Saved {len(records)} chunks → {EMBEDDINGS_JSON}')

    # Write a lightweight text-only file for client-side keyword retrieval
    slim = [{'id': r['id'], 'title': r['title'], 'source': r['source'], 'text': r['text']}
            for r in records]
    CONTEXT_CHUNKS_JSON.write_text(
        json.dumps(slim, separators=(',', ':')), encoding='utf-8'
    )
    print(f'\u2705 Saved slim context \u2192 {CONTEXT_CHUNKS_JSON}')


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


def load_posts_json():
    """Load the posts registry"""
    if POSTS_JSON.exists():
        with open(POSTS_JSON, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_posts_json(posts):
    """Save the posts registry"""
    with open(POSTS_JSON, 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2, ensure_ascii=False)
        f.write('\n')


def normalize_date(date_str):
    """Convert human-readable date to YYYY-MM-DD for sorting"""
    for fmt in ('%B %d, %Y', '%b %d, %Y', '%Y-%m-%d', '%B %Y', '%d %B %Y'):
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return date_str


def register_post(post_id, frontmatter, excerpt_text):
    """Add or update a post entry in posts.json"""
    posts = load_posts_json()

    category_raw = frontmatter.get('category', 'Technology')
    category_key = category_raw.lower()[:4]  # 'tech', 'life', etc.

    entry = {
        'id': post_id,
        'title': frontmatter.get('title', 'Untitled Post'),
        'date': normalize_date(frontmatter.get('date', datetime.now().strftime('%B %d, %Y'))),
        'category': category_key,
        'categoryLabel': category_raw,
        'excerpt': frontmatter.get('excerpt', excerpt_text),
        'tags': frontmatter.get('tags', []),
    }

    # Update existing or append new
    for i, p in enumerate(posts):
        if p['id'] == post_id:
            posts[i] = entry
            break
    else:
        posts.append(entry)

    save_posts_json(posts)
    return entry


def generate_blog_manager_js():
    """Regenerate js/blog-manager.js from posts.json"""
    posts = load_posts_json()
    # Sort by date descending for the default order
    posts.sort(key=lambda p: p.get('date', ''), reverse=True)

    posts_js = json.dumps(posts, indent=4, ensure_ascii=False)

    js_content = f"""/**
 * Blog Manager — AUTO-GENERATED from posts.json
 * Do not edit manually. Run: python3 build-blog.py --rebuild-index
 */

(function() {{
  'use strict';

  const blogPosts = {posts_js};

  window.BlogManager = {{
    getAllPosts: function() {{
      return blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    }},

    getRecentPosts: function(count = 3) {{
      return this.getAllPosts().slice(0, count);
    }},

    getPostById: function(id) {{
      return blogPosts.find(post => post.id === id);
    }},

    getPostsByCategory: function(category) {{
      return blogPosts.filter(post => post.category === category);
    }},

    getPostsByTag: function(tag) {{
      return blogPosts.filter(post => post.tags.includes(tag));
    }}
  }};
}})();
"""
    BLOG_MANAGER_JS.parent.mkdir(exist_ok=True)
    with open(BLOG_MANAGER_JS, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"✅ Regenerated {BLOG_MANAGER_JS}")


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

    # Auto-register in posts.json and regenerate blog-manager.js
    post_id = md_path.stem
    # Use first ~30 words of body as excerpt fallback
    excerpt_fallback = ' '.join(body.split()[:30]).rstrip('.,;:') + '...'
    register_post(post_id, frontmatter, excerpt_fallback)
    generate_blog_manager_js()
    print('\U0001f4a1 Run  python3 build-blog.py --build-embeddings  to refresh Shimmy\'s AI context.')

    return output_path


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 build-blog.py drafts/my-post.md      # Build post + update index")
        print("  python3 build-blog.py --rebuild-index         # Regenerate blog-manager.js from posts.json")
        print("  python3 build-blog.py --build-embeddings      # Regenerate embeddings.json + context-chunks.json for Shimmy RAG")
        return

    if sys.argv[1] == '--rebuild-index':
        generate_blog_manager_js()
        return

    if sys.argv[1] == '--build-embeddings':
        generate_embeddings()
        return

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
