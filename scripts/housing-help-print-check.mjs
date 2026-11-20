import assert from 'node:assert/strict';
import {execPDF} from './pdf-tools.mjs';

// Check content, not a fixed sheet count: longer resource lists may need more pages.
export function assertNoBlankPDFPages(file) {
  const pages=execPDF('pdftotext',[file,'-'],{encoding:'utf8',maxBuffer:8*1024*1024}).split('\f');
  if(pages.at(-1)==='')pages.pop();
  assert(pages.length>0,'Housing Help PDF must contain content');
  pages.forEach((text,index)=>assert(text.trim(),`Housing Help PDF has a blank page ${index+1}`));
  return pages.length;
}

export async function checkHousingHelpFullPrint(page,file,format='Letter') {
  const card=page.locator('#resource-marana-school-support');
  assert.equal(await card.count(),1);
  const paragraphs=await card.locator('p,h3').allTextContents();
  const links=await card.locator('a').evaluateAll(nodes=>nodes.map(node=>node.href));
  assert.deepEqual(links,[
    'https://www.maranausd.org/administration/departments/student-family-support-services',
    'https://www.maranausd.org/academics/federal-programs/homeless-education',
    'https://www.azed.gov/homeless/mckinney-vento-homeless-liaisons/mckinney-vento-liaisons-contacts',
  ]);
  await page.pdf({path:file,format,printBackground:false,tagged:true});
  const pages=assertNoBlankPDFPages(file);
  const audit=JSON.parse(execPDF('audit',[file],{encoding:'utf8',maxBuffer:12*1024*1024}));
  const text=audit.pages.map(page=>page.text).join(' ').replace(/\s+/g,' ');
  for(const paragraph of paragraphs)assert(text.includes(paragraph.replace(/\s+/g,' ').trim()),'Full Marana card text retained');
  const uris=audit.pages.flatMap(page=>page.links).map(link=>link.uri).filter(Boolean);
  for(const link of links)assert(uris.includes(link),'Marana PDF link remains clickable: '+link);
  for(const page of audit.pages)for(const word of page.words)
    assert(word[0]>=-1&&word[1]>=-1&&word[2]<=page.width+1&&word[3]<=page.height+1,'Housing Help text must stay within the paper');
  return {format,pages,blankPages:0,fullMaranaCard:true,clickableMaranaLinks:links};
}
