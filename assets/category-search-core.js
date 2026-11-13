(function(root){
  'use strict';
  function fold(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[–—]/g,'-');}
  function terms(v){return (String(v||'').replace(/[“”]/g, '"').match(/"[^"]+"|\S+/g)||[]).map(x=>fold(x.replace(/^"|"$/g,''))).filter(Boolean);}
  function searchYears(r){const periods=typeof window!=='undefined'?window.HAPFundingPeriods:null;const row=periods?.get(r.scope,r.id);return r.category==='funding'?(row?periods.years(row):r.programPeriod?.years||[]):r.years;}
  function matches(r,s){
    const years=searchYears(r);
    const status=(typeof window!=='undefined'?window.HAPFundingPeriods?.get(r.scope,r.id)?.programPeriod:r.programPeriod)?.status||r.programPeriod?.status;
    return r.scope===s.scope && r.category===s.category && (!s.year || (s.year==='__not_applicable' ? status==='not_applicable' : s.year==='__unindexed' ? !years.length && status!=='not_applicable' : years.includes(s.year))) && (!s.sourceType || r.sourceType===s.sourceType) && (!s.subject || r.topics.includes(s.subject)) && terms(s.query).every(t=>{
      const year=t.match(/^year:(20\d{2}|unknown)$/);
      return year ? (year[1]==='unknown' ? !years.length && status!=='not_applicable' : years.includes(year[1])) : fold(r.searchText).includes(t);
    });
  }
  function search(records,s){
    const ts=terms(s.query);const score=r=>ts.reduce((n,t)=>n+(fold(r.id)===t?100:0)+(fold(r.id).includes(t)?25:0)+(fold(r.title).includes(t)?10:0),0);
    return records.filter(r=>matches(r,s)).sort((a,b)=>score(b)-score(a));
  }
  root.HAPPreviewCore={fold,terms,searchYears,matches,search};
  if(typeof module!=='undefined')module.exports=root.HAPPreviewCore;
})(typeof window==='undefined'?globalThis:window);
