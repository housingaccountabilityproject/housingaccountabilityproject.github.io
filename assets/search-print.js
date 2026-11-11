/* Detached reports reuse the complete matching set; screen pagination never limits Ctrl+P. */
(() => {
  'use strict';
  const make = (tag, text) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; return n; };
  const value = item => typeof item === 'function' ? item() : item;
  window.HAPSearchPrint = {
    register({title, describe = () => [], results, currentResults = results, count, snapshot = '', privacy, lists}) {
      const button=document.querySelector('#print-search-results');
      const toolbar=button?.closest('.search-print-toolbar');
      if(!button || !toolbar) return;
      const registers=lists || [{id:'results',label:title,results,currentResults,count}];
      const choices=make('div'); choices.className='list-print-options screen-only';
      function select(id,label,items) {
        const wrapper=make('label',label),control=make('select');control.id=id;
        for(const [id,text] of items){const option=make('option',text);option.value=id;control.append(option);}
        wrapper.append(control);choices.append(wrapper);return control;
      }
      const list=select('print-list','List to print',registers.map(r=>[r.id,value(r.label)]));
      if(registers.length===1)list.parentElement.hidden=true;
      const scope=select('print-scope','Records to print',[['all','All matches'],['current','Current page (up to six)']]);
      const detail=select('print-detail','Evidence detail',[['full','Full evidence'],['compact','Compact']]);
      const help=make('p');help.className='list-print-help screen-only';
      const detailHelp=make('p','Compact keeps dates, sources and qualifications. Full also retains connected context. Screen pages do not set paper page sizes.');detailHelp.className='list-print-help screen-only';
      toolbar.prepend(choices);toolbar.append(help,detailHelp);
      // Replace stale instructions about Show More/unpaginated entries with the actual contract.
      for(const p of [...toolbar.children])if(p.tagName==='P' && p!==help && p!==detailHelp && !p.classList.contains('list-link-notice'))p.remove();
      let previewing=false, previewButton, returnFocus=button, returnScroll=0, selection=null;
      const selected=()=>registers.find(r=>r.id===list.value)||registers[0];
      function removeReport(){document.getElementById('search-print-output')?.remove();document.body.classList.remove('printing-search-results');}
      function cleanup(){
        removeReport();previewing=false;selection=null;
        document.getElementById('search-print-preview-controls')?.remove();document.body.classList.remove('previewing-search-results');
        privacy?.leavePrint();returnFocus?.focus({preventScroll:true});window.scrollTo({top:returnScroll,left:0,behavior:'instant'});
      }
      function clone(entry, mode) {
        let copy;
        if(entry.tagName==='TR'){
          copy=make('article');copy.className='index-print-record';
          const headings=[...entry.closest('table').querySelectorAll('thead th')];
          [...entry.children].forEach((cell,i)=>{
            copy.append(make(i===0?'h2':'h3',headings[i]?.textContent || 'Record'));
            const content=make('div');for(const child of cell.childNodes)content.append(child.cloneNode(true));copy.append(content);
          });
        }else copy=entry.cloneNode(true);
        copy.hidden=false;copy.dataset.printRecordId=entry.id||entry.dataset.recordKey||'';
        if(entry.id)copy.prepend(make('p','Record ID: '+entry.id));
        copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
        copy.querySelectorAll('details').forEach(n=>{n.open=true;});
        copy.querySelectorAll('.search-why,.city-project-permalink,.question-permalink').forEach(n=>n.remove());
        if(mode==='compact')copy.querySelectorAll('.record-connections,.related-records').forEach(n=>n.remove());
        copy.querySelectorAll('details').forEach(n=>{if(!n.textContent.trim() || (n.children.length===1 && n.firstElementChild.tagName==='SUMMARY'))n.remove();});
        const referenceURL=document.querySelector('link[rel="canonical"]')?.href || document.baseURI;
        copy.querySelectorAll('a[href]').forEach(link=>{
          const href=link.getAttribute('href');
          if(href.startsWith('#') && link.textContent.trim()==='Direct link')link.remove();
          else link.href=new URL(href,referenceURL).href;
        });
        if(entry.id){const p=make('p'),link=make('a','Full record in context');link.href=new URL('#'+entry.id,referenceURL).href;p.append(link);copy.append(p);}
        return copy;
      }
      function choose(selectedScope=scope.value,selectedDetail=detail.value){
        return {register:selected(),scope:selectedScope,detail:selectedDetail};
      }
      function prepare(){
        removeReport();
        const choice=selection||choose('all','full'),reg=choice.register;
        const all=reg.results(),entries=choice.scope==='current'?(reg.currentResults?.()||all.slice(0,6)):all;
        const report=make('section');report.id='search-print-output';report.className='print-'+choice.detail;report.setAttribute('aria-label',title);
        report.append(make('p','Housing Accountability Project'),make('h1',title),make('p','List: '+value(reg.label)),make('p',(choice.detail==='compact'?'Compact':'Full evidence')+' · '+(choice.scope==='current'?'Current page (up to six)':'All matches')));
        for(const line of (reg.describe||describe)()){
          if(!privacy?.includeTerms() && /^Search:/.test(line))continue;
          report.append(make('p',line));
        }
        report.append(make('p',`${all.length} matching result${all.length===1?'':'s'} · ${choice.scope==='current'?entries.length+' records from the current page':'complete results for this search'}`));
        const snapshotText=value(snapshot);if(snapshotText)report.append(make('p',snapshotText));
        report.append(make('p',`Print prepared: ${window.HAPSearchOptions.preparedAt()} · America/Phoenix, year-round. This is a print time; research dates remain attached to the records.`));
        if(choice.detail==='compact')report.append(make('p','Condensed evidence: dates, source notes and qualifications are retained. Full evidence also retains connected navigation context.'));
        for(const entry of entries)report.append(clone(entry,choice.detail));
        if(!entries.length)report.append(make('p','No results match the active search.'));
        document.body.append(report);privacy?.showPrint(report);document.body.classList.add('printing-search-results');
      }
      function preview(){
        returnFocus=previewButton;returnScroll=window.scrollY;selection=choose();previewing=true;prepare();
        document.body.classList.remove('printing-search-results');document.body.classList.add('previewing-search-results');
        const controls=make('div');controls.id='search-print-preview-controls';
        const print=make('button','Print / Save PDF');print.id='print-results';print.type='button';print.addEventListener('click',()=>window.print());
        const close=make('button','Return to results');close.id='close-print';close.type='button';close.addEventListener('click',cleanup);
        controls.append(print,close);document.body.prepend(controls);print.focus({preventScroll:true});window.scrollTo({top:0,left:0,behavior:'instant'});
      }
      function update(){
        for(const reg of registers){const option=[...list.options].find(o=>o.value===reg.id);if(option)option.textContent=value(reg.label);}
        const reg=selected(),n=reg.count?reg.count():reg.results().length;
        button.disabled=previewButton.disabled=n===0;
        help.textContent=`Ctrl+P: all matches in “${value(reg.label)}”, Full evidence. In a preview, Ctrl+P prints its selected scope and detail. Print and return keep your query, filters and page.`;
      }
      window.addEventListener('beforeprint',()=>{
        if(document.body.classList.contains('printing-complete-index'))return;
        if(!previewing && !selection){returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:button;returnScroll=window.scrollY;}
        prepare();
      });
      window.addEventListener('afterprint',()=>{
        if(document.body.classList.contains('printing-complete-index'))return;
        if(previewing)document.body.classList.remove('printing-search-results');else cleanup();
      });
      button.hidden=false;button.textContent='Print search results';
      button.addEventListener('click',()=>{returnFocus=button;returnScroll=window.scrollY;selection=choose();window.print();});
      previewButton=make('button','Preview print results');previewButton.id='preview-print';previewButton.type='button';previewButton.addEventListener('click',preview);button.after(previewButton);
      list.addEventListener('change',update);update();
      const controller={update,preview,closePreview:cleanup};window.HAPSearchPrint.active=controller;return controller;
    }
  };
})();
