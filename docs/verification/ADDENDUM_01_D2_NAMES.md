# D2 substep — female-name correction and licensed sources

This is a completed substep, **not completion of D2**. Remaining catalog/import,
capacity UI, bulk-consent and thematic/localization requirements remain open in
the plan and `resources/generator/DATA_SOURCES.md`.

Default profiles now use only the upstream female-name arrays for eight countries
and three types. Country-specific name data is versioned/checksummed, with full
MIT notices and reproducible extraction from reviewed Faker 10.6.0. No runtime
download or new runtime dependency is required. Polish adjective surnames use
feminine forms. No digits or suffixes were added to human names to simulate growth.

Custom profile pools must start their name with an entry in the selected female
first-name vocabulary; incompatible entries fail `POOL_NAME_NOT_FEMALE` before
reservation. An existing pool may therefore require editing. The existing pool
integration fixture was updated from the non-name `Synthetic Example` to the
female-name fixture `Olivia Example`; contact uniqueness assertions are unchanged.
Already issued profiles and idempotent responses remain unchanged, including
legacy names. Dataset metadata is attached to new profiles, not retroactively
invented for old cards. The store/registry schema is unchanged.

## Actual verification (Linux Cloud, 2026-11-12)

- `node --test tests/unit/generator-female.test.cjs tests/integration/generator-female.test.cjs`:
  observed **2 failures** before implementation; **2 passes** after implementation.
- `npm run verify`: **27 unit + 37 integration pass**, syntax/whitespace/format pass.
- `BLEGO_HEADLESS=1 npm run test:ui`: **1 real Electron workflow passes**.

The new checks cover explicitly female sources, normalized deduplication, selected
male-name exclusions, actual country-file hashes, Polish feminine surnames, all
24 generated combinations, unchanged legacy request results and rejection of an
incompatible custom pool without consuming registry values. Existing 10,000-contact
and restart regression still passes; it is not proof of accepted geographic data.

Sources were read from the actual npm package and its full LICENSE. Counts were
computed from the resulting files and are recorded in `name-counts.json` and
`DATA_SOURCES.md`. First-name and surname deficits remain in several countries;
all independently verified geographic minima remain unfulfilled. Locale quality
has not been reviewed by native speakers for every entry. Existing geographic
examples are not represented as independently checked postal data.

Logs: `/tmp/blego-d2-female-{red,green,verify,ui}.log`. No application build, signing,
native Windows/macOS execution, metadata writing or live Facebook check was run.
