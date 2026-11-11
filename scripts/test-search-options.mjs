import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {existsSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'http://127.0.0.1:8768';
const output = '/tmp/hap-category-search';
mkdirSync(output, {recursive:true});
const server = spawn('python3', ['-m','http.server','8768','--bind','127.0.0.1'], {cwd:root,stdio:'ignore'});
let browser;
try {
  for (let i=0; i<50; i++) {
    try { assert((await fetch(base+'/search.html')).ok); break; }
    catch(error) { if(i===49) throw error; await new Promise(resolve=>setTimeout(resolve,100)); }
  }
  browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)});
  const context = await browser.newContext({timezoneId:'Asia/Tokyo',viewport:{width:1280,height:900}});
  await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  const page = await context.newPage();
  const errors=[];
  const requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>requests.push(request.url()));
  async function privacySnapshot() {
    return page.evaluate(()=>({url:location.href,history:history.length,local:localStorage.length,session:sessionStorage.length}));
  }
  async function checkPrivate(before, requestCount) {
    assert.deepEqual(await privacySnapshot(),before,'Search choices do not write URL, history or storage');
    assert.equal(requests.length,requestCount,'Searching and link preparation send no requests');
    assert.equal((await context.cookies()).length,0,'No search cookies');
  }
  async function skipTo(id) {
    const skip=page.locator('a.skip');
    assert.equal(await skip.getAttribute('href'),'#'+id);
    await skip.focus(); await skip.press('Enter');
    assert(await page.locator('#'+id).evaluate(node=>document.activeElement===node),'Skip reaches the visible report');
    assert(await page.locator('#'+id).isVisible());
  }
  async function inspectPDF(name) {
    const path=output+'/'+name+'.pdf';
    await page.pdf({path,format:'Letter',tagged:true,timeout:90000});
    const pages=execFileSync('pdftotext',[path,'-'],{encoding:'utf8',maxBuffer:8*1024*1024}).split('\f');
    if(!pages.at(-1).trim()) pages.pop();
    assert(pages.every(text=>text.trim()),'Every PDF page contains text');
    return pages.join(' ').replace(/\s+/g,' ');
  }
  for (const [scope,category,query,filter,total] of [
    ['tucson','sources','HUD','Other source records',10],
    ['phoenix','funding','year:unknown','__unindexed',11]
  ]) {
    const path=scope==='tucson'?'/search.html':'/phoenix/search.html';
    await page.goto(base+path); await page.waitForLoadState('networkidle');
    const before=await privacySnapshot(),requestCount=requests.length;
    assert(!(await page.locator('#include-search-terms').isChecked()));
    await page.locator('[data-category="'+category+'"]').click();
    await page.locator('#query').fill(query);
    await page.locator('#category-filter').selectOption(filter);
    assert((await page.locator('#count').textContent()).startsWith(total+' matches'));
    await page.locator('#next').click();
    const state=await page.locator('#page-count').textContent();
    for (const mode of ['compact','full']) {
      const button=mode==='compact'?'#print-compact':'#print';
      await page.locator(button).click(); await skipTo('print-sheet');
      const header=await page.locator('.print-header').textContent();
      assert(!header.includes('Search:'),'Typed terms omitted from default print');
      assert(header.includes('MST (UTC−7)'),'Print preparation time is MST even in a Tokyo browser');
      assert.equal(await page.locator('.print-record').count(),total);
      if(scope==='phoenix') assert(header.includes('Research snapshot: 2026-11-10'));
      const pdf=await inspectPDF('privacy-'+scope+'-'+mode);
      assert(pdf.includes(total+' matching records'));
      assert(!pdf.includes('Search: '+query));
      if(scope==='phoenix') {
        assert(pdf.includes('104 apartments') && pdf.includes('19 townhomes'));
        assert(pdf.includes('$10 million') && pdf.includes('loan') && pdf.includes('grant'));
      }
      await page.getByRole('button',{name:'← Back to search',exact:true}).click();
      assert(await page.locator(button).evaluate(node=>document.activeElement===node));
      assert.equal(await page.locator('#query').inputValue(),query);
      assert.equal(await page.locator('#category-filter').inputValue(),filter);
      assert.equal(await page.locator('#page-count').textContent(),state);
      assert.equal(await page.locator('a.skip').getAttribute('href'),'#main');
    }
    await page.locator('#include-search-terms').check();
    await page.locator('#print-compact').click();
    assert((await page.locator('.print-header').textContent()).includes('Search: “'+query+'”'));
    await page.getByRole('button',{name:'← Back to search',exact:true}).click();
    await page.getByText('Share this search · optional',{exact:true}).click();
    await page.locator('#create-search-link').click();
    const link=await page.locator('#shared-search-link').inputValue();
    assert.equal(new URL(link).search,'');
    assert(link.includes('#hap-search='));
    await checkPrivate(before,requestCount);
    const incoming=new URL(link);
    await page.goto(base+incoming.pathname+incoming.hash);
    assert.equal(await page.locator('#query').inputValue(),query);
    assert.equal(await page.locator('#category-filter').inputValue(),filter);
    assert.equal(await page.locator('#page-count').textContent(),state);
    assert(!(await page.locator('#include-search-terms').isChecked()),'Shared links do not opt into printing terms');
    await page.goto(base+path); await page.locator('#query').fill(query); await page.reload();
    assert.equal(await page.locator('#query').inputValue(),'','Ordinary reload clears the query');
    assert.equal(await page.locator('#category-filter').inputValue(),'');
    assert(!(await page.locator('#include-search-terms').isChecked()));
    assert.equal(await page.evaluate(()=>HAPSearchOptions.preparedAt(new Date('2026-11-11T00:15:00Z'))),'November 10, 2026 at 5:15:00 PM MST (UTC−7)');
    console.log('PASS category privacy, optional print terms, explicit sharing, report skip and return state',scope);
  }
  for (const [path,queryField,submit,preview,back,surface] of [
    ['/search-all.html','#site-query',true,'#preview-print','#close-print','broader Tucson'],
    ['/phoenix/records.html','#record-query',false,'#preview-print','#close-print','Phoenix evidence']
  ]) {
    await page.goto(base+path); await page.waitForLoadState('networkidle');
    const before=await privacySnapshot(),requestCount=requests.length;
    assert(!(await page.locator('#include-search-terms').isChecked()));
    await page.locator(queryField).fill('HOME');
    if(submit) await page.getByRole('button',{name:'Search',exact:true}).click();
    await page.locator(preview).click(); await skipTo('search-print-output');
    assert(!(await page.locator('#search-print-output > p').allTextContents()).some(text=>text.startsWith('Search:')));
    assert((await page.locator('#search-print-output').textContent()).includes('MST (UTC−7)'));
    if(!submit) assert((await page.locator('#search-print-output').textContent()).includes('2026-11-10'));
    await page.locator(back).click();
    assert.equal(await page.locator(queryField).inputValue(),'HOME');
    assert(await page.locator(preview).evaluate(node=>document.activeElement===node));
    await page.locator('#include-search-terms').check();
    await page.locator(preview).click();
    assert((await page.locator('#search-print-output > p').allTextContents()).some(text=>text==='Search: HOME'));
    await page.locator(back).click();
    await page.getByText('Share this search · optional',{exact:true}).click();
    await page.locator('#create-search-link').click();
    const link=new URL(await page.locator('#shared-search-link').inputValue());
    await checkPrivate(before,requestCount);
    await page.goto(base+link.pathname+link.hash);
    assert.equal(await page.locator(queryField).inputValue(),'HOME');
    assert(!(await page.locator('#include-search-terms').isChecked()));
    console.log('PASS default-off terms, explicit sharing, memory-only state and print skip',surface);
  }
  const failed=await context.newPage();
  await failed.route('**/assets/category-search-data.js',route=>route.abort());
  await failed.goto(base+'/search.html');
  assert((await failed.locator('#count').textContent()).includes('could not load'));
  assert.equal(await failed.locator('#count').getAttribute('role'),'alert');
  assert((await failed.locator('#full-search').getAttribute('href')).endsWith('evidence.html'));
  assert(await failed.locator('#full-search').isVisible());
  assert.deepEqual(errors,[]);
  console.log('PASS clear search-load failure fallback. DOM/Chromium/PDF automation; native dialogs and a spoken screen reader are separate manual checks.');
} finally {
  await browser?.close(); server.kill();
}
