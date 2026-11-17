import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load():
    spec = importlib.util.spec_from_file_location("classifier2_crf", ROOT / "scripts/classifier2_crf.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CrfTest(unittest.TestCase):
    def test_forward_backward_marginals_normalize(self):
        crf = load()
        model = crf.LinearChainCRF(["NONE", "email"], ["first", "second"])
        sequence = [["first"], ["second"]]
        probabilities = model.marginals(sequence)
        self.assertEqual(probabilities.shape, (2, 2))
        for row in probabilities:
            self.assertAlmostEqual(sum(row), 1.0, places=8)

    def test_training_learns_a_simple_sequence_without_secret_content(self):
        crf = load()
        examples = [([['first'], ['second']], ['email', 'password'])] * 8
        model = crf.train(examples, iterations=60)
        labels, confidence = model.predict([['first'], ['second']])
        self.assertEqual(labels, ['email', 'password'])
        self.assertTrue(all(0 <= value <= 1 for value in confidence))

    def test_structural_features_exclude_raw_secret(self):
        crf = load()
        entries = [
            {"header": "Password", "column": "Password", "value": "SYNTHETIC_SECRET_123", "labelled": True},
            {"header": "Email", "column": "Email", "value": "one@example.invalid", "labelled": True},
        ]
        features = crf.features_for(entries)
        self.assertEqual(len(features), 2)
        self.assertNotIn("SYNTHETIC_SECRET_123", str(features))
        self.assertIn("header=password", features[0])
        unknown = crf.features_for([{
            "header": "Unknown 2FA SYNTHETIC_PRIVATE_123",
            "column": "Unknown 2FA SYNTHETIC_PRIVATE_123",
            "value": "SYNTHETIC_SECRET_123",
            "labelled": True,
        }])
        self.assertNotIn("syntheticprivate123", str(unknown).lower())


if __name__ == "__main__":
    unittest.main()
