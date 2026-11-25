#!/usr/bin/env python3
"""Place existing published reporting in regional editions; never ingest drafts."""
from pathlib import Path
from html import escape
from urllib.parse import urlsplit, unquote, urljoin
import hashlib
import json
import re
import sys
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://housingaccountabilityproject.github.io/'
REGIONS = {'tucson': 'Tucson & Pima County', 'phoenix': 'Phoenix & Maricopa County'}
CATALOG = json.loads((ROOT / 'data/category-search.json').read_text())['records']
RECORDS = {r['key']: r for r in CATALOG}
CATALOG_PATH = ROOT / 'data/editorial-stories.json'
NEW_PAGES = ['tucson.html', 'phoenix.html', 'watch-tucson.html', 'watch-phoenix.html',
             'archive-tucson.html', 'archive-phoenix.html', 'library.html']


def clean(value):
    return ' '.join(value.split())


def local(url):
    u = urlsplit(url)
    if u.netloc and u.netloc != urlsplit(SITE).netloc:
        return url
    path = u.path.lstrip('/') or 'index.html'
    return path + ('?' + u.query if u.query else '') + ('#' + u.fragment if u.fragment else '')


def target(url):
    u = urlsplit(local(url))
    assert not u.scheme and not u.netloc, ('Expected local published destination', url)
    path = (ROOT / unquote(u.path)).resolve()
    assert path.is_relative_to(ROOT), url
    if path.is_dir():
        path /= 'index.html'
    assert path.is_file() and path.suffix == '.html', url
    doc = html.parse(str(path))
    nodes = doc.xpath('//*[@id=$id]', id=unquote(u.fragment)) if u.fragment else doc.xpath('//main')
    assert len(nodes) == 1, ('Missing or ambiguous destination', url)
    return nodes[0]


def link(url, title, css=''):
    return '<a href="' + escape(local(url), quote=True) + '"' + (f' class="{css}"' if css else '') + '>' + escape(title) + '</a>'


def load_stories(path=CATALOG_PATH):
    raw = json.loads(path.read_text())['stories']
    stories = {}
    for key, entry in raw.items():
        assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', key), key
        placements = entry['placements']
        assert placements and all(r in REGIONS and p in ('lead', 'reading', 'watch', 'archive') for r, p in placements.items()), key
        record = RECORDS.get(entry.get('recordKey'))
        if 'recordKey' in entry:
            assert record is not None, ('Unpublished or unknown record', key)
            assert not record.get('publicationPending'), key
            assert all(r in record.get('regionalScopes', [record['scope']]) for r in placements), ('Region mismatch', key)
            source = local(record['url'])
            node = target(source)
            story = dict(title=record['title'], summary=record['summary'], caveats=record['caveats'],
                         label=record['label'], sources=record['originals'], key=key, source=source,
                         recordKey=record['key'])
            if 'watch' in placements.values():
                assert record['category'] == 'questions', ('Only published questions belong on watch', key)
            elif any(p in ('lead', 'reading') for p in placements.values()):
                assert record['category'] != 'questions', ('Open questions stay on watch', key)
        else:
            source = entry['source']
            node = target(source)
            assert source == 'findings.html#f-012' and placements.keys() == {'tucson'}, key
            def texts(selector):
                matches = node.xpath(selector)
                assert matches, ('Empty published selector', key, selector)
                return [clean(n.text_content()) for n in matches]
            story = dict(title=texts(entry['headlineSelector'])[0], summary=texts(entry['summarySelector']),
                         caveats=texts(entry['qualificationSelector']), label=texts(entry['labelSelector'])[0],
                         sources=[{'title': clean(a.text_content()), 'url': urljoin(SITE + source, a.get('href'))}
                                  for a in node.xpath('.//a[@href]')], key=key, source=source, recordKey=None)
        assert not node.xpath('ancestor-or-self::*[@data-publication-pending="true"]'), key
        story.update(placements=placements, destination=entry.get('destination', source), illustration=entry.get('illustration'))
        target(story['destination'])
        story['related'] = RECORDS.get(entry.get('relatedRecordKey'))
        if 'relatedRecordKey' in entry:
            assert story['related'] and not story['related'].get('publicationPending')
            assert all(r == story['related']['scope'] for r in placements)
            target(story['related']['url'])
        if story['illustration']:
            allowed_illustrations = {
                ('findings.html#f-012', 'tucson', 'lead'): 'assets/tucson-house-arizona.webp',
                ('phoenix/housing-help.html#resource-wvhac', 'phoenix', 'lead'): 'assets/editorial/surprise-west-valley-sketch.webp',
            }
            assert len(placements) == 1
            region, placement = next(iter(placements.items()))
            assert allowed_illustrations.get((source, region, placement)) == story['illustration']['src'], ('Illustration does not match its published story', key)
            assert (ROOT / story['illustration']['src']).is_file()
        stories[key] = story
    for region in REGIONS:
        assert sum(s['placements'].get(region) == 'lead' for s in stories.values()) == 1, region
    return stories


def picks(stories, region, *placements):
    return [s for s in stories.values() if s['placements'].get(region) in placements]


def edition_nav(region):
    routes = [(region + '.html#latest', 'Lead Story'), (region + '.html#keep-reading', 'Keep Reading'),
              ('watch-' + region + '.html', 'Watchlist'), ('archive-' + region + '.html', 'Archive'),
              ('library.html#' + region, 'Research Library'),
              ('housing-help.html' if region == 'tucson' else 'phoenix/housing-help.html', 'Housing help')]
    return '<nav class="desk-nav" aria-label="In this edition">' + ''.join(link(u, t) for u, t in routes) + '</nav>'


def home_brand():
    # Keep the homepage's wrapping, decorative mark and accessible name as the
    # shared source; the editorial stylesheet only supplies its scoped sizing.
    nodes = html.parse(str(ROOT / 'index.html')).xpath('//a[contains(concat(" ", normalize-space(@class), " "), " brand-home ")]')
    assert len(nodes) == 1, 'Expected one statewide home link'
    brand = nodes[0]
    brand.set('class', brand.get('class') + ' brand')
    return html.tostring(brand, encoding='unicode', with_tail=False)


def shell(region, title, body, page=None):
    canonical = SITE + (page or ((region or 'library') + '.html'))
    version = hashlib.sha256((ROOT / 'assets/editorial.css').read_bytes()).hexdigest()[:12]
    tabs = link('index.html', 'Arizona') + ''.join(
        '<a href="' + r + '.html"' + (' aria-current="page"' if region == r else '') + '>' + escape(n.replace(' County', '')) + '</a>'
        for r, n in REGIONS.items())
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} | Housing Accountability Project</title><meta name="description" content="Published housing research, source records and open questions from the Housing Accountability Project."><link rel="canonical" href="{canonical}"><link rel="stylesheet" href="assets/general-page-print-links.css"><script src="assets/general-page-print-links.js" defer></script><script src="assets/editorial.js" defer></script><link rel="icon" href="assets/brand/logo-mark.svg" type="image/svg+xml"><link rel="stylesheet" href="assets/editorial.css?v={version}"><link rel="alternate" type="application/atom+xml" title="HAP research updates" href="feed.xml"></head><body class="{region or 'arizona'}" data-editorial-navigation="true"><a class="skip" href="#main">Skip to content</a><header class="mast"><div class="wrap">{home_brand()}<nav class="switch" aria-label="Regional editions">{tabs}</nav></div></header>{body}<footer class="footer wrap"><nav aria-label="Reader tools">{link('library.html', 'Research Library')} {link('about.html', 'About')} {link('contact.html', 'Contact')} {link('privacy.html', 'Privacy')} {link('feed.xml', 'Updates feed')}</nav><p>Independent public research. Read each finding with its date and source.</p><p>Regional editions organize already-published reporting. Dates and unresolved findings remain attached to the original records.</p></footer><script data-goatcounter="https://housingaccountabilityproject.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script></body></html>'''


def illustration(story):
    image = story.get('illustration')
    if not image:
        return ''
    return f'<figure class="illustration story-illustration"><img src="{image["src"]}" width="{image["width"]}" height="{image["height"]}" alt="{escape(image["alt"], quote=True)}" decoding="async"><figcaption class="caption">{escape(image["caption"])}</figcaption></figure>'


def source_details(story):
    citations = ''.join('<li>' + link(s['url'], s['title']) + '</li>' for s in story['sources'])
    return '<details class="story-sources"><summary>Sources &amp; full reporting</summary><p>' + link(story['source'], story['label']) + '</p><ul>' + citations + '</ul></details>'


def teaser(story):
    return f'<article data-story="{story["key"]}"><p class="meta">{escape(story["label"])}</p><h3>{link(story["destination"], story["title"])}</h3><p>{escape(story["summary"][0])}</p><details class="story-sources"><summary>Full context &amp; qualifications</summary><div>{''.join('<p>'+escape(p)+'</p>' for p in story['caveats'])}</div></details>{link(story["source"], "Read the record & qualifications", "storylink")}</article>'


def library_cards(routes):
    return '<div class="library-cards">' + ''.join(f'<article><h3>{link(u, t)}</h3><p>{escape(note)}</p></article>' for t, u, note in routes) + '</div>'


def paths_for(region):
    if region == 'tucson':
        return [('Older regional overview', 'tucson/index.html', 'Original reporting, historical notes and dated updates.'),
                ('Findings', 'findings.html', 'Published findings and the limits of each source.'),
                ('Evidence & questions', 'evidence.html', 'Original source register and numbered research questions.'),
                ('Housing projects', 'housing-projects.html', 'Project records and separate outcome measures.'),
                ('Funding & outcomes report', 'reports/tucson-housing-funding-outcomes-2026.html', 'The dated report with its corrections and qualifications.'),
                ('Search Tucson records', 'search.html', 'Sources, Funding, Questions and Updates, with print tools.')]
    return [('Older regional overview', 'phoenix/index.html', 'Original reporting, historical notes and dated updates.'),
            ('Evidence & records', 'phoenix/records.html', 'Published evidence, source references and open questions.'),
            ('Housing projects', 'phoenix/projects.html', 'Project profiles with dates and financing distinctions.'),
            ('Questions & records needed', 'phoenix/questions.html', 'Published questions and the evidence needed to answer them.'),
            ('Funding report', 'phoenix/capital-fund.html', 'The dated Capital Fund review and its limitations.'),
            ('Search Phoenix records', 'phoenix/search.html', 'Sources, Funding, Questions and Updates, with print tools.')]


def front(stories, region):
    lead = picks(stories, region, 'lead')[0]
    reads = picks(stories, region, 'reading')
    watches = picks(stories, region, 'watch')[:3]
    intro = '<div class="identity"><div><div class="edition">Regional edition</div><h1>' + escape(REGIONS[region]) + '</h1><p class="deck">Local housing, public money and the records behind both.</p></div>' + link('housing-help.html' if region == 'tucson' else 'phoenix/housing-help.html', 'Find Housing Help', 'help') + '</div>'
    lead_cta = "See shelter contacts and sources" if lead["key"] == "approved-nov19-02" else "Read the story & sources"
    lead_body = f'<article class="lead" data-story="{lead["key"]}"><p class="meta">{escape(lead["label"])}</p><h2>{escape(lead["title"])}</h2><p>{escape(" ".join(lead["summary"]))}</p><p class="qualification">{escape(" ".join(lead["caveats"]))}</p>{link(lead["destination"], lead_cta, "storylink")}{source_details(lead)}</article>'
    art = illustration(lead)
    if not art and lead.get('related'):
        more = lead['related']
        art = '<aside class="lead-record"><p class="kicker">From the published record</p><h3>' + link(more['url'], more['title']) + '</h3><p>' + escape(more['summary'][0]) + '</p><p class="qualification">' + escape(' '.join(more['caveats'])) + '</p>' + link('phoenix/projects/moreland.html#sources', 'Open the source appendix', 'storylink') + '</aside>'
    coc_target = 'hud-coc-funding-court-tracker.html#' + ({'tucson': 'tucson-pima', 'phoenix': 'phoenix-maricopa'}[region])
    target(coc_target)
    coc_link = '<p class="meta">Federal housing policy · Research Updates</p><h3>' + link(coc_target, 'Who Gets HUD Homelessness Funding? The Court Fight and Arizona’s Next Steps') + '</h3>'
    craycroft_followup = ''
    if region == 'tucson':
        craycroft_url = 'research-updates.html#craycroft-towers-board-action-2026-11-18'
        target(craycroft_url)
        craycroft_followup = '<article><p class="meta">Tucson · Project update</p><h3>' + link(craycroft_url, 'Craycroft Towers: Board authorizes steps toward closing') + '</h3></article>'
    additional_reading = ''
    if region == 'phoenix':
        goal = 'phoenix/projects.html#goodyear-cdbg-action-plan-2026-27'
        target(goal)
        additional_reading = '<article><p class="meta">Goodyear · CDBG action plan</p><h3>' + link(goal, 'Goodyear plans home repairs and legal help for renters') + '</h3></article>'
    rundown = ''.join('<li>' + link(s['destination'], s['title']) + '</li>' for s in reads)
    content = intro + edition_nav(region) + '<section aria-labelledby="latest"><div class="bar"><span id="latest">Lead Story</span><span>Published reporting · source dates vary</span></div><div class="storygrid">' + lead_body + art + '</div></section>'
    content += '<aside class="dispatch" aria-label="In this edition"><div><div class="kicker">Edition highlights</div><ul class="edition-links">' + rundown + '</ul></div>' + '</aside>'
    content += '<div class="columns"><section class="news" id="keep-reading"><header class="section-head"><h2>Keep Reading</h2><p>Published stories worth a closer look.</p></header>' + '<article class="federal-policy-update">' + coc_link + '</article>' + additional_reading + craycroft_followup + ''.join(teaser(s) for s in reads) + '</section><section class="following"><header class="section-head"><h2>Things We’re Following</h2><p>Published open questions and the records that could answer them.</p></header>' + ''.join(teaser(s) for s in watches) + link('watch-' + region + '.html', 'See the full watchlist', 'storylink') + '</section></div>'
    content += '<section class="archive"><div><h2>Research Archive</h2><p>Earlier reporting and historical context, with dates and sources intact.</p></div>' + link('archive-' + region + '.html', 'Browse archive', 'storylink') + '</section><section class="edition-library"><header class="section-head"><h2>Explore the research</h2><p>The original records, source dates and qualifications remain available.</p></header>' + library_cards(paths_for(region)) + '</section>'
    return shell(region, REGIONS[region], '<main id="main" class="wrap" tabindex="-1">' + content + '</main>')


def reading(region, title, content):
    return shell(region, title + ' · ' + REGIONS[region], '<main id="main" class="wrap reading" tabindex="-1"><p class="breadcrumbs">' + link(region + '.html', 'Current ' + REGIONS[region] + ' edition') + '</p><p class="kicker">' + escape(REGIONS[region]) + '</p><h1>' + escape(title) + '</h1>' + edition_nav(region) + content + '</main>', page=('watch-' if title == 'Things We’re Following' else 'archive-') + region + '.html')


def watch(stories, region):
    return reading(region, 'Things We’re Following', '<p class="summary">Open questions already in the published research. These are evidence gaps, not findings of wrongdoing.</p><div class="watch-desk">' + ''.join('<div class="watch-row">' + teaser(s) + '<aside class="watch-next"><p class="kicker">Next evidence</p><p>' + escape(' '.join(s['summary'] + s['caveats'])) + '</p>' + link(s['source'], 'Read the question & source limits') + '</aside></div>' for s in picks(stories, region, 'watch')) + '</div>')


def archive(stories, region):
    highlights = '<div class="news">' + ''.join(teaser(s) for s in picks(stories, region, 'lead', 'reading', 'archive')) + '</div>'
    groups = []
    for category, label in [('updates', 'Updates & reports'), ('funding', 'Funding records'), ('sources', 'Sources & project evidence'), ('questions', 'Questions & records needed')]:
        records = [r for r in CATALOG if region in r.get('regionalScopes', [r['scope']]) and r['category'] == category]
        rows = ''.join('<li data-record-key="' + escape(r['key'], quote=True) + '">' + link(r['url'], r['title']) + '<span>' + escape(r['id'] + ' · ' + r['label']) + '</span></li>' for r in records)
        groups.append(f'<details class="archive-group"><summary>{label} ({len(records)})</summary><ul class="archive-choices">{rows}</ul></details>')
    count = sum(region in r.get('regionalScopes', [r['scope']]) for r in CATALOG)
    return reading(region, 'Research Archive', '<p class="summary">Current and earlier reporting. Original links, dates and corrections remain attached to each record.</p><h2>Selected reporting</h2>' + highlights + '<h2>Published research index</h2><p>' + str(count) + ' indexed records, grouped by research category.</p>' + ''.join(groups))


def library():
    common = [('Tucson Research Center', 'research-center.html', 'Browse published Tucson-area research by topic.'), ('Tucson Funding Explorer', 'funding-explorer.html', 'Keep periods, commitments and spending distinct.'), ('Tucson research updates', 'research-updates.html', 'Dated reporting with earlier wording and corrections retained.'), ('Tucson reports & research methods', 'research.html', 'Tucson reports and the methods behind them.')]
    content = '<p class="edition">Arizona / Research Library</p><h1>Research Library</h1><p class="deck">Published findings, project records and reader tools.</p><section class="edition-library"><header class="section-head"><h2>Tucson reports and tools</h2></header>' + library_cards(common) + '</section>'
    for region in REGIONS:
        extra = [('Current regional edition', region + '.html', 'Lead Story, Keep Reading and the regional watchlist.'), ('Research Archive', 'archive-' + region + '.html', 'The full published regional record index.'), ('Watchlist', 'watch-' + region + '.html', 'Published open questions.'), ('Glossary', 'glossary.html' if region == 'tucson' else 'phoenix/glossary.html', 'Research definitions.')]
        if region == 'phoenix':
            extra += [('Corrections', 'phoenix/corrections.html', 'The public correction log.'), ('Comparisons', 'phoenix/comparisons.html', 'Dated source statements side by side.'), ('Inaugural report', 'phoenix/inaugural-report.html', 'The original regional report.')]
        content += '<section class="edition-library" id="' + region + '"><header class="section-head"><h2>' + escape(REGIONS[region]) + '</h2></header>' + library_cards(paths_for(region) + extra) + '</section>'
    return shell(None, 'Research Library', '<main id="main" class="wrap statewide" tabindex="-1">' + content + '</main>')


def homepage():
    path = ROOT / 'index.html'
    content = path.read_text()
    content = content.replace('href="tucson/index.html"', 'href="tucson.html"').replace('href="tucson/"', 'href="tucson.html"')
    content = content.replace('href="phoenix/index.html"', 'href="phoenix.html"').replace('href="phoenix/"', 'href="phoenix.html"')
    if 'href="library.html"' not in content:
        content = content.replace('<summary>Learn &amp; resources</summary><div>', '<summary>Learn &amp; resources</summary><div><a href="library.html">Research Library</a>', 1)
        content = content.replace('<nav class="reader-tools" aria-label="Reader tools">', '<nav class="reader-tools" aria-label="Reader tools"><a href="library.html">Research Library</a>', 1)
    path.write_text(content)


def build(stories):
    for region in REGIONS:
        (ROOT / (region + '.html')).write_text(front(stories, region))
        (ROOT / ('watch-' + region + '.html')).write_text(watch(stories, region))
        (ROOT / ('archive-' + region + '.html')).write_text(archive(stories, region))
    (ROOT / 'library.html').write_text(library())
    homepage()


if __name__ == '__main__':
    build(load_stories(Path(sys.argv[1]) if len(sys.argv) > 1 else CATALOG_PATH))
    print('Built seven editorial views from canonical story references.')
