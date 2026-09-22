"""
dataset.py — Modular Arithmetic Dataset for Grokking Studies
============================================================
Generates canonical modular arithmetic tasks:
  - Modular Addition:       (a + b) mod p
  - Modular Subtraction:    (a - b) mod p
  - Modular Multiplication: (a * b) mod p
"""

import torch
from torch.utils.data import Dataset, DataLoader
import numpy as np


class ModularArithmeticDataset(Dataset):
    """
    Dataset of all pairs (a, b) in Z_p x Z_p with operation (a op b) mod p.
    Inputs are encoded as concatenated one-hot or balanced-ternary vectors.
    """

    def __init__(
        self,
        p: int = 53,
        op: str = "add",
        split_ratio: float = 0.5,
        split: str = "train",
        seed: int = 42,
        ternary_encoding: bool = True,
    ):
        super().__init__()
        self.p = p
        self.op = op
        self.split = split
        self.ternary_encoding = ternary_encoding

        # Generate all p x p pairs
        all_pairs = [(a, b) for a in range(p) for b in range(p)]
        if op == "mul":
            # For multiplication, often exclude 0 to avoid trivial zero absorption
            all_pairs = [(a, b) for a, b in all_pairs if a != 0 and b != 0]

        rng = np.random.RandomState(seed)
        shuffled_indices = rng.permutation(len(all_pairs))

        n_train = int(len(all_pairs) * split_ratio)
        if split == "train":
            selected_indices = shuffled_indices[:n_train]
        elif split == "test":
            selected_indices = shuffled_indices[n_train:]
        elif split == "all":
            selected_indices = shuffled_indices
        else:
            raise ValueError(f"Unknown split: {split}")

        self.pairs = [all_pairs[i] for i in selected_indices]

        # Compute targets
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

        self.targets = torch.tensor(self.targets, dtype=torch.long)

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        a, b = self.pairs[idx]
        y = self.targets[idx]

        # Input representation: concatenated vectors for a and b
        # In ternary encoding: +1 at active index, 0 elsewhere (or -1 background)
        x_a = torch.zeros(self.p, dtype=torch.float32)
        x_b = torch.zeros(self.p, dtype=torch.float32)

        x_a[a] = 1.0
        x_b[b] = 1.0

        x = torch.cat([x_a, x_b], dim=0)
        return x, y


def get_modular_data(
    p: int = 53,
    op: str = "add",
    split_ratio: float = 0.5,
    batch_size: int = 512,
    seed: int = 42,
) -> tuple[DataLoader, DataLoader, int, int]:
    """
    Returns train_loader, test_loader, input_dim, num_classes.
    """
    train_ds = ModularArithmeticDataset(p=p, op=op, split_ratio=split_ratio, split="train", seed=seed)
    test_ds = ModularArithmeticDataset(p=p, op=op, split_ratio=split_ratio, split="test", seed=seed)

    train_loader = DataLoader(train_ds, batch_size=min(batch_size, len(train_ds)), shuffle=True)
    test_loader = DataLoader(test_ds, batch_size=len(test_ds), shuffle=False)

    input_dim = 2 * p
    num_classes = p
    return train_loader, test_loader, input_dim, num_classes
