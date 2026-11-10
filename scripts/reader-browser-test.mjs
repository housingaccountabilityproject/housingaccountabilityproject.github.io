import {chromium} from 'playwright';
import {localPageUrl,routeLocalRequest} from './browser-test-url.mjs';
import {mkdir,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {assertReaderContrast} from './reader-contrast.mjs';
import {openNavigation} from './browser-navigation.mjs';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
await mkdir('reader-qa-screenshots',{recursive:true});
const pages=(await readdir('.')).filter(p=>p.endsWith('.html')&&!p.startsWith('google')).concat('reports/tucson-housing-funding-outcomes-2026.html','tucson/index.html','phoenix/index.html','phoenix/capital-fund.html','phoenix/projects/25th-at-bell.html');
try {
for(const width of [390,768,1280]) {
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Never send local QA traffic or search tests to analytics/external hosts.
 await page.route(/^https?:/,routeLocalRequest);
 for(const file of pages){
  await page.goto(localPageUrl(file));
  await assertReaderContrast(page,`${file} at ${width}`);
  const info=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length}));
  assert(!info.overflow,`${file} overflow at ${width}`);assert.equal(info.h1,1);assert.equal(info.main,1);
 }
 await page.goto(localPageUrl('search.html'));
 await page.getByLabel('Search Tucson & Pima County research',{exact:true}).fill('F-007');await page.getByRole('button',{name:'Search',exact:true}).click();
 assert((await page.locator('#search-results article').count())>0);
 await page.screenshot({path:`reader-qa-screenshots/search-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Clear',exact:true}).click();assert.equal(await page.locator('#site-query').inputValue(),'');
 await page.locator('#site-query').fill('impossible-match-947362');await page.locator('#site-query').press('Enter');assert.equal(await page.locator('#search-results article').count(),0);
 await page.getByRole('button',{name:'Clear',exact:true}).click();await page.locator('#site-query').fill('CDBG');await page.locator('#site-query').press('Enter');
 await page.getByRole('button',{name:'Show More Results'}).click();assert((await page.locator('#search-results article').count())>20);
 await page.goto(localPageUrl('research-updates.html')+'#current-research-status');await page.screenshot({path:`reader-qa-screenshots/status-${width}.png`});
 const closed=page.locator('.topic-status details').filter({has:page.getByText('Allocations and Final Reporting',{exact:true})});await closed.locator('summary').click();assert(await closed.getAttribute('open')!==null);await closed.locator('summary').click();assert.equal(await closed.getAttribute('open'),null);
 await page.goto(localPageUrl('tucson/index.html'));
 assert(await page.locator('.city-landscape img').isVisible());
 assert(await page.locator('.city-hero-date').isVisible());
 await page.locator('.city-about > summary').click();
 const slogan=page.locator('.city-about .hero-slogan');
 assert.equal(await slogan.textContent(),'Public Funding Deserves Public Understanding');
 assert.equal(await slogan.evaluate(el=>getComputedStyle(el).fontStyle),'italic');
 assert.equal(await page.locator('header .hero-slogan').count(),0);
 const sloganBox=await slogan.boundingBox();
 assert(sloganBox.x>=0&&sloganBox.x+sloganBox.width<=width,`scope notes stay in viewport at ${width}`);
 await page.locator('.city-about > summary').click();
 await page.screenshot({path:`reader-qa-screenshots/home-nov7-${width}.png`,fullPage:true});
 await page.locator('.city-evidence-library > summary').click();
 const homeAnchors=await page.locator('.page-jump a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
 assert(homeAnchors.every(href=>href.startsWith('#')));
 assert.equal(await page.locator('#latest-updates > ol > li').count(),6);
 assert.equal(await page.locator('#correction-history > ol > li').count(),3);
 for(const href of homeAnchors){await page.locator(`.page-jump a[href="${href}"]`).click();assert(page.url().endsWith(href));assert.equal(await page.locator(href).count(),1);}
 await page.goto(localPageUrl('tucson/index.html'));

 await page.locator('.city-evidence-library > summary').click();
 await page.locator('#latest-updates > ol > li').first().getByRole('link').click();
 assert(page.url().endsWith('#craycroft-council-vote-2026-11-09'));
 assert(await page.locator('#craycroft-council-vote-2026-11-09').isVisible());
 assert((await page.locator('#craycroft-council-vote-2026-11-09').textContent()).includes('6–0 vote adopting Resolution 24206'));
 assert((await page.locator('#craycroft-council-vote-2026-11-09').textContent()).includes('does not establish bond closing'));
 await page.goto(localPageUrl('research-updates.html')+'#county-housing-funding-2026-11-08');
 assert(page.url().endsWith('#county-housing-funding-2026-11-08'));
 assert.equal(await page.locator('#county-housing-funding-2026-11-08 h3').count(),3);
 const countyText=await page.locator('#county-housing-funding-2026-11-08').textContent();
 for(const phrase of ['$2,986,331','$78,172.27','This is not a measure of County spending.','August 2026'])assert(countyText.includes(phrase));
 await page.screenshot({path:`reader-qa-screenshots/update-nov8-${width}.png`,fullPage:true});
 await page.goto(localPageUrl('research-updates.html')+'#payments-projects-outcomes-2026-11-07');
 assert.equal(await page.locator('#payments-projects-outcomes-2026-11-07 h3').count(),5);
 assert((await page.locator('#payments-projects-outcomes-2026-11-07').textContent()).includes('$58,701,289'));
 await page.screenshot({path:`reader-qa-screenshots/update-nov7-${width}.png`,fullPage:true});
 await page.goto(localPageUrl('evidence.html'));
 assert((await page.locator('#counts').textContent()).includes('67 source rows and 20 question rows'));
 for(const [period,id] of [['FY2024','src-114'],['FY2025','src-108']]){
  await page.locator('#period').selectOption(period);
  assert(await page.locator('#'+id).isVisible());
  assert.equal(await page.locator('.source-row:visible').count(),1);
 }
 await page.getByRole('button',{name:'Clear',exact:false}).click();
 const crosswalk=page.locator('#source-id-crosswalk details');
 await crosswalk.locator('summary').click();
 assert.equal(await crosswalk.locator('tbody tr').count(),67);
 assert(await crosswalk.locator('table').isVisible());
 await page.screenshot({path:`reader-qa-screenshots/crosswalk-${width}.png`,fullPage:true});
 await crosswalk.locator('summary').click();
 assert.equal(await crosswalk.getAttribute('open'),null);
 await page.locator('#search').fill('AVP');
 assert(await page.locator('#q-020').isVisible());
 await page.getByRole('button',{name:'Clear',exact:false}).click();
 assert((await page.locator('#counts').textContent()).includes('67 source rows and 20 question rows'));
 assert.deepEqual(errors,[]);await page.close();
}
// The overview title must remain readable and reflow without clipping at 200% zoom.
for(const {width,zoom} of [{width:320,zoom:1},{width:1280,zoom:1},{width:1280,zoom:2},{width:640,zoom:1}]) {
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route(/^https?:/,routeLocalRequest);
 await page.goto(localPageUrl('tucson/index.html'));
 if(zoom!==1)await page.evaluate(z=>{document.body.style.zoom=String(z)},zoom);
 const heading=page.getByRole('heading',{level:1});
 assert.equal((await heading.innerText()).replace(/\s+/g,' ').trim(),'Tucson & Pima County');
 const metrics=await heading.evaluate(el=>{
  const box=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);
  return {font:parseFloat(getComputedStyle(el).fontSize),color:getComputedStyle(el).color,
   overflow:document.documentElement.scrollWidth>innerWidth+2,
   clipped:[...range.getClientRects()].some(r=>r.left<box.left-1||r.right>box.right+1||r.bottom>box.bottom+1),
   lines:new Set([...range.getClientRects()].filter(r=>r.width>0).map(r=>Math.round(r.top))).size};
 });
 assert(!metrics.overflow,`Home overflow at ${width}, zoom ${zoom}`);
 assert(!metrics.clipped,`Heading clipped at ${width}, zoom ${zoom}`);
 assert(metrics.font>=34);assert.equal(metrics.color,'rgb(24, 56, 60)');
 if(width===1280&&zoom===1)assert(metrics.lines>=1&&metrics.lines<=3,'City heading fits the overview');
 await page.screenshot({path:`reader-qa-screenshots/home-heading-${width}-zoom-${zoom}.png`,fullPage:true});
 await openNavigation(page);
 const more=page.locator('nav .city-more'),summary=more.locator('summary');
 await summary.focus();await page.keyboard.press('Enter');assert.notEqual(await more.getAttribute('open'),null);
 await page.keyboard.press('Enter');assert.equal(await more.getAttribute('open'),null);
 await summary.click();await more.getByRole('link',{name:'Findings',exact:true}).click();
 assert(page.url().endsWith('/findings.html'));await page.goBack();assert(page.url().endsWith('/index.html'));
 console.log('Homepage heading and keyboard navigation',JSON.stringify({width,zoom,...metrics}));
 await page.close();
}
console.log('PASS: all pages desktop/tablet/mobile overflow/landmarks, reader-panel text contrast, search flows, details, homepage 320px reflow and 200% CSS zoom, screenshots and no JS errors.');
} finally {await browser.close();}
