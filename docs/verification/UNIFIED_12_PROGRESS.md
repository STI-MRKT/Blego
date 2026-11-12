# SDD ledger — plan: docs/plans/BLEGO_LOCAL_V1_CONTINUATION_12.md

Pre-flight: D8 operation shape feeds D9 UI/reference and D10 plans; validation shared with existing policy. Inherit must never reach engine. D9 reference origins require source proofs revalidated by D10. D10 uses existing exporter/queue; D13 cannot use Linux evidence to open Mac gate. D11 source counts remain separate from registry. D14 reruns old and new acceptance.

D8: model and additive KV persistence implemented. Profile tests initially failed for absent modules, then 3 passed. Explicit Keep, inheritance, empty Set, provenance/no implicit values, validation rollback, old presets/settings and reopen tested. Full npm run verify recorded below after completion.

D8 ruling: explicit group-settings save persists group rules/names; file overrides and permissions are session-only. UI must state this, avoiding silent persistence of sensitive file identity or stale tokens. Cost: per-file adjustments require reselection/re-entry after restart; group settings and presets remain reusable.

D9–D14: not started. D13 native-environment availability to be checked after D8; unavailable targets remain blocked while local work continues.

D8 verification (2026-11-12, Linux x86_64, Node 24.22.1): `npm run verify` passed lint/format, 40 unit and 58 integration tests. Focused workspace tests: 3 passed after observed missing-module RED. Logs: `/tmp/blego-d8-baseline.log`, `/tmp/blego-d8-red.log`, `/tmp/blego-d8-green.log`, `/tmp/blego-d8-verify.log` (ephemeral Cloud logs). No OS-native packaging or installed-app claim.
