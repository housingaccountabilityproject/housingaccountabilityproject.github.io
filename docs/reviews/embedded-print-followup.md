# Private embedded-print investigation — PR #28

The starting website candidate is `afa234a72c08fbce1cae3f857b02d2cd15db4981`, on fixed base `a66cb05d5ed53235087077361ed87697bfd1d95d`. This follow-up changes review generation, tests and documentation only. The website HTML, assets, evidence, IDs, titles, source links and qualifications remain byte-for-byte identical to `afa234a`. No merge or publication is authorized; workbooks, backups and private LA material are outside scope.

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

The user then selected HOME with an empty query and appended `#src-125`: the announcement remained 12 of 67, Showing 1–6. Refresh retained the fragment but announced 67 of 67, Showing 1–6. This is an observed possible defect, not proof of the cause or exact document/frame target. The local delivered `afa234a` ZIP was reverified against all 54 committed-file hashes; its evidence page and scripts match this follow-up's website bytes.

The added fragment suite compares standalone file/HTTP hash changes, fresh loads and refresh, HOME and nonsense-query recovery, repeated links, Back/Forward, focus, live-region text and independent question pagination. A legacy-wrapper control deliberately leaves outer fragments unforwarded; the corrected review forwards them into its active page on both hashchange and initial load. A match to that control does not establish which document the user's address bar targeted. Exact-device fragment recovery and spoken recovery notices remain pending; existing chooser/counter/empty-result spoken passes are not marked untested again.

1. Open the new embedded copy directly in Chromebook Chrome. Choose Tucson Evidence Index, Source Registry page 2, Current/Full; open its report. Save separately using the report button, Ctrl+P while focus is on an outer review control, and Ctrl+P after focusing inside the report. Turn browser Headers and footers off. Verify all six IDs, complete evidence and portable links, with no review controls or clipping. Record the actual focus target and paper/scale settings. Keep native outcomes distinct from the automated A/B.
2. For each method, test Save and Cancel separately, then Return to results: check query, filters, page 2, disclosures, scroll and keyboard focus. A saved PDF cannot prove Cancel or return behavior. Repeat Compact and a Phoenix report, and check complete-index printing/return separately; complete index deliberately clears filters and returns to its own button.
3. Saved output coverage above is retained. Remaining unrecorded method/scope combinations include the three Tucson catalogs, Phoenix connected lists, Phoenix All/Funding, other regional category scopes, broader Tucson search and native Letter/A4 variations. Do not demand all prior output-only tests again as if they never occurred; changes are confined to the wrapper. Native methods that use the new wrapper need the focused retest in steps 1–2.
4. ChromeVox chooser names/positions, separate register counters, independent paging and zero-match announcements passed as reported above on `afa234a`; those website bytes are unchanged here. Still pending: linked-record recovery and its spoken notice, wrapper/frame navigation, selected preview scope/detail speech and print/return focus in the changed wrapper. Automated keyboard, accessibility-tree names, contrast and zoom checks are separate evidence. Old PR ChromeVox passes are not carried forward.
5. The known Phoenix evidence Current/Full Letter sparse final context-links sheet remains a layout limitation. Representative visual inspection is not an exhaustive reading-order audit; normalized text coverage is not whole-PDF text equality. Remote agency URL availability/content has not been freshly re-audited.

Final native status: the old wrapper remains unsuitable for Ctrl+P reports. The new wrapper's actual automated result must be read from its exact-head CI output; a native Chromebook correction is pending until the focused saved exports and return checks above are completed. No merge or publication is authorized by any test pass.
