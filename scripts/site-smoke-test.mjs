import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const tests = ['tucson/index.html','research-center.html','funding-explorer.html','housing-projects.html','questions-records.html','evidence.html'];
const failures = [];
const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
await mkdir('site-qa-screenshots',{recursive:true});
for (const width of [390,1280]) {
  const page = await browser.newPage({viewport:{width,height:800},deviceScaleFactor:1});
  await page.route(/^https?:/, route=>route.abort());
  const errors = [];
  page.on('pageerror',err=>errors.push(err.message));
  for(const path of tests) {
    const url=pathToFileURL(resolve(path)).href;
    const response=await page.goto(url,{waitUntil:'load'});
    const metrics=await page.evaluate(()=>({
      documentWidth:document.documentElement.scrollWidth,
      viewportWidth:document.documentElement.clientWidth,
      headingCount:document.querySelectorAll('h1').length,
      mainCount:document.querySelectorAll('main').length,
      researchLink:!!document.querySelector('nav a[href$="research-center.html"]')
    }));
    if(metrics.documentWidth>metrics.viewportWidth+2)failures.push(`${path} horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
    if(metrics.headingCount!==1||metrics.mainCount!==1||!metrics.researchLink) failures.push(`${path} unexpected page structure ${JSON.stringify(metrics)}`);
    if(errors.length)failures.push(`${path} JS errors ${errors.join('; ')}`);
    await page.screenshot({path:`site-qa-screenshots/${path.replaceAll('/','-').replace('.html','')}-${width}.png`,fullPage:true});
    console.log('Rendered',path,width,JSON.stringify(metrics));
  }
  for(const path of ['funding-explorer.html','housing-projects.html','questions-records.html']) {
    await page.goto(pathToFileURL(resolve(path)).href);
    const cards=page.locator('[data-catalog-entry]'),before=await cards.count();
    await page.locator('#catalog-search').fill('definitely-not-in-the-research-records');
    const shown=await cards.filter({visible:true}).count();
    if(shown!==0||await page.locator('#catalog-empty').isHidden())failures.push(`${path}: search filter not hiding all cards`);
    await page.locator('#catalog-search').fill('');
    if(await cards.filter({visible:true}).count()!==before) failures.push(`${path}: clearing filter did not restore ${before} records`);
    await page.locator('#catalog-filter').selectOption({index:1});
    const filtered=await cards.filter({visible:true}).count();
    if(filtered===0||filtered>before) failures.push(`${path}: category filter returned wrong count ${filtered}/${before}`);
    console.log('Filter checks',path,JSON.stringify({before,filtered}));
  }
  await page.goto(pathToFileURL(resolve('research-center.html')).href);
  await page.locator('#search').fill('nonmatching-phrase-124124');
  if(await page.locator('#cards article').filter({visible:true}).count()!==0) failures.push('research-center search did not filter');
  await page.locator('#search').fill('');
  await page.getByRole('button',{name:'Housing Projects'}).click();
  const selected=await page.locator('#cards article').filter({visible:true}).count();
  if(selected!==1) failures.push('research center housing filter expected 1, got '+selected);
  console.log('Research Center filter at',width,'selected',selected);
  await page.goto(pathToFileURL(resolve('housing-projects.html')).href);
  if(await page.locator('.ev-tile').count()!==44 || await page.locator('.ev-tile-excluded').count()!==8 || await page.locator('.ev-tile-other').count()!==15) failures.push('Outcome tiles must preserve 44 total, 8 excluded and 15 other included exits');
  if(!await page.locator('.ev-definition').getByText('does not establish its cause',{exact:false}).count()) failures.push('Return definition and causal limitation missing');
  await page.goto(pathToFileURL(resolve('funding-explorer.html')).href);
  if(await page.locator('.ev-funding-card').count()!==3 || !(await page.locator('.ev-calc').innerText()).includes('$58,701,289 combined.')) failures.push('Funding cards or explicit HCV calculation missing');
  for(const path of ['housing-projects.html','funding-explorer.html','evidence.html']) {
    await page.goto(pathToFileURL(resolve(path)).href);
    if(await page.locator('.evidence-visual details,.evidence-visual select').count()) failures.push(path+': new visual modules must not add dropdowns');
  }
  await page.close();
}
await browser.close();
if(failures.length){console.error('FAILURES',failures);process.exitCode=1}
else console.log('PASS — browser rendering, overflow, navigation, and filtering at desktop and mobile viewport widths');
