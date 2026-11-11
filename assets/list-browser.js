/* Six-entry views over complete, ordered record sets. No storage or query URLs. */
(() => {
  'use strict';
  const make = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function create({id, label, entries, mount, count, empty, focusTarget, total, onPage = () => {}}) {
    const allEntries = () => typeof entries === 'function' ? entries() : entries;
    let matches = [...allEntries()], page = 1;
    const controls = make('nav');
    controls.className = 'list-pagination screen-only';
    controls.id = id + '-pagination';
    controls.setAttribute('aria-label', (typeof label==='function'?label():label) + ' pages');
    const previous = make('button', 'Previous'), next = make('button', 'Next');
    previous.type = next.type = 'button';
    previous.id = id + '-previous'; next.id = id + '-next';
    previous.setAttribute('aria-label', 'Previous page of ' + (typeof label==='function'?label():label));
    next.setAttribute('aria-label', 'Next page of ' + (typeof label==='function'?label():label));
    const status = make('span'); status.id = id + '-page';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    controls.append(previous, status, next); mount.append(controls);
    if (focusTarget) focusTarget.tabIndex = -1;
    function render(focus = false) {
      const pages = Math.max(1, Math.ceil(matches.length / 6));
      page = Math.min(pages, Math.max(1, Number.isSafeInteger(page) ? page : 1));
      const start = (page - 1) * 6, visible = matches.slice(start, start + 6);
      const shown = new Set(visible);
      allEntries().forEach(entry => { entry.hidden = !shown.has(entry); });
      status.textContent = `Page ${page} of ${pages}`;
      previous.disabled = page === 1; next.disabled = page === pages;
      if (count) count.textContent = `${matches.length} of ${total?total():allEntries().length} ${typeof label==='function'?label():label}${matches.length ? ` · Showing ${start + 1}–${start + visible.length}` : ' · No matches'}`;
      if (empty) empty.hidden = matches.length > 0;
      if (focus && focusTarget) { focusTarget.focus({preventScroll:true}); focusTarget.scrollIntoView({block:'start'}); }
    }
    previous.addEventListener('click', () => { page--; render(true); onPage(); });
    next.addEventListener('click', () => { page++; render(true); onPage(); });
    return {
      update(found, reset = true) { matches = [...found]; if (reset) page = 1; render(); },
      page: () => page,
      setPage(value) { page = value; render(); },
      matches: () => [...matches],
      current: () => matches.slice((page - 1) * 6, page * 6),
      reveal(entry) { const index = matches.indexOf(entry); if (index < 0) return false; page = Math.floor(index / 6) + 1; render(); return true; }
    };
  }
  // History state is local to this tab's history entries. Reload deliberately starts fresh.
  // Coalesce consecutive typing; explicit filters/pages remain useful Back/Forward steps.
  function historyState({key, state, restore, afterRestore = () => {}}) {
    let restoring = false, lastKind = '', ready = false;
    const property = 'hap-list-' + key;
    const write = replace => {
      const data = {...(history.state || {}), [property]: {...state(),__focus:document.activeElement?.id||'',__scroll:window.scrollY}};
      history[replace ? 'replaceState' : 'pushState'](data, '', location.href);
    };
    const nav = performance.getEntriesByType('navigation')[0]?.type;
    const previous = nav !== 'reload' ? history.state?.[property] : null;
    if (previous) { restoring = true; restore(previous); restoring = false; }
    write(true); ready = true;
    window.addEventListener('popstate', event => {
      const value = event.state?.[property];
      if (!value) return;
      restoring = true; restore(value); afterRestore(); const target=document.getElementById(value.__focus)||document.querySelector('main');target?.focus({preventScroll:true});if(Number.isFinite(value.__scroll))window.scrollTo(0,value.__scroll);restoring = false; lastKind = '';
    });
    return {
      commit(kind = 'action') { if (!ready || restoring) return; write(kind === 'typing' && lastKind === 'typing'); lastKind = kind; },
      replace() { if (!restoring) write(true); }
    };
  }
  function notice(mount) {
    const node = make('p'); node.className = 'list-link-notice screen-only';
    node.setAttribute('role','status'); node.setAttribute('aria-live','polite'); mount.append(node);
    return node;
  }
  function reveal(target) {
    if (!target.textContent.trim()) target = target.closest('tr,[data-catalog-entry],.record-card,[data-connection-entry]') || target;
    for (let parent = target.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    target.tabIndex = -1; target.focus({preventScroll:true}); target.scrollIntoView({block:'start'});
  }
  window.HAPListBrowser = {create, history:historyState, notice, reveal};
})();
