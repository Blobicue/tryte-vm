"""
fourier_analyzer.py — Cyclotomic 2D Fourier Analysis for Grokking Circuits
==========================================================================
Computes the 2D Discrete Fourier Transform (DFT) over Z_p x Z_p to measure
how strongly a ternary network has aligned its internal circuits with
the cyclotomic roots of unity (e^{i 2pi k / p}).

Key Theorem:
  If a function f(a, b) depends purely on (a + b) mod p,
  its 2D Fourier transform F(k1, k2) is non-zero ONLY when k1 == k2.
  Therefore, the ratio of diagonal power to total power measures
  exact mechanistic generalization (grokking).
"""

import numpy as np
import torch
import torch.nn as nn


class CyclotomicFourierAnalyzer:
    """
    Analyzes neural network activations in the 2D Fourier basis over Z_p x Z_p.
    """

    def __init__(self, p: int):
        self.p = p
        # Precompute 2D Fourier basis matrices
        # basis[k1, k2, a, b] = exp(-2pi i (k1 * a + k2 * b) / p)
        omega = np.exp(-2j * np.pi / p)
        a_grid, b_grid = np.meshgrid(np.arange(p), np.arange(p), indexing="ij")
        self.a_grid = a_grid.flatten()
        self.b_grid = b_grid.flatten()

        # Generate inputs for all p x p pairs (p^2, 2p)
        self.all_inputs = np.zeros((p * p, 2 * p), dtype=np.float32)
        for idx in range(p * p):
            a = self.a_grid[idx]
            b = self.b_grid[idx]
            self.all_inputs[idx, a] = 1.0
            self.all_inputs[idx, p + b] = 1.0

        self.all_inputs_tensor = torch.tensor(self.all_inputs)

    def compute_fourier_spectrum(self, grid_activations: np.ndarray) -> np.ndarray:
        """
        Computes 2D FFT for a grid of shape (p, p).
        Returns complex Fourier coefficients of shape (p, p).
        """
        assert grid_activations.shape == (self.p, self.p)
        return np.fft.fft2(grid_activations) / (self.p * self.p)

    def analyze_neuron(self, neuron_activations: np.ndarray) -> dict[str, float]:
        """
        Takes flat activations across all p*p pairs (length p^2) and computes
        the Fourier power distribution.
        """
        grid = neuron_activations.reshape(self.p, self.p)
        fourier_coeff = self.compute_fourier_spectrum(grid)
        power = np.abs(fourier_coeff) ** 2

        # Ignore DC component (k1=0, k2=0) which is just mean activation
        total_ac_power = np.sum(power) - power[0, 0]
        if total_ac_power < 1e-12:
            return {
                "diagonal_power_ratio": 0.0,
                "dominant_freq": 0,
                "total_power": float(total_ac_power),
            }

        # Diagonal power: k1 == k2 (excluding 0,0)
        diag_indices = np.arange(1, self.p)
        diag_power = np.sum(power[diag_indices, diag_indices])

        ratio = float(diag_power / total_ac_power)

        # Dominant non-zero frequency on diagonal
        diag_powers = power[diag_indices, diag_indices]
        dominant_k = int(diag_indices[np.argmax(diag_powers)])

        return {
            "diagonal_power_ratio": ratio,
            "dominant_freq": dominant_k,
            "total_power": float(total_ac_power),
        }

    def evaluate_model(self, model: nn.Module) -> dict[str, float]:
        """
        Evaluates full model on all p*p inputs and measures mean Fourier progress ratio
        across all hidden neurons.
        """
        model.eval()
        with torch.no_grad():
            x = self.all_inputs_tensor.to(next(model.parameters()).device)
            # Inspect hidden representation
            if hasattr(model, "layer1"):
                # Direct TernaryMLP
                h = model.layer1(x)
                if hasattr(model, "act"):
                    h = model.act(h)
            elif hasattr(model, "gen_w1"):
                # TernaryHypernetwork
                w1, _ = model.generate_ternary_weights()
                h = torch.nn.functional.linear(x, w1)
                h = model.act(h)
            else:
                raise ValueError("Model does not expose recognized hidden layer")

            h_np = h.detach().cpu().numpy()  # (p^2, hidden_dim)

        hidden_dim = h_np.shape[1]
        ratios = []
        for j in range(hidden_dim):
            res = self.analyze_neuron(h_np[:, j])
            if res["total_power"] > 1e-8:
                ratios.append(res["diagonal_power_ratio"])

        mean_ratio = float(np.mean(ratios)) if ratios else 0.0
        max_ratio = float(np.max(ratios)) if ratios else 0.0

        return {
            "mean_fourier_ratio": mean_ratio,
            "max_fourier_ratio": max_ratio,
            "active_fourier_neurons": len(ratios),
        }
