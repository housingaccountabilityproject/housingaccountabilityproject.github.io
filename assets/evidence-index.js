/* Independent source/question pages share the existing period, topic and text filters. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),search=$('search'),period=$('period'),topic=$('topic');
 const sources=[...document.querySelectorAll('#sources tbody tr')],questions=[...document.querySelectorAll('#questions tbody tr')];
 search.value='';period.value='';topic.value='';
 let history,printing;
 const toolbar=document.createElement('div');toolbar.className='search-print-toolbar';
 toolbar.innerHTML='<button type="button" id="print-search-results" hidden>Print search results</button>';
 $('counts').after(toolbar);
 const notice=window.HAPListBrowser.notice(toolbar);
 const lists=[['sources',sources,'Tucson & Pima County source rows'],['questions',questions,'Tucson & Pima County question rows']].map(([id,entries,label])=>{
  const wrapper=$(id).parentElement,mount=document.createElement('div'),status=document.createElement('p'),empty=document.createElement('p');
  status.id=id+'-count';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  empty.id=id+'-empty';empty.textContent='No matching '+(id==='sources'?'source':'question')+' rows. Clear filters or try a broader term.';
  mount.append(status,empty);wrapper.before(mount);
  const pagination=document.createElement('div');wrapper.after(pagination);
  return window.HAPListBrowser.create({id,label,entries,mount:pagination,count:status,empty,focusTarget:status,onPage:()=>{history?.commit();printing?.update();}});
 });
 const state=()=>({query:search.value,period:period.value,topic:topic.value,pages:lists.map(l=>l.page())});
 function restore(value){
  search.value=typeof value.query==='string'?value.query.slice(0,4096):'';
  for(const [select,key] of [[period,'period'],[topic,'topic']])select.value=[...select.options].some(o=>o.value===value[key])?value[key]:'';
  apply();lists.forEach((list,i)=>list.setPage(value.pages?.[i]||1));printing?.update();
 }
 const privacy=window.HAPSearchOptions.register({surface:'tucson-evidence',mount:toolbar,state,restore:value=>{restore(value);history?.commit();}});
 function match(row){return (!search.value.trim()||row.textContent.toLowerCase().includes(search.value.trim().toLowerCase()))&&(!period.value||(row.dataset.period||'').split(' ').includes(period.value))&&(!topic.value||(row.dataset.topic||'').split(' ').includes(topic.value));}
 function apply(){
  notice.textContent='';privacy.clearLink();
  lists[0].update(sources.filter(match));lists[1].update(questions.filter(match));
  const sc=lists[0].matches().length,qc=lists[1].matches().length;
  $('counts').textContent=`${sc} source rows and ${qc} question rows match · Tucson & Pima County. Each register has its own pages.`;
  $('noresults').hidden=sc+qc>0;printing?.update();
 }
 function reset(){search.value='';period.value='';topic.value='';apply();}
 function revealHash(){
  let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
  const target=document.getElementById(id),row=target?.closest('#sources tbody tr,#questions tbody tr');if(!row)return;
  notice.textContent='';
  const list=lists[sources.includes(row)?0:1];
  if(!list.matches().includes(row)){reset();notice.textContent='Shared filters were cleared to reveal the linked record '+row.id+'.';}
  list.reveal(row);window.HAPListBrowser.reveal(target);history?.replace();printing?.update();
 }
 for(const [element,event] of [[search,'input'],[period,'change'],[topic,'change']])element.addEventListener(event,()=>{apply();history.commit(element===search?'typing':'filter');});
 $('clear').addEventListener('click',()=>{privacy.reset();reset();history.commit();search.focus();});
 apply();const shared=window.HAPSearchOptions.incoming('tucson-evidence');if(shared)restore(shared);
 history=window.HAPListBrowser.history({key:'tucson-evidence',state,restore,afterRestore:()=>{notice.textContent='Previous list view restored.';}});
 window.addEventListener('hashchange',revealHash);
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link){const url=new URL(link.href,location.href);if(url.origin===location.origin&&url.pathname===location.pathname&&url.hash===location.hash)revealHash();}});
 revealHash();
 const describe=()=>[...(privacy.includeTerms()?[`Search: ${search.value.trim()||'(no search terms)'}`]:[]),`Period: ${period.selectedOptions[0].textContent}`,`Subject: ${topic.selectedOptions[0].textContent}`];
 printing=window.HAPSearchPrint.register({title:'Tucson & Pima County Public Evidence Index',privacy,describe,lists:lists.map((list,i)=>({id:i?'questions':'sources',label:i?'Tucson & Pima County question register':'Tucson & Pima County source register',results:list.matches,currentResults:list.current})),snapshot:'Published research only. Website source IDs and workbook IDs remain separate namespaces.'});
 const complete=$('print-all'),completeNotice=document.createElement('p');completeNotice.id='print-all-notice';completeNotice.textContent='Print Complete Index clears the shared filters and includes both complete registers, the ID crosswalk and explanatory material. It does not limit output to six rows.';complete.setAttribute('aria-describedby',completeNotice.id);complete.before(completeNotice);
 let details=new Map(),printLinks=new Map();
 function portablePrintLinks(){
  // The complete index prints the live document, unlike detached reports.
  // Resolve cross-page links against its published address, never a local ZIP path.
  const canonical=new URL(document.querySelector('link[rel="canonical"]').href);
  document.querySelectorAll('a[href]').forEach(link=>{
   const href=link.getAttribute('href');
   if(href.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(href))return;
   const target=new URL(href,canonical);
   const portable=target.origin===canonical.origin && target.pathname===canonical.pathname && target.search===canonical.search && target.hash ? target.hash : target.href;
   if(portable!==href){printLinks.set(link,href);link.setAttribute('href',portable);}
  });
 }
 complete.addEventListener('click',()=>{
  privacy.reset();reset();history.commit();
  document.body.classList.add('printing-complete-index');[...sources,...questions].forEach(row=>{row.hidden=false;});
  portablePrintLinks();
  document.querySelectorAll('main details').forEach(d=>{details.set(d,d.open);d.open=true;});
  const stamp=document.createElement('p');stamp.id='complete-index-time';stamp.textContent='Print Complete Index · 67 source rows and 20 question rows, plus explanatory material. Print prepared: '+window.HAPSearchOptions.preparedAt()+' · America/Phoenix, year-round. Research dates remain attached to records.';document.querySelector('main h1').after(stamp);
  window.print();
 });
 window.addEventListener('afterprint',()=>{
  if(!document.body.classList.contains('printing-complete-index'))return;
  document.body.classList.remove('printing-complete-index');$('complete-index-time')?.remove();details.forEach((open,d)=>{d.open=open;});details.clear();printLinks.forEach((href,link)=>link.setAttribute('href',href));printLinks.clear();apply();complete.focus();
 });
})();
