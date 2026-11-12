# SDD ledger — plan: docs/plans/BLEGO_LOCAL_V1_CONTINUATION_12.md

Pre-flight: D8 operation shape feeds D9 UI/reference and D10 plans; validation shared with existing policy. Inherit must never reach engine. D9 reference origins require source proofs revalidated by D10. D10 uses existing exporter/queue; D13 cannot use Linux evidence to open Mac gate. D11 source counts remain separate from registry. D14 reruns old and new acceptance.

D8: model and additive KV persistence implemented. Profile tests initially failed for absent modules, then 3 passed. Explicit Keep, inheritance, empty Set, provenance/no implicit values, validation rollback, old presets/settings and reopen tested. Full npm run verify recorded below after completion.

D8 ruling: explicit group-settings save persists group rules/names; file overrides and permissions are session-only. UI must state this, avoiding silent persistence of sensitive file identity or stale tokens. Cost: per-file adjustments require reselection/re-entry after restart; group settings and presets remain reusable.

D9–D14: not started. D13 native-environment availability to be checked after D8; unavailable targets remain blocked while local work continues.

D8 verification (2026-11-12, Linux x86_64, Node 24.22.1): `npm run verify` passed lint/format, 40 unit and 58 integration tests. Focused workspace tests: 3 passed after observed missing-module RED. Logs: `/tmp/blego-d8-baseline.log`, `/tmp/blego-d8-red.log`, `/tmp/blego-d8-green.log`, `/tmp/blego-d8-verify.log` (ephemeral Cloud logs). No OS-native packaging or installed-app claim.

D13 early environment check after D8: Cloud environment listing returned only the default environment; current host is Linux x86_64. No macOS/Windows executor is available. Native runtime/installed-app tests remain BLOCKED; target packaging gate stays closed. Portable probes/runbook will be prepared in D13.

D9: reused image service, reader, policy, SQLite KV and editor. Added named groups, explicit group-settings save, session overrides/inheritance, canonical-path deduplication, reference selection with zero preselected fields and hash proof, preset rename/duplicate/delete/export, numeric camera fields and semantic fractional readback. Reference images share the same file/byte limits and are not automatically group members. GUI preserves drafts by group/selection; personal values are disclosed before local saving. Existing preset schema remains readable.

D9 verification: focused tests initially failed (missing APIs / unsupported camera fields), then 3 passed including actual JPEG/PNG/WebP write/readback and unchanged originals. `npm run verify`: lint/format, 40 unit + 61 integration PASS. `BLEGO_HEADLESS=1 npm run test:ui`: 3 PASS, including group draft/reference/save/restart and all prior GUI workflows. Linux x86_64 only. Logs `/tmp/blego-d9-{red,green,verify2,ui}.log`. Deduplication exposed old fixtures repeating one path; replaced them with actual distinct files so queue/cancel assertions still exercise multiple items. Group export/retry remains D10, not claimed here.
