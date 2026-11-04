import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const path='reports/tucson-housing-funding-outcomes-2026.html';
const errors=[];
const browser=await chromium.launch({headless:true});
await mkdir('report-qa-screenshots',{recursive:true});
for (const width of [390,768,1280]) {
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
 const runtime=[];
 page.on('pageerror',e=>runtime.push(e.message));
 await page.goto(pathToFileURL(resolve(path)).href,{waitUntil:'load'});
 const checks=await page.evaluate(()=>{
   const links=[...document.querySelectorAll('a[href^="#"]')];
   const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);
   const tableCount=document.querySelectorAll('table').length;
   return {
      documentWidth:document.documentElement.scrollWidth,
      viewportWidth:document.documentElement.clientWidth,
      h1:document.querySelectorAll('h1').length,
      main:document.querySelectorAll('main').length,
      tables:tableCount,
      brokenAnchors:links.map(x=>x.hash.substring(1)).filter(id=>!ids.includes(id)),
      duplicatedIds:ids.filter((x,i)=>ids.indexOf(x)!==i),
      correctionVisible:document.body.textContent.includes('Primary-source correction (November 4, 2026)'),
      publicationLabel:document.body.textContent.includes('First Public Edition')&&document.body.textContent.includes('Findings remain subject to verification')
   };
 });
 if(checks.documentWidth>checks.viewportWidth+2)errors.push(`Report overflow at ${width}: ${JSON.stringify(checks)}`);
 if(checks.h1!==1||checks.main!==1||checks.tables!==3||checks.brokenAnchors.length||checks.duplicatedIds.length||!checks.correctionVisible||!checks.publicationLabel)errors.push(`Report semantic check failed at ${width}: ${JSON.stringify(checks)}`);
 if(runtime.length)errors.push(`Browser JS error ${runtime.join(',')}`);
 await page.screenshot({path:`report-qa-screenshots/report-${width}.png`,fullPage:true});
 console.log('Report at '+width,JSON.stringify(checks));
 await page.emulateMedia({media:'print'});
 const print=await page.evaluate(()=>({hiddenNav:getComputedStyle(document.querySelector('aside')).display,hiddenHeader:getComputedStyle(document.querySelector('header')).display}));
 if(print.hiddenNav!=='none'||print.hiddenHeader!=='none')errors.push('Print layout not hiding navigation: '+JSON.stringify(print));
 await page.close();
}
await browser.close();
if(errors.length){console.error(errors);process.exitCode=1}else console.log('PASS — report renders on mobile/tablet/desktop; print, anchors, table wrappers and source correction checked.');
