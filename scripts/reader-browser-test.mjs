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
 await page.getByLabel('Search the Website',{exact:true}).fill('F-007');await page.getByRole('button',{name:'Search',exact:true}).click();
 assert((await page.locator('#search-results article').count())>0);
 await page.screenshot({path:`reader-qa-screenshots/search-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Clear',exact:true}).click();assert.equal(await page.locator('#site-query').inputValue(),'');
 await page.locator('#site-query').fill('impossible-match-947362');await page.locator('#site-query').press('Enter');assert.equal(await page.locator('#search-results article').count(),0);
 await page.getByRole('button',{name:'Clear',exact:true}).click();await page.locator('#site-query').fill('CDBG');await page.locator('#site-query').press('Enter');
 await page.getByRole('button',{name:'Show More Results'}).click();assert((await page.locator('#search-results article').count())>20);
 await page.goto(pathToFileURL(resolve('research-updates.html')).href+'#current-research-status');await page.screenshot({path:`reader-qa-screenshots/status-${width}.png`});
 const closed=page.locator('.topic-status details').filter({has:page.getByText('Allocations and Final Reporting',{exact:true})});await closed.locator('summary').click();assert(await closed.getAttribute('open')!==null);await closed.locator('summary').click();assert.equal(await closed.getAttribute('open'),null);
 await page.goto(pathToFileURL(resolve('index.html')).href);
 const slogan=page.locator('.hero h1 + .hero-slogan');
 assert.equal(await slogan.textContent(),'Public Funding Deserves Public Understanding');
 assert.equal(await slogan.evaluate(el=>getComputedStyle(el).fontStyle),'italic');
 assert.equal(await page.locator('header .hero-slogan').count(),0);
 const headlineBox=await page.locator('.hero h1').boundingBox(),sloganBox=await slogan.boundingBox();
 assert(sloganBox.y>=headlineBox.y+headlineBox.height,`slogan below headline at ${width}`);
 assert(sloganBox.x>=0&&sloganBox.x+sloganBox.width<=width,`slogan stays in viewport at ${width}`);
 await page.screenshot({path:`reader-qa-screenshots/home-nov7-${width}.png`,fullPage:true});
 const homeAnchors=await page.locator('.page-jump a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
 assert(homeAnchors.every(href=>href.startsWith('#')));
 assert.equal(await page.locator('#latest-updates > ol > li').count(),3);
 assert.equal(await page.locator('#correction-history > ol > li').count(),3);
 for(const href of homeAnchors){await page.locator(`.page-jump a[href="${href}"]`).click();assert(page.url().endsWith(href));assert.equal(await page.locator(href).count(),1);}
 await page.goto(pathToFileURL(resolve('index.html')).href);

 await page.locator('#latest-updates > ol > li').first().getByRole('link').click();
 assert(page.url().endsWith('#payments-projects-outcomes-2026-11-07'));
 assert.equal(await page.locator('#payments-projects-outcomes-2026-11-07 h3').count(),5);
 assert((await page.locator('#payments-projects-outcomes-2026-11-07').textContent()).includes('$58,701,289'));
 await page.screenshot({path:`reader-qa-screenshots/update-nov7-${width}.png`,fullPage:true});
 await page.goto(pathToFileURL(resolve('evidence.html')).href);
 assert((await page.locator('#counts').textContent()).includes('66 source rows and 20 question rows'));
 for(const [period,id] of [['FY2024','src-114'],['FY2025','src-108']]){
  await page.locator('#period').selectOption(period);
  assert(await page.locator('#'+id).isVisible());
  assert.equal(await page.locator('.source-row:visible').count(),1);
 }
 await page.getByRole('button',{name:'Clear',exact:false}).click();
 const crosswalk=page.locator('#source-id-crosswalk details');
 await crosswalk.locator('summary').click();
 assert.equal(await crosswalk.locator('tbody tr').count(),66);
 assert(await crosswalk.locator('table').isVisible());
 await page.screenshot({path:`reader-qa-screenshots/crosswalk-${width}.png`,fullPage:true});
 await crosswalk.locator('summary').click();
 assert.equal(await crosswalk.getAttribute('open'),null);
 await page.locator('#search').fill('AVP');
 assert(await page.locator('#q-020').isVisible());
 await page.getByRole('button',{name:'Clear',exact:false}).click();
 assert((await page.locator('#counts').textContent()).includes('66 source rows and 20 question rows'));
 assert.deepEqual(errors,[]);await page.close();
}
// The homepage title must reflow without reducing its existing font sizes.
for(const {width,zoom} of [{width:320,zoom:1},{width:1280,zoom:1},{width:1280,zoom:2},{width:640,zoom:1}]) {
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route(/^https?:/,route=>route.abort());
 await page.goto(pathToFileURL(resolve('index.html')).href);
 if(zoom!==1)await page.evaluate(z=>{document.body.style.zoom=String(z)},zoom);
 const heading=page.getByRole('heading',{level:1});
 assert.equal((await heading.innerText()).replace(/\s+/g,' ').trim(),'Where Do Housing Funds Go? What Do They Deliver?');
 const metrics=await heading.evaluate(el=>{
  const box=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);
  return {font:parseFloat(getComputedStyle(el).fontSize),color:getComputedStyle(el).color,
   overflow:document.documentElement.scrollWidth>innerWidth+2,
   clipped:[...range.getClientRects()].some(r=>r.left<box.left-1||r.right>box.right+1||r.bottom>box.bottom+1),
   lines:new Set([...range.getClientRects()].filter(r=>r.width>0).map(r=>Math.round(r.top))).size};
 });
 assert(!metrics.overflow,`Home overflow at ${width}, zoom ${zoom}`);
 assert(!metrics.clipped,`Heading clipped at ${width}, zoom ${zoom}`);
 assert(metrics.font>=34);assert.equal(metrics.color,'rgb(255, 255, 255)');
 if(width===1280&&zoom===1)assert.equal(metrics.lines,2,'Desktop headline should have two lines');
 await page.screenshot({path:`reader-qa-screenshots/home-heading-${width}-zoom-${zoom}.png`,fullPage:true});
 const more=page.locator('nav .more-nav'),summary=more.locator('summary');
 await summary.focus();await page.keyboard.press('Enter');assert.notEqual(await more.getAttribute('open'),null);
 await page.keyboard.press('Enter');assert.equal(await more.getAttribute('open'),null);
 await summary.click();await more.getByRole('link',{name:'Research Findings',exact:true}).click();
 assert(page.url().endsWith('/findings.html'));await page.goBack();assert(page.url().endsWith('/index.html'));
 console.log('Homepage heading and keyboard navigation',JSON.stringify({width,zoom,...metrics}));
 await page.close();
}
console.log('PASS: all pages desktop/tablet/mobile overflow/landmarks, reader-panel text contrast, search flows, details, homepage 320px reflow and 200% CSS zoom, screenshots and no JS errors.');
} finally {await browser.close();}
