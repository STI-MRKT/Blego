#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd -P)"
report_dir="${1:-$project_root/docs/verification/classifier2}"
mkdir -p "$report_dir"
temporary_root="$(mktemp -d /tmp/blego-classifier2-XXXXXX)"
baseline_path="$temporary_root/baseline"
cleanup() {
  git -C "$project_root" worktree remove --force "$baseline_path" >/dev/null 2>&1 || true
  rm -rf "$temporary_root"
}
trap cleanup EXIT

python3 "$project_root/scripts/classifier2_dataset.py"
python3 -m unittest discover -s "$project_root/tests/experiment" -p '*_test.py'
git -C "$project_root" worktree add --detach "$baseline_path" 746a7ee >/dev/null
node "$project_root/scripts/classifier2_export.cjs" "$baseline_path" \
  "$project_root/docs/verification/classifier2/dataset.jsonl" "$temporary_root/A.json"
node "$project_root/scripts/classifier2_export.cjs" "$project_root" \
  "$project_root/docs/verification/classifier2/dataset.jsonl" "$temporary_root/B.json"
python3 "$project_root/scripts/classifier2_evaluate.py" \
  "$project_root/docs/verification/classifier2/dataset.jsonl" "$temporary_root/A.json" "$report_dir/A-metrics.json"
python3 "$project_root/scripts/classifier2_evaluate.py" \
  "$project_root/docs/verification/classifier2/dataset.jsonl" "$temporary_root/B.json" "$report_dir/B-metrics.json"
python3 "$project_root/scripts/classifier2_crf.py" \
  "$project_root/docs/verification/classifier2/dataset.jsonl" "$temporary_root/B.json" "$report_dir/C-metrics.json"
python3 "$project_root/scripts/classifier2_control.py" "$temporary_root/control.jsonl"
node "$project_root/scripts/classifier2_export.cjs" "$baseline_path" \
  "$temporary_root/control.jsonl" "$temporary_root/control-A.json"
node "$project_root/scripts/classifier2_export.cjs" "$project_root" \
  "$temporary_root/control.jsonl" "$temporary_root/control-B.json"
python3 "$project_root/scripts/classifier2_control_eval.py" \
  "$project_root/docs/verification/classifier2/dataset.jsonl" "$temporary_root/B.json" \
  "$temporary_root/control.jsonl" "$temporary_root/control-A.json" "$temporary_root/control-B.json" \
  "$report_dir/C-metrics.json" "$report_dir/CONTROL-metrics.json"
