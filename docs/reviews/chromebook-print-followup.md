# Private Chromebook print follow-up — PR #28

Verified starting head: `f8e1ce1461c7eb3b76b7344c436af05227e32a17`.
Verified base: `a66cb05d5ed53235087077361ed87697bfd1d95d`.
Both matched the reviewed candidate before editing. This remains a draft; no merge or publication is authorized. LA, workbooks and backups are outside this change.

## Change and limits

Detached Tucson table-row reports now group the record identifier, ID cell and title cell in a small print lead with `break-inside: avoid`. Remaining evidence can flow across pages. No fixed heights, clipping, line clamps or whole-record unbreakable boxes are introduced. Browser pagination constraints are best effort, particularly if a lead ever exceeds a paper page.

Automation now retains the existing last-page tests and adds six-record source page 2 and six-record question page 1, Compact and Full on Letter and A4, with browser headers/footers disabled. It checks order, counts, text, canonical links, identifier/title attachment and Return state. All-register PDFs also check each ID/title pair, including SRC-027 and Q-004. These checks do not establish native Chrome dialog behavior.

Visual review of generated Letter PDFs covered SRC-065 in Current/Compact and Current/Full, SRC-027 in All sources/Compact, and Q-004 in Current/Compact, with adjacent pages. IDs and titles stay together. Long evidence still flows; Full SRC-065 continues its source link onto the next sheet. This is allowed and preserves the complete record. Added spacing at page bottoms is preferable to separating the identifier and title.

## Bill's evidence on the starting candidate

- Tucson shared HUD search: 19 sources and eight questions; independent paging, no-match messages and clearing worked.
- Phoenix Evidence Browser: six entries; category changes reset the list and Next showed 7–12 in Questions, Sources, Funding and All Entries.
- Embedded Tucson Current/Full: the button did nothing, and Ctrl+P produced only SRC-065. Return preserved page 2. This is a failed embedded print test; the wrapper being the sole cause is unproven.
- Direct standalone Tucson source Current/Full: button and Ctrl+P opened dialogs and produced PDFs with SRC-029, SRC-036, SRC-040, SRC-034, SRC-064 and SRC-065 once each, in order, with candidate text and expected links. Cancel and Return preserved page 2.
- Standalone source Current/Compact, All sources/Compact, question Current/Compact and All questions/Compact retained expected records and links. Content was complete; SRC-065, SRC-027 and Q-004 illustrated stranded IDs.

Those observations belong to the starting candidate. They are not native passes on the changed candidate. Original PDFs with local-path footers remain private and are not included in the review package.

## Short Chromebook checklist — changed candidate

1. Open the extracted standalone `evidence.html` directly. Resume the paused **Print Complete Index / Save as PDF** test under **On this page → Methods and Revision History**, below Priority Completion Queue and immediately before Revision Register. This action clears filters. Check both complete registers, source-ID crosswalk, methods, revision material, links, complete text and page breaks. Confirm Cancel/return and the resulting filter/page state; do not assume ordinary preview restoration rules apply to this separate action.
2. In Chrome's print dialog, turn **Headers and footers off** before saving a shareable PDF. Verify the saved copy has no local path. The site cannot change this browser setting automatically.
3. On source page 2, retest Current/Full with the button and Ctrl+P inside its preview. Expect SRC-029, SRC-036, SRC-040, SRC-034, SRC-064 and SRC-065 once each, in order. Retest Current/Compact. Check title/ID attachment, all evidence text, source links, Save, Cancel, Return, page 2 and keyboard focus.
4. Retest All sources/Compact, question Current/Compact and All questions/Compact, especially SRC-027 and Q-004. Test the remaining native source/question All/Full and question Current/Full scopes. A normal-list Ctrl+P uses all matches/Full for the selected list; a preview uses its selected scope/detail.
5. Recheck the embedded Current/Full button and Ctrl+P failure separately, recording the exact selected records and output. A standalone pass does not close this issue. Check Phoenix and every other applicable list's Current/All × Compact/Full exports, native dialog/Save/Cancel/return/focus, and normal-list versus preview Ctrl+P. These untested native scopes remain pending.
6. Run ChromeVox: chooser labels, independent pagination announcements, empty results, selected report scope, print/return focus, and linked-record recovery. Automated keyboard and DOM checks are not spoken-output passes.

The native complete-index Save test, all other untested native scopes, embedded failure and ChromeVox remain open. Repeat the previously successful native scopes because the print layout changed. Release awaits the owner's decision.
