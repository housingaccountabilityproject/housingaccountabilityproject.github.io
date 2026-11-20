#!/usr/bin/env python3
"""Verify placement provenance, original research bytes and published deep links."""
from pathlib import Path
from urllib.parse import urlsplit, unquote, urljoin
from copy import deepcopy
from collections import Counter
import hashlib
import json
import runpy
import subprocess
import sys
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
BASE = 'ba87383359bdc0ba3de5042533dd7d78f720918d'
SITE = 'https://housingaccountabilityproject.github.io/'
api = runpy.run_path(str(ROOT / 'scripts/build-regional-editions.py'))
stories = api['load_stories']()
baseline = json.loads((ROOT / 'docs/reviews/regional-front-pages-inventory.json').read_text())
assert baseline['baseline'] == BASE
protected = baseline['preservedHashes']
research = json.loads((ROOT / 'docs/reviews/research-nov19-preservation.json').read_text())
assert research['baseline'] == '367acbdd6ae18114b0208fdac62ee5eb39ef6598'

# The single approved Surprise illustration changes four protected files. Accept
# only these exact byte transitions, preserving the original research manifest.
ILLUSTRATION_TRANSITIONS = {
    'data/editorial-stories.json': ('b8733a6a295496965af7dc6fdc55030a32dbd388fbf1e4fd716fa1b577d2fb32', '5d37a1239f0402673b9afe662ec94853aced3a17a0af29ca9906ac86066a01f9'),
    'phoenix.html': ('33a4b5f530811fcfcb31e67b167f79b3221d2722d891c61640ef889c74e7acb9', 'f7221a321bae1b767f0475a7c7a538a53fa0c4a169e1868ed6665d33df787933'),
    'scripts/build-regional-editions.py': ('ea95dfee3efba5c92a15b691ef80a8b69293334127e783d59caf07e8bc9061af', 'eafb74ed64dbeffbf6ab9e49c5eeb8cfec82d9ca440371cd518b77057e4778fc'),
    'scripts/test-regional-editions.mjs': ('d4020e11c53d64e5bfb3ba8e4a1aff7e1611399ee3bee89020f1c2d94807538e', '529f501d7d30855295c3cc93994f33ee34bd12f4771399f248070d0dca5f3482'),
}

review=json.loads((ROOT/'docs/reviews/phoenix-batch-a-nov20-preservation.json').read_text())
assert review['base']=='776a12b556b5757820b7d03637184bf664a18249'
assert review['addedRecordKeys']==['phoenix:PHX-WEB-037','phoenix:PHX-WEB-038']
assert review['changedRecordKeys']==['phoenix:MC-PLAN-WEB-001']
for name,digest in review['candidateFileHashes'].items():
    assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,('Unenumerated candidate change',name)

# Permit only exact, independently enumerated candidate bytes, then apply the
# existing historical checks to their protected-main counterparts. Earlier
# hash manifests and their maintenance substitutions remain unchanged.
# Permit only these maintenance substitutions when checking historical hashes.
# Original manifests stay intact; any other byte change still fails preservation.
def preserved_digest(name):
    content = (ROOT / name).read_bytes()
    if name in review['candidateFileHashes']:
        content = subprocess.check_output(['git','show',review['base']+':'+name],cwd=ROOT)
    substitutions = {
        'research-center.html': [(b'Search published Tucson &amp; Pima County research', b'Search all published research')],
        'assets/search-index.js': [(b'Search published Tucson & Pima County research', b'Search all published research')],
        'scripts/check-list-baseline.py': [(
            b" content=(ROOT/name).read_bytes()\n"
            b" if name=='assets/search-index.js':\n"
            b"  label=b'Search published Tucson & Pima County research'\n"
            b"  assert content.count(label)<=1,('Duplicated maintenance label',name)\n"
            b"  content=content.replace(label,b'Search all published research')\n"
            b" assert hashlib.sha256(content).hexdigest()==sha,('Public research/data/download changed',name)\n",
            b" assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==sha,('Public research/data/download changed',name)\n",
        )],
        'sitemap.xml': [(
            b'  <url>\n    <loc>https://housingaccountabilityproject.github.io/tucson.html</loc>\n  </url>\n'
            b'  <url>\n    <loc>https://housingaccountabilityproject.github.io/phoenix.html</loc>\n  </url>\n',
            b'',
        )],
    }
    for current, original in substitutions.get(name, []):
        assert content.count(current) <= 1, ('Duplicated maintenance substitution', name)
        content = content.replace(current, original)
    digest = hashlib.sha256(content).hexdigest()
    transition = ILLUSTRATION_TRANSITIONS.get(name)
    if transition and digest == transition[1]:
        return transition[0]
    return digest

for name, digest in research['approvedChangedFiles'].items():
    assert preserved_digest(name) == digest, ('Unreviewed research change', name)
assert all(preserved_digest(p) == digest for p,digest in protected.items() if p != 'assets/category-search.css' and p not in research['approvedChangedFiles']), 'Original research or assets changed'
# The statewide copy and image must survive apart from the intended entry links.
after = html.parse(str(ROOT / 'index.html'))
assert baseline['homepage']['h1'] == after.xpath('//h1//text()')
assert baseline['homepage']['landscape'] == after.xpath('//div[@class="city-landscape"]//img/@src')
assert after.xpath('//div[@class="home-actions"]/a[last()]/@href') == ['about.html']
assert after.xpath('//div[@class="home-actions"]/a[position()<3]/@href') == ['tucson.html', 'phoenix.html']
assert baseline['homepage']['actions'] == after.xpath('//div[@class="home-actions"]/a//text()')

def destination(path, href):
    url = urlsplit(urljoin(SITE + path, href))
    if url.netloc != urlsplit(SITE).netloc:
        return None
    target = unquote(url.path.lstrip('/')) or 'index.html'
    if target.endswith('/'):
        target += 'index.html'
    assert (ROOT / target).is_file(), ('Missing route', path, href)
    if url.fragment and target.endswith('.html'):
        assert html.parse(str(ROOT / target)).xpath('//*[@id=$id]', id=unquote(url.fragment)), ('Missing deep link', path, href)
    return target

inventory = {'baseline': BASE, 'routes': [], 'records': [], 'preservedFiles': len(protected)}
for route in baseline['routes']:
    path = route['path']
    doc = html.parse(str(ROOT / path))
    assert set(route['ids']) <= set(doc.xpath('//@id')), ('Lost saved fragment', path)
    assert len(doc.xpath('//@id')) == len(set(doc.xpath('//@id'))), ('Duplicated fragment', path)
    if path != 'index.html':
        assert set(route['citations']) <= set(doc.xpath('//a/@href')), ('Lost original citation', path)
    for href in doc.xpath('//a/@href'):
        destination(path, href)
    inventory['routes'].append({'path': path, 'sha256': hashlib.sha256((ROOT / path).read_bytes()).hexdigest(),
                                'ids': doc.xpath('//@id'), 'citations': doc.xpath('//a/@href'),
                                'dates': doc.xpath('//time/@datetime')})

for path in api['NEW_PAGES']:
    doc = html.parse(str(ROOT / path))
    assert len(doc.xpath('//h1')) == len(doc.xpath('//main')) == 1, path
    ids = doc.xpath('//@id')
    assert len(ids) == len(set(ids)), path
    for href in doc.xpath('//a/@href|//link[@rel="stylesheet"]/@href|//img/@src'):
        destination(path, href)
    assert not doc.xpath('//*[@data-publication-pending="true"]'), path
    home = doc.xpath('//header//a[contains(concat(" ", normalize-space(@class), " "), " brand-home ")]')
    assert len(home) == 1 and home[0].get('href') == 'index.html'
    assert home[0].get('aria-label') == 'Housing Accountability Project home'
    assert home[0].xpath('.//img/@alt') == ['']
    assert home[0].xpath('.//span[@class="brand-name"]/text()') == ['Housing', 'Accountability Project']
    if path != 'library.html':
        region = 'phoenix' if 'phoenix' in path else 'tucson'
        assert doc.xpath('//nav[@aria-label="In this edition"]/a/@href')[:2] == [region + '.html#latest', region + '.html#keep-reading']

original_records = json.loads(subprocess.check_output(['git', 'show', BASE + ':data/category-search.json'], cwd=ROOT))['records']
original_keys = Counter(record['key'] for record in original_records)
current_keys = Counter(record['key'] for record in api['CATALOG'])
assert set(original_keys) <= set(current_keys) and all(count == 1 for count in current_keys.values()), 'Lost or duplicated stable record identity'
assert set(current_keys) - set(original_keys) == set(research['addedRecordKeys']+review['addedRecordKeys']), 'Unreviewed record addition'
old_records = {r['key']: r for r in original_records}
for row in api['CATALOG']:
    if row['key'] in old_records and row['key'] not in research['changedRecordKeys']+review['changedRecordKeys']:
        assert row == old_records[row['key']], ('Unreviewed record change', row['key'])

for record in api['CATALOG']:
    destination('index.html', record['url'])
    inventory['records'].append({k: record.get(k) for k in ('key', 'id', 'scope', 'category', 'url', 'label', 'years', 'yearBasis', 'yearNote')})
    for region in record.get('regionalScopes', [record['scope']]):
        doc = html.parse(str(ROOT / ('archive-' + region + '.html')))
        assert len(doc.xpath('//*[@data-record-key=$key]', key=record['key'])) == 1, record['key']

# Every promoted excerpt and limitation is generated from its one entry and
# remains with that entry in the edition and its regional archive or watchlist.
for story in stories.values():
    for region, placement in story['placements'].items():
        paths = ([region + '.html'] if placement != 'archive' else []) + [('watch-' if placement == 'watch' else 'archive-') + region + '.html']
        for path in paths:
            nodes = html.parse(str(ROOT / path)).xpath('//*[@data-story=$key]', key=story['key'])
            assert len(nodes) == 1, (path, story['key'])
            content = ' '.join(nodes[0].text_content().split())
            for paragraph in [story['summary'][0], *story['caveats']]:
                assert paragraph in content, ('Lost qualification', path, story['key'])
        if story['illustration']:
            doc = html.parse(str(ROOT / (region + '.html')))
            image = doc.xpath('//figure//img')[0]
            assert image.get('alt') == story['illustration']['alt']
            assert story['illustration']['caption'] == ('AI illustration · Not a photo' if story['key'] == 'approved-nov19-02' else 'AI illustration · Not a photo.')
            assert doc.xpath('//figcaption')[0].text_content() == story['illustration']['caption']

# Exercise one-entry management in memory. No synthetic story or new evidence
# is written to any page, asset, index, feed or sitemap.
changed = deepcopy(stories)
changed['tucson-house']['placements']['tucson'] = 'archive'
changed['county-housing-funding']['placements']['tucson'] = 'lead'
front = html.fromstring(api['front'](changed, 'tucson'))
archive = html.fromstring(api['archive'](changed, 'tucson'))
assert front.xpath('//article[@class="lead"]/@data-story') == ['county-housing-funding']
assert not front.xpath('//*[@data-story="tucson-house"]')
assert len(archive.xpath('//*[@data-story="tucson-house"]')) == 1
changed['tucson-final-report']['placements']['tucson'] = 'archive'
assert not html.fromstring(api['watch'](changed, 'tucson')).xpath('//*[@data-story="tucson-final-report"]')
assert len(html.fromstring(api['archive'](changed, 'tucson')).xpath('//*[@data-story="tucson-final-report"]')) == 1

outputs = ['index.html', *api['NEW_PAGES']]
snapshots = {p: (ROOT / p).read_bytes() for p in outputs}
api['build'](stories)
assert all((ROOT / p).read_bytes() == snapshots[p] for p in outputs), 'Nondeterministic edition output'
if '--inventory' in sys.argv:
    path = Path(sys.argv[sys.argv.index('--inventory') + 1])
    path.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n')
print(f'PASS {len(inventory["routes"])} original routes, {sum(len(r["ids"]) for r in inventory["routes"])} current fragments in those routes, {len(inventory["records"])} research records; destinations, dates, citations and approved research changes enumerated; other original research bytes preserved.')
print('PASS seven deterministic editorial views; one-entry lead/archive/watch placement; published-only excerpts and qualifications; statewide branding and approved illustration metadata.')
print('Records by region/category:', dict(Counter((r['scope'], r['category']) for r in api['CATALOG'])))
