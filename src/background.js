(() => {
  'use strict';
  const api = globalThis.browser || globalThis.chrome;
  const DR = globalThis.DR;
  let state = {answers: [], cursor: null, checkedAt: 0, lastSuccess: 0, nextPoll: 0, failures: 0, etag: null, etagURL: null, error: null};
  let prefs = {...DR.DEFAULTS};
  let flight;
  const loaded = api.storage.local.get(['feed', 'preferences']).then(data => {
    if (data.feed) state = {...state, ...data.feed, answers: DR.merge([], data.feed.answers || [])};
    prefs = {...prefs, ...data.preferences};
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
      if (!flight) flight = poll().finally(() => { flight = null; });
      await flight;
      return {answers: DR.merge([], state.answers), preferences: prefs, lastSuccess: state.lastSuccess, error: state.error, nextPoll: state.nextPoll};
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
