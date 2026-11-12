/* Fragment recovery on exact candidate pages and on the private review wrapper.
 * DOM/live-region assertions are separate from native ChromeVox spoken output.
 */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url)),temporary=mkdtempSync(join(tmpdir(),'hap-fragments-private-'));
const output=process.env.REVIEW_PRINT_OUTPUT||'/tmp/hap-review-print-verified';mkdirSync(output,{recursive:true});
const base='http://127.0.0.1:8789';
const server=spawn('python3',['-m','http.server','8789','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const fixed=join(temporary,'fixed.html'),legacy=join(temporary,'legacy.html');
for(const [path,flags] of [[fixed,[]],[legacy,['--legacy-print']]])execFileSync('python3',['scripts/build-review-preview.py','--lists','--output',path,...flags],{cwd:root});
const results={checkout:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),spoken_output:false,cases:[]};
let browser;
function state(frame){return frame.evaluate(()=>({
 hash:location.hash,topic:document.getElementById('topic').value,query:document.getElementById('search').value,
 source:document.getElementById('sources-count').textContent,question:document.getElementById('questions-count').textContent,
 sourcePage:document.getElementById('sources-page').textContent,questionPage:document.getElementById('questions-page').textContent,
 visible:!document.getElementById('src-125').hidden,focus:document.activeElement.id,
 notice:document.querySelector('.list-link-notice').textContent,
 noticeAtomic:document.querySelector('.list-link-notice').getAttribute('aria-atomic'),
 live:['sources-count','questions-count'].map(id=>({id,role:document.getElementById(id).getAttribute('role'),live:document.getElementById(id).getAttribute('aria-live')})),
 terms:document.getElementById('include-search-terms').checked
}));}
async function recovered(frame,notice=false){
 await frame.waitForFunction(()=>!document.getElementById('src-125').hidden&&document.activeElement.id==='src-125'&&document.getElementById('sources-page').textContent==='Page 12 of 12');
 const s=await state(frame);assert.equal(s.topic,'');assert.equal(s.query,'');assert.match(s.source,/^67 of 67 .*Showing 67–67$/);assert.equal(s.sourcePage,'Page 12 of 12');
 assert(s.live.every(x=>x.role==='status'&&x.live==='polite'));assert(!s.terms);
 if(notice)assert.match(s.notice,/filters were cleared.*src-125/i);
 assert.equal(s.noticeAtomic,'true');
 return s;
}
async function home(frame){await frame.locator('#topic').selectOption('home');const s=await state(frame);assert.match(s.source,/^12 of 67 .*Showing 1–6$/);assert(!s.visible);return s;}
async function openWrapper(page,path,hash=''){
 await page.goto(pathToFileURL(path).href+hash);const frame=page.frames().find(f=>f.parentFrame()===page.mainFrame());await frame.waitForSelector('#topic');return frame;
}
async function noticeAX(page){
 const session=await page.context().newCDPSession(page);
 try{
  const doc=await session.send('DOM.getDocument');
  const {nodeId}=await session.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.list-link-notice'});
  const {node}=await session.send('DOM.describeNode',{nodeId});
  const {nodes}=await session.send('Accessibility.getPartialAXTree',{backendNodeId:node.backendNodeId,fetchRelatives:false});
  const ax=nodes[0];return {ignored:ax.ignored,role:ax.role?.value,properties:Object.fromEntries((ax.properties||[]).map(p=>[p.name,p.value.value])),ignoredReasons:ax.ignoredReasons?.map(r=>r.name)};
 }finally{await session.detach();}
}
try{
 for(let i=0;i<40;i++){try{assert((await fetch(base+'/evidence.html')).ok);break;}catch(e){if(i===39)throw e;await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{})});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=route.request().url();return url.startsWith('file:')||url.startsWith(base+'/')?route.continue():route.abort();});
 // Standalone file and HTTP: same-document hash, fresh load, reload, repeated
 // public-record link, Back/Forward, and question-page independence.
 for(const url of [pathToFileURL(join(root,'evidence.html')).href,base+'/evidence.html']){
  const scheme=url.startsWith('file:')?'file':'http';await page.goto(url);await page.reload();
  const emptyAX=await noticeAX(page);assert(!emptyAX.ignored&&emptyAX.role==='status','Empty notice is exposed before a message exists');assert.equal(emptyAX.properties.live,'polite');assert.equal(emptyAX.properties.atomic,true);
  if(scheme==='file'){
   const legacyStyle=await page.addStyleTag({content:'.list-link-notice:empty{display:none!important}'}),legacyAX=await noticeAX(page);
   assert(legacyAX.ignored,'Legacy display:none removes the live region before its first update');await legacyStyle.evaluate(n=>n.remove());
   results.noticeExposure={beforeMessage:emptyAX,legacyDisplayNone:legacyAX,nativeSpeechVerified:false};
  }
  await home(page);
  const origin=await page.evaluate(()=>performance.timeOrigin);await page.goto(url+'#src-125');assert.equal(await page.evaluate(()=>performance.timeOrigin),origin,'A real same-document fragment change');
  results.cases.push({surface:'standalone-'+scheme,action:'HOME then hash change',state:await recovered(page,true)});
  const populatedAX=await noticeAX(page);assert(!populatedAX.ignored&&populatedAX.role==='status');
  await page.goBack();await page.waitForFunction(()=>document.getElementById('topic').value==='home');assert.match((await state(page)).source,/^12 of 67 /);
  await page.goForward();results.cases.push({surface:'standalone-'+scheme,action:'Forward restores linked record',state:await recovered(page)});
  await page.reload();results.cases.push({surface:'standalone-'+scheme,action:'refresh with fragment',state:await recovered(page)});
  await page.goto('about:blank');await page.goto(url+'#src-125');results.cases.push({surface:'standalone-'+scheme,action:'fresh fragment load',state:await recovered(page)});
  // Manual filtering can hide a previously linked record; a repeated same-hash
  // in-page link must recover it without requiring another hashchange event.
  await home(page);await page.evaluate(()=>{const a=document.createElement('a');a.id='repeat-fragment-test';a.href='#src-125';a.textContent='Reveal linked source again';document.querySelector('main').prepend(a);});
  await page.locator('#repeat-fragment-test').click();results.cases.push({surface:'standalone-'+scheme,action:'repeat same-fragment link',state:await recovered(page,true)});
  await page.goto(url);await page.reload();await page.locator('#questions-next').click();await page.goto(url+'#src-125');const independent=await recovered(page);assert.equal(independent.questionPage,'Page 2 of 4');
  results.cases.push({surface:'standalone-'+scheme,action:'question page retained',state:independent});
  await page.locator('#search').fill('no-record-17373');assert.match((await state(page)).source,/^0 of 67 /);
  await page.goto(url+'#src-124');await page.waitForFunction(()=>!document.getElementById('src-124').hidden);assert.equal(await page.locator('#search').inputValue(),'');
  assert(!new URL(page.url()).search,'Ordinary terms/filter state are not put in the URL');
 }
 // The original-style OUTER fragment never reaches srcdoc. This control must
 // reproduce the reported filtered-state -> unfiltered first-page pattern.
 {
  let f=await openWrapper(page,legacy);await home(f);await page.goto(pathToFileURL(legacy).href+'#src-125');
  const before=await state(f);assert.equal(before.topic,'home');assert.equal(before.sourcePage,'Page 1 of 2');assert(!before.visible);
  await page.reload();f=page.frames().find(f=>f.parentFrame()===page.mainFrame());await f.waitForSelector('#topic');const after=await state(f);assert.equal(after.topic,'');assert.equal(after.sourcePage,'Page 1 of 12');assert(!after.visible);
  results.cases.push({surface:'legacy-wrapper-control',action:'outer fragment then refresh',before,after});
 }
 // Corrected wrapper forwards outer hashes on both hashchange and initial load.
 {
  let f=await openWrapper(page,fixed);await home(f);await page.goto(pathToFileURL(fixed).href+'#src-125');
  results.cases.push({surface:'corrected-wrapper',action:'HOME then outer hash change',state:await recovered(f,true)});
  await page.reload();f=page.frames().find(f=>f.parentFrame()===page.mainFrame());await f.waitForSelector('#topic');results.cases.push({surface:'corrected-wrapper',action:'refresh outer fragment',state:await recovered(f)});
  await page.goto('about:blank');f=await openWrapper(page,fixed,'#src-125');results.cases.push({surface:'corrected-wrapper',action:'fresh outer fragment load',state:await recovered(f)});
 }
 assert.deepEqual(errors,[]);writeFileSync(join(output,'fragment-results.json'),JSON.stringify(results,null,2)+'\n');
 console.log('PASS fragment recovery: standalone file/HTTP hash changes, fresh loads, refresh, repeated links, Back/Forward, independent pages, privacy, focus and live-region text. Legacy outer-fragment control reproduces filtered then first-page behavior; corrected wrapper forwards fragments. ChromeVox speech remains separate.');
}finally{await browser?.close();server.kill();rmSync(temporary,{recursive:true,force:true});}
