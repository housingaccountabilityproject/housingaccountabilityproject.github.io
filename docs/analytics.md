# Website analytics

GoatCounter measures aggregate visits and referral campaigns starting November 5, 2026. It cannot reconstruct earlier traffic.

Private dashboard: https://housingaccountabilityproject.goatcounter.com/

The owner account uses hap.research.info@gmail.com. Do not commit passwords or API keys. No API key is needed in the public site.

The standard asynchronous GoatCounter script is included once before `</body>` on each public HTML page. The Google verification file is intentionally unchanged. Include the same script on newly added pages:

```html
<script data-goatcounter="https://housingaccountabilityproject.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
```

Dashboard visibility is restricted to logged-in users. Individual pageview exports, browser/system details, screen size, region and language collection are disabled. Aggregate sessions, referrers/campaigns and country-level counts remain enabled. GoatCounter uses no tracking cookies; its documentation describes short-lived visitor deduplication: https://www.goatcounter.com/help/sessions

Campaign links may use `utm_source`, `utm_medium` and `utm_campaign`. Do not put personal information in campaign values. Use the dashboard's Campaigns view to check results; visits blocked by browsers/ad blockers are not counted, so counts are estimates.

Test visits during setup may appear in totals. Avoid repeatedly reloading pages while testing. The owner can exclude their browser using the "disable for this browser" link in GoatCounter Settings. This opt-out is browser-specific.
