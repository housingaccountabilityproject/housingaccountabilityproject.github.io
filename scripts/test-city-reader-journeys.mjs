import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {existsSync, readdirSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {assertReaderContrast} from './reader-contrast.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.CITY_TEST_BASE_URL || 'http://127.0.0.1:8768';
const server = process.env.CITY_TEST_BASE_URL ? null : spawn('python3',['-m','http.server','8768','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
let browser;
const errors = [];
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
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),`${path} overflow at ${width}`);
      if(!['index.html','about.html','contact.html','privacy.html'].includes(path)) {
        assert.deepEqual(await page.locator('.city-main-nav>a').allTextContents(),['Overview','Projects','Funding','Questions','Sources','Search']);
      }
      await assertReaderContrast(page,path);
    }
    const appearance=[];
    for(const path of ['tucson/index.html','phoenix/index.html']) {
      await page.goto(base+'/'+path);
      appearance.push(await page.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,font:getComputedStyle(document.body).fontFamily,heading:getComputedStyle(document.querySelector('h1')).fontFamily,nav:getComputedStyle(document.querySelector('.city-header')).backgroundColor})));
      assert.equal(await page.locator('.city-learning-grid>a').count(),4);
      await page.locator('.city-concepts summary').first().focus();
      await page.keyboard.press('Enter');
      assert.notEqual(await page.locator('.city-concepts details').first().getAttribute('open'),null);
    }
    assert.deepEqual(appearance[0],appearance[1],'both cities share a theme');
    await page.locator('.city-switcher').getByRole('link',{name:'Tucson & Pima County',exact:true}).click();
    assert(page.url().endsWith('/tucson/index.html'));
    await page.locator('.city-main-nav').getByRole('link',{name:'Search',exact:true}).click();
    await page.getByLabel('Search Tucson & Pima County research',{exact:true}).fill('"El Portal"');
    await page.getByRole('button',{name:'Search',exact:true}).click();
    assert(await page.locator('#search-results mark[data-search-mark]').count()>0);
    assert((await page.locator('#search-results .search-why').first().textContent()).includes('Matched in:'));
    await page.getByRole('button',{name:'Clear',exact:true}).click();
    assert.equal(await page.locator('#search-results mark').count(),0);
    await page.locator('.city-switcher').getByRole('link',{name:'Phoenix',exact:true}).click();
    await page.locator('.city-main-nav').getByRole('link',{name:'Funding',exact:true}).click();
    await page.locator('[data-view="funding"][aria-pressed="true"]').waitFor();
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
  const page=await browser.newPage();
  await page.goto(base+'/phoenix/projects/moreland.html');
  mkdirSync('/tmp/hap-search-print',{recursive:true});
  await page.pdf({path:'/tmp/hap-search-print/moreland-project-file.pdf',format:'Letter',tagged:true});
  const pdf=execFileSync('pdftotext',['/tmp/hap-search-print/moreland-project-file.pdf','-'],{encoding:'utf8'}).replace(/\s+/g,' ');
  for(const term of ['132 planned apartments','105 planned apartments','$43.1 million','up to $10 million','up to 54'])assert(pdf.includes(term),term);
  await page.goto(base+'/phoenix/corrections.html');
  assert((await page.locator('.correction-empty').textContent()).includes('No correction entries'));
  assert.equal(await page.locator('.correction-entry').count(),0);
  await page.close();
  assert.deepEqual(errors,[]);
  console.log('PASS Moreland PDF and honest empty correction history. These automated checks are not a participant usability study.');
} finally {await browser?.close();server?.kill();}
