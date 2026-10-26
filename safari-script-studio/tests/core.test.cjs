const assert=require('node:assert/strict');const c=require('../extension/lib/core.js');let n=0;function t(name,fn){fn();n++;console.log('PASS',name)}
t('metadata',()=>{const m=c.parse('// ==UserScript==\n// @name Test\n// @match https://*.example.org/*\n// @grant GM_getValue\n// ==/UserScript==');assert.equal(m.name,'Test');assert.equal(m.problems.length,0);assert(c.applies(m,'https://a.example.org/foo'))});
t('missing metadata',()=>assert.throws(()=>c.parse('hello')));
t('unsupported dependencies',()=>assert.equal(c.parse('// ==UserScript==\n// @name X\n// @require https://x/x.js\n// @grant GM_xmlhttpRequest\n// ==/UserScript==').problems.length,3));
t('host boundary',()=>{assert(c.match('*://*.example.org/*','https://example.org/x'));assert(!c.match('*://*.example.org/*','https://notexample.org/x'));assert(!c.match('*://example.org/*','https://example.org.evil/x'))});
t('scheme boundary',()=>{assert(!c.match('<all_urls>','file:///etc/passwd'));assert(!c.match('https://*/*','http://example.org'))});
t('query/path',()=>{assert(c.match('https://*/*q=test*','https://x.org/?q=test'));assert(!c.match('https://x.org/abc','https://x.org/abcd'))});
t('exclusions',()=>assert(!c.applies({matches:['*://*/*'],includes:[],excludes:['*private*'],excludeMatches:[]},'https://x.org/private')));
t('regex include',()=>assert(c.applies({matches:[],includes:['/^https:\\/\\/x\\.org\\//'],excludes:[],excludeMatches:[]},'https://x.org/x')));
console.log(`${n} tests passed`);
