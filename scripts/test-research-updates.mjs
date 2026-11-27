// One regression: inventory + synthetic growth, then five bounded browser checks.
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {execPDF} from './pdf-tools.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = '/tmp/hap-research-updates';
mkdirSync(output, {recursive: true});
execFileSync('python3', ['scripts/build-research-updates.py', '--check', '--fixture-test'], {cwd: root, stdio: 'inherit'});
const base = 'http://127.0.0.1:8797';
const server = spawn('python3', ['-m', 'http.server', '8797', '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const source = 'research-updates.html';
const current = 'pchip-qa-2026-11-24';
const older = 'county-housing-fy27-q1-2026-11-06';
const olderAnchor = 'one-pima-fy27-q1-version-comparison';
let browser;
const checks = [];
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { assert((await fetch(base + '/' + source)).ok); break; }
    catch (error) { if (attempt === 49) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  browser = await chromium.launch({headless: true,
    ...((process.env.CHROMIUM_PATH || existsSync('/usr/bin/chromium'))
      ? {executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium'} : {})});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, timezoneId: 'America/Phoenix'});
  await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  // 1. Phone layout: the front and static archive contain only six summary cards.
  for (const width of [320, 390]) {
    await page.setViewportSize({width, height: 844});
    for (const path of [source, 'research-updates-archive.html']) {
      await page.goto(base + '/' + path);
      assert.equal(await page.locator('[data-update-summary]:visible').count(), 6, path);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path + ' fits phone');
      if (path === source) assert.equal(await page.locator('.updates-content article:visible').count(), 0);
      await page.screenshot({path: `${output}/${path.replace('.html', '')}-${width}.png`, fullPage: true});
    }
  }
  checks.push('phone layout at 320/390 px');

  // 2. Keyboard: Tab reaches visible links, Enter opens the article, focus follows it.
  await page.goto(base + '/' + source);
  const first = page.locator('[data-update-summary]').first().locator('h2 a');
  for (let key = 0; key < 80; key++) {
    if (await first.evaluate(node => node === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  assert(await first.evaluate(node => node === document.activeElement), 'Summary reached with Tab');
  assert(await first.evaluate(node => getComputedStyle(node).outlineStyle !== 'none'), 'Visible focus');
  await page.keyboard.press('Enter');
  await page.waitForFunction(id => location.hash === '#' + id && document.activeElement.id === id, current);
  assert.equal(await page.evaluate(() => document.activeElement.id), current);
  assert(await page.locator('#' + current).isVisible());
  await page.locator('#updates-reading-tools a').first().press('Enter');
  await page.locator('#updates-recent').waitFor({state: 'visible'});
  assert.equal(await page.locator('[data-update-summary]:visible').count(), 6);
  checks.push('keyboard navigation and focus');

  // 3. Current deep link: approved P-CHIP body, deadline, both sources, single search entry.
  await page.goto(base + '/' + source + '#' + current);
  const currentArticle = page.locator('#' + current);
  assert(await currentArticle.isVisible());
  assert.equal(await page.locator('[data-update-summary]:visible').count(), 0);
  assert((await currentArticle.innerText()).includes('December 10, 2026, at 11:59 p.m. MST'));
  const inventory = JSON.parse(readFileSync(root + '_data/research_updates_inventory.json'));
  const saved = inventory.entries.find(entry => entry.id === current);
  assert.deepEqual(await currentArticle.locator('a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), saved.source_links);
  const index = JSON.parse(readFileSync(root + 'assets/search-index.js', 'utf8').split('window.HAP_SEARCH_INDEX=')[1].replace(/;\s*$/, ''));
  assert.equal(index.records.filter(record => record.url === source + '#' + current).length, 1);
  checks.push('current P-CHIP deep link');

  // 4. Older deep link; repeat the archive path with JavaScript disabled.
  await page.goto(base + '/' + source + '#' + olderAnchor);
  await page.waitForFunction(id => location.hash === '#' + id && document.activeElement.id === id, olderAnchor);
  assert(await page.locator('#' + older).isVisible());
  assert(await page.locator('#' + olderAnchor).isVisible(), 'Non-article legacy destination');
  assert.equal(await page.locator('.updates-content article:visible').count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement.id), olderAnchor);
  const nojs = await browser.newContext({javaScriptEnabled: false, viewport: {width: 390, height: 844}});
  await nojs.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  const fallback = await nojs.newPage();
  await fallback.goto(base + '/' + source);
  await fallback.getByRole('link', {name: 'Browse all research updates', exact: true}).click();
  let found = false;
  for (let count = 0; count < 8; count++) {
    const link = fallback.locator(`[data-update-summary="${older}"] h2 a`);
    if (await link.count()) { await link.click(); found = true; break; }
    await fallback.getByRole('link', {name: 'Older entries', exact: true}).first().click();
  }
  assert(found && fallback.url().endsWith('#' + older));
  assert(await fallback.locator('#' + older).isVisible(), 'Old article opens without JavaScript');
  await fallback.goto(base + '/' + source + '#' + olderAnchor);
  assert(await fallback.locator('#' + olderAnchor).isVisible(), 'Old non-article anchor opens without JavaScript');
  assert(await fallback.locator('#' + older).isVisible(), 'Non-article anchor reveals its exact containing article without JavaScript');
  await nojs.close();
  checks.push('older article and non-article deep links, plus archive without JavaScript');

  // 5. One full-article PDF: every substantive paragraph and source, no other article.
  const olderArticle = page.locator('#' + older);
  const paragraphs = await olderArticle.locator('h2,h3,h4,p,li,caption').evaluateAll(nodes => nodes.map(node => node.textContent));
  const tables = await olderArticle.locator('table').evaluateAll(nodes => nodes.map(table =>
    [...table.rows].map(row => [...row.cells].map(cell => cell.textContent))));
  const allSources = await olderArticle.locator('a[href]').evaluateAll(nodes => nodes.map(node =>
    new URL(node.getAttribute('href'), document.querySelector('link[rel="canonical"]').href).href).filter(url => url.startsWith('https://')));
  const originalDisclosure = await olderArticle.locator('details').evaluateAll(nodes => nodes.map(node => node.open));
  const pdf = output + '/full-article-with-sources.pdf';
  await page.pdf({path: pdf, format: 'Letter', printBackground: false, displayHeaderFooter: false});
  const audit = JSON.parse(execPDF('audit', [pdf], {encoding: 'utf8', maxBuffer: 20 * 1024 * 1024}));
  const pdfText = audit.pages.map(sheet => sheet.text).join(' ').replace(/\s+/g, ' ');
  const normalize = text => text.normalize('NFKC').replace(/\s/g, '');
  for (const paragraph of paragraphs.filter(text => text.trim().length > 35)) {
    assert(normalize(pdfText).includes(normalize(paragraph)), 'Full article paragraph retained: ' + paragraph.slice(0, 70));
  }
  // Wrapped table labels interleave with adjacent values in whole-page text.
  // Read each actual PDF column by word coordinates and require every cell in order.
  for (const rows of tables) {
    let located = false;
    for (const sheet of audit.pages) {
      const first = sheet.words.find(word => normalize(word[4]) === normalize(rows[0][0]));
      if (!first) continue;
      const headers = rows[0].map(label => sheet.words.find(word =>
        normalize(word[4]) === normalize(label) && Math.abs(word[1] - first[1]) < 2));
      if (headers.some(word => !word)) continue;
      for (let column = 0; column < headers.length; column++) {
        const words = sheet.words.filter(word => word[1] >= first[1] - 1 &&
          word[0] >= headers[column][0] - 2 &&
          (column === headers.length - 1 || word[0] < headers[column + 1][0] - 2));
        const actual = normalize(words.map(word => word[4]).join(' '));
        const expected = normalize(rows.map(row => row[column]).join(' '));
        assert(actual.startsWith(expected), 'Complete table cells and order in PDF column ' + (column + 1));
      }
      located = true;
      break;
    }
    assert(located, 'Table headers and all columns are present in the PDF');
  }
  const links = audit.pages.flatMap(sheet => sheet.links).map(link => link.uri).filter(Boolean);
  for (const url of allSources) assert(links.includes(url), 'Clickable source in PDF: ' + url);
  assert(!pdfText.includes('P-CHIP applicants:'), 'Only the selected full article prints');
  assert(audit.pages.every(sheet => sheet.text.trim().length > 25), 'No blank print sheets');
  assert.deepEqual(await olderArticle.locator('details').evaluateAll(nodes => nodes.map(node => node.open)), originalDisclosure, 'Disclosures restored after print');
  checks.push('one full article print with all source links');
  assert.deepEqual(errors, []);
  writeFileSync(output + '/results.json', JSON.stringify({checks, browser: browser.version(), pdfPages: audit.pages.length}, null, 2) + '\n');
  console.log('PASS Research Updates: ' + checks.join('; '));
} finally {
  await browser?.close();
  server.kill();
}
