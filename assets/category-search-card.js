(function(root){
'use strict';
const missing='Not established in this index';
const scopes={tucson:'Tucson / Pima County',phoenix:'Phoenix / Maricopa County'};
function metadata(r,key){return (r.metadata||[]).filter(([k])=>k===key).map(([,v])=>v).join(' · ');}
function useful(v){return v&&v!=='Not separately tagged'&&v!=='other'&&v!=='unresolved'?v:'';}
function original(r){const links=[...(r.correctedSourceUrl?[{title:'Corrected source',url:r.correctedSourceUrl}]:[]),...(r.originals||[]),...(r.programPeriod?.evidence||[]).map(e=>({title:e.locator||'Period evidence',url:e.url})),...(r.links||[])];return links.find(l=>l.url&&!l.url.startsWith('https://housingaccountabilityproject.github.io/'))||links[0]||{title:'Full public record',url:r.url};}
function publication(r){
 const stamp=r.raw?.feed_timestamps?.published||metadata(r,'Website publication timestamp');if(stamp)return stamp;
 const texts=[...(r.raw?.timestamps?.publication||[]),metadata(r,'Publication date context')];
 for(const text of texts){const m=String(text).match(/^(?:Published|Posted):\s*(.*?(?:MST(?:\s*\(Tucson\))?|\(Tucson\)|\d{4}))(?:\.|$)/);if(m)return m[1];}
 return 'Publication date not established';
}
function documentDate(r){
 const context=[metadata(r,'Dates & coverage'),r.yearNote||''].join(' ');
 // Only explicit document-date wording is eligible. Never use a review/check date.
 const m=context.match(/(?:document|report|memo|notice|audit|letter)\s+(?:is\s+)?dated\s+([A-Z][a-z]+ \d{1,2},? \d{4})/i);if(m)return m[1];
 const direct=['Document date','Notice publication date','Original newsletter publication date','Award-announcement publication date','City recap publication date','Federal Register publication date','Memo date','Presentation date'];
 if(direct.includes(r.yearBasis)&&r.years.length)return r.years.join(', ')+' · year only; date context in details';
 return missing;
}
function period(r){
 if(r.category==='funding')return r.programPeriod?.years.length?r.programPeriod.label:'Active period: not yet verified';
 const labeled=useful(metadata(r,'Period'));if(labeled)return labeled;
 const context=metadata(r,'Dates & coverage');
 if(context&&/coverage|reporting period|plan period|survey period|fiscal year|program year/i.test(context))return context.split(/\.\s/)[0];
 if(r.category==='sources'&&!['Reporting period','Draft reporting period','ACS 1-year survey period','Annual agency-plan period','Annual reporting year','Fiscal reporting coverage','Audited fiscal coverage','Plan fiscal/program coverage'].includes(r.yearBasis))return missing;
 if(/period|coverage|fiscal year|grant years|competition cycle|reporting/i.test(r.yearBasis||'')&&!/no explicit|not specified|unresolved|without|unknown/i.test(r.yearBasis||''))return r.years.length?r.years.join(', ')+' · '+r.yearBasis:missing;
 return missing;
}
function summary(r){return r.displaySummary||(r.id==='federal-allocations-2026'?r.raw.summary.slice(1,7).join(' '):(r.summary||[]).join(' '));}
function related(r){return (r.sourceIds||[]).filter(id=>id!==r.id).join(' · ')||'Not separately listed; follow the evidence links';}
function fields(r,programNames){
 const agency=useful(r.agency)||missing,place=scopes[r.scope]+' · regional search scope';
 if(r.category==='funding')return [['Program',(programNames||r.programs||[]).join(' · ')||missing],['Administering body',agency],['Place / scope',place],['Fiscal / program period',period(r)]];
 if(r.category==='sources')return [['Issuer',agency],['Document date',documentDate(r)],['Period covered',period(r)],['Status',r.label||missing]];
 if(r.category==='questions')return [['Place / scope',place],['Period',period(r)],['Related evidence',related(r)]];
 return [['Actual publication date',publication(r)],['Affected records',related(r)]];
}
root.HAPCardStandard={metadata,publication,documentDate,period,summary,original,fields};if(typeof module!=='undefined')module.exports=root.HAPCardStandard;
})(typeof window==='undefined'?globalThis:window);
