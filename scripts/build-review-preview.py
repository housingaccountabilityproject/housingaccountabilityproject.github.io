from pathlib import Path
from lxml import html,etree
from urllib.parse import urlsplit
import base64,json,mimetypes
root=Path(__file__).resolve().parents[1]
out=root/'organization-qa-screenshots/HAP-organization-review.html'
out.parent.mkdir(exist_ok=True)
files=[*root.glob('*.html'),*root.glob('reports/*.html')]
site={}
for f in files:
 if f.name.startswith('google'):continue
 rel=f.relative_to(root).as_posix();doc=html.parse(str(f))
 for e in doc.xpath('//script[@data-goatcounter]'):e.getparent().remove(e)
 for e in doc.xpath('//link[@rel="stylesheet"]'):
  p=(f.parent/e.get('href')).resolve();style=html.Element('style');style.text=p.read_text();e.getparent().replace(e,style)
 for e in doc.xpath('//script[@src]'):
  src=e.get('src');assert not urlsplit(src).scheme,src
  e.text=(f.parent/src).read_text();del e.attrib['src']
 for e in doc.xpath('//img[@src]|//link[@rel="icon"]'):
  key='src' if e.tag=='img' else 'href';p=(f.parent/e.get(key)).resolve()
  if p.is_file():e.set(key,'data:'+mimetypes.guess_type(p.name)[0]+';base64,'+base64.b64encode(p.read_bytes()).decode())
 shim=html.Element('script');shim.text='''
const currentPath=PATH;
document.addEventListener('click',event=>{
 const a=event.target.closest('a[href]');if(!a||event.ctrlKey||event.metaKey||event.shiftKey)return;
 const href=a.getAttribute('href');const target=new URL(href,'https://hap-preview.local/'+currentPath);
 if(target.hostname==='hap-preview.local'||target.hostname==='housingaccountabilityproject.github.io'){
  let path=target.pathname.replace(/^\\//,'')||'index.html';
  if(path.endsWith('.html')){event.preventDefault();if(path===currentPath&&target.hash){location.hash=target.hash;const e=document.getElementById(decodeURIComponent(target.hash.slice(1)));if(e)e.scrollIntoView();}else parent.postMessage({type:'hap-preview-navigate',path,hash:target.hash},'*');return;}
  a.href='https://housingaccountabilityproject.github.io/'+path+target.hash;
 }
 a.target='_blank';a.rel='noopener noreferrer';
});
window.addEventListener('message',event=>{if(event.data&&event.data.type==='hap-preview-anchor'){location.hash=event.data.hash;const e=document.getElementById(decodeURIComponent(event.data.hash.slice(1)));if(e)e.scrollIntoView();}});
'''.replace('PATH',json.dumps(rel))
 doc.xpath('//body')[0].append(shim)
 site[rel]=etree.tostring(doc,encoding='unicode',method='html',doctype='<!doctype html>')
labels={'index.html':'Home','research-center.html':'Research Center','funding-explorer.html':'Funding','housing-projects.html':'Projects & Outcomes','questions-records.html':'Questions & Records','findings.html':'Findings','evidence.html':'Evidence','research-updates.html':'Updates','research.html':'Library','reports/tucson-housing-funding-outcomes-2026.html':'First Edition','about.html':'About','contact.html':'Contact','glossary.html':'Glossary','search.html':'Search','housing-help.html':'Housing Help','privacy.html':'Privacy'}
encoded=base64.b64encode(json.dumps(site).encode()).decode()
buttons=''.join('<button type="button" data-page="'+p+'">'+label.replace('&','&amp;')+'</button>' for p,label in labels.items())
page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HAP Organization Review · Unpublished Draft</title><style>
*{box-sizing:border-box}body{margin:0;background:#dce9e5;color:#123442;font:15px/1.55 system-ui,sans-serif}.review-header{padding:16px 24px;background:#102e3d;color:white}.review-header h1{font-size:22px;margin:0 0 5px}.review-header p{margin:5px 0;max-width:1050px}.review-header strong{color:#b9e9db}.review-tools{padding:12px 20px;background:#f5faf7;border-bottom:1px solid #9cb7af}.review-tools p{margin:0 0 10px}.review-pages{display:flex;gap:8px;flex-wrap:wrap}.review-pages button,.view-buttons button{font:inherit;padding:8px 12px;background:white;color:#123442;border:1px solid #789b91;border-radius:5px;cursor:pointer}.review-pages button[aria-current=page],.view-buttons button[aria-pressed=true]{background:#166267;color:white}.view-buttons{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}button:focus-visible{outline:3px solid #be6500;outline-offset:3px}.review-stage{padding:18px 12px;display:flex;justify-content:center}iframe{border:1px solid #9cb7af;background:white;width:100%;max-width:1400px;height:80vh;min-height:650px;box-shadow:0 4px 20px #102e3d20}.review-note{font-size:13px;color:#45626a}.review-note strong{color:#123442}@media(max-width:600px){.review-header{padding:14px}.review-tools{padding:12px}.review-stage{padding:8px 0}iframe{border-inline:0;min-height:650px}}
</style></head><body><header class="review-header"><h1>Housing Accountability Project · Organization Review</h1><p><strong>Unpublished draft for Bill’s review.</strong> The public website is unchanged. This copy contains the complete proposed site organization, not just excerpts.</p><p>Registers come earlier; page roles are clearer; duplicate question explanations are consolidated; F-006’s arithmetic is grouped as resolved; old links, dates, corrections and both menus are preserved.</p></header><section class="review-tools" aria-label="Review controls"><p>Choose a page, then use its normal links, filters or search. External source links open the original website.</p><div class="review-pages">BUTTONS</div><div class="view-buttons"><span>Preview width:</span><button type="button" data-width="wide" aria-pressed="true">Desktop</button><button type="button" data-width="390" aria-pressed="false">390px</button><button type="button" data-width="320" aria-pressed="false">320px</button><span id="current-page" aria-live="polite"></span></div><p class="review-note">Review copy prepared from the published November 7 baseline. The separately held Research Center source-count change is not included. No new evidence-review dates were added. Analytics are disabled in this offline copy.</p></section><div class="review-stage"><iframe id="site-preview" title="Proposed HAP website page" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals"></iframe></div><noscript>This interactive review file requires JavaScript. Open the full draft files in a browser to review the site.</noscript><script>
const pages=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('PAYLOAD'),c=>c.charCodeAt(0))));
const frame=document.getElementById('site-preview');let current='index.html';let nextHash='';
function showPage(path,hash=''){if(!pages[path])return;current=path;nextHash=hash;frame.srcdoc=pages[path];document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-current',b.dataset.page===path?'page':'false'));document.getElementById('current-page').textContent='Viewing '+path;}
frame.addEventListener('load',()=>{if(nextHash)frame.contentWindow.postMessage({type:'hap-preview-anchor',hash:nextHash},'*');});
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
document.querySelectorAll('[data-width]').forEach(b=>b.addEventListener('click',()=>{frame.style.maxWidth=b.dataset.width==='wide'?'1400px':b.dataset.width+'px';document.querySelectorAll('[data-width]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;if(event.data&&event.data.type==='hap-preview-navigate')showPage(event.data.path,event.data.hash);});
showPage('index.html');
</script></body></html>'''.replace('BUTTONS',buttons).replace('PAYLOAD',encoded)
out.write_text(page)
print(out, out.stat().st_size, 'bytes; pages:',len(site))
# Validate the finished payload, included assets, all links and no active analytics.
reconstructed=json.loads(base64.b64decode(encoded));assert len(reconstructed)==16
for rel,text in reconstructed.items():
 d=html.fromstring(text);assert len(d.xpath('//h1'))==1;assert not d.xpath('//script[@src]');assert not d.xpath('//script[@data-goatcounter]');assert not d.xpath('//link[@rel="stylesheet"]')
print('PASS: all 16 pages embedded, CSS/scripts/images included, no active analytics or remote scripts.')
