import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const tests = ['index.html','research-center.html','funding-explorer.html','housing-projects.html','questions-records.html'];
const failures = [];
const browser = await chromium.launch({headless:true});
await mkdir('site-qa-screenshots',{recursive:true});
for (const width of [390,1280]) {
  const page = await browser.newPage({viewport:{width,height:800},deviceScaleFactor:1});
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
      researchLink:!!document.querySelector('nav a[href="research-center.html"]')
    }));
    if(metrics.documentWidth>metrics.viewportWidth+2)failures.push(`${path} horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
    if(metrics.headingCount!==1||metrics.mainCount!==1||!metrics.researchLink) failures.push(`${path} unexpected page structure ${JSON.stringify(metrics)}`);
    if(errors.length)failures.push(`${path} JS errors ${errors.join('; ')}`);
    await page.screenshot({path:`site-qa-screenshots/${path.replace('.html','')}-${width}.png`,fullPage:true});
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
  await page.getByRole('button',{name:'Housing projects'}).click();
  const selected=await page.locator('#cards article').filter({visible:true}).count();
  if(selected!==1) failures.push('research center housing filter expected 1, got '+selected);
  console.log('Research Center filter at',width,'selected',selected);
  await page.close();
}
await browser.close();
if(failures.length){console.error('FAILURES',failures);process.exitCode=1}
else console.log('PASS — browser rendering, overflow, navigation, and filtering at desktop and mobile viewport widths');
