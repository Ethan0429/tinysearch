const test=require('node:test');const assert=require('node:assert/strict');
const {answer,background,response,now,core,read}=require('./helpers.cjs');
const preferences={enabled:true,notifications:true};
const toastDelivery={since:now-1000,seen:[]};
test('notification defaults are off and only regular non-DGG websites are eligible',()=>{
 const DR=core();assert.equal(DR.DEFAULTS.notifications,false);
 for(const url of ['https://example.org/','http://example.org/'])assert.equal(DR.notificationPage(url),true);
 for(const url of ['chrome://settings','about:blank','file:///tmp/a','https://www.destiny.gg/bigscreen','https://addons.mozilla.org/','https://chromewebstore.google.com/'])assert.equal(DR.notificationPage(url),false);
});
test('alarms fetch and notify without an open DGG tab; notifications are deduplicated across worker restarts',async()=>{
 const bg=background({preferences,toastDelivery,notificationAccess:true,responses:[response([answer()]),response([answer()])]});
 await bg.emitAlarm();assert.equal(bg.injections.length,1);assert.equal(bg.toasts.filter(item=>item.message.type==='DR_TOAST_SHOW').length,1);
 assert.equal(bg.toasts[0].message.answers[0].chat_summary,answer().chat_summary);
 bg.advance(31000);await bg.emitAlarm();assert.equal(bg.injections.length,1);
 const restarted=background({preferences,notificationAccess:true,feed:{...bg.stored.feed,nextPoll:0},toastDelivery:bg.stored.toastDelivery,responses:[response([answer()])]});
 await restarted.emitAlarm();assert.equal(restarted.injections.length,0);
});
test('first enable, stale catch-up and already cached messages never produce a toast backlog',async()=>{
 const bg=background({notificationAccess:true,responses:[response([answer('a',-100),answer('b',-180000)])]});
 const popup={id:bg.sender.id,url:'chrome-extension://test-extension/popup.html'};
 await bg.send({type:'DR_PREFERENCES',patch:{notifications:true}},popup);
 assert.equal(bg.alarm.periodInMinutes,0.5);await bg.emitAlarm();assert.equal(bg.injections.length,0);
 bg.advance(31000);const candidates=core().notificationCandidates([answer('a',-180000)],{since:0,seen:new Set(),now});
 assert.equal(candidates.length,0);
});
test('denied or revoked website access disables notification delivery and clears its alarm',async()=>{
 const bg=background();const popup={id:bg.sender.id,url:'chrome-extension://test-extension/popup.html'};
 const denied=await bg.send({type:'DR_PREFERENCES',patch:{notifications:true}},popup);assert.ok(denied.error);
 const enabled=background({preferences,toastDelivery,notificationAccess:true});
 await enabled.send({type:'DR_PREFERENCES'}, {id:enabled.sender.id,url:popup.url});
 await new Promise(setImmediate);assert.equal(enabled.alarm.periodInMinutes,0.5);
 await enabled.revokeAccess();assert.equal(enabled.stored.preferences.notifications,false);assert.equal(enabled.alarm,null);
 assert.ok(enabled.toasts.some(item=>item.message.type==='DR_TOAST_CLEAR'));
});
test('restricted pages, unfocused windows and failed injections do not break feed synchronization',async()=>{
 for(const patch of [{activeTab:{id:1,url:'chrome://settings/'}},{activeTab:{id:1,url:'https://www.destiny.gg/bigscreen'}},{windowFocused:false},{injectError:true}]){
  const bg=background({preferences,toastDelivery,notificationAccess:true,responses:[response([answer()])],...patch});
  const result=await bg.send();assert.equal(result.answers.length,1);assert.equal(result.error,null);
  assert.equal(bg.toasts.filter(item=>item.message.type==='DR_TOAST_SHOW').length,0);
 }
});
test('turning TinySearch off clears displayed toasts and stops background polling',async()=>{
 const bg=background({preferences,toastDelivery,notificationAccess:true});const popup={id:bg.sender.id,url:'chrome-extension://test-extension/popup.html'};
 await bg.send({type:'DR_PREFERENCES',patch:{enabled:false}},popup);assert.equal(bg.alarm,null);
 assert.ok(bg.toasts.some(item=>item.message.type==='DR_TOAST_CLEAR'));await bg.emitAlarm();assert.equal(bg.calls.length,0);
});
async function toastWindow(){
 const {Window}=await import('happy-dom');const w=new Window({url:'https://example.org/'});let receive;
 w.document.body.textContent='Existing website content';
 w.chrome={runtime:{id:'own',onMessage:{addListener(fn){receive=fn;}}}};
 const attach=w.Element.prototype.attachShadow;
 w.Element.prototype.attachShadow=function(){return attach.call(this,{mode:'open'});};
 w.eval(read('core.js'));w.eval(read('icons.js'));w.eval(read('clipboard.js'));w.DR.toastStyles=read('toast.css');w.eval(read('toast.js'));
 return {w,send(message,sender={id:'own'}){let result;receive(message,sender,value=>result=value);return result;},root(){return w.document.querySelector('#tinysearch-notification')?.shadowRoot;}};
}
test('toast renders the same safe summary, source links and copy prefix without changing website content',async()=>{
 const {w,send,root}=await toastWindow();const raw=answer('a',0,{chat_summary:'<img src=x> A sourced answer. https://example.org/evidence'});
 send({type:'DR_TOAST_SHOW',answers:[raw]});const shadow=root();assert.ok(shadow);
 assert.equal(w.document.body.textContent,'Existing website content');assert.equal(shadow.querySelectorAll('img,iframe,script').length,0);
 assert.match(shadow.querySelector('p').textContent,/<img src=x> A sourced answer/);
 assert.equal(shadow.querySelector('.source').href,'https://example.org/evidence');
 let copied;w.navigator.clipboard.writeText=async text=>{copied=text;};
 shadow.querySelector('[aria-label="Copy summary for chat"]').click();await new Promise(setImmediate);
 assert.equal(copied,'@Destiny '+raw.chat_summary);
 send({type:'DR_TOAST_SHOW',answers:[raw]});shadow.querySelector('[aria-label="Dismiss answer"]').click();assert.equal(root(),undefined);
 await w.happyDOM.abort();
});
test('toast ignores foreign senders, queues distinct answers and removes everything when disabled',async()=>{
 const {w,send,root}=await toastWindow();send({type:'DR_TOAST_SHOW',answers:[answer()]},{id:'foreign'});assert.equal(root(),undefined);
 send({type:'DR_TOAST_SHOW',answers:[answer(),answer('b')]});root().querySelector('[aria-label="Dismiss answer"]').click();assert.match(root().textContent,/Question|claim remains/);
 send({type:'DR_TOAST_CLEAR'});assert.equal(root(),undefined);await w.happyDOM.abort();
});
test('notifications dismiss after twelve seconds and pause while the pointer is over the card',async()=>{
 const {w,send,root}=await toastWindow();const timers=new Map();let id=0;
 w.setTimeout=(callback,delay)=>{assert.equal(delay,12000);timers.set(++id,callback);return id;};
 w.clearTimeout=value=>timers.delete(value);
 send({type:'DR_TOAST_SHOW',answers:[answer('a',0,{chat_summary:'First answer.'}),answer('b',0,{chat_summary:'Second answer.'})]});
 const card=root().querySelector('article');assert.equal(timers.size,1);
 card.dispatchEvent(new w.Event('mouseenter'));assert.equal(timers.size,0);
 card.dispatchEvent(new w.Event('mouseleave'));assert.equal(timers.size,1);
 [...timers.values()][0]();assert.equal(root().querySelector('p').textContent,'Second answer.');
 const last=[...timers.values()].at(-1);last();assert.equal(root(),undefined);await w.happyDOM.abort();
});
