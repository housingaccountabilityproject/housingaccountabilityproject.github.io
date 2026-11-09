# Reader tools

## Shared educational layout

Tucson and Phoenix use one layout and theme: a city switcher, the same six main destinations, consistent reading surfaces and four learning paths. Their city-specific content, source dates and search scopes remain distinct. A decorative Arizona landscape now has a clear area of its own on the homepage and both city overviews; text sits on an opaque reading surface. The shorter city openings keep their dates visible and put longer scope notes in a disclosure.

Both overviews follow key findings → projects and funding → open questions → sources. Compact project summaries show place, stage/date, homes and funding, with a visible essential limit. The full project context and original overview research remain available in native disclosures. Saved research anchors open their context, including repeated links. Printing expands these disclosures and restores their prior state. The four evidence-type explainers distinguish approval, financing, spending and delivery without presenting them as a guaranteed sequence.

Both primary searches highlight matching text and explain which fields matched. Phoenix source-filter choices show counts calculated with the query and the other source selections applied. Counts do not change the selected criteria printed in a report. Resetting clears the highlights and criteria without storing or sending search terms.

The Moreland project file reuses published records for its two planned phases and separate financing stages. Phoenix correction history begins as an empty, explicitly labeled log; future corrections require preserved earlier text, corrected text, evidence and a real publication date. Unresolved source differences are not recorded as corrections.

See `docs/site-information-flow.md` for the page/data flow and regeneration commands, and `docs/reader-testing.md` for the participant study protocol. A ready-to-use participant handout and blank observation sheet are in `docs/reader-testing-session.md`. Automated reader-journey checks do not constitute a usability study with unfamiliar readers; no participant study or recruitment has been performed.

The reader, organization, research-center and report browser suites accept `SITE_TEST_BASE_URL=http://127.0.0.1:8770` when local file URLs are restricted. Start `python3 -m http.server 8770 --bind 127.0.0.1` from the repository first, and set `CHROMIUM_PATH` if using a system browser. These suites allow HTTP requests to that server only and block external analytics. Without the base URL they retain local-file testing for CI.

This release contains the six approved reader improvements and the light-panel contrast correction. It is based on main `f69fd33af440c114402f2179f3d18d768a8c9ef3`, including the November 6 County update. Existing research dates, correction history and resident-privacy safeguards are retained.

## Features

- Whole-site search: 15 public content pages, including the complete report, finding and question IDs, source rows and historical corrections. `search.html` itself and the Google verification file are not indexed. Search queries stay in memory; no requests, query URLs, browser storage or analytics events are added by the search feature. Clicking a result is a normal page visit.
- Current status: short known/unanswered summaries in Findings and expandable topic snapshots in Updates. Their November 6, 2026 source-review cutoff is explicit. They do not establish current housing availability or fresh agency actions.
- Evidence: 36 source rows, including the 14 prior rows, SRC-074–094 and the later published County memo. All 15 tracker citations have canonical links. New rows map previously published citations, and are explicitly not described as freshly rechecked sources. Existing historical IDs and aliases are preserved. `data/source-register.json` is the mapping source of record for this addition; source text remains in the HTML.
- Housing help: three official Tucson/Pima County assistance pages, opened November 6, 2026. Providers determine services, availability and requirements.
- Privacy: actual GoatCounter configuration was inspected November 6, 2026. Browser/system, screen size and region collection are enabled, contrary to the older repository note. `privacy.html` and `docs/analytics.md` now agree. No account settings were changed.
- Atom feed: six initial updates with explicit publication/revision timestamps in their HTML. Date-only archive entries and the November 5 funding entry with a November 6 correction of unknown time are excluded, rather than inventing timestamps. The original archive remains complete. No email subscription or capture is introduced.

## Updating generated files

Install the build dependency with `python -m pip install -r requirements-dev.txt`.

After any public content change:

1. Preserve existing IDs and historical correction text.
2. Add a new substantive update to the `feed_ids` list in `scripts/build-reader-data.py` only when its original publication and latest revision have explicit, accurate timezone-bearing `time[datetime]` values. If a later correction has no exact time, do not use the earlier time as the latest revision. The feed list is intentionally curated, not automatic.
3. Run `python scripts/build-reader-data.py`.
4. Run `python scripts/check-reader-data.py` and `node scripts/test-search.cjs`.
   Run `python scripts/check-reader-contrast.py` for the light-panel source and color-pair regression checks.
5. Run the browser tests on a browser-capable machine, inspect desktop/mobile screenshots and print layouts, and review the diff before publishing.

Search assets and feed are deterministic. Running the generator does not advance source dates or publication dates. `check-reader-data.py` intentionally asserts the current approved inventory; update its expected source/feed counts when adding approved records.

## Draft verification history

Passed: 16 public-page local link and anchor checks; unique IDs and main headings; 36 source mappings; all 15 tracker links; valid Atom XML with six exact timestamp-bearing entries; deterministic generation; JavaScript syntax and mocked-DOM interaction tests including phrase/ID/amount searches, categories, pagination, clear, empty/error states and hostile text input. Baseline comparison preserved 243 existing IDs, all recorded timestamps, 73 article texts, both original public data JSON files and the Google verification file.

Not run successfully: browser rendering, desktop/mobile geometry, keyboard behavior in a real browser, browser accessibility audit, and existing browser smoke tests. The installed Chromium could not create its required process socket in the execution environment, including the approved elevated attempt. The available cloud browser rejects local-file URLs. No restriction was bypassed. Static checks are not a visual QA pass.

The three help pages, GoatCounter settings and the official GoatCounter privacy link were opened successfully. External research source documents were not downloaded again during this implementation; source mappings were verified against already published URLs/attributions. No new source-content verification is claimed.

The reviewed reader improvements and contrast correction were approved for publication. Browser results must be reported separately from static checks.

## County carry-forward review
The published County article, homepage card, funding and question sections, source row, publication timestamp and filters are carried forward. Search data and the feed are regenerated, with the County article first in the feed. The prior draft remains preserved. This is a local review copy, not a publication. Browser rendering remains unverified.

## Current-status contrast correction

The Findings current-status panel has a pale background and sits inside the white-text hero. Its missing foreground declaration caused white text on pale green (1.11:1 contrast). The shared light-panel stylesheet now explicitly owns its dark foreground, resets heading and paragraph inheritance, and gives metadata and links their own readable colors. The same protection covers the status panels, reader callouts and search form.

Calculated WCAG 2.x contrast on the panel background is 12.41:1 for body text/headings, 5.84:1 for metadata and 6.65:1 for links. Each exceeds the 4.5:1 AA threshold for normal text. This is a scoped color-pair check, not a claim that the entire site meets WCAG.

Passed: source-contract checks for all six light panels, a negative regression test against the original faulty stylesheet, the existing static/data checks, mocked-DOM search tests, JavaScript syntax and unchanged HTML/research-data comparisons against the County carry-forward commit. The interactive review file is rebuilt from the corrected source with the same content and analytics disabled. It opens on the corrected Findings panel.

The browser suite now includes computed text-color contrast checks at desktop, tablet and phone widths. Execution is still blocked at Chromium startup by the environment's process-socket restriction, before a page is loaded. Those new browser checks, real rendering and keyboard interaction remain unverified. No publishing, pushing or live-site changes were performed.

## Release checks

The release candidate was checked against all 43 blobs in the current main snapshot. All 249 existing IDs, all 41 recorded timestamps and 74 article texts are preserved, apart from the approved added canonical evidence links in the tracker source article. The 36 source-register rows match the Evidence Index URLs and aliases. Both pre-existing public data JSON files and the Google verification file are unchanged. Local link, search, feed, deterministic-build and light-panel color checks pass.

## November 7 research publication

The approved five-part update and targeted current summaries add SRC-095–SRC-107 without repurposing existing IDs. Current inventory: 49 source rows, 20 numbered questions, 12 findings and 15 research-update articles. The source appendix and separate clarification are not counted as updates. Rows can share documents; aliases are not additional rows. Q-001's arithmetic remains resolved; the other 19 numbered questions retain open dependencies.

The current structured catalogs, search index and seven-entry Atom feed are aligned with the approved update. Original dated archive text and prior corrections are retained with follow-up pointers. Older evidence dates are preserved. New timestamps use actual Tucson time for this publication revision, not the dates of source actions.


## November 7 additional-record publication

Adds an independently checked payments/project/outcomes review and a separate preview of the November 10 County and November 12 TPCH discussions. Ten original source rows (SRC-108–SRC-117) extend the current Evidence register to 59 rows. Existing source IDs, 12 findings and 20 numbered questions remain intact. There are 17 research-update articles plus the separate source appendix; the Atom feed has nine explicitly timestamped entries. HOME and County budget final-download limitations are stated on their new source rows; retained original records were inspected.

The homepage keeps three current research stories prominent, separates correction history, links its On This Page list only to local sections, and shortens repeated historical teasers while retaining archive links. Both existing navigation dropdowns are unchanged. Research Center’s dated November 6 inventory is deliberately unchanged in this scoped release.

Static link, ID, inventory, search, feed determinism and eight light-panel contrast checks pass locally. Local Chromium cannot start because its process socket is restricted; browser CI must pass for the exact release commit before merge. The browser suite covers current homepage links, separate correction history, responsive pages, search, keyboard/dropdown navigation and print/report rendering.

## Source namespace and inventory correction (November 7, 2026, 8:26 p.m. MST (Tucson))

The current register contains 59 website source rows, 20 numbered questions and 12 findings. The earlier 36-row and 49-row counts above are dated release snapshots. Website source IDs are a distinct namespace from the private workbooks: same-numbered SRC-074–117 refer to different documents. The public crosswalk covers every website row, maps only verified registered locations, and leaves unmatched documents explicitly unassigned. No private workbook is published. Q-001 is resolved for resource arithmetic only; Q-006 implementation and Q-007 spending reconciliation remain open. Evidence filters now include FY2024 and FY2025. Historical search labels cover the archived journal entries and historical inventory note without marking current source records or the entire first-edition report superseded.


## Two-city navigation and Tucson-only search (November 8, 2026)

The shared homepage now links to a dedicated `/tucson/` landing and the Phoenix overview. Existing flat Tucson pages, report URLs, data and feed remain in place. Fourteen legacy homepage fragments bridge to the corresponding Tucson sections; no-JavaScript fallback links remain available. The generic `#main` anchor stays the shared homepage skip target.

Search remains Tucson/Pima County only: 319 sections from the existing 15-page inventory, with no city field or Phoenix records. `build-reader-data.py` uses an explicit legacy page list and reads the old homepage content from `tucson/index.html`. Search result rendering maps its retained `index.html` URLs to `tucson/index.html`. The generated search index, coverage file and Atom feed retain their previous bytes. New research-area content must not be added to this index without a separately reviewed search design.

The browser regression checks follow the relocated Tucson homepage, and also include the shared homepage and three Phoenix pages. Phoenix source IDs remain separate. Source dates, draft status, financial stages and limitations remain attached to the findings.

## Printing search results

The Tucson/Pima County search and the Phoenix evidence index have a **Print search results** button. The Phoenix project directory and question/evidence matrix also support it. Use **Preview print results** to review a detached report, then print or save a PDF. Returning to results restores the original screen view. The shared print flow retains the latest reference guides, visible filter buttons and verified research-publication timestamp. Browser Print / Ctrl+P / Command+P prepares the same report.

Tucson prints all matches from the submitted search and selected page category, including results beyond the 20 currently displayed. Unsubmitted edits do not relabel the existing results. Historical cautions, full indexed record text and contextual source-page links are preserved; context links are explicitly not presented as verified evidence for every result. Printing does not load additional results onto the screen or change pagination.

Phoenix prints only entries matching the active view, search and filters. Source notes and connected evidence disclosures expand in the report; the original screen disclosures stay unchanged. Both reports include search/filter descriptions, a result count, a preparation timestamp with timezone, and public canonical URLs suitable for paper or PDF references. Research dates remain separate from the preparation timestamp. Empty searches do not print stale results.

`node scripts/test-search-print.mjs` starts a local server and verifies button/browser-print behavior, complete Tucson pagination, category filters, Phoenix record filtering, source locators, historical cautions, disclosure restoration and actual PDF text. It requires Playwright/Chromium and `pdftotext` (Poppler). Sample PDFs are written to `/tmp/hap-search-print/`, or `PRINT_TEST_OUTPUT`. The shared print changes are covered by the Phoenix index CI workflow.
