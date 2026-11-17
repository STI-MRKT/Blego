import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class ControlTest(unittest.TestCase):
    def test_supplied_control_is_separate_and_has_exact_spans(self):
        source = ROOT / "scripts/classifier2_control.py"
        spec = importlib.util.spec_from_file_location("classifier2_control", source)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        case = module.make_case()
        self.assertEqual(case["split"], "control")
        self.assertEqual(case["format"], "txt")
        self.assertEqual(len(case["records"]), 1)
        record = case["records"][0]
        self.assertEqual(record["fields"]["accountId"], "61500000000000")
        self.assertEqual(record["fields"]["password"], "FAKEPASS01")
        self.assertEqual(record["fields"]["emailPassword"], "FAKEMAILPASS1")
        for field, span in record["spans"].items():
            self.assertEqual(case["text"][span["start"]:span["end"]], span["raw"], field)
        self.assertEqual(set(record["fields"]), set(record["spans"]))


if __name__ == "__main__":
    unittest.main()
