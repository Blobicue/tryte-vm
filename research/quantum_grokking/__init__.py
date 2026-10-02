"""
Quantum Hypernetwork Grokking Research Suite
============================================
Investigating grokking, QFT alignment, and entanglement phase transitions
in parameterized quantum circuits and True Ternary Quantum Hypernetworks.
"""

from .quantum_circuit import ParameterizedUnitary, QuantumModularAdderCircuit, build_qft_matrix
from .quantum_hypernet import ClassicalQuantumHypernetwork
from .qft_analyzer import QuantumGrokkingAnalyzer
from .dataset import QuantumModularDataset, get_quantum_modular_data
from .ternary_qutrit_circuit import TopologicalQutritCircuit, build_b4_generators, build_qutrit_cx
from .ternary_quantum_hypernet import TrueTernaryQuantumHypernetwork

__all__ = [
    "ParameterizedUnitary",
    "QuantumModularAdderCircuit",
    "build_qft_matrix",
    "ClassicalQuantumHypernetwork",
    "QuantumGrokkingAnalyzer",
    "QuantumModularDataset",
    "get_quantum_modular_data",
    "TopologicalQutritCircuit",
    "TrueTernaryQuantumHypernetwork",
    "build_b4_generators",
    "build_qutrit_cx",
]
