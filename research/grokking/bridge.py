"""
bridge.py — Ctypes Bridge to Native Bit-Sliced Ternary SIMD Engine
==================================================================
Wraps libternary_simd.so for ultra-fast ternary matrix operations in Python.
"""

import os
import ctypes
import numpy as np

# Locate shared library
_DIR = os.path.dirname(os.path.abspath(__file__))
_LIB_PATH = os.path.join(_DIR, "native", "libternary_simd.so")

if not os.path.exists(_LIB_PATH):
    raise FileNotFoundError(f"Native library not found at {_LIB_PATH}. Run 'make -C native' first.")

_LIB = ctypes.CDLL(_LIB_PATH)

# Define ctypes function signatures
_LIB.pack_trits_i8.argtypes = [
    ctypes.POINTER(ctypes.c_int8),
    ctypes.c_size_t,
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(ctypes.c_uint64),
]
_LIB.pack_trits_i8.restype = None

_LIB.pack_trits_f32.argtypes = [
    ctypes.POINTER(ctypes.c_float),
    ctypes.c_size_t,
    ctypes.c_float,
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(ctypes.c_uint64),
]
_LIB.pack_trits_f32.restype = None

_LIB.unpack_trits_i8.argtypes = [
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.c_size_t,
    ctypes.POINTER(ctypes.c_int8),
]
_LIB.unpack_trits_i8.restype = None

_LIB.ternary_matvec.argtypes = [
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.c_size_t,
    ctypes.c_size_t,
    ctypes.POINTER(ctypes.c_int32),
]
_LIB.ternary_matvec.restype = None

_LIB.ternary_matmul_batch.argtypes = [
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.c_size_t,
    ctypes.c_size_t,
    ctypes.c_size_t,
    ctypes.POINTER(ctypes.c_int32),
]
_LIB.ternary_matmul_batch.restype = None

_LIB.ternary_weight_continuous_input_matmul.argtypes = [
    ctypes.POINTER(ctypes.c_float),
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.c_size_t,
    ctypes.c_size_t,
    ctypes.c_size_t,
    ctypes.POINTER(ctypes.c_float),
]
_LIB.ternary_weight_continuous_input_matmul.restype = None


def words_for_n(n: int) -> int:
    return (n + 63) // 64


def pack_trits(trits: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Packs an int8 array with values in {-1, 0, +1} into bitmasks (P, M)."""
    trits = np.ascontiguousarray(trits, dtype=np.int8)
    count = trits.size
    k = words_for_n(count)
    p_words = np.zeros(k, dtype=np.uint64)
    m_words = np.zeros(k, dtype=np.uint64)

    _LIB.pack_trits_i8(
        trits.ctypes.data_as(ctypes.POINTER(ctypes.c_int8)),
        count,
        p_words.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
        m_words.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
    )
    return p_words, m_words


def unpack_trits(p_words: np.ndarray, m_words: np.ndarray, count: int) -> np.ndarray:
    """Unpacks bitmasks (P, M) into an int8 array of trits."""
    p_words = np.ascontiguousarray(p_words, dtype=np.uint64)
    m_words = np.ascontiguousarray(m_words, dtype=np.uint64)
    out = np.zeros(count, dtype=np.int8)

    _LIB.unpack_trits_i8(
        p_words.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
        m_words.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
        count,
        out.ctypes.data_as(ctypes.POINTER(ctypes.c_int8)),
    )
    return out


def pack_ternary_matrix(W: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Packs a 2D ternary matrix W of shape (M, N) into row-wise bitmasks:
    P_mask, M_mask each of shape (M, ceil(N/64)) uint64.
    """
    W = np.ascontiguousarray(W, dtype=np.int8)
    M, N = W.shape
    K = words_for_n(N)
    P_mask = np.zeros((M, K), dtype=np.uint64)
    M_mask = np.zeros((M, K), dtype=np.uint64)

    for i in range(M):
        p_row, m_row = pack_trits(W[i])
        P_mask[i] = p_row
        M_mask[i] = m_row

    return P_mask, M_mask


def native_ternary_matmul(X: np.ndarray, W: np.ndarray) -> np.ndarray:
    """
    Computes Y = X @ W.T for ternary arrays X (B, N) and W (M, N).
    Both X and W have entries in {-1, 0, +1}.
    """
    X = np.ascontiguousarray(X, dtype=np.int8)
    W = np.ascontiguousarray(W, dtype=np.int8)
    B, N = X.shape
    M, N_w = W.shape
    assert N == N_w, f"Dimension mismatch: X has {N} cols, W has {N_w} cols"

    K = words_for_n(N)
    X_p = np.zeros((B, K), dtype=np.uint64)
    X_m = np.zeros((B, K), dtype=np.uint64)
    for b in range(B):
        X_p[b], X_m[b] = pack_trits(X[b])

    W_p, W_m = pack_ternary_matrix(W)
    Y_out = np.zeros((B, M), dtype=np.int32)

    _LIB.ternary_matmul_batch(
        X_p.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
        X_m.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
        W_p.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
        W_m.ctypes.data_as(ctypes.POINTER(ctypes.c_uint64)),
        B, M, N,
        Y_out.ctypes.data_as(ctypes.POINTER(ctypes.c_int32)),
    )
    return Y_out
