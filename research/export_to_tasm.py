"""
export_to_tasm.py — Native Tryte Assembly (.tasm) Compiler for Ternary Networks
================================================================================
Compiles a trained discrete balanced ternary neural network (weights in {-1, 0, +1})
into clean, standalone Tryte Assembly (.tasm) that executes directly inside
the Tryte-VM emulator (src/vm.js / src/run.js).
"""

import numpy as np
import torch
from typing import Optional


def compile_ternary_weights_to_tasm(
    w1: np.ndarray,
    w2: np.ndarray,
    program_name: str = "ternary_network",
) -> str:
    """
    Compiles a 2-layer discrete balanced ternary network into Tryte Assembly.
    w1: shape (hidden_dim, input_dim) with values in {-1, 0, +1}
    w2: shape (output_dim, hidden_dim) with values in {-1, 0, +1}
    """
    hidden_dim, input_dim = w1.shape
    output_dim, hidden_dim2 = w2.shape
    assert hidden_dim == hidden_dim2

    lines = []
    lines.append(f"; ---------------------------------------------------------------------------")
    lines.append(f"; {program_name}.tasm — Compiled Ternary Neural Network for Tryte-VM")
    lines.append(f"; Architecture: {input_dim} Inputs -> {hidden_dim} Hidden -> {output_dim} Outputs")
    lines.append(f"; All weights are strictly discrete balanced ternary {-1, 0, +1}")
    lines.append(f"; Zero multiplications: evaluated via native ADD, SUB, and BR3 three-way branch")
    lines.append(f"; ---------------------------------------------------------------------------\n")

    # 1. Read input values
    lines.append("; --- Step 1: Read Inputs ---")
    for i in range(input_dim):
        lines.append(f"        IN")
        lines.append(f"        STORE in_{i}")

    # 2. Hidden Layer Computation
    lines.append("\n; --- Step 2: Hidden Layer (Ternary Synaptic Sum + BR3 Activation) ---")
    for j in range(hidden_dim):
        lines.append(f"; Hidden neuron h_{j}")
        # Find active incoming connections
        pos_inputs = [i for i in range(input_dim) if w1[j, i] == 1]
        neg_inputs = [i for i in range(input_dim) if w1[j, i] == -1]

        if not pos_inputs and not neg_inputs:
            # Completely pruned neuron
            lines.append(f"        LOADI 0")
            lines.append(f"        STORE h_{j}")
            continue

        lines.append(f"        LOADI 0")
        for i in pos_inputs:
            lines.append(f"        ADD   in_{i}")
        for i in neg_inputs:
            lines.append(f"        SUB   in_{i}")

        # Activation: three-way branch BR3 (sign of accumulator)
        lines.append(f"        BR3   act_tbl_{j}")
        lines.append(f"act_tbl_{j}: .table h_neg_{j}, h_zero_{j}, h_pos_{j}")
        lines.append(f"h_neg_{j}: LOADI -1")
        lines.append(f"        JMP   h_done_{j}")
        lines.append(f"h_zero_{j}: LOADI 0")
        lines.append(f"        JMP   h_done_{j}")
        lines.append(f"h_pos_{j}:  LOADI 1")
        lines.append(f"h_done_{j}: STORE h_{j}")

    # 3. Output Layer Computation
    lines.append("\n; --- Step 3: Output Layer Computation & Emission ---")
    for m in range(output_dim):
        lines.append(f"; Output neuron out_{m}")
        pos_h = [j for j in range(hidden_dim) if w2[m, j] == 1]
        neg_h = [j for j in range(hidden_dim) if w2[m, j] == -1]

        if not pos_h and not neg_h:
            lines.append(f"        LOADI 0")
            lines.append(f"        OUT")
            continue

        lines.append(f"        LOADI 0")
        for j in pos_h:
            lines.append(f"        ADD   h_{j}")
        for j in neg_h:
            lines.append(f"        SUB   h_{j}")
        lines.append(f"        OUT")

    # Halt execution
    lines.append("\n; --- Finish ---")
    lines.append("        HALT\n")

    # 4. Data Section (Memory variables placed conventionally in negative memory)
    # Total memory cells needed: input_dim + hidden_dim
    total_vars = input_dim + hidden_dim
    lines.append(f"; --- Data Storage ---")
    lines.append(f"        .org  -{total_vars}")

    for i in range(input_dim):
        lines.append(f"in_{i}:  .word 0")
    for j in range(hidden_dim):
        lines.append(f"h_{j}:   .word 0")

    lines.append("")
    return "\n".join(lines)


def export_model_to_tasm(model, filepath: str, program_name: str = "ternary_network"):
    """
    Extracts ternary weights from model and writes TASM file.
    """
    if hasattr(model, "layer1") and hasattr(model, "layer2"):
        w1 = model.layer1.ternary_weight.detach().cpu().numpy().astype(int)
        w2 = model.layer2.ternary_weight.detach().cpu().numpy().astype(int)
    elif hasattr(model, "generate_ternary_weights"):
        w1, w2 = model.generate_ternary_weights()
        w1 = w1.detach().cpu().numpy().astype(int)
        w2 = w2.detach().cpu().numpy().astype(int)
    else:
        raise ValueError("Model does not expose ternary weights")

    tasm_code = compile_ternary_weights_to_tasm(w1, w2, program_name=program_name)
    with open(filepath, "w") as f:
        f.write(tasm_code)
    print(f"Exported Tryte Assembly to {filepath}")
    return tasm_code
