(() => {
  TinyIcons.hydrate();
  const api = globalThis.browser || globalThis.chrome;
  const status = document.querySelector('#status');
  const inputs = [...document.querySelectorAll('input')];
  let save = Promise.resolve();
  async function init() {
    try {
      const data = await api.runtime.sendMessage({type:'DR_PREFERENCES'});
      if(!data.preferences)throw new Error('Unavailable');
      for(const input of inputs)input.checked=data.preferences[input.id];
      status.textContent='Preferences are saved on this device.';
      for(const input of inputs)input.addEventListener('change',()=>{
        const patch={[input.id]:input.checked};
        // Request directly in the click handler; queuing this call loses the
        // user gesture required by Firefox and Chrome optional permissions.
        const permission=input.id==='notifications'&&input.checked
          ? api.permissions.request(DR.NOTIFICATION_ACCESS).catch(()=>false)
          : Promise.resolve(true);
        input.disabled=true;
        save=save.then(async()=>{
          if(!await permission){input.checked=false;status.textContent='Website access was not granted. Notifications remain off.';return null;}
          const result=await api.runtime.sendMessage({type:'DR_PREFERENCES',patch});
          if(input.id==='notifications'&&!input.checked&&result.preferences)await api.permissions.remove(DR.NOTIFICATION_ACCESS).catch(()=>{});
          return result;
        }).then(result=>{
          if(!result)return;
          status.textContent=result.preferences?'Saved.':'Could not save. Reopen and try again.';
          if(result.preferences)input.checked=!!result.preferences[input.id];
        }).catch(()=>{input.checked=!patch[input.id];status.textContent='Could not save. Reopen and try again.';}).finally(()=>{input.disabled=false;});
      });
    }catch{status.textContent='Could not load preferences. Reopen to retry.';for(const input of inputs)input.disabled=true;}
  }
  const installed=api.runtime.getManifest().version;
  document.querySelector('#installed-version').textContent=`Version ${installed}`;
  let bundled=[],remote=[];
  const textNode=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
  function showReleases(releases){
    const output=document.querySelector('#release-notes');output.replaceChildren();
    const seen=new Set();
    for(const release of [...releases,...bundled]){
      if(seen.has(release.version))continue;seen.add(release.version);
      const section=document.createElement('section');
      section.append(textNode('h2',`Version ${release.version}${release.preview?' · Preview':''}`),TinyMarkdown.render(release.notes, 'prose'));output.append(section);
    }
  }
  async function loadReleases(refresh=false){
    const control=document.querySelector('#check-updates');control.disabled=true;
    try{
      const result=await api.runtime.sendMessage({type:'DR_RELEASES',refresh});
      if(!result.updates)throw new Error('Unavailable');
      const info=result.updates;
      const chrome=info.channel==='chrome';
      const storeURL='https://chromewebstore.google.com/detail/tinysearch/lgonddigopjaghgljjhjokpkpglcaboc';
      const storeMessages={automatic:'Chrome manages updates automatically.',no_update:'Chrome Web Store reports no update.',throttled:'Chrome checked recently. Try again later.',unpacked:'Install from Chrome Web Store for automatic updates.',update_available:'An update is ready to install.'};
      document.querySelector('#update-status').textContent=info.error || (chrome?storeMessages[info.storeStatus]||storeMessages.automatic:info.available?`Version ${info.latest.version} is available.`:'You’re up to date.');
      const notice=document.querySelector('#update-notice');notice.hidden=!info.available;
      const history=document.querySelector('#release-history');
      if(chrome){history.href=storeURL;history.replaceChildren(document.createTextNode('Chrome Web Store '),TinyIcons.create('arrow-up-right'));}
      if(info.available){
        const expected=chrome?storeURL:`https://github.com/Ethan0429/tinysearch/releases/tag/v${info.latest.version}`;
        if(info.latest.url===expected){
          document.querySelector('#update-heading').textContent=`TinySearch ${info.latest.version} ${chrome?'is ready':'is available'}`;
          document.querySelector('#update-instructions').textContent=chrome?'Restart Chrome to finish installing this update.':'Download the new version, replace the loaded extension files, and reload it.';
          const link=document.querySelector('#update-download');link.href=expected;
          link.replaceChildren(document.createTextNode(chrome?'View in Chrome Web Store ':'Download update '),TinyIcons.create('arrow-up-right'));
        }else notice.hidden=true;
      }
      remote=info.releases||[];showReleases(remote);
    }catch{document.querySelector('#update-status').textContent='Could not check for updates. Try again later.';showReleases([]);}
    finally{control.disabled=false;}
  }
  fetch(api.runtime.getURL('changelog.json')).then(response=>response.json()).then(data=>{bundled=data.releases;showReleases(remote);}).catch(()=>{});
  document.querySelector('#check-updates').addEventListener('click',()=>loadReleases(true));
  init();loadReleases();
})();
