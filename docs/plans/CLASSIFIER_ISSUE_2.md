# BLEGO issue 2 implementation plan

> Execute sequentially with superpowers:executing-plans; tests before implementation and regression checks after each stage.

Goal: classify local synthetic records into 11 columns, preserve exact per-row cookies and existing graphics.
Architecture: extend the existing importer and worker; retain the classification service, clipboard IPC, archive and SQLite. Add a pure production schema module and an explicit seven-field copy adapter. No network or new persistent secret store.
Spec: https://github.com/STI-MRKT/Blego/issues/2
Base: 44b3fe63d25a2ca6626d69767b6e83e2cd51ed55 (remote HEAD checked 2026-11-12; Mac run 43299393012 success).

## Constraints
- Exactly rowNumber, fullName, accountId, password, emailPassword, email, birthDate, geo, userAgent, token, cookies, in this order; 50 rows/page.
- Preserve missing values, IDs and cookie text. No credentials inferred by length or punctuation. No cookie ownership transfer.
- Only seven agreed fields in mass copy/export; formula safety; global secret restrictions remain.
- Existing graphic resources, navigation, generator/news/photos/proxy unchanged. Synthetic fixtures only.
- Mac ARM64 native runtime, DMG and installed GUI gate must all pass before QA artifact upload. No merge/release.

## Review focus
1. Duplicate aliases/JSON keys and two plausible emails must not silently overwrite.
2. Mixed delimiters inside JSON or escaped quotes must not split logical records.
3. Cancel/reset/reclassify races must not restore discarded sensitive data.
4. Unknown and invalid values remain traceable without entering reports or default archives.
5. Sorting/filtering/pagination must keep stable IDs and copy the intended original value.

## Stage 1 — schema / recognition
- [ ] Add failing tests in tests/unit/classifier.test.cjs and importer regressions for explicit headers, selected headerless schemas, JSON source slices, dates, ambiguity, duplicate aliases, ID precision, empty positions and delimiters.
- [ ] Extend shared/importer.mjs with opt-in classification parsing options; add shared/classifier.mjs exposing CLASSIFIER_FIELDS, CORE_FIELDS, classifyRecords(parsed, options).
- [ ] Run focused tests and npm run verify; commit.

## Stage 2 — model / worker
- [ ] Integration tests for production preview, stable IDs, paging/filter/sort, remap, cancellation, confirmation and sanitized archive result.
- [ ] Worker runs classification; service holds one existing operation model, exposes page/cell/export/reclassify. Explicit confirmation retains existing archive contract; default result excludes cookie/token/UA and unknown raw text.
- [ ] Run integration and npm run verify; commit.

## Stage 3 — UI
- [ ] GUI test for fixed columns, compact long values, mapping/schema selection, sorting/filter and clear; reproduce failures before implementation.
- [ ] Update existing import view/handlers only, add minimal local CSS if needed using current variables. No full values in attributes.
- [ ] Run verify and GUI; commit.

## Stage 4 — copying
- [ ] Test exact cookie copy (12/1000/10000 chars), empty disabled, correct record across pages, seven-field TSV/CSV with formulas escaped.
- [ ] Reuse copyText IPC; introduce explicit classifier copy model without relaxing import/global redaction.
- [ ] Run verify and GUI; commit.

## Stage 5 — review / native QA
- [ ] Whole-branch independent review, fix important findings with failing regression tests.
- [ ] Run complete suite, visual comparison; include classifier GUI in installed-app gate, mount DMG and run copied app outside checkout.
- [ ] Push feature branch, trigger existing Mac QA workflow; collect SHA, checksum, OS, artifacts and per-requirement status.
- [ ] Create review PR against UX base, attach PR, do not merge.

## Progress / decisions
- Existing cloud worktrees and untracked v13 reports untouched; isolated /workspace/BLEGO-classifier.
- Headerless schema is selected explicitly, never guessed from column count. Cost: one extra selection for ambiguous files; prevents password/cookie swaps.
- Archive remains explicit. Unrecognized source values stay in session memory; default persisted result contains only seven agreed fields, no raw unresolved secret values.
- Stage 1 complete: focused importer/classifier 11/11; verify lint PASS, unit 50/50, integration 71/71. RED reproduced row splitting and missing classification; first verify attempt overlapped the next unformatted test and failed formatting; stage-isolated rerun passed. Logs: /tmp/blego-classifier-stage1-*.log (cloud session only).
- Stage 2 complete: worker/model integration 7/7; verify lint PASS, unit 50/50, integration 75/75. Production read applies versioned rules; test-only direct classifyDocument path retained solely for existing archive fixtures. Unknown rows require partial confirmation. No input secrets in default result/diagnostics/unresolved archive payload.
