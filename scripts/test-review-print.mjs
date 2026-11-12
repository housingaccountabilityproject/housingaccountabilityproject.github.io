/* Actual top-document PDFs, with identical candidate data in legacy/fixed wrappers.
 * CDP printToPDF tests the print/event/layout path, not native keyboard/dialog UI.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {execPDF} from './pdf-tools.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const privateDir=mkdtempSync(join(tmpdir(),'hap-review-print-private-'));
const verified=process.env.REVIEW_PRINT_OUTPUT||'/tmp/hap-review-print-verified';mkdirSync(verified,{recursive:true});
const sourceIds=['src-029','src-036','src-040','src-034','src-064','src-065'];
const fixture=JSON.parse(readFileSync(new URL('./fixtures/six-entry-baseline.json',import.meta.url)));
const evidenceIds=fixture.registers['evidence.html'][0].map(r=>r.id);
const results={candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),native_dialog:false,chromevox:false,control:[],pdfs:[]};
const fixed=join(privateDir,'current.html'),legacy=join(privateDir,'legacy-control.html');
for(const [path,flags] of [[fixed,[]],[legacy,['--legacy-print']]])execFileSync('python3',['scripts/build-review-preview.py','--lists','--output',path,...flags],{cwd:root});
const norm=s=>s.replace(/\s+/g,'');
function audit(path){return JSON.parse(execPDF('audit',[path],{encoding:'utf8',maxBuffer:40*1024*1024}));}
function checkPDF(path,ids,texts,links){
 const a=audit(path),all=a.pages.map(p=>p.text).join('\n');
 assert.deepEqual([...all.matchAll(/Record ID:\s*([\w-]+)/g)].map(m=>m[1]),ids,'All selected records appear once and in order');
 assert(!all.includes('Six-entry Lists and Printing Review'),'Outer review controls are excluded');
 assert(a.pages.every(p=>p.text.trim().length>25),'No blank/border-only sheets');
 for(const text of texts)assert(norm(all).includes(norm(text)),'Evidence/qualification retained: '+text.slice(0,90));
 const urls=a.pages.flatMap(p=>p.links).map(l=>l.uri).filter(Boolean);
 for(const p of a.pages)for(const l of p.links){assert(!l.file,'No local file action');if(l.uri)assert(/^(https:|mailto:)/.test(l.uri),'Portable annotation '+l.uri);}
 for(const href of links)assert(urls.includes(href),'Clickable expected source/context target '+href);
 return {pages:a.pages.length,records:ids.length,links:urls.length,zero_local_targets:true};
}
let browser;
async function load(page,path,site='evidence.html',ready='#preview-print'){
 await page.goto(pathToFileURL(path).href);
 await page.locator('#site-preview').waitFor();
 if(site!=='evidence.html')await page.locator('[data-page="'+site+'"]').click();
 await page.waitForFunction(site=>document.getElementById('site-preview').contentDocument?.querySelector('link[rel="canonical"]')?.href.endsWith('/'+site),site);
 const frame=page.frames().find(f=>f.parentFrame()===page.mainFrame());
 await frame.waitForSelector(ready);return frame;
}
async function selectPreview(frame,{list='sources',detail='full',scope='current',next=true}={}){
 if(next)await frame.locator('#'+(list==='records'?'records':list)+'-next').click();
 if(await frame.locator('#print-list').isVisible())await frame.locator('#print-list').selectOption(list);
 await frame.locator('#print-scope').selectOption(scope);await frame.locator('#print-detail').selectOption(detail);
 await frame.locator('#preview-print').click();
 return await frame.locator('#search-print-output').evaluate(report=>({
  ids:[...report.querySelectorAll(':scope>[data-print-record-id]')].map(n=>n.dataset.printRecordId),
  texts:[...report.querySelectorAll(':scope>[data-print-record-id]')].flatMap(n=>{const w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),a=[];while(w.nextNode()){const t=w.currentNode.textContent.trim();if(t)a.push(t);}return a;}),
  links:[...report.querySelectorAll('a[href]')].map(a=>a.href)
 }));
}
try{
 browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{})});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Same candidate and geometry: change focus only, without fixing the wrapper.
 for(const focus of ['outer','report']){
  const f=await load(page,legacy);assert.deepEqual((await selectPreview(f)).ids,sourceIds);
  if(focus==='outer')await page.locator('[data-width="wide"]').focus();else await f.locator('#print-results').focus();
  const pdf=join(privateDir,'control-'+focus+'.pdf');await page.pdf({path:pdf,format:'Letter',displayHeaderFooter:false});
  const a=audit(pdf),text=a.pages.map(p=>p.text).join('\n');
  const ids=[...text.matchAll(/Record ID:\s*([\w-]+)/g)].map(m=>m[1]);
  assert(text.includes('Six-entry Lists and Printing Review'),'Control prints outer controls');
  assert(ids.includes('src-029')&&ids.length<6,'Control clips the six-record report');
  results.control.push({focus,pages:a.pages.length,ids,clipped:true});
 }
 for(const format of ['Letter','A4'])for(const detail of ['compact','full'])for(const focus of ['outer','report']){
  const f=await load(page,fixed),expected=await selectPreview(f,{detail});assert.deepEqual(expected.ids,sourceIds);
  const before=await f.evaluate(()=>({page:document.getElementById('sources-page').textContent,search:document.getElementById('search').value}));
  if(focus==='outer')await page.locator('[data-width="wide"]').focus();else await f.locator('#print-results').focus();
  const name=`tucson-six-${detail}-${format}-${focus}`,pdf=join(privateDir,name+'.pdf');
  await page.pdf({path:pdf,format,tagged:true,displayHeaderFooter:false});
  const stats=checkPDF(pdf,expected.ids,expected.texts,expected.links);copyFileSync(pdf,join(verified,name+'.pdf'));
  await page.waitForTimeout(30);
  assert.equal(await page.locator('[data-review-print-copy]').count(),0,'Projection removed');
  assert.equal(await f.locator('#search-print-output>[data-print-record-id]').count(),6,'Preview remains usable');
  if(focus==='report')assert.equal(await f.evaluate(()=>document.activeElement.id),'print-results');
  else assert.equal(await page.evaluate(()=>document.activeElement.dataset.width),'wide');
  await f.locator('#close-print').click();
  assert.equal(await f.locator('#sources-page').textContent(),before.page);assert.equal(await f.locator('#search').inputValue(),before.search);
  assert.equal(await f.evaluate(()=>document.activeElement.id),'preview-print');
  results.pdfs.push({name,...stats,focus_restored:true});
 }
 for(const site of ['evidence.html','phoenix/records.html']){
  const f=await load(page,fixed,site),list=site==='evidence.html'?'questions':'records';
  const expected=await selectPreview(f,{list});
  // The report button routes to the top-level request exactly once. No dialog
  // outcome is inferred from this spy; the real PDF path is checked separately.
  await page.evaluate(()=>{window.savedPrint=window.print;window.printCalls=0;window.print=()=>window.printCalls++;});
  await f.locator('#print-results').click();assert.equal(await page.evaluate(()=>window.printCalls),1);
  await page.evaluate(()=>{window.print=window.savedPrint;});
  const name=site==='evidence.html'?'tucson-questions-six-full':'phoenix-six-full',pdf=join(privateDir,name+'.pdf');
  await page.pdf({path:pdf,format:'Letter',tagged:true,displayHeaderFooter:false});
  const stats=checkPDF(pdf,expected.ids,expected.texts,expected.links);copyFileSync(pdf,join(verified,name+'.pdf'));results.pdfs.push({name,...stats,button_route:'one top-level request'});
 }
 // A normal-list root print honors the candidate's All/Full contract and restores page 2.
 {
  const f=await load(page,fixed);await f.locator('#sources-next').click();
  await f.locator('#print-scope').selectOption('current');await f.locator('#print-detail').selectOption('compact');
  const pdf=join(privateDir,'normal-list.pdf');await page.pdf({path:pdf,format:'Letter',displayHeaderFooter:false});
  const stats=checkPDF(pdf,evidenceIds,[],[]);copyFileSync(pdf,join(verified,'normal-list.pdf'));
  await page.waitForTimeout(30);assert.match(await f.locator('#sources-page').textContent(),/^Page 2 /);assert.equal(await f.locator('#search-print-output').count(),0);
  results.pdfs.push({name:'normal-list-all-full',...stats});
 }
 // Complete-index button routes through the same projection, preserving internal links.
 for(const format of ['Letter','A4']){
  const f=await load(page,fixed);const linksBefore=await f.locator('a[href]').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')));
  await page.evaluate(()=>{window.savedPrint=window.print;window.print=()=>{};});await f.locator('#print-all').click();await page.evaluate(()=>{window.print=window.savedPrint;});
  const name='complete-'+format,pdf=join(privateDir,name+'.pdf');await page.pdf({path:pdf,format,tagged:true,displayHeaderFooter:false});
  const a=audit(pdf),text=a.pages.map(p=>p.text).join('\n');
  for(const id of ['SRC-125','Q-020'])assert(text.includes(id));
  assert(!text.includes('Six-entry Lists and Printing Review'));assert(!/Showing 1[–-]6/.test(text));
  for(const p of a.pages){assert(p.text.trim().length>25);for(const l of p.links){assert(!l.file);if(l.uri)assert(/^(https:|mailto:)/.test(l.uri));if([1,4].includes(l.kind))assert(l.page>=0&&l.page<a.pages.length);}}
  await page.waitForTimeout(30);assert.equal(await f.evaluate(()=>document.activeElement.id),'print-all');
  assert.deepEqual(await f.locator('a[href]').evaluateAll(ns=>ns.map(n=>n.getAttribute('href'))),linksBefore);
  copyFileSync(pdf,join(verified,name+'.pdf'));results.pdfs.push({name,pages:a.pages.length,zero_local_targets:true,complete_focus_restored:true});
 }
 // Category browsers use a different print-sheet implementation. Exercise that
 // wrapper path in both regions, rather than repeating already confirmed native
 // source-register methods or assuming one report implementation covers another.
 for(const region of ['tucson','phoenix'])for(const detail of ['full','compact']){
  const f=await load(page,fixed,region==='tucson'?'search.html':'phoenix/search.html','#query');
  if(region==='tucson'){
   await f.locator('#query').fill('HUD');await f.locator('#category-filter').selectOption('Other source records');
  }else{
   await f.locator('[data-category="funding"]').click();await f.locator('#query').fill('year:unknown');
  }
  await f.locator('#print-record-scope').selectOption('all');
  const button=detail==='full'?'print':'print-compact';await f.locator('#'+button).click();
  const expected=await f.locator('#print-sheet').evaluate(sheet=>({
   ids:[...sheet.querySelectorAll('.print-record')].map(n=>[...n.children].find(c=>c.tagName==='P'&&c.textContent.startsWith('Record ID: ')).textContent.slice(11)),
   texts:[...sheet.querySelectorAll('.print-record')].flatMap(n=>{const w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),a=[];while(w.nextNode()){const t=w.currentNode.textContent.trim();if(t)a.push(t);}return a;}),
   links:[...sheet.querySelectorAll('.print-record a[href]')].map(a=>a.href)
  }));
  assert(expected.ids.length>6,'All matches extend beyond the screen page');if(region==='tucson')assert.equal(expected.ids.length,10);
  const name=region+'-category-all-'+detail,pdf=join(privateDir,name+'.pdf');
  await page.pdf({path:pdf,format:'Letter',tagged:true,displayHeaderFooter:false});
  const stats=checkPDF(pdf,expected.ids,expected.texts,expected.links);copyFileSync(pdf,join(verified,name+'.pdf'));
  await f.locator('#print-sheet .print-controls button').first().click();
  assert.equal(await f.locator('#query').inputValue(),region==='tucson'?'HUD':'year:unknown');assert.equal(await f.evaluate(()=>document.activeElement.id),button);
  results.pdfs.push({name,...stats,return_query_focus_preserved:true});
 }
 assert.deepEqual(errors,[]);copyFileSync(fixed,join(verified,'HAP-Embedded-Review.html'));
 writeFileSync(join(verified,'results.json'),JSON.stringify(results,null,2)+'\n');
 console.log('PASS fixed/legacy wrapper A/B; focus inside/outside; '+results.pdfs.length+' actual portable PDFs; button route, complete index and restoration. Native Ctrl+P/Save/Cancel and ChromeVox remain unverified.');
}finally{await browser?.close();rmSync(privateDir,{recursive:true,force:true});}
