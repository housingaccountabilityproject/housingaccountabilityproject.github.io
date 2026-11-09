/* Prepare a detached, complete results report without changing the screen view. */
(() => {
  'use strict';
  window.HAPSearchPrint = {
    register({title, describe, results, count = () => results().length, snapshot = ''}) {
      const button = document.querySelector('#print-search-results');
      let previewing = false;
      let previewButton;
      const makeText = (tag, value) => {
        const node = document.createElement(tag);
        node.textContent = value;
        return node;
      };
      function removeReport() {
        document.querySelector('#search-print-output')?.remove();
        document.body.classList.remove('printing-search-results');
      }
      function cleanup() {
        removeReport();
        previewing = false;
        document.querySelector('#search-print-preview-controls')?.remove();
        document.body.classList.remove('previewing-search-results');
        previewButton?.focus();
      }
      function prepare() {
        removeReport();
        const entries = results();
        const referenceURL = document.querySelector('link[rel="canonical"]')?.href || document.baseURI;
        const report = document.createElement('section');
        report.id = 'search-print-output';
        report.setAttribute('aria-label', title);
        report.append(makeText('p', 'Housing Accountability Project'), makeText('h1', title));
        for (const line of describe()) report.append(makeText('p', line));
        report.append(makeText('p', `${entries.length} matching result${entries.length === 1 ? '' : 's'} · complete results for this search`));
        if (snapshot) report.append(makeText('p', snapshot));
        report.append(makeText('p', `Prepared for printing: ${new Date().toLocaleString(undefined, {timeZoneName: 'short'})}. Research dates remain attached to the records.`));
        for (const entry of entries) {
          const copy = entry.cloneNode(true);
          copy.hidden = false;
          copy.removeAttribute('id');
          copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
          copy.querySelectorAll('details').forEach(node => { node.open = true; });
          // Print source/context links as absolute addresses so paper copies are useful.
          copy.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (href.startsWith('#') && link.textContent.trim() === 'Direct link') {
              link.remove();
            } else if (href.startsWith('#') && link.closest('.record-heading')) {
              link.replaceWith(makeText('span', link.textContent));
            } else {
              link.href = new URL(href, referenceURL).href;
            }
          });
          report.append(copy);
        }
        if (!entries.length) report.append(makeText('p', 'No results match the active search.'));
        document.body.append(report);
        document.body.classList.add('printing-search-results');
      }
      function preview() {
        previewing = true;
        prepare();
        document.body.classList.remove('printing-search-results');
        document.body.classList.add('previewing-search-results');
        let controls = document.querySelector('#search-print-preview-controls');
        if (!controls) {
          controls = document.createElement('div');
          controls.id = 'search-print-preview-controls';
          const print = makeText('button', 'Print / Save PDF');
          print.id = 'print-results';
          print.type = 'button';
          print.addEventListener('click', () => window.print());
          const close = makeText('button', 'Return to results');
          close.id = 'close-print';
          close.type = 'button';
          close.addEventListener('click', cleanup);
          controls.append(print, close);
          document.body.prepend(controls);
        }
        controls.querySelector('button').focus();
        controls.scrollIntoView({block: 'start'});
      }
      function update() {
        if (button) button.disabled = count() === 0;
        if (previewButton) previewButton.disabled = count() === 0;
      }
      window.addEventListener('beforeprint', prepare);
      window.addEventListener('afterprint', () => {
        if (previewing) document.body.classList.remove('printing-search-results');
        else cleanup();
      });
      if (button) {
        button.hidden = false;
        button.addEventListener('click', () => window.print());
        previewButton = makeText('button', 'Preview print results');
        previewButton.id = 'preview-print';
        previewButton.type = 'button';
        previewButton.addEventListener('click', preview);
        button.after(previewButton);
      }
      update();
      const controller = {update, preview, closePreview: cleanup};
      window.HAPSearchPrint.active = controller;
      return controller;
    }
  };
})();
