/* Shared metadata/matching; original implementation. */
(function(root){
const supported=new Set(['none','GM_getValue','GM_setValue','GM_deleteValue','GM_listValues','GM_addStyle','GM_registerMenuCommand','GM_unregisterMenuCommand','GM.getValue','GM.setValue','GM.deleteValue','GM.listValues','GM.addStyle']);
function parse(source){
 const block=source.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
 if(!block) throw Error('缺少 UserScript 元数据');
 const tags={}; for(const line of block[1].split('\n')){const m=line.match(/^\s*\/\/\s*@([\w:-]+)\s*(.*?)\s*$/);if(m)(tags[m[1]]??=[]).push(m[2]);}
 if(!tags.name?.[0])throw Error('脚本缺少 @name');
 const problems=[];for(const g of tags.grant||[])if(!supported.has(g))problems.push('不支持授权 '+g);
 for(const t of ['require','resource'])if(tags[t]?.length)problems.push('不支持 @'+t+' 外部依赖');
 if(tags['inject-into']?.includes('page'))problems.push('不支持页面主世界注入');
 if(!tags.match?.length&&!tags.include?.length)problems.push('缺少 @match / @include（不自动全站运行）');
 return {name:tags.name[0],namespace:tags.namespace?.[0]||'',version:tags.version?.[0]||'0',description:tags.description?.[0]||'',matches:tags.match||[],includes:tags.include||[],excludes:tags.exclude||[],excludeMatches:tags['exclude-match']||[],runAt:tags['run-at']?.[0]||'document-end',noframes:!!tags.noframes,grants:tags.grant||[],problems};
}
function glob(p,s){try{return new RegExp('^'+p.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*')+'$').test(s)}catch{return false}}
function match(p,url){try{const u=new URL(url);if(!/^https?:$/.test(u.protocol))return false;if(p==='<all_urls>')return true;const m=p.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);if(!m)return false;const h=m[2];return (m[1]==='*'||m[1]+':'===u.protocol)&&(h==='*'||h===u.hostname||(h.startsWith('*.')&&(u.hostname===h.slice(2)||u.hostname.endsWith('.'+h.slice(2)))))&&glob(m[3],u.pathname+u.search)}catch{return false}}
function include(p,url){if(p.startsWith('/')&&p.endsWith('/')){try{return new RegExp(p.slice(1,-1)).test(url)}catch{return false}}return glob(p,url)}
function applies(m,url){return (m.matches.some(p=>match(p,url))||m.includes.some(p=>include(p,url)))&&!m.excludes.some(p=>include(p,url))&&!m.excludeMatches.some(p=>match(p,url))}
const api={parse,glob,match,applies};root.ScriptCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
