"""
export_to_braid.py — Serializer for Learned Anyon Braids into Tryte-QOS .braid Binaries
========================================================================================
Takes learned discrete braid sequences from TrueTernaryQuantumHypernetwork and
serializes them into the compact .braid binary format compatible with Tryte-QOS
and tsh.js.
"""

import struct
from typing import Sequence


def pack_braid_word(word: Sequence[int]) -> bytes:
    """
    Packs signed generator indices (±1, ±2, ±3) into 4-bit nibbles (2 per byte).
    bit 3: sign (0 = pos, 1 = neg)
    bits 2..0: abs generator index (1, 2, 3)
    """
    num_crossings = len(word)
    num_bytes = (num_crossings + 1) // 2
    buf = bytearray(num_bytes)

    for i, gen in enumerate(word):
        sign_bit = 1 if gen < 0 else 0
        abs_gen = abs(gen) & 0x07
        nibble = (sign_bit << 3) | abs_gen

        byte_idx = i // 2
        if i % 2 == 0:
            buf[byte_idx] = (nibble << 4) & 0xF0
        else:
            buf[byte_idx] |= (nibble & 0x0F)

    return bytes(buf)


def encode_braid_program(
    word: Sequence[int],
    name: str = "learned_anyon",
    program_type: int = 0x02,  # QUANTUM_QUTRIT
    qutrit_count: int = 2,
    tryte_registers: int = 1,
) -> bytes:
    """
    Serializes a complete Tryte-QOS .braid binary executable.
    """
    magic = b"TQOS"
    version = 0x01
    name_bytes = name.encode("utf-8")[:31]
    name_len = len(name_bytes)

    packed_braid = pack_braid_word(word)
    word_len = len(word)

    # Layout:
    # [0..3]: 'TQOS'
    # [4]: Version
    # [5]: Program Type
    # [6]: Qutrit Count
    # [7]: Register Count
    # [8..9]: Word Length (Uint16 BE)
    # [10]: Name Length
    # [11 .. 11+name_len]: Name
    header = struct.pack(
        ">4sBBBBHB",
        magic,
        version,
        program_type,
        qutrit_count,
        tryte_registers,
        word_len,
        name_len,
    ) + name_bytes

    body = header + packed_braid

    # Compute 16-bit additive checksum
    checksum = sum(body) & 0xFFFF
    checksum_bytes = struct.pack(">H", checksum)

    return body + checksum_bytes


def export_model_braid_to_file(model, filepath: str, name: str = "learned_qutrit"):
    """
    Extracts discrete braid words from TrueTernaryQuantumHypernetwork and saves to .braid.
    """
    trits_a, trits_b = model.generate_braid_trits()
    word = []

    # Qutrit A braids
    for i, t in enumerate(trits_a):
        gen = i + 1
        val = int(t.item())
        if val == 1:
            word.append(gen)
        elif val == -1:
            word.append(-gen)

    # Qutrit B braids
    for i, t in enumerate(trits_b):
        gen = i + 1
        val = int(t.item())
        if val == 1:
            word.append(gen)
        elif val == -1:
            word.append(-gen)

    binary_data = encode_braid_program(word, name=name)
    with open(filepath, "wb") as f:
        f.write(binary_data)

    print(f"Exported {len(word)} anyon crossings to Tryte-QOS binary: {filepath}")
    return word
