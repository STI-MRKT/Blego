# BLEGO TZ9 1.4.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Inline implementation, one fresh whole-branch reviewer at the end. User has authorized execution of the specified design and sequence; no additional plan-approval pause.

**Goal:** Fix map lifecycle/tiles, contextual TXT recognition, fresh-install defaults and trustworthy Facebook presentation; ship checked1.4.2 ARM64 QA.
**Architecture:** Reuse current Electron/SQLite/frontend and service boundaries. Renderer map owns viewport/consent and a bounded tile scheduler; existing native tile service retains network safety/cache and supports request cancellation. Classification remains deterministic with conservative compatible file layouts; Facebook retains evidence/diagnostics beneath presentation.
**Tech Stack:** Electron45.3.1, Node24.22.1, vanilla JS/CSS, SQLite, ExifTool, node:test/Playwright.
**Spec:** docs/specs/BLEGO_TZ09_V142.md + full user TZ9.

## Global Constraints

- Base5f30cf51a0f04da13975a7ecd11b96c488457623, branch codex/blego-v1-4-2-fixes, QA1.4.2. No merge/release.
- Preserve stored settings/FP/BIO/archive and original graphics; no unrelated rewrite; no general header copy.
- No real secrets or TXT network calls. Background map permission separate from defaults. No TLS/security/resource bypass.
- Required20-photo test; historical1000-photo FAIL retained. Every source fix gets witnessed RED→GREEN and regression.
- Baseline expected from preceding acceptance123unit/127integration/44GUI, to be rerun rather than inherited.

## Review Focus

- Tile request cancellation overlaps a remount asking for the same key: no duplicate download, leaked consumer or stale paint. Task2 includes consumer/cancel/remount tests.
- Same-width but different TXT layouts and empty optional cells: no cross-group password assignment. Task3 includes conflicting/interleaved groups and missing passwords.
- Numeric/date/email-shaped password with explicit label: preserve exact content; recognition type must not override label. Task3 tests each.
- Legacy partial settings and migration defaults: never override explicit false or cause startup transmission. Task4 tests fresh/false/mixed/restart and IPC request counts.
- Unavailable wording in unrelated profile, login script, intermediate HTTP error or stale retry: no false BLOCKED. Task5 tests target provenance, incomplete HTML and retry epochs.

### Task1 — Audit and baseline
- [x] Verify remote PR9/SHA, clean worktree, isolated branch. Read affected paths and save root-cause findings.
- [x] npm ci; npm run verify; BLEGO_HEADLESS=1 npm run test:ui. Record actual counts and failures. Expected no existing failure.
- [x] Add minimal regression witnesses for four defects before touching corresponding production paths (can land with each task). Commit spec/plan/baseline evidence.

### Task2 — Map lifecycle, viewport and bounded tile loading
**Files:** src/js/ui/photo-map.js; shared/photo-map.mjs; new src/js/utils/map-tile-loader.mjs; electron/features/geo/tiles.cjs; electron/main.cjs; electron/preload.cjs; map unit/integration/UI tests, test-only controlled tile-server fixture.
**Interfaces:** Preserve photoMapRows/fitMap/project/visibleTiles. Persist model.background; content identity invalidates model.view without changing GPS. createMapTileLoader({load,cancel,decode,onChange,cache}) exposes update(wanted), snapshot(), retry(), dispose(); opaque per-request IDs. Existing mapTile(x,y,z) callers stay valid; optional requestId and mapTileCancel(requestId) are validated narrowly.
- [ ] RED GUI: enable background, generate new city, remount/switch before-after/resize; require consent retained, city viewport and20correct points, actual tile pixels.
- [ ] RED unit/service: per-key failure isolation, <=4inflight, <=3attempts, dedup, cancel old viewport/shared consumers, late decode/reply, corrupted cache and missingGPS/fit-all.
- [ ] Implement minimal state/scheduler/service changes. Successful decoded tiles bounded; errors cannot stop other keys. Never report loaded unless all required visible tiles drawn. Retry explicit after exhausted attempts.
- [ ] GREEN targeted tests; full verify and GUI regression. Export20 copies and independent GPS readback through existing metadata engine; original hashes unchanged. Commit.

### Task3 — TXT contextual recognition and metrics
**Files:** shared/classifier-lexer.mjs; shared/classifier-recognition.mjs; shared/classifier.mjs; shared/importer.mjs; optionally new shared/classifier-layouts.mjs; tests/fixtures/classifier-v142.cjs; tests/unit/classifier-v142.test.cjs; tests/integration/classifier-v142.test.cjs; tests/ui/classifier-v142.test.cjs; scripts/check-classifier-v142.cjs.
**Interfaces:** classifyRecords keeps records/data/core7/source contract; optional layouts/provenance are non-secret internal metadata (no payload logs). Reuse mapping API/service; compatible layouts inferred from >=2explicit independent examples, conservative rejection of conflicts/structural groups.
- [ ] RED hand-labelled cases: email pass aliases, two formats, semicolon/tab/mixed separators, comments, multilines/nested cookie, explicit unusual passwords, blank optional segments, distinct compatible groups.
- [ ] Expand labels/lexing only where necessary; group by compatible typed anchors rather than width alone; preserve uncertain raw values/manual mapping, no arbitrary adjacent-string password guessing.
- [ ] Assert exact source record/ranges, no cross-record assignments, no invented missing password. Measure field precision/recall/false/missing/ambiguous/time on hand-labelled fixtures with literal expected fields, including holdout patterns.
- [ ] GUI real TXT parse/copy/manual mapping/core7/export/archive/restart; full verify and GUI. Commit.

### Task4 — Fresh defaults, stored preferences and network policy
**Files:** electron/local/settings.cjs; settings unit/integration/UI tests; only startup callers needing policy guard fixes.
**Interfaces:** getSettings merges defaults with stored keys; updateSettings remains atomic.
- [ ] RED fresh store expects three true; oldfalse/mixed and unrelated fields unchanged; save/reopen; no hidden startup network requests.
- [ ] Set three defaults true, preserve explicit false. Update old fixture setup where a test explicitly needs disabled tools, retaining behavior assertions; do not relax network tests.
- [ ] GREEN targeted and full verify/GUI. Commit.

### Task5 — Facebook evidence and UI statuses
**Files:** electron/features/facebook/{inspect,service,transport,diagnostics}.cjs as required; src/js/ui/checker.js; minimal local existing CSS status selectors; controlled unit/integration/UI tests.
**Interfaces:** Preserve internal availability/reason/source/history compatibility. Presentation ACTIVE/BLOCKED only for current evidence-backed profile_visible/unavailable; old weak HTTP_UNAVAILABLE rows remain UNKNOWN. Technical statuses retain clear code and specific reason.
- [ ] RED15-case matrix plus target mismatch, script-only phrases, false status, truncated HTML, redirect/login, per-target retry/time/cancel/100queue and Retry-After.
- [ ] Strengthen source/target/meaningful-content evidence; remove bare HTTP403/404/410 unavailable shortcut. Add ACTIVE/BLOCKED presentation/descriptions/green-red only for confirmed states; neutral unknown/network. No token/cookie use.
- [ ] GREEN targeted + full verify/GUI; bounded real public page check separately, restrictions recorded BLOCKED. Commit.

### Task6 — Version, integration and fresh review
**Files:** package.json/package-lock.json; existing QA scripts/workflow/install guide adapted1.4.2; docs/verification/tz9.
- [ ] Set1.4.2; workflow allow new branch, exact output ZIP members DMG/SHA256SUMS/INSTALL-RU.txt. Preserve native runtime gate and all prior tests. Add new native city/20photo/classifier/default/checker scenarios.
- [ ] Run explicit npm ci/lint/test:unit/test:integration/test:ui/verify; record counts and zero unexpected skips. Preserve1000-photo historical FAIL reference.
- [ ] Fresh whole-branch reviewer reads spec/plan/ledger/base diff; one RED→GREEN fix pass for important issues and full regression. Commit fixes before checked Mac candidate (review repeated only if user asks).

### Task7 — Native QA, evidence and PR
- [ ] Push marked candidate; same-host baseline5f30cf5 performance comparison; prepare/verify bundled runtime, build DMG, mount readonly, copy app outside repo, full installed GUI +20photos/citytiles/readback and all new cases.
- [ ] Real OSM city viewport separately: require correct city z/x/y and actual raster pixels, not world screenshot; failures explicitly BLOCKED. Anonymous Facebook live outcome separate from deterministic PASS.
- [ ] Download artifact; verify codeSHA/ZIP CRC/inner files/DMG SHA256, view screenshots. Record OS/host/commands/timings and limits; DeveloperID/notary BLOCKED if absent.
- [ ] New PR against codex/blego-hide-header-copy; attach it, no merge/release. Deliver exact install ZIP, checksums, changed-file inventory, classifier metrics, all four root causes/status map and screenshots.

## Ledger

Plan identity: docs/plans/BLEGO_TZ09_V142.md. This ledger is durable across context compaction.
Preflight: existing isolated worktree /workspace/BLEGO-final, gitdir /workspace/BLEGO/.git/worktrees/BLEGO-final; no AGENTS.md; clean. PR9 draft/open at exact5f30cf5; new branch created from fetched base. Existing PR9 unchanged.
Shared interfaces: Tasks2/4 share renderer settings only; map consent remains separate, no new general network enablement. Tasks3/5 share imported facts: classifier output must never authorize Facebook transport or determine public availability. Task6 native runner consumes all prior tests and artifact names.
Ruling: execute the user's explicit detailed design inline; preserve existing worktree rather than create another; one final independent reviewer. No new functional ambiguity requires a permission pause.
Audit findings: map background/errors/cache local to mount; first tile failure globally stops renderer and server backoff; geometry/initial1×1 fit can leave wrong view. Classifier explicit email pass alias missing; width-only file layout grouping cannot separate compatible distinct formats. Three settings defaults false. Facebook bare403/404/410 currently means unavailable, insufficient for new BLOCKED semantics. Demo screenshot TXT has no emailPassword; its empty cell is correct and must remain empty.
Baseline commands running; do not count earlier acceptance as new PASS.

Task1: complete. npm ci PASS, lint/123unit/127integration PASS,44GUI PASS161.366s,0skips. Four explicit audit regression witnesses failed for intended reasons; logs in docs/verification/tz9/baseline. Current demonstration lacks mail password by construction, no data-loss claim for it. Historical1000-photo FAIL remains documented in docs/verification/v141/ACCEPTANCE.md#21.3 and NATIVE.md. Task2 now active.

Task2 implementation: consent moved into existing photoMap model; viewport identity invalidates fit only for changed city/coordinates, fitting deferred until measured Canvas size. Shared bounded decoded cache, per-tile attempt budgets, four concurrent jobs, three tries, explicit retry, timeout/cancellation/stale guards. Narrow cancelMapTile IPC preserves sender validation. Server coalesces tile consumers and cancels only the last consumer; removed global failure backoff. Controlled HTTP GUI fixture exercises actual PNG decode/draw and 20 independent EXIF readbacks. Test-authoring correction: engine returns group/copy-qualified raw ExifTool keys; readback assertion uses signed Composite GPS, not nonexistent normalized tags.gps. No product export defect was hidden.
Task2 GREEN: lint,125unit,127integration,45GUI PASS, no skips; GUI183.618s. 20 exported JPEG copies match signed Composite GPS readback and unchanged originals. Whole-suite original map pointer/resize/group tests retained. Controlled tile-server proof is not a claim about real OSM access; live city acceptance remains Task6.
Task3 complete: email pass/mail pass labels; mixed tab/semicolon lexer; compatible explicit-example layout groups (>=2 examples,>=2 typed anchors, max64groups), ambiguity rejects competing schemas; per-field provenance retains source column/range/method. Existing worker/SQLite/archive/core7 contracts reused. Hand-labelled11datasets/22records:90correct nonempty assignments,precision1,recall1,false0,missing0,4review records,33.17ms Linux (limited fixture corpus, not a universal accuracy claim). Lint136unit128integration PASS. FullGUI45/46 passed; new test failed because Archive was inside a closed existing details block. Corrected test opens that block and then independently passes copy/archive assertion. No product assertion removed. Final full-suite rerun remains required after subsequent stages.
Task4 complete: only three defaults changed; getSettings merge/update transaction unchanged. Fresh/unset true; stored false/mixed and partial upgrade/reopen validated. Startup configure/cache snapshot caused0transport calls. Lint136unit130integration PASS. Full47GUI run:44PASS,3old fixtures assumed fresh OFF. Explicitly persisted OFF in those opt-out fixtures (app/News/UX) without changing their assertions; all3 and new fresh-install GUI PASS on rerun. Fresh GUI independently verifies ON and selective disable/restart. No forced migration or hidden auto-fetch added. Final fullGUI rerun required.
