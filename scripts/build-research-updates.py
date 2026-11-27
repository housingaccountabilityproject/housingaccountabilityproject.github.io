#!/usr/bin/env python3
"""Generate six-entry views from the journal; the full journal is the sole source."""
from pathlib import Path
from html import escape
from collections import Counter
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit
from lxml import html, etree
import argparse
import hashlib
import json
import re
import runpy
import shutil
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[1]
PAGE = 'research-updates.html'
LIMIT = 6
START = '<!-- BEGIN UPDATE BROWSER -->'
END = '<!-- END UPDATE BROWSER -->'
SOURCE_START = '<!-- BEGIN UPDATE SOURCE --><div class="updates-content">'
SOURCE_END = '</div><!-- END UPDATE SOURCE -->'
ASSETS_START = '<!-- UPDATE BROWSER ASSETS -->'
ASSETS_END = '<!-- END UPDATE BROWSER ASSETS -->'


def clean(value):
    return ' '.join(value.split())


def original(raw):
    raw = re.sub(re.escape(START) + r'.*?' + re.escape(END), '', raw, flags=re.S)
    raw = re.sub(re.escape(ASSETS_START) + r'.*?' + re.escape(ASSETS_END), '', raw, flags=re.S)
    return raw.replace(SOURCE_START, '').replace(SOURCE_END, '')


def entries(raw, root=ROOT):
    """Use the recorded publication sequence, independently of dates in article text."""
    doc = html.fromstring(original(raw))
    result = {}
    nodes = doc.xpath('//main//article | //main/section[@id="craycroft-towers-board-action-2026-11-18" or @id="hud-oversight"]')
    for node in nodes:
        meta = node.xpath('./p[contains(concat(" ",normalize-space(@class)," ")," meta ")]')
        headings = node.xpath('./h2|./h3')
        title = clean(headings[0].text_content())
        paragraphs = node.xpath('./p[not(contains(concat(" ",normalize-space(@class)," ")," meta "))]')
        summary = textwrap.shorten(clean(paragraphs[0].text_content()), width=330, placeholder='…') if paragraphs else title
        result[node.get('id')] = {'id': node.get('id'), 'title': title,
                                 'date_label': clean(meta[0].text_content()) if meta else 'Original article dates and sources are retained in full.',
                                 'summary': summary}
    order = json.loads((root / '_data/research_updates_publication_order.json').read_text())['records']
    identities = [record['id'] for record in order]
    assert len(identities) == len(set(identities)) and set(identities) == set(result), 'Record the publication order for every article'
    return [result[aid] for aid in identities]


def archive_path(number):
    return 'research-updates-archive' + (f'-{number}' if number > 1 else '') + '.html'


def cards(items):
    return '<ol class="updates-summaries">' + ''.join(
        f'<li data-update-summary="{e["id"]}"><h2><a href="{PAGE}#{e["id"]}">{escape(e["title"])}</a></h2>'
        f'<p class="meta">{escape(e["date_label"])}</p><p>{escape(e["summary"])}</p>'
        f'<a class="updates-read" href="{PAGE}#{e["id"]}">Read full article &amp; sources<span class="updates-sr-only">: {escape(e["title"])}</span></a></li>'
        for e in items) + '</ol>'


def generated(root=ROOT):
    raw = original((root / PAGE).read_text())
    items = entries(raw, root)
    recent = START + '<section id="updates-recent" class="city-design-ui">' \
        '<p>Read the six latest published research notes. Open an article for its full text, qualifications and sources.</p>' \
        '<nav class="updates-actions" aria-label="Browse research updates">' \
        '<a href="research-updates-archive.html">Browse all research updates</a>' \
        '<a href="search.html">Search updates</a><a href="#current-research-status">Topic status</a>' \
        '<a href="#method">Methods &amp; corrections</a><a href="#follow-updates">Follow updates</a></nav>' \
        + cards(items[:LIMIT]) + '</section>' \
        '<nav id="updates-reading-tools" class="city-design-ui updates-actions" aria-label="Article tools">' \
        '<a href="research-updates.html">Latest six summaries</a><a href="research-updates-archive.html">Browse all research updates</a>' \
        '<button type="button" id="updates-print" hidden>Print full article &amp; sources</button></nav>' + END
    main = re.search(r'(<main\b[^>]*>)(.*?)(</main>)', raw, flags=re.S)
    body = main[2].replace('</h1>', '</h1>' + recent, 1)
    page = raw[:main.start(2)] + SOURCE_START + body + SOURCE_END + raw[main.end(2):]
    versions = {ext: hashlib.sha256((root / f'assets/research-updates.{ext}').read_bytes()).hexdigest()[:12] for ext in ('css', 'js')}
    assets = ASSETS_START + f'<link rel="stylesheet" href="assets/research-updates.css?v={versions["css"]}">' \
        f'<script src="assets/research-updates.js?v={versions["js"]}" defer></script>' + ASSETS_END
    # The established reader contract keeps the shared city theme last.
    theme = '<link rel="stylesheet" href="assets/city-layout.css'
    assert theme in page
    page = page.replace(theme, assets + theme, 1)
    output = {PAGE: page}
    api = runpy.run_path(str(root / 'scripts/build-regional-editions.py'))
    count = (len(items) + LIMIT - 1) // LIMIT
    for number in range(1, count + 1):
        path = archive_path(number)
        paging = '<nav class="updates-actions" aria-label="Archive pages">'
        if number > 1:
            paging += f'<a href="{archive_path(number - 1)}" rel="prev">Newer entries</a>'
        paging += f'<span>Page {number} of {count}</span>'
        if number < count:
            paging += f'<a href="{archive_path(number + 1)}" rel="next">Older entries</a>'
        paging += '</nav>'
        body = '<main id="main" class="wrap" tabindex="-1"><p class="eyebrow">Tucson &amp; Pima County</p>' \
            '<h1>Research Updates Archive</h1><p>Browse research notes in publication order, newest first, with earlier wording and corrections retained. '
        body += 'Articles open individually at their original links. Original research and source dates are retained.</p>' \
            '<nav class="updates-actions" aria-label="Research updates"><a href="research-updates.html">Latest six summaries</a>' \
            '<a href="search.html">Search updates</a><a href="research-updates.html#method">Methods &amp; corrections</a></nav>' \
            + paging + cards(items[(number - 1) * LIMIT:number * LIMIT]) + paging + '</main>'
        output[path] = api['shell']('tucson', 'Research Updates Archive', body, page=path).replace(
            '</head>', f'<link rel="stylesheet" href="assets/research-updates.css?v={versions["css"]}"></head>')
    return output


def verify_inventory(root=ROOT):
    inventory = json.loads((root / '_data/research_updates_inventory.json').read_text())
    saved = inventory['original_html']
    assert hashlib.sha256(saved.encode()).hexdigest() == inventory['sha256']
    current = original((root / PAGE).read_text())
    doc = html.fromstring(current)
    for entry in inventory['entries']:
        assert current.count(entry['exact_html']) == 1, ('Changed or duplicated full entry', entry['id'])
        assert hashlib.sha256(entry['exact_html'].encode()).hexdigest() == entry['sha256']
        node = doc.xpath('//*[@id=$id]', id=entry['id'])
        assert len(node) == 1, entry['id']
        assert node[0].xpath('.//a/@href') == entry['source_links'], entry['id']
        assert node[0].xpath('.//time/@datetime') == entry['dates'], entry['id']
    ids = Counter(doc.xpath('//@id'))
    assert all(ids[aid] == 1 for aid in inventory['destinations']), 'Missing/duplicated legacy destination'
    before = html.fromstring(saved)
    for aid in inventory['destinations']:
        # Compare the entire target subtree, not just the existence of its ID.
        old = before.xpath('//*[@id=$id]', id=aid)[0]
        new = doc.xpath('//*[@id=$id]', id=aid)[0]
        if aid != 'main':
            assert html.tostring(old, with_tail=False) == html.tostring(new, with_tail=False), ('Changed legacy destination', aid)
    assert Counter(doc.xpath('//a/@href')) >= Counter(inventory['links']), 'Lost original destination'
    publication = json.loads((root / '_data/research_updates_publication_order.json').read_text())
    baseline_ids = [e['id'] for e in inventory['entries'] if e['tag'] == 'article'
                    or e['id'] in {'hud-oversight', 'craycroft-towers-board-action-2026-11-18'}]
    if (root / '.git').exists():
        # Prove the recorded sequence against first appearance on protected main.
        commits = subprocess.check_output(['git', 'log', '--first-parent', '--reverse', '--format=%H',
                                           inventory['base'], '--', PAGE], cwd=root, text=True).splitlines()
        first = {}
        for sequence, commit in enumerate(commits):
            prior = html.fromstring(subprocess.check_output(['git', 'show', commit+':'+PAGE], cwd=root))
            for aid in prior.xpath('//@id'):
                if aid in baseline_ids and aid not in first:
                    first[aid] = (sequence, commit)
        expected_order = sorted(baseline_ids, key=lambda aid: first[aid][0], reverse=True)
        actual = [record for record in publication['records'] if record['id'] in baseline_ids]
        assert [record['id'] for record in actual] == expected_order, 'Publication order differs from protected-main history'
        for record in actual:
            assert (record['publication_sequence'], record['first_main_commit']) == first[record['id']]
    assert hashlib.sha256((root / 'feed.xml').read_bytes()).hexdigest() == publication['feed_sha256'], 'Feed bytes changed'
    ns = {'a': 'http://www.w3.org/2005/Atom'}
    feed = etree.parse(str(root / 'feed.xml'))
    assert feed.xpath('//a:entry/a:link/@href', namespaces=ns) == publication['feed_destinations'], 'Feed destinations changed'
    for url in publication['feed_destinations']:
        parsed = urlsplit(url)
        destination = html.parse(str(root / parsed.path.lstrip('/')))
        assert len(destination.xpath('//*[@id=$id]', id=parsed.fragment)) == 1, ('Lost feed destination', url)
    print(f'PASS inventory: {len(inventory["entries"])} exact entries, {len(inventory["destinations"])} destinations, {len(inventory["links"])} links; {len(baseline_ids)} article/archive destinations; publication order, feed bytes and all feed destinations preserved.')


def verify_outputs(root=ROOT):
    expected = generated(root)
    assert {p.name for p in root.glob('research-updates-archive*.html')} == set(expected) - {PAGE}
    for path, content in expected.items():
        assert (root / path).read_text() == content, ('Regenerate Research Updates', path)
        doc = html.fromstring(content)
        assert len(doc.xpath('//*[@data-update-summary]')) <= LIMIT, path
    archive_ids = [aid for path, content in expected.items() if path != PAGE
                   for aid in html.fromstring(content).xpath('//*[@data-update-summary]/@data-update-summary')]
    assert Counter(archive_ids) == Counter(e['id'] for e in entries((root / PAGE).read_text(), root))
    assert archive_ids == [e['id'] for e in entries((root / PAGE).read_text(), root)], 'Archive publication order'
    print(f'PASS deterministic generation: six front summaries; {len(archive_ids)} entries across {len(expected)-1} static archive pages.')


def fixture_test():
    with TemporaryDirectory(prefix='hap-update-growth-') as temp:
        root = Path(temp)
        shutil.copytree(ROOT, root, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns('.git', 'node_modules', '_site'))
        source = root / PAGE
        original_six = entries(source.read_text(), root)[:LIMIT]
        displaced = original_six[-1]['id']
        fixture = json.loads((root / 'scripts/fixtures/research-update-new-article.json').read_text())
        publication_path = root / '_data/research_updates_publication_order.json'
        publication = json.loads(publication_path.read_text())
        publication['records'].insert(0, {'id': fixture['id'], 'first_main_commit': None, 'publication_sequence': 'fixture-newest'})
        publication_path.write_text(json.dumps(publication, indent=2)+'\n')
        raw = source.read_text().replace('<article id="pchip-qa-2026-11-24">',
                                        fixture['html'] + '<article id="pchip-qa-2026-11-24">', 1)
        source.write_text(raw)
        for path, content in generated(root).items():
            (root / path).write_text(content)
        verify_inventory(root)
        verify_outputs(root)
        front = html.parse(str(source)).xpath('//*[@data-update-summary]/@data-update-summary')
        assert len(front) == LIMIT and fixture['id'] in front and displaced not in front
        assert front[0] == fixture['id'], 'New publication sorts first despite its deliberately old source-check date'
        assert len(html.parse(str(source)).xpath('//*[@id=$id]', id=displaced)) == 1
        assert any(html.parse(str(path)).xpath('//*[@data-update-summary=$id]//a[@href=$url]',
                   id=displaced, url=PAGE+'#'+displaced) for path in root.glob('research-updates-archive*.html'))
        subprocess.run([sys.executable, str(root / 'scripts/build-reader-data.py')], cwd=root, check=True)
        assert (root / 'feed.xml').read_bytes() == (ROOT / 'feed.xml').read_bytes(), 'Adding a fixture changed the feed'
        index = json.loads((root / 'assets/search-index.js').read_text().split('window.HAP_SEARCH_INDEX=', 1)[1].rstrip(';\n'))
        for aid in (displaced, fixture['id']):
            assert len([r for r in index['records'] if r['url'] == PAGE+'#'+aid]) == 1, ('Search reachability / uniqueness', aid)
        assert all('research-updates-archive' not in r['url'] for r in index['records'])
        print(f'PASS new-article fixture: front remains six; displaced {displaced} survives its old link, archive and search exactly once.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--fixture-test', action='store_true')
    args = parser.parse_args()
    if args.check:
        verify_inventory()
        verify_outputs()
    else:
        for path, content in generated().items():
            (ROOT / path).write_text(content)
        print('Built the six-summary journal and paginated archive from existing full entries.')
    if args.fixture_test:
        fixture_test()
