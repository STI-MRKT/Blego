# TZ06 BIO: sourced organizations and automatic saving

Goal: populate and atomically persist synthetic BIOs at generation, and autosave edits without losing data on navigation or normal shutdown.
Architecture: extend the existing institution JSON catalog; reuse generator and SQLite requests/lastCard transaction; serialize debounced renderer saves with revision checks; flush before replacing/clearing a profile and native window close/quit. No new DB, generator, clipboard system or visual framework.
Tech: Electron, existing vanilla JS UI, SQLite, node:test and Playwright Electron.
Spec: user BIO addendum, recorded in docs/specs/BLEGO_TZ06_BIO_AUTOSAVE.md.
Base: 1e7e22423dd358d5bebec4e48c6a1cf1190a6474, codex/blego-v1-4-1-fixes (clean).

## Constraints and decisions
- All initial BIO fields are persisted in the same generation transaction. Unavailable verified organization data means empty fields.
- Existing Tech profiles use brand_name. They receive location and thematic text, but no invented employment/education. Personal profiles may receive explicitly synthetic organization examples.
- Same-city organizations first; regional fallback only with unambiguous verified city-to-region mapping. No country-wide fallback. Schools are city-only, following the specific school requirement.
- Preserve legacy records on read; no random regeneration on tab changes, no migrations or rewriting profile fields.
- Sourced names are factual reference data; roles are synthetic compatible examples, never claims of actual employment or attendance.
- Save errors retain the draft and block profile replacement/normal close; retry is explicit or triggered by subsequent editing. No success before commit.
- No protected CSS/assets changes expected; use existing components.

## Review Focus
1. Edits made during an in-flight save must survive; stale revisions/late suggestions cannot overwrite them.
2. Immediate Cmd+Q/window close before debounce must save before SQLite closes; failed write keeps the draft/window.
3. Unknown towns and ambiguous city names must not acquire unrelated employers or schools.
4. Brand pages must not acquire a personal employment/education history; old profiles remain editable.
5. Catalog extension is data-only; atomic failures must leave both requests and lastCard unchanged and not spend contacts.

## Tasks
- [ ] 1. Catalog and generation: failing selection/generation/atomicity tests, verified expandable catalog, geographic/category selection, automatic initial BIO in existing transaction. Targeted + npm run verify; logical commit.
- [ ] 2. Autosave: failing coordinator/race tests, renderer debounce/flush/error handling, native close/quit handshake, individual regenerate/copy, remove Save/unsaved text. Targeted + npm run verify; logical commit.
- [ ] 3. GUI acceptance: automatic initial population, all copies, individual regenerate, edit while saving, failure/retry, tabs/navigation, 360px, close/quit/relaunch; actual screenshots. Run complete GUI regression sequentially, review changes independently, fix important findings with RED/GREEN. Logical commit.
- [ ] 4. Native candidate: push [mac-qa-run] on existing working branch, real ARM64 installed-app QA, download/check artifact hashes, update draft PR7 and evidence. Never merge/publish. Report coverage gaps and blocked checks separately.

## Execution ledger
Pre-flight: catalog produces same schema consumed by generator and BIO read API; renderer receives values/institutions/revision; close handshake consumes coordinator.flush before storage cleanup. Existing transactions stay authoritative.
Ruling: city-only schools, conservative unknown geography, and blank personal biography for brand pages resolve the conflicting fill-all versus no-fabrication requirements; cost is intentionally sparse BIOs where reliable local data is absent.
Ruling: cloud skills scripts are not local executable files; track task evidence in this checked-in ledger instead of a separate skill scratch directory.

Task 1 complete: new selection/generation tests observed RED (missing generateBiography and initial profile.biography), then GREEN. Seven targeted tests initially passed, extended to eight with real catalog validation. Atomic failure tests cover rollback of requests/lastCard/issued contacts. Catalogue source evidence: 40 rows, all eight countries, 17 companies, 15 universities, 8 schools. Common checks in the working candidate: npm run verify PASS (lint, 117 unit, 120 integration; no skips). Existing Tech-as-person birthplace assertion updated because Tech uses brand_name; legacy persisted values are retained.
Task 2 in progress: debounce, in-flight typing, stale suggestions, failed write/retry, close/quit gates observed RED then GREEN (7 targeted coordinator/UI/gate tests). Storage cleanup moved from cancellable before-quit to will-quit. Actual Electron first two GUI scenarios PASS, including normal window-close failure retention and explicit native quit/relaunch.

Task 2 complete: debounced serial saves, per-field regeneration, failure/retry warnings, tab retention, transition freeze, native close/quit flush, and no Save BIO button. Linux npm run verify PASS: lint, 119 unit, 120 integration. Linux full Electron GUI PASS: 34/34, no skips (157.246s); all five BIO GUI scenarios pass. Saved logs in docs/verification/v141/bio-autosave.
Final review: fresh independent reviewer found two Important gaps (transition edits/suggestions; ambiguous direct city matches), no Critical. Transition fix reproduced in unit/GUI RED then GREEN; ambiguity reproduced unit RED then GREEN. A navigation-hidden error was graded Important because the user explicitly requires visible failure; global warning regression RED→GREEN. No deferred review findings. Review limits (live source reverification/native artifacts) are handled by the source evidence and forthcoming native QA, not treated as PASS by review.
GUI test investigation: reused postal codes and cross-country shared names correctly triggered the unchanged registry; fixture names/postcodes are now unique. Asynchronous waitForFunction was insufficient for IPC persistence: replaced with Node-side awaited polling. Retry button inherited display styling overriding hidden; scoped inline display now hides it unless a failure exists (actual GUI RED→GREEN). No protected CSS changed.
Task 3 in progress: real bundled-city coverage audit found 0 matching cities in seven initial country lists, 1/6 GB. Added a failing coverage regression and expanding sourced organizations to cities actually present in those lists. Geography distribution and registry stay unchanged. This is a functional correction to catalogue coverage, not a nationwide-coverage claim.
