"""
train_quantum.py — Quantum Circuit & Hypernetwork Grokking Runner
=================================================================
Runs modular arithmetic experiments on parameterized quantum circuits
and classical-to-quantum hypernetworks, tracking:
- Train / Test Accuracy
- Mean QFT Projection Fidelity
- Bipartite Von Neumann Entanglement Entropy
"""

import argparse
import time
import json
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np

from .quantum_circuit import QuantumModularAdderCircuit
from .quantum_hypernet import ClassicalQuantumHypernetwork
from .qft_analyzer import QuantumGrokkingAnalyzer
from .dataset import get_quantum_modular_data


def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    for a, b, y in loader:
        a, b, y = a.to(device), b.to(device), y.to(device)
        optimizer.zero_grad()
        logits = model(a, b)
        loss = criterion(logits, y)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * len(y)
        preds = logits.argmax(dim=-1)
        correct += (preds == y).sum().item()
        total += len(y)

    return total_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0

    for a, b, y in loader:
        a, b, y = a.to(device), b.to(device), y.to(device)
        logits = model(a, b)
        loss = criterion(logits, y)

        total_loss += loss.item() * len(y)
        preds = logits.argmax(dim=-1)
        correct += (preds == y).sum().item()
        total += len(y)

    return total_loss / total, correct / total


def run_quantum_grokking_experiment(
    p: int = 5,
    op: str = "add",
    model_type: str = "hypernet",
    epochs: int = 500,
    lr: float = 0.01,
    weight_decay: float = 0.01,
    split_ratio: float = 0.5,
    eval_every: int = 25,
    seed: int = 42,
    verbose: bool = True,
):
    torch.manual_seed(seed)
    np.random.seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    train_loader, test_loader = get_quantum_modular_data(
        p=p, op=op, split_ratio=split_ratio, seed=seed
    )

    if model_type == "circuit":
        model = QuantumModularAdderCircuit(p=p).to(device)
    elif model_type == "hypernet":
        model = ClassicalQuantumHypernetwork(p=p, latent_dim=32, hidden_dim=64).to(device)
    else:
        raise ValueError(f"Unknown model_type: {model_type}")

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    analyzer = QuantumGrokkingAnalyzer(p=p)

    # Pre-collect all test pairs for quantum state analysis
    test_a = []
    test_b = []
    for a, b, _ in test_loader:
        test_a.append(a)
        test_b.append(b)
    test_a = torch.cat(test_a).to(device)
    test_b = torch.cat(test_b).to(device)

    history = {
        "epoch": [],
        "train_acc": [],
        "test_acc": [],
        "train_loss": [],
        "test_loss": [],
        "qft_fidelity": [],
        "entropy_bits": [],
        "norm_entropy": [],
    }

    grokked_epoch = None
    memorized_epoch = None

    if verbose:
        print("=" * 80)
        print(f"  Quantum Grokking Experiment: ({op}) mod {p}")
        print(f"  Model: {model_type.upper()} | Hilbert Space: C^{p} x C^{p} (dim={p*p})")
        print(f"  Dataset: {len(train_loader.dataset)} Train / {len(test_loader.dataset)} Test ({int(split_ratio*100)}% Split)")
        print(f"  Weight Decay: {weight_decay} | Learning Rate: {lr}")
        print("=" * 80)
        print(f"{'Epoch':<8} | {'Train Acc':<10} | {'Test Acc':<10} | {'Train Loss':<11} | {'QFT Fid':<9} | {'Entropy (bits)':<15}")
        print("-" * 80)

    t0 = time.time()

    for epoch in range(1, epochs + 1):
        tr_loss, tr_acc = train_epoch(model, train_loader, optimizer, criterion, device)

        if memorized_epoch is None and tr_acc >= 0.99:
            memorized_epoch = epoch

        if epoch % eval_every == 0 or epoch == epochs or epoch == 1:
            te_loss, te_acc = evaluate(model, test_loader, criterion, device)
            q_metrics = analyzer.evaluate_model(model, test_a, test_b)
            qft_fid = q_metrics["mean_qft_fidelity"]
            entropy_bits = q_metrics["mean_entropy_bits"]

            history["epoch"].append(epoch)
            history["train_acc"].append(tr_acc)
            history["test_acc"].append(te_acc)
            history["train_loss"].append(tr_loss)
            history["test_loss"].append(te_loss)
            history["qft_fidelity"].append(qft_fid)
            history["entropy_bits"].append(entropy_bits)
            history["norm_entropy"].append(q_metrics["normalized_entropy"])

            if verbose:
                print(
                    f"{epoch:<8} | {tr_acc*100:6.2f}%    | {te_acc*100:6.2f}%    | {tr_loss:10.4f}  | {qft_fid:8.4f}  | {entropy_bits:10.4f}"
                )

            if grokked_epoch is None and tr_acc >= 0.95 and te_acc >= 0.80:
                grokked_epoch = epoch
                if verbose:
                    print(f"\n>>> [QUANTUM GROKKING EVENT DETECTED AT EPOCH {epoch}] <<<")
                    print(f">>> Test Acc: {te_acc*100:.2f}%, QFT Overlap: {qft_fid:.4f}, Entropy: {entropy_bits:.4f} bits!\n")

    total_time = time.time() - t0

    if verbose:
        print("=" * 80)
        print(f"Total Experiment Time   : {total_time:.2f} s ({total_time/epochs*1000:.2f} ms/epoch)")
        print(f"Memorization Epoch      : {memorized_epoch if memorized_epoch else 'Not reached'}")
        print(f"Grokking Phase Epoch    : {grokked_epoch if grokked_epoch else 'Not reached within budget'}")
        print(f"Final Test Accuracy     : {history['test_acc'][-1]*100:.2f}%")
        print(f"Final QFT Fidelity      : {history['qft_fidelity'][-1]:.4f}")
        print("=" * 80)

    return {
        "p": p,
        "op": op,
        "model_type": model_type,
        "epochs": epochs,
        "weight_decay": weight_decay,
        "memorized_epoch": memorized_epoch,
        "grokked_epoch": grokked_epoch,
        "final_train_acc": history["train_acc"][-1],
        "final_test_acc": history["test_acc"][-1],
        "final_qft_fidelity": history["qft_fidelity"][-1],
        "final_entropy_bits": history["entropy_bits"][-1],
        "history": history,
    }


def main():
    parser = argparse.ArgumentParser(description="Quantum Hypernetwork Grokking Runner")
    parser.add_argument("-p", "--prime", type=int, default=5, help="Modulus prime p")
    parser.add_argument("--op", type=str, default="add", choices=["add", "sub", "mul"], help="Operation")
    parser.add_argument("--model", type=str, default="hypernet", choices=["circuit", "hypernet"], help="Model")
    parser.add_argument("--epochs", type=int, default=400, help="Total epochs")
    parser.add_argument("--lr", type=float, default=0.01, help="Learning rate")
    parser.add_argument("--wd", "--weight-decay", type=float, default=0.01, help="Weight decay")
    parser.add_argument("--split", type=float, default=0.5, help="Train split ratio")
    parser.add_argument("--eval-every", type=int, default=25, help="Eval frequency")
    parser.add_argument("--seed", type=int, default=42, help="Seed")

    args = parser.parse_args()

    run_quantum_grokking_experiment(
        p=args.prime,
        op=args.op,
        model_type=args.model,
        epochs=args.epochs,
        lr=args.lr,
        weight_decay=args.wd,
        split_ratio=args.split,
        eval_every=args.eval_every,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
