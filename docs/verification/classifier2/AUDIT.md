# Classifier 2.0 stage 1 audit

- A: immutable BLEGO 1.4.4 `746a7ee`; B: deterministic classifier at `f60c7ff`.
- New experiment branch: `codex/blego-classifier-2-experiment`, based on B.
- `shared/importer.mjs` decodes UTF-8/UTF-16 and guarded Windows-1251, then routes TXT/CSV/TSV/JSON. Source bytes and decoded source text remain available.
- `shared/classifier-tab-labels.mjs` frames explicit tab pairs; `shared/classifier-lexer.mjs` frames mixed/positional TXT and preserves UTF-16 decoded-text offsets with bounded record/JSON sizes.
- `shared/classifier-recognition.mjs` recognizes labels and typed anchors; `shared/classifier-layouts.mjs` infers only repeated compatible layouts; `shared/classifier.mjs` resolves manual, named, schema and inferred candidates with ambiguity warnings.
- Existing `tests/unit/classifier*.test.cjs`, `tests/integration/classifier*.test.cjs`, and quality scripts cover individual formats and regressions. They do not provide a frozen independent-family train/tune/test split or a fair A/B/C benchmark.
- The named mandatory `BLEGO_TZ13_CONTROL_SANITIZED.txt` is absent from the available workspace and attachments at audit time. It was requested; its regression result remains **BLOCKED**. The separately uploaded `order_38071682.txt` is a private, different format and is excluded from Git and this experiment.
- Corpus generation produces 36 synthetic files across nine format families, with immutable record boundaries and exact source spans. Four families are training, two tuning, and three independent test. Values are synthetic; no user operation or private credential is used for model training.

Experiment limitation: synthetic families do not establish accuracy on a customer's complete unseen file. The mandatory control and real-world acceptance remain separate gates.
