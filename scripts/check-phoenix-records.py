#!/usr/bin/env python3
"""Check coverage, provenance and destinations of the published Phoenix index."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from lxml import html
import hashlib
import json
import subprocess
import sys
from datetime import date
import re

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'data/phoenix-records.json').read_text())
page = html.parse(str(ROOT / 'phoenix/records.html'))
records = data['records']
sources = {s['id']: s for s in data['sources']}
assert len(sources) == len(data['sources']) == 33
metadata = json.loads((ROOT / 'data/phoenix-source-metadata.json').read_text())
assert set(metadata['sources']) == set(sources), 'Every indexed source needs explicit navigation metadata'
for sid, source in sources.items():
    value = source['metadata']
    assert value == metadata['sources'][sid]
    assert value['agency'] in metadata['agencies']
    assert value['document_type'] in metadata['document_types']
    assert value['programs'] and set(value['programs']) <= set(metadata['programs'])
    assert all(re.fullmatch(r'20\d{2}', year) for year in value['reporting_years'])
    assert value['year_status'] in ['stated', 'unresolved', 'not-established']
    assert bool(value['reporting_years']) == (value['year_status'] == 'stated')
    if value['retrieved_on']:
        date.fromisoformat(value['retrieved_on'])
    assert value['date_basis'] and value['date_basis_url']
# Critical distinctions: no year extraction from file paths, publication or retrieval dates.
assert sources['PHX-CITY-027']['metadata']['reporting_years'] == ['2024', '2025']
assert sources['PHX-LIHTC-001']['metadata']['reporting_years'] == ['2020']
for sid in ['PHX-CITY-013', 'PHX-CITY-003', 'PHX-EXT-PROJECT-210']:
    assert sources[sid]['metadata']['year_status'] == 'unresolved'
    assert sources[sid]['metadata']['reporting_years'] == []
assert sources['PHX-CFP-014']['metadata']['year_status'] == 'not-established'
assert sources['PHX-EXT-PROJECT-209']['metadata']['retrieved_on'] is None
assert len({r['id'] for r in records}) == len(records) == 37
assert sum(r['kind'] == 'question' for r in records) == 10
assert sum(r['kind'] == 'needed' for r in records) == 3
original_ids = set()
for path in data['input_pages']:
    original = html.parse(str(ROOT / path))
    original_ids.update(original.xpath('//article[@id]/@id'))
assert original_ids == {r['id'] for r in records if r['kind'] not in ['question', 'needed']}
assert len(original_ids) == 24
assert {sid for r in records for sid in r['source_ids']} <= set(sources)
original_sources = set()
for path in data['input_pages']:
    original_sources.update(s.removeprefix('source-') for s in html.parse(str(ROOT / path)).xpath('//li[starts-with(@id,"source-")]/@id'))
assert set(sources) == original_sources
for record in records:
    assert record['summary'] and record['limitations'], record['id']
    assert all(sid in sources for sid in record['source_ids'])
    assert page.xpath('//*[@id=$id]', id=record['id']), record['id']
    if record['id'] in original_ids:
        path, fragment = record['page_url'].split('#', 1)
        original = html.parse(str(ROOT / 'phoenix' / path)).xpath('//*[@id=$id]', id=fragment)[0]
        original_links = original.xpath('.//a/@href')
        for citation in record.get('citations', []):
            assert citation['url'] in original_links, (record['id'], citation['url'])
            assert citation['source_ids']
        normalized = lambda element: ' '.join(' '.join(element.itertext()).split())
        for limitation in original.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," caveat ") or contains(concat(" ",normalize-space(@class)," ")," funding-limit ")]'):
            assert normalized(limitation) in record['limitations'], ('lost qualification', record['id'])
for sid in sources:
    assert page.xpath('//*[@id=$id]', id='source-' + sid)
    assert urlsplit(sources[sid]['url']).scheme == 'https'
assert len(page.xpath('//*[@data-kind]')) == 70
assert len(page.xpath('//h1')) == len(page.xpath('//main')) == 1
ids = page.xpath('//@id')
assert len(ids) == len(set(ids))
connections = json.loads((ROOT / 'data/phoenix-connections.json').read_text())
projects = connections['projects']
questions = connections['question_connections']
assert len({p['id'] for p in projects}) == len(projects) == 8
assert sum(p['kind'] == 'development' for p in projects) == 7
assert sum(p['kind'] == 'planning-area' for p in projects) == 1
assert {p['id'] for p in projects if 'PHX-WEB-002' in p['record_ids']} == {'bell', 'pueblo', 'garfield-ii', 'falcon-park', 'harmony'}
record_map = {r['id']: r for r in records}
assert len({q['question_id'] for q in questions}) == len(questions) == 13
assert {q['question_id'] for q in questions} == {r['id'] for r in records if r['kind'] in ['question', 'needed']}
directory = html.parse(str(ROOT / 'phoenix/projects.html'))
matrix = html.parse(str(ROOT / 'phoenix/questions.html'))
for project in projects:
    assert directory.xpath('//*[@id=$id]', id='project-' + project['id'])
    assert all(rid in record_map for rid in project['record_ids'] + project['question_ids'])
    for observation in project['observations']:
        assert observation['record_id'] in project['record_ids']
for question in questions:
    row = matrix.xpath('//*[@id=$id]', id='need-' + question['question_id'])[0]
    assert record_map[question['question_id']]['title'] in row.text_content()
    assert all(rid in record_map for rid in question['record_ids'])
comparisons = connections['comparisons']
assert len({c['id'] for c in comparisons}) == len(comparisons) == 2
comparison_page = html.parse(str(ROOT / 'phoenix/comparisons.html'))
for comparison in comparisons:
    card = comparison_page.xpath('//*[@id=$id]', id='comparison-' + comparison['id'])[0]
    assert len(card.xpath('.//section[@class="comparison-statement"]')) == 2
    for statement in comparison['statements']:
        record = record_map[statement['record_id']]
        assert set(statement['source_ids']) <= set(record['source_ids'])
        assert statement['date_text'] in card.text_content()
        for paragraph in record['summary'] + record['limitations']:
            assert paragraph in card.text_content(), ('lost comparison context', statement['record_id'])
    assert all(record_map[q]['kind'] in ['question', 'needed'] for q in comparison['question_ids'])
for doc_path in sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / 'phoenix').rglob('*.html')):
    doc = html.parse(str(ROOT / doc_path))
    assert len(doc.xpath('//main')) == len(doc.xpath('//h1')) == 1
    all_ids = doc.xpath('//@id')
    assert len(all_ids) == len(set(all_ids)), doc_path
    for href in doc.xpath('//a/@href|//link[@rel="stylesheet"]/@href|//script/@src'):
        url = urlsplit(href)
        if url.scheme or url.netloc:
            continue
        dest = (ROOT / doc_path).parent / unquote(url.path) if url.path else ROOT / doc_path
        if dest.is_dir():
            dest /= 'index.html'
        assert dest.exists(), (doc_path, href)
        if url.fragment:
            assert html.parse(str(dest)).xpath('//*[@id=$id]', id=unquote(url.fragment)), (doc_path, href)
outputs = [ROOT / 'data/phoenix-records.json', ROOT / 'phoenix/records.html', ROOT / 'phoenix/projects.html', ROOT / 'phoenix/questions.html', ROOT / 'phoenix/comparisons.html']
before = [hashlib.sha256(p.read_bytes()).digest() for p in outputs]
subprocess.run([sys.executable, str(ROOT / 'scripts/build-phoenix-records.py')], check=True)
subprocess.run([sys.executable, str(ROOT / 'scripts/build-phoenix-connections.py')], check=True)
assert before == [hashlib.sha256(p.read_bytes()).digest() for p in outputs], 'Index is stale or nondeterministic'
print('PASS: 24 evidence entries, 10 questions, 3 evidence needs, 33 linked source IDs; unique IDs, local destinations and deterministic generation.')
print('PASS: 7 development connections, separate planning area, 13 mapped evidence needs and complete local navigation.')
print('PASS: 2 dated comparisons preserve published statements, limitations, date meanings and source relationships.')
