"""Verify bounded candidate exceptions against the unmodified starting commit."""
import subprocess,json,hashlib,re
from pathlib import Path
from lxml import html
BASE='377430ceddd796193a57ed1443f65c21536de4b6'
def old(name):return subprocess.check_output(['git','show',BASE+':'+name])
fixture=json.loads(old('scripts/fixtures/six-entry-baseline.json'))
current=json.loads(Path('scripts/fixtures/six-entry-baseline.json').read_text())
a=current['registers']['evidence.html'][0];b=fixture['registers']['evidence.html'][0]
assert [x for x in a if x['id']!='src-124']==[x for x in b if x['id']!='src-124']
for name,groups in fixture['registers'].items():
 if name!='evidence.html':assert current['registers'][name]==groups
assert current['registers']['evidence.html'][1]==fixture['registers']['evidence.html'][1]
allowed={'assets/search-index.js','assets/search-source-urls.js','data/search-coverage.json','feed.xml','reports/tucson-housing-funding-outcomes-2026.html'}
for name,sha in fixture['files'].items():
 if name not in allowed:assert hashlib.sha256(Path(name).read_bytes()).hexdigest()==sha,name
name='reports/tucson-housing-funding-outcomes-2026.html';normal=lambda b:re.sub(rb'city-layout.css\?v=[a-f0-9]+',b'city-layout.css?v=CACHE',b)
assert normal(old(name))==normal(Path(name).read_bytes())
for name in subprocess.check_output(['git','diff','--name-only',BASE]).decode().splitlines():
 if not name.endswith('.html'):continue
 a=html.fromstring(old(name));b=html.parse(name)
 assert a.xpath('//time/@datetime')==b.xpath('//time/@datetime'),('Timestamp changed',name)
a=html.fromstring(old('evidence.html')).get_element_by_id('src-124');b=html.parse('evidence.html').getroot().get_element_by_id('src-124')
assert [x.text_content() for x in a[:4]]==[x.text_content() for x in b[:4]]
assert a.xpath('.//a/@href')==b.xpath('.//a/@href')[:len(a.xpath('.//a/@href'))]
r=json.loads(Path('data/source-responses/src-124-funding-2026-11-12.json').read_text());assert len(r['results'])==3 and r['page_metadata']['hasNext'] is False
assert any(x['gross_outlay_amount']==78172.27 and x['reporting_fiscal_year']==2026 and x['reporting_fiscal_month']==11 for x in r['results'])
assert any(x['transaction_obligated_amount']==11519567.21 for x in r['results'])
print('PASS original baseline independently checked: 18 unchanged protected files; 4 derived artifacts; report CSS key only; original SRC-124 cells/links/figures/recipe/qualifications retained; every existing HTML time datetime unchanged. Remaining 234 fingerprints checked by check-list-baseline.py.')
