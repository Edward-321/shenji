// ==UserScript==
// @name         网页工具箱
// @namespace    safari-script-studio.original
// @version      1.1.0
// @description  侧边悬浮面板：页内中文翻译（不跳转、不走代理）、媒体资源嗅探、广告外观过滤、本站 CSS、自动滚动。功能按站点保存，默认全部关闭。
// @match        http://*/*
// @match        https://*/*
// @run-at       document-end
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==
(() => {
  'use strict';
  if (window.top !== window.self || window.__sssToolkit) return;
  window.__sssToolkit = true;

  const CFG_KEY = `toolkit.options:${location.origin}`;
  const defaults = {
    provider: 'youdao', side: 'right', slot: 'middle', showHandle: true, autoOpen: false,
    sniff: false, ads: false, css: '', scroll: false, scrollPixels: 120, scrollSeconds: 3, autoTranslate: false,
  };
  const cfg = { ...defaults, ...GM_getValue(CFG_KEY, {}) };
  const LIMIT = { youdao: 800, mymemory: 400 };
  const batchLimit = () => LIMIT[cfg.provider] || 800;
  const save = () => Promise.resolve(GM_setValue(CFG_KEY, cfg)).catch(() => {});

  let host, root, panel, handle, body, progressEl, sniffBox, statusEl;
  let open = false, dragging = null, observer, mediaTimer, scrollTimer;

  /* ---------------- 页内翻译：不发跳转，不经过代理 ---------------- */
  const originals = new Map();
  let translating = false, cancelRequested = false, done = 0, total = 0, failed = 0, currentNode = null;

  const isCJK = (text) => {
    const chars = [...text.replace(/\s/g, '')];
    if (!chars.length) return true;
    let hit = 0;
    for (const ch of chars) if (/[\u3400-\u9FFF\uF900-\uFAFF]/.test(ch)) hit++;
    return hit / chars.length > 0.3;
  };
  const hasWords = (text) => /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\uAC00-\uD7AF]/.test(text);
  const SKIP = 'script,style,noscript,code,pre,kbd,samp,textarea,select,option,svg,math,canvas,iframe,[contenteditable=""],[contenteditable="true"],[translate="no"],.notranslate';

  function collectTextNodes() {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const raw = node.nodeValue;
        if (!raw || raw.trim().length < 2) return NodeFilter.FILTER_REJECT;
        const el = node.parentElement;
        if (!el || el.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        if (isCJK(raw) || !hasWords(raw)) return NodeFilter.FILTER_REJECT;
        if (!el.getClientRects().length) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode() && out.length < 1500) out.push(walker.currentNode);
    return out;
  }
  function buildBatches(nodes) {
    const limit = batchLimit(), batches = []; let group = [], size = 0;
    for (const node of nodes) {
      const len = node.nodeValue.trim().length;
      if (len > limit) { if (group.length) { batches.push(group); group = []; size = 0; } batches.push([node]); continue; }
      const add = group.length ? size + len + 1 : len;
      if (add > limit) { batches.push(group); group = []; size = 0; }
      group.push(node); size = group.length > 1 ? size + len + 1 : len;
    }
    if (group.length) batches.push(group);
    return batches;
  }
  function report() {
    if (progressEl) progressEl.textContent = translating ? `翻译中… 已翻译 ${done}/${total} 段${failed ? `，跳过 ${failed} 段` : ''}` : (total ? `上次翻译 ${done}/${total} 段${failed ? `，跳过 ${failed} 段` : ''}` : '尚未翻译本页');
  }
  async function runBatch(nodes) {
    if (cancelRequested) return;
    const lines = nodes.map((n) => n.nodeValue);
    let res;
    try { res = await (globalThis.browser || globalThis.chrome).runtime.sendMessage({ type: 'translate', provider: cfg.provider, lines }); }
    catch (e) { res = { ok: false, error: String(e && e.message || e) }; }
    if (!res || !res.ok || !Array.isArray(res.lines) || res.lines.length !== nodes.length) { failed++; report(); return; }
    nodes.forEach((node, i) => {
      const text = res.lines[i];
      if (typeof text !== 'string' || !text.trim()) return;
      if (!originals.has(node)) originals.set(node, node.nodeValue);
      node.nodeValue = text;
    });
    done++; report();
  }
  async function translatePage() {
    if (translating) return;
    const nodes = collectTextNodes();
    if (!nodes.length) { if (statusEl) statusEl.textContent = '本页没有需要翻译的外文段落。'; return; }
    translating = true; cancelRequested = false; done = 0; failed = 0; total = nodes.length; report();
    const batches = buildBatches(nodes);
    let cursor = 0;
    const worker = async () => { while (!cancelRequested) { const batch = batches[cursor++]; if (!batch) return; await runBatch(batch); await new Promise((r) => setTimeout(r, 120)); } };
    try { await Promise.all([worker(), worker()]); } finally { translating = false; report(); }
  }
  function restorePage() {
    let count = 0;
    for (const [node, text] of originals) { if (node.isConnected) { node.nodeValue = text; count++; } }
    originals.clear(); done = 0; total = 0; failed = 0; report();
    if (statusEl) statusEl.textContent = `已还原 ${count} 段原文。`;
  }
  function stopTranslate() { cancelRequested = true; translating = false; report(); }

  /* ---------------- 可选功能：资源嗅探 / 广告外观过滤 / 本站 CSS / 自动滚动 ---------------- */
  const resources = new Map();
  const cssStyle = document.createElement('style');
  const adStyle = document.createElement('style');
  function applyStyles() {
    cssStyle.textContent = typeof cfg.css === 'string' ? cfg.css.slice(0, 50000) : '';
    adStyle.textContent = cfg.ads ? '[data-ad-slot],ins.adsbygoogle,#carbonads,.adsbygoogle{display:none!important}' : '';
    for (const s of [cssStyle, adStyle]) if (!s.isConnected) (document.head || document.documentElement).append(s);
  }
  const safeURL = (value) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try { const u = new URL(value, location.href); return /^https?:$/.test(u.protocol) ? u.href : null; } catch (_) { return null; }
  };
  let renderPending = false;
  function renderResources() {
    if (!sniffBox || renderPending) return;
    renderPending = true;
    setTimeout(() => {
      renderPending = false;
      if (!sniffBox) return;
      sniffBox.replaceChildren();
      for (const [url, type] of resources) {
        const line = document.createElement('div');
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = `[${type}] ${url}`;
        line.append(a); sniffBox.append(line);
      }
    }, 300);
  }
  function addResource(value, type) {
    const url = safeURL(value);
    if (!url || resources.has(url) || resources.size >= 200) return;
    resources.set(url, type); renderResources();
  }
  const scanMedia = () => document.querySelectorAll('video,audio,video source,audio source').forEach((m) => addResource(m.currentSrc || m.src, 'media'));
  function ingest(entries) {
    for (const e of entries) if (['video', 'audio'].includes(e.initiatorType) || /\.(mp4|m4a|mp3|webm|ogg|wav|m3u8|mpd)(?:[?#]|$)/i.test(e.name)) addResource(e.name, e.initiatorType || 'resource');
  }
  function updateSniff() {
    if (observer) observer.disconnect();
    observer = null; clearInterval(mediaTimer);
    if (!cfg.sniff) return;
    ingest(performance.getEntriesByType('resource')); scanMedia();
    if ('PerformanceObserver' in window) { try { observer = new PerformanceObserver((l) => ingest(l.getEntries())); observer.observe({ type: 'resource', buffered: true }); } catch (_) { /* 旧内核只靠媒体扫描 */ } }
    mediaTimer = setInterval(() => { if (!document.hidden) scanMedia(); }, 4000);
  }
  function updateScroll() {
    clearInterval(scrollTimer);
    if (!cfg.scroll) return;
    const seconds = Math.max(1, Math.min(60, Number(cfg.scrollSeconds) || 3));
    const pixels = Math.max(10, Math.min(1000, Number(cfg.scrollPixels) || 120));
    scrollTimer = setInterval(() => {
      const el = document.activeElement;
      if (document.hidden || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName || '') || el?.isContentEditable) return;
      window.scrollBy({ top: pixels, behavior: 'auto' });
    }, seconds * 1000);
  }

  /* ---------------- 侧边悬浮面板 ---------------- */
  function buildUI() {
    host = document.createElement('div');
    host.dataset.side = cfg.side === 'left' ? 'left' : 'right';
    host.dataset.slot = ['top', 'middle', 'bottom'].includes(cfg.slot) ? cfg.slot : 'middle';
    root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `:host{position:fixed;z-index:2147483647;pointer-events:none;display:flex;align-items:center;transition:top .18s ease;font:13px/1.55 -apple-system,system-ui,sans-serif;color:#18202a;color-scheme:light}:host([data-side="right"]){right:0;flex-direction:row-reverse}:host([data-side="left"]){left:0;flex-direction:row}:host([data-slot="middle"]){top:50%;transform:translateY(-50%)}:host([data-slot="top"]){top:8vh}:host([data-slot="bottom"]){top:72vh}*{box-sizing:border-box}.handle{pointer-events:auto;width:26px;height:76px;border:0;border-radius:10px 0 0 10px;background:rgba(9,120,124,.85);color:#fff;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:pointer;box-shadow:-1px 0 8px rgba(0,0,0,.25);padding:0}:host([data-side="left"]) .handle{border-radius:0 10px 10px 0;box-shadow:1px 0 8px rgba(0,0,0,.25)}.handle i{writing-mode:vertical-rl;font-style:normal;font-size:11px;letter-spacing:2px}.panel{pointer-events:auto;width:min(320px,80vw);max-height:70vh;overflow:auto;background:#fff;border:1px solid #c9d6e2;border-radius:12px;margin:0 6px;box-shadow:0 8px 30px rgba(0,0,0,.28);padding:12px}.panel[hidden]{display:none}h2{font-size:14px;margin:0 0 6px}button{font:inherit;font-size:12px;margin:3px 3px 3px 0;padding:6px 9px;border:1px solid #c9d6e2;background:#f4f8fb;border-radius:7px;cursor:pointer}.primary{background:#0d8b8f;border-color:#0d8b8f;color:#fff}label{display:block;margin:8px 0;font-size:12px}select,textarea,input[type=number]{font:inherit;font-size:12px;border:1px solid #c9d6e2;border-radius:6px;padding:4px;background:#fff}textarea{width:100%;height:80px;font-family:ui-monospace,monospace}.sniff{max-height:150px;overflow:auto;font-size:11px;word-break:break-all;border-top:1px solid #e6edf3;margin-top:6px;padding-top:6px}.sniff a{color:#1558b0;text-decoration:none}.tip{color:#6b7c8d;font-size:11px;margin:6px 0}.progress{font-size:12px;color:#0d6a6e;margin:6px 0;min-height:18px}hr{border:0;border-top:1px solid #e6edf3;margin:10px 0}`;
    root.append(style);
    handle = document.createElement('button');
    handle.type = 'button'; handle.className = 'handle';
    const mark = document.createElement('i'); mark.textContent = '澄页';
    handle.append(mark);
    handle.title = '澄页工具箱（拖动可上下吸附）';
    panel = document.createElement('section'); panel.className = 'panel'; panel.hidden = true;
    panel.append(el('h2', '网页工具箱'));
    const row1 = el('div');
    const btnTranslate = el('button', '翻译本页为中文', 'primary');
    btnTranslate.onclick = () => translatePage();
    const btnRestore = el('button', '还原原文'); btnRestore.onclick = () => restorePage();
    const btnStop = el('button', '停止'); btnStop.onclick = () => stopTranslate();
    const btnClose = el('button', '收起'); btnClose.onclick = () => toggle(false);
    row1.append(btnTranslate, btnRestore, btnStop, btnClose);
    progressEl = el('div', '', 'progress');
    panel.append(row1, progressEl);
    const providerLabel = el('label', '翻译服务：');
    const providerSel = document.createElement('select');
    for (const [value, text] of [['youdao', '有道（免密，推荐）'], ['mymemory', 'MyMemory（备用）']]) { const o = document.createElement('option'); o.value = value; o.textContent = text; providerSel.append(o); }
    providerSel.value = cfg.provider;
    providerSel.onchange = () => { cfg.provider = providerSel.value; save(); report(); };
    providerLabel.append(providerSel);
    panel.append(providerLabel, el('p', '待翻译文字会发送给所选第三方翻译服务（有道或 MyMemory），不需要跳转和代理。译文只是替换页面文字，不会改动原文数据。', 'tip'));
    panel.append(check('本页自动翻译（按站点记住）', 'autoTranslate', () => { if (cfg.autoTranslate) setTimeout(translatePage, 600); }));
    panel.append(el('hr'));
    panel.append(check('资源嗅探（仅当前页面可见的 HTTP(S) 媒体地址，最多 200 条）', 'sniff', updateSniff));
    sniffBox = el('div', '', 'sniff');
    const btnClear = el('button', '清空资源列表'); btnClear.onclick = () => { resources.clear(); renderResources(); };
    panel.append(btnClear, sniffBox);
    renderResources();
    panel.append(el('p', '不解密 DRM，不抓取受保护内容；blob/MSE、加密流、跨域帧及未加载资源可能不可见。链接可能含敏感签名，不自动上传。', 'tip'));
    panel.append(check('可选广告外观过滤（可能误隐藏内容，仅隐藏元素、不拦截请求）', 'ads', applyStyles));
    panel.append(check('自动向下滚动（后台或输入时暂停）', 'scroll', updateScroll));
    const speed = el('div');
    for (const [key, text, min, max] of [['scrollPixels', '每次像素', 10, 1000], ['scrollSeconds', '间隔秒数', 1, 60]]) {
      const label = el('label', text + ' ');
      const input = document.createElement('input');
      input.type = 'number'; input.min = String(min); input.max = String(max); input.value = String(cfg[key]);
      input.onchange = () => { cfg[key] = Math.max(min, Math.min(max, Number(input.value) || defaults[key])); input.value = String(cfg[key]); save(); updateScroll(); };
      label.append(input); speed.append(label);
    }
    panel.append(speed);
    const cssLabel = el('label', '本站 CSS（只粘贴可信内容；url()/@import 会让浏览器向第三方发请求）');
    const cssArea = document.createElement('textarea');
    cssArea.value = typeof cfg.css === 'string' ? cfg.css : ''; cssArea.maxLength = 50000;
    cssLabel.append(cssArea);
    const btnCss = el('button', '保存并应用 CSS');
    btnCss.onclick = () => { cfg.css = cssArea.value; save(); applyStyles(); if (statusEl) statusEl.textContent = '已应用本站 CSS。'; };
    panel.append(cssLabel, btnCss, el('hr'));
    const sideLabel = el('label', '面板位置：');
    const btnSide = el('button', cfg.side === 'left' ? '移到右侧' : '移到左侧');
    btnSide.onclick = () => { host.dataset.side = host.dataset.side === 'left' ? 'right' : 'left'; cfg.side = host.dataset.side; btnSide.textContent = cfg.side === 'left' ? '移到右侧' : '移到左侧'; save(); };
    const btnSlot = el('button', '回到垂直居中');
    btnSlot.onclick = () => setSlot('middle');
    const btnHide = el('button', '隐藏本页悬浮按钮');
    btnHide.onclick = () => { cfg.showHandle = false; save(); toggle(false); host.remove(); registerMenuCommands(); };
    sideLabel.append(btnSide, btnSlot, btnHide);
    panel.append(sideLabel);
    statusEl = el('p', '自动化仅滚动，不自动点击、提交、同意 Cookie 或填写表单。', 'tip');
    panel.append(statusEl);
    root.append(handle, panel);
    bindDrag();
    if (cfg.showHandle) document.documentElement.append(host);
    return host;
  }
  function el(tag, text, cls) { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; }
  function check(text, key, onChange) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox'; input.checked = Boolean(cfg[key]);
    input.onchange = () => { cfg[key] = input.checked; save(); onChange?.(); };
    label.append(input, document.createTextNode(text));
    return label;
  }
  function setSlot(slot) { host.dataset.slot = slot; host.style.top = ''; host.style.transform = ''; cfg.slot = slot; save(); }
  function toggle(next) {
    open = next ?? !open;
    if (open && !host.isConnected) document.documentElement.append(host);
    panel.hidden = !open;
    handle.style.borderRadius = open ? (host.dataset.side === 'left' ? '0 10px 10px 0' : '10px 0 0 10px') : (host.dataset.side === 'left' ? '0 10px 10px 0' : '10px 0 0 10px');
    if (open) report();
  }
  function bindDrag() {
    let startY = 0, startTop = 0, moved = 0;
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const rect = host.getBoundingClientRect();
      startY = e.clientY; startTop = rect.top; moved = 0;
      dragging = true; host.style.transition = 'none'; host.style.transform = 'none';
      try { handle.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
      e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      moved = Math.max(moved, Math.abs(e.clientY - startY));
      const top = Math.max(0, Math.min(window.innerHeight - 90, startTop + e.clientY - startY));
      host.style.top = `${top}px`;
    });
    const finish = (e) => {
      if (!dragging) return;
      dragging = false; host.style.transition = 'top .18s ease';
      const center = host.getBoundingClientRect().top + 38;
      const h = window.innerHeight || 800;
      const nearest = center < h * 0.33 ? 'top' : center < h * 0.66 ? 'middle' : 'bottom';
      setSlot(nearest);
      if (moved < 6) toggle();
      try { handle.releasePointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  }
  /* ---------------- 入口 ---------------- */
  function registerMenuCommands() {
    GM_registerMenuCommand((cfg.showHandle ? '隐藏' : '显示') + '本页悬浮按钮', () => {
      cfg.showHandle = !cfg.showHandle; save();
      if (cfg.showHandle) { if (!host.isConnected) document.documentElement.append(host); toggle(true); }
      else { toggle(false); host.remove(); }
    });
    GM_registerMenuCommand('打开工具箱（侧边悬浮）', () => toggle(true));
    GM_registerMenuCommand('翻译本页为中文（页内翻译，不跳转）', () => translatePage());
    GM_registerMenuCommand('还原原文', () => restorePage());
    GM_registerMenuCommand('停止翻译', () => stopTranslate());
  }
  buildUI();
  registerMenuCommands();
  applyStyles();
  updateSniff();
  updateScroll();
  if (cfg.autoOpen) toggle(true);
  if (cfg.autoTranslate && !isCJK(document.title || '')) setTimeout(() => { if (!translating) translatePage(); }, 900);
  window.addEventListener('pagehide', () => { observer?.disconnect(); clearInterval(mediaTimer); clearInterval(scrollTimer); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) { updateSniff(); updateScroll(); } });
})();
