"""
quantum_hypernet.py — Classical-to-Quantum Hypernetwork for Circuit Generation
=============================================================================
A classical neural network that outputs the Lie algebra generators and phase
angles for a target quantum circuit.

Weight decay on the hypernetwork directly penalizes quantum circuit complexity:
    ||phi|| -> 0  ==>  Generators A -> 0  ==>  Unitaries U = exp(A) -> Identity!
"""

import torch
import torch.nn as nn
import numpy as np


class ClassicalQuantumHypernetwork(nn.Module):
    """
    Classical hypernetwork that generates the unitary parameters of a
    Quantum Modular Adder circuit.
    """

    def __init__(self, p: int, latent_dim: int = 32, hidden_dim: int = 64):
        super().__init__()
        self.p = p
        self.latent_dim = latent_dim

        # Latent state embedding
        self.latent = nn.Parameter(torch.randn(latent_dim) * 0.1)

        # Total parameter count needed for quantum circuit:
        # - u_a: 2 * p * p (real + imag generators)
        # - u_b: 2 * p * p
        # - entangler_phases: p * p
        # - u_out: 2 * p * p
        self.u_dim = 2 * p * p
        self.phase_dim = p * p

        # Hypernetwork MLP heads
        self.mlp_ua = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, self.u_dim),
        )
        self.mlp_ub = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, self.u_dim),
        )
        self.mlp_phases = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, self.phase_dim),
        )
        self.mlp_uout = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, self.u_dim),
        )

    def _generate_unitary(self, raw_params: torch.Tensor) -> torch.Tensor:
        """Converts raw 2*p*p float vector into a strictly unitary matrix in U(p)."""
        real_part = raw_params[: self.p * self.p].view(self.p, self.p)
        imag_part = raw_params[self.p * self.p :].view(self.p, self.p)
        H = torch.complex(real_part, imag_part)
        A = 0.5 * (H - H.conj().transpose(-2, -1))
        return torch.linalg.matrix_exp(A)

    def generate_quantum_circuit_parameters(self) -> dict[str, torch.Tensor]:
        """Generates all quantum circuit components."""
        raw_ua = self.mlp_ua(self.latent)
        raw_ub = self.mlp_ub(self.latent)
        raw_phases = self.mlp_phases(self.latent).view(self.p, self.p)
        raw_uout = self.mlp_uout(self.latent)

        u_a = self._generate_unitary(raw_ua)
        u_b = self._generate_unitary(raw_ub)
        u_out = self._generate_unitary(raw_uout)
        phases = raw_phases

        return {
            "U_A": u_a,
            "U_B": u_b,
            "U_out": u_out,
            "phases": phases,
        }

    def forward_state(self, a_idx: torch.Tensor, b_idx: torch.Tensor) -> torch.Tensor:
        """Evolves quantum state through the hypernetwork-generated circuit."""
        params = self.generate_quantum_circuit_parameters()
        U_A = params["U_A"]
        U_B = params["U_B"]
        U_out = params["U_out"]
        phases = params["phases"]

        batch_size = a_idx.shape[0]
        device = a_idx.device

        # Basis states in C^p
        psi_a = torch.zeros(batch_size, self.p, dtype=torch.complex64, device=device)
        psi_b = torch.zeros(batch_size, self.p, dtype=torch.complex64, device=device)
        psi_a.scatter_(1, a_idx.unsqueeze(1), 1.0 + 0.0j)
        psi_b.scatter_(1, b_idx.unsqueeze(1), 1.0 + 0.0j)

        # Apply generated local unitaries
        psi_a = torch.matmul(psi_a, U_A.transpose(-2, -1))
        psi_b = torch.matmul(psi_b, U_B.transpose(-2, -1))

        # Joint state
        psi_joint = torch.einsum("bi,bj->bij", psi_a, psi_b)

        # Apply generated entangling phases
        ent_factor = torch.polar(torch.ones_like(phases), phases)
        psi_joint = psi_joint * ent_factor.unsqueeze(0)

        # Readout unitary on output register
        psi_joint = torch.einsum("bij,kj->bik", psi_joint, U_out)
        return psi_joint

    def forward(self, a_idx: torch.Tensor, b_idx: torch.Tensor) -> torch.Tensor:
        """Computes Born rule probability distribution and outputs log-probabilities."""
        psi_joint = self.forward_state(a_idx, b_idx)
        probs_y = torch.sum(torch.abs(psi_joint) ** 2, dim=1)  # (batch, p)
        probs_y = probs_y / (torch.sum(probs_y, dim=-1, keepdim=True) + 1e-12)
        logits = torch.log(probs_y + 1e-12)
        return logits
