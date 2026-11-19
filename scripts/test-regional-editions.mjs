import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {execPDF} from './pdf-tools.mjs';

const base=process.env.EDITION_TEST_BASE_URL||'http://127.0.0.1:8794';
const server=process.env.EDITION_TEST_BASE_URL?null:spawn('python3',['-m','http.server','8794','--bind','127.0.0.1'],{stdio:'ignore'});
const output='/tmp/hap-regional-editions';
mkdirSync(output,{recursive:true});
const data=JSON.parse(readFileSync(new URL('../data/category-search.json',import.meta.url))).records;
const counts=(scope,category)=>data.filter(r=>r.scope===scope&&r.category===category).length;
const errors=[],results=[];
let browser;
async function open(width,path){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/'+path);return page;
}
const overflow=page=>page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth})).then(m=>assert(m.scroll<=m.width+1,JSON.stringify(m)));
const metrics=page=>page.evaluate(()=>Object.fromEntries(['main','#query','.search-panel','#results','.card-main','.record-label','.caution'].map(s=>{
 const node=document.querySelector(s);if(!node)return [s,null];const r=node.getBoundingClientRect();return [s,{left:r.left,width:r.width}];
})));
try{
 for(let i=0;i<50;i++){try{assert((await fetch(base+'/tucson.html')).ok);break;}catch(e){if(i===49)throw e;await new Promise(r=>setTimeout(r,100));}}
 const executablePath=process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 console.log('Browser',browser.version());
 for(const width of [320,390,768,1280]){
  const geometry={};
  for(const scope of ['tucson','phoenix']){
   const page=await open(width,scope+'.html');
   await overflow(page);
   assert.equal(await page.locator('main').count(),1);assert.equal(await page.locator('h1').count(),1);
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'skip');
   await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
   for(const [name,id] of [['Keep Reading','keep-reading'],['Lead Story','latest']]){
    await page.getByRole('navigation',{name:'In this edition',exact:true}).getByRole('link',{name,exact:true}).press('Enter');
    assert.equal(new URL(page.url()).pathname,'/'+scope+'.html');assert.equal(new URL(page.url()).hash,'#'+id);
    assert(await page.locator('#'+id).isVisible());
   }
   assert.equal(await page.locator('.lead').count(),1);
   if(scope==='tucson'){
    assert.equal(await page.locator('.lead a').first().getAttribute('href'),'findings.html#f-012');
    assert.equal(await page.locator('figcaption').textContent(),'AI-assisted illustration of Tucson House. Not a photograph.');
   }else assert.equal(await page.locator('.storygrid img').count(),0,'No held image in Phoenix');
   await page.screenshot({path:`${output}/${scope}-edition-${width}.png`,fullPage:true});
   await page.goto(base+'/watch-'+scope+'.html');await overflow(page);
   assert.equal(await page.locator('.watch-row').count(),3);
   await page.goto(base+'/archive-'+scope+'.html');await overflow(page);
   assert.equal(await page.locator('[data-record-key]').count(),data.filter(r=>r.scope===scope).length);
   await page.goto(base+'/library.html#'+scope);await overflow(page);
   const path=scope==='tucson'?'search.html':'phoenix/search.html';
   await page.goto(base+'/'+path);await page.locator('#results article.card').first().waitFor();
   geometry[scope]={};
   for(const category of ['sources','funding','questions','updates']){
    await page.locator(`[data-category="${category}"]`).press('Enter');
    assert.match(await page.locator('#count').textContent(),new RegExp('^'+counts(scope,category)+' match'));
    assert.equal(await page.locator('#results article.card').count(),Math.min(6,counts(scope,category)));
    await overflow(page);geometry[scope][category]=await metrics(page);
    const option=await page.locator('#category-filter option').nth(1).evaluate(n=>({value:n.value,count:Number(n.textContent.match(/\((\d+)\)$/)[1])}));
    await page.locator('#category-filter').selectOption(option.value);
    assert.match(await page.locator('#count').textContent(),new RegExp('^'+option.count+' match'));
    await page.locator('#reset').press('Enter');
    const query=category==='sources'?(scope==='phoenix'?'Moreland':'Craycroft'):'';
    await page.locator('#query').fill(query);
    if(!query&&counts(scope,category)>6)await page.locator('#next').press('Enter');
    const range=await page.locator('#count').textContent(),pagination=await page.locator('#page-count').textContent();
    for(const button of ['#print-compact','#print']){
     await page.locator(button).press('Enter');
     assert(await page.locator('#print-sheet .print-record').count()>0);
     await page.getByRole('button',{name:'← Back to search',exact:true}).press('Enter');
     assert.equal(await page.locator('#query').inputValue(),query);
     assert.equal(await page.locator('#count').textContent(),range);
     assert.equal(await page.locator('#page-count').textContent(),pagination);
     assert(await page.locator(button).evaluate(n=>n===document.activeElement));
    }
    await page.locator('#reset').press('Enter');
   }
   await page.close();
  }
  for(const category of ['sources','funding','questions','updates'])for(const selector of ['main','#query','.search-panel','#results','.card-main','.record-label','.caution']){
   const a=geometry.tucson[category][selector],b=geometry.phoenix[category][selector];
   if(!a||!b)continue;
   assert(Math.abs(a.left-b.left)<1&&(['.record-label','.caution'].includes(selector)||Math.abs(a.width-b.width)<1),`${width} ${category} ${selector} differs: ${JSON.stringify({a,b})}`);
  }
  results.push({width,geometry});
  console.log('PASS editions and four-category search',width,'keyboard, counts, filters, query/range return, identical regional widths and no overflow');
 }
 // The native Chromebook dialog remains a separate check. Exercise the real
 // beforeprint/afterprint handlers and PDF engine without substituting records.
 const page=await open(1280,'phoenix/search.html');
 await page.locator('[data-category="sources"]').click();await page.locator('#query').fill('Moreland');
 const ids=await page.locator('#results article.card').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-record-key')));
 assert.equal(ids.length,6);assert.match(await page.locator('#count').textContent(),/^6 matches/);
 const before={query:await page.locator('#query').inputValue(),count:await page.locator('#count').textContent(),range:await page.locator('#page-count').textContent()};
 for(const mode of ['full-preview','direct-beforeprint']){
  if(mode==='full-preview')await page.locator('#print').click();
  const path=`${output}/moreland-${mode}.pdf`;await page.pdf({path,format:'Letter',tagged:true,timeout:90000});
  const text=execPDF('pdftotext',[path,'-'],{encoding:'utf8',maxBuffer:8*1024*1024}).replace(/\s+/g,' ');
  assert(text.includes('6 matching records'));
  for(const key of ids){const record=data.find(r=>r.key===key);assert(text.includes('Record ID: '+record.id),record.id);}
  const urls=execPDF('pdfinfo',['-url',path],{encoding:'utf8',maxBuffer:8*1024*1024});
  assert(urls.includes('https://housingaccountabilityproject.github.io/phoenix/'));
  assert(!urls.includes(base));
  if(mode==='full-preview')await page.getByRole('button',{name:'← Back to search',exact:true}).click();
  assert.equal(await page.locator('#query').inputValue(),before.query);assert.equal(await page.locator('#count').textContent(),before.count);assert.equal(await page.locator('#page-count').textContent(),before.range);
 }
 await page.close();assert.deepEqual(errors,[]);
 writeFileSync(output+'/results.json',JSON.stringify({browser:browser.version(),results,morelandIds:ids},null,2));
 console.log('PASS Moreland: all six records in Full Evidence preview and direct beforeprint PDFs; canonical clickable links; unchanged query/result range. Native Ctrl+P/ChromeVox still require Chromebook.');
}finally{await browser?.close();server?.kill();}
