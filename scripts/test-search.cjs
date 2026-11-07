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
assert.match(elements['search-status'].textContent,/15 published pages/);
let results=query('F-007','Findings');assert(results.length>=1);assert.equal(results[0].querySelector('a').href,'findings.html#f-007');assert.equal(results[0].querySelector('a').textContent,'What Still Needs Explaining in CDBG Spending?');assert(!results[0].className.includes('historical'));
results=query('Q-007','Evidence');assert(results.some(x=>x.querySelector('a').href==='evidence.html#q-007'));
for(const q of ['"El Portal"','SRC-094','1,284,589.71','CDBG formula','housing help'])assert(query(q).length>0,q);
assert.equal(query('impossible-match-947362').length,0);assert.match(elements['search-status'].textContent,/No matching sections/);
assert.equal(query('<img src=x onerror=alert(1)>').length,0);
results=query('CDBG');assert.equal(results.length,20);assert.equal(elements['more-results'].hidden,false);elements['more-results'].events.click();assert(elements['search-results'].children.length>20);assert(elements['search-results'].children[20].querySelector('a').focused);
results=query('','Findings');assert(results.length>=12);
elements['clear-search'].events.click();assert.equal(elements['site-query'].value,'');assert.equal(elements['search-category'].value,'all');assert.equal(elements['search-results'].children.length,0);assert(elements['site-query'].focused);
const current=data.filter(x=>x.url==='findings.html#f-007'&&!x.historical);const old=data.filter(x=>x.url==='findings.html#f-007'&&x.historical);assert.equal(current.length,1);assert.equal(old.length,1);assert.match(old[0].title,/Historical wording/);
// Missing-index state must be useful and must not submit a query.
const failContext={window:{},document};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/site-search.js'),'utf8'),failContext);assert(elements['site-search-form'].hidden);assert.match(elements['search-status'].textContent,/unavailable/);
console.log('PASS: search results, titles, current/historical separation, phrases, IDs, amounts, categories, zero results, hostile input, pagination/focus, clear/reset and missing-index fallback. DOM logic test, not visual browser QA.');
