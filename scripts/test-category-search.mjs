import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.CATEGORY_TEST_BASE_URL||'http://127.0.0.1:8767';
const server=process.env.CATEGORY_TEST_BASE_URL?null:spawn('python3',['-m','http.server','8767','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const data=JSON.parse(readFileSync(new URL('../data/category-search.json',import.meta.url)));
const output='/tmp/hap-category-search';mkdirSync(output,{recursive:true});let browser;
try{
 for(let i=0;i<50;i++){try{assert((await fetch(base+'/search.html')).ok);break}catch(e){if(i===49)throw e;await new Promise(r=>setTimeout(r,100))}}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)});
 for(const width of [320,390,768,1280])for(const scope of ['tucson','phoenix']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await page.goto(base+(scope==='tucson'?'/search.html':'/phoenix/search.html'));await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('main').count(),1);assert.equal(await page.locator('h1').count(),1);
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),`${scope} overflow ${width}`);
  assert.equal(await page.locator('main select:visible').count(),1);
  const initialRequests=requests.length;
  for(const category of ['funding','sources','questions','updates']){
   await page.locator(`[data-category="${category}"]`).click();
   const expected=data.records.filter(r=>r.scope===scope&&r.category===category);
   assert((await page.locator('#count').textContent()).startsWith(expected.length+' match'));
   assert.equal(await page.locator('#results article.card').count(),Math.min(6,expected.length));
   assert.equal(await page.locator('main select:visible').count(),1);
   await page.locator('#query').fill('no-record-439623');assert(await page.locator('#empty').isVisible());assert(await page.locator('#print').isDisabled());assert(await page.locator('#print-compact').isDisabled());
   await page.locator('#empty-reset').click();assert.equal(await page.locator('#query').inputValue(),'');
   if(expected.length>6){await page.locator('#next').click();assert((await page.locator('#page-count').textContent()).startsWith('Page 2'));await page.locator('#previous').click()}
   for(const printButton of ['#print-compact','#print']){await page.locator(printButton).click();assert.equal(await page.locator('#print-sheet .print-record').count(),expected.length);assert(await page.locator('main').isHidden());
   await page.getByRole('button',{name:'← Back to search',exact:true}).click();assert(await page.locator('main').isVisible());assert.equal(await page.locator('#print-sheet .print-record').count(),0);}
  }
  await page.locator('[data-category="funding"]').click();await page.locator('#category-filter').selectOption('__unindexed');assert((await page.locator('#results').textContent()).includes('Active period: not yet verified'));
  await page.locator('[data-category="sources"]').click();assert.equal(await page.locator('#category-filter').inputValue(),'');
  await page.locator('#query').fill('<img src=x onerror=alert(1)>');assert.equal(await page.locator('#results article').count(),0);assert.equal(await page.locator('#results img').count(),0);await page.locator('#reset').click();
  assert.deepEqual(requests.slice(initialRequests),[],'Local-only search');assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(errors,[]);
  if(width===1280){
   await page.locator('[data-category="funding"]').click();const expected=data.records.filter(r=>r.scope===scope&&r.category==='funding');
   for(const mode of ['compact','full']){await page.locator(mode==='compact'?'#print-compact':'#print').click();await page.pdf({path:`${output}/${scope}-funding-${mode}.pdf`,format:'Letter',printBackground:false,tagged:true});
   const text=execFileSync('pdftotext',[`${output}/${scope}-funding-${mode}.pdf`,'-'],{encoding:'utf8'}).replace(/\s+/g,' ');
   assert(text.includes(expected.length+' matching records'));for(const r of expected)assert(text.includes('Record ID: '+r.id),`PDF retains ${r.id}`);
   if(scope==='tucson'&&mode==='compact'){for(const amount of ['$4,962,047','$3,061,840.81','$448,998','$1,140,597','$9,613,482.81'])assert(text.includes(amount),'Allocation amount retained '+amount);assert(text.includes('https://'),'Source references retained')}assert(text.includes('Active period: not yet verified'));assert(text.includes('Known source / event dates'));assert(!text.includes('working preview'));
   await page.getByRole('button',{name:'← Back to search',exact:true}).click();}
   if(scope==='tucson'){
    await page.locator('[data-category="sources"]').click();await page.locator('#query').fill('SRC-100');
    assert(await page.locator('#results a[href*="/downloads/8800?"]').count());
    for(const mode of ['compact','full']){await page.locator(mode==='compact'?'#print-compact':'#print').click();await page.pdf({path:`${output}/src100-${mode}.pdf`,format:'Letter',printBackground:false,tagged:true});
    const text=execFileSync('pdftotext',[`${output}/src100-${mode}.pdf`,'-'],{encoding:'utf8'});assert(text.includes('Solera'));assert(text.includes('/8800?'));assert(text.includes('/8818?'));
    await page.getByRole('button',{name:'← Back to search',exact:true}).click();}
   }
  }
  await page.screenshot({path:`${output}/${scope}-${width}.png`,fullPage:true});await page.close();console.log(`PASS category search ${scope} ${width}: all categories, single selector, empty/reset, pagination, all-match print/return, no query transmission or storage.`);
 }
 console.log('PASS Chromium Letter PDFs: both Funding categories and SRC-100; every matching ID, evidence URLs, dates and limits retained.');
}finally{await browser?.close();server?.kill()}
