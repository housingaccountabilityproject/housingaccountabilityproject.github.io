// Focused, non-deploying browser evidence from the real Pages build on this PR merge.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {chromium} from 'playwright';
import {execPDF} from './pdf-tools.mjs';

const expectedCard = '<article class="resource" id="resource-greater-vail-meals"><p class="tag">Independent-living support</p><h3>Greater Vail: home-delivered meals</h3><p>The <a href="https://resourcesvail.org/homebound-meals/">Greater Vail Homebound Meal Program</a> serves homebound adults age 60 and older within its service area in the Vail School District. For meal delivery inquiries or to check whether your address is served, call <a href="tel:15203382610">520-338-2610</a> or email <a href="mailto:foodbank@resourcesvail.org">foodbank@resourcesvail.org</a>.</p></article>';
const target = 'housing-help.html#resource-greater-vail-meals';
const links = ['https://resourcesvail.org/homebound-meals/', 'tel:15203382610', 'mailto:foodbank@resourcesvail.org'];
const expectedText = 'Independent-living support Greater Vail: home-delivered meals The Greater Vail Homebound Meal Program serves homebound adults age 60 and older within its service area in the Vail School District. For meal delivery inquiries or to check whether your address is served, call 520-338-2610 or email foodbank@resourcesvail.org .';
const expectedRecord = {url:target, page:'Tucson & Pima County housing help', title:'Greater Vail: home-delivered meals', category:'Other', text:expectedText, historical:false};
const output = '/tmp/hap-greater-vail';
const root = resolve('_site');
const norm = text => text.replace(/-(?:\r?\n)+(?=\S)/g, '-').replace(/\s+/g, ' ').trim();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {schema:'hap-greater-vail-browser/v1', status:'FAIL', checks:[], externalRequestsAllowed:false};
let server, browser;
async function check(name, fn) {
  try { await fn(); report.checks.push({name,status:'PASS'}); return true; }
  catch(error) { report.checks.push({name,status:'FAIL',blocker:String(error.stack||error)}); return false; }
}
function blocked(name, blocker) { report.checks.push({name,status:'NOT RUN',blocker}); }
const browserChecks = ['Rendered Vail card, anchor, links and responsive widths', 'Saved Vail PDF text and destinations', 'Single Vail search result and destination'];

try {
  await mkdir(output, {recursive:true});
  const head = execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim();
  const expected = process.env.HAP_EXPECTED_TEST_MERGE || process.env.GITHUB_SHA;
  assert.match(expected || '', /^[a-f0-9]{40}$/, 'An exact current PR test-merge SHA is required');
  assert.equal(head, expected, 'Browser evidence must match the requested test merge');
  report.testMerge = head;
  report.tree = execFileSync('git', ['rev-parse','HEAD^{tree}'], {encoding:'utf8'}).trim();
  const built = await readFile(resolve(root,'housing-help.html'));
  await check('Exact reviewed card in Pages output', async()=>assert(built.includes(Buffer.from(expectedCard)), 'Real Pages output must contain the exact reviewed card'));
  report.builtHousingHelpSHA256 = digest(built);

  server = createServer(async (request,response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      const file = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
      assert(file.startsWith(root + sep), 'Preview request outside built output');
      const data = await readFile(file);
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : file.endsWith('.json') ? 'application/json' : 'application/octet-stream';
      response.writeHead(200, {'Content-Type':type}); response.end(data);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { browser = await chromium.launch({headless:true}); }
  catch(error) { for(const name of browserChecks)blocked(name,'Chromium launch unavailable: '+String(error)); throw error; }
  report.chromiumVersion = browser.version();
  const context = await browser.newContext({viewport:{width:1280,height:900}});
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors=[]; page.on('pageerror', error => errors.push(String(error)));
  const card=page.locator('#resource-greater-vail-meals');
  await check(browserChecks[0], async()=>{
  await page.goto(base + '/' + target);
  assert.equal(await card.count(),1);
  assert.equal(await card.evaluate(node=>node.outerHTML),expectedCard);
  assert.deepEqual(await card.locator('a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))),links);
  await card.scrollIntoViewIfNeeded(); assert(await card.isVisible());
  for(const width of [1280,390,320]) {
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), `Housing Help must fit ${width}px`);
    await card.scrollIntoViewIfNeeded(); assert(await card.isVisible());
  }
  });
  await check(browserChecks[1], async()=>{
  await page.goto(base + '/' + target);
  await page.setViewportSize({width:1280,height:900});
  const paragraphs=await card.locator('p,h3').allTextContents();
  const pdf=output+'/greater-vail-housing-help.pdf';
  await page.pdf({path:pdf,format:'Letter',printBackground:false,tagged:true});
  const audit=JSON.parse(execPDF('audit',[pdf],{encoding:'utf8',maxBuffer:16*1024*1024}));
  const pdfText=norm(audit.pages.map(page=>page.text).join(' '));
  for(const paragraph of paragraphs)assert(pdfText.includes(norm(paragraph)), 'Complete Vail card retained in saved PDF');
  const destinations=audit.pages.flatMap(page=>page.links).map(link=>link.uri).filter(Boolean);
  for(const link of links)assert(destinations.includes(link), 'Exact Vail PDF link: '+link);
  report.pdf={file:'greater-vail-housing-help.pdf',sha256:digest(await readFile(pdf)),links};
  });
  await check(browserChecks[2], async()=>{
  await page.goto(base+'/search-all.html');
  await page.locator('#site-query').fill('Greater Vail');
  await page.locator('#site-query').press('Enter');
  await page.locator('#search-results article').first().waitFor();
  assert.equal(await page.locator('#search-results article').count(),1);
  assert.deepEqual(await page.evaluate(target=>window.HAP_SEARCH_INDEX.records.filter(row=>row.url===target),target),[expectedRecord]);
  const result=page.locator('#search-results article');
  assert(norm(await result.textContent()).includes(expectedText), 'Rendered search result retains the exact indexed wording');
  const destination=result.locator('h2 a');
  assert.equal(await destination.getAttribute('href'),target);
  assert.equal(await destination.textContent(),expectedRecord.title);
  await destination.click(); await page.waitForURL(base+'/'+target);
  assert.equal(await card.evaluate(node=>node.outerHTML),expectedCard);
  });
  await check('No browser JavaScript errors', async()=>assert.deepEqual(errors,[]));
  report.status=report.checks.every(check=>check.status==='PASS')?'PASS':'FAIL';
  if(report.status!=='PASS')process.exitCode=1;
} catch(error) {
  report.blocker=String(error.stack||error); process.exitCode=1;
  for(const name of browserChecks)if(!report.checks.some(check=>check.name===name))blocked(name,report.blocker);
} finally {
  if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  await mkdir(output,{recursive:true});
  await writeFile(output+'/receipt.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
