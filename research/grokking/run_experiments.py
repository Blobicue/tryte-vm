"""
run_experiments.py — Multi-Run Sweep & Cluster Experiment Harness
=================================================================
Runs automated hyperparameter sweeps (weight decay, architectures, seeds)
to map the phase diagram of discrete ternary grokking.
Compatible with multi-core execution on AMD Ryzen / 12-node cluster.
"""

import os
import sys
import json
import argparse
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

from .train import run_grokking_experiment


def run_single_worker(config: dict) -> dict:
    """Worker task executed across processes/cluster nodes."""
    print(f"[Worker Start] Config: p={config['p']}, wd={config['wd']}, model={config['model']}, seed={config['seed']}")
    res = run_grokking_experiment(
        p=config["p"],
        op=config.get("op", "add"),
        model_type=config["model"],
        hidden_dim=config.get("hidden_dim", 128),
        epochs=config.get("epochs", 3000),
        lr=config.get("lr", 1e-2),
        weight_decay=config["wd"],
        split_ratio=config.get("split", 0.5),
        eval_every=config.get("eval_every", 100),
        delta=config.get("delta", 0.08),
        seed=config["seed"],
        verbose=False,
    )
    print(
        f"[Worker Done] wd={config['wd']}, seed={config['seed']} -> "
        f"Mem Epoch: {res['memorized_epoch']}, Grok Epoch: {res['grokked_epoch']}, "
        f"Final Test Acc: {res['final_test_acc']*100:.2f}%, Fourier: {res['final_fourier_ratio']:.4f}"
    )
    return res


def main():
    parser = argparse.ArgumentParser(description="Ternary Grokking Sweep Runner")
    parser.add_argument("-p", "--prime", type=int, default=23, help="Modulus prime p")
    parser.add_argument("--epochs", type=int, default=2000, help="Epochs per run")
    parser.add_argument("--workers", type=int, default=4, help="Parallel worker processes")
    parser.add_argument("--output", type=str, default="research/grokking/results/sweep_summary.json")

    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    # Sweep grid: weight decay regimes
    weight_decays = [0.001, 0.01, 0.1, 0.5, 1.0, 2.0]
    seeds = [42, 101]
    models = ["mlp"]

    configs = []
    for wd in weight_decays:
        for seed in seeds:
            for m in models:
                configs.append({
                    "p": args.prime,
                    "wd": wd,
                    "model": m,
                    "seed": seed,
                    "epochs": args.epochs,
                    "lr": 1e-2,
                    "delta": 0.08,
                    "hidden_dim": 128,
                    "split": 0.5,
                    "eval_every": 100,
                })

    print("=" * 78)
    print(f"Launching Ternary Grokking Sweep: {len(configs)} runs on {args.workers} workers")
    print(f"Modulus: Z_{args.prime} | Epochs per run: {args.epochs}")
    print("=" * 78)

    t0 = time.time()
    results = []

    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(run_single_worker, c): c for c in configs}
        for fut in as_completed(futures):
            try:
                res = fut.result()
                results.append(res)
            except Exception as e:
                print(f"Error in worker: {e}", file=sys.stderr)

    total_time = time.time() - t0

    # Save summary
    with open(args.output, "w") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 78)
    print(f"Sweep Completed in {total_time:.2f} seconds!")
    print(f"Summary saved to {args.output}")
    print("=" * 78)

    # Print summary table
    print(f"{'WD':<8} | {'Seed':<6} | {'Mem Epoch':<12} | {'Grok Epoch':<12} | {'Final Test Acc':<16} | {'Fourier Ratio':<14}")
    print("-" * 78)
    for r in sorted(results, key=lambda x: (x["weight_decay"], x.get("seed", 0))):
        mem = str(r["memorized_epoch"]) if r["memorized_epoch"] else "None"
        grok = str(r["grokked_epoch"]) if r["grokked_epoch"] else "None"
        test_acc = f"{r['final_test_acc']*100:.2f}%"
        fourier = f"{r['final_fourier_ratio']:.4f}"
        print(f"{r['weight_decay']:<8} | {r.get('seed', 42):<6} | {mem:<12} | {grok:<12} | {test_acc:<16} | {fourier:<14}")
    print("=" * 78)


if __name__ == "__main__":
    main()
