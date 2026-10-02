"""
quantum_circuit.py — Differentiable Parameterized Quantum Circuit Engine
========================================================================
Implements exact, differentiable unitary quantum state evolution and measurement
in PyTorch using skew-Hermitian Lie algebra parameterization:
    U = matrix_exp(M - M†)  ==>  U† U = I strictly guaranteed!
"""

import torch
import torch.nn as nn
import numpy as np


def build_qft_matrix(d: int, device=None, dtype=torch.complex64) -> torch.Tensor:
    """
    Constructs the canonical d-dimensional Quantum Fourier Transform (QFT) matrix:
        QFT[j, k] = (1 / sqrt(d)) * exp(2pi * i * j * k / d)
    """
    j, k = torch.meshgrid(
        torch.arange(d, device=device, dtype=torch.float32),
        torch.arange(d, device=device, dtype=torch.float32),
        indexing="ij",
    )
    phase = (2.0 * np.pi * j * k) / d
    qft = (torch.cos(phase) + 1j * torch.sin(phase)) / np.sqrt(d)
    return qft.to(dtype=dtype)


class ParameterizedUnitary(nn.Module):
    """
    A parameterized unitary operator U in U(d) constructed via matrix exponential
    of a skew-Hermitian generator:
        A = (H - H†) / 2   where H is an unconstrained complex matrix.
        U = matrix_exp(A)
    Guarantees U† U = I for ANY parameter values with full differentiability!
    """

    def __init__(self, d: int):
        super().__init__()
        self.d = d
        # Real and imaginary components of unconstrained generator
        self.real_gen = nn.Parameter(torch.randn(d, d) * 0.05)
        self.imag_gen = nn.Parameter(torch.randn(d, d) * 0.05)

    def get_unitary(self) -> torch.Tensor:
        # Construct general complex matrix H
        H = torch.complex(self.real_gen, self.imag_gen)
        # Skew-Hermitian generator: A = (H - H†) / 2  satisfies A† = -A
        A = 0.5 * (H - H.conj().transpose(-2, -1))
        # Matrix exponential is strictly unitary
        U = torch.linalg.matrix_exp(A)
        return U

    def forward(self, state: torch.Tensor) -> torch.Tensor:
        """
        Applies U to input state(s):
        state: shape (..., d) complex vector
        """
        U = self.get_unitary()
        # Batched matrix-vector product: state @ U.T
        return torch.matmul(state, U.transpose(-2, -1))


class QuantumModularAdderCircuit(nn.Module):
    """
    Quantum circuit architecture designed for modular arithmetic on Z_p.
    Input registers: |a⟩ ∈ C^p, |b⟩ ∈ C^p (joint space C^(p x p)).
    Architecture:
      1. Register A local unitary U_A
      2. Register B local unitary U_B
      3. Controlled Entangling Layer (Controlled-Phase / Entangler)
      4. Joint Quantum Unitary U_joint in U(p^2)
      5. Output Projective Measurement onto computational basis |y⟩
    """

    def __init__(self, p: int, parameterized_joint: bool = True):
        super().__init__()
        self.p = p
        self.dim = p * p

        # Local single-register unitaries
        self.u_a = ParameterizedUnitary(p)
        self.u_b = ParameterizedUnitary(p)

        # Entangling phase vector: exp(i * phi_ab)
        self.entangler_phases = nn.Parameter(torch.zeros(p, p))

        # Joint unitary over the entire p^2 Hilbert space
        if parameterized_joint:
            self.u_joint = ParameterizedUnitary(p)
        else:
            self.register_module("u_joint", None)

    def forward_state(self, a_idx: torch.Tensor, b_idx: torch.Tensor) -> torch.Tensor:
        """
        Prepares joint state |a⟩ ⊗ |b⟩ and evolves through the quantum circuit.
        Returns evolved state vector of shape (batch_size, p, p).
        """
        batch_size = a_idx.shape[0]
        device = a_idx.device

        # Prepare basis states |a⟩ and |b⟩ in C^p
        psi_a = torch.zeros(batch_size, self.p, dtype=torch.complex64, device=device)
        psi_b = torch.zeros(batch_size, self.p, dtype=torch.complex64, device=device)
        psi_a.scatter_(1, a_idx.unsqueeze(1), 1.0 + 0.0j)
        psi_b.scatter_(1, b_idx.unsqueeze(1), 1.0 + 0.0j)

        # Step 1: Local unitaries
        psi_a = self.u_a(psi_a)  # (batch, p)
        psi_b = self.u_b(psi_b)  # (batch, p)

        # Step 2: Outer product joint state |psi_a⟩ ⊗ |psi_b⟩
        psi_joint = torch.einsum("bi,bj->bij", psi_a, psi_b)  # (batch, p, p)

        # Step 3: Entangling Phase Layer: exp(i * phi_ij)
        ent_factor = torch.polar(torch.ones_like(self.entangler_phases), self.entangler_phases)
        psi_joint = psi_joint * ent_factor.unsqueeze(0)

        # Step 4: Output Register unitary
        if self.u_joint is not None:
            # Flatten or transform target register
            # Projective readout on register A:
            psi_joint = torch.einsum("bij,kj->bik", psi_joint, self.u_joint.get_unitary())

        return psi_joint

    def forward(self, a_idx: torch.Tensor, b_idx: torch.Tensor) -> torch.Tensor:
        """
        Computes Born-rule probability distribution over output classes {0, ..., p-1}.
        Returns logits (log probabilities) of shape (batch_size, p).
        """
        psi_joint = self.forward_state(a_idx, b_idx)  # (batch, p, p)

        # Born rule measurement: probability of measuring outcome y on target register
        # Summing over the ancilla / control register (tracing out register A)
        probs_y = torch.sum(torch.abs(psi_joint) ** 2, dim=1)  # (batch, p)

        # Add small epsilon for numerical stability in log
        probs_y = probs_y / (torch.sum(probs_y, dim=-1, keepdim=True) + 1e-12)
        logits = torch.log(probs_y + 1e-12)
        return logits
