# tryte-vm

A working computer that counts in **three states instead of two** — core
arithmetic, a 25-instruction machine, an assembler, an emulator written in its own
assembly, and eight audits establishing exactly what its instruction set can reach
and what the device model beneath it rests on.

**481 checks**, all passing. Every number below is recomputed by one of them.

```bash
npm test              # everything (~55s; the monoid and switch sweeps are real work)
npm run build         # rebuild the interactive page from src/
node src/run.js programs/multiply.tasm 7 5
```

| | |
|---|---|
| **What it is** | balanced-ternary VM + assembler + self-hosting interpreter + vocabulary audits |
| **Read next** | [`FINDINGS.json`](FINDINGS.json) — every claim, machine-readable, validated by `test/test-findings.js` |
| **Before changing it** | [`AGENTS.md`](AGENTS.md) — pre-registration protocol, test standards, and the traps this repo has fallen into |
| **Where it came from** | [`docs/origin/`](docs/origin/) — append-only provenance |

---

## The machine

| | |
|---|---|
| Trit | −1, 0, +1 |
| Tryte | 6 trits — 729 values, **−364 … +364** |
| Memory | 729 cells, addressed **−364 … +364**; address 0 is the *centre* |
| Registers | `A` accumulator, `C` gate/table control, `PC` |
| Instruction | two cells: opcode, operand |
| Instructions | 25 (`src/isa.js`) |

```
src/         device.js (switch-level transistors -- the layer BELOW the arithmetic),
             ternary.js (arithmetic + gates), isa.js, vm.js, assembler.js,
             selfhost.js (run a program inside the emulated machine), run.js
programs/    demos, plus interp.tasm and interp-core.tasm — the two emulators
bench/       benchmark pairs: one task, two implementations
tools/       the eight audits, each with its registered predictions
test/        one suite per concern; run-all.js runs them all
docs/origin/ the source conversation, its audit, and its 16 code artifacts
build/       inlines src/ into docs/tryte-vm.html, and fails if they diverge
```

---

## Findings at a glance

Eight prediction sets, registered before their runs. **33 held, 2 failed** — the
failures are kept, and both produced the most useful results here. Full detail,
with registering commits and the tests that assert each one, in
[`FINDINGS.json`](FINDINGS.json).

| | claim | outcome |
|---|---|---|
| **P1–P6** | what the `TGATE` control vocabulary generates | 5 held, **P3 failed** |
| **Q1–Q5** | what `TOP` buys once the truth table is data | all held |
| **R1–R5** | what breaks the positionwise ceiling | all held |
| **S1–S4** | folding a chain of tables into one | all held |
| **U1–U3** | `TOPC`, the carry as a table | all held |
| **V1–V4** | whether the ceiling ladder has another rung | all held |
| **W1–W3** | the gates rebuilt from switches, and what they cost | all held |
| **X1–X5** | the axioms the device model rests on | 4 held, **X2 failed** |

Measured but never registered as predictions — listed separately so the
pre-registration record is not inflated by facts that were never at risk:

- **`ADD` is one particular `TOPC` table.** The machine's arithmetic is a 27-cell lookup.
- **A bug of order *k* is invisible at *k* layers** of nested emulation.
- **Folding buys a depth level**, not just instructions.
- **`MIN`/`MAX`/`NEG` are exactly Kleene's three-valued logic.**
- **Base 3 is the cheapest integer radix**, by the measure Setun was argued on.
- **Three-way branching wins about half an instruction** per decision point, and nothing when the decision is binary.
- **The standard ternary inverter is not the only four-switch `NEG`.** Exhaustive search over 148,995 networks finds four, and it is one of them.

---

## Built from switches, not asserted from the top

Everything above `src/ternary.js` is built on it. `src/device.js` is the layer
**below** it: transistors as threshold switches, nodes resolved by which rail they
can reach. `MIN`, `MAX` and `NEG` are constructed from those switches and checked
against the same functions the rest of the suite is written against.

```bash
npm run audit:device          # exhaustive: all 531,441 pairs per gate, ~90s
npm run audit:axioms          # break the axioms on purpose, see what stops working
```

| gate | switches | mid-rail taps |
|---|---|---|
| STI (= `NEG`) | 4 | 1 |
| NTI / PTI | 2 each | 0 |
| MIN / MAX | 8 each | 1 |

Six slices side by side make a six-trit datapath that matches `T.tMIN`, `T.tMAX`
and `T.neg` **exhaustively**, and gates compose without degrading.

### The axioms underneath

A switch model is only worth what its assumptions are worth, so `src/device.js`
states them — six about a single switch, eight about how a network resolves, four
theorems a circuit may then rely on — and `test/test-axioms.js` proves every one
of them exhaustively. It also parses the ids out of `device.js` and checks them
against the ids proved, in both directions, so the two lists cannot drift apart.

Then it breaks the solver three ways and requires the *right* proofs to notice:

| defect | axioms that catch it |
|---|---|
| thresholds made strict | D3 N2 N6 N7 N8 T1 T2 T3 T4 |
| unknown conduction treated as off | D6 N7 N8 |
| reachability runs through rails | N2 T3 |

Two of those three are defects this model actually had. The expected sets are
pinned because *which* axioms a defect trips is the part worth knowing — a proof
that fails for everything is not telling you what it caught.

**One axiom was false as written, and the audit is what found it.** N7 claimed
that resolution cannot oscillate, full stop. It cannot *from the default start*,
where any node with a non-driven gate goes unresolved on the first pass and stays
there. Seeded at a level, a ternary inverter wired to its own input runs
−1 → +1 → −1 forever, and the solver throws rather than hand back a half-settled
answer. The same experiment showed the fixed point is not unique: that inverter
also sits happily at 0, which is fully determined and fully consistent — the
solver simply will not invent it. So the starting state is part of the semantics,
and `solve()` takes one.

**This is switch-level, not SPICE**, and the header of `src/device.js` lists what
that means it assumes away. The largest by far: **the middle rail is free here.**
Real ternary logic must *generate* its mid level — dividers that burn static
power, or dual supplies — so switch counts report mid-rail taps in a separate
column. A comparison that folds that in is not a comparison.

Which is why the cost result is reported the way it is:

| at equal representable range | switches | mid-rail taps | rails |
|---|---|---|---|
| ternary `MIN`, 6 trits (729 values) | **48** | 6 | 3 |
| binary `AND`, 10 bits (1024 values) | 60 | 0 | 2 |

The raw ratio is **0.80 — it favours ternary**, and that was predicted along with
the prediction that it should not be believed. Six trits carry what ten bits do,
so the ternary side gets fewer, wider slices; but it also taps a rail this model
hands out free. Separately, the radix-economy bar computed earlier was **3.08×
per digit** — a different currency from switches per gate, and not settled by it.

## The idea, without the jargon

A normal computer digit is a light switch: **off or on**. To write a negative
number you sacrifice one switch to mean "this whole thing is negative", then bolt
on machinery to handle it.

A balanced ternary digit — a **trit** — is a **balance scale**. It tips left, sits
level, or tips right: **−1, 0, +1**. Weights go on *either* pan, so negative
numbers are not a special case.

Four things fall out, and all four are asserted as tests:

| property | what it means |
|---|---|
| **Negation is flipping every digit** | −5 from 5 by tipping every scale. No two's complement. |
| **There is no sign bit** | `5` is `000+--`, `−5` is `000-++` — an exact mirror. |
| **Subtraction is not separate** | `a − b` is `a + (−b)`, and negation is free. |
| **Rounding is free** | chopping low digits lands on the *nearest* value. |

That last one is load-bearing, not decorative. `programs/multiply.tasm` extracts
one trit at a time with `v − 3 × (v ≫ 1)`, which only works because the shift
rounds — break the rounding and the multiply demo fails.

### The instruction with no binary equivalent

Every ordinary CPU compares two numbers and gets one bit back. Asking "negative,
zero, or positive?" therefore takes two tests. This machine has **`BR3`** — one
test, **three destinations**:

```
        BR3   sgn          ; look at the accumulator once
sgn:    .table neg, zero, pos
```

No flags register, no chain of compares. Tested against all 729 possible
accumulator values.

---

## It emulates itself, three deep

`programs/interp.tasm` is a tryte VM written in this assembly, running on this
machine. Same source, same inputs, **same output** — asserted for all 25 opcodes
and every demo program, not just demonstrated.

```bash
npm run selfhost
```

Two interpreters exist, and the split is a measured decision rather than an
oversight:

| | full | core |
|---|---|---|
| Opcodes | 25 | 16 |
| Size | 358 cells | **224** |
| Stacks | 2 deep | **3 deep** |
| Carries (`TOPC`) | yes | no |

The core implements exactly the 16 opcodes it needs to interpret **itself** —
**closed under self-interpretation**, which is the property that lets a copy run
inside a copy. The suite verifies that closure by reading the core's own jump
table, not by trusting the comment.

```
threeway.tasm, native         58 instructions
              1 interpreter    1,568   (27×)
              2 interpreters  41,874   (722×)
              3 interpreters 1,118,514 (19,285×)   identical output
```

**Coverage and depth are one budget.** Adding an opcode to the core costs about
16 cells, and the depth-4 window is 729 − 3×(core size) — so each opcode costs
roughly 48 cells of innermost memory. At 729 cells total you can have complete
coverage or maximum depth, not both. `TOPC` is in the full interpreter only,
because putting it in the core would leave a depth-4 window of 9 cells.

### A bug of order *k* is invisible at *k* layers

Found by mutation testing, kept as a property test. An interpreter bug that
permutes the emulated semantics has an **order** — how many applications return it
to the identity. Stacking *n* interpreters applies it *n* times, so it vanishes
whenever its order divides *n*:

| | 1 layer | 2 layers | 3 layers |
|---|---|---|---|
| Swap two branch arms (order 2) | caught | **masked** | caught |
| Rotate all three (order 3) | caught | caught | **masked** |

**No single depth is a safe place to test.** The acceptance tests compare every
depth, and the table above is itself a test.

---

## The gates are three-valued logic, exactly

Read the three states as truth values — **−1 = false, 0 = unknown, +1 = true** —
and `MIN`, `MAX` and `NEG` stop being *analogies* for AND, OR and NOT. They **are**
the connectives of Kleene's strong three-valued logic, on all twelve rows. That is
the logic SQL uses for `NULL`.

```bash
npm run logic
node src/run.js programs/kleene.tasm 0 1
```

The tests that carry the claim are the ones that **fail** classically: `a OR NOT a`
comes back **unknown**, so the excluded middle breaks, and so does
non-contradiction. Had they held, this would be binary logic with a spare state.
De Morgan, double negation, absorption and associativity all survive.

*A precision:* for these three connectives Kleene's K3 and Łukasiewicz's Ł3 are
identical, diverging only at implication, which this machine has no operator for.

**And why base three at all?** The historical argument for Setun, checked:
representing a million values costs **40** in base 2, **39** in base 3, **40** in
base 4. Base 3 wins because the continuous optimum is *e*.

---

## The vocabulary ladder

The central result, and the reason the audits exist. The source conversation
claimed that cascading two `TGATE` stages gives **"531,441 unique cascading logic
networks."** Measuring that properly took six audits and produced a ladder — where
**every rung is a fact about the vocabulary, not about the machine.**

A vocabulary of *k* tables on *N* points generates a **monoid** under composition,
and chaining stages, however many, cannot leave it. So the question is never how
many configurations exist but how many **elements** the vocabulary reaches.

| vocabulary | reach | |
|---|---|---|
| `TGATE`, all 729 controls | **77,687** at width 6 | closed |
| any positionwise vocabulary | **27^w** | closed — `TOP` sits exactly on it |
| positionwise + **one** carry (`ADD`) | **251,505** at width 2 | closed |
| positionwise + **arbitrary** carries (`TOPC`) | **531,441** | closed |
| every map on 9 points | 387,420,489 | — |

**531,441 = 729² counted configurations of two stages. 77,687 is every function
reachable by any number of stages.** The claim overstates by **6.84×**, and
cascading past two stages adds nothing at all.

### More tables do not mean more reach

The lesson that recurs at every rung:

- 19,683 `TOP` tables, second operand pinned, collapse to **27** maps.
- 27 extra positionwise generators buy **+0** elements.
- One shift buys **+72**. One *carry* buys **+250,776**.

**Not all coupling is equal**, and that part was not predicted: both `ADD` and
`SHL` touch other positions, but the carry buys **3,483×** what the shift does. A
shift is a fixed relabelling; a carry is **data-dependent**. Coupling has to be
conditional to generate.

### The prediction that failed

**P3** predicted the reach would be the full direct product, 7^w. It is 47 not 49,
307 not 343. One composition step applies *one* control across *all* trit
positions, so after *d* steps every position carries a word of length exactly *d* —
the positions must agree on word **length**, which is strictly weaker:

> reach(w) = │ ⋃_d (M_d)^w │

Labelled post-hoc throughout, validated on five widths before being used at the
sixth. **Q3 later explained the failure**: `TOP` *can* express the identity as a
column, so positions idle while others advance — dissolving exactly the constraint
that bound `TGATE`, which has no identity mode.

### The instrument lied first

The last audit initially reported **V3 failed**. It had not: at depth 16 the
sampled vocabulary was still *growing* while the comparison vocabulary had already
*closed*, so a smaller number was read as a smaller reach. Running out of depth,
hitting the cap, and closing are three different outcomes; the auditor now reports
them separately, and a test asserts all three stay distinguishable.

### A coincidence, flagged as one

The ladder's top rung is **531,441** — numerically the exact figure the source
conversation claimed. It is a coincidence: that figure was 729² counting two-stage
configurations of 6-trit trytes; this is 9⁶ counting elements of a monoid on 9
points. Both are 3¹² for unrelated reasons, and the conversation's claim about
what it counted remains wrong.

---

## Routing: folding a chain into one table

Closure is a licence to **fold**. If the composite of two `TOP`s is again a `TOP`,
a chain collapses at build time into a single table:

> **T3[a][b] = T2[ T1[a][b] ][b]**

Column-wise composition — and the formula never mentions the second operand, so one
fold serves every input. It is a **language feature**, not a tool-only trick:

```
allT:   .fold minT, negT, maxT, negT     ; nine cells, composed at build time
```

A fold may name tables declared after it, or another fold. `programs/fold.tasm`
computes the same chain both ways and emits both results, so the program checks
the fold against itself.

| four-stage chain | unfolded | folded |
|---|---|---|
| Cells | 93 | **25** |
| Instructions, native | 27 | **7** |
| At emulation depth 4 | refused — too big | **runs** |

**Folding buys a depth level, not just instructions**, and the saving multiplies
by ~27× per level of emulation — it is worth most exactly where execution is
dearest.

**Foldability is a property `TOP` has and `TGATE` does not.** `TGATE`'s three modes
generate a seven-element per-trit monoid, so six of its eight two-stage composites
are not any `TGATE` mode; a `TGATE` chain has nothing to fold into.

**And the fold stops at a carry** — insert one `ADD` and the folded table stops
agreeing, because the chain is no longer positionwise. The optimisation's boundary
is exactly the boundary the carry audit found by counting.

---

## Is the ternary part actually worth it?

Every other suite checks that ternary is *correct*. `npm run bench` checks whether
it is *worth it* — comparing **three-way against two-way dispatch on the same
machine**, since a two-way branch is `BR3` with two arms merged. The two-way
baseline pays no store/reload tax, because `BR3` leaves the accumulator untouched;
a baseline the reader could improve would make the exercise worthless.

| | three-way | two-way | |
|---|---|---|---|
| Classify one value | 21 cells, 5.50 steps | 26 cells, 6.00 steps | 19% smaller |
| Six in a loop | 41 cells, 68.0 steps | 46 cells, 71.0 steps | 4.2% fewer steps |
| A genuinely binary decision | — | — | **identical; no benefit exists** |
| Deep dispatch (27 ways) | 149 cells | 30 cells (indexed jump) | **three-way loses** |

**A real win, and a modest one:** about half an instruction and a fifth of the code
per decision point, and only where the decision genuinely has three outcomes. When
the dispatch gets deep, the elegant `BR3` tree loses decisively to a boring indexed
jump table.

---

## Where this came from

This project is the unfinished half of a Google AI Mode conversation, preserved in
[`docs/origin/`](docs/origin/). That conversation designed a "tryte ALU" and
offered three separate times to *"implement balanced ternary arithmetic, treating
trits as numerical values"* — and never did. Every artifact it produced was
ordinary binary logic wearing ternary vocabulary; its own Verilog encoded the
"trit" as two binary wires.

`docs/origin/REPORT.md` is the audit of that conversation: every piece of its logic
is correct, and its framing oversells a conventional ALU.

The audits since have sharpened the verdict into something more interesting than
"it was wrong". **`TGATE` and `TOP` are bounded by 27^w however many tables they
carry. What makes this a general computer is `ADD`, `SUB`, `SHL` and `SHR` — the
arithmetic, not the gates.** The conversation spent its entire length on the gates
and skipped the arithmetic three times.

**Prior art:** *Setun*, built in 1958 at Moscow State University under Sergei
Sobolev and Nikolay Brusentsov, was the first modern ternary computer and used
this same balanced system. Around 50 were built between 1959 and 1965 from ferrite
cores and diodes, and used for teaching at more than thirty universities. This
emulator is inspired by that lineage, not a reimplementation of it.

---

## Testing standard

The short version: exhaustive where possible, mutation-tested, constants derived
rather than hardcoded, and the manifest validated against the repository. Full
conventions and the list of traps this codebase has actually fallen into are in
[`AGENTS.md`](AGENTS.md).

Three checks are worth naming here because they are unusual:

- **`test-findings.js`** validates `FINDINGS.json` against the repo — recomputing
  the cheap numbers, verifying each registering commit really precedes its results
  commit, and confirming every prediction id appears in the test that asserts it.
- **`build-artifact.js`** re-runs the demo programs through the *bundled* copy of
  `src/` and fails the build on any divergence, so the published page cannot drift
  from the tested code.
- **`test-style.js`** computes WCAG contrast for every colour pair in both themes,
  because three real defects shipped past visual inspection.
