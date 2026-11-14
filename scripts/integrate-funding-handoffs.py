"""Integrate two checked, ID-keyed research handoffs without changing source records."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--tucson', type=Path, required=True)
parser.add_argument('--phoenix', type=Path, required=True)
args = parser.parse_args()
ledger_path = ROOT / 'data/funding-browser-periods.json'
ledger = json.loads(ledger_path.read_text())
ledger_rows = {(r['scope'], r['id']): r for r in ledger['records']}
search = json.loads((ROOT / 'data/category-search.json').read_text())['records']
notice = 'https://www.maricopa.gov/DocumentCenter/View/124683/Public-Notice-2025-29-Consolidated-Plan-Substantial-Amendment'

def prose(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get('detail') or value.get('explanation') or value.get('label') or json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return '; '.join(prose(v) for v in value)
    return ''

def evidence(items):
    result = {}
    for e in items:
        url, loc = e['url'], e.get('pinpoint') or e.get('locator')
        assert url.startswith('https://') and loc
        result[url, loc] = {k: v for k, v in {
            'url': url, 'locator': loc, 'basis': e.get('basis', ''),
            'checkedOn': e.get('checked_date', '2026-11-13'),
            'sha256': e.get('sha256') or e.get('source_sha256'),
        }.items() if v}
    return list(result.values())

reconciliation = {'baseline_commit': ledger['baseline_commit'], 'starting_draft_head': '787b9a8ad8a47aee0f7e3224acfaf781bbaee4f2',
                  'regions': {}, 'scope_note': 'Existing categories and records are preserved; no record is added, removed or reclassified.'}
batches = []
for scope, path, expected in [
    ('tucson', args.tucson, 12),
    ('phoenix', args.phoenix, 18),
]:
    handoff = json.loads(path.read_text())
    records = handoff['records']
    ids = [r['id'] for r in records]
    assert len(ids) == len(set(ids)) == expected
    expected_ids = {r['id'] for r in search if r['scope'] == scope and r['category'] == 'funding'}
    assert set(ids) == expected_ids
    batch_id = 'HAP-FUNDING-' + scope.upper() + '-20261113'
    batches.append({'id': batch_id, 'handoff_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'records': expected, 'checked_on': '2026-11-13', 'scope': scope})
    mapped = []
    for r in records:
        row = ledger_rows[scope, r['id']]
        assert row['key'] == r['key']
        parts = []
        for p in r['periods']:
            verified = p['status'] == 'verified'
            matches = []
            if verified:
                is_interval = bool(p.get('start') and p.get('end') and 'calendar' in p.get('filter_year_basis', ''))
                for y in p['filter_years']:
                    matches.append({'year': str(y), 'basis': 'calendar_overlap' if is_interval else 'source_year_label'})
                # Source FY/PY labels remain searchable aliases, never calendar-activity assertions.
                for label in p.get('source_year_labels', []):
                    for y in re.findall(r'(?<!\d)(?:19|20)\d{2}(?!\d)', label):
                        item = {'year': y, 'basis': 'source_year_label', 'label': label}
                        if not any(m['year'] == y and m['basis'] == item['basis'] for m in matches):
                            matches.append(item)
            part = {
                'label': p['label'], 'kind': p['type'], 'status': p['status'],
                'years': sorted({m['year'] for m in matches}), 'yearMatches': matches,
                'sourceYearLabels': p.get('source_year_labels', []),
                'matchingBasis': p['filter_year_basis'], 'evidence': evidence(p.get('evidence', [])),
                'explanation': p.get('basis', p.get('qualification', '')),
            }
            for field in ['start', 'end']:
                if p.get(field):
                    part[field] = p[field]
            if p.get('qualification'):
                part['qualification'] = p['qualification']
            if p.get('next_source_to_check'):
                part['nextSource'] = p['next_source_to_check']
            parts.append(part)
        unknown_component = r['status'] == 'unknown' or bool(r.get('include_in_unknown_filter') or r.get('has_unknown_component'))
        issues = list(dict.fromkeys(prose(i) for i in r.get('issues', r.get('unresolved_issues', [])) if prose(i)))
        unknowns = r.get('unknown_components') or []
        next_sources = list(dict.fromkeys([prose(r.get('next_source_to_check'))] + [p.get('nextSource', '') for p in parts]))
        next_sources = [s for s in next_sources if s]
        current_years = sorted({y for p in parts for y in p['years']})
        label = '; '.join(p['label'] for p in parts if p['status'] == 'verified')
        if r['status'] == 'not_applicable':
            label = 'Not applicable · national guidance'
        elif not current_years:
            label = 'Unknown / not established'
        explanation = ' '.join(dict.fromkeys(filter(None, [prose(r.get('evidence_basis'))] + [p['explanation'] for p in parts])))
        if not explanation:
            explanation = 'See the cited period evidence and retained qualifications.'
        explanation += ' A year match identifies a source year label or coverage of an explicitly dated period; it does not prove an award, payment or expenditure in that calendar year.'
        if unknowns:
            explanation += ' Unresolved component: ' + prose(unknowns)
        period = {
            'label': label, 'kind': parts[0]['kind'] if len(parts) == 1 else 'separate_scoped_periods',
            'status': r['status'], 'years': current_years, 'periods': parts,
            'hasUnknownComponent': unknown_component, 'explanation': explanation,
            'evidence': evidence(r.get('evidence', []) + [e for p in r['periods'] for e in p.get('evidence', [])]),
            'issues': issues, 'nextSources': next_sources,
            'unknownComponents': [prose(x) for x in unknowns] if isinstance(unknowns, list) else [prose(unknowns)],
        }
        row['programPeriod'] = period
        row['review'] = {'status': 'accepted_handoff', 'batch_id': batch_id, 'checked_on': '2026-11-13',
                         'source_basis': 'ID/key/scope reconciled to the evidence-backed regional JSON handoff; period, stage, unknown components and source conflicts retained.',
                         'unresolved': issues + next_sources, 'handoff_status': r['status']}
        # Previous source/event observations remain separate, dated historical context.
        mapped.append({'id': r['id'], 'key': row['key'], 'handoff_status': r['status'],
                       'filter_years': current_years, 'matches_unknown': unknown_component,
                       'broader_search_category': 'funding', 'primary_surface': 'catalog' if scope == 'tucson' and r['id'].startswith('FUND-PUB-') else 'context_section' if scope == 'tucson' else 'funding_tab'})
    reconciliation['regions'][scope] = {'handoff_records': expected, 'broader_funding_search_records': expected,
                                       'primary_funding_records': 7 if scope == 'tucson' else 19,
                                       'context_sections': 5 if scope == 'tucson' else 0,
                                       'missing_ids': [], 'duplicated_ids': [], 'mapped_records': mapped}

# This existing browser entry is outside both research handoffs; check its notice separately.
extra = ledger_rows['phoenix', 'MC-PLAN-WEB-001']
extra['programPeriod'].update(hasUnknownComponent=True, issues=[
    'The notice gives 2025–2029 plan coverage and a three-year projected HOME reduction, but does not identify the three funding years. No funding year is inferred.',
    'The draft-amendment body link previously looped to the document index. The separate notice remains accessible; no adoption or execution is established.'
], nextSources=['The substantive amendment body and adopted Annual Action Plan / HOME Consortium funding schedule identifying the affected funding years.'])
extra['programPeriod']['evidence'][0].update(basis='Official one-page notice checked: plan heading; HOME change paragraphs; ESG goals. Funding years and implementation are not established.', checkedOn='2026-11-13')
extra['review'] = {'status': 'accepted_handoff', 'batch_id': 'HAP-FUNDING-SCOPE-20261113', 'checked_on': '2026-11-13',
                   'source_basis': 'Supplemental check of the official notice for the existing nineteenth browser record; outside the 18-record broader Funding handoff.',
                   'handoff_status': 'unknown', 'unresolved': extra['programPeriod']['issues']}
batches.append({'id': 'HAP-FUNDING-SCOPE-20261113', 'records': 1, 'scope': 'phoenix', 'source_url': notice,
                'pinpoint': 'PDF page 1, plan heading and HOME/ESG proposed changes', 'checked_on': '2026-11-13'})
reconciliation['regions']['phoenix']['additional_browser_record'] = {
    'id': extra['id'], 'key': extra['key'], 'broader_search_category': 'sources', 'primary_surface': 'funding_tab',
    'handoff_coverage': 'Not in the 18 Funding-search records; checked separately without assigning years.',
    'status': 'unknown', 'filter_years': [], 'matches_unknown': True,
    'explanation': extra['programPeriod']['explanation'], 'source_url': notice,
}
reconciliation['matching_rule'] = 'Both regions match supported source FY/PY/vintage year labels OR calendar years overlapping an explicitly dated supported period. Each match retains its basis; no calendar coverage is inferred from a fiscal label alone. Unknown components additionally match Unknown; guidance matches Not applicable only.'
reconciliation['normalization_note'] = 'County FY2027 Q1 matches 2026 for its July–September interval and 2027 for its explicit fiscal label. This preserves the handoff distinction instead of treating 2027 as calendar activity. All other numeric assignments match the handoffs.'
ledger['accepted_batches'] = batches
ledger['review_state'] = 'Thirty ID-reconciled handoff records plus one separately checked existing browser record. Unknowns and not-applicable guidance remain explicit.'
ledger['matching_rule'] = reconciliation['matching_rule']
ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n')
(ROOT / 'docs/reviews/pr30-funding-id-reconciliation.json').write_text(json.dumps(reconciliation, ensure_ascii=False, indent=2) + '\n')
print('Integrated Tucson 12 + Phoenix 18; retained and separately checked Phoenix browser-only MC-PLAN-WEB-001 as unknown. No original records changed.')
