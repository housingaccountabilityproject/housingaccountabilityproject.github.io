(function(){
'use strict';
const cards=Array.from(document.querySelectorAll('[data-catalog-entry]'));
const search=document.getElementById('catalog-search');
const filter=document.getElementById('catalog-filter');
const stage=document.getElementById('city-project-stage');
const counter=document.getElementById('catalog-count');
const empty=document.getElementById('catalog-empty');
if(!search||!filter||!counter||!empty)return;
function apply(){
 const query=search.value.trim().toLocaleLowerCase('en-US');
 const selected=filter.value;
 let n=0;
 for(const item of cards){
  const terms=(item.getAttribute('data-search')||item.textContent).toLocaleLowerCase('en-US');
  const group=(item.getAttribute('data-group')||'').split(' ');
  const matches=(!query||terms.includes(query))&&(!selected||group.includes(selected))&&(!stage?.value||(item.dataset.projectStages||'').split(' ').includes(stage.value));
  item.hidden=!matches;
  if(matches)n++;
 }
 counter.textContent='Showing '+n+' of '+cards.length+' research record'+(cards.length===1?'':'s')+'.';
 empty.hidden=n!==0;
}
search.addEventListener('input',apply);
filter.addEventListener('change',apply);
stage?.addEventListener('change',apply);
apply();
// A stable question/project URL must reveal its record, including historical aliases.
function revealAnchor(hash){
 let id;try{id=decodeURIComponent((hash||'').replace(/^#/,''));}catch{return;}
 const target=document.getElementById(id);
 const card=target&&target.closest('[data-catalog-entry]');
 if(!card)return;
 if(card.hidden){search.value='';filter.value='';if(stage)stage.value='';apply();}
 requestAnimationFrame(()=>card.scrollIntoView({block:'start'}));
}
window.addEventListener('hashchange',()=>revealAnchor(location.hash));
document.addEventListener('click',event=>{
 const link=event.target.closest('a[href^="#"]');
 if(link)revealAnchor(link.getAttribute('href'));
});
revealAnchor(location.hash);
})();
