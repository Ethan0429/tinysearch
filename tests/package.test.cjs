const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {root}=require('./helpers.cjs');
test('both release manifests use minimal permissions and the correct MV3 background',()=>{
  for(const browser of ['chrome','firefox']){
    const dir=path.join(root,'dist',browser);const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
    assert.equal(manifest.manifest_version,3);assert.equal(manifest.name,'TinySearch');assert.equal(manifest.action.default_title,'TinySearch');assert.deepEqual(manifest.permissions,['storage','clipboardWrite']);assert.equal(manifest.host_permissions.length,2);
    assert.equal(manifest.externally_connectable,undefined);assert.equal(manifest.web_accessible_resources,undefined);
    assert.ok(manifest.content_scripts[0].all_frames);assert.ok(manifest.content_scripts[0].matches.every(s=>s.includes('destiny.gg/embed/chat')));
    assert.equal(browser==='chrome'?manifest.background.service_worker:manifest.background.scripts[0],'background.js');
    if(browser==='firefox')assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required,['none']);
    for(const file of ['content.js','background.js','popup.html','popup.js','popup.css','icons/128.png'])assert.ok(fs.statSync(path.join(dir,file)).size);
  }
});
test('release code never uses HTML sinks, eval, Discord APIs, or localhost networking',()=>{
  const dir=path.join(root,'dist','chrome');
  const code=['content.js','background.js','popup.js'].map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
  assert.doesNotMatch(code,/innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|new Function\s*\(|discord\.com\/api|https?:\/\/(?:localhost|127\.0\.0\.1)/);
});
