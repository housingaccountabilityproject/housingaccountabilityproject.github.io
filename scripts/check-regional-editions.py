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

# Approved CoC tracker: pin only its own additions and exact changed bytes;
# feed the actual verified predecessor to every existing historical gate.
COC_BASE = 'a296733f1a4c1695d3f640a914b4a7bbde8d5e3b'
COC_PUBLIC_PATHS = ('index.html', 'phoenix.html', 'research-updates.html', 'scripts/build-regional-editions.py', 'scripts/check-reader-data.py', 'sitemap.xml', 'tucson.html')
COC_GUARD_PATHS = ('scripts/check-list-baseline.py', 'scripts/check-regional-editions.py')
COC_NEW_PATHS = ('assets/coc-court-tracker.css', 'assets/coc-court-tracker.js', 'hud-coc-funding-court-tracker.html')
coc_transition = json.loads((ROOT / '_data/coc_court_tracker_transition.json').read_text())
assert set(coc_transition) == {'base', 'files', 'added'} and coc_transition['base'] == COC_BASE
assert set(coc_transition['files']) == set(COC_PUBLIC_PATHS + COC_GUARD_PATHS)
assert set(coc_transition['added']) == set(COC_NEW_PATHS)
coc_pins = {'base': COC_BASE, 'files': {p:coc_transition['files'][p] for p in COC_PUBLIC_PATHS}, 'added':coc_transition['added']}
assert hashlib.sha256(json.dumps(coc_pins, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == 'e60eb0d69c27a70ac011bcb5008c5b76ee8a9eb19949a1e22f2ff0a529c3d1c2', 'Unexpected CoC release pins'
coc_prior = {}
for coc_path, coc_hash in coc_transition['files'].items():
    assert set(coc_hash) == {'before','after'}
    coc_old = subprocess.check_output(['git','show',COC_BASE+':'+coc_path], cwd=ROOT)
    assert hashlib.sha256(coc_old).hexdigest() == coc_hash['before'], ('Unverified CoC predecessor',coc_path)
    assert hashlib.sha256((ROOT / coc_path).read_bytes()).hexdigest() == coc_hash['after'], ('Unreviewed CoC change',coc_path)
    coc_prior[coc_path] = coc_old
for coc_path, coc_hash in coc_transition['added'].items():
    assert hashlib.sha256((ROOT / coc_path).read_bytes()).hexdigest() == coc_hash, ('Unreviewed CoC addition',coc_path)


def coc_preserved_bytes(name):
    return coc_prior[name] if name in coc_prior else (ROOT / name).read_bytes()


coc_url = 'hud-coc-funding-court-tracker.html'
coc_doc = html.parse(str(ROOT / coc_url))
assert len(coc_doc.xpath('//h1')) == len(coc_doc.xpath('//main')) == 1
coc_anchor_ids = ['what-happened','timeline','tucson-pima','phoenix-maricopa','next','sources']
for coc_nav in coc_doc.xpath('//aside[@class="jump"]//nav'):
    assert coc_nav.xpath('.//a/@href') == ['#' + ident for ident in coc_anchor_ids]
for coc_region, coc_anchor in [('tucson','tucson-pima'),('phoenix','phoenix-maricopa')]:
    coc_region_doc = html.parse(str(ROOT / (coc_region + '.html')))
    assert len(coc_region_doc.xpath('//section[@id="keep-reading"]//a[@href=$url]', url=coc_url+'#'+coc_anchor)) == 1
    assert len(coc_doc.xpath('//*[@id=$anchor]', anchor=coc_anchor)) == 1
    assert coc_region_doc.xpath('//section[@id="keep-reading"]//a[@href=$url]/text()', url=coc_url+'#'+coc_anchor) == coc_doc.xpath('//h1/text()')
coc_home = html.parse(str(ROOT / 'index.html'))
coc_home_feature = coc_home.xpath('//main/section[@aria-labelledby="featured-coc-court-tracker-title"]')
assert len(coc_home_feature) == 1
coc_home_feature = coc_home_feature[0]
assert 'city-home-hero' in coc_home_feature.getprevious().get('class', '').split()
assert coc_home_feature.getnext().get('id') == 'research-areas'
assert coc_home_feature.xpath('.//h2/text()') == ['The $1.3 Billion Fight Over Homelessness Funding']
assert coc_home_feature.xpath('./p[2]/text()') == ['A federal judge struck down HUD’s plan to give certain new projects first shot at $1.3 billion. See who was competing, why the rule mattered to programs that keep people housed, and what Arizona communities are watching next.']
assert coc_home_feature.xpath('.//a/strong/text()') == ['Read the Arizona funding explainer']
assert coc_home_feature.xpath('.//a/@href') == [coc_url]
def coc_home_original(doc):
    for extra in doc.xpath('//section[@aria-labelledby="featured-coc-court-tracker-title"] | //link[@href="assets/coc-court-tracker.css"]'):
        extra.drop_tree()
    return html.tostring(doc)
assert coc_home_original(coc_home.getroot()) == coc_home_original(html.fromstring(coc_prior['index.html'])), 'Unexpected changes outside approved secondary home feature'
coc_journal = html.parse(str(ROOT / 'research-updates.html'))
assert coc_journal.xpath('//nav[@aria-label="Federal housing policy update"]/p/a/@href') == [coc_url, coc_url+'#tucson-pima', coc_url+'#phoenix-maricopa']
assert 'Private website preview' not in coc_doc.xpath('//body')[0].text_content()
assert (ROOT / 'feed.xml').read_bytes() == subprocess.check_output(['git','show',COC_BASE+':feed.xml'],cwd=ROOT)
print('PASS CoC: pinned article and release scope, both navigators and both regional links, historic feed unchanged.')

# Dated successor: restrict public changes to the approved HAMC notice, and
# feed independently verified predecessor bytes to all historical Phase 3 checks.
HAMC_NOTICE_BASE = '3b5dd9a9e179cda3156f5df0d2bfac0185b6c5d2'
hamc_notice_manifest = json.loads((ROOT / '_data/hamc_waitlist_notice_transition.json').read_text())
assert set(hamc_notice_manifest) == {'base', 'files'}
assert hamc_notice_manifest['base'] == HAMC_NOTICE_BASE
assert set(hamc_notice_manifest['files']) == {'scripts/check-list-baseline.py', 'scripts/check-regional-editions.py', 'phoenix/housing-help.html', 'scripts/reader-browser-test.mjs'}
assert hamc_notice_manifest['files']['phoenix/housing-help.html'] == {'before': '689d5ddf49128fda14c76da0cd4731e08d0d293c15548d98a7722b2582f26a7a', 'after': '83141790242fce4d1fd5b8c5b662f1ea61dba5dadff44a186169c0caa3ee0756'}
hamc_notice_predecessor = {}
for hamc_path, hamc_hashes in hamc_notice_manifest['files'].items():
    assert set(hamc_hashes) == {'before', 'after'}
    hamc_old = subprocess.check_output(['git', 'show', HAMC_NOTICE_BASE + ':' + hamc_path], cwd=ROOT)
    assert hashlib.sha256(hamc_old).hexdigest() == hamc_hashes['before'], ('Unverified HAMC baseline', hamc_path)
    assert hashlib.sha256(coc_preserved_bytes(hamc_path)).hexdigest() == hamc_hashes['after'], ('Unreviewed HAMC candidate', hamc_path)
    hamc_notice_predecessor[hamc_path] = hamc_old
# Independent release check: the one approved span changes, with every other byte retained.
hamc_notice_old_text = b'<p>HAMC has announced that applications for four property waitlists will close at 8 a.m. Arizona time on December 1, 2026. Property-specific application limits may apply earlier. Read the official closure notice and check HAMC\xe2\x80\x99s latest schedule before applying. These are HAMC property lists, separate from City of Phoenix housing programs.</p><p>This notice does not guarantee an apartment. Sources checked November 9, 2026 Arizona time; other resource links retain their earlier review date.</p>'
hamc_notice_new_text = b'<p>The Housing Authority of Maricopa County says applications for Casa Bonitas Apartments, Clare Feldstadt Apartments, Heritage at Surprise Apartments, and Heritage Senior Apartments close at 8 a.m. MST on December 1, 2026, until further notice. The closure covers all bedroom sizes at these properties, and paper applications will not be accepted. Check HAMC\xe2\x80\x99s current schedule for how to apply and for property-specific limits that may take effect earlier. These are HAMC property lists, separate from City of Phoenix housing programs.</p><p>A waitlist is not a vacancy. Sources checked November 9, 2026 Arizona time; other resource links retain their earlier review date.</p>'
hamc_public_path = 'phoenix/housing-help.html'
assert hamc_notice_predecessor[hamc_public_path].count(hamc_notice_old_text) == 1
assert (ROOT / hamc_public_path).read_bytes() == hamc_notice_predecessor[hamc_public_path].replace(hamc_notice_old_text, hamc_notice_new_text, 1)
print('PASS HAMC notice: approved waitlist wording only; all publication history, links, and unrelated content preserved.')


# Exact Phase 3 navigation-only successor. Validate the new scope and bytes,
# then run all earlier checks on verified predecessor bytes as before.
PHASE3_BASE = 'a28da08067c7db82ea545129b06c1ea430d556c8'
PHASE3_NAV_DIGEST = '6a2ec3cd24c862d9b15a3ab41e5c6efe693d6006c6442c70f426c94d2e8fac59'
PHASE3_NAV_PATHS = {
    'about.html',
    'contact.html',
    'evidence.html',
    'findings.html',
    'funding-explorer.html',
    'glossary.html',
    'housing-help.html',
    'housing-projects.html',
    'phoenix/capital-fund.html',
    'phoenix/comparisons.html',
    'phoenix/corrections.html',
    'phoenix/glossary.html',
    'phoenix/housing-help.html',
    'phoenix/inaugural-report.html',
    'phoenix/index.html',
    'phoenix/projects.html',
    'phoenix/projects/25th-at-bell.html',
    'phoenix/projects/moreland.html',
    'phoenix/questions.html',
    'phoenix/records.html',
    'phoenix/search.html',
    'privacy.html',
    'questions-records.html',
    'reports/tucson-housing-funding-outcomes-2026.html',
    'research-center.html',
    'research-updates.html',
    'research.html',
    'scripts/city_layout.py',
    'scripts/test-city-reader-journeys.mjs',
    'search-all.html',
    'search.html',
    'tucson/index.html',
}
phase3_nav = json.loads((ROOT / '_data/phase3_shared_navigation_transition.json').read_text())
phase3_verifier = 'scripts/check-regional-editions.py'
assert set(phase3_nav) == {'base', 'files'} and phase3_nav['base'] == PHASE3_BASE, 'Invalid Phase 3 navigation transition'
assert set(phase3_nav['files']) == {*PHASE3_NAV_PATHS, phase3_verifier, 'scripts/check-list-baseline.py'}, 'Unexpected Phase 3 navigation path'
phase3_content = {'base': PHASE3_BASE, 'files': {name: phase3_nav['files'][name] for name in PHASE3_NAV_PATHS}}
assert hashlib.sha256(json.dumps(phase3_content, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == PHASE3_NAV_DIGEST, 'Unexpected Phase 3 navigation pins'
phase3_prior = {}
for name, hashes in phase3_nav['files'].items():
    assert set(hashes) == {'before', 'after'}, ('Invalid Phase 3 navigation hash pair', name)
    prior = subprocess.check_output(['git', 'show', PHASE3_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(prior).hexdigest() == hashes['before'], ('Unverified Phase 3 base bytes', name)
    assert hashlib.sha256(hamc_notice_predecessor.get(name, coc_preserved_bytes(name))).hexdigest() == hashes['after'], ('Unreviewed Phase 3 navigation bytes', name)
    phase3_prior[name] = prior


def phase3_preserved_bytes(name):
    return phase3_prior[name] if name in phase3_prior else hamc_notice_predecessor.get(name, coc_preserved_bytes(name))


def phase3_nav_signature(doc, path, *, current):
    edition_titles = {'Tucson & Pima County': 'tucson.html', 'Phoenix & Maricopa County': 'phoenix.html'}
    head = doc.xpath('//header//nav[@class="city-switcher"]')
    footer = doc.xpath('//footer//nav[@aria-label="Research area links"]')
    learn = doc.xpath('//header//details[@class="city-more"]')
    assert len(head) == len(footer) == len(learn) == 1, ('Missing existing Phase 3 shell', path)
    for position, group in enumerate((head[0], footer[0], learn[0])):
        seen = []
        library = []
        for a in group.xpath('.//a[@href]'):
            title = a.text_content().strip()
            target = edition_titles.get(title)
            if target:
                seen.append(title)
                url = urlsplit(urljoin('https://housingaccountabilityproject.github.io/' + path, a.get('href')))
                assert url.netloc == 'housingaccountabilityproject.github.io' and not url.fragment and not url.query
                if current:
                    assert url.path == '/' + target and a.get('aria-current') is None, ('Unexpected Phase 3 edition link', path, title)
                else:
                    assert url.path in {'/' + target, '/' + target.replace('.html','/index.html'), '/' + target.replace('.html','/')}
                a.drop_tree()
            elif position == 2 and title == 'Research Library':
                library.append(a)
                url = urlsplit(urljoin('https://housingaccountabilityproject.github.io/' + path, a.get('href')))
                assert (url.netloc, url.path, url.query, url.fragment) == ('housingaccountabilityproject.github.io', '/library.html', '', '')
                a.drop_tree()
        if position < 2:
            assert seen == list(edition_titles), ('Unexpected Phase 3 regional link list', path, position)
        else:
            assert len(library) == (1 if current else 0), ('Unexpected Phase 3 library count', path)
    return html.tostring(doc)


for phase3_name in PHASE3_NAV_PATHS:
    if phase3_name.endswith('.html'):
        before = html.fromstring(phase3_prior[phase3_name])
        after = html.fromstring(hamc_notice_predecessor.get(phase3_name, coc_preserved_bytes(phase3_name)))
        assert before.xpath('//@id') == after.xpath('//@id'), ('Changed Phase 3 anchor', phase3_name)
        assert phase3_nav_signature(before, phase3_name, current=False) == phase3_nav_signature(after, phase3_name, current=True), ('Change outside exact Phase 3 navigation', phase3_name)

print('PASS Phase 3: exact header/footer edition and library changes only; all other HTML, links, and anchors unchanged.')


# Exact successor Tucson navigation transition. Feed the verified Phase 1
# bytes to the unchanged Phoenix transition and every historical assertion.
TUCSON_NAV_BASE = 'd6912c0e4a6cd6f5368a63275cb27781e459394e'
TUCSON_NAV_PINS = {
    'tucson/index.html': ('5f1c7ad0b3841161fc5b4899664a6b625083a09ac98aadfd9e424dcef3549c92', '700fe175d434742fc3967d8de97ff3d94a70dae959d741a82198bcfc1939d5b0'),
    'scripts/city_reader_guide.py': ('69f665b53918adc1e18183ae5837311a73f3275aee7049114e5f55713c1e76a0', 'c36b2d5c3315f311b928c9ba0ab794befd6d94caffafcf0581343a3ca3d0a627'),
}
tucson_nav = json.loads((ROOT / '_data/tucson_overview_navigation_transition.json').read_text())
assert set(tucson_nav) == {'base', 'files'}, 'Invalid Tucson overview navigation manifest'
assert tucson_nav['base'] == TUCSON_NAV_BASE, 'Wrong Tucson overview navigation base'
tucson_nav_verifier = 'scripts/check-regional-editions.py'
assert set(tucson_nav['files']) == {*TUCSON_NAV_PINS, tucson_nav_verifier}, 'Unreviewed Tucson overview navigation path'
assert tucson_nav['files'][tucson_nav_verifier]['before'] == 'd082dd25bfe40b1a4f8d41c66ef6779158e97bde89954597c0bc1505acb39f0f'
for name, (before, after) in TUCSON_NAV_PINS.items():
    assert tucson_nav['files'][name] == {'before': before, 'after': after}, ('Unexpected Tucson overview navigation pin', name)
tucson_nav_prior = {}
for name, hashes in tucson_nav['files'].items():
    assert set(hashes) == {'before', 'after'}, ('Invalid Tucson overview navigation transition', name)
    prior = subprocess.check_output(['git', 'show', TUCSON_NAV_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(prior).hexdigest() == hashes['before'], ('Unverified Tucson overview navigation base bytes', name)
    assert hashlib.sha256(phase3_preserved_bytes(name)).hexdigest() == hashes['after'], ('Unreviewed Tucson overview navigation bytes', name)
    tucson_nav_prior[name] = prior


def tucson_nav_preserved_bytes(name):
    return tucson_nav_prior[name] if name in tucson_nav_prior else phase3_preserved_bytes(name)

# The Phoenix overview navigation changes presentation only. Read exact approved
# successor bytes now, then feed the verified pre-change bytes to every prior
# preservation check. The manifest is Jekyll data, not a served file.
PHOENIX_NAV_BASE = 'c1d270ffc57f4ca1de0c7ce7e2ee21e7bb6804b8'
PHOENIX_NAV_PINS = {
    'phoenix/index.html': (
        'd33233c37741638ac357929580bb4bec6bdb4e6b383214d95cf6f1ff5144c300',
        'd168e498c6288c33aea11e6366da0c8f70ec9bbed160747a80d9a9e6cd7405f3',
    ),
    'scripts/city_reader_guide.py': (
        '3521e2f8da8e9871d352d382153e92f4bffd9b0ae280f3c8fe5b5a29518e8011',
        '69f665b53918adc1e18183ae5837311a73f3275aee7049114e5f55713c1e76a0',
    ),
}
phoenix_nav = json.loads((ROOT / '_data/phoenix_overview_navigation_transition.json').read_text())
assert set(phoenix_nav) == {'base', 'files'}, 'Invalid Phoenix overview navigation manifest'
assert phoenix_nav['base'] == PHOENIX_NAV_BASE, 'Wrong Phoenix overview navigation base'
nav_verifier = 'scripts/check-regional-editions.py'
assert set(phoenix_nav['files']) == {*PHOENIX_NAV_PINS, nav_verifier}, 'Unreviewed Phoenix overview navigation path'
assert phoenix_nav['files'][nav_verifier]['before'] == '971aa803d5f2d5b9d39a4ae746a88c06b2f4dd786a9d436f82699e141544139a'
for name, (before, after) in PHOENIX_NAV_PINS.items():
    assert phoenix_nav['files'][name] == {'before': before, 'after': after}, ('Unexpected Phoenix overview navigation pin', name)
phoenix_nav_prior = {}
for name, hashes in phoenix_nav['files'].items():
    assert set(hashes) == {'before', 'after'}, ('Invalid Phoenix overview navigation transition', name)
    prior = subprocess.check_output(['git', 'show', PHOENIX_NAV_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(prior).hexdigest() == hashes['before'], ('Unverified Phoenix overview navigation base bytes', name)
    assert hashlib.sha256(tucson_nav_preserved_bytes(name)).hexdigest() == hashes['after'], ('Unreviewed Phoenix overview navigation bytes', name)
    phoenix_nav_prior[name] = prior


def phoenix_nav_preserved_bytes(name):
    return phoenix_nav_prior[name] if name in phoenix_nav_prior else tucson_nav_preserved_bytes(name)


# Exact November 22 certificate-note transition. Verify the current bytes first,
# then apply every historical assertion to its independently verified base.
# _data is a Jekyll input directory; this review manifest is not a served file.
NOV22_BASE = 'c084755f583cafa7c6d9fc0c749f73c573fb971c'
nov22 = json.loads((ROOT / '_data/phoenix_contract_completion_transition.json').read_text())
# Preserve the reviewed 15d019b transition while pinning only its print fix.
print_fix = nov22.pop('printFix')
PRINT_FIX_BASE = '15d019bdeb4eb56de181ffdc795a00159c31c4b9'
assert set(print_fix) == {'base', 'files'}
assert print_fix['base'] == PRINT_FIX_BASE
assert set(print_fix['files']) == {'assets/search-print.js', 'scripts/check-regional-editions.py'}
assert print_fix['files']['assets/search-print.js'] == {'before': '680bee0b2c7d77d6199ab0f8b192c5471b6fcb60860c02f170e4353804831dab', 'after': 'c5aee4ab79786a878d788c55e86d3d9f4ec68be1cdf1df184f7100a4c85ce588'}
print_fix_prior = {}
for name, transition in print_fix['files'].items():
    assert set(transition) == {'before', 'after'}, ('Invalid print-fix transition', name)
    prior = subprocess.check_output(['git', 'show', PRINT_FIX_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(prior).hexdigest() == transition['before'], ('Unverified print-fix base bytes', name)
    assert hashlib.sha256(phoenix_nav_preserved_bytes(name)).hexdigest() == transition['after'], ('Unreviewed print-fix bytes', name)
    print_fix_prior[name] = prior


def print_fix_preserved_bytes(name):
    return print_fix_prior[name] if name in print_fix_prior else phoenix_nav_preserved_bytes(name)


assert set(nov22) == {'base', 'reviewedContentCandidate', 'files'}
assert nov22['base'] == NOV22_BASE
assert nov22['reviewedContentCandidate'] == 'e5d78434c041f3c2403b3d94b9ed0f0b4b8b013f'
assert set(nov22['files']) == {'phoenix/projects.html', 'scripts/build-phoenix-connections.py', 'scripts/check-regional-editions.py'}
assert nov22['files']['phoenix/projects.html'] == {'before': '340af44010846c7cf52623ddf69c60c9d527e3c96dcc8c31e2d7568c28aa1835', 'after': '674e6c831c4d768d25f56215a6696f3039bcaa8cd89f353c93f7e6dc31ff8868'}
assert nov22['files']['scripts/build-phoenix-connections.py'] == {'before': '9f0103a648c9ba3b8377251d1aeeb1b46763d226b2ed8d6eb8ed1e2e25a697f2', 'after': '69a91c2637791979d745e4049948172dfb2834a59ef7098f23359994e2a305b8'}
nov22_prior = {}
for name, transition in nov22['files'].items():
    assert set(transition) == {'before', 'after'}, ('Invalid November 22 transition', name)
    prior = subprocess.check_output(['git', 'show', NOV22_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(prior).hexdigest() == transition['before'], ('Unverified November 22 base bytes', name)
    assert hashlib.sha256(print_fix_preserved_bytes(name)).hexdigest() == transition['after'], ('Unreviewed November 22 bytes', name)
    nov22_prior[name] = prior


def nov22_preserved_bytes(name):
    return nov22_prior[name] if name in nov22_prior else print_fix_preserved_bytes(name)


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
# Round 1 navigation only: verify exact candidate bytes against exact deployed
# #46 originals, then apply every pre-existing preservation guard unchanged.
ROUND1_BASE = '595471cc45fc217c8b27edeb5fd1c120f924ad6a'
ROUND1_TRANSITIONS = {
    'archive-phoenix.html': ('dddf3b1e6577d13001e366eadbb75e81a164bcd205581ee4681bd5283a55d6b2', '8f5e7eab91db836ca74956657ada18d830c3db972bd364ff5828dda84e2c1687'),
    'archive-tucson.html': ('bdc37102dd4dcaa923d0ca6d9f62b74de3634877b43a6e42d78b8a062ad95774', '2bd5a32a4a33c34b9fc38112c86ba74a9933aabd70e827fbb1ba1974110d2fd7'),
    'assets/search-index.js': ('eb68503d9c4636f105d87e84c317de7b0001e76bb0802914aefc088b2cace07e', 'ff4ac60c1396050ed9a0986d84803339fd00c6f18bf4bfcf0fcea148abfca973'),
    'housing-help.html': ('d7ff1a76923f2c8c2fcec7ae9c10b3230eef5cb95967075fac91ec6c00c265ea', '02fc7cbc1f3925008402db5e59bed86b24708f056bcdd50af02c5c8e9b49d6b5'),
    'phoenix.html': ('97855d745df44ebe49d49ceef7a1f6bd90dc9ef2d60eebeb6e4a17cbfc35ac62', 'ab56f83258cf69ce0cbe1d10cd44877602373de868925cc383412a2c249d8e02'),
    'phoenix/housing-help.html': ('1d5ad3143e66f9885ede915d2455375d29cf78ee27d1cb256c9bd4c74ab68b97', '315946073a53672095ca691b6efe1c8e9558b8b39d7e99c82fdf569ec2c3c35f'),
    'scripts/build-regional-editions.py': ('eafb74ed64dbeffbf6ab9e49c5eeb8cfec82d9ca440371cd518b77057e4778fc', 'e1dadc99ac1a89b9565b05c9117fa230ee74f34a22796f059cb196fc04de30eb'),
    'tucson.html': ('bbebc35eb6b108217a673fe52800d0f09490dc13d66cdcdc8d1f28523cd43922', '740b426a890420f9e116b78ac1c1c6ea8147d7ece629c4a595a2fa9079f8773e'),
    'research.html': ('aa3ba5ec5a10a62500058ca464d09e3e2b340da395d0f53b50f89c0e09535417', '20a3de5e1005ae349b68a35a4ffe0e672193c2f4900541c4f837289f9bc9f97c'),
    'research-center.html': ('03c604a4f3cbbacf4365ae0fc3121074d4408d76671145be76a072c0e1e0b564', 'f78b4f154af744e4341253cca630ca35c1ed452ac28433ddd41a90f3607028b0'),
    'scripts/check-list-baseline.py': ('83879dd488eb4c4bb25967ee94d9d9da0468ffd8833aea3be107f1abac180341', 'b7cac756265c9e27c13b0dc20b1b40bd7ab30691e0f83c88f284790697faacbe'),
}
# The verifier's own exact after-hash lives outside its bytes.
round1_verifier = json.loads((ROOT / 'scripts/fixtures/round1-verifier-transition.json').read_text())
assert round1_verifier['base'] == ROUND1_BASE
assert set(round1_verifier) == {'base', 'before', 'after'}
assert round1_verifier['before'] == cleanup['verifier']['after']
ROUND1_TRANSITIONS[verifier_path] = (round1_verifier['before'], round1_verifier['after'])

# Round 2 E/F verifies its exact tracked delta before the prior gates.
ROUND2_BASE = '8a621f0eecf6c3fa5d2e51619d8562d13422efca'
round2 = json.loads((ROOT / 'scripts/fixtures/round2-ef-transition.json').read_text())
assert round2['base'] == ROUND2_BASE
assert round2['tree'] == 'e4d5a3e23d77ef7e41f12dbea9a08abd31bce23f'
assert subprocess.check_output(['git', 'rev-parse', ROUND2_BASE + '^{tree}'], cwd=ROOT, text=True).strip() == round2['tree']
assert set(round2['files']) == {'assets/help-navigation.css', 'assets/search-source-urls.js', 'research-updates.html', 'assets/search-index.js', 'evidence.html', 'feed.xml', 'contact.html', 'data/search-coverage.json', 'assets/category-search.js', 'reports/tucson-housing-funding-outcomes-2026.html', 'scripts/test-category-search.mjs'}
round2_prior = {}
for name, hashes in round2['files'].items():
    prior = subprocess.check_output(['git', 'show', ROUND2_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(prior).hexdigest() == hashes['before'], ('Unexpected Round 2 base bytes', name)
    assert hashlib.sha256(tucson_nav_preserved_bytes(name)).hexdigest() == hashes['after'], ('Unverified Round 2 candidate bytes', name)
    round2_prior[name] = prior
assert set(round2['checkers']) == {'scripts/check-list-baseline.py', 'scripts/check-regional-editions.py'}
for name, hashes in round2['checkers'].items():
    prior = subprocess.check_output(['git', 'show', ROUND2_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(prior).hexdigest() == hashes['before'], ('Unexpected Round 2 verifier base', name)
    assert hashlib.sha256(nov22_preserved_bytes(name)).hexdigest() == hashes['after'], ('Unverified Round 2 verifier', name)
    round2_prior[name] = prior

round1_prior = {}
for name, (before, after) in ROUND1_TRANSITIONS.items():
    assert hashlib.sha256(round2_prior.get(name, tucson_nav_preserved_bytes(name))).hexdigest() == after, ('Unexpected Round 1 bytes', name)
    original = subprocess.check_output(['git', 'show', ROUND1_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(original).hexdigest() == before, ('Unverified deployed Round 1 base bytes', name)
    round1_prior[name] = original

audit_review_prior = {}
for name, (before, after) in AUDIT_REVIEW_TRANSITIONS.items():
    assert hashlib.sha256(round1_prior.get(name, round2_prior.get(name, tucson_nav_preserved_bytes(name)))).hexdigest() == after, ('Unexpected audit-review bytes', name)
    original = subprocess.check_output(['git', 'show', AUDIT_REVIEW_BASE + ':' + name], cwd=ROOT)
    assert hashlib.sha256(original).hexdigest() == before, ('Unverified pre-audit-review bytes', name)
    audit_review_prior[name] = original


def preservation_bytes(name):
    content = audit_review_prior[name] if name in audit_review_prior else round1_prior.get(name, round2_prior.get(name, nov22_preserved_bytes(name)))
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
        if path in {'evidence.html', 'research-updates.html'}:
            obsolete = {href for href in expected_citations if urlsplit(href).hostname == 'cpd.hud.gov'
                        and urlsplit(href).path == '/cpd-public/api/env-reviews/downloads/8818'}
            assert len(obsolete) <= 1, ('Unexpected historic HUD target in baseline', path)
            correction = doc.xpath('//*[@id="src-100-citation-correction"]')
            assert len(correction) == 1
            provenance = correction[0].xpath('.//code/text()')
            assert len(provenance) == 1 and urlsplit(provenance[0]).path == '/cpd-public/api/env-reviews/downloads/8818'
            assert not obsolete or obsolete == set(provenance), ('Historical URL not preserved verbatim', path)
            assert provenance[0] not in doc.xpath('//a/@href'), ('Obsolete URL is still actionable', path)
            expected_citations -= obsolete
        # Historic inventory includes the two replaced shell destinations.
        # Preserve its complete assertion on verified predecessor bytes,
        # while the new verified transition checks actual shell and body.
        citation_doc = html.fromstring(phase3_preserved_bytes(path)) if path in PHASE3_NAV_PATHS else doc
        assert expected_citations <= set(citation_doc.xpath('//a/@href')), ('Lost original citation', path)
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
