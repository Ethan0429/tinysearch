(() => {
  'use strict';
  const api = globalThis.browser || globalThis.chrome;
  const DR = globalThis.DR;
  if (globalThis.tinySearchToast || window !== window.top || !DR.notificationPage(location.href)) return;
  let host, root, timer, current;
  const queue = [], seen = new Set();
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function clear() {
    clearTimeout(timer); queue.length = 0; current = null; host?.remove(); host = null;
  }
  function later() { clearTimeout(timer); timer = setTimeout(next, 12000); }
  function next() {
    clearTimeout(timer);
    host?.remove(); host = null; current = queue.shift();
    if (!current) return;
    const answer = current;
    host = document.createElement('div'); host.id = 'tinysearch-notification';
    root = host.attachShadow({mode:'closed'});
    // Constructed stylesheets also work on sites that forbid inline styles.
    const sheet = new CSSStyleSheet(); sheet.replaceSync(DR.toastStyles);
    root.adoptedStyleSheets = [sheet];
    const card = element('article', '', 'toast'); card.setAttribute('role','status'); card.setAttribute('aria-live','polite');
    const header = element('header');
    const controls = element('nav'); controls.setAttribute('aria-label','Answer actions');
    const feedback = element('span','','feedback'); feedback.setAttribute('aria-live','polite');
    function button(name, label, action) {
      const node = element('button'); node.type='button'; node.title=label; node.setAttribute('aria-label',label);
      node.append(TinyIcons.create(name)); node.addEventListener('click',action); controls.append(node);
    }
    button('clipboard','Copy summary for chat',async()=>{
      try { await DR.writeClipboard(DR.copyText(answer,{summaryOnly:true})); feedback.textContent='Copied'; }
      catch { feedback.textContent='Clipboard unavailable'; }
    });
    button('x','Dismiss answer',next);
    header.append(TinyIcons.create('search'),element('strong','TinySearch'),element('span',answer.source_name,'channel'),controls);
    const prose = element('p');
    const summary = DR.chatSummary(answer); let offset=0, citation=0;
    for (const match of summary.matchAll(/https?:\/\/[^\s<>]+/g)) {
      prose.append(document.createTextNode(summary.slice(offset,match.index)));
      const a=element('a',`[${++citation}]`,'source'); a.href=DR.safeURL(match[0]); a.target='_blank'; a.rel='noopener noreferrer'; a.title=match[0];
      prose.append(a); offset=match.index+match[0].length;
    }
    prose.append(document.createTextNode(summary.slice(offset)));
    const footer=element('div','','footer'), dashboard=element('a','View answers');
    dashboard.href='https://tinysearch.app/#questions'; dashboard.target='_blank'; dashboard.rel='noopener noreferrer'; dashboard.append(TinyIcons.create('arrow-up-right'));
    footer.append(feedback,dashboard); card.append(header,prose,footer); root.append(card);
    card.addEventListener('mouseenter',()=>clearTimeout(timer));
    card.addEventListener('mouseleave',()=>{if(!root.activeElement)later();});
    card.addEventListener('focusin',()=>clearTimeout(timer));
    card.addEventListener('focusout',()=>queueMicrotask(()=>{if(!root.activeElement)later();}));
    document.documentElement.append(host); later();
  }
  const receive = (message, sender, respond) => {
    if (sender.id !== api.runtime.id || sender.tab) return;
    if (message?.type === 'DR_TOAST_CLEAR') { clear(); respond({ok:true}); }
    if (message?.type !== 'DR_TOAST_SHOW' || !Array.isArray(message.answers)) return;
    if (document.visibilityState === 'hidden') { respond({ok:false}); return; }
    for (const raw of message.answers.slice(-5)) {
      const answer=DR.normalize(raw);
      if (!answer || seen.has(answer.id)) continue;
      seen.add(answer.id); queue.push(answer);
    }
    if (seen.size>200) for(const id of [...seen].slice(0,seen.size-200))seen.delete(id);
    if (queue.length>5) queue.splice(0,queue.length-5);
    if (!current) next();
    respond({ok:true});
  };
  globalThis.tinySearchToast = {clear};
  api.runtime.onMessage.addListener(receive);
  window.addEventListener('pagehide',clear,{once:true});
})();
