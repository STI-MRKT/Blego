# D2 — generator catalog, imports and capacity

2026-11-12, Linux Cloud. This extends A2 and the female-name substep, retaining
the same SQLite store and issued-value registry. Dataset source/count/license
details are in `resources/generator/DATA_SOURCES.md`.

Implemented country-dataset JSON/ZIP preview/apply/cancel using main-owned file
tokens, source-hash revalidation and transactional activation. Imported versions
are stored separately from bundled resources inside the existing store; both
bundled and prior imported versions can be selected. Invalid input and changes
after preview leave the active dataset intact. Limits: 50 MiB input, 256 MiB ZIP
expansion, 1024 entries, depth 8, no links/path traversal. ZIP parsing reuses the
existing archive reader with a dataset validator; archive manifest checks remain
the default. ZIP contents are parsed from the exact hashed input buffer.

`getPoolStats` exposes known/estimated/unknown capacities and source deficits.
Settings and the generator show dataset versions and limiting fields before issue.
Name combination count is not full-profile capacity. Phone capacity is a synthetic
format estimate, not proof that those numbers are unassigned or valid subscribers.
Full-profile bounds are labelled estimates because other optional fields and
custom-pool conflicts can exhaust first.

The three types now provide 30 authored biography structures and 20 localized
statuses each across all seven languages/eight countries. Country/type selection
changes actual content. Contact templates use versioned Latin transliteration
without changing displayed names; email patterns vary and use example.com/net/org.
Handle/email UUID suffixes retain registry protection. Multiple generation requires
explicit consent for finite optional repeats; contacts remain strict. Existing
manually configured optional-repeat settings are preserved.

## Verification actually performed

- Catalog/import tests initially failed because the module was absent; bulk
  consent and diversity/transliteration tests also failed before implementation.
- Profile command: `node --test tests/unit/pool-catalog.test.cjs
  tests/integration/pool-registry-migration.test.cjs
  tests/integration/generator-diversity.test.cjs`: **5 pass**.
- `npm run verify`: **29 unit + 40 integration pass**, syntax and format pass.
- `BLEGO_HEADLESS=1 npm run test:ui`: **1 expanded real Electron workflow pass**,
  including package preview/cancel/apply, count changes, saved bulk consent and
  restoration of bundled data. The native chooser is replaced only in the test
  with a controlled fixture; the real application IPC/store/importer are exercised.
- Existing 10,000 synthetic-format generations/restart now also assert handle
  uniqueness. This remains separate from actual finite geographic capacity.
- A first UI integration run failed because the new awaited operation was placed
  in a synchronous click callback. `node --check` reproduced the syntax error;
  making that callback async fixed it. The complete checks above were rerun.

Import checks include altered/invalid packages, unknown tokens, ZIP cancellation,
excess directory depth and an over-50-MiB file; active versions and issued counts
survive reopening the database. Strict postal exhaustion preserves the registry.
Existing archive recovery/CRC/path checks also pass after reader reuse.

The authored language samples were inspected for consistent topics and preservation
of accents. Full native-speaker review and independent postal validation have not
been performed. Geographic targets and several country-name/surname targets remain
unmet; **E02 is not accepted**. This is a documented source deficit, not a reduction
of the requested minima. Independent D3–D7 work can proceed.

No live contact verification, application build, native macOS/Windows execution,
signing, deployment or image-metadata writing was performed in D2.
Logs are `/tmp/blego-d2-*.log`. Earlier intermediate red/UI logs remain separate
from the final green logs (`verify-final`, `ui-expanded`).
