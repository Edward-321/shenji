// ==UserScript==
// @name         Script Studio · Repair
// @namespace    safari-script-studio.original
// @version      1.0.0
// @description  Restore ordinary selection/copy; optional app-link guard and conservative tracking cleanup.
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==
(() => {
  'use strict';
  if (window.top !== window.self || window.__sssRepair) return;
  window.__sssRepair = true;
  const defaults = { enabled: true, cleanLinks: true, blockAppLinks: false };
  const config = { ...defaults, ...GM_getValue('repair.options', {}) };
  const persist = () => Promise.resolve(GM_setValue('repair.options', config)).catch(console.warn);
  for (const [key, title] of [['enabled', '选择/复制修复'], ['cleanLinks', '保守清理跟踪参数'], ['blockAppLinks', '阻止已知 App 跳转链接']]) {
    GM_registerMenuCommand(`${config[key] ? '✓' : '○'} ${title}（重载生效）`, () => {
      config[key] = !config[key]; persist();
    });
  }
  if (!config.enabled) return;
  GM_addStyle('html body :not(input):not(textarea):not(select):not([contenteditable]):not([contenteditable] *){-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important}');
  // Do not cancel the default browser action, synthesize clipboard contents, or
  // read the clipboard. Capture interception cannot undo earlier page listeners.
  for (const type of ['copy', 'cut', 'contextmenu', 'selectstart']) {
    window.addEventListener(type, event => {
      const target = event.target;
      if (target instanceof Element && target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
      event.stopImmediatePropagation();
    }, true);
  }
  const appSchemes = new Set(['weixin:', 'weibo:', 'sinaweibo:', 'zhihu:', 'bilibili:', 'snssdk1128:', 'snssdk143:', 'baiduboxapp:', 'taobao:', 'alipays:', 'intent:']);
  const tracking = /^(utm_(source|medium|campaign|term|content|id)|fbclid|gclid|dclid|msclkid)$/i;
  function clean(url) {
    // Signed/authorization URLs are left byte-for-byte unchanged.
    if ([...url.searchParams.keys()].some(k => /(^|[-_])(sig(nature)?|token|auth|credential|policy|expires)([-_]|$)/i.test(k))) return null;
    const keys = [...url.searchParams.keys()].filter(k => tracking.test(k));
    if (!keys.length) return null;
    keys.forEach(k => url.searchParams.delete(k));
    return url.href;
  }
  if (config.cleanLinks) {
    try {
      const cleaned = clean(new URL(location.href));
      if (cleaned) history.replaceState(history.state, '', cleaned);
    } catch (_) { /* Sandboxed documents may forbid history changes. */ }
  }
  window.addEventListener('click', event => {
    if (!event.isTrusted || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.composedPath().find(node => node instanceof HTMLAnchorElement);
    if (!anchor || anchor.hasAttribute('download')) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch (_) { return; }
    // Only explicit, trusted anchor activation is guarded. Do not patch location,
    // timers, arbitrary protocols, tel:, mailto:, or site JavaScript globally.
    if (config.blockAppLinks && appSchemes.has(url.protocol)) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (config.cleanLinks && /^https?:$/.test(url.protocol)) {
      const cleaned = clean(url);
      if (cleaned) anchor.href = cleaned;
    }
  }, true);
})();
