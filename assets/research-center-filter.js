/* Search the complete public catalog, then page six entries without altering their order. */
(() => {
 'use strict';
 const cards=[...document.querySelectorAll('[data-catalog-entry]')],search=document.getElementById('catalog-search'),filter=document.getElementById('catalog-filter'),stage=document.getElementById('city-project-stage'),counter=document.getElementById('catalog-count'),empty=document.getElementById('catalog-empty');
 if(!search||!filter||!counter||!empty)return;
 search.value='';filter.value='';if(stage)stage.value='';
 const title=document.querySelector('h1').textContent,label='Tucson & Pima County '+title+' records',grid=cards[0].parentElement;
 const toolbar=document.createElement('div');toolbar.className='search-print-toolbar';toolbar.innerHTML='<button type="button" id="print-search-results" hidden>Print search results</button>';
 grid.before(toolbar);const mount=document.createElement('div');grid.after(mount);
 const clear=document.createElement('button');clear.type='button';clear.textContent='Clear list filters';toolbar.append(clear);
 const notice=window.HAPListBrowser.notice(toolbar);let history,printing;
 const pager=window.HAPListBrowser.create({id:'catalog',label,entries:cards,mount,count:counter,empty,focusTarget:counter,onPage:()=>{history?.commit();printing?.update();}});
 const state=()=>({query:search.value,filter:filter.value,stage:stage?.value,page:pager.page()});
 function restore(s){search.value=typeof s.query==='string'?s.query.slice(0,4096):'';filter.value=[...filter.options].some(o=>o.value===s.filter)?s.filter:'';if(stage)stage.value=[...stage.options].some(o=>o.value===s.stage)?s.stage:'';apply();pager.setPage(s.page||1);printing?.update();}
 const privacy=window.HAPSearchOptions.register({surface:'catalog-'+location.pathname.split('/').pop(),mount:toolbar,state,restore:s=>{restore(s);history?.commit();}});
 function apply(){
  notice.textContent='';privacy.clearLink();
  const query=search.value.trim().toLocaleLowerCase('en-US'),selected=filter.value;
  const found=cards.filter(item=>{
   const terms=(item.id+' '+[...item.querySelectorAll('[id]')].map(n=>n.id).join(' ')+' '+(item.getAttribute('data-search')||item.textContent)).toLocaleLowerCase('en-US'),group=(item.getAttribute('data-group')||'').split(' ');
   return (!query||terms.includes(query))&&(!selected||group.includes(selected))&&(!stage?.value||(item.dataset.projectStages||'').split(' ').includes(stage.value));
  });
  pager.update(found);printing?.update();document.dispatchEvent(new Event('hapfilterschange'));
 }
 function reset(){privacy.reset();search.value='';filter.value='';if(stage)stage.value='';apply();}
 for(const control of [search,filter,stage].filter(Boolean))control.addEventListener(control===search?'input':'change',()=>{apply();history.commit(control===search?'typing':'filter');});
 clear.addEventListener('click',()=>{reset();history.commit();search.focus();});
 function revealAnchor(){
  let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
  const target=document.getElementById(id),card=target?.closest('[data-catalog-entry]');if(!card)return;
  notice.textContent='';
  if(!pager.matches().includes(card)){reset();notice.textContent='Filters cleared to reveal the linked record '+(card.id||id)+'.';}
  pager.reveal(card);window.HAPListBrowser.reveal(target);history?.replace();printing?.update();
 }
 apply();const shared=window.HAPSearchOptions.incoming('catalog-'+location.pathname.split('/').pop());if(shared)restore(shared);
 history=window.HAPListBrowser.history({key:'catalog',state,restore});
 window.addEventListener('hashchange',revealAnchor);
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link){const u=new URL(link.href,location.href);if(u.origin===location.origin&&u.pathname===location.pathname&&u.hash===location.hash)revealAnchor();}});
 revealAnchor();
 printing=window.HAPSearchPrint.register({title:label,privacy,describe:()=>[...(privacy.includeTerms()?[`Search: ${search.value.trim()||'(no search terms)'}`]:[]),'Topic / type: '+filter.selectedOptions[0].textContent,...(stage?['Evidence stage: '+stage.selectedOptions[0].textContent]:[])],results:pager.matches,currentResults:pager.current,snapshot:'Published public research. Dates, source references and limitations remain attached to each record.'});
})();
