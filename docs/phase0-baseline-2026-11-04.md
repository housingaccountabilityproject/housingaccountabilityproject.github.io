# Phase 0 — Baseline, evidence and publication controls
Date: 2026-11-04
Repository: housingaccountabilityproject/housingaccountabilityproject.github.io
Working branch: research-center-phase0-phase1-2026-11-04
Baseline default-branch commit: 0cf96ee854dbfc791b578ae3021900697650b5c5

## Safety and scope
- The default branch remains the live version; this branch is a non-live development candidate.
- Preserve all existing research pages, evidence IDs, anchored findings, historical notes, contact disclosures, and branding.
- Master workbook (v13.3, 2026-11-03) and separate accountability audit workbook (v2.4, 2026-11-03) remain private and unchanged. Some internal sheets retain individual case context and are not publishable without review.
- Never auto-export the workbooks to this repository. Public source rows are a curated subset, not full counts from private workbooks.
- The November 2 publication-readiness register distinguishes "ready with context", "open question only" and "hold." Later updates may supersede statuses and need source-by-source reconciliation before publication.
- The existing website displays 12 finding entries, 11 public questions, and 13 indexed source entries as a dated November 3 snapshot, **not** counts of all available evidence.
- No records-request state is upgraded from prepared/submitted to acknowledged/answered without documentary evidence.
- Preserve the distinction between reported financing, planned expenditure, actual draw, completed apartment, occupied apartment, and confirmed application availability.

## Phase 1 branch deliverables
- `research-center.html`: a standalone, accessible, searchable, filterable 4-record introductory research presentation using claims already published.
- Existing site: new Research Center navigation links, homepage CTA and jump link; old 2026 research-note section retained and labeled as historical.
- `data/public-research-preview.json`: four curated source-linked public candidate entries. **Preview dataset only; not a current financial ledger.**
- `docs/public-record-schema.md`: record model, publication gates, ID crosswalk and correction controls.
- `sitemap.xml`: candidate Research Center URL; effective only if/when merged into the live site.

## Verified initial crosswalk
| Public record | Site finding | Evidence question | Description / boundary |
|---|---|---|---|
| F-001 | findings.html#f-001 | evidence.html#q-006 | Reported Oct. 2026 $1.5m CDBG reallocation; not new money or verified draws |
| F-003 | findings.html#f-003 | evidence.html#q-009 | 82 PBV allocations; not available vacancies |
| F-005 | findings.html#f-005 | evidence.html#questions-section | PY2025 draft CAPER; final HUD version unverified |
| F-007 | findings.html#f-007 | evidence.html#q-007 | $944,972.60 cross-presentation arithmetic; not a verified financial discrepancy |

## Required release checks
- Search/filters are keyboard-operable, count feedback updates, and hidden results stay hidden under simultaneous keyword and topic filters.
- Every local page and anchor link resolves in the proposed branch; no duplicate IDs, unexpected external scripts, or viewport overflow on narrow screens.
- Every published quantitative entry has a period, jurisdiction, accounting measure, cited source and explicit limitation.
- Original reported facts, editorial interpretation, provisional workbook-only values, and unresolved questions are not presented as interchangeable.
- Every publication change has a dated change log, specific commit, and rollback possibility.
- Live public URL and deployed page must be checked *after* an approved merge. A successful GitHub commit alone is not proof the published browser view is correct.
- No raw workbook, case records, health details, personal identifiers, or email threads are included in the public site.

## Release decision
Development baseline only. **Do not merge to main until the user reviews the draft, source/claim integrity and privacy checks pass, and the public deployment can be tested.**
