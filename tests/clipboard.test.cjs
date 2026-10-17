const test=require('node:test');const assert=require('node:assert/strict');
const {ui,answer}=require('./helpers.cjs');
test('copy on a compact card includes the full message, sources and stream with the Destiny prefix',async()=>{
  const w=await ui();const writes=[];
  Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>writes.push(text)}});
  const data=answer('a',0,{answer_markdown:'**Complete answer** beyond the compact preview. [Evidence](https://example.org/full).'});
  const card=w.DR.card(data);w.document.body.append(card);card.querySelector('.copy-button').click();
  await new Promise(setImmediate);
  assert.equal(writes.length,1);assert.ok(writes[0].startsWith('@Destiny Question a? '));
  assert.ok(writes[0].includes('Complete answer beyond the compact preview. Evidence (https://example.org/full).'));
  assert.ok(writes[0].includes('Evidence: https://example.org/evidence'));assert.ok(writes[0].includes(data.stream_url));
  assert.ok(!writes[0].includes('**'));assert.equal(card.querySelector('.copy-button').getAttribute('aria-label'),'Copied');
  assert.equal(w.document.querySelector('textarea').value,'');await w.happyDOM.abort();
});
test('history cards also provide the clipboard button',async()=>{
  const w=await ui();const writes=[];Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>writes.push(text)}});
  const card=w.DR.card(answer(),{archive:true,compact:false});card.querySelector('.copy-button').click();await new Promise(setImmediate);
  assert.equal(writes.length,1);assert.equal(card.querySelector('.copy-button').disabled,false);await w.happyDOM.abort();
});
test('a clipboard failure offers retry and leaves the chat draft unchanged',async()=>{
  const w=await ui();let fail=true;
  Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{if(fail)throw new Error('Denied');}}});
  w.document.querySelector('textarea').value='An existing draft';
  const card=w.DR.card(answer());const control=card.querySelector('.copy-button');control.click();await new Promise(setImmediate);
  assert.equal(control.getAttribute('aria-label'),'Copy failed. Click to try again.');assert.equal(control.disabled,false);
  assert.equal(w.document.querySelector('textarea').value,'An existing draft');
  fail=false;control.click();await new Promise(setImmediate);assert.equal(control.getAttribute('aria-label'),'Copied');await w.happyDOM.abort();
});
