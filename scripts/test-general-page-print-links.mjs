import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {execPDF} from './pdf-tools.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const baseline=process.env.HAP_PRINT_BASELINE||'/workspace/hap-private-review/reconstruction-2026-11-12/site';
const out=process.env.HAP_GENERAL_PRINT_OUTPUT||resolve(root,'../artifacts/portable-fix');mkdirSync(out,{recursive:true});
const origin='https://housingaccountabilityproject.github.io';
const servers=[spawn('python3',['-m','http.server','8788','--bind','127.0.0.1'],{cwd:baseline,stdio:'ignore'}),spawn('python3',['-m','http.server','8789','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'})];
const paths=['about.html','glossary.html','phoenix/index.html','research-updates.html'];
const results=[],errors=[],baselinePDFs=new Map(),baselinePixels=new Map(),screens=new Map(),headerFocus=new Map();let browser;
const snap=()=>({links:[...document.querySelectorAll('a[href]')].map(n=>n.getAttribute('href')),text:document.querySelector('main').textContent,ids:[...document.querySelectorAll('[id]')].map(n=>n.id),attributes:[...document.querySelectorAll('a')].map(n=>[...n.attributes].map(a=>[a.name,a.value])),times:[...document.querySelectorAll('time')].map(n=>[n.getAttribute('datetime'),n.textContent]),details:[...document.querySelectorAll('details')].map(n=>n.open),controls:[...document.querySelectorAll('input,select')].map(n=>[n.id,n.value,n.checked]),active:document.activeElement?.outerHTML});
const settle=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
const content=s=>({links:s.links,text:s.text,ids:s.ids,times:s.times,controls:s.controls,attributes:s.attributes});
const audit=path=>JSON.parse(execPDF('audit',[path],{encoding:'utf8',maxBuffer:90*1024*1024}));
function uris(d){return d.pages.flatMap(p=>p.links).filter(l=>l.uri).map(l=>l.uri).sort();}
function internals(d){return d.pages.map(p=>p.links.filter(l=>l.kind===1||l.kind===4).map(l=>({kind:l.kind,page:l.page,to:l.to,nameddest:l.nameddest})));}
function sameContentAndGeometry(d,old,label){
 assert.deepEqual(d.pages.map(p=>({width:p.width,height:p.height,text:p.text,words:p.words})),old.pages.map(p=>({width:p.width,height:p.height,text:p.text,words:p.words})),label+' exact text/order, word geometry and pagination retained');
}
function renderHashes(file){
 return JSON.parse(execFileSync('python3',['-c',"import fitz,hashlib,json,sys;d=fitz.open(sys.argv[1]);print(json.dumps([hashlib.sha256(p.get_pixmap(alpha=False).samples).hexdigest() for p in d]))",file],{encoding:'utf8'}));
}

function portable(d){for(const p of d.pages){assert(p.text.trim().length>25,'No blank page');for(const l of p.links){assert(!l.file,'No local/remote file action');if(l.uri){assert(/^(https:|mailto:)/i.test(l.uri),l.uri);assert(!/localhost|127\.0\.0\.1|file:/i.test(l.uri),l.uri);}}for(const w of p.words)assert(w[0]>=-1&&w[1]>=-1&&w[2]<=p.width+1&&w[3]<=p.height+1,'Text within page: '+w[4]);}}
async function eventContract(page,name){
 await page.locator('main a[href]:visible').last().evaluate(n=>n.focus({preventScroll:true}));await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));await settle(page);const before=await page.evaluate(snap);
 assert.equal(await page.evaluate(()=>document.activeElement.tagName),'A','A visible content link receives focus');
 for(let i=0;i<3;i++){
  await page.evaluate(()=>{window.dispatchEvent(new Event('beforeprint'));window.dispatchEvent(new Event('beforeprint'));});
  const targets=await page.evaluate(()=>{const canonical=new URL(document.querySelector('link[rel=canonical]').href);return [...document.querySelectorAll('a[href]')].map(n=>n.getAttribute('href'));});
  const canonical=await page.locator('link[rel=canonical]').getAttribute('href');
  for(let j=0;j<before.links.length;j++){
   const raw=before.links[j],target=new URL(raw,canonical),self=u=>u.pathname.replace(/\/index\.html$/,'/');
   const expected=raw&&!raw.trim().startsWith('#')&&target.origin===origin&&self(target)!==self(new URL(canonical))?target.href:raw;
   assert.equal(targets[j],expected,name+' print target '+raw);
  }
  await page.evaluate(()=>{window.dispatchEvent(new Event('afterprint'));window.dispatchEvent(new Event('afterprint'));});
  await settle(page);assert.deepEqual(await page.evaluate(snap),before,name+' repeated cancel/afterprint restores exact DOM values/focus');
 }
 // A print-media exit also restores attributes, without relying on afterprint.
 await page.emulateMedia({media:'print'});await page.waitForTimeout(60);await page.emulateMedia({media:'screen'});
 await page.waitForFunction(links=>JSON.stringify([...document.querySelectorAll('a[href]')].map(n=>n.getAttribute('href')))===JSON.stringify(links),before.links);
 assert.deepEqual(await page.evaluate(snap),before,name+' print-media restoration/focus');await page.emulateMedia({media:null});
 // Restoration on a back/forward-cache boundary must not retain print URLs.
 await page.evaluate(()=>{window.dispatchEvent(new Event('beforeprint'));window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});
 assert.deepEqual(await page.locator('a[href]').evaluateAll(ns=>ns.map(n=>n.getAttribute('href'))),before.links,name+' pagehide restores links');
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 assert.deepEqual(await page.evaluate(snap),before);
}
try{
 for(const port of [8788,8789])for(let i=0;i<40;i++){try{assert((await fetch(`http://127.0.0.1:${port}/about.html`)).ok);break;}catch(e){if(i===39)throw e;await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
 for(const mode of ['baseline-preview','fixed-preview','fixed-live-equivalent']){
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(mode+': '+e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(mode==='fixed-live-equivalent'&&u.origin===origin){
    const file=resolve(root,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));
    assert(file.startsWith(root),file);
    const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon'};
    try{await route.fulfill({status:200,body:readFileSync(file),contentType:types[extname(file)]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:'Not found'});}return;
   }
   if(u.origin===`http://127.0.0.1:${mode==='baseline-preview'?8788:8789}`)await route.continue();else await route.abort();
  });
  for(const path of paths){
   const url=mode==='fixed-live-equivalent'?origin+'/'+path:`http://127.0.0.1:${mode==='baseline-preview'?8788:8789}/`+path;
   await page.goto(url,{waitUntil:'networkidle'});if(path==='phoenix/index.html')await page.locator('.city-evidence-library>summary').click();
   await page.locator('.city-brand').focus();await page.keyboard.press('Tab');
   const headerBefore=await page.evaluate(()=>({tag:document.activeElement.tagName,href:document.activeElement.getAttribute('href')}));
   await page.emulateMedia({media:'print'});await page.waitForTimeout(60);await page.emulateMedia({media:'screen'});await page.waitForTimeout(60);
   const headerAfter=await page.evaluate(()=>({tag:document.activeElement.tagName,href:document.activeElement.getAttribute('href')}));
   const headerState={before:headerBefore,after:headerAfter};
   if(mode==='baseline-preview')headerFocus.set(path,headerState);else assert.deepEqual(headerState,headerFocus.get(path),'Header print-media focus behavior matches starting candidate');
   await page.emulateMedia({media:null});
   await page.locator('main a[href]:visible').last().evaluate(n=>n.focus({preventScroll:true}));await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));await settle(page);
   let before=await page.evaluate(snap);
   if(mode==='baseline-preview')screens.set(path,content(before));else assert.deepEqual(content(before),screens.get(path),mode+' original content, records, timestamps, order and hrefs');
   if(mode!=='baseline-preview'){await eventContract(page,mode+'/'+path);await settle(page);before=await page.evaluate(snap);}
   for(const format of ['Letter','A4']){
    const file=join(out,mode+'-'+path.replaceAll('/','-')+'-'+format+'.pdf');
    await page.pdf({path:file,format,tagged:true,displayHeaderFooter:false});const d=audit(file),key=path+'/'+format;await settle(page);
    assert.deepEqual(await page.evaluate(snap),before,'Actual export restores exact screen state/focus: '+key);
    const pixels=renderHashes(file);
    if(mode==='baseline-preview'){baselinePDFs.set(key,d);baselinePixels.set(key,pixels);}
    else{
     const old=baselinePDFs.get(key);portable(d);
     sameContentAndGeometry(d,old,key);assert.deepEqual(pixels,baselinePixels.get(key),'Every rendered page pixel-identical to unchanged candidate: '+key);
     assert.deepEqual(internals(d),internals(old),'Same-document PDF destinations unchanged: '+key);
     const expected=uris(old).map(u=>u.replace('http://127.0.0.1:8788/',origin+'/')).sort();
     assert.deepEqual(uris(d),expected,'Exact annotations; external URLs/fragments retained: '+key);
    }
    results.push({mode,path,format,file,pages:d.pages.length,links:uris(d).length});
   }
   if(mode==='fixed-preview'){
    const file=join(out,'fixed-repeat-'+path.replaceAll('/','-')+'.pdf');await page.pdf({path:file,format:'Letter',tagged:true,displayHeaderFooter:false});const d=audit(file);await settle(page);portable(d);sameContentAndGeometry(d,baselinePDFs.get(path+'/Letter'),path+'/Letter');assert.deepEqual(renderHashes(file),baselinePixels.get(path+'/Letter'),'Repeat export pixels unchanged');assert.deepEqual(await page.evaluate(snap),before,'Repeated actual export restores state');results.push({mode:'fixed-repeat',path,format:'Letter',file,pages:d.pages.length,links:uris(d).length});
   }
  }
  if(mode==='fixed-preview'){
   // Only the four pages opt in. The ordinary research engines remain untouched.
   for(const path of ['evidence.html','funding-explorer.html','phoenix/records.html','search.html','phoenix/search.html']){
    await page.goto('http://127.0.0.1:8789/'+path);assert.equal(await page.locator('script[src*="general-page-print-links"]').count(),0,path+' helper absent');
   }
   // Glossary filters and mobile keyboard navigation survive simulated cancellation.
   await page.goto('http://127.0.0.1:8789/glossary.html');await page.locator('#glossary-query').fill('accrual');await eventContract(page,'filtered glossary');
   await page.setViewportSize({width:390,height:850});
   for(const path of paths){await page.goto('http://127.0.0.1:8789/'+path);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),'No phone overflow');await page.locator('.city-menu-toggle').click();const close=page.locator('.city-menu-close');await close.focus();const focus=await page.evaluate(()=>document.activeElement.outerHTML);await page.evaluate(()=>{window.dispatchEvent(new Event('beforeprint'));window.dispatchEvent(new Event('afterprint'));});assert.equal(await page.evaluate(()=>document.activeElement.outerHTML),focus);await page.keyboard.press('Escape');await page.locator('.city-menu-toggle').evaluate(n=>{if(document.activeElement!==n)throw Error('Menu focus did not return');});}
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'results.json'),JSON.stringify({results,errors,localFileTested:false,nativeDialogTested:false,chromeVoxTested:false,headerFocus:[...headerFocus],liveEquivalent:'Canonical HTTPS requests fulfilled from the new local build; no publication.'},null,2));
 console.log('PASS four pages: local/canonical HTTPS equivalents, exact annotations, fragments/internal destinations, unchanged content/word geometry and pixel identity, repeat exports/cancel/media exit/pagehide restoration, filtered glossary and phone keyboard focus. '+results.length+' PDFs (8 baseline, 20 fixed). Native tests remain separate.');
}finally{await browser?.close();for(const s of servers)s.kill();}
