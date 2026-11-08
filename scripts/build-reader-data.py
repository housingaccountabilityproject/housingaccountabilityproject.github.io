#!/usr/bin/env python3
"""Build public search index and Atom feed from HTML. Requires lxml (see requirements-dev.txt)."""
from pathlib import Path
from collections import OrderedDict
from copy import deepcopy
from datetime import datetime
from lxml import html, etree
import json,re
ROOT=Path(__file__).resolve().parents[1]
SITE='https://housingaccountabilityproject.github.io/'
CATEGORIES={'findings.html':'Findings','research-updates.html':'Updates','questions-records.html':'Questions','evidence.html':'Evidence','funding-explorer.html':'Funding','housing-projects.html':'Projects','reports/tucson-housing-funding-outcomes-2026.html':'Report'}
EDITION_LABELS={'reports/tucson-housing-funding-outcomes-2026.html':'First edition, November 4; later corrections retained'}
HISTORICAL={'audit-corrections-2026-11-06','housing-questions-2026-11-06','verified-funding-2026-11-05','cdbg-review-2026-11-05','audit-2026-11-03','research-review-2026-11-04','pub-001','pub-003','pub-004','housing-outcomes-2026-11-05-1500','housing-plans-2026-11-05-0839'}
def clean(s):return ' '.join(s.split())
def write(path,content):
 f=ROOT/path;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(content,encoding='utf-8')
# Exclude interface text, not collapsed research disclosures. Closed <details>
# remain searchable: historical wording and source limitations live inside them.
UI_TAGS={'script','style','nav','form','button','select','input','textarea','label','noscript','template'}
UI_ROLES={'status','navigation','search','button','combobox','listbox','textbox'}
UI_CLASSES={'toolbar','subnav','counter','empty','empty-state','filter-controls','search-controls','page-jump','jump','section-links'}
def is_search_ui(e):
 if not isinstance(e.tag,str):return True
 style=e.get('style','').lower()
 return (e.tag in UI_TAGS or e.get('role','').lower() in UI_ROLES
         or 'hidden' in e.attrib or e.get('aria-hidden','').lower()=='true'
         or bool(set(e.get('class','').split()) & UI_CLASSES)
         or bool(re.search(r'(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)',style)))
records=[];coverage=[]
# Explicit Tucson-only inventory. Keep legacy result URLs stable; the UI maps index.html to /tucson/.
TUCSON_PAGES=['about.html', 'contact.html', 'evidence.html', 'findings.html', 'funding-explorer.html', 'glossary.html', 'housing-help.html', 'housing-projects.html', 'index.html', 'privacy.html', 'questions-records.html', 'reports/tucson-housing-funding-outcomes-2026.html', 'research-center.html', 'research-updates.html', 'research.html']
for rel in TUCSON_PAGES:
 p=ROOT/('tucson/index.html' if rel=='index.html' else rel)
 if p.name.startswith('google') or p.name=='search.html':continue
 doc=html.parse(str(p)); main=doc.xpath('//main')[0]; title=clean(' '.join(doc.xpath('//h1//text()')))
 # Index rendered public content only, never repository notes or personal records.
 for unwanted in list(main.iterdescendants()):
  if is_search_ui(unwanted) and unwanted.getparent() is not None:unwanted.drop_tree()
 current=title;heading_anchor='';buckets=OrderedDict();count=0
 def add_text(parent,value):
  global count
  if not value or not clean(value):return
  chain=[parent,*parent.iterancestors()]
  container=next((a for a in chain if a.get('id') and a.get('id')!='main'),None)
  anchor=container.get('id') if container is not None else heading_anchor
  if anchor=='report':anchor=heading_anchor or anchor
  own_heading=container.xpath('.//*[self::h1 or self::h2 or self::h3 or self::h4][1]') if container is not None else []
  label=clean(own_heading[0].text_content()) if own_heading else current
  if container is not None and container.tag in ('h1','h2','h3','h4'):label=clean(container.text_content())
  if container is not None and container.tag=='p' and 'report-title' in container.get('class',''):label=clean(container.text_content())
  if container is not None and container.get('id','').startswith('tracker-source-'):
   links=container.xpath('./a');label=clean(links[0].text_content()) if links else label
  if container is not None and container.tag=='tr':label=' · '.join(clean(' '.join(c.itertext())) for c in list(container)[:2])
  if container is not None and container.get('id')=='report':label=current
  historical=any(a.get('id') in HISTORICAL or a.get('data-search-history')=='true' or (a.tag=='details' and any(word in clean(' '.join(a.xpath('./summary//text()'))).lower() for word in ['superseded','historical'])) for a in chain)
  key=(anchor or '',historical)
  if key not in buckets:buckets[key]={'title':('Historical wording: ' if historical else '')+label,'parts':[],'historical':historical}
  buckets[key]['parts'].append(clean(value));count+=1
 def walk(e):
  global current,heading_anchor
  if not isinstance(e.tag,str):return
  if e.tag in ('h1','h2','h3','h4'):
   current=clean(e.text_content()) or title
   if e.get('id'):heading_anchor=e.get('id')
  add_text(e,e.text)
  for child in e:
   walk(child);add_text(e,child.tail)
 walk(main)
 # Keep original section titles and historical flags; edition context belongs
 # in page metadata, not a blanket superseded label on the report.
 page_label=title+(' · '+EDITION_LABELS[rel] if rel in EDITION_LABELS else '')
 # Header/hero h1 is represented by the page title on every result.
 for (anchor,historical),b in buckets.items():
  text=' '.join(b['parts'])
  if not text:continue
  records.append({'url':rel+('#'+anchor if anchor else ''),'page':page_label,'title':b['title'],'category':CATEGORIES.get(rel,'Other'),'text':text,'historical':b['historical']})
 coverage.append({'page':rel,'records':len(buckets),'text_nodes':count})
# Deliberately no generated-at time: reproducible content, not a new evidence review date.
payload={'version':1,'coverage':coverage,'records':records}
serialized=json.dumps(payload,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
write('assets/search-index.js','/* Generated by scripts/build-reader-data.py. Do not edit. */\nwindow.HAP_SEARCH_INDEX='+serialized+';\n')
write('data/search-coverage.json',json.dumps(coverage,indent=2)+'\n')
# Only entries whose original timestamps are explicitly recorded. No inferred midnight times.
feed_ids=['county-housing-funding-2026-11-08','payments-projects-outcomes-2026-11-07','upcoming-housing-measures-2026-11-07','records-clarified-2026-11-07','county-housing-fy27-q1-2026-11-06','audit-corrections-2026-11-06','privacy-correction-2026-11-06','cdbg-review-2026-11-06','housing-questions-2026-11-06','housing-plans-2026-11-05-0839']
source=html.parse(str(ROOT/'research-updates.html')); ns='http://www.w3.org/2005/Atom'
feed=etree.Element('{'+ns+'}feed',nsmap={None:ns})
def sub(el,name,text=None,**attrs):
 n=etree.SubElement(el,'{'+ns+'}'+name,**attrs);n.text=text;return n
sub(feed,'id',SITE+'feed.xml');sub(feed,'title','Housing Accountability Project: research updates');sub(feed,'subtitle','Substantive updates and corrections. Read source dates and limitations.');sub(feed,'link',href=SITE+'feed.xml',rel='self');sub(feed,'link',href=SITE+'research-updates.html',rel='alternate');sub(sub(feed,'author'),'name','Housing Accountability Project')
entries=[]
for aid in feed_ids:
 a=source.xpath('//*[@id=$aid]',aid=aid)[0]; times=a.xpath('.//time/@datetime')
 if not times or any('T' not in x for x in times):raise ValueError('Missing exact timestamp: '+aid)
 dates=sorted(times,key=datetime.fromisoformat);explicit_publication=a.xpath('.//time[@data-publication="true"]/@datetime');published=explicit_publication[0] if explicit_publication else dates[0];updated=dates[-1]
 copy=deepcopy(a)
 for link in copy.xpath('.//a[@href]'):
  from urllib.parse import urljoin
  link.set('href',urljoin(SITE+'research-updates.html',link.get('href')))
 title=clean(a.xpath('.//h2')[0].text_content())
 entries.append((updated,aid,title,published,etree.tostring(copy,encoding='unicode',method='html')))
sub(feed,'updated',max(e[0] for e in entries))
for updated,aid,title,published,content in sorted(entries,reverse=True):
 entry=sub(feed,'entry');url=SITE+'research-updates.html#'+aid
 sub(entry,'id',url);sub(entry,'title',title);sub(entry,'link',href=url,rel='alternate');sub(entry,'published',published);sub(entry,'updated',updated);sub(entry,'content',content,type='html')
write('feed.xml',etree.tostring(feed,encoding='utf-8',xml_declaration=True,pretty_print=True).decode())
print(f'Built {len(records)} search sections across {len(coverage)} pages; {len(entries)} dated feed entries.')
