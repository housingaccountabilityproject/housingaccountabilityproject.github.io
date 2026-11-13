/* The four general pages keep preview navigation on screen and canonical HAP
 * destinations on paper. Research export engines do not load this helper. */
(() => {
  'use strict';
  const value = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  let canonical;
  try { canonical = new URL(value); } catch { return; }
  if (canonical.origin !== 'https://housingaccountabilityproject.github.io') return;
  const originals = new Map();
  const labelAttribute = 'data-hap-print-original-href';
  // Directory and index.html spellings identify the same document.
  const documentPath = url => url.pathname.replace(/\/index\.html$/, '/');
  function prepare() {
    for (const link of document.querySelectorAll('a[href]')) {
      const original = link.getAttribute('href');
      if (!original || original.trim().startsWith('#')) continue;
      let target;
      try { target = new URL(original, canonical); } catch { continue; }
      if (target.origin !== canonical.origin || documentPath(target) === documentPath(canonical)) continue;
      if (target.href === original) continue;
      // Repeated beforeprint/media events must not replace the original value.
      if (!originals.has(link)) originals.set(link, {href: original, label: link.getAttribute(labelAttribute)});
      link.setAttribute(labelAttribute, originals.get(link).href);
      link.setAttribute('href', target.href);
    }
  }
  function restore() {
    for (const [link, original] of originals) {
      link.setAttribute('href', original.href);
      if (original.label === null) link.removeAttribute(labelAttribute);
      else link.setAttribute(labelAttribute, original.label);
    }
    originals.clear();
  }
  window.addEventListener('beforeprint', prepare);
  window.addEventListener('afterprint', restore);
  // Some browsers signal leaving print media when a dialog is cancelled.
  matchMedia('print').addEventListener('change', event => {
    if (event.matches) prepare(); else restore();
  });
  // Do not retain print-only URLs in a back/forward-cache document.
  window.addEventListener('pagehide', restore);
})();
