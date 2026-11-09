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
    for (const disclosure of document.querySelectorAll('.city-evidence-library,.city-project-details,.city-about,.city-stage-guide details')) {
      if (!disclosure.open) { printOpened.add(disclosure); disclosure.open = true; }
    }
  });
  window.addEventListener('afterprint', () => {
    for (const disclosure of printOpened) disclosure.open = false;
    printOpened.clear();
  });
})();
