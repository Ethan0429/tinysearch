(() => {
  'use strict';
  // The real message list is in /embed/chat, not the top bigscreen document.
  if (!/^\/embed\/chat\/?$/.test(location.pathname)) return;
  const api = globalThis.browser || globalThis.chrome;
  const DR = globalThis.DR;
  function context() {
    try {
      const parent = window.top;
      const hash = parent.location.hash.match(/^#youtube\/([\w-]{11})(?:$|[?&/])/i);
      if (hash) return hash[1];
      const kick = parent.location.hash.match(/^#kick\/([\w-]{1,25})(?:$|[?&/])/i);
      if (kick) return 'kick:'+kick[1].toLowerCase();
      for (const iframe of parent.document.querySelectorAll('iframe[src]')) {
        const id = DR.videoID(iframe.src) || DR.kickChannel(iframe.src); if (id) return id;
      }
    } catch { /* Popout/cross-origin pages still get unfiltered recent research. */ }
    return null;
  }
  const app = new DR.ChatApp({transport:()=>api.runtime.sendMessage({type:'DR_FEED'}),context});
  let timer;
  async function cycle() { await app.tick(); timer = setTimeout(cycle,15000); }
  cycle();
  // This observer only repairs mounting after DGG refreshes its output frame.
  // Normal chat traffic is not read, retained or transmitted.
  let pending = false;
  const observer = new MutationObserver(() => {
    if(app.host?.isConnected&&app.lines?.isConnected)return;
    if(pending)return;pending=true;
    queueMicrotask(()=>{pending=false;app.mount();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>{clearTimeout(timer);observer.disconnect();app.destroy();},{once:true});
})();
