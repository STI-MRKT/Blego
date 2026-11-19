#!/usr/bin/env python3
"""Offline linear-chain CRF experiment; never imported by installed BLEGO."""
import json
import re
import sys
import time
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp

KNOWN_HEADERS = {
    "loginfb", "login", "password", "email", "emailpassword", "mailpassword",
    "idaccount", "accountid", "dateofbirth", "birthdate", "token",
    "useragent", "cookie", "cookies", "backupemail", "2fa",
}


def value_kind(value):
    value = str(value or "")
    if not value:
        return "empty"
    if re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        return "email"
    if re.fullmatch(r"\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{2}-\d{2}", value):
        return "date"
    if re.fullmatch(r"\d+", value):
        return "digits"
    if value.startswith(("https://", "http://")):
        return "url"
    if value.startswith("Mozilla/"):
        return "user-agent"
    if value.startswith(("[{", "{")):
        return "json"
    return "opaque"


def features_for(entries):
    kinds = [value_kind(entry.get("value")) for entry in entries]
    result = []
    for index, entry in enumerate(entries):
        value = str(entry.get("value") or "")
        header = re.sub(r"[\s_-]+", "", str(entry.get("header") or "").lower())
        header = header if header in KNOWN_HEADERS else "other"
        column = str(entry.get("column") or "")
        features = [
            "bias", f"kind={kinds[index]}", f"position={min(index, 12)}",
            f"from-end={min(len(entries) - index - 1, 12)}", f"count={min(len(entries), 14)}",
            f"length={min(len(value) // 8, 12)}", f"labelled={bool(entry.get('labelled'))}",
            f"header={header}",
            f"column={'positional' if re.fullmatch(r'column_\d+', column) else 'named'}",
            f"prev-kind={kinds[index - 1] if index else 'BOS'}",
            f"next-kind={kinds[index + 1] if index + 1 < len(entries) else 'EOS'}",
        ]
        for char, name in (("@", "at"), (":", "colon"), ("/", "slash"), ("=", "equals")):
            if char in value:
                features.append(f"has-{name}")
        result.append(features)
    return result


class LinearChainCRF:
    def __init__(self, labels, features):
        self.labels = list(labels)
        self.features = {name: index for index, name in enumerate(features)}
        self.index = {name: index for index, name in enumerate(labels)}
        self.k = len(labels)
        self.f = len(features)
        self.weights = np.zeros(self.k * self.f + self.k * self.k)

    def encode(self, sequence):
        return [[self.features[name] for name in token if name in self.features] for token in sequence]

    def potentials(self, sequence):
        encoded = self.encode(sequence)
        emission_weights = self.weights[:self.k * self.f].reshape(self.k, self.f)
        emission = np.zeros((len(sequence), self.k))
        for time, indices in enumerate(encoded):
            if indices:
                emission[time] = emission_weights[:, indices].sum(axis=1)
        transition = self.weights[self.k * self.f:].reshape(self.k, self.k)
        return emission, transition, encoded

    def forward_backward(self, sequence):
        emission, transition, encoded = self.potentials(sequence)
        n = len(sequence)
        if not n:
            return 0.0, np.zeros((0, self.k)), np.zeros((0, self.k, self.k)), encoded
        alpha = np.zeros((n, self.k))
        beta = np.zeros((n, self.k))
        alpha[0] = emission[0]
        for time in range(1, n):
            alpha[time] = emission[time] + logsumexp(alpha[time - 1][:, None] + transition, axis=0)
        log_z = logsumexp(alpha[-1])
        for time in range(n - 2, -1, -1):
            beta[time] = logsumexp(transition + emission[time + 1][None, :] + beta[time + 1][None, :], axis=1)
        unary = np.exp(alpha + beta - log_z)
        pair = np.zeros((n - 1, self.k, self.k))
        for time in range(1, n):
            pair[time - 1] = np.exp(alpha[time - 1][:, None] + transition +
                                    emission[time][None, :] + beta[time][None, :] - log_z)
        return log_z, unary, pair, encoded

    def marginals(self, sequence):
        return self.forward_backward(sequence)[1]

    def predict(self, sequence):
        if not sequence:
            return [], []
        emission, transition, _ = self.potentials(sequence)
        scores = np.zeros_like(emission)
        back = np.zeros_like(emission, dtype=int)
        scores[0] = emission[0]
        for time in range(1, len(sequence)):
            candidates = scores[time - 1][:, None] + transition
            back[time] = np.argmax(candidates, axis=0)
            scores[time] = emission[time] + np.max(candidates, axis=0)
        indices = [int(np.argmax(scores[-1]))]
        for time in range(len(sequence) - 1, 0, -1):
            indices.append(int(back[time, indices[-1]]))
        indices.reverse()
        marginals = self.marginals(sequence)
        return [self.labels[index] for index in indices], [float(marginals[t, index]) for t, index in enumerate(indices)]


def train(examples, iterations=120, regularization=0.04):
    labels = sorted({label for _, sequence in examples for label in sequence} | {"NONE"})
    vocabulary = sorted({feature for sequence, _ in examples for token in sequence for feature in token})
    model = LinearChainCRF(labels, vocabulary)

    def objective(weights):
        model.weights = weights
        loss = 0.5 * regularization * np.dot(weights, weights)
        gradient_emission = np.zeros((model.k, model.f))
        gradient_transition = np.zeros((model.k, model.k))
        for sequence, gold in examples:
            log_z, unary, pair, encoded = model.forward_backward(sequence)
            emission, transition, _ = model.potentials(sequence)
            indices = [model.index[label] for label in gold]
            loss += log_z - sum(emission[time, label] for time, label in enumerate(indices))
            loss -= sum(transition[indices[time - 1], indices[time]] for time in range(1, len(indices)))
            for time, features in enumerate(encoded):
                diff = unary[time].copy()
                diff[indices[time]] -= 1
                for feature in features:
                    gradient_emission[:, feature] += diff
            for time in range(1, len(indices)):
                gradient_transition += pair[time - 1]
                gradient_transition[indices[time - 1], indices[time]] -= 1
        gradient = np.concatenate([gradient_emission.ravel(), gradient_transition.ravel()])
        return loss, gradient + regularization * weights

    result = minimize(objective, model.weights, jac=True, method="L-BFGS-B",
                      options={"maxiter": iterations, "ftol": 1e-8})
    model.weights = result.x
    model.training = {"success": bool(result.success), "iterations": int(result.nit),
                      "finalLoss": float(result.fun), "features": len(vocabulary), "labels": labels}
    return model


def gold_for_entry(entry, record):
    interval = entry.get("range")
    if interval:
        matches = [key for key, span in record["spans"].items()
                   if interval["start"] < span["end"] and interval["end"] > span["start"]]
        return matches[0] if len(matches) == 1 else "NONE"
    value = str(entry.get("value") or "")
    matches = [key for key, wanted in record["fields"].items() if value == wanted]
    return matches[0] if len(matches) == 1 else "NONE"


def make_examples(cases, predictions, split):
    index = {item["id"]: item for item in predictions["results"]}
    examples = []
    for case in cases:
        if case["split"] != split:
            continue
        rows = index[case["id"]]["records"]
        if len(rows) != len(case["records"]):
            continue  # Cannot train through an uncertain record boundary.
        for row, record in zip(rows, case["records"]):
            entries = row.get("entries", [])
            if entries:
                examples.append((features_for(entries), [gold_for_entry(entry, record) for entry in entries]))
    return examples


def hybrid(cases, predictions, model, threshold):
    from classifier2_evaluate import fields_of
    result = json.loads(json.dumps(predictions))
    for case, output in zip(cases, result["results"]):
        started = time.perf_counter()
        if len(output["records"]) != len(case["records"]):
            continue
        for row in output["records"]:
            entries = row.get("entries", [])
            if not entries:
                continue
            labels, confidences = model.predict(features_for(entries))
            for entry, label, confidence in zip(entries, labels, confidences):
                if label == "NONE" or confidence < threshold or not entry.get("value"):
                    continue
                if fields_of(row).get(label):
                    continue
                # The model only fills unresolved values from this parsed record.
                # Existing explicit/manual assignments are immutable.
                if label in row.get("data", {}):
                    row["data"][label] = entry["value"]
                elif label in row.get("extended", {}):
                    row["extended"][label] = entry["value"]
        output["durationMs"] += (time.perf_counter() - started) * 1000
    return result


def run(dataset_path, prediction_path, report_path):
    from classifier2_evaluate import summarize
    cases = [json.loads(line) for line in Path(dataset_path).read_text().splitlines()]
    predictions = json.loads(Path(prediction_path).read_text())
    examples = make_examples(cases, predictions, "train")
    training_started = time.perf_counter()
    model = train(examples)
    training_ms = (time.perf_counter() - training_started) * 1000
    baseline_tune = summarize(cases, predictions, "tune")
    candidates = []
    for threshold in (0.50, 0.70, 0.80, 0.90, 0.95, 0.98, 0.995, 1.01):
        metrics = summarize(cases, hybrid(cases, predictions, model, threshold), "tune")
        eligible = (metrics["falseAssignments"] <= baseline_tune["falseAssignments"] and
                    metrics["boundaryErrors"] <= baseline_tune["boundaryErrors"] and
                    metrics["crossRecordTransfers"] == 0)
        candidates.append((eligible, metrics["macroF1"], threshold, metrics))
    eligible = [candidate for candidate in candidates if candidate[0]]
    best = max(eligible, key=lambda item: (item[1], item[2])) if eligible else candidates[-1]
    selected = best[2]
    report = {"training": {**model.training, "durationMs": training_ms}, "trainSequences": len(examples),
              "thresholdSelection": [{"threshold": threshold, "eligible": is_eligible,
                                      "macroF1": score, "falseAssignments": metrics["falseAssignments"]}
                                     for is_eligible, score, threshold, metrics in candidates],
              "selectedThreshold": selected,
              "train": summarize(cases, hybrid(cases, predictions, model, selected), "train"),
              "tune": summarize(cases, hybrid(cases, predictions, model, selected), "tune"),
              "test": summarize(cases, hybrid(cases, predictions, model, selected), "test")}
    Path(report_path).write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"sequences": len(examples), "threshold": selected,
                      "testMacroF1": report["test"]["macroF1"],
                      "testFalseAssignments": report["test"]["falseAssignments"]}))


if __name__ == "__main__":
    run(*sys.argv[1:4])
