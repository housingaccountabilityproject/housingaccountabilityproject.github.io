# General-page portable print links

This helper is limited to About, Glossary, Phoenix overview and Research Updates.
During printing, relative cross-document HAP links resolve against each page's
canonical HTTPS URL. Same-document anchors and external sources stay unchanged.
Original href and temporary label attributes are restored after printing, print
media exit or a pagehide event, including repeated preparation calls.

Phoenix's existing print CSS displays source-link hrefs as text. The companion
print-only rule keeps those labels equal to the original relative URL while the
PDF annotation points to HTTPS. No layout, disclosure, research data, screen
navigation or publication-date changes are involved. Without JavaScript, normal
page printing remains available but local-preview annotation portability is not
guaranteed. Native Chromebook save/cancel and file opening need owner testing.

Private verification requires a separate checkout of the unchanged baseline:

```
HAP_PRINT_BASELINE=/path/to/ec98a19 node scripts/test-general-page-print-links.mjs
node scripts/test-general-print-link-contract.mjs
```

The first test compares local preview and a private canonical-HTTPS equivalent
against the baseline: exact text, word geometry, pagination, every rendered-page
pixel, annotations, fragment destinations, repeated print/cancel contracts,
restoration, filters and keyboard focus. No live site is modified. The second
checks URL/restoration edge cases independently from layout. Research-export
regressions remain in scripts/private-hosted-print.mjs.

An earlier private report attributed an A4 clipping defect to these pages.
Rechecking the immutable evidence and matched main/ec98a19 renderings did not
reproduce clipping: fresh and repeated-cycle page images were identical and the
card fields visibly present. No speculative clipping/layout fix is included.
