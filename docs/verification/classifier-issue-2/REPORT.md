# Classifier issue #2 — verification ledger

Source requirement: [issue #2](https://github.com/STI-MRKT/Blego/issues/2), preserved in `docs/specs/CLASSIFIER_ISSUE_2.md`.
Base: `44b3fe63d25a2ca6626d69767b6e83e2cd51ed55`, remote HEAD of `codex/blego-ux-restoration-20261112` at start. Confirmed existing native run `43299393012` was successful. Separate branch: `codex/blego-classifier-next`. No edits to main, PR #1, or earlier worktrees/untracked reports.

## Implementation and tests

1. Schema/recognition (`f4e5e00`): fixed 11 fields; explicit header aliases, selected core7/full10/numbered11 layouts and column mapping; cautious email/date/ISO-country/UA recognition; exact JSON source slices and string IDs; local unresolved values. Focused 11/11, lint PASS, unit 50/50, integration 71/71.
2. Worker/model (`7a9d663`): production rules in existing worker, stable record IDs, 50-row pages, filter/sort, remapping, cancellation and existing confirmation/archive lifecycle. Focused 7/7, lint PASS, unit 50/50, integration 75/75.
3. UI (`b5850ee`): original table/copy components, fixed column order, compact long values, source/schema mapping and controls. Lint PASS, unit 50/50, integration 75/75, Electron GUI 6/6.
4. Copy (`c570f2d`): one-click exact cookie, explicit seven-field model, TSV/CSV formula protection and export, native clipboard readback and explicit archive. Lint PASS, unit 52/52, integration 75/75, GUI 7/7. Cookie lengths 12/1000/10000, sorting, filter, page 51, empty disabled, file/clipboard/archive verified. No real credentials or sessions used.
5. Independent final review: five important findings reproduced before fixes: ambiguous header auto-detection, renamed duplicate aliases, stale import-source copy snapshots after reset, prototype-named keys, heuristics overwriting explicitly empty fields. All focused reproductions now PASS (14 unit/integration; 2 GUI). A visual geometry test also reproduced copy buttons below cells; scoped inline-flex corrected placement.

Commands were run in Codex Cloud Linux 6.18.57, Node v24.22.1. Tool sandbox cannot run the test child processes/network fixtures correctly; tests ran in the approved outer cloud executor, never on the user's PC. No checks disabled. First attempts caught formatting warnings, stale structural-preview fixture and collapsed save disclosure; corrected causes and reran. Earlier red/green logs live at `/tmp/blego-classifier-*.log` for this cloud session only; final results and native evidence are recorded here/CI.

## Decisions and limits

- Headerless layouts require explicit schema selection; ambiguous header detection preserves the first row and offers headers Yes/No. The tradeoff is one extra choice for unusual named files.
- Production classifier archives deliberately exclude original input even if the legacy include-original preference is enabled. Seven agreed fields may include passwords only on explicit archive/copy/export action. Raw cookie/token/UA and unknown source remain transient; the cost is that archival output is not a full source backup.
- Unknown values are retained in memory; unresolved archive output stores record/location markers only. No new SQLite tables, registry, ZIP implementation, clipboard service, auth/session or network requests.
- Automatic GEO recognition is conservative ISO-3166 alpha-2; explicit GEO fields retain supplied text. Names, IDs, passwords and tokens are never guessed by length/punctuation.
- Individual clipboard and current formatted export payloads retain the existing 10 MiB ceiling; input parsing retains 50 MiB and bounded worker memory. Larger formatted results fail explicitly, never truncate.
- Two review minors deferred: mapping controls could explain precedence more clearly (explicit headers/schema win); diagnostics could show more actionable per-column/source locations on screen. Source and per-record unknown values remain accessible locally; ambiguous values are not silently assigned.
- Native QA/visual comparison were outside the read-only review; the parent owns these gates and records actual outcomes below.

## Visual evidence

`visual/original-generator-empty.png` and `visual/candidate-generator-empty.png`: actual Electron screenshots, 1280×900, dark theme, isolated temporary data; original SHA `6e57eab` versus candidate. Original shell, palette, components and typography remain recognizable. Existing base differences (localized copy, persistent profile model, separate News and Settings) are intentionally retained. This classifier branch does not change generator UI, protected original CSS or graphics. `visual/classifier.png` is the real new screen using synthetic names/IDs/example.com and empty sensitive columns, not a mockup. Functional tests verify formatted phone display and exact canonical clipboard digits, separate News and absent old timer behavior.

## Native candidate

Pending final gate execution; no PASS inferred from old runs. Workflow now mounts the generated DMG, copies BLEGO.app from that mounted image outside checkout and runs all eight GUI scenarios, with the native metadata runtime gate before packaging. QA upload remains success-only; unsigned, not notarized, no official release.

## Final local regression

`npm run verify`: lint PASS, unit **56/56**, integration **75/75**, zero failures/skips. `BLEGO_HEADLESS=1 BLEGO_CAPTURE_UX=1 npm run test:ui`: **8/8**, zero failures/skips. YAML parsed successfully. `git diff --check`: PASS. Base re-fetched before push: still `44b3fe6`.

| Issue requirement | Evidence | Status |
|---|---|---|
| Fixed eleven columns, stable record IDs, missing cells | classifier unit + production integration + GUI | PASS |
| TXT/CSV/TSV/JSON, empty positions, explicit headerless schemes, multiline JSON | classifier/importer unit | PASS |
| ID precision/leading zeros; conservative password/token assignment | classifier unit | PASS |
| Dates including impossible dates, email, ISO GEO, UA | classifier unit | PASS |
| Exact cookie raw representation and row ownership | source-slice unit, conflict diagnostic, 12/1000/10000 clipboard GUI | PASS |
| 50-row paging, sort/filter, compact previews, empty copy disabled | production integration + classifier GUI | PASS |
| Exactly seven fields in row/table TSV and CSV | classifier-copy unit + clipboard/file/archive GUI | PASS |
| Global secret policy and formula escaping unchanged | copy-format/copy-sources + classifier-copy unit | PASS |
| Worker cancellation, reset memory, no extra store/network/auth | service integration + reset GUI + source review | PASS |
| Existing phone/generator/News/photos/tour/copy regressions | complete existing suite; generator untouched in branch | PASS |
| Visual comparison to original and no protected asset edits | actual 1280×900 screenshots + diff + copy-icon geometry GUI | PASS |
| Native macOS ARM64 runtime, DMG, installed GUI, checksums | Awaiting current candidate CI | NOT RUN |
| Developer ID / notarization / owner acceptance | Explicitly outside unsigned QA scope | NOT VERIFIED |
