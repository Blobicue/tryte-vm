"""
ternary_qutrit_circuit.py — Topological Qutrit Quantum Circuit Engine (SU(3) / SU(9))
===================================================================================
Implements 3-state quantum qutrit computation matching the 4-Fibonacci-anyon
fusion space V₄(τ) with dim = 3.

Uses the irreducible Temperley-Lieb TL₄(φ) representation of the braid group B₄:
    σᵢ = A * I + A⁻¹ * eᵢ   where A = exp(i 2π/5)
    Basis: |-1⟩, |0⟩, |+1⟩ (balanced ternary!)
"""

import torch
import torch.nn as nn
import numpy as np

# Golden Ratio φ
PHI = (1.0 + np.sqrt(5.0)) / 2.0
INV_PHI = 1.0 / PHI
INV_PHI2 = INV_PHI * INV_PHI
INV_PHI3_2 = np.power(PHI, -1.5)

# Kauffman parameter A = exp(i 2π/5)
TL_A = np.exp(1j * 2.0 * np.pi / 5.0)
TL_A_INV = np.exp(-1j * 2.0 * np.pi / 5.0)

# Cube root of unity ω = exp(i 2π/3)
OMEGA = np.exp(1j * 2.0 * np.pi / 3.0)


def build_b4_generators(dtype=torch.complex64, device=None) -> dict[int, torch.Tensor]:
    """
    Builds exact unitary matrices for B₄ generators σ₁, σ₂, σ₃ and inverses in SU(3).
    """
    # Temperley-Lieb real generator matrices
    e1 = np.array([
        [PHI, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
    ], dtype=np.complex64)

    e2 = np.array([
        [INV_PHI, INV_PHI3_2, INV_PHI],
        [INV_PHI3_2, INV_PHI2, INV_PHI3_2],
        [INV_PHI, INV_PHI3_2, INV_PHI],
    ], dtype=np.complex64)

    e3 = np.array([
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [0.0, 0.0, PHI],
    ], dtype=np.complex64)

    identity = np.eye(3, dtype=np.complex64)

    # σᵢ = A * I + A⁻¹ * eᵢ
    sigma1 = TL_A * identity + TL_A_INV * e1
    sigma2 = TL_A * identity + TL_A_INV * e2
    sigma3 = TL_A * identity + TL_A_INV * e3

    def to_torch(m):
        return torch.tensor(m, dtype=dtype, device=device)

    return {
        0: to_torch(identity),
        1: to_torch(sigma1),
        -1: to_torch(sigma1.conj().T),
        2: to_torch(sigma2),
        -2: to_torch(sigma2.conj().T),
        3: to_torch(sigma3),
        -3: to_torch(sigma3.conj().T),
    }


def build_qutrit_cx(dtype=torch.complex64, device=None) -> torch.Tensor:
    """
    Controlled-Shift (CX₃) in SU(9):
        |c, t⟩ -> |c, (t + c) mod 3⟩
    CX₃ = diag(I, X₃, X₃²)
    """
    # X₃ (shift / cycle matrix): |-1> -> |0>, |0> -> |+1>, |+1> -> |-1>
    # Indices 0, 1, 2
    x3 = np.array([
        [0, 0, 1],
        [1, 0, 0],
        [0, 1, 0],
    ], dtype=np.complex64)
    x3_sq = x3 @ x3
    id3 = np.eye(3, dtype=np.complex64)

    cx = np.zeros((9, 9), dtype=np.complex64)
    cx[0:3, 0:3] = id3
    cx[3:6, 3:6] = x3
    cx[6:9, 6:9] = x3_sq

    return torch.tensor(cx, dtype=dtype, device=device)


def build_qutrit_hadamard(dtype=torch.complex64, device=None) -> torch.Tensor:
    """
    Chrestenson / Qutrit Hadamard gate H₃:
        H₃ = (1 / sqrt(3)) * [[1, 1, 1], [1, ω, ω²], [1, ω², ω]]
    """
    h3 = (1.0 / np.sqrt(3.0)) * np.array([
        [1.0, 1.0, 1.0],
        [1.0, OMEGA, OMEGA * OMEGA],
        [1.0, OMEGA * OMEGA, OMEGA],
    ], dtype=np.complex64)
    return torch.tensor(h3, dtype=dtype, device=device)


class DifferentiableBraidGate(torch.autograd.Function):
    """
    Straight-Through Estimator mapping continuous logit s to discrete braid generator:
        s > delta  ==> σᵢ (+1)
        s < -delta ==> σᵢ⁻¹ (-1)
        otherwise  ==> I (0)
    """

    @staticmethod
    def forward(ctx, s: torch.Tensor, gen_idx: int, b4_dict: dict, delta: float = 0.35):
        ctx.save_for_backward(s)
        ctx.delta = delta

        # Discrete trit decision
        if s.item() > delta:
            trit = 1
            U = b4_dict[gen_idx]
        elif s.item() < -delta:
            trit = -1
            U = b4_dict[-gen_idx]
        else:
            trit = 0
            U = b4_dict[0]

        ctx.trit = trit
        return U.clone()

    @staticmethod
    def backward(ctx, grad_output):
        (s,) = ctx.saved_tensors
        # Real part of projection onto generator direction
        grad_s = torch.real(grad_output).sum()
        return grad_s, None, None, None


class TopologicalQutritCircuit(nn.Module):
    """
    Topological Quantum Circuit operating on two qutrits (A and B) in SU(9).
    Composed of:
    - Discrete braid layers driven by trits in {-1, 0, +1}
    - Qutrit Hadamard H₃
    - Entangling CX₃ gate in SU(9)
    """

    def __init__(self):
        super().__init__()
        self.b4 = build_b4_generators()
        self.cx = build_qutrit_cx()
        self.h3 = build_qutrit_hadamard()

    def evaluate_braid_unitary(self, braid_trits: torch.Tensor, gen_idx: int) -> torch.Tensor:
        """
        Smoothly interpolates unitary using softmax or selects discrete braid:
        braid_trits: scalar in [-1, 1]
        """
        # Linear blend between Identity, σ, σ† with STE
        return DifferentiableBraidGate.apply(braid_trits, gen_idx, self.b4, 0.3)

    def forward_state(
        self,
        a_idx: torch.Tensor,
        b_idx: torch.Tensor,
        braid_trits_a: torch.Tensor,
        braid_trits_b: torch.Tensor,
    ) -> torch.Tensor:
        """
        Evolves two qutrits |a⟩ ⊗ |b⟩:
        a_idx, b_idx: batch of indices in {0, 1, 2} corresponding to |-1>, |0>, |+1>
        braid_trits_a, braid_trits_b: tensors of shape (3,) specifying trits for σ₁, σ₂, σ₃
        """
        batch_size = a_idx.shape[0]
        device = a_idx.device

        # Basis state preparation in C³
        psi_a = torch.zeros(batch_size, 3, dtype=torch.complex64, device=device)
        psi_b = torch.zeros(batch_size, 3, dtype=torch.complex64, device=device)
        psi_a.scatter_(1, a_idx.unsqueeze(1), 1.0 + 0.0j)
        psi_b.scatter_(1, b_idx.unsqueeze(1), 1.0 + 0.0j)

        # Apply B₄ braid sequence to Qutrit A
        u_a = self.b4[0].to(device)
        for i in range(3):
            gen = i + 1
            u_a = torch.matmul(self.evaluate_braid_unitary(braid_trits_a[i], gen).to(device), u_a)

        # Apply B₄ braid sequence to Qutrit B
        u_b = self.b4[0].to(device)
        for i in range(3):
            gen = i + 1
            u_b = torch.matmul(self.evaluate_braid_unitary(braid_trits_b[i], gen).to(device), u_b)

        psi_a = torch.matmul(psi_a, u_a.T)
        psi_b = torch.matmul(psi_b, u_b.T)

        # Joint 2-qutrit state in C⁹
        psi_9 = torch.einsum("bi,bj->bij", psi_a, psi_b).reshape(batch_size, 9)

        # Apply 2-qutrit entangler CX₃ in SU(9)
        cx = self.cx.to(device)
        psi_9 = torch.matmul(psi_9, cx.T)

        # Output state reshaped to (batch, 3, 3)
        return psi_9.view(batch_size, 3, 3)

    def forward(
        self,
        a_idx: torch.Tensor,
        b_idx: torch.Tensor,
        braid_trits_a: torch.Tensor,
        braid_trits_b: torch.Tensor,
    ) -> torch.Tensor:
        """
        Computes Born-rule measurement probabilities on target qutrit.
        Returns log probabilities of shape (batch, 3).
        """
        psi_joint = self.forward_state(a_idx, b_idx, braid_trits_a, braid_trits_b)
        # Trace out control qutrit A to measure target qutrit B
        probs = torch.sum(torch.abs(psi_joint) ** 2, dim=1)  # (batch, 3)
        probs = probs / (torch.sum(probs, dim=-1, keepdim=True) + 1e-12)
        return torch.log(probs + 1e-12)
