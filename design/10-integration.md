<!-- kind: subsystem -->
# 10 — The whole machine, budgeted

## Requirement

A number for what the machine costs, under each coherent combination of the
choices in this folder, in every currency [`01-currencies.md`](01-currencies.md)
names — so that the choices can be compared rather than argued about.

Checkably: once built, `Net.cost()` on the assembled machine matches the number
this file predicted, or the file was wrong and says so.

## What the axioms force

Nothing new. This file is arithmetic over the others, and its job is to make one
thing impossible to miss.

## Options

Two coherent paths, and the gap between them is the whole planning decision.

| | conservative — `M0` | aggressive — `M1` |
|---|---|---|
| model | unchanged | charge retention |
| storage cell | `S0`, 11 switches | `S3`, ~2 switches |
| memory, 729 × 6 | **~48,100** | **~8,700** |
| registers, 3 × 6 trits, master-slave | **396** `MEASURED` | ~72 |
| decode, ~12 lines | ~480 | ~480 |
| interconnect | ~300 | ~300 |
| ALU (existing adder + gates) | ~700 | ~700 |
| address path | ~1,000–3,000 | ~1,000–3,000 |
| **total** | **~51,000–53,000** | **~11,000–13,000** |
| status | DERIVED from `04`, `07` | PROPOSED |

And the thing that ought to be uncomfortable:

| | switches | share of machine |
|---|---|---|
| memory (`M0`) | ~48,100 | **~93%** |
| everything else | ~3,700 | ~7% |
| **the six-trit adder** — three phases, two exhaustive sweeps, the best result in the repository | **540** | **~1%** |

`DERIVED`

## Interactions

**The plan's centre of gravity is not where the work has been.** Every phase of
this project so far has been spent on the 1%. That is not wasted — the adder is
where the axioms were established, the failures happened and the method was
built — but as *design*, it means the machine's cost has never been governed by
anything anyone has optimised.

Three consequences for what to do next:

1. **The storage cell decision outranks everything.** `A0` against `A1` is a
   factor of five on the whole machine. No other choice in this folder moves the
   total by more than a few percent, and several — decode, interconnect — are
   rounding error at any setting.
2. **So `M1` charge retention is the highest-leverage open question in the
   project**, and [`03-model-options.md`](03-model-options.md) ranked it fourth by
   blast radius. Leverage and blast radius disagree, and that disagreement is the
   decision.
3. **Or the scope changes.** `A2` (fewer words) and `A3` (harness-held memory) are
   not compromises to be embarrassed about; they are the difference between a
   machine that can be built and swept exhaustively and one that cannot. A 27-word
   machine is a real machine and it is ~2,000 switches.

## What a measurement phase would register

1. **The 27-word machine as a whole**, under `M0`/`S0`/`I0`/`C1`/`Q0` — small
   enough to sweep, complete enough to run a program. Predicted ~2,000 switches
   and a dependency depth per instruction nobody has estimated.
2. **`M1`'s blast radius before its benefit**: run the existing 634 checks against
   a solver where `Z` retains, and register which ones break. That is a day's
   leverage on a factor-of-five decision.
3. **The address path, D0 against D1**, since it is the only sub-kilo-switch item
   with a range wide enough to matter.
4. **A prediction of the assembled total before assembling it** — this file's
   numbers, registered, so that building the machine tests the plan as well as the
   circuit.

## What is missing from this list

Wiring, which this model cannot represent and which in a real 48,000-device design
would dominate area. Power.

~~Anything about whether a 4,374-node seed actually solves in reasonable time — the
solver is superlinear in practice.~~ **Both halves of that were wrong**, and the H
set measured them. The solver is *linear* in devices × passes; 50,000 devices solve
in about 70ms. The machine can be simulated. What it cannot be is **swept**: a full
531,441-pair sweep fits in an hour only up to roughly 4,800 devices, and the machine
is ten times that. `MEASURED`

Which relocates the worry rather than removing it. Every circuit result in this
repository rests on exhaustive sweeping, and the machine sits outside where that is
available — so the numbers in this file will be checkable by sampling and by
construction, and not the way everything else here was checked.
