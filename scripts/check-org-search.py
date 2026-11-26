#!/usr/bin/env python3
"""Check source or real Pages output against the frozen .org search inventory."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import urlsplit
from lxml import etree, html
from org_search_preservation import BASE, MANIFEST, canonical_successor

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://housingaccountabilityproject.org'


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
        assert (ROOT / name).read_bytes() == expected, ('Editorial HTML or historical citation changed', name)
        current = canonical((output / name).read_bytes())
        assert current == canonical(expected), ('Built canonical mismatch', name)
        rows.append({'file': name, 'canonical': current})
    canonical_urls = {r['canonical'] for r in rows}
    assert len(canonical_urls) == 40
    for url in new_urls:
        path = urlsplit(url).path.lstrip('/')
        name = path + 'index.html' if not path or path.endswith('/') else path
        assert (output / name).is_file(), ('Sitemap destination absent from output', url)
        assert canonical((output / name).read_bytes()) == url, ('Sitemap/canonical disagreement', url)
    existing_exceptions = sorted(canonical_urls - set(new_urls))
    assert existing_exceptions == [ORIGIN + '/watch-phoenix.html', ORIGIN + '/watch-tucson.html']
    robots = (output / 'robots.txt').read_text()
    directives = [s.partition(':')[2].strip() for s in robots.splitlines() if s.lower().startswith('sitemap:')]
    assert directives == [ORIGIN + '/sitemap.xml'], 'Wrong or duplicate robots Sitemap directive'
    for name in ('feed.xml', 'google7522bd7ac47935b5.html', 'CNAME', '_config.yml'):
        assert (ROOT / name).read_bytes() == original(name), ('Protected source changed', name)
        if name != '_config.yml':
            assert (output / name).read_bytes() == original(name), ('Protected output changed', name)
    allowed = set(transition['files']) | set(transition['added']) | {MANIFEST}
    changed = set(subprocess.check_output(['git', 'diff', '--name-only', BASE, '--'], cwd=ROOT).decode().splitlines())
    assert changed == allowed, ('Unexpected migration diff', sorted(changed ^ allowed))
    report = {'base': BASE, 'origin': ORIGIN, 'sitemapCount': 38, 'canonicalCount': 40,
              'pathInventoryUnchanged': True, 'duplicates': 0, 'canonicalPages': rows,
              'existingSitemapOmissions': existing_exceptions,
              'feedSHA256': hashlib.sha256((output / 'feed.xml').read_bytes()).hexdigest(),
              'scope': 'Built Pages output' if output != ROOT else 'Committed source'}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(f'PASS {report["scope"]}: 38 unchanged sitemap paths, 40 .org canonicals, '
          'sitemap/canonical agreement, robots directive and unchanged feed/verification/config/CNAME.')
    print('EXISTING EXCEPTION: the two Watchlist pages remain outside the sitemap; not added by this migration.')


if __name__ == '__main__':
    main()
