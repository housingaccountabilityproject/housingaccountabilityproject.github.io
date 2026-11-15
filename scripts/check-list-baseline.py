#!/usr/bin/env python3
"""Freeze public research independently from presentation changes."""
import hashlib,json
from pathlib import Path
from lxml import html
ROOT=Path(__file__).resolve().parents[1]
fixture=json.loads((ROOT/'scripts/fixtures/six-entry-baseline.json').read_text())
# Preserve the historical baseline verbatim. The approved audit changes only
# the exact old-to-new fingerprints below; everything else remains frozen.
audit=json.loads((ROOT/'scripts/fixtures/approved-audit-2026-11-14-delta.json').read_text())
assert audit['baseFixture']==fixture['commit'], 'Audit delta uses the wrong baseline'
assert set(audit['files']) <= set(fixture['files'])
for name, delta in audit['files'].items():
 assert delta['old']==fixture['files'][name], ('Audit delta old file hash mismatch',name)
 fixture['files'][name]=delta['new']
assert set(audit['registers']) <= set(fixture['registers'])
for name, indexed in audit['registers'].items():
 for index, changes in indexed.items():
  prior=fixture['registers'][name][int(index)]
  assert set(changes) <= {row['id'] for row in prior}, ('Audit delta added record IDs',name,index)
  for row in prior:
   if row['id'] in changes:
    change=changes[row['id']]
    assert row['sha256']==change['old'] and row['id']==change['new']['id'], ('Audit delta old record hash mismatch',name,row['id'])
    assert row['ids']==change['new']['ids'], ('Audit delta changed preserved anchors',name,row['id'])
    row['sha256']=change['new']['sha256']
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
assert len(source_records)==len(source_ids)==67
assert {r['url'].split('#')[-1] for r in source_records}==set(source_ids)
guides=[r for r in records if r['scope']=='tucson' and r['category']=='guidance']
assert [(r['id'],r['title']) for r in guides]==[('source-excerpts','Let Readers Check the Evidence')]
print(f"PASS fixed baseline {fixture['commit']}: {len(fixture['files'])} data/download hashes and {count} ordered record fingerprints; only the exact approved audit file and record deltas allowed.")
print('PASS 67 source-register rows match Tucson category Sources; the reading guide is separate.')
