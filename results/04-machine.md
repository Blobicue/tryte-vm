<!-- kind: results-topic -->
# 04 — Headroom, terminals, addressed memory, interconnect

**Owned sets:** `H` `B` `C` `A` `T`

Cross-references `J`/`K`/`L` (the cells this is built from), `E` (the read path's
alternative), `N` (which prices it), `X` (the axioms that keep biting).

This is the machine, as far as it goes. **The two findings that emerged from building
it are not about ternary at all — they are about control**, and they are what sets
`D`, `M` and `O` were later built on.

---

## What is established

### 1. The model can run a machine, and cannot sweep one

The solver is **linear** in devices × passes — measured exponent 0.92 across 8 to
50,000 devices — and 50,000 devices solve in about **70 ms** (`H1`, `H2`). `MEASURED`

`H1` is recorded FAILED, instructively: both numeric criteria missed, and its spread
threshold measured **3.72 on one run and 2.89 on the next** — either side of its own
line. *The same world produced both a pass and a fail.* A defect in the prediction
rather than a fact about the subject, and the origin of the noise-floor defect class.

The consequence is the important half. **A full 531,441-pair sweep fits inside an
hour only up to roughly 4,806 devices**, and a machine is larger than that:

> The machine can be **run** and cannot be **swept** — the first subject in this
> project to sit outside the exhaustive discipline every other result rests on.

That boundary is collected in [`08-limits.md`](08-limits.md) and forced the
verification-contract language in [`../METHOD.md`](../METHOD.md).

**Charge retention changes nothing in the existing corpus** (`H3`): one rule — an
isolated node keeps its previous value instead of floating — and across every gate,
every input and the adder swept, **221,938 node values compared, zero differences.**
It also takes a trit cell from 11 switches to **1**, and a 729-word memory from
48,114 to 4,374 (`H4`) — *eleven times, against the five the design phase estimated.*
That is measured; whether to allow it is a person's decision, because it changes what
the model **is**.

### 2. A stored value can drive a selector's source — with a condition

Everything before `B` fed a selector's **gate**. Interconnect, the read path and the
whole address path need a stored trit on a **source terminal**, which is a different
thing in this model.

**It works** (`B1b`): all 81 stored patterns read back correctly through both
selector families, and **reading disturbs nothing at any pass of the solve**, nor on
a second consecutive read (`B2`). `MEASURED`

But the families are **not interchangeable** (`B1a`). The decoded selector gates its
middle arm on a *computed* detector output, unknown on pass one — so the selected word
gets bridged to a second word's rail and **the network never settles** on two of the
three addresses. The tree selector gates every arm on the select **input**, known at
pass one, and is immune by construction. The asymmetry was derived from the solver
*before* the run and the measurement matched it, middle address included.

**Decision: the read path is built from the tree family**, paying 4 switches instead
of 3 to remove a failure mode nothing would catch.

`B3` confirmed the cost model exactly — a 27-way one-trit read mux builds to the
predicted 39 switches. And `B4` settled an open design question by **counting**: a
27-way mux has 13 internal nodes and a write path needs 27 one-hot selects, so the
decoder **cannot** collapse into the read mux. They share 2.3%, not the half that had
been hoped for — **which decides 243 words as out of reach for good.**

### 3. There is an addressed memory, and it does not start on its own

27 words of six trits, **2,301 switches**: decoder, complement plane, buffered write
data, 162 cells and a read tree. A write **lands in its word and disturbs none of the
other 26** — checked at every pass, not only at the end — and write-then-read round
trips work for every word tried (`C3`, `C4`). **The first round trip through an
address in this project.** `MEASURED`

`C1` predicted the address-path formula was wrong **three ways at once** and derived
519 against its 603. Built: **519**, exactly.

| | old formula | built |
|---|---|---|
| decoder | 129 | **105** |
| read tree | 312 | 312 |
| write path | 162 | **102** |
| **address path** | **603** | **519** |

It charged one selector per output *line* where a node makes three; it charged a bare
routing tree, which is not a decoder; and it charged a per-cell write switch the
measured cell already contains. Against that it omitted the complement plane and the
data buffers. **The overcounts win, so the target machine got cheaper.**

**Two things the plan did not have on it:**

**A bare routing tree is not a decoder, and it fails silently and totally** (`C2`).
With route-in arms only, an unselected select line floats; a floating write-enable is
unknown conduction, which poisons the cell it gates. **Not one write landed and 104
words were corrupted across four attempts.** Four pull-downs per node fix it — and
*two of the four are for "not middle" alone*, because that is two thresholds where
"not low" and "not high" are one each. The middle level charges again.

**And the array does not start.** Every word's hold gate is a decoder output — a
*computed* node, unknown on pass one — so **all 26 unaddressed words go to unknown on
every write.** The cells hold perfectly when that gate is a primary input and not at
all when it is a decoder output: *same circuit, different reachability.*

> That is `B1a` one layer up and much larger. The fix is to solve the control cone on
> its own and seed it — which makes the seeding discipline a **requirement of the
> design** rather than a risk to it, and it scales with control fan-out rather than
> with anything the budget counts.

`C5` is the completeness check the roadmap said should exist *before* the array:
1,225 state nodes, none unseeded, and a withheld seed stays visible.

### 4. Interconnect: the crossover is on the axis nobody was watching

Two documents predicted the selector-tree fabric would win at this machine's size.
**Both were wrong, and wrong about which variable matters** (`A1`).

A tree costs one copy **per destination**, growing as destinations × sources. A bus
costs one switch per source plus one decoder, growing as **sources alone**.

| | tree | bus | |
|---|---|---|---|
| 4 sources, 3 destinations | 234 | **62** | bus, 3.8× |
| 3 sources, 1 destination | **30** | 31 | tree — its only win |

The tree wins in **one corner of the entire surface**. `MEASURED`

What the tree buys is not the absence of a shared node — a selector's output *is*
shared between its arms. It is that **every arm is gated by the same select trit, and
one trit cannot hold two values**, so exclusion is *structural*. A bus needs several
separate enables to be one-hot: an **invariant something must uphold every step**
(`A3`).

The bus's two failure modes were **produced rather than asserted**: two enables give
unknown on the bus, no enable leaves it floating and poisons whatever reads it. And
one detail nobody predicted — **the bus goes unknown only on the trits where the two
sources disagree**, so a double-enable fault is *invisible* when they hold equal
values.

**`A4` deliberately deferred the pick**, registered in advance so deferring reads as a
result rather than an omission: the bus is cheaper and costs a second control cone
solved and seeded every step, and whether that is affordable is a *sequencing*
question with sequencing unbuilt.

### 5. Instruction decode, and the free version of `C5` killed

The design folder called one option the interesting one: **could the ISA be
renumbered so decode vanishes?** It is the only option there that changes something
outside the device layer, and nobody had costed it.

First, ground truth. The control table is a **design**, not a measurement — no
datapath consumes control lines yet — so what is checkable is **sufficiency**: an
interpreter driven only by control words, never seeing an opcode, reproduces
`src/vm.js` state for state across **566 steps of all eight programs** (`T1`).
`MEASURED`

Then the arithmetic. The control word is **11 trits wide and injective** — 25
distinct words for 25 opcodes, carrying exactly the opcode's information spread
eleven trits wide instead of three (`T2`). The opcode needs 3 trits and its cell
holds 6, so **three are spare** — and **11 does not fit in 6.**

> **The free version of `C5` is dead.** Decode cannot be made to vanish by widening
> the opcode into its own cell's spare trits.

And no field can be a direct slice of a three-trit opcode (`T3`). A field of width
`w` fits only if its largest class is at most `3^(3−w)`; the class sizes are 16/5/4,
14/11, 23/2, 23/2, 7/6/2, 16/7/2, 22/2/1 and 22/1/1/1, and **none fits**.

What the spare trits *do* buy is `T4`, and the prediction there **failed by exactly
one trit**: the best jointly direct-encodable subset is **five** trits, not six, and
is **not** jointly injective. Six trits of capacity exist, but the fields are chunky
and no combination summing to six separates all 25 opcodes. So **five of eleven
control trits become free** and decode falls from 572 switches to 312 — a **45%**
saving at zero memory cost, rather than the 55% predicted.

### 6. The failed prediction that separated control from data

`A2` predicted a tree fed by a **computed** source inherits the bus's cold-start
precondition. **It does not** — 4 of 4 routed. A computed *data* node is rail-driven
through whatever produced it and resolves; what poisons a network is an unresolved
*control* node.

So the distinction is **control versus data**, not computed versus given — which is
why the defect class is named after control. The boundary had been registered
explicitly *so it could be wrong*, and being wrong is what produced the distinction
`D`, `M` and `O` then built on.

---

## How it was established

| | |
|---|---|
| tools | [`headroom-audit.js`](../tools/headroom-audit.js), [`terminal-audit.js`](../tools/terminal-audit.js), [`memory-audit.js`](../tools/memory-audit.js), [`interconnect-audit.js`](../tools/interconnect-audit.js) |
| tests | `test-headroom.js`, `test-terminal.js`, `test-memory.js`, `test-interconnect.js` |
| sweeps | 27-way trees over stored cells; 135 writes across all 27 words with trajectory inspection; 108 round trips; cost surfaces at three source and three destination counts |

---

## What it does not show

- **The machine is not assembled.** Decode, sequencing and whole-machine assembly do
  not exist. What exists is a memory, an accumulator, and both interconnect options
  measured.
- **The memory is 27 words, and 27 words runs none of the eight programs.** The one
  configuration that both fits the sweep budget and runs an existing program is 81
  words under charge retention — which requires the model change.
- **`H2`'s 4,806 is a budget of solves, not a verification contract.** No machine is
  exhaustive over its own state space, and what the budget is spent on has to be
  chosen and stated.
- **`A4` is a scope commitment, not a falsifiable claim about a circuit** — the only
  such prediction in the corpus, and flagged in the ledger so it does not become a
  template.
- **The tree-versus-bus ledger's "no precondition" is true of the rig, not of the
  machine**: in an assembled machine the tree's selects come from instruction decode,
  itself computed. The real comparison is **one** control cone against **two**.
- All costs inherit the model's four limits — see [`00-model.md`](00-model.md).

---

## Owned sets

| set | subject | outcome |
|---|---|---|
| `H` | whether the model can carry a machine, and what retention would cost | 3 held, `H1` failed |
| `B` | can a stored value drive a selector source terminal? | all held |
| `C` | a 27-word addressed memory, and three errors in the budget | all held |
| `A` | interconnect: tree against bus, and which axis decides | 3 held, `A2` failed |
| `T` | the control word, and whether decode can disappear | 3 held, `T4` failed |

Full text in [`99-ledger.md`](99-ledger.md).
