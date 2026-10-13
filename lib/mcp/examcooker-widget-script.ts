import { EXAMCOOKER_LOGO_SVG } from "./generated/website-appearance";

// Self-contained JavaScript embedded in the sandboxed MCP resource.
export const EXAMCOOKER_WIDGET_SCRIPT = String.raw`
(() => {
  'use strict';
  const root = document.getElementById('root');
  const logo = ${JSON.stringify(EXAMCOOKER_LOGO_SVG)};
  const searchIcon = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>';
  const escape = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = (value) => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  };
  const validSummary = (item) => item && typeof item.id === 'string' && item.id.length <= 500 && typeof item.title === 'string' && item.title.length <= 1000 && safeUrl(item.url);
  const summary = (item) => ({ id: item.id, title: item.title, url: item.url });
  const kinds = { all: 'All', course: 'Courses', past_paper: 'Past papers', note: 'Notes', syllabus: 'Syllabi', resource: 'Resources' };
  const kindLabels = { course: 'Course', past_paper: 'Past paper', note: 'Note', syllabus: 'Syllabus', resource: 'Resource' };
  const kindOf = (item) => String(item.id || '').split(':')[0];
  const state = { query: '', results: [], cards: {}, searched: false, filter: 'all', detail: null, busy: false, ready: false, error: '', operation: 0 };
  const pending = new Map();
  let initialToolResultSeen = false, localNavigationStarted = false;
  let sequence = 0, sizeFrame = 0, lastSize = '', hostCapabilities = {}, lastDeepLink = '', toolQuery = '', contextQueue = Promise.resolve(), contextVersion = 0;
  const notify = (method, params) => window.parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
  const request = (method, params, timeout = 25000) => new Promise((resolve, reject) => {
    const id = 'examcooker-' + (++sequence);
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('The request timed out. Please retry.')); }, timeout);
    pending.set(id, { resolve, reject, timer });
    window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  });
  const extract = (result) => {
    if (!result || result.isError) throw new Error('ExamCooker could not load this resource. Please retry.');
    if (result.structuredContent) return result.structuredContent;
    for (const item of result.content || []) { if (item.type === 'text') { try { return JSON.parse(item.text); } catch {} } }
    throw new Error('ExamCooker returned an unexpected response.');
  };
  const sendSize = () => {
    if (!state.ready || sizeFrame) return;
    sizeFrame = requestAnimationFrame(() => {
      sizeFrame = 0;
      if (document.documentElement.dataset.display === 'fullscreen') return;
      const size = { width: window.innerWidth, height: Math.ceil(root.getBoundingClientRect().height) };
      const key = JSON.stringify(size);
      if (key !== lastSize) { lastSize = key; notify('ui/notifications/size-changed', size); }
    });
  };
  const persist = () => {
    try { window.openai?.setWidgetState?.({ privateContent: { version: 3, filter: state.filter } }); } catch {}
  };
  const syncContext = () => {
    if (!state.ready || !hostCapabilities.updateModelContext) return;
    const version = ++contextVersion;
    const active = state.detail ? summary(state.detail) : null;
    contextQueue = contextQueue.catch(() => {}).then(async () => {
      if (version !== contextVersion) return;
      await request('ui/update-model-context', {
        content: active ? [{ type: 'resource_link', uri: active.url, name: active.title, description: 'ExamCooker source id: ' + active.id }] : [],
        structuredContent: { activeResource: active },
      });
    });
    // Context attachment support is additive; browsing still works on failure.
    contextQueue.catch(() => {});
  };
  const applyHostContext = (context) => {
    if (!context || typeof context !== 'object') return;
    if (['light', 'dark'].includes(context.theme)) document.documentElement.classList.toggle('dark', context.theme === 'dark');
    if (context.displayMode) document.documentElement.dataset.display = context.displayMode;
    if (typeof context.locale === 'string') document.documentElement.lang = context.locale;
    const deepLink = context['openai/deepLink']?.url;
    if (typeof deepLink === 'string' && deepLink !== lastDeepLink && deepLink.startsWith('/') && !deepLink.startsWith('//') && !deepLink.includes('#')) {
      lastDeepLink = deepLink;
      const route = new URL(deepLink, 'https://examcooker.invalid');
      if (route.pathname === '/search') { const query = route.searchParams.get('q') || ''; if (query.length <= 240) void runSearch(query); }
      if (route.pathname === '/resource') { const id = route.searchParams.get('id'); if (id && id.length <= 500) void openResource(id); }
    }
    sendSize();
  };
  const cardTitle = (item) => String(item.title).replace(/^(Course|Past paper|Note|Syllabus|Resource):\s*/i, '');
  const displayTitle = (item) => {
    const title = item.metadata?.displayTitle || state.cards[item.id]?.title;
    if (typeof title === 'string' && title.trim()) return title;
    return kindOf(item) === 'course' ? cardTitle(item).replace(/^[A-Z0-9]+\s*[-–]\s*/, '').replace(/\s*\(\d+ papers?(?:, \d+ notes?)?\)$/, '') : cardTitle(item);
  };
  const renderLabels = (labels) => Array.isArray(labels) ? labels.filter((label) => typeof label === 'string' && label).map((label) => '<span class="paper-label">' + escape(label) + '</span>').join('') : '';
  const renderCard = (item) => {
    const kind = kindOf(item), display = state.cards[item.id] || {};
    const code = display.courseCode || (kind === 'course' ? item.id.slice(7) : '');
    const counts = /\((\d+) papers?(?:, (\d+) notes?)?\)$/.exec(cardTitle(item));
    const paperCount = typeof display.paperCount === 'number' ? display.paperCount : counts ? Number(counts[1]) : null;
    const stats = paperCount !== null ? '<div class="ec-catalog-stats"><span class="ec-catalog-number">' + escape(paperCount) + '</span><span class="ec-catalog-unit">paper' + (paperCount === 1 ? '' : 's') + '</span></div>' : '';
    return '<button class="card ec-catalog-card" type="button" data-action="open" data-id="' + escape(item.id) + '"><span class="ec-catalog-code">' + escape(kindLabels[kind] || 'Resource') + (code ? ' · ' + escape(code) : '') + '</span><div class="paper-labels">' + renderLabels(display.labels) + '</div><h3 class="ec-catalog-title">' + escape(displayTitle(item)) + '</h3>' + stats + '</button>';
  };
  const renderBody = (text) => String(text || '').split(/\r?\n/).map((line) => {
    if (!line.trim() || /^#\s/.test(line)) return '';
    if (/^###\s/.test(line)) return '<h4>' + escape(line.replace(/^###\s*/, '')) + '</h4>';
    if (/^##\s/.test(line)) return '<h3>' + escape(line.replace(/^##\s*/, '')) + '</h3>';
    const match = /(https?:\/\/[^\s)]+)/.exec(line);
    const href = match && safeUrl(match[1]);
    if (href) return '<a class="source-row" href="' + escape(href) + '" target="_blank" rel="noopener noreferrer">' + escape(line.slice(0, match.index).replace(/^[-\s]+|[-\s:]+$/g, '') || 'Open resource') + '<small>' + escape(new URL(href).hostname) + ' ↗</small></a>';
    return '<p>' + escape(line.replace(/^-\s*/, '')) + '</p>';
  }).join('');
  const renderDetail = () => {
    const doc = state.detail, meta = doc.metadata || {};
    const stats = [['paperCount','papers'],['noteCount','notes'],['moduleCount','modules'],['topicCount','topics']].filter(([key]) => typeof meta[key] === 'number').map(([key, label]) => '<span><b>' + escape(meta[key]) + '</b> ' + label + '</span>').join('');
    const pdf = safeUrl(meta.fileUrl) || safeUrl(/^PDF:\s*(\S+)/m.exec(doc.text || '')?.[1]);
    const page = safeUrl(doc.url);
    const labels = kindOf(doc) === 'past_paper' ? [meta.examTypeLabel, meta.slot, meta.year?.toString(), meta.hasAnswerKey ? 'Answer key' : null] : [];
    return '<button class="text-button" data-action="back">← Back to results</button><div class="detail-heading"><span class="eyebrow">' + escape(kindLabels[kindOf(doc)] || 'Resource') + (meta.courseCode ? ' · ' + escape(meta.courseCode) : '') + '</span><div class="paper-labels">' + renderLabels(labels) + '</div><h1>' + escape(displayTitle(doc)) + '</h1><div class="stats">' + stats + '</div></div><div class="detail-actions">' + (pdf ? '<a class="button" href="' + escape(pdf) + '" target="_blank" rel="noopener noreferrer">Open PDF ↗</a>' : '') + (page ? '<a class="button" href="' + escape(page) + '" target="_blank" rel="noopener noreferrer">View on ExamCooker ↗</a>' : '') + '</div><div class="body-text">' + renderBody(doc.text) + '</div>';
  };
  const renderResults = () => {
    if (!state.searched) return '<div class="empty"><h2>Find your study resources</h2><p>Search a course code or subject for past papers, notes, syllabi, and resources.</p><div class="suggestions">' + ['Calculus', 'Data structures', 'Engineering physics', 'Browse courses'].map((label) => '<button class="suggestion" data-action="suggest" data-query="' + escape(label === 'Browse courses' ? '' : label) + '"' + (!state.ready ? ' disabled' : '') + '>' + label + '</button>').join('') + '</div></div>';
    const results = state.results.filter((item) => state.filter === 'all' || kindOf(item) === state.filter);
    return '<div class="section-head"><h2>' + escape(state.query || 'Browse resources') + '</h2><span class="muted">' + results.length + ' result' + (results.length === 1 ? '' : 's') + '</span></div>' + (results.length ? '<div class="grid">' + results.map(renderCard).join('') + '</div>' : '<div class="blank">' + (state.results.length ? 'No resources of this type. Try another filter.' : 'No matching resources. Try a course code or a shorter subject name.') + '</div>');
  };
  const render = () => {
    const focused = document.activeElement?.id === 'search-input';
    const draft = focused ? document.activeElement.value : state.query;
    root.innerHTML = '<header class="header"><div class="brand">' + logo + '<span>Exam<span class="ec-gradient-text">Cooker</span></span></div><form class="search ec-catalog-search" id="search-form" role="search"><label class="sr-only" for="search-input">Search ExamCooker</label><input id="search-input" type="search" maxlength="240" placeholder="Search course or code…" value="' + escape(draft) + '" autocomplete="off"><button type="submit" aria-label="Search" title="Search"' + (!state.ready ? ' disabled' : '') + '>' + searchIcon + '</button></form></header><nav class="filters" aria-label="Resource type">' + Object.entries(kinds).map(([kind,label]) => '<button class="filter" data-action="filter" data-kind="' + kind + '" aria-pressed="' + (state.filter === kind) + '">' + label + '</button>').join('') + '</nav>' + (state.error ? '<div class="notice" role="alert">' + escape(state.error) + '<button class="text-button" data-action="dismiss">Dismiss</button></div>' : '') + '<main id="results" aria-live="polite" aria-busy="' + state.busy + '">' + (state.busy ? '<div class="loading"><span class="spinner" aria-hidden="true"></span>Loading resources…</div>' : state.detail ? renderDetail() : renderResults()) + '</main>';
    if (focused) root.querySelector('#search-input').focus();
    sendSize();
  };
  const applyResult = (result) => {
    const initial = !initialToolResultSeen;
    initialToolResultSeen = true;
    // The opening tool can finish after the user has already searched or
    // followed a deep link. Its initial payload must not replace that navigation.
    if (initial && localNavigationStarted) return;
    // Host results, including failures, finish the previous operation.
    state.operation++; state.busy = false;
    let output;
    try { output = extract(result); } catch { state.error = 'ExamCooker could not load these resources. Try your search again.'; render(); return; }
    state.error = '';
    if (Array.isArray(output.results)) {
      state.results = output.results.filter(validSummary).map(summary);
      state.cards = result._meta?.cards || {};
      state.query = typeof output.query === 'string' ? output.query : typeof result._meta?.query === 'string' ? result._meta.query : toolQuery;
      state.searched = output.view !== 'workspace' || Boolean(state.query || state.results.length);
      state.detail = validSummary(output.detail) && typeof output.detail.text === 'string' ? output.detail : null;
    } else if (validSummary(output) && typeof output.text === 'string') { state.detail = output; }
    render(); syncContext();
  };
  const callTool = async (name, args) => { await bridgeReady; return request('tools/call', { name, arguments: args }); };
  const runSearch = async (query) => {
    localNavigationStarted = true;
    const operation = ++state.operation;
    state.query = query.trim().slice(0, 240); state.busy = true; state.error = ''; state.detail = null; syncContext(); render();
    try {
      const result = await callTool('search', { query: state.query });
      const output = extract(result);
      if (operation !== state.operation) return;
      state.results = (output.results || []).filter(validSummary).map(summary); state.cards = result._meta?.cards || {}; state.searched = true;
    } catch (error) { if (operation === state.operation) state.error = error.message; }
    finally { if (operation === state.operation) { state.busy = false; render(); } }
  };
  const openResource = async (id) => {
    localNavigationStarted = true;
    const operation = ++state.operation;
    state.busy = true; state.error = ''; render();
    try {
      const output = extract(await callTool('fetch', { id }));
      if (operation !== state.operation) return;
      if (!validSummary(output) || typeof output.text !== 'string') throw new Error('This resource is unavailable. Try another source.');
      state.detail = output; syncContext();
    } catch (error) { if (operation === state.operation) state.error = error.message; }
    finally { if (operation === state.operation) { state.busy = false; render(); } }
  };
  root.addEventListener('submit', (event) => { if (event.target.id !== 'search-form') return; event.preventDefault(); if (state.ready) void runSearch(root.querySelector('#search-input').value); });
  root.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const { action, id, kind, query } = button.dataset;
    if (action === 'open') void openResource(id);
    else if (action === 'suggest') void runSearch(query);
    else if (action === 'filter') { state.operation++; state.busy = false; state.filter = kind; state.detail = null; persist(); render(); syncContext(); }
    else if (action === 'back') { state.operation++; state.busy = false; state.detail = null; render(); syncContext(); }
    else if (action === 'dismiss') { state.error = ''; render(); }
  });
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.jsonrpc !== '2.0') return;
    if (message.id != null && pending.has(message.id)) {
      const handler = pending.get(message.id); clearTimeout(handler.timer); pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message || 'The host could not complete this request.'));
      else handler.resolve(message.result);
      return;
    }
    if (message.method === 'ui/notifications/tool-result') applyResult(message.params);
    else if (message.method === 'ui/notifications/tool-input') toolQuery = typeof message.params?.arguments?.query === 'string' ? message.params.arguments.query : '';
    else if (message.method === 'ui/notifications/host-context-changed') applyHostContext(message.params);
    else if (message.method === 'ui/notifications/tool-cancelled') { state.operation++; state.busy = false; state.error = 'The request was cancelled. You can try again.'; render(); }
    else if (message.method === 'ui/resource-teardown' && message.id != null) {
      for (const handler of pending.values()) { clearTimeout(handler.timer); handler.reject(new Error('Resource browser closed.')); }
      pending.clear(); window.parent.postMessage({ jsonrpc: '2.0', id: message.id, result: {} }, '*');
    }
  });
  try {
    const saved = window.openai?.widgetState?.privateContent;
    if (saved?.version === 3 && Object.prototype.hasOwnProperty.call(kinds, saved.filter)) state.filter = saved.filter;
  } catch {}
  const bridgeReady = request('ui/initialize', {
    protocolVersion: '2026-01-26', appInfo: { name: 'examcooker-resource-browser', version: '0.3.0' },
    appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
  }, 10000).then((result) => {
    hostCapabilities = result?.hostCapabilities || {}; state.ready = true;
    notify('ui/notifications/initialized', {}); render(); applyHostContext(result?.hostContext);
  });
  bridgeReady.catch(() => { state.error = 'ExamCooker could not connect. Reopen it in ChatGPT to retry.'; render(); });
  document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  new ResizeObserver(sendSize).observe(root);
  render();
})();
`;
