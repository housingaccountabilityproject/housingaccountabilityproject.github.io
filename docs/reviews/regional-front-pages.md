# Regional newspaper editions: layout candidate

The statewide homepage retains its HAP mark, Arizona landscape, “Public funding. Real homes.” copy, founder link and two arrow buttons. The regional entry links now open newspaper editions. Existing overviews, research records, citations, dates, historical wording and unresolved findings remain at their original URLs.

Design reference: the approved [private regional front pages](https://hap-regional-front-pages-preview.viridlapel3.chatgpt.site), source commit `14c365f3b4bec668597d2f46cddadf32102ba0d8`. Only the newspaper stylesheet and approved Tucson House illustration were carried over. The candidate uses published reporting for every placement.

## Pinned comparison

- Protected main: `ba87383359bdc0ba3de5042533dd7d78f720918d`.
- Live comparison: [GitHub Pages run 43808435634](https://github.com/housingaccountabilityproject/housingaccountabilityproject.github.io/actions/runs/43808435634), successful at that main SHA. The fetched live homepage matched the pinned source byte for byte (SHA-256 `0f8dda18fc4b3a420c6da5b75494ed85444f29420a4d0be8d3100399bd826128`).
- Active “Protect main” ruleset 26964569 requires a PR, an up-to-date branch and `reader-tools`, `phoenix-index` and `smoke`, with no bypass actors. No protection or spending settings are changed.

## Routes and published placements

| View | Tucson & Pima County | Phoenix & Maricopa County |
| --- | --- | --- |
| Newspaper edition | `tucson.html` | `phoenix.html` |
| Lead Story / Keep Reading | `#latest` / `#keep-reading` within the edition | `#latest` / `#keep-reading` within the edition |
| Regional watchlist | `watch-tucson.html` | `watch-phoenix.html` |
| Regional archive | `archive-tucson.html` | `archive-phoenix.html` |
| Research Library | `library.html#tucson` | `library.html#phoenix` |
| Original overview | `tucson/index.html` | `phoenix/index.html` |
| Search | `search.html` | `phoenix/search.html` |

The preview’s leads are replaced with existing published reporting: [Tucson House F-012](../../findings.html#f-012) and [The Moreland project file](../../phoenix/projects/moreland.html), including its planned-phase and financing limitations. Tucson House keeps the approved image’s exact disclosure and alt text. No Phoenix image is added.

Keep Reading links to the existing County funding and Craycroft vote updates in Tucson; Phoenix links to the existing Moreland I financing record and housing-counts update. Watchlists use published questions Q-005, Q-007 and Q-020 in Tucson and question-overview-03, question-overview-04 and question-bell-06 in Phoenix. Selecting a question does not resolve it.

The [baseline inventory](regional-front-pages-inventory.json) records all 33 public HTML routes (including the verification page), 1,048 existing fragments and 218 indexed research records, with original destinations, citations, explicit dates and qualification labels. The indexed categories are:

| Region | Sources | Funding | Questions | Updates | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tucson & Pima | 68 | 12 | 23 | 23 | 126 |
| Phoenix & Maricopa | 59 | 18 | 13 | 2 | 92 |

These are navigation counts, not counts of distinct projects or awards. Tucson’s Sources category includes the explanatory source-excerpts section in addition to 67 source-register rows. Original research data, search indexes, feed, sitemap and research HTML are checked against the pinned baseline hashes. Only the statewide entry-page links change in existing public HTML. A shared screen-only stylesheet correction gives both regional search routes the same centered width and card inset; research and print data are unchanged.

## One entry controls placement

Edit `data/editorial-stories.json`, then run `python scripts/build-regional-editions.py`. Each stable entry references an existing published record and specifies its regional `lead`, `reading`, `watch` or `archive` placement. Headline, summary, limitations and citations are read from that record rather than copied into separate editorial versions. A related-record panel belongs to the lead entry too. Archive indexes also retain the complete published catalog.

The generator rejects unknown records, pending publications, region mismatches and multiple leads. Questions stay out of lead and reading slots. A historical question can move to the archive without changing its unanswered qualification. `check-regional-editions.py` exercises lead replacement and watch-to-archive placement in memory, checks the generated views and confirms deterministic output. No fixture story is written to a public asset.

## Validation and review limits

Local static checks cover original research hashes, old/new destinations and anchors, all seven new views, source-backed excerpts and qualifications, illustration metadata, the statewide hero and deterministic generation. The existing search data, contrast-source, source-crosswalk, category-search and Phoenix generation checks are retained.

The added browser suite covers both editions, watchlists, archives and library at 320, 390, 768 and 1280 pixels; keyboard skip/jump navigation; all four search categories and exact dataset-derived counts; filter choices; matching regional search geometry; overflow; Compact/Full return focus and query/result range. It separately checks all six Phoenix Sources → Moreland records in Full Evidence preview and direct-beforeprint PDFs, including canonical clickable targets. The required existing browser suites remain in place. Actual GitHub results and exact tested SHAs are reported in the PR.

The local headless runner was blocked by the environment’s socket restriction. GitHub browser results must be read from the exact test merge; a local static pass is not a browser pass. Native Chromebook Ctrl+P, the native Print dialog, Cancel → Back restoration and ChromeVox still require a focused check on this candidate. The approved preview’s Chromebook pass remains prior evidence only.

This is a draft layout candidate. No merge or public deployment is authorized. Spending remains $0.
