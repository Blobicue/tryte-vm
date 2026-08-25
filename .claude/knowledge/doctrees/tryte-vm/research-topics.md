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
| **Is `I0` or `I2` the cheaper interconnect, and where do they cross?** | 6, 9 | the next build phase; `B` established that `I0`'s stored sources work, but only in `tmux` | **highest** |
| **What do the decoder and write-enable terms actually cost?** | 7, 8 | now the largest `PROPOSED` numbers in the budget; `B3` measured the read term and left these two | **high** |
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
