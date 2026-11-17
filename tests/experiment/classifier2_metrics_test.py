import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class MetricsTest(unittest.TestCase):
    def module(self):
        source = ROOT / "scripts/classifier2_evaluate.py"
        spec = importlib.util.spec_from_file_location("classifier2_evaluate", source)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_missing_and_wrong_assignments_are_distinct(self):
        metrics = self.module().score_case(
            {"records": [{"fields": {"email": "one@example.invalid", "password": "SYNTHETIC_ONE"}}]},
            {"records": [{"data": {"email": "wrong@example.invalid", "password": ""}, "extended": {}}]},
        )
        self.assertEqual(metrics["correct"], 0)
        self.assertEqual(metrics["missing"], 2)
        self.assertEqual(metrics["falseAssignments"], 1)
        self.assertEqual(metrics["boundaryErrors"], 0)

    def test_cross_record_transfer_and_boundary_error_are_counted(self):
        gold = {"records": [
            {"fields": {"email": "one@example.invalid"}},
            {"fields": {"email": "two@example.invalid"}},
        ]}
        swapped = {"records": [
            {"data": {"email": "two@example.invalid"}, "extended": {}},
            {"data": {"email": "one@example.invalid"}, "extended": {}},
        ]}
        self.assertEqual(self.module().score_case(gold, swapped)["crossRecordTransfers"], 2)
        self.assertEqual(self.module().score_case(gold, {"records": swapped["records"][:1]})["boundaryErrors"], 1)

    def test_fragmented_record_is_boundary_failure_without_invented_cross_account_transfer(self):
        gold = {"records": [
            {"start": 0, "end": 10, "fields": {"email": "one@example.invalid"}},
            {"start": 12, "end": 22, "fields": {"email": "two@example.invalid"}},
        ]}
        fragmented = {"records": [
            {"data": {"email": "one@example.invalid"}, "extended": {},
             "entries": [{"range": {"start": 0, "end": 5}}]},
            {"data": {}, "extended": {}, "entries": [{"range": {"start": 5, "end": 10}}]},
            {"data": {"email": "two@example.invalid"}, "extended": {},
             "entries": [{"range": {"start": 12, "end": 20}}]},
        ]}
        result = self.module().score_case(gold, fragmented)
        self.assertGreater(result["boundaryErrors"], 0)
        self.assertEqual(result["crossRecordTransfers"], 0)


if __name__ == "__main__":
    unittest.main()
