/* Reader tools. No requests, query URLs, storage or analytics. */
(() => {
 'use strict';
 // Promote existing native filters into visible buttons, preserving their values and behavior.
 for(const id of ['record-topic','record-kind','connection-filter']){
  const select=document.getElementById(id);if(!select)continue;
  const label=document.querySelector(`label[for="${id}"]`);
  const group=document.createElement('div');group.className='filter-chips';group.setAttribute('role','group');group.setAttribute('aria-label',label?.textContent||'Filter');
  const buttons=[...select.options].map(option=>{const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.dataset.value=option.value;b.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));});group.append(b);return b;});
  select.after(group);select.hidden=true;
  const sync=()=>buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===select.value)));
  select.form?.addEventListener('change',sync);select.form?.addEventListener('reset',()=>setTimeout(sync,0));document.querySelector('.record-views')?.addEventListener('click',sync);sync();
 }
 const glossary=document.getElementById('glossary-query');
 if(glossary){const terms=[...document.querySelectorAll('.glossary-term')];glossary.addEventListener('input',()=>{const words=glossary.value.toLowerCase().trim().split(/\s+/).filter(Boolean);let count=0;for(const term of terms){term.hidden=!words.every(w=>term.textContent.toLowerCase().includes(w));if(!term.hidden)count++;}document.getElementById('glossary-status').textContent=`${count} of ${terms.length} searchable entries`;});}
 const phoenix=document.getElementById('record-results'),tucson=document.getElementById('search-results'),connection=document.getElementById('connection-results');
 const results=phoenix||tucson||connection;if(!results)return;
 const controls=document.createElement('div');controls.className='result-print-controls';controls.innerHTML='<button type="button" id="preview-print">Preview print results</button><button type="button" id="print-results">Print / Save PDF</button><button type="button" id="close-print" hidden>Return to results</button><label><input type="checkbox" id="load-all-print" checked> Load all matching results before print</label><p>Printing keeps your current city and filters. Loading all expands this existing index only; it does not add newly researched records.</p>';
 results.before(controls);
 const manifest=document.createElement('div');manifest.className='print-manifest';results.before(manifest);
 let details=new Map();
 function prepare(){
  if(tucson&&document.getElementById('load-all-print').checked)window.HAP_SEARCH_PRINT?.loadAll();
  const state=tucson?window.HAP_SEARCH_PRINT?.state():null;
  const cards=[...results.children].filter(el=>!el.hidden);
  let filters;
  if(tucson)filters=`Search: ${state?.query||'(all terms)'}; category: ${state?.category||'All pages'}`;
  else {const form=document.querySelector('#record-filters,.connection-filters');const values=[...form.querySelectorAll('input[type=search],select')].map(el=>el.tagName==='SELECT'?(el.selectedOptions[0]?.textContent||'All'):('Search: '+(el.value||'(all terms)')));const view=document.querySelector('.record-views button[aria-pressed=true]');filters=[view?.textContent,...values].filter(Boolean).join('; ');}
  const city=tucson?'Tucson & Pima County':'Phoenix';const total=state?.matches??cards.length;
  manifest.replaceChildren();const title=document.createElement('strong');title.textContent=`${city} · Research results`;manifest.append(title);
  const lines=[`Filters: ${filters}`,`Printed ${cards.length} of ${total} matching entries. ${cards.length<total?'PARTIAL RESULT SET: enable Load all before print for the full filtered set.':'All matching entries included.'}`,`Evidence snapshot: November 8, 2026. Print prepared: ${new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',dateStyle:'long',timeStyle:'short'}).format(new Date())} ${tucson?'Tucson':'Phoenix'} time (MST).`, 'Entry dates and caveats control interpretation; printing is not a new source audit.'];for(const line of lines){const p=document.createElement('p');p.textContent=line;manifest.append(p);}
  for(const card of cards)for(const d of card.querySelectorAll('details')){if(!details.has(d))details.set(d,d.open);d.open=true;}
 }
 document.getElementById('preview-print').addEventListener('click',()=>{prepare();document.body.classList.add('print-preview');document.getElementById('close-print').hidden=false;manifest.scrollIntoView({block:'start'});});
 document.getElementById('close-print').addEventListener('click',()=>{document.body.classList.remove('print-preview');document.getElementById('close-print').hidden=true;details.forEach((open,d)=>d.open=open);details.clear();});
 window.addEventListener('beforeprint',prepare);window.addEventListener('afterprint',()=>{if(!document.body.classList.contains('print-preview')){details.forEach((open,d)=>d.open=open);details.clear();}});
 document.getElementById('print-results').addEventListener('click',()=>{prepare();window.print();});
})();
