(() => {
  const api = globalThis.browser || globalThis.chrome;
  const status = document.querySelector('#status');
  const inputs = [...document.querySelectorAll('input')];
  let save = Promise.resolve();
  async function init() {
    try {
      const data = await api.runtime.sendMessage({type:'DR_PREFERENCES'});
      if(!data.preferences)throw new Error('Unavailable');
      for(const input of inputs)input.checked=data.preferences[input.id];
      status.textContent='Preferences apply within 15 seconds.';
      for(const input of inputs)input.addEventListener('change',()=>{
        const patch={[input.id]:input.checked};
        save=save.then(()=>api.runtime.sendMessage({type:'DR_PREFERENCES',patch})).then(result=>{
          status.textContent=result.preferences?'Saved · applies within 15 seconds.':'Could not save. Reopen and try again.';
        }).catch(()=>{status.textContent='Could not save. Reopen and try again.';});
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
      section.append(textNode('h2',`Version ${release.version}${release.preview?' · Preview':''}`),textNode('p',release.notes));output.append(section);
    }
  }
  async function loadReleases(refresh=false){
    const control=document.querySelector('#check-updates');control.disabled=true;
    try{
      const result=await api.runtime.sendMessage({type:'DR_RELEASES',refresh});
      if(!result.updates)throw new Error('Unavailable');
      const info=result.updates;
      document.querySelector('#update-status').textContent=info.error || (info.available?`Version ${info.latest.version} is available.`:'You’re up to date.');
      const notice=document.querySelector('#update-notice');notice.hidden=!info.available;
      if(info.available && info.latest.url===`https://github.com/Ethan0429/tinysearch/releases/tag/v${info.latest.version}`){
        document.querySelector('#update-heading').textContent=`TinySearch ${info.latest.version} is available`;
        document.querySelector('#update-download').href=info.latest.url;
      }
      remote=info.releases||[];showReleases(remote);
    }catch{document.querySelector('#update-status').textContent='Could not check for updates. Try again later.';showReleases([]);}
    finally{control.disabled=false;}
  }
  fetch(api.runtime.getURL('changelog.json')).then(response=>response.json()).then(data=>{bundled=data.releases;showReleases(remote);}).catch(()=>{});
  document.querySelector('#check-updates').addEventListener('click',()=>loadReleases(true));
  init();loadReleases();
})();
