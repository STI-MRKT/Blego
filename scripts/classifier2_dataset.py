#!/usr/bin/env python3
"""Deterministic, entirely synthetic Classifier 2.0 span-labelled corpus."""
import csv
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs/verification/classifier2/dataset.jsonl"
SPLITS = {
    "vertical_tab": "train",
    "csv_headers": "train",
    "json_objects": "train",
    "colon_positional": "train",
    "tsv_headers": "tune",
    "pipe_mixed": "tune",
    "horizontal_noisy": "test",
    "multiline_mixed": "test",
    "double_colon": "test",
}


def values(number, missing_mail=False):
    ident = str(61500000000000 + number)
    result = {
        "login": f"synthetic.login.{number}",
        "password": f"SYNTHETIC_ACCOUNT_{number}",
        "email": f"synthetic{number}@example.invalid",
        "emailPassword": "" if missing_mail else f"SYNTHETIC_MAIL_{number}",
        "accountId": ident,
        "birthDate": f"{number % 27 + 1:02d}.02.1994",
        "token": f"SYNTHETIC_TOKEN_{number}",
        "userAgent": f"Mozilla/5.0 (Synthetic {number})",
        "cookies": json.dumps(
            [{"name": "c_user", "value": ident}, {"name": "xs", "value": f"SYNTHETIC:{number}"}],
            separators=(",", ":"),
        ),
    }
    return result


LABELS = {
    "login": "Login FB", "password": "Password", "email": "Email",
    "emailPassword": "Email password", "accountId": "ID Account",
    "birthDate": "Date of Birth", "token": "Token",
    "userAgent": "User-agent", "cookies": "Cookie",
}


def csv_cell(value, delimiter):
    out = io.StringIO()
    writer = csv.writer(out, delimiter=delimiter, lineterminator="")
    writer.writerow([value])
    return out.getvalue()


def record(family, value, variant):
    keys = list(value)
    if family in ("vertical_tab", "horizontal_noisy", "multiline_mixed"):
        if family == "horizontal_noisy":
            parts = []
            for key in keys:
                if key == "email":
                    parts += ["Сервис входа на почту:", "https://example.invalid/mail"]
                if key == "userAgent":
                    parts += ["ИНСТРУКЦИЯ / INSTRUCTIONS - @example_bot"]
                parts += [LABELS[key], (
                    f"https://www.facebook.com/profile.php?id={value[key]}"
                    if key == "accountId" else value[key]
                )]
            text = "\t".join(parts)
        else:
            separator = "\n" if family == "vertical_tab" else "\r\n"
            parts = [f"{LABELS[key]}\t{value[key]}" for key in keys]
            if family == "multiline_mixed":
                parts.insert(3, "Instructions: synthetic only")
            text = separator.join(parts)
        sources = {k: (
            f"https://www.facebook.com/profile.php?id={v}" if family == "horizontal_noisy" and k == "accountId" else v
        ) for k, v in value.items() if v}
    elif family in ("csv_headers", "tsv_headers", "json_objects"):
        if family == "json_objects":
            text = json.dumps({LABELS[k]: v for k, v in value.items()}, ensure_ascii=False, separators=(",", ":"))
            sources = {k: json.dumps(v, ensure_ascii=False) for k, v in value.items() if v}
        else:
            delimiter = "," if family == "csv_headers" else "\t"
            text = delimiter.join(csv_cell(value[k], delimiter) for k in keys)
            sources = {k: csv_cell(v, delimiter) for k, v in value.items() if v}
    elif family == "colon_positional":
        keys = ["login", "password", "email", "emailPassword", "accountId"]
        text = ":".join(value[k] for k in keys)
        sources = {k: value[k] for k in keys if value[k]}
    elif family == "pipe_mixed":
        keys = ["email", "token", "userAgent", "cookies", "password", "emailPassword", "birthDate", "accountId"]
        text = " | ".join(value[k] for k in keys)
        sources = {k: value[k] for k in keys if value[k]}
    else:
        keys = ["login", "password", "email", "emailPassword", "accountId", "birthDate"]
        text = "::".join(value[k] for k in keys)
        sources = {k: value[k] for k in keys if value[k]}
    expected = {k: value[k] for k in keys if value[k]}
    spans = {}
    for key, raw in sources.items():
        anchor = f"{LABELS[key]}\t" if family in ("vertical_tab", "horizontal_noisy", "multiline_mixed") else ""
        position = text.find(anchor) + len(anchor) if anchor else 0
        start = text.find(raw, position)
        if start < 0:
            raise ValueError((family, key, raw))
        spans[key] = {"start": start, "end": start + len(raw), "raw": raw}
    return text, expected, spans


def dataset():
    cases = []
    index = 0
    for family, split in SPLITS.items():
        for variant in range(4):
            records = []
            number_of_records = 2 if variant % 2 else 1
            for _ in range(number_of_records):
                index += 1
                records.append(record(family, values(index, variant == 3), variant))
            if family in ("csv_headers", "tsv_headers"):
                delimiter = "," if family == "csv_headers" else "\t"
                header = delimiter.join(csv_cell(LABELS[k], delimiter) for k in values(1)) + "\n"
                separator = "\n"
                suffix = ""
            elif family == "json_objects":
                header, separator, suffix = "[", ",", "]"
            else:
                header, separator, suffix = "", "\n\n" if family in ("vertical_tab", "multiline_mixed") else "\n", ""
            text = header + separator.join(item[0] for item in records) + suffix
            gold = []
            offset = len(header)
            for raw, expected, spans in records:
                gold.append({
                    "start": offset,
                    "end": offset + len(raw),
                    "fields": expected,
                    "spans": {k: {**v, "start": v["start"] + offset, "end": v["end"] + offset} for k, v in spans.items()},
                })
                offset += len(raw) + len(separator)
            format_name = "csv" if family == "csv_headers" else "json" if family == "json_objects" else "tsv" if family == "tsv_headers" else "txt"
            cases.append({"id": f"{family}-{variant + 1}", "family": family, "split": split,
                          "format": format_name, "text": text, "records": gold})
    return cases


if __name__ == "__main__":
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("".join(json.dumps(case, ensure_ascii=False, separators=(",", ":")) + "\n" for case in dataset()), encoding="utf-8")
    print(f"Wrote {len(dataset())} synthetic files to {OUTPUT.relative_to(ROOT)}")
