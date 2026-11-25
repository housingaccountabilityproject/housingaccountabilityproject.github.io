/* Synthetic period semantics and production-data isolation; no research verification is implied. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fixture=JSON.parse(read('scripts/fixtures/funding-period-framework.json'));
const published=JSON.parse(read('data/funding-browser-periods.json'));
const original=JSON.parse(read('data/funding-periods.json'));
const approved=JSON.parse(read('scripts/fixtures/_nov19-approved-lists.json'));
const expectedTotal=approved.baselinePeriodKeys.length+approved.periodAdditions.length;
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
equal(published.records.length,expectedTotal,'existing annotations plus independently reviewed additions');
equal(published.requiredKeys,approved.baselinePeriodKeys,'required baseline identities are unchanged');
for(const [key,hash] of Object.entries(approved.baselinePeriodHashes)){
 const row=published.records.find(r=>r.key===key);assert(row,key+' baseline row retained');assertions++;
 let historical=row;
 if(key==='tucson:funding-explorer.html#county-funding-fy27-q1'){
  const archive='https://housingaccountabilityproject.github.io/docs/reports/one-pima-fy2027-q1-original.pdf';
  const retired='https://content.civicplus.com/api/assets/506bd603-1c7d-4568-b6a5-4084878d74bf';
  equal((JSON.stringify(row).match(new RegExp(archive.replaceAll('.','\\.'),'g'))||[]).length,3,'Exactly three original date/period citations repaired');
  assert(!JSON.stringify(row).includes(retired),'No retired active period citation');assertions++;
  historical=JSON.parse(JSON.stringify(row).replaceAll(archive,retired));
 }
 equal(createHash('sha256').update(JSON.stringify(historical)).digest('hex'),hash,key+' baseline metadata unchanged after the exact citation-only transition');
}
const bundle=vm.createContext({window:{}});vm.runInContext(read('assets/funding-periods-data.js'),bundle);
equal(bundle.window.HAP_FUNDING_PERIODS_DATA,published,'production bundle matches the handoff ledger exactly');
equal(published.records.filter(r=>r.scope==='tucson').length,12,'Tucson scope retained');
equal(published.records.filter(r=>r.scope==='phoenix').length,approved.phoenixFunding.expectedIds.length,'Phoenix scope plus reviewed additions');
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
// The same mixed-record contract applies to both regions and both unknown aliases.
for(const scope of ['tucson','phoenix']){
 const mixed=structuredClone(fixture),r=mixed.records.find(r=>r.scope===scope&&r.id.endsWith('SINGLE'));
 r.programPeriod.hasUnknownComponent=true;
 const m=load(mixed),record={...r,category:'funding',topics:[],searchText:''};
 for(const alias of ['__unknown','__unindexed'])equal(m.api.matches(r,alias),true,scope+' mixed matches '+alias);
 equal(m.api.matches(r,'2024'),true,scope+' mixed still matches supported year');
 equal(m.api.matches(r,'__not_applicable'),false,scope+' mixed is not guidance');
 equal(m.api.values(r),['2024','__unknown'],scope+' mixed options include both classifications');
 equal(m.core.matches(record,{scope,category:'funding',year:'__unindexed',query:'year:2024'}),true,scope+' known-year query intersects unknown component');
 equal(m.core.matches(record,{scope,category:'funding',year:'2024',query:'year:unknown'}),true,scope+' unknown query intersects known year');
}
const live=load(published),byId=id=>published.records.find(r=>r.id===id);
equal(published.records.filter(r=>r.review.status==='accepted_handoff').length,expectedTotal,'all retained and added annotations have provenance');
equal(live.api.ready,true,'valid extended annotation set loads');
const onlyBaseline=structuredClone(published);onlyBaseline.records=onlyBaseline.records.filter(r=>approved.baselinePeriodKeys.includes(r.key));
equal(load(onlyBaseline).api.ready,true,'baseline identities load without requiring the new total');
const missing=structuredClone(published);missing.records.shift();equal(load(missing).api.ready,false,'missing baseline identity rejects readiness');
const duplicate=structuredClone(published);duplicate.records.push(duplicate.records[0]);equal(load(duplicate).api.ready,false,'duplicate identity rejects readiness');
const malformed=structuredClone(published);malformed.records.push({key:'phoenix:READINESS-PROBE',scope:'phoenix',id:'READINESS-PROBE'});equal(load(malformed).api.ready,false,'malformed addition rejects readiness');
const extended=structuredClone(published),probe=structuredClone(published.records.at(-1));probe.id='READINESS-PROBE';probe.key='phoenix:'+probe.id;extended.records.push(probe);
equal(load(extended).api.ready,true,'a structurally valid further addition has no fixed-total guard');
for(const expected of approved.periodAdditions){
 const row=byId(expected.id);equal(live.api.years(row),expected.years,expected.id+' independently supported years');
 equal(live.api.matches(row,'__unknown'),expected.unknown,expected.id+' explicit unknown status');
 for(const year of ['2024','2025','2026','2027','2028'])equal(live.api.matches(row,year),expected.years.includes(year),expected.id+' period year '+year);
}
equal(live.api.years(byId('BELL-06')),['2019','2020'],'checked HOME pool vintages, not adoption year alone');
equal(live.api.years(byId('county-price-funding-2026')),['2025','2026','2027','2028','2029','2030','2031','2032'],'full City performance term, each supported overlapping year');
equal(live.api.matches(byId('county-price-funding-2026'),'2033'),false,'no year beyond documented term');
equal(live.api.years(byId('county-funding-fy27-q1')),['2026','2027'],'quarter interval year and explicit fiscal-label alias');
const q=byId('county-funding-fy27-q1').programPeriod.periods[0];
equal(q.yearMatches.find(m=>m.year==='2027').basis,'source_year_label','FY2027 is not calendar-2027 activity');
equal(q.yearMatches.find(m=>m.year==='2026').basis,'calendar_overlap','quarter calendar overlap is 2026');
const addedKnown=approved.periodAdditions.filter(r=>r.years.length).length,addedUnknown=approved.periodAdditions.filter(r=>r.unknown).length;
for(const [scope,known,unknown,na] of [['tucson',11,1,0],['phoenix',approved.baselinePhoenixPeriodCounts.known+addedKnown,approved.baselinePhoenixPeriodCounts.unknown+addedUnknown,approved.baselinePhoenixPeriodCounts.notApplicable]]){
 const rs=published.records.filter(r=>r.scope===scope);
 equal(rs.filter(r=>live.api.years(r).length>0).length,known,scope+' supported record count');
 equal(rs.filter(r=>live.api.matches(r,'__unknown')).length,unknown,scope+' unknown includes mixed and browser-only record');
 equal(rs.filter(r=>live.api.matches(r,'__not_applicable')).length,na,scope+' guidance separate');
}
equal(live.api.years(byId('MC-PLAN-WEB-001')),[],'plan horizon does not become funding years');
for(const id of ['BELL-06','PHX-WEB-012']){
 equal(live.api.matches(byId(id),'__unknown'),true,id+' unresolved component retained');
 equal(live.api.hasUnknown(byId(id)),true,id+' mixed flag');
}
console.log(`PASS ${assertions} funding-period assertions: single years, ranges, noncontinuous periods, unknowns, handoff overrides and city/test-data isolation. Accepted research batches: ${published.accepted_batches.length}.`);
