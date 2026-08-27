#!/usr/bin/env python3
"""GROK — does the algebra of a task predict when a network generalises?

Set AM. The design is AL's: every two-input ternary operation carries labels this
project measured before anyone thought of training on them -- affine or not (AL1,
AL2), reversible or not (AB1), and an erasure in bits (AB).

The grokking literature studies modular arithmetic almost exclusively, and modular
arithmetic is AFFINE. AL1 measured how strong that assumption is: 27 of 19,683
two-input ternary operations are affine, which is 0.137% of the space. So the
algebraic variable has been held fixed by almost everyone who has looked.

THE TASK. Tokens a, b in 0..26 -- a three-trit register -- and the target is the
table applied TRITWISE. The network sees a and b as opaque tokens, so the structure
it has to discover is "decompose into base three, apply f positionwise, recompose".
That is the ternary analogue of discovering a Fourier basis for modular addition:
a hidden factorisation, not a hidden linearity.

729 pairs, 40% for training, everything else held out.

ONE QUADRANT IS DEGENERATE BY CONSTRUCTION, and it is worth stating rather than
discovering later. An affine table is reversible in its leading argument exactly when
alpha is nonzero, so AFFINE AND ERASING forces alpha = 0, which means the function
ignores its first input entirely. All nine such tables are one-input functions. That
quadrant cannot carry a two-input task at all, which is a fact about the algebra and
not about the experiment.

------------------------------------------------------------------------------
PREDICTED OUTCOMES — registered before the run, per AGENTS.md.

  AM1 GROKKING HAPPENS HERE AT ALL. Predicted at least one task shows the signature
      -- train accuracy reaching 100% at least 5x earlier in steps than test accuracy
      first reaches 90% -- so the phenomenon reproduces on a task family that is not
      modular arithmetic. Registered with the alternative: if every task generalises
      at roughly the same time it memorises, this arena is too small or too factorable
      to grok and the result is about the arena.

  AM2 THE AFFINE TASK GROKS SOONEST. Modular addition is what the literature studies
      and it is the one affine two-input task available. Predicted it reaches 90% test
      accuracy in FEWER steps than the non-affine reversible task trained identically
      -- same architecture, same seed, same optimiser, same split -- so the algebraic
      label predicts the outcome rather than merely labelling it.

  AM3 AND ACCURACY IS THE WRONG METRIC FOR AN ERASING TASK. An erasing operation has
      a non-uniform output distribution, so a majority-class guesser already scores
      well before anything is learned. Predicted the erasing task's majority-class
      baseline exceeds 40% while the reversible tasks' baselines sit near 1/27 = 3.7%,
      so raw test accuracy is not comparable across quadrants and the gap over
      baseline is what has to be reported.

  AM4 THE DEGENERATE QUADRANT IS DEGENERATE. Predicted the affine-erasing task is
      learned almost immediately -- 90% test accuracy within a tenth of the steps the
      affine-reversible task needs -- because it ignores one of its two inputs and
      there is no two-input structure to find. Predicted this is true of ALL NINE
      tables in that quadrant, not just the one trained, since alpha = 0 is forced.

------------------------------------------------------------------------------
Run:  python3 bench/grok.py            (writes bench/grok-results.json)
"""
import json, math, os, sys, time
import torch
import torch.nn as nn

TRITS = [-1, 0, 1]
IDX = {-1: 0, 0: 1, 1: 2}

# Chosen deliberately rather than taken first-in-quadrant, because the first of each
# happened to be constant or near-constant and a constant function is not a task.
TASKS = {
    # alpha=1, beta=1, gamma=0 -- ternary modular addition, the literature's task
    "affine_reversible":    [-1, 0, 1, 0, 1, -1, 1, -1, 0],
    # alpha=0 is forced for affine+erasing, so this ignores its first input: f = b
    "affine_erasing":       [-1, 0, 1, -1, 0, 1, -1, 0, 1],
    # a genuine two-input reversible operation that is not affine
    "nonaffine_reversible": [0, 1, 1, 1, 0, 0, -1, -1, -1],
    # tritwise MIN
    "nonaffine_erasing":    [-1, -1, -1, -1, 0, 0, -1, 0, 1],
}

N_STATES = 27
def trits3(v):
    return [v % 3, (v // 3) % 3, (v // 9) % 3]
def from3(t):
    return t[0] + 3 * t[1] + 9 * t[2]

def apply_table(tbl, a, b):
    """Apply the 3x3 table tritwise across three trits. a,b,out in 0..26."""
    ta, tb = trits3(a), trits3(b)
    out = []
    for i in range(3):
        va, vb = TRITS[ta[i]], TRITS[tb[i]]
        out.append(IDX[tbl[3 * IDX[va] + IDX[vb]]])
    return from3(out)

def dataset(tbl, device):
    A, B, Y = [], [], []
    for a in range(N_STATES):
        for b in range(N_STATES):
            A.append(a); B.append(b); Y.append(apply_table(tbl, a, b))
    return (torch.tensor(A, device=device), torch.tensor(B, device=device),
            torch.tensor(Y, device=device))

class Grokker(nn.Module):
    """One-layer transformer over [a, b, =], reading the last position."""
    def __init__(self, n_vocab=N_STATES + 1, d=128, heads=4):
        super().__init__()
        self.emb = nn.Embedding(n_vocab, d)
        self.pos = nn.Parameter(torch.randn(3, d) * 0.02)
        self.attn = nn.MultiheadAttention(d, heads, batch_first=True)
        self.ln1 = nn.LayerNorm(d); self.ln2 = nn.LayerNorm(d)
        self.mlp = nn.Sequential(nn.Linear(d, 4 * d), nn.GELU(), nn.Linear(4 * d, d))
        self.out = nn.Linear(d, N_STATES)
    def forward(self, a, b):
        eq = torch.full_like(a, N_STATES)
        x = self.emb(torch.stack([a, b, eq], dim=1)) + self.pos
        h, _ = self.attn(self.ln1(x), self.ln1(x), self.ln1(x), need_weights=False)
        x = x + h
        x = x + self.mlp(self.ln2(x))
        return self.out(x[:, -1])

def run(name, tbl, device, steps=40000, train_frac=0.4, seed=0, log_every=200):
    torch.manual_seed(seed)
    A, B, Y = dataset(tbl, device)
    n = len(A)
    perm = torch.randperm(n, generator=torch.Generator().manual_seed(seed)).to(device)
    ntr = int(n * train_frac)
    tr, te = perm[:ntr], perm[ntr:]

    # Majority-class baseline on the held-out split -- AM3's control.
    counts = torch.bincount(Y[te], minlength=N_STATES)
    baseline = (counts.max().item() / len(te))

    model = Grokker().to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1.0, betas=(0.9, 0.98))
    lossf = nn.CrossEntropyLoss()
    hist = []
    first_train_100 = None
    first_test_90 = None

    for step in range(1, steps + 1):
        model.train()
        opt.zero_grad(set_to_none=True)
        logits = model(A[tr], B[tr])
        loss = lossf(logits, Y[tr])
        loss.backward(); opt.step()

        if step % log_every == 0 or step == 1:
            model.eval()
            with torch.no_grad():
                tra = (model(A[tr], B[tr]).argmax(-1) == Y[tr]).float().mean().item()
                tea = (model(A[te], B[te]).argmax(-1) == Y[te]).float().mean().item()
            hist.append({"step": step, "train": round(tra, 4), "test": round(tea, 4),
                         "loss": round(loss.item(), 5)})
            if first_train_100 is None and tra >= 0.999: first_train_100 = step
            if first_test_90 is None and tea >= 0.90: first_test_90 = step
            if first_test_90 is not None and step > first_test_90 * 2 and tra >= 0.999:
                break
    return {
        "task": name, "table": tbl,
        "train_examples": ntr, "test_examples": len(te),
        "majority_baseline": round(baseline, 4),
        "first_train_100": first_train_100,
        "first_test_90": first_test_90,
        "gap_ratio": (round(first_test_90 / first_train_100, 2)
                      if first_train_100 and first_test_90 else None),
        "final_train": hist[-1]["train"], "final_test": hist[-1]["test"],
        "steps_run": hist[-1]["step"],
        "history": hist,
    }

def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device: {device}", flush=True)
    if device == "cuda":
        print(f"gpu: {torch.cuda.get_device_name(0)}", flush=True)
    out = {"device": device, "torch": torch.__version__, "results": {}}
    for name, tbl in TASKS.items():
        t0 = time.time()
        print(f"\n=== {name} ===", flush=True)
        r = run(name, tbl, device)
        r["seconds"] = round(time.time() - t0, 1)
        out["results"][name] = r
        print(f"  baseline {r['majority_baseline']:.3f}   "
              f"train100 @ {r['first_train_100']}   test90 @ {r['first_test_90']}   "
              f"gap {r['gap_ratio']}   final test {r['final_test']:.4f}   "
              f"{r['seconds']}s", flush=True)
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "grok-results.json"), "w") as f:
        json.dump(out, f, indent=1)
    print("\nwrote grok-results.json", flush=True)

if __name__ == "__main__":
    main()
