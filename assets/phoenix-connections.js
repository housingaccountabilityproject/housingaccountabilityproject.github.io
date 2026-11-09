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
  const text = new Map(entries.map(entry => [entry, normalize(entry.textContent)]));
  const reasons = new Map(entries.map(entry => {
    const reason = document.createElement('p'); reason.className = 'search-why'; reason.hidden = true;
    entry.querySelector('h2').after(reason); return [entry,reason];
  }));
  let printing;
  function update() {
    const terms = tools ? tools.tokens(query.value) : normalize(query.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
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
      if (!entry.hidden) count++;
    }
    document.querySelector('#connection-count').textContent = `${count} of ${entries.length} entries`;
    document.querySelector('#connection-empty').hidden = count > 0;
    printing?.update();
    document.dispatchEvent(new Event('hapfilterschange'));
  }
  function reset() { query.value = ''; filter.value = ''; if(stage)stage.value=''; update(); }
  function revealHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target?.hasAttribute('data-connection-entry')) return;
    if (target.hidden) reset();
    target.scrollIntoView({block: 'start'});
  }
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  form.addEventListener('reset', event => { event.preventDefault(); reset(); });
  window.addEventListener('hashchange', revealHash);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash === location.hash) revealHash();
  });
  form.hidden = false;
  update();
  revealHash();
  printing = window.HAPSearchPrint?.register({
    title: `Phoenix ${document.querySelector('h1').textContent} — search results`,
    describe: () => [`Search: ${query.value.trim() || '(no search terms)'}`, `Show: ${filter.options[filter.selectedIndex].textContent}`,...(stage?[`Evidence stage: ${stage.options[stage.selectedIndex].textContent}`]:[])],
    results: () => entries.filter(entry => !entry.hidden),
    snapshot: 'Published research snapshot: November 8, 2026. These are research navigation records, not a log of submitted or received records requests.'
  });
})();
