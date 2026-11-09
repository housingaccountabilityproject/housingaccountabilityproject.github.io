const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.value='';this.textContent='';this.hidden=false;this.focused=false;}
 addEventListener(name,fn){this.events[name]=fn;}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 focus(){this.focused=true;}
 querySelector(tag){for(const c of this.children){if(c.tag===tag)return c;const child=c.querySelector(tag);if(child)return child;}return null;}
}
const elements={};for(const id of ['site-search-form','site-query','search-category','search-status','search-results','more-results','clear-search'])elements[id]=new Element();
elements['search-category'].value='all';
const document={getElementById:id=>elements[id],createElement:tag=>new Element(tag)};
const context={window:{},document};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/search-index.js'),'utf8'),context);vm.runInNewContext(fs.readFileSync(path.join(root,'assets/site-search.js'),'utf8'),context);
const data=context.window.HAP_SEARCH_INDEX.records;const query=(q,category='all')=>{elements['site-query'].value=q;elements['search-category'].value=category;let prevented=false;elements['site-search-form'].events.submit({preventDefault(){prevented=true;}});assert(prevented);return elements['search-results'].children;};
assert.match(elements['search-status'].textContent,/15 published Tucson and Pima County pages/);
for(const r of data){assert(!['catalog-empty','catalog-count','empty','count'].includes(r.url.split('#')[1]),r.url);assert(!r.text.includes('No matching records'),r.url);}
for(const [term,url,title] of [
 ['"Tucson House Renovation"','housing-projects.html#project-pub-005','Tucson House Renovation'],
 ['"Housing Choice Vouchers"','funding-explorer.html#fund-pub-007','Housing Choice Vouchers — Reported Funding Comparisons'],
 ['"Which Projects Do the CoC Funding Decisions Concern"','questions-records.html#q-020','Which Projects Do the CoC Funding Decisions Concern?']
]){const matches=query(term);assert(matches.some(x=>x.querySelector('a').href===url&&x.querySelector('a').textContent===title),term);}

for(const [term,anchor] of [['"Source References and Research Status Corrected"','audit-corrections-2026-11-06'],['"Housing Funding and Project Questions"','housing-questions-2026-11-06']]){
 const result=query(term,'Updates').find(x=>x.querySelector('a').href==='research-updates.html#'+anchor);
 assert(result,anchor);assert(result.className.includes('historical'));assert.match(result.querySelector('a').textContent,/^Historical wording: /);
 assert(result.children.some(x=>x.className==='result-caution'),anchor+' caution');
}
const reportResults=query('','Report');assert(reportResults.length>0);assert(reportResults.every(x=>x.children[0].textContent.includes('First edition, November 4; later corrections retained')));
let results=query('F-007','Findings');assert(results.length>=1);assert.equal(results[0].querySelector('a').href,'findings.html#f-007');assert.equal(results[0].querySelector('a').textContent,'What Still Needs Explaining in CDBG Spending?');assert(!results[0].className.includes('historical'));
results=query('Q-007','Evidence');assert(results.some(x=>x.querySelector('a').href==='evidence.html#q-007'));
for(const q of ['"El Portal"','SRC-094','1,284,589.71','CDBG formula','housing help'])assert(query(q).length>0,q);
assert.equal(query('impossible-match-947362').length,0);assert.match(elements['search-status'].textContent,/No matching sections/);
assert.equal(query('<img src=x onerror=alert(1)>').length,0);
results=query('CDBG');assert.equal(results.length,20);assert.equal(elements['more-results'].hidden,false);elements['more-results'].events.click();assert(elements['search-results'].children.length>20);assert(elements['search-results'].children[20].querySelector('a').focused);
results=query('','Findings');assert(results.length>=12);
elements['clear-search'].events.click();assert.equal(elements['site-query'].value,'');assert.equal(elements['search-category'].value,'all');assert.equal(elements['search-results'].children.length,0);assert(elements['site-query'].focused);
const current=data.filter(x=>x.url==='findings.html#f-007'&&!x.historical);const old=data.filter(x=>x.url==='findings.html#f-007'&&x.historical);assert.equal(current.length,1);assert.equal(old.length,1);assert.match(old[0].title,/Historical wording/);
// Legacy homepage results must open Tucson, including the unfragmented result.
for(const r of data.filter(r=>r.url.split('#')[0]==='index.html')){
 const expected=r.url.replace(/^index\.html/, 'tucson/index.html');
 const found=query('"'+r.title.replace(/^Historical wording: /,'')+'"');
 assert(found.some(x=>x.querySelector('a').href===expected),expected);
}
assert(data.length===351);assert(data.every(r=>!r.url.startsWith('phoenix/')));
// Missing-index state must be useful and must not submit a query.
const failContext={window:{},document};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/site-search.js'),'utf8'),failContext);assert(elements['site-search-form'].hidden);assert.match(elements['search-status'].textContent,/unavailable/);
console.log('PASS: search results, titles, current/historical separation, phrases, IDs, amounts, categories, zero results, hostile input, pagination/focus, clear/reset and missing-index fallback. DOM logic test, not visual browser QA.');
