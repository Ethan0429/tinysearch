(() => {
  'use strict';
  const api = globalThis.browser || globalThis.chrome;
  const DR = globalThis.DR;
  const manifest = api.runtime.getManifest();
  const installed = manifest.version;
  const chrome = !manifest.browser_specific_settings?.gecko;
  const managed = chrome && api.runtime.id === DR.CHROME_STORE_ID;
  let state = {answers: [], cursor: null, checkedAt: 0, lastSuccess: 0, nextPoll: 0, failures: 0, etag: null, etagURL: null, error: null};
  let prefs = {...DR.DEFAULTS};
  let flight, updateFlight, nativeFlight;
  let updates = {version:1,releases:[],latest:null,nextCheck:0,checkedAt:0,error:null};
  let browserUpdate = {installed,status:managed?'automatic':'unpacked',version:null,attemptedAt:0,error:null};
  function updateInfo() {
    if (!chrome) return {...updates,installed,channel:'firefox',available:!!updates.latest&&DR.newerVersion(updates.latest.version,installed)};
    const available = managed && DR.newerVersion(browserUpdate.version,installed);
    return {...updates,installed,channel:'chrome',managed,available,
      latest:available?{version:browserUpdate.version,url:DR.CHROME_STORE}:null,
      releases:updates.releases.filter(release=>!DR.newerVersion(release.version,installed)),
      storeStatus:browserUpdate.status,error:browserUpdate.error};
  }
  async function updateBadge() {
    const info=updateInfo();
    await api.action?.setBadgeText?.({text:info.available?'NEW':''});
    if(info.available)await api.action?.setBadgeBackgroundColor?.({color:'#8c61c6'});
    await api.action?.setTitle?.({title:info.available?`TinySearch ${info.latest.version} available`:'TinySearch'});
  }
  async function checkReleaseNotes(refresh=false) {
    await loaded;
    if(Date.now()<updates.nextCheck && (!refresh || Date.now()-(updates.attemptedAt||0)<60000))return updateInfo();
    if(!updateFlight)updateFlight=(async()=>{
      updates.attemptedAt=Date.now();
      try{
        const response=await fetch(DR.UPDATES,{method:'GET',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw new Error('Unavailable');
        const body=await response.text();if(body.length>80000)throw new Error('Too large');
        const parsed=DR.releaseFeed(JSON.parse(body));if(!parsed.latest)throw new Error('No release information');
        Object.assign(updates,parsed,{checkedAt:Date.now(),nextCheck:Date.now()+6*3600000,error:null});
      }catch{updates.error='Could not check for updates. Try again later.';updates.nextCheck=Date.now()+15*60000;}
      await api.storage.local.set({updates});await updateBadge();
      return updateInfo();
    })().finally(()=>{updateFlight=null;});
    return updateFlight;
  }
  async function checkChromeUpdate() {
    if(!managed)return updateInfo();
    if(nativeFlight)return nativeFlight;
    if(Date.now()-(browserUpdate.attemptedAt||0)<60000)return updateInfo();
    nativeFlight=(async()=>{
      browserUpdate.attemptedAt=Date.now();
      try{
        const result=await api.runtime.requestUpdateCheck();
        if(!['update_available','no_update','throttled'].includes(result?.status))throw new Error('Invalid update result');
        if(result.status==='update_available'){
          if(!DR.newerVersion(result.version,installed))throw new Error('Invalid update version');
          browserUpdate.version=result.version;
        }else if(result.status==='no_update')browserUpdate.version=null;
        browserUpdate.status=result.status;
        browserUpdate.error=null;
      }catch{browserUpdate.error='Could not check Chrome Web Store. Try again later.';}
      await api.storage.local.set({browserUpdate});await updateBadge();
      return updateInfo();
    })().finally(()=>{nativeFlight=null;});
    return nativeFlight;
  }
  async function checkUpdates(refresh=false) {
    if(!chrome)return checkReleaseNotes(refresh);
    await loaded;
    // GitHub supplies release notes; only Chrome can confirm a published store update.
    checkReleaseNotes().catch(()=>{});
    return refresh?checkChromeUpdate():updateInfo();
  }
  const loaded=api.storage.local.get(['feed','preferences','updates','browserUpdate']).then(data=>{
    if(data.feed)state={...state,...data.feed,answers:DR.merge([],data.feed.answers||[])};
    prefs={...prefs,...data.preferences};
    if(data.updates){try{updates={...updates,...data.updates,...DR.releaseFeed(data.updates)};}catch{}}
    if(managed&&data.browserUpdate?.installed===installed)browserUpdate={...browserUpdate,...data.browserUpdate};
    updateBadge().catch(()=>{});
  });
  if(managed)api.runtime.onUpdateAvailable?.addListener(async details=>{
    await loaded;
    if(!DR.newerVersion(details?.version,installed))return;
    browserUpdate={...browserUpdate,status:'update_available',version:details.version,error:null};
    await api.storage.local.set({browserUpdate});await updateBadge();
  });
  async function request(path, headers = {}) {
    return fetch(DR.RELAY + path, {method: 'GET', headers, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12000)});
  }
  async function poll() {
    await loaded;
    if (!prefs.enabled || Date.now() < state.nextPoll) return;
    let cursor = state.cursor;
    let fresh = [];
    try {
      for (let page = 0; page < 5; page++) {
        const path = '/v1/answers?limit=100' + (cursor ? '&after=' + encodeURIComponent(cursor) : '');
        const response = await request(path, state.etag && state.etagURL === path ? {'If-None-Match': state.etag} : {});
        if (response.status === 304) break;
        if (response.status === 409 && cursor) { cursor = null; state.etag = null; continue; }
        if (!response.ok) throw new Error('Relay unavailable');
        const text = await response.text();
        if (text.length > 4000000) throw new Error('Feed too large');
        const data = JSON.parse(text);
        if (data.version !== 1 || !Array.isArray(data.answers) || data.answers.length > 100 ||
            !(data.next_cursor === null || /^[a-f0-9]{24}$/.test(data.next_cursor || '')) || typeof data.has_more !== 'boolean') throw new Error('Invalid feed');
        if (data.answers.some(answer => !DR.normalize(answer))) throw new Error('Invalid answer');
        fresh.push(...data.answers);
        state.etag = response.headers.get('etag'); state.etagURL = path;
        if (data.has_more && (!data.next_cursor || data.next_cursor === cursor)) throw new Error('Invalid pagination');
        cursor = data.next_cursor || cursor;
        if (!data.has_more) break;
      }
      state.answers = DR.merge(state.answers, fresh);
      state.cursor = cursor;
      state.lastSuccess = Date.now(); state.failures = 0; state.error = null;
      state.nextPoll = Date.now() + 15000;
    } catch {
      state.failures++;
      state.error = 'Reconnecting to TinySearch';
      state.nextPoll = Date.now() + Math.min(15000 * 2 ** Math.min(state.failures, 4), 300000);
    }
    state.checkedAt = Date.now();
    await api.storage.local.set({feed: state});
  }
  async function dispatch(message, sender) {
    await loaded;
    if (!DR.allowedSender(sender, api.runtime.id)) throw new Error('Unsupported sender');
    if (message?.type === 'DR_FEED') {
      checkUpdates().catch(()=>{});
      if (!flight) flight = poll().finally(() => { flight = null; });
      await flight;
      return {answers: DR.merge([], state.answers), preferences: prefs, lastSuccess: state.lastSuccess, error: state.error, nextPoll: state.nextPoll, updates:updateInfo()};
    }
    if (message?.type === 'DR_RELEASES') {
      if(!['chrome-extension:', 'moz-extension:'].includes(new URL(sender.url).protocol))throw new Error('Release controls require extension UI');
      return {updates:await checkUpdates(message.refresh===true)};
    }
    if (message?.type === 'DR_PREFERENCES') {
      if (!['chrome-extension:', 'moz-extension:'].includes(new URL(sender.url).protocol)) throw new Error('Settings require extension UI');
      if (message.patch) {
        for (const key of Object.keys(DR.DEFAULTS)) if (typeof message.patch[key] === 'boolean') prefs[key] = message.patch[key];
        await api.storage.local.set({preferences: prefs});
      }
      return {preferences: prefs};
    }
    throw new Error('Unsupported request');
  }
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    dispatch(message, sender).then(sendResponse, () => sendResponse({error: 'TinySearch request failed'}));
    return true;
  });
})();
