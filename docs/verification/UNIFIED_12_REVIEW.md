# v1.2 whole-branch review and verification

A fresh read-only reviewer inspected aeb8c23 through D8–D13 and the D14 candidate.
No reviewer changed repository files. Eight actionable findings and the subsequent
cache edge case were fixed before candidate packaging:

- Multi-selection now changes only explicitly edited fields. Applied drafts are
  discarded; only unapplied metadata drafts are cached. Switching A+B→A→A+B,
  and the reverse, cannot restore an old applied value. Unrelated preset-name /
  scope controls do not mark metadata dirty.
- Multi-value/unknown ISO remains displayable and is preserved by Keep; it cannot
  become an invalid scalar reference Set. A real PNG with ISO `100 200` passes a
  title-only grouped export; array-valued raw tags are covered separately.
- Applied preset values are snapshots, surviving later preset rename/delete.
- Add-dialog cancellation preserves drafts; removing a file restores the remaining
  selection's own draft. Clearing files revokes session/reference state.
- Explicit group Save includes displayed/cached group drafts after validation.
- Saved reference proofs need fresh explicit authorization; unchanged name/hash
  can rebind a newly chosen reference without restoring an old IPC capability.
- A previously reference-only file can be explicitly promoted into the image list.
- Preview shows operation origin/reference proof and support information.

Additional checks found/fixed concurrent canonical-path registration and ensured
replaced destinations/changed source proofs return PLAN_STALE for grouped plans.
The global input-byte reservation is refreshed when a selected file changes size.
Group copying reuses the shared copy-source/serialization/clipboard path.

Observed RED evidence includes erased multi-selection drafts, stale applied-cache
restoration, renamed preset rejection, duplicate registration, unsupported ISO Keep,
and destination identity returning the wrong error. Focused corrected cases pass.
The first post-`npm ci` GUI launch failed because Electron 45 defers its binary
installation; `NODE_USE_ENV_PROXY=1 XDG_CACHE_HOME=/tmp/blego-cache npx --no
install-electron` completed the pinned installation. That environment failure is
not described as a successful GUI run.

Final source verification: `npm run verify` (lint/format, 42 unit, 69 integration)
and `BLEGO_HEADLESS=1 npm run test:ui` (3 real Electron GUI tests), all PASS on
Linux 6.18.57 x86_64 / Node 24.22.1 / Electron 45.3.1. Logs:
`/tmp/blego-v12-verify.log`, `/tmp/blego-v12-ui.log`.
Native platforms, source-data minima and live Facebook corpus remain separate
acceptance gates, not exceptions hidden by code review.
