// ==UserScript==
// @name         Script Studio · Toolkit
// @namespace    safari-script-studio.original
// @version      1.0.0
// @description  Opt-in resource list, movable panel, cosmetic filters, origin-local CSS/scroll automation and Chinese translation navigation.
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
  const key = `toolkit.options:${location.origin}`;
  const defaults = { sniff: false, ads: false, css: '', scroll: false, scrollPixels: 120, scrollSeconds: 3, autoChinese: false };
  const options = { ...defaults, ...GM_getValue(key, {}) };
  let host, root, resourceBox, status, observer, mediaTimer, scrollTimer;
  const resources = new Map();
  const save = () => Promise.resolve(GM_setValue(key, options)).catch(error => {
    console.warn('Script Studio settings save failed', error);
    if (status) status.textContent = '保存失败；本次设置仅在当前页面有效。';
  });
  const cssStyle = document.createElement('style');
  const adStyle = document.createElement('style');
  function applyStyles() {
    cssStyle.textContent = typeof options.css === 'string' ? options.css.slice(0, 50000) : '';
    // Cosmetic only; no requests blocked and no generic iframe/article selectors.
    adStyle.textContent = options.ads ? '[data-ad-slot],ins.adsbygoogle,#carbonads{display:none!important}' : '';
    for (const style of [cssStyle, adStyle]) if (!style.isConnected) (document.head || document.documentElement).append(style);
  }
  function safeURL(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try { const url = new URL(value, location.href); return /^https?:$/.test(url.protocol) ? url.href : null; } catch (_) { return null; }
  }
  let renderPending = false;
  function renderResources() {
    if (!resourceBox || renderPending) return;
    renderPending = true;
    setTimeout(() => {
      renderPending = false;
      if (!resourceBox) return;
      resourceBox.replaceChildren();
      for (const [url, type] of resources) {
        const line = document.createElement('div');
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = `[${type}] ${url}`;
        line.append(a); resourceBox.append(line);
      }
    }, 300);
  }
  function addResource(value, type) {
    const url = safeURL(value);
    if (!url || resources.has(url) || resources.size >= 200) return;
    resources.set(url, type); renderResources();
  }
  function scanMedia() {
    document.querySelectorAll('video,audio,video source,audio source').forEach(media => addResource(media.currentSrc || media.src, 'media'));
  }
  function ingest(entries) {
    for (const entry of entries) {
      if (['video', 'audio'].includes(entry.initiatorType) || /\.(mp4|m4a|mp3|webm|ogg|wav|m3u8|mpd)(?:[?#]|$)/i.test(entry.name)) addResource(entry.name, entry.initiatorType || 'resource');
    }
  }
  function updateSniff() {
    if (observer) observer.disconnect();
    observer = null; clearInterval(mediaTimer);
    if (!options.sniff) return;
    ingest(performance.getEntriesByType('resource')); scanMedia();
    if ('PerformanceObserver' in window) {
      try { observer = new PerformanceObserver(list => ingest(list.getEntries())); observer.observe({ type: 'resource', buffered: true }); } catch (_) { /* Older WebKit still has media scanning. */ }
    }
    mediaTimer = setInterval(() => { if (!document.hidden) scanMedia(); }, 4000);
  }
  function updateScroll() {
    clearInterval(scrollTimer);
    if (!options.scroll) return;
    const seconds = Math.max(1, Math.min(60, Number(options.scrollSeconds) || 3));
    const pixels = Math.max(10, Math.min(1000, Number(options.scrollPixels) || 120));
    scrollTimer = setInterval(() => {
      if (document.hidden || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable) return;
      window.scrollBy({ top: pixels, behavior: 'auto' });
    }, seconds * 1000);
  }
  function translate() {
    // Avoid translating Google services/proxy pages into themselves.
    if (/(^|\.)google\.[a-z.]+$|(^|\.)translate\.goog$/i.test(location.hostname)) {
      window.alert('为避免循环，不自动翻译 Google 或翻译代理页面。'); return;
    }
    if (!window.confirm('将离开当前页面，导航到 Google 翻译。完整页面 URL（含查询参数）会发送给 Google，Google 可能获取并处理网页内容。请勿用于私密、登录后、含令牌或敏感数据的页面。动态内容、登录和部分网站可能无法翻译。继续？')) return;
    const target = new URL('https://translate.google.com/translate');
    target.searchParams.set('sl', 'auto'); target.searchParams.set('tl', 'zh-CN');
    const original = new URL(location.href); original.hash = '';
    target.searchParams.set('u', original.href); location.assign(target.href);
  }
  function button(parent, text, handler) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', handler); parent.append(b); return b;
  }
  function checkbox(parent, text, name, callback) {
    const label = document.createElement('label'); const input = document.createElement('input');
    input.type = 'checkbox'; input.checked = Boolean(options[name]);
    input.addEventListener('change', () => { options[name] = input.checked; save(); callback?.(); });
    label.append(input, document.createTextNode(text)); parent.append(label); return input;
  }
  function openPanel() {
    if (host?.isConnected) { host.hidden = false; return; }
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;right:12px;top:70px;width:min(350px,calc(100vw - 24px));z-index:2147483647;color-scheme:light;';
    root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ':host{font:13px system-ui;color:#18202a}*{box-sizing:border-box}section{background:#fff;border:1px solid #bbc5d4;border-radius:12px;box-shadow:0 6px 28px #0003}header{padding:10px;background:#edf2fa;border-radius:12px;touch-action:none;cursor:move;display:flex;gap:8px;align-items:center}strong{flex:1}main{padding:10px;max-height:65vh;overflow:auto}button{margin:3px;padding:6px;cursor:pointer}label{display:block;margin:8px 0}textarea{width:100%;height:100px}a{overflow-wrap:anywhere;color:#1558b0}.resources{max-height:160px;overflow:auto;font-size:11px}p{line-height:1.5}input[type=number]{width:70px}';
    root.append(style);
    const section = document.createElement('section'); const header = document.createElement('header');
    const title = document.createElement('strong'); title.textContent = 'Script Studio 工具箱'; header.append(title);
    const main = document.createElement('main');
    button(header, '折叠', event => { main.hidden = !main.hidden; event.currentTarget.textContent = main.hidden ? '展开' : '折叠'; });
    button(header, '关闭', () => { host.hidden = true; });
    let drag;
    header.addEventListener('pointerdown', event => {
      if (event.target.closest('button') || event.button !== 0) return;
      const rect = host.getBoundingClientRect(); drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      header.setPointerCapture(event.pointerId); event.preventDefault();
    });
    header.addEventListener('pointermove', event => {
      if (!drag) return;
      host.style.right = 'auto';
      host.style.left = Math.max(0, Math.min(innerWidth - host.offsetWidth, drag.left + event.clientX - drag.x)) + 'px';
      host.style.top = Math.max(0, Math.min(innerHeight - 45, drag.top + event.clientY - drag.y)) + 'px';
    });
    const stopDrag = () => { drag = null; };
    header.addEventListener('pointerup', stopDrag); header.addEventListener('pointercancel', stopDrag); header.addEventListener('lostpointercapture', stopDrag);
    section.append(header, main); root.append(section); document.documentElement.append(host);
    const note = document.createElement('p'); note.textContent = '以下选项按源（协议+域名+端口）保存；默认全部关闭。关闭面板不会停止已启用功能。'; main.append(note);
    checkbox(main, '资源嗅探（仅当前页面可见 HTTP(S) 媒体 URL，最多 200 条）', 'sniff', updateSniff);
    resourceBox = document.createElement('div'); resourceBox.className = 'resources'; main.append(resourceBox); renderResources();
    button(main, '清空资源列表', () => { resources.clear(); renderResources(); });
    const limits = document.createElement('p'); limits.textContent = '不解密 DRM，不抓取受保护内容；blob/MSE、加密流、跨域帧及未加载资源可能不可见。链接可能含敏感签名，不自动上传。'; main.append(limits);
    checkbox(main, '可选广告外观过滤（可能误隐藏内容）', 'ads', applyStyles);
    checkbox(main, '自动向下滚动（后台/输入时暂停）', 'scroll', updateScroll);
    for (const [name, labelText, min, max] of [['scrollPixels', '每次像素', 10, 1000], ['scrollSeconds', '间隔秒数', 1, 60]]) {
      const label = document.createElement('label'); label.textContent = labelText + ' ';
      const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.value = String(options[name]);
      input.addEventListener('change', () => { options[name] = Math.max(min, Math.min(max, Number(input.value) || defaults[name])); input.value = String(options[name]); save(); updateScroll(); });
      label.append(input); main.append(label);
    }
    const cssLabel = document.createElement('label'); cssLabel.textContent = '本站 CSS（仅粘贴可信内容；url()/@import 可向第三方发请求）';
    const textarea = document.createElement('textarea'); textarea.value = typeof options.css === 'string' ? options.css : ''; textarea.maxLength = 50000; cssLabel.append(textarea); main.append(cssLabel);
    button(main, '保存并应用 CSS', () => { options.css = textarea.value; save(); applyStyles(); });
    const translateLabel = document.createElement('label'); const auto = document.createElement('input'); auto.type = 'checkbox'; auto.checked = options.autoChinese === true;
    auto.addEventListener('change', () => {
      if (auto.checked && !window.confirm('启用本站中文翻译提示：以后每次加载此源都会询问是否跳转 Google。仅确认跳转后才发送 URL；Google 可能处理页面内容。并非所有网站都可翻译。启用？')) { auto.checked = false; return; }
      options.autoChinese = auto.checked; save();
    });
    translateLabel.append(auto, document.createTextNode('每次打开本站提示中文翻译（仍需确认跳转）')); main.append(translateLabel);
    button(main, '通过 Google 翻译此页为中文…', translate);
    status = document.createElement('p'); status.textContent = '自动化仅滚动，不自动点击、提交、同意 Cookie 或填写表单。'; main.append(status);
  }
  GM_registerMenuCommand('打开工具箱（可拖动/折叠）', openPanel);
  GM_registerMenuCommand('暂停本站自动滚动', () => { options.scroll = false; updateScroll(); save(); });
  GM_registerMenuCommand('通过 Google 翻译为中文（第三方）…', translate);
  applyStyles(); updateSniff(); updateScroll();
  if (options.autoChinese === true && !/(^|\.)google\.[a-z.]+$|(^|\.)translate\.goog$/i.test(location.hostname)) setTimeout(translate, 800);
  window.addEventListener('pagehide', () => { observer?.disconnect(); clearInterval(mediaTimer); clearInterval(scrollTimer); });
  window.addEventListener('pageshow', event => { if (event.persisted) { updateSniff(); updateScroll(); } });
})();
