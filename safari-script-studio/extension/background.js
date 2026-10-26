const api=globalThis.browser;
/* ---------- 用户脚本存储（串行写入） ---------- */
let queue=Promise.resolve();
api.runtime.onMessage.addListener((msg,sender)=>{
 if(msg?.type==='translate')return translateRequest(msg);
 if(!sender.tab||msg?.type!=='value')return;
 if(!['set','delete'].includes(msg.op)||typeof msg.id!=='string'||typeof msg.key!=='string')return;
 queue=queue.catch(()=>{}).then(async()=>{
  const key='values:'+msg.id;const data=(await api.storage.local.get(key))[key]||{};
  if(msg.op==='delete')delete data[msg.key];else data[msg.key]=msg.value;
  await api.storage.local.set({[key]:data});return {ok:true};
 });return queue;
});
/* ---------- 翻译代理：内容脚本不能跨域，由后台代发 ---------- */
const PROVIDERS={
 youdao:{limit:800,url:lines=>'https://aidemo.youdao.com/trans?'+new URLSearchParams({from:'auto',to:'zh-CHS',q:lines.join('\n')}),parse:json=>{if(String(json.errorCode)!=='0'||!Array.isArray(json.translation))throw Error('有道返回错误 '+(json.errorCode??'?'));return String(json.translation[0]).split('\n')}},
 mymemory:{limit:400,url:lines=>'https://api.mymemory.translated.net/get?'+new URLSearchParams({q:lines.join('\n'),langpair:'autodetect|zh-CN'}),parse:json=>{const text=json?.responseData?.translatedText;if(Number(json?.responseStatus)!==200||typeof text!=='string')throw Error('MyMemory 返回错误 '+(json?.responseStatus??'?'));return text.split('\n')}}
};
const cache=new Map();let cacheDirty=0;
api.storage.local.get('trcache').then(d=>{for(const [k,v]of Object.entries(d?.trcache||{}))cache.set(k,v)}).catch(()=>{});
function cacheKey(p,line){return p+'\u0001'+line}
function remember(p,line,out){
 if(!line||line.length>400||cache.size>4000)return;
 cache.set(cacheKey(p,line),out);cacheDirty++;
 if(cacheDirty>=25){cacheDirty=0;const obj={};let n=0;for(const [k,v]of cache){if(n++>=800)break;obj[k]=v}api.storage.local.set({trcache:obj}).catch(()=>{})}
}
let chain=Promise.resolve();
function serialize(task){const run=chain.then(task,task);chain=run.catch(()=>{}).then(()=>new Promise(r=>setTimeout(r,130)));return run}
async function fetchJSON(url,ms=9000){
 const stop=new AbortController();const timer=setTimeout(()=>stop.abort(),ms);
 try{const res=await fetch(url,{signal:stop.signal});if(!res.ok)throw Error('HTTP '+res.status);return await res.json()}
 finally{clearTimeout(timer)}
}
function splitLong(text,limit){
 const parts=[];let rest=text;
 while(rest.length>limit){
  const window=rest.slice(0,limit);let cut=Math.max(window.lastIndexOf('。'),window.lastIndexOf('！'),window.lastIndexOf('？'),window.lastIndexOf('. '),window.lastIndexOf('! '),window.lastIndexOf('? '),window.lastIndexOf('; '),window.lastIndexOf('，'));
  cut=cut>limit*0.4?cut+1:limit;parts.push(rest.slice(0,cut));rest=rest.slice(cut);
 }
 if(rest)parts.push(rest);return parts;
}
async function translateGroup(p,group,to){
 const spec=PROVIDERS[p];if(!spec)throw Error('未知翻译服务 '+p);
 const cached=group.map(l=>cache.get(cacheKey(p,l)));
 if(cached.every(v=>typeof v==='string'))return cached;
 const json=await fetchJSON(spec.url(group));
 let out=spec.parse(json);
 if(out.length!==group.length){const single=[];for(const line of group){const j=await fetchJSON(spec.url([line]));const r=spec.parse(j);if(r.length!==1)throw Error('译文行数不匹配');single.push(r[0])}out=single}
 group.forEach((line,i)=>remember(p,line,out[i]));
 return out;
}
async function translateRequest(msg){
 const provider=PROVIDERS[msg?.provider]?msg.provider:'youdao';
 const lines=Array.isArray(msg?.lines)?msg.lines.filter(l=>typeof l==='string'&&l.trim()):[];
 if(!lines.length)return {ok:true,lines:[]};
 const limit=PROVIDERS[provider].limit;
 const parts=[],owner=[];
 lines.forEach((line,i)=>{const pieces=line.length>limit?splitLong(line,limit):[line];for(const piece of pieces){parts.push(piece);owner.push(i)}});
 try{
  const pieceOut=await serialize(async()=>{
   const result=[];let group=[],size=0;
   const flush=async()=>{if(!group.length)return;const translated=await translateGroup(provider,group);result.push(...translated);group=[];size=0};
   for(const piece of parts){
    const add=group.length?size+piece.length+1:piece.length;
    if(add>limit)await flush();
    group.push(piece);size=group.length>1?size+piece.length+1:piece.length;
   }
   await flush();return result;
  });
  if(pieceOut.length!==parts.length)throw Error('译文段数不匹配');
  const out=lines.map(()=>'');
  pieceOut.forEach((text,i)=>{out[owner[i]]+=text});
  lines.forEach((line,i)=>remember(provider,line,out[i]));
  return {ok:true,lines:out};
 }catch(e){return {ok:false,error:String(e?.message||e)}}
}
// 升级迁移：清掉旧版本内置脚本（英文名 Script Studio · *），避免重装后留下重复条目
async function migrateLegacy(){
 try{
  const data=await api.storage.local.get('index');
  const index=Array.isArray(data.index)?data.index:[];
  const legacy=index.filter(s=>s?.meta?.namespace==='safari-script-studio.original'&&/^Script Studio · /.test(s?.meta?.name||''));
  if(!legacy.length)return;
  await api.storage.local.set({index:index.filter(s=>!legacy.includes(s))});
  const remove=legacy.map(s=>'values:'+s.id);
  if(api.storage.local.remove)await api.storage.local.remove(remove);
 }catch(e){console.warn('[澄页] 迁移失败',e)}
}
if(api.runtime.onInstalled)api.runtime.onInstalled.addListener(()=>{migrateLegacy()});
if(api.runtime.onStartup)api.runtime.onStartup.addListener(()=>{migrateLegacy()});
migrateLegacy();
