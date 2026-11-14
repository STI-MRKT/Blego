# BLEGO ТЗ10 Implementation Plan

> Execute inline with superpowers:executing-plans and test-driven-development; one fresh whole-branch review.

**Goal:** filtered Friends bulk URL copying and News field-level copying.
**Architecture:** existing canonicalUrl→transient list copyUrl→shared filter/selection→existing clipboard IPC/readback. Existing delegated UI actions and toast.
**Tech Stack:** current Electron/vanilla JS/SQLite, no new dependencies.
**Spec:** docs/specs/BLEGO_TZ10_COPY.md plus full user ТЗ10.

## Global constraints
Touch only Friends, News, narrowly necessary copy utility/main dispatch, tests/QA/docs. Preserve original protected resources and unrelated product modules. No header Copy, no clipboard truncation, no network on copy, no persistent selection history. No merge/release.

## Review focus
- Rapid filter/search/route changes or pending clipboard promises must not use stale rows or commit unsuccessful selection history.
- URL duplicates/tracking/invalid legacy data and imported rows must share existing validation, without modifying saved values.
- Repeated rendering must not duplicate listeners; exact7 and larger pools have different repeat semantics.
- Card text/URL with quotes, markup, Unicode, long text must copy exact original values and never navigate.
- Narrow cards and high counts/size-limit errors must leave all actions reachable and report honest outcome.

### Task1: audit / baseline
- [x] Confirm remote HEAD/branch/clean isolation; npmci/verify/UI baseline. Save counts/logs.
- [x] Commit design/plan and baseline evidence.

### Task2: Friends
Files: electron/features/friends/service.cjs; new shared/friends-copy.mjs; src/js/ui/friends.js; src/js/main.js; src/js/utils/clipboard.js; new unit/integration/UI tests.
Interfaces: list rows gain transient copyUrl:string|null, never persisted. filterFriends(rows,{geo,platform,query}), uniqueFriendLinks(rows), selectSeven(urls,previous=[],randomInt=...), friendsCopyMessage(count,seven). UI exports friendsCopyLinks and syncFriendsCopyActions for existing oninput/dispatch; state/selection stays session-only.
- [x] RED list canonical eligibility/duplicates/storage unchanged, buttons0/3/7/10+, filtering, uniform sampler and repeated-set handling.
- [x] Implement minimal code; buttons use fresh current filters and all pages. Common clipboard limit unchanged; custom Friends failure text only after failure, success after readback.
- [x] GUI actual import + GEO/platform/search/pagination>100 +7/all/readback, failure/delayed write, narrow/re-render, no external request. Targeted +fullverify/UI GREEN, commit.

### Task3: News
Files: src/js/ui/news.js; src/js/main.js; new tests/unit/news-copy.test.cjs and tests/ui/news-copy.test.cjs; update old copy-removal expectation to new card contract, retain header absence/navigation assertions.
Interfaces: data-action=news-copy with escaped full model value and title/link kind, copyText existing IPC, no new listeners.
- [x] RED two per-card buttons and actual exact title/URL clipboard, no browser-open on copy.
- [x] Add compact actions using existing copy icon, no source/date buttons or global Copy.
- [x] GUI all5topics, refresh, persisted SQLite cache/restart, long title/queryURL, failures/360px; targeted + fullverify/UI GREEN, commit.

### Task4: review / native QA / PR
Files: existing .github/workflows/blego-macos-qa.yml narrow branch/artifact/guide updates; docs/verification/tz10.
- [x] One fresh independent whole-branch review; one RED→GREEN important-fix pass, full regression. Source boundaries check. Keep1.4.2 version; TZ10-specific installer ZIP name avoids confusing prior artifact.
- [ ] Push marked QA candidate; native runtime gate, DMG/mount/copyoutside, all installedGUI including real clipboard exact payload assertions and screenshots; no tests skipped.
- [ ] Download/verify SHA/ZIP/member list/OS/codeSHA; full requirement report/files/clipboard evidence/screenshots. New draft PR against incoming branch, attach, no merge/release.

## Ledger
Plan identity: docs/plans/BLEGO_TZ10_COPY.md.
Preflight: clean linked worktree /workspace/BLEGO-final (gitdir!=common, not submodule). Base remote matches7679fed. New branch codex/blego-friends-news-copy. No AGENTS.md found. Baseline running.
Preflight shared interface: Friends/News share existing copyText; optional fourth failure message preserves defaults for all old calls. New actions remain in existing single delegated listener; no copy-actions.js change expected.
Ruling: user's detailed scope already authorizes execution; implement inline without another design approval. Reuse current isolated worktree, create a new branch; no existing changes to discard. Cost if wrong: branch/worktree organization only, no data modification.
Ruling: reuse canonicalUrl via transient copyUrl rather than duplicate normalization or add clipboard IPC. Copy URL may be canonicalized exactly as existing Friends importer/open operation; stored source remains unchanged. Cost if wrong: compatibility tested against old list consumers and storage snapshots.
Ruling: bounded rejection sampling rather than a biased forced replacement;32 repeated identical sets yields an honest error, not an infinite loop. With healthy RNG this bound is negligible even for8profiles. Test deterministic repeat and rejection boundaries.
Task1 complete: npmci/lint145unit131integration48GUI PASS,0fail/skip;GUI209.231s. Baseline collected before new tests were added to those respective suite glob expansions. Task2 RED observed: missing transient canonical copyUrl, missing buttons, missing selection helper. Test runner requires unrestricted child-process sandbox profile in this cloud; initial restricted invocation could not execute test workers, rerun used normal authorized cloud test execution.
Task2 complete: transient canonical copyUrl reuses Friends validation without changing saved rows. Uniform Fisher–Yates/rejection checked over40320 equally likely eight-profile permutations; each omitted URL occurs5040times. Unit/integration RED→GREEN5/5; actual Electron GUI import/filter/paging113links/copy7/repeat/exact7/3/zero/clipboardfail/delayedwrite/360px PASS. Full lint149unit132integration49GUI PASS,0skip. Global copy infrastructure retains10MiB limit/readback; only optional Friends error text added. Friends query oninput updates bulk availability immediately while existing Find/card rendering remains unchanged. No new network/IPC/storage mechanism.

Task3 complete: targeted News RED→GREEN; full lint150unit132integration50GUI PASS,0fail/skip (GUI241.082s). Real Electron native clipboard checks cover5topics, controlled RSS through actual parser, refreshed values, reopened SQLite cache, long title/query URL, navigation isolation, failure and360px. Earlier unit expectation from TZ6 forbade all News copy controls; it failed as expected under the new contract. Updated only that obsolete assertion to exact2card buttons while retaining absence of header/metadata copy and existing Network assertions. First failure evidence preserved. Raw RED log trailing whitespace removed only for diff hygiene.
Ruling: TZ10 supersedes earlier blanket News-copy removal; old tests now assert the two explicitly required per-card actions while retaining all unrelated guarantees. Cost if wrong: reintroducing forbidden metadata/header controls; new assertions explicitly reject those.
Visual inspection: Linux News360 screenshot shows both buttons in bounds. Friends wide screenshot initially retained test scroll position; test capture now resets content scroll, product behavior unchanged. Native QA remains pending.

Final review: fresh gpt-6-astra reviewer reviewed7679fed..c817ebf read-only. One Important: RSS title was truncated at300characters before copying; RED regression reproduces this. Fix retains complete normalized title under existing2MiB feed cap, existing CSS clamping and10MiB clipboard guard; RSS/Atom unit fixture and all-topic GUI fixture now exceed300withEND_MARKER, including refresh/cache reopen.
Final: minor (deferred): add deterministic failed-seven/retry and filter/route changes during pending Friends writes; reviewer found no product defect. Existing test covers failed/delayed all-write, implementation snapshots input and advances history only on success.
Final: Ruling: native QA was outside reviewer execution — run actual installed macOS ARM64 checks before claiming acceptance; cost if wrong is an unverified installer, so evidence is a release gate.
Final: Ruling: unchanged modules received scope review, not a fresh deep audit — full existing regression remains required; cost is residual pre-existing defects outside this narrow task, disclosed as such.
Final: Ruling: keep existing Friends canonicalization and News URL normalization — they remain the specified contracts and stored values remain unchanged; cost if wrong is an inherited normalization limitation, not silently introduced new policy.

Final: fixed RSS/Atom title truncation — News full-headline regression RED→GREEN2/2; whole suite lint151unit132integration50GUI PASS,0fail/skip. GUI uses >300-character END_MARKER through real parser, cache/restart and native clipboard. No re-review. Native QA candidate marked next; user already requested new PR and installer, so no repeated approval or release/merge. PR11 draft created against incoming branch. Host attach_artifact called but did not return; direct PR URL retained.
