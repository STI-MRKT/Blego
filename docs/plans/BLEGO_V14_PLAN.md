# BLEGO 1.4 — implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` task by task; one fresh independent whole-branch reviewer at the end. Preserve this ledger across context changes.

**Goal:** Implement specification #5 on top of BLEGO 1.3, preserving original graphics, data contracts and all existing functions.
**Architecture:** Extend existing classifier worker/parser, image workspace/export engine, public Facebook queue, SQLite store and native clipboard. GEO uses licensed, provenance-bearing local city polygons and explicit CSPRNG generation; Friends uses an import/preview/confirm flow in the existing store.
**Tech stack:** Electron/Node, existing JavaScript renderer, SQLite, ExifTool, Playwright; no new frontend framework or external AI classifier.
**Current controlling spec:** `docs/specs/BLEGO_V14_TZ05_CONSOLIDATED.md` (received after Task 5). Previous completed commits remain intact; correspondence and remaining work are in `docs/verification/v14/CONSOLIDATED_RECONCILIATION.md`.
**Historical spec:** `docs/specs/BLEGO_V14_TZ05.md`; generator supplement `docs/specs/BLEGO_V14_TZ05_GENERATOR_ADDENDUM.md` received during Task 3.
**Base:** `782c1b2c1b61703f81542eafb8d97a33fc3264ec`; branch `codex/blego-v1-4-improvements` in existing isolated `/workspace/BLEGO-final`.

## Global constraints

- Existing 11 classifier fields and seven-field export remain compatible; cookie copy is exact and row-specific.
- 50 MiB input limit; 100 Facebook targets; worker/resource/cancel guards remain in force.
- No real credential samples, user data or secrets in Git, screenshots, reports or remote requests.
- GEO is generated only by explicit user action inside verified Polygon/MultiPolygon boundaries, never radius jitter. Altitude defaults to Keep.
- Existing image engine, groups, SQLite, ZIP and clipboard are reused; originals/pixels/alpha/profile/orientation remain protected.
- Original protected CSS/resources/animations retained; additions use existing controls/disclosures.
- No merge or official release. Developer ID/notarization distribution gate BLOCKED unless owner credentials become available; no protection bypass.
- Baseline 61 unit / 90 integration / 15 GUI must remain covered. Run focused tests then `npm run verify` and sequential full GUI after each implementation stage.

## Design decisions / limits

The user supplied a complete implementation order and authorized execution. Routine module choices are made here without an additional approval round. Native sequential implementation; independent review is explicitly required by the specification.

- Classified source records and field spans stay immutable; manual per-record mappings rerun classification against the same input, never reconstruct secrets.
- Legacy header/schema paths remain authoritative. New deterministic content recognition is bounded and conservative; contradictory or unrecognized values remain reviewable.
- Curated initial city boundaries cover BR/US/FR/PL/DE/ES/IT/GB. Additions use validated local GeoJSON packages with source/version/license, avoiding mandatory public geocoding calls or autocomplete. Initial city count and source limitations will be documented from actual retrieved data.
- Uniform spherical-area sampling uses longitude / sin(latitude) rejection within validated geometry, with holes, multipart handling, bounded work and final Point-in-Polygon after coordinate quantization. No altitude synthesis.
- Only synthetic examples of described A/B structures are available in this task; original confidential TXT samples are not requested or uploaded. Friends expansion data is explicitly pending; preserve seed cards and test import with synthetic links.
- Main-process facts and network facts remain separate; imported names/avatar URLs are labelled unverified and never fetched automatically.

## Review focus

1. Broken JSON followed by a valid record must not transfer cookies or secrets across record boundaries (Task 2 tests).
2. Duplicate identities / cookie owner / profile URL conflicts must remain visible after manual mapping and pagination (Task 2 tests).
3. Holes, disconnected city regions, dateline geometry, zero coordinates and thin polygons must not yield out-of-boundary points or unbounded CPU (Task 3 tests).
4. Changing city/selection/groups between preview and export must never regenerate silently or reuse stale metadata plans (Task 4 GUI/integration tests).
5. Redirect/login/rate-limited Facebook responses and hostile imported Friends links must not become verified profiles or implicit network requests (Tasks 5/6 tests).

## Task 1: audit and baseline

- [x] Read complete specification; verify remote HEAD, PR #5 and clean working tree; create separate branch.
- [x] Run `npm ci`, `npm run verify`, `BLEGO_HEADLESS=1 npm run test:ui`; expected 61/90/15 PASS, zero skips.
- [x] Map existing modules and record decisions/limits in this plan and `docs/verification/v14/PROGRESS.md`; commit audit.

## Task 2: deterministic Classifier

**Files:** create `shared/classifier-lexer.mjs`, `shared/classifier-recognition.mjs`; extend `shared/importer.mjs`, `shared/classifier.mjs`, `electron/features/classification/{service,worker}.cjs`, existing IPC/preload and `src/js/ui/import.js`, `src/js/main.js`.
**Interfaces:** lexer produces logical records with exact `sourceRecord`, `range`, `sourceEntries` and diagnostics; classifier retains `data`'s 11 keys and adds `extended`, `extraFields`, `warnings`, `confidence`; `options.recordMapping[recordId][column]` assigns a specific source entry. Existing `reclassify`, `page`, `cell`, `exportText` stay the entry points.

- [x] Add failing unit tests for A/B, mixed formats, multiline and same-line records, holes in fields, exact JSON, malformed recovery, Unicode, conflicts and unsupported guesses.
- [x] Implement lexer and recognition in existing worker pipeline; retain raw source and 7-field export.
- [x] Add failing worker tests for 1/10/100/1000 records, per-record manual mapping, warning filters, cancellation and input limit; implement missing service/IPC behavior.
- [x] Add real GUI test for detail/confidence, masked secrets, explicit reveal/copy, row assignment and pagination; implement with existing card/table/clipboard components.
- [x] Run focused suites, full verify and GUI; record commands/results and commit.

## Task 3: GEO catalogue and geometry

**Files:** create `electron/features/geo/{geometry,catalog,service}.cjs`, `resources/geo/` manifest/boundaries/licenses and provenance docs; add tests `tests/unit/geo*.test.cjs`, `tests/integration/geo*.test.cjs`.
**Interfaces:** `validateBoundary(feature)` returns bounded normalized geometry; `generatePoints(boundary,count,{exclude,signal})` returns distinct `{latitude,longitude}`; catalogue lists countries/cities with stable IDs/region/provenance and loads a boundary by ID. Local package preview/confirm updates existing SQLite cache atomically.

- [x] Retrieve/verify real initial boundaries and licensing; record exact URLs/IDs/timestamps without inventing unavailable cities.
- [x] Write failing geometry tests (holes, multipart, bounds, zero/negative, area distribution, uniqueness, invalid/thin/bounded-work cases).
- [x] Implement CSPRNG sampling and validation, provenance-bearing catalogue and local import/cache.
- [x] Verify real bundled geometries with sampled points, focused tests, full verify/GUI; commit.

## Task 4: Photos integration

**Files:** existing images service/groups/write-policy, `shared/metadata-operations.mjs`, IPC/preload, `src/js/ui/photos.js`, `src/js/main.js`; tests `tests/integration/image-geo*.test.cjs`, `tests/ui/photos-geo*.test.cjs` and native batch script.
**Interfaces:** generated per-file GPS operations use existing workspace overrides and immutable preview/export plans; `altitudeMode:'keep'|'set'|'remove'` extends existing GPS value semantics without changing old persisted operation behavior. Explicit regenerate replaces only selected targets; retry selects failed files only.

- [x] Write failing per-file unique/stable GEO and altitude Keep/export tests; integrate existing workspace, never a second export pipeline.
- [x] Country/city search, generate all/one, coordinates/provenance preview, manual advanced entry, multi-select/drop/remove/clear and failure retry.
- [x] Actual JPEG/PNG/WebP write/readback and protected data/pixels; 1/10/100 plus representative high-resolution fixtures; cancel and failure isolation.
- [x] Focused + full suites; record and commit.

## Task 5: Facebook diagnostics and useful results

**Files:** existing `electron/features/facebook/{normalize,transport,inspect,service}.cjs`, IPC/preload, checker UI/main; unit/integration/GUI tests.
**Interfaces:** preserve public queue/cancellation and compatibility fields; add explicit statuses, safe diagnostic cause/time/source, verified identity/name/avatar/object type only when evidence supports requested target. Imported local facts remain separate, explicit and unverified; no imported credential use.

- [x] Verify official Meta User/Graph API access limits and record documentation; no API call without authorized access.
- [x] Failing controlled tests for all 8 statuses, target mismatch, Retry-After, timeout/DNS/TLS/cancel/redirect, input dedup and retry one.
- [x] Extend bounded transport/queue and clear Russian UI with status filtering/sorting/individual copies/details.
- [x] Actual public requests separately recorded; protected API access BLOCKED if absent; full suites and commit.

## Task 6: Friends import

**Files:** new `electron/features/friends/service.cjs`, existing data/UI, IPC/preload; unit/integration/GUI tests.
**Interfaces:** `preview(bytes,format)` validates canonical URLs and returns added/duplicate/incomplete counts with a preview token; `confirm(token)` saves only accepted local rows in existing SQLite key/table, preserving built-in cards.

- [ ] Failing TXT/CSV/JSON import, malicious URL, canonical dedup, preview tamper and restart tests.
- [ ] Implement source-aware local import, search/GEO/platform filters, counts and safe explicit external opens; no scraping.
- [ ] GUI import/confirm/filter/open/restart; full suites and commit. Real new links remain pending.

## Task 7: Generator / Settings

**Files:** existing generator/settings UI and main/copy model; GUI tests.

- [x] Failing exact Name/BIO copy tests (Unicode/truncation/empty BIO/native clipboard/keyboard); add accessible per-field buttons next to left-card text and truthful Russian toast.
- [x] Remove generator “Additional fields” disclosure only; retain full model, Copy full set and prior history.
- [x] Introduce `person_name` / `brand_name` strategies: TECH uses thematic brands (25 supplied examples + 200–300 new unique names); MODEL/CRYPTO retain geographically appropriate female personal names, each +200–300 variants. Extend existing pools and registry, preserve exhaustion/opt-in repeat behavior.
- [x] New generated emails use only `@dayrep.com`, normalized from display name and reserved uniquely through existing registry; never rewrite old/imported emails or probe/send mail.
- [x] Add ≥50 natural unique BIOs per category **for each supported language**, using existing selection; validate counts, normalized deduplication, country/language/category metadata, mass generation and restart/history.
- [ ] Russian primary Settings labels/help and independent toggles; preserve advanced controls and store schema.
- [ ] GUI setting independence/restart plus all existing copy checks; full suites and commit.

## Task 7b: responsive window and navigation (user supplement)

**Spec:** docs/specs/BLEGO_V14_TZ05_RESPONSIVE_ADDENDUM.md. User explicitly authorizes responsive layout/minimum window changes while preserving original wide-screen aesthetics. Use a scoped responsive stylesheet and existing shell/navigation components; no framework or scaling.

- [ ] Lower native window minimums appropriately for 360px tests and 1/3 macOS work-area width; respect window manager and retain saved bounds safely.
- [ ] Automatic compact icon sidebar, accessible hover/focus labels, active state, explicit full-menu toggle and adaptive logo/status/developer footer.
- [ ] All nine sections: local table scroll, single-column cards, reachable wrapping actions, min-width:0 and vertical main scroll. No form/operation reset on resize.
- [ ] Real GUI tests at 360/390/427/480/504/576/768/980/1280; active state + copy/import/generation/batch preservation; return to original wide appearance.
- [ ] Full verify/GUI and commit. Task 9 must test actual installed macOS window bounds at all widths, not claim browser viewport emulation as native resizing.

## Task 8: full regression

- [ ] `npm ci`, lint, unit, integration, GUI, verify; baseline scenarios retained, no skipped tests for green status.
- [ ] Verify protected resources, classifier export/row-cookie, Proxy/Trust/News, storage/restart and all new modules at both viewport sizes.
- [ ] Candidate version 1.4.0; record new acceptance matrix and source limits.

## Task 9: native ARM64 QA

- [ ] Extend existing QA workflow to this branch; verified embedded runtime before packaging, actual installed app outside checkout, new GEO/high-resolution batch, before/after screenshots and measured performance.
- [ ] Download successful artifact, check ZIP CRC, DMG hash and reports; include Russian installation instructions. Unsigned QA is distinct from signed distribution (BLOCKED without owner credentials).

## Task 10: independent review and handoff

- [ ] Fresh whole-branch reviewer against this spec/base; reproduce and fix important findings with tests and repeat affected/full/native checks.
- [ ] New PR to base final-hardening, no merge; attach PR to task.
- [ ] Commit acceptance matrix, Linux/Mac evidence, synthetic A/B results, GPS readbacks, screenshots, changed files, limitations and final installer link/checksum.

## Consolidated execution order (supersedes remaining order above)

Completed work is not replayed or reset. Current tasks 2–5 are partial evidence for the expanded specification, never automatic final acceptance.

1. Generator (old Task 7 without Settings): naming, names, dayrep, per-language BIO, copy/disclosure; focused tests + full regression, logical commits.
2. GEO follow-up: confirm current engine against §§7.1–7.8; map-safe boundary/point validation API. Check coverage and serialized EXIF uniqueness in 1000-image tests.
3. Photos folders: extend existing ingestion/export with bounded cancellable recursive scanning, canonical physical-file dedup (symlinks/hardlinks), relative paths, root aliases and collision-safe contained directory export. No second workspace/export pipeline. Tests traversal/symlink escape/cancel/permissions/duplicate names/restart, actual JPEG/PNG/WebP readback.
4. Interactive map: offline-first local GeoJSON contours/points, open rendering library or documented alternative; no remote tiles without explicit opt-in. Before/after, missing-GPS group, selection/thumbnail, clusters/zoom/pan, city-constrained marker drag through existing revisioned operations, manual coordinates separate. Test no implicit network/state reset, 10/100/500/1000 markers, keyboard/accessibility and narrow layout. Files below map on narrow widths; export always reachable.
5. Facebook final reconciliation: current Task 5 plus missing approved facts fields/diagnostics; revalidate candidate. Real external limits remain explicit.
6. Friends (Task 6).
7. Responsive (Task 7b), including map and folder queue state.
8. Settings (remaining Task 7), independent switches/restart.
9. Full regression (Task 8), expanded performance baseline comparison on identical fixtures; 1/10/100/500/1000 images, memory/latency, representative real high-resolution photos separately from synthetic data.
10. Native ARM64 QA (Task 9): installed resize, map, folder/export, native ExifTool, source/installed parity; DMG+checksum+Russian instructions ZIP. No signing credentials -> signed distribution BLOCKED.
11. Independent whole-branch review and PR/handoff (Task 10). No merge.
