# BLEGO 1.4.1 implementation plan

> Execute inline with superpowers:executing-plans; independent whole-branch review before delivery.

**Goal:** Fix TZ06 user workflows without replacing the BLEGO architecture or visual resources.
**Architecture:** Extend existing shared classifier, SQLite services and renderer components. Reuse archive, metadata, map and clipboard pipelines; no parallel storage or secret transport.
**Tech stack:** Electron, JavaScript, SQLite, ExifTool, Canvas, Playwright.
**Spec:** ../specs/BLEGO_V141_TZ06.md

## Global constraints
- Base 95b80ff302fafef8c395169d4fe5e23019d37f31 / PR6; separate codex/blego-v1-4-1-fixes; no merge/release.
- Preserve original assets, protected CSS, data, seven-field archive, exact cookies, phone national copy and address/city/postalCode.
- Photos mandatory 20; historical 1000 GUI failure retained. No credentials or personal fixtures in Git.
- RED before reproduced defect fixes; full lint/unit/integration per stage; GUI sequential; installed ARM64 acceptance separately.

## Review focus
- Partially labelled files must not transfer a password across record/column boundaries (A1 tests).
- Interrupted archive save must leave import/source recoverable (A2 tests).
- A hidden map must resize correctly and external map requests must not leak private data (A3 tests).
- BIO editing an old saved profile must not consume contacts or overwrite another profile (B tests).
- Clipboard failure and asynchronous navigation must not show success or reveal another record (C tests).

## A1 Classifier
Files shared/classifier*.mjs, shared/importer.mjs; tests/unit/classifier-v141.test.cjs, integration classifier tests.
- [x] Reproduce aliases/backupEmail, bare GEO, useful-content boundaries, repeated structure with synthetic fixtures; record RED.
- [x] Add backupEmail without changing core7/legacy schemas; extend exact labels, contextual recognition and conservatively validated file structure. Preserve exact ranges and unknown data.
- [x] Run focused tests, npm run verify; ledger actual results and commit.

## A2 Archive
Files src/js/main.js, src/js/ui/import.js, electron/features/importer/service.cjs and existing archive/storage modules as evidence requires.
- [x] Trace selected save -> confirmation -> SQLite/file -> list/restart with a GUI regression; record actual failure or existing PASS.
- [x] Fix only reproduced path failures; check partial data, collision, permissions, interruption and repeat save.
- [x] Focused integration/GUI plus npm run verify; commit.

## A3 Map
Files src/js/ui/photo-map.js, shared/photo-map.mjs, electron existing geo service/IPC if needed, map-specific local styles.
- [x] Reproduce current lack of geographic context; test container hidden/resize and markers.
- [x] Add licensed geographic background with explicit loading action and honest offline grid/boundaries, no metadata/photo transport. Keep existing point editing and GEO engine.
- [x] Real rendered screenshots, 20-photo export/readback, focused tests and npm run verify; commit. Native OSM fetch and installed rendering PASS; live Facebook remains BLOCKED.

## A4 Facebook
Files electron/features/facebook existing service/parser, tests unit/integration/GUI.
- [x] Audit matching-profile evidence, redirects and login/challenge handling; RED for discovered false verdicts/missed valid evidence.
- [x] Preserve anonymous bounded requests, truthful 8 statuses, 100 targets/retry/cancel. Investigate isolated browser only if HTTP evidence warrants it; no auth/session use.
- [x] Controlled cases and separate real public request report, verify and commit. Live-provider acceptance remains explicitly BLOCKED where the external service refuses the request.

## B Generator BIO
Files existing generator service/contracts/storage/UI/main, new small BIO catalogue with official provenance.
- [x] Tests for old-profile compatibility, independent residence/birthplace, explicit school/university choices, save/restart and emoji exact copy.
- [x] Separate BIO section, editable fields with per-field copies, local contextual work/position, real sourced institutions or honest no-data, editable/regenerable main BIO and thematic page BIO emoji.
- [x] Preserve full set, phone and address order; verify, GUI, commit.

## C UI cleanup
Files shell.js, network.js, news.js, import.js, main.js and scoped responsive CSS.
- [x] Tests for topbar settings, removed labels/controls, exact cookie reveal/copy/collapse/failure, automatic format, English Network and quality/trust N/A.
- [x] Implement requested removals; keep internal diagnostics/storage and all transports. Document measured quality formula independently of provider risk.
- [x] All sections/widths 360/390/480/576/768/980/1280, verify/GUI and commit.

## D Friends
Files existing Friends service/UI/main and corresponding tests.
- [x] Diagnose seed/import/persistence/dedupe/partial records/search/filter/open refresh; RED for defects.
- [x] Fix causes, keep real user data and unavailable links; truthful counts and consistent cards.
- [x] Verify/restart GUI, commit.

## E Regression and review
- [x] npm run verify; BLEGO_HEADLESS=1 npm run test:ui; no skips/disabled old coverage (expectations update only for explicitly changed UI).
- [x] Compare 1.4 / 1.4.1 under same conditions: launch/generation/import/archive/map/20 photos/UI gaps/RSS; screenshots.
- [x] Fresh whole-branch review; fix important findings with RED/GREEN and full regression.

## F ARM64 delivery
Files package*.json, .github/workflows/blego-macos-qa.yml, QA scripts/docs.
- [x] Version1.4.1, fixed-SHA build, embedded runtime gate before DMG; install outside repo; native GUI/classifier/archive/BIO/map/20 individual/folder checks.
- [x] Download/verify installer ZIP/DMG checksums; retain unsigned/notarization BLOCKED and historical failures.
- [x] Draft PR #7 created against codex/blego-v1-4-improvements, no merge. Final reports actual commands/OS/evidence/screens/remaining failures. Task attachment was requested; the host tool did not return confirmation and its stalled wait was stopped. PR remains accessible by URL.
