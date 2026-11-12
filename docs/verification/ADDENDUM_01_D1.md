# D1 — shared copy preparation, 2026-11-12

Implemented `shared/copy-format.mjs::serializeCopy(request, context)` over a
section-owned, unpaginated model. The existing `electron/local/ipc.cjs::copyText`
remains the only native text clipboard owner. Its limit and the renderer preflight
now use 10 MiB UTF-8, before writing; no truncation. Too-large copies direct the
user to file export. Null/missing values copy empty, never a display placeholder.

One request addresses one source. Fields are explicitly allowlisted by the owning
adapter and may be public, personal, secret or internal. Personal fields require
an explicit full-report option; secrets remain excluded from mass reports. A
single sensitive field requires explicit disclosure in adapter context. URL
credentials and known credential query parameters are removed in bulk. Nested
objects must be deliberately formatted by their owner, preventing arbitrary
hidden fields from entering a report. The serializer has no clipboard or network
access. D6 will provide the screen-specific adapters and controls.

Value/card/selected/filter/all scopes use actual model rows, not rendered DOM.
Cards preserve saved order and mandatory contacts. JSON and quoted TSV are
supported, along with labelled/plain card text. TSV requires an explicit raw or
spreadsheet-safe choice; formula candidates and numeric identifiers are prefixed
in safe mode and the payload reports the transformation. Raw single-value copying
remains exact, including significant whitespace and long string IDs. Unsafe JS
integer input is rejected rather than silently claiming restored precision.

Large row loops yield, using a snapshot to prevent live updates from mixing old
and new data. This is not a claim that cloning arbitrary huge models is free;
D6 adapters should keep models bounded or prepare them in the owning process.

## Observed checks

- Initial `node --test tests/unit/copy-format.test.cjs tests/integration/clipboard.test.cjs`:
  **7 failures, 1 pass**. Six failures identified the absent serializer module;
  one exposed the old size/error contract. Existing denial behavior already passed.
- The same command after implementation: **8 pass, 0 fail**.
- `npm run verify`: **26 unit + 36 integration pass**, syntax/whitespace/format pass.
- `BLEGO_HEADLESS=1 npm run test:ui`: **1 pass**, real Linux Electron workflow,
  including native clipboard and existing import/archive/restart regression.

Tests cover exact Unicode/zero/phone/ID values, card order/mandatory contacts,
three selected rows across a 120-row paginated model, all 120 rows and sorted
filtered rows, missing-selection rejection, quoted TSV roundtrip, explicit formula
safety, report redaction/disclosure, exactly 10 MiB and over-limit unchanged buffer,
adapter denial/read-back mismatch, and mutation during asynchronous preparation.
The boundary and fault tests use an injected clipboard adapter; the existing GUI
test checks native Linux clipboard separately. Windows/macOS clipboard and the
D6 all-screen workflow have not been verified.

Logs: `/tmp/blego-d1-{red,green,verify,ui}.log` in Cloud scratch space.
No new application build or deployment was performed in D1.

E23–E27 are **partial**: shared preparation is checked, but complete screen
integration, native image copying and final cross-platform acceptance remain D6/D7.
