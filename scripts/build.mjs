import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {zipSync} from 'fflate';
import sharp from 'sharp';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=name=>readFile(path.join(root,'src',name),'utf8');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const core=await read('core.js'), css=await read('ui.css');
const content=[await read('vendor/markdown-it.min.js'),await read('markdown.js'),await read('icons.js'),core,await read('clipboard.js'),`globalThis.DR.styles = ${JSON.stringify(css)};`,await read('ui.js'),await read('content.js')].join('\n');
const background=[core,await read('background.js')].join('\n');
const toast=[await read('icons.js'),core,await read('clipboard.js'),`globalThis.DR.toastStyles = ${JSON.stringify(await read('toast.css'))};`,await read('toast.js')].join('\n');
const base={manifest_version:3,name:'TinySearch',version:pkg.version,
  description:'Sourced stream answers in DGG chat, with searchable history and stream timestamps.',
  homepage_url:'https://github.com/Ethan0429/tinysearch',
  permissions:['storage','clipboardWrite','alarms'],host_permissions:['https://tinysearch.app/*'],
  optional_permissions:['scripting'],optional_host_permissions:['http://*/*','https://*/*'],
  icons:{16:'icons/16.png',32:'icons/32.png',48:'icons/48.png',128:'icons/128.png'},
  action:{default_title:'TinySearch',default_popup:'popup.html',default_icon:{16:'icons/16.png',32:'icons/32.png'}},
  content_scripts:[{matches:['https://www.destiny.gg/embed/chat*','https://destiny.gg/embed/chat*'],
    js:['content.js'],all_frames:true,run_at:'document_idle'}],
  content_security_policy:{extension_pages:"script-src 'self'; object-src 'none'; connect-src 'self' https://tinysearch.app"}
};
const files=['manifest.json','core.js','content.js','toast.js','background.js','popup.html','popup.js','popup.css','changelog.json','icons.js','markdown.js','vendor/markdown-it.min.js','vendor/MARKDOWN-IT-LICENSE','vendor/LUCIDE-LICENSE','vendor/README.md',...Object.values(base.icons)];
const icons=await Promise.all([16,32,48,128].map(async size=>[size,await sharp(path.join(root,'assets','icon.png')).resize(size,size).png().toBuffer()]));
await mkdir(path.join(root,'artifacts'),{recursive:true});
for(const browser of ['chrome','firefox']){
  const dir=path.join(root,'dist',browser);await mkdir(path.join(dir,'icons'),{recursive:true});await mkdir(path.join(dir,'vendor'),{recursive:true});
  const manifest=structuredClone(base);
  if(browser==='chrome'){manifest.minimum_chrome_version='120';manifest.background={service_worker:'background.js'};}
  // Keep the Firefox installation ID stable across product renames.
  else {manifest.background={scripts:['background.js']};manifest.browser_specific_settings={gecko:{id:'destiny-research@ethan0429',strict_min_version:'142.0',data_collection_permissions:{required:['none']}}};}
  await writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  await writeFile(path.join(dir,'content.js'),content+'\n');await writeFile(path.join(dir,'background.js'),background+'\n');
  await writeFile(path.join(dir,'toast.js'),toast+'\n');
  for(const name of ['core.js','popup.html','popup.js','popup.css','changelog.json','icons.js','markdown.js','vendor/markdown-it.min.js','vendor/MARKDOWN-IT-LICENSE','vendor/LUCIDE-LICENSE','vendor/README.md'])await copyFile(path.join(root,'src',name),path.join(dir,name));
  for(const [size,png] of icons)await writeFile(path.join(dir,'icons',size+'.png'),png);
  const entries=Object.fromEntries(await Promise.all(files.map(async file=>[file,[new Uint8Array(await readFile(path.join(dir,file))),{mtime:new Date(2026,0,1)}]])));
  await writeFile(path.join(root,'artifacts',`tinysearch-${browser}-${pkg.version}.zip`),zipSync(entries,{level:9}));
  console.log(`Built ${browser}: dist/${browser} and artifacts/tinysearch-${browser}-${pkg.version}.zip`);
}
