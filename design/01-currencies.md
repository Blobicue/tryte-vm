<!-- kind: reference -->
# 01 — What this machine is measured in

Six costs. They do not agree, and the project has already produced a design that
improved two while making a third worse. Any design claim that does not name its
currency is meaningless.

---

## The six

| currency | what it counts | status of the instrument |
|---|---|---|
| **switches** | devices in the network | MEASURED — `Net.cost().switches` |
| **mid-rail taps** | devices touching `vmid` | MEASURED — reported separately because the middle rail is free here and is not free in silicon |
| **pass depth** | conducting switches a level arrived through, from the rail that drives it, shortest path, over nodes something *reads* | MEASURED — `Net.readDepth` |
| **dependency stages** | solver passes needed to settle | MEASURED — the iteration cap |
| **state elements** | nodes that must retain a value between solves | PROPOSED — nothing counts these yet |
| **seeded nodes** | nodes whose value must be supplied at the start of a solve | PROPOSED — nothing counts these either |

The last two are new for this phase. Everything built so far has been
combinational; a machine is not.

---

## Where they disagree

This is measured history, not speculation.

**Switches against pass depth.** The decoded-selector adder is 540 switches at
depth 3 against the selector tree's 624 at depth 6 — better on both. But it is
**worse** on dependency stages: 13 passes against 7, because decoding inserts a
level of gating the tree did not have. Two currencies improved and one got worse,
and only naming all three made that visible. `MEASURED`

**Switches against mid-rail taps.** The same decoded design taps the middle rail
**186 times against 168** — one extra per detector. It wins on area partly by
leaning harder on the one resource nobody is charging for. `MEASURED`

**Area against restoration.** Buffering the selector tree to reduce pass depth
takes it from 624 switches to 912, and buffering both levels to 1776 — for no
further depth at all, because both floors are already reached by the cheaper
option. `MEASURED`

**Per digit against per machine.** A ternary adder digit costs 104 switches
against a binary one's 28 — 3.71×, where the break-even is log₂3 ≈ 1.58. The
per-digit and per-machine numbers point the same way here, but they are different
quantities and one earlier comparison in this project mixed units by a factor of
two. `MEASURED`

---

## Which currency should the machine be optimised in

Not settled, and it is a genuine fork.

| position | argument | status |
|---|---|---|
| **switches** | it is the only currency with an uncontested instrument, and it is what a chip is billed in | PROPOSED |
| **state elements** | in real sequential design, storage dominates area by orders of magnitude, and this machine is about to acquire a 729-word memory | PROPOSED |
| **mid-rail taps** | it is the cost this model hides entirely, so optimising it is the only way the design does not quietly free-ride | PROPOSED |
| **dependency stages** | it is the closest thing this model has to time, and a machine that takes more passes per instruction is slower in the only sense the model can express | PROPOSED |
| **none — report all six** | the project's best result came from noticing a design improved two and worsened a third; collapsing to one number destroys that | PROPOSED |

The last position is the one the record most supports, and it is also the one that
refuses to make a decision. Both things are true.

---

## What is missing from this list

A real chip is billed in area, power, delay and yield. This model can express
none of them directly. Switches are a proxy for area that ignores wiring; mid-rail
taps are a proxy for static power that ignores everything else; dependency stages
are a proxy for delay that the model itself has shown to be wrong in an
interesting way — a ripple carry costs nothing here, which is the one thing a
ripple adder is famous for costing.

Any currency added later should be added to this table, and the design files that
compared options under the old set should be re-read.
