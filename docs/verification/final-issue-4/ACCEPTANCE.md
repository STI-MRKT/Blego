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
| Photos 1/10/100 mixed-format load | PASS (Linux native); Mac result below | Independent output tags/pixels/original hashes in metadata-load reports; tiny synthetic fixtures, not maximum-resolution acceptance. |
| Generator eight-country canonical phones and per-element copy | PASS | All eight country GUI assertions, category copy, avatar/card and saved history preserved; no deletion timer restored. Existing dictionary coverage limits remain. |
| Classifier 11 fields, leading zeros, empty fields, row-specific complete cookie | PASS | Existing classifier regression unchanged; native clipboard checks after sorting/filtering/pagination; 7-field export excludes cookie/token/UA. |
| Archive last navigation item; open/copy/TXT/ZIP/folder/delete/filter/sort | PASS | Real GUI plus archive/storage integration. Existing SQLite/ZIP formats retained; secondary diagnostics hidden initially. |
| Settings/history persist through restart | PASS | Storage rollback/reopen tests and actual Electron restart flows; tests use isolated stores. |

## Native build and performance

Pending final Mac ARM64 run and artifact inspection. A queued/running workflow is not a PASS. Final SHA, commands, hardware, DMG checksum, installed tests, measurements and artifact link will be recorded here after completion.

## Remaining priorities

- P1 external acceptance: owner's proxy routes, live IPv6, representative Facebook availability and owner Keychain interaction need the relevant authorized environment.
- P1 distribution: complete publisher reuse-rights review before commercial distribution; official release is outside this task.
- P2 performance breadth: large real-world image sets, physical M1 measurements, system permission denial/ENOSPC and user assessment remain distinct from synthetic automated QA.
- Follow-up only: Developer ID signing/notarization excluded by issue #4. Unsigned QA launch is not proof of frictionless Gatekeeper installation on every Mac. Do not disable system protection.
- Existing profile-dictionary coverage limitations are unchanged; this task does not certify every dataset as exhaustive.

Installation: download the successful QA artifact, unzip, verify the included SHA256SUMS file, open the DMG and copy BLEGO.app to an application folder. The build is unsigned; if macOS blocks it, record the message and use a future signed build/owner-approved assessment. Do not disable Gatekeeper. Start with synthetic data; try classifier exact cookie copy, per-field generator copy, explicit News loading, and date/GEO preview/export while retaining original photos.
