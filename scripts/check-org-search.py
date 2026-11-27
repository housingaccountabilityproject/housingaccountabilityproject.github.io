#!/usr/bin/env python3
"""Check source or real Pages output against the frozen .org search inventory."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import urlsplit
from lxml import etree, html
from org_search_preservation import BASE, MANIFEST, canonical_successor, homepage_wording_successor

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://housingaccountabilityproject.org'
TEST_EXPECTATION_BASE = 'f5935cd29716452c9db5691669b9dab13aa69d09'
HOMEPAGE_RELEASE_BASE = '1c9d6146757bc03c358cdfb01c7f260b46a82264'
HOMEPAGE_RELEASE_PATHS = {
    'index.html',
    '_data/org_search_transition.json',
    'scripts/check-list-baseline.py',
    'scripts/check-regional-editions.py',
    'scripts/org_search_preservation.py',
    'scripts/check-org-search.py',
}
TEST_EXPECTATION_EDITS = {
    'scripts/test-portable-print.mjs': (
        b"new URL(href,'https://housingaccountabilityproject.github.io/evidence.html')",
        b"new URL(href,'https://housingaccountabilityproject.org/evidence.html')"),
    'scripts/test-funding-framework.mjs': (
        b"assert.equal(url.origin,'https://housingaccountabilityproject.github.io')",
        b"assert.equal(url.origin,'https://housingaccountabilityproject.org')"),
}


def verified_test_expectation_paths():
    # Admit these two paths only after checking their complete bytes against
    # the frozen prior head plus the independently specified literal edit.
    # An unrelated assertion/comment change in either allowed path still fails.
    for name, (before, after) in TEST_EXPECTATION_EDITS.items():
        prior = subprocess.check_output(['git', 'show', TEST_EXPECTATION_BASE + ':' + name], cwd=ROOT)
        assert prior.count(before) == 1, ('Ambiguous saved test expectation', name)
        assert (ROOT / name).read_bytes() == prior.replace(before, after, 1), ('Unexpected test expectation edit', name)
    return set(TEST_EXPECTATION_EDITS)


def verified_homepage_release_paths():
    # Keep the original migration inventory exact and separately constrain the
    # later homepage release to its reviewed HTML and preservation-validation files.
    changed = set(subprocess.check_output(
        ['git', 'diff', '--name-only', HOMEPAGE_RELEASE_BASE, '--'], cwd=ROOT
    ).decode().splitlines())
    assert changed == HOMEPAGE_RELEASE_PATHS, ('Unexpected homepage release diff',
                                              sorted(changed ^ HOMEPAGE_RELEASE_PATHS))
    return HOMEPAGE_RELEASE_PATHS


def locs(content):
    return etree.fromstring(content).xpath('//*[local-name()="loc"]/text()')


def canonical(content):
    nodes = html.fromstring(content).xpath('//link[@rel="canonical"]/@href')
    assert len(nodes) == 1, 'Missing or duplicate canonical'
    return nodes[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    transition = json.loads((ROOT / MANIFEST).read_text())
    assert transition['base'] == BASE
    assert json.loads((ROOT / '_data/canonical_origin.json').read_text()) == {'origin': ORIGIN}
    original = lambda name: subprocess.check_output(['git', 'show', BASE + ':' + name], cwd=ROOT)
    old_urls = locs(original('sitemap.xml'))
    new_urls = locs((output / 'sitemap.xml').read_bytes())
    suffix = lambda url: (urlsplit(url).path, urlsplit(url).query, urlsplit(url).fragment)
    assert len(old_urls) == len(new_urls) == 38
    assert len(set(old_urls)) == len(set(new_urls)) == 38, 'Duplicate sitemap URL'
    assert [suffix(u) for u in new_urls] == [suffix(u) for u in old_urls], 'Sitemap paths/order/slashes changed'
    assert all(urlsplit(u).scheme + '://' + urlsplit(u).netloc == ORIGIN for u in new_urls)
    rows = []
    for name in transition['canonical_files']:
        old = original(name)
        expected = canonical_successor(old)
        if name == 'index.html':
            expected = homepage_wording_successor(expected)
        assert (ROOT / name).read_bytes() == expected, ('Editorial HTML or historical citation changed', name)
        current = canonical((output / name).read_bytes())
        assert current == canonical(expected), ('Built canonical mismatch', name)
        rows.append({'file': name, 'canonical': current})
    canonical_urls = {r['canonical'] for r in rows}
    assert len(canonical_urls) == 46
    for url in new_urls:
        path = urlsplit(url).path.lstrip('/')
        name = path + 'index.html' if not path or path.endswith('/') else path
        assert (output / name).is_file(), ('Sitemap destination absent from output', url)
        assert canonical((output / name).read_bytes()) == url, ('Sitemap/canonical disagreement', url)
    existing_exceptions = sorted(canonical_urls - set(new_urls))
    assert existing_exceptions == [
        ORIGIN + '/research-updates-archive-2.html', ORIGIN + '/research-updates-archive-3.html',
        ORIGIN + '/research-updates-archive-4.html', ORIGIN + '/research-updates-archive-5.html',
        ORIGIN + '/research-updates-archive-6.html', ORIGIN + '/research-updates-archive.html',
        ORIGIN + '/watch-phoenix.html', ORIGIN + '/watch-tucson.html']
    robots = (output / 'robots.txt').read_text()
    directives = [s.partition(':')[2].strip() for s in robots.splitlines() if s.lower().startswith('sitemap:')]
    assert directives == [ORIGIN + '/sitemap.xml'], 'Wrong or duplicate robots Sitemap directive'
    for name in ('feed.xml', 'google7522bd7ac47935b5.html', 'CNAME', '_config.yml'):
        assert (ROOT / name).read_bytes() == original(name), ('Protected source changed', name)
        if name != '_config.yml':
            assert (output / name).read_bytes() == original(name), ('Protected output changed', name)
    allowed = (set(transition['files']) | set(transition['added']) | {MANIFEST} |
               verified_test_expectation_paths() | verified_homepage_release_paths())
    changed = set(subprocess.check_output(['git', 'diff', '--name-only', BASE, '--'], cwd=ROOT).decode().splitlines())
    assert changed == allowed, ('Unexpected migration diff', sorted(changed ^ allowed))
    report = {'base': BASE, 'origin': ORIGIN, 'sitemapCount': 38, 'canonicalCount': 46,
              'pathInventoryUnchanged': True, 'duplicates': 0, 'canonicalPages': rows,
              'existingSitemapOmissions': existing_exceptions,
              'feedSHA256': hashlib.sha256((output / 'feed.xml').read_bytes()).hexdigest(),
              'scope': 'Built Pages output' if output != ROOT else 'Committed source'}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(f'PASS {report["scope"]}: 38 unchanged sitemap paths, 46 .org canonicals, '
          'sitemap/canonical agreement, robots directive and unchanged feed/verification/config/CNAME.')
    print('EXISTING EXCEPTION: six Research Updates archive pages and two Watchlist pages already remain outside the sitemap; not added by this migration.')


if __name__ == '__main__':
    main()
