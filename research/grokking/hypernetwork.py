"""
hypernetwork.py — Ternary Hypernetwork & Target MLP Architectures
=================================================================
Implements:
1. TernaryMLP: Direct discrete ternary network with continuous latent regularization.
2. TernaryHypernetwork: Meta-network generating discrete ternary weights for a target MLP.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

from .quantizer import TernaryLinear, ternarize
from .bridge import native_ternary_matmul


class QuadraticActivation(nn.Module):
    """
    f(x) = x^2.
    Standard in mechanistic interpretability & grokking literature (Nanda et al.)
    because quadratic activations naturally produce product-to-sum trigonometric
    identities: (cos a + cos b)^2 contains 2 * cos a * cos b.
    """
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * x


class TernaryMLP(nn.Module):
    """
    Target neural network with strictly discrete balanced ternary weights {-1, 0, +1}.
    """

    def __init__(
        self,
        input_dim: int,
        hidden_dim: int,
        output_dim: int,
        activation: str = "quadratic",
        delta: float = 0.35,
    ):
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.output_dim = output_dim

        self.layer1 = TernaryLinear(input_dim, hidden_dim, bias=False, delta=delta)
        self.layer2 = TernaryLinear(hidden_dim, output_dim, bias=False, delta=delta)

        if activation == "quadratic":
            self.act = QuadraticActivation()
        elif activation == "relu":
            self.act = nn.ReLU()
        else:
            raise ValueError(f"Unknown activation: {activation}")

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = self.layer1(x)
        h_act = self.act(h)
        out = self.layer2(h_act)
        return out

    def get_sparsity(self) -> dict[str, float]:
        s1 = self.layer1.get_sparsity()
        s2 = self.layer2.get_sparsity()
        return {
            "layer1_pct_zero": s1["pct_zero"],
            "layer1_active": s1["active_sparsity"],
            "layer2_pct_zero": s2["pct_zero"],
            "layer2_active": s2["active_sparsity"],
            "mean_sparsity": (s1["pct_zero"] + s2["pct_zero"]) / 2.0,
        }

    def forward_native_simd(self, x_numpy: np.ndarray) -> np.ndarray:
        """
        Executes inference using the native C AVX2/NEON bit-sliced engine.
        x_numpy: (B, input_dim) with values in {-1, 0, +1}.
        """
        w1 = self.layer1.ternary_weight.detach().cpu().numpy().astype(np.int8)
        w2 = self.layer2.ternary_weight.detach().cpu().numpy().astype(np.int8)

        # Layer 1: X @ W1.T
        h1 = native_ternary_matmul(x_numpy, w1)  # (B, hidden_dim) int32

        # Activation: Quadratic
        h1_act = (h1 * h1).astype(np.float32)

        # Layer 2: float matrix multiply with ternary weights
        out = h1_act @ w2.T.astype(np.float32)
        return out


class TernaryHypernetwork(nn.Module):
    """
    A continuous meta-network that generates the discrete ternary weights
    for a target MLP.
    """

    def __init__(
        self,
        input_dim: int,
        hidden_dim: int,
        output_dim: int,
        latent_dim: int = 64,
        delta: float = 0.35,
    ):
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.output_dim = output_dim
        self.delta = delta

        # Total weights needed for target network
        self.num_w1 = hidden_dim * input_dim
        self.num_w2 = output_dim * hidden_dim

        # Latent task embedding
        self.latent_emb = nn.Parameter(torch.randn(latent_dim))

        # Hypernetwork generator MLPs
        self.gen_w1 = nn.Sequential(
            nn.Linear(latent_dim, 128),
            nn.GELU(),
            nn.Linear(128, self.num_w1),
        )
        self.gen_w2 = nn.Sequential(
            nn.Linear(latent_dim, 128),
            nn.GELU(),
            nn.Linear(128, self.num_w2),
        )

        self.act = QuadraticActivation()

    def generate_ternary_weights(self) -> tuple[torch.Tensor, torch.Tensor]:
        """Generates continuous weights and quantizes them to balanced ternary {-1, 0, +1}."""
        raw_w1 = self.gen_w1(self.latent_emb).view(self.hidden_dim, self.input_dim)
        raw_w2 = self.gen_w2(self.latent_emb).view(self.output_dim, self.hidden_dim)

        w1_ternary = ternarize(raw_w1, delta=self.delta)
        w2_ternary = ternarize(raw_w2, delta=self.delta)
        return w1_ternary, w2_ternary

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        w1, w2 = self.generate_ternary_weights()
        h = F.linear(x, w1)
        h = self.act(h)
        out = F.linear(h, w2)
        return out

    def get_sparsity(self) -> dict[str, float]:
        with torch.no_grad():
            w1, w2 = self.generate_ternary_weights()
            total = w1.numel() + w2.numel()
            n_zero = (w1 == 0.0).sum().item() + (w2 == 0.0).sum().item()
            return {
                "mean_sparsity": (n_zero / total) * 100.0,
                "w1_zeros": (w1 == 0.0).sum().item() / w1.numel() * 100.0,
                "w2_zeros": (w2 == 0.0).sum().item() / w2.numel() * 100.0,
            }
