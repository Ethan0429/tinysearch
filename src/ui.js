(() => {
  'use strict';
  const DR = globalThis.DR;
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (label, title, action, cls = '', iconName = null) => {
    const node = el('button', cls, label);
    node.type = 'button'; node.title = title; node.setAttribute('aria-label', title);
    node.addEventListener('click', action); if(iconName)node.append(icon(iconName)); return node;
  };
  const icon = kind => TinyIcons.create(kind);
  function copyButton(answer, summaryOnly = false) {
    const control = el('button','copy-button');
    control.type = 'button';
    const feedback = el('span','sr-only');feedback.setAttribute('role','status');
    const reset = () => {
      control.title = summaryOnly ? 'Copy summary for chat' : 'Copy full answer';control.setAttribute('aria-label',control.title);
      control.replaceChildren(icon('clipboard'),feedback);feedback.textContent='';
    };
    reset();
    control.addEventListener('click',async()=>{
      control.disabled=true;control.setAttribute('aria-busy','true');
      try{
        await DR.writeClipboard(DR.copyText(answer, {summaryOnly}));
        control.replaceChildren(icon('check'),feedback);
        control.title='Copied for chat';control.setAttribute('aria-label','Copied');
        feedback.textContent='Copied for chat';
        setTimeout(reset,1800);
      }catch{
        control.title='Copy failed. Click to try again.';control.setAttribute('aria-label',control.title);
        feedback.textContent='Copy failed. Click to try again.';
      }finally{control.disabled=false;control.removeAttribute('aria-busy');}
    });
    return control;
  }

  const link = (label, url, cls = '', iconName = null) => {
    const node = el('a', cls, label);
    if(iconName)node.append(icon(iconName));
    const safe = DR.safeURL(url);
    if (safe) { node.href = safe; node.target = '_blank'; node.rel = 'noopener noreferrer'; node.referrerPolicy = 'no-referrer'; }
    return node;
  };
  const stamp = value => new Date(value).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
  DR.markdown = text => TinyMarkdown.render(text, 'prose');
  function shadow(host) {
    const root = host.attachShadow({mode:'open'});
    const style = el('style'); style.textContent = DR.styles; root.append(style); return root;
  }
  DR.card = (answer, {compact = true, archive = false, onBrowse = () => {}} = {}) => {
    if (!archive) {
      const article = el('article', `card inline-summary${compact ? ' compact' : ''}`);
      article.setAttribute('aria-label', `TinySearch: ${answer.question}`);
      const head = el('header', 'byline');
      const avatar = el('span', 'avatar'); avatar.append(icon('search'));
      head.append(avatar, el('strong', 'bot-name', 'TinySearch'), el('span', 'bot-tag', 'BOT'), copyButton(answer, true));
      const prose = el('p', 'chat-summary');
      const summary = DR.chatSummary(answer);
      let offset = 0, citation = 0;
      for (const match of summary.matchAll(/https?:\/\/[^\s<>]+/g)) {
        prose.append(document.createTextNode(summary.slice(offset, match.index)));
        const source = answer.sources.find(s => DR.safeURL(s.url) === DR.safeURL(match[0]));
        const anchor = link(`[${++citation}]`, match[0], 'summary-source');
        anchor.title = source?.title || match[0];
        anchor.setAttribute('aria-label', `Source ${citation}: ${anchor.title}`);
        prose.append(anchor); offset = match.index + match[0].length;
      }
      prose.append(document.createTextNode(summary.slice(offset)));
      const footer = el('footer', 'card-actions');
      const time = el('time', '', stamp(answer.created_at)); time.dateTime = answer.created_at;
      footer.append(button('Full answer', 'Read the full answer in TinySearch', () => onBrowse(answer.id), 'text-button', 'arrow-up-right'), time);
      article.append(head, prose, footer); return article;
    }
    const article = el('article', `card${compact ? ' compact' : ''}`);
    article.setAttribute('aria-label', `TinySearch: ${answer.question}`);
    const head = el('header', 'byline');
    const avatar=el('span','avatar');avatar.append(icon('search'));
    head.append(avatar, el('strong','bot-name','TinySearch'), el('span','bot-tag','BOT'),copyButton(answer));
    const meta = el('div', 'meta');
    const time = el('time', '', stamp(answer.created_at)); time.dateTime = answer.created_at;
    time.title = 'Answer published ' + new Date(answer.created_at).toLocaleString();
    meta.append(el('span', 'eyebrow', archive ? 'ANSWER HISTORY' : 'STREAM ANSWER'), time);
    const title = el('h3', 'question', answer.question);
    const body = DR.markdown(answer.answer_markdown);
    const content = el('div', 'answer-body'); content.append(body);
    const sources = el('div', 'sources');
    if (answer.sources.length) {
      sources.append(el('span', 'eyebrow', `SOURCES · ${answer.sources.length}`));
      answer.sources.forEach((source, i) => {
        sources.append(link(`${i+1}. ${source.title}`, source.url, 'source-link'));
      });
    }
    content.append(sources);
    const footer = el('footer', 'card-actions');
    const watch = link('Watch moment', answer.stream_url, 'watch', 'arrow-up-right');
    watch.title = 'Open the stream at the time this question was heard';
    footer.append(watch);
    article.append(head, meta, title, content, footer, el('p','disclaimer','AI answer · check the sources'));
    return article;
  };

  DR.ChatApp = class {
    constructor({transport, context = () => null, now = () => Date.now()}) {
      this.transport = transport; this.context = context; this.now = now; this.startedAt = now();
      this.answers = []; this.preferences = {...DR.DEFAULTS}; this.seen = new Set(); this.live = new Map();
      this.selected = null; this.query = ''; this.scope = 'all'; this.unread = 0; this.open = false; this.busy = false;
      this.onResize = () => this.position();
    }
    mount() {
      const chat = document.querySelector('#chat');
      const output = document.querySelector('#chat-output-frame');
      const lines = document.querySelector('#chat-win-main .chat-lines');
      if (!chat || !output || !lines) return false;
      if (this.host?.isConnected && this.lines === lines) return true;
      this.host?.remove(); this.lines = lines;
      this.host = el('div'); this.host.dataset.drToolbar = ''; this.host.style.cssText = 'display:block;flex:0 0 auto;position:relative;z-index:90;min-width:0';
      this.root = shadow(this.host);
      const toolbar = el('div', 'toolbar');
      this.browse = button('', 'Browse TinySearch history', () => this.toggle(), 'brand');
      this.dot = el('span', 'status-dot');
      this.count = el('span', 'count', '0');
      this.browse.append(this.dot, el('strong','','TinySearch'), this.count);
      this.browse.setAttribute('aria-expanded','false');
      this.status = el('span', 'toolbar-status', 'Connecting…'); this.status.setAttribute('role','status');
      const nav = el('div','toolbar-nav');
      this.prev = button('', 'Previous answer', () => this.step(-1), 'icon-button', 'chevron-left');
      this.next = button('', 'Next answer', () => this.step(1), 'icon-button', 'chevron-right');
      nav.append(this.prev, this.next, button('','Search TinySearch history', () => {this.toggle(true);this.search.focus();}, 'icon-button', 'list'));
      this.updateLink=link('Update',DR.REPOSITORY+'/releases','update-link','arrow-up-right');
      this.updateLink.hidden=true;this.updateLink.title='A TinySearch extension update is available';
      toolbar.append(this.browse,this.status,this.updateLink,nav);
      this.drawer = el('section','drawer'); this.drawer.hidden = true; this.drawer.setAttribute('aria-label','Answer history');
      const heading = el('div','drawer-heading');
      const name = el('div'); name.append(el('span','eyebrow','TINYSEARCH'),el('h2','','Answer history'));
      heading.append(name,button('','Close TinySearch history',()=>this.toggle(false),'icon-button close','x'));
      this.search = el('input','search'); this.search.type = 'search';this.search.placeholder = 'Search questions, answers, sources…';
      this.search.setAttribute('aria-label','Search TinySearch history');
      this.search.addEventListener('input',()=>{this.query=this.search.value;this.renderHistory();});
      const filters = el('div','filters');
      this.allFilter = button('All answers','Show all recent answers',()=>this.setScope('all'),'filter active');
      this.streamFilter = button('This stream','Show answers for this YouTube stream',()=>this.setScope('stream'),'filter');
      filters.append(this.allFilter,this.streamFilter);
      this.results = el('div','results');this.results.setAttribute('aria-label','Questions');
      this.reader = el('div','reader');
      this.positionText = el('span','position-text');
      const readerNav = el('div','reader-nav');
      this.older = button('Older','Previous matching answer',()=>this.step(-1),'text-button','arrow-left');
      this.newer = button('Newer','Next matching answer',()=>this.step(1),'text-button','arrow-right');
      readerNav.append(this.older,this.positionText,this.newer);
      this.drawer.append(heading,this.search,filters,this.results,readerNav,this.reader);
      this.empty = el('p','empty');
      this.root.append(toolbar,this.drawer);
      chat.insertBefore(this.host,output);
      this.input = document.querySelector('#chat-input-frame');
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(chat); if(this.input)this.resizeObserver.observe(this.input);
      window.removeEventListener('resize',this.onResize);window.addEventListener('resize',this.onResize);
      this.toggle(this.open);this.refreshBar();return true;
    }
    position() {
      if (!this.host?.isConnected) return;
      this.host.style.setProperty('--panel-top', `${this.host.getBoundingClientRect().bottom}px`);
      const bottom = this.input?.getBoundingClientRect().top;
      this.host.style.setProperty('--panel-bottom', `${bottom ? Math.max(0,window.innerHeight-bottom) : 8}px`);
    }
    visible() { return [...this.answers].reverse().filter(a=>DR.matches(a,this.query) && (this.scope!=='stream'||a.stream_id===this.context())); }
    setScope(scope) { this.scope = scope; this.renderHistory(); }
    toggle(value) {
      this.open = value === undefined ? !this.open : value;
      if(!this.drawer)return;
      this.drawer.hidden=!this.open;this.browse.setAttribute('aria-expanded',String(this.open));
      if(this.open){this.unread=0;this.renderHistory();this.position();}
      this.refreshBar();
    }
    step(delta) {
      this.toggle(true);
      const entries=this.visible();
      let index=entries.findIndex(a=>a.id===this.selected);
      if(index<0)index=0;
      // History is newest-first; older moves toward a larger index.
      index=Math.max(0,Math.min(entries.length-1,index-delta));
      if(entries[index]){this.selected=entries[index].id;this.renderHistory();this.reader.scrollTop=0;this.results.querySelector('.selected')?.scrollIntoView({block:'nearest'});}
    }
    refreshBar() {
      if(!this.host)return;
      this.host.style.display=this.preferences.enabled?'block':'none';
      this.count.textContent=String(this.answers.length)+(this.unread?` · +${this.unread}`:'');
      this.dot.classList.toggle('offline',!!this.error||!this.lastSuccess);
      this.status.textContent=this.error?'Reconnecting':this.lastSuccess?'Connected':'Connecting…';
      this.status.title=this.lastSuccess?`Public feed checked ${stamp(this.lastSuccess)}`:'Waiting for the public relay';
      this.prev.disabled=this.next.disabled=!this.answers.length;
      this.streamFilter.disabled=!this.context();
      this.streamFilter.title=this.context()?'Filter to the embedded YouTube video':'Available when a YouTube stream is embedded';
      this.updateLink.hidden=!this.updates?.available;
      if(this.updates?.available && this.updates.latest?.url===DR.REPOSITORY+'/releases/tag/v'+this.updates.latest.version){
        this.updateLink.href=this.updates.latest.url;
        this.updateLink.title=`TinySearch ${this.updates.latest.version} is available. View changes and download.`;
      }
      this.position();
    }
    renderHistory() {
      const entries=this.visible();
      if(!entries.some(a=>a.id===this.selected))this.selected=entries[0]?.id||null;
      this.allFilter.classList.toggle('active',this.scope==='all');this.streamFilter.classList.toggle('active',this.scope==='stream');
      const fragment=document.createDocumentFragment();
      entries.forEach(answer=>{
        const item=button('',answer.question,()=>{this.selected=answer.id;this.renderHistory();this.reader.scrollTop=0;},'result'+(answer.id===this.selected?' selected':''));
        item.setAttribute('aria-pressed',String(answer.id===this.selected));
        item.append(el('span','result-question',answer.question),el('span','result-time',stamp(answer.created_at)));
        fragment.append(item);
      });
      if(!entries.length)fragment.append(el('p','empty',this.query?'Try another search to find an answer.':this.scope==='stream'?'Answers for this stream will appear here.':'TinySearch answers will appear here during the stream.'));
      const oldScroll=this.results.scrollTop;
      this.results.replaceChildren(fragment);this.results.scrollTop=oldScroll;
      const index=entries.findIndex(a=>a.id===this.selected);
      this.positionText.textContent=entries.length?`${index+1} / ${entries.length}`:'0 answers';
      this.older.disabled=index<0||index>=entries.length-1;this.newer.disabled=index<=0;
      const signature=entries[index]?JSON.stringify(entries[index]):null;
      if(this.renderedID!==this.selected||this.renderedSignature!==signature){
        this.reader.replaceChildren();
        if(entries[index])this.reader.append(DR.card(entries[index],{compact:false,archive:true}));
        this.renderedID=this.selected;this.renderedSignature=signature;
      }
    }
    insert(answer) {
      const host=el('div');host.dataset.drAnswer=answer.id;host.style.cssText='display:block;margin:8px 7px;clear:both;';
      const root=shadow(host);
      root.append(DR.card(answer,{compact:this.preferences.compact,onBrowse:id=>{this.selected=id;this.toggle(true);}}));
      host.drSignature=JSON.stringify(answer);
      const atBottom=this.lines.scrollHeight-this.lines.clientHeight-this.lines.scrollTop<64;
      this.lines.append(host);
      if(atBottom)this.lines.scrollTop=this.lines.scrollHeight;
      this.live.set(answer.id,host);
      while(this.live.size>30){const [id,node]=this.live.entries().next().value;node.remove();this.live.delete(id);}
    }
    async tick() {
      if(this.busy)return;this.busy=true;
      try {
        if(!this.mount())return;
        const snapshot=await this.transport();
        if(!Array.isArray(snapshot.answers))throw new Error('No feed');
        const previous=new Set(this.answers.map(a=>a.id));
        const incoming=DR.merge([],snapshot.answers,this.now());
        this.preferences={...DR.DEFAULTS,...snapshot.preferences};this.lastSuccess=snapshot.lastSuccess;this.error=snapshot.error;this.updates=snapshot.updates;
        for(const answer of incoming){
          const existing=this.live.get(answer.id);
          if(existing && existing.drSignature!==JSON.stringify(answer)){
            existing.shadowRoot.querySelector('article').replaceWith(DR.card(answer,{
              compact:this.preferences.compact,onBrowse:id=>{this.selected=id;this.toggle(true);}
            }));
            existing.drSignature=JSON.stringify(answer);
          }
          if(DR.shouldInline(answer,{streamID:this.context(),startedAt:this.startedAt,seen:this.seen,now:this.now()})){
            if(this.preferences.enabled&&this.preferences.inline)this.insert(answer);
            if(!previous.has(answer.id)&&!this.open)this.unread++;
          }
          this.seen.add(answer.id);
        }
        this.answers=incoming;
        for(const [id,node]of this.live){node.hidden=!this.preferences.enabled||!this.preferences.inline;}
        this.refreshBar();if(this.open)this.renderHistory();
      } catch {this.error='Reconnecting';this.refreshBar();}
      finally{this.busy=false;}
    }
    destroy() {
      this.resizeObserver?.disconnect();window.removeEventListener('resize',this.onResize);
      this.host?.remove();for(const node of this.live.values())node.remove();
    }
  };
})();
