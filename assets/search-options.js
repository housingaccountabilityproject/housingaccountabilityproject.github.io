/* Search choices stay in memory. A URL is produced only by an explicit action. */
(() => {
  'use strict';
  const prefix = '#hap-search=';
  const make = (tag, text) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function preparedAt(value = new Date()) {
    const stamp = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Phoenix', dateStyle: 'long', timeStyle: 'medium'
    }).format(value);
    return `${stamp} MST (UTC−7)`;
  }

  function incoming(surface) {
    if (!location.hash.startsWith(prefix)) return null;
    try {
      const encoded = location.hash.slice(prefix.length);
      if (encoded.length > 16000) return null;
      const payload = JSON.parse(decodeURIComponent(encoded));
      return payload.version === 1 && payload.surface === surface &&
        payload.state && typeof payload.state === 'object' ? payload.state : null;
    } catch {
      return null;
    }
  }

  function register({surface, mount, state}) {
    const box = make('div');
    box.className = 'search-options screen-only';
    box.dataset.searchUi = '';
    const choice = make('label');
    const checkbox = make('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'include-search-terms';
    checkbox.checked = false;
    choice.append(checkbox, ' Include my typed search terms in print');
    const printHelp = make('p', 'Off by default. Selected filters and the records’ own evidence remain in print. Reloading clears this choice and ordinary search state.');
    const sharing = make('details');
    sharing.append(make('summary', 'Share this search · optional'));
    const sharingHelp = make('p', 'Creating a link includes your typed terms and filters in its URL fragment. Anyone with the link can read them. Opening the link can leave it in browser history. Ordinary searching does not change the URL or save search state.');
    sharingHelp.id = 'search-sharing-help';
    const create = make('button', 'Create a link with my terms and filters');
    create.type = 'button';
    create.id = 'create-search-link';
    create.setAttribute('aria-describedby', sharingHelp.id);
    const output = make('div');
    output.hidden = true;
    const outputLabel = make('label', 'Search link to share');
    outputLabel.htmlFor = 'shared-search-link';
    const field = make('input');
    field.id = 'shared-search-link';
    field.type = 'text';
    field.readOnly = true;
    field.autocomplete = 'off';
    const status = make('p');
    status.setAttribute('role', 'status');
    output.append(outputLabel, field, status);
    create.addEventListener('click', () => {
      const url = new URL(document.querySelector('link[rel="canonical"]')?.href || location.href);
      url.search = '';
      url.hash = 'hap-search=' + encodeURIComponent(JSON.stringify({version: 1, surface, state: state()}));
      field.value = url.href;
      output.hidden = false;
      status.textContent = 'Link created at your request. Select and copy it to share.';
      field.focus();
      field.select();
    });
    sharing.append(sharingHelp, create, output);
    box.append(choice, printHelp, sharing);
    mount.append(box);
    const skipLinks = [...document.querySelectorAll('a.skip')].map(link => ({link, href: link.getAttribute('href')}));
    for (const {link} of skipLinks) link.addEventListener('click', event => {
      const report = document.getElementById(link.getAttribute('href').slice(1));
      if (report?.dataset.searchPrintTarget === 'true') {
        event.preventDefault();
        report.focus();
        report.scrollIntoView({block: 'start'});
      }
    });
    return {
      includeTerms: () => checkbox.checked,
      clearLink: () => { output.hidden = true; field.value = ''; },
      reset: () => { checkbox.checked = false; output.hidden = true; field.value = ''; },
      showPrint: report => {
        report.tabIndex = -1;
        report.dataset.searchPrintTarget = 'true';
        for (const {link} of skipLinks) link.setAttribute('href', '#' + report.id);
      },
      leavePrint: () => {
        for (const {link, href} of skipLinks) link.setAttribute('href', href);
      }
    };
  }
  window.HAPSearchOptions = {register, incoming, preparedAt};
})();
