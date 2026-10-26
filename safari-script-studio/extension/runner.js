(async()=>{
'use strict';
const api=globalThis.browser;const commands=new Map();const errors=[];let serial=0,ran=0;
api.runtime.onMessage.addListener(msg=>{
 if(msg?.type==='status')return Promise.resolve({ran,errors,commands:[...commands].map(([id,v])=>({id,name:v.name}))});
 if(msg?.type==='command'&&commands.has(msg.id)){try{commands.get(msg.id).fn()}catch(e){console.error(e)}return Promise.resolve({ok:true})}
});
const state=await api.storage.local.get(['index','disabledHosts','paused']);
if(state.paused||(state.disabledHosts||[]).includes(location.hostname))return;
const ids=(state.index||[]).filter(x=>x.enabled&&ScriptCore.applies(x.meta,location.href)&&!(x.meta.noframes&&window!==top)).map(x=>x.id);
const keys=ids.flatMap(id=>['script:'+id,'values:'+id]);const data=keys.length?await api.storage.local.get(keys):{};
function ready(when){if(when==='document-start')return Promise.resolve();return new Promise(resolve=>{const done=()=>when==='document-idle'?setTimeout(resolve,100):resolve();if(document.readyState!=='loading')done();else document.addEventListener('DOMContentLoaded',done,{once:true})})}
await Promise.all(ids.map(async id=>{
 const s=data['script:'+id];if(!s||s.meta.problems.length)return;
 await ready(s.meta.runAt);const values=data['values:'+id]||{};
 const get=(k,d)=>Object.hasOwn(values,k)?values[k]:d;
 const set=(k,v)=>{values[k]=v;return api.runtime.sendMessage({type:'value',op:'set',id,key:String(k),value:v})};
 const del=k=>{delete values[k];return api.runtime.sendMessage({type:'value',op:'delete',id,key:String(k)})};
 const style=css=>{const el=document.createElement('style');el.textContent=css;(document.head||document.documentElement).append(el);return el};
 const register=(name,fn)=>{const n=id+':'+(++serial);commands.set(n,{name:s.meta.name+' · '+name,fn});return n};
 const all={GM_getValue:get,GM_setValue:set,GM_deleteValue:del,GM_listValues:()=>Object.keys(values),GM_addStyle:style,GM_registerMenuCommand:register,GM_unregisterMenuCommand:n=>commands.delete(n),GM_info:{script:{name:s.meta.name,version:s.meta.version},scriptHandler:'澄页',version:'0.2.0'},GM:{getValue:async(...a)=>get(...a),setValue:set,deleteValue:del,listValues:async()=>Object.keys(values),addStyle:style}};
 const grants=new Set(s.meta.grants);const exposed={};for(const [k,v]of Object.entries(all)){if(k==='GM_info'||grants.has(k))exposed[k]=v;else if(k==='GM')exposed.GM=Object.fromEntries(Object.entries(v).filter(([method])=>grants.has('GM.'+method)))}
 try{new Function(...Object.keys(exposed),'"use strict";\n'+s.source+'\n//# sourceURL=userscript-'+id+'.js')(...Object.values(exposed));ran++}catch(e){errors.push(s.meta.name+': '+e.message);console.error('[澄页]',s.meta.name,e)}
}));
})().catch(e=>console.error('[澄页启动失败]',e));
