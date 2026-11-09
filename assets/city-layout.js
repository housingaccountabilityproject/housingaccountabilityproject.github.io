(() => {
  const nav = document.querySelector('.city-main-nav');
  if (!nav) return;
  function currentView() {
    if (!document.body.classList.contains('city-phoenix')) return;
    const selected = document.querySelector('.record-views button[aria-pressed="true"]')?.dataset.view;
    let key;
    if (selected) key = selected === 'source' ? 'sources' : selected === 'funding' ? 'funding' : selected === 'question' ? 'questions' : 'search';
    else if (/\/projects\//.test(location.pathname)) key = 'projects';
    else if (/capital-fund\.html$/.test(location.pathname)) key = 'funding';
    if (!key) return;
    for (const link of nav.querySelectorAll('[data-city-route]')) {
      if (link.dataset.cityRoute === key) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }
  document.addEventListener('hapfilterschange', currentView);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    for (const menu of document.querySelectorAll('.city-more[open]')) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  currentView();
})();

/* Stable research links reveal their context, including inside optional reading. */
(() => {
  function reveal(hash) {
    let id;
    try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    let opened = false;
    for (let node = target; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS' && !node.open) { node.open = true; opened = true; }
    }
    if (opened) requestAnimationFrame(() => target.scrollIntoView({block:'start'}));
  }
  window.addEventListener('hashchange', () => reveal(location.hash));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const raw = link.getAttribute('href');
    if (raw.startsWith('#')) { reveal(raw); return; }
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.hash) reveal(url.hash);
  });
  reveal(location.hash);
  const printOpened = new Set();
  window.addEventListener('beforeprint', () => {
    for (const disclosure of document.querySelectorAll('.city-evidence-library,.city-project-details,.city-about,.city-funding-explainer,.city-stage-guide details,.city-story-source,.city-story-publication')) {
      if (!disclosure.open) { printOpened.add(disclosure); disclosure.open = true; }
    }
  });
  window.addEventListener('afterprint', () => {
    for (const disclosure of printOpened) disclosure.open = false;
    printOpened.clear();
  });
})();

/* One accessible navigation drawer, with ordinary links when JavaScript is off. */
(() => {
  const toggle=document.querySelector('.city-menu-toggle');
  const panel=document.querySelector('.city-nav-panel');
  if(!toggle||!panel)return;
  const closeButton=panel.querySelector('.city-menu-close');
  const backdrop=document.querySelector('.city-menu-backdrop');
  const mobile=matchMedia('(max-width:760px)');
  const original=new Map();let opened=false,overflow='';
  function close(focus=true){
    if(!opened)return;
    opened=false;document.body.classList.remove('city-menu-open');
    toggle.setAttribute('aria-expanded','false');
    panel.removeAttribute('role');panel.removeAttribute('aria-modal');panel.removeAttribute('aria-labelledby');
    backdrop.hidden=true;
    for(const [node,value] of original)node.inert=value;
    original.clear();document.body.style.overflow=overflow;
    if(focus&&mobile.matches)toggle.focus();
  }
  function open(){
    if(!mobile.matches)return;
    opened=true;document.body.classList.add('city-menu-open');
    toggle.setAttribute('aria-expanded','true');
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','city-menu-title');
    backdrop.hidden=false;overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const nodes=[...document.body.children].filter(node=>!node.classList.contains('city-header')&&!['SCRIPT','STYLE'].includes(node.tagName));
    nodes.push(document.querySelector('.city-brand'),document.querySelector('.city-current-city'),toggle);
    for(const node of nodes){if(!node)continue;original.set(node,node.inert);node.inert=true;}
    closeButton.focus();
  }
  toggle.hidden=false;document.body.classList.add('city-menu-ready');
  toggle.addEventListener('click',()=>opened?close():open());
  closeButton.addEventListener('click',()=>close());backdrop.addEventListener('click',()=>close());
  panel.addEventListener('click',event=>{if(event.target.closest('a[href]'))close(false);});
  document.addEventListener('keydown',event=>{
    if(!opened)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const items=[...panel.querySelectorAll('a[href],button:not([disabled]),summary,[tabindex="0"]')].filter(node=>node.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  mobile.addEventListener('change',()=>{if(!mobile.matches)close(false);});
})();

/* Letter and text filters combine locally; no queries or selections are stored. */
(() => {
  const query=document.getElementById('glossary-query');
  if(!query)return;
  const terms=[...document.querySelectorAll('.glossary-term')];
  const bar=document.createElement('div');bar.className='city-glossary-letters city-design-ui';bar.setAttribute('role','group');bar.setAttribute('aria-label','Filter glossary by initial');
  let letter='';
  const titles=new Map(terms.map(term=>[term,(term.querySelector('th,h3,h2')?.textContent||term.textContent).trim().toLocaleUpperCase('en-US')]));
  const letters=[...new Set([...titles.values()].map(title=>title.charAt(0)))].sort();
  const buttons=[];
  function update(){
    const words=query.value.toLocaleLowerCase('en-US').trim().split(/\s+/).filter(Boolean);let count=0;
    for(const term of terms){term.hidden=Boolean(letter&&!titles.get(term).startsWith(letter))||!words.every(word=>term.textContent.toLocaleLowerCase('en-US').includes(word));if(!term.hidden)count++;}
    const status=document.getElementById('glossary-status');if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent=`${count} of ${terms.length} searchable entries`;}
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.letter===letter));
  }
  for(const value of ['',...letters]){
    const button=document.createElement('button');button.type='button';button.dataset.letter=value;button.textContent=value||'All terms';
    button.addEventListener('click',()=>{letter=value;update();});buttons.push(button);bar.append(button);
  }
  const clear=document.createElement('button');clear.type='button';clear.textContent='Clear glossary filters';clear.addEventListener('click',()=>{query.value='';letter='';update();query.focus();});bar.append(clear);
  query.closest('label')?.after(bar);if(!bar.isConnected)query.after(bar);
  query.addEventListener('input',update);update();
})();

/* A detached project brief prints its citations without changing the full file. */
(() => {
  for(const button of document.querySelectorAll('[data-city-print]')){button.hidden=false;button.addEventListener('click',()=>window.print());}
  const story=document.querySelector('.city-project-story');
  const button=document.getElementById('print-project-brief');
  if(!story||!button)return;
  const publication=document.getElementById('research-publication-time');
  if(publication){
    const details=document.createElement('details');details.className='city-story-publication';
    const summary=document.createElement('summary');summary.textContent='Publication details';
    details.append(summary,publication);story.append(details);
  }
  function cleanup(){document.getElementById('city-brief-print-output')?.remove();document.body.classList.remove('printing-project-brief');}
  function prepare(){
    cleanup();
    const report=document.createElement('section');report.id='city-brief-print-output';report.setAttribute('aria-label','Project research brief');
    const title=document.createElement('h1');title.textContent=story.dataset.projectName;
    const label=document.createElement('p');label.textContent='Housing Accountability Project · Phoenix · Project research brief';
    const snapshot=document.createElement('p');snapshot.textContent='Research snapshot: November 8, 2026. Source dates and limitations govern interpretation.';
    const copy=story.cloneNode(true);copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));copy.querySelectorAll('.city-story-tools,button').forEach(node=>node.remove());copy.querySelectorAll('details').forEach(node=>node.open=true);
    const reference=document.querySelector('link[rel="canonical"]')?.href||document.baseURI;
    copy.querySelectorAll('a[href]').forEach(link=>link.href=new URL(link.getAttribute('href'),reference).href);
    const appendix=document.createElement('p');appendix.textContent='Full findings and source appendix: '+reference.split('#')[0]+'#sources';
    report.append(label,title,snapshot,copy,appendix);document.body.append(report);document.body.classList.add('printing-project-brief');
  }
  button.hidden=false;button.addEventListener('click',()=>{prepare();try{window.print();}finally{cleanup();}});
  window.addEventListener('afterprint',cleanup);
  window.HAPProjectBrief={prepare,cleanup};
})();
