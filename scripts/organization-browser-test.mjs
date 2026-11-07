import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const pages=(await readdir('.')).filter(p=>p.endsWith('.html')&&!p.startsWith('google')).concat('reports/tucson-housing-funding-outcomes-2026.html');
const url=file=>pathToFileURL(resolve(file)).href;
await mkdir('organization-qa-screenshots',{recursive:true});
execFileSync('python',['scripts/build-review-preview.py'],{stdio:'inherit'});
try{
for(const {width,zoom} of [{width:320,zoom:1},{width:390,zoom:1},{width:1280,zoom:1},{width:1280,zoom:2}]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,route=>route.abort());
 for(const file of pages){
  await page.goto(url(file));
  if(zoom!==1)await page.evaluate(z=>document.body.style.zoom=String(z),zoom);
  assert.equal(await page.locator('main h1').count(),1,`${file}: title inside main`);
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)),`${file}: overflow ${width}/${zoom}`);
  await page.keyboard.press('Tab');assert(await page.locator('a.skip').evaluate(el=>document.activeElement===el),`${file}: first tab skip link`);
  await page.keyboard.press('Enter');assert(await page.locator('main').evaluate(el=>document.activeElement===el),`${file}: skip moves focus to main`);
  for(const region of await page.locator('.table-wrap,.table-scroll').all()){
   assert.equal(await region.getAttribute('tabindex'),'0');assert.equal(await region.getAttribute('role'),'region');assert(await region.getAttribute('aria-label'));
   // Historical tables can be inside a collapsed disclosure. Open it by keyboard first.
   for(const disclosure of await region.locator('xpath=ancestor::details').all()){
    if(await disclosure.getAttribute('open')===null){await disclosure.locator(':scope > summary').focus();await page.keyboard.press('Enter');assert.notEqual(await disclosure.getAttribute('open'),null);}
   }
   assert(await region.isVisible(),`${file}: table region visible after opening disclosure`);
   const before=await region.evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+2,x:el.scrollLeft}));
   if(before.overflow){await region.focus();assert(await region.evaluate(el=>document.activeElement===el));await page.keyboard.press('ArrowRight');await page.waitForTimeout(350);assert(await region.evaluate(el=>el.scrollLeft)>before.x,`${file}: arrow-key table scroll for ${await region.getAttribute('aria-label')}`);}
  }
  await page.screenshot({path:`organization-qa-screenshots/${file.replaceAll('/','-').replace('.html','')}-${width}-zoom-${zoom}.png`,fullPage:false});
 }
 // Register filtering, direct old aliases, repeated links and browser history.
 await page.goto(url('questions-records.html'));
 const aliases={'project-cost-table-2026':'q-018','housing-first-reallocation-2026':'q-019','unnamed-coc-decisions-2026':'q-020'};
 for(const [alias,canonical] of Object.entries(aliases)){
  assert.equal(await page.locator(`#${canonical} #${alias}`).count(),1);
  await page.locator('#catalog-search').fill('no-record-983489');
  assert(await page.locator('#'+canonical).isHidden());
  await page.evaluate(a=>location.hash=a,alias);await page.waitForTimeout(100);
  assert(await page.locator('#'+canonical).isVisible(),`${alias}: reveals canonical entry`);
  assert.equal(await page.locator('#catalog-search').inputValue(),'');
 }
 await page.goBack();assert(page.url().endsWith('#housing-first-reallocation-2026'));assert(await page.locator('#q-019').isVisible());
 await page.goForward();assert(page.url().endsWith('#unnamed-coc-decisions-2026'));assert(await page.locator('#q-020').isVisible());
 // The same hash does not fire hashchange; a repeated in-page link must still reveal it.
 await page.locator('#catalog-search').fill('no-record-983489');
 await page.evaluate(()=>{const a=document.createElement('a');a.href='#unnamed-coc-decisions-2026';a.id='repeat-alias-test';a.textContent='Return to the same question';document.querySelector('.section-links').append(a);});
 await page.locator('#repeat-alias-test').click();await page.waitForTimeout(100);assert(await page.locator('#q-020').isVisible());assert.equal(await page.locator('#catalog-search').inputValue(),'');
 for(const file of ['funding-explorer.html','housing-projects.html','questions-records.html']){
  await page.goto(url(file));const cards=page.locator('[data-catalog-entry]');const n=await cards.count();
  await page.locator('#catalog-filter').selectOption({index:1});await page.locator('#catalog-search').fill('no-record-983489');assert(await page.locator('#catalog-empty').isVisible());
  await page.locator('#catalog-search').fill('');await page.locator('#catalog-filter').selectOption('');assert.equal(await cards.filter({visible:true}).count(),n);
  for(const link of await page.locator('.section-links a').all()){const href=await link.getAttribute('href');await link.click();assert(page.url().endsWith(href));}
  await page.screenshot({path:`organization-qa-screenshots/${file.replace('.html','')}-${width}-full.png`,fullPage:true});
 }
 // The three entry journeys and housing-help route remain explicit and usable.
 for(const destination of ['funding-explorer.html','housing-projects.html','questions-records.html']){
  await page.goto(url('index.html'));await page.locator(`.question-paths a[href="${destination}"]`).click();assert(page.url().endsWith('/'+destination));await page.goBack();assert(page.url().endsWith('/index.html'));
 }
 await page.locator('.reader-tools a[href="housing-help.html"]').click();assert(page.url().endsWith('/housing-help.html'));
 assert.deepEqual(errors,[]);await page.close();console.log('PASS organization browser',JSON.stringify({width,zoom,pages:pages.length}));
}
// Validate the deliverable itself, not just its source pages.
const preview=await browser.newPage({viewport:{width:1280,height:900}});await preview.route(/^https?:/,route=>route.abort());
await preview.goto(url('organization-qa-screenshots/HAP-organization-review.html'));
const embedded=preview.frameLocator('#site-preview');await embedded.locator('h1').waitFor();
await preview.locator('[data-page="questions-records.html"]').click();await embedded.locator('#catalog-search').fill('no-record-983489');assert(await embedded.locator('#catalog-empty').isVisible());await embedded.locator('#catalog-search').fill('');
await preview.locator('[data-page="search.html"]').click();await embedded.getByLabel('Search the Website',{exact:true}).fill('F-007');await embedded.getByRole('button',{name:'Search',exact:true}).click();assert((await embedded.locator('#search-results article').count())>0);
await preview.locator('[data-page="index.html"]').click();await embedded.locator('.question-paths a[href="housing-projects.html"]').click();await embedded.locator('#catalog-search').waitFor();assert((await preview.locator('#current-page').textContent()).includes('housing-projects.html'));
await preview.locator('[data-width="390"]').click();assert.equal(Math.round((await preview.locator('#site-preview').boundingBox()).width),390);
await preview.screenshot({path:'organization-qa-screenshots/review-artifact-390.png'});await preview.close();console.log('PASS: offline preview navigation, filters, search and mobile-width controls.');
}finally{await browser.close();}
