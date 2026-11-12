from pathlib import Path
from lxml import html,etree
from urllib.parse import urlsplit
import argparse,base64,json,mimetypes,re,subprocess
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--lists',action='store_true',help='Build the private lists/print review, with a top-level print projection.')
parser.add_argument('--legacy-print',action='store_true',help='A/B control only: retain the original fixed-iframe print behavior.')
parser.add_argument('--output',type=Path)
args=parser.parse_args()
assert not args.legacy_print or args.lists,'--legacy-print is only an investigation control'
out=args.output or root/'organization-qa-screenshots/HAP-organization-review.html'
out.parent.mkdir(exist_ok=True)
files=sorted([*root.glob('*.html'),*root.glob('reports/*.html'),*root.glob('tucson/*.html'),*root.glob('phoenix/*.html'),*root.glob('phoenix/projects/*.html')],key=lambda p:p.relative_to(root).as_posix())
if args.lists:
 list_paths={'funding-explorer.html','housing-projects.html','questions-records.html','evidence.html','search.html','phoenix/comparisons.html','phoenix/projects.html','phoenix/questions.html','phoenix/records.html','phoenix/search.html','search-all.html'}
 files=[f for f in files if f.relative_to(root).as_posix() in list_paths]
site={}
for f in files:
 if f.name.startswith('google'):continue
 rel=f.relative_to(root).as_posix();doc=html.parse(str(f))
 for e in doc.xpath('//script[@data-goatcounter]|//script[@src="assets/legacy-home-bridge.js"]'):e.getparent().remove(e)
 for e in doc.xpath('//link[@rel="stylesheet"]'):
  p=(f.parent/urlsplit(e.get('href')).path).resolve();style=html.Element('style')
  def inline_css_asset(match):
   value=match.group(1).strip('"\' ')
   if urlsplit(value).scheme or value.startswith('#'):return match.group(0)
   asset=(p.parent/value).resolve()
   if not asset.is_file():return match.group(0)
   return 'url("data:'+mimetypes.guess_type(asset.name)[0]+';base64,'+base64.b64encode(asset.read_bytes()).decode()+'")'
  style.text=re.sub(r'url\(([^)]*)\)',inline_css_asset,p.read_text());e.getparent().replace(e,style)
 for e in doc.xpath('//script[@src]'):
  src=e.get('src');assert not urlsplit(src).scheme,src
  e.text=(f.parent/urlsplit(src).path).read_text();del e.attrib['src']
 # Inline scripts ignore defer; preserve deferred execution after the page DOM exists.
 for e in list(doc.xpath('//script[@defer]')):
  del e.attrib['defer'];e.getparent().remove(e);doc.xpath('//body')[0].append(e)
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
  if(path.endsWith('/'))path+='index.html';
  if(path.endsWith('.html')){event.preventDefault();if(path===currentPath&&target.hash){location.hash=target.hash;const e=document.getElementById(decodeURIComponent(target.hash.slice(1)));if(e)e.scrollIntoView();}else parent.postMessage({type:'hap-preview-navigate',path,hash:target.hash},'*');return;}
  a.href='https://housingaccountabilityproject.github.io/'+path+target.hash;
 }
 a.target='_blank';a.rel='noopener noreferrer';
});
window.addEventListener('message',event=>{if(event.data&&event.data.type==='hap-preview-anchor'){location.hash=event.data.hash;const e=document.getElementById(decodeURIComponent(event.data.hash.slice(1)));if(e)e.scrollIntoView();}});
'''.replace('PATH',json.dumps(rel))
 doc.xpath('//body')[0].append(shim)
 site[rel]=etree.tostring(doc,encoding='unicode',method='html',doctype='<!doctype html>')
labels={'index.html':'Shared Home','tucson/index.html':'Tucson & Pima County','phoenix/index.html':'Phoenix','phoenix/capital-fund.html':'Capital Fund','phoenix/projects/25th-at-bell.html':'25th at Bell','research-center.html':'Research Center','funding-explorer.html':'Funding','housing-projects.html':'Projects & Outcomes','questions-records.html':'Questions & Records','findings.html':'Findings','evidence.html':'Evidence','research-updates.html':'Updates','research.html':'Library','reports/tucson-housing-funding-outcomes-2026.html':'First Edition','about.html':'About','contact.html':'Contact','glossary.html':'Glossary','search.html':'Search','housing-help.html':'Housing Help','privacy.html':'Privacy'}
for path,content in site.items():
 if path not in labels:labels[path]=('Phoenix · ' if path.startswith('phoenix/') else '')+html.fromstring(content).xpath('//h1')[0].text_content()
if args.lists:
 labels={'funding-explorer.html':'Tucson · Funding','housing-projects.html':'Tucson · Projects','questions-records.html':'Tucson · Questions','evidence.html':'Tucson · Evidence Index','search.html':'Tucson · Category Search','phoenix/comparisons.html':'Phoenix · Comparisons','phoenix/projects.html':'Phoenix · Projects','phoenix/questions.html':'Phoenix · Questions','phoenix/records.html':'Phoenix · Evidence Browser','phoenix/search.html':'Phoenix · Category Search','search-all.html':'Tucson · Broader Search'}
encoded=base64.b64encode(json.dumps(site).encode()).decode()
buttons=''.join('<button type="button" data-page="'+p+'">'+label.replace('&','&amp;')+'</button>' for p,label in labels.items())
page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HAP Organization Review · Unpublished Draft</title><style>
*{box-sizing:border-box}body{margin:0;background:#dce9e5;color:#123442;font:15px/1.55 system-ui,sans-serif}.review-header{padding:16px 24px;background:#102e3d;color:white}.review-header h1{font-size:22px;margin:0 0 5px}.review-header p{margin:5px 0;max-width:1050px}.review-header strong{color:#b9e9db}.review-tools{padding:12px 20px;background:#f5faf7;border-bottom:1px solid #9cb7af}.review-tools p{margin:0 0 10px}.review-pages{display:flex;gap:8px;flex-wrap:wrap}.review-pages button,.view-buttons button{font:inherit;padding:8px 12px;background:white;color:#123442;border:1px solid #789b91;border-radius:5px;cursor:pointer}.review-pages button[aria-current=page],.view-buttons button[aria-pressed=true]{background:#166267;color:white}.view-buttons{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}button:focus-visible{outline:3px solid #be6500;outline-offset:3px}.review-stage{padding:18px 12px;display:flex;justify-content:center}iframe{border:1px solid #9cb7af;background:white;width:100%;max-width:1400px;height:80vh;min-height:650px;box-shadow:0 4px 20px #102e3d20}.review-note{font-size:13px;color:#45626a}.review-note strong{color:#123442}@media(max-width:600px){.review-header{padding:14px}.review-tools{padding:12px}.review-stage{padding:8px 0}iframe{border-inline:0;min-height:650px}}
</style></head><body><header class="review-header"><h1>Housing Accountability Project · Organization Review</h1><p><strong>Unpublished draft for Bill’s review.</strong> The public website is unchanged. This copy contains the complete proposed site organization, not just excerpts.</p><p>Two visible city choices lead to the proposed Tucson landing and reviewed Phoenix pages. Original flat Tucson pages and research wording are preserved.</p></header><section class="review-tools" aria-label="Review controls"><p>Choose a page, then use its normal links, filters or search. External source links open the original website.</p><div class="review-pages">BUTTONS</div><div class="view-buttons"><span>Preview width:</span><button type="button" data-width="wide" aria-pressed="true">Desktop</button><button type="button" data-width="390" aria-pressed="false">390px</button><button type="button" data-width="320" aria-pressed="false">320px</button><span id="current-page" aria-live="polite"></span></div><p class="review-note">Private migration candidate based on repository commit 62424779f493a9e30ac3dfc8f1b13268686f6d85, November 8, 2026. No new evidence-review dates were added. Analytics are disabled in this offline copy.</p></section><div class="review-stage"><iframe id="site-preview" title="Proposed HAP website page" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"></iframe></div><noscript>This interactive review file requires JavaScript. Open the full draft files in a browser to review the site.</noscript><script>
const pages=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('PAYLOAD'),c=>c.charCodeAt(0))));
const frame=document.getElementById('site-preview');let current='index.html';let nextHash='';
function showPage(path,hash=''){if(!pages[path])return;current=path;nextHash=hash;frame.srcdoc=pages[path];document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-current',b.dataset.page===path?'page':'false'));document.getElementById('current-page').textContent='Viewing '+path;}
frame.addEventListener('load',()=>{if(nextHash)frame.contentWindow.postMessage({type:'hap-preview-anchor',hash:nextHash},'*');});
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
document.querySelectorAll('[data-width]').forEach(b=>b.addEventListener('click',()=>{frame.style.maxWidth=b.dataset.width==='wide'?'1400px':b.dataset.width+'px';document.querySelectorAll('[data-width]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;if(event.data&&event.data.type==='hap-preview-navigate')showPage(event.data.path,event.data.hash);});
showPage('index.html');
</script></body></html>'''.replace('BUTTONS',buttons).replace('PAYLOAD',encoded)
if args.lists:
 commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
 page=page.replace('HAP Organization Review · Unpublished Draft','HAP Lists and Printing · Private Review')
 page=page.replace('Housing Accountability Project · Organization Review','HAP · Six-entry Lists and Printing Review')
 page=page.replace('This copy contains the complete proposed site organization, not just excerpts.','This private copy contains the current list and print controls.')
 page=page.replace('Two visible city choices lead to the proposed Tucson landing and reviewed Phoenix pages. Original flat Tucson pages and research wording are preserved.','Choose one of the eleven list pages. Research text and source data are preserved; analytics are disabled.')
 page=page.replace('Private migration candidate based on repository commit 62424779f493a9e30ac3dfc8f1b13268686f6d85, November 8, 2026.','Candidate '+commit+'.')
 page=page.replace("let current='index.html'","let current='evidence.html'").replace("showPage('index.html');","showPage('evidence.html');")
 page=page.replace("if(!pages[path])return;","if(!pages[path]){window.open('https://housingaccountabilityproject.github.io/'+path+hash,'_blank','noopener');return;}")
 page=page.replace('<head>','<head><meta name="hap-review-candidate" content="'+commit+'">',1)
 if not args.legacy_print:
  runtime=(root/'scripts/review-print-wrapper.js').read_text()
  page=page.replace('</body>','<script>'+runtime+'</script></body>')
  page=page.replace('Choose a page, then use its normal links, filters or search. External source links open the original website.','Choose a page, then use its normal links, filters or search. In a report preview, its Print button and Ctrl+P use the selected scope and detail. Outside a report, Ctrl+P uses the page’s normal print behavior. Native Chromebook retesting is still required.')
out.write_text(page)
print(out, out.stat().st_size, 'bytes; pages:',len(site))
# Validate the finished payload, included assets, all links and no active analytics.
reconstructed=json.loads(base64.b64decode(encoded));assert len(reconstructed)==len([f for f in files if not f.name.startswith('google')])
for rel,text in reconstructed.items():
 d=html.fromstring(text);assert len(d.xpath('//h1'))==1;assert not d.xpath('//script[@src]');assert not d.xpath('//script[@data-goatcounter]');assert not d.xpath('//link[@rel="stylesheet"]')
print(f'PASS: all {len(site)} pages embedded, CSS/scripts/images included, no active analytics or remote scripts.')
