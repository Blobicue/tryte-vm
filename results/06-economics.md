<!-- kind: results-topic -->
# 06 — The currencies: what the mid rail costs, and what erasure costs

**Owned sets:** `N` `AB` `AC` `AD` `AG` `AH` `AJ`

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

### 9. A loop bound the program discovers — and why that is still not enough

`AC` left a stated gap: every loop in this repository was bounded by a literal or by
a number handed to it, which is exactly why it found the cost cheap to obtain
everywhere. The class that matters was missing.

The refinement that names it: a stop condition being *data-dependent* is not enough,
because `countdown`'s bound is data-dependent and is simply **read** off the input —
which is why two runs priced two hundred. The condition has to be **discovered**,
produced by the loop's own work.

[`programs/hailstone.tasm`](../programs/hailstone.tasm) is the first program here
with one. Low trit zero descends by a third; otherwise it climbs by `2n + low_trit`;
it stops at 1. **363 of 729 inputs terminate**, and the rest never do — exhausting a
step budget is a first-class outcome rather than a failure. `MEASURED`

#### Discovered really is different from read

| | `countdown` (read bound) | `hailstone` (discovered bound) |
|---|---|---|
| two-point affine fit | exact on **200 of 200** | exact on **2 of 363** |
| monotone in the input | yes | **no** — 33 of 242 adjacent pairs invert |

The same procedure that priced `countdown` perfectly is right 0.6% of the time here
(`AD1`). And because the cost is not monotone, no predictor built from the
*magnitude* of the input can be correct either. So the distinction is real and it is
measurable.

#### And it is still not enough

A predictor is not obliged to be clever. It is allowed to be **patient**.

The accumulator has 729 states, so a memoised traversal resolves every one of them
at most once. Measured: **728 map evaluations to price all 729 inputs**, against
**3,777** to answer the same questions by independent re-running (`AD2`). At a mean
of 10.4 evaluations per query, tabulating has paid for itself after **70 queries**,
and every answer after that is free.

**Being genuinely discovered is therefore not sufficient for an implied receipt.**

#### The bound is pigeonhole, not particular

The longest terminating trajectory is **19 steps** against a ceiling of 729 — 2.61%
of the available headroom (`AD3`). And the ceiling is not a fact about this map:
every terminating trajectory was checked and **none revisits a value**, so each is a
simple path through the state space. A longer path would have to repeat, and a
repeat means it never terminates. **That holds for any single-accumulator map
whatever.**

#### So the security parameter is state count

Poison every scratch word before the run and **all 729 answers are unchanged**
(`AD4`), so the cost really is a function of the accumulator alone and the
tabulation bound is tight rather than generous.

The arithmetic that follows is `DERIVED`:

| live words beyond the accumulator | states to tabulate |
|---|---|
| 0 | 729 |
| 1 | 531,441 |
| 2 | 387,420,489 |
| 3 | 282,429,536,481 |

Each word multiplies the tabulator's one-off cost by 729 and leaves the runner's
single query untouched. So:

> **The security parameter of an implied receipt is reachable state count, not
> whether the loop bound is discovered.**

That is the same shape as key length — and a different design problem from the one
the question started with. A step count is evidence of work exactly when the
reachable state space is too large to tabulate, which is a quantity you choose
rather than a property you hope for.

---

### 10. The second knob, and a third one nobody asked for

`AD4` concluded that the security parameter of an implied receipt is **reachable
state count**. That was half of it, and the other half arrived from outside the
repository — from `WaveSeeds`, which faces the same problem with a secret carrying
only 3.17 bits per tap:

> *"Argon2 does not add entropy. It adds a work factor — a cost multiplier per
> guess."*

`AD2` counted 728 evaluations to tabulate the whole space and treated each as free.
The bill is **states × cost per evaluation**, and the asymmetry is severe: the honest
party evaluates **once**, the tabulator **729 times**. `AF` measured both. `MEASURED`

#### This machine already contains the expensive evaluation

| tick defined as | cost of one evaluation |
|---|---|
| one **VM instruction** | **1** step, by definition |
| one **tree** adder solve | 624 devices × 7 passes = **4,368** node-updates |
| one **decoded** adder solve | 540 devices × 10 passes = **5,400** |

`AG4`: log(5,400)/log(729) = **1.304**, so redefining a tick from an instruction to a
device-level solve buys slightly **more than one word of state, free** — the
tabulator's bill for a 729-state arena moves from 729 evaluations to **3,936,600**
node-updates. Worth having. Not sufficient alone.

#### And the width belongs to the harness

`AG2`: a nested loop over three loaded words reaches a live width of **3 in 28
instructions**, putting the state space at 729⁴ = **282,429,536,481** — past what
`AD2`'s tabulator could afford. Nothing about the ternary datapath prevented this.
No existing program has that width only because **none of them was written to take
its work as runtime input** — including `interp.tasm`, which measures **0**, because
the program it interprets is assembled into its own image and is identical on every
run.

#### `AG1` failed, and produced the factor the whole thread was missing

Predicted every program would measure at most 2 live words. `threeway` measures
**5** — it classifies five values and each one changes the path taken.

But look at what that width is worth:

| program | live width | cost range | spread |
|---|---|---|---|
| `threeway` | **5** | 55 .. 56 | **1.02×** |
| `countdown` | **1** | 8 .. 203 | **25.38×** |

A tabulator facing 729⁶ states to learn a number that is always 55 or 56 **would not
tabulate.** It would guess 55 and be right almost always. Meanwhile `countdown` has
one live word and a cost that moves by a factor of 25.

> **Width and cost variance are independent, and neither is the security parameter
> alone.**

So an implied receipt rests on **three** factors, not two:

1. reachable state count (`AD4`)
2. cost per evaluation (`AG3`, `AG4`)
3. **variance of the cost itself** (`AG1`, by failing)

And the third dominates: if the cost barely moves, a predictor guesses the commonest
answer and the other two stop mattering entirely.

---

### 11. Building the spec, and finding two of its three items weaker than claimed

`AG` left a spec: make the cost vary, widen the live state past three words, define
the tick at the device level. `AH` built it and priced the attack. **Two of the four
predictions failed, and both failures were corrections to `AG` itself.** `MEASURED`

#### The variance bar is cleared decisively

The three-word program spans **32 to 16,443 steps — a spread of 513.8×** across 120
inputs, with 88 distinct costs (`AH1`). Against `threeway`'s 1.02× with *five* live
words, this is the first workload here that satisfies the item of the spec that
matters most. Width without variance is security theatre; this has both.

#### But the work factor buys no asymmetry at all

`AG4` called a device-level tick *"worth slightly more than one word of state."*
That treats the two as one currency. They are not:

| lever | attacker's bill | honest cost |
|---|---|---|
| baseline | 531,441 | 1,150 |
| **+ one word of state** | **387,420,489** | **1,150** — untouched |
| **+ device-level tick** | 2,869,781,400 | **6,210,000** |

> **The ratio gains 729× from state and exactly 1× from the work factor.**

It cancels, because it charges both sides the same (`AH3`). What a work factor buys
is **absolute** infeasibility — turning a cheap attack into a slow one in wall-clock
terms, which is exactly what a KDF is for and is a real thing. It is not asymmetry.
`AG4` never measured the honest side, which is the only place the difference shows.

#### And widening the state did not kill the sharing

`AH2` predicted that memoisation — the whole reason a tabulator beat `hailstone` —
would collapse once the state was three words wide. It does not:

| | control space | visits | distinct | reuse |
|---|---|---|---|---|
| `hailstone` | 729 | 3,777 | 362 | **10.43×** |
| three-word | 387,420,489 | 16,082 | 5,030 | **3.20×** |

A state space **500,000× larger** and the tabulator still resolves each state 3.20
times over. The reason is structural: a subtractive inner loop converges onto a
shared suffix whenever two inputs agree on the subtrahend, whatever their starting
values.

> **A tabulator exploits trajectory convergence, not a small state space — and the
> two come apart.**

So the receipt rests on **four** things, not three: state count, cost per evaluation,
cost variance, and **how tree-like the trajectory graph is**. Only the last two are
about the map rather than its size.

#### The margin, quoted the way it survives

The reachable control space is (w, b, c) = 729³ = **387,420,489** — `AH4` predicted
10¹¹, which was 729⁴, counting a fourth word this program does not have because its
step counter never gates a branch. One honest run costs **1,150** steps, not the
predicted under-300.

So the margin is **3.37 × 10⁵** — real, and three orders short of the claim. And it
is **identical under either definition of a tick**, because a ratio cannot see a
factor charged to both sides.

Quote the margin as a ratio and it is a statement about the state space alone. Quote
it in seconds and the work factor is the whole story. Both are true, and they answer
different questions.

---

### 12. Self-reference is not the property — reversibility is

The proposal was that **full self-reference** would give a tick currency its
layer-one security, with the concrete version being to write the history operator in
the language its own ladder produces.

Half the answer is a negative already proved elsewhere. The Ladder's **Coda III**
shows that *no system closes over its own semantics*: internalise the observer and
you have written a new term, reduced by someone with a budget it cannot see, and the
regress terminates at an axiom rather than at nothing. Its `nf(t)` returns HOLD,
GREW or RAN, and **two of the three verdicts are not in the term**. Full
self-reference in the strong sense is unavailable by that artifact's own theorem,
derived there three separate ways.

The weak sense — self-hosting — is available, and
[`programs/ladder.tasm`](../programs/ladder.tasm) now does it. But the thing being
asked for turns out to be cheaper than the thing being proposed. `MEASURED`

#### What a receipt actually needs, and where it comes from

`AI4` established the requirement: a state map with **in-degree one everywhere**.
The history operator has it — and *not* because it is self-referential.

Carry the operator in two words, `sum = Σ L(0..n−1)` and `lag = L(n)`. The step is
**(sum, lag) → (sum + lag, sum + 1)**. Over all 531,441 states (`AJ1`):

| | |
|---|---|
| maximum in-degree | **1** |
| unreachable states | **0** |

And the inverse is explicit rather than abstract: `sum = second − 1`,
`lag = first − sum`, recovered on all five probes including the wrapping corner
(364, −364).

> **Every component is `ADD`, and `AB2` measured `ADD` at zero bits erased.**
> A map built of reversible parts is reversible.

Note what that does *not* require. **Not self-reference. Not memory.** A *forgetful*
two-word carry has the property as fully as an append-only history would. `AI4` had
to search 19,683 tables to find the 216 that work; this needs nothing but addition.

#### The reversibility is in the state, not the output

`H` takes a whole history to one number. Over all 81 histories of length four from
the three trit values, it collapses them onto **9 outputs, erasing 3.5944 bits**
(`AJ2`).

So the state map is a bijection and the emitted value is a nine-to-one channel, at
the same time and without contradiction — they are different maps. That is `AB2`'s
accumulator-versus-pair distinction arriving from a completely different direction.
**Anyone reading only the number is reading an erasing channel.**

#### And self-hosting does not inherit reversibility

`ladder.tasm` reproduces the ladder exactly against an independent implementation, in
**152 instructions for nine terms** — and erases **6.2564 bits per instruction**
(`AJ3`), the second-highest figure in the corpus.

The map is a bijection. The program calls `STORE` on every turn of the loop, and
`AB2` measured `STORE` at the full 9.5098 bits. **A reversible mathematics
implemented on an erasing machine still erases** — the gap between *having* a
property and *running* it.

#### The price of never forgetting

The ladder grows like φⁿ and a tryte holds −364..+364, so it exceeds the range at
**term 15, value 377**: fourteen terms fit (`AJ4`). Asked for eighteen, the machine
emits 233 then **−352** — wrapping rather than growing, which is the only thing
bounded memory can do.

> **The price of a trajectory graph that cannot converge is a state that cannot be
> bounded.** Every real machine erases for exactly that reason.

Which is why `AJ1` matters: **reversibility buys the non-convergence without the
unbounded state.** It is the way out of the trade, not a way of paying it.

### 13. The other question: not what it cost to run, but what was found

Sections 8 to 12 all ask one question — **can the cost of running a program be an
unforgeable receipt?** — and the answer is no, three separate ways, ending at
`AK4`'s trilemma. `AN` asks the question Bitcoin actually answers, which is a
different one.

> A miner does not prove it ran a program. It proves it **found a rare witness**,
> and the witness is cheap to check. The asymmetry is search-against-check, not
> run-against-run.

Nothing in `AD` through `AK` bounds that, because a search puzzle never claims a
step count. In-degree, cost variance and bounded state are simply not its
constraints. Its constraints are different, and `AN` measured them exhaustively over
all 531,441 message-nonce pairs at six trits, with `D`'s split-round mixer as the
permutation and four candidates sharing it.

#### The variance of hit counts is the test `D4` could not supply

`D4` failed because truncating **any** permutation gives perfectly uniform buckets,
so a collision count cannot separate a hash from a relabelling. The number of nonces
that hit the target **per message** can, and structurally rather than statistically:
if `h` is a bijection in the nonce then every message has exactly `3^(6−k)` hits and
the variance is **zero**, while a compressing `h` scatters them binomially.

| candidate | sd of hits per message, k = 1 | against binomial 12.73 |
|---|---|---|
| feed-forward | 9.274 | 0.729× |
| bijective | **0.000** | 0× |
| affine | **0.000** | 0× |
| pseudorandom control | 12.39 | 0.973× |

So the discriminator works, and works absolutely: a bijective candidate is not
*near* zero, it is zero. `MEASURED`

#### `AN1` failed — and the failure is what detected the break

The registration predicted the feed-forward candidate would sit within 25% of
binomial at every difficulty. It came in at **0.729× and 0.674×** at `k = 1` and
`k = 2` — *more uniform than chance*. A puzzle more uniform than chance is
structured, and the structure was this:

```
h(m,n) = P(m + n) − n        substituting u = m + n
       = P(u) − u + m
       = g(u) + m            with g(u) = P(u) − u
```

Verified on all 531,441 pairs. **The message enters through the same group operation
as the nonce, so it commutes straight out**, and every message is one puzzle,
shifted. One 729-entry inverted index of `g` then solves every mineable message in
**1.54 lookups** against a brute force of 3.0 to 305.2, and correctly declares the
rest unmineable rather than failing on them.

Keying the permutation with the message instead — true Davies–Meyer, the message
never touching the data path — destroys the identity and returns the variance to
within 3% of binomial at every difficulty. **A fix that removes the symptom is what
confirms the cause** (`F-MESSAGE-COMMUTES-OUT-OF-A-GROUP-FEEDFORWARD`).

The registration had said in advance that agreement would not be a certificate and
that only disagreement could refute. The disagreement arrived and did exactly that.

#### The tabulator returns, and the algebra is worse than the table

`AD2` tabulated a program to price it and broke even at seventy queries. Against a
puzzle the same attack is not an approximation — it is total (`AN2`).

| candidate | attack | precomputation | per solve | solved |
|---|---|---|---|---|
| bijective | invert `P` | **729 entries** | 1 lookup | 729/729 at every k |
| affine | solve `(A − I)n = d − A(m)` | **1 inversion** | 1 rotation | 729/729 at every k |

Against a brute force of 205 attempts at `k = 5`, that is a **205× speedup**, and
the affine case breaks even on **query one** rather than query seventy. So the two
algebraic labels this project has carried since `AL` are, for a puzzle, both
disqualifying — and in a strict order: **being affine is strictly worse than being
merely reversible, and the gap between them is exactly the 729-entry table.**

A detail no prediction covered: the affine candidate gives every message exactly the
right *number* of solutions and puts them in the wrong *places*. At `k = 3` every
message has exactly 27 valid nonces, as a bijection must, yet a sequential scan needs
**248 attempts** to reach one where the null says 27
(`F-AFFINE-HIDES-ITS-SOLUTIONS-FROM-A-SCAN`).

#### Irreversibility is paid for in stranded messages

A puzzle **needs** `h` to be non-invertible in the nonce, or the tabulator applies.
But non-invertible means the image of `h(m, ·)` is smaller than the nonce space, so a
message can miss the target set entirely and be **unmineable** — no nonce exists, and
a miner holding it grinds forever (`AN3`).

| k | feed-forward stranded | null | bijective | affine |
|---|---|---|---|---|
| 4 | 0 | 0.085 | 0 | 0 |
| 5 | **33** | 36.071 | 0 | 0 |
| 6 | **264** | 268.000 | 0 | 0 |

**At maximum difficulty 36.2% of messages cannot be mined at all.** This is the exact
twin of the receipt result: the receipt died needing in-degree one; the puzzle needs
in-degree *above* one and pays in stranded work. And the property that guarantees
every message is mineable is the same property `AN2` uses to skip the mining.

The stranding and the shortcut turn out to be **one object, not two findings**.
`g`'s image is 465 of 729 digests, and 729 − 465 = **264** is exactly the stranded
count — because a message is mineable at the tightest target precisely when its
shifted target lies in that image (`F-STRANDING-IS-AN-IMAGE-DEFICIT`). Nothing
predicted the two numbers would be the same number.

#### And the fix is more nonce, not a different function

`AN4` widened the nonce to twelve trits, absorbed in two blocks through the same
compression function, leaving message and digest at six.

| nonce space | stranded at k = 6 | mean search |
|---|---|---|
| 729 | **264** | 311.2 |
| 531,441 | **0** | **735.0** |

Both symptoms moved together. The wide search lands within **0.8%** of `3⁶ = 729`,
the figure a proper lottery owes — which a truncated nonce space understates by 58%.
So `AN3` is not a fact about irreversibility as such but about a nonce space too
small for the target, and the design rule is **measured rather than borrowed**:

> **Nonce space must exceed target rarity by orders of magnitude.** That is what the
> extraNonce field in Bitcoin is for.

#### What this leaves standing

The receipt is dead and the puzzle is not. A search puzzle escapes `AK4` entirely,
because it never claims a step count — but it inverts every requirement that killed
the receipt. The receipt wanted in-degree one; the puzzle needs in-degree above one.
The 216 reversible tables that were `AI4`'s answer are here the **disqualifying**
case. What is usable is the non-affine erasing quadrant `AL3` already counted —
**19,458 of 19,683** — and what is still missing is what `D4` left missing: a way to
certify a candidate rather than merely fail to break it. `AN1` supplies one
refutation test. It is one, at 729 states, and a toy is not evidence against an
adversary.

### 14. And what a wipe would cost

A trusted-setup ceremony ends by destroying a secret. `F-REVERSIBLE-CANNOT-DESTROY`
settles the reversible case by argument — a language of bijections cannot express
deletion, so the ceremony is not merely unperformed there but **inexpressible**. `AO`
asks what that corollary was standing in front of: an *erasing* machine can collapse
states, but does collapsing certify anything?

#### The measure was already here, under another name

Model a ceremony as a map from secret to public output. Afterwards the world holds
`P(s)`, and what protects the secret is the number of secrets consistent with that
output — the **preimage size**. Which is exactly what `AB`'s erasure is built from:

> `E = (1/|S|) Σ n_y log₂ n_y`

So erasure and information-theoretic hiding are one quantity wearing two names. The
question was never whether the measure applies. It is whether its **summary** is the
right one — and `E` is a mean where security is not.

| pseudorandom ceremony map | |
|---|---|
| `E` | 0.8894 bits — reads healthy |
| `2^E`, the average hiding | 1.85 secrets |
| smallest preimage | **1** |
| secrets recovered **exactly** | **252 of 729 — 34.6%** |

**`E` cannot certify a wipe.** That is the third time in this corpus a summary
statistic has hidden the failure it was asked about: `D4`'s collision count could not
tell a hash from a relabelling, `AN1`'s mean could not tell a puzzle from a shift, and
now a healthy average erasure sits on top of a third of the space being fully exposed.
`MEASURED`

#### What certifies it is the construction `D4` disqualified

`D4` failed because truncating **any** permutation gives perfectly uniform buckets, so
uniformity is worthless as evidence of mixing. That same forced uniformity is exactly
what a wipe needs (`AO2`, `PROVEN`):

| m trits kept | image | min preimage | max | flat |
|---|---|---|---|---|
| 1 | 3 | 243 | 243 | **yes** |
| 3 | 27 | 27 | 27 | **yes** |
| 5 | 243 | 3 | 3 | **yes** |
| *random* | 446 | *1* | *6* | *no* |

The mixer is a bijection, so grouping its 729 distinct outputs by their low `m` trits
partitions them into `3^m` classes of exactly `3^(6−m)`. Flatness is **forced**, not
observed. A construction disqualified for one job is the right answer to another, and
the disqualifying property is the qualifying one.

#### The exchange rate, which is the number that matters

By pigeonhole, hiding every secret among at least `h` others forces the image below
`⌊729/h⌋` — so the public output can carry only so many bits (`AO3`):

| hide among | output may carry |
|---|---|
| 3 | 7.925 of 9.510 bits |
| 9 | 6.340 |
| 27 | **4.755 — half** |

Truncation attains that bound at every power of three; the pseudorandom map attains it
nowhere, and **not one of 400 random draws is even flat**. A balanced wipe never
happens by accident.

> **Hiding is bought with output bits at a fixed price.** A ceremony whose parameters
> must be large enough to be useful cannot buy much of it — which is why real
> ceremonies take their security from computational hardness and not from erasure at
> all.

#### Two results, four sets apart, are one number

`AN3` measured **264** blocks with no winning nonce. `AO` measures **252** secrets with
a unique preimage. The shared null is **268** — and they are equal by construction,
because a block with no nonce and a secret with one preimage are the `k = 0` and
`k = 1` tails of the same Poisson(1), which puts identical mass on both (`AO4`).
Neither set knew it.

#### `AO1` failed on its own control

The registration put a 5% band around the erasure null. It came in 7.6% out — so
`AO1` failed. Sweeping 400 pseudorandom maps then showed the null was **exactly**
right (mean 0.8269 against a predicted 0.8265) and that **336 of 400 draws would have
passed**. The band was reasonable; the draw was not. This set froze one seed as its
control and froze a 2.09-sigma one.

> **A single fixed pseudorandom object is one sample; a null model is a distribution.**
> Scoring one against the other scores the seed rather than the claim.

`T-CRITERION-IN-THE-NOISE`, third bite — and the sibling clause survived the same
unlucky draw only because it had been given a 10% band instead of a 5% one.

### 15. Giving the coin an owner, with nothing but the hash

`AN` found that mint-by-search is available where mint-by-receipt is not. `AO` priced
destroying a secret. Both left the same hole: **a minted coin with no owner is not a**
**coin**. `AP` asks whether ownership can be added without adding an assumption.

It can, and the construction is the oldest one. A **Lamport one-time signature** needs
only a hash — no curve, no pairing, no ceremony, nothing this project would have to
import and could not check. Per digit position you publish `b` preimage hashes and
reveal exactly one.

> Its famous defect is that a key signs **once**. Here that is not a defect. One mint,
> one key, one burn is the semantics the ledger wants, and the construction **enforces**
> it rather than asking.

#### What a reused key gives away

| | |
|---|---|
| ordered pairs swept | **531,441** |
| mean forgeable after two signatures | **21.433** against a null of 21.43 |
| maximum | **64** = 2⁶, when the messages differ everywhere |
| minimum | **1**, only by signing the same message twice |

The mean agrees with the closed form to **one part in ten thousand**, which is the real
content: it confirms the binomial model *describes* what a reused key leaks rather than
merely bounding it. So the one-time rule is not advisory — a second signature hands over
2.94% of the message space on average and **8.78% at worst**, and the only way to leak
nothing is to sign the same message twice (`AP2`). `MEASURED`

And one signature is exactly one message: over all 729 signed messages, the worst case
forges **1**, and no signed message admits a second (`AP1`). `MEASURED`

#### Ternary leaks less, and pays for it

| | ternary | binary |
|---|---|---|
| preimages | 18 | 20 |
| leak on reuse | **2.94%** | 5.63% |
| destroyed per signature | **12 of 18 (⅔)** | 10 of 20 (½) |
| key material erased | **19.020 bits** | 15.850 bits |

Trits differ more often than bits — 2/3 against 1/2 — and leak **less anyway**, because
six positions against ten outweighs the higher per-position rate. But the advantage is
bought: two thirds of a ternary key must be destroyed against half a binary one, and
`AB`'s erasure agrees the wipe is a projection, at 19.020 bits against 15.850. `AO`
already priced what a wipe costs.

#### All four held — and two should not have been registered

This is the part worth keeping, and it is unflattering. `AP1` and `AP2` were genuine
measurements against uncertain outcomes. **`AP3` and `AP4` were arithmetic the
registration itself had already computed** — both sides of the leak comparison are the
closed form `(1 + (b−1)/b)^pos`, and the destruction fractions are `(b−1)/b`. Nothing
in either was ever at risk.

> `AGENTS.md` names this failure directly: *inflating the registered set with facts that*
> *were never at risk turns the discipline into decoration.*

They are recorded as held **and** as registrations that should not have been made. A set
that scores four from four in this corpus is a warning rather than a result — every
finding here worth defending arrived by a prediction being wrong.

#### And the one fact measured before it could be registered

A Lamport key costs `b / ln b` per value, minimised at **b = e**, which puts three ahead
of two by 5.4%. That is asymptotic, and it does **not** hold at every width, because the
position count is an integer: across ten digest sizes, **binary wins at 256 and 1024**,
the two tie at 64 and 4096, and ternary takes the other six
(`F-LAMPORT-BASE-ADVANTAGE-IS-NOT-PER-SIZE`, `PROVEN`).

It was measured while choosing the arena, which is exactly when a fact stops being a
prediction — so it is recorded as unregistered rather than claimed as one.

---

## How it was established

| | |
|---|---|
| tools | [`midrail-price-audit.js`](../tools/midrail-price-audit.js), [`midrail-audit.js`](../tools/midrail-audit.js), [`budget.js`](../tools/budget.js), [`erasure-audit.js`](../tools/erasure-audit.js), [`predict-audit.js`](../tools/predict-audit.js), [`hailstone-audit.js`](../tools/hailstone-audit.js), [`workfactor-audit.js`](../tools/workfactor-audit.js), [`margin-audit.js`](../tools/margin-audit.js), [`selfref-audit.js`](../tools/selfref-audit.js), [`puzzle-audit.js`](../tools/puzzle-audit.js), [`wipe-audit.js`](../tools/wipe-audit.js), [`keylayer-audit.js`](../tools/keylayer-audit.js) |
| tests | `test-midprice.js`, `test-midrail.js`, `test-budget.js`, `test-erasure.js`, `test-predict.js`, `test-hailstone.js`, `test-workfactor.js`, `test-margin.js`, `test-selfref.js`, `test-puzzle.js`, `test-wipe.js`, `test-keylayer.js` |
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
- **That `AD` proves no program can resist a predictor.** It shows that no
  **single-accumulator** program can, because 729 states are tabulatable. A
  program holding live state in memory is outside that argument, and `AD4`
  computes how far outside — but no such program was built or measured.
- **That the tabulator is the best predictor.** It is the one that was
  implemented. A cleverer analysis might do better; `AD` bounds the problem from
  one side only, which is the side that matters for a security claim.
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

### 16. How wide the tree should be, and the answer nobody predicted

A ledger that keeps every transaction has to be able to prove one of them without
shipping all of them, and that is what an authenticated tree is for. The published
constructions branch 256 ways at every node. The question put to this project was
whether it has to be 256 — and whether a machine whose natural ladder is 3, 9, 27, 81,
243, 729 ought to branch by powers of three instead.

`AQ` is a **cost model**, and the distinction matters. It says nothing about whether any
of these trees is secure, and `F-REVERSIBLE-CANNOT-DESTROY` had already settled that a
machine made of bijections cannot destroy a secret, so a trusted-setup ceremony is not
merely unperformed here but **inexpressible**. Every setup-requiring commitment is out
before arity is asked at all. What is left is the ceremony-free shape: an opening whose
size does not grow with the branching factor, and a verification that does.

Three of the four predictions failed.

**Binary is never optimal.** Not once in 2,880 cells. The optimum never descends past
three and never widens as verifying gets more expensive. That part held exactly, and it
is worth stating plainly: for a vector commitment, the binary tree that every hash-based
construction reaches for is the one shape that is never the right answer. In the
hash-based regime the reverse is absolute — `b = 2` wins all 2,880 cells there.

**But three does not beat four. It ties, 21 leaf counts each.** Chasing that tie found
the thing the prediction had been groping at:

> A leaf count of 3^k wants branching factor three, in 15 of 18 cases. A leaf count of
> 2^k wants four, in 13 of 19. **The tree branches in the base its address space is
> counted in.**

**Read that with the constraint it was measured under, which `AR` later lifted.** Every
tree in this sweep has the same arity at every level. Let the arity vary by depth and 25
of these 45 leaf counts change shape — 11 of the 18 powers of three among them — and
`N` = 729 prefers `[4,4,4,4,3]` to six threes, for 0.0178% of the cost. The sentence is
true of *constant* trees and is not a property of trees. The wording above stands because
it is what was found; section `AR` below is the correction, and the finding itself now
carries it (`F-TREE-BRANCHES-IN-ITS-OWN-BASE`, `AR4`, `F-THE-ARITY-OPTIMUM-IS-FLAT`).

The 21-21 tie was a fact about how many of each shape the sweep happened to contain, not
about trees. That is `T-CLAIM-NARROWED-BY-A-DESIGN` for the fourth time — a measured
result stated as a property of the subject when it was a property of the design measuring
it — and it is the fourth time this project has had a prediction fail by counting its own
setup.

The practical reading is the one that answers the original question. **If the address
space is counted in threes, branch in threes.** A ternary machine addressing 3^k leaves
pays nothing for a ternary tree and rounds up for a binary one. The reverse holds just as
firmly, which is why the published 256-ary choice is not wrong — it is right *for a state
space counted in bytes*.

**And 64 is not interchangeable with 256.** 571 of the 909 cells where either is near
optimal have them differing by more than 15%, worst case 149%. But 426 of those 571 are
cells where the two sit at **different depths**: when 256 saves a whole level it wins by
that level, and when it does not it pays four times the verification for nothing. The
question as asked has no answer that does not name the leaf count.

The one prediction that held was registered against the obvious answer. Recomputing every
cost in whole **trytes** rather than whole bytes moves eight argmins — a unit is a scale
factor and a scale factor cannot move an optimum, except that a proof travels in whole
units, and that rounding is a ceiling. It held for exactly that reason, on an effect
thirteen times smaller than the instrument first reported: the registered conversion
divided a *count of operations* by bytes-per-tryte and rounded it, which is a category
error twice over. Caught before scoring, because a 19% unit change cannot honestly move
an optimum from three to six.

The set's own control was worse than that. It gave its two cost terms the same
pseudorandom draw, so the swept exchange rate cancelled out of it algebraically and its
answer was constant in exactly the dimension being measured. **It could only ever agree.**
That is a new defect class — `T-CONTROL-CANNOT-DISCRIMINATE` — and the honest remedy was a
second control, declared post-hoc and scoring nothing, which does move: seven distinct
optima and 131 backward steps, against the vector regime's smooth descent and zero.

None of this is `bitblock` evidence and it does not try to be. That project's
authenticated-state plan admits a Verkle candidate only after a descriptor freezes the
scheme, arity, curve, proof sizes and setup assumptions, and says plainly that outside
measurements are research *inputs*. This is such an input: the arity line of that
descriptor now has a sweep behind it instead of an inherited constant.

### `AR` — and then the arity was allowed to vary, and the headline dissolved

`AQ` costed trees that had **one width**. Every leaf count in it was matched against a
single branching factor repeated all the way down, and its answer — a tree branches in
the base its address space is counted in — is a statement about that family. Real
address spaces are not clean powers of anything, so the question `AQ` could not reach
from inside itself is whether a tree that is one width at the top and another below sits
against the ceiling more tightly than any constant can.

It does, and the first thing to say is what it costs to say so. **Order is free.** In
this model a sequence's total depends on it only through the multiset of its arities —
in fact only through the depth and the sum — because the levels' weights add. "Three at
the top and nine below" costs exactly what "nine at the top and three below" costs. There
is no schedule to choose, only a multiset, and the whole search collapses onto one
quantity: the least sum of `d` factors whose product covers `N`. That is
`F-RADIX-ORDER-IS-FREE`, and it is proved rather than swept, which also fixes the scope:
a cost that is order-*sensitive* — a verifier caching the top levels, an update path
priced differently from a read — is a different model and nothing here bounds it.

**Three of the four predictions held and the fourth inverted.** The flexibility is worth
less than a sixth at every one of 68,408 cells — worst 12.30% at `N` = 257 — and worth
3.15% at the median (`AR1`). The staircase flattens: the largest single-leaf cost jump
falls from 11.97% to 4.00% (`AR2`). And it helps **85.7%** of leaf counts, not a handful
(`AR3`) — the prediction the registration said it could not call, registered against a
hand sample of six of which four pointed the other way. The sample was drawn at powers,
which is exactly where a constant tree needs no help.

**`AR4` failed, and it failed inverted.** It predicted the optimal tree would get deeper
more often than shallower, reasoning that per-level slack is what a sequence exploits and
there is more of it where there are more levels. The measurement is 3,580 shallower
against 2,176 deeper. The mechanism was backwards:

> A varying tree buys the **same verify budget in fewer levels**. The quantity the
> exchange rate is charged on is never larger than the constant tree's, it is *identical*
> at 2,861 of 7,169 leaf counts, and 1,836 of the 3,580 shallower cells are of exactly
> that kind. **The slack removes a level rather than adding one.**

That mechanism is what overturns `AQ`. If a sequence can reach the same verify budget in
fewer levels, then the constant tree's arity was never a preference — it was the only way
to reach that budget while every level had to agree. Admit sequences and **25 of `AQ`'s
45 leaf counts change shape**, including **11 of the 18 powers of three**, which is
`AQ`'s own headline case. `N` = 729 wants `[4,4,4,4,3]`, not six threes.

**And the change costs 0.0178%.** That is the finding a descriptor author actually needs.
Where `AQ` read a preference, the surface is flat to four decimal places: the median
shape change is worth 0.0251%, and 13 of the 25 are worth under half a percent
(`F-THE-ARITY-OPTIMUM-IS-FLAT`). "A tree branches in the base its address space is
counted in" is true of *constant* trees and is not a property of trees.
`T-CLAIM-NARROWED-BY-A-DESIGN`, fifth bite, and the second time this one class has taken
a bite out of the same sentence.

The structure underneath is simple enough to state in a line. Across 42,700 levels of
7,169 optimal trees exactly **three arities ever appear** — four takes 69.0% of levels,
five 22.1%, three 8.9% — and a leaf count is helped by variation **exactly when its own
optimal tree is not constant**, with no exceptions in 7,169
(`F-VARYING-HELPS-IFF-THE-OPTIMUM-IS-NOT-CONSTANT`). In the merkle regime variation buys
nothing at all, and that one is proved: `b - 1 >= log2(b)` for every integer arity with
equality only at two, so the all-twos tree attains the floor
(`F-MERKLE-WANTS-BINARY-AT-EVERY-LEVEL`).

**The control is where this set spent most of its honesty.** `AQ`'s could not
discriminate because its two cost terms shared a draw; this one drew them independently
and still failed two of its three registered responsiveness assertions — its frozen seed
happened to put its cheapest arity at 604, wide enough to cover any swept leaf count in
two levels, so repeating that one arity is optimal everywhere and variation cannot help
it *by construction*. `T-CONTROL-CANNOT-DISCRIMINATE` a second time, from degeneracy
rather than algebra. The remedy, post-hoc and scoring nothing, is `AO1`'s lesson applied:
a **null over 100 redraws** rather than one frozen object. Only 4 of 100 draws gain at
all; median and 95th percentile are exactly zero; structureless costs help 0.83% of
draw-by-leaf pairs against the vector regime's 85.7%.

That null also disarms `AR1`. **Its tail reaches 23.7% — above the subject's worst cell.**
So noise can produce a bigger *maximum* than structure does, and `AR1`'s bound
discriminates nothing on its own. The hundredfold gap in *frequency* is what shows the
effect is real. A magnitude registered without a null beside it would have read as
evidence and been none.

One more thing the record should carry, because it decided a verdict. `AR1`'s line was
registered at 15% rather than 10%, with the reason written down before the run: a hand
case at `N` = 11 came in at 9.99%, and a criterion decided by the third decimal of a case
already in hand teaches nothing. The run measured 12.30%. **A 10% line would have
failed** — so the discipline of refusing a threshold near a known value is not
housekeeping, it changed the answer.

One scope note, because the registration left it ambiguous and the ambiguity is the
kind that decides verdicts. `AR2`, `AR3` and `AR4` say "the verify-dominated rate" in
prose while the sweep is described at eight decade boundaries; the registered code pins
them to 10^3.875, which is not one. The code decides the scope, and whether that mattered
is measured rather than argued: rerun at the nearest decade and the three verdicts are
identical — 85.7% helped, 2,176 deeper against 3,580 shallower, and a jump ratio of 0.337
against 0.334. A check pins that, so it cannot start mattering later.

For `bitblock`'s descriptor the reading is narrower than `AQ`'s was and more useful.
Freezing a single arity costs about 3% against the best per-level schedule and never more
than a sixth, so the one-arity line is defensible; but *which* arity it names is
under-determined by this model to four decimal places at the leaf counts where `AQ`
seemed to have an answer, and should be decided on grounds this cost model does not
contain.

### `AS` — the ledger head attacked instead of counted, and the 840 turns out to be a 7

`ledger-audit.js` published two numbers and left a hole between them. The summed head
accepts **all 21,840** compensating forgeries of one six-entry ledger; the split-round
mixer accepts **26**, against a chance rate of 29.96 (`F-FINDABILITY-NOT-COUNT`). That
file says in its own header what it does not measure: `AN2` showed the mixer's
feed-forward collapses, and in the ledger direction the step is `g(a + e) + a` with the
accumulator fed forward rather than the entry. Whether that residual gives a forger
anything was left open, and 26 against 30 is an unexamined number a design was resting
on. Set `AS` designs four attacks, prices them, and asks.

**First, two things the algebra settles before any measurement, both checked
exhaustively anyway.** With `g(u) = P(u) − u`, the step is `a + g(a + e)`, and
substituting `u_k = a_{k−1} + e_k` — triangular, therefore invertible — gives
`head = g(u_1) + … + g(u_L)`. **The mixer's head is a commutative sum in disguise**, over
a reparametrisation of the entries (`F-LEDGER-CHAIN-IS-A-SUM-IN-U`). And because `P` is a
permutation, every step is a bijection *in the accumulator*, so a forgery touching
positions `i` and `j` preserves the head exactly when the accumulator after `max(i, j)` is
restored — 218,400 of 218,400 agreements, with 274 accepts among them so the agreement is
not vacuous. A forger never evaluates the tail, and can walk the chain **backwards** from
a target head. That is what makes the fourth attack possible at all.

**And one correction to the published sweep.** `forge(E, i, j, d)` and
`forge(E, j, i, −d)` are the same forged ledger, so the 21,840 ordered tries are **10,920
distinct forgeries and the 26 accepts are 13** (`F-COMPENSATING-SWEEP-DOUBLE-COUNTS`).
Ratios are unaffected — 29.96 is double-counted the same way — but dispersion is not: a
perfectly Poisson process scored over a doubled count shows a variance-to-mean ratio of 2.
Every count in `AS` is over distinct forgeries.

**`AS1` HELD. The 26 is the mixer, not the ledger.** Over 2,000 drawn ledgers and
21,840,000 distinct forgeries the mean is **15.111** against a chance of 14.979, the
variance-to-mean ratio **1.018**, and the worst ledger of the 2,000 accepts **30** against
a registered line of 40. There is no weak-ledger class. The 17% preimage spread
`F-MIXER-HEAD-IS-NOT-FLAT` measured at length two does **not** reach the six-entry
forgery neighbourhood — had it, the registered arithmetic put the ratio at 1.43 and the
line at 1.25 would have fired. Two further structural cuts were looked at and neither is a
lever: no merge distance and no carry pattern accepts above 1.05× chance, so the
arithmetic-versus-tritwise group mismatch a forger might have exploited buys nothing.

**`AS2` HELD, and wider than expected. There is no differential to exploit.** The
differential table of `g` over all 530,712 non-zero-input cells has a **maximum of 8**,
against a registered line of 27. The Feistel's free two-round characteristic — probability
one in the mod-27 group, four windows in eight rounds — does not survive into the tritwise
metric at all. What makes the verdict readable is the control: over twelve random
permutations the same statistic runs **7 to 9**, and the empty-cell fraction is 36.81%
against `g`'s 36.74%. **`g` is not distinguishable from a random permutation's residual
here.** The affine map of set `AN` returns 729 on the same statistic, which is what says
it could have reached the hundreds.

**`AS3` HELD, and it was the one the registration said it could not call.** A
meet-in-the-middle join modifies entries 1, 2, 5 and 6, pushes the left half forward to
the accumulator after entry 4 and pulls the right half **backwards** from the head, then
joins on (accumulator, arithmetic partial sum). Ideal yield 531,441; measured **532,485**,
a ratio of **1.0020**, and every one of eight further ledgers inside [0.9986, 1.0015]. The
failure mode was live rather than hypothetical: the halves really are sparse — 335,881 and
335,763 of 531,441 keys occupied — so had their reachable sets coincided the join would
have returned the sum of squared counts, which the tool measures at **2.0003** for this
very table. It does not. The non-flatness is real and is not cashable.

**`AS4` HELD at 0.4506 against a line at 0.5, and it carries the mechanism.** For an
adjacent position pair, an accepted forgery **is** the realisation of a two-round
differential of `g`: with `A` the change the first edit makes to the accumulator and `t`
the input difference it induces at the second, acceptance is exactly `g` realising
`t → −A` at that ledger's own `u`. So a forger can rank deltas by the table before
spending anything on the chain, and ranking that way finds the first accepted delta at
mean rank **137.49** against a uniform order's **305.16** — bootstrap 95% [0.4425, 0.4589],
and two further seeds at 0.4495 and 0.4566, none of them reaching the line. `AN1`'s
finding that this mixer came in *more uniform than chance* was the registered route to
failure and it did not transfer.

**The one thing in this set that is a certainty rather than an average.** A delta whose
differential cell is empty **cannot** be accepted: **0 accepts in 2,669,929 tries**, which
is 36.67% of the family discarded for free. The accept rate then rises linearly with the
cell — 0.98, 1.97, 3.07, 3.74, 5.65, 5.40 and 6.65 times chance at cells one through
seven — and the top 8.04% of deltas carry 26.86% of the accepts
(`F-EMPTY-DIFFERENTIAL-CELLS-CANNOT-ACCEPT`). **That is a forger beating chance: not on
the family average, which is exactly chance, but on a band the table names in advance.**

**And the answer the ledger question actually turns on, which no prediction claimed
because it follows from `AS3` and the cost model.** Brute force over the same
four-position family accepts at chance and costs **4,414 ops per accepted forgery**. The
join enumerates the whole family at **6.99 ops per forgery** for 2,125,764 table slots — a
**632× cut**. The summed head needs no search at all, about one op. So, priced rather
than counted, **the mixer's advantage over the sum is a factor of about seven, not the
840 a per-try collision rate suggests** (`F-MITM-PRICES-THE-MIXER-AT-SEVEN-OPS`). The 840
is a fact about a family with one free parameter, where a single constraint costs a single
tryte of search whatever the accumulator is. Give the forger four entries and the enabling
property is not the mixer's algebra but **its width**: nine and a half bits of
accumulator, so the state space squared fits in two million slots. The attack uses nothing
about the split round and would work against any iterated head this narrow.

**What this does not show.** One ledger length, one join split, adjacent pairs only for
the differential work, and a brute-force baseline that is sampled at 3,000,000 of
387,420,489 candidates rather than exhaustive. `AS2` bounds one table's maximum cell and
says nothing about a multi-round characteristic; nothing here searches for one. And no
attack in this set touches the ledger's *length* — every forgery keeps six entries, so
insertion and deletion are unexamined.

**And the unexamined surface is measured rather than left as silence, because silence
is how the 26 got here.** `P` has exactly **one fixed point**, so exactly one `u` has
`g(u) = 0`, so from **every one of the 729 accumulators there is exactly one entry value
that leaves the mixer head unchanged** — verified at all 729 rather than argued from the
fixed-point count (`F-EVERY-ACCUMULATOR-HAS-A-NO-OP-ENTRY`). A forger who may *insert*
an entry has that free move at every position of every ledger. The value is forced, so
the arithmetic total moves and the insertion has to be paid for elsewhere; that is a cost
rather than an obstacle, and nothing here measures it. The same object read the other way
is `g`'s image: 465 of 729, so 264 accumulator increments are unreachable in a single
step.

**For a design downstream, the reading is a width statement rather than a mixing
statement.** A one-tryte head is not a ledger head against an adversary who can hold two
million table slots, and no amount of mixing repairs that, because the attack that breaks
it never looks inside the mixer. `AS1` through `AS4` say the split round is doing
everything a 9.5-bit permutation-based head can do — it is indistinguishable from a random
permutation on every statistic tried — and `F-MITM-PRICES-THE-MIXER-AT-SEVEN-OPS` says
that is worth a factor of seven over adding the entries up.

### `AT` — the forger is allowed to LENGTHEN the ledger, and the price collapses to two entries

`AS` left this route open by naming it. `P` has exactly one fixed point, so from every one
of the 729 accumulators there is exactly one entry value that leaves the mixer head
unchanged, and **every forgery in `AS` keeps the ledger at six entries**, so not one of
them can use it. `AT` prices the forger who may lengthen it.

**The class, stated because it is strictly larger and the difference is qualitative.** The
ledger publishes **both** heads — the arithmetic total and the mixer head — and a forgery
must reproduce both. `AS` never had to say that out loud because its family preserved the
total by construction. `AS`'s forger edits in place at a fixed length over a family of
10,920. This one may insert at any of the L + 1 gaps, delete any subset, and rearrange, so
**the family is unbounded**, and "how many forgeries" stops being a question with a finite
answer. That is why the cost model carries **two currencies, stated before the run**: `AS`'s
operation, so the two sets are comparable, and **growth** — entries added — which nothing in
this repository converts into operations. Both are reported and no exchange rate is
invented. And the precondition, which is not a cost: **this forger exists only where the
verifier does not authenticate the ledger's length.**

**The answer, and no prediction claimed it.** There are exactly **three pairs of entry
values — (136, −136), (295, −295) and (362, −362) — each of which, prepended to any ledger
of any length, leaves both heads unchanged.** Two added entries, **zero operations**, no
knowledge of the ledger's contents, precomputable once for the mixer rather than per
ledger, verified by rebuilding both heads on 420 drawn ledgers across seven lengths
(`F-A-UNIVERSAL-TWO-ENTRY-INSERTION-FORGERY`). The mechanism is one sentence: the
accumulator before the first entry is the tritwise identity on *every* ledger, so gap zero
is one fixed accumulator every ledger stands on; inserting `x` then `−x` there returns the
accumulator exactly when that accumulator is a fixed point of `a → STEP[STEP[a][x]][−x]`,
which by `AS`'s D3 is a permutation for every `x`. Across all 729 accumulators the number
of `x` fixing each sums to 741 — a mean of 1.0165 — and **256 accumulators admit none**, so
a pair need not have existed; the random-permutation control's identity accumulator admits
**zero**. This one admits three.

**`AT1` HELD. The no-op-only route costs about five entries and nothing else.** An
insertion that must leave the mixer head alone has a *forced* value, one per gap, so an
insertion-only forgery is exactly a non-empty multiset of the seven forced values summing
to zero in Z₇₂₉ — a shortest cycle on a 729-node Cayley graph, which is a breadth-first
search and not a search over forgeries. Over 2,000 ledgers the exact minimum has mean
**4.934** against a registered band of [4.0, 6.0], and the worst of the 2,000 needs **10**
against a line at 12. The uniform-generator null measures 4.966 and a random-permutation
chain 4.911, so **the seven forced values are not distinguishable from seven independent
uniform draws.** The order census looks like structure and is not: 414.96 per 729 at order
729 against a null 486 is entirely the gap-zero generator counted once per ledger, and
removing it leaves (4708 − 2000)/12000 = 0.2257 against a null 0.2222. **The interesting
end is the left one** — 18 of the 2,000 ledgers have a minimum of **1**, and those are
exactly the chains that stand on the fixed point `u*` at some gap, where the forced value
is arithmetically zero and a single inserted entry forges both heads.

**`AT2` FAILED, on one leg of four, and the failure is arithmetic I did myself.** Three
legs held: the mean minimum is strictly decreasing at every one of the ten steps from
length two to length twelve, 13.592 at two is above 9.0, and 3.3625 at twelve is below 4.5
— and the whole curve tracks the uniform null — within 0.64 at length two and within 0.17
from length three on — so **a longer ledger really is cheaper to forge by insertion**, for the counting reason and not a
structural one. The fourth leg registered a bound on a **maximum** using a heuristic that
is only about a **mean**. The measured worst is **146** against a registered 100. Drawn
directly, the uniform null exceeds 100 in 22, 25 and 33 of 50,000 draws at three seeds, so
2,000 draws expect about one and **the line had roughly a 58% chance of firing on the null
alone**; the null's own maximum is 243 at every seed. **No claim is made that the subject's
tail is heavier than chance** — 146 against a single-draw null maximum of 81 is two samples
from one heavy tail. `T-CRITERION-IN-THE-NOISE`, fourth bite, in the form that needs no
run-to-run variation at all.

**`AT3` FAILED by 0.012, and the miss is where the universal pair was found.** The
two-free-insertion family is 28 gap pairs × 729 free values, the second value forced by the
arithmetic total: 20,412 candidates, registered chance 28.0. Measured **30.0120** over
distinct forged ledgers — seventeen standard errors out, so the **line** was fine and the
**chance value** was wrong. Broken down by gap distance the entire departure sits in one
cell: distance zero reads 1.296× chance and every other distance is within 2.3% of 1.0.
Gap zero is not a draw from the mean-one distribution above, it is **one number every
ledger inherits**, and here it is 3. The family's true expectation is
gapPairs − 1 + c(ZERO) = **30**, and the measurement sits 0.012 from it. The control
settles it: a random-permutation chain has c(ZERO) = 0, true expectation 27, measured
27.1865. **The fact that breaks the 28 was written into this set's own registration two
hundred lines above the prediction** and the connection was not made. Half (b) held
outright: **0 of 2,000 ledgers admit any deletion-only forgery** over all 63 subsets,
against a chance of 0.237 — 173 of 126,000 subsets preserve the mixer head and 190 preserve
the total, both at chance, and none does both. **Deletion has no free parameter**, and that
asymmetry is the whole result.

**`AT4` HELD, and its control is a certainty rather than a statistic.** Every rearrangement
preserves the arithmetic total exactly, so **the summed head accepts 1,426,480 of
1,426,480** — every single one. On that family the mixer stands alone, and it stands at
exactly chance: **1,907 accepts against 1,956.76**, a ratio of 0.9746, variance-to-mean
1.0392, worst ledger 6 against a line at 10. The registered route to failure was `AS`'s own
D2 — this head is a *commutative sum* of `g`-values in the reparametrised variable, and a
commutative sum does not care about order. It does not transfer, because the change of
variable is triangular; had it transferred the count would have been 1,438,000. The
length-preserving sub-family, which is what a verifier that *counts* entries still faces,
is 49,903 distinct moves accepted 65 times against a chance of 68.45.

**What an insertion costs, in both currencies, against `AS` cited rather than re-run**
(`F-INSERTION-IS-PRICED-IN-LENGTH-NOT-IN-SEARCH`):

| attack | operations | growth | knowledge needed |
|---|---|---|---|
| the universal pair | **0** | **+2** | none at all |
| the universal prepend run | 0 | +243 | none at all |
| shortest no-op run (`AT1`) | ~5,100 | +4.93 | the ledger's accumulators |
| two free insertions (`AT3`) | ~2,380 | +2 | the whole ledger |
| `AS` brute force, edits only | 4,414 | 0 | the whole ledger |
| `AS` meet in the middle | 6.99 | 0 | + 2,125,764 slots |
| the summed head, edits only | ~1 | 0 | a compensating pair is free |

**So the factor of seven does not survive the enlarged class.** `AS` established that
pricing rather than counting makes the mixer worth seven operations over a summed head
against a forger who may only edit. Against a forger who may insert, **the mixer's search
cost falls to zero** and the entire remaining defence is whether anyone counts the entries.
That is a statement about the *verifier*, not the accumulator — the same shape as `AS`'s
own conclusion that this is a width question rather than a mixing question, one level
further out.

**What this does not show.** Uniform entry distributions only; a real ledger of small mints
and burns walks the accumulator differently. Six-entry rearrangements only, which is the
largest length whose permutations can be swept exhaustively at this ledger count. And the
universal pair is a property of `D`'s permutation, not of narrow iterated heads in general
— the control chain has none, and 256 of 729 accumulators admit none. What *is* general is
that **gap zero is never a random accumulator**, so any statistic averaged over gaps
inherits one fixed cell.

**And the surface this set leaves open is measured rather than named, because silence is
how the last one waited.** A forger who pays for one insertion with one compensating
**edit** has no free parameter left — the inserted value is forced by the gap and the edit
by the total — so the family is 42 candidates per ledger. Over 500 ledgers it accepts 28 of
20,970, **0.973× chance** (`F-THE-HYBRID-INSERT-AND-EDIT-IS-EXACTLY-CHANCE`). Named and not
measured: **three or more free-value insertions**, a 729^(k−1)-parameter family that an
`AS3`-style meet-in-the-middle would price and this set does not build; insertion against
structured rather than uniform entries; and any family that edits more than one entry
alongside an insertion. The k ≥ 3 route is the one worth taking next — two insertions
already yield 30 forgeries per ledger, and a third multiplies the parameter space by 729
while adding one constraint.

**A disclosure added after the fact, and neither outcome is changed.** Set `AU` established
that a criterion sitting in the noise leaves *no signal at all* when it lands inside its
band, so this corpus records the defect only when it happens to fail
(`F-A-LINE-IN-THE-NOISE-THAT-PASSES-IS-THE-SAME-DEFECT`). Turned on `AT`'s own twelve legs,
it fires on two — and one of the two is a leg that **held**.

**`AT1`'s maximum leg was never measuring the subject.** It registered "no ledger of the
2,000 needs more than 12" and measured **10**. The uniform null's *most likely* maximum over
2,000 draws is **also 10**, at probability 0.32; P(a null maximum exceeds 10) = 0.29,
exceeds 11 = 0.12, exceeds 12 = **0.077** with a 95% interval of [0.044, 0.109] over 500,000
draws carrying 20 exceedances. Re-run at twelve seeds the subject's own maximum spans
[9, 13] and **crosses the registered line at two of them**. The measured value is the null's
modal outcome and the line sat one step above where chance lands anyway.

**And `AT2`'s maximum leg — which failed, and became a counted bite of
`T-CRITERION-IN-THE-NOISE` — sits forty lines above it in the same registration.** Same
author, same day, same error: a bound on a maximum placed by reasoning about a mean. One is
in the corpus and one was invisible until `AU` supplied the rule that found it. So the count
for this class is **the number of times it produced a visible failure, not the number of
times it happened** — the noticing was done by the outcome rather than by anyone looking,
and every criterion equally in the noise that landed inside its band was written down as a
clean HELD. That makes the recorded bite count a lower bound of unknown size, and it points
at the **held** column as the place to look, which inverts this project's own habit, since
[`METHOD.md`](../METHOD.md)'s argument rests on the failures being where the value is
(`F-THE-BITE-COUNT-IS-WHAT-FAILED-NOT-WHAT-HAPPENED`).

**`AT3` is the benign case, and it is what makes the malign one legible.** Its verdict is
seed-dependent too — the mean lands outside the registered band on five of twelve seeds and
inside on seven, and the derivation says it had to be about half, since the true mean is the
corrected chance of 30 and the line sits at 30.0 with a standard error of 0.1185. But all
twelve means lie within **0.271** of `gapPairs − 1 + c(ZERO) = 30`. The criterion decided
which word went in the outcome field and **never touched the mechanism**. A line in the
noise corrupts a verdict; it does not automatically corrupt a finding, and telling those two
apart is what a reader needs.

**Both outcomes stand: `AT1` HELD, `AT3` FAILED.** The registered run is the run, and an
outcome fixed at the results commit is the only property of this record a later edit cannot
fake. What changes is what those two legs are worth as evidence, which is nothing.

**The diagnosis discriminates, and that is on the record beside the two that fired.**
`AT4`'s maximum leg was swept the same way at the same twelve seeds and crosses its line at
**none** of them, spanning [5, 7] against a line at 10; `AT1`'s *mean* leg sits 31.4 standard
errors from its nearest band edge. Ten of the twelve legs are clear.

**And the remedy has the same floor one level up, which is left in rather than corrected
away.** The first version of this disclosure put the null's exceedance probability at
**3.9%**, estimated from 50,000 draws containing exactly *one* exceedance — a tail read off a
single observation, written into the disclosure about reading tails badly. Drawn at 500,000
it is 7.7%. The antibody is that `tailNull` now returns a confidence interval with every
estimate, so an exceedance rate resting on a handful of draws announces itself instead of
being quoted as a point. The shortest-run statistic behind all of these numbers also has a
**second implementation** now — iterated Minkowski sums over a 729-element reachability set,
sharing no code with the breadth-first search — agreeing on 4,000 of 4,000 random generator
sets and on every real ledger the disclosure is computed over.

**And set `AU` found the same class from both sides, which is what makes it a class rather
than an accident.** Three of its legs are criteria the run *can* move — `AU1`(a) at width
two, `AU2`(c) at width three and `AU3`(c)'s slope gap, all within 0.005 of their band, all
of which **held**, two of which straddle on reseed. That is `AT1`'s shape exactly, three
more times. And one of its legs is a criterion the run *cannot* move: `AU2`(b)'s band was
drawn round the birthday law's **asymptotic** exponent, and six points spanning 2.4 decades
do not measure an asymptote — on three of the seven windows that sweep could have chosen,
**the ideal object itself** scores under the band's lower edge
(`F-A-BAND-DRAWN-ROUND-AN-ASYMPTOTE-THE-WINDOW-CANNOT-REACH`).

**So the class has two halves and one consequence.** A criterion **in the noise** is one the
draw decides; a criterion **round a limit** is one nothing can satisfy; and **the corpus
records neither unless it happens to fail.** Underneath both is one mistake — a line placed
by reasoning about a limit rather than about the thing being measured — and an asymptotic
exponent, a tail integrated from an approximation fitted to its centre, and a chance value
computed as though every gap were a random accumulator are three faces of it. The remedy
this repository already applies to null models applies to criteria as well: **compute it at
the width, the length and the seed you are actually measuring, and not in the limit.**

### `AU` — the remaining lever is WIDTH, and it buys one currency and not the other

`AS` and `AT` between them measured the accumulator's **mixing** twice and found it worth
approximately nothing: priced rather than counted, the split round is worth seven
operations a forgery over adding the entries up, and a forger who may lengthen the ledger
gets a forgery for two entries and no search at all. Both results end in the same
sentence — **this is a width question, not a mixing question** — and nobody had measured
what width buys.

**The answer in one line, and it is not the one the fitted laws give.** About **two heads
in three at every width from 27 states to 729** admit a two-entry, zero-operation,
zero-knowledge forgery, and width six is no rarer than width three. `AT` found one such
head and called it a property of `D`'s permutation; over 400 drawn heads per width it is
the **typical** case. That is the difference between a law with an exception and a law
that describes the minority. The two cost laws below say what width buys where no such
shortcut exists — the state count against a forger handed a ledger, its square root
against one who may choose both — and they are the second finding here, not the first.

**The family is a design decision and nothing about it is at risk.** `D`'s mixer is
defined on 729 states and nothing narrower or wider exists, so the sweep needs a family:
widths **1 to 6 trits**, 3 to 729 states, all exhaustively enumerable. The step is `AS`'s
D1 at every width — `a' = perm(a + e) − e`, tritwise over GF(3)^w — with the summed head
arithmetic over Z_(3^w), and the ledger's entries, its total and its head all narrow
together. The subject family is a **random permutation conditioned on exactly one fixed
point**, because an entry is a no-op at an accumulator exactly when their tritwise sum is
a fixed point of the head, so a head with none has no insertion family at all and `D`'s
`P` has exactly one. That is not a lucky draw and the corpus already knew it: `D`'s own
`F-ALWAYS-ONE-FIXED-POINT` establishes the split-state construction has **exactly one fixed
point for every round table**, structurally — the state with L = R and round(R) = 0 is fixed,
and the round table being a permutation sends exactly one R to zero — where an unconditioned
random permutation would have none about 37% of the time. So the conditioning is what makes
the null family comparable to the subject, and `AU4` is where it turns out to cost something.

`AS` and `AT` had already measured the split round as indistinguishable from a random permutation on five separate statistics at 729 states, so
a family of random heads isolates width as the only varying parameter — and the widened
split round is run at widths 4 and 6 as the anchor that says the law is not a law about
the generator.

**The anchor, because this tool is a second implementation of a chain that already
exists.** At width six the widened split round reproduces `D`'s 729-entry table with zero
mismatches, the width-parametric `STEP` equals `ledger-audit.js`'s **cell by cell over all
531,441**, `AS3`'s join returns **532,485** matches at ratio **1.0020** and 3,720,087
operations through the new code path, and `AT`'s **c(ZERO) = 3** comes back with witnesses
136, 295 and 362, profile total 741, 256 accumulators admitting none, canonical run 4 and
prepend run 243. The same exact-birthday routine returns **34.5100** at 729 digests and
**914.3328** at 531,441 — the two figures `ladderlang`'s `HASH27.md` registered its two
widths against, so two documents cannot disagree about one object.

**`AU1` HELD. The ops currency is linear in the state count, and width buys the forger's
MEMORY rather than his time.** The first accepted compensating forgery arrives at index
3.000, 8.372, 27.854, 82.058, 241.540 and 702.564 against exact finite-family nulls of 3,
9, 27, 81, 243 and 729 — **the state count itself, at every width** — and none of the 5,760
scans exhausted its family. `AS`'s meet-in-the-middle join returns between **0.9933 and
1.0105** of ideal at widths two to six, so its amortised cost is **6.94 to 7.17 operations
per forgery at every width**: the 6.99 `AS` measured is not a fact about 729 states. What
grows is the table, `4N^2` slots, **36 at width one against 2,125,764 at width six** — a
factor of 59,049 across five trits while the cost per forgery does not move
(`F-WIDTH-BUYS-THE-FORGERS-MEMORY-NOT-HIS-TIME`). All **20,199** rebuilt joined keys
reproduce both heads. The split-round head sits inside the random family's range on both
statistics at widths four and six.

> **And one leg of it is not evidence, which is the set's own antibody.** `AU1`(a) held at
> width two by **0.0002** — 0.9302 against a line at 0.93 — and redrawn at four seeds the
> same statistic gives 0.9684, **0.9243**, 1.0275 and 0.9693, one of them below the line.
> `T-CRITERION-IN-THE-NOISE`, **fifth bite, and the first on a line that PASSED.** The four
> earlier bites were every one of them found because a criterion *failed*; a criterion in
> the noise that passes leaves a green check, a `HELD` in the manifest and no signal at
> all. The remedy has to run on passes too, and now does
> (`F-A-LINE-IN-THE-NOISE-THAT-PASSES-IS-THE-SAME-DEFECT`).

**`AU2` FAILED, on a statistic that does not exist — and the two legs that held are the
set's sharpest result.** The forger who may choose *both* ledgers pays the birthday price:
the first colliding pair of equal-total length-two ledgers arrives at 4.394, 7.523, 12.026,
20.244 and 34.296 against exact finite-N birthday expectations of 4.4583, 7.1981, 11.9577,
20.2105 and 34.5100 — ratios of **1.0057, 1.0017 and 0.9938** at widths four, five and six,
with **zero collision-free rows in 25,272 scanned**. Fitted against the state count the
two attacks give slopes of **0.4642** and **1.0031**.

> **And the collision slope is better than the registered band made it look, which two
> readers found and this file reproduced before accepting.** The band [0.45, 0.55] was
> drawn round the birthday law's **asymptotic** exponent, and six points spanning 2.4
> decades do not measure an asymptote: the exact expectation is about `√(πN/2) + 2/3`,
> and an additive term lifts the small-N points hardest. Fitted over the registered window
> of widths 2 to 6, **the ideal object's own slope is 0.4665** — so the measured 0.4642
> sits **0.0023 below the ideal null**, agreement to half a percent, rather than 7% below
> a limit nothing here can reach. The verdict does not move: 0.4642 is inside the
> registered band and leg (b) HELD, scored against the null that was registered.
> **The defect is that the band was drawn round that limit at all.** On three of the seven
> windows this sweep could have used — 1..5, 1..4, 2..4 — the exact null's own slope is
> 0.4439, 0.4315 and 0.4490, *under the band's own lower edge*, so a perfectly ideal head
> would have failed. It is a property of the window and not of the family: 0.4770 out to
> width 8, 0.4877 to 12, 0.4950 to 20. That is `T-CRITERION-IN-THE-NOISE`'s cousin rather
> than another instance — a criterion the run *cannot* move, because the null misses it
> too — and the remedy is the one this repository already applies to null models, pushed
> one step out: compute it at the width you are measuring, not in the limit
> (`F-A-BAND-DRAWN-ROUND-AN-ASYMPTOTE-THE-WINDOW-CANNOT-REACH`). The second-preimage null
> needed no correction; its own slope is 1.000000 on every one of the seven windows.

> **So the two attack goals separate by exactly one square root, and the separation is
> measured rather than assumed** (`F-THE-TWO-ATTACK-GOALS-SEPARATE-BY-ONE-SQUARE-ROOT`).
> The birthday law prices a collision. A ledger forger is handed a ledger and needs a
> second preimage. Read as a design rule the birthday number demands **twice the width**
> the second-preimage forger actually costs.

Leg (c) failed at width one, and it fails *because of* the mechanism it was asserting: the
row map there is injective, so the measured scan finds no collision in any of 72 rows
**and the reshuffled null finds none in any of 14,400**. The ratio is 0/0. The registration
named width one as degenerate in this very statistic's rationale and then included it in
the leg anyway. At widths two and three the leg held — 1.0208 and 1.0492 — so the
narrow-end shortfall really is a *multiplicity* effect and not an ordering one; the
width-three value sits 0.0008 inside its line and is reported as thin.

**`AU3` HELD. Growth is nearly free of width, and length beats width.** The shortest
insertion-only forgery costs 1.0640, 1.4951, 2.0714, 2.7989, 3.8172 and 4.9607 entries,
tracking `AT`'s counting heuristic to within **0.0887 at every width** against a registered
0.30 — so a heuristic checked at one width predicts the whole sweep, at both ledger
lengths. `AT2`'s registered failure route runs here where it must be largest and still
does not fire: at width one a seven-gap chain visits only **2.822** distinct accumulators
of seven, so five of the seven forced generators are duplicates, **and the duplication
costs the forger nothing** — 1.064 against a null of 1.097. The fitted slope is **0.2812**
against 0.5 for the birthday law and the measured 1.0031 for the ops law:

> **Five more trits multiply the state count by 243 and the growth cost by 4.66.**

And at ledger length twelve the slope falls to 0.2266, a gap of 0.0545 — adding gaps
defeats width faster than width defends against gaps. That last leg is also a line in the
noise: three further seeds give gaps of 0.0494, 0.0441 and 0.0597, two of them under the
registered 0.05. The *direction* is stable at every seed and the size of the gap is not.

**`AU4` FAILED at width two — on the head family this set chose, not on width, and the
control run beside it is what says so.** `AT` found three universal pairs at 729 states and
said in its own results that the universal pair "is a property of `D`'s permutation, not of
narrow iterated heads in general", on a control sample of one. Over 400 random heads at
each width, the fraction admitting at least one is 1.0000, **0.5275**, 0.6075, 0.6625,
0.6000 and 0.6450; the registered band was [0.56, 0.70] and width two is outside it, as is
its accumulator fraction of 0.45833 against [0.335, 0.395]. **The unconditioned family at
the same nine states reads 0.6450 and a mean c(ZERO) of 0.9650**, comfortably where the
closed form says. So the failure is the *conditioning* — the design choice that makes a
head comparable to `D`'s `P` at all — and at nine states one constraint is a ninth of the
object. `T-CLAIM-NARROWED-BY-A-DESIGN`, and for the first time caught by a control rather
than by a reader.

> **The answer survives its own failure.** From 27 states up, **about two heads in three
> at every width admit a two-entry, zero-operation, zero-knowledge forgery**, and width six
> is not rarer than width three (`F-WIDTH-DOES-NOT-KILL-THE-ZERO-OP-FORGERY`). The
> quantity's mean does not depend on the state count — `a → STEP[STEP[a][x]][−x]` is a
> permutation for every `x`, so the count of `x` fixing the identity accumulator has mean
> one whatever N is — and a quantity whose mean does not depend on N cannot be driven down
> by raising N. In the operations currency width is worth its own state count; against this
> family it is worth nothing at all.

### And one defect the sweep found in its own construction, which transfers

**Widening a construction can turn it into the IDENTITY at one width while leaving it
healthy at the widths either side.** `D`'s split round widened to w/2-trit halves is a
permutation at widths 2, 4 and 6 with exactly one fixed point at 4 and 6 — and at width
**two it has nine fixed points on nine states**, which is to say it is the identity. Eight
rounds of a one-trit Feistel over a three-entry S-box return every state to itself. It was
found only because the invariant was checked at *every* even width rather than at the
endpoints, and the endpoints are exactly where it hides: 4 and 6 both behave.

**No distributional statistic computed on such a family would say so**, and neither would
the obvious structural check. Asking which input positions can influence which outputs
says nothing about whether the influences *cancel*, so a family can have complete
reachability at every width and still be a relabelling at one of them — and every
distribution measured there would be measuring the identity and reporting it as a mixer.
So the invariant has to be asserted at every width in the family, and asserted as a
separate thing from reachability (`F-A-WIDENED-FAMILY-CAN-COLLAPSE-WHERE-INFLUENCE-STILL-REACHES`).
Width two is a control in this set thereafter, never a subject.

### What a stated target implies, and how far that is an extrapolation

Fitted on widths 1 to 6 and tested on the split-round head at widths 4 and 6. The unit is
CANDIDATE FORGERIES TRIED, each costing two to six table reads, so the operation count
under `AS`'s unit is a small constant times the figure and the WIDTH the target implies
moves by at most one trit either way:

| the forger | measured law | 2^80 operations needs | 2^128 needs |
|---|---|---|---|
| handed a ledger, must edit it | tries ≈ **N** = 3^w, slope 1.0031 | **51 trits** | **81 trits** |
| chooses both ledgers | tries ≈ **√(πN/2)**, slope 0.4642 | **101 trits** | **162 trits** |
| may lengthen the ledger | entries ≈ **N^0.28** at L = 6 | no width suffices | no width suffices |
| holds the universal pair | **0 operations, +2 entries** | no width suffices | no width suffices |

The 162 in the last cell of the second row is the same number `ladderlang`'s
`VECTOR_COMMITMENT.md` R10 arrived at from the other side, and it agrees for the same
reason: 3^162 ≥ 2^256, and a collision costs the square root.

**And the extrapolation is named rather than implied.** `ladderlang`'s H27 is 162 trits.
This sweep tops out at 6, so applying the fitted law to H27 spans **156 trits, a factor of
3^156 ≈ 10^74 in state count** — and a law fitted over TWO AND A HALF decades of state count
(3 to 729) and applied over seventy-seven is an extrapolation whatever its residuals
look like. Two further gaps are
load-bearing and neither is closed here. **H27 is a different object**: it is a Davies-Meyer
compression in which the message keys the permutation, chosen precisely so there is no
backward pass, while the head measured here is `a' = P(a + e) − e` with the entry entering
through two bijections. And **a structural shortcut makes cost independent of width
entirely**: `HASH27.md` measures `h_old(a, b) = P(a + b) − b` — this head's shape read
one-headed — inverting in one backward pass, 531,441 of 531,441 openings recovered at 6
trits and 512 of 512 at 162, so a collision costs two backward passes at *both* widths.
Every law in the table above is conditional on no such shortcut existing, and `AU4` is an
example of one that does: two entries, zero operations, at every width in the sweep.

**What this does not show.** Six widths of one head family, conditioned on one fixed point,
with entries and both heads narrowing together — so **nothing here measures a COMPRESSING
head**, which is what a real digest is, and that is the single largest gap between this
sweep and H27. One join split. Ledger lengths six and twelve. Collisions in the cheapest
form only, length-two ledgers at a fixed total. No multi-round differential across width —
`AS2` read one table at one width and this set does not widen it. And no claim anywhere
that anything is secure: every figure here is one attack family's cost, and a family that
survives at 729 states has merely not yet been killed.

## Owned sets

| set | subject | outcome |
|---|---|---|
| `N` | pricing the free mid rail, the model's largest assumption | 3 held, `N1` failed |
| `AB` | erasure: what the machine destroys, and whether the price is in the object | 3 held, `AB4` and `AB5` failed |
| `AC` | whether a program's cost can be learned without paying it | 1 held, `AC1`, `AC3` and `AC4` failed |
| `AD` | a discovered loop bound, and whether that is enough for an implied receipt | all four held |
| `AG` | state width, evaluation cost, and what a receipt actually rests on | 2 held, `AG1` and `AG3` failed |
| `AH` | building the spec, and what the attack on it costs | 2 held, `AH2` and `AH4` failed |
| `AJ` | what self-reference buys, and what buys the property it is asked for | all four held |
| `AN` | a purpose-built search puzzle, and whether it has the asymmetry | 3 held, `AN1` failed — and the failure found the shortcut |
| `AO` | can an erasing machine certify a wipe, and is erasure the certificate | 3 held, `AO1` failed — on its own frozen control |
| `AP` | a hash-only key layer, and what one-time ownership costs | all four held — and two should not have been registered |
| `AQ` | how wide an authenticated tree should be, and whether three ever wins | 1 held, `AQ1`, `AQ2` and `AQ4` failed — and `AQ1`'s failure found the answer |
| `AR` | does a tree want the same arity at every depth, and what does varying buy | 3 held, `AR4` failed — inverted, and the inversion overturned `AQ`'s headline |
| `AS` | does the mixer's residual algebra help a ledger forger, and what does one cost | all four held — and the attack that prices the head at 7 ops uses nothing about the mixer |
| `AT` | what does an INSERTION cost, once the forger may lengthen the ledger | 2 held, `AT2` and `AT3` failed — and `AT3`'s failure found a universal forgery costing two entries and no search |
| `AU` | what does the WIDTH of the head buy, once mixing has been measured twice and found worth nothing | 2 held, `AU2` and `AU4` failed — and the two laws it fitted separate a second preimage from a collision by exactly one square root |

Full text in [`99-ledger.md`](99-ledger.md).
