"""
train.py — Training & Grokking Experiment Runner for Ternary Networks
=====================================================================
Executes training loops on modular arithmetic to monitor grokking,
parameter norm contraction, ternary sparsity, and cyclotomic Fourier alignment.
"""

import argparse
import time
import json
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np

from .dataset import get_modular_data
from .hypernetwork import TernaryMLP, TernaryHypernetwork
from .fourier_analyzer import CyclotomicFourierAnalyzer


def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    for x, y in loader:
        x, y = x.to(device), y.to(device)
        optimizer.zero_grad()
        logits = model(x)
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

    for x, y in loader:
        x, y = x.to(device), y.to(device)
        logits = model(x)
        loss = criterion(logits, y)

        total_loss += loss.item() * len(y)
        preds = logits.argmax(dim=-1)
        correct += (preds == y).sum().item()
        total += len(y)

    return total_loss / total, correct / total


def run_grokking_experiment(
    p: int = 53,
    op: str = "add",
    model_type: str = "mlp",
    hidden_dim: int = 128,
    epochs: int = 2000,
    lr: float = 1e-3,
    weight_decay: float = 0.5,
    split_ratio: float = 0.5,
    eval_every: int = 50,
    delta: float = 0.35,
    seed: int = 42,
    verbose: bool = True,
):
    torch.manual_seed(seed)
    np.random.seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    train_loader, test_loader, input_dim, num_classes = get_modular_data(
        p=p, op=op, split_ratio=split_ratio, seed=seed
    )

    if model_type == "mlp":
        model = TernaryMLP(
            input_dim=input_dim,
            hidden_dim=hidden_dim,
            output_dim=num_classes,
            activation="quadratic",
            delta=delta,
        ).to(device)
    elif model_type == "hypernet":
        model = TernaryHypernetwork(
            input_dim=input_dim,
            hidden_dim=hidden_dim,
            output_dim=num_classes,
            delta=delta,
        ).to(device)
    else:
        raise ValueError(f"Unknown model_type: {model_type}")

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    fourier_analyzer = CyclotomicFourierAnalyzer(p=p)

    history = {
        "epoch": [],
        "train_acc": [],
        "test_acc": [],
        "train_loss": [],
        "test_loss": [],
        "mean_sparsity": [],
        "fourier_ratio": [],
    }

    grokked_epoch = None
    memorized_epoch = None

    if verbose:
        print("=" * 78)
        print(f"  Ternary Grokking Experiment: ({op}) mod {p}")
        print(f"  Model: {model_type.upper()} (Hidden Dim: {hidden_dim}) | Weights: Discrete {-1, 0, +1}")
        print(f"  Dataset: {len(train_loader.dataset)} Train / {len(test_loader.dataset)} Test ({int(split_ratio*100)}% Split)")
        print(f"  Weight Decay: {weight_decay} | Learning Rate: {lr} | Quant Delta: {delta}")
        print("=" * 78)
        print(f"{'Epoch':<8} | {'Train Acc':<10} | {'Test Acc':<10} | {'Train Loss':<11} | {'Sparsity':<9} | {'Fourier Ratio':<14}")
        print("-" * 78)

    t0 = time.time()

    for epoch in range(1, epochs + 1):
        tr_loss, tr_acc = train_epoch(model, train_loader, optimizer, criterion, device)

        if memorized_epoch is None and tr_acc >= 0.99:
            memorized_epoch = epoch

        if epoch % eval_every == 0 or epoch == epochs or epoch == 1:
            te_loss, te_acc = evaluate(model, test_loader, criterion, device)
            sparsity = model.get_sparsity()["mean_sparsity"]
            fourier_res = fourier_analyzer.evaluate_model(model)
            f_ratio = fourier_res["mean_fourier_ratio"]

            history["epoch"].append(epoch)
            history["train_acc"].append(tr_acc)
            history["test_acc"].append(te_acc)
            history["train_loss"].append(tr_loss)
            history["test_loss"].append(te_loss)
            history["mean_sparsity"].append(sparsity)
            history["fourier_ratio"].append(f_ratio)

            if verbose:
                print(
                    f"{epoch:<8} | {tr_acc*100:6.2f}%    | {te_acc*100:6.2f}%    | {tr_loss:10.4f}  | {sparsity:6.2f}%   | {f_ratio:10.4f}"
                )

            # Check for grokking transition: train memorized (>95%) and test accuracy crosses 80%
            if grokked_epoch is None and tr_acc >= 0.95 and te_acc >= 0.80:
                grokked_epoch = epoch
                if verbose:
                    print(f"\n>>> [GROKKING EVENT DETECTED AT EPOCH {epoch}] <<<")
                    print(f">>> Test accuracy reached {te_acc*100:.2f}%, Fourier ratio {f_ratio:.4f}!\n")

    total_time = time.time() - t0

    # Benchmark native C SIMD evaluation
    test_inputs = []
    for x, _ in test_loader:
        test_inputs.append(x)
    test_inputs = torch.cat(test_inputs, dim=0).numpy().astype(np.int8)

    simd_time_ms = 0.0
    if model_type == "mlp":
        t_simd_start = time.time()
        for _ in range(50):
            _ = model.forward_native_simd(test_inputs)
        simd_time_ms = (time.time() - t_simd_start) / 50 * 1000

    if verbose:
        print("=" * 78)
        print(f"Total Experiment Time   : {total_time:.2f} s ({total_time/epochs*1000:.2f} ms/epoch)")
        print(f"Memorization Epoch      : {memorized_epoch if memorized_epoch else 'Not reached'}")
        print(f"Grokking Phase Epoch    : {grokked_epoch if grokked_epoch else 'Not reached within budget'}")
        if model_type == "mlp":
            print(f"Native Bit-Sliced SIMD  : {simd_time_ms:.3f} ms per batch forward pass")
        print("=" * 78)

    return {
        "p": p,
        "op": op,
        "model_type": model_type,
        "hidden_dim": hidden_dim,
        "epochs": epochs,
        "weight_decay": weight_decay,
        "memorized_epoch": memorized_epoch,
        "grokked_epoch": grokked_epoch,
        "final_train_acc": history["train_acc"][-1] if history["train_acc"] else 0.0,
        "final_test_acc": history["test_acc"][-1] if history["test_acc"] else 0.0,
        "final_fourier_ratio": history["fourier_ratio"][-1] if history["fourier_ratio"] else 0.0,
        "simd_inference_time_ms": simd_time_ms,
        "history": history,
    }


def main():
    parser = argparse.ArgumentParser(description="Ternary Grokking & Hypernetwork Experiment")
    parser.add_argument("-p", "--prime", type=int, default=53, help="Modulus prime p")
    parser.add_argument("--op", type=str, default="add", choices=["add", "sub", "mul"], help="Modular operation")
    parser.add_argument("--model", type=str, default="mlp", choices=["mlp", "hypernet"], help="Model architecture")
    parser.add_argument("--hidden-dim", type=int, default=128, help="Hidden dimension")
    parser.add_argument("--epochs", type=int, default=2000, help="Total epochs")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--wd", "--weight-decay", type=float, default=0.5, help="Weight decay")
    parser.add_argument("--split", type=float, default=0.5, help="Train split ratio")
    parser.add_argument("--eval-every", type=int, default=100, help="Eval frequency")
    parser.add_argument("--delta", type=float, default=0.35, help="Ternary quantizer threshold")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--output", type=str, default=None, help="Save history to JSON file")

    args = parser.parse_args()

    results = run_grokking_experiment(
        p=args.prime,
        op=args.op,
        model_type=args.model,
        hidden_dim=args.hidden_dim,
        epochs=args.epochs,
        lr=args.lr,
        weight_decay=args.wd,
        split_ratio=args.split,
        eval_every=args.eval_every,
        delta=args.delta,
        seed=args.seed,
    )

    if args.output:
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        print(f"Results saved to {args.output}")


if __name__ == "__main__":
    main()
