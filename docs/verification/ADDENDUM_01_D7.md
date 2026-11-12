# D7 — regression and delivery checks (2026-11-12)

Work continues on codex/blego-local-v1; main and upstream history retained. D0–D6 stage reports are evidence records. This file records D7 findings and is extended with final package/review results; no platform is accepted by inference.

Added an upgrade test which extracts pre-addendum A7 commit 211d2a2 into a disposable Cloud directory, creates synthetic historical data with that actual code, closes and copies the store, and opens the copy with current code. ZIP SHA-256, issued rows, idempotent old card and settings survive; a newly issued female profile preserves contact uniqueness. The initial test incorrectly named a schema column and expected the IPC projection from a lower-level archive API; both test assumptions were corrected against actual baseline interfaces.

Added missing/ mixed metadata and atomic file-count/size/total-limit checks. `npm run verify`: 35 unit and 52 integration passed, lint/format passed (log /tmp/blego-d7-verify.log). Added a packaging gate: only Linux x64 with prepared bundled runtime is currently permitted. macOS arm64/x64 and Windows x64 require a verified native engine/runtime before the gate can be extended. They remain blocked, not successful cross-builds.

Initial Linux packaging tried the read-only default cache; rerun with documented /tmp XDG/Electron/builder caches succeeded. The first packaged GUI run failed before a window because libvips was still inside ASAR. This was an actual packaged-run defect, not a source-test success. Packaging now explicitly unpacks @img and sharp native resources. Subsequent package tests and final acceptance statuses are recorded below when actually completed.


## Final results

Code commit ff1ca8d: review fixes recorded in ADDENDUM_01_REVIEW.md. Full regression
38 unit + 57 integration passed, including real owner/serial/IPTC GPS/JPEG COM
read-write-read and preservation tests. Both GUI workflows passed from the rebuilt
Linux package. Playwright's async waitForFunction pitfall was found during the
100-file GUI check; explicit awaited polling replaced those test waits and the
packaged workflows were rerun successfully.

100-file GUI check: 100 read, 100 verified exports, 100 output files and progress
rows; 56.926 s, 1,280 event-loop ticks, maximum sampled gap 284 ms. These are small
12×8 synthetic RGBA PNGs, not worst-case images. The earlier service-only load
check measured 83 MiB sampled parent/direct-child peak RSS; no equivalent GUI
memory claim is made.

Final Linux tarball SHA-256 and exact commands are in ADDENDUM_01_ACCEPTANCE.md.
No application publication, signing or native macOS/Windows success is asserted.
Source code contained in the ASAR is checked against the committed application
files. Final branch remains separate, with a draft PR for review; no merge.

Delivery integrity: 108 tracked electron/src/shared/resources files match their
ASAR bytes. Tar app.asar matches the tested unpacked app (SHA-256
`e7fe9f0c9c5f4f314fcbe44d7c9e46bbb4a5a466a41e458a82f080dc701dafa1`).
Tar size: 162,635,587 bytes. Final npm run verify repeat again passed
38 unit / 57 integration with no failures, and lint/format passed.
