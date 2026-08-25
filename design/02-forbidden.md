<!-- kind: reference -->
# 02 — What the axioms already rule out

Read this before the subsystem files. It is short, and it is what constrains them.

Three of the four obvious ways to build storage turn out to be unavailable, and
the reasons are axioms that had been proved and never leaned on. Each line below
was run, not reasoned about.

---

## Measured

| attempt | result | which axiom | status |
|---|---|---|---|
| cross-coupled inverter pair, cold start | `X` — never resolves to a level | `N7` — a node on a feedback loop never gets a determined gate, so it lands on unresolved and stays | MEASURED |
| the same pair, seeded at −1, 0 or +1 | holds all three | `N8` — the initial state is part of the semantics; the solver will not invent a level it cannot justify, but it will keep one it is given | MEASURED |
| write by passing an **input** onto the node | `X` for every value | `T5` — an input gates and terminates a path, but never sources one | MEASURED |
| write by driving the node against the loop | `X` for every value | `N4` — two drivers reaching one node is contention, and this model has no notion of strength, so the writer cannot win | MEASURED |
| write by **opening the feedback loop** first | works, all three trits, both phases | none — nothing forbids it | MEASURED |

The last row is the whole reason this design phase has a subject.

---

## What that means, stated carefully

**This model cannot express a ratioed write.** In silicon you overpower a latch by
making the writer stronger. Strength is exactly what `N4` refuses to represent —
contention is declared unknown rather than resolved. So every write in this
machine must break the loop, not win a fight. `DERIVED`

**This model cannot cold-start.** Any machine built here is powered up into a
seeded state; it cannot model its own power-on. That is not a bug to be fixed but
a cost to be declared, and it is the reason `seeded nodes` is a currency in
[`01-currencies.md`](01-currencies.md). `DERIVED`

**Primary inputs cannot be stored directly.** Data entering the machine from
outside has to pass through something rail-driven — an inverter or buffer whose
*gate* is the input — before it can be written anywhere. That is a real cost at
every boundary and it is invisible until you try. `MEASURED`

**And the middle rail still cannot be built.** `T5` already established that a
divider between the supplies is contention here, so `vmid` is given rather than
generated. Every cost number in this folder inherits that. `MEASURED`

---

## What is *not* forbidden, and is worth noticing

Nothing forbids a node from being read by many gates. Fan-out is free in this
model, which is not true in silicon and will flatter every design here. `DERIVED`

Nothing forbids arbitrarily deep pass chains. There is no degradation, so a
100-deep chain resolves as cleanly as a 1-deep one — the pass-depth currency
exists precisely because the model will not complain. `MEASURED`

Nothing forbids a solve from being handed any initial state at all, including an
inconsistent one. `solve()` validates that seeded nodes exist and are not driven,
and validates nothing else. A machine whose sequencing lives in the seed is
trusting the harness completely. `MEASURED`

---

## What is missing from this list

Untested, and each would change a subsystem file if it went the other way:

- whether a **chain** of loop-broken cells can pass a value along without a
  restoring stage between them
- whether two cells sharing a write bus can be written selectively without one
  contending with the other
- whether a cell's output can drive a selector's *terminal* rather than its gate
  without degrading — everything so far drives gates
- whether the seeded-state discipline composes across a machine with thousands of
  state nodes, or whether some node's seed is always missing
