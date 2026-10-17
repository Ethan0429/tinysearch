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
  init();
})();
