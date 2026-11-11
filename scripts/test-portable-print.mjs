// Exercise actual local-file exports as well as hosted copies. Never upload an
// unverified PDF: use a private temporary path, then retain only audited output.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {execPDF} from './pdf-tools.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),privateDir=mkdtempSync(join(tmpdir(),'hap-print-private-'));
const out=process.env.PORTABLE_PRINT_OUTPUT||'/tmp/hap-portable-print-verified';mkdirSync(out,{recursive:true});
const base=process.env.PORTABLE_PRINT_BASE_URL||'http://127.0.0.1:8783';
const server=process.env.PORTABLE_PRINT_BASE_URL?null:spawn('python3',['-m','http.server','8783','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const results=[],errors=[];let browser;
const norm=s=>s.normalize('NFKC').replace(/\s/g,'');
function audit(path){return JSON.parse(execPDF('audit',[path],{encoding:'utf8',maxBuffer:80*1024*1024}));}
function portable(data,label){
 const targets=data.pages.flatMap(p=>p.links).filter(l=>l.uri||l.file);
 assert(targets.length>0,label+' has clickable links');
 for(const link of targets){assert(!link.file,label+' remote/local file action '+link.file);assert(/^(https:|mailto:)/i.test(link.uri||''),label+' nonportable URI '+link.uri);assert(!/localhost|127\.0\.0\.1/.test(link.uri),label+' preview target');}
 assert(data.pages.every(p=>p.text.trim().length>25),label+' blank/border-only page');
 return targets.length;
}
async function exportPDF(page,name,format,check){
 const path=join(privateDir,name+'.pdf');await page.pdf({path,format,tagged:true,displayHeaderFooter:false});
 const data=audit(path),links=portable(data,name);await check?.(data);
 copyFileSync(path,join(out,name+'.pdf'));results.push({name,format,pages:data.pages.length,links});return data;
}
try{
 for(let i=0;i<40;i++){try{assert((await fetch(base+'/evidence.html')).ok);break;}catch(e){if(i===39)throw e;await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{})});
 const page=await browser.newPage({viewport:{width:1280,height:900},timezoneId:'Asia/Tokyo'});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 // Complete index: check both launch contexts and paper sizes, external link
 // identity, internal destinations, complete records/qualifications and restore.
 for(const context of ['file','http'])for(const format of ['Letter','A4']){
  await page.goto(context==='file'?pathToFileURL(root+'/evidence.html').href:base+'/evidence.html');
  const before=await page.locator('a[href]').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')));
  const readRows=ns=>ns.map(n=>({id:n.id,cells:[...n.children].map(c=>{const w=document.createTreeWalker(c,NodeFilter.SHOW_TEXT),a=[];while(w.nextNode())a.push(w.currentNode.textContent);return a.join(' ');})}));
  const rows=await page.locator('#sources tbody tr,#questions tbody tr').evaluateAll(readRows);
  const headers=await page.locator('#sources thead tr,#questions thead tr').evaluateAll(ns=>ns.map(n=>[...n.children].map(c=>c.textContent)));
  const disclosures=await page.locator('main details').evaluateAll(ns=>ns.map(n=>n.open));
  await page.locator('#search').fill('CDBG');
  await page.evaluate(()=>{window.print=()=>window.dispatchEvent(new Event('beforeprint'));});
  await page.locator('#print-all').click();await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('#sources tbody tr:visible').count(),67);assert.equal(await page.locator('#questions tbody tr:visible').count(),20);
  assert.deepEqual(await page.locator('#sources tbody tr,#questions tbody tr').evaluateAll(readRows),rows);
  assert(!await page.locator('#sources-count').isVisible());assert(!await page.locator('#questions-count').isVisible());
  assert.equal(await page.locator('main details:not([open])').count(),0);
  const during=await page.locator('a[href]').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')));
  before.forEach((href,i)=>{
   if(href.startsWith('#')||/^[a-z][a-z\d+.-]*:/i.test(href))assert.equal(during[i],href,'Preserve fragment/external source: '+href);
   else {const u=new URL(href,'https://housingaccountabilityproject.github.io/evidence.html');assert.equal(during[i],u.pathname==='/evidence.html'&&u.hash?u.hash:u.href,'Canonical cross-page target');}
  });
  const expectedTargets=await page.locator('main a[href]:visible').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')).filter(h=>!h.startsWith('#')));
  await exportPDF(page,`complete-${context}-${format}`,format,data=>{
   const text=data.pages.map(p=>p.text).join(' ');
   assert(!/Showing\s+1[–-]6/.test(text),'No stale screen counter');
   for(const phrase of ['Website and Workbook Source-ID Crosswalk','Methodology, Source Quality','Priority Completion Queue','Revision Register'])assert(norm(text).includes(norm(phrase)),phrase);
   const uris=data.pages.flatMap(p=>p.links).map(l=>l.uri).filter(Boolean);
   for(const target of new Set(expectedTargets))assert(uris.includes(target),'PDF retains target '+target);
   assert(data.pages.flatMap(p=>p.links).some(l=>[1,4].includes(l.kind)&&l.page>=0),'Internal PDF destinations retained (direct or named)');
   // Read each of the five fixed table columns across page breaks, rather
   // than claiming equality from interleaved whole-page extraction. Repeated
   // table headers may intervene, and adjacent links can extract as a single
   // word. Compare whitespace-normalized cell text in each column's order;
   // exclude the repeated header wording identically on both sides.
   const columns=Array.from({length:5},()=>''),margin=18*72/25.4;
   for(const p of data.pages)for(const w of p.words){const col=Math.min(4,Math.max(0,Math.floor((w[0]-margin)/((p.width-2*margin)/5))));columns[col]+=norm(w[4]);}
   for(let col=0;col<5;col++){
    const withoutHeaders=s=>headers.reduce((t,h)=>t.replaceAll(norm(h[col]),''),norm(s));
    const text=withoutHeaders(columns[col]);let at=0;
    for(const row of rows){const cell=withoutHeaders(row.cells[col]),found=text.indexOf(cell,at);assert(found>=0,`Complete ${context}/${format}: ${row.id} column ${col+1} text retained`);at=found+cell.length;}
   }
  });
  // page.pdf already emitted afterprint. A second synthetic event would
  // exercise the unrelated normal-report cleanup after complete mode ended.
  await page.emulateMedia({media:'screen'});
  assert.deepEqual(await page.locator('a[href]').evaluateAll(ns=>ns.map(n=>n.getAttribute('href'))),before);
  assert.deepEqual(await page.locator('main details').evaluateAll(ns=>ns.map(n=>n.open)),disclosures);
  assert.equal(await page.locator('#search').inputValue(),'');assert.equal(await page.locator('#sources tbody tr:visible').count(),6);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'print-all');
  // Also verify a single simulated cancel event, without a PDF export.
  // This remains an event-contract check, not a native dialog cancellation.
  await page.locator('#print-all').click();await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.evaluate(()=>document.activeElement.id),'print-all');
  assert.deepEqual(await page.locator('a[href]').evaluateAll(ns=>ns.map(n=>n.getAttribute('href'))),before);
 }
 // Full six-record pages in both regions. The existing suite also retains
 // every all-register/last-page case and the SRC-027/Q-004 attachment checks.
 for(const [path,list,prefix] of [['evidence.html','sources','sources'],['evidence.html','questions','questions'],['phoenix/records.html',null,'records']]){
  for(const scope of ['current','all'])for(const detail of ['compact','full'])for(const format of ['Letter','A4']){
   await page.goto(pathToFileURL(root+'/'+path).href);
   await page.locator('#'+prefix+'-next').click();if(list)await page.locator('#print-list').selectOption(list);
   const state=await page.locator('#'+prefix+'-page').textContent();
   await page.locator('#print-scope').selectOption(scope);await page.locator('#print-detail').selectOption(detail);await page.locator('#preview-print').click();
   const ids=await page.locator('#search-print-output>[data-print-record-id]').evaluateAll(ns=>ns.map(n=>n.dataset.printRecordId));
   if(scope==='current')assert.equal(ids.length,6);
   const fragments=await page.locator('#search-print-output>[data-print-record-id]').evaluateAll(ns=>ns.flatMap(n=>{const w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),a=[];while(w.nextNode()){const s=w.currentNode.textContent.trim();if(s)a.push(s);}return a;}));
   await exportPDF(page,`${prefix}-${scope}-${detail}-${format}`,format,data=>{
    const text=data.pages.map(p=>p.text).join(' '),flat=norm(text);
    assert.deepEqual([...text.matchAll(/Record ID:\s*([\w-]+)/g)].map(m=>m[1]),ids,'Every record once in order');
    for(const fragment of fragments)assert(flat.includes(norm(fragment)),'PDF retains evidence/qualification '+fragment);
   });
   await page.locator('#close-print').click();assert.equal(await page.locator('#'+prefix+'-page').textContent(),state);assert.equal(await page.evaluate(()=>document.activeElement.id),'preview-print');
  }
 }
 // Category searches: both regions, every category and print scope/detail.
 for(const region of ['tucson','phoenix'])for(const category of ['sources','questions','funding','updates'])for(const scope of ['current','all'])for(const detail of ['compact','full']){
  await page.goto(pathToFileURL(root+(region==='phoenix'?'/phoenix':'')+'/search.html').href);
  await page.locator('[data-category="'+category+'"]').click();if(await page.locator('#next').isEnabled())await page.locator('#next').click();
  const state=await page.locator('#page-count').textContent();await page.locator('#print-record-scope').selectOption(scope);await page.locator(detail==='compact'?'#print-compact':'#print').click();
  const records=await page.locator('.print-record').evaluateAll(ns=>ns.map(n=>({key:n.dataset.recordKey,id:n.querySelector('h2')?.textContent})));
  await exportPDF(page,`${region}-${category}-${scope}-${detail}`,'Letter',data=>{for(const r of records)assert(norm(data.pages.map(p=>p.text).join(' ')).includes(norm(r.id)),r.key+' title retained');});
  await page.getByRole('button',{name:'← Back to search',exact:true}).click();assert.equal(await page.locator('#page-count').textContent(),state);assert.equal(await page.evaluate(()=>document.activeElement.id),detail==='compact'?'print-compact':'print');
 }
 // Actual browser accessibility trees, not a claim of ChromeVox speech.
 const cdp=await page.context().newCDPSession(page);
 for(const path of ['evidence.html','phoenix/records.html','search.html','phoenix/search.html']){
  await page.goto(pathToFileURL(root+'/'+path).href);const ax=(await cdp.send('Accessibility.getFullAXTree')).nodes.filter(n=>!n.ignored);
  for(const role of ['main','heading','button','combobox'])assert(ax.some(n=>n.role?.value===role),path+' exposes '+role);
  for(const n of ax.filter(n=>['button','combobox','textbox','checkbox'].includes(n.role?.value)))assert(n.name?.value,path+' unnamed control');
  if(path==='evidence.html'){for(const name of ['List to print','Records to print','Evidence detail'])assert(ax.some(n=>n.role?.value==='combobox'&&n.name?.value===name),name);assert(ax.filter(n=>n.role?.value==='status').length>=2,'Independent register status announcements');}
 }
 assert.deepEqual(errors,[]);writeFileSync(out+'/results.json',JSON.stringify({pdfs:results,errors,nativeDialogs:false,chromeVox:false,embeddedReview:false},null,2));
 console.log(`PASS portable file/hosted complete-index exports; ${results.length} PDFs, every tested URI portable, all register cell tokens in column order, scopes/evidence/qualifications, restoration and AX control names. Native Chromebook, ChromeVox and embedded-review failure remain separate.`);
}finally{await browser?.close();server?.kill();rmSync(privateDir,{recursive:true,force:true});}
