#!/usr/bin/env python3
"""Freeze public research independently from presentation changes."""
import hashlib,json
from pathlib import Path
from lxml import html
ROOT=Path(__file__).resolve().parents[1]
fixture=json.loads((ROOT/'scripts/fixtures/six-entry-baseline.json').read_text())
selectors={'evidence.html':['//table[@id="sources"]/tbody/tr','//table[@id="questions"]/tbody/tr'],'questions-records.html':['//*[@data-catalog-entry]'],'funding-explorer.html':['//*[@data-catalog-entry]'],'housing-projects.html':['//*[@data-catalog-entry]'],'phoenix/records.html':['//*[contains(concat(" ",@class," ")," record-card ")]'],'phoenix/questions.html':['//*[@data-connection-entry]'],'phoenix/projects.html':['//*[@data-connection-entry]'],'phoenix/comparisons.html':['//*[@data-connection-entry]']}
for name,sha in fixture['files'].items():
 assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==sha,('Public research/data/download changed',name)
count=0
for name,queries in selectors.items():
 doc=html.parse(str(ROOT/name))
 for i,query in enumerate(queries):
  records=[]
  for e in doc.xpath(query):
   contents={'text':' '.join(e.text_content().split()),'links':[a.get('href') for a in e.xpath('.//a[@href]')],'ids':e.xpath('.//@id'),'data':dict(e.attrib)}
   records.append({'id':e.get('id'),'ids':contents['ids'],'sha256':hashlib.sha256(json.dumps(contents,sort_keys=True,ensure_ascii=False).encode()).hexdigest()})
  assert records==fixture['registers'][name][i],('IDs/order/text/links/qualifications changed',name,i)
  assert len(records)==len({r['id'] for r in records}),('Duplicate record',name)
  count+=len(records)
records=json.loads((ROOT/'data/category-search.json').read_text())['records']
source_records=[r for r in records if r['scope']=='tucson' and r['category']=='sources']
source_ids=[r['id'] for r in fixture['registers']['evidence.html'][0]]
extra=[r for r in source_records if r['url'].split('#')[-1] not in source_ids]
assert len(source_records)==68 and len(source_ids)==67
assert [(r['id'],r['title']) for r in extra]==[('source-excerpts','Let Readers Check the Evidence')]
print(f"PASS fixed baseline {fixture['commit']}: {len(fixture['files'])} data/download hashes and {count} ordered record fingerprints; text, dates, IDs, aliases, links and qualifications unchanged.")
print('PASS scope difference: 67 source-register rows; category search additionally includes source-excerpts, the explanatory evidence section (68).')
