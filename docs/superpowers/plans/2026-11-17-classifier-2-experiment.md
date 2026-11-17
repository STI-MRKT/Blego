# Classifier 2.0 Experiment Implementation Plan

> **For agentic workers:** Execute tasks in order with tests before implementation. This plan covers stages 1–2 and an offline A/B/C experiment only; production integration requires a later gate.

**Goal:** Compare current BLEGO 1.4.4, the improved deterministic classifier, and an offline linear-chain CRF on independent synthetic format families.

**Architecture:** Keep the Electron application unchanged. Generate a versioned synthetic, span-annotated corpus; run both repository revisions through the same read-only Node evaluator; train and evaluate a Python CRF offline using only structural features. The hybrid may fill unresolved fields only at a calibrated confidence threshold and may never move values between records.

**Tech Stack:** Node.js 24, Python 3.12, NumPy 2.3.5, SciPy 1.17.0.

**Spec:** User's “ТЗ №13 — BLEGO Classifier 2.0” in this conversation.

## Global Constraints

- Base A is immutable `746a7ee`; B is the current deterministic classifier at `f60c7ff`.
- No production model integration, product version bump, DMG, or release in stages 1–2.
- No real credentials, cookie, token or 2FA value in Git, logs or training data.
- Split by format family; never by randomly sampled rows.
- Original source spans and record boundaries are gold labels and independently validated.
- `BLEGO_TZ13_CONTROL_SANITIZED.txt` is a mandatory external control; report BLOCKED until actually available.
- No changes to News, FP, BIO or other unrelated modules.

## Review Focus

- Extra instructions among tab pairs must remain raw and must not shift known fields.
- Empty email password must stay empty even when a nearby account password exists.
- A Facebook profile URL in `ID Account` may yield only its unambiguous numeric `id`.
- Cookie JSON punctuation and embedded delimiters must remain exact source slices.
- A record boundary error must never be masked by a high field F1 score.

## Tasks

### Task 1: Corpus and baseline audit

**Files:** Create `scripts/classifier2_dataset.py`, `docs/verification/classifier2/dataset.jsonl`, `tests/experiment/classifier2_dataset_test.py`.

- [ ] Write validation tests for spans, record boundaries, split disjointness by family, safe values and missing-field truth.
- [ ] Run them RED, then implement a deterministic corpus generator and run GREEN.
- [ ] Audit existing `shared/classifier*.mjs` and `shared/importer.mjs`; record parser paths and control-file availability.
- [ ] Commit the dataset and audit separately.

### Task 2: Fair A/B evaluator

**Files:** Create `scripts/classifier2_export.cjs`, `scripts/classifier2_evaluate.py`, `tests/experiment/classifier2_metrics_test.py`.

- [ ] Test precision, recall, macro-F1, whole-record accuracy, boundary errors, abstentions, cross-record transfers and timing on tiny known examples.
- [ ] Run RED, implement evaluator, run GREEN.
- [ ] Evaluate A and B against the same held-out families. A executes from a detached checkout of `746a7ee`.
- [ ] Commit the evaluator and baseline results.

### Task 3: Offline CRF and gate

**Files:** Create `scripts/classifier2_crf.py`, `tests/experiment/classifier2_crf_test.py`, `docs/verification/classifier2/REPORT.md`.

- [ ] Test forward/backward normalization, Viterbi, no training-family overlap and confidence abstention; run RED.
- [ ] Implement a compact linear-chain CRF trained with L-BFGS from synthetic structural features only.
- [ ] Tune confidence on the tuning families only; freeze it before the independent test families.
- [ ] Evaluate C beside A/B and report field metrics, confusion matrix, boundaries, transfers, timings and the ≥5-point macro-F1 gate.
- [ ] Keep model out of BLEGO unless the gate succeeds and the missing mandatory control has been checked.
- [ ] Commit and open a draft PR for stages 1–2 review; do not merge.

## Acceptance gate

Model integration is eligible only if C improves independent-family macro-F1 by at least 0.05 over B, has no worse record integrity, and has zero cross-account transfers. A missing control file blocks final acceptance regardless of synthetic scores.
