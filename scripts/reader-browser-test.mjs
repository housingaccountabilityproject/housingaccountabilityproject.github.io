import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {assertReaderContrast} from './reader-contrast.mjs';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
await mkdir('reader-qa-screenshots',{recursive:true});
const pages=(await readdir('.')).filter(p=>p.endsWith('.html')&&!p.startsWith('google')).concat('reports/tucson-housing-funding-outcomes-2026.html');
try {
for(const width of [390,768,1280]) {
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Never send local QA traffic or search tests to analytics/external hosts.
 await page.route(/^https?:/,route=>route.abort());
 for(const file of pages){
  await page.goto(pathToFileURL(resolve(file)).href);
  await assertReaderContrast(page,`${file} at ${width}`);
  const info=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length}));
  assert(!info.overflow,`${file} overflow at ${width}`);assert.equal(info.h1,1);assert.equal(info.main,1);
 }
 await page.goto(pathToFileURL(resolve('search.html')).href);
 await page.getByLabel('Search the website',{exact:true}).fill('F-007');await page.getByRole('button',{name:'Search',exact:true}).click();
 assert((await page.locator('#search-results article').count())>0);
 await page.screenshot({path:`reader-qa-screenshots/search-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Clear',exact:true}).click();assert.equal(await page.locator('#site-query').inputValue(),'');
 await page.locator('#site-query').fill('impossible-match-947362');await page.locator('#site-query').press('Enter');assert.equal(await page.locator('#search-results article').count(),0);
 await page.getByRole('button',{name:'Clear',exact:true}).click();await page.locator('#site-query').fill('CDBG');await page.locator('#site-query').press('Enter');
 await page.getByRole('button',{name:'Show more results'}).click();assert((await page.locator('#search-results article').count())>20);
 await page.goto(pathToFileURL(resolve('research-updates.html')).href+'#current-research-status');await page.screenshot({path:`reader-qa-screenshots/status-${width}.png`});
 const closed=page.locator('.topic-status details:not([open])').first();await closed.locator('summary').click();assert(await closed.getAttribute('open')!==null);await closed.locator('summary').click();assert.equal(await closed.getAttribute('open'),null);
 await page.goto(pathToFileURL(resolve('index.html')).href);
 await page.screenshot({path:`reader-qa-screenshots/home-nov7-${width}.png`,fullPage:true});
 await page.locator('#latest-updates > ol > li').first().getByRole('link').click();
 assert(page.url().endsWith('#records-clarified-2026-11-07'));
 assert.equal(await page.locator('#records-clarified-2026-11-07 h3').count(),5);
 assert((await page.locator('#records-clarified-2026-11-07').textContent()).includes('$792,695'));
 await page.screenshot({path:`reader-qa-screenshots/update-nov7-${width}.png`,fullPage:true});
 await page.goto(pathToFileURL(resolve('evidence.html')).href);
 assert((await page.locator('#counts').textContent()).includes('49 source rows and 20 question rows'));
 await page.locator('#search').fill('AVP');
 assert(await page.locator('#q-020').isVisible());
 await page.getByRole('button',{name:'Clear',exact:false}).click();
 assert((await page.locator('#counts').textContent()).includes('49 source rows and 20 question rows'));
 assert.deepEqual(errors,[]);await page.close();
}
console.log('PASS: all pages desktop/tablet/mobile overflow/landmarks, reader-panel text contrast, search flows, details, screenshots and no JS errors.');
} finally {await browser.close();}
