/* Enhance native fragment navigation and full-article printing. No content copies. */
(() => {
  'use strict';
  const content = document.querySelector('.updates-content');
  const print = document.querySelector('#updates-print');
  if (!content || !print) return;
  print.hidden = false;
  const opened = new Set();
  function target() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
    const node = document.getElementById(id);
    return node && content.contains(node) && !node.closest('.city-design-ui') ? node : null;
  }
  function article() {
    const node = target();
    if (!node) return null;
    let parent = node.closest('article');
    if (!parent) {
      parent = node;
      while (parent.parentElement !== content && parent.parentElement) parent = parent.parentElement;
    }
    return parent;
  }
  function navigate() {
    const node = target();
    if (!node) return;
    for (let parent = node.parentElement; parent && parent !== content; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    if (!node.hasAttribute('tabindex')) node.tabIndex = -1;
    node.focus({preventScroll: true});
    node.scrollIntoView({block: 'start', behavior: 'instant'});
  }
  function prepare() {
    const active = article();
    if (!active) return;
    for (const detail of active.querySelectorAll('details:not([open])')) {
      opened.add(detail);
      detail.open = true;
    }
  }
  function restore() {
    for (const detail of opened) detail.open = false;
    opened.clear();
  }
  addEventListener('hashchange', navigate);
  addEventListener('pageshow', navigate);
  addEventListener('beforeprint', prepare);
  addEventListener('afterprint', restore);
  addEventListener('pagehide', restore);
  matchMedia('print').addEventListener('change', event => event.matches ? prepare() : restore());
  print.addEventListener('click', () => window.print());
  navigate();
})();
