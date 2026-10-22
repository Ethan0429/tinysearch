const test=require('node:test');const assert=require('node:assert/strict');
const {ui,answer,now}=require('./helpers.cjs');
function snapshot(answers,preferences={}){return {answers,preferences,lastSuccess:now,error:null};}
test('research integrates into the observed DGG iframe without changing native messages or composer',async()=>{
  const w=await ui();let data=snapshot([answer()]);const app=new w.DR.ChatApp({transport:async()=>data,now:()=>now});await app.tick();
  assert.equal(w.document.querySelectorAll('[data-dr-toolbar]').length,1);assert.equal(w.document.querySelectorAll('[data-dr-answer]').length,1);
  assert.equal(w.document.querySelector('.msg-chat').textContent,'Native chat');assert.ok(w.document.querySelector('textarea'));
  await app.tick();assert.equal(w.document.querySelectorAll('[data-dr-answer]').length,1);
  data=snapshot([answer(),answer('b',1000)]);await app.tick();assert.equal(w.document.querySelectorAll('[data-dr-answer]').length,2);
  app.destroy();w.happyDOM.abort();
});
test('backfill remains searchable and previous/next navigation selects individual answers',async()=>{
  const w=await ui();const answers=[answer('a',-7200000,{question:'A question about oceans?'}),answer('b',-3600000,{question:'A question about mountains?'})];
  const app=new w.DR.ChatApp({transport:async()=>snapshot(answers),now:()=>now});await app.tick();
  assert.equal(w.document.querySelectorAll('[data-dr-answer]').length,0);app.toggle(true);assert.equal(app.results.querySelectorAll('button').length,2);
  assert.equal(app.selected,answer('b').id);app.step(-1);assert.equal(app.selected,answer('a').id);app.step(1);assert.equal(app.selected,answer('b').id);
  app.search.value='oceans';app.search.dispatchEvent(new w.Event('input'));assert.equal(app.results.querySelectorAll('button').length,1);assert.equal(app.selected,answer('a').id);
  assert.ok(app.reader.textContent.includes('A question about oceans?'));app.destroy();w.happyDOM.abort();
});
test('unsafe answer content is inert text, never HTML or executable links',async()=>{
  const w=await ui();const attack=answer('a',0,{question:'<img src=x onerror=alert(1)>',answer_markdown:'<script>alert(1)</script> [click](javascript:alert(1)) **safe** [source](https://example.org)'});
  const card=w.DR.card(attack,{compact:false,archive:true});
  assert.equal(card.querySelectorAll('script,img,iframe').length,0);assert.ok(card.textContent.includes('<script>'));assert.ok(card.querySelector('strong'));
  for(const a of card.querySelectorAll('a[href]')){assert.match(a.href,/^https?:/);assert.equal(a.rel,'noopener noreferrer');}
  w.happyDOM.abort();
});
test('inline summary is complete and full answer opens the detailed reader',async()=>{
  const w=await ui();const data=answer();let selected;
  const card=w.DR.card(data,{onBrowse:id=>selected=id});
  assert.equal(card.querySelector('.chat-summary').textContent,'The claim remains unverified. [1]');
  assert.equal(card.querySelectorAll('a').length,1);
  assert.equal(card.querySelector('.question'),null);assert.equal(card.querySelector('.prose'),null);
  card.querySelector('.card-actions button').click();assert.equal(selected,data.id);
  const app=new w.DR.ChatApp({transport:async()=>snapshot([data]),now:()=>now});await app.tick();
  w.document.querySelector('[data-dr-answer]').shadowRoot.querySelector('.card-actions button').click();
  assert.equal(app.open,true);assert.ok(app.reader.textContent.includes('Sourced answer'));
  assert.equal(app.reader.querySelectorAll('.source-link').length,1);app.destroy();w.happyDOM.abort();
});
test('disabled inline cards and video filtering still allow archive reading',async()=>{
  const w=await ui();const app=new w.DR.ChatApp({transport:async()=>snapshot([answer()],{inline:false}),context:()=> 'xxxxxxxxxxx',now:()=>now});await app.tick();
  assert.equal(w.document.querySelectorAll('[data-dr-answer]').length,0);app.toggle(true);assert.equal(app.results.querySelectorAll('button').length,1);
  app.setScope('stream');assert.equal(app.results.querySelectorAll('button').length,0);app.destroy();w.happyDOM.abort();
});
test('a native chat refresh mounts one toolbar and preserves history',async()=>{
  const w=await ui();const app=new w.DR.ChatApp({transport:async()=>snapshot([answer()]),now:()=>now});await app.tick();
  w.document.querySelector('#chat-win-main .chat-lines').replaceWith(w.document.createElement('div'));w.document.querySelector('#chat-win-main div').className='chat-lines';
  app.mount();await app.tick();assert.equal(w.document.querySelectorAll('[data-dr-toolbar]').length,1);assert.equal(app.answers.length,1);app.destroy();w.happyDOM.abort();
});
test('new inline answers do not yank a scrolled-up viewer to the bottom',async()=>{
  const w=await ui();const app=new w.DR.ChatApp({transport:async()=>snapshot([answer()]),now:()=>now});app.mount();
  Object.defineProperty(app.lines,'scrollHeight',{value:2000,configurable:true});Object.defineProperty(app.lines,'clientHeight',{value:500,configurable:true});
  app.lines.scrollTop=200;await app.tick();assert.equal(app.lines.scrollTop,200);app.destroy();w.happyDOM.abort();
});
test('polling preserves the open reader DOM and scroll position for an unchanged answer',async()=>{
  const w=await ui();const app=new w.DR.ChatApp({transport:async()=>snapshot([answer()]),now:()=>now});await app.tick();app.toggle(true);
  const card=app.reader.firstChild;app.reader.scrollTop=150;await app.tick();assert.equal(app.reader.firstChild,card);assert.equal(app.reader.scrollTop,150);app.destroy();w.happyDOM.abort();
});

test('edited feed summaries refresh inline in place without duplicate cards',async()=>{
  const w=await ui();let data=snapshot([answer()]);
  const app=new w.DR.ChatApp({transport:async()=>data,now:()=>now});await app.tick();
  const host=w.document.querySelector('[data-dr-answer]');
  data=snapshot([answer('a',0,{chat_summary:'A revised concise answer.'})]);await app.tick();
  assert.equal(w.document.querySelectorAll('[data-dr-answer]').length,1);
  assert.equal(w.document.querySelector('[data-dr-answer]'),host);
  assert.equal(host.shadowRoot.querySelector('.chat-summary').textContent,'A revised concise answer.');
  app.destroy();await w.happyDOM.abort();
});

test('Kick detail cards open the channel without a Watch moment control and DGG filters inline by channel',async()=>{
 const w=await ui();
 const kick=w.DR.normalize(answer('b',0,{stream_id:'kick:anythingelse:one',stream_url:'https://kick.com/anythingelse',source_name:'Anything Else'}));
 const card=w.DR.card(kick,{archive:true});assert.ok(card.textContent.includes('Open Kick channel'));assert.ok(!card.textContent.includes('Watch moment'));
 assert.equal(card.querySelector('.watch').href,'https://kick.com/anythingelse');
 const app=new w.DR.ChatApp({transport:async()=>snapshot([answer(),kick]),context:()=> 'kick:anythingelse',now:()=>now});await app.tick();
 assert.equal(w.document.querySelectorAll('[data-dr-answer]').length,1);
 assert.equal(w.document.querySelector('[data-dr-answer]').getAttribute('data-dr-answer'),kick.id);
 app.destroy();await w.happyDOM.abort();
});

test('the actual DGG content script detects Kick hashes and player embeds as well as YouTube',()=>{
 const {read,core}=require('./helpers.cjs');const vm=require('node:vm');let captured;
 const parent={location:{hash:'#kick/anythingelse'},document:{querySelectorAll:()=>[]}};
 const DR=core();DR.ChatApp=class{constructor(options){captured=options.context;}async tick(){}mount(){}destroy(){}};
 const sandbox=vm.createContext({DR,location:{pathname:'/embed/chat'},window:{top:parent,addEventListener(){}},chrome:{runtime:{}},document:{documentElement:{}},MutationObserver:class{observe(){}disconnect(){}},setTimeout(){return 0;},clearTimeout(){},queueMicrotask(){}});
 vm.runInContext(read('content.js'),sandbox);
 assert.equal(captured(),'kick:anythingelse');
 parent.location.hash='#youtube/abcdefghijk';assert.equal(captured(),'abcdefghijk');
 parent.location.hash='';parent.document.querySelectorAll=()=>[{src:'https://player.kick.com/anythingelse?autoplay=true'}];
 assert.equal(captured(),'kick:anythingelse');
 parent.document.querySelectorAll=()=>[{src:'https://www.youtube.com/embed/abcdefghijk'}];
 assert.equal(captured(),'abcdefghijk');
});
