import {execPDF} from './pdf-tools.mjs';
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {existsSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.PRINT_TEST_BASE_URL || 'http://127.0.0.1:8766';
const output = process.env.PRINT_TEST_OUTPUT || '/tmp/hap-search-print';
mkdirSync(output, {recursive: true});
const server = process.env.PRINT_TEST_BASE_URL ? null : spawn('python3', ['-m', 'http.server', '8766', '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
let browser;
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { assert((await fetch(base + '/search-all.html')).ok); break; }
    catch (error) { if (attempt === 39) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  // Substitute the OS dialog only; exercise the real button and beforeprint handler.
  async function clickPrint() {
    await page.evaluate(() => { window.print = () => { window.dispatchEvent(new Event('beforeprint')); }; });
    await page.getByRole('button', {name: 'Print search results', exact: true}).click();
    await page.emulateMedia({media: 'print'});
  }
  async function finishPrint() {
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({media: 'screen'});
    assert.equal(await page.locator('#search-print-output').count(), 0);
    assert(!await page.locator('body').evaluate(el => el.classList.contains('printing-search-results')));
  }
  async function savePDF(name) {
    const path = `${output}/${name}.pdf`;
    await page.pdf({path, format: 'Letter', printBackground: false, tagged: true});
    // The print engine fires afterprint when PDF rendering completes.
    return execPDF('pdftotext', [path, '-'], {encoding: 'utf8'}).replace(/\s+/g, ' ');
  }

  await page.goto(base + '/search-all.html');
  assert(await page.getByRole('button', {name: 'Print search results'}).isDisabled());
  await page.getByLabel('Search Tucson & Pima County research', {exact: true}).fill('CDBG');
  await page.getByRole('button', {name: 'Search', exact: true}).click();
  const expected = Number((await page.locator('#search-status').textContent()).match(/^(\d+)/)[1]);
  assert(expected > 20);
  assert.equal(await page.locator('#search-results article:not([hidden])').count(), 6);
  const statusBefore = await page.locator('#search-status').textContent();
  await page.getByRole('button', {name: 'Preview print results', exact: true}).click();
  assert.equal(await page.locator('#search-print-output article').count(), expected);
  assert.equal(await page.locator('#search-results article:not([hidden])').count(), 6);
  assert(await page.getByRole('button', {name: 'Return to results'}).isVisible());
  await page.getByRole('button', {name: 'Return to results'}).click();
  assert.equal(await page.locator('#search-print-output').count(), 0);
  assert.equal(await page.locator('#search-results article:not([hidden])').count(), 6);

  // Unsubmitted edits must not relabel the results being printed.
  await page.getByLabel('Search Tucson & Pima County research', {exact: true}).fill('not-the-submitted-query');
  await clickPrint();
  assert.equal(await page.locator('#search-print-output article').count(), expected);
  assert(!(await page.locator('#search-print-output').textContent()).includes('Search: CDBG'),'Typed terms are omitted by default');
  assert.equal(await page.locator('#search-print-output .historical-result .result-caution').count(), await page.locator('#search-print-output .historical-result').count());
  assert(await page.locator('#site-search-form').isHidden());
  assert.equal(await page.locator('#search-results article:not([hidden])').count(), 6);
  const tucsonPDF = await savePDF('tucson-search-results');
  assert(tucsonPDF.includes('Tucson & Pima County search results'));
  assert(tucsonPDF.includes(`${expected} matching results`));
  assert(tucsonPDF.includes('Historical entry.'));
  assert(tucsonPDF.includes('https://housingaccountabilityproject.github.io/'));
  assert(!tucsonPDF.includes(base), 'printed references should use public canonical URLs');
  await finishPrint();
  assert.equal(await page.locator('#search-status').textContent(), statusBefore);
  assert.equal(await page.locator('#search-results article:not([hidden])').count(), 6);
  await page.locator('#broader-next').click();
  assert.match(await page.locator('#broader-page').textContent(),/^Page 2/);
  assert.equal(await page.locator('#search-results article:not([hidden])').count(),6);
  await page.getByRole('button', {name: 'Clear', exact: true}).click();
  assert(await page.getByRole('button', {name: 'Print search results'}).isDisabled());
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.locator('#search-print-output article').count(), 0, 'clearing must not print stale results');
  await finishPrint();
  await page.locator('#search-category').selectOption('Findings');
  const categoryMatches = Number((await page.locator('#search-status').textContent()).match(/^(\d+)/)[1]);
  await clickPrint();
  assert.equal(await page.locator('#search-print-output article').count(), categoryMatches);
  assert((await page.locator('#search-print-output').textContent()).includes('Pages: Findings'));
  await finishPrint();
  console.log(`PASS Tucson: ${expected} results printed beyond the first six; PDF text, historical cautions, submitted filters and unchanged screen pagination.`);

  await page.goto(base + '/phoenix/records.html');
  await page.getByRole('button', {name: 'Funding', exact: true}).click();
  await page.locator('#record-kind').selectOption('expenditure', {force:true});
  const sourceDetails = page.locator('#PHX-CFP-WEB-004 details').first();
  assert.equal(await sourceDetails.getAttribute('open'), null);
  await clickPrint();
  assert.equal(await page.locator('#search-print-output > article').count(), 1);
  assert.equal(await page.locator('#search-print-output details:not([open])').count(), 0);
  assert((await page.locator('#search-print-output').textContent()).includes('Record type: Annual expenditure'));
  assert((await page.locator('#search-print-output').textContent()).includes('SEFA printed page 1'));
  assert(await page.locator('#record-filters').isHidden());
  assert.equal(await page.locator('#search-print-output #record-query').count(), 0);
  const phoenixPDF = await savePDF('phoenix-search-results');
  assert(phoenixPDF.includes('7,218,862'));
  assert(phoenixPDF.includes('SEFA printed page 1'));
  assert(phoenixPDF.includes('PHX-CITY-027'));
  assert(phoenixPDF.includes('not a cash-flow'));
  assert(!phoenixPDF.includes('2,813,904'));
  await finishPrint();
  assert.equal(await page.locator('#record-kind').inputValue(), 'expenditure');
  assert.equal(await page.locator('.record-card:visible').count(), 1);
  assert.equal(await sourceDetails.getAttribute('open'), null);
  await page.getByRole('button', {name: 'Sources', exact: true}).click();
  await page.locator('#source-agency').selectOption('hud');
  await page.locator('#source-program').selectOption('capital-fund');
  await page.locator('#source-format').selectOption('award-schedule');
  await page.locator('#source-year').selectOption('2026');
  await page.getByRole('searchbox').fill('PHX-CFP-011');
  await clickPrint();
  assert.equal(await page.locator('#search-print-output > article').count(), 1);
  assert((await page.locator('#search-print-output').textContent()).includes('Grants!A218:D218'));
  assert((await page.locator('#search-print-output').textContent()).includes('Document type: Award schedule / workbook'));
  assert((await page.locator('#search-print-output').textContent()).includes('Reporting / event year: 2026'));
  const filteredSourcePDF = await savePDF('phoenix-source-filters');
  assert(filteredSourcePDF.includes('Agency / publisher: HUD'));
  assert(filteredSourcePDF.includes('Reporting / event year: 2026'));
  assert(filteredSourcePDF.includes('Grants!A218:D218'));
  assert(filteredSourcePDF.includes('2026-11-10'),'Print uses the canonical evidence-index snapshot');
  await finishPrint();
  assert.equal(await page.locator('#source-year').inputValue(), '2026');
  await page.getByRole('searchbox').fill('no-match-938476');
  assert(await page.getByRole('button', {name: 'Print search results'}).isDisabled());
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.locator('#search-print-output article').count(), 0);
  await finishPrint();
  console.log('PASS Phoenix: filtered funding and source reports retain source locators and caveats; no unmatched entries; screen filters and disclosures restored.');

  for (const [path, query, id] of [
    ['projects.html', 'Moreland', 'project-moreland'],
    ['questions.html', 'current deed', 'need-question-bell-03'],
    ['comparisons.html', 'ARPA', 'comparison-bell-arpa']
  ]) {
    await page.goto(base + '/phoenix/' + path);
    await page.getByRole('searchbox').fill(query);
    const expected = await page.locator('[data-connection-entry]:visible').count();
    assert(expected > 0);
    await clickPrint();
    assert.equal(await page.locator('#search-print-output > article').count(), expected);
    assert(!(await page.locator('#search-print-output').textContent()).includes(`Search: ${query}`),'Connection print does not expose typed terms by default');
    assert.equal(await page.locator('#search-print-output details:not([open])').count(), 0);
    if (path === 'comparisons.html') {
      const pdf = await savePDF('phoenix-source-comparison');
      for (const value of ['11 units', '16 ARPA units', '65% AMI', '40% AMI', '20 years']) assert(pdf.includes(value), value);
      assert(pdf.includes('An executed amendment has not been verified'));
    }
    await finishPrint();
    assert(await page.locator('#' + id).isVisible());
  }
  // Keyboard/system print invokes the same complete report without clicking a button.
  await page.goto(base + '/search-all.html');
  await page.getByLabel('Search Tucson & Pima County research', {exact: true}).fill('F-007');
  await page.getByRole('button', {name: 'Search', exact: true}).click();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert(await page.locator('#search-print-output article').count() > 0);
  await finishPrint();
  assert.deepEqual(errors, []);
  console.log(`PASS: Phoenix project/question reports and browser print events. PDF artifacts: ${output}`);
} finally {
  await browser?.close();
  server?.kill();
}
