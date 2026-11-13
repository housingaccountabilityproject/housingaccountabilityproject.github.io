/* Funding-period annotations retain their review status. Source/event years never populate this filter. */
(() => {
  'use strict';
  const data=window.HAP_FUNDING_PERIODS_DATA;
  const unknown='Unknown / not established';
  const rows=new Map((data?.records||[]).map(r=>[r.scope+':'+r.id.toLowerCase(),r]));
  const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  function get(scope,id){return rows.get(scope+':'+String(id).toLowerCase());}
  function years(row){
    const p=row?.programPeriod;if(!p||p.status==='not_applicable')return [];
    const found=new Set(p.years||[]);
    // Expand each supported interval separately; never bridge gaps between intervals.
    for(const interval of p.periods?.length?p.periods:[p]){
      for(const y of interval.years||[])found.add(y);
      const a=Number(interval.start?.slice(0,4)),b=Number(interval.end?.slice(0,4));
      if(a>=2000&&b>=a&&b-a<=100)for(let y=a;y<=b;y++)found.add(String(y));
    }
    return [...found].sort();
  }
  function label(row){const p=row?.programPeriod;return !years(row).length&&p?.status!=='not_applicable'?unknown:p.label;}
  function reviewLabel(row){return row?.review?.status==='test_only'?'TEST DATA — not verified research':row?.review?.status==='accepted_handoff'?'Evidence-backed handoff: '+row.review.batch_id:'Published baseline · funding-period review pending';}
  function matches(row,value){const p=row?.programPeriod,ys=years(row);return !value||(value==='__unknown'?!ys.length&&p?.status!=='not_applicable':value==='__not_applicable'?p?.status==='not_applicable':ys.includes(value));}
  function optionLabel(value){return !value?'All funding years / periods':value==='__unknown'?unknown:value==='__not_applicable'?'Not applicable · guidance':value;}
  function fill(select,entries,countEntries=entries){
    const selected=select.value,allYears=[...new Set(entries.flatMap(years))].sort().reverse();
    const values=['',...allYears,'__unknown',...(entries.some(r=>r?.programPeriod.status==='not_applicable')?['__not_applicable']:[])];
    select.replaceChildren(...values.map(value=>{const n=make('option',optionLabel(value)+' ('+countEntries.filter(r=>matches(r,value)).length+')');n.value=value;return n;}));
    select.value=values.includes(selected)?selected:'';
  }
  function control(id,results='record-results'){
    const box=make('div');box.className='funding-period-control';
    const title=make('label','Funding year / period');title.htmlFor=id;
    const select=make('select');select.id=id;select.setAttribute('aria-controls',results);box.append(title,select);
    return {box,select};
  }
  function decorate(target,row){
    if(!target||!row||target.querySelector(':scope > .funding-period'))return;
    const box=make('div');box.className='funding-period';box.dataset.searchUi='funding-period-annotation';
    const title=make('p');title.append(make('strong','Funding year / period: '),make('span',label(row)));box.append(title,make('p',reviewLabel(row)));
    const details=make('details'),summary=make('summary','Funding-period evidence & limits');details.append(summary,make('p',row.programPeriod.explanation));
    const periods=row.programPeriod.periods||[];
    for(const p of periods)details.append(make('p',p.label+(p.start||p.end?' · '+(p.start||'Start unknown')+' – '+(p.end||'End unknown'):'')));
    const evidence=[...(row.programPeriod.evidence||[]),...(row.knownDates||[]).flatMap(d=>(d.evidence||[]).map(e=>({...e,context:'Separate source/event date; excluded from Funding year / period. '})))];
    if(evidence.length){const list=make('ul'),seen=new Set();for(const e of evidence){const key=e.url+' '+e.locator;if(seen.has(key))continue;seen.add(key);const li=make('li'),link=make('a',(e.context||'')+(e.locator||'Period evidence'));link.href=e.url;li.append(link);list.append(li);}details.append(list);}
    if(row.periodLeads?.length)for(const p of row.periodLeads)details.append(make('p','Unverified period lead, excluded from filtering: '+p.label+'. '+p.explanation));
    box.append(details);
    const heading=target.querySelector(':scope > h2,:scope > h3');
    if(heading)heading.after(box);else target.prepend(box);
  }
  window.HAPFundingPeriods={get,label,years,reviewLabel,matches,fill,control,decorate,optionLabel,ready:rows.size===31};
})();
