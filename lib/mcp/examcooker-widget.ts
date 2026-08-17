export const EXAMCOOKER_WIDGET_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
  :root {
    color-scheme: light dark;
    --ec-bg: #C2E6EC;
    --ec-surface: #F8FDFE;
    --ec-surface-soft: #EAF6F8;
    --ec-surface-hover: #FFFFFF;
    --ec-border: rgba(13,88,117,0.18);
    --ec-border-hover: rgba(13,148,136,0.62);
    --ec-text: #0A2A36;
    --ec-text-soft: rgba(10,42,54,0.76);
    --ec-text-muted: rgba(10,42,54,0.56);
    --ec-divider: rgba(10,42,54,0.14);
    --ec-link: #0D5875;
    --ec-link-strong: #06384B;
    --ec-accent: #0D9488;
    --ec-accent-soft: rgba(13,148,136,0.13);
    --ec-accent-strong: #08756C;
    --ec-shadow: 0 14px 28px -20px rgba(13,88,117,0.56);
    --ec-radius: 8px;
    --ec-radius-sm: 6px;
    --ec-btn-bg: #0D9488;
    --ec-btn-fg: #FFFFFF;
    --ec-btn-hover-bg: #0B7E75;
    --ec-btn-secondary-fg: var(--ec-text);
    --ec-btn-secondary-border: rgba(10,42,54,0.28);
    --ec-focus: rgba(13,148,136,0.42);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ec-bg: #0C1222;
      --ec-surface: #111A2B;
      --ec-surface-soft: #101827;
      --ec-surface-hover: #172338;
      --ec-border: rgba(194,230,236,0.18);
      --ec-border-hover: rgba(59,244,199,0.64);
      --ec-text: #E6F4F5;
      --ec-text-soft: rgba(230,244,245,0.78);
      --ec-text-muted: rgba(230,244,245,0.54);
      --ec-divider: rgba(230,244,245,0.14);
      --ec-link: #6BFADB;
      --ec-link-strong: #9BFFE8;
      --ec-accent: #3BF4C7;
      --ec-accent-soft: rgba(59,244,199,0.12);
      --ec-accent-strong: #6BFADB;
      --ec-shadow: 0 18px 34px -22px rgba(0,0,0,0.72);
      --ec-btn-bg: #3BF4C7;
      --ec-btn-fg: #04241D;
      --ec-btn-hover-bg: #6BFADB;
      --ec-btn-secondary-fg: var(--ec-text);
      --ec-btn-secondary-border: rgba(230,244,245,0.3);
      --ec-focus: rgba(59,244,199,0.45);
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--ec-bg); color: var(--ec-text); }
  body {
    font-family: "Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    min-height: 100vh;
    font-size: 14px;
    line-height: 1.5;
  }
  .root { max-width: 1120px; margin: 0 auto; padding: 30px 32px 34px; }
  @media (max-width: 720px) {
    .root { padding: 24px 22px 28px; }
  }
  @media (max-width: 480px) {
    .root { padding: 20px 16px 24px; }
  }

  .status {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    min-height: 156px; padding: 28px 16px;
    color: var(--ec-text-muted); font-size: 13px; font-weight: 600;
    text-align: center;
  }
  .spinner {
    width: 15px; height: 15px; flex: 0 0 auto;
    border: 2px solid var(--ec-text-muted); border-top-color: transparent;
    border-radius: 50%; animation: spin 700ms linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .bar {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    min-height: 38px; margin-bottom: 20px; padding-bottom: 13px;
    border-bottom: 1px solid var(--ec-divider);
  }
  .bar-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
  .bar-title { font-size: 13px; font-weight: 700; color: var(--ec-text-soft); letter-spacing: 0.01em; }
  .bar-count { font-size: 12px; font-weight: 700; color: var(--ec-text-muted); }

  .back {
    display: inline-flex; align-items: center; gap: 7px;
    min-height: 32px; padding: 0 11px;
    font: 700 12px/1 inherit; letter-spacing: 0.01em;
    color: var(--ec-text-soft); background: var(--ec-surface);
    border: 1px solid var(--ec-border); border-radius: var(--ec-radius-sm);
    cursor: pointer; transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
  }
  .back:hover { border-color: var(--ec-border-hover); color: var(--ec-text); background: var(--ec-surface-hover); }
  .back:focus-visible, .tile:focus-visible, .row:focus-visible, .btn:focus-visible {
    outline: 0; box-shadow: 0 0 0 3px var(--ec-focus);
  }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(238px, 1fr)); gap: 12px; }
  .tile {
    position: relative; display: flex; flex-direction: column; gap: 13px;
    min-height: 164px; padding: 17px 18px 15px;
    overflow: hidden; text-align: left; text-decoration: none;
    color: var(--ec-text); background: var(--ec-surface);
    border: 1px solid var(--ec-border); border-radius: var(--ec-radius);
    font-family: inherit; font-size: inherit; line-height: inherit;
    cursor: pointer; transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 200ms ease;
  }
  .tile::before {
    content: ""; position: absolute; inset: 0 auto 0 0; width: 3px;
    background: var(--ec-accent); opacity: 0.78;
  }
  .tile:hover { transform: translateY(-2px); border-color: var(--ec-border-hover); background: var(--ec-surface-hover); box-shadow: var(--ec-shadow); }
  .tile:active { transform: translateY(0); }
  .tile-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 21px; }
  .tile-code {
    display: inline-flex; align-items: center; max-width: 100%; min-height: 23px;
    padding: 3px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--ec-accent-strong); background: var(--ec-accent-soft);
    border: 1px solid rgba(13,148,136,0.18); border-radius: 4px;
    font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  }
  .tile-kind { flex: 0 0 auto; font-size: 10.5px; font-weight: 700; color: var(--ec-text-muted); }
  .tile-title {
    font-size: 15px; font-weight: 800; line-height: 1.35; letter-spacing: -0.01em;
    color: var(--ec-text); display: -webkit-box; -webkit-line-clamp: 3;
    -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;
  }
  .tile-foot {
    display: flex; align-items: baseline; gap: 7px; margin-top: auto; padding-top: 12px;
    border-top: 1px solid var(--ec-divider);
  }
  .tile-stat { font-size: 24px; font-weight: 800; line-height: 1; color: var(--ec-text); letter-spacing: -0.03em; }
  .tile-stat-label, .tile-stat-sub { font-size: 11px; font-weight: 700; color: var(--ec-text-muted); }
  .tile-stat-sub { margin-left: auto; }
  .tile-arrow { margin-left: auto; color: var(--ec-accent); opacity: 0.7; transition: transform 180ms ease, opacity 180ms ease; }
  .tile:hover .tile-arrow { opacity: 1; transform: translateX(3px); }

  .detail { display: flex; flex-direction: column; gap: 16px; }
  .hero {
    position: relative; overflow: hidden; padding: 23px 24px 20px;
    background: var(--ec-surface); border: 1px solid var(--ec-border); border-radius: var(--ec-radius);
  }
  .hero::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--ec-accent); }
  .hero-eyebrow {
    display: inline-flex; align-items: center; min-height: 24px; max-width: 100%;
    margin-bottom: 14px; padding: 3px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--ec-accent-strong); background: var(--ec-accent-soft);
    border: 1px solid rgba(13,148,136,0.18); border-radius: 4px;
    font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  }
  .hero-title { margin: 0; max-width: 820px; font-size: 27px; font-weight: 800; line-height: 1.16; letter-spacing: -0.025em; color: var(--ec-text); }
  .hero-stats { display: flex; flex-wrap: wrap; gap: 0; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--ec-divider); }
  .hero-stat { display: flex; align-items: baseline; gap: 7px; min-width: 112px; margin: 2px 22px 2px 0; }
  .hero-stat-num { font-size: 25px; font-weight: 800; line-height: 1; color: var(--ec-text); letter-spacing: -0.03em; }
  .hero-stat-label { font-size: 11.5px; font-weight: 700; color: var(--ec-text-muted); }

  .section { display: flex; flex-direction: column; gap: 9px; }
  .section-head {
    display: flex; align-items: center; gap: 10px;
    padding: 0 2px; color: var(--ec-text-soft);
    font-size: 12.5px; font-weight: 800; letter-spacing: 0.01em;
  }
  .section-head::after { content: ""; height: 1px; flex: 1; background: var(--ec-divider); }
  .tag-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .tag-chip {
    display: inline-flex; align-items: center; max-width: 100%;
    padding: 4px 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--ec-text); background: var(--ec-surface);
    border: 1px solid var(--ec-border); border-radius: 0;
    font-size: 11px; font-weight: 700; line-height: 1.25;
  }
  .tag-chip::first-letter { color: var(--ec-accent); }
  .markdown-code {
    padding: 1px 4px; color: var(--ec-accent-strong); background: var(--ec-accent-soft);
    border: 1px solid var(--ec-border); border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em;
  }
  .row-value { font-size: 13px; font-weight: 600; line-height: 1.45; word-break: break-word; }
  .row-list { display: flex; flex-direction: column; gap: 7px; }
  .row {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    padding: 12px 14px; min-height: 50px;
    color: var(--ec-text); background: var(--ec-surface);
    border: 1px solid var(--ec-border); border-radius: var(--ec-radius-sm);
    text-align: left; text-decoration: none; font: inherit; cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 180ms ease;
  }
  .row:hover { transform: translateX(2px); border-color: var(--ec-border-hover); background: var(--ec-surface-hover); box-shadow: var(--ec-shadow); }
  .row-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .row-title { font-size: 13.5px; font-weight: 700; line-height: 1.4; color: var(--ec-text); word-break: break-word; }
  .row-sub { font-size: 11px; font-weight: 700; color: var(--ec-text-muted); }
  .row-arrow { color: var(--ec-accent); flex-shrink: 0; opacity: 0.68; transition: transform 180ms ease, opacity 160ms ease; }
  .row:hover .row-arrow { opacity: 1; transform: translateX(3px); }

  .prose {
    padding: 13px 15px; color: var(--ec-text-soft); background: var(--ec-surface-soft);
    border: 1px solid var(--ec-border); border-left: 3px solid var(--ec-accent);
    border-radius: var(--ec-radius-sm); font-size: 13px; line-height: 1.62;
    white-space: pre-wrap; word-break: break-word;
  }
  .prose a { color: var(--ec-link); text-decoration: none; font-weight: 700; word-break: break-word; }
  .prose a:hover { color: var(--ec-link-strong); text-decoration: underline; }

  .actions { display: flex; flex-wrap: wrap; gap: 9px; padding-top: 2px; }
  .btn-wrap { display: inline-flex; }
  .btn-shadow { display: none; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 40px; padding: 0 15px;
    color: var(--ec-btn-fg); background: var(--ec-btn-bg);
    border: 1px solid var(--ec-btn-bg); border-radius: 5px;
    text-decoration: none; font: 800 12px/1 inherit; letter-spacing: 0.01em;
    cursor: pointer; transition: background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease;
  }
  .btn:hover { background: var(--ec-btn-hover-bg); border-color: var(--ec-btn-hover-bg); }
  .btn:active { transform: translateY(1px); }
  .btn.secondary { color: var(--ec-btn-secondary-fg); background: transparent; border-color: var(--ec-btn-secondary-border); }
  .btn.secondary:hover { color: var(--ec-link); background: var(--ec-surface-hover); border-color: var(--ec-link); }
  @media (max-width: 480px) {
    .hero { padding: 21px 18px 18px; }
    .hero-title { font-size: 23px; }
    .hero-stat { min-width: 98px; margin-right: 14px; }
    .hero-stat-num { font-size: 22px; }
    .actions, .btn-wrap, .btn { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
</style>
</head>
<body>
<div class="root" id="root">
  <div class="status"><div class="spinner"></div>Loading ExamCooker…</div>
</div>
<script>
(() => {
  const root = document.getElementById('root');
  const ESC = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const safeHref = (href) => {
    try {
      const url = new URL(String(href || ''), window.location.href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch (e) {
      return null;
    }
  };
  const linkify = (s) => s.replace(/(https?:\\/\\/[^\\s<)\\]]+)/g, (u) => {
    const href = safeHref(u);
    if (!href) return u;
    return '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(href.replace(/^https?:\\/\\//,'').replace(/^www\\./,'')) + '</a>';
  });
  const ARROW_RIGHT = '<svg class="tile-cta-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
  const ARROW_LEFT = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
  const CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';

  // ===== App state =====
  const state = {
    mode: 'empty',
    searchQuery: '',
    searchResults: null,
    detail: null,
    history: [],
  };

  // ===== MCP Apps bridge =====
  let nextRpcId = 1;
  const pending = new Map();
  const send = (payload) => {
    try { window.parent.postMessage(payload, '*'); } catch (e) { /* ignore */ }
  };
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = 'w-' + (nextRpcId++);
    pending.set(id, { resolve, reject });
    send({ jsonrpc: '2.0', id, method, params });
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error('Request timed out: ' + method)); }
    }, 25000);
  });
  const notify = (method, params) => send({ jsonrpc: '2.0', method, params: params || {} });
  const callTool = (name, args) => request('tools/call', { name, arguments: args });

  let lastW = 0, lastH = 0, sizeFrame = 0;
  const sendSize = () => {
    if (sizeFrame) return;
    sizeFrame = requestAnimationFrame(() => {
      sizeFrame = 0;
      const el = document.documentElement;
      const prev = el.style.height;
      el.style.height = 'max-content';
      const h = Math.ceil(el.getBoundingClientRect().height);
      el.style.height = prev;
      const w = Math.ceil(window.innerWidth);
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      notify('ui/notifications/size-changed', { width: w, height: h });
    });
  };
  let initialized = false;
  (async () => {
    try {
      await request('ui/initialize', {
        protocolVersion: '2025-11-21',
        appInfo: { name: 'examcooker-widget', version: '0.1.0' },
        appCapabilities: {},
      });
      notify('ui/notifications/initialized', {});
      initialized = true;
      sendSize();
    } catch (e) { /* fall back to passive */ }
  })();

  // Re-measure once webfonts have loaded — metrics shift after swap and the
  // last row would otherwise be clipped by an under-measured iframe height.
  try {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => sendSize());
    }
  } catch (e) { /* ignore */ }

  Promise.resolve().then(() => {
    try {
      const wo = window.openai;
      if (!wo) return;
      if (wo.toolOutput) applyInitialResult(wo.toolOutput);
      if (typeof wo.addEventListener === 'function') {
        wo.addEventListener('toolOutput', (ev) => applyInitialResult(ev && ev.detail ? ev.detail : ev));
      } else if (typeof wo.subscribe === 'function') {
        wo.subscribe('toolOutput', (v) => applyInitialResult(v));
      }
    } catch (e) { /* ignore */ }
  });

  try {
    const ro = new ResizeObserver(sendSize);
    ro.observe(document.documentElement);
    ro.observe(document.body);
  } catch (e) { /* older browser */ }

  const extractStructured = (result) => {
    if (!result) return null;
    if (result.structuredContent) return result.structuredContent;
    if (Array.isArray(result.content)) {
      for (const c of result.content) {
        if (c && c.type === 'text' && typeof c.text === 'string') {
          try { return JSON.parse(c.text); } catch (e) { /* keep searching */ }
        }
      }
    }
    if (typeof result.text === 'string') {
      try { return JSON.parse(result.text); } catch (e) { /* not JSON */ }
    }
    return null;
  };

  // ===== Title parsing =====
  const splitTitle = (raw) => {
    const m = /^([A-Za-z ]+):\\s*(.*)$/.exec(raw || '');
    return m ? { kind: m[1].trim(), rest: m[2].trim() } : { kind: '', rest: raw || '' };
  };
  const splitStat = (body) => {
    const m = /\\((\\d+)\\s+(papers?|notes?)(?:,\\s*(\\d+)\\s+(papers?|notes?))?\\)\\s*$/.exec(body);
    if (!m) return { body, primary: null, secondary: null };
    return {
      body: body.slice(0, m.index).trim(),
      primary: { n: Number(m[1]), unit: m[2] },
      secondary: m[3] ? { n: Number(m[3]), unit: m[4] } : null,
    };
  };
  const splitCourseCode = (body) => {
    const m = /^([A-Z][A-Z0-9]{2,9})\\s*[-–]\\s*(.+)$/.exec(body);
    return m ? { code: m[1], title: m[2] } : { code: '', title: body };
  };
  const splitQualifierTail = (body) => {
    const m = /\\s*\\(([^)]+)\\)\\s*$/.exec(body);
    if (!m) return { body, eyebrow: '' };
    const parts = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    return { body: body.slice(0, m.index).trim(), eyebrow: parts.join(' · ') };
  };

  // ===== Markdown-ish body parser for fetch detail =====
  const REDUNDANT_INTRO_KEYS = /^(?:Past papers?|Notes?|Modules?|Topics?|Videos?|Previous questions?|Past papers? URL|Notes? URL|Resources? URL|Syllabus URL|Year)$/i;
  const PAST_PAPER_INTRO_KEYS = /^(?:Course|Course title|Exam type|Slot|Semester|Campus|Answer key)$/i;
  const parseFetchBody = (text, resourceType = '') => {
    const lines = String(text || '').split(/\\r?\\n/);
    const sections = [];
    let cur = null;
    const intro = [];
    const extras = {};
    let inIntro = true;
    for (const raw of lines) {
      const line = raw.trimEnd();
      const heading = /^(#{1,6})\\s+(.+)$/.exec(line);
      if (heading) {
        if (heading[1].length === 1) continue;
        cur = { title: heading[2].trim(), items: [] };
        sections.push(cur);
        inIntro = false;
        continue;
      }
      const listMatch = /^\\s*(?:[-*+]|\\d+[.)]|\\([a-z]+\\))\\s+(.+)$/.exec(line);
      if (listMatch) {
        const item = listMatch[1];
        if (cur) cur.items.push(parseListItem(item));
        else if (inIntro && !shouldSkipIntroLine(item, extras, resourceType)) intro.push(item);
        continue;
      }
      if (!line.trim()) continue;
      if (cur) cur.items.push(parseListItem(line));
      else if (inIntro && !shouldSkipIntroLine(line, extras, resourceType)) intro.push(line);
    }
    return { intro, sections, extras };
  };
  const shouldSkipIntroLine = (line, extras, resourceType = '') => {
    const pdfMatch = /^PDF:\\s*(https?:\\/\\/\\S+)/i.exec(line);
    if (pdfMatch) { extras.syllabusPdf = pdfMatch[1]; return true; }
    const synMatch = /^Syllabus(?: URL)?:\\s*(https?:\\/\\/\\S+)/i.exec(line);
    if (synMatch) { extras.syllabusUrl = synMatch[1]; return true; }
    const kv = /^([A-Za-z][A-Za-z _]*):\\s*(.+)$/.exec(line);
    if (kv && REDUNDANT_INTRO_KEYS.test(kv[1].trim())) return true;
    if (resourceType === 'past_paper' && kv && PAST_PAPER_INTRO_KEYS.test(kv[1].trim())) return true;
    if (kv && /^not listed$/i.test(kv[2].trim())) return true;
    return false;
  };
  const parseListItem = (raw) => {
    const normalized = raw.replace(/^\\s*(?:\\d+[.)]|\\([a-z]+\\))\\s+/i, '').trim();
    const urlMatch = /(https?:\\/\\/\\S+)/.exec(normalized);
    if (urlMatch) {
      const url = urlMatch[1].replace(/[).,;]+$/, '');
      const before = normalized.slice(0, urlMatch.index).replace(/[\\s-]+$/, '').trim();
      return { label: before || url, url };
    }
    const kv = /^([A-Za-z][A-Za-z _]*):\\s*(.+)$/.exec(normalized);
    if (kv) return { label: kv[1].trim(), value: kv[2].trim() };
    return { label: normalized, value: null };
  };
  const renderMarkdownText = (raw) => {
    let html = esc(raw == null ? '' : raw);
    html = html
      .replace(/\\x60([^\\x60]+)\\x60/g, '<code class="markdown-code">$1</code>')
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
    return linkify(html);
  };

  // ===== Rendering =====
  const renderStatus = (msg, withSpinner) => {
    root.innerHTML = '<div class="status" role="status" aria-live="polite">' + (withSpinner ? '<div class="spinner" aria-hidden="true"></div>' : '') + esc(msg) + '</div>';
  };

  const renderSearchTile = (r, idx) => {
    const { kind, rest } = splitTitle(r.title || '');
    const { body: afterStat, primary, secondary } = splitStat(rest);
    let eyebrow = '';
    let title = afterStat;
    if (kind === 'Course') {
      const c = splitCourseCode(afterStat);
      if (c.code) { eyebrow = c.code; title = c.title; }
    } else if (kind) {
      const tail = splitQualifierTail(afterStat);
      eyebrow = tail.eyebrow || kind;
      title = tail.body || afterStat;
    }
    const head = '<div class="tile-head">' +
      (eyebrow ? '<span class="tile-code">' + esc(eyebrow) + '</span>' : '<span></span>') +
      (kind ? '<span class="tile-kind">' + esc(kind) + '</span>' : '') +
      '</div>';
    const statFoot = primary
      ? '<span class="tile-stat">' + esc(primary.n) + '</span>' +
        '<span class="tile-stat-label">' + esc(primary.unit) + '</span>' +
        (secondary ? '<span class="tile-stat-sub">+' + esc(secondary.n) + ' ' + esc(secondary.unit) + '</span>' : '')
      : '<span class="tile-stat-label">Open resource</span>';
    return '<button class="tile" type="button" aria-label="' + esc('Open ' + title) + '" data-action="open" data-idx="' + idx + '">' +
      head +
      '<div class="tile-title">' + esc(title) + '</div>' +
      '<div class="tile-foot">' + statFoot + '<span class="tile-arrow">' + ARROW_RIGHT + '</span></div>' +
    '</button>';
  };
  const catalogItemTitle = (item) => {
    if (!item || typeof item !== 'object') return '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const code = typeof item.code === 'string' ? item.code.trim() : '';
    if (code && typeof item.paperCount === 'number' && typeof item.noteCount === 'number') {
      const stats = [
        item.paperCount + ' ' + (item.paperCount === 1 ? 'paper' : 'papers'),
        item.noteCount + ' ' + (item.noteCount === 1 ? 'note' : 'notes'),
      ].join(', ');
      return 'Course: ' + code + ' - ' + title + ' (' + stats + ')';
    }
    if (Object.prototype.hasOwnProperty.call(item, 'examTypeLabel') || Object.prototype.hasOwnProperty.call(item, 'examType')) {
      const qualifiers = [item.examTypeLabel, item.year, item.hasAnswerKey ? 'answer key' : null].filter(Boolean);
      return 'Past paper: ' + title + (qualifiers.length ? ' (' + qualifiers.join(', ') + ')' : '');
    }
    if (Object.prototype.hasOwnProperty.call(item, 'courseTitle')) {
      return 'Note: ' + title + (item.courseCode ? ' (' + item.courseCode + ')' : '');
    }
    if (Object.prototype.hasOwnProperty.call(item, 'name')) {
      const syllabusTitle = item.courseName || item.name || title;
      return 'Syllabus: ' + syllabusTitle + (item.courseCode ? ' (' + item.courseCode + ')' : '');
    }
    if (Object.prototype.hasOwnProperty.call(item, 'year')) {
      return 'Resource: ' + (item.courseName || title) + (item.year ? ' (' + item.year + ')' : '');
    }
    return title || (typeof item.name === 'string' ? item.name.trim() : '');
  };

  const normalizeCatalogResult = (catalog) => ({
    ...catalog,
    results: (Array.isArray(catalog.items) ? catalog.items : []).flatMap((item) => {
      if (!item || typeof item.id !== 'string' || typeof item.url !== 'string') return [];
      const title = catalogItemTitle(item);
      return title ? [{ id: item.id, title, url: item.url }] : [];
    }),
  });


  const renderSearch = () => {
    const results = (state.searchResults && state.searchResults.results) || [];
    const labelPrefix = state.searchQuery ? 'Results for ' + esc('"' + state.searchQuery + '"') : 'ExamCooker results';
    if (!results.length) {
      root.innerHTML = '<div class="bar"><div class="bar-left"><span class="bar-title">' + labelPrefix + '</span></div></div>' +
        '<div class="status" role="status" aria-live="polite">No matching ExamCooker resources.</div>';
      return;
    }
    root.innerHTML =
      '<div class="bar"><div class="bar-left"><span class="bar-title">' + labelPrefix + '</span><span class="bar-count">· ' + results.length + '</span></div></div>' +
      '<div class="grid">' + results.map(renderSearchTile).join('') + '</div>';
    root.querySelectorAll('[data-action="open"]').forEach((el) => {
      el.addEventListener('click', () => openResultAt(Number(el.getAttribute('data-idx'))));
    });
  };

  const renderDetail = () => {
    const doc = state.detail;
    if (!doc) return renderStatus('No data.', false);
    const meta = doc.metadata || {};
    const code = meta.courseCode || '';
    const rawTitle = doc.title || 'ExamCooker resource';
    const cleanTitle = code ? rawTitle.replace(new RegExp('^' + code.replace(/[-/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&') + '\\\\s*[-–]\\\\s*'), '') : rawTitle;
    const type = meta.type ? String(meta.type).replace(/_/g, ' ') : '';
    const typeLabel = type ? type[0].toUpperCase() + type.slice(1) : '';
    const eyebrowBits = [code, typeLabel].filter(Boolean);
    const eyebrow = eyebrowBits.join(' · ');

    const heroStats = [];
    const addStat = (value, label) => {
      if (value == null || heroStats.some((item) => item.label === label)) return;
      heroStats.push({ n: value, label });
    };
    if (typeof meta.paperCount === 'number') addStat(meta.paperCount, meta.paperCount === 1 ? 'paper' : 'papers');
    if (typeof meta.noteCount === 'number') addStat(meta.noteCount, meta.noteCount === 1 ? 'note' : 'notes');
    if (typeof meta.moduleCount === 'number') addStat(meta.moduleCount, meta.moduleCount === 1 ? 'module' : 'modules');
    if (typeof meta.topicCount === 'number') addStat(meta.topicCount, meta.topicCount === 1 ? 'topic' : 'topics');
    if (typeof meta.videoCount === 'number') addStat(meta.videoCount, meta.videoCount === 1 ? 'video' : 'videos');
    if (meta.year != null) addStat(meta.year, 'year');

    const parsed = parseFetchBody(doc.text, String(meta.type || ''));
    const assets = Array.isArray(doc.assets) ? doc.assets : [];
    const assetPdf = assets.find((asset) =>
      asset && typeof asset.uri === 'string' && /\\.pdf(?:[?#]|$)/i.test(asset.uri)
    );
    const primaryPdf = meta.fileUrl || parsed.extras.syllabusPdf || (assetPdf && assetPdf.uri);
    const pdfLabel = meta.type === 'syllabus' ? 'Open syllabus PDF' : 'Open PDF';

    const seenItems = new Set();
    parsed.sections = parsed.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const key = [item.url || '', item.label || '', item.value || ''].join('|');
          if (seenItems.has(key)) return false;
          if (primaryPdf && item.url === primaryPdf) return false;
          seenItems.add(key);
          return true;
        }),
      }))
      .filter((section) => section.title.trim());

    const renderRow = (item) => {
      const sub = item.kind ? '<div class="row-sub">' + renderMarkdownText(item.kind) + '</div>' : '';
      const itemHref = item.url ? safeHref(item.url) : null;
      if (itemHref) {
        return '<a class="row" href="' + esc(itemHref) + '" target="_blank" rel="noopener noreferrer">' +
          '<div class="row-main"><div class="row-title">' + renderMarkdownText(item.label) + '</div>' + sub + '</div>' +
          '<span class="row-arrow">' + CHEVRON + '</span>' +
        '</a>';
      }
      if (item.value) {
        return '<div class="row"><div class="row-main">' +
          '<div class="row-sub">' + renderMarkdownText(item.label) + '</div>' +
          '<div class="row-value">' + renderMarkdownText(item.value) + '</div>' +
        '</div></div>';
      }
      return '<div class="row"><div class="row-main"><div class="row-title">' + renderMarkdownText(item.label) + '</div></div></div>';
    };

    const renderSection = (section) => {
      if (/^tags?$/i.test(section.title.trim())) {
        const tags = Array.from(new Set(section.items
          .map((item) => item.label || item.value)
          .filter(Boolean)));
        if (!tags.length) return '';
        return '<section class="section">' +
          '<div class="section-head">Tags</div>' +
          '<div class="tag-list" aria-label="Tags">' +
            tags.map((tag) => '<span class="tag-chip">#' + renderMarkdownText(tag) + '</span>').join('') +
          '</div>' +
        '</section>';
      }
      return '<section class="section">' +
        '<div class="section-head">' + renderMarkdownText(section.title) + '</div>' +
        (section.items.length ? '<div class="row-list">' + section.items.map(renderRow).join('') + '</div>' : '') +
      '</section>';
    };

    const renderBtn = (href, label, secondary) => {
      const safe = safeHref(href);
      if (!safe) return '';
      const cls = 'btn-wrap' + (secondary ? ' secondary' : '');
      const btnCls = 'btn' + (secondary ? ' secondary' : '');
      return '<span class="' + cls + '">' +
        '<span class="btn-shadow"></span>' +
        '<a class="' + btnCls + '" href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>' +
      '</span>';
    };
    const actionBtns = [
      primaryPdf ? renderBtn(String(primaryPdf), pdfLabel, false) : '',
      doc.url ? renderBtn(doc.url, 'View on ExamCooker', true) : '',
    ].filter(Boolean).join('');
    const barHtml = state.history.length
      ? '<div class="bar"><div class="bar-left"><button class="back" type="button" data-action="back">' + ARROW_LEFT + 'Back</button></div></div>'
      : '';

    root.innerHTML = barHtml +
      '<div class="detail">' +
        '<section class="hero">' +
          (eyebrow ? '<span class="hero-eyebrow">' + esc(eyebrow) + '</span>' : '') +
          '<h1 class="hero-title">' + esc(cleanTitle) + '</h1>' +
          (heroStats.length ? '<div class="hero-stats">' + heroStats.map((s) =>
              '<div class="hero-stat"><span class="hero-stat-num">' + esc(s.n) + '</span><span class="hero-stat-label">' + esc(s.label) + '</span></div>'
            ).join('') + '</div>' : '') +
        '</section>' +
        (parsed.intro.length ? '<div class="prose">' + renderMarkdownText(parsed.intro.join('\\n')) + '</div>' : '') +
        parsed.sections.map(renderSection).join('') +
        (actionBtns ? '<div class="actions">' + actionBtns + '</div>' : '') +
      '</div>';

    const back = root.querySelector('[data-action="back"]');
    if (back) back.addEventListener('click', goBack);
  };

  const render = () => {
    if (state.mode === 'loading') renderStatus('Loading ExamCooker resource…', true);
    else if (state.mode === 'search') renderSearch();
    else if (state.mode === 'detail') renderDetail();
    else renderStatus('Ask ChatGPT to search ExamCooker.', false);
    if (initialized) sendSize();
  };

  // ===== Actions =====
  const openResultAt = async (idx) => {
    const r = state.searchResults && state.searchResults.results && state.searchResults.results[idx];
    if (!r) return;
    state.history.push({ mode: 'search', searchResults: state.searchResults, searchQuery: state.searchQuery });
    state.mode = 'loading';
    render();
    try {
      const resp = await callTool('fetch', { id: r.id });
      const sc = extractStructured(resp);
      if (!sc || typeof sc.text !== 'string') throw new Error('Unexpected fetch response');
      state.detail = sc;
      state.mode = 'detail';
      render();
    } catch (err) {
      state.mode = 'search';
      state.history.pop();
      renderStatus('Could not load that resource. ' + (err && err.message ? err.message : ''), false);
    }
  };
  const goBack = () => {
    const prev = state.history.pop();
    if (!prev) return;
    state.mode = prev.mode;
    state.searchResults = prev.searchResults || null;
    state.searchQuery = prev.searchQuery || '';
    state.detail = prev.detail || null;
    render();
  };

  // ===== Incoming messages =====
  const applyInitialResult = (result) => {
    const sc = extractStructured(result);
    if (!sc) return;
    if (Array.isArray(sc.results)) {
      state.mode = 'search';
      state.searchResults = sc;
      state.searchQuery = (result && result._meta && result._meta.query) || '';
      state.history = [];
      render();
      return;
    }
    if (Array.isArray(sc.items)) {
      state.mode = 'search';
      state.searchResults = normalizeCatalogResult(sc);
      state.searchQuery = (result && result._meta && result._meta.query) || '';
      state.history = [];
      render();
      return;
    }
    if (typeof sc.text === 'string') {
      state.mode = 'detail';
      state.detail = sc;
      state.history = [];
      render();
    }
  };

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.jsonrpc !== '2.0') return;
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) return reject(new Error(msg.error.message || 'Tool call failed'));
      return resolve(msg.result || null);
    }
    if (msg.method === 'ui/notifications/tool-result' || msg.method === 'tool-result') {
      applyInitialResult(msg.params);
    }
  }, { passive: true });
})();
</script>
</body>
</html>`;

export const EXAMCOOKER_WIDGET_URI = "ui://widget/examcooker.html";
