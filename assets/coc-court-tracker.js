(() => {
  const main = document.querySelector('.coc-court-tracker main');
  if (!main) return;
  const jump = main.querySelector('.jump');
  const disclosure = jump.querySelector('details');
  const summary = disclosure.querySelector('summary');

  jump.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || event.button !== 0) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    if (disclosure.contains(link)) disclosure.open = false;
    // Keep native anchor navigation and history, but move keyboard focus to
    // the section itself rather than to a now-hidden link in the menu.
    target.setAttribute('tabindex', '-1');
    requestAnimationFrame(() => target.focus({preventScroll:true}));
  });

  disclosure.addEventListener('keydown', event => {
    if (event.key === 'Escape' && disclosure.open) {
      event.preventDefault();
      disclosure.open = false;
      summary.focus();
    }
  });
})();
