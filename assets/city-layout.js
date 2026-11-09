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
