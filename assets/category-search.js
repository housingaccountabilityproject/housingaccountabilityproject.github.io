(()=>{'use strict';
const dataset=window.HAP_CATEGORY_SEARCH_DATA,core=window.HAPPreviewCore,standard=window.HAPCardStandard;
const records=dataset?.records;
const $=id=>document.getElementById(id),names={funding:'Funding',sources:'Sources',questions:'Questions',updates:'Updates'},scopeNames={phoenix:'Phoenix and Maricopa County',tucson:'Tucson / Pima County'};
const fallbackRoot=document.body.dataset.searchScope==='phoenix'?'../':'';
let state={scope:document.body.dataset.searchScope||'tucson',category:'sources',query:'',year:'',sourceType:'',subject:''},page=1,found=[],pageSize=6,printMode='full';
if (!Array.isArray(records) || !core || !standard || !window.HAPSearchOptions) {
  $('count').textContent = 'Search could not load. Use the full evidence browser or the regional research pages below.';
  $('count').setAttribute('role', 'alert');
  $('search-form').hidden = true;
  $('empty').hidden = false;
  $('empty-text').textContent = 'The interactive index is unavailable. Browse the full evidence and regional research pages using their normal links.';
  $('empty-reset').hidden = true;
  document.querySelectorAll('[data-category], #print, #print-compact').forEach(button => { button.disabled = true; });
  $('full-search').textContent = 'Open the full evidence browser';
  $('full-search').href = fallbackRoot + (document.body.dataset.searchScope === 'phoenix' ? 'phoenix/records.html' : 'evidence.html');
  return;
}
const options = window.HAPSearchOptions.register({
  surface: 'category-' + state.scope,
  mount: $('search-panel'),
  state: () => ({...state, page}),
  restore: shared => { applyShared(shared); render(); }
});
const shared = window.HAPSearchOptions.incoming('category-' + state.scope);
function applyShared(shared) {
  if (!shared || shared.scope !== state.scope) return;
  state.category = 'sources';
  for (const key of ['query', 'year', 'sourceType', 'subject']) state[key] = '';
  if (Object.hasOwn(names, shared.category)) state.category = shared.category;
  for (const key of ['query', 'year', 'sourceType', 'subject']) {
    if (typeof shared[key] === 'string' && shared[key].length <= 4096) state[key] = shared[key];
  }
  page = Number.isSafeInteger(shared.page) && shared.page > 0 ? shared.page : 1;
  $('query').value = state.query;
}
applyShared(shared);

function node(tag,text,cls){let e=document.createElement(tag);if(text!==undefined)e.textContent=String(text).replace(/this preview/gi,'this search').replace(/preview supplies/g,'search supplies').replace(/four-category preview/g,'four-category search');if(cls)e.className=cls;return e;}
function link(label,url,cls){let a=node('a',label,cls);a.href=url;a.target='_blank';a.rel='noopener';return a;}
function excerpt(s,n=210){s=String(s||'');if(s.length<=n)return s;let end=s.lastIndexOf(' ',n);return s.slice(0,end>n/2?end:n)+'…';}
function paragraph(text,cls){return node('p',text,cls);}
function cautionList(r){return r.caveats.filter(Boolean);}
function evidenceList(items,r,print){const ul=node('ul');for(const e of items){const li=node('li');if(e.quote)li.append(paragraph(e.quote));li.append(link(e.locator||'Open date evidence',e.url));if(print)li.append(paragraph(e.url,'print-url'));ul.append(li);}return ul;}
function body(r,print=false){let box=node('div');
  if(r.category==='funding'&&r.programPeriod){const p=r.programPeriod;box.append(node('h4','Fiscal / program period'),paragraph(p.label),paragraph(p.explanation||''));if(p.start||p.end)box.append(paragraph('Explicit interval: '+(p.start||'Start not established')+' to '+(p.end||'End not established')));if(p.periods?.length)for(const part of p.periods)box.append(paragraph(part.label||part.explanation||''));if(p.evidence?.length)box.append(node('h4','Period evidence'),evidenceList(p.evidence,r,print));if(r.periodLeads?.length){box.append(node('h4','Unverified period leads · excluded from year filter'));for(const lead of r.periodLeads){box.append(paragraph(lead.label||lead.description||''),paragraph(lead.explanation||lead.note||''));if(lead.evidence?.length)box.append(evidenceList(lead.evidence,r,print));}}if(r.knownDates?.length){box.append(node('h4','Known source / event dates · not active periods'));for(const d of r.knownDates){box.append(paragraph((d.date?d.date+' · ':'')+d.label),paragraph(d.explanation||''));if(d.evidence?.length)box.append(evidenceList(d.evidence,r,print));}}box.append(paragraph('A stated reporting, planned or agreement period does not establish the full lifetime of a program. Earlier date-review context is retained below.'));}
  if(r.yearBasis)box.append(node('h4',r.category==='funding'?'Source / event date-review context':'Year used by search'),paragraph((r.years.length?r.years.join(', '):'Year not established')+' · '+r.yearBasis),paragraph(r.yearNote||''));
  if(r.yearSourceCheck)box.append(node('h4','Date check status'),paragraph(r.yearSourceCheck));
  if(r.yearEvidence?.length){let evidence=node('ul');for(const item of r.yearEvidence){let li=node('li');const warning=r.linkWarnings?.find(w=>w.url===item.url);if(item.quote)li.append(paragraph(item.quote));li.append(link((warning?'Mismatched link · ':'')+(item.locator||'Open the date evidence'),item.url));if(warning)li.append(paragraph(warning.text,'caution'));if(print)li.append(paragraph(item.url,'print-url'));evidence.append(li);}box.append(node('h4','Date evidence & locators'),evidence);}
  if(r.label)box.append(node('h4','Published status / label'),paragraph(r.label));
  if(r.documentDate){box.append(node('h4','Document date and role'),paragraph(r.documentDate.date+' · '+r.documentDate.role));box.append(link(r.documentDate.locator,r.documentDate.url));}if(r.verificationChecks?.length){box.append(node('h4','Separate source-verification checks'));r.verificationChecks.forEach(check=>box.append(paragraph(standard.formatInstant(check.checked_at)+' · '+check.outcome+' · '+check.scope)));}if(r.metadata.length){let dl=node('dl');for(const [k,v] of r.metadata){dl.append(node('dt',k),node('dd',typeof v==='string'?standard.formatInstant(v):v));}box.append(dl);}
  if(r.displaySummary)box.append(node('h4','Corrected summary'),paragraph(r.displaySummary));
  if(r.summary.length){box.append(node('h4',r.displaySummary?'Earlier published summary · retained for comparison':'Record summary'));r.summary.forEach(v=>box.append(paragraph(v)));}
  if(r.caveats.length){box.append(node('h4','Qualifications & limits'));r.caveats.forEach(v=>box.append(paragraph(v)));}
  if(r.notes.length){box.append(node('h4','Full record notes & context'));if(r.yearSourceCheck)box.append(paragraph('Earlier review and access notes are retained below. See the date check above for the newer, date-specific check.'));r.notes.forEach(v=>box.append(paragraph(v)));}
  if(r.sourceIds.length){box.append(node('h4','Source / related record IDs'),paragraph(r.sourceIds.join(' · ')));}
  if(r.aliases.length)box.append(paragraph('Other published identifiers: '+r.aliases.join(' · ')));
  const links=[...(r.correctedSourceUrl?[{title:'Corrected Craycroft archive link',url:r.correctedSourceUrl}]:[]),...r.originals,...r.links,{title:'Read this record on the live site',url:r.url},{title:'Read the finding in context',url:r.contextUrl}];let seen=new Set(),ul=node('ul');
  for(const l of links){if(seen.has(l.url))continue;seen.add(l.url);let li=node('li');const warning=r.linkWarnings?.find(w=>w.url===l.url);li.append(link(warning?'Mismatched source link · '+l.title:l.title,l.url));if(warning)li.append(paragraph(warning.text,'caution'));if(print)li.append(paragraph(l.url,'print-url'));ul.append(li);}
  box.append(node('h4','Original sources & linked context'),ul);return box;
}
function card(r){const a=node('article',undefined,'card');a.dataset.recordKey=r.key;let m=node('div',undefined,'card-main'),head=node('div',undefined,'card-head');
  head.append(paragraph(scopeNames[r.scope]+' · '+r.kind,'record-label'),link(r.id,r.url,'record-id'));m.append(head,node('h3',r.title));
  const dl=node('dl',undefined,'card-fields');for(const [label,value] of standard.fields(r,window.HAP_FUNDING_PROGRAM_NAMES?.[r.key]))dl.append(node('dt',label),node('dd',value));m.append(dl);
  const summary=standard.summary(r),summaryLabel={funding:'Amount & what it represents',sources:'Source context',questions:'What we know',updates:'What changed'}[r.category];
  if(summary){const p=paragraph(undefined,'summary');if(r.category==='questions'&&!/^(Documented:|Resolved)/i.test(summary)){m.append(paragraph('What we know: this entry identifies a question or evidence need; no separate answer is labeled.','summary'));p.append(node('strong','Question context: '));}else p.append(node('strong',summaryLabel+': '));if(r.category==='funding'&&!/\$[\d]/.test(summary))p.append('A monetary amount is not established in this record. ');p.append(excerpt(summary,280));if(summary.length>280)p.append(' Full context in details.');m.append(p);}
  const caveats=cautionList(r);if(caveats.length){const label=r.category==='questions'?'What remains open':r.category==='updates'?'Remaining limits':'Key caveat';let p=paragraph(undefined,'caution');p.append(node('strong',label+': '),excerpt(caveats[0],280));if(caveats[0].length>280)p.append(' Full qualification in details.');m.append(p);}else m.append(paragraph(r.category==='questions'?'What remains open: see the question and evidence needs in details.':'Limits: no separate qualification is stated here; read the full record.','caution'));
  let detail=node('details',undefined,'record-detail'),summaryControl=node('summary','Full record, dates & source notes');detail.append(summaryControl);let detailBody=body(r);detailBody.className='detail-body';detail.append(detailBody);
  const source=standard.original(r),warning=r.linkWarnings?.some(w=>w.url===source.url);let actions=node('div',undefined,'card-actions');actions.append(link(r.correctedSourceUrl?'Open corrected source ↗':warning?'Inspect mismatched source link ↗':'Source / evidence ↗',source.url));if(caveats.length>1)actions.append(node('span',`${caveats.length-1} more qualification${caveats.length>2?'s':''} in details`,'count'));m.append(actions,detail);a.append(m);return a;
}
function appendPrintFields(a,r){
 const fields=node('dl',undefined,'print-fields');
 for(const [label,value] of standard.fields(r,window.HAP_FUNDING_PROGRAM_NAMES?.[r.key]))fields.append(node('dt',label),node('dd',value));
 a.append(fields);
}
function compactRecord(r){
 const a=node('article',undefined,'print-record compact-record');a.dataset.recordKey=r.key;
 a.append(paragraph(scopeNames[r.scope]+' · '+names[r.category]),node('h2',r.title),paragraph('Record ID: '+r.id));
 appendPrintFields(a,r);
 if(r.category==='funding'){
  const p=r.programPeriod;a.append(paragraph(p?.label||'Active period: not yet verified'));
  if(p?.explanation)a.append(paragraph(p.explanation));
  if(r.knownDates?.length)a.append(paragraph('Known source / event dates, not active periods: '+r.knownDates.map(d=>(d.date?d.date+' · ':'')+d.label).join('; ')));
 }else{a.append(paragraph((r.years.length?r.years.join(', '):'Year not established')+' · '+r.yearBasis));if(r.yearNote)a.append(paragraph(r.yearNote));}
 if(r.label)a.append(paragraph(r.label));
 a.append(paragraph(standard.summary(r)));
 for(const caution of r.caveats)a.append(paragraph(caution,'caution'));
 if(r.sourceIds.length)a.append(paragraph('Source / related IDs: '+r.sourceIds.join(' · ')));
 const links=[...(r.correctedSourceUrl?[{title:'Corrected source',url:r.correctedSourceUrl}]:[]),...r.originals,...r.links,...(r.programPeriod?.evidence||[]).map(e=>({title:e.locator||'Period evidence',url:e.url})),{title:'Full record and evidence notes',url:r.url},{title:'Finding in context',url:r.contextUrl}];
 const seen=new Set();for(const l of links){if(!l.url||seen.has(l.url))continue;seen.add(l.url);const warning=r.linkWarnings?.find(w=>w.url===l.url);const p=paragraph((warning?'Mismatched historical link · ':'')+l.title+' ','print-url');p.append(link(l.url,l.url));a.append(p);if(warning)a.append(paragraph(warning.text,'caution'));}
 return a;
}
function printRecord(r){let a=node('article',undefined,'print-record');a.dataset.recordKey=r.key;a.append(paragraph(scopeNames[r.scope]+' · '+names[r.category]+' · '+r.kind),node('h2',r.title),paragraph('Record ID: '+r.id));appendPrintFields(a,r);a.append(body(r,true));return a;}
function filterSpec() {
  if (state.category === 'sources') return {key:'sourceType',label:'Source type',all:'All source types',values:r=>[r.sourceType],help:'Grouping follows the public source labels. Type year:2025 or year:unknown for a source-year limit.'};
  if (state.category === 'questions') return {key:'subject',label:'Question subject',all:'All subjects',values:r=>r.topics,help:'Topics follow the public question tags. Type year:2025 or year:unknown for a year limit.'};
  return {key:'year',label:state.category==='updates'?'Update year':'Fiscal / program year',all:'All years',
    values:r=>state.category==='funding' ? (r.programPeriod.status==='not_applicable' ? ['__not_applicable'] : r.programPeriod.years.length ? r.programPeriod.years : ['__unindexed']) : r.years.length ? r.years : ['__unindexed'],
    help:state.category==='funding'?'Award fiscal years and source-backed coverage are separate from complete performance periods. Unknown periods and guidance with no applicable period are separate choices.':'Years follow the existing dated update records.'};
}
function describe(includeQuery=true){const spec=filterSpec(),value=state[spec.key];return [scopeNames[state.scope],names[state.category],includeQuery?(state.query?'Search: “'+state.query+'”':'No search terms'):'',value?spec.label+': '+(value==='__not_applicable'?'Not applicable':value==='__unindexed'?(state.category==='funding'?'Active period: not yet verified':'Year not established'):value):spec.all].filter(Boolean).join(' · ');}
function preparePrint(){const sheet=$('print-sheet');sheet.replaceChildren();const controls=node('div',undefined,'print-controls');let back=node('button','← Back to search'),printNow=node('button','Print / Save as PDF','primary');back.addEventListener('click',()=>{document.body.classList.remove('show-print-view');sheet.replaceChildren();options.leavePrint();$(printMode==='compact'?'print-compact':'print').focus();});printNow.addEventListener('click',()=>window.print());controls.append(back,printNow);const head=node('div',undefined,'print-header');head.append(node('h1','HAP research search'),paragraph((printMode==='compact'?'Compact results':'Full evidence')+' · '+describe(options.includeTerms())),paragraph(found.length+' matching records. All matches are included, not only the current page.'),paragraph('Public records with date-focused checks. Periods, source/event dates and qualifications remain separate. This is not a full financial audit.'));head.append(paragraph('Prepared for printing: '+window.HAPSearchOptions.preparedAt()+'. This is a print time, not a research update.'));if(dataset.researchSnapshots?.[state.scope])head.append(paragraph('Research snapshot: '+dataset.researchSnapshots[state.scope]));sheet.append(controls,head);options.showPrint(sheet);found.forEach(r=>sheet.append(printMode==='compact'?compactRecord(r):printRecord(r)));if(printMode==='compact')head.append(paragraph('Condensed records with essential qualifications and source links. Choose Full evidence print in search for every retained date check, note and source locator.'));}
function updateFilter(){const spec=filterSpec(),select=$('category-filter'),base=records.filter(r=>r.scope===state.scope&&r.category===state.category),values=[...new Set(base.flatMap(spec.values))].sort((a,b)=>spec.key==='year'?b.localeCompare(a):a.localeCompare(b));select.replaceChildren();for(const value of ['',...values]){const count=core.search(records,{...state,[spec.key]:value}).length;const label=value===''?spec.all:value==='__not_applicable'?'Not applicable':value==='__unindexed'?(state.category==='funding'?'Active period: not yet verified':'Year not established'):value;const option=node('option',label+' ('+count+')');option.value=value;select.append(option);}select.value=state[spec.key];$('filter-label').textContent=spec.label;$('filter-help').textContent=spec.help;}
function renderAnnualCoverage() {
 const coverage=dataset.annualReportCoverage,region=coverage?.regions[state.scope];
 if(!region)return;
 const details=node('details');details.id='annual-report-coverage';
 details.append(node('summary','Selected annual report coverage · '+region.issuer),paragraph(coverage.scope));
 const add=row=>{
  const item=node('li');item.append(paragraph(row.target_period+' · '+row.status),link(row.source_label,row.url),paragraph(row.locator),paragraph(row.note||''));
  if(row.checked_at)item.append(paragraph('Separate source check: '+standard.formatInstant(row.checked_at)));
  return item;
 };
 const list=node('ul');region.reporting_periods.forEach(row=>list.append(add(row)));
 details.append(list,node('h4','Separate plan period'));
 const planned=node('ul');planned.append(add(region.separate_plan));details.append(planned);
 $('coverage-audit').append(details);
}
function render(focus=false){options.clearLink();found=core.search(records,state);updateFilter();page=Math.min(page,Math.max(1,Math.ceil(found.length/pageSize)));document.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===state.scope)));document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===state.category)));$('search-title').textContent='2. Search '+names[state.category];$('results-title').textContent=({sources:'Source',questions:'Question',updates:'Update',funding:'Funding'}[state.category])+' matches';$('active-search').textContent=describe();let start=(page-1)*pageSize,end=Math.min(start+pageSize,found.length);$('count').textContent=`${found.length} match${found.length===1?'':'es'} · ${scopeNames[state.scope]}${found.length?` · Showing ${start+1}–${end}`:''}`;$('results').replaceChildren(...found.slice(start,end).map(card));$('empty').hidden=found.length>0;$('empty-text').textContent=`Nothing matched this combination in ${names[state.category]} for ${scopeNames[state.scope]}. Try fewer words, clear the filter, or choose another category or area.`;$('pagination').hidden=found.length<=pageSize;$('page-count').textContent=`Page ${page} of ${Math.max(1,Math.ceil(found.length/pageSize))}`;$('previous').disabled=page===1;$('next').disabled=end>=found.length;$('print').disabled=!found.length;$('print-compact').disabled=!found.length;$('coverage-text').textContent=dataset.coverage[state.scope];$('coverage-audit').replaceChildren();for(const item of dataset.coverageAudit?.[state.scope]||[]){const coverage=window.HAP_FULL_SEARCH_COVERAGE;let p=paragraph(coverage&&item.text.startsWith('Compared against the public full-page index:')?`Compared against the public full-page index: ${coverage.records} text chunks across ${coverage.pages} pages. Those chunks overlap and include glossary, help and navigation; they are not separate research records.`:item.text);if(item.url){p.append(' ',link('Open public page ↗',item.url));}$('coverage-audit').append(p);}renderAnnualCoverage();$('full-search').href=fallbackRoot+(state.scope==='phoenix'?'phoenix/records.html':'search-all.html');$('print-sheet').replaceChildren();if(focus)$('results-title').focus();}
function reset(){options.reset();state.query='';state.year='';state.sourceType='';state.subject='';$('query').value='';page=1;render();}
document.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>{state.scope=b.dataset.scope;reset();}));document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.category;reset();}));
$('search-form').addEventListener('submit',e=>{e.preventDefault();state.query=$('query').value.trim();page=1;render();});$('query').addEventListener('input',()=>{state.query=$('query').value.trim();page=1;render();});$('category-filter').addEventListener('change',()=>{state[filterSpec().key]=$('category-filter').value;page=1;render();});for(const id of ['reset','empty-reset'])$(id).addEventListener('click',()=>{reset();$('query').focus();});$('next').addEventListener('click',()=>{page++;render(true);$('results-title').scrollIntoView({block:'start'});});$('previous').addEventListener('click',()=>{page--;render(true);$('results-title').scrollIntoView({block:'start'});});$('print').addEventListener('click',()=>{printMode='full';preparePrint();document.body.classList.add('show-print-view');window.scrollTo(0,0);$('print-sheet').querySelector('button').focus();});$('print-compact').addEventListener('click',()=>{printMode='compact';preparePrint();document.body.classList.add('show-print-view');window.scrollTo(0,0);$('print-sheet').querySelector('button').focus();});window.addEventListener('beforeprint',()=>{if(!$('print-sheet').childElementCount)preparePrint();});window.addEventListener('afterprint',()=>{if(!document.body.classList.contains('show-print-view')){$('print-sheet').replaceChildren();options.leavePrint();}});
render();
})();
