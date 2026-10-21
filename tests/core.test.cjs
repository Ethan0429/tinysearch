const test=require('node:test');const assert=require('node:assert/strict');
const {answer,core,now}=require('./helpers.cjs');
test('only safe link protocols; credentials and forged YouTube hosts rejected',()=>{
  const DR=core();
  for(const value of ['javascript:alert(1)','data:text/html,<h1>x</h1>','file:///etc/passwd','https://user:password@example.org'])assert.equal(DR.safeURL(value),null);
  assert.equal(DR.videoID('https://youtube.com.attacker.example/watch?v=abcdefghijk'),null);
  assert.equal(DR.videoID('javascript://www.youtube.com/watch?v=abcdefghijk'),null);
  assert.equal(DR.videoID('https://www.youtube-nocookie.com/embed/abcdefghijk'), 'abcdefghijk');
});
test('schema normalizes a minimal public answer and removes unknown fields',()=>{
  const DR=core();const clean=DR.normalize(answer('a',0,{private_token:'never forward',sources:[{title:'Bad',url:'javascript:alert(1)'},{title:'Good',url:'https://example.org'}]}));
  assert.equal(clean.private_token,undefined);assert.equal(clean.sources.length,1);
  for(const patch of [{id:'oops'},{kind:'chat'},{question:''},{answer_markdown:'x'.repeat(30001)},{created_at:'bad'},{stream_url:'https://example.org/watch?v=abcdefghijk'},{sources:null}])assert.equal(DR.normalize(answer('a',0,patch)),null);
});
test('cache deduplicates, refreshes edits, expires and bounds history',()=>{
  const DR=core();const old=answer('a',-8*86400000);const fresh=answer('b',-1000);const edit={...fresh,question:'Edited?'};
  const result=DR.merge([old,fresh],[edit],now);assert.equal(result.length,1);assert.equal(result[0].question,'Edited?');
  const many=Array.from({length:240},(_,i)=>answer('a',-i*1000,{id:i.toString(16).padStart(24,'0')}));
  assert.equal(DR.merge([],many,now).length,200);
});
test('old backfill and other videos never flood inline chat',()=>{
  const DR=core();const context={startedAt:now,streamID:'abcdefghijk',seen:new Set(),now};
  assert.equal(DR.shouldInline(answer('a',-2*3600000),context),false);
  assert.equal(DR.shouldInline(answer('a'),context),true);
  assert.equal(DR.shouldInline(answer('a'),{...context,streamID:'xxxxxxxxxxx'}),false);
  assert.equal(DR.shouldInline(answer('a'),{...context,seen:new Set(['a'.repeat(24)])}),false);
});
test('runtime rejects arbitrary sites and foreign extension identities',()=>{
  const DR=core();const id='own';
  assert.equal(DR.allowedSender({id,url:'https://www.destiny.gg/embed/chat?follow=x'},id),true);
  for(const sender of [{id:'other',url:'https://www.destiny.gg/embed/chat'},{id,url:'https://evil.example/'},{id,url:'https://www.destiny.gg/profile'},{id,url:'https://www.destiny.gg/embed/chat-evil'}])assert.equal(DR.allowedSender(sender,id),false);
});

test('chat summary enforces prose length, existing sources and at most two links',()=>{
  const DR=core();assert.equal(DR.normalize(answer()).chat_summary,answer().chat_summary);
  for(const chat_summary of ['x'.repeat(281),'😀'.repeat(141),'https://invented.example','https://example.org/evidence '.repeat(3),'bad\nline']){
    const item=DR.normalize(answer('a',0,{chat_summary}));
    assert.match(item.chat_summary,/Summary unavailable/);
    assert.equal(item.answer_markdown,answer().answer_markdown);
  }
  assert.equal(DR.normalize(answer('a',0,{chat_summary:'x'.repeat(271)})).chat_summary.length,271);
});

test('280 prose characters exclude mention and both known source URLs',()=>{
  const DR=core();const a=answer();a.chat_summary='x'.repeat(280)+' '+a.sources[0].url;
  assert.equal(DR.chatSummary(a),a.chat_summary);
});
