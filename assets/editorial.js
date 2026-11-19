/* Print the edition's qualifications and restore each disclosure afterwards. */
(() => {
  const opened = new Set();
  function prepare() {
    for (const item of document.querySelectorAll('main details:not([open])')) {
      opened.add(item);
      item.open = true;
    }
  }
  function restore() {
    for (const item of opened) item.open = false;
    opened.clear();
  }
  addEventListener('beforeprint', prepare);
  addEventListener('afterprint', restore);
  addEventListener('pagehide', restore);
  matchMedia('print').addEventListener('change', event => event.matches ? prepare() : restore());
})();
