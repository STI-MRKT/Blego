# Addendum 01 — D0 baseline, 2026-11-12

## Preserved work and instructions

Cloud workspace: `/workspace/BLEGO`; branch: `codex/blego-local-v1`.
Entry HEAD: `211d2a2d745d6e149e9104cea678d45ccbac1458`.
Entry `git status --short --branch`: only `## codex/blego-local-v1` (clean).
No indivisible write/build operation was active. No user changes were removed.
No AGENTS.md was found in the workspace or repository. Original main is
`6e57eabfb5b51af4475b90686fa580b5ce57e9b0`; it is not a rollback target.
The existing ten development commits and their A-stage reports remain intact.

Both uploaded addendum documents were read and copied byte-for-byte to their
requested spec/plan paths. The original plan now includes D0–D7 as a continuation.
The uploaded documents are requirements, not evidence that their features work.

User overrides: generate female names only (D2); when actually extending subject
classification, ask for its parameters; absent source values remain empty.
No subject rules are inferred. `rules_pending` is not classification completion.
The UI style, store, issued-value registry and clipboard owner stay in place.

## Requirement map

`Extend` means the existing implementation is the sole starting point, not that
the additional requirements pass. `Create` refers to a missing responsibility
within that architecture. Paths are relative to this repository.

| Requirements | Current files / evidence | Action | Stages |
|---|---|---|---|
| EXT-01, EXT-05 | Git history, this report, existing A0–A7 reports | Preserved and checked | D0 |
| EXT-02, EXT-03 | `electron/local/store.cjs`, generator registry, classification service | Preserve; extend only scoped functions | A1/A2/A3, D0–D7 |
| EXT-04 | `electron/main.cjs`, settings, network services | Extend explicit network controls to FB; local images | A1/A5/A6, D3–D5/D7 |
| EXT-06 | This map, source counts, future acceptance ledger | Retain targets and report deficits | D0/D2/D7 |
| POOL-01, POOL-02 | `resources/generator/countries/*.json`, `types/*.json` | Extend all eight countries and 24 presets; female-only | A2/D2 |
| POOL-03, POOL-15 | `electron/features/generator/sources.cjs` capacity | Extend used/remaining counts and limiting reasons; create catalog | A2/D2 |
| POOL-04, POOL-05 | Generator resource README/schema and `sources.cjs` | Extend dataset metadata, licenses, normalization and transliteration | A2/D2 |
| POOL-06, POOL-07 | Generator service and type JSON (three bios/statuses) | Extend actual thematic/localized structures and counts | A2/D2 |
| POOL-08 | `electron/local/settings.cjs`, `src/js/ui/settings.js`, override validation | Extend via validated package preview/apply; JSON/ZIP import missing | A1/A2/D2 |
| POOL-09, POOL-10 | `electron/features/generator/service.cjs` | Extend email/handle templates; preserve registry | A2/D2 |
| POOL-11, POOL-12 | Country places, phone prefixes/digits; generator service | Extend documented synthetic geography/phone capacities | A2/D2 |
| POOL-13, POOL-16 | `registry.cjs`, `service.cjs`, store transactions | Preserve and regression-test upgrades/exhaustion | A2/D2/D7 |
| POOL-14 | Settings `allowRepeats`, generator sources | Extend explicit bulk-mode consent, preserve strict contacts | A1/A2/D2 |
| POOL-17 | `tests/integration/generator-registry.test.cjs` | Extend actual source-quality report separately from synthetic 10k test | A2/D2 |
| FB-01, FB-02, FB-03 | `src/js/services/checker.js`, `ui/checker.js`, `/api/fb/check` | Replace misleading legacy interpretation with honest diagnostics | D3 |
| FB-04, FB-05, FB-06, FB-07 | Legacy `parseIds`, server fetch | Extend exact parsing; create bounded target-specific transport | D3 |
| FB-08, FB-09 | Legacy status model/UI | Extend result contract and evidence interpretation | D3 |
| FB-10 | Existing external-URL IPC, same local store | Extend safe opening and separate manual-note history | A1/D3 |
| FB-11, FB-12, FB-13 | Legacy three-worker checker queue | Replace queue within same checker; rate/size/timeout/cancel controls | D3 |
| IMG-01, IMG-02, IMG-03, IMG-04 | `src/js/ui/photos.js` upload/preview only | Extend Photos; create metadata engine, policy and field plans | D4 |
| IMG-05, IMG-06, IMG-07, IMG-08, IMG-09, IMG-10 | No current metadata editing | Create protected-tag/duplicate/privacy/provenance policy | D4/D5 |
| IMG-11, IMG-12 | Photos limit 50; no metadata plan model | Extend queue/preview with specified resource limits | D4/D5 |
| IMG-13, IMG-14, IMG-15, IMG-16 | Archive no-overwrite export patterns; no image exporter | Create image-specific verified-copy export and reports | D5 |
| IMG-17 | Existing archive service and classification contracts | Preserve archive types; keep image export separate | A4/D5/D7 |
| IMG-18, IMG-19 | `electron/main.cjs`, package build configuration | Create restricted engine adapter; package/license/execute dependencies | D4/D5/D7 |
| COPY-01, COPY-03, COPY-04, COPY-05, COPY-06 | `electron/local/ipc.cjs::copyText`, `src/js/utils/clipboard.js` | Extend with one shared model serializer; no second clipboard | A1/D1/D6 |
| COPY-02, COPY-07 | `src/js/main.js`, existing UI modules | Extend field actions, focus, local keyboard and sequential copy | D6 |
| COPY-08 | Photos preview, main-process clipboard | Add typed image copy, distinguish file export | D6 |
| COPY-09 | Existing awaited write/read-back and restricted IPC | Preserve ownership and truthful failures | A1/D1/D6 |
| COPY-10 | Current limit is 4 Mi characters | Replace with exact 10 MiB UTF-8 preflight, no partial write | D1 |
| COPY-11 | Proxy vault/report, upcoming image metadata model | Explicit allowlist/redaction, deliberate sensitive-field action | A5/D1/D6 |

Target contract mapping: `generateProfile` and `copyText` already exist and will
be extended. `getPoolStats` and `importPoolPackage` belong to the existing generator;
`normalizeFacebookTargets`, `checkFacebookTargets`, `saveFacebookManualNote` extend
the checker. `readImageMetadata`, `planMetadataChanges`, `applyMetadataPlan` extend
Photos through main-owned tokens. `serializeCopy` is shared formatting only;
`copyImage` extends the current main-owned clipboard. There will be no second DB.

Pre-flight dependencies: D1 supplies the payload used by D3/D4/D6; D2 keeps the A2
profile contract; D4 creates main-owned plans consumed by D5; D6 consumes actual
models from these stages; D7 verifies all stages and packaged resources.
Ruling: the plan's proposed `electron/local/clipboard.cjs` is mapped to the existing
`electron/local/ipc.cjs::copyText`; moving it is not needed to add formatting.
Ruling: user overrides are recorded separately; supplied spec/plan bytes remain
unaltered, and their older instruction never to ask classifier questions is
superseded only when classifier work is reached.

## Checks actually run

On 2026-11-12 in this Linux Cloud workspace, with the existing dependencies:

| Command | Result |
|---|---|
| `npm run verify` | PASS: syntax/whitespace/Prettier, 20 unit and 34 integration tests |
| `BLEGO_HEADLESS=1 npm run test:ui` | PASS: one real Electron offline workflow, native clipboard, pending import, ZIP and restart |

Logs: `/tmp/blego-addendum-d0-verify.log`, `/tmp/blego-addendum-d0-ui.log` (Cloud
scratch files; do not contain user documents). No new build, native Windows/macOS
run, signing, metadata write or live Facebook check was performed in D0.
E01 passes for preserved work and mapping. E32 passes for the baseline only;
D7 must rerun after implementation. Other E items remain unverified for this
addendum, even where A-stage tests cover part of the behavior.

## Git destination requested by user

The user explicitly authorized copying history and new work to
`https://github.com/STI-marketing/Blego`. Local remotes now point to:

- `origin`: `https://github.com/STI-marketing/Blego.git` (intended development destination).
- `upstream`: `https://github.com/Kinetic58/BLEGO.git` (preserved source).

Reading upstream works. No remote branches were overwritten or deleted.
The destination was unavailable to both the Git transport (403) and GitHub API
(404). An authorized attempt to create a private repository using
`gh repo create STI-marketing/Blego --private` failed with `CreateRepository`
permission denial. After the user's access confirmation, actual read and
`git push --dry-run origin codex/blego-local-v1` still failed with 403.
`gh api user` identifies STI-marketing, while `gh api user/installations` exposes
`chatgpt-codex-connector` only for account STI-MRKT (repository selection: all).
These observations do not prove the destination does not exist; it may be private
and outside the authorized installation. The exact repository/installation needs
to be accessible before transfer. This is a GitHub permission failure, not an
automatic approval-review rejection. No credentials were requested or logged.

After access is repaired, first inspect/fetch destination refs. Push `main` from
the preserved source and `codex/blego-local-v1` only if safe fast-forwards or absent.
Do not force-push or overwrite an independently initialized destination. Verify
remote SHA equality after sending. Development continues on the same working
branch; transfer must not be reported complete before that verification.

### Destination correction from the user

The user subsequently requested creating the repository in the connected
organization STI-MRKT. The current intended origin is therefore
`https://github.com/STI-MRKT/Blego.git`; upstream remains unchanged.
Creation was actually attempted with `gh repo create STI-MRKT/Blego --private`
and REST `POST /orgs/STI-MRKT/repos` with `private=true`. Both were rejected:
`Resource not accessible by integration` (REST HTTP 403). The installation reports
`contents: write`, no administration permission. No repository was created by
these calls and no commits were uploaded. A GitHub organization member with the
necessary rights must create an empty repository and expose it to the existing
installation before a push can proceed. No additional verbal authorization or
secret shared in chat can change these GitHub permission checks.

D0 commit: `fa38d97`. This subsequent correction only changes the intended Git
destination and handoff record; application code and the supplied documents are
unchanged. All A-stage commits and D0 remain in the current branch. A new
self-contained bundle is prepared at `/workspace/BLEGO-STI-MRKT-transfer.bundle`
outside the repository; it includes `main` and the working branch, not ignored
build outputs or user storage.
