/**
 * AI Agent — Browser-based LLM chat widget
 * Uses WebLLM (MLC) to run a small language model client-side via WebGPU.
 * No server required — everything runs in the visitor's browser.
 *
 * Include css/ai-agent.css + this script on any page to enable the agent.
 */
(function () {
  'use strict';

  // ---- Configuration ----
  const MODEL_ID = 'SmolLM2-360M-Instruct-q4f16_1-MLC';
  const SYSTEM_PROMPT =
    'You are Shimmy, a friendly and concise AI assistant on Shivani Gowda KS\'s portfolio website. ' +
    'Your knowledge is based on the context provided to you, I speak on behalf of Shivani, you are not Shivani itself.' +
    'Keep responses concise (2-3 sentences). If you don\'t know something specific about Shivani, say so honestly.';

  // ---- State ----
  let engine = null;
  let isEngineLoading = false;
  let isGenerating = false;
  let chatHistory = [{ role: 'system', content: SYSTEM_PROMPT }];
  let ragChunks = null;    // array of {id, title, text, embedding} from embeddings.json
  let embedder = null;     // transformers.js pipeline, loaded lazily
  let embedderLoading = null; // Promise, prevents duplicate loads

  // ---- RAG: load embeddings.json (text + vectors) ----
  function loadRAGChunks() {
    fetch('/embeddings.json')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        ragChunks = data || null;
        if (ragChunks) console.log('[Shimmy] Loaded', ragChunks.length, 'RAG chunks with embeddings');
      })
      .catch(function() { /* silent — RAG is optional */ });
  }

  // ---- RAG: load the in-browser embedding model (lazy, shared with WebLLM load) ----
  function ensureEmbedder() {
    if (embedder) return Promise.resolve(embedder);
    if (embedderLoading) return embedderLoading;
    embedderLoading = import('https://esm.run/@huggingface/transformers')
      .then(function(transformers) {
        return transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2',
          { dtype: 'fp32', device: 'cpu' });
      })
      .then(function(pipe) {
        embedder = pipe;
        console.log('[Shimmy] Embedding model ready');
        return embedder;
      })
      .catch(function(e) {
        console.warn('[Shimmy] Could not load embedding model, falling back to keyword search:', e);
        embedderLoading = null;
        return null;
      });
    return embedderLoading;
  }

  // ---- RAG: cosine similarity ----
  function cosineSim(a, b) {
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
  }

  // ---- RAG: keyword fallback (used when embedder hasn't loaded yet) ----
  var STOP_WORDS = new Set([
    'a','an','the','is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','must','shall',
    'can','i','you','he','she','it','we','they','me','him','her','us','them','my',
    'your','his','its','our','their','this','that','these','those','in','on','at',
    'to','for','of','with','by','from','as','into','about','and','or','but','if',
    'so','not','no','what','how','when','where','why','which','who','just','also'
  ]);
  function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
      .filter(function(w){ return w.length > 2 && !STOP_WORDS.has(w); });
  }
  function keywordRetrieve(query, topK) {
    var qT = new Set(tokenize(query));
    if (!qT.size) return '';
    var scored = ragChunks.map(function(c) {
      var ct = tokenize(c.text);
      return { c: c, s: ct.filter(function(w){ return qT.has(w); }).length / Math.sqrt(ct.length+1) };
    });
    scored.sort(function(a,b){ return b.s-a.s; });
    return scored.slice(0,topK).filter(function(x){ return x.s>0; })
      .map(function(x){ return '['+x.c.title+']\n'+x.c.text; }).join('\n\n');
  }

  // ---- RAG: async retrieval (vector if embedder ready, else keyword) ----
  async function retrieveContext(query, topK) {
    topK = topK || 3;
    if (!ragChunks || !ragChunks.length) return '';
    var pipe = await ensureEmbedder();
    if (!pipe) return keywordRetrieve(query, topK);   // fallback
    var out = await pipe(query, { pooling: 'mean', normalize: true });
    var qVec = Array.from(out.data);
    var scored = ragChunks
      .filter(function(c) { return c.embedding && c.embedding.length; })
      .map(function(c) { return { c: c, s: cosineSim(qVec, c.embedding) }; });
    scored.sort(function(a,b){ return b.s-a.s; });
    return scored.slice(0,topK).filter(function(x){ return x.s>0.2; })
      .map(function(x){ return '['+x.c.title+']\n'+x.c.text; }).join('\n\n');
  }

  // ---- Sparkle SVG icon ----
  const SPARKLE_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L13.09 8.26L18 5L14.74 9.91L21 11L14.74 12.09L18 17L13.09 13.74L12 20L10.91 13.74L6 17L9.26 12.09L3 11L9.26 9.91L6 5L10.91 8.26L12 2Z"
          fill="#4ade80" stroke="#4ade80" stroke-width="0.5"/>
  </svg>`;
  const SPARKLE_SMALL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="#4ade80"/>
  </svg>`;

  // ---- DOM references (populated after injection) ----
  let els = {};

  // ---- Inject HTML ----
  function injectHTML() {
    var wrapper = document.createElement('div');
    wrapper.className = 'ai-agent-wrapper';
    wrapper.id = 'ai-agent-wrapper';
    wrapper.innerHTML =
      '<div class="ai-thought-bubble" id="ai-thought">' +
        "I'm <strong>Shimmy</strong>, Shivani's personal AI. Ask me anything!" +
      '</div>' +
      '<span class="ai-thought-dot-0" id="ai-dot-0"></span>' +
      '<span class="ai-thought-dot-1" id="ai-dot-1"></span>' +
      '<span class="ai-thought-dot-2" id="ai-dot-2"></span>' +

      '<div class="ai-chat-panel" id="ai-chat-panel">' +
        '<div class="ai-chat-header">' +
          '<div class="ai-chat-header-info">' +
            '<div class="ai-chat-avatar">' + SPARKLE_SMALL + '</div>' +
            '<div>' +
              '<div class="ai-chat-name">Shimmy</div>' +
              '<div class="ai-chat-status" id="ai-status">powered by WebLLM</div>' +
            '</div>' +
          '</div>' +
          '<button class="ai-chat-close" id="ai-close-btn" aria-label="Close chat">&times;</button>' +
        '</div>' +

        '<div class="ai-loading-bar" id="ai-loading">' +
          '<div class="ai-loading-text" id="ai-loading-text">Preparing model…</div>' +
          '<div class="ai-progress-track"><div class="ai-progress-fill" id="ai-progress-fill"></div></div>' +
        '</div>' +

        '<div class="ai-chat-messages" id="ai-messages">' +
          '<div class="ai-msg ai-msg-bot">Hi! I\'m <strong>Shimmy</strong>, Shivani\'s personal AI assistant. ' +
          'I run entirely in your browser using WebGPU — no data leaves your device. Ask me anything!</div>' +
        '</div>' +

        '<div class="ai-chat-input">' +
          '<input type="text" id="ai-input" placeholder="Ask me anything…" autocomplete="off">' +
          '<button id="ai-send-btn">Send</button>' +
        '</div>' +
      '</div>' +

      '<button class="ai-agent-btn" id="ai-agent-btn" aria-label="Open AI chat">' +
        SPARKLE_SVG +
      '</button>';

    document.body.appendChild(wrapper);

    // Cache references
    els.wrapper     = wrapper;
    els.btn         = document.getElementById('ai-agent-btn');
    els.thought     = document.getElementById('ai-thought');
    els.dots        = [document.getElementById('ai-dot-0'), document.getElementById('ai-dot-1'), document.getElementById('ai-dot-2')];
    els.panel       = document.getElementById('ai-chat-panel');
    els.messages    = document.getElementById('ai-messages');
    els.input       = document.getElementById('ai-input');
    els.sendBtn     = document.getElementById('ai-send-btn');
    els.closeBtn    = document.getElementById('ai-close-btn');
    els.loading     = document.getElementById('ai-loading');
    els.loadingText = document.getElementById('ai-loading-text');
    els.progressFill= document.getElementById('ai-progress-fill');
    els.status      = document.getElementById('ai-status');
  }

  // ---- Event wiring ----
  function bindEvents() {
    els.btn.addEventListener('click', toggleChat);
    els.closeBtn.addEventListener('click', closeChat);
    els.sendBtn.addEventListener('click', sendMessage);
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-hide thought bubble after 30 seconds
    setTimeout(function () {
      if (els.thought) els.thought.classList.add('hidden');
      if (els.dots) els.dots.forEach(function(d){ d.classList.add('hidden'); });
    }, 30000);
  }

  // ---- Chat toggle ----
  function toggleChat() {
    var isOpen = els.panel.classList.contains('active');
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  function openChat() {
    els.panel.classList.add('active');
    els.thought.classList.add('hidden');
    if (els.dots) els.dots.forEach(function(d){ d.classList.add('hidden'); });
    els.input.focus();

    // Lazy-load embeddings + engine only when chat first opens
    if (!ragChunks) loadRAGChunks();
    if (!engine && !isEngineLoading) loadEngine();
  }

  function closeChat() {
    els.panel.classList.remove('active');

    // Unload LLM engine and free all memory
    if (engine) {
      try { engine.unload(); } catch(e) { /* not all versions expose unload */ }
      engine = null;
    }
    isEngineLoading = false;
    isGenerating = false;

    // Release RAG data and embedding model
    ragChunks = null;
    embedder = null;
    embedderLoading = null;

    // Reset chat history to system prompt only
    chatHistory = [{ role: 'system', content: SYSTEM_PROMPT }];

    // Reset UI
    els.messages.innerHTML =
      '<div class="ai-msg ai-msg-bot">Hi! I\'m <strong>Shimmy</strong>, Shivani\'s personal AI assistant. ' +
      'I run entirely in your browser using WebGPU — no data leaves your device. Ask me anything!</div>';
    els.status.textContent = 'powered by WebLLM';
    els.loading.classList.remove('active');
    els.progressFill.style.width = '0%';
    els.sendBtn.disabled = false;
  }

  // ---- WebLLM Engine ----
  async function loadEngine() {
    // Check WebGPU support
    if (!navigator.gpu) {
      addSystemMessage(
        'Your browser does not support WebGPU. Please try Chrome 113+, Edge 113+, or a recent Safari/Firefox.'
      );
      return;
    }

    isEngineLoading = true;
    els.loading.classList.add('active');
    els.status.textContent = 'loading model…';
    els.loadingText.textContent = 'Downloading model (first time only)…';
    els.progressFill.style.width = '0%';

    try {
      var webllm = await import('https://esm.run/@mlc-ai/web-llm');

      engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: function (report) {
          var pct = Math.round((report.progress || 0) * 100);
          els.progressFill.style.width = pct + '%';
          els.loadingText.textContent = report.text || ('Loading… ' + pct + '%');
        }
      });

      els.loading.classList.remove('active');
      els.status.textContent = 'online — running locally';
      isEngineLoading = false;

    } catch (err) {
      isEngineLoading = false;
      els.loading.classList.remove('active');
      els.status.textContent = 'failed to load';
      console.error('[SAi] Engine load error:', err);

      addSystemMessage(
        'Could not load the AI model. Error: ' + (err.message || err) +
        '. Make sure you\'re using a WebGPU-compatible browser (Chrome 113+).'
      );
    }
  }

  // ---- Messaging ----
  async function sendMessage() {
    var text = els.input.value.trim();
    if (!text || isGenerating) return;

    // Add user message
    addMessage(text, 'user');
    els.input.value = '';

    // Augment with retrieved context (vector search, async)
    var context = await retrieveContext(text);
    var msgContent = context
      ? 'Relevant context:\n' + context + '\n\nUser question: ' + text
      : text;
    chatHistory.push({ role: 'user', content: msgContent });

    if (!engine) {
      if (isEngineLoading) {
        addSystemMessage('Model is still loading, please wait…');
      } else {
        addSystemMessage('Model not loaded. Please wait or refresh the page.');
      }
      return;
    }

    // Generate response
    isGenerating = true;
    els.sendBtn.disabled = true;

    // Add placeholder for bot response
    var botEl = addMessage('', 'bot');
    botEl.innerHTML = '<span class="ai-typing"><span></span><span></span><span></span></span>';

    try {
      var chunks = await engine.chat.completions.create({
        messages: chatHistory,
        stream: true,
        max_tokens: 256,
        temperature: 0.7,
      });

      var fullResponse = '';
      for await (var chunk of chunks) {
        var delta = chunk.choices[0]?.delta?.content || '';
        fullResponse += delta;
        botEl.textContent = fullResponse;
        scrollToBottom();
      }

      chatHistory.push({ role: 'assistant', content: fullResponse });

    } catch (err) {
      console.error('[SAi] Generation error:', err);
      botEl.textContent = 'Sorry, something went wrong. Please try again.';
      botEl.classList.add('ai-msg-system');
      botEl.classList.remove('ai-msg-bot');
    }

    isGenerating = false;
    els.sendBtn.disabled = false;
    els.input.focus();
  }

  // ---- DOM helpers ----
  function addMessage(text, role) {
    var div = document.createElement('div');
    div.className = 'ai-msg ' + (role === 'user' ? 'ai-msg-user' : 'ai-msg-bot');
    div.textContent = text;
    els.messages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function addSystemMessage(text) {
    var div = document.createElement('div');
    div.className = 'ai-msg ai-msg-system';
    div.textContent = text;
    els.messages.appendChild(div);
    scrollToBottom();
  }

  function scrollToBottom() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  // ---- Init ----
  function init() {
    injectHTML();
    bindEvents();
    // Nothing loaded here — all resources load lazily when chat opens
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
