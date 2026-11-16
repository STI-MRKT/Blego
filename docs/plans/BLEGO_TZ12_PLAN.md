# BLEGO TZ12 implementation and selective verification

Base: `99c5a3ec074032ea9380de40d8ff78e7318716c9` (verified 1.4.3).
Branch: `codex/blego-tz12-news-bio-dictionaries`. No merge or official release.
Specifications: [TZ12](../specs/BLEGO_TZ12.md), [priority addendum §21](../specs/BLEGO_TZ12_ADDENDUM.md).

## Evidence and constraints

The exact pre-copy News renderer is `295b2a5^`; compare it with the incoming base using identical fixture stories, theme and viewports. Existing `tools.css` contains the original 12px card radius, 12/13px padding, 10px grid gap, 12.4px/1.4 title typography and three-line clamp. TZ10 appended a new flex row of text buttons, increasing card height. Preserve original resources and remove that row from normal flow.

FP's closed native select is the visual reference. Both tabs will progressively use a shared accessible popup while retaining real selects and existing change events; country/type appearance stays unchanged. BIO city becomes a searchable popup with explicit city/postal choice. Organization name and actual city remain separate. BIO fields reuse FP field/copy classes; manual edits and autosave remain authoritative.

The current Crypto strategy is female personal names, not brands. Keep it. Extend country name atoms and the existing authored Tech-name and localized BIO supplements. No old Cartesian combinations count as new dictionary entries. Address records must store the complete city/postal/address tuple and provenance; legacy street combinations remain available. No database migration, contact/clipboard/full-set change, or unrelated module changes.

Baseline counts and counting definitions: [baseline.json](../verification/tz12/baseline.json). Counts are normalized globally as NFKC/trim/lowercase, with raw text retained. Country/category counts are also reported; duplicate entries across countries count once globally.

## Sequence and impact matrix

| Stage | Files / dependencies | Required checks | Deferred independent groups |
|---|---|---|---|
| 1. News compact actions | News renderer, local CSS only | News unit, copy/cache/topic integration and GUI; 360/390/480/576/768/980/1280 screenshots, exact baseline metrics | Generator, storage, other tools unchanged |
| 2. BIO / common generator popup | BIO renderer, generator-only popup, BIO city handler | BIO unit/integration/GUI, FP selection and independence, keyboard/search/region/resize; FP before/after visual equality | News backend and unrelated screens unchanged |
| 3. Dictionary expansion | Existing resources, generator source loader/address selection | Retention/count/normalized uniqueness, female/localization, postal/GEO, deterministic new-value use, exhaustion, 100/1000 profiles, history/contact invariants | Other modules do not load generator resources |
| 4. QA candidate | 1.4.4 package metadata, existing Mac workflow | One final integrated verification; installed ARM64 tests, comparable screenshots and performance, DMG/ZIP checksums | No repeated full suite per stage |

Execution of test commands is delegated to the coordinating agent as a shell/CI process under the user's model restriction. This implementation agent writes tests and records only actual returned results. Use focused commands after each stage; no model substitution for the requested test-review model.

## Deliverables and completion gates

- Logical commits: specification/plan, compact News, unified BIO controls, additive dictionaries/validation, QA/evidence.
- Reproducible visual harness with original News, incoming News/FP/BIO, candidate News/FP/BIO and open popups at all seven widths.
- Statistics with per-country and per-type/language additions, no combinations counted, authored provenance and synthetic-address limitation.
- Native QA uses the existing workflow; prepare `QA_SPEC=tz12`, base SHA above, 1.4.4 QA installer instructions. No push until coordinator approval.
- Results use PASS / FAIL / BLOCKED / NOT RUN honestly. Native installed-app acceptance and user review are required before completion/release claims.
