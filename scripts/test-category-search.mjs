import {execPDF} from './pdf-tools.mjs';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.CATEGORY_TEST_BASE_URL||'http://127.0.0.1:8767';
const server=process.env.CATEGORY_TEST_BASE_URL?null:spawn('python3',['-m','http.server','8767','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const data=JSON.parse(readFileSync(new URL('../data/category-search.json',import.meta.url)));
const funding=JSON.parse(readFileSync(new URL('../data/funding-browser-periods.json',import.meta.url)));
const output=process.env.CATEGORY_TEST_OUTPUT||'/tmp/hap-category-search';
const categories=['funding','sources','questions','updates'];
const countText=n=>new RegExp('^'+n+' match');
const years=r=>r.category==='funding'?funding.records.find(x=>x.scope===r.scope&&x.id===r.id).programPeriod.years:r.years;
const focusOn=el=>el.evaluate(node=>node===document.activeElement);
const recordCount=(page,n)=>page.locator('#count').textContent().then(text=>assert.match(text,countText(n)));
const pdfOptions={
 format:'Letter',printBackground:false,tagged:true,timeout:90000,displayHeaderFooter:true,
 headerTemplate:'<div style="font-size:8px; padding-left:25px">HAP TEST HEADER</div>',
 footerTemplate:'<div style="font-size:8px; padding-left:25px">HAP TEST FOOTER</div>',
};
const printSearches={
 tucson:{category:'sources',query:'Craycroft',ids:[
  'SRC-064','SRC-078','SRC-089','SRC-100','SRC-076','SRC-092','SRC-098','SRC-099','SRC-125','source-excerpts',
 ]},
 phoenix:{category:'funding',query:'year:unknown',ids:[
  'PHX-WEB-009','PHX-WEB-010','PHX-WEB-012','PHX-CFP-WEB-003','PHX-CFP-WEB-007',
  'BELL-03','BELL-04','BELL-06','BELL-07','BELL-08','PHX-WEB-029','PHX-WEB-030',
 ]},
};
function pdfText(path){
 const pages=execPDF('pdftotext',[path,'-'],{encoding:'utf8',maxBuffer:8*1024*1024}).split('\f');
 if(pages.at(-1)==='')pages.pop();
 const evidence=pages.map((page,i)=>{
  const body=page.split('\n').filter(line=>!['HAP TEST HEADER','HAP TEST FOOTER'].includes(line.trim())).join('\n');
  assert(body.trim(),`${path} page ${i+1} has no record text`);
  return body;
 });
 return evidence.join(' ').replace(/\s+/g,' ');
}
const pdfLinks=path=>execPDF('pdfinfo',['-url',path],{encoding:'utf8',maxBuffer:8*1024*1024});
mkdirSync(output,{recursive:true});

async function inspectPDF(page, scope, category, mode, expected, suffix=''){
 const path=`${output}/${scope}-${category}-${mode}${suffix}.pdf`;
 await page.pdf({path,...pdfOptions});
 const text=pdfText(path);
 assert(text.includes(expected.length+' matching records'));
 for(const r of expected)assert(text.includes('Record ID: '+r.id),`PDF retains ${r.id}`);
 assert(!text.includes('working preview'));
 if(category==='funding'){
  assert(text.includes('Unknown / not established'));
  assert(text.includes('Known source / event dates'));
  if(scope==='tucson'){
   for(const amount of ['$4,962,047','$3,061,840.81','$448,998','$1,140,597','$9,613,482.81'])assert(text.includes(amount),'Allocation amount retained '+amount);
  }else{
   for(const fact of ['104 apartments','19 townhomes','$6 million','$2 million','$8 million','cash paid','people served','April 25, 2024','June 14, 2023','December 3, 2025','May 12, 2026'])assert(text.includes(fact),fact);
  }
 }
 if(scope==='phoenix'&&category==='sources'){
  for(const fact of ['450 existing','preservation','household outcomes','April 25, 2024'])assert(text.includes(fact),fact);
 }
 const source=expected.find(r=>r.correctedSourceUrl)||expected.find(r=>r.originals.length);
 if(source)assert(pdfLinks(path).includes(source.correctedSourceUrl||source.originals[0].url),'PDF has a clickable source link');
}

let browser;
try{
 for(let i=0;i<50;i++){
  try{assert((await fetch(base+'/search.html')).ok);break}
  catch(e){if(i===49)throw e;await new Promise(r=>setTimeout(r,100))}
 }
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)});
 for(const width of [320,390,768,1280])for(const scope of ['tucson','phoenix']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.context().route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  const path=scope==='tucson'?'/search.html':'/phoenix/search.html';
  await page.goto(base+path);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('main').count(),1);assert.equal(await page.locator('h1').count(),1);
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),`${scope} overflow ${width}`);
  assert.equal(await page.locator('main #category-filter:visible').count(),1);
  const initialRequests=requests.length;
  const input=page.locator('#query'),select=page.locator('#category-filter');
  for(const category of categories){
   const button=page.locator(`[data-category="${category}"]`);
   await button.press('Enter');
   assert.equal(await button.getAttribute('aria-pressed'),'true');
   const expected=data.records.filter(r=>r.scope===scope&&r.category===category);
   await recordCount(page,expected.length);
   assert.equal(await page.locator('#results article.card').count(),Math.min(6,expected.length));
   assert.equal(await page.locator('main #category-filter:visible').count(),1);
   const choice=await select.locator('option').nth(1).evaluate(el=>({value:el.value,count:Number(el.textContent.match(/\((\d+)\)$/)[1])}));
   await select.selectOption(choice.value);await recordCount(page,choice.count);
   await page.locator('#reset').press('Enter');assert(await focusOn(input));

   await input.fill(expected[0].id);await input.press('Enter');
   const first=page.locator('#results article.card').first();
   assert.equal(await first.getAttribute('data-record-key'),expected[0].key);
   const details=first.locator('details');
   await details.locator('summary').press('Enter');assert.equal(await details.getAttribute('open'),'');
   await details.locator('summary').press('Enter');assert.equal(await details.getAttribute('open'),null);
   await page.locator('#reset').press('Enter');
   const year=expected.flatMap(years)[0];
   await input.fill('year:'+(year||'unknown'));
   await recordCount(page,expected.filter(r=>year?years(r).includes(year):!years(r).length&&r.programPeriod?.status!=='not_applicable').length);
   await page.locator('#reset').press('Enter');

   await input.fill('no-record-439623');
   assert(await page.locator('#empty').isVisible());
   assert(await page.locator('#print').isDisabled());assert(await page.locator('#print-compact').isDisabled());
   await page.locator('#empty-reset').press('Enter');assert.equal(await input.inputValue(),'');assert(await focusOn(input));
   if(expected.length>6){
    await page.locator('#next').press('Enter');assert.match(await page.locator('#page-count').textContent(),/^Page 2/);
    assert(await focusOn(page.locator('#results-title')));
   }
   for(const mode of ['compact','full']){
    const printButton=page.locator(mode==='compact'?'#print-compact':'#print');
    await printButton.press('Enter');
    assert.equal(await page.locator('#print-sheet .print-record').count(),expected.length);
    assert(await page.locator('main').isHidden());
    if(width===1280)await inspectPDF(page,scope,category,mode,expected);
    await page.getByRole('button',{name:'← Back to search',exact:true}).press('Enter');
    assert(await page.locator('main').isVisible());
    assert.equal(await page.locator('#print-sheet .print-record').count(),0);
    assert(await focusOn(printButton));
   }
   if(expected.length>6)await page.locator('#previous').press('Enter');
  }

  await page.locator('[data-category="funding"]').click();
  await select.selectOption('__unindexed');
  assert((await page.locator('#results').textContent()).includes('Unknown / not established'));
  await page.locator('[data-category="sources"]').click();assert.equal(await select.inputValue(),'');
  await input.fill(scope==='tucson'?'"Craycroft/Lee Street"':'"Phoenix Manor"');
  assert(await page.locator('#results article').count()>0,'Quoted phrase finds regional evidence');
  await page.locator('#print-compact').click();
  assert(!(await page.locator('#print-sheet .print-header').textContent()).includes('Search:'),'Printed results omit the typed query');
  await page.getByRole('button',{name:'← Back to search',exact:true}).click();
  await input.fill('<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('#results article').count(),0);assert.equal(await page.locator('#results img').count(),0);
  await page.locator('#reset').click();

  if(width===1280){
   const {category,query,ids}=printSearches[scope];
   const expected=data.records.filter(r=>r.scope===scope&&r.category===category&&ids.includes(r.id));
   assert.equal(expected.length,ids.length);
   await page.locator(`[data-category="${category}"]`).click();
   await input.fill(query);await recordCount(page,ids.length);
   await page.locator('#next').click();
   for(const mode of ['compact','full']){
    assert.match(await page.locator('#page-count').textContent(),/^Page 2/);
    await page.locator(mode==='compact'?'#print-compact':'#print').click();
    await inspectPDF(page,scope,category,mode,expected,'-filtered');
    await page.getByRole('button',{name:'← Back to search',exact:true}).click();
   }
   await page.locator('#reset').click();
  }

  if(width===1280&&scope==='tucson'){
   await input.fill('SRC-100');
   const source=data.records.find(r=>r.id==='SRC-100');
   assert(await page.locator('#results a[href*="/erlink?f=ERR_900000010528814_"]').count());
   for(const mode of ['compact','full']){
    await page.locator(mode==='compact'?'#print-compact':'#print').click();
    const path=`${output}/src100-${mode}.pdf`;
    await page.pdf({path,...pdfOptions});
    const text=pdfText(path);
    for(const fact of ['Solera','August 11, 2026','September 1, 2026','posting end','separate final signed','occupancy'])assert(text.includes(fact),fact);
    const urls=pdfLinks(path);
    assert(urls.includes(source.correctedSourceUrl));
    assert(urls.includes(source.linkWarnings[0].url));
    await page.getByRole('button',{name:'← Back to search',exact:true}).click();
   }
   await page.locator('#reset').click();
  }
  assert.deepEqual(requests.slice(initialRequests),[],'Local-only search');
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  assert.equal(page.url(),base+path);
  assert.deepEqual(errors,[]);
  const fallback=page.locator('#full-search'),fallbackPath=scope==='tucson'?'/search-all.html':'/phoenix/records.html';
  await fallback.locator('xpath=ancestor::details/summary').press('Enter');
  const [popup]=await Promise.all([page.waitForEvent('popup'),fallback.press('Enter')]);
  await popup.waitForURL(base+fallbackPath);
  if(scope==='tucson'){
   for(const [query,dest] of [['William Connell','about.html'],['Contact','contact.html']]){
    await popup.locator('#site-query').fill(query);
    await popup.locator('#site-query').press('Enter');
    assert(await popup.locator(`#search-results a[href*="${dest}"]`).count()>0,`Broader search finds ${dest}`);
   }
  }
  await popup.close();
  await page.screenshot({path:`${output}/${scope}-${width}.png`,fullPage:true});
  await page.close();
  console.log(`PASS category search ${scope} ${width}: categories, filters, ID/year/phrase, keyboard, details, empty/reset, pagination, all-match print, fallback and query privacy.`);
 }
 console.log('PASS 22 Chromium Letter PDFs, including filtered results and SRC-100: matching IDs, amounts, dates, qualifications, clickable sources and no empty pages.');
}finally{await browser?.close();server?.kill()}

await import("./test-search-options.mjs");
