# TZ8 — PR9 header copy removal

Branch: codex/blego-hide-header-copy. Existing [PR9](https://github.com/STI-MRKT/Blego/pull/9), base codex/blego-fp-bio-independent at cdc72c4. Received HEAD5c30c7e. Clean preflight; earlier commits and PR preserved. No merge/release.

## Audit and implementation

The received fix removes the dynamically injected header button in copy-actions.js, but retained panel state across unsupported views and record changes. Focused real Electron tests reproduced automatic resurrection after navigation, late archive reads reopening the menu, and interception of contenteditable fields. The added empty-source preview scenario also exposed the existing zero-row source being serialized as a one-card request.

The existing copy infrastructure is retained. Header controls are never constructed. The advanced panel is mounted lazily outside the page and completely removed on close/context change. Its zero-size fixed wrapper does not occupy document layout. Source identity and a request generation counter invalidate late work. Same-record redraws preserve an explicitly open form. Native text input/select/contenteditable, selection, composition and key repeats retain their normal behavior. Ctrl/Command+Shift+C and Ctrl/Command+Alt+Shift+C preserve the requested contracts.

Inspected main.js, generator.js, biography.js, shell.js and responsive.css: no separate header-control creation or per-render listener registration needs replacement. Only copy-actions.js and the local copy-panel rule in ux.css need product changes. FP/BIO persistence, organization engine, SQLite, archives and original graphic resources are unchanged.

## Verification ledger

- npm ci: PASS (316 packages; existing dependency deprecation warnings).
- Initial lint on received branch: FAIL, formatting of new header-copy-removed.test.cjs. Corrected with repository Prettier.
- Initial received GUI test:1/1 PASS, but did not cover generated BIO, Settings, restart or lifecycle races.
- Added focused lifecycle/keyboard tests: failures reproduced before product fixes; initial focused pass4/4.
- First npm run verify: lint PASS;123 unit/127 integration PASS.
- Separate npm run lint, npm run test:unit, npm run test:integration: PASS,123/127.
- Initial expanded full GUI:41/42 PASS, one genuine empty-preview failure. Fixed invalid one-card scope; follow-up RED caught order=[] preference overwrite, now prevented for zero-row previews. Focused4/4 PASS. Fresh common verify: lint PASS,123/123 unit and127/127 integration. Full GUI then42/42 PASS (214.601s), zero skips. Screenshots inspected: FP and BIO visible, header controls absent.

Current native candidate: cd82fc500637740e360f178c03c4676e5a19d84f. [Repeat QA run](https://github.com/STI-MRKT/Blego/actions/runs/43521493403). First attempt d14929d failed as recorded below. Repeat candidate cd82fc5: all native gates PASS; verified delivery and limitations below.

## Independent review and final correction

One fresh whole-change review (base cdc72c4 through c5c2799) found no critical issue, one important stale photo-group snapshot and one minor sequential-copy completion race. Both reproduced with real Electron tests before changes: switching group A→B kept A’s prepared panel, and completing native clipboard IPC after navigation emitted a null-panel exception. Active group identity now participates in context invalidation; sequential copying rechecks panel/generation after preparation and clipboard completion. Focused6/6 PASS (13.418s), including both new regressions. Final verify after this correction: lint PASS,123/123 unit,127/127 integration (53.106s), zero skips. Full GUI44/44 PASS (185.584s), zero skipped/cancelled; no gates weakened.

## Acceptance coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| No general header action in FP/BIO/Import/News/Network/Photos/Friends/Checker/Archive/Settings | PASS | header-copy-removed: real DOM assertions, no hidden mount; generation/import/navigation/redraw/resize/restart |
| FP field copies and Copy full set | PASS | all8 fields exact, phone national portion; profileText exact full-set contract |
| BIO copies and independence/autosave | PASS | all7 generated values copied; edited main BIO saved/reloaded; existing independent-generator suite |
| Classifier fields, exact cookie, collapse, exports | PASS | existing classifier-structured/reset/copy-all-sections GUI and integration coverage retained |
| Photos/Archive/Checker point copies | PASS | existing copy-all-sections; image bitmap and metadata; archive open/selection; checked result copy |
| Advanced keyboard panel | PASS | Ctrl variants, Command variants conditional on actual darwin; native text selection/input/contenteditable remain intact |
| No stale menu or duplicate mount | PASS | replacement/clear/navigation, late archive response, same-record redraw, active photo group, pending sequential clipboard |
| Empty source | PASS | no clipboard overwrite on normal shortcut; zero-row advanced preview; no preference overwrite |
| Responsive | PASS | 360,390,427,480,504,576,768,980,1280px; closed header mount absent; explicit menu within bounds |
| Native installed app | PASS | Fresh installed cd82fc5:44/44 GUI PASS,314.085s; exact artifact/code SHA validated |

GUI fixtures contain synthetic profiles/imports and temporary isolated SQLite stores. Native file chooser answers are controlled; real clipboard IPC, persistence and metadata output are exercised. This is not a manual owner acceptance or a guarantee about every macOS permission/Gatekeeper condition.

Linux logs: [verify](linux/verify.log.txt), [full GUI](linux/gui.log.txt), [review RED](linux/review-red.log.txt), [focused GREEN](linux/focused-green.log.txt), [npm ci](linux/npm-ci.log.txt).

## Required commands and environments

Linux cloud: Node24.22.1, Electron45.3.1. GUI invoked with `BLEGO_HEADLESS=1` (Electron’s supported headless Ozone backend); tests run sequentially to isolate the system clipboard. `npm ci`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run verify`, `npm run test:ui` all actually executed. Separate unit/integration commands preceded the final review correction; the final verify repeated both suites against the final product change. GUI observations do not substitute for the native ARM64 gate.

Native workflow retains all existing prerequisites: pinned dependencies, native Perl/ExifTool preparation and read-write-readback, lint/unit/integration, unsigned ARM64 DMG, readonly hdiutil mount, ditto install outside checkout, native dependency probe and all GUI tests using BLEGO_EXECUTABLE. It additionally runs20-photo/folder operations, a real high-resolution photograph check, and original/baseline/candidate UX observations. ZIP preparation occurs only after these gates succeed. No skip/timeout/security check was relaxed for this change.

## Change boundaries

- Product: src/js/utils/copy-actions.js; src/css/ux.css (only existing advanced-panel wrapper).
- GUI regression: tests/ui/header-copy-removed.test.cjs plus existing app, classifier-reset, copy-all-sections, generator-bio, ux-restoration tests adapted to the supported shortcut without deleting copy assertions.
- QA: .github/workflows/blego-macos-qa.yml adds this branch to existing gated workflow; docs/verification/v141/INSTALL-RU.txt explains retained shortcuts.
- Tracking/evidence: docs/plans/BLEGO_TZ08_HEADER_COPY.md and docs/verification/tz8/.
- No changes to FP/BIO data model, SQLite, archives, organization catalogs, original graphics/animations, protected CSS tokens/base/components/shell/tools/views or responsive.css.

## First native attempt — FAIL, installer withheld

[Run43519024471](https://github.com/STI-MRKT/Blego/actions/runs/43519024471), candidate d14929d: native runtime/readback, verify, real photograph, date/GEO batches and DMG build PASS. Installed GUI43/44 PASS, one FAIL, zero skips (442.322s). All6 TZ8-specific tests passed on the installed ARM64 app, including Command variants and screenshots. The remaining failure was archive-v141’s unscoped singleton “Сохранено” locator: two legitimate save notifications were simultaneously visible. The test now marks pre-existing notifications before each save and awaits a new success notification; exact archive content, exclusions, two-record count and restart assertions remain. No product code, timeout or test requirement was weakened. The failed candidate’s installer was not produced or delivered. [Installed report](native-attempt1/installed-darwin-arm64.json), [complete GUI log](native-attempt1/installed-darwin-arm64.json.log.txt). Fresh Linux and native QA subsequently completed successfully for cd82fc5, as recorded below.

Cloud environment restart interrupted the candidate2 Linux GUI repeat mid-suite (no final result); not counted as PASS. The repeat was restarted from the beginning after environment readiness. GitHub ARM64 QA is independent and continued.

Final candidate2 Linux GUI repeat:44/44 PASS (194.624s), zero skipped/cancelled. [Final GUI log](linux/candidate2-gui.log.txt), [final verify](linux/candidate2-verify.log.txt). The interrupted run is not used as evidence.

## Final native acceptance — PASS

Checked commit **cd82fc500637740e360f178c03c4676e5a19d84f**, application source unchanged since7173a1e. Later report-only commits do not replace the checked build SHA. [PR9](https://github.com/STI-MRKT/Blego/pull/9), [branch](https://github.com/STI-MRKT/Blego/tree/codex/blego-hide-header-copy), [successful run43521493403](https://github.com/STI-MRKT/Blego/actions/runs/43521493403).

Actual host: **macOS15.8.2 (24H232), Darwin24.6.0, arm64, Apple M1 (Virtual), VirtualMac2,1**, Node24.22.1/Electron45.3.1. [Environment](native/macOS-env.txt), [installed report](native/installed-darwin-arm64.json).

| Check | Linux cloud | Native macOS ARM64 |
| --- | --- | --- |
| npm ci | PASS | PASS |
| npm run lint | PASS | PASS |
| npm run test:unit |123/123 PASS |123/123 PASS |
| npm run test:integration |127/127 PASS |127/127 PASS |
| npm run verify | PASS | PASS |
| npm run test:ui / all UI files with BLEGO_EXECUTABLE |44/44 PASS,194.624s |44/44 PASS,314.085s |
| Skipped/cancelled tests |0/0 |0/0 |
| Native Perl/ExifTool read-write-readback | Existing Linux verification PASS | PASS |
| ARM64 DMG, readonly mount, install outside repo, launch | Not applicable | PASS |
| FP/BIO field copies, full set, Command shortcuts, restart, widths360–1280 | PASS | PASS |

Native commands: `bash scripts/prepare-metadata-darwin.sh`; `node scripts/check-metadata-native.cjs --target darwin-arm64 ...`; `npm run verify`; `npm run dist:mac -- --arm64`; `hdiutil attach ... -readonly -nobrowse`; `ditto .../BLEGO.app "$RUNNER_TEMP/BLEGO-qa.app"`; packaged dependency probe; `node scripts/check-installed-app.cjs --executable "$RUNNER_TEMP/BLEGO-qa.app/Contents/MacOS/BLEGO" --report ...`. [Full native command definitions](../../../.github/workflows/blego-macos-qa.yml). Installed check actually invokes every tests/ui/*.test.cjs sequentially against the copied executable outside checkout, using isolated temporary user stores.

Evidence: [native common tests](native/verification-native.log.txt), [all installed GUI tests](native/installed-darwin-arm64.json.log.txt), [runtime gate](native/native-darwin-arm64.json), [native resizing](native/responsive-native.json). No test failure or skip is hidden: first-attempt failure and corrected expectation are recorded above.

Additional retained gates: [20 individual files](native/metadata-ui-batch-darwin.log.txt)20/20 saved,9.689s; [20 files in20 folders](native/metadata-ui-folder20-darwin.log.txt)20/20 saved,10.466s; fixture12×8 RGBA PNG (not a worst-case stress claim). [Real photograph](native/real-photo-candidate.json):6000×2696 JPEG/PNG/WebP derivatives with actual date/GEO export and preservation checks. [UX observations](native/ux-performance-darwin.json): three launches per version, same current environment; not a scientific cold-cache benchmark.

## Installed screenshots

All four images below come from the installed cd82fc5 executable in this run and were visually inspected. Header has no general Copy; adjacent copy controls remain. Host display constrains screenshot height to656px; lower fields remain accessible by vertical scrolling, exercised by the tests.

- [FP1280](native/tz8-profile-1280.png)
- [BIO1280](native/tz8-bio-1280.png)
- [FP360](native/tz8-profile-360.png)
- [BIO360](native/tz8-bio-360.png)

## Installer and checksums

Delivery: `BLEGO-1.4.1-TZ8-arm64-cd82fc5.zip`,150749177bytes. Contains exactly `BLEGO-1.4.1-arm64.dmg`, `SHA256SUMS-mac.txt`, `INSTALL-RU.txt`. Both outer artifact and inner installer ZIP CRC/SHA256 validated; embedded DMG hash and instruction/checksum bytes equal the accepted QA files.

DMG SHA256: `e90a9e7c54bf09b5611acbe339ad986e691c976246c3c9337e748a502df26679`.

Installer ZIP SHA256: `6a0eebc156a6804ff09e2954233daf7879d2135fa56b7a6354809efa2b2f0c09`.

[QA artifact14082869903](https://github.com/STI-MRKT/Blego/actions/runs/43521493403/artifacts/14082869903), expiry2026-11-18T22:54:49Z. This Actions artifact is the larger QA bundle containing the installer and diagnostics. [Artifact manifest](native/artifact.json), [DMG checksum](native/SHA256SUMS-mac.txt), [ZIP checksum](native/SHA256SUMS-zip.txt), [installation guide](../v141/INSTALL-RU.txt).

## Remaining limits

- Developer ID signing/notarization: **BLOCKED**, credentials not provided. QA build is unsigned by Developer ID and not notarized. Gatekeeper behavior for a quarantined download on the owner’s physical Mac is not proven by CI; no protection is disabled.
- Owner acceptance: **PENDING**. Verified on virtual M1/macOS15.8.2, not every physical Apple Silicon/macOS version. File chooser answers use test fixtures; real permission-denial/window-manager variants beyond the recorded tests are not claimed.
- Existing unrelated external-service limit remains: [anonymous Facebook observation](native/public-services-native.json) **BLOCKED/UNKNOWN/INSUFFICIENT_EVIDENCE**, no ban verdict. OSM one-tile installed rendering PASS, not a complete public pan/zoom matrix.
- Organization catalogs retain existing finite coverage; unsupported locations may have empty organizations. No invented data or completeness claim was added.
- No unresolved TZ8 copying defect remains in executed tests. No official release or PR merge performed. [Full changed-file inventory](CHANGED_FILES.txt).
