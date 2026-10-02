"""
ternary_quantum_hypernet.py — True Ternary Quantum Hypernetwork
===============================================================
A neural meta-network where:
1. Controller weights are strictly discrete balanced ternary trits {-1, 0, +1}
   using TernaryLinear with Straight-Through Estimation.
2. Network outputs are discrete trits {-1, 0, +1} selecting B₄ anyon braid powers.
3. Target quantum circuit operates on 3-state topological qutrits in SU(3) and SU(9).
"""

import torch
import torch.nn as nn
from research.grokking.quantizer import TernaryLinear, ternarize
from .ternary_qutrit_circuit import TopologicalQutritCircuit


class TrueTernaryQuantumHypernetwork(nn.Module):
    """
    A 100% balanced ternary quantum hypernetwork.
    - Meta-weights: {-1, 0, +1} (TernaryLinear)
    - Circuit controls: {-1, 0, +1} (Braid powers for σ₁, σ₂, σ₃)
    - State space: Qutrits in C³ / C⁹
    """

    def __init__(self, latent_dim: int = 16, hidden_dim: int = 32, delta: float = 0.35):
        super().__init__()
        self.latent_dim = latent_dim
        self.hidden_dim = hidden_dim
        self.delta = delta

        # Continuous latent task parameter
        self.latent = nn.Parameter(torch.randn(latent_dim) * 0.2)

        # Ternary linear layers with weights strictly in {-1, 0, +1}
        self.layer1 = TernaryLinear(latent_dim, hidden_dim, bias=False, delta=delta)
        # Outputs 6 trits: 3 for Qutrit A braids, 3 for Qutrit B braids
        self.layer2 = TernaryLinear(hidden_dim, 6, bias=False, delta=delta)

        # Native Topological Qutrit Circuit
        self.circuit = TopologicalQutritCircuit()

    def generate_braid_trits(self) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Runs the ternary controller to output discrete braid trits {-1, 0, +1}.
        Returns (braid_trits_a, braid_trits_b) each of shape (3,).
        """
        # Forward through TernaryLinear layers
        h = self.layer1(self.latent)
        h = torch.relu(h)
        raw_trits = self.layer2(h)

        # Quantize outputs to balanced ternary trits {-1, 0, +1} via STE
        discrete_trits = ternarize(raw_trits, delta=self.delta)

        trits_a = discrete_trits[0:3]
        trits_b = discrete_trits[3:6]
        return trits_a, trits_b

    def forward(self, a_idx: torch.Tensor, b_idx: torch.Tensor) -> torch.Tensor:
        """
        Forward evaluation: generates braid trits and simulates topological qutrit circuit.
        """
        trits_a, trits_b = self.generate_braid_trits()
        return self.circuit(a_idx, b_idx, trits_a, trits_b)

    def get_sparsity(self) -> dict[str, float]:
        """Returns ternary weight sparsity across the hypernetwork."""
        s1 = self.layer1.get_sparsity()
        s2 = self.layer2.get_sparsity()
        trits_a, trits_b = self.generate_braid_trits()
        total_braids = 6
        zero_braids = ((trits_a == 0.0).sum() + (trits_b == 0.0).sum()).item()

        return {
            "layer1_pct_zero": s1["pct_zero"],
            "layer2_pct_zero": s2["pct_zero"],
            "mean_weight_sparsity": (s1["pct_zero"] + s2["pct_zero"]) / 2.0,
            "braid_identity_pct": (zero_braids / total_braids) * 100.0,
        }
