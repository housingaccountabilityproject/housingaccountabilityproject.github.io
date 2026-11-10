const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../assets/category-search-core.js');
const dataset=require('../data/category-search.json');
const records=dataset.records;
const base={scope:'tucson',category:'sources',query:'',year:'',sourceType:'',subject:''};
let assertions=0;
function check(value,message){assert(value,message);assertions++;}
for(const scope of ['tucson','phoenix'])for(const category of ['funding','sources','questions','updates']){
 const entries=records.filter(r=>r.scope===scope&&r.category===category);
 const field=category==='sources'?'sourceType':category==='questions'?'subject':'year';
 const values=[...new Set(entries.flatMap(r=>field==='year'?[...core.searchYears(r),'__unindexed']:field==='subject'?r.topics:[r.sourceType]))];
 for(const value of ['',...values])for(const query of ['','HOME','CDBG','year:unknown','HOME year:2026','zz-no-result',...new Set(entries.flatMap(r=>core.searchYears(r)).map(y=>'year:'+y))]){
  const expected=entries.filter(r=>(!value||(field==='year'?(value==='__unindexed'?!core.searchYears(r).length:core.searchYears(r).includes(value)):field==='subject'?r.topics.includes(value):r.sourceType===value))&&core.terms(query).every(t=>t==='year:unknown'?!core.searchYears(r).length:/^year:20\d{2}$/.test(t)?core.searchYears(r).includes(t.slice(5)):core.fold(r.searchText).includes(t)));
  const actual=core.search(records,{...base,scope,category,query,[field]:value});check(actual.length===expected.length,'filter count');check(actual.every(r=>expected.includes(r)),'filter members');
 }
}
check(records.length===204,'Reviewed 204 records');check(new Set(records.map(r=>r.key)).size===204,'Unique stable keys');
const funding=records.filter(r=>r.category==='funding');check(funding.length===28,'28 Funding entries');check(funding.filter(r=>r.programPeriod.years.length).length===16,'16 supported period references');check(funding.filter(r=>!r.programPeriod.years.length).length===12,'12 unknown periods');
for(const r of records){check(!!r.yearBasis&&!!r.yearNote,'Date basis retained');check(r.years.every(y=>/^20\d{2}$/.test(y)),'Date year format');}
for(const id of ['BELL-03','BELL-04','PHX-CFP-WEB-006','PHX-WEB-012','craycroft-financing-2026','PHX-CFP-WEB-003'])check(!core.searchYears(records.find(r=>r.id===id)).length,'No event/guidance year substitution '+id);
check(core.search(records,{...base,scope:'phoenix',category:'funding',query:'year:2023'}).length===0,'No inferred 2023 program periods');
const source=records.find(r=>r.id==='SRC-100');check(source.correctedSourceUrl.includes('/downloads/8800?'),'Correct SRC-100');check(source.linkWarnings.some(w=>w.url.includes('/8818?')&&w.text.includes('Renton')),'Old mismatch retained visibly');
const context={window:{}};vm.runInNewContext(fs.readFileSync('assets/category-search-data.js','utf8'),context);check(JSON.stringify(context.window.HAP_CATEGORY_SEARCH_DATA)===JSON.stringify(dataset),'Committed browser bundle matches public snapshot');
check(!JSON.stringify(dataset).includes('/workspace/'),'No local paths');
console.log(`PASS: ${assertions} category-search assertions; 204 records, 28 funding entries, 16 supported periods, 12 unknown periods.`);

vm.runInNewContext(fs.readFileSync('assets/category-search-coverage.js','utf8'),context);
const periods=require('../data/funding-periods.json');check(periods.records.length===28,'28 sanitized public period records');check(!('evidenceReports' in periods)&&!('preparedFor' in periods),'No internal report wrapper');check(context.window.HAP_FULL_SEARCH_COVERAGE.records===require('../data/search-coverage.json').reduce((n,p)=>n+p.records,0),'Current generated full-page count');

check(!records.some(r=>r.sourceType==='Reference indexes'),'No misleading fallback group label');

const standard=require('../assets/category-search-card.js');
for(const r of records){const fields=standard.fields(r);check(fields.length>0&&fields.every(([k,v])=>k&&v),'Every standard field is explicit');check(!!standard.original(r).url,'Each card has an evidence link');}
check(standard.publication(records.find(r=>r.id==='craycroft-council-vote-2026-11-09'))==='2026-11-09T20:37:19-07:00','Use actual publication timestamp');
check(standard.publication(records.find(r=>r.id==='cdbg-reconciliation'))==='Publication date not established','Correction/review date is not publication');
check(standard.documentDate(records.find(r=>r.id==='PHX-CITY-027'))==='January 21, 2026','Document date distinct from FY2025 coverage');
check(standard.documentDate(records.find(r=>r.id==='SRC-100'))==='Not established in this index','Certification date is not document publication');
check(standard.summary(records.find(r=>r.id==='federal-allocations-2026')).includes('$9,613,482.81'),'Allocation amounts and measures retained');
console.log('PASS approved card standard: explicit missing fields, source references, separate document/coverage/publication dates.');
