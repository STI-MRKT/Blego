# Classifier 2.0 — stages 1–2 experiment

**Status:** Experimental results for review. Production integration and a new app build are intentionally withheld. Branch `codex/blego-classifier-2-experiment` is based on deterministic classifier `f60c7ff`; A is the immutable BLEGO 1.4.4 revision `746a7ee`.

## Reproduce

On a cloud development machine with Node.js 24 and Python 3.12:

```sh
python3 -m pip install -r scripts/requirements-classifier2.txt
bash scripts/run-classifier2-experiment.sh
```

The script creates an ephemeral detached checkout of `746a7ee`, executes A and B on exactly the same corpus, trains the offline CRF, chooses its threshold on tuning families only, then writes `A-metrics.json`, `B-metrics.json`, and `C-metrics.json`. No Python package or model artifact is loaded by Electron. The training examples and output contain only synthetic account values and `example.invalid`; user actions are not training data.

## Corpus and protocol

- `dataset.jsonl`: 36 files, 54 records, nine structural families. Each gold record has start/end positions and each labelled value has an exact source span and raw slice.
- Training families (16 files, 24 records): vertical tab labels, CSV headers, JSON objects, colon positional.
- Tuning families (8 files, 12 records): TSV headers and pipe mixed.
- Independent test families (12 files, 18 records): noisy horizontal tab pairs with instructions, multiline mixed records, and double-colon positional records.
- Split is by **entire family**, with no random row split or user data. Each candidate uses B's record segmentation; the CRF only proposes labels for unresolved entries within the same parsed record and cannot override an already filled field.
- `BLEGO_TZ13_CONTROL_SANITIZED.txt` was not present in the available workspace/attachments. Its mandatory regression is **BLOCKED** and is not represented as a passing corpus case.

## Independent-family results

| Variant | Precision | Recall | F1 | Macro-F1 | Auto-filled | Whole-record accuracy | Boundary errors | Cross-record transfers | Processing time for 12 files |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A — `746a7ee` | 0.462 | 0.261 | 0.333 | 0.257 | 0.565 | 0/18 | 48 | 0 | 23.7 ms |
| B — deterministic `f60c7ff` | 1.000 | 0.797 | 0.887 | 0.889 | 0.797 | 12/18 | 0 | 0 | 15.6 ms |
| C — B + offline CRF | 1.000 | 0.797 | 0.887 | 0.889 | 0.797 | 12/18 | 0 | 0 | 39.7 ms |

Times are process-local measurements on Linux x64, including parsing; they are not Mac ARM64 performance claims. C includes experimental inference overhead even though its selected confidence cutoff accepted no additions. `auto-filled` is the count of nonempty assignments divided by gold nonempty fields. A boundary error includes a record-count mismatch and an aligned output row whose source entry lies outside that gold record; it does **not** imply data was actually copied across accounts. Cross-record transfers are counted only when a predicted field's value has a unique gold owner in another source record. Unknown ownership is never called a confirmed transfer.

### Confusion summary on independent families

The complete confusion matrices **for each independent format family** (`test.byFamily.*.confusion`), per-field precision/recall/F1, and per-file outcomes are in the three machine-readable metrics files. B and C each have 110 correct fields, 28 missing and **zero false assignments**. The 28 omissions are `accountId` 6, `birthDate` 6, `emailPassword` 4, `login` 6 and `password` 6, all in the independent double-colon family. A has 36 correct, 102 missing and 42 false assignments. Neither B nor C transfers a value to another source record in this corpus.

| Independent family | A correct / missing / false | B correct / missing / false | C correct / missing / false |
|---|---:|---:|---:|
| Noisy horizontal tab | 30 / 22 / 12 | 52 / 0 / 0 | 52 / 0 / 0 |
| Multiline mixed | 0 / 52 / 30 | 52 / 0 / 0 | 52 / 0 / 0 |
| Double-colon positional | 6 / 28 / 0 | 6 / 28 / 0 | 6 / 28 / 0 |

## CRF experiment and gate

The compact linear-chain CRF uses forward/backward probabilities, Viterbi decoding and L-BFGS training. It saw 24 training sequences, 67 structural features and ten labels. Features describe known headers, position, neighbouring types, value type/length and punctuation; they exclude raw password, token and cookie content. No production module imports the experiment.

At confidence `0.50`, C made six false assignments on tuning families and reduced tuning macro-F1 from 0.889 to 0.852. At `0.70` through `0.995`, it made no false assignments but added no correct fields. The conservative tuning choice `1.01` therefore accepts no model proposals. Independent macro-F1 is **0.889**, equal to B, a **0 percentage point** improvement. The required improvement is at least **5 percentage points** without worse record integrity and with zero transfers. **The model fails the inclusion gate and is not enabled in BLEGO.**

The experiment demonstrates only these synthetic families. The unavailable mandatory control file and unseen customer files prevent a final production-quality claim. A larger, independently labelled corpus would be needed before revisiting the model; simply lowering its threshold would violate the project's precision priority.

## Scope and checks

- Python experiment tests: 10 PASS, including exact span/boundary validation, family separation, no raw secret features, CRF marginals/Viterbi, per-format confusion matrices and transfer metric semantics.
- Existing classifier source, UI, copy/export/archive and installed macOS ARM64 behavior are unchanged on this branch. The earlier build `f60c7ff` is evidence only for B, not for a newly integrated C.
- No DMG or ZIP was produced because C did not pass the inclusion gate and the mandatory control is absent. No release or merge is performed.
