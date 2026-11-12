/* Ordinary searches stay in memory. Sharing is an explicit URL-fragment choice. */
(function () {
  'use strict';
  const form=document.getElementById('site-search-form'),input=document.getElementById('site-query'),category=document.getElementById('search-category'),status=document.getElementById('search-status'),results=document.getElementById('search-results'),more=document.getElementById('more-results');
  const index=window.HAP_SEARCH_INDEX;
  if(!index||!Array.isArray(index.records)||!window.HAPSearchOptions){status.setAttribute('role','alert');status.textContent='Search could not load. Use the Findings, Updates or Evidence Index links in the navigation.';form.hidden=true;return;}
  const fold=s=>s.normalize('NFKC').toLocaleLowerCase('en').replace(/[’‘]/g,"'").replace(/[–—]/g,'-');
  const records=index.records.map(r=>({...r,search:fold(`${r.title} ${r.page} ${r.url} ${r.text}`)}));
  let matches=[],shown=0,terms=[],activeQuery='',activeCategory='All Pages',printing,navigation,nodes=[];
  input.value='';category.value='all';more.hidden=true;
  const mount=document.createElement('div');results.after(mount);
  const pager=window.HAPListBrowser.create({id:'broader',label:'Tucson & Pima County indexed sections',entries:()=>nodes,mount,focusTarget:status,onPage:()=>{renderStatus();navigation?.commit();printing?.update();}});
  const state=()=>({query:activeQuery,draft:input.value,category:category.value,page:pager.page()});
  const options = window.HAPSearchOptions.register({surface:'tucson-broader',mount:document.querySelector('.search-print-toolbar'),state,restore:shared=>{applyShared(shared);search();pager.setPage(shared.page||1);renderStatus();navigation?.commit();}});
  const shared = window.HAPSearchOptions.incoming('tucson-broader');
  function applyShared(shared) {
    if (!shared) return;
    input.value = ''; category.value = 'all';
    if (typeof shared.query === 'string' && shared.query.length <= 4096) input.value = shared.query;
    if ([...category.options].some(option => option.value === shared.category)) category.value = shared.category;
  }
  applyShared(shared);

  function tokens(value){if(window.HAPSearchText)return window.HAPSearchText.tokens(value);return (value.replace(/[“”]/g, '"').match(/"[^"]+"|\S+/g)||[]).map(v=>fold(v.replace(/^"|"$/g,''))).filter(Boolean);}
  function text(tag,value,cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;}
  function snippet(r){const original=r.text;let start=terms.length?Math.min(...terms.map(t=>fold(original).indexOf(t)).filter(i=>i>=0)):0;if(!Number.isFinite(start))start=0;start=Math.max(0,start-80);return(start?'…':'')+original.slice(start,start+350)+(original.length>start+350?'…':'');}
  function resultArticle(r){const article=document.createElement('article');article.className='search-result'+(r.historical?' historical-result':'');article.append(text('p',r.category+' · '+r.page,'result-label'));const heading=document.createElement('h2'),link=document.createElement('a');link.href=r.url.replace(/^index\.html(?=#|$)/,"tucson/index.html");link.textContent=r.title;heading.append(link);article.append(heading);if(r.historical)article.append(text('p','Historical entry. Later evidence may supersede this wording. Read the correction and latest status before using an earlier comparison.','result-caution'));const excerpt=text('p',snippet(r),'search-snippet');article.append(excerpt);article.append(text('p',r.text,'print-source-urls'));const path=r.url.replace(/^index\.html(?=#|$)/,'tucson/index.html');article.append(text('p','Record URL: https://housingaccountabilityproject.github.io/'+path,'print-result-url'));const sources=window.HAP_SEARCH_SOURCES?.[r.url]||[];if(sources.length){const sourceBox=text('div','Source-page links for context; not necessarily evidence for this result:','print-source-urls');for(const url of sources)sourceBox.append(text('p',url));article.append(sourceBox);}if(terms.length){const fields=[['title',r.title],['page',r.page],['record link',r.url],['indexed record text',r.text]];const labels=fields.filter(([,value])=>terms.some(term=>fold(value).includes(term))).map(([label])=>label);article.append(text('p','Matched in: '+labels.slice(0,3).join(', ')+(labels.length>3?', and other fields.':'.'),'search-why'));if(window.HAPSearchText){for(const el of article.querySelectorAll('h2,.search-snippet,p.print-source-urls,.result-label'))window.HAPSearchText.highlight(el,terms);}}return article;}
  function renderStatus(){
    shown=pager.current().length;
    const start=(pager.page()-1)*6;
    status.textContent=matches.length?`${matches.length} matching section${matches.length===1?'':'s'} · Tucson & Pima County · Showing ${start+1}–${start+shown}`:activeQuery||category.value!=='all'?'No matching sections. Try fewer words, a source or question ID, or select All pages.':`Search ${index.coverage.length} published Tucson and Pima County pages. Phoenix is not included. Enter a word, phrase, finding ID or question ID to begin.`;
  }
  function search(browseAll=false){
    options.clearLink();activeQuery=input.value.trim();activeCategory=category.options?.[category.selectedIndex]?.textContent||category.value;terms=tokens(activeQuery);
    matches=!terms.length&&category.value==='all'&&browseAll!==true?[]:records.filter(r=>(category.value==='all'||r.category===category.value)&&terms.every(t=>r.search.includes(t))).map(r=>({...r,score:terms.reduce((n,t)=>n+(fold(r.title).includes(t)?8:0)+(fold(r.url).includes(t)?12:0),0)+(r.historical?-15:0)})).sort((a,b)=>b.score-a.score||a.url.localeCompare(b.url));
    nodes=matches.map(resultArticle);results.replaceChildren(...nodes);pager.update(nodes);renderStatus();printing?.update();
  }
  window.HAP_SEARCH_PRINT={loadAll:()=>matches.map(resultArticle),state:()=>({matches:matches.length,shown,query:activeQuery,category:activeCategory})};
  form.addEventListener('submit',e=>{e.preventDefault();search();navigation.commit();});
  category.addEventListener('change',()=>{search();navigation.commit('filter');});
  document.getElementById('clear-search').addEventListener('click',()=>{options.reset();input.value='';category.value='all';search();navigation.commit();input.focus();});
  input.addEventListener('search',()=>{if(!input.value){search();navigation.commit();}});
  search();pager.setPage(shared?.page||1);renderStatus();
  navigation=window.HAPListBrowser.history({key:'tucson-broader',state,restore:s=>{applyShared(s);search();pager.setPage(s.page||1);if(typeof s.draft==='string')input.value=s.draft;renderStatus();printing?.update();}});
  printing=window.HAPSearchPrint?.register({title:'Tucson & Pima County search results',describe:()=>[...(options.includeTerms()?[`Search: ${activeQuery||'(no search terms)'}`]:[]),`Pages: ${activeCategory}`],privacy:options,results:()=>matches.map(resultArticle),currentResults:()=>matches.slice((pager.page()-1)*6,pager.page()*6).map(resultArticle),count:()=>matches.length,snapshot:'Indexed text and contextual source-page links are navigation aids, not a new source audit. Context links are not necessarily evidence for every result. Historical cautions are retained.'});
})();
