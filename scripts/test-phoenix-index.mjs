import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {openNavigation} from './browser-navigation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.PHOENIX_TEST_BASE_URL || 'http://127.0.0.1:8765';
const server = process.env.PHOENIX_TEST_BASE_URL ? null : spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
let browser;
try {
  for (let i = 0; i < 40; i++) {
    try { assert((await fetch(base + '/phoenix/records.html')).ok); break; }
    catch (error) { if (i === 39) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  for (const width of [320, 390, 768, 1280]) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
    await page.goto(base + '/phoenix/records.html');
    const visible = page.locator('.record-card:visible');
    assert.equal(await visible.count(), 6); assert.match(await page.locator('#record-count').textContent(), /^90 of /);
    assert(await page.locator('#source-filters').isHidden());
    assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `overflow ${width}`);
    await page.keyboard.press('Tab');
    assert(await page.locator('.skip').evaluate(el => el === document.activeElement));
    await page.keyboard.press('Enter');
    assert(await page.locator('main').evaluate(el => el === document.activeElement));
    await page.waitForLoadState('networkidle');
    const initialRequests = requests.length;
    await page.getByRole('button', {name: 'Sources', exact: true}).click();
    assert.equal(await visible.count(), 6); assert.match(await page.locator('#record-count').textContent(), /^45 of /);
    assert(await page.locator('#source-filters').isVisible());
    assert(await page.locator('#record-kind-control').isHidden());
    assert(await page.locator('#record-topic-control').isHidden());
    await page.getByLabel('Agency / publisher', {exact:true}).selectOption('hud');
    await page.getByLabel('Program / subject', {exact:true}).selectOption('home');
    await page.getByLabel('Document type', {exact:true}).selectOption('dataset-metadata');
    assert.equal(await visible.count(), 2);
    await page.getByLabel('Reporting / event year', {exact:true}).selectOption('2026');
    assert.equal(await visible.count(), 1);
    assert.equal(await visible.first().getAttribute('id'), 'source-PHX-EXT-PROJECT-203');
    assert.match(await page.locator('#record-count').textContent(),/^1 of 45 Phoenix & Maricopa County source references/);
    assert.equal(await visible.first().locator('.source-retrieval time').getAttribute('datetime'), '2026-11-08');
    await page.getByLabel('Reporting / event year', {exact:true}).selectOption('2025');
    assert.equal(await visible.first().getAttribute('id'), 'source-PHX-EXT-PROJECT-200');
    await page.getByLabel('Agency / publisher', {exact:true}).selectOption('data-gov');
    await page.getByLabel('Reporting / event year', {exact:true}).selectOption('2026');
    assert.equal(await visible.first().getAttribute('id'), 'source-PHX-EXT-PROJECT-201');
    await page.getByRole('button', {name: 'Clear filters', exact:true}).click();
    await page.getByRole('button', {name: 'Sources', exact:true}).click();
    for (const id of ['source-agency','source-program','source-format','source-year']) assert.equal(await page.locator('#'+id).inputValue(), '');
    await page.locator('#source-agency').selectOption('city-phoenix');
    await page.locator('#source-program').selectOption('capital-fund');
    await page.locator('#source-format').selectOption('plan');
    await page.locator('#source-year').selectOption('unresolved');
    assert.equal(await visible.count(), 2);
    assert(await page.locator('#source-PHX-CITY-003').isVisible());
    assert(await page.locator('#source-PHX-CITY-013').isVisible());
    await page.locator('#source-format').selectOption('audit');
    await page.locator('#source-year').selectOption('2026');
    assert.equal(await visible.count(), 0, 'Audit publication year is not its reporting period');
    await page.locator('#source-year').selectOption('2025');
    assert.equal(await visible.count(), 1);
    assert.equal(await visible.first().getAttribute('id'), 'source-PHX-CITY-027');
    await page.getByRole('button', {name: 'Clear filters', exact:true}).click();
    await page.getByRole('button', {name: 'Sources', exact:true}).click();
    await page.locator('#source-agency').selectOption('arizona-housing');
    await page.locator('#source-year').selectOption('2026');
    assert.equal(await visible.count(), 0, 'File-modification year is not an award year');
    await page.locator('#source-year').selectOption('2020');
    assert.equal(await visible.count(), 1);
    assert.equal(await visible.first().getAttribute('id'), 'source-PHX-LIHTC-001');
    await page.getByRole('button', {name: 'Clear filters', exact:true}).click();
    await page.getByRole('button', {name: 'Sources', exact:true}).click();
    await page.getByRole('searchbox').fill('PHX-CFP-011');
    assert.equal(await visible.count(), 1);
    assert.equal(await visible.first().getAttribute('id'), 'source-PHX-CFP-011');
    await visible.first().getByText('Findings using this source', {exact: true}).click();
    await visible.first().getByRole('link', {name: 'Capital Fund: HUD-published award amount', exact: true}).click();
    assert(page.url().endsWith('#PHX-CFP-WEB-001'));
    await page.locator('#PHX-CFP-WEB-001').waitFor({state: 'visible'});
    await page.getByRole('button', {name: 'Questions', exact: true}).click();
    assert.equal(await visible.count(), 6); assert.match(await page.locator('#record-count').textContent(), /^13 of /);
    await page.locator('#record-topic').selectOption('bell', {force:true});
    assert.equal(await visible.count(), 6);
    await page.getByRole('button', {name: 'Funding', exact: true}).click();
    assert.equal(await visible.count(), 6); assert.match(await page.locator('#record-count').textContent(), /^19 of /);
    await page.getByRole('searchbox').fill('MC-HOME-WEB-001');
    assert(await page.locator('#MC-HOME-WEB-001').isVisible());
    assert((await page.locator('#MC-HOME-WEB-001').textContent()).includes('not confirmed awards or spending'));
    await page.getByRole('searchbox').fill('');
    await page.locator('#record-kind').selectOption('expenditure', {force:true});
    assert.equal(await visible.count(), 1);
    assert.equal(await visible.first().getAttribute('id'), 'PHX-CFP-WEB-004');
    await page.getByRole('searchbox').fill('no-record-837462');
    assert.equal(await visible.count(), 0);
    assert(await page.locator('#record-empty').isVisible());
    await page.getByRole('button', {name: 'Clear filters', exact: true}).click();
    assert.equal(await visible.count(), 6); assert.match(await page.locator('#record-count').textContent(), /^90 of /);
    await page.getByRole('searchbox').fill('MC-HAMC-WEB-001');
    assert.equal(await visible.count(), 3);
    assert(await page.locator('#MC-HAMC-WEB-001').isVisible());
    assert(await page.locator('#source-PHX-HAMC-001').isVisible());
    assert(await page.locator('#source-PHX-HAMC-002').isVisible());
    await page.locator('#record-kind').selectOption('notice', {force:true});
    assert.equal(await visible.count(), 1);
    assert((await visible.first().textContent()).includes('application limits may apply earlier'));
    assert((await visible.first().textContent()).includes('8 a.m. Arizona time'));
    await page.getByRole('button', {name: 'Clear filters', exact: true}).click();
    await page.getByRole('searchbox').fill('<img src=x onerror=alert(1)>');
    assert.equal(await visible.count(), 0);
    assert.equal(await page.locator('#record-results img').count(), 0);
    await page.getByRole('button', {name: 'Clear filters', exact: true}).click();
    await page.getByRole('searchbox').fill('Moreland');
    assert(await visible.count() > 0);
    assert(!await page.locator('#BELL-03').isVisible());
    // Chromium can revalidate the fixed favicon after an in-page fragment visit.
    const extraRequests = requests.slice(initialRequests).filter(url => url !== base + '/assets/phoenix-review/favicon.svg');
    assert.deepEqual(extraRequests, [], 'filtering must not send requests');
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.deepEqual(errors, []);
    await page.goto(base + '/phoenix/records.html#BELL-04');
    await page.locator('#BELL-04').waitFor({state: 'visible'});
    await page.getByRole('searchbox').fill('unmatched-944');
    await page.evaluate(() => {
      const link = document.createElement('a'); link.href = '#BELL-04'; link.id = 'repeat-test'; link.textContent = 'Repeat direct link'; document.querySelector('main').prepend(link);
    });
    await page.locator('#repeat-test').click();
    await page.locator('#BELL-04').waitFor({state: 'visible'});
    if (width === 1280) {
      await page.evaluate(() => document.body.style.zoom = '2');
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), '200% zoom overflow');
    }
    await page.close();
    console.log(`PASS Phoenix index at ${width}: source lookup, reverse links, funding/questions, filters, reset, direct links, keyboard and local-only search.`);
  }
  for (const width of [320, 390, 768, 1280]) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
    await page.goto(base + '/phoenix/projects.html');
    const projects = page.locator('[data-connection-entry]:visible');
    assert.equal(await projects.count(), 6); assert.match(await page.locator('#connection-count').textContent(), /^11 of /);
    assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `directory overflow ${width}`);
    await page.locator('#connection-filter').selectOption('development', {force:true});
    assert.equal(await projects.count(), 6); assert.match(await page.locator('#connection-count').textContent(), /^10 of /);
    await page.getByRole('searchbox').fill('Moreland');
    assert.equal(await projects.count(), 1);
    assert.equal(await projects.first().getAttribute('id'), 'project-moreland');
    await projects.first().locator('.city-project-details > summary').click();
    await projects.first().getByRole('link', {name: 'Read the record · PHX-WEB-010', exact: true}).click();
    assert(page.url().endsWith('/phoenix/records.html#PHX-WEB-010'));
    await page.locator('#PHX-WEB-010').waitFor({state: 'visible'});
    await page.locator('#PHX-WEB-010').getByRole('link', {name: 'The Moreland', exact: true}).click();
    assert(page.url().endsWith('/phoenix/projects.html#project-moreland'));
    await page.locator('#project-moreland').waitFor({state: 'visible'});
    await page.getByRole('searchbox').fill('no-project-123476');
    assert.equal(await projects.count(), 0);
    assert(await page.locator('#connection-empty').isVisible());
    // Repeated direct links must reveal hidden entries without relying on hashchange.
    await page.evaluate(() => {
      const link = document.createElement('a'); link.href = '#project-moreland'; link.id = 'repeat-project'; link.textContent = 'Repeat project link'; document.querySelector('main').prepend(link);
    });
    await page.locator('#repeat-project').click();
    await page.locator('#project-moreland').waitFor({state: 'visible'});
    await page.locator('#connection-filter').selectOption('planning-area', {force:true});
    assert.equal(await projects.count(), 1);
    assert.equal(await projects.first().getAttribute('id'), 'project-marcos-grant-park');
    await page.getByRole('button', {name: 'Clear filters'}).click();
    assert.equal(await projects.count(), 6); assert.match(await page.locator('#connection-count').textContent(), /^11 of /);

    await openNavigation(page);
    await page.getByRole('navigation', {name: 'Main navigation'}).getByRole('link', {name: 'Questions'}).click();
    await page.waitForURL(base + '/phoenix/questions.html');
    await page.waitForLoadState('load');
    const questions = page.locator('[data-connection-entry]:visible');
    assert.equal(await questions.count(), 6); assert.match(await page.locator('#connection-count').textContent(), /^13 of /);
    assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `matrix overflow ${width}`);
    await page.locator('#connection-filter').selectOption('bell', {force:true});
    assert.equal(await questions.count(), 6);
    await page.getByRole('searchbox').fill('amendment');
    assert(await questions.count() > 0);
    await page.getByRole('searchbox').fill('no-question-123476');
    assert.equal(await questions.count(), 0);
    await page.getByRole('button', {name: 'Clear filters'}).click();
    await page.locator('#connection-filter').selectOption('capital', {force:true});
    assert.equal(await questions.count(), 3);
    const need = page.locator('#need-capital-evidence-needed-03');
    await need.getByText('Relevant published records', {exact: true}).click();
    await need.getByRole('link', {name: 'Capital Fund: annual SEFA expenditure', exact: true}).click();
    assert(page.url().endsWith('#PHX-CFP-WEB-004'));
    await page.locator('#PHX-CFP-WEB-004').waitFor({state: 'visible'});
    assert.deepEqual(errors, []);
    if (width === 1280) {
      for (const path of ['projects.html', 'questions.html']) {
        await page.goto(base + '/phoenix/' + path);
        await page.evaluate(() => document.body.style.zoom = '2');
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `200% zoom overflow ${path}`);
      }
    }
    await page.goto(base + '/phoenix/comparisons.html');
    assert.equal(await page.locator('[data-connection-entry]:visible').count(), 2);
    assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `comparison overflow ${width}`);
    await page.locator('#connection-filter').selectOption('bell', {force:true});
    assert.equal(await page.locator('[data-connection-entry]:visible').count(), 1);
    const bellComparison = page.locator('#comparison-bell-arpa');
    assert.equal(await bellComparison.locator('.comparison-statement').count(), 2);
    assert((await bellComparison.textContent()).includes('June 14, 2023'));
    assert((await bellComparison.textContent()).includes('2025 recovery report'));
    await bellComparison.getByRole('link', {name: 'Read the original explanation · BELL-07', exact: true}).click();
    assert(page.url().endsWith('/phoenix/projects/25th-at-bell.html#BELL-07'));
    await page.goto(base + '/phoenix/comparisons.html#comparison-capital-fund-amounts');
    await page.getByRole('searchbox').fill('no-comparison-9382');
    assert(await page.locator('#connection-empty').isVisible());
    await page.getByRole('button', {name: 'Clear filters'}).click();
    await page.locator('#connection-filter').selectOption('capital', {force:true});
    assert.equal(await page.locator('[data-connection-entry]:visible').count(), 1);
    assert((await page.locator('#comparison-capital-fund-amounts').textContent()).includes('not a Phoenix transaction date'));
    if (width === 1280) {
      await page.evaluate(() => document.body.style.zoom = '2');
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), 'comparison 200% zoom');
    }
    for (const path of ['index.html', 'capital-fund.html', 'projects/25th-at-bell.html']) {
      await page.goto(base + '/phoenix/' + path);
      assert.equal(await page.locator('main h1').count(), 1);
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `existing page overflow ${path} at ${width}`);
      if(path==='index.html'){
        assert(await page.locator('.city-hero-date').isVisible(),'overview date is visible before opening the full research');
        await page.locator('.city-evidence-library>summary').click();
      }
      const reading = await page.locator('.record-text').first().evaluate(el => ({font: parseFloat(getComputedStyle(el).fontSize), line: parseFloat(getComputedStyle(el).lineHeight)}));
      assert(reading.font >= 17 && reading.line >= reading.font * 1.6, `reading typography ${path}`);
      assert(await page.locator('.claim-meta').first().isVisible(), 'scope and dates remain visible');
      const identifiers = page.locator('.technical-note').first();
      assert.equal(await identifiers.getAttribute('open'), null);
      await identifiers.locator('summary').focus();
      await page.keyboard.press('Enter');
      assert.notEqual(await identifiers.getAttribute('open'), null, 'technical identifiers open by keyboard');
      await page.keyboard.press('Enter');
      const locator = page.locator('.source-locator').first();
      await locator.locator('summary').focus();
      await page.keyboard.press('Enter');
      assert(await locator.locator('small').isVisible(), 'source locators remain accessible');
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      assert.notEqual(await identifiers.getAttribute('open'), null, 'identifiers expand for printing');
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      assert.equal(await identifiers.getAttribute('open'), null, 'closed screen notes restored after print');
      assert.notEqual(await locator.getAttribute('open'), null, 'already-open source note stays open');
      const navigation = page.getByRole('navigation', {name: 'Main navigation'});
      await openNavigation(page);
      assert.equal(await navigation.getByRole('link').count(), 7);
      await navigation.getByRole('link', {name: 'Projects'}).click();
      assert(page.url().endsWith('/phoenix/projects.html'));
    }
    await page.close();
    console.log(`PASS connected Phoenix pages at ${width}: directory scope, phase links, evidence matrix, filters and direct-link recovery.`);
  }
  const noJS = await browser.newPage({javaScriptEnabled: false});
  await noJS.goto(base + '/phoenix/records.html');
  assert.equal(await noJS.locator('.record-card:visible').count(), 90);
  assert(await noJS.locator('#record-filters').isHidden());
  await noJS.locator('#source-PHX-CFP-011 summary').first().click();
  assert(await noJS.locator('#source-PHX-CFP-011 .record-sources a').first().isVisible());
  assert(await noJS.locator('#source-PHX-CFP-011 .source-metadata').isVisible());
  for (const [path, count] of [['projects.html', 11], ['questions.html', 13], ['comparisons.html', 2]]) {
    await noJS.goto(base + '/phoenix/' + path);
    assert.equal(await noJS.locator('[data-connection-entry]:visible').count(), count);
    assert(await noJS.locator('.connection-filters').isHidden());
  }
  await noJS.close();
  console.log('PASS: all entries and source disclosures work without JavaScript.');
} finally {
  await browser?.close();
  server?.kill();
}
