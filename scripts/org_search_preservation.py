"""Verify the exact .org metadata transition before earlier preservation gates."""
import hashlib
import json
import re
import subprocess
from site_inspection_preservation import RELEASE_BASE, VALIDATION_PATHS, released_source, verify_release

BASE = 'f5935cd29716452c9db5691669b9dab13aa69d09'
OLD_ORIGIN = b'https://housingaccountabilityproject.github.io'
NEW_ORIGIN = b'https://housingaccountabilityproject.org'
GUARDS = {'scripts/check-list-baseline.py', 'scripts/check-regional-editions.py'}
GENERATORS = {'scripts/build-regional-editions.py', 'scripts/build-phoenix-records.py',
              'scripts/build-phoenix-connections.py'}
SOURCE_ADAPTERS = {'scripts/research_updates_preservation.py'}
MANIFEST = '_data/org_search_transition.json'
ADDED = {'_data/canonical_origin.json', 'scripts/org_search_preservation.py',
         'scripts/check-org-search.py'}
CANONICAL = re.compile(rb'(<link\b(?=[^>]*\brel=["\x27]canonical["\x27])[^>]*\bhref=["\x27])'
                       + re.escape(OLD_ORIGIN) + rb'(?=/)', re.I)


# Exact proposed homepage wording after the .org release. The original .org
# and historical gates below still inspect independently pinned predecessor bytes.
def homepage_wording_successor(baseline):
    assert hashlib.sha256(baseline).hexdigest() == '98e285ef28aea56146c91eeb65691dee7b2d76c35b772c96dd36347e1d079b51', 'Unverified homepage wording baseline'
    before = b'<p id="regional-research-update"><strong>Regional research released <time datetime="2026-11-20">November 20, 2026</time>.</strong> Explore the regional editions: <a class="text-link" href="tucson.html">Tucson &amp; Pima County</a> and <a class="text-link" href="phoenix.html">Phoenix &amp; Maricopa County</a>.</p><p><strong>Earlier statewide report:</strong> <a class="text-link" href="updates/2026-11-14-arizona-housing-research.html">Arizona housing research update: voucher history, funding and open questions</a> \xc2\xb7 Sources checked <time datetime="2026-11-14">November 14, 2026</time>.</p>'
    after = b'<p id="regional-research-update">Explore research by region: <a class="text-link" href="tucson.html">Tucson &amp; Pima County</a> and <a class="text-link" href="phoenix.html">Phoenix &amp; Maricopa County</a>.</p><p><strong>Earlier statewide report:</strong> <span style="font-size:13px"><a class="text-link" href="updates/2026-11-14-arizona-housing-research.html">Arizona housing research update: voucher history, funding and open questions</a> \xc2\xb7 Sources for this report were checked <time datetime="2026-11-14">14 Nov 2026</time>.</span></p>'
    assert baseline.count(before) == 1, 'Expected one original homepage wording block'
    expected = baseline.replace(before, after, 1)
    assert hashlib.sha256(expected).hexdigest() == '1a68b499719d0f81aef34ede142175787508d1c46c3a2fd4e1a894c8c3164652', 'Unexpected homepage wording proposal'
    return expected


def homepage_wording_predecessor(root, current):
    baseline = subprocess.check_output(
        ['git', 'show', '1c9d6146757bc03c358cdfb01c7f260b46a82264:index.html'], cwd=root)
    assert current == homepage_wording_successor(baseline), 'Unreviewed homepage wording successor'
    print('PASS exact proposed homepage wording; links, anchor, report source-check date and other bytes verified.')
    return baseline


def canonical_successor(content):
    changed, count = CANONICAL.subn(lambda m: m.group(1) + NEW_ORIGIN, content)
    assert count == 1, 'Expected exactly one first-party canonical tag'
    return changed


def guard_successor(content, digest):
    marker = b'ROOT = Path(__file__).resolve().parents[1]\n'
    if marker not in content:
        marker = b'ROOT=Path(__file__).resolve().parents[1]\n'
    insertion = (b'from org_search_preservation import verify_transition\n'
                 b"org_search_preserved_bytes = verify_transition(ROOT, '" + digest.encode() + b"')\n")
    assert content.count(marker) == 1
    content = content.replace(marker, marker + insertion, 1)
    # The new layer verifies exact canonical-only successors before supplying
    # their independently pinned main bytes to the unchanged short-page gates.
    before = b"short_updates_prior = verify_transition(ROOT, '60074490ea88bbd72969a99f753f9e1ed91b1f4d3801288ff9974c71884e7ed9')"
    after = before[:-1] + b', org_search_preserved_bytes)'
    assert content.count(before) == 1
    content = content.replace(before, after, 1)
    changes = [
        (b'hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == sha',
         b'hashlib.sha256(org_search_preserved_bytes(path)).hexdigest() == sha'),
        (b'else (ROOT/name).read_bytes()', b'else org_search_preserved_bytes(name)'),
        (b'hashlib.sha256((ROOT / n).read_bytes()).hexdigest() == h,',
         b'hashlib.sha256(org_search_preserved_bytes(n)).hexdigest() == h,'),
        (b'hashlib.sha256((ROOT / coc_path).read_bytes()).hexdigest() == coc_hash,',
         b'hashlib.sha256(org_search_preserved_bytes(coc_path)).hexdigest() == coc_hash,'),
    ]
    for before, after in changes:
        expected = 2 if before.endswith(b'== sha') else 1
        assert content.count(before) == expected, ('Unexpected preservation guard', before)
        content = content.replace(before, after)
    return content


def source_adapter_successor(content):
    before = b'def verify_transition(root: Path, digest: str):\n'
    after = (b'def verify_transition(root: Path, digest: str, preserved_bytes=None):\n'
             b'    source_bytes = preserved_bytes if preserved_bytes is not None else lambda path: (root / path).read_bytes()\n')
    assert content.count(before) == 1
    content = content.replace(before, after, 1)
    before = b'hashlib.sha256((root / path).read_bytes()).hexdigest()'
    after = b'hashlib.sha256(source_bytes(path)).hexdigest()'
    assert content.count(before) == 2
    return content.replace(before, after)


def generator_successor(name, content):
    declaration = b"CANONICAL_ORIGIN = json.loads((ROOT / '_data/canonical_origin.json').read_text())['origin']\n"
    marker = (b"SITE = 'https://housingaccountabilityproject.github.io/'\n"
              if name.endswith('build-regional-editions.py') else
              b'ROOT = Path(__file__).resolve().parents[1]\n')
    assert content.count(marker) == 1
    content = content.replace(marker, marker + declaration, 1)
    if name.endswith('build-regional-editions.py'):
        before = b"canonical = SITE + (page or ((region or 'library') + '.html'))"
        after = b"canonical = CANONICAL_ORIGIN + '/' + (page or ((region or 'library') + '.html'))"
    else:
        before = b'<link rel="canonical" href="' + OLD_ORIGIN + b'/phoenix/'
        after = b'<link rel="canonical" href="{CANONICAL_ORIGIN}/phoenix/'
    assert content.count(before) == 1
    return content.replace(before, after, 1)


def verify_transition(root, expected_digest):
    verify_release(root)
    transition = json.loads((root / MANIFEST).read_text())
    assert set(transition) == {'base', 'origin', 'canonical_files', 'files', 'added'}
    assert transition['base'] == BASE and transition['origin'].encode() == NEW_ORIGIN
    canonical_files = transition['canonical_files']
    assert len(canonical_files) == len(set(canonical_files)) == 46
    print_helper = 'assets/general-page-print-links.js'
    assert set(transition['files']) == (set(canonical_files) | GENERATORS | GUARDS | SOURCE_ADAPTERS |
                                      {print_helper, 'sitemap.xml', 'robots.txt', 'scripts/check-regional-release-output.py'})
    assert set(transition['added']) == ADDED
    pins = {**transition, 'files': {p: h for p, h in transition['files'].items() if p not in GUARDS}}
    digest = hashlib.sha256(json.dumps(pins, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    assert digest == expected_digest, 'Unreviewed .org migration pins'
    prior = {}
    for name, hashes in transition['files'].items():
        assert set(hashes) == {'before', 'after'}
        old = subprocess.check_output(['git', 'show', BASE + ':' + name], cwd=root)
        current = released_source(root, name)
        if name == 'index.html':
            current = homepage_wording_predecessor(root, current)
        assert hashlib.sha256(old).hexdigest() == hashes['before'], ('Unverified .org baseline', name)
        assert hashlib.sha256(current).hexdigest() == hashes['after'], ('Unreviewed .org successor', name)
        if name in canonical_files:
            assert current == canonical_successor(old), ('Non-canonical HTML change', name)
        elif name in GUARDS:
            assert current == guard_successor(old, expected_digest), ('Historical assertion changed', name)
        elif name in GENERATORS:
            assert current == generator_successor(name, old), ('Non-canonical generator change', name)
        elif name in SOURCE_ADAPTERS:
            assert current == source_adapter_successor(old), ('Short-page assertion changed', name)
        elif name == print_helper:
            before = b"  if (canonical.origin !== 'https://housingaccountabilityproject.github.io') return;"
            after = b"""  if (![
    'https://housingaccountabilityproject.github.io',
    'https://housingaccountabilityproject.org',
  ].includes(canonical.origin)) return;"""
            assert old.count(before) == 1
            assert current == old.replace(before, after, 1), 'Unexpected print helper change'
        elif name == 'sitemap.xml':
            expected, count = re.subn(rb'(<loc>)' + re.escape(OLD_ORIGIN) + rb'(?=/)',
                                      lambda m: m.group(1) + NEW_ORIGIN, old)
            assert count == 38 and current == expected, 'Sitemap changed beyond its origin'
        elif name == 'robots.txt':
            before = b'Sitemap: ' + OLD_ORIGIN + b'/sitemap.xml'
            assert old.count(before) == 1
            assert current == old.replace(before, b'Sitemap: ' + NEW_ORIGIN + b'/sitemap.xml', 1)
        prior[name] = old
    for name, digest in transition['added'].items():
        current = (root / name).read_bytes()
        if name in VALIDATION_PATHS:
            current = subprocess.check_output(['git', 'show', RELEASE_BASE + ':' + name], cwd=root)
        assert hashlib.sha256(current).hexdigest() == digest, ('Unreviewed .org addition', name)
    assert json.loads((root / '_data/canonical_origin.json').read_text()) == {'origin': NEW_ORIGIN.decode()}

    def preserved_bytes(name):
        return prior[name] if name in prior else released_source(root, name)

    print('PASS exact .org transition: 46 canonical tags, unchanged HTML outside those tags, '
          'sitemap/robots origins, generator-only metadata edits and intact historical assertions.')
    return preserved_bytes
