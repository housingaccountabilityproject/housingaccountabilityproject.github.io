#!/usr/bin/env python3
"""Public-only regression checks for namespaces, inventory and resolved arithmetic."""
from pathlib import Path
from lxml import html
import csv, json, re
ROOT=Path(__file__).resolve().parents[1]
registry=json.loads((ROOT/'data/source-register.json').read_text())
crosswalk=json.loads((ROOT/'data/source-id-crosswalk.json').read_text())
sources=registry['sources']; rows=crosswalk['rows']
assert len(rows)==len(sources)==59
assert {r['website_source_id'] for r in rows}=={s['public_id'] for s in sources}
assert len({r['website_source_id'] for r in rows})==59
assert len(list(csv.DictReader((ROOT/'data/source-id-crosswalk.csv').open())))==59
for source,row in zip(sources,rows):
 assert source['public_id']==row['website_source_id']
 assert source['urls']==row['website_urls']
 assert source['page_url']==row['website_page']
 assert source['workbook_source_ids']==row['workbook_source_ids']
 assert source['namespace']=='website'
 assert row['basis']
 assert row['workbook_source_ids']==[d['source_id'] for d in row['workbook_documents']]
 for d in row['workbook_documents']:
  assert d['url'].startswith('https://') and re.fullmatch(r'SRC-\d+',d['source_id'])
 if not row['workbook_source_ids']:assert row['mapping_status']=='no registered equivalent verified'
 if row['same_number_collision']:assert row['website_source_id'] not in row['workbook_source_ids']
assert sum(r['same_number_collision'] for r in rows)==44
evidence=html.parse(str(ROOT/'evidence.html'))
assert len(evidence.xpath('//*[@id="source-id-crosswalk"]//tbody/tr'))==59
assert 'Internal IDs retain the master-workbook naming' not in evidence.getroot().text_content()
for period in ['FY2024','FY2025']:
 assert evidence.xpath('//select[@id="period"]/option[@value=$period]',period=period)
 assert evidence.xpath('//tr[@data-period=$period]',period=period)
assert 'Resolved: resource arithmetic reproduced' in evidence.xpath('//*[@id="q-001"]')[0].text_content()
questions=html.parse(str(ROOT/'questions-records.html'))
assert 'Resolved scope:' in questions.xpath('//*[@id="q-001"]')[0].text_content()
assert questions.xpath('//*[@id="q-001"]//a[@href="#q-007"]')
assert questions.xpath('//*[@id="q-001"]//a[@href="#q-006"]')
center=html.parse(str(ROOT/'research-center.html'))
assert center.xpath('//div[@class="metric"]/strong/text()')==['12','20','59']
preview=json.loads((ROOT/'data/public-research-preview.json').read_text())
assert preview['counts']['public_source_entries']==59
assert '59 source rows' in preview['counts_scope']
home=html.parse(str(ROOT/'index.html'))
assert home.xpath('//footer/p[text()="Public Research Website"]')
index=json.loads((ROOT/'assets/search-index.js').read_text().split('window.HAP_SEARCH_INDEX=',1)[1].rstrip(';\n'))
for anchor in ['pub-001','pub-003','pub-004','research-review-2026-11-04','verified-funding-2026-11-05']:
 matches=[r for r in index['records'] if r['url']=='research-updates.html#'+anchor]
 assert matches and all(r['historical'] for r in matches),anchor
assert any(r['historical'] and 'At that release, source rows totaled 49' in r['text'] for r in index['records'])
assert any(not r['historical'] and r['url']=='evidence.html#source-id-crosswalk' for r in index['records'])
for path in [ROOT/'data/source-id-crosswalk.csv',ROOT/'data/source-id-crosswalk.json']:
 text=path.read_text().lower()
 assert not any(x in text for x in ['mail.google.com','gmail.com','file://','/workspace/','/tmp/','drive.google.com'])
print('PASS: all 59 crosswalk rows, 44 ID collisions, current counts, historical labels, FY2024/FY2025 filters, resolved Q-001 boundaries and public-data allowlist.')
