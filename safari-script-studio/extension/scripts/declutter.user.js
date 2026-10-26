// ==UserScript==
// @name         弹窗清理
// @namespace    safari-script-studio.original
// @version      1.1.0
// @description  只隐藏已知的 Cookie 同意平台横幅和遮罩，绝不自动点击同意或拒绝。不绕过登录与付费墙，也不代表阻止跟踪。
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
  if (window.top !== window.self || window.__sssDeclutter) return;
  window.__sssDeclutter = true;
  const key = `declutter.enabled:${location.origin}`;
  let enabled = GM_getValue(key, true) !== false;
  // Explicit consent-provider identifiers only: no blanket dialog, fixed-position,
  // login/paywall, newsletter, overlay, iframe, or text-content heuristics.
  const selectors = ['#onetrust-banner-sdk', '#onetrust-consent-sdk .onetrust-pc-dark-filter', '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyUnderlay', '#truste-consent-track', '.qc-cmp2-container'];
  const style = document.createElement('style');
  style.textContent = selectors.join(',') + '{display:none!important;visibility:hidden!important;pointer-events:none!important}';
  function apply() {
    if (enabled && !style.isConnected) (document.head || document.documentElement).append(style);
    if (!enabled) style.remove();
  }
  apply();
  GM_registerMenuCommand('切换本站 Cookie 横幅隐藏（不表示同意）', () => {
    enabled = !enabled; apply();
    Promise.resolve(GM_setValue(key, enabled)).catch(console.warn);
  });
  GM_registerMenuCommand('关于横幅清理', () => {
    window.alert('仅隐藏已知同意管理平台的横幅，不点击同意/拒绝，不写入同意 Cookie，也不绕过登录或付费墙。网站可能仍跟踪，滚动也可能仍被锁定。需要设置隐私偏好时，请先通过菜单恢复横幅。');
  });
})();
