/* Synthetic period semantics and production-data isolation; no research verification is implied. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fixture=JSON.parse(read('scripts/fixtures/funding-period-framework.json'));
const published=JSON.parse(read('data/funding-browser-periods.json'));
const original=JSON.parse(read('data/funding-periods.json'));
function load(data){
 const context=vm.createContext({window:{HAP_FUNDING_PERIODS_DATA:data}});
 vm.runInContext(read('assets/funding-periods.js'),context);
 vm.runInContext(read('assets/category-search-core.js'),context);
 return {api:context.window.HAPFundingPeriods,core:context.window.HAPPreviewCore};
}
const {api,core}=load(fixture);
let assertions=0;
function equal(a,b,why){assert.deepEqual(a===undefined?a:JSON.parse(JSON.stringify(a)),b,why);assertions++;}
equal(fixture.testData,true,'fixture is explicitly synthetic');
const cases={SINGLE:['2024'],RANGE:['2020','2021','2022','2023'],GAPS:['2020','2021','2024','2025'],UNKNOWN:[]};
for(const [scope,prefix] of [['tucson','TUC'],['phoenix','PHX']])for(const [name,expected] of Object.entries(cases)){
 const id=`TEST-${prefix}-${name}`,row=api.get(scope,id);
 equal(row.review.status,'test_only',id+' test label');
 equal(api.get(scope==='tucson'?'phoenix':'tucson',id),undefined,id+' city isolation');
 equal(api.years(row),expected,id+' exact coverage (no gap filling)');
 equal(api.reviewLabel(row),'TEST DATA — not verified research',id+' visible review status');
 equal(api.matches(row,'__unknown'),name==='UNKNOWN',id+' unknown classification');
 for(const year of ['2020','2021','2022','2023','2024','2025','2026']){
  equal(api.matches(row,year),expected.includes(year),id+' year='+year);
  const record={...row,category:'funding',years:['2026'],topics:[],searchText:id};
  const state={scope,category:'funding',query:'',year,sourceType:'',subject:''};
  equal(core.matches(record,state),expected.includes(year),id+' shared-search year='+year);
  equal(core.matches(record,{...state,year:'',query:'year:'+year}),expected.includes(year),id+' year query='+year);
 }
}
// A checked handoff must override stale original metadata in every shared-search path.
const handoff=structuredClone(fixture);
const sample=handoff.records[0];sample.programPeriod={years:[],status:'not_applicable',label:'TEST guidance',explanation:'Synthetic status change'};
const integrated=load(handoff),old={...fixture.records[0],category:'funding',topics:[],searchText:''};
equal(integrated.core.matches(old,{scope:'tucson',category:'funding',year:'__not_applicable',query:''}),true,'handoff status overrides old status');
equal(integrated.core.matches(old,{scope:'tucson',category:'funding',year:'__unindexed',query:''}),false,'not-applicable remains distinct from unknown');
equal(published.records.length,31,'all existing Funding annotations retained');
const bundle=vm.createContext({window:{}});vm.runInContext(read('assets/funding-periods-data.js'),bundle);
equal(bundle.window.HAP_FUNDING_PERIODS_DATA,published,'production bundle matches the handoff ledger exactly');
equal(published.records.filter(r=>r.scope==='tucson').length,12,'Tucson scope retained');
equal(published.records.filter(r=>r.scope==='phoenix').length,19,'Phoenix scope retained');
for(const row of published.records){
 assert(!row.id.startsWith('TEST-'),'no synthetic IDs in production');assertions++;
 assert(['awaiting_handoff','accepted_handoff'].includes(row.review.status),row.id+' explicit review state');assertions++;
 if(row.review.status==='accepted_handoff'){
  assert(published.accepted_batches.some(b=>b.id===row.review.batch_id)&&row.review.source_basis&&row.programPeriod.evidence.length,row.id+' accepted handoff provenance');assertions++;
 }
 const existing=original.records.find(r=>r.key===row.key);
 if(existing&&row.review.status==='awaiting_handoff'){
  const normalized=structuredClone(existing.programPeriod);
  if(!normalized.years.length&&normalized.status!=='not_applicable')normalized.label='Unknown / not established';
  equal(row.programPeriod,normalized,row.id+' only existing published period metadata');
  equal(row.knownDates,existing.knownDates,row.id+' source/event context retained');
 }
}
for(const page of ['search.html','phoenix/search.html','funding-explorer.html','phoenix/records.html']){
 assert(!read(page).includes('funding-period-framework'),page+' does not load synthetic data');assertions++;
}
console.log(`PASS ${assertions} funding-period assertions: single years, ranges, noncontinuous periods, unknowns, handoff overrides and city/test-data isolation. Accepted research batches: ${published.accepted_batches.length}.`);
