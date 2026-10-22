const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
const now=Date.now();
function answer(letter='a',offset=0,patch={}){
  return {id:letter.repeat(24),kind:'research.answer',question:`Question ${letter}?`,answer_markdown:'**Sourced answer** with [evidence](https://example.org/evidence).',
    chat_summary:'The claim remains unverified. https://example.org/evidence',
    stream_id:'abcdefghijk',stream_url:'https://www.youtube.com/watch?v=abcdefghijk&t=120s',
    created_at:new Date(now+offset).toISOString(),heard_at:new Date(now+offset-60000).toISOString(),
    sources:[{title:'Evidence',url:'https://example.org/evidence'}],...patch};
}
function core(){const context=vm.createContext({URL,Date,Map,Set});vm.runInContext(read('core.js'),context);return context.DR;}
async function ui(){
  const {Window}=await import('happy-dom');
  const window=new Window({url:'https://www.destiny.gg/embed/chat?follow=%2Fbigscreen'});
  window.document.body.innerHTML='<div id="chat"><div id="chat-output-frame"><div id="chat-win-main"><div class="chat-lines"><div class="msg-chat">Native chat</div></div></div></div><div id="chat-input-frame"><textarea></textarea></div></div>';
  window.eval(read('core.js'));window.eval(read('clipboard.js'));window.DR.styles=read('ui.css');window.eval(read('vendor/markdown-it.min.js'));window.eval(read('markdown.js'));window.eval(read('icons.js'));window.eval(read('ui.js'));
  return window;
}
function background({responses=[],feed,preferences,fetcher,updates,installed="0.1.4",channel="firefox",managed=true,updateCheck=async()=>({status:"no_update"}),browserUpdate}={}){
  let clock=now,calls=[],nativeCalls=[],badges=[];let availableListener;
  const stored={feed,preferences,browserUpdate,updates:updates||{version:1,releases:[],latest:null,nextCheck:now+3600000,checkedAt:now}};let listener;
  const api={action:{async setBadgeText(value){badges.push(value.text);}},runtime:{id:channel==='chrome'&&managed?'lgonddigopjaghgljjhjokpkpglcaboc':'test-extension',getManifest:()=>({version:installed,...(channel==='firefox'?{browser_specific_settings:{gecko:{id:'test'}}}:{})}),async requestUpdateCheck(){nativeCalls.push(clock);return updateCheck();},onUpdateAvailable:{addListener(fn){availableListener=fn;}},onMessage:{addListener(fn){listener=fn;}}},storage:{local:{
    async get(){return structuredClone(stored);},async set(data){Object.assign(stored,structuredClone(data));}
  }}};
  class Clock extends Date{static now(){return clock;}}
  const context=vm.createContext({URL,Date:Clock,Map,Set,AbortSignal,console,structuredClone,
    chrome:api,fetch:async(url,options)=>{calls.push({url,options});const result=fetcher?await fetcher(url,options):responses.shift();if(!result)throw new Error('Offline');return result;}});
  vm.runInContext(read('core.js')+'\n'+read('background.js'),context);
  const sender={id:api.runtime.id,url:'https://www.destiny.gg/embed/chat?follow=%2Fbigscreen',tab:{id:1}};
  const send=(message={type:'DR_FEED'},from=sender)=>new Promise(resolve=>listener(message,from,resolve));
  return {send,calls,stored,sender,nativeCalls,badges,async emitUpdate(details){return availableListener?.(details);},advance(ms){clock+=ms;},context};
}
const response=(answers=[],extra={},status=200)=>new Response(JSON.stringify({version:1,answers,next_cursor:answers.at(-1)?.id||null,has_more:false,...extra}),{status,headers:{etag:'"test"'}});
module.exports={read,root,now,answer,core,ui,background,response};
