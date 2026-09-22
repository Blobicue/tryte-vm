"""
Quantum Hypernetwork Grokking Research Suite
============================================
Investigating grokking, QFT alignment, and entanglement phase transitions
in parameterized quantum circuits and classical-to-quantum hypernetworks.
"""

from .quantum_circuit import ParameterizedUnitary, QuantumModularAdderCircuit, build_qft_matrix
from .quantum_hypernet import ClassicalQuantumHypernetwork
from .qft_analyzer import QuantumGrokkingAnalyzer
from .dataset import QuantumModularDataset, get_quantum_modular_data

__all__ = [
    "ParameterizedUnitary",
    "QuantumModularAdderCircuit",
    "build_qft_matrix",
    "ClassicalQuantumHypernetwork",
    "QuantumGrokkingAnalyzer",
    "QuantumModularDataset",
    "get_quantum_modular_data",
]
