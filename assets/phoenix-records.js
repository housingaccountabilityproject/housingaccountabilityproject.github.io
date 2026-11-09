/* Local Phoenix-only filtering. No requests, storage, query URLs or analytics. */
(() => {
  const form = document.querySelector('#record-filters');
  if (!form) return;
  const cards = [...document.querySelectorAll('.record-card')];
  const query = document.querySelector('#record-query');
  const topic = document.querySelector('#record-topic');
  const kind = document.querySelector('#record-kind');
  const count = document.querySelector('#record-count');
  const empty = document.querySelector('#record-empty');
  const views = document.querySelector('.record-views');
  const buttons = [...views.querySelectorAll('button')];
  const normalized = value => value.normalize('NFKC').toLowerCase();
  const searchable = new Map(cards.map(card => [card, normalized(card.dataset.search)]));
  let view = 'all';
  let printing;

  function update() {
    const terms = normalized(query.value).trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const card of cards) {
      const matches = (view === 'all' || card.dataset.group === view)
        && (!topic.value || card.dataset.topic.split(' ').includes(topic.value))
        && (!kind.value || card.dataset.kind === kind.value)
        && terms.every(term => searchable.get(card).includes(term));
      card.hidden = !matches;
      if (matches) shown++;
    }
    count.textContent = `${shown} of ${cards.length} entries · Phoenix only`;
    empty.hidden = shown > 0;
    printing?.update();
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    document.dispatchEvent(new Event('hapfilterschange'));
  }

  function clear() {
    query.value = '';
    topic.value = '';
    kind.value = '';
    view = 'all';
  }

  function revealHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target?.classList.contains('record-card')) return;
    if (target.hidden) { clear(); update(); }
    target.scrollIntoView({block: 'start'});
  }

  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('reset', event => { event.preventDefault(); clear(); update(); });
  buttons.forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view;
    // A new index starts with its own complete set; query terms remain local.
    topic.value = '';
    kind.value = '';
    update();
  }));
  window.addEventListener('hashchange', revealHash);
  // Repeated links to the current fragment do not fire hashchange.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash === location.hash) revealHash();
  });
  form.hidden = false;
  views.hidden = false;
  update();
  revealHash();
  printing = window.HAPSearchPrint?.register({
    title: 'Phoenix search results',
    describe: () => [
      `Search: ${query.value.trim() || '(no search terms)'}`,
      `Index: ${buttons.find(button => button.dataset.view === view).textContent}`,
      `Topic: ${topic.options[topic.selectedIndex].textContent}`,
      `Record type: ${kind.options[kind.selectedIndex].textContent}`
    ],
    results: () => cards.filter(card => !card.hidden),
    snapshot: 'Published research snapshot: November 8, 2026. Funding stages and project counts remain separate; source qualifications are retained.'
  });
})();
