const test=require('node:test');const assert=require('node:assert/strict');
const {core,background,answer,response,now,ui}=require('./helpers.cjs');
const release=(version='0.1.5')=>({version,url:`https://github.com/Ethan0429/tinysearch/releases/tag/v${version}`,notes:'A useful improvement.',preview:true});
const feed=(version='0.1.5')=>({version:1,latest:release(version),releases:[release(version)]});
const popup={id:'test-extension',url:'chrome-extension://test-extension/popup.html'};
test('update version comparison is numeric and rejects invalid or older versions',()=>{
  const DR=core();assert.ok(DR.newerVersion('0.1.10','0.1.9'));assert.ok(DR.newerVersion('1.0.0','0.9.99'));
  assert.equal(DR.newerVersion('0.1.4','0.1.4'),false);assert.equal(DR.newerVersion('0.1.3','0.1.4'),false);
  assert.equal(DR.newerVersion('latest','0.1.4'),false);assert.equal(DR.newerVersion('0.1.4.0','0.1.4'),false);
});
test('release feed accepts only project release URLs and displays notes as data',()=>{
  const DR=core();assert.equal(DR.releaseFeed(feed()).latest.version,'0.1.5');
  assert.throws(()=>DR.releaseFeed({version:1,releases:[{...release(),url:'https://evil.example'}]}));
  assert.throws(()=>DR.releaseFeed({version:1,releases:[{...release(),notes:{html:'bad'}}]}));
});
test('concurrent update checks share a fixed-host request, then throttle persistently',async()=>{
  const bg=background({updates:{version:1,releases:[],latest:null,nextCheck:0},responses:[new Response(JSON.stringify(feed()))]});
  const results=await Promise.all([bg.send({type:'DR_RELEASES'},popup),bg.send({type:'DR_RELEASES'},popup)]);
  assert.equal(bg.calls.length,1);assert.equal(bg.calls[0].url,'https://tinysearch.up.railway.app/v1/extension');
  assert.ok(results[0].updates.available);assert.equal(results[0].updates.installed,'0.1.4');
  assert.equal(bg.calls[0].options.credentials,'omit');assert.equal(bg.calls[0].options.referrerPolicy,'no-referrer');
  assert.equal(bg.calls[0].options.headers,undefined);
  const restarted=background({updates:bg.stored.updates});
  assert.ok((await restarted.send({type:'DR_RELEASES'},popup)).updates.available);assert.equal(restarted.calls.length,0);
});
test('failed update checks keep known release notes and back off',async()=>{
  const bg=background({updates:{...feed(),nextCheck:0,checkedAt:now-86400000},responses:[new Response('{}',{status:503})]});
  const result=await bg.send({type:'DR_RELEASES'},popup);
  assert.equal(result.updates.latest.version,'0.1.5');assert.ok(result.updates.error);
  await bg.send({type:'DR_RELEASES'},popup);assert.equal(bg.calls.length,1);
});
test('web content cannot force update requests or pass arbitrary update URLs',async()=>{
  const bg=background({updates:{version:1,releases:[],latest:null,nextCheck:0}});
  assert.ok((await bg.send({type:'DR_RELEASES',refresh:true})).error);assert.equal(bg.calls.length,0);
});
test('an update request never blocks research feed delivery',async()=>{
  let releasePending;
  const bg=background({updates:{version:1,releases:[],latest:null,nextCheck:0},fetcher:async url=>{
    if(url.includes('/v1/extension'))return new Promise(resolve=>releasePending=resolve);
    return response([answer()]);
  }});
  const result=await bg.send();assert.equal(result.answers.length,1);
  releasePending(new Response(JSON.stringify(feed())));await new Promise(setImmediate);
});
test('DGG toolbar shows a release link when a newer extension is available',async()=>{
  const w=await ui();const app=new w.DR.ChatApp({transport:async()=>({answers:[answer()],preferences:{},lastSuccess:now,updates:{available:true,latest:release()}}),now:()=>now});
  await app.tick();assert.equal(app.updateLink.hidden,false);assert.equal(app.updateLink.href,release().url);
  assert.match(app.updateLink.title,/0.1.5/);app.destroy();await w.happyDOM.abort();
});

test('empty metadata is treated as unavailable instead of incorrectly reporting up to date',async()=>{
  const bg=background({updates:{version:1,releases:[],latest:null,nextCheck:0},responses:[new Response(JSON.stringify({version:1,releases:[],latest:null}))]});
  const result=await bg.send({type:'DR_RELEASES'},popup);assert.ok(result.updates.error);
});

const storeURL='https://chromewebstore.google.com/detail/tinysearch/lgonddigopjaghgljjhjokpkpglcaboc';
const chromePopup=bg=>({id:bg.sender.id,url:`chrome-extension://${bg.sender.id}/popup.html`});
test('Chrome does not advertise a GitHub release that is awaiting Web Store review',async()=>{
 const bg=background({channel:'chrome',installed:'0.1.9',updates:{...feed('0.2.0'),nextCheck:now+3600000}});
 const info=(await bg.send({type:'DR_RELEASES'},chromePopup(bg))).updates;
 assert.equal(info.channel,'chrome');assert.equal(info.available,false);assert.equal(info.latest,null);
 assert.equal(info.releases.length,0);assert.equal(info.storeStatus,'automatic');assert.equal(bg.nativeCalls.length,0);
 assert.ok(!bg.badges.includes('NEW'));
});
test('Chrome native checks are coalesced, throttled and open only the official store listing',async()=>{
 let resolve;const pending=new Promise(done=>resolve=done);
 const bg=background({channel:'chrome',installed:'0.1.9',updateCheck:()=>pending});
 const requests=[bg.send({type:'DR_RELEASES',refresh:true},chromePopup(bg)),bg.send({type:'DR_RELEASES',refresh:true},chromePopup(bg))];
 await new Promise(setImmediate);assert.equal(bg.nativeCalls.length,1);
 resolve({status:'update_available',version:'0.2.0'});
 const [result]=await Promise.all(requests);
 assert.equal(result.updates.available,true);assert.equal(result.updates.latest.url,storeURL);assert.ok(bg.badges.includes('NEW'));
 await bg.send({type:'DR_RELEASES',refresh:true},chromePopup(bg));assert.equal(bg.nativeCalls.length,1);
 const restored=background({channel:'chrome',installed:'0.1.9',browserUpdate:bg.stored.browserUpdate});
 assert.equal((await restored.send({type:'DR_RELEASES'},chromePopup(restored))).updates.available,true);
 const upgraded=background({channel:'chrome',installed:'0.2.0',browserUpdate:bg.stored.browserUpdate});
 assert.equal((await upgraded.send({type:'DR_RELEASES'},chromePopup(upgraded))).updates.available,false);
});
test('Chrome update events notify users without manual ZIP instructions or automatic reloads',async()=>{
 const bg=background({channel:'chrome',installed:'0.1.9'});
 await bg.emitUpdate({version:'0.2.0'});
 const info=(await bg.send({type:'DR_RELEASES'},chromePopup(bg))).updates;
 assert.equal(info.available,true);assert.equal(info.latest.url,storeURL);assert.equal(info.storeStatus,'update_available');
 await bg.emitUpdate({version:'malformed'});assert.equal((await bg.send({type:'DR_RELEASES'},chromePopup(bg))).updates.latest.version,'0.2.0');
});
test('Chrome native update checks remain distinct from errors fetching release notes',async()=>{
 const bg=background({channel:'chrome',installed:'0.1.9',updates:{version:1,releases:[],latest:null,nextCheck:0},updateCheck:async()=>({status:'no_update'})});
 const result=await bg.send({type:'DR_RELEASES',refresh:true},chromePopup(bg));
 assert.equal(result.updates.storeStatus,'no_update');assert.equal(result.updates.error,null);assert.equal(result.updates.available,false);
 assert.ok((await bg.send({type:'DR_RELEASES',refresh:true})).error);assert.equal(bg.nativeCalls.length,1);
});
test('Unpacked Chrome builds link to the store without claiming automatic installation updates',async()=>{
 const bg=background({channel:'chrome',managed:false,installed:'0.1.9'});
 const info=(await bg.send({type:'DR_RELEASES',refresh:true},chromePopup(bg))).updates;
 assert.equal(info.storeStatus,'unpacked');assert.equal(info.available,false);assert.equal(bg.nativeCalls.length,0);
});
test('DGG Chrome update notice opens the store instead of a GitHub download',async()=>{
 const w=await ui();const app=new w.DR.ChatApp({transport:async()=>({answers:[],preferences:{},lastSuccess:now,updates:{channel:'chrome',available:true,latest:{version:'0.2.0',url:storeURL}}}),now:()=>now});
 await app.tick();assert.equal(app.updateLink.href,storeURL);assert.match(app.updateLink.title,/Restart Chrome/);
 app.destroy();await w.happyDOM.abort();
});
