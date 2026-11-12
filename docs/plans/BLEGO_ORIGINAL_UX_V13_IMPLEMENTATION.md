# BLEGO Original UX v13 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task-by-task. User approved design and explicitly requested execution; do not ask for another plan approval.

**Goal:** Restore original BLEGO graphics with working, simple local workflows and individual copying of every working value.
**Architecture:** Keep vanilla renderer/Electron IPC/SQLite/current metadata engine, exporter, ZIP and clipboard. Restore original components; adapt existing services in place. Additional styles only for genuinely new controls.
**Tech Stack:** Electron 45.3.1, Node 24, vanilla JS, SQLite, ExifTool/embedded Perl, Playwright.
**Spec:** `docs/plans/BLEGO_ORIGINAL_UX_V13_DESIGN.md`, user UX v1.0 and subsequent approval with **each element copied separately**.

## Global Constraints

- Original visual source `6e57eabfb5b51af4475b90686fa580b5ce57e9b0`; functional base `7de572764e4f09c5b1a542fbec22161bd1be9f42`.
- Keep protected CSS/assets/icons/animations byte-identical. No new framework, no database duplication.
- Copy buttons next to individual values; advanced whole-model copy remains secondary, never the main flow.
- No random date/GPS/camera defaults, no original image overwrite, no destructive migration.
- No PR #1 changes, merge, release publishing, purchased service, committed secrets or personal data.
- Real verification only; Linux is not Mac validation. Rules pending and dictionary limitations stay explicit.

## Review Focus

- A late result after input/topic/selection changes must not appear to describe the new input (tasks 2,3,5).
- Missing/false/empty risk data must never turn into perfect trust (task 2).
- Multi-file edits preserve individual timezone/overrides when omitted (task 5).
- Hidden fields still copy independently and survive refresh/restart (tasks 1,6).
- Cancel or failed native dialogs must never show success or overwrite an existing file (tasks 4–7).

## Task 1: original graphics and individual copy

Files: renderer `ui/generator.js`, `network.js`, `news.js`, `shell.js`, `utils/copy-actions.js`; test `tests/ui/original-ux.test.cjs`.
Consumes existing `state` and IPC results. Produces same render exports/handlers and visible original components; no backend contract change.
- [x] Write GUI assertions: original gauge/packets visible, no top technical panel, gradient avatar, archive last, independent native clipboard values, advanced fields reachable.
- [x] Run `BLEGO_HEADLESS=1 node --test tests/ui/original-ux.test.cjs`; observe failure.
- [x] Restore original markup and minimally adapt to current models; compact copy controls after main content.
- [x] Run target GUI + `npm run verify` + `BLEGO_HEADLESS=1 npm run test:ui`; all must pass. Capture new screenshots at 1280×900.
- [x] Commit `ui(UX1): restore original graphics and individual copy` and ledger actual results.

## Task 2: Network

Files: existing proxy `transports.cjs`, `service.cjs`, `providers.cjs`, `assessment.cjs`; add provider `proxycheck.cjs`; existing server/network IPC/UI. Tests: `proxy-transports`, new `proxy-boundaries` and `network-diagnostics` integration, `proxy` unit, original-ux GUI.
Interfaces: `checkProxy({value}, signal)` returns safe error code, route, IP, timings, independent sources and `assessment.trustScore`; diagnostics accepts abort and returns nullable measured values.
- [x] RED tests socks5h/local DNS distinction, bad auth/TLS/DNS/timeout/cancel/private endpoints, empty risk, missing/wrong IP evidence.
- [x] Implement bounded fixed-target transports, public endpoint guard, precise safe errors; `100-risk` only strict numeric 0–100 with matching IP/source.
- [x] Restore distinct direct latency/speed controls, route labels, cancellation and separate result state; speed explicit only, bounded stream.
- [x] Check official provider documentation and real endpoint response; record unavailable access honestly. Run real controlled sockets all four protocols, regression and GUI.
- [x] Commit, record tested commands and external/live limitations.

## Task 3: News

Files: `shared/news-catalog.mjs` (new catalog only); existing feeds/service/settings/main/state/news UI; new news topic/race/security tests.
Interfaces: `refreshNews({topic,force})` and `snapshot(topic)` return selected-topic items/source states/last success; cache remains existing SQLite news store.
- [x] RED tests topic-only requests, rapid switching/coalescing, 20 unique valid items where available, stale cache/429, redirect/private/DNS guard, encodings and normalized duplicates.
- [x] Select verified official topical feeds, implement chosen-topic persistence and cache throttling without all-topic background timer.
- [x] Restore original cards/loading effects, five-topic dropdown and individual title/link/source copying; hide News Settings.
- [x] Run live selected-topic checks with source/HTTP/received/unique/displayed/time report, regression and GUI; do not substitute fixtures for live acceptance.
- [x] Commit and ledger.

## Task 4: Facebook

Files: existing checker UI/main + tests; retain normalizer/service/transport unchanged unless test exposes defect.
Interfaces unchanged `normalizeTargets`, `checkFacebook`, `cancelFacebook` with runId.
- [x] RED GUI single Check normalizes then checks; cancel/late result ignored; each ID/link/result copies individually.
- [x] Original textarea/card/progress, clear status labels, notes/history in disclosure; no sanctions inference.
- [x] Run input/response/queue tests, live bounded public check, full regression and GUI; record restrictions as restrictions.
- [x] Commit and ledger.

## Task 5: Photos date/GPS

Files: existing photos UI/main, metadata operation/contracts/policy/write-policy/group workspace; reuse image preview service. Tests metadata namespaces/timezone/selection + GUI date/GPS workflow.
Interfaces extend existing captureDate operation with explicit date representation scope and timezone operation, backward-compatible presets. No new writer.
- [x] RED tests keep-existing offset per file, explicit remove/set offset, EXIF/XMP selection, GPS zero, untouched metadata, stale plan and selection changes.
- [x] Restore real thumbnail grid using authorized preview tokens; primary date/GPS fields, Preview and Save copies; advanced groups/presets/reference/tags disclosures.
- [x] Preserve dirty-only drafts and multi-selection untouched overrides; retain original/pixel/alpha/ICC/orientation and exclusive output safety.
- [x] Actual JPEG/PNG/WebP single/group writes/readback + cancellation/permission/full-disk/restart; full regression and GUI, screenshots.
- [x] Commit and ledger.

## Task 6: Generator and Archive

Files: generator/history/main/copy controls; tests existing registry/archive plus new GUI actions.
- [x] RED compact original archive row actions/open/copy/TXT/ZIP/folder/delete confirm/filter/sort; generator extras and every independent value copy.
- [x] Finish compact flows; preserve ZIP and history/settings; short honest dictionary error; no expiry timer.
- [x] Regression/GUI/restart/protected-resource comparison, commit and ledger.

## Task 7: candidate verification and native QA

Files: verification scripts/tests/workflow/docs only as needed; add new UI suites to installed-app check, keep native runtime gate.
- [ ] Review branch with fresh reviewer per executing-plans; regression tests for material findings before fixes.
- [ ] Run lint/unit/integration/full GUI, original/new screenshots, existing data upgrade and protected asset hashes.
- [ ] Native arm64 runtime then DMG then installed outside checkout tests on available authorized Mac environment; never weaken gate. Respect no paid services, no release/merge.
- [ ] Record SHA/changed files/per-stage results/function map/E01–E60 evidence, real news/proxy/date/GPS, installer hash if actually produced; otherwise BLOCKED and exact remaining requirements.
- [ ] Commit report and push working branch. Owner acceptance remains outstanding.
