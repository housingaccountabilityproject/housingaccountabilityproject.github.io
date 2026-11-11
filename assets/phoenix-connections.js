/* Local search of pre-rendered project and evidence-gap entries. */
(() => {
  const form = document.querySelector('.connection-filters');
  if (!form) return;
  const query = document.querySelector('#connection-query');
  const filter = document.querySelector('#connection-filter');
  const stage = document.querySelector('#city-project-stage');
  const entries = [...document.querySelectorAll('[data-connection-entry]')];
  const tools = window.HAPSearchText;
  const normalize = tools?.fold || (value => value.normalize('NFKC').toLowerCase());
  const text = new Map(entries.map(entry => [entry, normalize(entry.id+' '+(entry.dataset.search||'')+' '+entry.textContent)]));
  const reasons = new Map(entries.map(entry => {
    const reason = document.createElement('p'); reason.className = 'search-why'; reason.hidden = true;
    entry.querySelector('h2').after(reason); return [entry,reason];
  }));
  let printing, navigation;
  query.value='';filter.value='';if(stage)stage.value='';
  const count=document.querySelector('#connection-count'),empty=document.querySelector('#connection-empty');
  const toolbar=document.querySelector('.search-print-toolbar'),notice=window.HAPListBrowser.notice(toolbar);
  const mount=document.createElement('div');document.querySelector('#connection-results').after(mount);
  const label='Phoenix & Maricopa County '+document.querySelector('h1').textContent+' entries';
  const pager=window.HAPListBrowser.create({id:'connections',label,entries,mount,count,empty,focusTarget:count,onPage:()=>{navigation?.commit();printing?.update();}});
  const state=()=>({query:query.value,filter:filter.value,stage:stage?.value,page:pager.page()});
  function restore(s){query.value=typeof s.query==='string'?s.query.slice(0,4096):'';filter.value=[...filter.options].some(o=>o.value===s.filter)?s.filter:'';if(stage)stage.value=[...stage.options].some(o=>o.value===s.stage)?s.stage:'';update();pager.setPage(s.page||1);printing?.update();}
  const privacy=window.HAPSearchOptions.register({surface:'phoenix-'+location.pathname.split('/').pop(),mount:toolbar,state,restore:s=>{restore(s);navigation?.commit();}});
  function update() {
    const terms = tools ? tools.tokens(query.value) : normalize(query.value).trim().split(/\s+/).filter(Boolean);
    notice.textContent='';privacy.clearLink();const found=[];
    for (const entry of entries) {
      entry.hidden = Boolean(filter.value && entry.dataset.group !== filter.value)
        || Boolean(stage?.value && !(entry.dataset.projectStages || '').split(' ').includes(stage.value))
        || !terms.every(term => text.get(entry).includes(term));
      if (tools) tools.clear(entry);
      const reason = reasons.get(entry); reason.hidden = entry.hidden || !terms.length;
      if (!reason.hidden) {
        reason.textContent = 'Matched in: this entry and its connected evidence.';
        if (tools) for (const node of entry.querySelectorAll('h2,.project-observations,.question-heading>p:not(.search-why),.question-evidence>p,.question-outcome>p,.comparison-quote,.comparison-date,.comparison-explanation,.connection-links li')) tools.highlight(node,terms);
      }
      if (!entry.hidden) found.push(entry);
    }
    pager.update(found);
    printing?.update();
    document.dispatchEvent(new Event('hapfilterschange'));
  }
  function reset() { query.value = ''; filter.value = ''; if(stage)stage.value=''; update(); }
  function revealHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    const entry=target?.closest('[data-connection-entry]');if(!entry)return;
    if(!pager.matches().includes(entry)){reset();notice.textContent='Filters cleared to reveal the linked record '+(entry.id||id)+'.';}
    pager.reveal(entry);window.HAPListBrowser.reveal(target);navigation?.replace();printing?.update();
  }
  form.addEventListener('input',event=>{if(event.target===query){update();navigation.commit('typing');}});
  form.addEventListener('change',()=>{update();navigation.commit('filter');});
  form.addEventListener('submit',event=>{event.preventDefault();update();navigation.commit();});
  form.addEventListener('reset',event=>{event.preventDefault();privacy.reset();reset();navigation.commit();});
  window.addEventListener('hashchange', revealHash);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash === location.hash) revealHash();
  });
  form.hidden = false;
  update();const shared=window.HAPSearchOptions.incoming('phoenix-'+location.pathname.split('/').pop());if(shared)restore(shared);
  navigation=window.HAPListBrowser.history({key:'phoenix-connections',state,restore});
  revealHash();
  printing = window.HAPSearchPrint?.register({
    title: `Phoenix ${document.querySelector('h1').textContent} — search results`, privacy,
    describe: () => [`Search: ${query.value.trim() || '(no search terms)'}`, `Show: ${filter.options[filter.selectedIndex].textContent}`,...(stage?[`Evidence stage: ${stage.options[stage.selectedIndex].textContent}`]:[])],
    results:pager.matches, currentResults:pager.current,
    snapshot: 'Published research snapshot: November 8, 2026. These are research navigation records, not a log of submitted or received records requests.'
  });
})();
