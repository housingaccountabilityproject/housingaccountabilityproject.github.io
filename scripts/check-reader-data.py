#!/usr/bin/env python3
"""Static regression checks for reader tools. Run after build-reader-data.py."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
from lxml import html,etree
from datetime import datetime
import json,re,subprocess
ROOT=Path(__file__).resolve().parents[1]
files=[*ROOT.glob('*.html'),*ROOT.glob('reports/*.html')]
pages={p.relative_to(ROOT).as_posix():html.parse(str(p)) for p in files if not p.name.startswith('google')}
for rel,doc in pages.items():
 ids=doc.xpath('//@id');assert len(ids)==len(set(ids)),('duplicate ID',rel)
 assert len(doc.xpath('//h1'))==len(doc.xpath('//main'))==1,('landmarks',rel)
 assert doc.xpath('//nav[@aria-label="Reader tools"]'),('reader tools',rel)
 assert doc.xpath('//link[@rel="alternate"][@type="application/atom+xml"]'),('feed discovery',rel)
 assert len(doc.xpath('//script[@data-goatcounter]'))==1,('analytics count',rel)
 for href in doc.xpath('//a/@href|//script/@src|//link[@rel="stylesheet"]/@href|//img/@src'):
  u=urlsplit(href)
  if u.scheme or u.netloc:continue
  dest=(ROOT/u.path.lstrip('/')) if u.path.startswith('/') else (ROOT/rel).parent/u.path
  dest=dest.resolve() if u.path else (ROOT/rel)
  if dest.is_dir():dest=dest/'index.html'
  assert dest.exists(),('missing local link',rel,href)
  if u.fragment and dest.suffix=='.html':assert html.parse(str(dest)).xpath('//*[@id=$id]',id=unquote(u.fragment)),('missing anchor',rel,href)
idx=(ROOT/'assets/search-index.js').read_text().split('window.HAP_SEARCH_INDEX=',1)[1].rstrip(';\n')
index=json.loads(idx);expected=set(pages)-{'search.html'}
assert set(x['page'] for x in index['coverage'])==expected
for r in index['records']:
 path,_,anchor=r['url'].partition('#');assert path in expected
 if anchor:assert pages[path].xpath('//*[@id=$id]',id=anchor),r['url']
assert any('Q-020' in x['text'] for x in index['records'])
assert any('SRC-094' in x['text'] for x in index['records'])
assert any('1,284,589.71' in x['text'] for x in index['records'])
register=json.loads((ROOT/'data/source-register.json').read_text());rows=pages['evidence.html'].xpath('//tr[contains(concat(" ", normalize-space(@class), " "), " source-row ")]')
assert len(rows)==59==len(register['sources'])
assert len(register['tracker_to_source'])==15
for n,src in register['tracker_to_source'].items():
 assert pages['research-updates.html'].xpath('//*[@id=$id]//a[@href=$url]',id='tracker-source-'+n,url='evidence.html#'+src.lower()),(n,src)
ns={'a':'http://www.w3.org/2005/Atom'};feed=etree.parse(str(ROOT/'feed.xml'));entries=feed.xpath('//a:entry',namespaces=ns)
assert len(entries)==9
for e in entries:
 get=lambda k:e.findtext('{'+ns['a']+'}'+k)
 assert datetime.fromisoformat(get('published'))<=datetime.fromisoformat(get('updated'))
 url=get('id');aid=urlsplit(url).fragment;article=pages['research-updates.html'].xpath('//*[@id=$id]',id=aid)[0]
 times=article.xpath('.//time/@datetime');assert get('published') in times and get('updated') in times
 assert aid not in ['verified-funding-2026-11-05','audit-2026-11-03','cdbg-review-2026-11-05']
 content=html.fromstring(get('content'))
 assert all(urlsplit(x).scheme in ('http','https','mailto') for x in content.xpath('.//a/@href'))
# Generated output must be deterministic.
old={p:(ROOT/p).read_bytes() for p in ['feed.xml','assets/search-index.js','data/search-coverage.json']}
subprocess.run(['python','scripts/build-reader-data.py'],cwd=ROOT,check=True)
assert all((ROOT/p).read_bytes()==b for p,b in old.items())
print(f'PASS: {len(pages)} pages; local links, unique IDs, landmarks, analytics/discovery; {len(index["records"])} search sections; 59 sources; 15 mappings; 9 timestamp-verified feed entries; deterministic generation.')
