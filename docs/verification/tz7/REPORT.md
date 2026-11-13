# TZ7 — independent FP and BIO generators

Base: `5a63ee7e5177459ebe4aed6a9c143df5cfeda341` (`codex/blego-v1-4-1-fixes`).
Branch: `codex/blego-fp-bio-independent`. No merge, official release, destructive migration or database replacement.

## Changes

1. Independent SQLite kv workspace, record IDs, parameter revisions, atomic value writes, bounded history and idempotent generation. Existing organization selection engine and catalog reused. BIO never consumes the FP uniqueness registry.
2. Permanent ФП | BIO tabs visible on empty startup. Own BIO country/city/theme and generate/clear actions. Existing FP card/avatar, full set, national-phone copy, address→city→postalCode, authored pools and history retained. Original CSS, assets and animation files unchanged.
3. Same autosave coordinator reused for independent values and parameter drafts. Writes are serialized, stale revisions rejected, last keystrokes flushed on close/quit, in-flight suggestions awaited; failed writes retain drafts. BIO clipboard source uses its own values, including current edits.
4. Old attached BIOs remain available through history using deterministic legacy references. Opening does not create copies or change FP JSON. First edit writes one independent BIO record; repeated opens reuse it. Clear removes only the current pointer; saved history remains available.

## Checks so far

Linux x64, Node 24.22.1 / Electron 45.3.1:
- `npm run verify`: lint PASS, 123 unit PASS, 127 integration PASS, no skips.
- `BLEGO_HEADLESS=1 node --test --test-concurrency=1 tests/ui/generator-bio.test.cjs`: 9/9 PASS, no skips.
- `BLEGO_HEADLESS=1 BLEGO_CAPTURE=/tmp/tz7-final-screens npm run test:ui`: full cross-module GUI 38/38 PASS, 164.423s, no skips.
- Native ARM64: pending; no installed Mac acceptance claimed yet.

| # | User scenario | Evidence |
|---|---|---|
| 1 | Both tabs visible immediately | TZ7 empty-start GUI; permanent-tabs unit |
| 2 | FP works without BIO | Existing generator GUI plus standalone workspace tests |
| 3 | BIO without FP | TZ7 empty-start GUI; requests/issued remain empty integration |
| 4 | FP generation preserves BIO | TZ7 two-direction GUI; independent workspace integration |
| 5 | BIO generation preserves FP | Exact lastCard equality in GUI/integration |
| 6 | Independent clear | Both directions in GUI; history and pointer integration |
| 7 | Tabs retain edited fields | In-flight/autosave GUI and coordinator unit |
| 8 | BIO autosave | Actual IPC/SQLite GUI, failures/retry, revisions/rollback integration |
| 9 | Restart restores both | Native application quit/relaunch GUI, own parameter drafts |
| 10 | Legacy records open | Repeated GUI opens, original JSON unchanged, 0→1 lazy independent records |
| 11 | Copy buttons | All seven BIO values, FP national phone/full set, shared menu source switching |
| 12 | Wide/narrow | Both tabs at 360/390/427/480/504/576/768/980/1280px; actual Electron window bounds |

## Data and acceptance limits

The existing 55-record sourced institution catalog is unchanged. Coverage is limited; all eight country hubs, covered bundled localities and sparse-town empty states are tested. This does not establish exhaustive city coverage or fresh live verification of every institution. Regional choices retain their actual city; no invented organizations or inferred employment claims.

BIO country/city/theme controls describe the next generation. Regenerating one saved result field uses that result's saved geography/theme. Clearing retains history. Old attached BIOs are not rewritten or removed.

Developer ID signing, Apple notarization, Gatekeeper behavior on the owner's downloaded copy and owner acceptance are not established by CI. Existing dictionary/public-provider limitations remain in prior verification reports; this task does not relabel them PASS.

## Independent review and regression fixes

Fresh whole-branch review identified a startup failure for legitimate old FP records with disabled city. A real SQLite regression reproduced `INVALID_BIO_PARAMETERS`; read-only legacy normalization now retains blank city and exact original FP JSON. The legacy installed-app GUI fixture also disables city.

A cross-country history transition briefly retained old city/postal suggestions. Delayed real IPC GUI reproduced 504 stale options; workspace replacement now clears them before loading the matching country. Existing request epochs reject late responses. This was treated as a data-integrity issue because a stale hidden postcode could affect organization matching.

Both regressions were observed failing before fixes and passing afterward. Normal quit during pending standalone generation is covered; committed writes are atomic, but forced termination can lose keystrokes still inside the debounce interval.
