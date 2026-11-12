# Six-entry record lists and print reports — review candidate

Fixed public baseline: `a66cb05d5ed53235087077361ed87697bfd1d95d` (approved main, November 11, 2026). This batch uses a separate checkout. No Drive workbooks, Space backups, partial research saves or reconciled research imports are inputs. Research publication requires separate review. No website deployment or merge is authorized.

| Page | Applicable list / scope | Baseline count |
| --- | --- | ---: |
| `evidence.html` | Tucson source register | 67 |
| `evidence.html` | Tucson question register; shared filters, independent pages | 20 |
| `questions-records.html` | Tucson question tracker | 20 |
| `funding-explorer.html` | Comparable filterable Tucson funding catalog | 7 |
| `housing-projects.html` | Comparable filterable Tucson project catalog | 5 |
| `phoenix/records.html` | Evidence browser: 32 evidence entries, 10 questions, 3 evidence needs, 45 source references | 90 |
| `phoenix/questions.html` | Connected evidence questions | 13 |
| `phoenix/projects.html` | Comparable project/phase directory | 11 |
| `phoenix/comparisons.html` | Comparable dated-source comparisons | 2 |
| `search.html` | Tucson category search: sources / questions / funding / updates | 68 / 23 / 12 / 23 |
| `phoenix/search.html` | Phoenix category search: sources / questions / funding / updates | 59 / 13 / 18 / 2 |
| `search-all.html` | Broader Tucson indexed text sections across 15 pages | 362 |

The lists with fewer than seven records keep a disabled Previous/Next pair and Page 1 of 1. Narrative sections, source-excerpt explanations, the namespace crosswalk, glossaries and full project files are not paginated. Generated `phoenix/corrections.html` and `phoenix/projects/moreland.html` only pick up the shared controller's asset fingerprint; their narrative and print behavior are not redesigned.

## Why 67 source rows and 68 category-search matches are both correct

The 67 rows are the contents of `evidence.html#sources`. Category search also includes the explanatory `evidence.html#source-excerpts` entry, “Let Readers Check the Evidence.” It is one additional indexed Sources entry, not a missing source-register row or a new document. No evidence was added, removed or reclassified to equalize the counts. Other category/browser totals also describe their own published scopes.

## Behavior

- `assets/list-browser.js` provides six-entry pages, scoped counts, keyboard focus, visible linked-record recovery, and tab-local Back/Forward history without query URLs or local/session storage. Typing coalesces history steps; explicit filters and page moves remain navigable. Ordinary reload starts fresh; explicit shared-search fragments restore their stated search without print consent.
- `assets/evidence-index.js` independently pages source and question rows against the complete matching sets. Their existing shared filters remain shared.
- `assets/search-print.js` provides an explicit list selector where needed, current-page/all-match scope and Compact/Full detail. Detached reports do not change the screen's query, filters, pagination or disclosures. Table rows become labeled evidence blocks; links use canonical public addresses. Compact retains date/source/qualification text, with reduced spacing and less connected-navigation context; Full retains the complete relevant entry including its notes, citations, limitations and connected context.
- Existing regional category-search renderers remain in `assets/category-search.js`. Their default print actions still include all matches. A scope choice additionally permits the current page. The broader Tucson search now shows six sections per page while retaining all-match reports.
- On a normal list, Ctrl+P prepares all matches for the selected list in Full detail, regardless of a current-page chooser. A preview prints exactly its selected scope and detail. These behaviors are explained beside the controls.
- `Print Complete Index` remains separate, explicitly clears Tucson's shared filters and includes both complete registers, the namespace crosswalk and explanatory material. Its after-print handler restores the screen's six-entry pages and prior disclosure states.
- Typed search terms are excluded from report metadata by default and require an explicit checkbox. Consent is not in shared links or history snapshots. Print-preparation timestamps identify America/Phoenix, MST (UTC−7), year-round, separately from unchanged research dates.

## Safeguards and validation

`scripts/fixtures/six-entry-baseline.json` records SHA-256 hashes for 23 public data/download artifacts plus ordered IDs, aliases and content fingerprints for 235 existing register/catalog entries. `scripts/check-list-baseline.py` verifies the unchanged text, dates, links, qualifications, namespaces, downloads and scope difference. No Los Angeles or private material is imported.

`scripts/test-list-browser.mjs` covers all ordered pages, no duplicates/omissions, late/repeated links, aliases, whole-set filters, independent registers, history, reload/privacy, explicit shared links, every print scope/detail, the complete index, PDF record counts and clickable links, keyboard, narrow widths and 200% CSS zoom. Existing regressions are updated only for the intentional six-entry screen limit and history behavior. The reader workflow runs the new checks plus the existing privacy suite.

The required protected-main checks are `reader-tools`, `phoenix-index` and `smoke`. Their actual final-candidate results must be reported separately. Automated browser/PDF checks do not establish native Chromebook dialog behavior or ChromeVox speech output. Repeat native Ctrl+P, button print, Save PDF, Cancel/return/focus and ChromeVox on the final approved candidate before release.
