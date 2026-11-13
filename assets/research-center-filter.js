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
 const funding=location.pathname.endsWith('/funding-explorer.html')?window.HAPFundingPeriods:null;
 const fundingControl=funding?.ready?funding.control('catalog-funding-year','catalog-grid'):null;
 const fundingYear=fundingControl?.select;
 const fundingRows=new Map(cards.map(card=>[card,funding?.get('tucson',card.id)]));
 // Keep the catalog's original search text and seven-entry scope intact.
 const originalTerms=new Map(cards.map(card=>[card,card.getAttribute('data-search')||card.textContent]));
 if(fundingControl){
  if(!grid.id)grid.id='catalog-grid';
  funding.fill(fundingYear,[...fundingRows.values()]);
  const panel=search.closest('.toolbar');panel.classList.add('funding-catalog-panel');panel.setAttribute('role','search');panel.setAttribute('aria-label','Filter Tucson and Pima County Funding catalog');
  const row=document.createElement('div');row.className='record-search-row';row.append(search.parentElement,clear);clear.textContent='Clear filters';
  const fields=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Filters';
  const controls=document.createElement('div');controls.className='record-filter-grid';controls.append(filter.parentElement,fundingControl.box);fields.append(legend,controls);panel.append(row,fields);
  const help=document.createElement('p');help.className='funding-filter-help';help.id='catalog-funding-help';help.textContent='Filters apply to the seven catalog entries below. '+funding.help+' ';
  const broader=document.createElement('a');broader.textContent='Search all 12 Tucson Funding entries';
  const url=new URL('search.html',document.querySelector('link[rel="canonical"]').href);url.hash='hap-search='+encodeURIComponent(JSON.stringify({version:1,surface:'category-tucson',state:{scope:'tucson',category:'funding',query:'',year:'',sourceType:'',subject:'',page:1}}));broader.href=url.href;help.append(broader);panel.append(help);fundingYear.setAttribute('aria-describedby',help.id);
  for(const card of cards)funding.decorate(card,fundingRows.get(card));
  for(const id of ['county-price-funding-2026','county-funding-fy27-q1','federal-allocations-2026','craycroft-financing-2026','coc-request-2026'])funding.decorate(document.getElementById(id),funding.get('tucson',id));
 }
 const notice=window.HAPListBrowser.notice(toolbar);let history,printing;
 const pager=window.HAPListBrowser.create({id:'catalog',label,entries:cards,mount,count:counter,empty,focusTarget:counter,onPage:()=>{history?.commit();printing?.update();}});
 const state=()=>({query:search.value,filter:filter.value,stage:stage?.value,...(fundingYear?{fundingYear:fundingYear.value}:{}),page:pager.page()});
 function restore(s){search.value=typeof s.query==='string'?s.query.slice(0,4096):'';filter.value=[...filter.options].some(o=>o.value===s.filter)?s.filter:'';if(stage)stage.value=[...stage.options].some(o=>o.value===s.stage)?s.stage:'';if(fundingYear)fundingYear.value=[...fundingYear.options].some(o=>o.value===s.fundingYear)?s.fundingYear:'';apply();pager.setPage(s.page||1);printing?.update();}
 const privacy=window.HAPSearchOptions.register({surface:'catalog-'+location.pathname.split('/').pop(),mount:toolbar,state,restore:s=>{restore(s);history?.commit();}});
 function apply(){
  notice.textContent='';privacy.clearLink();
  const query=search.value.trim().toLocaleLowerCase('en-US'),selected=filter.value;
  const base=cards.filter(item=>{
   const terms=(item.id+' '+[...item.querySelectorAll('[id]')].map(n=>n.id).join(' ')+' '+originalTerms.get(item)).toLocaleLowerCase('en-US'),group=(item.getAttribute('data-group')||'').split(' ');
   return (!query||terms.includes(query))&&(!selected||group.includes(selected))&&(!stage?.value||(item.dataset.projectStages||'').split(' ').includes(stage.value));
  });
  if(fundingYear)funding.fill(fundingYear,[...fundingRows.values()],base.map(card=>fundingRows.get(card)));
  const found=base.filter(item=>!fundingYear||funding.matches(fundingRows.get(item),fundingYear.value));
  pager.update(found);printing?.update();document.dispatchEvent(new Event('hapfilterschange'));
 }
 function reset(){privacy.reset();search.value='';filter.value='';if(stage)stage.value='';if(fundingYear)fundingYear.value='';apply();}
 for(const control of [search,filter,stage,fundingYear].filter(Boolean))control.addEventListener(control===search?'input':'change',()=>{apply();history.commit(control===search?'typing':'filter');});
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
 printing=window.HAPSearchPrint.register({title:label,privacy,describe:()=>[...(privacy.includeTerms()?[`Search: ${search.value.trim()||'(no search terms)'}`]:[]),'Topic / type: '+filter.selectedOptions[0].textContent,...(fundingYear?['Funding year / period: '+funding.optionLabel(fundingYear.value)]:[]),...(stage?['Evidence stage: '+stage.selectedOptions[0].textContent]:[])],results:pager.matches,currentResults:pager.current,snapshot:'Published public research. Dates, source references and limitations remain attached to each record.'});
})();
