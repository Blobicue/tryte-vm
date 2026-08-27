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

---

## How it was established

| | |
|---|---|
| tools | [`midrail-price-audit.js`](../tools/midrail-price-audit.js), [`midrail-audit.js`](../tools/midrail-audit.js), [`budget.js`](../tools/budget.js), [`erasure-audit.js`](../tools/erasure-audit.js), [`predict-audit.js`](../tools/predict-audit.js), [`hailstone-audit.js`](../tools/hailstone-audit.js), [`workfactor-audit.js`](../tools/workfactor-audit.js), [`margin-audit.js`](../tools/margin-audit.js), [`selfref-audit.js`](../tools/selfref-audit.js), [`puzzle-audit.js`](../tools/puzzle-audit.js) |
| tests | `test-midprice.js`, `test-midrail.js`, `test-budget.js`, `test-erasure.js`, `test-predict.js`, `test-hailstone.js`, `test-workfactor.js`, `test-margin.js`, `test-selfref.js`, `test-puzzle.js` |
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

Full text in [`99-ledger.md`](99-ledger.md).
