# TZ06 BIO addendum — verified candidate 32a8265

Repository: STI-MRKT/Blego. Branch: `codex/blego-v1-4-1-fixes`. Existing draft PR7 is continued; PR6 and main are unchanged. Starting SHA: `1e7e22423dd358d5bebec4e48c6a1cf1190a6474`.

## Changes

- `3afd41d`: initial synthetic BIO is generated inside the existing profile/registry transaction. Existing institution JSON extended with real companies, region, industry, stable source IDs and dates. No new database or parallel generator.
- `fa4bddf`: remove Save BIO; debounce edits by 400ms, serialize revision-checked saves, retain concurrent input, retry failures, copy/regenerate individual fields. Freeze replacement/clear transitions, flush pending suggestions and edits before normal window close/Cmd+Q. SQLite closes only after accepted application shutdown.
- Geographic follow-up: ambiguous cities fail closed; source-confirmed postal codes can disambiguate a locality. Extend reference coverage to actual bundled city/postcode pairs. Keep all existing generator geography/uniqueness rules.

Initial residence and personal birthplace use profile city/country. Initial main BIO uses the generated thematic text. Real employer/role/university/school assignments are synthetic examples, not real-person credentials. Tech currently uses `brand_name`: employment, position, university, school and birthplace stay empty for new project pages; manual editing remains possible. Existing saved values are not migrated or overwritten by opening a tab.

## Acceptance checklist

| Requirement | Evidence/status |
| --- | --- |
| Initial BIO saved with profile | PASS: generation, request history, idempotent retry and transaction rollback integration tests |
| Real organizations/source metadata | See [ORGANIZATIONS.md](ORGANIZATIONS.md); 55 records, bounded starter coverage |
| Same-city first / verified-region fallback / actual city shown | PASS: selection tests, explicit aliases, category-compatible roles, ambiguous city and postcode regressions |
| Missing data remains blank | PASS: eight country unknown/sparse-town cases; no invented institutions |
| No Save BIO or persistent unsaved banner | PASS: rendered UI and real Electron checks |
| Debounce, concurrent typing, retry | PASS: coordinator and actual IPC GUI tests; no success before persistence |
| Tab and section switching preserve draft | PASS: BIO/Profile/News navigation |
| Normal close, native quit and restart | Linux Electron PASS, including immediately after input, failed close and pending regeneration; native Mac ARM64 PASS below |
| Individual copies/regeneration | PASS: all seven copy controls checked against native clipboard; all seven regenerate controls exercised |
| Existing fields, history, registry and archive | PASS: profile fields unchanged; old request BIO updated atomically; full regression checks |
| Original visual resources | Protected six CSS files, assets and animations unchanged; existing components retained, one scoped display override hides retry until failure |
| Expand without generator rewrite | PASS: data-only catalog additions selected through the same code; bundled coverage regression prevents zero usable localities |

## Commands and environments

Cloud Linux x64, Node 24.22.1, Electron 45.3.1. Source tests use temporary synthetic data only.

```
npm run verify
BLEGO_HEADLESS=1 BLEGO_CAPTURE=/tmp/blego-bio-captures npm run test:ui
```

Final Linux candidate: lint PASS, 121/121 unit, 120/120 integration, 34/34 GUI, zero skipped. GUI elapsed 164.227 seconds. Raw outputs: [linux-verify.txt](linux-verify.txt), [linux-gui.txt](linux-gui.txt). Native results below are for this exact candidate; earlier native PASS results were not reused.

## Review and regressions

Fresh independent review: no Critical findings; two Important findings fixed with RED/GREEN tests (edits and pending suggestions at replacement/close boundaries; ambiguous direct city matches). Hidden save-error feedback was also fixed and tested because the user explicitly requires visible errors. No deferred findings. Live source checks and native package acceptance were outside that read-only review and are evidenced separately.

GUI fixtures initially reused postcodes and names shared by US/DE/GB dictionaries. The real registry correctly rejected these; fixtures were made unique without weakening checks. Persistence assertions now await actual IPC readback rather than an asynchronous browser predicate. A test cleanup fixture that deliberately failed every save was restored before teardown so the production close guard could complete normally. These failures are not claimed as successful tests.

## Coverage limits

This is a verified, expandable starter catalog, not a nationwide organization database. Full employer/role/university/local-school reference coverage currently exists for one bundled locality per country:

| Country | Bundled locality | Postcode | Bundled place rows |
| --- | --- | --- | ---: |
| BR | Adamantina | 17800-000 | 500 |
| US | Amsterdam, New York | 12010 | 500 |
| FR | Alfortville | 94140 | 500 |
| PL | Andrychów | 34-120 | 500 |
| DE | Aachen | 52062 | 500 |
| ES | A Coruña | 15001 | 500 |
| IT | Abbiategrasso | 20081 | 500 |
| GB | London | EC1A 1BB | 6 |

Major-city coverage also supports explicit/imported profiles in the eight source hubs. Other generated towns commonly retain blank organization fields. City distribution is not silently biased to make the catalog appear complete. Schools stay in the profile city; employer/university fallback uses only a confirmed matching administrative region and displays the actual city. The pre-existing alphabetically limited geography dictionaries are not expanded by this change.

Normal orderly close/quit is tested. Process kill, OS crash or power loss before the debounce commits cannot be promised to preserve an in-memory draft. SQLite committed values remain transactional.

Existing limitations remain: Facebook positive live-account acceptance is not established; old dictionary breadth/quality deficits and historical 1000-photo GUI failure are not renamed PASS. This addendum does not alter the requested 20-photo acceptance target. Official release, merge, Developer ID signing, notarization and owner-device acceptance are not performed. No system protection is disabled.


## Verified native build and delivery

Code SHA: **32a8265b1e1b93d390b08f6ffafd63cc6e5956ea**. [Successful run 43474420977](https://github.com/STI-MRKT/Blego/actions/runs/43474420977), Mac job `132054665281`. [QA artifact 14062952151](https://github.com/STI-MRKT/Blego/actions/runs/43474420977/artifacts/14062952151), expires 2026-11-18 17:47 UTC. Subsequent commits only record documentation/screenshots and correct the ZIP installation instructions.

Actual environment: **macOS 15.8.2 (24H232), Darwin 24.6.0, ARM64, Apple M1 (Virtual), VirtualMac2,1**. Node24.22.1 / Electron45.3.1. This is cloud-native QA, not access to the owner's Mac.

| Gate | Actual result |
| --- | --- |
| CI lint / unit / integration | PASS: 121 unit, 120 integration, zero skipped; [summary](native/ci-test-summary.txt) |
| Bundled Perl/ExifTool before packaging | PASS: actual JPEG/PNG/WebP write/readback, protected pixels/payload/originals, empty PATH; [report](native/native-darwin-arm64.json) |
| ARM64 DMG | PASS: `npm run dist:mac -- --arm64`, publishing disabled |
| Installed app outside checkout | PASS: read-only DMG mount, `ditto` to runner temp, dependency probe, 34/34 real GUI tests, zero skipped, 256.212s; [report](native/installed-darwin-arm64.json), [log](native/installed-darwin-arm64.json.txt) |
| BIO native acceptance | PASS: all five new scenarios, including immediate quit, pending suggestion, failed close/retry, real clipboard, bundled towns, sparse towns and restart |
| 20 individual / 20 nested-folder photos | PASS: 9.129s / 8.825s, 20 outputs each; [individual](native/metadata-ui-batch-darwin.txt), [folder](native/metadata-ui-folder20-darwin.txt). Small synthetic RGBA fixtures, not maximum-size stress |
| Actual panorama JPEG/PNG/WebP | PASS: explicit date/GPS, native readback; [report](native/real-photo-candidate.json) |
| Real OSM / Facebook observation | OSM fetch and installed rendering PASS. Facebook remains BLOCKED: UNKNOWN / INSUFFICIENT_EVIDENCE; [report](native/public-services-native.json) |
| Download and archive integrity | PASS: outer artifact SHA256, CRC/path validation, original CI ZIP/DMG checksums, delivery ZIP CRC and embedded DMG hash |
| Developer ID, notarization, downloaded Gatekeeper / owner acceptance | Not performed / BLOCKED; no system protection disabled |

Native commands are in [.github/workflows/blego-macos-qa.yml](../../../../.github/workflows/blego-macos-qa.yml): `prepare-metadata-darwin.sh`, `check-metadata-native.cjs`, `npm run verify`, `npm run dist:mac -- --arm64`, `hdiutil attach ... -readonly -nobrowse`, `ditto`, `check-packaged-dependencies.cjs`, `check-installed-app.cjs`, both 20-photo GUI checks, UX comparison and bounded public-service checks.

| File | SHA-256 |
| --- | --- |
| QA artifact ZIP | `2823157dfadaf06a7725ea259bcd3ea81d3fba2d95fc279d0f577089215da836` |
| Verified DMG | `2444bc640fb322b13d0836d4bc00f4ec890d6b9053b344c77df1f8bbeffc6c34` |
| Original CI installation ZIP | `808196d26792147c8e08bf8bb185430cd9f4eca8a262737ec16ae792ed03835d` |
| Chat delivery ZIP `BLEGO-1.4.1-arm64-32a8265.zip` | `606c733b6edfecd24ab2b32459ee666a7319cd98c08d6e3911eaaa68b9aa73ec` |

The chat ZIP was repacked in Linux solely to replace the old instruction “save BIO” with the actual automatic-saving workflow. It contains the **byte-identical verified DMG**, its original checksum file and corrected `INSTALL-RU.txt`; the inner DMG digest and ZIP CRC were checked afterward. The original CI artifact is retained unchanged. The canonical workspace installation ZIP points to this verified delivery copy. Updated [installation instructions](../INSTALL-RU.txt) require no new user data, credentials or disabled system protections.

Actual Mac screenshots: [wide BIO](bio-wide.png), [360px BIO](bio-360.png). The host display constrains native window height, so lower controls require the tested vertical scroll. The QA artifact also retains comparative original/1.4/candidate screenshots. [Changed files](CHANGED_FILES.txt).

Three same-host samples, medians in milliseconds (not a cold-cache or universal-speed claim):

| Metric | Original | Packaged1.4 baseline | Candidate |
| --- | ---: | ---: | ---: |
| Launch | 1044 | 863 | 862 |
| Generation | 928 | 256 | 207 |
| Frame P95 | 18.8 | 21.8 | 18.6 |
| Import1000 synthetic rows | — | 270 | 233 |
| Archive | — | 597 | 407 |
| Map | — | 407 | 214 |

Raw measurements: [ux-performance-darwin.json](native/ux-performance-darwin.json). No overall performance improvement is inferred beyond these observations.

## Explicit decisions

- Schools stay city-local; employer/university regional fallback requires verified geography. Brand/project pages do not receive invented personal credentials. Cost: fewer automatically populated fields, intentionally favoring empty values over unsupported claims.
- Source coverage is an expandable starter set, explicitly measured above; the generator's city distribution is unchanged. Cost: many ordinary generated towns still have empty organization fields until data is added.
- Execution evidence uses the checked-in plan ledger because the cloud skill scripts were not local executables. Cost: bookkeeping is maintained explicitly rather than by the skill's helper scripts; tests and commits remain independently inspectable.
