(async()=>{
  let receive, count=0;
  // Model the active-tab state in the standalone demo, including hidden preview
  // browsers. The extension itself uses the real document visibility state.
  Object.defineProperty(document,'visibilityState',{get:()=> 'visible'});
  globalThis.chrome={runtime:{id:'tinysearch-preview',onMessage:{addListener(fn){receive=fn;}}}};
  globalThis.browser=globalThis.chrome;
  DR.toastStyles=await(await fetch('/toast.css')).text();
  const script=document.createElement('script');script.src='/toast.js';
  await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;document.head.append(script);});
  const sample=(await(await fetch('/sample.json')).json()).answers[0];
  const show=()=>{
    const id=(++count).toString(16).padStart(24,'0');
    receive({type:'DR_TOAST_SHOW',answers:[{...sample,id,created_at:new Date().toISOString(),
      chat_summary:'The claim remains unverified: the available sources do not establish it. https://example.org/evidence',
      sources:[{title:'Evidence',url:'https://example.org/evidence'}]}]}, {id:'tinysearch-preview'},()=>{});
  };
  document.querySelector('#show').onclick=show;document.querySelector('#queue').onclick=show;
  document.querySelector('#clear').onclick=()=>receive({type:'DR_TOAST_CLEAR'},{id:'tinysearch-preview'},()=>{});
  show();
})().catch(error=>{document.querySelector('.note').textContent='Preview error: '+error.message;});
