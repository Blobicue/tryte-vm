"""
train_ternary_quantum.py — Training Runner for True Ternary Quantum Hypernetwork
================================================================================
Trains TrueTernaryQuantumHypernetwork on balanced ternary modular addition:
  - Task Z_3: Single-trit addition (a + b) mod 3 for a, b in {-1, 0, +1}
  - Full discrete ternary pipeline: ternary weights -> ternary braids -> qutrits
"""

import argparse
import time
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np

from .ternary_quantum_hypernet import TrueTernaryQuantumHypernetwork
from .dataset import get_quantum_modular_data


def run_ternary_quantum_experiment(
    epochs: int = 300,
    lr: float = 0.02,
    weight_decay: float = 0.01,
    split_ratio: float = 0.5,
    eval_every: int = 25,
    seed: int = 42,
    verbose: bool = True,
):
    torch.manual_seed(seed)
    np.random.seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Modular addition on Z_3 (3 basis states: |-1>, |0>, |+1>)
    p = 3
    train_loader, test_loader = get_quantum_modular_data(
        p=p, op="add", split_ratio=split_ratio, seed=seed
    )

    model = TrueTernaryQuantumHypernetwork(latent_dim=16, hidden_dim=32, delta=0.25).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)

    if verbose:
        print("=" * 82)
        print("  True Ternary Quantum Hypernetwork: (add) mod 3")
        print("  Meta-Weights: Discrete {-1, 0, +1} (TernaryLinear)")
        print("  Quantum Circuit: 4-Anyon Topological Qutrits in SU(3) / SU(9) driven by B₄")
        print(f"  Dataset: {len(train_loader.dataset)} Train / {len(test_loader.dataset)} Test ({int(split_ratio*100)}% Split)")
        print(f"  Weight Decay: {weight_decay} | Learning Rate: {lr}")
        print("=" * 82)
        print(f"{'Epoch':<8} | {'Train Acc':<10} | {'Test Acc':<10} | {'Train Loss':<11} | {'Weight Sparsity':<16} | {'Braid Pruning':<14}")
        print("-" * 82)

    t0 = time.time()
    grokked_epoch = None
    memorized_epoch = None

    history = {
        "epoch": [],
        "train_acc": [],
        "test_acc": [],
        "sparsity": [],
        "braid_pruning": [],
    }

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        correct = 0
        total = 0

        for a, b, y in train_loader:
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

        tr_acc = correct / total
        tr_loss = total_loss / total

        if memorized_epoch is None and tr_acc >= 0.99:
            memorized_epoch = epoch

        if epoch % eval_every == 0 or epoch == epochs or epoch == 1:
            model.eval()
            with torch.no_grad():
                te_correct = 0
                te_total = 0
                for a, b, y in test_loader:
                    a, b, y = a.to(device), b.to(device), y.to(device)
                    logits = model(a, b)
                    preds = logits.argmax(dim=-1)
                    te_correct += (preds == y).sum().item()
                    te_total += len(y)
                te_acc = te_correct / te_total

                sp_dict = model.get_sparsity()
                sparsity = sp_dict["mean_weight_sparsity"]
                braid_pruning = sp_dict["braid_identity_pct"]

            history["epoch"].append(epoch)
            history["train_acc"].append(tr_acc)
            history["test_acc"].append(te_acc)
            history["sparsity"].append(sparsity)
            history["braid_pruning"].append(braid_pruning)

            if verbose:
                print(
                    f"{epoch:<8} | {tr_acc*100:6.2f}%    | {te_acc*100:6.2f}%    | {tr_loss:10.4f}  | {sparsity:14.2f}% | {braid_pruning:12.2f}%"
                )

            if grokked_epoch is None and tr_acc >= 0.95 and te_acc >= 0.80:
                grokked_epoch = epoch
                if verbose:
                    print(f"\n>>> [TERNARY QUANTUM GROKKING DETECTED AT EPOCH {epoch}] <<<")
                    print(f">>> Test Acc: {te_acc*100:.2f}%, Weight Sparsity: {sparsity:.2f}%, Braid Pruning: {braid_pruning:.2f}%\n")

    total_time = time.time() - t0

    if verbose:
        trits_a, trits_b = model.generate_braid_trits()
        print("=" * 82)
        print(f"Total Experiment Time   : {total_time:.2f} s ({total_time/epochs*1000:.2f} ms/epoch)")
        print(f"Memorization Epoch      : {memorized_epoch if memorized_epoch else 'Not reached'}")
        print(f"Grokking Phase Epoch    : {grokked_epoch if grokked_epoch else 'Not reached within budget'}")
        print(f"Final Test Accuracy     : {history['test_acc'][-1]*100:.2f}%")
        print(f"Learned Braid Words     : Qutrit A: {trits_a.tolist()} | Qutrit B: {trits_b.tolist()}")
        print("=" * 82)

    return {
        "memorized_epoch": memorized_epoch,
        "grokked_epoch": grokked_epoch,
        "final_train_acc": history["train_acc"][-1],
        "final_test_acc": history["test_acc"][-1],
        "history": history,
    }


def main():
    parser = argparse.ArgumentParser(description="True Ternary Quantum Grokking Runner")
    parser.add_argument("--epochs", type=int, default=300, help="Total epochs")
    parser.add_argument("--lr", type=float, default=0.02, help="Learning rate")
    parser.add_argument("--wd", "--weight-decay", type=float, default=0.01, help="Weight decay")
    parser.add_argument("--eval-every", type=int, default=25, help="Eval frequency")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")

    args = parser.parse_args()

    run_ternary_quantum_experiment(
        epochs=args.epochs,
        lr=args.lr,
        weight_decay=args.wd,
        eval_every=args.eval_every,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
