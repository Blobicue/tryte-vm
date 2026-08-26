<!-- kind: results-topic -->
# 03 — Storage, registers, and a circuit that computes and remembers

**Owned sets:** `J` `K` `L`

Cross-references `X` (the axioms that forbade three of four storage designs), `E`
(the adder it wraps), `C` (the memory built from these cells), `H` (what retention
would do to them).

Everything before this computes and forgets. **This is where state arrives — and
where three axioms that had sat inert through every combinational phase suddenly
forbade the first thing storage needed.**

---

## What is established

### 1. A trit can be stored, and three of the four obvious ways are forbidden

Not by argument — by the axioms, each proved earlier and none of which had
constrained anything until now:

| approach | outcome |
|---|---|
| cross-coupled pair, cold start | goes unresolved — a feedback loop from cold lands on unknown |
| write from a primary input | **forbidden**: an input gates but never sources |
| write by overpowering the loop | **forbidden**: this model has no drive strength, so a contended node is *unknown*, not "whichever side is stronger" |
| **open the feedback loop while writing** | works |

Six loop-breaking cells under one enable hold a tryte **exhaustively** — all 729
written, all 729 held, zero wrong (`J1`). `MEASURED`

That was registered as at risk for a specific reason: **six feedback loops settle
inside one solve, and nothing in this project had ever solved a network with more
than one loop.** The axiom governing loops had already surfaced consequences twice
that appeared only once state arrived. It did not this time.

**Cost: 114 switches built for test, 66 in place** (`J2`). The 48-switch difference is
six input buffers, mandatory at any boundary with a primary input. *Enable fan-out is
free in this model and is the largest thing these numbers hide.*

**And it does not leak** (`J3`): with hold asserted and write enable low, sweeping the
data across the range over 11,025 solves moves the stored tryte **not at all**.
Strides are stated in the output rather than quietly chosen.

### 2. The prediction that was wrong in the most useful direction

`J4` predicted that a read in the same solve as a write sees the **old** value. Over
334 cases it saw the **new** one — 334 times, cleanly, in the opposite direction.

The mechanism is exact and obvious afterwards: **while the write enable is asserted
the feedback loop is held open — that is the whole trick that makes the write
possible — so the cell is driven straight from its input and the seeded value has
nothing holding it.**

So it is a **transparent latch, not a flip-flop**, the register file doubles, and the
next phase was forced. `MEASURED`

### 3. Master-slave, and the discipline shown load-bearing by breaking it

A master-slave pair on opposite phases **reads the old value while writing the new** —
626 cases, 626 correct, zero seeing the new value (`K1`). Not automatic that the
textbook answer would survive this model, given three of four ways to build the single
cell were forbidden. `MEASURED`

**Cost: 180 built for test, 132 in place** (`K2`) — *exactly double the single latch
and nothing more*. The slave needs no input buffer because its input is the master's
output, already rail-driven. The design phase had estimated ~228.

A full two-phase step moves the value through **exactly once**, over all 729 trytes,
with idle phases holding (`K3`).

And then the part that makes it a result rather than an assumption: **asserting both
phases at once degenerates the structure to precisely the transparent latch `J4`
measured** — 127 cases, all seeing the new value (`K4`).

> So two-phase **non-overlapping** clocking is *load-bearing here rather than
> conventional*, and the failure it exists to prevent was **produced deliberately**
> instead of asserted.

### 4. A circuit that computes and remembers

Wire the decoded adder to a master-slave register and one two-phase step performs
`A ← A + B`. Over all 729 accumulator values × 9 addends — **6,561 steps, zero wrong
sums** (`L1`).

The sum being right is the lesser half. **The register is read by the adder while the
adder is computing the register's next value, and on none of the 6,561 steps did it
stop reading the OLD accumulator.** That is `K1`'s property under load, and the whole
reason `J4`'s failure mattered.

**672 switches** (`L2`): 540 adder plus 132 register, and **nothing between them** —
no buffer, because the sum is already rail-driven, which is the one place the
sourcing axiom does not charge. The addend needs none either, since it only ever
gates selectors.

Ten successive additions accumulate to −79, matching the reference at every step and
wrapping correctly where the running total leaves the tryte range (`L4`). **The first
computation in this repository carried out by simulated transistors holding their own
state between steps.** `MEASURED`

### 5. The first cost that belongs to the computation rather than the structure

The accumulator's phase-A settling takes **10 to 14 passes depending on the data**
(`L3`), inherited from the decoded adder's 9–13 (`E4`).

> **A machine built on this design has no fixed clock period.**

Every earlier cost here was a property of the circuit. This one is a property of what
the circuit is being asked to compute. `MEASURED`

---

## How it was established

| | |
|---|---|
| tools | [`register-audit.js`](../tools/register-audit.js), [`msregister-audit.js`](../tools/msregister-audit.js), [`accumulator-audit.js`](../tools/accumulator-audit.js) |
| tests | `test-register.js`, `test-msregister.js`, `test-accumulator.js` |
| sweeps | all 729 trytes written and held; 11,025 leak solves; 6,561 accumulator steps |

Every solve seeds every state node explicitly. That discipline is cheap at six cells
and became a **requirement of the design** at 162 — see
[`04-machine.md`](04-machine.md).

---

## What it does not show

- **Enable fan-out is free in this model.** One enable drives six cells at no cost,
  and that is the largest thing the 66 and 132 figures hide.
- **The clock is not built.** These are two-phase circuits driven by a harness that
  chooses the phases. Whether a sequencer can be made of switches is unbuilt.
- **`K4` shows the non-overlap discipline is load-bearing; it does not show it is
  achievable** in a machine where the phases come from somewhere other than a test
  harness.
- **All costs inherit the model's four limits** — see [`00-model.md`](00-model.md).
  The accumulator's 672 switches carry 210 mid-rail taps.
- **Charge retention would change every number here**, taking a cell from 11 switches
  to 1. That is measured (`H4`) and is a person's decision, not this file's.

---

## Owned sets

| set | subject | outcome |
|---|---|---|
| `J` | a six-trit register — the first sequential circuit here | 3 held, `J4` failed |
| `K` | the master-slave register `J4` established was required | all held |
| `L` | an accumulator — the first circuit that computes *and* remembers | all held |

Full text in [`99-ledger.md`](99-ledger.md).
