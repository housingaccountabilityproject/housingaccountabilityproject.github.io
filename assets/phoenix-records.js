/* Local, city-scoped search. No requests, query URLs, storage or analytics. */
(() => {
  const form = document.querySelector('#record-filters');
  if (!form) return;
  const cards = [...document.querySelectorAll('.record-card')];
  const query = document.querySelector('#record-query');
  const topic = document.querySelector('#record-topic');
  const kind = document.querySelector('#record-kind');
  const sourceControls = document.querySelector('#source-filters');
  const kindControl = document.querySelector('#record-kind-control');
  const topicControl = document.querySelector('#record-topic-control');
  const textTools = window.HAPSearchText;
  const fold = textTools?.fold || (value => String(value).normalize('NFKC').toLowerCase());
  const tokenize = textTools?.tokens || (value => fold(value).trim().split(/\s+/).filter(Boolean));
  const sourceFacets = [
    ['source-agency', 'sourceAgency', 'Agency / publisher'],
    ['source-program', 'sourcePrograms', 'Program / subject'],
    ['source-format', 'sourceFormat', 'Document type'],
    ['source-year', 'sourceYears', 'Reporting / event year']
  ].map(([id, key, label]) => ({element: document.getElementById(id), key, label})).filter(facet => facet.element);
  for (const facet of sourceFacets) for (const option of facet.element.options) option.dataset.label = option.textContent;
  const count = document.querySelector('#record-count');
  const empty = document.querySelector('#record-empty');
  const views = document.querySelector('.record-views');
  const buttons = [...views.querySelectorAll('button')];
  const sourceCards = cards.filter(card => card.dataset.group === 'source');
  const model = new Map(cards.map(card => {
    const record = JSON.parse(card.dataset.search);
    const meta = record.metadata || {};
    const facts = [...card.querySelectorAll('.source-metadata dd')].map(node => node.textContent);
    const fields = [
      ['title', record.title], ['record text', (record.summary || []).join(' ')],
      ['record identifiers', [record.id, ...(record.aliases || [])].join(' ')],
      ['source IDs', (record.source_ids || []).join(' ')], ['status', (record.labels || []).join(' ')],
      ['dates and scope', [...(record.context || []), meta.date_basis || '', ...(meta.reporting_years || []), meta.retrieved_on || '', meta.date_basis_url || ''].join(' ')],
      ['source notes', record.source_note || ''], ['related findings', (record.related_titles || []).join(' ')],
      ['agency', facts[0] || ''], ['program', facts[1] || ''], ['document type', facts[2] || ''], ['period status', facts[3] || ''],
      ['limitations', (record.limitations || []).join(' ')]
    ].filter(([,value]) => value).map(([label,value]) => [label,fold(value)]);
    const why = document.createElement('p');
    why.className = 'search-why';
    why.hidden = true;
    card.querySelector('.record-summary').before(why);
    return [card, {fields, why}];
  }));
  let view = 'all';
  let printing;

  function basicMatch(card) {
    return (view === 'all' || card.dataset.group === view)
      && (!topic.value || card.dataset.topic.split(' ').includes(topic.value))
      && (!kind.value || card.dataset.kind === kind.value);
  }
  function facetMatch(card, replacement, value) {
    return sourceFacets.every(facet => {
      const selected = facet === replacement ? value : facet.element.value;
      return !selected || (card.dataset[facet.key] || '').split(' ').includes(selected);
    });
  }
  function updateCounts(textMatches) {
    if (view !== 'source') return;
    for (const facet of sourceFacets) {
      for (const option of facet.element.options) {
        const matches = sourceCards.filter(card => basicMatch(card) && textMatches.get(card) && facetMatch(card, facet, option.value)).length;
        option.textContent = `${option.dataset.label} (${matches})`;
      }
    }
  }
  function update() {
    const primer=document.getElementById('city-funding-primer');
    if(primer)primer.hidden=view!=='funding';
    const title=document.querySelector('.records-intro h1');
    if(title)title.textContent=view==='funding'?'Understand Phoenix funding':view==='source'?'Phoenix source index':view==='question'?'Phoenix research questions':'Search Phoenix research';
    if (sourceControls) sourceControls.hidden = view !== 'source';
    if (kindControl) kindControl.hidden = view === 'source';
    if (topicControl) topicControl.hidden = view === 'source';
    const terms = tokenize(query.value);
    const textMatches = new Map(cards.map(card => [card, terms.every(term => model.get(card).fields.some(([,value]) => value.includes(term)))]));
    let shown = 0;
    for (const card of cards) {
      const matches = basicMatch(card) && textMatches.get(card) && (view !== 'source' || facetMatch(card));
      card.hidden = !matches;
      const {fields,why} = model.get(card);
      why.hidden = !matches || !terms.length;
      if (textTools) textTools.clear(card);
      if (matches) {
        shown++;
        if (terms.length) {
          const labels = fields.filter(([,value]) => terms.some(term => value.includes(term))).map(([label]) => label);
          why.textContent = textTools ? textTools.explanation(labels) : 'Matched in: ' + labels.join(', ');
          if (textTools) for (const node of card.querySelectorAll('h2,.record-summary,.record-labels,.record-context,.source-date-basis,.source-retrieval,.source-metadata dd,.record-sources p,.record-heading a,.related-records a')) textTools.highlight(node,terms);
        }
      }
    }
    updateCounts(textMatches);
    count.textContent = view === 'source'
      ? `${shown} of ${sourceCards.length} source references · Phoenix only`
      : `${shown} of ${cards.length} entries · Phoenix only`;
    empty.hidden = shown > 0;
    printing?.update();
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    document.dispatchEvent(new Event('hapfilterschange'));
  }
  function clear() {
    query.value = '';
    topic.value = '';
    kind.value = '';
    sourceFacets.forEach(({element}) => { element.value = ''; });
    view = 'all';
  }
  function revealHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (id.startsWith('view-') && ['source','funding','all'].includes(id.slice(5))) {
      clear(); view = id.slice(5); update(); form.scrollIntoView({block: 'start'}); return;
    }
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
    topic.value = ''; kind.value = '';
    sourceFacets.forEach(({element}) => { element.value = ''; });
    update();
  }));
  window.addEventListener('hashchange', revealHash);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.hash === location.hash) revealHash();
  });
  form.hidden = false; views.hidden = false; update(); revealHash();
  const selectedLabel = select => select.options[select.selectedIndex].dataset.label || select.options[select.selectedIndex].textContent;
  printing = window.HAPSearchPrint?.register({
    title: 'Phoenix search results',
    describe: () => [
      `Search: ${query.value.trim() || '(no search terms)'}`,
      `Index: ${buttons.find(button => button.dataset.view === view).textContent}`,
      ...(view !== 'source' ? [`Topic: ${selectedLabel(topic)}`, `Record type: ${selectedLabel(kind)}`] : []),
      ...(view === 'source' ? sourceFacets.map(({element,label}) => `${label}: ${selectedLabel(element)}`) : [])
    ], results: () => cards.filter(card => !card.hidden),
    snapshot: 'Published research snapshot: November 8, 2026. Funding stages and project counts remain separate; source qualifications are retained.'
  });
})();
