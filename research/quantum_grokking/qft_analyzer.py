"""
qft_analyzer.py — Quantum Mechanistic Interpretability & Grokking Analyzer
==========================================================================
Measures the fundamental quantum information signatures of grokking:
1. QFT Projection Fidelity: Overlap between learned unitaries and canonical QFT.
2. Bipartite Von Neumann Entanglement Entropy: Schmidt spectrum across registers.
3. Entanglement Phase Transitions during training.
"""

import torch
import numpy as np
from .quantum_circuit import build_qft_matrix


class QuantumGrokkingAnalyzer:
    """
    Computes QFT overlap and Von Neumann entanglement entropy for quantum circuits.
    """

    def __init__(self, p: int):
        self.p = p
        self.qft_matrix = build_qft_matrix(p)
        self.max_entropy = np.log2(p)

    def compute_unitary_qft_fidelity(self, U: torch.Tensor) -> float:
        """
        Computes normalized trace fidelity with the canonical QFT:
            F_QFT = (1 / p) * |Tr(U† * QFT)|
        """
        U_c = U.detach().cpu().to(dtype=torch.complex64)
        qft = self.qft_matrix.cpu()

        # Matrix product U† @ QFT
        prod = torch.matmul(U_c.conj().T, qft)
        trace = torch.trace(prod)
        fidelity = float(torch.abs(trace).item() / self.p)
        return fidelity

    def compute_entanglement_entropy(self, psi_joint: torch.Tensor) -> dict[str, float]:
        """
        Computes Schmidt decomposition and Von Neumann entanglement entropy
        for a batch of bipartite states: psi_joint of shape (batch, p, p).
        Returns mean and max entanglement entropy in bits.
        """
        psi = psi_joint.detach().cpu().to(dtype=torch.complex64)
        batch_size = psi.shape[0]

        # SVD of each (p, p) matrix in the batch
        # psi[b] = U @ diag(S) @ Vh
        # S contains Schmidt coefficients lambda_k
        try:
            S = torch.linalg.svdvals(psi)  # shape (batch, p)
        except Exception:
            return {"mean_entropy_bits": 0.0, "normalized_entropy": 0.0}

        # Probability distribution over Schmidt states: p_k = lambda_k^2
        probs = S ** 2
        # Normalize across Schmidt values for numerical stability
        probs = probs / (torch.sum(probs, dim=-1, keepdim=True) + 1e-12)

        # Von Neumann Entropy: -sum(p_k * log2(p_k))
        log_probs = torch.log2(probs + 1e-12)
        entropy = -torch.sum(probs * log_probs, dim=-1)  # (batch,)

        mean_entropy = float(torch.mean(entropy).item())
        norm_entropy = float(mean_entropy / self.max_entropy) if self.max_entropy > 0 else 0.0

        return {
            "mean_entropy_bits": mean_entropy,
            "max_entropy_possible": float(self.max_entropy),
            "normalized_entropy": norm_entropy,
        }

    def evaluate_model(self, model: torch.nn.Module, a_idx: torch.Tensor, b_idx: torch.Tensor) -> dict[str, float]:
        """
        Runs comprehensive quantum mechanistic diagnostic on model.
        """
        model.eval()
        with torch.no_grad():
            # Extract circuit parameters
            if hasattr(model, "generate_quantum_circuit_parameters"):
                params = model.generate_quantum_circuit_parameters()
                u_a = params["U_A"]
                u_b = params["U_B"]
                u_out = params["U_out"]
                psi_joint = model.forward_state(a_idx, b_idx)
            elif hasattr(model, "u_a"):
                u_a = model.u_a.get_unitary()
                u_b = model.u_b.get_unitary()
                u_out = model.u_joint.get_unitary() if model.u_joint is not None else u_a
                psi_joint = model.forward_state(a_idx, b_idx)
            else:
                raise ValueError("Unrecognized quantum model architecture")

            # Compute QFT fidelities
            f_a = self.compute_unitary_qft_fidelity(u_a)
            f_b = self.compute_unitary_qft_fidelity(u_b)
            f_out = self.compute_unitary_qft_fidelity(u_out)

            # Compute Entanglement Entropy
            ent_dict = self.compute_entanglement_entropy(psi_joint)

        return {
            "qft_fidelity_ua": f_a,
            "qft_fidelity_ub": f_b,
            "qft_fidelity_uout": f_out,
            "mean_qft_fidelity": (f_a + f_b + f_out) / 3.0,
            "mean_entropy_bits": ent_dict["mean_entropy_bits"],
            "normalized_entropy": ent_dict["normalized_entropy"],
        }
