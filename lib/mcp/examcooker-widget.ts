export const EXAMCOOKER_WIDGET_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap">
<style>
  :root {
    color-scheme: light dark;
    --ec-bg: #C2E6EC;
    --ec-tile: #5FC4E7;
    --ec-tile-border: #5FC4E7;
    --ec-tile-accent: #ffffff;
    --ec-text: #000000;
    --ec-text-soft: rgba(0,0,0,0.65);
    --ec-text-muted: rgba(0,0,0,0.52);
    --ec-divider: rgba(0,0,0,0.15);
    --ec-link: #0D5875;
    --ec-link-strong: #06384b;
    --ec-shadow-xl: 0 22px 44px -22px rgba(13,88,117,0.45);
    /* Brutalist button */
    --ec-btn-bg: #3BF4C7;
    --ec-btn-fg: #000000;
    --ec-btn-border: #000000;
    --ec-btn-shadow: #3BF4C7;       /* offset accent behind, light mode = same as bg so no visible shadow */
    --ec-btn-hover-fg: #000000;
    --ec-btn-secondary-border: rgba(0,0,0,0.85);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ec-bg: #0C1222;
      --ec-tile: #0C1222;              /* desktop variant: same as body */
      --ec-tile-border: rgba(213,213,213,0.18);
      --ec-tile-accent: #3BF4C7;
      --ec-text: #D5D5D5;
      --ec-text-soft: rgba(213,213,213,0.72);
      --ec-text-muted: rgba(213,213,213,0.50);
      --ec-divider: rgba(213,213,213,0.14);
      --ec-link: #3BF4C7;
      --ec-link-strong: #6BFADB;
      --ec-shadow-xl: 0 24px 48px -24px rgba(0,0,0,0.6);
      /* Dark brutalist button: navy body, light gray border, cyan offset square behind */
      --ec-btn-bg: #0C1222;
      --ec-btn-fg: #D5D5D5;
      --ec-btn-border: #D5D5D5;
      --ec-btn-shadow: #3BF4C7;       /* cyan square shows on hover when button translates */
      --ec-btn-hover-fg: #3BF4C7;
      --ec-btn-secondary-border: rgba(213,213,213,0.55);
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
  /* Generous outer margin so the widget reads as a self-contained surface inside ChatGPT.
     ChatGPT renders the widget edge-to-edge inside its sandbox iframe with no outer chrome,
     so we need to provide all of the breathing room ourselves. */
  body { padding: 36px 40px 40px; }
  .root { max-width: 1100px; margin: 0 auto; padding: 0; }
  @media (max-width: 720px) {
    body { padding: 24px 22px 28px; }
  }
  @media (max-width: 480px) {
    body { padding: 20px 16px 24px; }
  }

  .status { display: flex; align-items: center; justify-content: center; padding: 56px 16px; color: var(--ec-text-muted); font-size: 13px; font-weight: 500; gap: 10px; }
  .spinner { width: 14px; height: 14px; border: 2px solid var(--ec-text-muted); border-top-color: transparent; border-radius: 50%; animation: spin 700ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Header bar */
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  .bar-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
  .bar-title { font-size: 13px; font-weight: 600; color: var(--ec-text-soft); letter-spacing: -0.005em; }
  .bar-count { font-size: 12px; font-weight: 600; color: var(--ec-text-muted); }

  /* Back button — uses the brutalist outlined style */
  .back {
    display: inline-flex; align-items: center; gap: 6px;
    height: 36px; padding: 0 14px;
    font: 600 12.5px/1 inherit;
    color: var(--ec-text);
    background: transparent;
    border: 2px solid var(--ec-tile-border);
    cursor: pointer;
    transition: transform 160ms cubic-bezier(0.22,1,0.36,1), border-color 180ms ease, color 180ms ease;
  }
  .back:hover { border-color: var(--ec-tile-accent); color: var(--ec-link); transform: translateX(-2px); }

  /* Search grid: chunky flat tiles, no rounded corners */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(248px, 1fr)); gap: 14px; }
  .tile {
    display: flex; flex-direction: column; gap: 14px;
    background: var(--ec-tile);
    border: 2px solid var(--ec-tile-border);
    padding: 18px;
    text-align: left;
    text-decoration: none; color: var(--ec-text);
    font-family: inherit; font-size: inherit; line-height: inherit;
    cursor: pointer;
    min-height: 156px;
    transition: transform 220ms cubic-bezier(0.22,1,0.36,1), box-shadow 220ms cubic-bezier(0.22,1,0.36,1), border-color 180ms ease;
  }
  .tile:hover { transform: scale(1.03); box-shadow: var(--ec-shadow-xl); border-bottom-color: var(--ec-tile-accent); }
  .tile:active { transform: scale(0.99); }
  .tile-code {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px; font-weight: 700; letter-spacing: 0.02em;
    color: var(--ec-text-soft);
  }
  .tile-title {
    font-size: 15.5px; font-weight: 700; line-height: 1.34;
    color: var(--ec-text);
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    word-break: break-word;
  }
  .tile-foot { margin-top: auto; display: flex; align-items: baseline; gap: 8px; padding-top: 4px; }
  .tile-stat { font-size: 30px; font-weight: 800; line-height: 1; color: var(--ec-text); letter-spacing: -0.02em; }
  .tile-stat-label { font-size: 11.5px; font-weight: 600; color: var(--ec-text-muted); }
  .tile-stat-sub { font-size: 11.5px; font-weight: 500; color: var(--ec-text-muted); margin-left: auto; }
  .tile-kind { font-size: 11.5px; font-weight: 600; color: var(--ec-text-muted); }
  .tile-cta { font-size: 12.5px; font-weight: 600; color: var(--ec-text); display: inline-flex; align-items: center; gap: 6px; }
  .tile-cta-arrow { transition: transform 220ms cubic-bezier(0.22,1,0.36,1); }
  .tile:hover .tile-cta-arrow { transform: translateX(3px); }

  /* Detail view */
  .detail { display: flex; flex-direction: column; gap: 20px; }
  .hero {
    background: var(--ec-tile);
    border: 2px solid var(--ec-tile-border);
    padding: 24px 26px 22px;
  }
  .hero-eyebrow {
    display: inline-block;
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12.5px; font-weight: 700; letter-spacing: 0.01em;
    color: var(--ec-text-soft);
    margin-bottom: 14px;
  }
  .hero-title {
    margin: 0;
    font-size: 30px; font-weight: 800; line-height: 1.12; letter-spacing: -0.02em;
    color: var(--ec-text);
  }
  .hero-stats { display: flex; flex-wrap: wrap; gap: 32px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--ec-divider); }
  .hero-stat { display: flex; align-items: baseline; gap: 8px; }
  .hero-stat-num { font-size: 34px; font-weight: 800; line-height: 1; color: var(--ec-text); letter-spacing: -0.02em; }
  .hero-stat-label { font-size: 12.5px; font-weight: 600; color: var(--ec-text-muted); }

  /* Section heads — plain title case, not uppercase */
  .section { display: flex; flex-direction: column; gap: 12px; }
  .section-head {
    font-size: 13px; font-weight: 600; color: var(--ec-text-soft); letter-spacing: -0.005em;
    padding-bottom: 10px; border-bottom: 1px solid var(--ec-divider);
  }
  .row-list { display: flex; flex-direction: column; gap: 8px; }
  .row {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    background: var(--ec-tile);
    border: 2px solid var(--ec-tile-border);
    padding: 14px 18px;
    text-align: left; text-decoration: none; color: var(--ec-text);
    font: inherit; cursor: pointer;
    transition: transform 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 180ms cubic-bezier(0.22,1,0.36,1), border-color 180ms ease;
  }
  .row:hover { transform: scale(1.01); box-shadow: var(--ec-shadow-xl); border-bottom-color: var(--ec-tile-accent); }
  .row-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .row-title { font-size: 14px; font-weight: 600; line-height: 1.35; color: var(--ec-text); word-break: break-word; }
  .row-sub { font-size: 12px; font-weight: 500; color: var(--ec-text-muted); }
  .row-arrow { color: var(--ec-text-muted); flex-shrink: 0; opacity: 0.5; transition: transform 200ms cubic-bezier(0.22,1,0.36,1), opacity 180ms ease; }
  .row:hover .row-arrow { opacity: 1; transform: translateX(3px); }

  /* Free-form text block */
  .prose { color: var(--ec-text-soft); font-size: 13.5px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
  .prose a { color: var(--ec-link); text-decoration: none; font-weight: 600; word-break: break-word; }
  .prose a:hover { color: var(--ec-link-strong); text-decoration: underline; }

  /* === Brutalist offset-shadow button (faithful to upload-button-notes pattern) ===
     Wrapper holds an absolute cyan square behind. On hover the button (the relative
     anchor) translates -1/-1 to reveal the cyan square as an offset accent shadow. */
  .actions { display: flex; flex-wrap: wrap; gap: 14px; padding-top: 6px; }
  .btn-wrap { position: relative; display: inline-flex; height: 48px; }
  .btn-shadow {
    position: absolute; inset: 0;
    background: var(--ec-btn-shadow);
    /* In light mode the bg matches the button face, so it's invisible by default;
       in dark mode it's cyan and revealed only when the face translates on hover */
    pointer-events: none;
  }
  .btn {
    position: relative;
    display: inline-flex; align-items: center; gap: 8px;
    height: 100%; padding: 0 18px;
    background: var(--ec-btn-bg);
    color: var(--ec-btn-fg);
    border: 2px solid var(--ec-btn-border);
    text-decoration: none;
    font: 700 13px/1 inherit;
    letter-spacing: 0.005em;
    cursor: pointer;
    transition: transform 180ms cubic-bezier(0.22,1,0.36,1), color 180ms ease, border-color 180ms ease;
  }
  .btn:hover { color: var(--ec-btn-hover-fg); }
  @media (prefers-color-scheme: dark) {
    .btn:hover { border-color: #3BF4C7; transform: translate(-4px, -4px); }
  }
  @media (prefers-color-scheme: light) {
    .btn:hover { transform: translate(-2px, -2px); }
  }

  /* Secondary (outline only): same brutalist shape, no cyan offset behind */
  .btn-wrap.secondary .btn-shadow { display: none; }
  .btn.secondary {
    background: transparent;
    color: var(--ec-text);
    border-color: var(--ec-btn-secondary-border);
  }
  .btn.secondary:hover { color: var(--ec-link); border-color: var(--ec-link); }
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
  const linkify = (s) => s.replace(/(https?:\\/\\/[^\\s<)\\]]+)/g, (u) => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u.replace(/^https?:\\/\\//,'').replace(/^www\\./,'') + '</a>');
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
  const parseFetchBody = (text) => {
    const lines = String(text || '').split(/\\r?\\n/);
    const sections = [];
    let cur = null;
    const intro = [];
    const extras = {};
    let inIntro = true;
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^#\\s+/.test(line)) continue;
      if (/^##\\s+/.test(line)) {
        cur = { title: line.replace(/^##\\s+/, ''), items: [] };
        sections.push(cur);
        inIntro = false;
        continue;
      }
      if (/^-\\s+/.test(line)) {
        const item = line.replace(/^-\\s+/, '');
        if (cur) cur.items.push(parseListItem(item));
        else if (inIntro && !shouldSkipIntroLine(item, extras)) intro.push(item);
        continue;
      }
      if (!line.trim()) continue;
      if (cur) cur.items.push(parseListItem(line));
      else if (inIntro && !shouldSkipIntroLine(line, extras)) intro.push(line);
    }
    return { intro, sections, extras };
  };
  const shouldSkipIntroLine = (line, extras) => {
    const pdfMatch = /^PDF:\\s*(https?:\\/\\/\\S+)/i.exec(line);
    if (pdfMatch) { extras.syllabusPdf = pdfMatch[1]; return true; }
    const synMatch = /^Syllabus(?: URL)?:\\s*(https?:\\/\\/\\S+)/i.exec(line);
    if (synMatch) { extras.syllabusUrl = synMatch[1]; return true; }
    const kv = /^([A-Za-z][A-Za-z _]*):\\s*(.+)$/.exec(line);
    if (kv && REDUNDANT_INTRO_KEYS.test(kv[1].trim())) return true;
    if (kv && /^not listed$/i.test(kv[2].trim())) return true;
    return false;
  };
  const parseListItem = (raw) => {
    const urlMatch = /(https?:\\/\\/\\S+)/.exec(raw);
    if (urlMatch) {
      const url = urlMatch[1].replace(/[).,;]+$/, '');
      const before = raw.slice(0, urlMatch.index).replace(/[\\s-]+$/, '').trim();
      return { label: before || url, url };
    }
    const kv = /^([A-Za-z][A-Za-z _]*):\\s*(.+)$/.exec(raw);
    if (kv) return { label: kv[1].trim(), value: kv[2].trim() };
    return { label: raw, value: null };
  };

  // ===== Rendering =====
  const renderStatus = (msg, withSpinner) => {
    root.innerHTML = '<div class="status">' + (withSpinner ? '<div class="spinner"></div>' : '') + esc(msg) + '</div>';
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
    let foot = '';
    if (primary) {
      foot = '<div class="tile-foot">' +
        '<span class="tile-stat">' + primary.n + '</span>' +
        '<span class="tile-stat-label">' + esc(primary.unit) + '</span>' +
        (secondary ? '<span class="tile-stat-sub">+' + secondary.n + ' ' + esc(secondary.unit) + '</span>' : '') +
      '</div>';
    } else if (kind && kind !== 'Course') {
      foot = '<div class="tile-foot"><span class="tile-kind">' + esc(kind) + '</span></div>';
    }
    return '<button class="tile" type="button" data-action="open" data-idx="' + idx + '">' +
      (eyebrow ? '<span class="tile-code">' + esc(eyebrow) + '</span>' : '') +
      '<div class="tile-title">' + esc(title) + '</div>' +
      foot +
    '</button>';
  };

  const renderSearch = () => {
    const results = (state.searchResults && state.searchResults.results) || [];
    const labelPrefix = state.searchQuery ? 'Results for ' + esc('"' + state.searchQuery + '"') : 'ExamCooker results';
    if (!results.length) {
      root.innerHTML = '<div class="bar"><div class="bar-left"><span class="bar-title">' + labelPrefix + '</span></div></div>' +
        '<div class="status">No matching ExamCooker resources.</div>';
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
    if (typeof meta.paperCount === 'number') heroStats.push({ n: meta.paperCount, label: meta.paperCount === 1 ? 'paper' : 'papers' });
    if (typeof meta.noteCount === 'number') heroStats.push({ n: meta.noteCount, label: meta.noteCount === 1 ? 'note' : 'notes' });
    if (typeof meta.moduleCount === 'number') heroStats.push({ n: meta.moduleCount, label: meta.moduleCount === 1 ? 'module' : 'modules' });
    if (typeof meta.topicCount === 'number') heroStats.push({ n: meta.topicCount, label: meta.topicCount === 1 ? 'topic' : 'topics' });
    if (typeof meta.videoCount === 'number') heroStats.push({ n: meta.videoCount, label: meta.videoCount === 1 ? 'video' : 'videos' });
    if (meta.year != null) heroStats.push({ n: meta.year, label: 'year' });

    const parsed = parseFetchBody(doc.text);

    const renderRow = (item) => {
      const sub = item.kind ? '<div class="row-sub">' + esc(item.kind) + '</div>' : '';
      if (item.url) {
        return '<a class="row" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' +
          '<div class="row-main"><div class="row-title">' + esc(item.label) + '</div>' + sub + '</div>' +
          '<span class="row-arrow">' + CHEVRON + '</span>' +
        '</a>';
      }
      if (item.value) {
        return '<div class="row"><div class="row-main">' +
          '<div class="row-sub">' + esc(item.label) + '</div>' +
          '<div class="row-title" style="font-weight:600;font-size:13.5px;word-break:break-all">' + linkify(esc(item.value)) + '</div>' +
        '</div></div>';
      }
      return '<div class="row"><div class="row-main"><div class="row-title">' + esc(item.label) + '</div></div></div>';
    };

    const renderSection = (section) => {
      if (!section.items.length) return '';
      return '<section class="section">' +
        '<div class="section-head">' + esc(section.title) + '</div>' +
        '<div class="row-list">' + section.items.map(renderRow).join('') + '</div>' +
      '</section>';
    };

    const primaryPdf = meta.fileUrl || parsed.extras.syllabusPdf;
    const pdfLabel = meta.fileUrl ? (meta.type === 'syllabus' ? 'Open syllabus PDF' : 'Open PDF') : 'Open syllabus PDF';
    const renderBtn = (href, label, secondary) => {
      const cls = 'btn-wrap' + (secondary ? ' secondary' : '');
      const btnCls = 'btn' + (secondary ? ' secondary' : '');
      return '<span class="' + cls + '">' +
        '<span class="btn-shadow"></span>' +
        '<a class="' + btnCls + '" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>' +
      '</span>';
    };
    const actionBtns = [
      primaryPdf ? renderBtn(String(primaryPdf), pdfLabel, false) : '',
      doc.url ? renderBtn(doc.url, 'View on ExamCooker', true) : '',
    ].filter(Boolean).join('');

    const barHtml =
      '<div class="bar">' +
        '<div class="bar-left">' +
          (state.history.length ? '<button class="back" type="button" data-action="back">' + ARROW_LEFT + 'Back</button>' : '') +
        '</div>' +
      '</div>';

    root.innerHTML = barHtml +
      '<div class="detail">' +
        '<section class="hero">' +
          (eyebrow ? '<span class="hero-eyebrow">' + esc(eyebrow) + '</span>' : '') +
          '<h1 class="hero-title">' + esc(cleanTitle) + '</h1>' +
          (heroStats.length ? '<div class="hero-stats">' + heroStats.map((s) =>
              '<div class="hero-stat"><span class="hero-stat-num">' + esc(s.n) + '</span><span class="hero-stat-label">' + esc(s.label) + '</span></div>'
            ).join('') + '</div>' : '') +
        '</section>' +
        (parsed.intro.length ? '<div class="prose">' + linkify(esc(parsed.intro.join('\\n'))) + '</div>' : '') +
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
