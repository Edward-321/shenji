// 工具箱测试台：桩掉 GM_* 与后台翻译消息，把 toolkit.user.js 当作内容脚本执行
const store = { 'toolkit.options:null': { showHandle: true, autoOpen: false, sniff: true, ads: false, css: '', scroll: false, scrollPixels: 120, scrollSeconds: 3, autoTranslate: false, provider: 'youdao', side: 'right', slot: 'middle' } };
window.GM_getValue = (k, d) => (k in store ? store[k] : d);
window.GM_setValue = (k, v) => { store[k] = v; return Promise.resolve(); };
window.GM_deleteValue = (k) => Promise.resolve(delete store[k]);
window.GM_listValues = () => Object.keys(store);
window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); return s; };
window.__sssMenu = {};
window.GM_registerMenuCommand = (name, fn) => { window.__sssMenu[name] = fn; document.getElementById('log').textContent += ' ' + name + ' |'; };
window.chrome = {
  runtime: {
    sendMessage: async (msg) => {
      if (msg.type !== 'translate') return { ok: true };
      await new Promise((r) => setTimeout(r, 150)); // 模拟网络往返
      return { ok: true, lines: msg.lines.map((t) => '【译】' + String(t).trim().slice(0, 10)) };
    }
  }
};
fetch('../extension/scripts/toolkit.user.js').then((r) => r.text()).then((src) => {
  // eslint-disable-next-line no-new-func
  new Function('GM_getValue', 'GM_setValue', 'GM_addStyle', 'GM_registerMenuCommand', src)(
    window.GM_getValue, window.GM_setValue, window.GM_addStyle, window.GM_registerMenuCommand
  );
  document.getElementById('log').textContent += ' 已加载工具箱';
});
