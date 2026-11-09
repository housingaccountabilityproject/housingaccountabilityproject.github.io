"""One educational theme and navigational shell, with city-scoped destinations."""
from pathlib import Path
from html import escape
from urllib.parse import urlsplit
from lxml import html
import posixpath
import re
import hashlib
from city_reader_guide import apply as reader_guide
from city_design import apply as site_design

ROOT = Path(__file__).resolve().parents[1]
SHARED = {'index.html', 'about.html', 'contact.html', 'privacy.html'}
ABOUT = ('About', 'about.html')
ROUTES = {
    'tucson': [('Overview', 'tucson/index.html'), ('Projects', 'housing-projects.html'), ('Funding', 'funding-explorer.html'), ('Questions', 'questions-records.html'), ('Sources', 'evidence.html'), ('Search', 'search.html')],
    'phoenix': [('Overview', 'phoenix/index.html'), ('Projects', 'phoenix/projects.html'), ('Funding', 'phoenix/records.html#view-funding'), ('Questions', 'phoenix/questions.html'), ('Sources', 'phoenix/records.html#view-source'), ('Search', 'phoenix/records.html')],
    'shared': [('Research areas', 'index.html'), ABOUT, ('Contact', 'contact.html'), ('Search Tucson', 'search.html'), ('Search Phoenix', 'phoenix/records.html')],
}
MORE = {
    'tucson': [('Glossary', 'glossary.html'), ('Reports & reading', 'research.html#publications'), ('Research method', 'research.html#standards'), ('Updates & corrections', 'research-updates.html'), ('Housing help', 'housing-help.html'), ('Research Center', 'research-center.html'), ('Findings', 'findings.html'), ('First report', 'reports/tucson-housing-funding-outcomes-2026.html')],
    'phoenix': [('Glossary', 'phoenix/glossary.html'), ('Reports & reading', 'phoenix/inaugural-report.html'), ('Research method', 'phoenix/index.html#sources'), ('Corrections & history', 'phoenix/corrections.html'), ('Housing help', 'phoenix/housing-help.html'), ('Capital Fund guide', 'phoenix/capital-fund.html'), ('Source comparisons', 'phoenix/comparisons.html')],
    'shared': [('Tucson & Pima County', 'tucson/index.html'), ('Phoenix', 'phoenix/index.html'), ('Housing help: Tucson', 'housing-help.html'), ('Housing help: Phoenix', 'phoenix/housing-help.html')],
}


def relative(target, path):
    url = urlsplit(target)
    base = posixpath.dirname(path) or '.'
    result = posixpath.relpath(url.path, base)
    return result + ('#' + url.fragment if url.fragment else '')


def city_for(path):
    return 'shared' if path in SHARED else 'phoenix' if path.startswith('phoenix/') else 'tucson'


def city_link(label, target, path, selected=False, extra=''):
    current = ' aria-current="page"' if selected else ''
    return f'<a href="{escape(relative(target, path), quote=True)}"{current}{extra}>{escape(label)}</a>'


def header(path, city):
    name = {'tucson': 'Tucson & Pima County', 'phoenix': 'Phoenix', 'shared': 'Independent public research'}[city]
    switch = ''.join(city_link(label, target, path, city == key) for key, label, target in [('tucson', 'Tucson & Pima County', 'tucson/index.html'), ('phoenix', 'Phoenix', 'phoenix/index.html')])
    routes = ROUTES[city]
    if city != 'shared':
        routes = [routes[0], ABOUT, *routes[1:]]
    nav = ''.join(city_link(label, target, path, path == target and '#' not in target, f' data-city-route="{label.lower().replace(" ", "-")}"') for label, target in routes)
    more = ''.join(city_link(label, target, path, path == target) for label, target in MORE[city])
    utilities = ''.join(city_link(label,target,path) for label,target in [('Contact','contact.html'),('Privacy','privacy.html')])
    return f'''<header class="city-header"><div class="city-wrap city-header-inner"><a class="city-brand brand-home" href="{escape(relative('index.html', path))}" aria-label="Housing Accountability Project home"><img src="{escape(relative('assets/brand/logo-mark.svg', path))}" width="48" height="48" alt=""><span class="brand-name">Housing<br>Accountability Project</span></a><span class="city-current-city">{escape(name)}</span><button class="city-menu-toggle" type="button" aria-controls="city-navigation-panel" aria-expanded="false" hidden><span aria-hidden="true">☰</span> Menu</button><button class="city-menu-backdrop" type="button" tabindex="-1" aria-hidden="true" hidden></button><div class="city-nav-panel" id="city-navigation-panel"><div class="city-menu-heading"><span id="city-menu-title">Explore the website</span><button class="city-menu-close" type="button" aria-label="Close menu">Close ×</button></div><div class="city-identity"><span>{escape(name)}</span><nav class="city-switcher" aria-label="Research area">{switch}</nav></div><nav class="city-main-nav" aria-label="Main navigation">{nav}<details class="city-more"><summary>Learn &amp; resources</summary><div>{more}</div></details></nav><nav class="city-menu-utilities" aria-label="About this website">{utilities}</nav></div></div></header>'''


def footer(path, city):
    route_city = city if city != 'shared' else 'tucson'
    links = [ROUTES[route_city][-1], ('Housing help', 'phoenix/housing-help.html' if city == 'phoenix' else 'housing-help.html'), ('Privacy', 'privacy.html')]
    if city == 'phoenix':
        links += [('Corrections & history', 'phoenix/corrections.html')]
    else:
        links += [('Updates feed', 'feed.xml')]
    nav = ''.join(city_link(label, target, path) for label, target in links)
    areas = ''.join(city_link(label,target,path) for label,target in [('Tucson & Pima County','tucson/index.html'),('Phoenix','phoenix/index.html')])
    learn = ''.join(city_link(label,target,path) for label,target in MORE[route_city][:3])
    about = ''.join(city_link(label,target,path) for label,target in [('About the project','about.html'),('Contact','contact.html')])
    return f'<footer class="city-footer"><div class="city-wrap"><p class="city-footer-title">Housing Accountability Project</p><p>Independent public research. Read each finding with its date and source.</p><div class="city-footer-grid"><div><p class="city-footer-label">Research areas</p><nav aria-label="Research area links">{areas}</nav></div><div><p class="city-footer-label">Learn</p><nav aria-label="Learning resources">{learn}</nav></div><div><p class="city-footer-label">Reader tools</p><nav class="reader-tools" aria-label="Reader tools">{nav}</nav></div><div><p class="city-footer-label">About</p><nav aria-label="Project information">{about}</nav></div></div></div><p>Public Research Website</p></footer>'


def learning(city, path):
    routes = dict(ROUTES[city])
    cards = [('01', 'Follow the money', 'Read the difference between an approval, a funding record and reported spending.', 'Funding'), ('02', 'Explore the homes', 'Follow a project and distinguish planned homes from reported results.', 'Projects'), ('03', 'Check a claim', 'See the original record, its date and what it can establish.', 'Sources'), ('04', 'See what is still unknown', 'Follow the questions and the evidence needed to answer them.', 'Questions')]
    paths = ''.join(f'<a href="{escape(relative(routes[key], path), quote=True)}"><span class="city-path-number">{number}</span><strong>{title}</strong><span>{description}</span><span class="city-path-arrow" aria-hidden="true">→</span></a>' for number, title, description, key in cards)
    concepts = [('Does approved mean spent?', 'An approval permits an action or sets a ceiling. To understand payments, look for a record of actual disbursement or expenditure, with its program and period attached.'), ('Does planned mean completed?', 'A planned apartment count describes intended delivery. A dated completion report is a different record; neither by itself tells you which homes are currently available.'), ('Why do place and date matter?', 'City, county and regional figures can describe different populations and periods. Keep the geography, unit and reporting date with each number before comparing it.')]
    notes = ''.join(f'<details><summary>{question}</summary><p>{answer}</p></details>' for question, answer in concepts)
    return f'<section class="city-learning city-wrap" aria-labelledby="city-learning-title"><p class="city-eyebrow">Choose a path</p><h2 id="city-learning-title">Start with a question.</h2><p class="city-learning-intro">You do not need to know the program names or codes. Start with what you want to understand.</p><nav class="city-learning-grid question-paths" aria-label="Choose a research question">{paths}</nav><div class="city-concepts"><h3>Three ideas that make the records easier to read</h3>{notes}</div></section>'


def overview(output, path, city):
    doc = html.fromstring(output)
    existing = doc.xpath('//main/*[contains(concat(" ",normalize-space(@class)," ")," city-overview-hero ")]')
    if existing:
        return output
    if city == 'tucson':
        hero = doc.xpath('//main/div[contains(concat(" ",normalize-space(@class)," ")," hero ")]')[0]
        headline = html.tostring(hero.xpath('.//h1')[0], encoding='unicode')
        slogan = html.tostring(hero.xpath('.//p[@class="hero-slogan"]')[0], encoding='unicode')
        intro = ''.join(html.tostring(p, encoding='unicode') for p in hero.xpath('./p[not(@class)]'))
        extras = ''.join(html.tostring(d, encoding='unicode') for d in hero.xpath('./details'))
        service = ''.join(html.tostring(p, encoding='unicode') for p in hero.xpath('./p[@class="service-note"]'))
        scope = f'<p><strong>Research area:</strong> Tucson and Pima County, with each finding identifying its own jurisdiction and reporting period.</p>{service}'
        # This container has only HTML text and links; the research sections remain untouched.
        start = output.index('<div class="hero">')
        jump = output.index('<div class="page-jump"', start)
        end = output.rfind('</div>', start, jump) + len('</div>')
    else:
        hero = doc.xpath('//section[contains(concat(" ",normalize-space(@class)," ")," phoenix-hero ")]')[0]
        headline = '<h1>Where Do Housing Funds Go?<br>What Do They Deliver?</h1>'
        slogan = '<p class="hero-slogan">Public Funding Deserves Public Understanding</p>'
        intro = ''.join(html.tostring(p, encoding='unicode') for p in hero.xpath('./div/p'))
        extras = '<details class="hero-more"><summary>Explore the project files</summary><p>' + city_link('25th @ Bell', 'phoenix/projects/25th-at-bell.html', path) + ' · ' + city_link('The Moreland', 'phoenix/projects/moreland.html', path) + '</p></details>'
        scope = ''.join(html.tostring(p, encoding='unicode') for p in hero.xpath('./aside/p'))
        start = output.index('<section class="wrap phoenix-hero">')
        end = output.index('</section>', start) + len('</section>')
    name = 'Tucson & Pima County' if city == 'tucson' else 'Phoenix'
    new = f'<section class="hero city-overview-hero"><div class="city-wrap city-hero-grid"><div class="city-hero-copy"><p class="city-eyebrow">{escape(name)} · Housing research</p>{headline}{slogan}{intro}{extras}</div><aside class="city-scope"><p class="city-eyebrow">Read the scope</p>{scope}</aside></div></section>'
    output = output[:start] + new + output[end:]
    # Remove the older Phoenix summary/route block; the findings themselves are retained.
    output = re.sub(r'<section class="overview-summary wrap".*?</section></div></section>', '', output, count=1, flags=re.S)
    return output.replace(new, new + learning(city, path), 1)


def apply(output, path):
    city = city_for(path)
    body_match = re.search(r'<body\b([^>]*)>', output)
    attributes = body_match.group(1)
    attributes = re.sub(r'\sclass="([^"]*)"', lambda m: ' class="' + ' '.join(c for c in m.group(1).split() if c not in ['city-site','city-tucson','city-phoenix','city-shared','city-document','city-with-hero','city-landing','city-design']) + '"', attributes)
    doc = html.fromstring(output)
    main = doc.xpath('//main')[0]
    has_hero = city == 'phoenix' or path == 'index.html' or bool(main.xpath('./*[contains(concat(" ",normalize-space(@class)," ")," hero ")]'))
    classes = f'city-site city-design city-{city} ' + ('city-with-hero' if has_hero else 'city-document')
    if path in ['index.html','tucson/index.html','phoenix/index.html']:
        classes += ' city-landing'
    if 'class="' in attributes:
        attributes = attributes.replace('class="', f'class="{classes} ', 1)
    else:
        attributes += f' class="{classes}"'
    output = output[:body_match.start()] + '<body' + attributes + '>' + output[body_match.end():]
    output = re.sub(r'<header\b[^>]*>.*?</header>', lambda m: header(path, city), output, count=1, flags=re.S)
    output = re.sub(r'<footer\b[^>]*>.*?</footer>', lambda m: footer(path, city), output, count=1, flags=re.S)
    # The primary header replaces the old duplicate city navigation.
    output = re.sub(r'<nav class="wrap phoenix-tools".*?</nav>', '', output, flags=re.S)
    output = re.sub(r'<nav aria-label="Research areas"[^>]*>.*?</nav>', '', output, flags=re.S)
    output = re.sub(r'<div class="wrap breadcrumbs">.*?</div>', '', output, flags=re.S)
    output = re.sub(r'<nav class="city-breadcrumbs breadcrumbs".*?</nav>', '', output, flags=re.S)
    # Keep just one Reader tools landmark, now in the shared footer.
    before_footer, sep, after_footer = output.partition('<footer class="city-footer">')
    before_footer = re.sub(r'<nav\b[^>]*class="reader-tools"[^>]*>.*?</nav>', '', before_footer, flags=re.S)
    output = before_footer + sep + after_footer
    if city != 'shared':
        name = 'Tucson & Pima County' if city == 'tucson' else 'Phoenix'
        overview_path = ROUTES[city][0][1]
        crumb = city_link('Research areas', 'index.html', path) + ' / '
        crumb += escape(name) if path == overview_path else city_link(name, overview_path, path)
        output = re.sub(r'(<main\b[^>]*>)', lambda m: m.group(1) + f'<nav class="city-breadcrumbs breadcrumbs" aria-label="Breadcrumb">{crumb}</nav>', output, count=1)
    if path in ['tucson/index.html','phoenix/index.html']:
        output = overview(output, path, city)
    output = reader_guide(output, path)
    output = site_design(output, path)
    output = re.sub(r'<link rel="stylesheet" href="[^"]*assets/city-layout.css(?:\?[^"]*)?">', '', output)
    output = re.sub(r'<script src="[^"]*assets/city-layout.js(?:\?[^"]*)?" defer></script>', '', output)
    output = output.replace('</head>', f'<link rel="stylesheet" href="{escape(relative("assets/city-layout.css", path))}"><script src="{escape(relative("assets/city-layout.js", path))}" defer></script></head>')
    def asset_version(match):
        attribute, url, filename = match.groups()
        version = hashlib.sha256((ROOT/'assets'/filename).read_bytes()).hexdigest()[:12]
        return f'{attribute}="{url}?v={version}"'
    output = re.sub(r'(href|src)="((?:\.\./)*assets/(city-layout\.(?:css|js)|phoenix-connections\.js|phoenix-records\.js|research-center-filter\.js))(?:\?[^"]*)?"',asset_version,output)
    return output


def build():
    paths = [p for p in ROOT.glob('*.html') if not p.name.startswith('google')]
    paths += list((ROOT / 'tucson').glob('*.html')) + list((ROOT / 'phoenix').rglob('*.html')) + list((ROOT / 'reports').glob('*.html'))
    for path in paths:
        path.write_text(apply(path.read_text(), path.relative_to(ROOT).as_posix()))
    print(f'Applied the shared city theme and layout to {len(paths)} pages.')


if __name__ == '__main__':
    build()
