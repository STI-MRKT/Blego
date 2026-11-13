# TZ7 — independent FP and BIO generators

Base: `5a63ee7e5177459ebe4aed6a9c143df5cfeda341` (`codex/blego-v1-4-1-fixes`).
Branch: [`codex/blego-fp-bio-independent`](https://github.com/STI-MRKT/Blego/tree/codex/blego-fp-bio-independent).
Code/build SHA: `80b36de53b9b7b39b3e173a3dad13fa052cb7340`. Draft [PR #8](https://github.com/STI-MRKT/Blego/pull/8). No merge, official release, destructive migration or database replacement.

## Changes

1. Independent SQLite kv workspace, record IDs, parameter revisions, atomic value writes, bounded history and idempotent generation. Existing organization selection engine and catalog reused. BIO never consumes the FP uniqueness registry.
2. Permanent ФП | BIO tabs visible on empty startup. Own BIO country/city/theme and generate/clear actions. Existing FP card/avatar, full set, national-phone copy, address→city→postalCode, authored pools and history retained. Original CSS, assets and animation files unchanged.
3. Same autosave coordinator reused for independent values and parameter drafts. Writes are serialized, stale revisions rejected, last keystrokes flushed on close/quit, in-flight suggestions awaited; failed writes retain drafts. BIO clipboard source uses its own values, including current edits.
4. Old attached BIOs remain available through history using deterministic legacy references. Opening does not create copies or change FP JSON. First edit writes one independent BIO record; repeated opens reuse it. Clear removes only the current pointer; saved history remains available.

## Verified candidate

Linux x64, Node 24.22.1 / Electron 45.3.1:
- `npm run verify`: lint PASS, 123 unit PASS, 127 integration PASS, no skips.
- `BLEGO_HEADLESS=1 node --test --test-concurrency=1 tests/ui/generator-bio.test.cjs`: 9/9 PASS, no skips.
- `BLEGO_HEADLESS=1 BLEGO_CAPTURE=/tmp/tz7-final-screens npm run test:ui`: full cross-module GUI 38/38 PASS, 164.423s, no skips.
- Native ARM64: lint PASS, 123 unit / 127 integration PASS; installed application 38/38 GUI PASS, 310.642s, zero skips. The same nine BIO scenarios, including missing-city legacy data and delayed IPC, ran against the packaged executable outside checkout.

| # | User scenario | Linux / installed Mac ARM64 | Evidence |
|---|---|---|---|
| 1 | Both tabs visible immediately | PASS / PASS | TZ7 empty-start GUI; permanent-tabs unit |
| 2 | FP works without BIO | PASS / PASS | Existing generator GUI plus standalone workspace tests |
| 3 | BIO without FP | PASS / PASS | TZ7 empty-start GUI; requests/issued remain empty integration |
| 4 | FP generation preserves BIO | PASS / PASS | TZ7 two-direction GUI; independent workspace integration |
| 5 | BIO generation preserves FP | PASS / PASS | Exact lastCard equality in GUI/integration |
| 6 | Independent clear | PASS / PASS | Both directions in GUI; history and pointer integration |
| 7 | Tabs retain edited fields | PASS / PASS | In-flight/autosave GUI and coordinator unit |
| 8 | BIO autosave | PASS / PASS | Actual IPC/SQLite GUI, failures/retry, revisions/rollback integration |
| 9 | Restart restores both | PASS / PASS | Native application quit/relaunch GUI, own parameter drafts |
| 10 | Legacy records open | PASS / PASS | Repeated GUI opens, original JSON unchanged, 0→1 lazy independent records |
| 11 | Copy buttons | PASS / PASS | All seven BIO values, FP national phone/full set, shared menu source switching |
| 12 | Wide/narrow | PASS / PASS | Both tabs at 360/390/427/480/504/576/768/980/1280px; actual Electron window bounds |

## Data and acceptance limits

The existing 55-record sourced institution catalog is unchanged. Coverage is limited; all eight country hubs, covered bundled localities and sparse-town empty states are tested. This does not establish exhaustive city coverage or fresh live verification of every institution. Regional choices retain their actual city; no invented organizations or inferred employment claims.

BIO country/city/theme controls describe the next generation. Regenerating one saved result field uses that result's saved geography/theme. Clearing retains history. Old attached BIOs are not rewritten or removed.

Developer ID signing, Apple notarization, Gatekeeper behavior on the owner's downloaded copy and owner acceptance are not established by CI. Existing dictionary/public-provider limitations remain in prior verification reports; this task does not relabel them PASS.

## Independent review and regression fixes

Fresh whole-branch review identified a startup failure for legitimate old FP records with disabled city. A real SQLite regression reproduced `INVALID_BIO_PARAMETERS`; read-only legacy normalization now retains blank city and exact original FP JSON. The legacy installed-app GUI fixture also disables city.

A cross-country history transition briefly retained old city/postal suggestions. Delayed real IPC GUI reproduced 504 stale options; workspace replacement now clears them before loading the matching country. Existing request epochs reject late responses. This was treated as a data-integrity issue because a stale hidden postcode could affect organization matching.

Both regressions were observed failing before fixes and passing afterward. Normal quit during pending standalone generation is covered; committed writes are atomic, but forced termination can lose keystrokes still inside the debounce interval.

## Native delivery

[Successful workflow 43501437897](https://github.com/STI-MRKT/Blego/actions/runs/43501437897), Mac job `132148181378`, artifact `14074603411` (expires 2026-11-18 20:40:53 UTC). Downloaded artifact SHA-256 and ZIP CRC/path checks verified. Installer ZIP's own DMG, checksum and instruction bytes independently matched the verified extracted files.

Environment: macOS **15.8.2 (24H232)**, Darwin24.6.0, **arm64 / Apple M1 (Virtual) / VirtualMac2,1**, Node24.22.1. Evidence: [host](native/macOS-env.txt), [native runtime](native/native-darwin-arm64.json), [installed app](native/installed-darwin-arm64.json), [38-test GUI log](native/installed-darwin-arm64.json.log.txt), [unit/integration log](native/verification-native.log.txt).

Actual commands/gates in `.github/workflows/blego-macos-qa.yml`:
```sh
bash scripts/prepare-metadata-darwin.sh
node scripts/check-metadata-native.cjs --target darwin-arm64 --root build/metadata-runtime/darwin-arm64 --report release/native-darwin-arm64.json
npm run verify
npm run dist:mac -- --arm64
# DMG mounted read-only with hdiutil; BLEGO.app copied with ditto outside checkout.
node scripts/check-installed-app.cjs --executable "$RUNNER_TEMP/BLEGO-qa.app/Contents/MacOS/BLEGO" --report release/installed-darwin-arm64.json
BLEGO_EXECUTABLE="$RUNNER_TEMP/BLEGO-qa.app/Contents/MacOS/BLEGO" node scripts/check-metadata-ui-batch.cjs
BLEGO_GUI_FOLDER_COUNT=20 BLEGO_EXECUTABLE="$RUNNER_TEMP/BLEGO-qa.app/Contents/MacOS/BLEGO" node scripts/check-metadata-ui-batch.cjs
```

Native GUI date/GEO exports: **20/20 individual photos in 10.733s**, **20/20 folder photos in 11.731s**; originals, actual output counts and progress checked. These GUI fixtures are 12×8 RGBA PNG, not maximum-size stress. Separate real photograph JPEG/PNG/WebP derivatives at 6000×2696 passed date/GPS readback, original hashes and pixels ([report](native/real-photo-candidate.json)). The requested 20-photo scope is retained; prior larger-batch limitations are not erased.

Installer ZIP SHA-256:
`5b5bd4f6c4ca7aa7c5b4c45928c1a794d6eeff8e4111859798fe25ce5627b037`

DMG SHA-256:
`909f866f84066ffbede4b7d907f46e10026a3f5ab5a6a20e596669f5e77d2c20`

Outer QA artifact SHA-256:
`84e319f7fda56434bec4be1560cee1db3255d5323ed972befb40339181795350`

Delivery copy: `BLEGO-1.4.1-TZ7-arm64-80b36de.zip`,150,748,753 bytes; byte-identical to CI's installer ZIP. [Artifact metadata](native/artifact.json), [installation instructions](../v141/INSTALL-RU.txt).

## Visual and timing evidence

[Original FP](native/ux-original-generator-1280.png) · [baseline1.4 FP](native/ux-baseline14-generator-1280.png) · [candidate FP](native/ux-candidate-generator-1280.png) · [BIO wide](native/bio-wide.png) · [BIO360](native/bio-360.png).

Actual Mac window resizing covers 360/390/427/480/504/576/768/980/1280px ([report](native/responsive-native.json)). Host work area 1024×684; screenshots reflect native height constraints. Comparison screenshots use matched renderer viewports. BIO fields below the fold remain reachable through normal vertical scrolling. Visual inspection confirms the original FP card/avatar and palette; the new permanent tabs and separate BIO form are intentional changes.

Three-launch medians on the same host ([raw observations](native/ux-performance-darwin.json)); original is 6e57eab, baseline1.4 is 95b80ff, candidate 80b36de. This is not a scientific cold-cache or all-hardware benchmark.

| Measure, ms | Original | Baseline1.4 | Candidate |
|---|---:|---:|---:|
| Launch |1166|1317|1008|
| FP generation |911|281|190|
| Frame interval p95 |18.7|21.5|18.7|
| Import1000 synthetic text rows |not measured|250|304|
| Archive |not measured|685|776|
| Map |not measured|282|266|

Import/archive observations are slower than this baseline sample; no claim of universal performance improvement. The 1000 figure here is text rows in the unchanged comparator, not a photo-batch target.

## Remaining limits

- Owner acceptance: **PENDING**. No merge or official release.
- Distribution signing/notarization/Gatekeeper on a downloaded owner copy: **BLOCKED / not supplied**. CI launch is not proof of unrestricted installation on another Mac.
- Other macOS versions and physical owner hardware: **NOT VERIFIED**. Configuration advertises 13+, but this embedded runtime was built/tested on 15.8.2; that does not establish 13/14 compatibility.
- Institution coverage remains limited to the existing sourced catalog. Missing matches remain blank; no exhaustive new city coverage claimed.
- Public Facebook observation remains **BLOCKED / UNKNOWN / INSUFFICIENT_EVIDENCE**. One OSM tile transport/cache/installed rendering observation passed ([report](native/public-services-native.json)); neither result is a general provider acceptance claim.
- Forced process termination before debounce completes can lose the latest unwritten keystrokes. Normal close/quit and committed SQLite transactions are covered.
- Automated file-dialog choices use synthetic fixtures; all real OS permission/window-manager combinations remain unverified.

No review findings deferred as minor: both reported defects were reproduced and fixed; broader native/GUI evidence was collected by the executor rather than inferred from review.

## Changed files relative to the base

```text
.github/workflows/blego-macos-qa.yml
docs/plans/BLEGO_TZ07_FP_BIO.md
docs/specs/BLEGO_TZ07_FP_BIO.md
docs/verification/tz7/REPORT.md
docs/verification/tz7/native/SHA256SUMS-mac.txt
docs/verification/tz7/native/SHA256SUMS-zip.txt
docs/verification/tz7/native/artifact.json
docs/verification/tz7/native/bio-360.png
docs/verification/tz7/native/bio-wide.png
docs/verification/tz7/native/installed-darwin-arm64.json
docs/verification/tz7/native/installed-darwin-arm64.json.log.txt
docs/verification/tz7/native/macOS-env.txt
docs/verification/tz7/native/metadata-load-baseline14.json
docs/verification/tz7/native/metadata-load-candidate-manual.json
docs/verification/tz7/native/metadata-load-darwin.json
docs/verification/tz7/native/metadata-ui-batch-darwin.log.txt
docs/verification/tz7/native/metadata-ui-folder20-darwin.log.txt
docs/verification/tz7/native/native-darwin-arm64.json
docs/verification/tz7/native/public-services-native.json
docs/verification/tz7/native/real-photo-baseline14.json
docs/verification/tz7/native/real-photo-candidate.json
docs/verification/tz7/native/responsive-native.json
docs/verification/tz7/native/ux-baseline14-generator-1280.png
docs/verification/tz7/native/ux-candidate-generator-1280.png
docs/verification/tz7/native/ux-original-generator-1280.png
docs/verification/tz7/native/ux-performance-darwin.json
docs/verification/tz7/native/verification-native.log.txt
docs/verification/v141/INSTALL-RU.txt
electron/features/generator/biography-workspace.cjs
electron/features/generator/biography.cjs
electron/features/generator/service.cjs
electron/main.cjs
shared/copy-sources.mjs
src/js/main.js
src/js/services/biography.js
src/js/state.js
src/js/ui/biography.js
src/js/ui/generator.js
src/js/utils/copy-actions.js
tests/integration/biography-workspace.test.cjs
tests/integration/generator-bio.test.cjs
tests/ui/generator-bio.test.cjs
tests/unit/biography-autosave.test.cjs
tests/unit/biography-v141.test.cjs
tests/unit/generator-independent.test.cjs
```
