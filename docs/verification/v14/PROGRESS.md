# BLEGO 1.4 progress — docs/plans/BLEGO_V14_PLAN.md

Base/PR: 782c1b2c1b61703f81542eafb8d97a33fc3264ec; PR #5 open, not merged; remote rechecked 2026-11-13. Existing isolated worktree /workspace/BLEGO-final is now on codex/blego-v1-4-improvements. Old branch and other worktrees preserved.

Task 1 complete: npm ci PASS; npm run verify PASS (lint, 61 unit, 90 integration); BLEGO_HEADLESS=1 npm run test:ui PASS (15/15, zero skipped), Linux x64, Node 24.22.1. Prior Mac/screenshots remain reference evidence, not v1.4 acceptance.

Pre-flight interfaces: classifier worker remains responsible for parse/classify and source immutability; row mapping is passed through existing reclassify. GEO generation returns coordinates/provenance consumed by existing image workspace overrides, not a second image engine. Friends and geo packages use existing SQLite. Checker never consumes password/token/cookie import fields. Generator buttons use verified clipboard service.

Ruling: execute sequentially under the user's complete specification and implementation authorization; routine module choices recorded in plan, no additional design approval loop. Cloud skill helper scripts are not local executables, so this persisted plan/ledger and explicit test logs provide the equivalent task evidence.
Ruling: only structural A/B descriptions are supplied; use synthetic fixtures and mark exact confidential source-file comparison unavailable. Do not request or upload active credentials. Friends links and Apple signing credentials are also absent and do not block independent tasks.
Ruling: runtime GEO works offline with curated genuine boundaries plus explicit local dataset import; avoids dependence on unrestricted public geocoding/autocomplete. Actual initial city coverage/provenance will be recorded after retrieval.

Task 2 in progress: extend immutable token/record parsing and conservative recognition without changing the 11-key data / 7-field export contract.
