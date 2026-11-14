/* Browser checks of the draft UI and explicitly synthetic edge cases. No period research is verified here. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {execPDF} from './pdf-tools.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.FUNDING_TEST_BASE_URL||'http://127.0.0.1:8773';
const output=process.env.FUNDING_TEST_OUTPUT||'/tmp/hap-funding-framework';
const server=process.env.FUNDING_TEST_BASE_URL?null:spawn('python3',['-m','http.server','8773','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
mkdirSync(output,{recursive:true});
const dataset=JSON.parse(readFileSync(new URL('../data/category-search.json',import.meta.url)));
const log=[],pdfs=[],errors=[];
const yearsById={
 'MC-HOME-WEB-001':['2027','2028'],'PHX-WEB-012':['2024'],
 'PHX-CFP-WEB-001':['2026'],'PHX-CFP-WEB-002':['2026'],'PHX-CFP-WEB-004':['2025'],'PHX-CFP-WEB-005':['2026'],
 'BELL-06':['2019','2020'],
 'FUND-PUB-001':['2024','2025'],'FUND-PUB-002':['2026','2027'],'FUND-PUB-003':['2024','2025'],
 'FUND-PUB-004':['2025','2026'],'FUND-PUB-005':['2025','2026'],'FUND-PUB-006':['2024','2025'],'FUND-PUB-007':['2024','2025','2026'],
 'county-price-funding-2026':['2025','2026','2027','2028','2029','2030','2031','2032'],'county-funding-fy27-q1':['2026','2027'],
 'federal-allocations-2026':['2026','2027'],'coc-request-2026':['2026']
};
const normalize=id=>id.startsWith('fund-pub-')?id.toUpperCase():id;
const priceExplanation='The two Pima County PRICE agreements cover July 1, 2026 through June 30, 2029. They are part of, not additional to, the City of Tucson’s broader federal PRICE award, which runs from January 15, 2025 through September 20, 2032.';
function match(id,value){id=normalize(id);return !value||(value==='__not_applicable'?id==='PHX-CFP-WEB-006':value==='__unknown'||value==='__unindexed'?(!yearsById[id]||['BELL-06','PHX-WEB-012'].includes(id))&&id!=='PHX-CFP-WEB-006':(yearsById[id]||[]).includes(value));}
const note=(width,surface,label,matches)=>log.push({width,surface,label,...(matches===undefined?{}:{matches}),passed:true});
const focus=locator=>locator.evaluate(n=>n===document.activeElement);
let browser;
async function open(width,path){
 const page=await browser.newPage({viewport:{width,height:1100},...(width<600?{isMobile:true,hasTouch:true}:{})});
 page.on('pageerror',e=>errors.push({width,path,message:e.message}));
 await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 await page.goto(base+path);return page;
}
async function fits(page,label){assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),label+' fits viewport');}
async function share(page,expected){
 await page.locator('.search-options details > summary').click();
 await page.locator('#create-search-link').click();
 const url=new URL(await page.locator('#shared-search-link').inputValue());
 const payload=JSON.parse(decodeURIComponent(url.hash.slice('#hap-search='.length)));
 for(const [key,value] of Object.entries(expected))assert.equal(payload.state[key],value,'shared '+key);
 assert.equal(url.origin,'https://housingaccountabilityproject.github.io');
 await page.goto(base+url.pathname+url.hash);
 await page.reload(); // An explicit shared URL must also survive a fresh document load.
}
async function pdf(page,name,ids,format='Letter'){
 const path=`${output}/${name}.pdf`;
 await page.pdf({path,format,printBackground:false,tagged:true,timeout:90000});
 const text=execPDF('pdftotext',[path,'-'],{encoding:'utf8',maxBuffer:8*1024*1024}).replace(/\s+/g,' ');
 assert(text.includes('Funding year / period'),name+' period label in PDF');
 assert(text.includes('Period evidence checked'),name+' review status in PDF');
 for(const id of ids)assert(text.includes('Record ID: '+id),name+' retains '+id);
 const links=execPDF('pdfinfo',['-url',path],{encoding:'utf8',maxBuffer:8*1024*1024});
 const audit=JSON.parse(execPDF('audit',[path],{encoding:'utf8',maxBuffer:80*1024*1024}));
 assert(audit.pages.every(p=>p.text.trim().length>25),name+' no blank/border-only pages');
 assert(!/file:\/\/|https?:\/\/(?:127\.0\.0\.1|localhost)/.test(links),name+' portable destinations');
 assert(links.includes('https://'),name+' clickable evidence');
 pdfs.push({file:name+'.pdf',records:ids.length,passed:true});
}
async function primary(width,scope){
 const phx=scope==='phoenix',surface=phx?'phoenix-evidence':'tucson-catalog';
 const page=await open(width,phx?'/phoenix/records.html':'/funding-explorer.html');
 const input=page.locator(phx?'#record-query':'#catalog-search'),select=page.locator(phx?'#funding-year':'#catalog-funding-year');
 await select.waitFor({state:'attached'});
 if(phx)await page.getByRole('button',{name:'Funding',exact:true}).click();
 const cards=page.locator(phx?'.record-card[data-group="funding"]':'[data-catalog-entry]');
 const ids=await cards.evaluateAll(ns=>ns.map(n=>n.id));
 assert.equal(ids.length,phx?19:7);
 assert.equal(await cards.locator(':scope > .funding-period').count(),ids.length,'period on every Funding record');
 assert.equal(await cards.locator(':scope > .funding-period > p').filter({hasText:'Period evidence checked'}).count(),ids.length);
 assert.equal(await select.getAttribute('aria-describedby'),phx?'funding-year-help':'catalog-funding-help');
 const ax=await page.locator(phx?'#record-filters':'.funding-catalog-panel').ariaSnapshot();
 assert.match(ax,/combobox "Funding year \/ period"/);assert.match(ax,/group "Filters"/);
 writeFileSync(`${output}/${width}-${surface}-accessibility.txt`,ax);
 const count=page.locator(phx?'#record-count':'#catalog-count'),next=page.locator(phx?'#records-next':'#catalog-next');
 const state=async()=>({query:await input.inputValue(),year:await select.inputValue(),page:await page.locator(phx?'#records-page':'#catalog-page').textContent()});
 async function check(expected,label){
  assert((await count.textContent()).startsWith(`${expected.length} of ${ids.length} `),surface+' '+label+' count');
  assert.deepEqual(await cards.filter({visible:true}).evaluateAll(ns=>ns.map(n=>n.id)),expected.slice(0,6),surface+' '+label+' records');
  assert.equal(await page.locator(phx?'#record-empty':'#catalog-empty').isVisible(),!expected.length);
  await fits(page,surface);note(width,surface,label,expected.length);
 }
 await check(ids,'initial');
 for(const value of await select.locator('option').evaluateAll(ns=>ns.map(n=>n.value))){
  await select.selectOption(value);await check(ids.filter(id=>match(id,value)),'period='+value);
 }
 const year=phx?'2028':'2025';
 await select.selectOption(year);
 const target=phx?'MC-HOME-WEB-001':'fund-pub-004';
 await input.fill(target);await check([target],'year plus identifier');
 await input.fill('no-funding-record-69325');await check([],'year plus no matches');assert.equal(await select.inputValue(),year);
 const clear=page.getByRole('button',{name:'Clear filters',exact:true});await clear.click();
 assert(await focus(phx?clear:input),surface+' retains the established clear-focus behavior');assert.equal(await select.inputValue(),'');assert.equal(await input.inputValue(),'');
 if(phx){assert.equal(await page.locator('.record-views [aria-pressed="true"]').getAttribute('data-view'),'all');await page.getByRole('button',{name:'Funding',exact:true}).click();}
 await check(ids,'clear restores scope');
 await select.focus();await select.press('Home');await select.press('ArrowDown');
 const keyboardYear=await select.locator('option').nth(1).getAttribute('value');
 assert.equal(await select.inputValue(),keyboardYear,'native keyboard selection changes the funding filter');
 await check(ids.filter(id=>match(id,keyboardYear)),'native keyboard year selection');
 await clear.press('Enter');if(phx)await page.getByRole('button',{name:'Funding',exact:true}).press('Enter');
 // Topic, year and query work together, including zero-count options that retain the selection.
 const topic=page.locator(phx?'#record-topic':'#catalog-filter');
 await select.selectOption(phx?'2027':'2025');await topic.selectOption(phx?'county':'home');
 const withTopic=phx?['MC-HOME-WEB-001']:['fund-pub-003','fund-pub-004','fund-pub-005'];
 await check(withTopic,'topic plus year');await input.fill(withTopic[0]);await check([withTopic[0]],'topic plus year plus search');
 await clear.click();if(phx)await page.getByRole('button',{name:'Funding',exact:true}).click();
 // Full pagination preserves every record exactly once.
 const paged=[];do{paged.push(...await cards.filter({visible:true}).evaluateAll(ns=>ns.map(n=>n.id)));if(await next.isDisabled())break;await next.click();}while(true);
 assert.deepEqual(paged,ids);note(width,surface,'complete pagination',paged.length);
 await select.selectOption(phx?'__unknown':'2025');
 const selected=ids.filter(id=>match(id,phx?'__unknown':'2025'));
 if(phx)await next.press('Enter');
 const saved=await state();
 await share(page,{fundingYear:saved.year,page:phx?2:1});
 assert.deepEqual(await state(),saved,'shared filters and page restored');
 note(width,surface,'share restores filters and page',selected.length);
 if(width===390||width===1280)await cards.filter({visible:true}).first().screenshot({path:`${output}/${width}-${scope}-primary-selected-record.png`});
 // Tab order includes the same search/reset row and native period control.
 await input.focus();await input.press('Tab');assert(await focus(clear));
 await page.keyboard.press('Tab');assert(await focus(topic));
 if(phx)await page.keyboard.press('Tab');
 await page.keyboard.press('Tab');assert(await focus(select));
 assert.equal(await select.evaluate(n=>getComputedStyle(n).outlineStyle),'solid');
 assert.equal(await select.evaluate(n=>n.getBoundingClientRect().height),48);
 for(const mode of ['full','compact']){
  await page.locator('#print-detail').selectOption(mode);
  await page.locator('#print-scope').selectOption(phx?'current':'all');
  await page.locator('#preview-print').press('Enter');
  const printed=phx?selected.slice(6,12):selected;
  assert.deepEqual(await page.locator('#search-print-output [data-print-record-id]').evaluateAll(ns=>ns.map(n=>n.dataset.printRecordId)),printed);
  assert.equal(await page.locator('#search-print-output .funding-period').count(),printed.length);
  assert((await page.locator('#search-print-output').textContent()).includes('Funding year / period: '));
  if(width===1280)await pdf(page,`${scope}-primary-${mode}`,printed);
  await page.locator('#close-print').press('Enter');assert.deepEqual(await state(),saved);assert(await focus(page.locator('#preview-print')));
  note(width,surface,mode+' print and return',printed.length);
 }
 // The direct print button invokes the same before/after-print path and preserves state.
 await page.evaluate(()=>{window.print=()=>{window.dispatchEvent(new Event('beforeprint'));window.__printIds=[...document.querySelectorAll('#search-print-output [data-print-record-id]')].map(n=>n.dataset.printRecordId);window.dispatchEvent(new Event('afterprint'));};});
 await page.locator('#print-search-results').press('Enter');
 assert.equal((await page.evaluate(()=>window.__printIds)).length,phx?6:selected.length);assert.deepEqual(await state(),saved);
 // Ctrl+P's native lifecycle on an ordinary list selects every match, independently of screen pagination.
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 assert.equal(await page.locator('#search-print-output [data-print-record-id]').count(),selected.length);
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.deepEqual(await state(),saved);
 note(width,surface,'print button and ordinary-list before/afterprint preserve filters and page');
 await clear.click();if(phx)await page.getByRole('button',{name:'Funding',exact:true}).click();
 if(width===390||width===1280){
  await page.locator('#print-scope').selectOption('all');await page.locator('#print-detail').selectOption('full');
  await page.locator(phx?'.records-workspace':'.funding-catalog-panel').evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'}));
  await page.screenshot({path:`${output}/${width}-${scope}-primary-funding.png`});
 }
 if(phx){
  await page.getByRole('button',{name:'Sources',exact:true}).click();
  assert(await select.isHidden());assert(await page.getByLabel('Reporting / event year',{exact:true}).isVisible());
  assert((await page.locator('#source-year-help').textContent()).includes('separate from'));
 }else{
  assert.equal(await page.locator('.funding-period').count(),12,'all seven catalog and five contextual sections annotated');
  await select.selectOption('__unknown');await check([],'catalog explicitly has zero unknowns');
  assert((await page.locator('#catalog-funding-help').textContent()).includes('12 Tucson Funding entries'));
 }
 assert.equal(new URL(page.url()).search,'');await page.close();
}
async function category(width,scope){
 const surface=scope+'-funding-search',page=await open(width,scope==='tucson'?'/search.html':'/phoenix/search.html');
 await page.locator('[data-category="funding"]').click();
 const rows=dataset.records.filter(r=>r.scope===scope&&r.category==='funding'),ids=rows.map(r=>r.id);
 const select=page.locator('#category-filter'),input=page.locator('#query');
 assert.equal(await page.locator('#filter-label').textContent(),'Funding year / period');
 assert.equal(rows.length,scope==='tucson'?12:18);
 async function check(expected,label){
  assert((await page.locator('#count').textContent()).startsWith(expected.length+' match'),surface+' '+label);
  assert.equal(await page.locator('#results article.card').count(),Math.min(6,expected.length));
  await fits(page,surface);note(width,surface,label,expected.length);
 }
 await check(ids,'initial');
 // All four category tabs retain search and their existing filter; period is a Funding-only concept.
 for(const category of ['sources','questions','updates','funding']){
  await page.locator(`[data-category="${category}"]`).press('Enter');
  assert(await input.isVisible());assert(await select.isVisible());assert.equal(await select.inputValue(),'');
  if(width===390||width===1280){await page.locator('#search-panel').evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:`${output}/${width}-${scope}-category-${category}.png`});}
 }
 const values=await select.locator('option').evaluateAll(ns=>ns.map(n=>n.value));
 for(const value of values){await select.selectOption(value);await check(ids.filter(id=>match(id,value)),'period='+value);}
 const wanted=scope==='tucson'?'2028':'2027';await select.selectOption(wanted);
 const target=scope==='tucson'?'county-price-funding-2026':'MC-HOME-WEB-001';
 await input.fill(target);await check([target],'year plus search');
 await input.fill('no-funding-record-68937');await check([],'year plus no matches');assert.equal(await select.inputValue(),wanted);
 await page.locator('#reset').press('Enter');assert.equal(await select.inputValue(),'');assert(await focus(input));
 await select.focus();await select.press('Home');await select.press('ArrowDown');
 const keyboardYear=await select.locator('option').nth(1).getAttribute('value');
 assert.equal(await select.inputValue(),keyboardYear,'native keyboard selection changes the regional Funding filter');
 await check(ids.filter(id=>match(id,keyboardYear)),'native keyboard year selection');
 await page.locator('#reset').press('Enter');
 const paged=[];do{paged.push(...await page.locator('#results article').evaluateAll(ns=>ns.map(n=>n.dataset.recordKey)));if(await page.locator('#next').isDisabled())break;await page.locator('#next').press('Enter');}while(true);
 assert.deepEqual(paged,rows.map(r=>r.key));note(width,surface,'complete pagination',paged.length);
 const year=scope==='tucson'?'__unindexed':'2028';await select.selectOption(year);
 const selected=ids.filter(id=>match(id,year));
 await share(page,{scope,category:'funding',year,page:1});
 assert.equal(await select.inputValue(),year);await check(selected,'shared filter restored');
 const card=page.locator('#results article.card').first();
 assert((await card.textContent()).includes('Funding year / period'));
 assert((await card.textContent()).includes('Period evidence checked: 2026-11-13'));
 if(scope==='tucson')assert((await card.textContent()).includes('Unknown / not established'));
 if(width===390||width===1280)await card.screenshot({path:`${output}/${width}-${scope}-search-selected-record.png`});
 const ax=await page.locator('#search-panel').ariaSnapshot();assert.match(ax,/combobox "Funding year \/ period"/);writeFileSync(`${output}/${width}-${surface}-accessibility.txt`,ax);
 await select.focus();assert.equal(await select.evaluate(n=>getComputedStyle(n).outlineStyle),'solid');
 for(const mode of ['compact','full']){
  const button=page.locator(mode==='full'?'#print':'#print-compact');await button.press('Enter');
  assert.equal(await page.locator('#print-sheet .print-record').count(),selected.length);
  assert((await page.locator('#print-sheet').textContent()).includes('Funding year / period'));
  if(width===1280)await pdf(page,`${scope}-search-${mode}`,selected);
  await page.getByRole('button',{name:'← Back to search',exact:true}).press('Enter');
  assert(await focus(button));assert.equal(await select.inputValue(),year);
  note(width,surface,mode+' print and return',selected.length);
 }
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('#print-sheet .print-record').count(),selected.length);
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await select.inputValue(),year);
 await page.locator('#reset').click();await check(ids,'clear restores full Funding scope');
 if(width===390||width===1280){await page.locator('#search-panel').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${width}-${scope}-funding-search.png`});}
 await page.locator('[data-category="sources"]').click();assert((await page.locator('#filter-help').textContent()).includes('reporting / event years'));
 await page.close();
}
async function pdf01TucsonCompact(){
 for(const width of [390,1280]){
  const canonical=await open(width,'/funding-explorer.html');
  const annotation=canonical.locator('#county-price-funding-2026 > .funding-period');
  assert.equal(await annotation.getByText(priceExplanation,{exact:true}).count(),1,'PRICE explanation appears once in the canonical record');
  assert.equal(await annotation.locator(':scope > p').first().textContent(),priceExplanation);
  assert((await annotation.locator(':scope > p').nth(1).textContent()).startsWith('Funding year / period: '),'PRICE explanation immediately precedes canonical periods');
  await fits(canonical,'PRICE canonical record');
  await annotation.screenshot({path:`${output}/${width}-price-canonical-explanation.png`});
  await canonical.close();
  const search=await open(width,'/search.html');
  await search.locator('[data-category="funding"]').click();
  await search.locator('#category-filter').selectOption('2025');
  await search.locator('#next').click();
  const card=search.locator('#results article.card');
  assert.equal(await card.getByText(priceExplanation,{exact:true}).count(),1,'PRICE explanation appears once in the search record');
  assert(await card.locator('.card-fields dd').evaluateAll((nodes,wording)=>nodes.some(n=>n.firstElementChild?.textContent===wording&&n.firstElementChild.nextSibling?.textContent.startsWith('County FY2027')) ,priceExplanation),'PRICE explanation immediately precedes search periods');
  await fits(search,'PRICE search record');
  await card.screenshot({path:`${output}/${width}-price-search-record.png`});
  note(width,'tucson-PRICE-explanation','exact wording once before periods in canonical and search records',1);
  await search.close();
 }
 const page=await open(1280,'/search.html'),id='county-price-funding-2026';
 await page.locator('[data-category="funding"]').click();
 await page.locator('#category-filter').selectOption('2025');
 await page.locator('#next').click();
 assert.equal(await page.locator('#page-count').textContent(),'Page 2 of 2');
 assert((await page.locator('#count').textContent()).startsWith('7 matches'));
 await page.locator('#print-record-scope').selectOption('current');
 await page.locator('#print-compact').press('Enter');
 const report=page.locator('#print-sheet'),records=report.locator('.print-record');
 assert.equal(await records.count(),1,'PDF-01 prints one current-page record, not all seven matches');
 assert.equal(await records.getAttribute('data-record-key'),'tucson:funding-explorer.html#'+id);
 assert.equal(await records.getByText(priceExplanation,{exact:true}).count(),1,'PRICE explanation appears once in Compact');
 const terms=[
  'PRICE home-repair packet agreement term: July 1, 2026–June 30, 2029',
  'PRICE eviction-prevention/legal-services packet agreement term: July 1, 2026–June 30, 2029'
 ];
 for(const term of terms)assert.equal(await report.getByText(term,{exact:true}).count(),1,'PDF-01 exact agreement dates appear once per component');
 const cityPeriod='City of Tucson full federal PRICE award: January 15, 2025–September 20, 2032';
 assert((await report.textContent()).includes(cityPeriod),'PDF-01 retains the separate City award period');
 const name='tucson-2025-page2-compact-pdf01';
 // Match the saved Chromebook sample's A4 paper; other existing PDF cases retain Letter.
 await pdf(page,name,[id],'A4');
 const text=execPDF('pdftotext',[`${output}/${name}.pdf`,'-'],{encoding:'utf8',maxBuffer:8*1024*1024});
 const compact=text.replace(/\s+/g,'');
 assert.equal(compact.split(priceExplanation.replace(/\s+/g,'')).length-1,1,'PRICE explanation appears once in Compact PDF');
 assert(compact.indexOf(priceExplanation.replace(/\s+/g,''))<compact.indexOf('CountyFY2027'),'PRICE explanation precedes formal Compact periods');
 for(const term of [...terms,cityPeriod])assert(compact.includes(term.replace(/\s+/g,'')),'PDF-01 dates retained in exported PDF');
 assert.equal((text.match(/Record ID:\s*county-price-funding-2026/g)||[]).length,1,'PDF-01 one primary record in PDF');
 assert(compact.includes('7matchingrecords.Currentpageonly:1records.'),'PDF-01 separates total matches from printed count');
 for(const qualification of ['County FY2027 housing allocations','does not prove spending or services in every included year','Not County spending or a current available balance'])assert(compact.includes(qualification.replace(/\s+/g,'')),'PDF-01 retains period scope and qualifications');
 note(1280,'tucson-PDF-01','2025 page two / Current page / Compact; both exact County agreement terms; separate City period; one primary record',1);
 await page.getByRole('button',{name:'← Back to search',exact:true}).click();
 await page.locator('#print').press('Enter');
 assert.equal(await records.count(),1,'Full prints the same single current-page record');
 assert.equal(await records.getByText(priceExplanation,{exact:true}).count(),1,'PRICE explanation appears once in Full');
 const fullName='tucson-2025-page2-full-price-context';
 await pdf(page,fullName,[id],'A4');
 const fullText=execPDF('pdftotext',[`${output}/${fullName}.pdf`,'-'],{encoding:'utf8',maxBuffer:8*1024*1024}).replace(/\s+/g,'');
 assert.equal(fullText.split(priceExplanation.replace(/\s+/g,'')).length-1,1,'PRICE explanation appears once in Full PDF');
 assert(fullText.indexOf(priceExplanation.replace(/\s+/g,''))<fullText.indexOf('CountyFY2027'),'PRICE explanation precedes formal Full periods');
 assert.equal((fullText.match(/RecordID:county-price-funding-2026/g)||[]).length,1,'Full one primary record in PDF');
 for(const qualification of ['does not prove spending or services in every included year','full signatures, reimbursements and actual outcomes remain unverified'])assert(fullText.includes(qualification.replace(/\s+/g,'')),'Full retains existing funding and execution qualifications');
 note(1280,'tucson-PRICE-explanation','Full: exact wording once before periods, one primary record and existing qualifications',1);
 await page.close();
}
async function synthetic(width){
 const page=await open(width,'/scripts/fixtures/funding-period-framework.html');
 await page.locator('#test-tucson article').first().waitFor();
 assert((await page.getByRole('note').textContent()).includes('TEST DATA ONLY'));
 for(const scope of ['tucson','phoenix']){
  const region=page.locator('#test-'+scope),select=region.getByRole('combobox'),input=region.getByRole('searchbox');
  assert.equal(await region.locator('article').count(),4);
  assert.equal(await region.locator('option[value="2026"]').count(),0,'event year excluded');
  for(const [year,n] of [['2020',2],['2021',2],['2022',1],['2023',1],['2024',2],['2025',1],['__unknown',1]]){
   await select.selectOption(year);assert.equal(await region.locator('article').count(),n);note(width,scope+'-SYNTHETIC','period='+year,n);
  }
  assert((await region.locator('article').textContent()).includes('Unknown / not established'));
  assert((await region.locator('article').textContent()).includes('TEST DATA — not verified research'));
  await select.selectOption('2022');await input.fill('GAPS');assert.equal(await region.locator('article').count(),0,'no interpolation across gap');
  await region.getByRole('button',{name:'Clear filters'}).press('Enter');assert.equal(await region.locator('article').count(),4);assert(await focus(input));assert.equal(await select.inputValue(),'');
 }
 await fits(page,'synthetic fixture');
 if(width===390||width===1280)await page.screenshot({path:`${output}/${width}-TEST-DATA-ONLY.png`,fullPage:true});
 await page.close();
}
async function handoffPlumbing(scope){
 // Instrumented test copy only: no production data file is written, accepted or published.
 const copy=JSON.parse(readFileSync(new URL('../data/funding-browser-periods.json',import.meta.url)));
 const id=scope==='tucson'?'craycroft-financing-2026':'PHX-WEB-009';
 const row=copy.records.find(r=>r.scope===scope&&r.id===id);
 const testURL='https://example.invalid/hap-pr30/TEST-ONLY-period-evidence';
 row.review={status:'test_only'};
 row.programPeriod={label:'TEST DATA ONLY · grant fiscal year 2042',years:['2042'],status:'test_only',explanation:'SYNTHETIC handoff plumbing check; not a verified funding finding.',evidence:[{url:testURL,locator:'TEST source reference · not research'}]};
 row.knownDates=[...(row.knownDates||[]),{date:'2099-01-01',years:['2099'],label:'TEST source/event 2099 · excluded from Funding years'}];
 const page=await open(1280,scope==='tucson'?'/search.html':'/phoenix/search.html');
 await page.route('**/assets/funding-periods-data.js',route=>route.fulfill({contentType:'application/javascript',body:'window.HAP_FUNDING_PERIODS_DATA='+JSON.stringify(copy).replaceAll('<','\\u003c')+';'}));
 await page.reload();await page.locator('[data-category="funding"]').click();
 assert.equal(await page.locator('#category-filter option[value="2099"]').count(),0,'test event date never becomes a funding year');
 await page.locator('#category-filter').selectOption('2042');
 assert((await page.locator('#count').textContent()).startsWith('1 match'));
 assert.equal(await page.locator('#results article').getAttribute('data-record-key'),row.key);
 assert((await page.locator('#results article').textContent()).includes('TEST DATA — not verified research'));
 for(const mode of ['compact','full']){
  await page.locator(mode==='compact'?'#print-compact':'#print').click();
  const report=page.locator('#print-sheet');
  assert((await report.textContent()).includes('TEST DATA ONLY · grant fiscal year 2042'));
  assert((await report.textContent()).includes('TEST DATA — not verified research'));
  assert((await report.textContent()).includes('TEST source/event 2099'));
  assert(await report.locator(`a[href="${testURL}"]`).count()>0,'current test period evidence reaches '+mode+' print');
  await page.getByRole('button',{name:'← Back to search',exact:true}).click();
  assert.equal(await page.locator('#category-filter').inputValue(),'2042');
  note(1280,scope+'-TEST-ONLY-handoff-plumbing',mode+' current period, event distinction and evidence reference',1);
 }
 await page.close();
}
try{
 for(let i=0;i<50;i++){try{assert((await fetch(base+'/search.html')).ok);break;}catch(e){if(i===49)throw e;await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)});
 for(const width of [320,390,768,1280]){
  for(const scope of ['tucson','phoenix']){await primary(width,scope);await category(width,scope);}
  await synthetic(width);
 }
 await pdf01TucsonCompact();
 for(const scope of ['tucson','phoenix'])await handoffPlumbing(scope);
 assert.deepEqual(errors,[],'no browser errors');
 writeFileSync(`${output}/results.json`,JSON.stringify({status:'passed',researchHandoffsAccepted:30,supplementalScopeRecord:1,syntheticDataIsNotResearch:true,checks:log,pdfs,errors},null,2));
 console.log(`PASS ${log.length} regional UI states at 320/390/768/1280px; ${pdfs.length} PDFs. Thirty research handoff records plus one scope check; synthetic edge cases remain test-only.`);
}catch(error){writeFileSync(`${output}/failure.json`,JSON.stringify({message:error.message,stack:error.stack,checks:log,errors},null,2));for(const [i,p] of (browser?.contexts().flatMap(c=>c.pages())||[]).entries())await p.screenshot({path:`${output}/failure-${i}.png`}).catch(()=>{});throw error;}
finally{await browser?.close();server?.kill();}
