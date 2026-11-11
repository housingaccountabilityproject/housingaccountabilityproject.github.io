# PR #28: portable complete-index printing

Starting candidate: `43c43646e4d5c9bd5dfb6f1a68b7c9d543072f22`.
Verified base: `a66cb05d5ed53235087077361ed87697bfd1d95d`.
Fixed research baseline remains that base: 23 protected data/download hashes and 235 ordered record fingerprints. No workbook, backup, research record or private LA content is part of this change. Keep the PR draft; no merge or publication is authorized.

## Reported evidence and correction

Bill's native Chromebook complete-index export on the starting candidate had 40 pages, all 67 source rows and 20 questions in order, plus the crosswalk, methodology, priority queue and revision history. Headers/footers were off; his visual inspection found no apparent clipping, overlap or blank pages. Whole-PDF text equality was not established because extraction interleaves columns. The PDF had 141 link annotations to 41 unique local targets, and screen counters still said “Showing 1–6.” These are observed defects, not native passes on this changed candidate.

The complete-index action prints the live page rather than the detached report. It now temporarily resolves relative cross-page links against the page's canonical HTTPS address. Existing fragment links remain fragments; relative links to this same evidence page become internal destinations. Existing absolute source links, including historical source addresses, retain their exact attributes. After printing, original link attributes and disclosure states return. The complete-index action retains its documented filter-clearing behavior and returns focus to its own button. Screen-only register counters are hidden by print CSS; the complete-index header states 67 source rows and 20 questions. No research HTML or data is rewritten.

The expanded Phoenix source page-2 Current/Full Letter test additionally found an empty ninth sheet. Detached Phoenix record cards now omit trailing print padding so card decoration cannot consume a final sheet. Evidence still flows normally; no content is hidden or clipped, and the record-ID/title attachment rules remain in place. The final matrix must verify the correction on both paper sizes and all selected records.

## Verification contract

Existing required jobs `reader-tools`, `phoenix-index` and `smoke` remain required. Their assertions are retained. The reader job additionally runs `scripts/test-portable-print.mjs`:

- File and HTTP complete exports, Letter and A4: audit actual PDF URI/file actions, canonical destinations, internal PDF destinations, exact external-link preservation, all 87 DOM rows/cells and normalized register-cell text in order within each of five print columns (excluding repeated column-header wording on both sides); verify crosswalk/methods/priority/revisions, no stale counters or empty pages, screen restoration and focus.
- Tucson source and question page 2 plus Phoenix evidence page 2: Current/All × Compact/Full × Letter/A4, all selected records once in order and retained text-node evidence/qualifications. Existing tests retain the first question page, last pages and ID/title attachment checks including SRC-065, SRC-027 and Q-004.
- Both regions, four category searches, Current/All × Compact/Full: PDF links, record titles, return state/focus; existing category tests cover full evidence, date labels, qualifications and source links.
- Browser accessibility trees: named controls, landmarks, headings and independent Tucson status regions. Existing keyboard, linked-ID recovery, mobile widths, 200% CSS zoom, privacy and contrast tests remain in place.

The new test generates PDFs in a private temporary directory and copies them to the verification artifact only after their link/action and content assertions pass. That artifact is uploaded only on a successful reader job. PDF inspection now includes file actions previously omitted by the URI-only helper. Ordered per-column token coverage is not an assertion of complete PDF text equality or an exhaustive visual audit.

Local static/data checks can run in this session. Local headless Chromium could not start because its process socket was denied; the execution policy rejected an escalated retry. Hosted browser results must be checked on the actual final PR head/test merge; do not claim them from test code alone.

## Native work still required on the final candidate

1. Standalone complete index: turn Chrome Headers and footers off; Save PDF; inspect every link annotation for local/file targets; confirm 67/20 rows in order, crosswalk, methodology, priority queue and revisions, no “Showing 1–6,” no clipping/overlap/blank pages, working internal jumps and HTTPS cross-page targets. Record actual page count; do not require exactly 40 after the correction.
2. Both print methods: report button and Ctrl+P within each selected preview, Current/All × Compact/Full for both Tucson registers and Phoenix lists/category searches. Normal-list Ctrl+P deliberately uses All/Full. Check all six source page-2 IDs in order: SRC-029, SRC-036, SRC-040, SRC-034, SRC-064, SRC-065. Inspect SRC-065, SRC-027 and Q-004 IDs/titles together and their continuing evidence/qualifications. Repeat previous native passes because the candidate changed.
3. For each method, separately Save and Cancel, then Return: check query/filter/page/disclosures, scroll and keyboard focus. Complete index clears filters and returns to its own button; ordinary reports preserve their selected results. Synthetic beforeprint/afterprint or headless PDF rendering does not verify native Save/Cancel.
4. ChromeVox: chooser names/values, both independent counters/pages, empty results, linked-record recovery, preview scope/detail and print/return focus. Browser accessibility-tree checks do not verify spoken output.
5. Embedded-review failure remains open: repeat its Current/Full print button and Ctrl+P, recording wrapper, exact candidate and six selected IDs versus PDF content. A generic iframe or standalone success cannot establish that the wrapper alone caused the earlier no-op button / SRC-065-only PDF.

Private review ZIPs must contain exact candidate assets, a verified commit/hash manifest and this checklist. Do not include the original path-bearing PDFs, private LA material, workbooks or backups. Publication requires Bill's approval after remaining release checks.
