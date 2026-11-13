# Issue #4 functional acceptance

This report applies only to the final-hardening candidate. Historical E01–E60 documents and previous builds are retained; their PASS results were not copied into this acceptance. Real-source evidence is separated from controlled fixtures. Every credential-like value used in tests is synthetic. No application release or merge was performed.

## Functional criteria

| Criterion | Result | Evidence / practical limit |
|---|---|---|
| Original shell, protected palette/assets/CSS and gauge/cards | PASS (visual inspection) | Original/candidate screenshots at 1280×900 and 980×720; protected resources unchanged. Dynamic Mac observations are reported separately below. |
| HTTP/HTTPS/SOCKS5/SOCKS5h, auth/no-auth, wrong auth | PASS (controlled transports) | Real loopback TCP/TLS/CONNECT/SOCKS servers and HTTPS echo; temporary test CA, no production TLS bypass. Both SOCKS forms use remote destination DNS. |
| Exit IP from selected route; local quality and explicit bounded speed | PASS (controlled transports) | Three echo attempts, separate TCP/sample metrics; null missing results; route download and no-provider opt-in tests. Quality formula in PROXY.md. |
| Private/service endpoint blocking, cancellation, redacted diagnostics | PASS | Integration and actual Electron cancellation tests; proxy input intentionally remains plain text. |
| Owner's external proxies / live IPv6 route | BLOCKED | No authorized external proxy endpoints supplied; fixture tests do not establish those routes. |
| proxycheck.io stable v3 risk → Trust | PASS (contract and real API) | Actual no-key 1.1.1.1 query: risk 33, confidence 100, Trust 67; response evidence in proxycheck-live.json. Explicit opt-in; exact-IP/range/freshness validation. |
| Provider malformed/null/mismatch/401/403/429/timeout and cancellation | PASS | Unit/integration assertions preserve unknown Trust and independent local quality. No API credentials in renderer/report. |
| Owner API key / actual Keychain consent workflow | BLOCKED (owner environment) | Existing safeStorage vault reused; plaintext fallback refused/tested. No owner key supplied. No-key mode verified. |
| News five topics, original cards and ≥20 distinct valid displayed links | PASS (point-in-time live sources) | Fashion 24, AI 20, Crypto 40, Finance 37, Tech 40. 17/17 endpoints HTTP 200; AI 2/3 sources supplied current relevant items. See news-live-gui.json and NEWS.md. |
| RSS/Atom limits, topic relevance, canonical dedup, cache, consent | PASS | Feed integration, selected-topic GUI, late reply and actual persisted SQLite restart/freshness checks. No all-topic/startup downloads. |
| Publisher permission for commercial redistribution | BLOCKED | Personal feed-reading references/declarations recorded; full reuse terms for several publishers remain unverified. No official/public release performed. |
| Facebook single/100 inputs, normalize, per-result copy, cancel/rate limits | PASS (controlled responses) | Real Electron interactions and bounded queue/transport tests; no BANNED/NOT_BANNED inference. |
| Real Facebook page availability acceptance | BLOCKED | Two anonymous official Meta URLs returned NETWORK_FAILURE from this cloud environment; honest results in facebook-live.json. |
| Photos quick date/GEO, zero/negative values, explicit keep/set/remove | PASS | JPEG/PNG/WebP actual native writes/readbacks; selected EXIF/XMP dates, offsets including fractional source dates, no hidden replacement values. |
| Photo preservation, previews, conflicts, groups, cancellation | PASS | Existing pixel/alpha/profile/orientation/hash gates plus GUI/export/group tests. Permission/full-disk faults are injected controlled cases, not a physically full Mac disk. |
| Photos 1/10/100 mixed-format load | PASS (Linux + Mac native) | Independent output tags/pixels/original hashes in metadata-load reports; tiny synthetic fixtures, not maximum-resolution acceptance. |
| Generator eight-country canonical phones and per-element copy | PASS | All eight country GUI assertions, category copy, avatar/card and saved history preserved; no deletion timer restored. Existing dictionary coverage limits remain. |
| Classifier 11 fields, leading zeros, empty fields, row-specific complete cookie | PASS | Existing classifier regression unchanged; native clipboard checks after sorting/filtering/pagination; 7-field export excludes cookie/token/UA. |
| Archive last navigation item; open/copy/TXT/ZIP/folder/delete/filter/sort | PASS | Real GUI plus archive/storage integration. Existing SQLite/ZIP formats retained; secondary diagnostics hidden initially. |
| Animation smoothness on a physical M1 | BLOCKED | VM frame samples recorded; candidate worst sample p95 34 ms versus original 25.3 ms. Cause is not isolated; no blanket smoothness/performance PASS. |
| Settings/history persist through restart | PASS | Storage rollback/reopen tests and actual Electron restart flows; tests use isolated stores. |

## Native build and performance

Native QA **PASS**, build SHA `09b2b504c4a448b4d7a28c651da0452dc489e15b`. [Workflow](https://github.com/STI-MRKT/Blego/actions/runs/43371554153) · [QA ZIP / DMG](https://github.com/STI-MRKT/Blego/actions/runs/43371554153/artifacts/14012822169) · [PR #5](https://github.com/STI-MRKT/Blego/pull/5). Artifact retention is five days. No release or merge.

Host: macOS 15.8.2 (24H232), arm64, VirtualMac2,1, Apple M1 (Virtual). This is a native Mac ARM64 runner, not the owner's physical Mac. Node 24.22.1; Electron 45.3.1. Actual commands:

```sh
npm ci
node node_modules/electron/install.js
bash scripts/prepare-metadata-darwin.sh
node scripts/check-metadata-native.cjs --target darwin-arm64 --root build/metadata-runtime/darwin-arm64 --report release/native-darwin-arm64.json
npm run verify
node scripts/check-metadata-load.cjs release/metadata-load-darwin.json
npm run dist:mac -- --arm64
# DMG mounted read-only; ditto copies BLEGO.app outside checkout into RUNNER_TEMP.
node scripts/check-installed-app.cjs --executable "$RUNNER_TEMP/BLEGO-qa.app/Contents/MacOS/BLEGO" --report release/installed-darwin-arm64.json
BLEGO_EXECUTABLE="$RUNNER_TEMP/BLEGO-qa.app/Contents/MacOS/BLEGO" node scripts/check-metadata-ui-batch.cjs
node scripts/check-ux-performance.cjs --original "$RUNNER_TEMP/blego-original-reference" --executable "$RUNNER_TEMP/BLEGO-qa.app/Contents/MacOS/BLEGO" --report release/ux-performance-darwin.json
```

Linux and Mac: lint PASS, **61/61 unit, 90/90 integration, 15/15 GUI**, zero failed/skipped. Mac GUI runs the actual installed binary outside checkout. Native date/GEO read-write-readback gate PASS. ZIP CRC and DMG hash independently checked after download. Test dialog selections and external failure scenarios are controlled fixtures; actual sources are independently recorded above.

DMG: `BLEGO-1.3.0-arm64.dmg`

SHA-256: `8e08972645970f319d6e9bd3ebe22c090ccadf0403afeaa43c368d2f7f547242`

After unzipping, run `shasum -a 256 BLEGO-1.3.0-arm64.dmg` and compare the hash above. The bundled checksum record retains the CI `release/` prefix; the artifact itself unpacks files at its root.

### Native date/GEO evidence

All batches wrote `2024-02-29T12:34:56-05:00`, latitude `0`, longitude `-73.987654`, altitude `0`. Independent reread, original hashes, decoded pixels/alpha and unchanged author passed for JPEG/PNG/WebP.

| Files | Read | Export | Total including independent verification |
|---|---:|---:|---:|
| 1/1 | 0.082 s | 0.316 s | 0.473 s |
| 10/10 | 0.902 s | 1.357 s | 3.008 s |
| 100/100 | 7.280 s | 13.511 s | 29.326 s |

Installed GUI exported 100/100 photos in **34.896 s**, with 100 progress rows and 128 ms maximum sampled event-loop gap. Fixtures are 12×8 synthetic images; this is not a maximum-resolution stress claim.

### Original / candidate timing

Three isolated launches per version; these are observations, not a cold-cache laboratory benchmark. Original checkout and installed candidate use the same Electron version.

| Version | Median launch | Median generation | Median frame interval | Frame p95 range |
|---|---:|---:|---:|---:|
| original | 1164 ms | 1786 ms | 16.7 ms | 18.8–25.3 ms |
| candidate | 1053 ms | 823 ms | 16.7 ms | 18.9–34.0 ms |

Raw samples and batch reports are retained in [native/](native/). First-launch and frame-time variance are visible; the candidate worst p95 sample (34 ms) exceeds the original worst sample (25.3 ms), and the cause is not isolated by this VM measurement; these measurements do not certify every animation or physical Mac responsiveness. Comparison PNG dimensions are asserted at 1280×900 and 980×720 using fixed renderer viewports because the virtual display clamps native window height. [Side-by-side images](VISUAL_COMPARISON.md). Owner UX acceptance and the external BLOCKED items above remain outstanding.


## Remaining priorities

- P1 external acceptance: owner's proxy routes, live IPv6, representative Facebook availability and owner Keychain interaction need the relevant authorized environment.
- P1 distribution: complete publisher reuse-rights review before commercial distribution; official release is outside this task.
- P2 frame pacing: profile the observed p95 outlier on a physical M1 before final smoothness acceptance.
- P2 performance breadth: large real-world image sets, physical M1 measurements, system permission denial/ENOSPC and user assessment remain distinct from synthetic automated QA.
- Follow-up only: Developer ID signing/notarization excluded by issue #4. Unsigned QA launch is not proof of frictionless Gatekeeper installation on every Mac. Do not disable system protection.
- Existing profile-dictionary coverage limitations are unchanged; this task does not certify every dataset as exhaustive.

Installation: download the successful QA artifact, unzip, verify the included SHA256SUMS file, open the DMG and copy BLEGO.app to an application folder. The build is unsigned; if macOS blocks it, record the message and use a future signed build/owner-approved assessment. Do not disable Gatekeeper. Start with synthetic data; try classifier exact cookie copy, per-field generator copy, explicit News loading, and date/GEO preview/export while retaining original photos.
