import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
const base='http://127.0.0.1:8791',out='../artifacts',server=spawn('python3',['-m','http.server','8791','--bind','127.0.0.1'],{stdio:'ignore'});
let browser;const results={};
try{
 for(let i=0;i<40;i++){try{await fetch(base);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():r.abort());
 for(const path of ['funding-explorer.html','phoenix/records.html']){
  await page.goto(base+'/'+path+(path.startsWith('phoenix/')?'#view-funding':''));const guide=page.locator('.city-stage-guide');assert.equal(await guide.locator(':scope>h2').textContent(),'Four records. Four different meanings.');assert.equal(await guide.locator('.city-stage-grid h3').count(),4);
  results[path]=await guide.locator('h2,h3').allTextContents();await guide.evaluate(e=>{for(let n=e.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;});await guide.screenshot({path:out+'/'+path.replaceAll('/','-')+'-headings.png'});
 }
 await page.goto(base+'/phoenix/index.html');await page.locator('.city-evidence-library>summary').click();
 results.labels=await page.locator('.eyebrow').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length).map(el=>{
  const lum=a=>a.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
  const parse=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);let n=el,bg;
  while(n){const c=getComputedStyle(n).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'){bg=parse(c);break;}n=n.parentElement;}
  const fg=parse(getComputedStyle(el).color),a=lum(fg),b=lum(bg||[255,255,255]);return {text:el.textContent,fg,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
 }));
 console.log(JSON.stringify(results.labels));
 assert(results.labels.find(x=>x.text.includes('04 / Housing need'))?.ratio>=4.5);for(const x of results.labels)assert(x.ratio>=4.5,JSON.stringify(x));
 await page.locator('#need').scrollIntoViewIfNeeded();await page.locator('#need').screenshot({path:out+'/phoenix-need.png'});
 for(const name of ['index.html','about.html','contact.html','privacy.html']){
  await page.goto(base+'/'+name);const footer=page.locator('.city-footer');const links=await footer.locator('a').evaluateAll(ns=>ns.map(n=>({label:n.textContent,href:n.getAttribute('href')})));
  for(const label of ['Search Tucson','Housing help: Tucson','Reports & reading: Tucson'])assert(links.some(x=>x.label===label),name+' '+label);
  results[name]=links;
  await footer.getByRole('link',{name:'Search Tucson',exact:true}).focus();await page.keyboard.press('Tab');results[name+' focus']=await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return {text:e.textContent,outline:s.outline,offset:s.outlineOffset}});assert.match(results[name+' focus'].outline,/3px/);
 }
 for(const name of ['glossary.html','about.html','research-updates.html','funding-explorer.html','phoenix/records.html','phoenix/index.html']){
  await page.goto(base+'/'+name);if(name==='phoenix/index.html')await page.locator('.city-evidence-library>summary').click();
  await page.pdf({path:out+'/pdfs/page-'+name.replaceAll('/','-')+'.pdf',format:'Letter',tagged:true,displayHeaderFooter:false});
 }
 await page.goto(base+'/search.html');await page.locator('#print').click();assert.match(await page.locator('.print-header').textContent(),/November 9 and 10 publications/);assert.match(await page.locator('.print-header').textContent(),/2026-11-08/);
 writeFileSync(out+'/eight-review-browser.json',JSON.stringify(results,null,2));console.log('PASS candidate-specific headings, accent labels, footer targets/focus and historical print snapshot; six page PDFs exported for separate audit.');
}finally{await browser?.close();server.kill();}
