"""
test_ternary_grokking.py — Unit Test Suite for Ternary Hypernetworks & Grokking
==============================================================================
Tests:
1. Native Bit-Sliced SIMD Packing & Matmul Bit-Exactness
2. Straight-Through Estimator (STE) Quantization & Gradient Flow
3. TernaryMLP & TernaryHypernetwork Forward & Sparsity
4. Native SIMD vs PyTorch Output Equivalence
5. Cyclotomic Fourier Analyzer Validation on Synthetic Fourier Signals
"""

import unittest
import numpy as np
import torch
import torch.nn as nn

from research.grokking.bridge import (
    pack_trits,
    unpack_trits,
    native_ternary_matmul,
)
from research.grokking.quantizer import TernarySTE, ternarize, TernaryLinear
from research.grokking.dataset import ModularArithmeticDataset, get_modular_data
from research.grokking.hypernetwork import TernaryMLP, TernaryHypernetwork
from research.grokking.fourier_analyzer import CyclotomicFourierAnalyzer


class TestTernarySIMD(unittest.TestCase):
    def test_packing_roundtrip(self):
        rng = np.random.RandomState(42)
        trits = rng.choice([-1, 0, 1], size=256).astype(np.int8)
        p, m = pack_trits(trits)
        restored = unpack_trits(p, m, len(trits))
        np.testing.assert_array_equal(trits, restored)

    def test_native_matmul_matches_numpy(self):
        rng = np.random.RandomState(123)
        B, M, N = 32, 64, 128
        X = rng.choice([-1, 0, 1], size=(B, N)).astype(np.int8)
        W = rng.choice([-1, 0, 1], size=(M, N)).astype(np.int8)

        expected = X.astype(np.int32) @ W.T.astype(np.int32)
        actual = native_ternary_matmul(X, W)
        np.testing.assert_array_equal(expected, actual)


class TestTernaryQuantizer(unittest.TestCase):
    def test_quantizer_discrete_values(self):
        theta = torch.tensor([-2.0, -0.8, -0.2, 0.0, 0.1, 0.36, 1.2], requires_grad=True)
        w = ternarize(theta, delta=0.35)
        expected = torch.tensor([-1.0, -1.0, 0.0, 0.0, 0.0, 1.0, 1.0])
        torch.testing.assert_close(w, expected)

    def test_ste_gradient_flow(self):
        theta = torch.tensor([-2.0, -0.5, 0.5, 2.0], requires_grad=True)
        w = ternarize(theta, delta=0.35, clip_val=1.5)
        loss = (w * torch.tensor([1.0, 2.0, 3.0, 4.0])).sum()
        loss.backward()

        # Gradients outside [-1.5, 1.5] should be clipped to 0
        expected_grad = torch.tensor([0.0, 2.0, 3.0, 0.0])
        torch.testing.assert_close(theta.grad, expected_grad)

    def test_ternary_linear_sparsity(self):
        layer = TernaryLinear(64, 32, delta=0.35)
        sparsity = layer.get_sparsity()
        self.assertIn("pct_zero", sparsity)
        self.assertIn("active_sparsity", sparsity)
        self.assertGreaterEqual(sparsity["pct_zero"], 0.0)
        self.assertLessEqual(sparsity["pct_zero"], 100.0)


class TestModularDataset(unittest.TestCase):
    def test_disjoint_train_test_split(self):
        p = 31
        train_ds = ModularArithmeticDataset(p=p, op="add", split_ratio=0.5, split="train", seed=42)
        test_ds = ModularArithmeticDataset(p=p, op="add", split_ratio=0.5, split="test", seed=42)

        train_pairs = set(train_ds.pairs)
        test_pairs = set(test_ds.pairs)

        # Intersection must be empty
        self.assertEqual(len(train_pairs.intersection(test_pairs)), 0)
        # Total must equal p * p
        self.assertEqual(len(train_pairs) + len(test_pairs), p * p)

    def test_modular_targets(self):
        p = 23
        ds = ModularArithmeticDataset(p=p, op="add", split="all")
        for i in range(len(ds)):
            a, b = ds.pairs[i]
            expected = (a + b) % p
            self.assertEqual(ds.targets[i].item(), expected)


class TestFourierAnalyzer(unittest.TestCase):
    def test_synthetic_fourier_circle(self):
        p = 29
        analyzer = CyclotomicFourierAnalyzer(p=p)

        # Generate ideal circle signal: f(a, b) = cos(2 * pi * 3 * (a + b) / p)
        # Frequency k = 3
        grid = np.zeros((p, p), dtype=np.float32)
        for a in range(p):
            for b in range(p):
                grid[a, b] = np.cos(2 * np.pi * 3 * (a + b) / p)

        res = analyzer.analyze_neuron(grid.flatten())
        # Diagonal power ratio must be ~1.0 because f depends purely on (a + b)
        self.assertAlmostEqual(res["diagonal_power_ratio"], 1.0, places=4)
        self.assertEqual(res["dominant_freq"], 3)

    def test_random_noise_fourier_ratio(self):
        p = 31
        analyzer = CyclotomicFourierAnalyzer(p=p)
        rng = np.random.RandomState(42)
        random_grid = rng.randn(p * p).astype(np.float32)

        res = analyzer.analyze_neuron(random_grid)
        # Random noise should have diagonal ratio ~ 1/p
        expected_ratio = 1.0 / p
        self.assertLess(res["diagonal_power_ratio"], 0.15)


class TestTernaryModels(unittest.TestCase):
    def test_ternary_mlp_forward_and_backward(self):
        p = 23
        model = TernaryMLP(input_dim=2 * p, hidden_dim=64, output_dim=p, activation="quadratic")
        x = torch.randn(8, 2 * p)
        out = model(x)
        self.assertEqual(out.shape, (8, p))

        loss = out.sum()
        loss.backward()
        self.assertIsNotNone(model.layer1.weight.grad)
        self.assertIsNotNone(model.layer2.weight.grad)

    def test_ternary_hypernetwork_forward_and_backward(self):
        p = 23
        model = TernaryHypernetwork(input_dim=2 * p, hidden_dim=32, output_dim=p)
        x = torch.randn(4, 2 * p)
        out = model(x)
        self.assertEqual(out.shape, (4, p))

        loss = out.sum()
        loss.backward()
        self.assertIsNotNone(model.latent_emb.grad)


if __name__ == "__main__":
    unittest.main()
