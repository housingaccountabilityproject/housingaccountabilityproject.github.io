import {execPDF} from './pdf-tools.mjs';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.LIST_TEST_BASE_URL||'http://127.0.0.1:8776';
const output=process.env.LIST_TEST_OUTPUT||'/tmp/hap-list-browser';mkdirSync(output,{recursive:true});
const server=process.env.LIST_TEST_BASE_URL?null:spawn('python3',['-m','http.server','8776','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const fixture=JSON.parse(readFileSync(new URL('./fixtures/six-entry-baseline.json',import.meta.url)));
const specs=[
 ['evidence.html','#sources tbody tr','sources',0],['evidence.html','#questions tbody tr','questions',1],
 ['questions-records.html','[data-catalog-entry]','catalog',0],['funding-explorer.html','[data-catalog-entry]','catalog',0],['housing-projects.html','[data-catalog-entry]','catalog',0],
 ['phoenix/records.html','.record-card','records',0],['phoenix/questions.html','[data-connection-entry]','connections',0],['phoenix/projects.html','[data-connection-entry]','connections',0],['phoenix/comparisons.html','[data-connection-entry]','connections',0]
];
const saved=[];let browser;
async function scopeHeaderVisible(page,selector){const box=await page.locator(selector).boundingBox();assert(box&&box.y>=0&&box.y+box.height<=900,'The selected report scope header is visible on opening');}
function pdfCheck(path,ids){
 const pages=execPDF('pdftotext',[path,'-'],{encoding:'utf8',maxBuffer:20*1024*1024}).split('\f').filter((p,i,a)=>i<a.length-1||p.trim());
 assert(pages.every(p=>p.trim().length>25),path+' has no blank/border-only pages');
 const text=pages.join(' ').replace(/\s+/g,' ');
 assert.equal((text.match(/Record ID:/g)||[]).length,ids.length,path+' records appear exactly once');
 for(const id of ids)assert(text.includes('Record ID: '+id),'PDF retains '+id);
 const links=execPDF('pdfinfo',['-url',path],{encoding:'utf8',maxBuffer:20*1024*1024});
 if(ids.length)assert(links.includes('https://'),'Clickable source/context links');
 assert(!links.includes(base),'Print links use canonical public addresses');saved.push({path,pages:pages.length,records:ids.length});
}
try{
 for(let i=0;i<40;i++){try{assert((await fetch(base+'/evidence.html')).ok);break;}catch(e){if(i===39)throw e;await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({headless:true,...((process.env.CHROMIUM_PATH||existsSync('/usr/bin/chromium'))?{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}:{})});
 const page=await browser.newPage({viewport:{width:1280,height:900},timezoneId:'Asia/Tokyo'}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 for(const [path,selector,prefix,index] of specs){
  await page.goto(base+'/'+path);const expected=fixture.registers[path][index].map(r=>r.id),seen=[];
  do{
   const ids=await page.locator(selector+':visible').evaluateAll(nodes=>nodes.map(n=>n.id));assert(ids.length<=6);seen.push(...ids);
   if(await page.locator('#'+prefix+'-next').isDisabled())break;
   await page.locator('#'+prefix+'-next').press('Enter');
  }while(seen.length<expected.length+6);
  assert.deepEqual(seen,expected,path+' complete ordered pagination');assert.equal(new Set(seen).size,expected.length);
  // A late identifier must search the whole list, independent of its current page.
  const input=page.locator(path==='evidence.html'?'#search':path.startsWith('phoenix/records')?'#record-query':path.startsWith('phoenix/')?'#connection-query':'#catalog-search');
  const phrase=expected.at(-1);await input.fill(phrase);
  if(path==='evidence.html')await input.fill(phrase.replace(/^src-/,'SRC-'));
  assert(await page.locator('#'+phrase).isVisible(),'Search reaches last record '+phrase);
  assert.match(await page.locator('#'+prefix+'-page').textContent(),/^Page 1 /);
  await input.fill('no-record-594332');assert.equal(await page.locator(selector+':visible').count(),0);
  assert(await page.locator('#'+(path==='evidence.html'?prefix+'-empty':prefix==='records'?'record-empty':prefix==='catalog'?'catalog-empty':'connection-empty')).isVisible());
  await input.fill('');
  const late=expected.at(-1);await page.goto(base+'/'+path+'#'+encodeURIComponent(late));assert(await page.locator('#'+late).isVisible());
  const linkedPage=await page.locator('#'+prefix+'-page').textContent();assert(linkedPage.includes('Page '+Math.ceil(expected.length/6)));
  await input.fill('no-record-594332');
  await page.evaluate(id=>{const a=document.createElement('a');a.href='#'+id;a.id='repeat-list-link';a.textContent='Repeat linked record';document.querySelector('main').prepend(a);},late);
  await page.locator('#repeat-list-link').click();assert(await page.locator('#'+late).isVisible());
  assert.match(await page.locator('.list-link-notice').textContent(),/Filters|filters/);assert.equal(await input.inputValue(),'');
  assert.equal(await page.evaluate(()=>document.activeElement.id),late);
  // Four unambiguous reports; current page is the late page, never an assumed first six.
  if(path==='evidence.html')await page.locator('#print-list').selectOption(prefix);
  const current=await page.locator(selector+':visible').evaluateAll(nodes=>nodes.map(n=>n.id));
  const stateBefore=await page.locator('#'+prefix+'-page').textContent();
  for(const scope of ['current','all'])for(const detail of ['compact','full']){
   await page.locator('#print-scope').selectOption(scope);await page.locator('#print-detail').selectOption(detail);
   await page.locator('#preview-print').press('Enter');await scopeHeaderVisible(page,'#search-print-output>h1');const ids=scope==='current'?current:expected;
   assert.deepEqual(await page.locator('#search-print-output>[data-print-record-id]').evaluateAll(ns=>ns.map(n=>n.dataset.printRecordId)),ids);
   const text=await page.locator('#search-print-output').textContent();assert(!text.includes('Search:'));assert(text.includes('MST (UTC−7)'));assert(text.includes('America/Phoenix'));
   assert.equal(await page.locator('#search-print-output details:not([open])').count(),0);
   const pdf=`${output}/${path.replaceAll('/','-').replace('.html','')}-${prefix}-${scope}-${detail}.pdf`;
   await page.pdf({path:pdf,format:'Letter',tagged:true});pdfCheck(pdf,ids);
   await page.locator('#close-print').press('Enter');assert.equal(await page.locator('#'+prefix+'-page').textContent(),stateBefore);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'preview-print');
  }
  // Native event contract: normal Ctrl+P always all matches / full, regardless of chooser.
  await page.locator('#print-scope').selectOption('current');await page.locator('#print-detail').selectOption('compact');
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.locator('#search-print-output>[data-print-record-id]').count(),expected.length);
  assert(await page.locator('#search-print-output').evaluate(n=>n.classList.contains('print-full')));
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await input.fill('CDBG');await page.locator('#include-search-terms').check();await page.reload();
  assert.equal(await input.inputValue(),'');assert(!await page.locator('#include-search-terms').isChecked());
  console.log('PASS ordered pagination, full-set search, late/repeated links, 4 PDF scopes, Ctrl+P and reload:',path,prefix);
 }
 // Independent registers and Back/Forward, including a shared query and a historical alias.
 await page.goto(base+'/evidence.html');await page.locator('#sources-next').press('Enter');await page.locator('#questions-next').press('Enter');
 await page.goBack();assert.match(await page.locator('#sources-page').textContent(),/^Page 2 /);assert.match(await page.locator('#questions-page').textContent(),/^Page 1 /);
 await page.goForward();assert.match(await page.locator('#questions-page').textContent(),/^Page 2 /);
 await page.locator('#search').fill('no-record-49494');await page.goto(base+'/evidence.html#src-073');assert(await page.locator('#src-024').isVisible());assert(await page.locator('.list-link-notice').isVisible());
 for(const [alias,canonical] of [['project-cost-table-2026','q-018'],['housing-first-reallocation-2026','q-019'],['unnamed-coc-decisions-2026','q-020']]){await page.goto(base+'/questions-records.html#'+alias);assert(await page.locator('#'+canonical).isVisible());assert.equal(await page.evaluate(()=>document.activeElement.id),canonical,'Empty aliases focus the real record');}
 for(const [alias,canonical] of [['PHX-WEB-001','PHX-WEB-002'],['PHX-WEB-022','PHX-WEB-020'],['PHX-CFP-011','source-PHX-CFP-011']]){await page.goto(base+'/phoenix/records.html#'+alias);assert(await page.locator('#'+canonical).isVisible());assert((await page.locator('.list-link-notice').textContent()).includes(alias));}
 // Complete-index action is deliberately distinct from ordinary reports and clears filters.
 await page.goto(base+'/evidence.html');await page.locator('#search').fill('CDBG');
 await page.evaluate(()=>{window.print=()=>window.dispatchEvent(new Event('beforeprint'));});await page.locator('#print-all').click();
 assert(await page.locator('body').evaluate(n=>n.classList.contains('printing-complete-index')));
 assert.equal(await page.locator('#sources tbody tr:visible').count(),67);assert.equal(await page.locator('#questions tbody tr:visible').count(),20);
 assert.equal(await page.locator('#search').inputValue(),'');assert.equal(await page.locator('#search-print-output').count(),0);
 assert.equal(await page.locator('#source-id-crosswalk details:not([open])').count(),0);
 const complete=output+'/tucson-complete-index.pdf';await page.pdf({path:complete,format:'Letter',tagged:true});
 const completeText=execPDF('pdftotext',[complete,'-'],{encoding:'utf8',maxBuffer:10*1024*1024});
 for(const phrase of ['Let Readers Check the Evidence','SRC-125','Q-020','Website and Workbook Source-ID Crosswalk','Methodology, Source Quality'])assert(completeText.includes(phrase),phrase);
 assert(completeText.split('\f').filter(p=>p.trim()).every(p=>p.trim().length>25));
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('#sources tbody tr:visible').count(),6);
 // Category search keeps existing complete reports and adds optional page scope.
 const data=JSON.parse(readFileSync(new URL('../data/category-search.json',import.meta.url))).records;
 for(const path of ['search.html','phoenix/search.html']){
  await page.goto(base+'/'+path);const region=path.startsWith('phoenix/')?'phoenix':'tucson';
  for(const category of ['sources','questions','funding','updates']){
   await page.locator('[data-category="'+category+'"]').click();const expected=data.filter(r=>r.scope===region&&r.category===category).map(r=>r.key),seen=[];
   do{seen.push(...await page.locator('#results article').evaluateAll(ns=>ns.map(n=>n.dataset.recordKey)));if(await page.locator('#next').isDisabled())break;await page.locator('#next').click();}while(seen.length<expected.length+6);
   assert.deepEqual(seen,expected);
   const current=expected.slice(Math.floor((expected.length-1)/6)*6);
   for(const scope of ['all','current'])for(const mode of ['compact','full']){
    await page.locator('#print-record-scope').selectOption(scope);await page.locator(mode==='compact'?'#print-compact':'#print').click();
    await scopeHeaderVisible(page,'.print-header h1');
    assert.deepEqual(await page.locator('.print-record').evaluateAll(ns=>ns.map(n=>n.dataset.recordKey)),scope==='all'?expected:current);
    assert(!(await page.locator('.print-header').textContent()).includes('Search:'));
    await page.getByRole('button',{name:'← Back to search',exact:true}).click();
   }
   await page.locator('#query').fill('no-match-74389');assert(await page.locator('#empty').isVisible());assert(await page.locator('#print').isDisabled());
   await page.locator('#reset').click();assert.match(await page.locator('#page-count').textContent(),/^Page 1 /);
  }
  await page.locator('[data-category="sources"]').click();await page.locator('#query').fill(region==='tucson'?'Craycroft':'HOME');await page.locator('#next').click();
  const before=await page.locator('#page-count').textContent();await page.locator('#previous').click();await page.goBack();assert.equal(await page.locator('#page-count').textContent(),before);
  await page.locator('#include-search-terms').check();await page.locator('#print-compact').click();assert((await page.locator('.print-header').textContent()).includes('Search:'));
  await page.getByRole('button',{name:'← Back to search',exact:true}).click();await page.locator('.search-options summary').click();await page.locator('#create-search-link').click();
  const share=await page.locator('#shared-search-link').inputValue();const local=new URL(share);await page.goto(base+local.pathname+local.hash);
  assert(!await page.locator('#include-search-terms').isChecked());assert.equal(await page.locator('#page-count').textContent(),before);
  await page.reload();assert(!await page.locator('#include-search-terms').isChecked());assert.equal(await page.locator('#page-count').textContent(),before);
 }
 // Width/zoom reflow and tab access for every list; table scroll regions are intentional.
 for(const width of [320,390,768,1280])for(const path of [...new Set(specs.map(s=>s[0])),'search.html','phoenix/search.html','search-all.html']){
  await page.setViewportSize({width,height:900});await page.goto(base+'/'+path);
  if(width===1280)await page.evaluate(()=>{document.body.style.zoom='2';});
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),path+' overflow '+width);
  await page.keyboard.press('Tab');assert(await page.locator('.skip').evaluate(n=>document.activeElement===n));
  await page.keyboard.press('Enter');assert(await page.locator('main').evaluate(n=>document.activeElement===n));
 }
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 writeFileSync(output+'/results.json',JSON.stringify({baseline:fixture.commit,pdfs:saved,errors},null,2));
 console.log('PASS privacy, explicit sharing without consent, independent registers, Back/Forward, aliases, complete index, all category orders/scopes, widths 320/390/768/1280, 200% CSS zoom and keyboard. Native ChromeVox/dialog testing is separate.');
}finally{await browser?.close();server?.kill();}
