# TZ12 verification record

Candidate: **BLEGO 1.4.4 QA**, branch `codex/blego-tz12-news-bio-dictionaries`.
Incoming verified base: `99c5a3ec074032ea9380de40d8ff78e7318716c9`.
Exact pre-TZ10 News reference: `7234b07fea6927aae9d08542ac90b481f01787b9` (`295b2a5^`).
Native installed ARM64 acceptance passed at `35226e5a1a071eb534408641b63a922915840caf`.
Final user acceptance, merge and official release remain pending.

## Delivered behavior

News retains the original card typography, padding, border, background, radius,
metadata and three-line title clamp. Two icon-only copy actions occupy the original
bottom inset, so they add no row height. Container rules cap the original grid at
three columns and reduce it to two and one. Existing RSS/Atom, cache, topics,
deduplication, source failure handling and 15-item limit remain unchanged.

FP closed selects retain their original markup and CSS. Both generators use the
same progressively enhanced popup for country/type; BIO city and institutions use
that popup too. Arrow keys, Enter, Escape, Home/End, typeahead, city filtering,
scrolling and viewport repositioning are covered. A city selection retains its
exact postal identity; manual ambiguous city text clears it. Hidden city options
retain the previous loading/snapshot DOM contract without enabling a native datalist.
BIO editable fields use FP card/copy tokens. Existing autosave, history, organization
name/city separation and generator independence remain intact.

The existing resource loader adds surname atoms and authored Tech/BIO entries.
New address examples are complete tuples selected together; imported geography is
never mixed with bundled examples. SQLite schema, historical records, canonical
field/export order, phone handling and dayrep.com email generation are unchanged.

## Dictionary counts

| Globally normalized unique dictionary pool | Before | Added | After |
|---|---:|---:|---:|
| Names / name atoms / explicit titles | 9,232 | 224 | 9,456 |
| FP BIO texts | 1,680 | 210 | 1,890 |
| Explicit address tuples | 0 | 200 | 200 |

No old records were removed. Legacy street × house-number combinations are retained
but excluded from both explicit-address counts. Name combinations are not counted.
The 224 new name entries comprise 128 surname atoms (16 per country, used by Model
and Crypto) and 96 Tech titles. The 210 BIOs comprise 10 per each of 3 categories ×
7 languages. English is counted once for US/GB. Addresses add 25 per country.
Full country/category/language breakdown: [dictionary-counts.json](dictionary-counts.json).

## Selective checks executed by the coordinator

Commands ran as shell/CI processes. No substitute LLM testing role was used.
The coordinator returned the following actual results during implementation:

| Changed area | Verification | Status |
|---|---|---|
| News | Unit copy/limits + cache/topic integration (3 files); GUI copy/topics (2 files) | PASS |
| BIO / FP | Existing independent/autosave/v143 unit and workspace/generation integration (6 files) | PASS |
| BIO | Existing generator-bio and biography-v143 GUI, including delayed cross-country city loading (10 tests) | PASS |
| Shared generator popup | New GUI keyboard, exact city/postal selection, five popup types at seven widths, resize (1 test) | PASS |
| Dictionaries | Strict TZ12 counts/retention/near-copy/GEO checks; v14 and female-resource checks (6 tests in last focused run) | PASS |
| Phone/address | Existing unit contracts | PASS |
| Generation | Existing v14/female/registry/diversity integration; finite brand exhaustion retained | PASS |
| New values / history | 24 country/type generations select new names, BIO and paired addresses; SQLite reopen preserves records | PASS |
| 100 / 1,000 profiles | Explicit bulk consent, unique names/contacts, request idempotence; separate strict GB run exhausts at 6 postal values | PASS |
| Classifier / Network / Checker / Photos | Intermediate repeat checks omitted: no production dependencies changed | NOT RUN |
| Final integrated suite | `npm run verify`: lint, 195/195 unit, 143/143 integration; no skips | PASS |
| Final Linux Electron GUI | `BLEGO_HEADLESS=1 npm run test:ui`: 60/60, no skips, 274.386 s | PASS |
| Visual comparison gate | All 15 News bounds equal original, FP controls equal incoming, no overflow across seven widths | PASS |
| macOS ARM64 installed application | Run 43849066820: installed app outside checkout, 60/60 GUI, no skips | PASS |
| Native runtime and verify | ExifTool read/write/readback; 195/195 unit and 143/143 integration, no skips | PASS |
| Native installed visual comparison | All News card bounds and FP control bounds match references, no overflow, seven widths | PASS |
| DMG / ZIP integrity and SHA-256 | Coordinator independently checked outer/inner ZIP integrity and DMG digest from the installer ZIP | PASS |

Final review follow-up: the typeahead buffer now resets when keyboard focus moves
to another picker. Its focused GUI passed (1/1, 6.4 s) after the earlier complete
60-scenario GUI run; this one-line control change has no dictionary/backend impact.
Final lint passed (293 JavaScript files and Prettier), and branch-wide
`git diff --check 99c5a3e` passed. Copied-spec trailing spaces were normalized and
five superseded auxiliary captures removed; all 35 TZ12 popup captures remain.

Failures found and resolved: the removed native datalist broke an existing stale-city
observation (hidden compatible options restored); an immediate resize observation
raced layout (control ResizeObserver, width clamp and condition-based test wait);
seven added surnames overlapped old explicit name suffixes (replaced without removing
old pool entries). New bulk fixtures now provide required explicit consent. A test
incorrectly asserted display ordering against persisted fieldOrder; removed that
assertion, leaving the established UI order and export contract unchanged. Historic
pool-size and catalog-capacity expectations were updated for the documented additive expansion; actual
exhaustion and registry checks remain enabled.

## Linux visual evidence — synthetic fixtures

`scripts/capture-tz12.cjs PROJECT LABEL OUTPUT` renders each version's own UI/CSS
with identical synthetic stories/profile/BIO, dark theme and seven viewports:
360, 390, 480, 576, 768, 980 and 1280 px. These are source-app screenshots,
not proof of a macOS installed binary. No real user records are captured.

- [Original News 1280](visual/original-news-1280.png), [incoming News 1280](visual/incoming-news-1280.png), [restored News 1280](visual/candidate-news-1280.png).
- [FP reference 1280](visual/incoming-profile-1280.png), [FP candidate 1280](visual/candidate-profile-1280.png).
- [BIO before 1280](visual/incoming-bio-1280.png), [BIO after 1280](visual/candidate-bio-1280.png).
- [Original metrics](visual/original-metrics.json), [incoming metrics](visual/incoming-metrics.json), [candidate metrics](visual/candidate-metrics.json).
- `popups/tz12-picker-*.png`: 35 actual GUI screenshots, five popup types at all seven widths.

The automated [comparison gate](visual/comparison.json) confirmed identical
original/candidate bounds for all 15 cards at every width, identical incoming/candidate
FP control bounds, and no horizontal page overflow. First-card heights are 81.719 or
113.078 px depending on wrapping.
The incoming enlarged cards were 120–192 px. Candidate News restores the original
three-column density at 1280. FP candidate/reference PNGs are byte-identical at
768/980/1280; no pixel-identity claim is made for the four narrower widths.

## Performance and limitations

The 1,000-profile Linux run reported 3,346.51 ms cumulative generation time;
the first 100 took 318.56 ms, median 2.70 ms/profile and p95 6.70 ms/profile.
Raw evidence: [generation](data/tz12-generation.json). These are observations from
one isolated run, not a cold-cache guarantee. The same-host three-run 100-profile
benchmark used Node 24.22.1 on Linux x64 / Intel Xeon Platinum 8573C. Incoming
100-profile runs took 229.60–315.30 ms, candidate runs 224.57–269.49 ms. Per-run
median latency was 2.19–2.74 ms incoming and 2.06–2.30 ms candidate; one candidate
sample had a 27.88 ms maximum. This small sample shows comparable typical behavior,
not a claimed speedup. Raw [incoming](data/performance-incoming.json) and
[candidate](data/performance-candidate.json) measurements include all three samples.
The same-host Mac benchmark also completed three 100-profile runs. Incoming totals
were 313.46 / 259.01 / 274.06 ms; candidate totals were 232.50 / 232.26 / 211.27 ms.
Per-run median latency was 2.64 / 2.22 / 2.67 ms incoming and 2.05 / 1.83 / 1.87 ms
candidate. These small samples are observations, not a guaranteed speedup.

Addresses are explicitly synthetic street/house examples with retained source-paired
city/postal values. They are not verified deliverable residences; independent
postal-link verification stays at its prior zero. Localized biographies are authored
texts, with native-speaker editorial review still outstanding. Existing finite pools
and explicit bulk-mode consent are preserved. Native signing/notarization remains
outside this unsigned, unnotarized QA build. The Mac runner is virtualized; its
results do not guarantee Gatekeeper acceptance on a user’s physical Mac. All visual
fixtures and generated address examples are synthetic. Final user acceptance is
still required. No merge or official release is authorized here.

## Native evidence collection

The existing Mac workflow now recognizes the TZ12 branch and base. It retains final
`npm run verify`, packaging dependency/runtime checks, and the complete installed-app
GUI gate. Unrelated additional photo stress/comparison and public-service observation
steps are skipped for TZ12 under addendum §21. Native source references and the
actual installed candidate are captured separately in `release/tz12-visual/`, with
`installed-candidate-*` labels for the installed binary. Package checksums and the
install ZIP were produced after successful installed-app acceptance in the second
native run below. Source-reference captures remain distinct from the installed
candidate captures; neither uses real user records.

### Native attempt 1 — run 43845667208

The installed macOS ARM64 GUI gate ran all 60 scenarios: **58 passed, 2 failed**.
This run is not accepted as an installation PASS. The failures were in unchanged
map/settings scenarios, not the TZ12 controls or dictionaries:

- `map-city-recovery`: the HTTP fixture counted 13 cumulative requests for three
  final viewport tiles against an expected 9. The renderer's attempt budget counts
  completed failures, while the fixture's lifetime server log also includes
  requests cancelled by earlier import/layout remounts. Cancellation deliberately
  does not consume a failure attempt. The assertion now waits for each final key
  and a quiet interval longer than automatic retry/debounce, then requires **zero
  additional requests after both direct and navigation remounts**. Explicit Retry
  must start requests and recover the raster. The existing scheduler unit still
  asserts exactly three failed attempts and concurrency at most four.
- `settings-defaults-v142`: the independent first-run tour intercepted Settings
  Save. This settings fixture now seeds only `tourSeen` using the existing store;
  all three settings defaults remain untouched and their save/restart assertions
  remain enabled. The tour's own tests remain in the suite.

These corrections change only the two GUI test fixtures. No production map,
settings, scheduler, IPC or default behavior is changed. The coordinator reran
`tests/unit/map-recovery.test.cjs` (PASS) and both affected cloud Electron GUI
files (2/2 PASS). The subsequent installed ARM64 rerun passed as recorded below;
no tests were disabled or skipped.

### Native attempt 2 — run 43849066820 — PASS

- [Successful workflow run](https://github.com/STI-MRKT/Blego/actions/runs/43849066820).
- Tested code: `35226e5a1a071eb534408641b63a922915840caf` (the first attempt’s two
  fixture corrections; production TZ12 behavior unchanged).
- Host: **macOS 15.8.2, arm64, Apple M1 (Virtual)**.
- Native ExifTool read → write → readback: **PASS**.
- Native verification: **195/195 unit, 143/143 integration**, no skipped tests.
- The actual installed `BLEGO.app`, copied outside the repository from the DMG:
  **60/60 GUI scenarios PASS**, no skipped tests.
- Native installed visual comparison: **PASS at 360, 390, 480, 576, 768, 980 and
  1280 px**. All 15 News card bounds match the original reference, FP control
  bounds match the incoming reference, and no horizontal overflow is present.
- [QA artifact and installer](https://github.com/STI-MRKT/Blego/actions/runs/43849066820/artifacts/14216458720).

The coordinator independently verified both outer artifact ZIP and inner installer
ZIP integrity, and recomputed the DMG digest from the inner ZIP. Verified files:

| File | SHA-256 |
|---|---|
| `BLEGO-1.4.4-TZ12-macOS-ARM64-install.zip` | `68f561e74c6f99f03ae2826cc6f1cb3af246af81f75485f1c676096cb563444d` |
| `BLEGO-1.4.4-arm64.dmg` | `94a59449d5cbf1173a360a11e1ce4036a0352ce8e57fa831de5fbc5416a3a217` |

This records native technical acceptance of the unsigned QA candidate. It does
not replace the owner’s acceptance, Developer ID signing/notarization, or permission
to merge and publish an official release. This documentation update changes no
runtime files and does not require a second build of the accepted code SHA.
