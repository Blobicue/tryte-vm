# tryte-vm

**This repository is two things.**

**A working computer that counts in three states instead of two** — core
arithmetic, a 25-instruction machine, an assembler, an emulator written in its own
assembly, transistors underneath it, and thirty audits establishing exactly what
its instruction set can reach and what the device model beneath it rests on.

**And a record of how it was found out about.** Every claim here was registered
before it was measured, in its own commit, and every failed prediction was kept.
One hundred and twenty-nine predictions, one hundred and twelve held, seventeen failed —
and the twelve produced more than the hundred and four. That loop is written up separately in
[`METHOD.md`](METHOD.md), for anyone who wants to run it on something else.

**1,089 checks**, all passing. Every number below is recomputed by one of them,
including the numbers in `METHOD.md` about the method itself.

```bash
npm test              # everything (~2 min; the monoid and switch sweeps are real work)
npm run build         # rebuild the interactive page from src/
node src/run.js programs/multiply.tasm 7 5
```

| | |
|---|---|
| **What it is** | balanced-ternary VM + assembler + self-hosting interpreter + switch-level device layer + thirty audits |
| **How it was found** | [`METHOD.md`](METHOD.md) — the discovery loop, its failure catalogue, and what parallelises |
| **What was found** | [`results/`](results/) — every result keyed by subject, with a generated ledger of every prediction |
| **What is not built** | [`design/`](design/) — interconnect, decode and sequencing, enumerated before anything is chosen, and [`design/12-roadmap.md`](design/12-roadmap.md) for the order to build them in |
| **What is known** | [`.claude/knowledge/doctrees/tryte-vm/`](.claude/knowledge/doctrees/tryte-vm/) — 13 pillars, each declaring how well mapped it is |
| **Every claim** | [`FINDINGS.json`](FINDINGS.json) — machine-readable, validated by `test/test-findings.js` |
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
design/      the design phase for the machine that does not exist yet
results/     the same corpus keyed by SUBJECT rather than by date, plus 99-ledger.md
tools/       the thirty audits, each with its registered predictions
test/        one suite per concern; run-all.js runs them all
docs/origin/ the source conversation, its audit, and its 16 code artifacts
build/       inlines src/ into docs/tryte-vm.html, and fails if they diverge
```

---

## Findings at a glance

Thirty prediction sets, registered before their runs. **112 held, 17 failed** — the
failures are kept, and four of them produced the result that replaced them.
Full detail,
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
| **Y1–Y5** | the carry cell and the adder, built from switches | all held |
| **Z1–Z5** | pricing the free mid rail and the missing restoration | 4 held, **Z2 failed** |
| **E1–E5** | the decoded-selector adder | 3 held, **E4 and E5 failed** |
| **F1–F4** | deriving the decoded adder's pass count | all held |
| **G1–G4** | whether the same number twice meant anything | all held |
| **H1–H4** | whether the model can carry a machine, and what retention costs | 3 held, **H1 failed** |
| **I1–I4** | whether four switches is minimal for the MID detector | all held |
| **J1–J4** | a six-trit register, the first sequential circuit here | 3 held, **J4 failed** |
| **K1–K4** | the master-slave register J4 said was required | all held |
| **L1–L4** | an accumulator: the first circuit here that computes *and* remembers | all held |
| **B1a–B4** | can a stored value drive a selector *source*, not just its gate? | all held |
| **C1–C5** | 27 words, addressed: a decoder, a write path, and a round trip | all held |
| **A1–A4** | interconnect: `I0` against `I2`, and which axis decides it | 3 held, **A2 failed** |
| **D1–D4** | which self-referencing ternary maps mix at all — a hashing question | 2 held, **D3 and D4 failed** |
| **M0–M3** | reversible universality: ternary at two operands, binary at none | all held |
| **O1–O4** | what that advantage is worth in switches — and where it comes from | all held |
| **N1–N4** | pricing the free mid rail, the model's own largest assumption | 3 held, **N1 failed** |
| **T1–T4** | the control word, and whether instruction decode can disappear | 3 held, **T4 failed** |
| **AA1–AA4** | sequencing: can the step boundary live inside the circuit? | all held |
| **AB1–AB5** | erasure: what the machine destroys, and whether the price is in the object | 3 held, **AB4 and AB5 failed** |
| **AC1–AC4** | can a program's cost be learned without paying it? | 1 held, **AC1, AC3 and AC4 failed** |
| **AD1–AD4** | a loop bound the program discovers, and whether that is enough | all held |

Measured but never registered as predictions — listed separately so the
pre-registration record is not inflated by facts that were never at risk:

- **`ADD` is one particular `TOPC` table.** The machine's arithmetic is a 27-cell lookup.
- **A bug of order *k* is invisible at *k* layers** of nested emulation.
- **Folding buys a depth level**, not just instructions.
- **`MIN`/`MAX`/`NEG` are exactly Kleene's three-valued logic.**
- **Base 3 is the cheapest integer radix**, by the measure Setun was argued on.
- **Three-way branching wins about half an instruction** per decision point, and nothing when the decision is binary.
- **The standard ternary inverter is not the only four-switch `NEG`.** Exhaustive search over 148,995 networks finds four, and it is one of them.
- **An input gates but never sources.** A conducting switch between an input and a node transfers nothing; reachability starts at rails and only at rails.

---

## Built from switches, not asserted from the top

Everything above `src/ternary.js` is built on it. `src/device.js` is the layer
**below** it: transistors as threshold switches, nodes resolved by which rail they
can reach. `MIN`, `MAX` and `NEG` are constructed from those switches and checked
against the same functions the rest of the suite is written against.

```bash
npm run audit:device          # exhaustive: all 531,441 pairs per gate, ~90s
npm run audit:axioms          # break the axioms on purpose, see what stops working
npm run audit:adder           # every operand pair, both adder variants, ~32 min
npm run audit:midrail         # price the free mid rail and the missing restoration
npm run audit:decoded         # the decoded-selector adder, every operand pair, ~35 min
npm run audit:passcount       # derive 128/243 from the carry table, ~30 min
npm run audit:collision       # is the same six-digit number twice a coincidence?
npm run audit:headroom        # can the model carry a machine, and what would charge retention cost?
npm run audit:detector        # is four switches minimal for the thing paid eighteen times?
npm run audit:register        # six trits, held: the first sequential circuit here
npm run audit:msregister      # the master-slave register J4 said was required
npm run audit:accumulator     # A <- A + B: the first thing here that computes AND remembers
npm run audit:terminal        # can a stored value drive a selector SOURCE? the phase-0 gate
npm run audit:memory          # 27 words, addressed: write one, disturb none, read it back
npm run audit:interconnect    # I0 against I2, and where they actually cross
npm run audit:iterhash        # which self-referencing ternary maps mix, and which cannot
npm run audit:reversible      # how many operands ternary needs for reversible universality
npm run audit:nonlinearity    # what a born-nonlinear conditional actually costs
npm run audit:midprice        # how much of this project rests on the free mid rail
npm run audit:decode          # the control word, and whether decode can disappear
npm run audit:sequencer       # can the step boundary live inside the circuit?
npm run budget                # what the machine costs, parametric in how much memory
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
| reachability runs through rails | N2 N7 T3 |

Two of those three are defects this model actually had. The expected sets are
pinned because *which* axioms a defect trips is the part worth knowing — a proof
that fails for everything is not telling you what it caught.

**One axiom was false as written, and the audit is what found it.** N7 claimed
that resolution cannot oscillate, full stop. It cannot *from the default start*,
because nodes firm up in gate-dependency order — a node may sit at unresolved for
a pass and take a level on the next — and a node on a gate *cycle* never gets a
determined gate at all, so it lands on unresolved and stays. Seeded at a level,
a ternary inverter wired to its own input runs
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

### The carry, in switches

The vocabulary audits ended by making the truth table *data*: `TOPC` reads a
27-cell table and addition falls out of it. This is that same sentence one layer
down. The 27 cells become a tree of 1-of-3 selectors — nine leaves chosen by the
carry-in, three by one operand, one by the other — and the tree is a full-adder
cell. Nobody designed the circuit; the table did.

```bash
npm run audit:adder           # every operand pair, both circuit variants, ~32 min
```

| | switches | mid-rail taps |
|---|---|---|
| one full-adder cell | 104 | 28 |
| six-trit ripple adder | 624 | 168 |
| the same, sharing identical leaves | **384** | 72 |

Sharing is the hash-consing `tableKey` already does to tables, applied to the
circuit instead: leaf selectors whose three cells agree become one selector. The
sum tree's leaves depend only on `a + b`, so nine collapse to **three**; the carry
tree's to five. That is a 38% saving, and it is not free of risk — a shared leaf
ties two mid-level selectors to a single node, so the shared circuit contains
conducting paths between them that the tree did not have. Registered as the
prediction most likely to fail (Y3).

**Ripple delay is invisible here, and that is the model telling on itself.** The
adder settles in exactly seven passes for every operand pair — never six, never
more — whether the carry travels nowhere or crosses all six positions. It has to:
reachability is transitive closure, so a fully determined chain of switches
resolves in one pass however long it is, and staging happens only where a *gate*
is still unknown. Cell 0 resolves on pass one, cell *i* on pass *i+1*, and pass
seven is the one that notices nothing changed. A model with no delays in it cannot
show you the one cost a ripple adder is famous for.

#### The cost result reverses

| at equal representable range | switches | mid-rail taps | rails |
|---|---|---|---|
| ternary adder, 6 trits (729 values) | **624** | 168 | 3 |
| binary adder, 10 bits (1024 values) | 280 | 0 | 2 |
| ternary, leaves shared | **384** | 72 | 3 |
| binary, leaves shared | 220 | 0 | 2 |

W3 measured **0.80** for `MIN` and predicted that number should not be believed.
Here the ratio is **2.23** unshared and **1.75** shared — the other side of 1.0.
Both numbers are real, and the currency did not change. `MIN` is *positionwise*:
six wide slices beat ten narrow ones, so fewer digits wins. An adder is a *table*,
and a selector tree over three inputs is 3³ wide in ternary against 2³ in binary.
The per-digit saving is spent on tree width, and then some.

Y5 checked this is structural rather than an artefact of pairing six trits with
ten bits: sweeping one trit to six against the matching bit width, the ratio never
drops below **1.46**. Registered alongside it, and checked, that the binary adder
being compared against is itself correct — a cost comparison against a circuit
that does not work is not a comparison.

#### Per digit, which is the currency the radix argument uses

| | switches per digit |
|---|---|
| one ternary full-adder cell | **104** (64 with leaves shared) |
| one binary full-adder cell | **28** (22 shared) |
| ratio | **3.71×** (2.91× shared) |

**Mind the units.** The radix-economy bar quoted above as 3.08× is *not* this
number and must not be compared to it. That measure charges a digit of radix *b*
a cost of *b*, so the binary side of it already carries a factor of two. In switch
currency the break-even is **log₂3 ≈ 1.58** — a trit's circuit may cost about
1.58× a bit's before ternary stops paying, because a trit carries about 1.58 bits.

Measured, a ternary adder digit costs **3.71×** a binary one, or **2.91×** with
leaves shared. Both are more than double the budget. And this is the *generous*
reading: the mid rail is still free in this model, and 168 of those 624 switches
touch it.

### The two caveats, priced

Every switch count above has carried two disclaimers: the middle rail is free,
and there is no level restoration. Neither had ever been costed.

**The first one is now a theorem, and it is worse than a caveat.** The way real
silicon makes a middle voltage is a divider between the two supplies. Here that is
two rails reaching one node, which is contention — it resolves to *unresolved*. So
the middle rail cannot be built inside this model at all (T5). It has to be handed
in from outside, and its price is charged in a currency this vocabulary does not
possess. The same theorem records a second thing that had never been stated: an
input **gates** and **terminates** a path, but it never *sources* one. Every
circuit here uses inputs purely as gates, so nothing has ever depended on it.

What can still be asked is a break-even. How dear would the generator have to be?

| | ternary | binary | ratio | parity at | reverses at |
|---|---|---|---|---|---|
| W3: `MIN` 6 trits vs `AND` 10 bits | 48 | 60 | 0.80 | **G = 12** | G = 13 |
| the adder, 6 trits vs 10 bits | 624 | 280 | 2.23 | G = 0 | — |

Twelve switches — **two per mid-rail tap** — and W3's 0.80 is gone. The adder
cannot be moved in either direction, because a charge only ever adds to the
ternary side. So the free rail was propping up **exactly one** published result,
and it is the one that favoured ternary.

**Restoration is measurable, and it has a floor.** Pass depth here means: how many
conducting switches a level arrived through, from the rail that drives it,
shortest path when there are several, counted only for nodes something actually
*reads* — a gate input or a named output. Restoring buffers cut it, and cost.

| | none | buffer mid | buffer leaf+mid |
|---|---|---|---|
| ternary adder, switches | 624 | 912 | 1776 |
| ternary, leaves shared | 384 | 672 | 1056 |
| binary adder, switches | 280 | 440 | 760 |
| binary, leaves shared | 220 | 380 | 580 |
| **ternary read depth** | 6 | **4** | **4** |
| **binary read depth** | 3 | **2** | **2** |

The repeated 4 and 2 are real: buffering this design stops helping once it hits
them. A selector's middle arm is two switches, because isolating the middle level
from the raw select needs the `D3` overlap, and a restoring buffer's own output
already sits two hops from a rail. Two plus two.

**Z2 then overreached, and is kept as a failed prediction.** It concluded that 4
is the best depth ternary can buy *at any price*. Nothing measured quantified over
designs — only over where buffers go inside one family of trees. Decode the select
instead of gating on it: a four-switch detector pulls to `vss` for both outer
levels and passes `vmid` for the middle one, **paid once per select signal rather
than once per selector**, and then every selector arm is a single device, middle
one included.

| ternary full-adder cell | switches | read depth |
|---|---|---|
| selector tree, gated on the raw select | 104 | 6 |
| **decoded select** | **90** | **3** |

Shallower *and* cheaper than the design the floors were measured on — matching
binary's unrestored 3. The clause is refuted twice over. Third time a sentence
here has outrun its measurement, after P3 and X2; the registration is left as
written and the counterexample is checked in
[`test-midrail.js`](test/test-midrail.js).

And restoring makes the cost ratio worse, not better: **2.23 → 3.26**. The
`leaf+mid` column costs nearly double the `mid` column and buys no depth at all,
on either side.

**Restoration also costs time — the only currency this model measures it in.** Y2
found the adder settles in exactly seven passes whatever the data. Buffered, it
takes 19; buffered twice, 31 — because each inverter is its own dependency stage.
Still independent of the data — **for these designs.** Every arm of a selector
here is gated on the raw select, so every arm's conduction becomes known at the
same moment and nothing can settle early. The decoded adder below breaks that, and
is the first circuit in this repository whose settling time depends on the numbers
going through it.

### The decoded selector — the circuit that failed Z2

Z2 said depth 4 was the best ternary could buy at any price. Checking that
sentence produced a circuit that reaches 3, and this is it at full width.

A selector gated on a raw trit needs a **series pair** for its middle arm —
isolating the middle level from a raw select needs the `D3` overlap and nothing
less, which X4 proved by exhaustive search. So decode the select first. One
four-switch detector answers *"is this signal MID?"*, and then every arm of every
selector using that signal is a **single device**, middle one included. The series
pair did not vanish; it moved into the detector, where it is paid **once per
signal** instead of once per selector — and a tree has thirteen selectors.

| six-trit adder | switches | shared | read depth | vs binary |
|---|---|---|---|---|
| selector tree, raw select | 624 | 384 | 6 | 2.23 |
| **decoded select** | **540** | **360** | **3** | **1.93** |
| binary, 10 bits | 280 | 220 | 3 | — |

Cheaper, half the depth, and level with binary's. The gap narrows and does not
close: the ratio never drops below **1.36** at any width, and per digit 90 against
28 is **3.21×** where the break-even is log₂3 ≈ 1.58.

**Two of the five predictions failed, and both are worth more than the three that
held.**

**E5 had the mid rail backwards.** The decoded design taps it **186 times against
168** — one extra per detector, eighteen of them. Which matters, because Z1 showed
the free rail is the largest unpriced thing in the whole stack. The design that
wins on switches leans harder on the thing nobody is charging for.

**E4 was wrong in a more interesting way.** It predicted exactly 13 passes for
every operand pair, deriving 13 correctly — as the *worst* case. The real range is
**9 to 13, and it depends on the numbers going through the adder.** That is the
first circuit in this repository whose settling time is arithmetic rather than
structural, and Y2's and Z5's "independent of the data" are now scoped to
raw-select designs because of it.

The mechanism is exact. With a raw select every arm's conduction becomes known at
the same instant, so nothing can settle early. Decoding splits the gating across
two dependency levels: with the carry-in LOW, the LOW arm is already conducting on
the raw select while the MID arm's gate is still unknown — and if both arms lead to
the *same rail*, the node is determined anyway, a whole pass early. **Six of the
carry table's nine leaves have their LOW and MID cells equal.** None of the sum
table's do. The adder settles faster on operands that happen to route through
those six. **The count is derived below**, exactly.

What is measured, with the three outcomes separated rather than merged:
**279,936** of the 531,441 pairs settle in *fewer* than thirteen passes, **251,505**
in exactly thirteen, and **none** in more — so thirteen is a real ceiling, and the
251,505 — which is, for no reason
anyone here can give, the same number the vocabulary audits found for what
positionwise logic plus one carrying `ADD` reaches at width two.

### Where 128/243 comes from

E4 measured that the decoded adder settles early on 279,936 of its 531,441
operand pairs and could not say why. This says why, and the account is exact —
**at carry-in 0**, which is what every sweep here fixed. With a non-zero carry-in
the bottom position can save too, and the walk below is a different walk.

**Each digit asks a question that takes an extra beat.** Its selectors are gated
partly on the raw carry coming in and partly on a detector answering *"is that
carry the middle value?"* — and the detector's answer arrives one pass later. But
sometimes the answer does not matter: if the arm already conducting and the arm
still waiting both lead to the **same rail**, the node is determined anyway.

For the **carry** output that happens often. For the **sum** output it never
happens. That asymmetry is the whole result:

| | condition for settling early | true on |
|---|---|---|
| carry tree | `carry(s+c) == carry(s)` | **12 of 18** |
| sum tree | `lowTrit(s+c) == lowTrit(s)` | **0 of 18** |

Adding one always moves a low trit. The carry function, by contrast, is flat over
stretches — several different sums produce the same carry. So only the carry tree
is ever early, and **the top digit's sum is always the last thing to move**, which
means a saving at the top position is invisible. That is precisely why an earlier
count over-predicted by exactly one, always in the same direction.

**The rule**, then, with *s* = the two operand digits summed:

> **At carry-in 0:** passes = (2n+1) − #{ positions *i*, excluding the bottom and
> the top, where the carry in is non-zero and `carry(s+c) == carry(s)` }

The bottom position is excluded because *at carry-in 0* its carry-in is zero and
the condition needs a non-zero one — that clause is a property of the sweep, not
of the circuit. Four positions can save, which is where the 3⁵ comes from.

**The count** is then a walk over the carry state, with the saving moves deleted —
a matrix derived from the adder's own tables, not written down:

| from | → −1 | → 0 | → +1 | total |
|---|---|---|---|---|
| **0** | 1 | 7 | 1 | 9 |
| **−1** | 2 | 1 | 0 | 3 |
| **+1** | 0 | 1 | 2 | 3 |

```
(1, 7, 1) → (9, 51, 9) → (69, 375, 69) → (513, 2763, 513) → (3789, 20367, 3789)
                                                     sum 27,945  × 9 = 251,505
```

251,505 pairs take the full thirteen passes, so 279,936 settle early — **128/243**,
exactly the measured figure.

**Checked against the real circuit, pair by pair, exhaustively at five widths.**
Not the total: every individual pair.

| trits | pairs | rule wrong on | take exactly 2n+1 | derived |
|---|---|---|---|---|
| 2 | 81 | 0 | 81 | 81 |
| 3 | 729 | 0 | 621 | 621 |
| 4 | 6,561 | 0 | 4,617 | 4,617 |
| 5 | 59,049 | 0 | 34,101 | 34,101 |
| 6 | 531,441 | 0 | 251,505 | 251,505 |

And every clause is shown load-bearing: counting the top position breaks the rule,
counting the bottom one does not, and swapping the sum table for the carry table
breaks it. The old over-prediction is accounted for *case by case* — the two rules
differ on exactly the pairs where the top position would have saved.

### It remembers: storage, a register, and a thing that computes

Everything above computes and forgets. Holding a value turned out to be the harder
problem, and **three of the four obvious ways to do it are forbidden by axioms that
had never mattered before.**

A cross-coupled pair holds all three trits once seeded, and from a cold start it
goes unresolved — `N7`. Writing straight from an input fails on `T5`. Writing by
overpowering the loop fails on `N4`, because this model has no notion of drive
strength: a contended node is unknown, not "whichever side is stronger". What works
is opening the feedback loop while writing. **11 switches a trit, in place.**

Then a six-trit register at 66, and a prediction that failed usefully:

> `J4` — a read during a write returns the value from *before* the write.

It does not. The write holds the feedback loop open, so the cell is transparent
while written and a read sees the new value on every case tried. That is a
**latch**, not a flip-flop — so the register file doubles and the next phase built
what `J4` proved was required: a master-slave pair on opposite clock phases, 132
switches, which does return the pre-step value. Asserting both phases at once
collapses it straight back to the transparent latch, which was produced deliberately
to show the non-overlap discipline is load-bearing rather than conventional.

Wire that register to the decoded adder and you get an **accumulator** — `A ← A + B`
in one two-phase step, 672 switches:

```bash
npm run audit:accumulator     # all 729 accumulator values x 9 addends
```

All 6,561 steps produce the right sum. The number that matters more is the other
one: on **none** of them did the register stop reading the *old* accumulator while
the adder was computing its replacement. Ten successive additions accumulate to
−79, matching the reference at every step — the first computation here carried out
by simulated transistors holding their own state between steps.

One consequence worth stating plainly: the decoded adder settles in 9 to 13 passes
depending on its operands, and the accumulator inherits that. **A machine built on
this design has no fixed clock period.**

### What is missing, and the order to build it in

A datapath fragment is not a machine. Still unbuilt at switch level: **interconnect,
the address path, addressed memory, instruction decode, and sequencing.**

[`design/12-roadmap.md`](design/12-roadmap.md) commits to an order, and it argues
that order from two measured ladders rather than from taste. The short version:

- **The solver can run a machine but cannot sweep one.** 50,000 devices solve in
  ~70 ms — the solver is linear, not superlinear as two design documents had
  asserted without checking. But a full 531,441-pair sweep fits in an hour only up
  to ~4,800 devices. The machine is the first subject here that sits outside the
  exhaustive discipline every other result rests on.
- **So which machine? Exactly one configuration works:** 81 words of memory under
  charge retention, ~3,562 switches. It is the only size that both fits the sweep
  budget and runs a program somebody already wrote — `countdown`, `threeway` and
  `kleene` fit as placed. A 27-word machine fits the budget and runs **none** of
  the eight.
- **Which means two decisions the design phase ranked separately are one.** Charge
  retention isn't a saving to weigh against others; it is the difference between a
  machine that runs a real program and one that runs a relocated toy.
- **And removing the dominant cost promotes the next one.** Under retention,
  storage stops being 93% of the machine and the **address path** — which nobody
  has built — becomes the largest single term: at 243 words it is **4,307**
  switches against storage's **1,458**.

The costs come from [`tools/budget.js`](tools/budget.js) rather than being typed
into the table, because a number in prose stops tracking the code that made it;
`test/test-budget.js` fails the build if this README, that roadmap and that tool
disagree.

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
