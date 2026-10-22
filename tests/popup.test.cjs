const test=require('node:test');const assert=require('node:assert/strict');const {read}=require('./helpers.cjs');
async function popup({failure=false,updates}={}){
  const {Window}=await import('happy-dom');
  const w=new Window({url:'https://preview.example'});
  w.document.body.innerHTML=read('popup.html').replace(/<script[^>]*>.*?<\/script>/g,'');
  w.chrome={runtime:{getManifest:()=>({version:'0.1.4'}),getURL:()=>'/changelog.json',sendMessage:async message=>{
    if(message.type==='DR_PREFERENCES')return {preferences:{enabled:true,inline:true,compact:true}};
    if(failure)throw new Error('offline');
    return {updates:updates||{available:true,latest:{version:'0.1.5',url:'https://github.com/Ethan0429/tinysearch/releases/tag/v0.1.5'},releases:[{version:'0.1.5',notes:'<img src=x onerror=alert(1)> Safe notes.'}]}};
  }}};
  w.fetch=async()=>({json:async()=>({releases:[{version:'0.1.4',notes:'Bundled notes remain available offline.'}]})});
  w.eval(read('icons.js'));w.eval(read('vendor/markdown-it.min.js'));w.eval(read('markdown.js'));w.eval(read('popup.js'));await new Promise(setImmediate);return w;
}
test('popup announces newer releases and renders remote notes as inert text',async()=>{
  const w=await popup();assert.equal(w.document.querySelector('#update-notice').hidden,false);
  assert.match(w.document.querySelector('#update-heading').textContent,/0.1.5/);
  assert.equal(w.document.querySelector('#update-download').href,'https://github.com/Ethan0429/tinysearch/releases/tag/v0.1.5');
  assert.equal(w.document.querySelectorAll('#release-notes img, #release-notes script').length,0);
  assert.ok(w.document.querySelector('#release-notes').textContent.includes('<img'));
  assert.ok(w.document.querySelector('#release-notes').textContent.includes('Bundled notes'));
  await w.happyDOM.abort();
});
test('bundled changelog and preferences still work when update metadata is unavailable',async()=>{
  const w=await popup({failure:true});assert.match(w.document.querySelector('#update-status').textContent,/Could not check/);
  assert.ok(w.document.querySelector('#release-notes').textContent.includes('Bundled notes'));
  assert.equal(w.document.querySelector('#enabled').checked,true);
  assert.equal(w.document.querySelector('#check-updates').disabled,false);await w.happyDOM.abort();
});

test('Chrome popup links to the store and explains native updates while showing bundled notes',async()=>{
 const url='https://chromewebstore.google.com/detail/tinysearch/lgonddigopjaghgljjhjokpkpglcaboc';
 const w=await popup({updates:{channel:'chrome',managed:true,storeStatus:'update_available',available:true,latest:{version:'0.2.0',url},releases:[]}});
 assert.equal(w.document.querySelector('#update-download').href,url);
 assert.match(w.document.querySelector('#update-download').textContent,/Chrome Web Store/);
 assert.match(w.document.querySelector('#update-instructions').textContent,/Restart Chrome/);
 assert.doesNotMatch(w.document.querySelector('#update-notice').textContent,/replace|loaded extension files/);
 assert.equal(w.document.querySelector('#release-history').href,url);await w.happyDOM.abort();
});
test('Chrome popup never claims a GitHub version is an approved store update',async()=>{
 const w=await popup({updates:{channel:'chrome',managed:true,storeStatus:'automatic',available:false,latest:null,releases:[]}});
 assert.equal(w.document.querySelector('#update-notice').hidden,true);
 assert.match(w.document.querySelector('#update-status').textContent,/Chrome manages/);await w.happyDOM.abort();
});
