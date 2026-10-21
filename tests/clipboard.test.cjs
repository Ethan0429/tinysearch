const test=require('node:test');const assert=require('node:assert/strict');
const {ui,answer}=require('./helpers.cjs');
test('inline copy uses only the short summary with the Destiny prefix',async()=>{
  const w=await ui();const writes=[];
  Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>writes.push(text)}});
  const data=answer();const card=w.DR.card(data);card.querySelector('.copy-button').click();
  await new Promise(setImmediate);
  assert.deepEqual(writes,['@Destiny '+data.chat_summary]);assert.ok(writes[0].length<=280);
  assert.equal(card.querySelector('.copy-button').getAttribute('aria-label'),'Copied');
  assert.equal(w.document.querySelector('textarea').value,'');await w.happyDOM.abort();
});
test('history cards also provide the clipboard button',async()=>{
  const w=await ui();const writes=[];Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>writes.push(text)}});
  const card=w.DR.card(answer(),{archive:true,compact:false});card.querySelector('.copy-button').click();await new Promise(setImmediate);
  assert.equal(writes.length,1);assert.ok(writes[0].includes('Sourced answer'));assert.ok(writes[0].includes(answer().stream_url));assert.equal(card.querySelector('.copy-button').disabled,false);await w.happyDOM.abort();
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
