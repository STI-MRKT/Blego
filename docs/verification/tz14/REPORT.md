# BLEGO TZ14 — 12 requested hotfixes (QA candidate)

Source branch: `codex/blego-tz14-hotfix-20261117`, based on verified BLEGO 1.4.5 / PR #18 `e333e372`. PR #20 is draft; no merging or official release.

## Affected UI only
- FP/BIO generator switcher has 18px gap.
- BIO cards and main textarea compact and auto-save as before.
- University/school picker rows removed; copy/regenerate retained.
- Embedded BIO history and explanatory synthetic placeholder removed from UI, not data.
- Friends copy bar separated from grid; expandable details styled as compact button.
- Archive filter/sorting form and archive count removed; filename search remains.
- Advanced Settings hidden; optional finite repeats always enabled, contact identities remain unique.

## Generator
- `Crypto` now uses distinct brand-name strategy analogous to Tech, 1000 combinations; Tech data unchanged.
- Visible/copied phone: `XXX-XXX-XXXX`. Canonical E.164 stored for generation history and uniqueness.
- Synthetic pool expansion (minimum +150 across all 24 presets): first/last names, street names, paired synthetic addresses, complete BIO texts, statuses, categories, role suggestions. Source rows preserved, no raw secrets.
- Verified city/postal source pairs unchanged; 55 factual organization rows unchanged because they cannot be expanded responsibly without source verification.
- Report: `node scripts/tz14-pool-report.cjs /tmp/tz14-counts.json`.

## QA gates
- 6 TZ14 contract tests PASS (24 presets, 150 minimum extra safe pool variants each, 1000 Crypto brands, phone copy mask, settings, BIO, Archive, News unchanged).
- Prior Linux full unit & integration PASS. Final Linux CI and native macOS installed-app test must PASS before release candidate is accepted.
- Selective changes outside News and Classifier. No training, cross-account parsing, or new Facebook Checker integration.

Developer ID signing and Apple notarization are not enabled. Manual acceptance on the owner's Mac remains required.
