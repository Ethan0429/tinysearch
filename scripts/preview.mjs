import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const routes=new Map([['/icons.js','src/icons.js'],['/markdown.js','src/markdown.js'],['/vendor/markdown-it.min.js','src/vendor/markdown-it.min.js'],['/','preview/index.html'],['/chat','preview/chat.html'],['/preview.js','preview/preview.js'],['/core.js','src/core.js'],['/ui.js','src/ui.js'],['/clipboard.js','src/clipboard.js'],['/popup.css','src/popup.css'],['/icons/128.png','dist/chrome/icons/128.png'],['/ui.css','src/ui.css'],['/sample.json','preview/sample.json'],['/changelog.json','src/changelog.json']]);
http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/popup'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end((await readFile(path.join(root,'src/popup.html'),'utf8')).replace('src="popup.js"','src="/popup-preview.js"'));return;}
  if(pathname==='/popup-preview.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(`const params=new URLSearchParams(location.search);const firefox=params.get('browser')==='firefox';const ready=params.get('update')==='ready';const store='https://chromewebstore.google.com/detail/tinysearch/lgonddigopjaghgljjhjokpkpglcaboc';
globalThis.chrome={runtime:{getManifest:()=>({version:'0.1.9'}),getURL:file=>'/'+file,sendMessage:async message=>message.type==='DR_RELEASES'?({updates:{installed:'0.1.9',channel:firefox?'firefox':'chrome',managed:!firefox,storeStatus:ready?'update_available':'automatic',available:ready,latest:ready?{version:'0.2.0',url:firefox?'https://github.com/Ethan0429/tinysearch/releases/tag/v0.2.0':store}:null,releases:[]}}):({preferences:{enabled:true,inline:true,compact:true}})}};
`+await readFile(path.join(root,'src/popup.js'),'utf8'));return;}
  const route=routes.get(new URL(req.url,'http://localhost').pathname);
  if(!route){res.writeHead(404);res.end('Not found');return;}
  try{
    const content=await readFile(path.join(root,route));
    res.writeHead(200,{'Content-Type':route.endsWith('.png')?'image/png':route.endsWith('.html')?'text/html; charset=utf-8':route.endsWith('.js')?'text/javascript; charset=utf-8':route.endsWith('.css')?'text/css; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(500);res.end('Preview unavailable');}
}).listen(Number(process.env.PORT || 8792),'127.0.0.1',()=>console.log(`TinySearch preview: http://localhost:${process.env.PORT || 8792} (fixture chat; real public research feed)`));
