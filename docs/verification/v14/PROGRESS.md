# BLEGO 1.4 progress — docs/plans/BLEGO_V14_PLAN.md

Base/PR: 782c1b2c1b61703f81542eafb8d97a33fc3264ec; PR #5 open, not merged; remote rechecked 2026-11-13. Existing isolated worktree /workspace/BLEGO-final is now on codex/blego-v1-4-improvements. Old branch and other worktrees preserved.

Task 1 complete: npm ci PASS; npm run verify PASS (lint, 61 unit, 90 integration); BLEGO_HEADLESS=1 npm run test:ui PASS (15/15, zero skipped), Linux x64, Node 24.22.1. Prior Mac/screenshots remain reference evidence, not v1.4 acceptance.

Pre-flight interfaces: classifier worker remains responsible for parse/classify and source immutability; row mapping is passed through existing reclassify. GEO generation returns coordinates/provenance consumed by existing image workspace overrides, not a second image engine. Friends and geo packages use existing SQLite. Checker never consumes password/token/cookie import fields. Generator buttons use verified clipboard service.

Ruling: execute sequentially under the user's complete specification and implementation authorization; routine module choices recorded in plan, no additional design approval loop. Cloud skill helper scripts are not local executables, so this persisted plan/ledger and explicit test logs provide the equivalent task evidence.
Ruling: only structural A/B descriptions are supplied; use synthetic fixtures and mark exact confidential source-file comparison unavailable. Do not request or upload active credentials. Friends links and Apple signing credentials are also absent and do not block independent tasks.
Ruling: runtime GEO works offline with curated genuine boundaries plus explicit local dataset import; avoids dependence on unrestricted public geocoding/autocomplete. Actual initial city coverage/provenance will be recorded after retrieval.

Task 2 in progress: extend immutable token/record parsing and conservative recognition without changing the 11-key data / 7-field export contract.

Task 2 complete (Linux x64, Node 24.22.1, Electron 45.3.1): deterministic mixed TXT lexer, exact source spans, conservative explicit/context recognition, extended metadata, identity warnings, per-record mappings, warning filter, masked values and explicit reveal/copy. Existing 11 fields, seven-field export and exact row cookie retained. No classifier network request added.

RED evidence: initial eight parser cases failed before implementation; edge regression exposed quoted-label splitting, duplicate profile ID selection, missing legacy source spans and service warning/mapping gaps; GUI first failed on visible password. All corrected at source. Ambiguous values remain unknown.

Commands: node --test tests/unit/classifier*.test.cjs tests/integration/classifier*.test.cjs PASS; BLEGO_HEADLESS=1 node --test --test-concurrency=1 tests/ui/classifier*.test.cjs tests/ui/import-cookie.test.cjs 5/5 PASS; npm run verify PASS (lint, 73 unit, 93 integration); BLEGO_HEADLESS=1 npm run test:ui 16/16 PASS, zero skips. Logs /tmp/blego-v14-task2-{verify,ui}.log. One formatter-only failure was corrected and the complete verify repeated. Existing UI assertion requiring a plaintext password was replaced with masked display AND actual native clipboard equality, retaining the assignment behavior test.

Limit: A/B fixtures represent the supplied structures using synthetic values; exact comparison with the two confidential original TXT files is unavailable. Native ARM64 reacceptance remains pending for this candidate.

Task 3 in progress: fetched eight real OSM administrative city/municipal geometries via a single cached, rate-limited developer lookup after reviewing current Nominatim policy. No public autocomplete/API dependency is being added to the application. Dataset provenance and geometry validation follow.
