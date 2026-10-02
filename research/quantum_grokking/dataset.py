"""
dataset.py — Quantum Modular Arithmetic Dataset
================================================
Generates pairs of indices (a, b) in Z_p x Z_p with label y = (a + b) mod p.
Provides DataLoader splits for train/test grokking evaluation.
"""

import torch
from torch.utils.data import Dataset, DataLoader
import numpy as np


class QuantumModularDataset(Dataset):
    """
    Dataset of discrete index pairs (a, b) with modular addition target (a + b) mod p.
    """

    def __init__(
        self,
        p: int = 7,
        op: str = "add",
        split_ratio: float = 0.5,
        split: str = "train",
        seed: int = 42,
    ):
        super().__init__()
        self.p = p
        self.op = op

        all_pairs = [(a, b) for a in range(p) for b in range(p)]
        rng = np.random.RandomState(seed)
        shuffled = rng.permutation(len(all_pairs))

        n_train = int(len(all_pairs) * split_ratio)
        if split == "train":
            selected = shuffled[:n_train]
        elif split == "test":
            selected = shuffled[n_train:]
        elif split == "all":
            selected = shuffled
        else:
            raise ValueError(f"Unknown split: {split}")

        self.pairs = [all_pairs[i] for i in selected]
        self.targets = []
        for a, b in self.pairs:
            if op == "add":
                y = (a + b) % p
            elif op == "sub":
                y = (a - b) % p
            elif op == "mul":
                y = (a * b) % p
            else:
                raise ValueError(f"Unknown op: {op}")
            self.targets.append(y)

        self.a_tensor = torch.tensor([p[0] for p in self.pairs], dtype=torch.long)
        self.b_tensor = torch.tensor([p[1] for p in self.pairs], dtype=torch.long)
        self.y_tensor = torch.tensor(self.targets, dtype=torch.long)

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        return self.a_tensor[idx], self.b_tensor[idx], self.y_tensor[idx]


def get_quantum_modular_data(
    p: int = 7,
    op: str = "add",
    split_ratio: float = 0.5,
    batch_size: int = 64,
    seed: int = 42,
):
    train_ds = QuantumModularDataset(p=p, op=op, split_ratio=split_ratio, split="train", seed=seed)
    test_ds = QuantumModularDataset(p=p, op=op, split_ratio=split_ratio, split="test", seed=seed)

    train_loader = DataLoader(train_ds, batch_size=min(batch_size, len(train_ds)), shuffle=True)
    test_loader = DataLoader(test_ds, batch_size=len(test_ds), shuffle=False)

    return train_loader, test_loader
