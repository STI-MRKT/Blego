# BLEGO ТЗ11 Implementation Plan

> Execute inline with superpowers:executing-plans / test-driven-development; one fresh independent whole-branch reviewer before final acceptance.

**Goal:** BLEGO1.4.3 QA: truthful Checker, structured TXT recognition, automatic consented Trust, simple safe Photos, separate BIO organization/city.
**Architecture:** retain existing Electron IPC/SQLite/services and public-request boundaries. Extend current recognition/model contracts and move advanced Photos controls into an explicitly opened secondary view. No new framework/storage or duplicate metadata/export engine.
**Tech Stack:** Electron45/Node24, vanilla renderer, SQLite, existing ExifTool.
**Spec:** docs/specs/BLEGO_TZ11.md (user supplied, authoritative).

## Global Constraints
Base91bc0c66f2eac47d6740f1f3657d7f51d13bee2b, branch codex/blego-v1-4-3-fixes. Preserve Friends7/all and News<=15, FP, archive formats, GEO sources/generation, dictionary and phone rules. No secrets in Git/logs/screenshots, no Meta bypass, no fake ACTIVE/BLOCKED or invented passwords. Native ARM64 installedApp tests required; mark external blocks honestly. No merge/release.

## Review Focus
- Delimiter-like syntax inside passwords, URLs, UA, JSON and paths must stay byte-exact and never leak between records.
- 2FA must not reach ordinary export/archive indirectly through raw source or auxiliary fields.
- Rapid photo changes, navigation, cancellation and stale plan replies must never export stale settings or overwrite originals.
- BIO manual edits racing suggestions must keep name/city/id paired without rewriting FP or historical rows.
- Persisted Trust refusal and renderer requests must never bypass backend consent or disclose proxy credentials.

## Task1 audit/baseline
Files: docs/specs/BLEGO_TZ11.md, this plan, docs/verification/tz11/baseline.
- [ ] Fetch and compare actual base/PR; preserve worktrees and uncommitted changes; create specified branch.
- [ ] npm ci; npm run verify; BLEGO_HEADLESS=1 npm run test:ui. Expected152unit132integration50GUI; record actual failures/counts before changing code.
- [ ] Inspect current interfaces and live Facebook without credentials; save only sanitized diagnostics. Commit audit.

## Task2 Facebook Checker
Files: electron/features/facebook/{inspect,transport,diagnostics,service}.cjs, src/js/ui/checker.js, shared/facebook-results.mjs where existing presentation resides; new tests/{unit,integration,ui}/facebook-v143.test.cjs; scripts/check-facebook-v143.cjs.
Interface: existing fetchPublicProfile(raw,{signal,request,maxBytes,deadline}) and inspectResponse(target,response), add bounded sanitized transport/evidence diagnostics without storing fullHTML. Preserve publicContent vs banAssessment distinction.
- [ ] RED controlled real-pattern publicPage evidence without mandatory PersonJSONLD; login/challenge precedence, contradictory identity, unavailable localized message; compressed/charset/truncated transport and source diagnostics.
- [ ] Minimal evidence rules tied to observed public representations; no arbitrary HTTP200 verdict. UI description exact supplied Russian, preserve copy/search/retry/cancel.
- [ ] GREEN targeted; real public tests record transport method/status/reason, BLOCKED if unavailable; fullverify/UI then commit.

## Task3 Classifier
Files: shared/classifier-{lexer,recognition,layouts}.mjs, shared/classifier.mjs, shared/importer.mjs, electron/features/classification/service.cjs; relevant copy/archive contract; new labelled synthetic fixtures and tests/{unit,integration,ui}/classifier-v143.test.cjs; scripts/check-classifier-v143.cjs.
Interface: preserve structuredRecords offsets/sourceEntries and discovery/mapping; add twoFactorCode confidential recognized field, explicit labels and confirmed schema roles. No fuzzy password guesses; schema confirmation through explicit labels/header or explicit user mapping for ambiguous bare tuples. Singlecolon and confirmed slash/backslash boundaries protect composite values.
- [ ] RED fixtures A/B/C +20spec cases; expected source exactness, ambiguity, conflict/provenance, no fabricated fields and no cross-account values.
- [ ] Extend existing lexer/group recognition minimally. Preserve multi-line/nestedJSON and old formats. Add manual role mapping for opaque unconfirmed positions.
- [ ] 2FA local recognition only, excluded from seven-field export AND persisted archive payload/source. Confirm original in-memory source retained; no blanket removal of other fields.
- [ ] GREEN labelled precision/recall/false assignments metrics; GUI copy/cookie collapse/archive; fullverify/UI then commit.

## Task4 Network
Files: src/js/{main,state}.js, src/js/ui/network.js, electron/local/settings.cjs (data default only, Settings UI unchanged), existing proxy IPC/service; tests/{unit,integration,ui}/network-v143.test.cjs.
Interface: persisted nullable proxyReputationConsent; first-use notification offers explicit grant/refusal. Proxy always checks ordinary connection; reputation request only with backend persisted grant and exitIP. Subsequent checks reuse choice, N/A on refusal/providerfailure.
- [ ] RED no checkbox; first-use approve/decline/restart, backend rejects unconsented renderer request; no proxycredentials to provider; independent connection quality.
- [ ] Remove checkbox markup/state dependency, reuse existing settings persistence/dialog/IPC. Keep speed explicit.
- [ ] GREEN controlled provider replies and real bounded observation; fullverify/UI then commit.

## Task5 Photos
Files: src/js/ui/photos.js, src/js/main.js, small renderer service helper if needed; existing tests/UI and scripts/check-metadata-ui-batch.cjs updated for new user flow; tests/ui/photos-v143.test.cjs.
Interface: existing applyImageForm/prepareImageExport/applyMetadataPlan retained; export coordinator prepares freshest authorized snapshot then applies only matching revision. Primary view excludes old panels; secondary tools view retains all existing group/preset/detail capabilities and storage.
- [ ] RED no listed technical panels in primaryDOM, save without Preview, implicit preparation after edits, stale plan/cancel/nochange/errors/retry only failed files.
- [ ] Primary Save runs current-plan validation safely, no export on nochange, progress/error in user terms. Secondary controls use existing handlers and restore drafts; no originaloverwrite.
- [ ] GREEN actual20files +20folder JPEG/PNG/WebP date/GPS readback/originalhashes; adapt older GUI navigation without removing checks; fullverify/UI then commit.

## Task6 BIO
Files: electron/features/generator/biography-workspace.cjs and narrow helpers in biography.cjs, src/js/ui/biography.js, src/js/services/biography.js, src/js/main.js. Do not change FP generation contract. Tests/{unit,integration,ui}/biography-v143.test.cjs.
Interface: standaloneBIO retains current strings and adds employerCity/universityCity/schoolCity plus organization identity metadata. Read adapter matches exact catalog/name/legacylabel; unmatched full label untouched, city empty. Persist only on explicit edit/generation, no destructive migration.
- [ ] RED separate exact copies/name withdash/NewYorkUniversity; regional actualcity, legacy/read/idempotence, regeneratepair, racing edits and restart.
- [ ] Extend standalone workspace normalization/validation; paired updates and revisions use existing editor/autosave. Catalog identity retained without trusting mismatched manual names.
- [ ] GREEN actualnativeclipboard/narrow/FPindependence; fullverify/UI then commit.

## Task7 regression/review/nativeQA/PR
Files: package.json/package-lock.json version1.4.3, existing macOSQA workflow and minimal QA scripts; docs/verification/tz11.
- [ ] Final fullverify/UI and scope diff; one fresh whole-branch reviewer, one RED→GREEN important-fix pass +fullsuite; ledger all findings/rulings.
- [ ] Push marked nativeQA candidate; runtime gate, DMG/mount/dittooutside, installedGUI +20photos/folder +performance identicalbase +realpublic Checker observations. No PASS from fixtures alone.
- [ ] Download checksum/CRCverify exact3member ZIP; screenshots/nativeclipboard/report; new draftPR against basebranch, attach, no merge/release. Signing/notary BLOCKED if unavailable.

## Ledger
Plan identity docs/plans/BLEGO_TZ11_PLAN.md. Base remote91bc0c6 verified, PR11draft/open/unmerged; local7460085 clean. Existing isolatedworktree retained; newbranch fromremote, no checkout/reset of oldbranch.
Preflight shared interfaces: main.js shared across5tasks, execute strictly sequential. Classification exact-source vs 2FAarchive privacy requires redacted persisted snapshot while preserving in-memory source. BIO independent workspace must not change FP producer. Photos secondary controls keep existing operations accessible for regression.
Ruling: detailed user spec authorizes implementation; developer autonomy supersedes redundant design/plan permission gates. Minimal existing architecture is the selected approach; wholesale rewrite or external classifier model violates constraints. Cost if wrong: routine UI placement choices may need review, no destructive actions.
Ruling: ambiguous unlabelled password/2FA tuples cannot be proven from syntax alone; preserve raw values and allow schema confirmation rather than fake confidence. Cost: manual clarification for inherently ambiguous input, as required by4.4/4.6.
Ruling: Photos advanced functions move to a secondary explicit view rather than being deleted, preserving groups/presets. Cost: one extra action for advanced users, primary flow becomes shorter.

Task1 complete: remote/base91bc0c6 verified, cleanworktree/newbranch, npmci/lint152unit132integration50GUI PASS (226.449s),0skips. Direct Node Facebook requests Meta/NASA ECONNREFUSED; configuredHTTPSroute receives actualNASA HTTP200523070bytes with OGidentity/description but no visible publicbody or Person/OrganizationJSONLD. Treat as dynamic shell requiring rendering, not ACTIVE. Currentparser also wrongly insists on PersonJSONLD for otherwise substantive publicPages; transport always UTF8 and stream abort diagnostics incomplete. No HTML or CDNqueryvalues persisted in evidence.

Task2 research: ordinary anonymous NASA HTML through configuredHTTPSroute has only OGpreview and clientJS, so PUBLIC_PREVIEW_ONLY remainsUNKNOWN. Isolated Firecrawl browser using basicproxy/noauth rejected unsupported_site403 before session creation; no CAPTCHA/login/bypass attempted. This is independent research, not applicationPASS. Native live probes remain required; positive/unavailable fixture outcomes cannot substitute.

Task2 complete: RED reproduced missing publicPage recognition, charset/stream handling and discarded original input. GREEN24 targeted, lint157unit133integration51GUI PASS/0skip (229.909s). Live Linux NASA/meta/zuck all FB_CONNECTION_REFUSED, positive public acceptance BLOCKED. Visible matching title+description+canonical evidence now supports publicPages without PersonJSONLD; preview-only HTML stays UNKNOWN. Compressed and declared-charset HTML is decoded with bounded streams and explicit failure codes. Original input and canonical target shown in details. Native live rerun pending.

Task3 complete: RED new separators/roles and 2FA original ZIP inclusion reproduced. GREEN24 labelled cases/27records, precision/recall1.0,0false assignments/0missing, per-field metrics recorded. Lint181unit134integration52GUI PASS/0skip (233.538s). New confirmed schemas A/B/C preserve empty positions and opaque values; unlabelled password tuples require explicit schema. Compatible repeated layouts accept numeric identity anchors; URLs/UA/JSON remain intact. 2FA is masked/copyable in record details and omitted from core7; archive rejects original inclusion for recognized 2FA, retaining exact in-memory source. Existing archive format unchanged. Header slash/backslash delimiters require whitespace framing to avoid splitting URL/path internals.
