const test=require('node:test');const assert=require('node:assert/strict');
const {answer,background,response,now}=require('./helpers.cjs');
test('one fixed-host request serves simultaneous tabs, then obeys minimum polling interval',async()=>{
  const bg=background({responses:[response([answer()])]});
  const snapshots=await Promise.all([bg.send(),bg.send(),bg.send()]);
  assert.equal(bg.calls.length,1);assert.equal(snapshots[0].answers.length,1);await bg.send();assert.equal(bg.calls.length,1);
  const {url,options}=bg.calls[0];assert.ok(url.startsWith('https://tinysearch.app/v1/answers'));
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.referrerPolicy,'no-referrer');
  assert.equal(options.headers.Authorization,undefined);assert.equal(options.method,'GET');
});
test('cursor polling and conditional requests retain cache on 304',async()=>{
  const bg=background({responses:[response([answer()]),response([],{next_cursor:answer().id}),new Response(null,{status:304})]});
  await bg.send();bg.advance(16000);await bg.send();bg.advance(16000);const result=await bg.send();
  assert.equal(result.answers.length,1);assert.match(bg.calls[1].url,/after=aaaaaaaa/);assert.equal(bg.calls[2].options.headers['If-None-Match'],'"test"');
  assert.equal(bg.stored.feed.cursor,answer().id);
});
test('expired cursor reloads the recent tail without duplicating retained answers',async()=>{
  const bg=background({feed:{answers:[answer()],cursor:answer().id,nextPoll:0},responses:[new Response('{}',{status:409}),response([answer(),answer('b')])]});
  const result=await bg.send();assert.equal(bg.calls.length,2);assert.equal(result.answers.length,2);assert.ok(!bg.calls[1].url.includes('after='));
});
test('bounded pagination catches up in chronological order',async()=>{
  const bg=background({feed:{answers:[answer('a',-2000)],cursor:answer('a').id,nextPoll:0},responses:[response([answer('b',-1000)],{has_more:true}),response([answer('c')])]});
  const result=await bg.send();assert.equal(result.answers.length,3);assert.equal(result.answers[2].id,answer('c').id);assert.match(bg.calls[1].url,/after=bbbbbbbb/);
});
test('network/invalid schema failures keep cached answers and back off',async()=>{
  const bg=background({feed:{answers:[answer()],cursor:answer().id,nextPoll:0},responses:[response([],{version:9})]});
  const result=await bg.send();assert.equal(result.answers.length,1);assert.ok(result.error);assert.equal(result.nextPoll,now+30000);
  bg.advance(16000);await bg.send();assert.equal(bg.calls.length,1);
});
test('worker restart restores deduplication and throttle from local storage',async()=>{
  const first=background({responses:[response([answer()])]});await first.send();
  const restarted=background({feed:first.stored.feed});const result=await restarted.send();
  assert.equal(result.answers.length,1);assert.equal(restarted.calls.length,0);
});
test('only extension popup may change boolean preferences; disable prevents polling',async()=>{
  const bg=background();const blocked=await bg.send({type:'DR_PREFERENCES',patch:{enabled:false}});assert.ok(blocked.error);assert.equal(bg.calls.length,0);
  const popup={id:bg.sender.id,url:'chrome-extension://test-extension/popup.html'};
  const saved=await bg.send({type:'DR_PREFERENCES',patch:{enabled:false,inline:false,relay:'https://evil.example'}},popup);
  assert.equal(saved.preferences.enabled,false);assert.equal(saved.preferences.relay,undefined);
  await bg.send();assert.equal(bg.calls.length,0);assert.equal(bg.stored.preferences.inline,false);
});
test('unauthorized senders and arbitrary request types never trigger a fetch',async()=>{
  const bg=background();await bg.send({type:'DR_FEED'},{...bg.sender,url:'https://evil.example'});await bg.send({type:'FETCH',url:'http://localhost'});
  assert.equal(bg.calls.length,0);
});
