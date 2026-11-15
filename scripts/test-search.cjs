const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.value='';this.textContent='';this.hidden=false;this.focused=false;this.dataset={};}
 set id(value){this._id=value;elements[value]=this;}
 get id(){return this._id;}
 after(){}
 scrollIntoView(){}
 setAttribute(name,value){this[name]=value;}
 addEventListener(name,fn){this.events[name]=fn;}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 focus(){this.focused=true;}
 querySelector(tag){for(const c of this.children){if(c.tag===tag)return c;const child=c.querySelector(tag);if(child)return child;}return null;}
}
const elements={};for(const id of ['site-search-form','site-query','search-category','search-status','search-results','more-results','clear-search'])elements[id]=new Element();
elements['search-category'].value='all';
const document={querySelector:()=>new Element(),getElementById:id=>elements[id],createElement:tag=>new Element(tag)};
const history={state:null,replaceState(s){this.state=s;},pushState(s){this.state=s;}};
const context={history,location:{href:'https://housingaccountabilityproject.github.io/search-all.html'},performance:{getEntriesByType:()=>[{type:'navigate'}]},window:{addEventListener(){},HAPSearchOptions:{register:()=>({clearLink(){},reset(){},includeTerms:()=>false}),incoming:()=>null}},document};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/search-index.js'),'utf8'),context);vm.runInNewContext(fs.readFileSync(path.join(root,'assets/list-browser.js'),'utf8'),context);vm.runInNewContext(fs.readFileSync(path.join(root,'assets/site-search.js'),'utf8'),context);
const data=context.window.HAP_SEARCH_INDEX.records;const query=(q,category='all')=>{elements['site-query'].value=q;elements['search-category'].value=category;let prevented=false;elements['site-search-form'].events.submit({preventDefault(){prevented=true;}});assert(prevented);return elements['search-results'].children.filter(x=>!x.hidden);};
assert.match(elements['search-status'].textContent,/16 pages of Tucson and Pima County and shared Arizona research/);
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
results=query('CDBG');assert.equal(results.length,6);assert.equal(elements['more-results'].hidden,true);assert(context.window.HAP_SEARCH_PRINT.state().matches>20);elements['broader-next'].events.click();assert.equal(elements['search-results'].children.filter(x=>!x.hidden).length,6);assert.equal(elements['broader-page'].textContent,'Page 2 of '+Math.ceil(context.window.HAP_SEARCH_PRINT.state().matches/6));assert(elements['search-status'].focused);
results=query('','Findings');assert.equal(results.length,6);assert(context.window.HAP_SEARCH_PRINT.state().matches>=12);
elements['clear-search'].events.click();assert.equal(elements['site-query'].value,'');assert.equal(elements['search-category'].value,'all');assert.equal(elements['search-results'].children.length,0);assert(elements['site-query'].focused);
const current=data.filter(x=>x.url==='findings.html#f-007'&&!x.historical);const old=data.filter(x=>x.url==='findings.html#f-007'&&x.historical);assert.equal(current.length,1);assert.equal(old.length,1);assert.match(old[0].title,/Historical wording/);
assert(data.some(r=>r.url.split('#')[0]==='tucson/index.html'));
assert(data.some(r=>r.url==='about.html'&&r.text.includes('SUM Bible College & Theological Seminary')));
// The compatibility mapping still accepts legacy homepage URLs.
for(const r of data.filter(r=>r.url.split('#')[0]==='index.html')){
 const expected=r.url.replace(/^index\.html/, 'tucson/index.html');
 const found=query('"'+r.title.replace(/^Historical wording: /,'')+'"');
 assert(found.some(x=>x.querySelector('a').href===expected),expected);
}
assert(data.some(r=>r.url==='privacy.html#search-privacy-choices'&&r.text.includes('typed terms starts off')));
assert.equal(data.length,context.window.HAP_SEARCH_INDEX.coverage.reduce((total,row)=>total+row.records,0));assert(data.every(r=>!r.url.startsWith('phoenix/')));
const azUrl='updates/2026-11-14-arizona-housing-research.html';
assert.equal(data.filter(r=>r.url.startsWith(azUrl)).length,1,'Shared report has one canonical search record, not duplicate sectional or regional entries');
assert(query('"Arizona housing research update"','Updates').some(x=>x.querySelector('a').href===azUrl));

const callbacks={};
const anchor='https://housingaccountabilityproject.github.io/phoenix/records.html';
const loc={href:anchor+'#view-source',hash:'#view-source'};
const frames={state:null,replaceState(s,_title,url){this.state=s;assert.equal(url,loc.href);},pushState(s,_title,url){this.replaceState(s,_title,url);}};
const frame={location:loc,history:frames,document,performance:context.performance,window:{scrollY:17,scrollTo(){},addEventListener(name,callback){callbacks[name]=callback;}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/list-browser.js'),'utf8'),frame);
let state={query:'HUD',page:2};
const restores=[];
const nav=frame.window.HAPListBrowser.history({key:'phoenix-example',state:()=>state,restore:s=>restores.push(s)});
const saved=frames.state;
assert(nav.hasSnapshot());assert(!nav.restoredInitially);
loc.hash='#view-funding';loc.href=anchor+loc.hash;
assert(!nav.hasSnapshot(),'A fresh fragment must not reuse state borrowed from another hash');
callbacks.popstate({state:saved});assert.equal(restores.length,0);
state={query:'',page:1};nav.replace();assert(nav.hasSnapshot());
loc.hash='#view-source';loc.href=anchor+loc.hash;
frames.state=saved;callbacks.popstate({state:saved});
assert(nav.hasSnapshot(),'Hashchange after Back receives a saved snapshot and need not clear it');
assert.equal(restores.at(-1).query,'HUD');
assert.equal(restores.at(-1).page,2);
assert(!loc.href.includes('HUD'),'Saved queries never enter the visible URL');

// Missing-index state must be useful and must not submit a query.
const failContext={window:{},document};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/site-search.js'),'utf8'),failContext);assert(elements['site-search-form'].hidden);assert.match(elements['search-status'].textContent,/could not load/);
console.log('PASS: search results, titles, current/historical separation, phrases, IDs, amounts, categories, zero results, hostile input, pagination/focus, clear/reset and missing-index fallback. DOM logic test, not visual browser QA.');
