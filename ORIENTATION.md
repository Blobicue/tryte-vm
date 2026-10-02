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
  lane before any lane is added. It is the number any bitsliced solver has to beat,
  and it found that relaxation is priced by a network's *depth*, not its edge count.

`design/13-instrument.md` is this line's plan, with each step marked done.

`main` also carries commit `1506225`, from a separate writer: a phinary memory
subsystem, Z[φ] arithmetic, 2D lattice addressing and a WebAssembly engine. It is a
different number base, not ternary, and no prediction set covers it. Its four opcodes
were renumbered when it met the line below — see the next section.

---

## The quantum, crypto and toolchain line

A third line was developed on GitHub's `main` from the same fork point: quantum and
anyon compilers with a `QEXEC` instruction, a cooperative microkernel, lattice
cryptography, Lean 4 proofs, a Rust SIMD engine, SystemVerilog RTL and the TRIL
compiler. It was merged with the lines above on 2026-10-01. It registered no prediction
sets, so it did not collide in the record.

**It collided in the instruction set instead.** `QEXEC` in `src/isa.js` and phinary's
`PHINORM` in `src/phinary.js` both claimed opcode 25. The tables are in different
files, so git reported nothing — and the VM looks up `BY_CODE` first, so every
`PHINORM` would have run a quantum braid. Phinary's opcodes moved to 26–29, and
`test/test-opcodes.js` now fails if any two opcode tables share a code or a name.

**It now lives in its own repository.** On 2026-10-02 it moved out to `tryte-quantum`,
built from this repository's history, the way the compute-horizon work did. Unlike that
work it had reached into the core, so it went in two steps. First `QEXEC` left the core
tables and began registering itself through a new extension hook in `src/isa.js`, and the
quantum line's own suites showed the move preserved its behaviour. Then its files left.
`FENCE.md` says what it changed inside the core and what was kept or reverted, and
`test/test-fence.js` fails if any of its files come back. While it was here, three of its
batteries were found to hold a check that could never fire, and its quantum hypernetwork
was found to have nothing to learn (`F-QUTRIT-HYPERNET-NOTHING-TO-LEARN`, still asserted
here from history).

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

1. **Whether phinary moves onto the extension hook, or out.** It is the one remaining
   fenced line: a different number base, its four opcodes still wired directly into the
   assembler and the VM. The hook's collision check already covers its table, so moving it
   would be mechanical; whether it belongs here at all is the same question the quantum
   line raised.

Settled on 2026-10-02: the quantum line moved out to `tryte-quantum`, and its masking of
`undefined` and `NaN` as 0 in `src/ternary.js` was reverted while its shift fixes were
kept (`FENCE.md`).

Settled on 2026-10-01: `test-slate-query.js` now reports its federation section as
**skipped** when the siblings are absent, never passed. The lab page no longer shows
three identical decoded rows: a restore option the builder ignores gets no row and is
not offered. And every verdict line of `solver-audit.js --quick` says on its face that
it is not a measurement.

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
