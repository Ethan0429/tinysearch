/* markdown-it parses Markdown; this renderer creates only allowlisted DOM nodes. */
(() => {
  'use strict';
  const parser = globalThis.markdownit({html:false,breaks:true,linkify:false});
  const safeURL = value => {
    try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;} catch {return null;}
  };
  const allowed=new Set('p strong em s a code pre blockquote ul ol li h1 h2 h3 h4 h5 h6 table thead tbody tr th td'.split(' '));
  function tokens(items, root) {
    const stack=[root];
    for(const token of items || []) {
      const parent=stack.at(-1);
      if(token.type==='inline'){tokens(token.children,parent);continue;}
      if(token.type==='text'||token.type==='html_inline'||token.type==='html_block'){parent.append(document.createTextNode(token.content));continue;}
      if(token.type==='softbreak'||token.type==='hardbreak'){parent.append(document.createElement('br'));continue;}
      if(token.type==='image'){parent.append(document.createTextNode(token.content));continue;}
      if(token.type==='code_inline'){const n=document.createElement('code');n.textContent=token.content;parent.append(n);continue;}
      if(token.type==='fence'||token.type==='code_block'){const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=token.content;pre.append(code);parent.append(pre);continue;}
      if(token.type==='hr'){parent.append(document.createElement('hr'));continue;}
      if(token.nesting===-1){if(stack.length>1)stack.pop();continue;}
      if(token.nesting!==1)continue;
      const tag=allowed.has(token.tag)?token.tag:'span';
      const node=document.createElement(tag);
      if(tag==='a') {
        const url=safeURL(token.attrGet('href'));
        if(url){node.href=url;node.target='_blank';node.rel='noopener noreferrer';node.referrerPolicy='no-referrer';}
        const title=token.attrGet('title');if(title)node.title=title;
      }
      if(tag==='ol'&&/^\d+$/.test(token.attrGet('start')||''))node.start=Number(token.attrGet('start'));
      if(tag==='th'||tag==='td'){const align=token.attrGet('style')?.match(/^text-align:(left|center|right)$/)?.[1];if(align)node.classList.add('align-'+align);}
      if(tag==='table'){const wrap=document.createElement('div');wrap.className='markdown-table';wrap.append(node);parent.append(wrap);}else parent.append(node);
      stack.push(node);
    }
  }
  globalThis.TinyMarkdown={render(text,className='prose') {
    const root=document.createElement('div');root.className=className;tokens(parser.parse(String(text||''),{}),root);return root;
  }};
})();
