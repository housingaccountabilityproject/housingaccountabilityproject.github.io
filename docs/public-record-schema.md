# Public research record and release contract

This document describes a **curated publication extract**, not the research master workbook or accountability audit workbook.

## Required fields
| Field | Purpose |
|---|---|
| public_id | Stable published F-, Q-, SRC-, PROJECT- or RECORD- identifier |
| record_type | finding, question, source, project, records_request |
| title | Plain-language claim or research question |
| program / jurisdiction | Exact program and City/PHA/county coverage |
| period / as_of_date | Reporting period and source-reviewed date |
| measure_type | Planned / allocated / obligated / drawn / expended / completed / occupied etc. |
| amount / units / unit_definition | Typed values with explicit units, or null where not known |
| source_ids / source_pages | Source identifiers and pinpoint locations, verified before public release |
| verification_level | original checked, official summary, source located unreviewed, calculation, or outstanding |
| publication_status | ready, ready with context, open question only, hold, private/excluded |
| limitations | What the available evidence **does not** establish |
| linked_findings / linked_questions | Stable related IDs |
| correction_history | Dated corrections when needed |
| page_url | Existing verified public finding/detail link |

## Control principles
1. Publicly listed IDs must have unique meanings. Don't silently renumber older F-/Q-/SRC-IDs.
2. A requested record is not "received" until a documented response confirms it; a portal submission is not agency approval.
3. Do not conflate plan-year/fiscal-year labels, jurisdiction, restricted balances, financial stages, or distinct unit categories.
4. A missing source is a research gap, not proof of malfeasance. Expenditure arithmetic across different scopes is not a verified shortage.
5. A housing development's allocated PBVs are not confirmed open units, and its reported completion is not a dated vacancy listing.
6. No auto-publication from workbooks. A human-reviewed, sanitized release extract must approve each record before production.
7. All visible public numbers should trace to stable records and preserve a clear "as of" date.
8. Preserve all old publication pages and anchors unless redirects are installed and verified.

9. Resident outcomes are researched through aggregate counts, reporting periods, inclusion rules and denominators. We do not seek resident names, occupied-unit identifiers, tenant rosters or individual case files. Use public or appropriately redacted records and combine or suppress small groups whenever totals or linked information could identify someone. Project and agency identities remain part of public accountability.

## Current preview boundary
The initial JSON contains four already-published research findings only. It is an example of structured data, not a verified financial dataset for the broader region. Its source IDs, where available, are pointers to the site's existing evidence register, and source page details still require review before expanded release.

## QA
- JSON parses without error and IDs are unique.
- Status and verification vocabularies use approved values.
- Sources and linked IDs resolve against existing public pages.
- Test keyboard accessibility, mobile layout, search/filter behavior, direct links, print behavior and contrast.
- Verify Github Pages **actual rendered public URLs** only after a separate, explicit release approval.
