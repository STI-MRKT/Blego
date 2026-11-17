#!/usr/bin/env python3
"""Evaluate the supplied sanitized control without using it for training or tuning."""
import json
import sys
from pathlib import Path

from classifier2_crf import hybrid, make_examples, train
from classifier2_evaluate import summarize


def read_json(path):
    return json.loads(Path(path).read_text())


def run(corpus_path, corpus_b_path, control_path, control_a_path, control_b_path,
        model_metrics_path, output_path):
    corpus = [json.loads(line) for line in Path(corpus_path).read_text().splitlines()]
    control = [json.loads(line) for line in Path(control_path).read_text().splitlines()]
    if len(control) != 1 or control[0]["split"] != "control":
        raise ValueError("INVALID_CONTROL_SPLIT")
    corpus_b = read_json(corpus_b_path)
    control_a = read_json(control_a_path)
    control_b = read_json(control_b_path)
    cutoff = read_json(model_metrics_path)["selectedThreshold"]
    model = train(make_examples(corpus, corpus_b, "train"))
    control_c = hybrid(control, control_b, model, cutoff)
    report = {"controlCase": control[0]["id"], "trainedOnControl": False,
              "tunedOnControl": False, "selectedThreshold": cutoff,
              "A": summarize(control, control_a, "control"),
              "B": summarize(control, control_b, "control"),
              "C": summarize(control, control_c, "control")}
    Path(output_path).write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({name: {key: report[name][key] for key in (
        "correct", "missing", "falseAssignments", "boundaryErrors", "crossRecordTransfers")}
        for name in ("A", "B", "C")}))


if __name__ == "__main__":
    run(*sys.argv[1:8])
