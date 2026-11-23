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


def hero(spec, path):
    day = date.fromisoformat(spec['date'])
    label = f'{day:%B} {day.day}, {day.year}'
    city = path.split('/', 1)[0]
    edition_label = {'tucson': 'Current Tucson & Pima County edition', 'phoenix': 'Current Phoenix & Maricopa County edition'}[city]
    updates = ' · '.join(f'<a href="{href(item["href"], path)}">{escape(item["label"])}</a>' for item in spec['published_updates'])
    return f'''<section class="hero city-overview-hero">{landscape(path)}<div class="city-hero-copy city-wrap"><p class="city-eyebrow">Regional research overview</p><h1>{escape(spec['name'])}</h1><p class="hero-intro">{escape(spec['intro'])}</p><p class="city-hero-date city-edition-link"><a href="{href(city + '.html', path)}">{escape(edition_label)}</a></p><p class="city-hero-date">{escape(spec['date_label'])} · <time datetime="{spec['date']}">{label}</time>. Source periods vary.<br>Later publications · {updates}</p></div></section>'''


def learning(spec, path):
    routes = [('Follow the money', 'funding_href', 'Approvals, financing and spending'), ('Explore the homes', 'projects_href', 'Projects, phases and reported results'), ('Check a claim', 'sources_href', 'Original records and source notes'), ('What’s still unknown?', 'questions_href', 'Open questions and evidence needed')]
    arrow = '<span class="city-path-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="M4 12 12 4M4 4h8v8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span>'
    cards = ''.join(f'<a href="{href(spec[key],path)}"><strong>{title}</strong><span>{description}</span>{arrow}</a>' for title,key,description in routes)
    return f'<section class="city-learning city-wrap" aria-labelledby="city-learning-title"><h2 id="city-learning-title">Start with a question.</h2><nav class="city-learning-grid question-paths" aria-label="Choose a research question">{cards}</nav></section>'


def project_facts(project):
    fields = [('Place','place'), ('Stage & date','stage'), ('Homes','homes'), ('Funding record','funding')]
    return '<dl class="city-project-facts">' + ''.join(f'<div><dt>{label}</dt><dd>{escape(project[key])}</dd></div>' for label,key in fields) + '</dl>'


def project_card(project, path):
    return f'<article class="city-project-card"><h3>{escape(project["name"])}</h3><p class="city-overview-homes">{escape(project["homes"])}</p><p class="city-overview-stage">{escape(project["stage"])}</p><a class="city-text-link" href="{href(project["href"],path)}">Explore {escape(project["name"])} <span aria-hidden="true">→</span></a></article>'


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
        cards.append(f'<li><span class="city-stage-letter" aria-hidden="true">{chr(65+index)}</span><h3>{title}</h3><p>{short}</p><details><summary>What does this establish?</summary><p>{explanation}</p><a href="{href(example["href"],path)}">{escape(example["label"])}</a></details></li>')
    return '<div class="city-stage-guide"><h2>Four records. Four different meanings.</h2><p class="city-stage-note">These are separate measures, not a guaranteed sequence. Evidence of one does not establish the others.</p><ol class="city-stage-grid">' + ''.join(cards) + '</ol></div>'


def guide(city, spec, path, projects):
    findings = ''.join(f'<article><h3>{escape(item["title"])}</h3><p>{escape(item["text"])}</p><a class="city-text-link" href="{href(item["href"],path)}">Read the finding <span aria-hidden="true">→</span></a></article>' for item in spec['findings'])
    featured = ''.join(project_card(projects[key], path) for key in spec['featured_projects'])
    questions = ''.join(f'<article><h3>{escape(item["title"])}</h3><p>{escape(item["text"])}</p><a class="city-text-link" href="{href(item["href"],path)}">Follow the question <span aria-hidden="true">→</span></a></article>' for item in spec['questions'])
    return f'''<div class="city-reading-guide city-wrap" data-city-guide-version="2">
<nav class="city-guide-jump" aria-label="Overview sections"><a href="#guide-findings">Key findings</a><a href="#guide-projects">Projects &amp; funding</a><a href="#guide-questions">Open questions</a><a href="#guide-sources">Sources</a></nav>
<section id="guide-findings" class="city-guide-section"><p class="city-eyebrow">01 / What the records say</p><h2>A few findings to start with.</h2><p class="city-section-intro">Selected examples from this research. Each figure keeps its date, place and limits.</p><div class="city-finding-grid">{findings}</div></section>
<section id="guide-projects" class="city-guide-section"><div class="city-section-heading"><div><p class="city-eyebrow">02 / Projects &amp; funding</p><h2>Start with one place.</h2></div><div class="city-section-actions"><a href="{href(spec['projects_href'],path)}">All researched projects →</a><a href="{href(spec['funding_href'],path)}">Explore funding →</a></div></div><p class="city-section-intro">A selected research set, not a complete city inventory or a housing availability list.</p><div class="city-project-grid">{featured}</div><p class="city-overview-project-note">Reported milestones do not establish current vacancies.</p><details class="city-funding-explainer"><summary>How do funding records differ?</summary>{stages(spec,path)}</details></section>
<section id="guide-questions" class="city-guide-section"><p class="city-eyebrow">03 / What remains unknown</p><h2>Good questions need the right records.</h2><p class="city-section-intro">A gap in the reviewed evidence does not by itself establish misuse.</p><div class="city-question-grid">{questions}</div><a class="city-text-link" href="{href(spec['questions_href'],path)}">See all research questions →</a></section>
<section id="guide-sources" class="city-guide-section city-source-invitation"><div><p class="city-eyebrow">04 / Check the evidence</p><h2>Go back to the original record.</h2><p>Use the source index to find original documents and locators. Check the reporting period and read the limits attached to each finding.</p></div><div class="city-source-actions"><a class="city-primary-link" href="{href(spec['sources_href'],path)}">Browse the sources →</a><a href="#full-research">Read the full research on this page</a></div></section>
</div>'''


def overviews(output, path, all_data):
    output = output.replace('<details id="full-research" class="city-evidence-library city-wrap"><summary>', '<details class="city-evidence-library city-wrap"><summary id="full-research" class="city-library-summary">')
    city = 'phoenix' if path.startswith('phoenix/') else 'tucson'
    spec = all_data['cities'][city]
    new_hero = hero(spec, path)
    # Retain historical dates and later publication links already on the page.
    old_date = re.search(r'<p class="city-hero-date">.*?</p>', output, re.S)
    if old_date:
        new_hero = re.sub(r'<p class="city-hero-date">.*?</p>', lambda _: old_date.group(), new_hero, count=1, flags=re.S)
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
    new_hero = f'''<section class="hero city-home-hero">{landscape(path)}<div class="city-hero-copy city-wrap"><p class="city-eyebrow">Independent public research · Arizona</p><h1>Public funding.<br>Real homes.</h1><p class="hero-intro">Follow housing money, explore projects, and see what the public records establish.</p><div class="home-actions"><a class="city-primary-link" href="tucson/index.html">Tucson &amp; Pima County →</a><a class="city-primary-link" href="phoenix/index.html">Phoenix &amp; Maricopa County →</a><a href="about.html">About the project and founder</a></div></div></section>'''
    new_hero = new_hero.replace('href="tucson/index.html"', 'href="tucson.html"').replace('href="phoenix/index.html"', 'href="phoenix.html"')
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



def overview_navigation_assets(city):
    """Reuse the exact Phase 1 responsive behavior without altering Phoenix output."""
    style = '''<style id="phoenix-page-contents-style">
.phoenix-overview .phoenix-overview-shell{container:phoenix-overview / inline-size;width:min(1240px,100% - 40px);margin-inline:auto}
.phoenix-overview .phoenix-overview-layout{display:grid;grid-template-columns:minmax(12rem,14rem) minmax(0,1fr);gap:clamp(1rem,3vw,2rem);align-items:start}
.phoenix-overview .phoenix-overview-reading{min-width:0}
.phoenix-overview .phoenix-overview-reading .wrap,.phoenix-overview .phoenix-overview-reading .city-wrap{width:100%}
.phoenix-overview .phoenix-page-nav{position:sticky;top:1rem;align-self:start;z-index:2;box-sizing:border-box;padding:.75rem;margin-block:1.5rem;border:1px solid var(--line);border-radius:10px;background:var(--paper)}
.phoenix-overview .phoenix-page-nav h2{margin:0 0 .45rem;font:700 1.05rem/1.3 system-ui,sans-serif}
.phoenix-page-nav>details{max-height:calc(100vh - 3rem);overflow:auto}
.phoenix-page-nav>details>summary{display:none}
.phoenix-page-nav ul{list-style:none;margin:0;padding:0}
.phoenix-page-nav a,.phoenix-source-choices a{display:inline-flex;align-items:center;min-height:44px;padding:.25rem .4rem;text-decoration:underline;line-height:1.25;overflow-wrap:anywhere}
.phoenix-page-nav .phoenix-primary-jumps a{display:flex;border-inline-start:3px solid transparent;border-radius:4px}
.phoenix-page-nav a[aria-current="location"]{background:var(--mint);border-inline-start-color:var(--teal);font-weight:700}
.phoenix-page-nav :is(a,summary):focus-visible,.phoenix-source-choices a:focus-visible{outline:3px solid currentColor;outline-offset:-2px}
.phoenix-page-nav .phoenix-more-jumps>summary{min-height:44px;padding:.65rem .4rem;cursor:pointer}
.phoenix-page-nav .phoenix-more-jumps>ul>li{margin-bottom:.5rem}
.phoenix-source-choices{display:flex;flex-wrap:wrap;gap:.35rem 1rem;margin-bottom:1rem}
@container phoenix-overview (max-width:52rem){
 .phoenix-overview .phoenix-overview-layout{display:block}
 .phoenix-overview .phoenix-page-nav{position:static;margin:.7rem 0;padding:.15rem .5rem}
 .phoenix-overview.phoenix-sticky-enhanced .phoenix-page-nav{position:sticky;top:0}
 .phoenix-page-nav h2{display:none}
 .phoenix-page-nav>details>summary{display:list-item;min-height:48px;padding:.6rem .35rem;font-weight:700;cursor:pointer}
 .phoenix-page-nav>details{max-height:min(60vh,22rem);overflow:auto}
}
@media(prefers-reduced-motion:reduce){html:has(.phoenix-overview){scroll-behavior:auto}}
@media print{
 .phoenix-overview .phoenix-overview-shell,.phoenix-overview .phoenix-overview-layout{display:block;width:100%}
 .phoenix-page-nav,.phoenix-source-choices{display:none!important}
}
</style>'''
    script = '''<script id="phoenix-page-contents-script">
document.addEventListener('DOMContentLoaded',()=>{
 const nav=document.getElementById('phoenix-page-contents');
 if(!nav)return;
 const menu=nav.querySelector(':scope>details');
 const summary=menu.querySelector(':scope>summary');
 const primary=Array.from(nav.querySelectorAll('.phoenix-primary-jumps a'));
 const links=Array.from(nav.querySelectorAll('a[href^="#"]'));
 const shell=nav.closest('.phoenix-overview-shell');
 let compact=null;
 const group=new Map();
 links.forEach(link=>group.set(link.hash.slice(1),link.dataset.primary||link.closest('[data-primary]')?.dataset.primary));
 const targetFor=id=>{try{return document.getElementById(decodeURIComponent(id.replace(/^#/,'')))}catch{return null}};
 const groupFor=node=>{for(;node;node=node.parentElement){if(group.has(node.id))return group.get(node.id)}return null};
 const openAncestors=target=>{
  for(let node=target.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
 };
 let frame=0,selected=null;
 function paint(){
  frame=0;
  let active=primary[0].hash.slice(1);let closest=-Infinity;
  const line=(compact?nav.getBoundingClientRect().height:0)+140;
  for(const [id,key] of group){
   const node=targetFor(id);
   if(!node?.getClientRects().length)continue;
   const top=node.getBoundingClientRect().top;
   if(top<=line&&top>closest){active=key;closest=top}
  }
  if(selected&&Math.abs(scrollY-selected.top)<4)active=selected.key;
  else selected=null;
  primary.forEach(a=>{if(a.hash==='#'+active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
 }
 function queue(){if(!frame)frame=requestAnimationFrame(paint)}
 function screen(){
  const next=getComputedStyle(summary).display!=='none';
  if(compact!==next){compact=next;menu.open=!compact}
  queue();
 }
 document.body.classList.add('phoenix-sticky-enhanced');
 screen();
 if(shell&&'ResizeObserver' in window)new ResizeObserver(screen).observe(shell);
 links.forEach(link=>link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
  const target=targetFor(link.hash);if(!target)return;
  event.preventDefault();openAncestors(target);
  if(compact)menu.open=false;
  if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
  if(location.hash!==link.hash){try{history.pushState(null,'',link.hash)}catch{location.hash=link.hash}}
  target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});
  selected={key:groupFor(target),top:scrollY};queue();
 }));
 nav.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&compact&&menu.open){event.preventDefault();menu.open=false;summary.focus()}
 });
 const fromHash=()=>{
  const target=targetFor(location.hash);
  if(target){openAncestors(target);selected={key:groupFor(target),top:scrollY};if(!selected.key)selected=null}
  queue();
 };
 addEventListener('scroll',queue,{passive:true});
 addEventListener('resize',screen);
 addEventListener('hashchange',fromHash);
 addEventListener('popstate',fromHash);
 fromHash();
});
</script>'''
    if city == 'phoenix':
        return style, script
    assert city == 'tucson'
    style = style.replace('phoenix', city).replace(
        '.tucson-overview .tucson-overview-shell,.tucson-overview .tucson-overview-layout{display:block;width:100%}',
        '.tucson-overview :is(.tucson-overview-shell,.tucson-overview-layout,.tucson-overview-reading){display:contents}'
    ).replace(
        '.tucson-overview .tucson-overview-reading .wrap,.tucson-overview .tucson-overview-reading .city-wrap{width:100%}',
        '@media screen{.tucson-overview .tucson-overview-reading :is(.wrap,.city-wrap){width:100%}}'
    ).replace(
        '.tucson-page-nav,.tucson-source-choices{display:none!important}',
        '.tucson-page-nav,.tucson-source-choices,.tucson-help-entry{display:none!important}'
    ).replace(
        ' .tucson-page-nav h2{display:none}',
        ' .tucson-overview.tucson-sticky-enhanced .tucson-overview-reading [id]{scroll-margin-top:4rem}\n .tucson-page-nav h2{display:none}'
    ).replace(
        ' .tucson-page-nav>details{max-height:min(60vh,22rem);overflow:auto}',
        ' .tucson-page-nav>details{max-height:min(60vh,22rem);overflow:auto}\n .tucson-overview:not(.tucson-sticky-enhanced) .tucson-page-nav>details{max-height:none}'
    )
    style = style.replace('</style>', '.tucson-help-entry{margin-block:1rem}.tucson-help-entry a{display:inline-flex;align-items:center;min-height:44px;text-decoration:underline;text-underline-offset:.18em}.tucson-help-entry a:focus-visible{outline:3px solid currentColor;outline-offset:2px}</style>')
    style = style.replace('</style>', '''/* The compact summary must show focus even when :focus-visible is unavailable. */
.tucson-overview .tucson-page-nav>details>summary:focus{outline:3px solid #124e52;outline-offset:-3px;background:#e4f2ec;color:#124e52;border-radius:4px}
@media(forced-colors:active){.tucson-overview .tucson-page-nav>details>summary:focus{outline-color:Highlight;background:Canvas;color:CanvasText}}
</style>''')
    script = script.replace('phoenix', city)
    return style, script


def phoenix_page_navigation(output):
    """Consolidate only the Phoenix overview's in-page wayfinding."""
    if 'id="phoenix-page-contents"' in output:
        return re.sub(r'<nav class="city-guide-jump" aria-label="Overview sections">.*?</nav>', '', output, count=1, flags=re.S)
    primary = [
        ('Findings & Updates', 'guide-findings'),
        ('Projects & Housing Results', 'delivery'),
        ('Open Questions', 'questions'),
        ('Sources & Methods', 'sources'),
    ]
    groups = [
        ('Findings and dated updates', 'guide-findings', [('Key findings', 'guide-findings'), ('November 20', 'research-update-2026-11-20'), ('November 19', 'phoenix-research-notes-nov19'), ('November 14', 'research-update-2026-11-14'), ('November 10', 'project-counts-and-shelter-funding'), ('November 9', 'research-update-2026-11-09'), ('Proposed County plan changes', 'maricopa-proposed-plan-amendment')]),
        ('Projects, results, funding and need', 'delivery', [('Project overview', 'guide-projects'), ('Reported results', 'delivery'), ('Projects & plans', 'planned'), ('Funding records', 'funding'), ('Housing need', 'need')]),
        ('Open questions', 'questions', [('Questions at a glance', 'guide-questions'), ('Detailed questions', 'questions')]),
        ('Sources and method', 'sources', [('Source tools', 'guide-sources'), ('Sources and method', 'sources'), ('November 19 source notes', 'phoenix-source-notes-nov19')]),
    ]
    main = ''.join(f'<li><a data-primary="{target}" href="#{target}">{escape(label)}</a></li>' for label, target in primary)
    items = ''.join(f'<li data-primary="{key}"><strong>{escape(label)}</strong><ul>' +
                    ''.join(f'<li><a href="#{target}">{escape(text)}</a></li>' for text, target in links)
                    + '</ul></li>' for label, key, links in groups)
    menu = ('<nav id="phoenix-page-contents" tabindex="-1" class="phoenix-page-nav" aria-label="On this page">'
            '<h2>On this page</h2><details open><summary>On this page</summary><ul class="phoenix-primary-jumps">'
            + main + '</ul><details class="phoenix-more-jumps"><summary>More sections</summary><ul>'
            + items + '</ul></details></details></nav>')
    style, script = overview_navigation_assets("phoenix")
    changes = [
        (r'<nav class="city-guide-jump" aria-label="Overview sections">.*?</nav>', ''),
        (r'<nav class="section-nav" aria-label="Phoenix sections">.*?</nav>', ''),
        (r'<section class="city-learning city-wrap"', '<div class="phoenix-overview-shell"><div class="phoenix-overview-layout">' + menu + '<div class="phoenix-overview-reading"><section class="city-learning city-wrap"'),
        (r'<section class="wrap"><h2>Source-Checked Research Notes · November 19, 2026', '<section class="wrap" id="phoenix-research-notes-nov19"><h2>Source-Checked Research Notes · November 19, 2026'),
        (r'<section class="wrap"><h2>Source Notes · November 19, 2026', '<section class="wrap" id="phoenix-source-notes-nov19"><h2>Source Notes · November 19, 2026'),
        (r'(<section id="sources" class="section"><div class="wrap sources"><div><span class="eyebrow accent">06 / Sources &amp; method</span><h2>Sources and method</h2>)',
         r'\g<1><div class="phoenix-source-choices"><a href="records.html#view-source">Browse original source records</a><a href="#phoenix-overview-method">Read the method on this page</a><a href="#phoenix-page-contents">Back to On this page</a></div>'),
        (r'<p>Each finding above links directly to its official source\.', '<p id="phoenix-overview-method">Each finding above links directly to its official source.'),
        (r'</head>', style + script + '</head>'),
        (r'</main>', '</div></div></div></main>'),
    ]
    for pattern, replacement in changes:
        output, count = re.subn(pattern, replacement, output, flags=re.S)
        if count != 1:
            raise ValueError(f'Phoenix overview navigation expected one match, got {count}: {pattern}')
    return output


def tucson_page_navigation(output):
    """Add an in-page Tucson menu without changing the research or saved URLs."""
    old_nav = r'<nav class="city-guide-jump" aria-label="Overview sections">.*?</nav>'
    if 'id="tucson-page-contents"' in output:
        return re.sub(old_nav, '', output, count=1, flags=re.S)
    primary = [
        ('Findings & Updates', 'guide-findings'),
        ('Projects & Funding', 'guide-projects'),
        ('Open Questions', 'guide-questions'),
        ('Sources & Methods', 'guide-sources'),
    ]
    groups = [
        ('Findings and dated updates', 'guide-findings', [('Key findings', 'guide-findings'), ('Earlier updates', 'latest-updates'), ('Research at a glance', 'dashboard'), ('Correction history', 'correction-history'), ('Historical notes', 'findings')]),
        ('Projects and funding', 'guide-projects', [('Projects and funding', 'guide-projects')]),
        ('Open questions', 'guide-questions', [('Open questions', 'guide-questions'), ('Research priorities', 'research')]),
        ('Sources and methods', 'guide-sources', [('Source tools', 'guide-sources'), ('Public records and primary sources', 'records'), ('Research methodology', 'methodology'), ('Project background', 'about')]),
    ]
    main = ''.join(f'<li><a data-primary="{target}" href="#{target}">{escape(label)}</a></li>' for label, target in primary)
    items = ''.join(f'<li data-primary="{key}"><strong>{escape(label)}</strong><ul>' +
                    ''.join(f'<li><a href="#{target}">{escape(text)}</a></li>' for text, target in links)
                    + '</ul></li>' for label, key, links in groups)
    menu = ('<nav id="tucson-page-contents" tabindex="-1" class="tucson-page-nav" aria-label="On this page">'
            '<h2>On this page</h2><details open><summary>On this page</summary><ul class="tucson-primary-jumps">'
            + main + '</ul><details class="tucson-more-jumps"><summary>More sections</summary><ul>'
            + items + '</ul></details></details></nav>')
    style, script = overview_navigation_assets('tucson')
    help_link = '<nav class="tucson-help-entry city-wrap" aria-label="Housing help"><a href="../housing-help.html">Get Tucson &amp; Pima County housing help</a></nav>'
    source_choices = ('<nav class="tucson-source-choices" aria-label="Source tools"><a href="../evidence.html#sources-section">Browse original source records</a>'
                      '<a href="#methodology">Read the method on this page</a><a href="#tucson-page-contents">Back to On this page</a></nav>')
    changes = [
        (old_nav, ''),
        (r'(<body\b[^>]*class="[^"]*\bcity-tucson\b)', r'\1 tucson-overview'),
        (r'<section class="city-learning city-wrap"', help_link + '<div class="tucson-overview-shell"><div class="tucson-overview-layout">' + menu + '<div class="tucson-overview-reading"><section class="city-learning city-wrap"'),
        (r'(<section id="records"[^>]*>.*?<h2>Public Records and Primary Sources</h2>)', r'\g<1>' + source_choices),
        (r'<head>', '<head>' + style),
        (r'</head>', script + '</head>'),
        (r'</main>', '</div></div></div></main>'),
    ]
    for pattern, replacement in changes:
        output, count = re.subn(pattern, replacement, output, flags=re.S)
        if count != 1:
            raise ValueError(f'Tucson overview navigation expected one match, got {count}: {pattern}')
    return output


def apply(output,path):
    if path not in ['index.html','tucson/index.html','phoenix/index.html','housing-projects.html','phoenix/projects.html','phoenix/projects/moreland.html','phoenix/projects/25th-at-bell.html']:
        return output
    all_data = data()
    if path == 'index.html':
        return homepage(output,path)
    if path in ['tucson/index.html','phoenix/index.html']:
        output = overviews(output,path,all_data)
        return phoenix_page_navigation(output) if path == "phoenix/index.html" else tucson_page_navigation(output)
    if path in ['housing-projects.html','phoenix/projects.html']:
        return project_summaries(output,path,all_data)
    return project_file_intro(output,path,all_data)
