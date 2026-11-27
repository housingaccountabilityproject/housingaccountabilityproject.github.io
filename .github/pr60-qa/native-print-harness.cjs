// Real Chromium PDF lifecycle against intercepted frozen candidate bytes.
// No live HAP request, synthetic print event, window.print override or runtime fix.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const [repo, output, packageFile, executable, python] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json')));
const {chromium} = require(path.dirname(packageFile));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const git = (...args) => {
  const r = spawnSync('git', args, {cwd:repo, encoding:'utf8'});
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
};
assert.equal(git('rev-parse', 'HEAD'), manifest.candidate);
assert.equal(git('rev-parse', 'HEAD^{tree}'), manifest.tree);
assert.equal(git('status', '--porcelain'), '');
fs.mkdirSync(output, {recursive:true});
const relative = 'research-updates.html?verify=1#hud-oversight';
const external = 'https://example.invalid/kept?verify=1#keep';
const legacyAbsolute = 'https://housingaccountabilityproject.github.io/about.html?verify=1#main';
const cases = [
  {name:'org-candidate', origin:'https://housingaccountabilityproject.org',
   expected:'https://housingaccountabilityproject.org/research-updates.html?verify=1#hud-oversight', rewrite:false},
  {name:'legacy-control', origin:'https://housingaccountabilityproject.github.io',
   expected:'https://housingaccountabilityproject.github.io/research-updates.html?verify=1#hud-oversight', rewrite:true},
  {name:'unrelated-control', origin:'https://unrelated.example.invalid',
   expected:'https://unrelated.example.invalid/research-updates.html?verify=1#hud-oversight', rewrite:false},
];
const results = [];
let browser;
function audit(file) {
  const code = "import fitz,json,sys;d=fitz.open(sys.argv[1]);print(json.dumps({'pages':len(d),'uris':[l.get('uri') for p in d for l in p.get_links() if l.get('uri')]}))";
  const r=spawnSync(python, ['-c',code,file], {encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
(async()=>{
 try {
  browser = await chromium.launch({headless:true, executablePath:executable});
  const browserVersion = await browser.version();
  for (const item of cases) {
   const row={name:item.name,candidate:manifest.candidate,origin:item.origin,browserVersion,
    engine:'Chromium PrintToPDF',nativeDialog:false,manualPrintEvents:false,requests:[],blocked:[],pass:false};
   const context=await browser.newContext({viewport:{width:1280,height:900}});
   try {
    await context.route('**/*',async route=>{
     try {
      const u=new URL(route.request().url());
      if(u.origin!==item.origin){row.blocked.push(u.href);return route.abort();}
      let rel=decodeURIComponent(u.pathname).replace(/^\//,'');
      if(!rel||rel.endsWith('/'))rel+='index.html';
      const file=path.resolve(repo,rel);
      assert(file.startsWith(path.resolve(repo)+path.sep),'Candidate path escape');
      if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Missing candidate file'});
      let body=fs.readFileSync(file);
      const expectedBlob=git('rev-parse',manifest.candidate+':'+rel);
      const blob=crypto.createHash('sha1').update(Buffer.from('blob '+body.length+'\0')).update(body).digest('hex');
      assert.equal(blob,expectedBlob,'Candidate asset bytes changed: '+rel);
      row.requests.push({path:rel,sha256:hash(body),gitBlob:blob});
      if(rel==='tucson.html') {
       assert.equal(hash(body),manifest.tucson_html_sha256);
       row.candidateResponseSHA256=hash(body);
       if(item.name!=='org-candidate') {
        const source=body.toString(),needle='href="https://housingaccountabilityproject.org/tucson.html"';
        assert.equal(source.split(needle).length-1,1);
        body=Buffer.from(source.replace(needle,'href="'+item.origin+'/tucson.html"'));
        row.controlFixtureChange='Canonical href origin only; candidate runtime bytes unchanged';
       }
      }
      if(rel==='assets/general-page-print-links.js')assert.equal(hash(body),manifest.helper_sha256);
      const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json'};
      return route.fulfill({status:200,contentType:types[path.extname(rel)]||'application/octet-stream',body});
     }catch(error){row.routeError=String(error);return route.abort();}
    });
    const page=await context.newPage();
    await page.goto(item.origin+'/tucson.html',{waitUntil:'load'});
    assert.equal(await page.title(),'Tucson & Pima County | Housing Accountability Project');
    assert(await page.locator('script[src*="general-page-print-links.js"]').count(),'Actual general-page helper must load');
    // The primary document/asset response bytes are exact. A clearly labeled
    // probe is inserted into its main for the requested relative query/fragment.
    await page.evaluate(({relative,external,legacyAbsolute})=>{
     const p=document.createElement('p');p.id='pr60-native-print-probe';
     for(const [id,href,text] of [['relative',relative,'PR60 relative query and fragment'],['external',external,'PR60 unrelated absolute control'],['legacy',legacyAbsolute,'PR60 legacy absolute control']]){
      const a=document.createElement('a');a.id='pr60-'+id;a.href=href;a.textContent=text;p.append(a,document.createTextNode(' | '));
     }
     document.querySelector('main').append(p);
     document.getElementById('pr60-relative').focus();
     const state=()=>Object.fromEntries(['relative','external','legacy'].map(id=>{
      const a=document.getElementById('pr60-'+id);return[id,{attribute:a.getAttribute('href'),resolved:a.href,label:a.getAttribute('data-hap-print-original-href')}];
     }));
     window.__pr60Native={before:state(),events:[],focus:document.activeElement.id};
     // Installed after production listeners, so the snapshots see helper work.
     for(const name of ['beforeprint','afterprint'])addEventListener(name,()=>window.__pr60Native.events.push({name,links:state(),focus:document.activeElement.id}));
    },{relative,external,legacyAbsolute});
    row.fixtureProbe='One labeled main probe; relative path/query/fragment plus unchanged absolute controls';
    const pdf=path.join(output,item.name+'.pdf');
    await page.pdf({path:pdf,format:'Letter',tagged:true,displayHeaderFooter:false});
    row.trace=await page.evaluate(()=>window.__pr60Native);
    row.pdf=path.basename(pdf);row.pdfSHA256=hash(fs.readFileSync(pdf));row.pdfAudit=audit(pdf);
    assert(!row.routeError,row.routeError);
    const before=row.trace.before,events=row.trace.events;
    assert.equal(before.relative.attribute,relative);assert.equal(before.relative.resolved,item.expected);
    const during=events.find(e=>e.name==='beforeprint'),after=events.findLast(e=>e.name==='afterprint');
    assert(during&&after,'Real beforeprint and afterprint must both fire');
    assert(events.indexOf(after)>events.indexOf(during),'Native lifecycle order');
    assert.equal(during.links.relative.attribute,item.rewrite?item.expected:relative);
    assert.equal(during.links.relative.resolved,item.expected);
    assert.equal(during.links.relative.label,item.rewrite?relative:null);
    assert.deepEqual(after.links,before,'All attributes/labels restored after native print');
    assert.equal(after.focus,row.trace.focus,'Native print return focus');
    for(const phase of [before,during.links,after.links]){
     assert.equal(phase.external.attribute,external);assert.equal(phase.external.resolved,external);
     assert.equal(phase.legacy.attribute,legacyAbsolute);assert.equal(phase.legacy.resolved,legacyAbsolute);
    }
    for(const expected of [item.expected,external,legacyAbsolute])assert(row.pdfAudit.uris.includes(expected),'Saved PDF URI missing: '+expected);
    row.pass=true;
   }catch(error){row.error=error.stack||String(error);}finally{await context.close();}
   results.push(row);
  }
  const report={candidate:manifest.candidate,tree:manifest.tree,pass:results.length===3&&results.every(r=>r.pass),
   runtimeHelperModified:false,liveSiteUsed:false,syntheticPrintEvents:false,nativeDialogClaimed:false,results};
  fs.writeFileSync(path.join(output,'native-print-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({candidate:report.candidate,pass:report.pass,results:results.map(r=>({name:r.name,pass:r.pass,error:r.error,pdf:r.pdf}))},null,2));
  if(!report.pass)process.exitCode=1;
 }finally{await browser?.close();}
})().catch(error=>{fs.writeFileSync(path.join(output,'native-print-blocker.txt'),String(error.stack||error)+'\n');console.error(error);process.exitCode=2;});
