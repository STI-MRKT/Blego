# D7 — regression and delivery checks (2026-11-12)

Work continues on codex/blego-local-v1; main and upstream history retained. D0–D6 stage reports are evidence records. This file records D7 findings and is extended with final package/review results; no platform is accepted by inference.

Added an upgrade test which extracts pre-addendum A7 commit 211d2a2 into a disposable Cloud directory, creates synthetic historical data with that actual code, closes and copies the store, and opens the copy with current code. ZIP SHA-256, issued rows, idempotent old card and settings survive; a newly issued female profile preserves contact uniqueness. The initial test incorrectly named a schema column and expected the IPC projection from a lower-level archive API; both test assumptions were corrected against actual baseline interfaces.

Added missing/ mixed metadata and atomic file-count/size/total-limit checks. `npm run verify`: 35 unit and 52 integration passed, lint/format passed (log /tmp/blego-d7-verify.log). Added a packaging gate: only Linux x64 with prepared bundled runtime is currently permitted. macOS arm64/x64 and Windows x64 require a verified native engine/runtime before the gate can be extended. They remain blocked, not successful cross-builds.

Initial Linux packaging tried the read-only default cache; rerun with documented /tmp XDG/Electron/builder caches succeeded. The first packaged GUI run failed before a window because libvips was still inside ASAR. This was an actual packaged-run defect, not a source-test success. Packaging now explicitly unpacks @img and sharp native resources. Subsequent package tests and final acceptance statuses are recorded below when actually completed.
