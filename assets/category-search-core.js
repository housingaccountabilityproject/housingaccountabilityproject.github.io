(function(root){
  'use strict';
  function fold(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[–—]/g,'-');}
  function terms(v){return (String(v||'').replace(/[“”]/g, '"').match(/"[^"]+"|\S+/g)||[]).map(x=>fold(x.replace(/^"|"$/g,''))).filter(Boolean);}
  function searchYears(r){const periods=typeof window!=='undefined'?window.HAPFundingPeriods:null;const row=periods?.get(r.scope,r.id);return r.category==='funding'?(row?periods.years(row):r.programPeriod?.years||[]):r.years;}
  function matches(r,s){
    const years=searchYears(r);
    const funding=typeof window!=='undefined'?window.HAPFundingPeriods:null,row=funding?.get(r.scope,r.id);
    const status=(typeof window!=='undefined'?window.HAPFundingPeriods?.get(r.scope,r.id)?.programPeriod:r.programPeriod)?.status||r.programPeriod?.status;
    const yearMatch=value=>r.category==='funding'&&row?funding.matches(row,value):!value||(value==='__not_applicable'?status==='not_applicable':['__unindexed','__unknown'].includes(value)?!years.length&&status!=='not_applicable':years.includes(value));
    return r.scope===s.scope && r.category===s.category && yearMatch(s.year) && (!s.sourceType || r.sourceType===s.sourceType) && (!s.subject || r.topics.includes(s.subject)) && terms(s.query).every(t=>{
      const year=t.match(/^year:(20\d{2}|unknown)$/);
      return year ? yearMatch(year[1]==='unknown'?'__unindexed':year[1]) : fold(r.searchText).includes(t);
    });
  }
  function search(records,s){
    const ts=terms(s.query);const score=r=>ts.reduce((n,t)=>n+(fold(r.id)===t?100:0)+(fold(r.id).includes(t)?25:0)+(fold(r.title).includes(t)?10:0),0);
    return records.filter(r=>matches(r,s)).sort((a,b)=>score(b)-score(a));
  }
  root.HAPPreviewCore={fold,terms,searchYears,matches,search};
  if(typeof module!=='undefined')module.exports=root.HAPPreviewCore;
})(typeof window==='undefined'?globalThis:window);
