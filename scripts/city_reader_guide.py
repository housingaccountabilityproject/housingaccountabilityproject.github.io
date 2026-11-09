"""Curated entry points over the existing, dated research; no new evidence claims."""
from pathlib import Path
from html import escape
from urllib.parse import urlsplit
from lxml import html
from datetime import date
import json
import posixpath
import re

ROOT = Path(__file__).resolve().parents[1]


def data():
    return json.loads((ROOT / 'data/city-reader-guide.json').read_text())


def href(target, path):
    url = urlsplit(target)
    result = posixpath.relpath(url.path or path, posixpath.dirname(path) or '.')
    return escape(result + ('#' + url.fragment if url.fragment else ''), quote=True)


def region(output, tag, marker):
    """Locate one balanced HTML region while retaining unrelated source markup."""
    start = re.search(r'<' + tag + r'\b[^>]*' + marker + r'[^>]*>', output)
    assert start, (tag, marker)
    depth = 0
    for token in re.finditer(r'</?' + tag + r'\b[^>]*>', output[start.start():]):
        depth += -1 if token.group().startswith('</') else 1
        if not depth:
            return start.start(), start.start() + token.end()
    raise ValueError(('Unclosed region', tag, marker))


def replace(output, tag, marker, value):
    start, end = region(output, tag, marker)
    return output[:start] + value + output[end:]


def landscape(path):
    return f'<div class="city-landscape" aria-hidden="true"><img src="{href("assets/arizona-landscape.webp", path)}" width="1983" height="793" alt="" decoding="async" fetchpriority="high"></div>'


def hero(city, spec, path):
    day = date.fromisoformat(spec['date'])
    label = f'{day:%B} {day.day}, {day.year}'
    return f'''<section class="hero city-overview-hero">{landscape(path)}<div class="city-hero-copy city-wrap"><p class="city-eyebrow">{escape(spec['name'])} · Housing research</p><h1>Where Do Housing Funds Go?<br>What Do They Deliver?</h1><p class="hero-intro">{escape(spec['intro'])}</p><p class="city-hero-date">{escape(spec['date_label'])}: <time datetime="{spec['date']}">{label}</time> · Source periods vary.</p></div></section>'''


def learning(spec, path):
    routes = [('Follow the money', 'funding_href', 'Approvals, financing and spending'), ('Explore the homes', 'projects_href', 'Projects, phases and reported results'), ('Check a claim', 'sources_href', 'Original records and source notes'), ('What’s still unknown?', 'questions_href', 'Open questions and evidence needed')]
    arrow = '<span class="city-path-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="M4 12 12 4M4 4h8v8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span>'
    cards = ''.join(f'<a href="{href(spec[key],path)}"><strong>{title}</strong><span>{description}</span>{arrow}</a>' for title,key,description in routes)
    return f'<section class="city-learning city-wrap" aria-labelledby="city-learning-title"><h2 id="city-learning-title">Start with a question.</h2><nav class="city-learning-grid question-paths" aria-label="Choose a research question">{cards}</nav></section>'


def project_facts(project):
    fields = [('Place','place'), ('Stage & date','stage'), ('Homes','homes'), ('Funding record','funding')]
    return '<dl class="city-project-facts">' + ''.join(f'<div><dt>{label}</dt><dd>{escape(project[key])}</dd></div>' for label,key in fields) + '</dl>'


def project_card(project, path):
    return f'<article class="city-project-card"><h3>{escape(project["name"])}</h3>{project_facts(project)}<p class="city-project-caution">{escape(project["caution"])}</p><a class="city-text-link" href="{href(project["href"],path)}">Explore {escape(project["name"])} <span aria-hidden="true">→</span></a></article>'


def stages(spec, path):
    steps = [
        ('Approved', 'Permission or a ceiling.', 'An adopted action or authorization shows what is permitted. It does not prove that an agreement was executed or money was paid.'),
        ('Financing secured', 'A financing event.', 'A reported closing describes financing. Read the closing documents and the funder’s role before describing it as City spending.'),
        ('Money spent', 'A dated payment or expenditure.', 'Look for disbursement or expenditure records matched to the program, project and period. A reported program total may not identify a specific project.'),
        ('Housing delivered', 'A reported housing milestone.', 'Read the completion or opening record with its date and evidence status. It does not by itself establish current occupancy or available vacancies.')
    ]
    cards = []
    for index, (title, short, explanation) in enumerate(steps):
        example = spec['stage_examples'][index]
        cards.append(f'<li><span class="city-stage-letter" aria-hidden="true">{chr(65+index)}</span><h4>{title}</h4><p>{short}</p><details><summary>What does this establish?</summary><p>{explanation}</p><a href="{href(example["href"],path)}">{escape(example["label"])}</a></details></li>')
    return '<div class="city-stage-guide"><h3>Four records. Four different meanings.</h3><p class="city-stage-note">These are separate measures, not a guaranteed sequence. Evidence of one does not establish the others.</p><ol class="city-stage-grid">' + ''.join(cards) + '</ol></div>'


def guide(city, spec, path, projects):
    findings = ''.join(f'<article><h3>{escape(item["title"])}</h3><p>{escape(item["text"])}</p><a class="city-text-link" href="{href(item["href"],path)}">Read the finding <span aria-hidden="true">→</span></a></article>' for item in spec['findings'])
    featured = ''.join(project_card(projects[key], path) for key in spec['featured_projects'])
    questions = ''.join(f'<article><h3>{escape(item["title"])}</h3><p>{escape(item["text"])}</p><a class="city-text-link" href="{href(item["href"],path)}">Follow the question <span aria-hidden="true">→</span></a></article>' for item in spec['questions'])
    return f'''<div class="city-reading-guide city-wrap" data-city-guide-version="2">
<nav class="city-guide-jump" aria-label="Overview sections"><a href="#guide-findings">Key findings</a><a href="#guide-projects">Projects &amp; funding</a><a href="#guide-questions">Open questions</a><a href="#guide-sources">Sources</a></nav>
<section id="guide-findings" class="city-guide-section"><p class="city-eyebrow">01 / What the records say</p><h2>A few findings to start with.</h2><p class="city-section-intro">Selected examples from this research. Each figure keeps its date, place and limits.</p><div class="city-finding-grid">{findings}</div></section>
<section id="guide-projects" class="city-guide-section"><div class="city-section-heading"><div><p class="city-eyebrow">02 / Projects &amp; funding</p><h2>Start with one place.</h2></div><div class="city-section-actions"><a href="{href(spec['projects_href'],path)}">All researched projects →</a><a href="{href(spec['funding_href'],path)}">Explore funding →</a></div></div><p class="city-section-intro">A selected research set, not a complete city inventory or a housing availability list.</p><div class="city-project-grid">{featured}</div>{stages(spec,path)}</section>
<section id="guide-questions" class="city-guide-section"><p class="city-eyebrow">03 / What remains unknown</p><h2>Good questions need the right records.</h2><p class="city-section-intro">A gap in the reviewed evidence does not by itself establish misuse.</p><div class="city-question-grid">{questions}</div><a class="city-text-link" href="{href(spec['questions_href'],path)}">See all research questions →</a></section>
<section id="guide-sources" class="city-guide-section city-source-invitation"><div><p class="city-eyebrow">04 / Check the evidence</p><h2>Go back to the original record.</h2><p>Use the source index to find original documents and locators. Check the reporting period and read the limits attached to each finding.</p></div><div class="city-source-actions"><a class="city-primary-link" href="{href(spec['sources_href'],path)}">Browse the sources →</a><a href="#full-research">Read the full research on this page</a></div></section>
</div>'''


def overviews(output, path, all_data):
    output = output.replace('<details id="full-research" class="city-evidence-library city-wrap"><summary>', '<details class="city-evidence-library city-wrap"><summary id="full-research" class="city-library-summary">')
    city = 'phoenix' if path.startswith('phoenix/') else 'tucson'
    spec = all_data['cities'][city]
    new_hero = hero(city, spec, path)
    new_learning = learning(spec, path)
    new_guide = guide(city, spec, path, all_data['projects'][city])
    if 'data-city-guide-version="2"' in output:
        output = replace(output, 'section', r'class="hero city-overview-hero"', new_hero)
        output = replace(output, 'section', r'class="city-learning city-wrap"', new_learning)
        return replace(output, 'div', r'class="city-reading-guide city-wrap"', new_guide)
    root = html.fromstring(output)
    old_hero = root.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," city-overview-hero ")]')[0]
    scope = old_hero.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," city-scope ")]')[0]
    notes = ''.join(html.tostring(child,encoding='unicode') for child in scope if 'city-eyebrow' not in child.get('class',''))
    notes += ''.join(html.tostring(e,encoding='unicode') for e in old_hero.xpath('.//*[@class="hero-slogan"]|.//details[contains(@class,"hero-more")]'))
    about = f'<details class="city-about city-scope city-wrap"><summary>About these records: scope, dates &amp; reading notes</summary><div>{notes}</div></details>'
    start, _ = region(output, 'section', r'class="hero city-overview-hero"')
    _, learning_end = region(output, 'section', r'class="city-learning city-wrap"')
    main_end = output.index('</main>', learning_end)
    full = output[learning_end:main_end]
    help_note = ''
    if city == 'tucson':
        h_start,h_end = region(full,'section',r'class="reader-callout"')
        help_note = full[h_start:h_end]
        full = full[:h_start] + full[h_end:]
    library = f'<details class="city-evidence-library city-wrap"><summary id="full-research" class="city-library-summary">Full research, updates and methods</summary><div class="city-full-research">{full}</div></details>'
    return output[:start] + new_hero + new_learning + about + new_guide + library + help_note + output[main_end:]


def homepage(output, path):
    new_hero = f'''<section class="hero city-home-hero">{landscape(path)}<div class="city-hero-copy city-wrap"><p class="city-eyebrow">Independent public research · Arizona</p><h1>Public funding.<br>Real homes.</h1><p class="hero-intro">Follow housing money, explore projects, and see what the public records establish.</p><div class="home-actions"><a class="city-primary-link" href="tucson/index.html">Tucson &amp; Pima County →</a><a class="city-primary-link" href="phoenix/index.html">Phoenix →</a><a href="about.html">About the project and founder</a></div></div></section>'''
    return replace(output,'section',r'class="hero(?: city-home-hero)?"',new_hero)


def project_summaries(output, path, all_data):
    city = 'tucson' if path == 'housing-projects.html' else 'phoenix'
    root = html.fromstring(output)
    for key,project in all_data['projects'][city].items():
        cards = root.xpath('//article[@id=$id]',id=key)
        if not cards:
            continue
        card = cards[0]
        heading = card.xpath('./h2|./h3')[0]
        title = html.tostring(heading,encoding='unicode',with_tail=False)
        if card.xpath('./details[contains(@class,"city-project-details")]'):
            details = html.tostring(card.xpath('./details[contains(@class,"city-project-details")]')[0],encoding='unicode',with_tail=False)
        else:
            body = ''.join(html.tostring(child,encoding='unicode') for child in card if child is not heading and 'directory-heading' not in child.get('class','') and 'record-reading' not in child.get('class',''))
            details = f'<details class="city-project-details"><summary>Dates, funding &amp; sources</summary>{body}</details>'
        attrs = ''.join(f' {name}="{escape(value,quote=True)}"' for name,value in card.attrib.items())
        target = project.get('finding_href',project['href'])
        label = 'Read the finding' if city == 'tucson' else 'Read the published context'
        permalink = f'<a class="city-project-permalink" href="#{key}">Direct link</a>'
        new = f'<article{attrs}>{permalink}{title}{project_facts(project)}<p class="city-project-caution">{escape(project["caution"])}</p><a class="record-reading city-text-link" href="{href(target,path)}">{label} →</a>{details}</article>'
        output = replace(output,'article',r'id="'+re.escape(key)+r'"',new)
    return output


def project_file_intro(output,path,all_data):
    key = 'project-moreland' if path.endswith('/moreland.html') else 'project-bell'
    project = all_data['projects']['phoenix'][key]
    intro = f'<section class="city-project-overview city-wrap"><h2>Project at a glance.</h2>{project_facts(project)}<p class="city-project-caution">{escape(project["caution"])}</p></section>'
    if 'class="city-project-overview city-wrap"' in output:
        return replace(output,'section',r'class="city-project-overview city-wrap"',intro)
    klass = 'connections-intro' if key == 'project-moreland' else 'project-hero'
    _,end = region(output,'section',r'class="wrap '+klass+r'"')
    return output[:end] + intro + output[end:]


def apply(output,path):
    if path not in ['index.html','tucson/index.html','phoenix/index.html','housing-projects.html','phoenix/projects.html','phoenix/projects/moreland.html','phoenix/projects/25th-at-bell.html']:
        return output
    all_data = data()
    if path == 'index.html':
        return homepage(output,path)
    if path in ['tucson/index.html','phoenix/index.html']:
        return overviews(output,path,all_data)
    if path in ['housing-projects.html','phoenix/projects.html']:
        return project_summaries(output,path,all_data)
    return project_file_intro(output,path,all_data)
