const api=globalThis.browser;
let queue=Promise.resolve();
api.runtime.onMessage.addListener((msg,sender)=>{
 if(!sender.tab||msg?.type!=='value')return;
 if(!['set','delete'].includes(msg.op)||typeof msg.id!=='string'||typeof msg.key!=='string')return;
 queue=queue.catch(()=>{}).then(async()=>{
  const key='values:'+msg.id;const data=(await api.storage.local.get(key))[key]||{};
  if(msg.op==='delete')delete data[msg.key];else data[msg.key]=msg.value;
  await api.storage.local.set({[key]:data});return {ok:true};
 });return queue;
});
