"""
test_quantum_grokking.py — Unit Test Suite for Quantum Circuit & Grokking Engine
================================================================================
Tests:
1. Exact QFT matrix unitarity (QFT† QFT = I)
2. Parameterized unitary operator strict unitarity for arbitrary parameters
3. Born-rule probability normalization (sum_y p(y) = 1.0)
4. Entanglement entropy validation on Bell state (1.0 bit) vs product state (0.0 bits)
5. Quantum hypernetwork gradient flow from loss to classical weights
"""

import unittest
import torch
import numpy as np

from research.quantum_grokking.quantum_circuit import (
    build_qft_matrix,
    ParameterizedUnitary,
    QuantumModularAdderCircuit,
)
from research.quantum_grokking.quantum_hypernet import ClassicalQuantumHypernetwork
from research.quantum_grokking.qft_analyzer import QuantumGrokkingAnalyzer
from research.quantum_grokking.dataset import QuantumModularDataset, get_quantum_modular_data


class TestQuantumCircuit(unittest.TestCase):
    def test_qft_matrix_unitarity(self):
        for d in [3, 5, 7, 8]:
            qft = build_qft_matrix(d)
            identity = torch.eye(d, dtype=torch.complex64)
            prod = torch.matmul(qft.conj().T, qft)
            diff = torch.max(torch.abs(prod - identity)).item()
            self.assertLess(diff, 1e-5, f"QFT matrix not unitary for d={d}")

    def test_parameterized_unitary_strictly_unitary(self):
        d = 7
        pu = ParameterizedUnitary(d)
        U = pu.get_unitary()
        identity = torch.eye(d, dtype=torch.complex64)
        prod = torch.matmul(U.conj().T, U)
        diff = torch.max(torch.abs(prod - identity)).item()
        self.assertLess(diff, 1e-5, "Parameterized unitary violated U† U = I")

    def test_born_rule_probability_normalization(self):
        p = 5
        circuit = QuantumModularAdderCircuit(p=p)
        a_idx = torch.tensor([0, 2, 4])
        b_idx = torch.tensor([1, 3, 2])

        logits = circuit(a_idx, b_idx)
        probs = torch.exp(logits)
        sum_probs = torch.sum(probs, dim=-1)
        expected = torch.ones_like(sum_probs)
        torch.testing.assert_close(sum_probs, expected, atol=1e-4, rtol=1e-4)


class TestQuantumAnalyzer(unittest.TestCase):
    def test_bell_state_entanglement_entropy(self):
        p = 2
        analyzer = QuantumGrokkingAnalyzer(p=p)

        # Maximally entangled Bell state: (|00⟩ + |11⟩) / sqrt(2)
        psi_bell = torch.zeros(1, p, p, dtype=torch.complex64)
        psi_bell[0, 0, 0] = 1.0 / np.sqrt(2)
        psi_bell[0, 1, 1] = 1.0 / np.sqrt(2)

        res = analyzer.compute_entanglement_entropy(psi_bell)
        # S_vN of Bell state must be exactly 1.0 bit!
        self.assertAlmostEqual(res["mean_entropy_bits"], 1.0, places=4)
        self.assertAlmostEqual(res["normalized_entropy"], 1.0, places=4)

    def test_product_state_zero_entropy(self):
        p = 3
        analyzer = QuantumGrokkingAnalyzer(p=p)

        # Unentangled product state: |0⟩ ⊗ |1⟩
        psi_prod = torch.zeros(1, p, p, dtype=torch.complex64)
        psi_prod[0, 0, 1] = 1.0

        res = analyzer.compute_entanglement_entropy(psi_prod)
        self.assertAlmostEqual(res["mean_entropy_bits"], 0.0, places=4)

    def test_qft_self_fidelity(self):
        p = 5
        analyzer = QuantumGrokkingAnalyzer(p=p)
        qft = build_qft_matrix(p)
        fid = analyzer.compute_unitary_qft_fidelity(qft)
        self.assertAlmostEqual(fid, 1.0, places=5)


class TestQuantumHypernetwork(unittest.TestCase):
    def test_hypernetwork_forward_and_backward(self):
        p = 5
        hypernet = ClassicalQuantumHypernetwork(p=p, latent_dim=16, hidden_dim=32)
        a = torch.tensor([0, 1, 2])
        b = torch.tensor([3, 4, 1])
        y = torch.tensor([3, 0, 3])

        logits = hypernet(a, b)
        self.assertEqual(logits.shape, (3, p))

        criterion = torch.nn.CrossEntropyLoss()
        loss = criterion(logits, y)
        loss.backward()

        self.assertIsNotNone(hypernet.latent.grad)
        self.assertGreater(torch.norm(hypernet.latent.grad).item(), 0.0)


if __name__ == "__main__":
    unittest.main()
