import importlib.util
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("classifier2_dataset", ROOT / "scripts/classifier2_dataset.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DatasetTest(unittest.TestCase):
    def test_families_are_split_without_leakage(self):
        cases = MODULE.dataset()
        self.assertEqual(len(cases), 36)
        self.assertEqual(len({case["id"] for case in cases}), len(cases))
        for family in MODULE.SPLITS:
            self.assertEqual({case["split"] for case in cases if case["family"] == family},
                             {MODULE.SPLITS[family]})
        self.assertGreaterEqual(len({case["family"] for case in cases if case["split"] == "test"}), 3)

    def test_gold_boundaries_and_original_spans_are_exact(self):
        for case in MODULE.dataset():
            text = case["text"]
            self.assertEqual(len(case["records"]), 1 if case["id"].endswith(("-1", "-3")) else 2)
            last_end = 0
            for record in case["records"]:
                self.assertGreaterEqual(record["start"], last_end)
                self.assertLess(record["start"], record["end"])
                self.assertLessEqual(record["end"], len(text))
                for field, span in record["spans"].items():
                    self.assertGreaterEqual(span["start"], record["start"], (case["id"], field))
                    self.assertLessEqual(span["end"], record["end"], (case["id"], field))
                    self.assertEqual(text[span["start"]:span["end"]], span["raw"])
                    self.assertIn(field, record["fields"])
                if case["id"].endswith("-4"):
                    self.assertNotIn("emailPassword", record["fields"])
                last_end = record["end"]

    def test_no_live_secret_or_non_example_domain(self):
        for case in MODULE.dataset():
            text = case["text"]
            for match in re.findall(r"[\w.+-]+@([\w.-]+)", text):
                self.assertEqual(match, "example.invalid")
            self.assertNotRegex(text, r"(?i)(?:EAAB|EAAJ)[A-Za-z0-9]{20,}")
            self.assertTrue(all(token in text for token in ("SYNTHETIC", "example.invalid")))


if __name__ == "__main__":
    unittest.main()
