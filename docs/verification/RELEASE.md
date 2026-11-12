# A7 — actual verification and remaining release gates

Date: 2026-11-12. Environment: Codex Cloud, Linux x64, kernel 6.18.57.
Initial HEAD and final fetched origin/main:
`6e57eabfb5b51af4475b90686fa580b5ce57e9b0` (unchanged).
Work branch: `codex/blego-local-v1`. No local PC access. Initial worktree clean;
no other person's work was reset or overwritten. Supplied TZ/plan match their
uploaded originals byte-for-byte. Existing CSS files are unchanged.

A0–A6 functionality and available A7 checks are implemented. **This is not a
completed macOS/Windows release and not a completed subject classifier.**
A35/A8 remains deferred. `rules_pending` cannot be confirmed or archived.

## Commands and observed outcomes

| Check | Actual result |
|---|---|
| `npm ci` | PASS; 306 packages installed from committed lockfile |
| `node node_modules/electron/install.js` | PASS using supplied Cloud proxy and writable caches |
| Electron runtime probe | 45.3.1, embedded Node 24.22.2, SQLite 3.53.4; open/query/close PASS |
| Host test runtime | Node v24.22.1, npm 11.9.0 |
| `npm run lint` | PASS; syntax + git diff whitespace + Prettier checks |
| `npm run test:unit` | PASS; 20 tests |
| `npm run test:integration` | PASS; 34 tests |
| `BLEGO_HEADLESS=1 npm run test:ui` | PASS; real Electron workflow with temporary data and restart |
| `node scripts/baseline-diagnostics.cjs` | PASS; all 3 original importer regressions |
| `npm run dist:linux` | PASS; unsigned Linux x64 tarball produced |
| Packaged Electron GUI workflow | PASS; same all-field copy/error/import/test ZIP/restart scenario against release/linux-unpacked/blego |
| `check-package.cjs` | PASS; required resources, fixture/data exclusion and application file byte comparisons |
| `npm run dist:mac` on Linux | FAIL / platform blocker: DMG generation requires `sips` (ENOENT); no finished DMG |
| `npm run dist:win` on Linux | FAIL / tool blocker: NSIS stage requires `wine` (ENOENT); no finished installer |
| macOS installed arm64/x64 checks | NOT_RUN: no macOS executor |
| Windows installed x64 check | NOT_RUN: no Windows executor |
| Signing/notarization | NOT_RUN: no certificates/Apple credentials; no OS protection bypass |
| Real user proxy / reputation vendor | NOT_RUN / not configured; controlled fixtures only |
| Final journal list | DEFERRED; editable legacy examples only, default disabled |

All build commands explicitly use `--publish never`.

Verified Linux artifact: `release/BLEGO-1.1.0-x64-linux.tar.gz` (120,564,174 bytes).
SHA-256: `9ccebb42e7430cd7dd4ec9c0c9dc785032b99ccbc6f2effac55aaba61bc32c1f`.
Packaged app.asar (2,724,588 bytes):
`b0118bda0b01e3e8ccc0aca3f2004099ab9df717acf4acd0e494f31aef7292f0`.
Checksums also saved in ignored `release/SHA256SUMS.txt`. Build artifacts are not
committed or published. Cross-packaged macOS app folders and Windows unpacked
files are untested intermediates. The incomplete NSIS output is renamed
`.exe.incomplete` to prevent presenting it as a usable installer.

GUI checks cover selecting country/type, generating, copying every field and
the ordered full set, actual system clipboard reads, saving symbols, importing
Cyrillic TXT as rules_pending, copying its source, opening a TEST-ONLY ZIP,
restarting and preserving the card/settings/archive, and injected async native
clipboard failure with no success toast. The UI test blocks/records non-loopback
renderer requests; it is not a packet-capture claim about Electron internals.
Disabled-module backend tests verify no news fetch and explicit proxy gating.
Screenshots are in ignored `artifacts/`; they contain only generated fixtures.

## Corrections found during A7

- A regression test reproduced insufficient numeric manifest validation;
  numeric counts/source sizes/offsets now reject malformed metadata before UI.
- Electron 45 clipboard methods return Promises. The previous synchronous mock
  did not model that API: actual writes succeeded but UI falsely reported a
  failure. Async success/failure tests were added before the fix; main now awaits
  both write and read-back. GUI additionally checks notifications.
- GUI initially waited for a responsive-layout-hidden logo. It now exercises
  real controls and waits for the window before setting test bounds. Initial
  no-X11/headless timeouts remain recorded in stage reports, not relabeled PASS.
- Added end-of-day archive filtering, catalogue pagination, immutable date/name
  checks, local-pool overlap handling, all-field copy, and deletion/registry
  regression coverage. BR synthetic national phone width corrected to 11 digits.
- Unavailable archive roots produce recovery notices while preserving files;
  they do not force a new empty service database.
- New modules/test code were formatted for review. The product CSS/style system
  and unrelated Photos/Friends/Checker functionality were retained.

## Acceptance A01–A35

PASS below means the stated scoped check actually ran. A platform-specific or
real-provider check cannot be inferred from a local fixture.

| ID | Status | Evidence / scope |
|---|---|---|
| A01 | PASS | Linux headless Electron, local generator/import/test archive; no account; disabled modules |
| A02 | PASS | Every one of 24 presets resolved and actually issued mandatory contacts |
| A03 | PASS | Distinct type dictionaries and initial field ordering; GUI country/type selection |
| A04 | PASS | Store reopen preserves country/type/order/symbols; GUI settings restart |
| A05 | PASS | 10,000 synthetic-capacity issues, reopen after 5,000, distinct ID/email/phone |
| A06 | PASS | Single-value dictionaries and explicit local pool exhaustion; transaction rollback |
| A07 | PASS | Parallel/same-clock requests and idempotent operation retry |
| A08 | PASS | Clear card and delete ZIP leave issued registry intact |
| A09 | PASS | GUI copies all fields and complete ordered set; native clipboard comparison |
| A10 | PASS | Async clipboard failure tests and actual Electron failure injection, no success toast |
| A11 | PASS | JSON field at record 51 retained |
| A12 | PASS | Conflicting headers, extra cells, nested values retained with diagnostics |
| A13 | PASS | Unclosed quotes rejected; BOM/CRLF/multiline/UTF16/CP1251 fixtures and Cyrillic GUI |
| A14 | PASS | Duplicates and non-object records accounted for with raw values/locations |
| A15 | PASS | Production null rules produce rules_pending; no confirmation or archive |
| A16 | PASS | Explicit TEST-ONLY fixture rules account for processed + unresolved |
| A17 | PASS | TEST-ONLY ZIP byte comparison and full Electron restart/open |
| A18 | PASS | Same source / fixed processing time creates distinct UUID filenames |
| A19 | PASS | Concurrent saves of one operation produce one catalogue entry / ZIP |
| A20 | PASS | Last-opened changes after verified open; timezone change does not rename |
| A21 | PASS | Injected pending/write/before-finalize/after-finalize/ENOSPC failures, actual EACCES export, cancellation; no real power-loss claim |
| A22 | PASS | Deleted catalogue rebuilt from valid manifests; last-opened stays unknown |
| A23 | PASS | Corrupt ZIP/CRC, traversal, symlink file and actual count/byte limits reject |
| A24 | PASS | Source copy off/on; exact source-byte comparison; input file never rewritten |
| A25 | PASS | Controlled HTTP/HTTPS/SOCKS5 with/without credentials, test CA verification and remote SOCKS hostname |
| A26 | PASS | 503+success, 429, invalid JSON, unsupported scheme reject |
| A27 | PASS | Delayed reputation adapter leaves transport timing and flag assessment unchanged |
| A28 | PASS | Missing/unavailable provider remains unknown; no green zero |
| A29 | PASS | Source success → partial failure → total failure → reopened persistent cache |
| A30 | PASS | RSS/Atom single quotes, Unicode, namespaces and unknown date fixtures |
| A31 | PASS | Disabled fetch/timer tests and offline local GUI; no OS-wide packet capture |
| A32 | PASS | Sender/frame/origin, URL/protocol/method, escaping, malformed metadata and archive path regressions; not an exhaustive security audit |
| A33 | NOT_RUN | Installed macOS arm64/x64 and Windows x64 unavailable in this Linux environment |
| A34 | PASS | Online backup, failed-migration rollback, store reopen and app restart; installed native upgrade remains NOT_RUN |
| A35 | DEFERRED | Customer subject rules/examples deliberately absent; no fabricated classification |

## Dependencies and security review limits

Runtime: fast-xml-parser 5.12.0, https-proxy-agent 9.1.0, socks-proxy-agent 10.1.0,
yauzl 3.4.0, yazl 3.3.1, all MIT. Embedded SQLite: public domain. Country data is
from the original repository; themes authored here. No external personal data.

`npm audit --omit=dev --json`: 0 reported runtime advisories on this date.
Full audit: 6 moderate build-chain package reports, no high/critical. Affected
packages: minimatch, @electron/universal, app-builder-lib, dmg-builder,
electron-builder, electron-builder-squirrel-windows. The underlying advisory is https://github.com/advisories/GHSA-g3hv-75wg-m249
(minimatch globparts amplification / denial of service). npm proposes downgrading
electron-builder to 25.1.0 for several paths; that incompatible automatic change
was not applied. This is residual build-tool risk, not a claim of full security.
No provider keys, user documents, SQLite databases, test TLS private keys,
installed dependencies or installers are committed.

Upstream minimum: Electron >=44 requires macOS 13+. Installed 26.18.0 builder
schema accepts the retained flat mac signing keys and minimumSystemVersion;
current website documentation also contains v27-only `mac.sign` migration
advice which was not blindly copied. Signing and entitlements remain unverified
on macOS. Sources: Electron breaking-changes, clipboard/security docs and
builder mac documentation; see README links and stage reports.

## Limits that remain visible

- Subject classification, final journal selection and reputation-provider keys
  are deferred; none blocks independent local work.
- Actual macOS/Windows build/install/run/signature/notarization gates are open.
- No global uniqueness guarantee, no guarantee synthetic phones are unassigned,
  no verified real-world address/delivery guarantee.
- Hard-link-capable archive filesystem required for no-overwrite finalization.
  Physical power-cut recovery was not tested. No automatic archive-directory
  migration tool is offered; choosing a root affects future archives only.
- Incomplete writes without a valid temporary ZIP require reprocessing; files
  are preserved and errors are visible. ZIP cannot recover generator history.
- GUI uses headless Electron's Linux test environment; it does not establish
  native macOS/Windows dialog, clipboard or installation behavior.

## Stage commits

| Stage | Commit |
|---|---|
| A0 baseline | 8214a8b |
| A0 separate Electron/tooling update | a8be2d8 |
| A1 | a5f0466 |
| A2 | 1c58d55 |
| A3 | 32f65c6 |
| A4 | 6da4829 |
| A5 | fd8b2f0 |
| A6 | 9701bac |
| A7 | Commit titled `build(A7): verify packaged workflow and document release gates` |

Review without applying: `git log --oneline --reverse 6e57eab..HEAD` and
`git show <commit>`. Each stage report contains its actual red/green checks and
limits. The final A7 report supersedes earlier unverified GUI/API assumptions.
