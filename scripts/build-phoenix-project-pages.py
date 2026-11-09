#!/usr/bin/env python3
"""Build project files and correction history from reviewed, existing public evidence."""
from pathlib import Path
from html import escape, unescape
from urllib.parse import urlsplit, urlunsplit
from datetime import date
import json
import posixpath
import re
from city_layout import apply as city_layout
from importlib import import_module

pages = import_module('build-phoenix-connections')
ROOT = Path(__file__).resolve().parents[1]


def rebase(output, filename):
    """The shared shell renders in /phoenix; nested files keep the same targets."""
    target = posixpath.dirname('phoenix/' + filename)
    if target == 'phoenix':
        return output

    def replace(match):
        attr, raw = match.groups()
        url = urlsplit(unescape(raw))
        if url.scheme or url.netloc or raw.startswith(('#', '/')):
            return match.group(0)
        path = posixpath.relpath(posixpath.normpath(posixpath.join('phoenix', url.path)), target)
        return f'{attr}="{escape(urlunsplit((url.scheme, url.netloc, path, url.query, url.fragment)), quote=True)}"'

    return re.sub(r'(href|src)="([^"]*)"', replace, output)


def record_panel(record):
    paragraphs = ''.join(f'<p>{escape(p)}</p>' for p in record['summary'])
    context = ''.join(f'<p>{escape(p)}</p>' for p in record['context'] if not p.startswith(record['id']))
    limits = ''.join(f'<p>{escape(p)}</p>' for p in record['limitations'])
    return f'<div class="project-record" data-origin-record="{escape(record["id"])}"><span class="label">{escape(" · ".join(record["labels"]))}</span>{paragraphs}<div class="claim-meta">{context}</div><div class="connection-limit">{limits}</div><a href="records.html#{escape(record["id"])}">Read the indexed finding · {escape(record["id"])}</a></div>'


def build_project(spec, records, sources):
    scope = records[spec['scope_record_id']]
    record_ids = [scope['id'], *[phase['record_id'] for phase in spec['phases']]]
    assert all(rid in records for rid in record_ids)
    phase_summary = ''.join(f'<a href="#{escape(p["id"])}"><strong>{escape(p["title"])}</strong><span>{escape(p["planned_units"])}</span></a>' for p in spec['phases'])
    phase_sections = ''.join(f'<section id="{escape(p["id"])}" class="project-file-section"><div class="project-file-heading"><span class="eyebrow accent">{escape(p["planned_units"])}</span><h2>{escape(p["title"])}: the funding record</h2><p>{escape(p["scope_note"])}</p></div>{record_panel(records[p["record_id"]])}</section>' for p in spec['phases'])
    timeline = []
    for event in spec['timeline']:
        assert event['source_id'] in records[event['record_id']]['source_ids']
        source = sources[event['source_id']]
        timeline.append(f'<li><p class="event-date">{escape(event["date"])}</p><h3>{escape(event["label"])}</h3><p>{escape(event["text"])}</p><a href="{escape(source["url"], quote=True)}">{escape(source["title"])}</a><p class="event-id">{escape(source["id"])}</p></li>')
    gaps = ''.join(f'<article><h3>{escape(item["title"])}</h3><p>{escape(item["text"])}</p><a href="questions.html#need-{escape(item["question_id"])}">Follow the evidence needed</a></article>' for item in spec['evidence_needed'])
    citations = []
    seen = set()
    for rid in record_ids:
        for citation in records[rid]['citations']:
            key = (citation['url'], citation['locator'])
            if key in seen:
                continue
            seen.add(key)
            citations.append(f'<li><a href="{escape(citation["url"], quote=True)}">{escape(citation["title"])}</a><p>{escape(citation["locator"])}</p><span>{escape(" · ".join(citation["source_ids"]))}</span></li>')
    body = f'''<div class="wrap project-file">
<nav class="project-file-jump" aria-label="Moreland project sections"><a href="#scope">Planned scope</a><a href="#phase-i">Phase I</a><a href="#phase-ii">Phase II</a><a href="#dated-records">Dated records</a><a href="#evidence-needed">Open questions</a><a href="#sources">Sources</a></nav>
<div class="project-print"><button type="button" id="print-project-file" hidden>Print project file / Save PDF</button></div>
<section id="scope" class="project-file-section"><h2>Keep the planned phases separate.</h2><div class="project-phase-summary">{phase_summary}</div>{record_panel(scope)}<div class="connection-limit"><strong>Boundary of this project file</strong><p>{escape(spec['limits'])}</p></div></section>
{phase_sections}<section id="dated-records" class="project-file-section"><h2>Follow the sequence of records.</h2><p>The dates connect the evidence. The amounts are not balances in one calculation.</p><ol class="project-record-timeline">{''.join(timeline)}</ol></section>
<section id="evidence-needed" class="project-file-section"><h2>What evidence is still needed?</h2><div class="project-file-gaps">{gaps}</div></section>
<section id="sources" class="project-file-section"><h2>Check the original sources.</h2><p>These citations come from the existing published findings; assembling this page does not recheck the external documents.</p><ul class="connection-links">{''.join(citations)}</ul><p><a href="corrections.html">Recorded corrections and change history</a> · <a href="projects.html#project-moreland">Back to the project directory</a></p></section></div>'''
    output = pages.shell(spec['filename'], spec['title'], spec['intro'], body)
    output = output.replace('</head>', '<link rel="stylesheet" href="../assets/phoenix-project-file.css"><script src="../assets/phoenix-project-file.js" defer></script></head>')
    (ROOT / 'phoenix' / spec['filename']).write_text(city_layout(rebase(output, spec['filename']), 'phoenix/' + spec['filename']))


def validate_corrections(log, records, sources):
    seen = set()
    for entry in log['entries']:
        required = ['id', 'published_on', 'record_ids', 'previous_statement', 'corrected_statement', 'reason', 'source_ids', 'previous_reference_url']
        assert all(entry.get(field) for field in required), 'A correction requires its date, both statements and evidence'
        assert entry['id'] not in seen
        seen.add(entry['id'])
        date.fromisoformat(entry['published_on'])
        assert set(entry['record_ids']) <= set(records)
        assert set(entry['source_ids']) <= set(sources)
        assert urlsplit(entry['previous_reference_url']).scheme == 'https'


def build_corrections(log, records, sources):
    validate_corrections(log, records, sources)
    entries = []
    for entry in sorted(log['entries'], key=lambda e: (e['published_on'], e['id']), reverse=True):
        citations = ''.join(f'<li><a href="{escape(sources[sid]["url"], quote=True)}">{escape(sources[sid]["title"])}</a> · {escape(sid)}</li>' for sid in entry['source_ids'])
        entries.append(f'<article id="{escape(entry["id"])}" class="correction-entry"><p><time datetime="{escape(entry["published_on"])}">{escape(entry["published_on"])}</time></p><h2>Published correction</h2><h3>Earlier statement</h3><p>{escape(entry["previous_statement"])}</p><h3>Corrected statement</h3><p>{escape(entry["corrected_statement"])}</p><h3>Why it changed</h3><p>{escape(entry["reason"])}</p><a href="{escape(entry["previous_reference_url"], quote=True)}">Read the preserved earlier version</a>{pages.record_links(entry["record_ids"], records)}<ul>{citations}</ul></article>')
    empty = '<section class="correction-empty"><h2>No correction entries are recorded in this log yet.</h2><p>This describes the log, not the verification status of every finding or the absence of earlier edits. Unresolved source differences remain visible in the comparisons and questions.</p></section>'
    body = f'<div class="wrap project-file"><section class="project-file-section"><h2>What belongs in this history?</h2><p>When a supported correction changes a published finding, an entry preserves the earlier statement, the corrected statement, the reason, the evidence and the publication date. A layout improvement or an unexplained source discrepancy is not a correction.</p><p><a href="comparisons.html">Read the unresolved source comparisons</a> · <a href="questions.html">Explore the evidence still needed</a></p></section>{"".join(entries) if entries else empty}</div>'
    output = pages.shell('corrections.html', 'Corrections & change history', 'Follow documented changes to Phoenix findings, with earlier statements and supporting evidence preserved.', body)
    output = output.replace('</head>', '<link rel="stylesheet" href="../assets/phoenix-project-file.css"></head>')
    (ROOT / 'phoenix/corrections.html').write_text(city_layout(output, 'phoenix/corrections.html'))


def build():
    index = json.loads((ROOT / 'data/phoenix-records.json').read_text())
    connections = json.loads((ROOT / 'data/phoenix-connections.json').read_text())
    records = {r['id']: r for r in index['records']}
    sources = {s['id']: s for s in index['sources']}
    for spec in connections['project_details']:
        build_project(spec, records, sources)
    log = json.loads((ROOT / 'data/phoenix-corrections.json').read_text())
    build_corrections(log, records, sources)
    print(f'Built {len(connections["project_details"])} project file and a history with {len(log["entries"])} documented corrections.')


if __name__ == '__main__':
    build()
