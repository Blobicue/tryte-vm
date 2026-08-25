<!-- kind: subsystem -->
# 04 — Storage: the trit cell

Everything else in this folder is downstream of this file.

## Requirement

A cell holds one of three levels across a solve and returns the level it was
given. Checkably: write −1, 0 or +1; solve; read it back; repeat under a hold
signal any number of times without the value moving. Never `X`, never `Z`, never a
different trit.

## What the axioms force

Three of the four obvious constructions are unavailable, and one is not. All four
were run; see [`02-forbidden.md`](02-forbidden.md) for the table.

- `N7` — a cold start on a feedback loop lands on unresolved and stays. **No cell
  in this model can power itself up.** `MEASURED`
- `N8` — but a seeded loop keeps what it was given. Storage is expressible
  *because* the initial state is part of the semantics. `MEASURED`
- `T5` — an input never sources, so data from outside must be re-driven from a
  rail before it can be written anywhere. `MEASURED`
- `N4` — two drivers on one node is contention, so **a write must open the loop,
  not overpower it.** `MEASURED`

## Options

| # | cell | switches | holds | needs | status |
|---|---|---|---|---|---|
| **S0** | cross-coupled `STI` pair, feedback gated, write port passes a rail-driven node | **19** with an input buffer, **11** without | all three trits | nothing | MEASURED |
| **S1** | the same, written by overpowering the loop | — | — | `M3` strength | MEASURED as impossible under `N4` |
| **S2** | the same, written directly from a primary input | — | — | `M3`, or `T5` revisited | MEASURED as impossible under `T5` |
| **S3** | dynamic: one pass gate onto an isolated node, value retained as charge | **1–2** | all three, for a bounded time in silicon and forever here | `M1` charge retention | PROPOSED |
| **S4** | master–slave: two S0 cells with opposite hold phases | **~38** | all three, with edge-like behaviour | nothing | PROPOSED |
| **S5** | a trit stored as two **bits** in binary cells, converted at the boundary | ~2 × binary cell + conversion | all three, indirectly | nothing | PROPOSED |
| **S6** | one-hot: three binary cells, one per level, exactly one asserted | ~3 × binary cell | all three, with an illegal-state hazard | nothing | PROPOSED |
| **S7** | **no cell at all** — state lives in the solver's seed and the circuit stays combinational | **0** | all three | nothing | PROPOSED |
| **S8** | cross-coupled `NTI` pair instead of `STI` | **~8** | **two levels only** — the middle is not a fixed point of `NTI∘NTI` | nothing | DERIVED |
| **S9** | three-device DRAM analogue: write gate, storage node, read gate | **~3** | all three | `M1` | PROPOSED |

Two of these deserve more than a table row.

**S7 is not a joke.** The model already requires the machine to be seeded, and the
sequencing options in [`09-sequencing.md`](09-sequencing.md) already put the step
boundary in the harness. If state is seeded anyway, a storage *circuit* buys
nothing except the claim that the machine is made of switches — which is exactly
the claim this whole layer exists to support. So S7 costs zero switches and
concedes the point of the exercise. It belongs on the list so that the concession
is explicit rather than accidental.

**S8 is the cheapest thing that works and it does not work.** A cross-coupled pair
of negative ternary inverters is bistable, not tristable: −1 and +1 are fixed
points of the doubled map and 0 is not, so it stores a *bit* in half the switches.
Worth knowing, because a machine that stores trits and computes in trits may still
want binary cells for control flags where a bit is all that is meant. `DERIVED`

## Interactions

- **[`05-registers.md`](05-registers.md)** inherits the write discipline entirely.
  If the cell needs its loop opened, every register write needs a hold signal
  routed to every cell, and that routing is a cost nobody has counted.
- **[`07-memory.md`](07-memory.md)** multiplies whichever cell wins by 4,374. At
  S0's 11 switches that is ~48,000 switches; at S3's 2 it is ~8,700. **This single
  choice moves the machine's total by an order of magnitude**, which makes it the
  highest-leverage decision in the folder.
- **[`03-model-options.md`](03-model-options.md)**: S3 and S9 are the argument for
  `M1`, and they are a strong one. If charge retention is admissible the storage
  chapter is rewritten.
- **[`01-currencies.md`](01-currencies.md)**: S0 introduces the first `state
  elements` and `seeded nodes` this project has ever had, and neither has an
  instrument yet.

## What a measurement phase would register

In order of leverage:

1. **The S0 cell exhaustively.** All three values, written, held across repeated
   solves, read back. Plus: does it hold across *many* solves, or does something
   drift? Nothing has ever been solved repeatedly with its own output re-seeded.
2. **Cost with the buffer removed**, in a context where the write data is already
   rail-driven — predicted 11 switches, currently `DERIVED` from subtraction.
3. **S8's bistability**, which is `DERIVED` by hand and should be run: predicted
   to hold −1 and +1 and to lose 0.
4. **Whether two S0 cells can share a write bus** without contending — this is the
   first thing [`06-interconnect.md`](06-interconnect.md) needs and it is untested.
5. **S3 under a patched solver**, which is the cheapest way to find out whether
   `M1` is worth the demolition.

## What is missing from this list

Cells that are not built from inverters at all. Cells that store a trit as a
*duration* or a *count* rather than a level. Anything using the third rail as a
storage reference rather than a signal level. And whatever the equivalent is of
the decoded selector — the design that beat the obvious one by 13% and half the
depth, and that nobody thought of for four phases.
