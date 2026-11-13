# TZ06 BIO addendum — acceptance candidate

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
| Normal close, native quit and restart | Linux Electron PASS, including immediately after input, failed close and pending regeneration; native Mac candidate pending below |
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

Final Linux candidate: lint PASS, 121/121 unit, 120/120 integration, 34/34 GUI, zero skipped. GUI elapsed 164.227 seconds. Raw outputs: [linux-verify.txt](linux-verify.txt), [linux-gui.txt](linux-gui.txt). Native build identifiers/results follow after actual completion; earlier native PASS results are not reused.

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
