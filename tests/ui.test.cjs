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
  const card=w.DR.card(attack,{compact:false});
  assert.equal(card.querySelectorAll('script,img,iframe').length,0);assert.ok(card.textContent.includes('<script>'));assert.ok(card.querySelector('strong'));
  for(const a of card.querySelectorAll('a[href]')){assert.match(a.href,/^https?:/);assert.equal(a.rel,'noopener noreferrer');}
  w.happyDOM.abort();
});
test('read/collapse works and all sources stay available in the full answer',async()=>{
  const w=await ui();const card=w.DR.card(answer());const toggle=card.querySelector('.card-actions button');assert.ok(card.classList.contains('compact'));
  toggle.click();assert.ok(!card.classList.contains('compact'));assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(card.querySelectorAll('.source-link').length,1);w.happyDOM.abort();
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
