import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {openNavigation} from './browser-navigation.mjs';
import {assertReaderContrast} from './reader-contrast.mjs';

const base='http://127.0.0.1:8790';
const server=spawn('python3',['-m','http.server','8790','--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
const errors=[];
async function pageFor(width=1280){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  page.on('pageerror',error=>errors.push(error.message));return page;
}
const pdfText=path=>execFileSync('pdftotext',[path,'-'],{encoding:'utf8'}).replace(/\s+/g,' ');
const pdfPages=path=>Number(execFileSync('pdfinfo',[path],{encoding:'utf8'}).match(/Pages:\s+(\d+)/)[1]);
try{
  for(let i=0;i<40;i++){try{if((await fetch(base+'/index.html')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  const executablePath=process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  for(const width of [320,390,700]){
    const page=await pageFor(width);await page.goto(base+'/phoenix/index.html');
    await openNavigation(page);
    assert(await page.getByRole('dialog',{name:'Explore the website'}).isVisible());
    assert(await page.locator('main').evaluate(node=>node.inert));
    const close=page.getByRole('button',{name:'Close menu',exact:true});
    assert(await close.evaluate(node=>node===document.activeElement));
    await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Privacy');
    await page.keyboard.press('Tab');assert(await close.evaluate(node=>node===document.activeElement));
    await assertReaderContrast(page,'open mobile navigation');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.city-menu-toggle').getAttribute('aria-expanded'),'false');
    assert(await page.locator('.city-menu-toggle').evaluate(node=>node===document.activeElement));
    assert(!await page.locator('main').evaluate(node=>node.inert));
    await openNavigation(page);await page.setViewportSize({width:1280,height:900});
    assert.equal(await page.locator('.city-menu-toggle').getAttribute('aria-expanded'),'false');
    assert(await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Projects',exact:true}).isVisible());
    assert(!await page.locator('main').evaluate(node=>node.inert));await page.close();
  }
  console.log('PASS mobile menu: focus trap, Escape/return focus, inert restoration, contrast and resize.');
  const page=await pageFor();
  await page.goto(base+'/phoenix/projects.html');
  await page.locator('#city-project-stage').selectOption('planned');
  assert.equal(await page.locator('[data-connection-entry]:visible').count(),2);
  await page.getByRole('searchbox').fill('Moreland');
  assert.equal(await page.locator('[data-connection-entry]:visible').count(),1);
  await page.getByRole('button',{name:'Preview print results',exact:true}).click();
  assert((await page.locator('#search-print-output').textContent()).includes('Evidence stage: Planned homes'));
  assert(!(await page.locator('#search-print-output').textContent()).includes('Marcos de Niza'));
  await page.getByRole('button',{name:'Return to results',exact:true}).click();
  await page.evaluate(()=>location.hash='project-marcos-grant-park');
  await page.locator('#project-marcos-grant-park').waitFor({state:'visible'});
  assert.equal(await page.locator('#city-project-stage').inputValue(),'');
  await page.goto(base+'/housing-projects.html');
  await page.locator('#city-project-stage').selectOption('inventory');
  assert.equal(await page.locator('[data-catalog-entry]:visible').count(),2);
  await page.locator('#catalog-search').fill('Tucson House');
  assert.equal(await page.locator('[data-catalog-entry]:visible').count(),1);
  await page.evaluate(()=>location.hash='project-pub-001');
  await page.locator('#project-pub-001').waitFor({state:'visible'});
  assert.equal(await page.locator('#city-project-stage').inputValue(),'');
  console.log('PASS combined project-stage filters, print criteria and saved-link recovery in both cities.');
  for(const path of ['glossary.html','phoenix/glossary.html']){
    await page.goto(base+'/'+path);const total=await page.locator('.glossary-term').count();
    await page.getByRole('group',{name:'Filter glossary by initial'}).getByRole('button',{name:'H',exact:true}).click();
    await page.locator('#glossary-query').fill('HOME');
    const matching=page.locator('.glossary-term:visible');assert(await matching.count()>0);
    for(const term of await matching.all())assert((await term.textContent()).toLowerCase().includes('home'));
    await page.getByRole('button',{name:'Clear glossary filters',exact:true}).click();
    assert.equal(await page.locator('.glossary-term:visible').count(),total);
  }
  console.log('PASS local letter/text glossary filtering and clearing in both cities.');
  mkdirSync('/tmp/hap-search-print',{recursive:true});
  for(const [file,name] of [['moreland.html','moreland'],['25th-at-bell.html','bell']]){
    await page.goto(base+'/phoenix/projects/'+file);
    assert(await page.locator('.city-project-story').isVisible());
    const original=await page.locator('.city-story-source').evaluateAll(nodes=>nodes.map(node=>node.open));
    const brief='/tmp/hap-search-print/'+name+'-brief.pdf';
    await page.evaluate(()=>window.HAPProjectBrief.prepare());await page.pdf({path:brief,format:'Letter',tagged:true});
    const text=pdfText(brief);
    assert(text.includes('What the records establish'));assert(text.includes('What still needs evidence'));
    assert(text.includes('Full findings and source appendix:'));assert(text.includes('#sources'));
    if(name==='moreland')for(const term of ['132','105','$43.1','up to $10','unverified'])assert(text.includes(term),term);
    else for(const term of ['53','20-year','executed amendment','current occupancy'])assert(text.includes(term),term);
    assert.equal(await page.locator('#city-brief-print-output').count(),0);
    assert.deepEqual(await page.locator('.city-story-source').evaluateAll(nodes=>nodes.map(node=>node.open)),original);
    const full='/tmp/hap-search-print/'+name+'-complete-file.pdf';await page.pdf({path:full,format:'Letter',tagged:true});
    assert(pdfPages(brief)<pdfPages(full),'brief is shorter than the complete file');
    console.log(`PASS ${name}: cited brief ${pdfPages(brief)} pages; complete file ${pdfPages(full)} pages; screen state restored.`);
  }
  await page.close();assert.deepEqual(errors,[]);
}finally{await browser?.close();server.kill();}
