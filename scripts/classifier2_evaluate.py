#!/usr/bin/env python3
"""Field and record-level scoring for immutable synthetic Classifier 2.0 cases."""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


def fields_of(row):
    return {k: v for k, v in {**row.get("data", {}), **row.get("extended", {})}.items()
            if k != "rowNumber" and v not in (None, "")}


def score_case(gold, prediction):
    truth = gold["records"]
    rows = prediction.get("records", [])
    counters = Counter()
    field_counts = defaultdict(Counter)
    confusion = Counter()
    counters["boundaryErrors"] += abs(len(truth) - len(rows))
    for index in range(max(len(truth), len(rows))):
        expected = truth[index].get("fields", {}) if index < len(truth) else {}
        actual = fields_of(rows[index]) if index < len(rows) else {}
        if expected == actual and index < len(truth) and index < len(rows):
            counters["wholeRecordsCorrect"] += 1
        for key in expected.keys() | actual.keys():
            value = actual.get(key, "")
            wanted = expected.get(key, "")
            if value and value == wanted:
                counters["correct"] += 1
                field_counts[key]["tp"] += 1
                confusion[(key, key)] += 1
            else:
                if wanted:
                    counters["missing"] += 1
                    field_counts[key]["fn"] += 1
                    counters["abstentions"] += not bool(value)
                    assigned_elsewhere = next((other_key for other_key, other_value in actual.items()
                                               if other_value == wanted), "ABSTAIN")
                    confusion[(key, assigned_elsewhere)] += 1
                if value:
                    counters["falseAssignments"] += 1
                    field_counts[key]["fp"] += 1
                    if not wanted:
                        confusion[("NONE", key)] += 1
        if index < len(rows) and index < len(truth):
            start, end = truth[index].get("start"), truth[index].get("end")
            if start is not None and end is not None:
                for entry in rows[index].get("entries", []):
                    interval = entry.get("range")
                    if interval and (interval.get("start", start) < start or interval.get("end", end) > end):
                        counters["boundaryErrors"] += 1
                        break
    for index, row in enumerate(rows):
        owners = set()
        for entry in row.get("entries", []):
            interval = entry.get("range")
            if interval:
                owners.update(j for j, record in enumerate(truth)
                              if record.get("start", 0) <= interval["start"] and
                              interval["end"] <= record.get("end", 0))
        owner = next(iter(owners)) if len(owners) == 1 else (
            index if not owners and len(rows) == len(truth) else None)
        if owner is None:
            continue  # Fragmented/ambiguous boundaries are a separate failure.
        for value in fields_of(row).values():
            origins = {j for j, record in enumerate(truth) if value in record.get("fields", {}).values()}
            if len(origins) == 1 and owner not in origins:
                counters["crossRecordTransfers"] += 1
    return {**{name: counters[name] for name in (
        "correct", "missing", "falseAssignments", "abstentions", "wholeRecordsCorrect",
        "boundaryErrors", "crossRecordTransfers")},
        "fieldCounts": {k: dict(v) for k, v in field_counts.items()},
        "confusion": {f"{a}->{b}": n for (a, b), n in confusion.items()}}


def ratio(numerator, denominator):
    return numerator / denominator if denominator else 0.0


def summarize(cases, predictions, split="test"):
    predictions = {item["id"]: item for item in predictions["results"]}
    totals = Counter()
    fields = defaultdict(Counter)
    confusion = Counter()
    per_case = []
    for case in cases:
        if case["split"] != split:
            continue
        prediction = predictions[case["id"]]
        result = score_case(case, prediction)
        totals.update({k: result[k] for k in (
            "correct", "missing", "falseAssignments", "abstentions", "wholeRecordsCorrect",
            "boundaryErrors", "crossRecordTransfers")})
        totals["records"] += len(case["records"])
        totals["cases"] += 1
        totals["durationMs"] += prediction["durationMs"]
        for key, counts in result["fieldCounts"].items():
            fields[key].update(counts)
        confusion.update(result["confusion"])
        per_case.append({"id": case["id"], "family": case["family"],
                         "correct": result["correct"], "missing": result["missing"],
                         "falseAssignments": result["falseAssignments"],
                         "boundaryErrors": result["boundaryErrors"],
                         "crossRecordTransfers": result["crossRecordTransfers"],
                         "error": prediction.get("error")})
    precision = ratio(totals["correct"], totals["correct"] + totals["falseAssignments"])
    recall = ratio(totals["correct"], totals["correct"] + totals["missing"])
    f1 = ratio(2 * precision * recall, precision + recall)
    per_field = {}
    for key, counts in sorted(fields.items()):
        p = ratio(counts["tp"], counts["tp"] + counts["fp"])
        r = ratio(counts["tp"], counts["tp"] + counts["fn"])
        per_field[key] = {"precision": p, "recall": r, "f1": ratio(2 * p * r, p + r), **counts}
    return {"split": split, **totals, "precision": precision, "recall": recall, "f1": f1,
            "macroF1": ratio(sum(item["f1"] for item in per_field.values()), len(per_field)),
            "autoFillRate": ratio(totals["correct"] + totals["falseAssignments"],
                                  totals["correct"] + totals["missing"]),
            "wholeRecordAccuracy": ratio(totals["wholeRecordsCorrect"], totals["records"]),
            "perField": per_field, "confusion": dict(sorted(confusion.items())),
            "perCase": per_case}


if __name__ == "__main__":
    dataset = [json.loads(line) for line in Path(sys.argv[1]).read_text().splitlines()]
    prediction = json.loads(Path(sys.argv[2]).read_text())
    result = {split: summarize(dataset, prediction, split) for split in ("train", "tune", "test")}
    Path(sys.argv[3]).write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps({k: {m: v[m] for m in ("cases", "macroF1", "boundaryErrors", "crossRecordTransfers")}
                      for k, v in result.items()}))
