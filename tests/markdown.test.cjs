const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const assetRoot=path.join(__dirname,'../src');
async function window(){const {Window}=await import('happy-dom');const w=new Window();for(const file of ['vendor/markdown-it.min.js','markdown.js','icons.js'])w.eval(fs.readFileSync(path.join(assetRoot,file),'utf8'));return w;}
test('Markdown renders nested emphasis, lists, headings, tables, quotes and code',async()=>{
 const w=await window();const prose=w.TinyMarkdown.render('# Heading\n\n**Bold with *emphasis*** and _italic_.\n\n- One\n- Two\n\n1. First\n2. Second\n\n> Quote\n\n```js\nconst value = 1;\n```\n\n| A | B |\n| - | - |\n| x | y |\n\n[Evidence](https://example.org/a_(b))');
 assert.equal(prose.querySelector('strong em').textContent,'emphasis');assert.equal(prose.querySelectorAll('ul li').length,2);assert.equal(prose.querySelectorAll('ol li').length,2);assert.ok(prose.querySelector('h1'));assert.ok(prose.querySelector('blockquote'));assert.match(prose.querySelector('pre code').textContent,/const value/);assert.equal(prose.querySelectorAll('td').length,2);assert.equal(prose.querySelector('a').href,'https://example.org/a_(b)');assert.doesNotMatch(prose.textContent,/\*\*Bold/);await w.happyDOM.abort();
});
test('untrusted Markdown cannot create HTML, fetch images or execute links',async()=>{
 const w=await window();const p=w.TinyMarkdown.render('<script>alert(1)</script> <img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1)) ![alt](https://example.org/a.png) [credentials](https://user:pass@example.org)');
 assert.equal(p.querySelectorAll('script,img,iframe').length,0);assert.ok(p.textContent.includes('<script>'));assert.ok([...p.querySelectorAll('a')].every(a=>!a.hasAttribute('href')));assert.ok(p.textContent.includes('alt'));await w.happyDOM.abort();
});
test('icons are local SVG library geometry, with accessible decorative semantics',async()=>{const w=await window();for(const name of ['search','arrow-right','x','pause','clipboard']){const svg=w.TinyIcons.create(name);assert.equal(svg.namespaceURI,'http://www.w3.org/2000/svg');assert.equal(svg.getAttribute('aria-hidden'),'true');assert.ok(svg.children.length);}await w.happyDOM.abort();});
