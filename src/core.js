(() => {
  'use strict';
  const DR = globalThis.DR = globalThis.DR || {};
  DR.RELAY = 'https://discord-relay-production-861c.up.railway.app';
  DR.UPDATES = 'https://tinysearch-dashboard-production.up.railway.app/v1/extension';
  DR.REPOSITORY = 'https://github.com/Ethan0429/tinysearch';
  DR.DEFAULTS = { enabled: true, inline: true, compact: true };
  DR.safeURL = value => {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  };
  DR.videoID = value => {
    try {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
      if (!['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com', 'youtu.be'].includes(url.hostname)) return null;
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|live)\/([\w-]{11})(?:\/|$)/)?.[1];
      return /^[\w-]{11}$/.test(id || '') ? id : null;
    } catch { return null; }
  };
  DR.chatSummary = answer => {
    const value = answer.chat_summary;
    const urls = typeof value === 'string' ? value.match(/https?:\/\/[^\s<>]+/g) || [] : [];
    if (typeof value === 'string' && value.trim() && !/[\r\n]/.test(value) &&
        ('@Destiny ' + value).length <= 280 && urls.length <= 2 &&
        urls.every(url => DR.safeURL(url) && answer.sources.some(source => source && DR.safeURL(source.url) === DR.safeURL(url)))) return value.trim();
    return 'Summary unavailable. Open the full TinySearch answer for details.';
  };
  DR.normalize = raw => {
    if (!raw || raw.kind !== 'research.answer' || !/^[a-f0-9]{24}$/.test(raw.id || '')) return null;
    if (typeof raw.question !== 'string' || !raw.question.trim() || raw.question.length > 4000) return null;
    if (typeof raw.answer_markdown !== 'string' || !raw.answer_markdown.trim() || raw.answer_markdown.length > 30000) return null;
    if (!/^[\w-]{11}$/.test(raw.stream_id || '') || DR.videoID(raw.stream_url) !== raw.stream_id) return null;
    if (![raw.created_at, raw.heard_at].every(t => typeof t === 'string' && Number.isFinite(Date.parse(t)))) return null;
    if (!Array.isArray(raw.sources) || raw.sources.length > 50) return null;
    return { id: raw.id, kind: raw.kind, question: raw.question.trim(), answer_markdown: raw.answer_markdown,
      chat_summary: DR.chatSummary(raw),
      stream_id: raw.stream_id, stream_url: DR.safeURL(raw.stream_url), created_at: raw.created_at, heard_at: raw.heard_at,
      sources: raw.sources.filter(s => s && DR.safeURL(s.url)).map(s => ({title: String(s.title || new URL(s.url).hostname).slice(0,300), url: DR.safeURL(s.url)})) };
  };
  DR.merge = (old, fresh, now = Date.now()) => {
    const byID = new Map();
    for (const item of [...old, ...fresh]) {
      const answer = DR.normalize(item);
      if (answer && Date.parse(answer.created_at) >= now - 7 * 86400000 && Date.parse(answer.created_at) < now + 300000) byID.set(answer.id, answer);
    }
    return [...byID.values()].sort((a,b) => Date.parse(a.created_at)-Date.parse(b.created_at) || a.id.localeCompare(b.id)).slice(-200);
  };
  DR.matches = (answer, query) => `${answer.question}\n${answer.answer_markdown}\n${answer.sources.map(s=>s.title).join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim());
  DR.shouldInline = (answer, {streamID, startedAt, seen, now = Date.now()}) => !seen.has(answer.id) &&
    Date.parse(answer.created_at) >= Math.max(startedAt - 30000, now - 10 * 60000) && (!streamID || answer.stream_id === streamID);
  DR.newerVersion = (candidate, installed) => {
    const valid = value => typeof value === 'string' && /^\d{1,5}\.\d{1,5}\.\d{1,5}(?:\.\d{1,5})?$/.test(value);
    if (!valid(candidate) || !valid(installed)) return false;
    const a=candidate.split('.').map(Number), b=installed.split('.').map(Number);
    for(let i=0;i<4;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}
    return false;
  };
  DR.releaseFeed = raw => {
    if(raw?.version!==1 || !Array.isArray(raw.releases) || raw.releases.length>10) throw new Error('Invalid releases');
    const releases=raw.releases.map(item=>{
      if(!item || typeof item.version!=='string' || !/^\d{1,5}\.\d{1,5}\.\d{1,5}(?:\.\d{1,5})?$/.test(item.version) ||
          item.url!==DR.REPOSITORY+'/releases/tag/v'+item.version || typeof item.notes!=='string')throw new Error('Invalid release');
      return {version:item.version,url:item.url,notes:item.notes.slice(0,5000),preview:!!item.preview};
    });
    releases.sort((a,b)=>DR.newerVersion(a.version,b.version)?-1:DR.newerVersion(b.version,a.version)?1:0);
    if(raw.latest && !releases.some(r=>r.version===raw.latest.version))throw new Error('Invalid latest release');
    return {version:1,releases,latest:releases[0]||null};
  };
  DR.allowedSender = (sender, runtimeID) => {
    if (sender.id !== runtimeID) return false;
    try {
      const url = new URL(sender.url);
      return ['chrome-extension:', 'moz-extension:'].includes(url.protocol) ||
        (url.protocol === 'https:' && ['www.destiny.gg', 'destiny.gg'].includes(url.hostname) &&
        (url.pathname === '/bigscreen' || url.pathname === '/bigscreen/' || url.pathname === '/embed/chat' || url.pathname === '/embed/chat/'));
    } catch { return false; }
  };
})();
