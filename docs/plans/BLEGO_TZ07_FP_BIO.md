# Independent FP/BIO implementation plan

> Execute inline using executing-plans, with one fresh independent review at the end.

Goal: two independently persisted generators under permanent ФП | BIO tabs.
Architecture: reuse the existing biography engine, autosave coordinator and SQLite kv transaction. Own BIO records/parameters/IDs; deterministic lazy legacy adapters preserve original requests and avoid duplicate reads.
Tech Stack: existing Electron, vanilla JS, SQLite, node:test, Playwright Electron.
Spec: docs/specs/BLEGO_TZ07_FP_BIO.md.

## Global constraints
Preserve FP avatar/card, names/BIO pools, female personal names, themed brands, @dayrep.com, separate copies and full-set semantics, national-phone copy and address→city→postalCode. Preserve original CSS/assets, archives and uniqueness. Never merge or release. No fabricated organizations, new DB, framework or duplicate metadata/clipboard engine.

## Review focus
1. Concurrent BIO editing/parameter saves while FP generates/clears must never retarget either result.
2. Legacy read/reopen/clear/restart must not duplicate BIOs, resurrect cleared results or rewrite profile JSON.
3. Late city/options/suggestion responses must not overwrite newer parameter choices or values.
4. Close/quit while parameter save, value save or generation is pending must preserve accepted edits and show failures honestly.
5. Clipboard actions on BIO must use BIO, while FP full set/phone and narrow navigation remain unchanged.

## Tasks
- [x] 1. Backend workspace: RED integration tests for standalone generation, independent records/parameters, idempotency, rollback, legacy adapter/history/restart. Implement biography-workspace.cjs reusing biography.cjs and SQLite kv. Profile validation remains separate. Run targeted + npm run verify, commit.
- [x] 2. UI/IPC independence: RED rendered UI/coordinator tests. Add separate state and permanent tabs; own BIO controls, persistence and history; remove FP-linked creation/flush/clear. Reuse coordinator for params and values, close flush both; extend shared copy source. Update tests whose previous coupling is explicitly superseded. Targeted + npm run verify, commit.
- [x] 3. Real GUI: fresh empty app, both generate/clear directions, no cross-write, own params, tabs/narrow/wide, all copies, retries/in-flight saves, quit/restart, legacy reopening/history/no duplicates. Full GUI sequentially. Fresh review, RED/GREEN fixes, common suite; commit candidate.
- [ ] 4. Native ARM64: enable feature branch in existing gated workflow, push candidate [mac-qa-run], actual installed-app QA, verify artifacts/checksums, create a draft PR against the unchanged base, deliver ZIP/screenshots/evidence. No merge/release.

## Ledger
Preflight: backend returns {parameters,parametersRevision,record,institutions}; record {id,parameters,values,revision,createdAt,updatedAt}. UI coordinator uses recordId/revision; parameter editor maps the same save protocol to configure. No main FP state/ID is an input to ordinary BIO actions. Legacy reference is a compatibility adapter only.
Ruling: use existing kv namespace rather than a schema migration, retaining compatibility with old app data and avoiding destructive migration. Legacy read is zero-copy; first edit gets deterministic independent identity. Cost: history is queried through JSON/kv rather than a new table.
Ruling: standalone BIO is a synthetic-person generator for all three themes; FP Tech remains a page/brand. Old attached fields are preserved exactly. Cost: no project-only BIO subtype added unless requested.
Authorization: detailed user specification explicitly requests implementation; routine architecture choices proceed without another approval menu. Plan/spec tracked in the repository instead of unavailable cloud-skill helper scripts.

Stage 1: implemented independent transactional workspace and zero-copy legacy adapter. RED: missing workspace module; GREEN: 6/6 targeted integration tests. Common `npm run verify`: lint PASS, 121 unit PASS, 125 integration PASS (first five new tests included); sixth pagination/geography test independently PASS. Linux x64 / Node24.22.1. UI still uses old API until stage 2; native validation pending.

Stage 2: permanent ФП | BIO tabs, independent controls/editors/IPC and clipboard source implemented. FP retains original card and no longer creates attached BIO. Existing legacy save helper retained for compatibility. RED: standalone tabs and BIO copy-source tests failed on old UI; GREEN: 123 unit / 126 integration, lint PASS (`npm run verify`, 48.634s integration); 7/7 targeted real Electron GUI, including independent clear/generate, restart, all copies, legacy zero-copy reads and 9 widths. Protected CSS/assets unchanged. Full cross-module GUI and native ARM64 still pending.
Ruling: allow empty city in saved parameter drafts, require nonempty city only for generation — ordinary field editing and quitting must not fail merely because a city was cleared; no organizations are fabricated.

Final review: fresh read-only reviewer (gpt-6-astra) found one P1 compatibility failure and one stale-options race. No destructive migration, cross-generator writes or additional blockers found.
Final: Ruling: re-grade stale country suggestions as Important — old rows can silently supply a wrong postcode to new BIO parameters, affecting organization matching; clear rows on workspace replacement. Cost if ignored: incorrect saved geography despite correct country control.
Final: fixed missing optional city in legacy BIO — real SQLite regression RED INVALID_BIO_PARAMETERS at initialization → GREEN after normalizing absent city to an empty read/draft parameter. Original FP JSON remains byte-for-byte unchanged; GUI legacy fixture now disables city.
Final: fixed stale city options — delayed cross-country history GUI RED (504 old-country rows) → GREEN (empty until matching-country response). Existing epoch check still rejects late responses.
Final: Ruling: reviewer deferred native execution/visual/clipboard/timing validation to executor — full actual GUI and native CI below are required; no inference from code review. Forced termination can lose debounce-buffered keystrokes, as before; committed SQLite writes remain atomic. Live catalog provenance unchanged and limited, not represented as fresh exhaustive verification. Unchanged modules covered by full regression rather than a new architecture review.

Stage 3 complete: review fixes RED→GREEN; final `npm run verify`: lint PASS, 123 unit / 127 integration PASS; full sequential `BLEGO_HEADLESS=1 BLEGO_CAPTURE=/tmp/tz7-final-screens npm run test:ui`: 38/38 PASS, 164.423s, zero skips. Native branch enabled without changing any gate. Base re-fetched unchanged at 5a63ee7. No protected CSS/assets/resources changed.
