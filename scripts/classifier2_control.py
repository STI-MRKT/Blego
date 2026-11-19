#!/usr/bin/env python3
"""Gold annotation for the supplied sanitized control, never a training example."""
import json
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
CONTROL = ROOT / "tests/fixtures/BLEGO_TZ13_CONTROL_SANITIZED.txt"
LABELS = {
    "login": "Login FB", "password": "Password", "email": "Email",
    "emailPassword": "Email password", "accountId": "ID Account",
    "birthDate": "Date of Birth", "token": "Token",
    "userAgent": "User-agent", "cookies": "Cookie",
}


def make_case():
    text = CONTROL.read_text(encoding="utf-8").rstrip("\n")
    if "\n" in text or "\r" in text:
        raise ValueError("CONTROL_MUST_BE_ONE_LINE")
    cells = text.split("\t")
    starts = []
    offset = 0
    for cell in cells:
        starts.append(offset)
        offset += len(cell) + 1
    fields, spans = {}, {}
    for key, label in LABELS.items():
        occurrences = [index for index, cell in enumerate(cells) if cell == label]
        if len(occurrences) != 1 or occurrences[0] + 1 >= len(cells):
            raise ValueError("MISSING_OR_DUPLICATE_CONTROL_LABEL")
        index = occurrences[0] + 1
        raw = cells[index]
        spans[key] = {"start": starts[index], "end": starts[index] + len(raw), "raw": raw}
        fields[key] = raw
    url = urlparse(fields["accountId"])
    ids = parse_qs(url.query).get("id", [])
    if url.hostname not in {"facebook.com", "www.facebook.com"} or len(ids) != 1 or not ids[0].isdigit():
        raise ValueError("INVALID_CONTROL_ID_URL")
    fields["accountId"] = ids[0]
    return {"id": "supplied-sanitized-control", "family": "supplied_control", "split": "control",
            "format": "txt", "text": text,
            "records": [{"start": 0, "end": len(text), "fields": fields, "spans": spans}]}


if __name__ == "__main__":
    Path(sys.argv[1]).write_text(json.dumps(make_case(), ensure_ascii=False) + "\n", encoding="utf-8")
    print("Sanitized control annotation ready: one record, nine fields")
