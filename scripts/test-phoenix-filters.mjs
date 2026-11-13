import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.PHOENIX_FILTER_TEST_BASE_URL || 'http://127.0.0.1:8769';
const output = process.env.PHOENIX_FILTER_TEST_OUTPUT || '/tmp/hap-phoenix-filters';
mkdirSync(output, {recursive:true});
const server = process.env.PHOENIX_FILTER_TEST_BASE_URL ? null : spawn('python3', ['-m','http.server','8769','--bind','127.0.0.1'], {cwd:root, stdio:'ignore'});
const views = [['all','All entries',90], ['funding','Funding',19], ['source','Sources',45], ['question','Questions',13]];
const facets = {'source-agency':'sourceAgency','source-program':'sourcePrograms','source-format':'sourceFormat','source-year':'sourceYears'};
const results = [];
let browser;
try {
  for(let i=0;i<40;i++) {
    try {assert((await fetch(base+'/phoenix/records.html')).ok);break;}
    catch(error) {if(i===39)throw error;await new Promise(resolve=>setTimeout(resolve,100));}
  }
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({headless:true, ...(executablePath ? {executablePath} : {})});
  for(const width of [320,390,768,1280]) {
    const page = await browser.newPage({viewport:{width,height:1000}, ...(width<600 ? {isMobile:true,hasTouch:true} : {})});
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(base+'/') ? route.continue() : route.abort());
    await page.goto(base+'/phoenix/records.html');
    const cards = await page.locator('.record-card').evaluateAll(nodes=>nodes.map(n=>({id:n.id,...n.dataset})));
    const query = page.getByRole('searchbox');
    const clear = page.getByRole('button',{name:'Clear filters',exact:true});
    const selectView = async name => {await clear.click();await page.getByRole('button',{name,exact:true}).click();};
    async function check(expected,total,label) {
      const state = await page.evaluate(()=>({
        ids:[...document.querySelectorAll('.record-card:not([hidden])')].map(n=>n.id),
        count:document.querySelector('#record-count').textContent,
        empty:!document.querySelector('#record-empty').hidden,
        page:document.querySelector('#records-page').textContent,
        overflow:document.documentElement.scrollWidth>innerWidth+1
      }));
      assert.deepEqual(state.ids,expected.slice(0,6).map(c=>c.id),label);
      assert(state.count.startsWith(`${expected.length} of ${total} `),label+' total');
      assert.equal(state.empty,expected.length===0,label+' no-results feedback');
      assert.match(state.page,/^Page 1 of /,label+' resets pagination');
      assert(!state.overflow,label+' fits viewport');
      results.push({width,label,matches:expected.length,passed:true});
    }
    for(const [view,name,total] of views) {
      await selectView(name);
      const expected = cards.filter(c=>view==='all'||c.group===view);
      await check(expected,total,name+' initial');
      assert(await query.isVisible());
      assert.equal(await page.locator('#record-filters .filter-chips').count(),0);
      const fields = view==='source' ? Object.keys(facets) : ['record-topic','record-kind'];
      for(const id of fields) assert(await page.locator('#'+id).isVisible(),name+' '+id+' is available');
      const ax = await page.locator('#record-filters').ariaSnapshot();
      assert.match(ax,/searchbox "Search Phoenix and Maricopa County research"/);
      assert.match(ax,/group "Filters"/);
      writeFileSync(`${output}/ax-${width}-${view}.txt`,ax);
      // Complete pagination retains every original record, in the same order.
      const paged = [];
      do {
        paged.push(...await page.locator('.record-card:visible').evaluateAll(nodes=>nodes.map(n=>n.id)));
        if(await page.locator('#records-next').isDisabled())break;
        await page.locator('#records-next').click();
      } while(true);
      assert.deepEqual(paged,expected.map(c=>c.id),name+' complete pagination');
      await query.fill('no-match-phoenix-filters-739180');
      await check([],total,name+' unmatched search');
      await query.fill('');
      await check(expected,total,name+' clearing search');
      const example = expected.find(c=>c.id.startsWith('source-')) || expected[0];
      await query.fill(example.id);
      await check(expected.filter(c=>c.id===example.id),total,name+' identifier search');
      await query.fill('');
      // Exercise every option, including zero-result options, through visible controls.
      for(const id of fields) {
        const values = await page.locator('#'+id+' option').evaluateAll(nodes=>nodes.map(n=>n.value));
        for(const value of values) {
          await page.locator('#'+id).selectOption(value);
          const key = facets[id] || (id==='record-topic' ? 'topic' : 'kind');
          const filtered = expected.filter(c=>!value||(c[key]||'').split(' ').includes(value));
          await check(filtered,total,name+' '+id+'='+value);
          if(view==='source') {
            const counts = await page.locator('#source-filters select').evaluateAll(nodes=>nodes.map(n=>({id:n.id,options:[...n.options].map(o=>({value:o.value,text:o.textContent}))})));
            for(const f of counts) for(const option of f.options) {
              const n=expected.filter(c=>(f.id===id||!value||(c[key]||'').split(' ').includes(value))&&(!option.value||(c[facets[f.id]]||'').split(' ').includes(option.value))).length;
              assert(option.text.endsWith(`(${n})`),name+' dynamic facet count '+id+' / '+f.id+'='+option.value);
            }
          }
        }
        await page.locator('#'+id).selectOption('');
      }
      // Keyboard traversal reaches the shared search/reset row and every relevant select.
      await query.focus();
      await query.press('Tab');
      assert(await clear.evaluate(n=>n===document.activeElement));
      for(const id of fields) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement.id),id,name+' keyboard '+id);
        assert.match(await page.locator('#'+id).evaluate(n=>getComputedStyle(n).outlineStyle),/solid/);
      }
      await clear.click();
      assert.equal(await query.inputValue(),'');
      assert.equal(await page.locator('.record-views [aria-pressed="true"]').getAttribute('data-view'),'all');
      for(const id of ['record-topic','record-kind',...Object.keys(facets)])assert.equal(await page.locator('#'+id).inputValue(),'');
      await page.getByRole('button',{name,exact:true}).click();
      if(width===390||width===1280) {
        await page.locator('.records-workspace').evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'}));
        const box = await page.locator('.records-workspace').boundingBox();
        const bottom = await page.locator('#record-count').boundingBox();
        await page.screenshot({path:`${output}/${width}-${view}.png`,clip:{x:box.x,y:box.y,width:box.width,height:bottom.y+bottom.height-box.y+16}});
      }
    }
    // All four source facets combine with text, then clearing resets every value.
    await selectView('Sources');
    for(const [id,value] of [['source-agency','hud'],['source-program','home'],['source-format','dataset-metadata'],['source-year','2026']])await page.locator('#'+id).selectOption(value);
    await check(cards.filter(c=>c.id==='source-PHX-EXT-PROJECT-203'),45,'combined source facets');
    await query.fill('PHX-EXT-PROJECT-203');
    await check(cards.filter(c=>c.id==='source-PHX-EXT-PROJECT-203'),45,'combined source facets + query');
    await query.fill('no-match-phoenix-filters-739180');
    await check([],45,'combined source facets no matches');
    await clear.click();
    await check(cards,90,'clear combined source facets');
    // Switching category keeps the query, clears contextual filters and resets page 1.
    await query.fill('Moreland');
    for(const [,name] of views) {
      await page.getByRole('button',{name,exact:true}).click();
      assert.equal(await query.inputValue(),'Moreland');
      assert.match(await page.locator('#records-page').textContent(),/^Page 1 of /);
      for(const id of ['record-topic','record-kind',...Object.keys(facets)])assert.equal(await page.locator('#'+id).inputValue(),'');
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
  writeFileSync(`${output}/results.json`,JSON.stringify({passed:true,widths:[320,390,768,1280],results},null,2));
  console.log(`PASS unified Phoenix filters: ${results.length} state checks; every filter option and dynamic source count, all 4 tabs at 320/390/768/1280px, search/clear, complete pagination, keyboard order and accessibility names. Screenshots: ${output}`);
} finally {
  await browser?.close();server?.kill();
}
