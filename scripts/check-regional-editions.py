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

# Pin only the exact cleanup presentation and derived/test follow-up bytes.
# Keep both original preservation manifests and all their assertions unchanged.
cleanup = json.loads((ROOT / 'docs/reviews/cleanup-presentation-preservation.json').read_text())
assert set(cleanup) == {'base', 'reviewedCandidate', 'files', 'verifier'}
assert cleanup['base'] == 'fa7c7d826294fa9b7cd39bfe472f26cbc03e9b5e'
assert cleanup['reviewedCandidate'] == '4de8d9f52b5542f31bce20ed2744d42c6cda3769'
CLEANUP_AFTER_HASHES = {
    'phoenix/index.html': 'd33233c37741638ac357929580bb4bec6bdb4e6b383214d95cf6f1ff5144c300',
    'phoenix/records.html': '65ab34ea3e3c7d5ce1ccf095ba3f33a1f1b9b0cbd3393d0563de752be7d13ec2',
    'phoenix/search.html': 'a6cb576530c710083b2ef765b0808301636078e2ff16304cc8c0f73fe27bea45',
    'research-center.html': '03c604a4f3cbbacf4365ae0fc3121074d4408d76671145be76a072c0e1e0b564',
    'tucson/index.html': 'ba5950c58900a12da6f9e8944b7e787957eb9f8dbbda40297d6cabd2b7224258',
    'scripts/build-phoenix-records.py': '5229584824f623796a5f018790141b61e16484ea75a578c4a18323737af5db51',
    'scripts/city_reader_guide.py': '3521e2f8da8e9871d352d382153e92f4bffd9b0ae280f3c8fe5b5a29518e8011',
    'assets/search-index.js': '804b0cebbc523c2056222597df25be3a0a5383860430d1accd5b1b7e050ef6a6',
    'data/search-coverage.json': '5556448be11c5552d8ff3d51ecaed6b71874971a5ceda0fe033bb74e2d1ed6e0',
    'scripts/site-smoke-test.mjs': '782f3dc3722a6063b06e708b3c03268346180fde4c0bbd46daab0fe653f96bef',
    'scripts/test-phoenix-index.mjs': 'b6f768b0bafba4ecc2d0de765041b9a6b58122cd9cf85231dfd639645054ca48',
    'scripts/check-list-baseline.py': 'd71a7281e00c1f8e8e43672201aa4b9f05acfaaf110233f1e751fbdff628c680',
    'scripts/reader-browser-test.mjs': 'a3bdaf92b733ab3e926a983208374aa04d72c2f80ba65f1343cc766e29350672',
    'scripts/test-city-reader-journeys.mjs': '4962f9698633432a156d515c27ae1a73b2ab5ac8814c1da36a6e54167baa4695',
}
assert set(cleanup['files']) == set(CLEANUP_AFTER_HASHES), 'Unreviewed cleanup path'
verifier_path = 'scripts/check-regional-editions.py'
assert set(cleanup['verifier']) == {'before', 'after'}
assert cleanup['verifier']['before'] == review['candidateFileHashes'][verifier_path]
cleanup_transitions = {**cleanup['files'], verifier_path: cleanup['verifier']}
cleanup_prior_bytes = {}
for name, transition in cleanup_transitions.items():
    assert set(transition) == {'before', 'after'}, ('Invalid cleanup transition', name)
    prior = subprocess.check_output(['git', 'show', cleanup['base'] + ':' + name], cwd=ROOT)
    assert hashlib.sha256(prior).hexdigest() == transition['before'], ('Unverified prior cleanup bytes', name)
    if name in CLEANUP_AFTER_HASHES:
        assert transition['after'] == CLEANUP_AFTER_HASHES[name], ('Unreviewed cleanup bytes', name)
    cleanup_prior_bytes[name] = prior


# Accept only the reviewed live-audit transitions (including historical labels).
# Each pre-review file is independently verified before every existing guard.
AUDIT_REVIEW_BASE = '69843d7d301fc980b08da6a235b9859bd8e14156'
AUDIT_REVIEW_TRANSITIONS = {
    'archive-phoenix.html': ('6b30c838f1f4e9a8a707c8e773f81e4959d48dc4d35eab8760767e36fb9fb433', 'dddf3b1e6577d13001e366eadbb75e81a164bcd205581ee4681bd5283a55d6b2'),
    'archive-tucson.html': ('e6aa677a2e8a0fdf8dd72628beb318d3692502eb1eb410e3581924b2c799bef8', 'bdc37102dd4dcaa923d0ca6d9f62b74de3634877b43a6e42d78b8a062ad95774'),
    'assets/category-search-data.js': ('32a95c829e0276471e4688c79ccb6a5b8c6c1c977043ebd4b1d6dd8dcd4cff33', 'c82df15091eea44b011294f33328f2d7e3fcce0b2bad5c554d0d2b5f2a003e24'),
    'assets/category-search.js': ('e80afebec177b0ec1b1fb4550e4b2a760e942df0c3f4b72a7684d1f686785ef6', '4aed326aeaecb1325567f221f96fbf9e402a442c32986f585d109b732f45698f'),
    'assets/phoenix-records.js': ('eb20e018a8a5aabf7fcd4535a8f1533fdb727a0d85920803f88cbc6b008e6010', '97aa89a347bc6ecd66953b9380f3e765a10c857227657321a4685ceebd7b2156'),
    'assets/search-index.js': ('804b0cebbc523c2056222597df25be3a0a5383860430d1accd5b1b7e050ef6a6', 'eb68503d9c4636f105d87e84c317de7b0001e76bb0802914aefc088b2cace07e'),
    'assets/search-source-urls.js': ('2db8ca212b34c31e47f273899703e1df6e343207a4b270c75437cf6933cd2523', '5bc41e0f62db35732b011ca8e9cbd75bc49f6bb49a729e43030ac0ff4fc5bfe3'),
    'data/category-search.json': ('66b69c2c26eef81d926ea312908490ed403f3cb5a4316e64e01156eecfdd4706', '0eecbbe4395c172cfb1c75740fb1a150b47efa3d0f9f2216170cefa975b63107'),
    'data/housing-help-resources.json': ('ef9d80fd55e06e8d0321b23e21003cc7558c5f6d442801669c5f4ba64ab278c6', 'dff56e2d999a396a08f3cf484ba93078f3bfcfcbcb2413cfe564cd24722a2794'),
    'data/search-coverage.json': ('5556448be11c5552d8ff3d51ecaed6b71874971a5ceda0fe033bb74e2d1ed6e0', '1aed08c184334f470c9ad612865d7c2d54d50cfb7c0e2fbb78961306edd45ec5'),
    'feed.xml': ('7adb0d857035bea876550fae53587e6559bc33828130fa346367a78ee8bb1b3c', 'c0c531deb513876cf3c7b486981829cff4fa2b01afd56c83ee698bcdd8372233'),
    'findings.html': ('9eb78010984bdc2194fd7240a6508aa6a9a1eda24b01d574888f835cdf276268', '0c3060ec6c0c050e6affafca4e535c7e4b775b01474dc748af89372c70cb5a8b'),
    'housing-help.html': ('9793cc8d0d062020b96f4e81d6ad567930a77ba94106bf328ec4a90adb4b197b', 'd7ff1a76923f2c8c2fcec7ae9c10b3230eef5cb95967075fac91ec6c00c265ea'),
    'phoenix.html': ('337060f3cac6ae4d9c4f8aa1d1f45bf4ff1468d82dd7d20bba8c1aed1e2a1ffc', '97855d745df44ebe49d49ceef7a1f6bd90dc9ef2d60eebeb6e4a17cbfc35ac62'),
    'phoenix/housing-help.html': ('f74687a502bdbe409d36c03ef3f2a93aead197aee5c2809645238a5dd7ff7008', '1d5ad3143e66f9885ede915d2455375d29cf78ee27d1cb256c9bd4c74ab68b97'),
    'phoenix/records.html': ('65ab34ea3e3c7d5ce1ccf095ba3f33a1f1b9b0cbd3393d0563de752be7d13ec2', '9262a0c9833fd7d2741a620cfe5871d04fadb634b74847702ba6d812405a2624'),
    'research-updates.html': ('7ce49c3ea07ae4170681704f35093a9b754195a8b46c5627a7170f29d78bc58f', '76ae44be2856be20a30e10f3dc922cadf7df3706bd1a12049c508a2cc352f2cf'),
    'scripts/build-phoenix-records.py': ('5229584824f623796a5f018790141b61e16484ea75a578c4a18323737af5db51', 'a037ec582fa00d81a38e94ab28871007692c0231b84c965eb5844d942873d1eb'),
    'scripts/check-list-baseline.py': ('d71a7281e00c1f8e8e43672201aa4b9f05acfaaf110233f1e751fbdff628c680', '83879dd488eb4c4bb25967ee94d9d9da0468ffd8833aea3be107f1abac180341'),
    'sitemap.xml': ('3bbdc87ca7b88635450c330710cd33d277296b30698ec32ec37ee3518c22bcd6', '37c1766dfbdb184439ca401fcbf12c837b5860809fdd2bff12fab8f51be65081'),
    'tucson.html': ('4a6a530588f1bce85b759220867b0494771d03d6e63d17469d32cc0a8afa779a', 'bbebc35eb6b108217a673fe52800d0f09490dc13d66cdcdc8d1f28523cd43922'),
    'tucson/index.html': ('ba5950c58900a12da6f9e8944b7e787957eb9f8dbbda40297d6cabd2b7224258', '5f1c7ad0b3841161fc5b4899664a6b625083a09ac98aadfd9e424dcef3549c92'),
}
audit_review_prior = {}
for name, (before, after) in AUDIT_REVIEW_TRANSITIONS.items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == after, ('Unexpected audit-review bytes', name)
    original = subprocess.check_output(['git', 'show', AUDIT_REVIEW_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(original).hexdigest() == before, ('Unverified pre-audit-review bytes', name)
    audit_review_prior[name] = original


def preservation_bytes(name):
    content = audit_review_prior[name] if name in audit_review_prior else (ROOT / name).read_bytes()
    if name in cleanup_transitions:
        assert hashlib.sha256(content).hexdigest() == cleanup_transitions[name]['after'], ('Unreviewed cleanup change', name)
        return cleanup_prior_bytes[name]
    return content


# Check every transition, including the verifier's own Batch A pin, even when
# a generator is not listed in either historical manifest. No path is skipped.
for name in cleanup_transitions:
    preservation_bytes(name)
for name,digest in review['candidateFileHashes'].items():
    assert hashlib.sha256(preservation_bytes(name)).hexdigest()==digest,('Unenumerated candidate change',name)
print(f'PASS Batch A preservation: {len(review["candidateFileHashes"])} exact file pins; reviewed cleanup transitions checked against verified prior bytes.')

# Permit only exact, independently enumerated candidate bytes, then apply the
# existing historical checks to their protected-main counterparts. Earlier
# hash manifests and their maintenance substitutions remain unchanged.
# Permit only these maintenance substitutions when checking historical hashes.
# Original manifests stay intact; any other byte change still fails preservation.
def preserved_digest(name):
    content = preservation_bytes(name)
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
print(f'PASS older regional preservation: {len(protected)} original file pins and {len(research["approvedChangedFiles"])} approved research file pins; existing maintenance and illustration checks retained.')
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
        expected_citations = set(route['citations'])
        if path in {'housing-help.html', 'phoenix/housing-help.html'}:
            # One reviewed replacement of an inaccessible provider guide.
            old_guide = 'https://www.aarp.org/aarp-foundation/find-help/housing/'
            new_guide = 'https://my.aarpfoundation.org/housing/'
            assert old_guide in expected_citations, ('Changed baseline guide', path)
            expected_citations.remove(old_guide)
            expected_citations.add(new_guide)
            assert old_guide not in doc.xpath('//a/@href'), ('Retired guide still linked', path)
        assert expected_citations <= set(doc.xpath('//a/@href')), ('Lost original citation', path)
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
    if row['key'] == 'phoenix:resource-wvhac':
        # Only the checked family/single-adult operator access wording changed.
        # All other keys and catalog records retain their existing assertions.
        prior_catalog = json.loads(audit_review_prior['data/category-search.json'])['records']
        prior = next(record for record in prior_catalog if record['key'] == row['key'])
        expected_changed = {'summary', 'label', 'links', 'originals', 'searchText', 'yearNote'}
        assert {name for name in prior.keys() | row.keys() if prior.get(name) != row.get(name)} == expected_changed
        assert hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest() == '7e6b30a31393b311f5dbbf0cdd89d8a844ac632a6a8770673a8206e7206072ef'
    if row['key'] in old_records and row['key'] not in research['changedRecordKeys']+review['changedRecordKeys']:
        expected = old_records[row['key']]
        if row['key'] == 'tucson:research-updates.html#county-housing-funding-2026-11-08':
            previous = 'The latest returned reporting period is August 2026, before the September County approvals.'
            historical = 'In the November 8 research snapshot, the latest returned reporting period was August 2026, before the September County approvals.'
            encoded = json.dumps(expected, ensure_ascii=False)
            assert encoded.count(previous) == 8, 'Changed historical PRICE baseline'
            expected = json.loads(encoded.replace(previous, historical))
        assert row == expected, ('Unreviewed record change', row['key'])

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
