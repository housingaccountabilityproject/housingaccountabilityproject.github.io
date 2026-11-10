import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {existsSync, readdirSync, mkdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {assertReaderContrast} from './reader-contrast.mjs';
import {openNavigation,closeNavigation} from './browser-navigation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.CITY_TEST_BASE_URL || 'http://127.0.0.1:8768';
const server = process.env.CITY_TEST_BASE_URL ? null : spawn('python3',['-m','http.server','8768','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
let browser;
const errors = [];
const pageIds = new Map();
function files(folder, prefix='') {
  return readdirSync(folder,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(folder+'/'+entry.name,prefix+entry.name+'/') : entry.name.endsWith('.html') ? [prefix+entry.name] : []);
}
try {
  for(let i=0;i<40;i++) {
    try {assert((await fetch(base+'/phoenix/projects/moreland.html')).ok);break;}
    catch(error){if(i===39)throw error;await new Promise(resolve=>setTimeout(resolve,100));}
  }
  const executablePath=process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const all = readdirSync(root).filter(name=>name.endsWith('.html')&&!name.startsWith('google')).concat(files(root+'/tucson','tucson/'),files(root+'/phoenix','phoenix/'),files(root+'/reports','reports/'));
  for(const width of [320,1280]) {
    const page=await browser.newPage({viewport:{width,height:950}});
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
    for(const path of all) {
      const response=await page.goto(base+'/'+path);
      assert.equal(response.status(),200,path);
      assert.equal(await page.locator('main h1').count(),1,path);
      assert.equal(await page.locator('.city-header').count(),1,path);
      assert.equal(await page.locator('.city-footer').count(),1,path);
      await openNavigation(page);
      for(const [region, name] of [['.city-main-nav','About'],['.city-footer','About the project']]) {
        const about=page.locator(region).getByRole('link',{name,exact:true});
        if(region==='.city-footer')await closeNavigation(page);
        assert(await about.isVisible(),`${path}: ${name} is available at ${width}`);
        assert.equal(await about.evaluate(link=>link.pathname),'/about.html',path);
      }
      if(width===320)pageIds.set(path,new Set(await page.locator('[id]').evaluateAll(nodes=>nodes.map(node=>node.id))));
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),`${path} overflow at ${width}`);
      if(!['index.html','about.html','contact.html','privacy.html'].includes(path)) {
        assert.deepEqual(await page.locator('.city-main-nav>a').allTextContents(),['Overview','About','Projects','Funding','Questions','Sources','Search']);
      }
      await assertReaderContrast(page,path);
    }
    const appearance=[];
    for(const path of ['index.html','tucson/index.html','phoenix/index.html']) {
      await page.goto(base+'/'+path);
      const image=page.locator('.city-landscape img');
      assert(await image.isVisible(),`${path}: visible landscape`);
      assert(await image.evaluate(node=>node.complete&&node.naturalWidth===1983),`${path}: landscape loaded`);
      assert.equal(await image.evaluate(node=>getComputedStyle(node).opacity),'1');
      assert.equal(await image.getAttribute('alt'),'');
      assert((await image.boundingBox()).height>=95,`${path}: landscape has space of its own`);
    }
    for(const path of ['tucson/index.html','phoenix/index.html']) {
      await page.goto(base+'/'+path);
      appearance.push(await page.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,font:getComputedStyle(document.body).fontFamily,heading:getComputedStyle(document.querySelector('h1')).fontFamily,nav:getComputedStyle(document.querySelector('.city-header')).backgroundColor})));
      assert.equal(await page.locator('.city-learning-grid>a').count(),4);
      assert.equal(await page.locator('.city-hero-copy>.hero-intro').count(),1);
      assert(await page.locator('.city-hero-date').isVisible());
      assert.equal(await page.locator('.city-about').getAttribute('open'),null);
      assert.deepEqual(await page.locator('.city-reading-guide>section').evaluateAll(nodes=>nodes.map(node=>node.id)),['guide-findings','guide-projects','guide-questions','guide-sources']);
      assert.equal(await page.locator('.city-project-grid>.city-project-card').count(),2);
      assert.equal(await page.locator('.city-stage-grid>li').count(),4);
      await openNavigation(page);
      await page.locator('.city-more>summary').click();
      const menu=await page.locator('.city-more>div').boundingBox();
      assert(menu.x>=0&&menu.x+menu.width<=width,`${path}: resources menu fits the viewport`);
      await page.keyboard.press('Escape');
      await page.locator('.city-evidence-library>summary').click();
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),`${path}: expanded research fits ${width}`);
      await page.locator('.city-evidence-library>summary').click();
      await page.locator('.city-funding-explainer>summary').click();
      await page.locator('.city-stage-grid summary').first().focus();
      await page.keyboard.press('Enter');
      assert.notEqual(await page.locator('.city-stage-grid details').first().getAttribute('open'),null);
      assert((await page.locator('.city-stage-note').textContent()).includes('not a guaranteed sequence'));
    }
    assert.deepEqual(appearance[0],appearance[1],'both cities share a theme');
    await openNavigation(page);
    await page.locator('.city-switcher').getByRole('link',{name:'Tucson & Pima County',exact:true}).click();
    assert(page.url().endsWith('/tucson/index.html'));
    await openNavigation(page);
    await page.locator('.city-main-nav').getByRole('link',{name:'Search',exact:true}).click();
    await page.getByLabel('Search these records',{exact:true}).fill('"El Portal"');
    await page.getByRole('button',{name:'Search',exact:true}).click();
    assert(await page.locator('#results article').count()>0);
    await page.locator('#reset').click();
    assert.equal(await page.locator('#query').inputValue(),'');
    await openNavigation(page);
    await page.locator('.city-switcher').getByRole('link',{name:'Phoenix',exact:true}).click();
    await openNavigation(page);
    await page.locator('.city-main-nav').getByRole('link',{name:'Funding',exact:true}).click();
    await page.locator('[data-view="funding"][aria-pressed="true"]').waitFor();
    await openNavigation(page);
    await page.locator('.city-main-nav').getByRole('link',{name:'Sources',exact:true}).click();
    await page.locator('[data-view="source"][aria-pressed="true"]').waitFor();
    await page.locator('#source-program').selectOption('home');
    await page.locator('#source-format').selectOption('dataset-metadata');
    const hud=page.locator('#source-agency option[value="hud"]');
    const catalog=page.locator('#source-agency option[value="data-gov"]');
    assert((await hud.textContent()).endsWith('(2)'));
    assert((await catalog.textContent()).endsWith('(1)'));
    await page.locator('#source-agency').selectOption('hud');
    assert((await page.locator('#source-year option[value="2026"]').textContent()).endsWith('(1)'));
    await page.getByRole('button',{name:'Clear filters',exact:true}).click();
    await page.getByRole('searchbox').fill('Moreland');
    assert(await page.locator('.record-card:visible mark').count()>0);
    assert((await page.locator('.record-card:visible .search-why').first().textContent()).includes('Matched in:'));
    assert.deepEqual(await page.evaluate(() => {
      const root=document.createElement('div');
      const original='The oﬃce — café <img src=x onerror=alert(1)>';
      root.textContent=original;
      window.HAPSearchText.highlight(root,window.HAPSearchText.tokens('office café "<img src=x onerror=alert(1)>"'));
      const result={same:root.textContent===original,marks:root.querySelectorAll('mark').length,images:root.querySelectorAll('img').length};
      window.HAPSearchText.clear(root);result.cleared=root.querySelectorAll('mark').length===0&&root.textContent===original;
      return result;
    }),{same:true,marks:3,images:0,cleared:true});
    await openNavigation(page);
    await page.locator('.city-main-nav').getByRole('link',{name:'Projects',exact:true}).click();
    await page.getByRole('searchbox').fill('Moreland');
    await page.locator('#project-moreland').getByRole('link',{name:'Read the published context',exact:false}).click();
    assert(page.url().endsWith('/phoenix/projects/moreland.html'));
    assert((await page.locator('#phase-i').textContent()).includes('$43.1 million'));
    assert((await page.locator('#phase-ii').textContent()).includes('up to $10 million'));
    assert((await page.locator('#scope').textContent()).includes('not to use that as completed Phase I units'));
    assert((await page.locator('#sources').textContent()).includes('PHX-EXT-PROJECT-002'));
    await page.locator('#evidence-needed').getByRole('link',{name:'Follow the evidence needed'}).first().click();
    assert(page.url().endsWith('#need-question-overview-03'));
    if(width===1280) {
      for(const path of ['tucson/index.html','phoenix/index.html','phoenix/projects/moreland.html','search.html','phoenix/records.html']) {
        await page.goto(base+'/'+path);await page.evaluate(()=>document.body.style.zoom='2');
        assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),`${path} 200% zoom`);
      }
    }
    await page.close();
    console.log(`PASS shared theme, ${all.length} pages, learning paths, city navigation and search journeys at ${width}.`);
  }
  const editorial=JSON.parse(readFileSync(root+'/data/city-reader-guide.json','utf8'));
  function links(value){
    if(Array.isArray(value))return value.flatMap(links);
    if(value&&typeof value==='object')return Object.entries(value).flatMap(([key,item])=>(key==='href'||key.endsWith('_href'))?[item]:links(item));
    return [];
  }
  for(const target of new Set(links(editorial))){
    const url=new URL(target,'https://hap.test/');
    const ids=pageIds.get(url.pathname.slice(1));
    assert(ids,`guide destination: ${target}`);
    if(url.hash)assert(ids.has(decodeURIComponent(url.hash.slice(1))),`guide anchor: ${target}`);
  }
  for(const path of ['tucson/index.html','phoenix/index.html']) {
    const page=await browser.newPage({viewport:{width:390,height:900}});
    await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
    await page.goto(base+'/'+path);
    const first=await page.locator('.city-learning-grid>a').first().boundingBox();
    assert(first.y+first.height<=900,`${path}: a learning path is visible on a phone's opening screen`);
    const state=()=>page.locator('.city-about,.city-evidence-library,.city-stage-grid details').evaluateAll(nodes=>nodes.map(node=>node.open));
    const before=await state();
    await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
    assert((await state()).every(Boolean));
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
    assert.deepEqual(await state(),before,'print restores optional-reading state');
    await page.close();
  }
  for(const [path,id] of [['tucson/index.html','latest-updates'],['phoenix/index.html','PHX-WEB-009']]) {
    const page=await browser.newPage();
    await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
    await page.goto(base+'/'+path+'#'+id);
    assert(await page.locator('#'+id).isVisible(),`${id}: saved link reveals research`);
    await page.locator('.city-evidence-library>summary').click();
    assert(await page.locator('#'+id).isHidden());
    await page.evaluate(id=>{const a=document.createElement('a');a.href='#'+id;a.id='repeat-library-link';a.textContent='Read the same record';document.querySelector('main').prepend(a)},id);
    await page.locator('#repeat-library-link').click();
    assert(await page.locator('#'+id).isVisible(),`${id}: repeated link reveals research`);
    await page.close();
  }
  const noScript=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:900}});
  await noScript.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  const plain=await noScript.newPage();
  await plain.goto(base+'/');
  assert(await plain.locator('.city-menu-toggle').isHidden());
  assert(await plain.locator('.city-menu-close').isHidden(),'inactive drawer controls stay hidden without JavaScript');
  assert(await plain.getByRole('navigation',{name:'Main navigation'}).isVisible());
  await plain.locator('.city-home-hero').getByRole('link',{name:'About the project and founder',exact:true}).click();
  assert.equal(new URL(plain.url()).pathname,'/about.html');
  assert(await plain.locator('main h1').isVisible(),'About opens without JavaScript');
  await plain.goto(base+'/phoenix/index.html');
  await plain.locator('.city-evidence-library>summary').click();
  assert(await plain.locator('#PHX-WEB-009').isVisible(),'full findings are available without JavaScript');
  await plain.goto(base+'/housing-projects.html');
  assert.equal(await plain.locator('[data-catalog-entry]:visible').count(),5);
  await plain.locator('#project-pub-001 .city-project-details>summary').click();
  assert(await plain.locator('#project-pub-001 .limit').isVisible());
  await noScript.close();
  console.log('PASS landscape loading, phone entry paths, guide links, funding-stage disclosures, saved/repeated research links, print restoration and reading without JavaScript.');
  const page=await browser.newPage();
  await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  await page.goto(base+'/phoenix/projects/moreland.html');
  mkdirSync('/tmp/hap-search-print',{recursive:true});
  await page.pdf({path:'/tmp/hap-search-print/moreland-project-file.pdf',format:'Letter',tagged:true});
  const pdf=execFileSync('pdftotext',['/tmp/hap-search-print/moreland-project-file.pdf','-'],{encoding:'utf8'}).replace(/\s+/g,' ');
  for(const term of ['132 planned apartments','105 planned apartments','$43.1 million','up to $10 million','up to 54'])assert(pdf.includes(term),term);
  await page.goto(base+'/phoenix/index.html');
  await page.pdf({path:'/tmp/hap-search-print/phoenix-overview-guide.pdf',format:'Letter',tagged:true});
  const overviewPdf=execFileSync('pdftotext',['/tmp/hap-search-print/phoenix-overview-guide.pdf','-'],{encoding:'utf8'}).replace(/\s+/g,' ');
  for(const term of ['Four records. Four different meanings.','PHX-WEB-009','$43.1 million','Neither amount is total City assistance'])assert(overviewPdf.includes(term),term);
  assert.equal(await page.locator('.city-evidence-library').getAttribute('open'),null,'real PDF restores the closed library');
  await page.goto(base+'/phoenix/corrections.html');
  assert((await page.locator('.correction-empty').textContent()).includes('No correction entries'));
  assert.equal(await page.locator('.correction-entry').count(),0);
  await page.close();
  assert.deepEqual(errors,[]);
  console.log('PASS Moreland PDF and honest empty correction history. These automated checks are not a participant usability study.');
} finally {await browser?.close();server?.kill();}
