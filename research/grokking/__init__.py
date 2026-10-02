"""
Ternary Hypernetwork & Grokking Research Suite
==============================================
A framework for studying grokking and phase transitions in balanced ternary neural networks
and hypernetworks on Tryte-VM.
"""

from .quantizer import TernarySTE, ternarize, TernaryLinear
from .dataset import ModularArithmeticDataset, get_modular_data
from .hypernetwork import TernaryHypernetwork, TernaryMLP
from .fourier_analyzer import CyclotomicFourierAnalyzer

__all__ = [
    "TernarySTE",
    "ternarize",
    "TernaryLinear",
    "ModularArithmeticDataset",
    "get_modular_data",
    "TernaryHypernetwork",
    "TernaryMLP",
    "CyclotomicFourierAnalyzer",
]
