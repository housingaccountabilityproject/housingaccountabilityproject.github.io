# Funding-period framework and research handoffs

PR #30 combines the regional layout and funding-period filter framework. It does
not complete the separately assigned funding-period research.

`data/funding-browser-periods.json` carries forward the existing published
metadata for 30 Funding-search entries and keeps the additional Phoenix
evidence-browser plan-amendment entry unknown. All 31 entries initially have
`review.status: awaiting_handoff`. No new source-verification result is claimed.
The original research datasets and their fixed preservation baseline remain
unchanged. The browser labels the carried-forward metadata as pending review.

## Batch integration

For each evidence-backed handoff, match the existing `key`, `id` and `scope`.
Never merge Tucson/Pima with Phoenix/Maricopa or introduce a record as part of
this update. Preserve record order, amounts, destinations and qualifications.

Update only that record's period annotation and review provenance. Record the
batch ID, source references, exact locators, the period's meaning and any
unresolved evidence. Set `review.status` to `accepted_handoff` only after those
inputs have been checked. Retain `awaiting_handoff` on every untouched record.
Add the batch provenance to `accepted_batches` and rebuild with
`python scripts/build-funding-browser-periods.py`.
Each accepted batch has an `id`. Each accepted record requires that `batch_id`,
a `review.source_basis`, and HTTPS period-evidence references with exact
locators. The builder rejects test records and accepted labels without these
inputs. The semantic test checks that the generated bundle matches this ledger.

Use `programPeriod.fiscalYearLabel` and `programYearLabel` for their literal
meanings. Use explicit `start`/`end` only where the funding, grant or reporting
interval is supported. A fiscal-year label alone does not establish exact
calendar start/end dates. Publication, retrieval, approval and other event
dates belong in `knownDates`, not in the filter's period years.

For a continuous supported interval, list or expand each covered year. For
separate/noncontinuous intervals, use separate `programPeriod.periods` entries.
The framework unions their years and expands each interval independently; it
does not fill gaps between the first and last interval. Different scopes within
one record retain their separate labels and evidence.

If no applicable funding period is established, use no period years and label
the record `Unknown / not established`. National guidance with no applicable
funding period retains the separate `not_applicable` classification.

## Scope and counts

| Surface | Tucson/Pima | Phoenix/Maricopa |
| --- | ---: | ---: |
| Broader Funding search | 12 | 18 |
| Existing paginated catalog / evidence-browser Funding tab | 7 | 19 |

Tucson's additional five Funding-search entries are existing contextual sections
outside its seven-record catalog. They retain their annotations and destinations.
The catalog explicitly states its filter scope and links to the broader Funding
search. The Phoenix plan-amendment entry remains in its existing evidence-browser
Funding group and its existing broader-search Sources category. No category is
silently moved to make the counts match.

## Test data

`scripts/fixtures/funding-period-framework.json` is synthetic test data. Its IDs
start with `TEST-`, each row has `review.status: test_only`, and the fixture page
shows a prominent TEST DATA warning. These entries are never loaded by production
pages, never counted as research records and never treated as accepted handoffs.

Tests cover supported single/multiple years, disjoint periods, unknown periods,
city isolation, filter combinations, clearing, pagination, accessible names and
keyboard controls, sharing and both print modes. Re-run the focused framework
test after a handoff; keep the existing required checks intact.
Update the browser tests' factual expected year/record sets from the checked
handoff when an assignment changes. Keep the independent synthetic range, gap
and unknown assertions intact; a research change is not a reason to relax them.
