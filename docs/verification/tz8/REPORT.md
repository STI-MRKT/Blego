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

Native candidate: d14929dc10a5400c8186c9833d19e925e6f3d815. [QA run](https://github.com/STI-MRKT/Blego/actions/runs/43519024471). Final installed outcomes, screenshots and ZIP checksums are pending actual verification.

## Independent review and final correction

One fresh whole-change review (base cdc72c4 through c5c2799) found no critical issue, one important stale photo-group snapshot and one minor sequential-copy completion race. Both reproduced with real Electron tests before changes: switching group A→B kept A’s prepared panel, and completing native clipboard IPC after navigation emitted a null-panel exception. Active group identity now participates in context invalidation; sequential copying rechecks panel/generation after preparation and clipboard completion. Focused6/6 PASS (13.418s), including both new regressions. Final verify after this correction: lint PASS,123/123 unit,127/127 integration (53.106s), zero skips. Full GUI44/44 PASS (185.584s), zero skipped/cancelled; no gates weakened.

## Acceptance coverage

| Requirement | Evidence |
| --- | --- |
| No general header action in FP/BIO/Import/News/Network/Photos/Friends/Checker/Archive/Settings | header-copy-removed: real DOM assertions, no hidden mount; generation/import/navigation/redraw/resize/restart |
| FP field copies and Copy full set | all8 fields exact, phone national portion; profileText exact full-set contract |
| BIO copies and independence/autosave | all7 generated values copied; edited main BIO saved/reloaded; existing independent-generator suite |
| Classifier fields, exact cookie, collapse, exports | existing classifier-structured/reset/copy-all-sections GUI and integration coverage retained |
| Photos/Archive/Checker point copies | existing copy-all-sections; image bitmap and metadata; archive open/selection; checked result copy |
| Advanced keyboard panel | Ctrl variants, Command variants conditional on actual darwin; native text selection/input/contenteditable remain intact |
| No stale menu or duplicate mount | replacement/clear/navigation, late archive response, same-record redraw, active photo group, pending sequential clipboard |
| Empty source | no clipboard overwrite on normal shortcut; zero-row advanced preview; no preference overwrite |
| Responsive | 360,390,427,480,504,576,768,980,1280px; closed header mount absent; explicit menu within bounds |
| Native installed app | Pending fresh ARM64 candidate; no prior build PASS inherited |

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

[Run43519024471](https://github.com/STI-MRKT/Blego/actions/runs/43519024471), candidate d14929d: native runtime/readback, verify, real photograph, date/GEO batches and DMG build PASS. Installed GUI43/44 PASS, one FAIL, zero skips (442.322s). All6 TZ8-specific tests passed on the installed ARM64 app, including Command variants and screenshots. The remaining failure was archive-v141’s unscoped singleton “Сохранено” locator: two legitimate save notifications were simultaneously visible. The test now marks pre-existing notifications before each save and awaits a new success notification; exact archive content, exclusions, two-record count and restart assertions remain. No product code, timeout or test requirement was weakened. The failed candidate’s installer was not produced or delivered. [Installed report](native-attempt1/installed-darwin-arm64.json), [complete GUI log](native-attempt1/installed-darwin-arm64.json.log.txt). Fresh Linux and native QA required for the corrected test candidate.
