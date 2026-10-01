# Where this repository stands

An orientation for whoever arrives after a gap — human or agent. Updated 2026-10-01.

This file **narrates and points**. It owns no numbers: every measured figure it
mentions lives in `FINDINGS.json` under the set id cited beside it, and every branch,
tag and commit is named so the claim can be checked with `git log`. If this file and
the manifest disagree, the manifest is right and this file is stale.

---

## What this repository is for

tryte-vm asks whether a small simulated ternary machine — the 729-cell VM and the
switch-level circuits beneath it — can be **measured affordably and honestly**.

It began as a request for **a ternary compute environment in a browser, on
WebAssembly**, and that request is met. `docs/tryte-lab.html` runs switch-level sweeps
in a browser on a solver the page emits for itself — no committed binary, no base64
blob, no toolchain. It was opened in a real browser and a full exhaustive sweep
reproduced `Y1` and `Y2`. The older VM page, `docs/tryte-vm.html`, predates it and is
plain JavaScript.

The instrument work that grew from it is recorded as prediction sets:

- **`AV`** — a packed-representation solver and a WebAssembly one, held against the
  untouched oracle `src/device.js`. Registered in tension; the two in tension failed
  together, on the premise they shared.
- **`AW`** — the decoded adder's pass-count rule at non-zero carry-in, crossing a
  scope line `F` had written about its own blind spot. All four failed, and the rule
  needed no amendment.
- **`AX`** — where a solver pass actually goes, across conduction, the reachability
  walk and the update loop. All four held.
- **`AY`** — what giving up the walk for frontier relaxation costs, measured at one
  lane before any lane is added. **Complete but not merged**: branch `ay-relaxation`,
  tip `d5bd7b3`. It is the number any bitsliced solver has to beat, and it found that
  relaxation is priced by a network's *depth*, not its edge count.

`design/13-instrument.md` is this line's plan, with each step marked done.

`main` also carries commit `1506225`, from a separate writer: a phinary memory
subsystem, Z[φ] arithmetic, 2D lattice addressing and a WebAssembly engine. It is a
different number base, not ternary, and no prediction set covers it.

---

## The compute-horizon work now lives in its own repository

A second line grew here as the branch `codex/ternary-compute-horizon`: a plan for a
ternary training and inference engine on real hardware, across a physical fleet of
machines. It asked a different question from this repository — not "can this machine
be measured?" but "can ternary be a useful engine on real silicon?" — and on
2026-10-01 it was moved to its own repository, **`C:\Users\Owen\ternary-compute`**.

**Why it moved.** Both lines forked from `a7b452f`, when the record ended at set `AU`,
and the scaffold correctly told *both* that their next sets were `AV` and `AW`. They
registered unrelated work under the same names. This repository's protocol keys every
binding on set id — `registered_at`, the `at_risk` lines, the drift check that recovers
text with `git show <registered_at>:<tool>` — and renaming a registered set is the one
move it forbids. Giving each line its own record was the only fix that edited no
registration.

**How.** The new repository was cloned from this one, not rebuilt, so every commit
hash came across and every registration still resolves there; its manifest validator
passed immediately after the split. Its `SPLIT.md` records the rest.

**What it means here.** From the split onward, **a set id means something only inside
the repository that registered it.** This repository's `AV` and `AW` are the solver
and carry-in sets above. ternary-compute's `AV` and `AW` are hardware profiling sets
and are unrelated. Cite across the two by repository as well as set.

**What remains here of it.** Nothing on `main` — that branch was never merged. The tag
`split/compute-horizon` points at its last commit, `38db1ec`, so the history stays
reachable from this repository too.

---

## Decisions that are open

None of these belong to whoever writes this file.

1. **Whether `AY` merges.** It is complete and its suites pass individually, but
   `main` moved under it: `1506225` touches `build/bundle.js` and
   `docs/tryte-lab.html`, which `AY`'s line also touched. Its full-suite run was
   repeatedly killed by the environment, so its aggregate check count is unconfirmed.
2. **Whether the browser thread continues.** It is finished as asked. Small open items
   remain: `dRippleAdder` ignores its `restore` option, so three rows of the lab page's
   cost table are one design under three labels; and `solver-audit.js --quick` can
   print a verdict that contradicts the manifest.
3. **Where each repository is published.** `origin/main` is still `a7b452f`. Nothing
   from either line has been pushed, and ternary-compute has no remote at all.

---

## What carries across the split

Two things from this repository are relevant to ternary-compute:

- **`AY`'s result.** If bitslicing is on ternary-compute's roadmap, the cost of
  replacing a worklist traversal with a sliceable one has already been measured here,
  with a mechanism attached.
- **The registration lessons.** This repository's sets failed repeatedly on
  predictions that shared one premise, and on constructions specified in prose while
  the predictions beside them were specified adversarially. The notes on `AV`, `AW`,
  `AX` and `AY` in `FINDINGS.json`, and the entries in `results/07-negative.md`,
  record those failures. They are cheaper to read than to repeat.
