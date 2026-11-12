# Private embedded-print investigation — PR #28

The starting website candidate is `afa234a72c08fbce1cae3f857b02d2cd15db4981`, on fixed base `a66cb05d5ed53235087077361ed87697bfd1d95d`. The wrapper follow-up through `16b8f17` changed review generation, tests and documentation only. The subsequent announcement refinement changes the shared notice's empty-state CSS and explicit atomic ARIA property; record text, HTML, source links, data and qualifications remain unchanged. No merge or publication is authorized; workbooks, backups and private LA material are outside scope.

## Distinct observations and evidence

The attached original `HAP-Lists-Print-Review.html` is 12,694,895 bytes, SHA-256 `3219fd981b3d932cfa361398d95c9f4731b27bb307d256c1d50d65c0e08b923e`, and embeds older candidate `f8e1ce1461c7eb3b76b7344c436af05227e32a17`. It has a sandboxed srcdoc iframe with `allow-modals`, `height:80vh`, `min-height:650px`, and no outer print stylesheet or beforeprint handler.

Keep these user-reported attempts separate:

| Original f8e1ce1 embedded attempt | Result |
| --- | --- |
| Earlier report | Button did nothing; Ctrl+P saved SRC-065 only; Return retained page 2. Retained as an earlier failure, not substituted for the later result. |
| Later Source Registry page 2, Current/Full, report button | Dialog opened; saved all six expected records and links. Native button-output pass reported by the user on the old wrapper. |
| Later Ctrl+P | Saved outer review controls and SRC-029 only; five records and most links missing. Failed output. |
| Click inside report, then Ctrl+P | Preview did not appear to show the records; no saved PDF verified. Observation only, not a second confirmed PDF failure. |

The six source IDs are SRC-029, SRC-036, SRC-040, SRC-034, SRC-064 and SRC-065, in that order. None of these old-wrapper outcomes is a native pass on the current wrapper. They also do not replace the separate standalone test results.

## Review-only correction and controlled test

`python3 scripts/build-review-preview.py --lists --output PATH` creates a private eleven-page embedded review with an exact source-commit label. Assets are inlined and analytics disabled, as in the prior review. Other contextual pages open their existing canonical public targets. The default organization-review builder remains separate.

The new review runtime prepares the active candidate's report and places a temporary copy directly in the outer document for printing. It copies the candidate's print styles and body classes, excludes the outer review controls, and removes that print copy afterward. It retains the live frame and its filters, pagination, disclosures and focus. The report button requests the same outer printing route. No print request is called from beforeprint, no Ctrl+P key is intercepted, and the candidate's website print implementation is unchanged.

`--legacy-print` is an investigation control only. `test-review-print.mjs` compares the same current candidate in the legacy fixed-frame layout and the corrected wrapper, with focus outside and inside the report. It requires the control to retain outer controls and lose records, and the corrected top-document PDFs to retain all selected records, evidence fragments and clickable targets without local-file actions. It also checks Compact/Full, Letter/A4, both registers, Phoenix, normal-list All/Full behavior, complete-index destinations and focus/return restoration. Control/truncated PDFs stay temporary; only successfully verified corrected PDFs are retained. Required CI jobs and existing assertions remain intact.

This establishes a wrapper-level cause only to the extent demonstrated by those controlled automated results. The original user's exact ChromeOS focus state was not recorded. Native keyboard routing and dialog behavior are separate gates. Do not describe a browser-generated PDF or a spied print call as a native Ctrl+P/Save/Cancel pass.

## Reconciled native evidence

Twenty-two saved Chromebook PDFs from the supplied standalone testing sequence were available for read-only inspection. Their headers identify the scopes below, all records appear in the expected ordered sets, and initial annotation inspection found no local-file targets. Their PDFs do not encode a Git commit, the exact button/keyboard method, Cancel behavior, or spoken output. Content is checked against the preserved `afa234a` baseline; upload timing or a filename alone does not establish exact-candidate or input-method provenance.

| Saved standalone output coverage | Records | Observed page counts |
| --- | --- | --- |
| Tucson complete index | 67 sources + 20 questions, crosswalk and explanatory material | 40 |
| Tucson source page 2: Current Compact / Full | 6 / 6 | 4 / 5 |
| Tucson sources: All Compact / Full | 67 / 67 | 35 / 42 |
| Tucson questions: Current Compact / Full | 6 / 6 | 4 / 5 |
| Tucson questions: All Compact / Full | 20 / 20 | 14 / 17 |
| Phoenix Sources page 2: Current Compact / Full | 6 / 6 | 7 / 9 |
| Phoenix Sources: All Compact / Full | 45 / 45 | 48 / 65 |
| Phoenix Questions: Current Compact / Full | 6 / 6 | 5 / 6 |
| Phoenix Questions: All Compact / Full | 13 / 13 | 9 / 11 |
| Tucson category Sources, Other source records, HUD: All Compact / Full | 10 / 10 | 10 / 22 |

Two Tucson question outputs are repeat artifacts. The Phoenix Current/Full Sources PDF named CTL-P is an additional output artifact; its filename is not independent proof of the input method. These artifact checks must not be described as unperformed native exports, but also must not be extended to unrecorded Save/Cancel/focus or ChromeVox tests. The full private ledger identifies the individual files and verification limits without publishing the original PDFs.

## Remaining device and accessibility checks

### Additional ChromeVox report on afa234a

The user confirmed spoken Records to print options All matches / Current page up to six and Evidence detail Full evidence / Compact, including positions. ChromeVox announced source and question counters separately, paging each independently; changing questions left sources on page 2. A nonsense query announced zero matches for both. These are completed spoken-output checks on the supplied `afa234a` evidence review, retained at that scope.

The earlier nonrecovery report is superseded by the owner's correction: the typed fragment omitted the hyphen (`#src125`). With `#src-125`, standalone recovery and refresh passed on `16b8f17`, and the question register remained on page 1. No valid-fragment website defect is asserted from that attempt. The delivered `afa234a` ZIP was reverified against all 54 committed-file hashes before that investigation.

The fragment suite compares standalone file/HTTP hash changes, fresh loads and refresh, HOME and nonsense-query recovery, repeated links, Back/Forward, focus, live-region text and independent question pagination. A legacy-wrapper control independently demonstrates that unforwarded outer fragments do not reach srcdoc. That wrapper limitation is separate from the owner's mistyped standalone fragment. Corrected-wrapper recovery, refresh, fresh-tab opening and record focus now have native passes on `16b8f17`.

### Native closeout on 16b8f17

The owner explicitly attributes the following Chromebook observations to `16b8f17`. They are user-reported inspected-output/interaction passes, distinct from the 22 independently audited prior PDF artifacts and from CI automation. The machine ledger is `docs/reviews/pr28-native-checks.json`.

| Interaction | Reconciled result |
| --- | --- |
| Standalone HOME → correct `#src-125`, then refresh | PASS: HOME cleared, SRC-125 on page 12; questions stayed on page 1. Earlier missing-hyphen attempt is not a candidate defect. |
| Embedded HOME → `#src-125`, refresh and fresh tab | PASS: subject All Subjects, SRC-125 page 12, record focus confirmed. Specific filter-cleared speech was not heard and is not marked passed. |
| Embedded Tucson Sources page 2, Current/Full | PASS: button, Ctrl+P after clicking outer review area, Ctrl+P after clicking report; all six records and links, no wrapper controls/local-file links/clipping/blank pages. Cancel/Return preserved page 2 and Preview Print Results focus. |
| Embedded Tucson Sources Current/Compact | PASS: inspected PDF. Do not invent separate method or Compact-specific Cancel details; the common return path is already confirmed in Full. |
| Embedded Phoenix Sources page 2, Current/Full | PASS: inspected six-record/link PDF, Cancel/Return page 2 and Preview Print Results focus. Input method was not separately specified; the same wrapper routes already passed in Tucson. |
| Embedded Tucson Complete Index | PASS: 67 sources, 20 questions, expected links, no local-file targets/stale counters/apparent clipping/blank pages. Earlier Cancel/return-focus confirmation retained. Exhaustive table reading order not established. |

Prior native saved-output scopes, ChromeVox chooser/counter/independent-page/zero-result passes and privacy/return checks are retained at their documented scopes. No request to repeat those confirmed checks is implied by this ledger update.

### Filter-cleared speech assessment

On `16b8f17` the empty notice has `role=status` and `aria-live=polite`, but `.list-link-notice:empty { display:none }` removes it from the accessibility tree. In the shared browser it changed from display none/empty to display block/populated while focus moved to the record. This is a concrete exposure risk; it does not prove the cause of the owner's missing speech. Polite notice, counter updates and record-focus speech also occur together, so queued/interrupted output remains a possible factor.

The narrow refinement keeps the empty status region visually hidden with a one-pixel clipped box, rather than removing it, and makes `aria-atomic=true` explicit. Message wording, politeness, timing, linked-row focus, filter/pagination behavior and print output are unchanged. No assertive alert or forced focus on the notice is introduced. The controlled CDP accessibility-tree test compares the old display-none state with the new exposed empty status, then checks the populated status after recovery. W3C ARIA22 recommends establishing the status container before its message and explicitly setting atomic when needed: https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html .

Native ChromeVox audibility of the specific notice remains UNCONFIRMED after this refinement. The only focused repeat requested for this change is HOME → `#src-125`, listening for the clear-filter explanation while record focus remains correct. Functional linked recovery and the confirmed print/Cancel/Return tests stay closed as passes on their tested candidate.

### Genuine remaining coverage limits

- The observed speech gap above remains the accessibility issue requiring one focused device check. A DOM/AX pass is not a speech pass. Refresh/fresh load with no active filters need not announce that filters were cleared.
- Normal-list Ctrl+P without opening a preview uses a distinct All/Full preparation branch; it has automated PDF coverage, but no explicit native method report. The selected Current/Full preview path must not be counted as that branch.
- Category-browser print sheets use a separate implementation. Standalone native category PDFs and automated scopes remain retained; corrected-wrapper category Full/Compact in both regions receive added actual-PDF coverage. Native evidence for that wrapper/category entry point is still unspecified, not a failure. One representative case would cover that distinct interaction; a full repeated regional/mode matrix is not being requested.
- Other unrecorded catalog/paper/method combinations are secondary coverage limits where paths are shared, not automatic demands to redo already confirmed actions. Full PDF logical/table reading order, whole-PDF text equality and remote agency availability/content have not been exhaustively audited.
- The known Phoenix Current/Full Letter sparse final context-links sheet remains a layout limitation. Representative visual inspection does not establish that every page has optimal density.

The old f8e1ce1 wrapper's Ctrl+P failure remains a historical wrapper failure. Corrected-wrapper native source printing is now passed on 16b8f17 at the scopes above. No test pass authorizes marking ready, merging or publishing.
