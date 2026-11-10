#!/usr/bin/env python3
"""Build a Phoenix-only index from published HTML; never fetch or infer research."""
from pathlib import Path
from html import escape
from lxml import html
import json
import re
from urllib.parse import urldefrag
from datetime import date
from city_layout import apply as city_layout
from phoenix_navigation import navigation

ROOT = Path(__file__).resolve().parents[1]
PAGES = ['phoenix/index.html', 'phoenix/capital-fund.html', 'phoenix/projects/25th-at-bell.html']
# Explicit editorial classification. New source articles require a reviewed entry.
META = {
 'MC-HAMC-WEB-001': ('waitlists', 'notice', 'Four Maricopa County property waitlists will close December 1'),
 'PHX-WEB-027': ('delivery', 'difference', 'Phoenix: rehabilitation count needs clarification'),
 'PHX-WEB-028': ('delivery', 'inventory', 'Phoenix Manor preserves 450 existing apartments'),
 'PHX-WEB-029': ('funding', 'financing', 'La Victoria Commons has 104 apartments in two financing portions'),
 'PHX-WEB-030': ('funding', 'authorization', 'Salvation Army family shelter expansion has up to $8 million in HOME-ARP authority'),
 'MC-HOME-WEB-001': ('county', 'competition', 'Maricopa County: HOME funding opportunities'),
 'PHX-WEB-002': ('delivery', 'reported', 'Five reported completed developments'),
 'PHX-WEB-004': ('delivery', 'inventory', 'Harmony at the Park: existing inventory'),
 'PHX-WEB-007': ('projects', 'planned', 'The Moreland: planned phases'),
 'PHX-WEB-020': ('projects', 'planned', 'Girasol: redevelopment and dated progress'),
 'PHX-WEB-009': ('funding', 'financing', 'Moreland I: authorization and reported bond closing'),
 'PHX-WEB-010': ('funding', 'authorization', 'Moreland II: mixed-fund authorization and vouchers'),
 'PHX-WEB-012': ('funding', 'award', 'Marcos de Niza–Grant Park: planning award'),
 'PHX-WEB-026': ('context', 'estimate', 'Phoenix city: median gross rent estimate'),
 'PHX-CFP-WEB-001': ('capital', 'award', 'Capital Fund: HUD-published award amount'),
 'PHX-CFP-WEB-002': ('capital', 'formula', 'Capital Fund: formula-calculation amount'),
 'PHX-CFP-WEB-003': ('capital', 'proposal', 'Capital Fund: draft proposed uses'),
 'PHX-CFP-WEB-004': ('capital', 'expenditure', 'Capital Fund: annual SEFA expenditure'),
 'PHX-CFP-WEB-005': ('capital', 'difference', 'Capital Fund: unexplained published-source difference'),
 'PHX-CFP-WEB-006': ('capital', 'definitions', 'Capital Fund: obligation, draw and expenditure definitions'),
 'PHX-CFP-WEB-007': ('capital', 'reported', 'Maryvale Parkway Terrace: reported 2025 improvements'),
 'BELL-01': ('bell', 'reported', '25th @ Bell: reported completed apartments'),
 'BELL-02': ('bell', 'dataset', '25th @ Bell: one address in two HUD activities'),
 'BELL-11': ('bell', 'identifiers', '25th @ Bell: program and City identifiers'),
 'HOME-dataset-vintage': ('bell', 'difference', 'HOME dataset: conflicting coverage descriptions'),
 'BELL-03': ('bell', 'dataset', '25th @ Bell: City of Phoenix HOME activity'),
 'BELL-04': ('bell', 'dataset', '25th @ Bell: State of Arizona HOME activity'),
 'BELL-05': ('bell', 'reported', '25th @ Bell: draft CAPER set-aside statement'),
 'BELL-06': ('bell', 'authorization', '25th @ Bell: 2020 HOME authorization'),
 'BELL-07': ('bell', 'authorization', '25th @ Bell: 2023 ARPA authorization'),
 'BELL-08': ('bell', 'reported', '25th @ Bell: 2025 ARPA performance statement'),
}
TOPICS = {'waitlists': 'Maricopa County property waitlists', 'county': 'Maricopa County opportunities', 'delivery': 'Reported delivery & inventory', 'projects': 'Projects & plans', 'funding': 'Project funding', 'capital': 'Public Housing Capital Fund', 'bell': '25th @ Bell', 'context': 'Housing need', 'sources': 'Source references'}
KINDS = {'notice': 'Dated waitlist notices', 'competition': 'Competitive funding estimates', 'reported': 'Reported results', 'inventory': 'Existing inventory', 'planned': 'Plans & forecasts', 'financing': 'Reported financing', 'authorization': 'Authorization ceilings', 'award': 'Published awards', 'estimate': 'Survey estimates', 'formula': 'Formula calculations', 'proposal': 'Draft proposals', 'expenditure': 'Annual expenditure', 'difference': 'Unresolved source differences', 'definitions': 'Program definitions', 'dataset': 'Administrative dataset records', 'identifiers': 'Project identifiers', 'question': 'Open questions', 'source': 'Source references', 'needed': 'Evidence still needed'}

def cls(name):
 return f'contains(concat(" ", normalize-space(@class), " "), " {name} ")'

def text(el):
 # A line break must remain a word boundary in exported text.
 return ' '.join(' '.join(el.itertext()).split())

def texts(el, names):
 return [text(x) for x in el.xpath('.//*[' + ' or '.join(cls(n) for n in names) + ']')]

def build():
 records = []
 metadata = json.loads((ROOT / 'data/phoenix-source-metadata.json').read_text())
 sources = {}
 documents = {p: html.parse(str(ROOT / p)) for p in PAGES}
 for path, doc in documents.items():
  for item in doc.xpath('//li[starts-with(@id,"source-")]'):
   sid = item.get('id').removeprefix('source-')
   a = item.xpath('.//a')[0]
   entry = {'id': sid, 'title': text(a), 'url': a.get('href'), 'note': ' '.join(text(x) for x in item.xpath('.//small')), 'page_url': path.removeprefix('phoenix/') + '#' + item.get('id')}
   if sid in sources:
    assert urldefrag(sources[sid]['url'])[0] == urldefrag(entry['url'])[0], ('source URL conflict', sid)
    if entry['note'] not in sources[sid]['note']:
     sources[sid]['note'] += ' | ' + entry['note']
   else:
    sources[sid] = entry
 assert set(metadata['sources']) == set(sources), 'Classify every Phoenix source explicitly'
 for sid, source in sources.items():
  source['metadata'] = metadata['sources'][sid]
 for path, doc in documents.items():
  for article in doc.xpath('//article[@id]'):
   rid = article.get('id')
   assert rid in META, ('Classify new Phoenix article before publication', rid)
   topic, kind, title = META[rid]
   summaries = texts(article, ['record-text'])
   if not summaries:
    summaries = [text(x) for x in article.xpath('.//*[' + cls('definition') + ']')]
   if not summaries:
    summaries = [text(x) for x in article.xpath('./p[not(@class)]')]
   assert summaries, ('missing published summary', rid)
   limitations = texts(article, ['caveat', 'funding-limit'])
   if rid in ['BELL-03', 'BELL-04', 'BELL-05']:
    limitations += ['The City six and State five HOME units may overlap. No unit schedule has been reviewed, and HOME and ARPA designations must not be added as distinct apartments.']
   if rid == 'HOME-dataset-vintage':
    limitations += ['The exact data-refresh date has not been independently established.']
   hrefs = article.xpath('.//a/@href')
   source_ids = [sid for sid, source in sources.items() if urldefrag(source['url'])[0] in [urldefrag(h)[0] for h in hrefs]]
   assert source_ids, ('no source', rid)
   citations = []
   for link in article.xpath('.//a[starts-with(@href,"https://")]'):
    matches = [sid for sid in source_ids if urldefrag(sources[sid]['url'])[0] == urldefrag(link.get('href'))[0]]
    if not matches:
     continue
    notes = link.getparent().xpath('.//small') if link.getparent().tag == 'li' else []
    citations.append({'source_ids': matches, 'title': text(link), 'url': link.get('href'), 'locator': ' '.join(text(n) for n in notes)})
   aliases = sorted(set(re.findall(r'\b(?:PHX-WEB-\d+|PHX-CFP-WEB-\d+|BELL-\d+)\b', ' '.join(texts(article, ['record-id'])))) - {rid})
   records.append({'id': rid, 'aliases': aliases, 'topic': topic, 'kind': kind, 'title': title, 'labels': texts(article, ['label']), 'summary': summaries, 'context': texts(article, ['claim-meta', 'record-stage', 'record-id']), 'limitations': limitations, 'source_ids': source_ids, 'citations': citations, 'page_url': path.removeprefix('phoenix/') + '#' + rid})
  questions = doc.xpath('//article[' + cls('question-item') + ' or ' + cls('unknown') + ']')
  for i, question in enumerate(questions, 1):
   bell = 'projects/' in path
   records.append({'id': f'question-{"bell" if bell else "overview"}-{i:02}', 'aliases': [], 'topic': 'bell' if bell else 'funding' if i >= 3 else 'projects', 'kind': 'question', 'title': text(question.xpath('.//h3')[0]), 'labels': ['Open question · not a finding of misuse'], 'summary': [text(p) for p in question.xpath('.//p')], 'context': [], 'limitations': ['The answer is not established by the repository’s reviewed records.'], 'source_ids': [], 'page_url': path.removeprefix('phoenix/') + ('#unknowns' if bell else '#questions')})
  for i, need in enumerate(doc.xpath('//ul[' + cls('needed-list') + ']/li'), 1):
   hrefs = need.xpath('.//a/@href')
   source_ids = [sid for sid, source in sources.items() if urldefrag(source['url'])[0] in [urldefrag(h)[0] for h in hrefs]]
   records.append({'id': f'capital-evidence-needed-{i:02}', 'aliases': [], 'topic': 'capital', 'kind': 'needed', 'title': text(need.xpath('.//h3')[0]), 'labels': ['Evidence still needed · no submitted-request status asserted'], 'summary': [text(p) for p in need.xpath('.//p')], 'context': [], 'limitations': ['The reviewed evidence does not provide a complete award-to-project spending reconciliation. Unknown draws and project expenditure remain unverified, not zero.'], 'source_ids': source_ids, 'page_url': 'capital-fund.html#records-needed'})
 assert set(META) == {r['id'] for r in records if r['kind'] not in ['question', 'needed']}
 data = {'schema_version': '1.1.0', 'source_filters': {key: metadata[key] for key in ['agencies', 'programs', 'document_types', 'year_policy', 'program_policy']}, 'scope': 'Phoenix and separately labeled Maricopa County navigation extract of published repository HTML; not a ledger or an external source recheck.', 'research_snapshot': '2026-11-10', 'input_pages': PAGES, 'topics': TOPICS, 'kinds': KINDS, 'sources': list(sources.values()), 'records': records}
 (ROOT / 'data/phoenix-records.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
 render(data)
 print(f'Built Phoenix index: {len(META)} evidence entries, {sum(r['kind']=='question' for r in records)} questions, {sum(r['kind']=='needed' for r in records)} evidence needs, {len(sources)} unique source IDs.')

def render(data):
 esc = escape
 cards = []
 connections = json.loads((ROOT / 'data/phoenix-connections.json').read_text())
 source_map = {s['id']: s for s in data['sources']}
 source_records = []
 for source in data['sources']:
  related = [r for r in data['records'] if source['id'] in r['source_ids']]
  source_records.append({'id': 'source-' + source['id'], 'aliases': [source['id']], 'topic': 'sources', 'topics': sorted({r['topic'] for r in related} | {'sources'}), 'kind': 'source', 'title': source['title'], 'labels': ['Published source reference · not rechecked by this index'], 'summary': [f'Linked to {len(related)} indexed entries. Open source notes for the published locators and qualifications.' if related else 'Listed in the Phoenix source notes; no separate indexed finding is attached.'], 'source_note': source['note'], 'metadata': source['metadata'], 'context': [], 'limitations': ['Source IDs identify references, not necessarily distinct documents. Keep the linked findings’ dates and qualifications attached.'], 'source_ids': [source['id']], 'page_url': source['page_url'], 'related': related})
 for r in [*data['records'], *source_records]:
  search_fields = {key: value for key, value in r.items() if key != 'related'}
  search_fields['related_titles'] = [item['title'] for item in r.get('related', [])]
  search = json.dumps(search_fields, ensure_ascii=False)
  sources = ''.join(f'<li><a href="{esc(source_map[s]["url"], quote=True)}">{esc(source_map[s]["title"])}</a><p>{esc(source_map[s]["note"])}</p><a href="{esc(source_map[s]["page_url"], quote=True)}">Read source notes · {esc(s)}</a></li>' for s in r['source_ids'])
  if r.get('citations'):
   sources = ''.join(f'<li><a href="{esc(c["url"], quote=True)}">{esc(c["title"])}</a><p>{esc(c["locator"])}</p><p>{esc(" · ".join(c["source_ids"]))}</p></li>' for c in r['citations'])
  summary = ''.join(f'<p>{esc(p)}</p>' for p in r['summary'])
  limitations = ''.join(f'<p>{esc(p)}</p>' for p in r['limitations'])
  context = ''.join(f'<p>{esc(p)}</p>' for p in r['context'])
  labels = ''.join(f'<span>{esc(p)}</span>' for p in r['labels'])
  details = f'<details><summary>Dates, scope &amp; sources</summary><div class="record-context">{context}</div><ul class="record-sources">{sources}</ul></details>' if sources else ''
  related = ''.join(f'<li><a href="#{esc(item["id"])}">{esc(item["title"])}</a></li>' for item in r.get('related', []))
  if related:
   details += f'<details><summary>Findings using this source</summary><ul class="related-records">{related}</ul></details>'
  group = 'source' if r['kind'] == 'source' else 'question' if r['kind'] in ['question', 'needed'] else 'funding' if r['topic'] in ['capital', 'funding', 'county'] or r['id'] in ['BELL-03', 'BELL-04', 'BELL-06', 'BELL-07', 'BELL-08'] else 'evidence'
  topic_keys = ' '.join(r.get('topics', [r['topic']]))
  project_links = ''.join(f'<li><a href="projects.html#project-{escape(p["id"])}">{escape(p["name"])}</a></li>' for p in connections['projects'] if r['id'] in p['record_ids'] or r['id'] in p['question_ids'])
  connected = f'<div class="record-connections"><strong>Related places</strong><ul>{project_links}</ul></div>' if project_links else ''
  if r['kind'] in ['question', 'needed']:
   connected += f'<p class="record-next"><a href="questions.html#need-{escape(r["id"])}">See the evidence needed to investigate</a></p>'
  for project in connections.get('project_details', []):
   origin_ids = [project['scope_record_id'], *[phase['record_id'] for phase in project['phases']]]
   if r['id'] in origin_ids:
    connected += f'<p class="record-next"><a href="{escape(project["filename"])}">Read the {escape(project["title"])} project file</a></p>'
  for comparison in connections.get('comparisons', []):
   if r['id'] in comparison['record_ids'] or r['id'] in comparison['question_ids']:
    connected += f'<p class="record-next"><a href="comparisons.html#comparison-{escape(comparison["id"])}">Compare the dated source statements</a></p>'
  source_attributes = ''
  source_facts = ''
  if r['kind'] == 'source':
   meta = r['metadata']
   year_keys = ' '.join(meta['reporting_years']) or meta['year_status']
   source_attributes = f'data-source-agency="{esc(meta["agency"])}" data-source-programs="{esc(" ".join(meta["programs"]))}" data-source-format="{esc(meta["document_type"])}" data-source-years="{esc(year_keys)}"'
   years_label = ', '.join(meta['reporting_years']) if meta['reporting_years'] else 'Unresolved year labels' if meta['year_status'] == 'unresolved' else 'Not established / not a reporting period'
   fields = [('Agency / publisher', data['source_filters']['agencies'][meta['agency']]), ('Program / subject', ', '.join(data['source_filters']['programs'][key] for key in meta['programs'])), ('Document type', data['source_filters']['document_types'][meta['document_type']]), ('Reporting / event years', years_label)]
   source_facts = '<dl class="source-metadata">' + ''.join(f'<div><dt>{esc(label)}</dt><dd>{esc(value)}</dd></div>' for label, value in fields) + '</dl>'
   source_facts += f'<p class="source-date-basis">{esc(meta["date_basis"])} <a href="{esc(meta["date_basis_url"], quote=True)}">Read the date context</a></p>'
   if meta['retrieved_on']:
    retrieved = date.fromisoformat(meta['retrieved_on'])
    retrieved_label = f'{retrieved.strftime("%B")} {retrieved.day}, {retrieved.year}'
    source_facts += f'<p class="source-retrieval"><strong>Recorded retrieval:</strong> <time datetime="{esc(meta["retrieved_on"])}">{esc(retrieved_label)}</time></p>'
   else:
    source_facts += '<p class="source-retrieval">A separate retrieval date is not recorded in the published note.</p>'
  cards.append(f'''<article class="record-card" id="{esc(r['id'])}" data-topic="{topic_keys}" data-group="{group}" data-kind="{r['kind']}" data-search="{esc(search, quote=True)}" {source_attributes}>
<div class="record-heading"><span>{esc(TOPICS[r['topic']])}</span><a href="#{esc(r['id'])}" aria-label="Direct link to {esc(r['title'], quote=True)}">{esc(r['id'])}</a></div>
<h2>{esc(r['title'])}</h2><p class="record-type">{esc(KINDS[r['kind']])}</p><div class="record-labels">{labels}</div><div class="record-summary">{summary}</div>{source_facts}
<div class="record-limits">{("<strong>Keep in mind</strong>" + limitations) if limitations else ""}</div>{details}{connected}<a class="record-reading" href="{esc(r['page_url'], quote=True)}">Read in context <span aria-hidden="true">→</span></a></article>''')
 original = (ROOT/'phoenix/index.html').read_text()
 header = '<header' + original.split('<header', 1)[1].split('</header>', 1)[0] + '</header>'
 # Current-page labels belong to the overview, not this new page.
 header = header.replace(' aria-current="page"', '').replace('href="#sources"', 'href="index.html#sources"').replace('href="records.html"', 'href="records.html" aria-current="page"')
 footer = '<footer' + original.split('<footer', 1)[1]
 options = lambda values: ''.join(f'<option value="{key}">{esc(value)}</option>' for key, value in values.items())
 source_options = data['source_filters']
 year_values = sorted({year for source in data['sources'] for year in source['metadata']['reporting_years']}, reverse=True)
 year_options = {year: year for year in year_values}
 year_options.update({'unresolved': 'Unresolved year labels', 'not-established': 'Not established / not a reporting period'})
 source_fields = ''.join(f'<div><label for="source-{key}">{esc(label)}</label><select id="source-{key}" aria-controls="record-results"><option value="">{esc(all_label)}</option>{options(values)}</select></div>' for key, label, all_label, values in [
  ('agency', 'Agency / publisher', 'All agencies / publishers', source_options['agencies']),
  ('program', 'Program / subject', 'All programs / subjects', source_options['programs']),
  ('format', 'Document type', 'All document types', source_options['document_types']),
  ('year', 'Reporting / event year', 'All reporting / event years', year_options)])
 source_controls = f'<fieldset id="source-filters" hidden><legend>Source filters</legend><div class="source-filter-grid">{source_fields}</div><p class="source-filter-help">Years refer to stated coverage, plan or grant periods, or cited events. Publication, file-update and retrieval dates are kept separate. Unresolved periods remain a separate choice. Program tags describe how this research uses the source.</p></fieldset>'
 output = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phoenix evidence browser | Housing Accountability Project</title><meta name="description" content="Explore published Phoenix housing evidence by topic and record type, with dates, source notes and limitations attached.">
<link rel="canonical" href="https://housingaccountabilityproject.github.io/phoenix/records.html"><link rel="icon" href="../assets/phoenix-review/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/phoenix-review/style.css"><link rel="stylesheet" href="../assets/research-detail.css"><link rel="stylesheet" href="../assets/phoenix-records.css"><link rel="stylesheet" href="../assets/search-print.css"><link rel="stylesheet" href="../assets/search-text.css"><script src="../assets/search-text.js" defer></script><script src="../assets/search-print.js" defer></script><script src="../assets/phoenix-records.js" defer></script><link rel="stylesheet" href="../assets/phoenix-reference.css"><script src="../assets/phoenix-reference.js" defer></script></head>
<body id="top" class="research-detail"><a class="skip" href="#main">Skip to content</a>{header}
<main id="main" tabindex="-1"><div class="wrap breadcrumbs"><a href="../index.html">Research areas</a> / <a href="index.html">Phoenix</a> / Evidence browser</div>
{navigation("records.html")}<section class="wrap records-intro"><span class="eyebrow accent">Phoenix / Published evidence index</span><h1>Search Phoenix research</h1><p class="hero-intro">Find funding records, original sources and open questions. Follow each entry back to the evidence and its published explanation.</p><p class="snapshot-note">{len(META)} evidence entries · {len(data['sources'])} source IDs · {sum(r['kind']=='question' for r in data['records'])} questions · {sum(r['kind']=='needed' for r in data['records'])} evidence needs</p><details class="index-method"><summary>About this index · November 10, 2026 snapshot</summary><p>Selected November 9 and November 10 updates are included. Other records keep their original review dates. These are navigation counts from three published pages, not counts of projects, awards or homes. Evidence entries include grouped findings. Different source IDs can reference the same document or separate metadata snapshots.</p><p>This index reorganizes published research; it does not recheck external sources or establish current housing availability. Unknown amounts remain unknown.</p></details></section>
<section class="records-boundary"><div class="wrap"><h2>Read each figure with its date and status.</h2><p>Planned homes, reported completions and existing inventory remain separate. Funding authorizations are not payments.</p></div></section>
<section class="wrap records-workspace" aria-label="Phoenix records">
<span class="city-route-anchor" id="view-source" aria-hidden="true"></span><span class="city-route-anchor" id="view-funding" aria-hidden="true"></span><span class="city-route-anchor" id="view-all" aria-hidden="true"></span><div class="record-views" role="group" aria-label="Choose Phoenix index" hidden><button type="button" data-view="all" aria-pressed="true">All entries</button><button type="button" data-view="funding" aria-pressed="false">Funding</button><button type="button" data-view="source" aria-pressed="false">Sources</button><button type="button" data-view="question" aria-pressed="false">Questions</button></div>
<form id="record-filters" class="record-filters" role="search" aria-label="Filter Phoenix evidence" hidden><div class="record-query"><label for="record-query">Search Phoenix research</label><input id="record-query" type="search" placeholder="Try Moreland, ARPA, FY2025 or a source ID" autocomplete="off" aria-controls="record-results"></div>{source_controls}<div id="record-topic-control"><label for="record-topic">Topic</label><select id="record-topic" aria-controls="record-results"><option value="">All topics</option>{options(TOPICS)}</select></div><div id="record-kind-control"><label for="record-kind">Record type</label><select id="record-kind" aria-controls="record-results"><option value="">All record types</option>{options(KINDS)}</select></div><button type="reset">Clear filters</button></form>
<noscript><p>All entries are available below. Use your browser’s Find command to search without JavaScript.</p></noscript><p id="record-count" role="status" aria-live="polite" aria-atomic="true">{len(data['records']) + len(data['sources'])} published entries · Phoenix only</p><p id="record-empty" hidden>No entries match these filters. Try a broader term or clear the filters.</p><div class="search-print-toolbar"><button type="button" id="print-search-results" hidden>Print search results</button><p>Prints all matching entries with dates, limitations and source notes expanded. Save a PDF from the print dialog.</p></div><div id="record-results" class="record-grid">{''.join(cards)}</div>
<p class="records-download"><a href="../data/phoenix-records.json" download>Download the Phoenix index (JSON)</a> · <a href="index.html#questions">What evidence is still needed?</a></p></section></main>{footer}'''
 (ROOT/'phoenix/records.html').write_text(city_layout(output, 'phoenix/records.html'))

if __name__ == '__main__':
 build()
