<!-- kind: results-topic -->
# 06 — The currencies: what the mid rail costs, and what erasure costs

**Owned sets:** `N` `AB` `AC`

Cross-references `Z` (which first priced the two limits), `O` (whose whole margin
turned out to be borrowed), `E`/`Y` (the adders it re-ranks), `C` (the memory it
prices), `B` (the decision it does not overturn), `M`/`D` (whose reversibility
results `AB` extends from maps to instructions), `E4` (the first data-dependent
cost, of which `AB3` is the second).

Two currencies live here and they are opposites. **The mid-rail tap has no known
exchange rate**, because it depends on devices nobody built. **Erasure has one
nobody has to agree to**: Landauer prices it at kT ln2 per bit, and a map that loses
states loses them whatever anybody declares.

Every switch count in this project is quoted under an assumption the model states
and calls its largest: **the middle rail is free.** This file is what happens when
that stops being true.

It is also where the thesis question terminates. Not because it is answered — because
**it is shown to be unanswerable from inside the model**, with a number attached to
how much depends on the answer.

---

## What is established

### 1. The middle level cannot be made inside the model at all

Not a limitation of effort. **A divider between the outer rails is two rails reaching
one node, which is contention, and resolves to unknown.** The middle level has to be
*given*.

So the model is structurally incapable of pricing its own biggest assumption. `N`
does the only thing available: it measures **how much rests on it.** `MEASURED`

### 2. Tap density is not uniform, and the best circuit is the hungriest

| part | switches | mid taps | density |
|---|---|---|---|
| storage cell | 11 | 2 | 18% |
| buffer | 8 | 2 | 25% |
| detector | 4 | 1 | 25% |
| **decoded adder** | 540 | 186 | **34%** |
| selector-tree adder | 624 | 168 | 27% |
| tree read path | — | 0 | **0%** |

The 27-word memory that was built takes **339 taps on 2,301 switches** — 14.7%, a
**1.15× multiplier** at a price of one switch per tap (`N3`). Not the doubling the
adder's 34% would suggest, because the memory is dominated by cells at 18% and a
tap-free read tree. `MEASURED`

### 3. Two published comparisons, re-checked under pricing

**The decoded adder — this project's best circuit result, three phases of work — is
the *more* tap-hungry family.** It wins 540 to 624 while taps are free and **loses
above a price of 4.67** (`N3`).

> So the headline circuit result survives a moderate charge and not a steep one.

**The read-path decision does not flip**, and for a reason worth stating plainly: the
tree selector was **never** the cheaper option — 960 against 736 at 81 words. `B`
chose it on *correctness*. Pricing the rail makes that decision dearer without making
it wrong.

That asymmetry is the useful shape here: **a decision made on cost is fragile to
pricing, and a decision made on correctness is not.**

### 4. Almost none of it can be engineered away

`N2` found the one exception. The MID detector outputs the middle level and costs a
tap — but **every consumer in the repository gates it at a threshold**, and a
threshold conducts for anything at or above it. A variant outputting the *top* level
instead costs the **same four switches with zero taps**, verified as a drop-in across
both consumer patterns exhaustively. `MEASURED`

That removes **3 taps of 339**.

The other **336** come from inverters and buffers whose outputs are genuinely
three-valued, and a node that must carry the middle level must reach the middle rail.

> **99.1% of the built memory's mid-rail taps cannot be designed around** (`N4`).

### 5. What that does to the thesis

Set `O` measured ternary's universal reversible gate at 10 switches and 2 taps against
binary's Toffoli at 12 and 0 — a 1.2× win. Price a tap at **one switch** and the two
**tie at 12**; at two, binary wins outright.

Combining that with `N4`: the taps cannot be removed, and the margin cannot survive
them being charged. So:

> **"Ternary is optimal for general compute" reduces to a single physical question —
> is generating a third voltage level cheap in real devices? — with a number now
> attached to how much rides on the answer.**

Everything from `O`'s gate comparison up through the machine budget is denominated in
that one unknown. `MEASURED` for the dependency; the question itself is outside what a
switch-level model can reach.

### 6. The failed prediction, and why it matters here

`N1` claimed a tap is unavoidable exactly where some node must carry the middle level.
**It failed two ways**, and the second is the one that limits this file's own result:

The test asked *"does this **build** put MID on a node"* — which is **not** the rule
as registered. The rule was *"must some node carry MID for the **function** to
compute"*. It scored the detector FORCED while `N2`, in the very next section, built
the same function with zero taps.

> **A circuit that uses the mid rail is not a circuit that needs it.**

Separating the two requires a search over equivalent circuits, which the test did not
do. So **99.1% is a ceiling on what is forced, not a proof of it.** One
detector-shaped saving was found by hand; there may be others.

---

### 7. The second currency: what the machine destroys

The question arrived from outside. A sister project prices a term by a **static
count** — expand to a fixed basis, weight the leaves, and the price is a function of
the object. Its virtue is that nobody has to be trusted: anyone holding the artifact
recomputes the price by hand, so there is no meter to corrupt. Every deployed cost
system prices work *extrinsically* instead — proof-of-work prices energy burnt, gas
prices instructions executed — and therefore has to be attested.

That is a price tag. **A conservation law is a different object**: it says what can
never be got back rather than what something cost to make. `AB` asks which of this
machine's own instructions destroy information, measured as

> E = (1/|S|) · Σ n_y log₂ n_y — the average log of the preimage size,
> zero exactly when the map is injective, log₂ 729 = 9.5098 bits when it is constant.

**Nothing in that is a convention**, which is the whole reason it is worth having
beside the tap price. `MEASURED`

#### Information-preserving operations are 23x rarer in ternary

Of the 19,683 two-input tritwise operations, **216 preserve information — 1.10%**.
The binary analogue is **4 of 16, 25.0%** (`AB1`). The instruction map is
(A,W) → (f(A,W), W), injective exactly when each of the table's three columns is a
bijection of the three trit values: 6³ = 216 against binary's 2² = 4. Eighteen of
the 216 are affine over GF(3) and **198 are not**, which is `M1`'s asymmetry on the
27-point arena arriving on the 729-point one.

The column criterion is an *argument*, so it was checked against a direct sweep of
all 531,441 pairs on a sample of tables. It agrees on every one.

#### The eraser is not the instruction you would guess

| class | count | opcodes |
|---|---|---|
| erase nothing, at every operand | 11 | HALT ADD ADDI SUB NEG SETC JMP BR3 OUT JMPX LDC |
| erase a fixed 9.5098 bits | 4 | LOADI LOAD **STORE** IN |
| erase an operand-dependent amount | 5 | MIN MAX CSUM SHL SHR |
| table families or three-place, out of scope | 5 | TGATE LOADX STOREX TOP TOPC |

**STORE erases the maximum and never writes the accumulator** (`AB2`). Under the
pair state it maps (A,W) → (A,A), destroying the addressed word outright. The
instruction whose name says it is *saving* something is the textbook Landauer
erasure, sitting in plain sight in an instruction set nobody wrote for
thermodynamics.

ADD is the contrast that makes the point: it is a **permutation of the entire
531,441-pair datapath**, because the operand survives in memory. Two-input, and it
destroys nothing.

#### The same instruction, a different price

`MIN` erases **0 bits** when its operand is all +1 and **9.5098** when it is all −1,
mean **4.5033** over uniform operands — a figure derived as 6·(0 + ⅔ + log₂3)/3
before the run and measured at 4.5033 (`AB3`). `MAX` mirrors it. `CSUM` **never
reaches the maximum at all**, topping out at exactly 4 bits, so one tritwise gate
cannot erase a whole tryte however hostile its operand. This is the project's
**second data-dependent cost**, after `E4` found settling time depends on operands.

`SHL n` and `SHR n` erase **identically**, n·log₂3 — one drops the high trits and
one the low, and an information count cannot tell those apart. That is a stated
limit of the measure, not a fact about the machine.

#### But the charge is mostly in the text after all — `AB4` failed

Predicted: the actual erasure along a trace would fall strictly below the bound
computable from the program text, everywhere, by more than 2x somewhere. Measured:
**six of eight programs charge exactly their text bound**, and the largest gap is
**1.21x**, not 2x.

The reason is the instruction mix. The operand-dependent opcodes simply do not
appear in six of the eight programs, so the worst case *is* the actual case. **The
static count transfers, conditionally** — erasure is recoverable from the text
exactly when the program's instruction mix is operand-independent, and this
repository's programs mostly are. That is a sharper claim than either the prediction
or its negation, and it came from being wrong.

#### And reversibility does not buy universality — `AB5` failed

The zero-erasure named ALU generates a group of order **exactly 1,458** on the 729
accumulator states: the 729 translations extended by negation, verified by sifting
all 1,459 instruction maps through a chain built from two of them. Predicted, held.

The second clause predicted that admitting all 216 reversible tables would lift that
to the full symmetric group. **It does not.** The orders land on a closed form,

> |G_W| = 2^W · 3^((3^W − 1)/2)

matching exactly at every width the stabiliser chain can reach:

| width | states | named ALU | reversible fragment | fraction of S_N |
|---|---|---|---|---|
| 1 | 3 | 6 | **6 — the whole symmetric group** | 10⁰, all of it |
| 2 | 9 | 18 | 324 | 10⁻³·⁰ |
| 3 | 27 | 54 | 12,754,584 | 10⁻²⁰·⁹ |
| 4 | 81 | 162 | 1.945 × 10²⁰ | 10⁻¹⁰⁰·⁵ |
| 5 | 243 | 486 | ~1.73 × 10⁵⁹ | 10⁻⁴¹⁶·⁵ |

**Width 1 is the only place reversibility is free.** From width 2 the reachable
fraction collapses super-exponentially. Extrapolated to the real accumulator the
fragment is 2⁶·3³⁶⁴ — 176 digits against 729!'s 1,773, a fraction of 10⁻¹⁵⁹⁶·⁷.

So the conclusion inverts: **the eraser is load-bearing, not a convention of the
opcode table.** It is the same shape as the classical result that no term over
{B,C,W,I} can select — take away the one information-destroying primitive and what
remains cannot compute.

---

### 8. Can you learn what a program costs without paying for it?

A currency has been proposed whose unit is one step of computation, secured by an
argument from physics: you cannot perform unbounded steps per second, so a large
step count is evidence that large work was done. **The receipt is implied rather
than issued** — holding the number is the proof, because the number could only have
been obtained by paying.

The argument is sound and it rests on one thing. Physics bounds what a machine can
**do**; it says nothing about what anyone can **claim**. The gap closes only if

> the cheapest way to learn a program's cost is to run it.

`AC` measured that, and answered it in **two directions at once**. Three of its four
predictions failed. `MEASURED`

#### The cost is not in the program's shape

Two programs, differing in **one immediate operand** — `LOADI 1` against
`LOADI 364` — have identical instruction counts and identical opcode histograms
under both a naive linear reader and the assembler's own tokenizer. They cost
**4 steps and 730** (`AC3`).

Any predictor reading only the static shape of a program returns one number for
both and is **wrong on one of them by a factor of 183**. That is a counterexample
rather than a failed search, and it settles the question against symbol counting
specifically: **a price computed from a program's text cannot track what running it
costs.** The two quantities are not merely different units — across this pair they
are not even correlated.

`AC3` was registered predicting a ratio above 300 and failed on the number, for a
reason worth keeping: the cheap program's **four-step floor sits in the
denominator**, so the ratio is 730/4 and not 364/1. Predicting a ratio without
accounting for constant overhead is the same error as quoting a speedup without the
serial fraction.

#### But the cost is cheap to obtain anyway

**Five of the eight programs cost exactly the same number of steps whatever data
they are handed** (`AC1`). Their price can be published once and nobody ever needs
to run them again. All eight execute `IN`; reading input is universal here and
**cost-invariance is still the norm.**

Where the cost does vary, it is priced by a straight line. `countdown`'s step count
is exactly `5N + 3` — fitted from two runs and **exact on 200 of 200 inputs, worst
error zero** (`AC2`). Two executions price two hundred, and the ratio only improves
with the sweep.

So data-dependence alone establishes **nothing**. It is necessary for an implied
receipt and nowhere near sufficient.

| | for a step count used as evidence of work |
|---|---|
| the cost is not readable from the program's **shape** | in favour — `AC3` |
| five of eight programs cost a **constant** | against — `AC1` |
| the one that varies is priced by **two runs** | against — `AC2` |

**The honest reading is that neither extreme holds on this corpus.** You cannot
read the price off the text, and you do not have to run the program to know it
either — you have to look at the operand values, and once you are evaluating
operands you have begun executing. Where a given program falls between those two
depends on the program, and this repository's eight are all small and
fixed-shaped. The case that would settle it is a program whose runtime is genuinely
unpredictable, which is to say general computation, and **that case is not in this
corpus.** `AC` measured what is here and does not reach past it.

#### And a step is not a bit

Bits erased per executed instruction spans only **1.68×** across the eight programs,
against a predicted 2× (`AC4` failed) — they are more alike in erasure intensity
than in anything else measured about them, all falling between 3.6 and 6.1 bits per
instruction. But the ordering clause held: **the longest-running program is not the
hungriest per step** (`interp-core` against `fold`). Two currencies, denominated in
steps and in destroyed information, rank the same programs differently — on a
narrower margin than predicted, but they do rank them differently. Choosing between
them is a decision, not a units conversion.

---

## How it was established

| | |
|---|---|
| tools | [`midrail-price-audit.js`](../tools/midrail-price-audit.js), [`midrail-audit.js`](../tools/midrail-audit.js), [`budget.js`](../tools/budget.js), [`erasure-audit.js`](../tools/erasure-audit.js), [`predict-audit.js`](../tools/predict-audit.js) |
| tests | `test-midprice.js`, `test-midrail.js`, `test-budget.js`, `test-erasure.js`, `test-predict.js` |
| method | tap counts read from built netlists; crossovers solved algebraically and confirmed at sampled prices; the detector variant swept exhaustively against both consumer patterns |

The six cost currencies this project measures in — switches, mid-rail taps, pass
depth, dependency stages, state elements, seeded nodes — are enumerated in
[`../design/01-currencies.md`](../design/01-currencies.md). **Mid-rail taps are the
only one where the exchange rate is unknown**, and that is precisely why they decide
so much.

---

## What it does not show

- **Whether the assumption is true.** This file prices it and cannot settle it. That
  is a fact about real devices.
- **That 99.1% is a floor.** `N1`'s failure means it is a **ceiling** on what is
  forced — the test conflated *uses* with *needs*.
- **That charging a tap one switch is the right exchange rate.** One switch is a
  convenient unit, not a measurement. The crossovers are reported as functions of the
  price for that reason.
- **That the erasure figures are the whole bill.** The census covers the datapath —
  the accumulator and the addressed word. PC and the gate control register are
  excluded, and each exclusion changes an answer: counting PC would make every jump
  an eraser. **Widening the state can only add erasure**, so every figure is a lower
  bound.
- **That an instruction has one erasure figure.** It has one per state boundary.
  `MIN` reads as a single fixed 4.5033 bits when the operand is folded into the
  state and as a range from 0 to 9.5098 when the operand is a parameter — and the
  fixed figure is exactly the mean of the range. Neither is wrong. The boundary is a
  modelling choice that has to be declared before any number means anything, and the
  first version of this census drew it somewhere the prediction did not.
- **That the width-6 group order was measured.** It was not: the stabiliser chain
  had not finished after two hours on this host, which is an observation and not the
  absolute claim "does not finish" — that would be a duration assertion, the class
  this project has already bitten twice. 2⁶·3³⁶⁴ is the closed form extrapolated from five
  widths that were measured exactly.
- **That `AC` reaches general computation.** Its eight programs are small and
  fixed-shaped. The case that would settle whether a step count can be evidence of
  work is a program whose runtime is genuinely unpredictable, and that case is not
  in this corpus. What was measured is what is here.
- **That "no cheap predictor exists".** `AC3` refutes predictors that read the
  static **shape** of a program, which is the specific class a symbol-counting
  price belongs to. It says nothing about analyses that partially evaluate, and a
  proof that none exists would be a halting argument rather than a measurement.
- **Anything about static power.** A real ternary mid level is typically generated
  with dividers that burn power continuously; this model has no notion of power at
  all, and the tap count is a proxy for a cost it cannot express.

---

## Owned sets

| set | subject | outcome |
|---|---|---|
| `N` | pricing the free mid rail, the model's largest assumption | 3 held, `N1` failed |
| `AB` | erasure: what the machine destroys, and whether the price is in the object | 3 held, `AB4` and `AB5` failed |
| `AC` | whether a program's cost can be learned without paying it | 1 held, `AC1`, `AC3` and `AC4` failed |

Full text in [`99-ledger.md`](99-ledger.md).
