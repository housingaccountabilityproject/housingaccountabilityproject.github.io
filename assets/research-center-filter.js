(function(){
'use strict';
const cards=Array.from(document.querySelectorAll('[data-catalog-entry]'));
const search=document.getElementById('catalog-search');
const filter=document.getElementById('catalog-filter');
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
  const matches=(!query||terms.includes(query))&&(!selected||group.includes(selected));
  item.hidden=!matches;
  if(matches)n++;
 }
 counter.textContent='Showing '+n+' of '+cards.length+' research record'+(cards.length===1?'':'s')+'.';
 empty.hidden=n!==0;
}
search.addEventListener('input',apply);
filter.addEventListener('change',apply);
apply();
})();