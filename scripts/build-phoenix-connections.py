#!/usr/bin/env python3
"""Render project and evidence-gap navigation using explicit, reviewed relationships."""
from html import escape
from pathlib import Path
import json
from phoenix_navigation import navigation

ROOT = Path(__file__).resolve().parents[1]


def record_links(ids, records):
    return '<ul class="connection-links">' + ''.join(
        f'<li><a href="records.html#{escape(rid)}">{escape(records[rid]["title"])}</a>'
        f'<span>{escape(rid)}</span></li>' for rid in ids
    ) + '</ul>'


def shell(filename, title, intro, body):
    original = (ROOT / 'phoenix/index.html').read_text()
    header = '<header' + original.split('<header', 1)[1].split('</header>', 1)[0] + '</header>'
    header = header.replace(' aria-current="page"', '').replace('href="#sources"', 'href="index.html#sources"')
    footer = '<footer' + original.split('<footer', 1)[1]
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} | Housing Accountability Project</title>
<meta name="description" content="{escape(intro, quote=True)}">
<link rel="canonical" href="https://housingaccountabilityproject.github.io/phoenix/{filename}">
<link rel="icon" href="../assets/phoenix-review/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/phoenix-review/style.css"><link rel="stylesheet" href="../assets/research-detail.css">
<link rel="stylesheet" href="../assets/phoenix-records.css"><link rel="stylesheet" href="../assets/phoenix-connections.css">
<script src="../assets/phoenix-connections.js" defer></script><link rel="stylesheet" href="../assets/phoenix-reference.css"><script src="../assets/phoenix-reference.js" defer></script></head>
<body id="top" class="research-detail"><a class="skip" href="#main">Skip to content</a>{header}
<main id="main" tabindex="-1"><div class="wrap breadcrumbs"><a href="../index.html">Research areas</a> / <a href="index.html">Phoenix</a> / {escape(title)}</div>
{navigation(filename)}<section class="wrap connections-intro"><span class="eyebrow accent">Phoenix / Connected evidence</span><h1>{escape(title)}</h1><p class="hero-intro">{escape(intro)}</p><p class="connection-snapshot">Published research snapshot: November 8, 2026.</p></section>
{body}</main>{footer}'''


def filters(label, options):
    options_html = ''.join(f'<option value="{escape(key)}">{escape(value)}</option>' for key, value in options)
    return f'''<form class="record-filters connection-filters" role="search" aria-label="{escape(label)}" hidden>
<div class="record-query"><label for="connection-query">Search {escape(label)}</label><input id="connection-query" type="search" autocomplete="off" aria-controls="connection-results" placeholder="Project name, record ID or evidence needed"></div>
<div><label for="connection-filter">Show</label><select id="connection-filter" aria-controls="connection-results"><option value="">All entries</option>{options_html}</select></div>
<button type="reset">Clear filters</button></form>'''


def workspace(controls, cards, count):
    return f'''<section class="wrap connection-workspace" aria-label="Browse connected evidence">{controls}
<noscript><p>All entries are available below. Use your browser’s Find command to search without JavaScript.</p></noscript>
<p id="connection-count" role="status" aria-live="polite" aria-atomic="true">{count} entries</p>
<p id="connection-empty" hidden>No entries match. Try a broader search or clear the filters.</p>
<div id="connection-results">{''.join(cards)}</div><p class="records-download"><a href="../data/phoenix-connections.json" download>Download the project and question relationships (JSON)</a></p></section>'''


def build():
    data = json.loads((ROOT / 'data/phoenix-connections.json').read_text())
    index = json.loads((ROOT / 'data/phoenix-records.json').read_text())
    assert data['research_snapshot'] == index['research_snapshot']
    records = {r['id']: r for r in index['records']}
    assert len({p['id'] for p in data['projects']}) == len(data['projects'])
    mapped = {q['question_id'] for q in data['question_connections']}
    assert len(mapped) == len(data['question_connections'])
    assert mapped == {r['id'] for r in index['records'] if r['kind'] in ['question', 'needed']}
    cards = []
    for project in data['projects']:
        assert all(rid in records for rid in [*project['record_ids'], *project['question_ids']])
        assert all(o['record_id'] in project['record_ids'] for o in project['observations'])
        kind = 'Development' if project['kind'] == 'development' else 'Neighborhood planning area'
        observations = ''.join(
            f'<li><h3>{escape(o["label"])}</h3><p>{escape(o["text"])}</p>'
            f'<a href="records.html#{escape(o["record_id"])}">Read the record · {escape(o["record_id"])}</a></li>'
            for o in project['observations']
        )
        linked = record_links(project['record_ids'], records)
        questions = record_links(project['question_ids'], records)
        if project['question_ids']:
            questions = f'<details><summary>Related published questions</summary>{questions}</details>'
        else:
            questions = '<p class="project-coverage">The publication has no separate project-specific question entry for this development or area. The <a href="questions.html">broader Phoenix questions</a> remain open.</p>'
        search = json.dumps(project, ensure_ascii=False) + ' ' + ' '.join(records[rid]['title'] for rid in project['record_ids'])
        cards.append(f'''<article class="project-directory-card" id="project-{escape(project['id'])}" data-connection-entry data-group="{escape(project['kind'])}" data-search="{escape(search, quote=True)}">
<div class="directory-heading"><span>{kind}</span><a href="#project-{escape(project['id'])}">Direct link</a></div><h2>{escape(project['name'])}</h2><p>{escape(project['description'])}</p>
<ul class="project-observations">{observations}</ul><div class="connection-limit"><strong>Keep in mind</strong><p>{escape(project['limits'])}</p></div>
<details><summary>Connected evidence ({len(project['record_ids'])})</summary>{linked}</details>{questions}
<a class="record-reading" href="{escape(project['detail_url'], quote=True)}">Read the published context <span aria-hidden="true">→</span></a></article>''')
    introduction = 'Follow a development across phases, funding records and reported results. Each observation keeps its own date and evidence status.'
    note = '''<section class="connections-note"><div class="wrap"><h2>One place can appear in several records.</h2><p>Seven developments and one neighborhood planning area are listed here. They are a selected research set, not a complete Phoenix inventory. Phase, inventory, designation and completion figures are not additive.</p></div></section>'''
    controls = filters('Phoenix projects', [('development', 'Developments'), ('planning-area', 'Neighborhood planning areas')])
    (ROOT / 'phoenix/projects.html').write_text(shell('projects.html', 'Projects & phases', introduction, note + workspace(controls, cards, len(cards))))

    cards = []
    for entry in data['question_connections']:
        question = records[entry['question_id']]
        assert question['kind'] in ['question', 'needed']
        assert all(rid in records for rid in entry['record_ids'])
        linked = record_links(entry['record_ids'], records)
        query = json.dumps(entry, ensure_ascii=False) + ' ' + question['title'] + ' ' + ' '.join(question['summary'])
        question_text = ''.join(f'<p>{escape(p)}</p>' for p in question['summary'])
        cards.append(f'''<article class="evidence-question" id="need-{escape(question['id'])}" data-connection-entry data-group="{escape(entry['group'])}" data-search="{escape(query, quote=True)}">
<header class="question-heading"><span>{escape(entry['scope'])}</span><h2>{escape(question['title'])}</h2>{question_text}<a href="records.html#{escape(question['id'])}">Read the published question or evidence need</a><a class="question-permalink" href="#need-{escape(question['id'])}">Direct link</a></header>
<div class="question-evidence"><h3>Evidence needed</h3><p>{escape(entry['evidence_needed'])}</p><details><summary>Relevant published records</summary>{linked}</details></div>
<div class="question-outcome"><h3>What it would clarify</h3><p>{escape(entry['would_clarify'])}</p></div></article>''')
    introduction = 'See the open question, the records needed to investigate it, and what those records could establish.'
    note = '''<section class="connections-note"><div class="wrap"><h2>Research gaps, with a path to better evidence.</h2><p>These are 10 published questions and three Capital Fund evidence needs. This is not a log of submitted or received records requests. The answers remain unverified; missing evidence alone is not a finding of misuse. Each related record retains its own project and program scope.</p></div></section>'''
    controls = filters('Phoenix evidence needs', [('project', 'General project questions'), ('funding', 'General funding questions'), ('bell', '25th @ Bell'), ('capital', 'Public Housing Capital Fund')])
    (ROOT / 'phoenix/questions.html').write_text(shell('questions.html', 'Questions & evidence', introduction, note + workspace(controls, cards, len(cards))))
    print(f'Built connected Phoenix pages: {len(data["projects"])} directory entries and {len(cards)} evidence needs.')


if __name__ == '__main__':
    build()
