# Phoenix evidence analysis and website integration

## Scope and provenance

This review covers all three Phoenix research pages in the repository: the overview, Capital Fund explainer, and 25th @ Bell project file. It analyzes the published HTML and its source references. It does not inspect internal workbooks, download the external documents again, verify current conditions, or advance the November 8, 2026 research snapshot.

The published material has 24 evidence entries, including grouped findings, 10 open questions, three Capital Fund evidence needs and 33 unique Phoenix source IDs. The overview's grouped entries also carry PHX-WEB-001 and PHX-WEB-022. These are navigation counts, not a count of distinct research claims, documents, projects, awards or homes. Source IDs can describe different snapshots or uses of the same document.

## What the evidence supports

| Evidence group | Published observations | Website treatment and boundary |
| --- | --- | --- |
| Reported delivery | Five developments: Bell 53, Pueblo 161, Garfield II 60, Falcon Park 192, Harmony III 90; subtotal 556 apartments in the draft FY2025–26 CAPER | Keep the draft status and period with the subtotal. This is a selected project set, not all Phoenix production, verified occupancy or HUD acceptance. The reported 49 HOME-designated units are a subset designation, not extra apartments. |
| Existing inventory | Harmony phases I/II/III: 120/115/90 apartments; 325 total in the May 2026 directory | Keep inventory separate from reported completions. Harmony III's 90 appears in both contexts and must not be counted twice. |
| Plans and forecasts | Moreland I/II: 132/105 planned apartments, 237 combined. Girasol: 364 planned gross apartments, 289 affordable and 75 market-rate; dated construction percentages and move-in forecasts | Keep phases and forecast dates visible. Girasol is redevelopment of existing capacity; gross planned units are not net additions. Do not treat construction percentages as delivered apartments. |
| Project financing | Moreland I: up to $50m approved, $43.1m financing reportedly closed. Moreland II: up to $10m mixed-fund authorization and up to 54 PBVs. Marcos de Niza–Grant Park: $500,000 planning award | Show financial stage, not a spending leaderboard. Do not add approval and closing amounts, classify all mixed funding as HOME, count vouchers as executed contracts, or treat a planning award as construction delivery. |
| Capital Fund | Published award $2,842,753; separate formula $2,813,904; City draft proposed uses $2,713,865; FY2025 SEFA expenditure $7,218,862 | Keep four measures and their periods separate. The $28,849 award/formula difference is arithmetic, not a verified transaction, loss or award revision. Source-year labels in the City drafts remain unresolved. SEFA accounting and HUD grant-reporting expenditure definitions differ. |
| Bell project and HOME activities | One physical development, 53 apartments. City activity 4938 / grantee 10659: six HOME units and $1m funding field. Arizona activity 7160 / grantee 136: five HOME units and $1,082,181.40 funding field | Link by project/address but retain grantee and activity IDs. Two activity records do not mean 106 apartments. Six plus five does not establish disjoint unit schedules. Funding fields are not independently verified payments or total development cost. Administrative completion dates are not occupancy dates. |
| Bell dated ARPA records | 2023 authorization: up to $896,564, 11 units at or below 65% AMI, at least 20 years. 2025 report: same allocation, 16 units at or below 40% AMI | Keep both records dated. An executed amendment is unverified; do not transfer the earlier term to the later unit/AMI statement or infer a restriction expiry. ARPA is not HOME-ARP. |
| Dataset and identifiers | HUD HOME item/layer/Data.gov descriptions give September 2026, December 2025 and June 2026 coverage. Bell LIHTC and City identifiers are published | Preserve the vintage conflict. Retrieval and embedded file-modification dates do not prove dataset refresh or edition dates. Program identifiers are not parcel IDs, ownership evidence or restriction dates. |
| Housing need | Phoenix city 2025 ACS median gross monthly rent $1,733, 90% margin of error ±$36 | Preserve geography, survey period, universe and uncertainty. This is not today's asking rent, a metro statistic or evidence of project-specific affordability. |

## How information should connect

The useful chain is **physical project → dated evidence → funding activity or reporting measure → source and locator → unresolved question**. A funding activity, designation, development phase and physical project need separate identities. A project map or total alone would hide these distinctions.

The most useful immediate addition is a searchable Phoenix index with separate entry views for funding, sources and questions. Record-type filters let readers distinguish authorization ceilings, administrative dataset fields, plans, reported delivery, expenditure and source discrepancies. Full limitations remain visible; dates, scope and source locators are available in disclosures and in the existing narrative context. Source entries link back to the findings using them.

The new browser is generated from the published pages, with explicit editorial classification of each evidence entry. It adds navigation rather than a new research layer. The published pages remain the content source of truth. Its JSON export contains text and identifiers; it deliberately avoids promoting dollar amounts or units into summable fields before a reviewed typed financial/project model exists. Phoenix search remains separate from the Tucson search index and feed.

## Research gaps and useful next evidence

The Capital Fund page also identifies three evidence needs: approved grant budgets/plans, grant-level performance or LOCCS reports, and a grant-to-project/City-year reconciliation. These appear alongside questions, with no claim that a request was submitted or received.

The 10 published questions overlap across the overview and Bell detail. They should stay distinct in the index because each has a different scope and destination. They cover six main themes:

1. **Unit-designation overlap:** reviewed, appropriately redacted schedules are needed before combining City/State HOME and ARPA designations. Do not publish resident names, occupied-unit identifiers or tenant rosters.
2. **Restriction terms:** executed agreements, amendments and verified start dates are needed before displaying expiry dates.
3. **Actual payments and cost:** disbursement and grant/activity records, a financing stack and a reconciliation to City fiscal years are needed before calculating spending or cost per apartment.
4. **Conflicting records:** an executed Bell amendment or explanatory transaction record is needed to resolve the ARPA and Capital Fund differences; metadata update dates alone do not resolve them.
5. **Ownership and property identity:** deed and parcel/legal-description evidence is needed before asserting current ownership. Existing project/program keys are insufficient.
6. **Occupancy and delivery:** dated occupancy or completion evidence is needed to move beyond a draft performance-report statement. This is not a vacancy listing.

## Later website improvements

| Priority | Improvement | Prerequisite |
| --- | --- | --- |
| Implemented locally | Project directory connecting Moreland, Harmony, Girasol and the five reported completed developments to existing evidence | Seven development entries and a separate planning area; no automatic summing across overlapping categories |
| Implemented locally | Question-to-evidence matrix showing the records needed and the relevant project/program | All 10 questions and three Capital Fund evidence needs; no submitted/received request status asserted |
| Implemented locally | Dated comparison panels for Bell ARPA set-asides and Capital Fund source discrepancies | Both statements, date types, original sources and limitations remain visible; the differences remain unresolved |
| After typed-data review | Funding-stage and grant-to-project explorer | Separate amount, currency, period, grantee, program, financial stage and verification; missing values remain null |
| After location review | Project map | Verified project locations and scope; no resident data or implied current availability |

Avoid a citywide spending total, cost-per-unit rankings, a cross-city scoreboard, a projected restriction-expiry calendar or a pipeline conversion chart until comparable definitions and underlying evidence support them.

## Maintenance

Run `python scripts/build-phoenix-records.py` with the development environment's Python after editing a Phoenix source page. The script requires an explicit classification for new evidence articles. Review the generated JSON and HTML together. Preserve all existing record IDs and source links. Changing the research snapshot requires research review, not a generator run.

Project and question relationships are explicitly curated in `data/phoenix-connections.json`. Its project slugs are directory navigation identifiers, not new research finding IDs. Each observation links to an existing evidence record. All 13 published questions/evidence needs must have a matrix entry. Program-wide Capital Fund records are not assigned to a development without evidence of that relationship.

After changing a source page or relationship, run `python scripts/build-phoenix-records.py` followed by `python scripts/build-phoenix-connections.py`. This regenerates the index's links to related places and the `phoenix/projects.html` and `phoenix/questions.html` pages. The original overview, Capital Fund and Bell pages remain the research content source of truth. Shared Phoenix tools navigation connects all seven pages. The two new pages are navigation summaries and research directions, not new external verification.

The page works without JavaScript: all entries, source links and disclosures remain available. JavaScript only filters the pre-rendered index, announces counts and reveals directly linked entries. Search terms stay in memory and do not create network requests, browser storage or query URLs.

The evidence index, directory and question matrix also prepare printable results through `assets/search-print.js`, shared with Tucson search. Reports preserve the active search scope, expand source/evidence disclosures in detached copies, and retain the original on-screen filter and disclosure state. Public canonical references remain usable in saved PDFs. See `docs/reader-tools.md` for the workflow and print/PDF verification command.

Run `python scripts/check-phoenix-records.py` for coverage, source provenance, preserved qualifications, link destinations and deterministic output. Run `node scripts/test-phoenix-index.mjs` for HTTP browser tests; it starts and stops its own local server. Set `CHROMIUM_PATH` if using a system Chromium. The browser tests exercise source-ID lookup, reverse links, funding-stage and question filters, no-match/reset states, hostile text input, direct links, keyboard entry, local-only filtering, four viewport widths, 200% zoom and the no-JavaScript fallback. The Phoenix-specific CI workflow runs both checks on relevant pull requests.

## Dated source comparisons

`phoenix/comparisons.html` presents Bell’s adopted 2023 ARPA authorization beside its 2025 recovery-report statement, and the Capital Fund formula workbook beside the current master ACC schedule. Both panels reuse the indexed source statements, qualifications and exact citation links. An action date, report year, formula effective date and file-update label are explicitly different kinds of dates. No new research date or reconciliation is asserted.

Comparison relationships and editorial explanations live in `data/phoenix-connections.json` and are generated by `scripts/build-phoenix-connections.py`. Related findings and questions link to the relevant comparison. Existing claim IDs, amounts and source snapshots remain unchanged. The comparison page supports local search, scope filtering, direct links, no-JavaScript reading and printable filtered results.
