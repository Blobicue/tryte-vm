---
name: tryte-vm-research-topics
description: Intake queue for questions that cut across pillars or are not yet shaped enough to be one. Topics graduate into pillar updates, prediction sets, or design documents.
type: queue
last_updated: 2026-08-25
---

# tryte-vm research topics

Questions land here when they cut across pillars or are not yet shaped enough to
become a registered prediction. A session picking up work reads `_overview.md`,
then this queue.

## Active topics

| Topic | Cuts across | Why it is not yet a phase | Priority |
|---|---|---|---|
| **Is a second control cone affordable per step?** | 6, 9 | `A4` deferred the `I0`/`I2` pick to sequencing, and `design/09` is unbuilt. This is now the question that gates the wiring decision | **highest** |
| **Does the seeded discipline compose at thousands of nodes?** | 4, 9 | one missing seed poisons whatever it gates and nothing catches it but a wrong answer; needs a completeness check written before the memory array, not after | high |
| **A switch-level multiplier** | 7 | no design phase exists for it; multiplication exists only as a program | medium |
| **Are the 13 failure classes really one?** | 11 | needs defects from a project that is not this one | medium |
| **Carry-in +-1 pass-count walk** | 7 | a scoping gap left open when the carry-in-0 derivation was registered | low |
| **Do any source claims remain unchecked?** | 12 | needs a systematic read of `docs/origin/` against `FINDINGS.json` | low |

## Closed

| Topic | Closed by | Outcome |
|---|---|---|
| Can a 50,000-device network be solved? | `H2`, 2026-08-25 | Yes - the solver is linear, 50,000 devices solve in ~70ms. But a full 531,441-pair sweep fits in an hour only to ~4,800 devices, so the machine can be run and not swept. |
| Charge retention: blast radius | `H3`, `H4`, 2026-08-25 | Zero differences across every gate, every input and the adder swept. A trit cell becomes **one switch**; the 729-word memory drops 48,114 to 4,374 - eleven times, against the five estimated. |
| Can a stored value drive a selector *terminal*? | `B1a`,`B1b`,`B2`, 2026-08-25 | **Yes**, and reading disturbs nothing at any pass. But the families are not interchangeable: `dmux` never settles on stored terminals unless its select cone is resolved first, and `tmux` is immune. The read path and interconnect are now priced in `tmux`. |
| Are the address decoder and the read mux one structure? | `B4`, 2026-08-25 | **No**, by counting: a 27-way mux has 13 internal nodes and a write path needs 27 one-hot selects. They share the MID detectors only, ~2%. The address path does not halve and **243 words is out of reach for good**. |
| What do the decoder and write-enable terms actually cost? | `C1`, 2026-08-25 | **Built.** Decoder 105, write path 102, address path 519 against the old formula's 603 — wrong three ways at once, two of them upward. The target machine got cheaper: 81 words under `M1` is 3,562. |
| Is `I0` or `I2` the cheaper interconnect, and where do they cross? | `A1`, 2026-08-25 | **`I2`, by 3.8x** at 4 sources and 3 destinations. The crossover is in DESTINATIONS, not sources -- `I0` grows as D x S, `I2` as S alone -- so both `design/06` and the roadmap were wrong, and wrong about the axis. `I0` wins in one corner only: one destination, three sources. |
| Are there new families of ternary hashing functions, given a single self-referencing f? | `D`, 2026-08-25 | **Doors closed and one opened.** Every positionwise `f` repeats within SIX calls at any width, so that whole family is dead by argument. `s + g(s)` is injective only when `g` is an orthomorphism -- 3 of 6 trit permutations, exactly the identity and the two 3-cycles, with negation collapsing 729 states to 1 -- but even then it stays affine and does not mix. What does mix: a split state with a NONLINEAR 27-entry round table, at 8 cycles against a random permutation's 6.6. The round table is exactly `TOPC`. |
| How many operands does ternary need for reversible universality? | `M`, 2026-08-25 | **Two.** A named width-two ternary gate set generates exactly A_27, predicted from parity before the run. Binary cannot: all 24 reversible 2-bit gates are affine and affine composes to affine, so no 2-bit set reaches the symmetric group at any width -- which is why binary needs a 3-bit gate. Change one ternary gate from non-affine to affine and the group drops to 1.4e-23 of the symmetric group. |
| Is ternary's operand advantage worth anything in switches? | `O`, 2026-08-25 | **1.2x, and all of it borrowed.** The root: a one-control conditional is affine in GF(2) and never in GF(3), so ternary is born nonlinear where binary must AND two controls. But built in one idiom with T5 obeyed on both sides, the universal ternary gate is 10 switches and 2 mid taps against binary's 12 and 0 -- price a mid tap at ONE switch and they tie. The advantage is structural, not economic. |
| How much of this project rests on the free mid rail? | `N`, 2026-08-25 | **99.1% of the built memory's taps are forced.** Density runs 18% on the storage cell to 34% on the decoded adder; the 27-word memory takes 339 taps on 2,301 switches, a 1.15x multiplier at a price of one. The decoded adder -- the best circuit result here -- is the MORE tap-hungry family and loses to the tree adder above a price of 4.67. The detector's tap is removable; nothing else is. |
| Is the MID detector minimal at 4 switches? | `I1`-`I4`, 2026-08-25 | Yes, and for all four tables the selector's contract accepts rather than only the one built. Nothing under four switches works; four solutions each. The adder's 540 stands. |
| Which sweepable machine is worth building? | `design/12-roadmap.md`, 2026-08-25 | **81 words under charge retention**, ~3,640 switches. The only configuration that both fits `H2`'s sweep budget and runs a program somebody already wrote. A 27-word machine fits the budget and runs none of the eight. Closed by a design document, not a prediction set — the arithmetic was over already-measured parts. |

## Graduation rule

A topic leaves this queue when it becomes one of three things: a **registered
prediction set** with a tool of its own, a **design document** in `design/`, or a
**pillar update** here. Anything that graduates should say in its commit which
queue entry it closes, and this file should lose the row.

A topic that has sat here through three phases without moving is evidence about
priority, not about difficulty. Say so rather than leaving it.

## Intake

New topics come from the **Open questions** section of any pillar. When an open
question is sharp enough that someone could start on it tomorrow, it belongs here
instead.
