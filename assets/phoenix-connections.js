/* Local search of pre-rendered project and evidence-gap entries. */
(() => {
  const form = document.querySelector('.connection-filters');
  if (!form) return;
  const query = document.querySelector('#connection-query');
  const filter = document.querySelector('#connection-filter');
  const entries = [...document.querySelectorAll('[data-connection-entry]')];
  const normalize = value => value.normalize('NFKC').toLowerCase();
  const text = new Map(entries.map(entry => [entry, normalize(entry.dataset.search)]));
  function update() {
    const terms = normalize(query.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const entry of entries) {
      entry.hidden = Boolean(filter.value && entry.dataset.group !== filter.value)
        || !terms.every(term => text.get(entry).includes(term));
      if (!entry.hidden) count++;
    }
    document.querySelector('#connection-count').textContent = `${count} of ${entries.length} entries`;
    document.querySelector('#connection-empty').hidden = count > 0;
  }
  function reset() { query.value = ''; filter.value = ''; update(); }
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
})();
