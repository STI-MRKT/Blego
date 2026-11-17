# TZ13 classifier verification

Candidate: **BLEGO 1.4.5 QA**, branch `codex/blego-tz13-classifier`.
Base: `35226e5a1a071eb534408641b63a922915840caf` (verified TZ12 product code).

## Follow-up: supplied one-line structure (17 November 2026)

A synthetic example supplied after the initial TZ13 candidate revealed a real
remaining defect: an unpaired instruction in a horizontal tab sequence caused
the whole line to be assigned to `Login FB`. Also, `ID Account` with a Facebook
`profile.php?id=...` URL was rejected as a nonnumeric ID. The horizontal parser
now locates known labels independently of pair parity, retains unknown and
unpaired cells for review, and binds each known field to its immediate value.
For a labelled Facebook profile URL with one unambiguous numeric `id`, the ID
column receives that number while `sourceEntries` and `sourceRecord` retain the
literal URL. Conflicting or non-Facebook URLs are not converted to an ID.

The new one-line fixture contains only fake credentials and `example.invalid`.
It verifies independent account/email passwords, email, birth date, token,
User-Agent, cookie, raw source and an instruction with no paired value. Worker
integration checks cell copying and seven-field export; Electron GUI checks
real clipboard values and captures `gui/tz13-classifier-one-line.png`.
Linux source scope: 19/19 selected files PASS, no skips; lint and v142/v143
quality gates PASS; focused GUI PASS. Native Mac acceptance for this follow-up
requires a new build SHA. The previous installed Mac result for
`9597a1895e8359de574378ff07a442877e600bab` does not validate this patch.

## Change and boundaries

Explicit TXT `label<TAB>value` records now bind labels to literal payloads before
the existing mixed-text lexer. Vertical blocks and horizontal label/value pairs
support Login FB, Password, Email, Email password, ID Account, Date of Birth,
Token, User-agent and existing Cookie aliases. Separators, quotes, backslashes,
surrounding spaces and multiline Cookie JSON remain exact source slices.
Unknown labels and prose remain available for review; they cannot shift adjacent
fields or teach an inferred credential layout. Conflicting duplicate labels retain
their raw values and produce an ambiguity warning. Ordinary header tables and
explicit schema selection retain their existing parser paths.

Manual assignment now takes precedence: row assignment, column assignment,
label/header, schema, inference. Original source entries remain unchanged.
The existing 2FA provenance protection still blocks confidential source values from
being reassigned into core export fields or included in original-source archives.
A literal Password payload beginning with `2fa=` is correctly a password.

No News, FP/BIO, resource dictionaries, layout/CSS or SQLite schema changes.
Core seven-field row/export order is retained, including the existing spreadsheet
escape for numeric-looking IDs. No authentication, external requests or account use
is performed by these fixtures.

## Evidence returned by the coordinator

Commands are executed as shell/CI processes by the coordinator; no substitute
LLM testing role is used. All committed fixtures use synthetic credentials and
`example.test`. Real uploaded source files, raw credentials and derived secret
values are excluded from Git, logs and screenshots.

| Stage | Result |
|---|---|
| Exact base: classifier/importer unit (8 files), integration (12 scenarios), GUI (6 scenarios) | PASS |
| Seven new unit cases before implementation | RED: 7/7 reproduced label framing, alias and manual-priority failures |
| New and existing classifier/importer unit after implementation | PASS: 83/83, no skips |
| Additional multiline Cookie/row mapping unit plus worker/archive regression | PASS: 19/19, no skips |
| Four-format actual clipboard, manual assignment, export and archive GUI | PASS: 1/1, four synthetic screenshots |
| Existing classifier/archive GUI regression | PASS: 8/8, no skips |
| Consolidated classifier/archive source regression | PASS: all 19 selected files |
| Existing classifier quality gates | PASS: v142 precision/recall 1.0/1.0, zero false classifications; v143 all 26 cases |
| Branch-wide whitespace check against exact base | PASS |
| Lint | PASS |
| Native installed macOS application, ZIP/DMG checksums | Pending |

The first new GUI attempt exposed an incorrect test locator: existing Cookie copy
uses `import-cookie-copy`. The fixture was corrected to that action; exact native
clipboard equality remains required. No product behavior was changed for this.
Screenshot capture also waits for transient copy notifications to disappear; this
changes only evidence timing, not the product or clipboard assertions. The repeated
new GUI passed (1/1) after that wait, and all four captures were regenerated.

## Actual supplied input and outstanding acceptance

The named control file `3748850_18_09_2026_21_09_31_Акки_Facebook_Франция_для_рекламы_заполненные.txt`
has not been supplied in this session. Its exact label layout and final acceptance
remain unverified; synthetic fixtures do not establish that this unavailable file
has been fixed.

A different uploaded `order_38071682.txt` was checked locally by the coordinator
using aggregate-only output. It contains ten nonempty lines, no tabs, and six `::`
separators per line. Both the exact base and candidate yielded ten records, with
ID/email/birth date/user agent/cookie recognized in all ten, raw source retained,
and unrecognized-value warnings in all ten. This is a separate unlabelled format;
it has not been assigned invented password/token roles. No contents of that file
are included in the repository or QA evidence.

## Selective native QA plan

`npm run test:classifier` runs every classifier/importer/archive unit and integration
file selected by `scripts/classifier-qa-suite.cjs`. The same selector supplies every
classifier/archive GUI file to `check-installed-app.cjs --suite classifier`; the
default runner remains the complete GUI suite. Reports record the actual file list.
The TZ13 workflow keeps lint, classifier quality fixtures, native dependency and
ExifTool runtime packaging gates, builds the DMG, copies BLEGO.app outside the
checkout, then runs the selected installed GUI tests before producing the install
ZIP and SHA-256 files. Unrelated generator, News, photo-load and network-service
regressions are outside this selective classifier run.

`gui/tz13-classifier-*.png` are cloud Linux source-app screenshots using synthetic
records. Native screenshots will be separately identified by the Mac artifact/run;
they are not claimed before that job completes. The build is unsigned and not
Apple-notarized. User acceptance on the original control file remains separate.
No merge or official release is authorized by this work.
