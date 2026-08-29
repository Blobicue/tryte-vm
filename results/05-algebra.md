<!-- kind: results-topic -->
# 05 — The algebra of a trit: what three states actually buy

**Owned sets: `D`, `M`, `O`, `AE`, `AF`, `AI`, `AK`, `AL`, `AM`.** Cross-references `P`–`V` (the reach ladder), `E`/`I`
(the decoded family), `B` (control versus data), `N` (the price).

This is the file to read first. Everything else in this project could in principle
have been done in binary and come out differently only in the constants. **The
results here are the ones where the answer changes because there are three states
rather than two**, and one of them changes the standard design intuition entirely.

---

## What is established

### 1. A one-control conditional is born nonlinear in ternary and cannot be in binary

Take one control digit and the simplest conditional there is: *act if this control
equals a particular value.*

In GF(2) the indicator of a single value is **affine** — the indicator of `x = 1` is
`x` itself, and of `x = 0` is `1 + x`. In GF(3) **no single-value indicator is
affine**: a function taking `(0,1,0)` across the three values would need `b = 0`,
then `a = 1`, then `2a = 0`, which is impossible. Exhaustive over both fields at one
variable (`O1`). `MEASURED`

The consequence is the root of everything below. **Binary must combine two controls
to obtain nonlinearity** — that is exactly what `AND` is — **and ternary gets it
from one.**

> **The design intuition inverts between the bases.** In binary, linear operations
> are cheap and nonlinearity is constructed. In ternary the simplest conditional is
> *already* nonlinear, and **linearity is the special case you have to work for**:
> `t_b += t_a` is affine and had to be deliberately chosen, while "if `t_a` equals 1"
> is not and comes free. (`F-BORN-NONLINEAR`)

Stated narrowly on purpose. The indicator of a single *point* of two binary digits
is quadratic too. The claim is about **one-control** conditionals, which is exactly
the case that decides gate width, and it is not evidence about anything wider.

### 2. Ternary reaches reversible universality at two operands; binary provably cannot

Every reversible gate is a permutation of states, and reversibility is what quantum
gates, hash permutations and classical reversible computing all share.

| | reversible 2-operand gates | affine | non-affine |
|---|---|---|---|
| binary (2 bits, 4 states) | 24 | **24** | **0** |
| ternary (2 trits, 9 states) | 362,880 | 432 | **362,448** |

`M1`, exact and unsampled. **Every** two-bit reversible gate is affine — `4! = 24`
and `|AGL(2,2)| = 24`, with nothing left over — and affine maps compose to affine,
so no set of two-bit gates reaches the symmetric group **at any width**. That is why
binary reversible computation needs a three-bit gate. `MEASURED`

Ternary does not have that problem. A named width-two set — increment one trit, plus
a controlled-increment on each of three pairs — generates **exactly `A₂₇`**, order
27!/2 (`M2`). `MEASURED`

The prediction was derived from parity *before* the run: every generator is an even
permutation, so the full symmetric group was ruled out in advance and predicting it
would have been predicting something the arithmetic forbids. And 20 of 20 randomly
drawn non-affine two-trit gates reach at least `A₂₇` on the same wiring, so this is
a property of the family and not of one lucky pick.

**The control that makes it mean something:** change one generator from non-affine
to affine — same widths, same wiring — and the group collapses to 151,632, about
**1.4 × 10⁻²³** of the symmetric group (`M3`). Verified by enumerating all 151,632
elements and confirming each is of the form `Ax + b`, not by an order bound, which
any small group would satisfy. `MEASURED`

### 3. But the operand advantage does not become a switch advantage

Both universal gates built in the **same pass-network idiom**, both obeying `T5`
with every source rail-driven and buffers counted, both verified exhaustively:

| | operands | states | switches | mid-rail taps |
|---|---|---|---|---|
| ternary controlled-increment | 2 trits | 9 | **10** | **2** |
| binary Toffoli | 3 bits | 8 | **12** | **0** |

`O3`. **1.2×, not the 3× that "two operands instead of three" invites.** `MEASURED`

An earlier estimate put the binary side at ~22 by building it from NAND gates while
giving the ternary side pass-transistor tricks. That was a strawman and it is
recorded rather than quietly dropped.

And the margin does not survive contact with the model's own accounting. Price a
mid-rail tap at **one switch** and the two gates **tie at 12**; price it at two and
binary wins outright (`O4`). The device model's first stated limit is that the mid
rail is free, and it calls that limit the largest of the four.

> **Ternary's advantage here is structural, not economic.** Every switch of the
> economic margin is borrowed from the one assumption this model flags as its
> biggest. See [`06-economics.md`](06-economics.md).

### 4. Under iteration, almost every obvious ternary construction is dead

Set `D` asked whether new families of ternary hash functions exist under one
constraint: **a single function called repeatedly, referencing itself**, `s ← f(s)`.

- **A non-bijective `f` bleeds state.** A random map keeps 461 of 729 after one call
  — `N(1 − 1/e)` to the integer — and 116 by the tenth; a permutation keeps all 729
  forever (`D1`). So such a hash must be a permutation and must compress by
  **truncation**. `MEASURED`
- **Every positionwise `f` repeats within six calls, at any width** (`D2`). A trit
  permutation has order 1, 2 or 3, and applying one per position, `f^m` is the
  identity exactly when every position's is. **The whole positionwise family is dead
  by argument, not statistic** — and that is strictly stronger than the reach
  ladder's `27^w` ceiling (`Q4`), because a ceiling still permits a large orbit and a
  period of six does not. `MEASURED`
- **`s + g(s)` keeps information only when `g` is an orthomorphism** — when
  `t ↦ t + g(t)` is itself a permutation. Exactly 3 of the 6 trit permutations
  qualify: the identity and the **two 3-cycles**. All three involutions fail, and
  **negation is the worst possible choice**, collapsing 729 states to one because
  `s + (−s) = 0` (`F-ORTHOMORPHISM-GATE`). `MEASURED`

  Another ternary-only fact: every non-identity permutation of a single *bit* is an
  involution, so binary has no analogue of the 3-cycle here.
- **And even then it does not mix** (`D3`, failed). With a correct orthomorphic
  choice, `rotate(s + g(s))` still gives 130 cycles against a random permutation's
  6.6 — because a positionwise 3-cycle *is* addition of a constant, so the sum stays
  affine. **Fixing injectivity does nothing for mixing**, and the carry advantage
  from `R5` does not survive self-composition.

**What does work:** split the state and let one half modify the other. That is
invertible for *any* round function, so nothing can bleed and the round function's
nonlinearity is unconstrained. With a nonlinear 27-entry round table, across 20
tables, cycle counts run 2–12 with mean 6.8 against `ln(729) = 6.6`, and 19 of 20
sit within two standard deviations — while the linear-round control gives 92 cycles
(`F-SPLIT-ROUND-MIXES`). **The structure is not what mixes; the round function's
nonlinearity is.** `MEASURED`

And that round table is 27 entries — **exactly this machine's `TOPC` primitive**,
which is the original tables-as-data idea from [`../docs/origin/`](../docs/origin/)
arriving from the far end.

### 5. One structural fingerprint, and it collides with the constraint

The split-state construction has **exactly one fixed point for every round table** —
1 in all 20 sampled, never 0 and never 2 — where a random permutation follows
Poisson(1) and would have none about 37% of the time (`F-ALWAYS-ONE-FIXED-POINT`).

It is explained rather than mysterious: the state where both halves match and the
round table sends that value to zero is frozen, and a permutation sends exactly one
value to zero. **A fixed point is an input that no number of rounds ever moves.**

The standard remedy is a per-round *constant*, which breaks the symmetry — and that
**collides with the one-function-called-repeatedly rule** unless the round counter is
carried inside the state. That is a real consequence of the constraint, not a detail
of one construction. `MEASURED`

---

### 6. The group this project rebuilt already had a name

`AB5` measured the group generated by the accumulator maps that erase nothing —
`ADD` over every operand, plus `NEG` — and found order exactly **1,458** on 729
states: the translations extended by negation, a vanishing fraction of 729!, and the
reason the named ALU cannot compute without an eraser.

Run that *identical* construction through the *identical* stabiliser chain on
**twelve** points and it returns **24**. That is the dihedral group musical set
theory has called the **T/I group** since the 1960s: transposition
T*ₙ*(x) = x + n and inversion I*ₙ*(x) = n − x, acting on twelve pitch classes.
`MEASURED`

| n | generators | order | 2n |
|---|---|---|---|
| 12 | translation-by-1, negation | **24** | 24 |
| 27 | " | **54** | 54 |
| 729 | " | **1,458** | 1,458 |

It is 2n at every width; the tryte is not special (`AE1`). Transposition **is** `ADD`
and inversion **is** `NEG` — in balanced ternary, negation is inversion about zero,
which is why it costs nothing.

**And the conclusions match.** Music theory has always known T and I preserve
interval-class content, so no amount of transposing and inverting carries one set
class into another. `AB5` phrased the same wall as *"without an eraser the named set
is inert."* Two fields, sixty years apart, same group, same limitation.

What breaks out of it in music is the **multiplicative operators** M5 and M7 — the
circle-of-fifths transform — which are the affine maps x ↦ ax + b. `AB1` measured
that split without knowing it had: of the 216 information-preserving ternary
operations, **18 are affine and 198 are not.** The M-operators are among the 18. The
other 198 have no name in music theory, because twelve-tone space is too small to
need many.

---

### 7. And here a prime-power pitch space is poor — which is not the same claim

**Narrowed after the fact, and the original wording is worth recording.** This
section first read *"and here ternary is genuinely worse"*, which is the numbers
right and the noun far too big: what follows measures **one** musical affordance —
how many chords can be transposed onto themselves — and says nothing about
consonance, rhythm, contour or timbre. `T-CLAIM-NARROWED-BY-A-DESIGN`, third bite,
and the first one this project scored against its own prose rather than against a
sweep.

The claim that survives is narrow and still worth having:

> **ℤ/27 as a pitch-class space is poor in transpositional symmetry, because 27 is
> a prime power.**

Note what it does *not* say. **It does not say binary does better** — `AF2` went and
measured that, and it does not: powers of two are divisor-poor on the same scale, so
the advantage belongs to compositeness rather than to either radix. (This sentence
first cited `AF2` before `AF` existed, and the citation rule refused it — a number in
prose that has no code yet fails the same check as one whose code has moved on.) And it does
not reach the layer where ternary is used as an
**addressing** scheme rather than a tuning, which is what a 3×3 pad grid is, and
where the factorisation 9 = 3 × 3 is the whole point.

**Twelve is highly composite for its size. 729 is a prime power.** Transposing by
*k* cycles with period n/gcd(k,n), so the available periods are exactly the divisors
of n — and the number of distinct orbit lengths equals the divisor count exactly, at
every n tested (`AE2`).

| n | divisors | the available periods |
|---|---|---|
| 12 | 6 | 1 2 3 4 6 12 |
| 27 | 4 | 1 3 9 27 |
| **720** | **30** | 1 2 3 4 5 6 8 9 … |
| **729** | **7** | 1 3 9 27 81 243 729 |

**720 and 729 are one apart** and have 30 divisors against 7. Every period in a
ℤ/3^k space is a power of three, so consecutive available periods differ by a factor
of exactly 3 with nothing in between.

Each period in ℤ/12 is a piece of harmonic vocabulary — the augmented triad at 3,
the diminished seventh at 4, the whole-tone scale at 6. **ℤ/27 has no analogue of
the last two**, not for want of looking: 6 and 4 do not divide 27.

#### Measured against a control that was published first

Before any ternary figure was believed, the same Burnside count was run on ℤ/12,
where the answers are in the literature and were **not derived here** (`AE3`):

| | measured | published |
|---|---|---|
| set classes under T/I | **224** | 224 |
| trichord classes | **12** | 12 |
| tetrachord classes | **29** | 29 |
| hexachord classes | **50** | 50 |

Four for four. An instrument that agrees with sixty years of counting where the
answer is known has earned the case where it is not: **ℤ/27 has 2,493,726 set
classes**, close to 2²⁷/54 because the identity element dominates the average at
that size.

#### The two axes pull opposite ways

`AE4` predicted the fraction of subsets with nontrivial transpositional symmetry
would be above 2% in ℤ/12 and below 0.001% in ℤ/27. **It failed on the first
threshold** — 1.81%, optimistic by a fifth — and held on everything else:

| | symmetric subsets | of | fraction |
|---|---|---|---|
| ℤ/12 | 74 | 4,096 | **1.81%** |
| ℤ/27 | 510 | 134,217,728 | **0.00038%** |

ℤ/12 is **4,755×** richer, 3.7 orders of magnitude. And yet ℤ/27 has **61 trichord
classes against ℤ/12's 12**. So a ternary pitch space is **richer in variety and
poorer in structure at the same time** — five times as many distinct three-note
chords, four thousand times fewer with any symmetry to compose against. More things
to say, far less structure to say them with.

The failure carries its own lesson: a threshold picked to sound decisive is a worse
prediction than the ratio it was standing in for. That is
`T-CRITERION-IN-THE-NOISE` in a different costume.

---

### 8. Breaking "good for music" apart — and the layers do not agree

`AE`'s overclaim was withdrawn without a replacement, which leaves a question open
rather than answered. `AF` measures the two layers the withdrawal stepped on:
**consonance** and **rhythm**. Neither had ever been touched here.

The result is that **music is not one thing, and the layers decouple.** `MEASURED`

| layer | what it wants | ternary |
|---|---|---|
| harmonic symmetry | many divisors | poor — but so is binary (`AF2`) |
| rhythm | many divisors | poor — **worse than binary** (`AF3`) |
| consonance | nothing to do with divisors | **better than twelve** (`AF1`) |

#### The withdrawn claim was wrong in the opposite direction

For an equal division into *n* steps and a just ratio *r*, the nearest available
interval is round(n·log₂r) steps. Summed over six just ratios:

| EDO | fifth | major 3rd | minor 3rd | harmonic 7th | **total** |
|---|---|---|---|---|---|
| **12** | **1.96** | 13.69 | 15.64 | 31.17 | **64.41** |
| **27** | 9.16 | 13.69 | **4.53** | **8.95** | **45.48** |
| **81** | 5.66 | **1.13** | **4.53** | 5.86 | **22.84** |

`AF1` predicted 27-EDO's fifth would be more than 4× worse (it is 4.68×) and its
harmonic seventh more than 3× better (3.48×). Both held. But the sweep answered a
question nobody asked: **27-EDO totals 45.48 cents of error against 12-EDO's 64.41,
and 81-EDO totals 22.84.**

A ternary division of the octave is not merely defensible on consonance — it
**beats twelve**, chiefly because 12-EDO's harmonic seventh is 31 cents out while
27-EDO's is 9. The claim withdrawn in §7 was not only too broad; on the axis it
never measured it pointed **the wrong way**.

#### Compositeness, not binary

`AF2`: no power of two or three below 100 exceeds **7** divisors, while 60 has
**12**. The counts of 32 and 27 differ by exactly 2. **Powers of two are poor on the
same scale as powers of three**, so `AE2` was never a binary-versus-ternary result —
and 12 = 2²·3 is a power of neither radix.

#### Rhythm goes to binary, and that was said here without measuring it

| 1/d | base 2 | base 3 | base 6 |
|---|---|---|---|
| 1/2, 1/4, 1/8 | **exact** | — | exact |
| 1/3 | — | **exact** | exact |
| 1/6, 1/12 | — | — | **exact** |

Base two gets **3 of 6**; base three gets **1** (`AF3`). The offhand claim that
rhythm favours base three is **wrong on the ordinary repertoire** — Western notation
is halves, quarters and eighths. The two neither base gets are exactly those with
both 2 and 3 as factors, and base six gets all of them.

#### And `AF4` failed, which is the finding

`AF4` predicted a tidy unifying story: that the *n* minimising consonance error and
the *n* maximising divisor count would both be divisible by 2 and 3, so music would
want both primes at every layer.

**The best consonance in 5–72 is n = 53. It is prime.** 31 is close behind at 18.19
cents — also prime. The divisor clause held (60), and the two do not agree.

> **Harmonic symmetry and rhythm want compositeness. Consonance does not care about
> it at all.**

Consonance is a question about whether n·log₂(r) lands near an integer, which has
nothing to do with how *n* factors — and the prime divisions microtonalists favour
are exactly the counterexample. Predicting that three layers would agree was
reaching for a single sentence where the measurement supports two.

**The honest summary is that no pure radix is good for music, and neither is any
single number: twelve earned its place on symmetry and rhythm while losing on
consonance to divisions two and four times its size.**

---

### 8. The arity ladder, and the feedback that makes a trajectory graph tree-like

`AH2` found the binding constraint on an implied receipt, and it was not state size:
a control space 500,000× larger than `hailstone`'s still handed a tabulator 3.20×
reuse. **Trajectory convergence** is what a tabulator eats.

`AI` takes the proposal to grow by **arity** rather than by width — climb n → n+1
inputs, with the truth table of an n-input function as the object — and finds the
thing that was missing. `MEASURED`

#### The Ladder's history operator, replicated

The layer sequence comes from one total operator over the whole history rather than
a two-term recurrence:

> **H(prev) = Σ prev + [prev ≠ ∅]** — *"everything that has happened, plus one if
> anything has happened at all"*

Defined on the empty history, no cases. It reproduces Fibonacci-with-two-zeros for
all **40 terms** checked here, against the 9 its own page verified (`AI1`). Three of
the four rival rules it names fail exactly where it says.

The point is the genesis. The two-term recurrence **holds from term three and fails
at term two**; the operator has no such exception. Fibonacci is a *consequence*.

#### Arity cubes where width multiplies

| n | rows | functions 3^(3^n) | cube of the last? |
|---|---|---|---|
| 1 | 3 | 27 | — |
| 2 | 9 | 19,683 | **yes** |
| 3 | 27 | 7,625,597,484,987 | **yes** |
| 4 | 81 | 39 digits | **yes** |

`AD4`'s width ladder multiplies by **729 per live word**. The arity ladder **cubes**
(`AI2`), passes width at n = 3, and by n = 4 they are not in the same range — 39
digits against 15. **Adding an input is not a bigger version of adding a word.**

#### And `AB1` turns out to have been one rung of a closed form

A function is reversible in its leading argument exactly when each of its 3^(n−1)
columns is a bijection, so the count is **6^(3^(n−1))** and the fraction
**(2/9)^(3^(n−1))** (`AI3`):

| n | reversible | fraction |
|---|---|---|
| 1 | 6 | 22.22% |
| 2 | **216** | **1.097%** |
| 3 | 10,077,696 | 0.000132% |

`AB1` measured 216 of 19,683 by sweeping every table one at a time. The formula
gives the same figure without a sweep, and **216 = 6³ exactly.**

#### The payoff: `AB1`'s 216 tables are the receipt

Take an n-input function as shift-register feedback — state (x₁..xₙ), next
(x₂..xₙ, f(x₁..xₙ)). Over all 531,441 states of the two-input register (`AI4`):

| feedback | max in-degree | unreachable |
|---|---|---|
| **reversible** (an `AB1` table) | **1** | **0** |
| MIN (collapsing) | 729 | **484,785 — 91.22%** |

A reversible feedback makes the state map a **bijection**: every state has in-degree
exactly one, no two trajectories ever merge, and **a tabulator's reuse is exactly
1.00** — against `AH2`'s 3.20 and `hailstone`'s 10.43. There is nothing to amortise.

The collapsing case is far worse than predicted rather than better: a quarter
unreachable was the guess, and 91.22% is the answer. **A collapsing feedback is not
a weak receipt, it is a state space that mostly does not exist.**

> **`AB1`'s 216 tables are exactly the feedback functions that make the fourth factor
> come out right — measured four sets before anyone knew what they were for.**

---

### 9. The smallest reversible language, and the trilemma it exposes

If every primitive of a language is reversible, then every program written in it has
in-degree one **by construction** — `AH2`'s fourth factor free for everything, with no
per-program analysis. `AK` builds that language out of pieces already in the corpus
and finds what it costs. `MEASURED`

#### Three forms

| | |
|---|---|
| `INC i` | trit *i* += 1 |
| `CINC a b` | trit *b* += trit *a* — affine |
| `C1INC a b` | trit *b* += 1 if trit *a* = 1 — **not** affine (`O`'s free nonlinearity) |

Fifteen instances on a three-trit register. **Every one is a permutation, and every
one has order exactly 3** (`AK1`) — so a gate's inverse is that gate applied twice,
and **the language needs no inverse instruction set at all.**

They generate **A₂₇ = 27!/2**, a 28-digit number, agreeing with `M`'s figure from a
separately written implementation. Two independent codings landing on one number is
what makes a re-implementation worth having.

> **An erratum worth keeping.** The registration typed A₂₇ as a *25*-digit number —
> three zeros dropped, a factor of a thousand. It cost nothing because the tool
> **computes** 27!/2 rather than comparing against the typed digits. `AGENTS.md`
> already says *derive constants, never hardcode them*; the rule was obeyed in the
> code and broken in the sentence beside it.

#### Factor four becomes a property of the alphabet

Four hundred random programs of random length. **All 400 have in-degree exactly 1 at
every state, zero unreachable** (`AK2`). A composition of bijections is a bijection,
so there is nothing a programmer can write that breaks it.

Compare where the same guarantee came from before:

| bought by | cost to keep |
|---|---|
| `AI4` — searching 19,683 tables for the 216 that work | a property of a chosen table |
| `AJ1` — building the map deliberately out of `ADD` | a property of a particular program |
| `AK2` — **choosing a reversible alphabet** | **a property of the language** |

Only the last one survives a programmer.

#### And the cost stops varying

Every one of fifty straight-line programs costs exactly its own length in gates, for
all 27 starting states (`AK3`):

| | spread |
|---|---|
| `AH1`'s three-word program — the bar | **513.8×** |
| `countdown` | 25.38× |
| `threeway` — `AG1` called this security theatre | 1.02× |
| **this language** | **1.0000×** |

Flatter than the theatre. Nothing here depends on the data, because branching on data
means *testing* data, and a test that discards its answer is erasing.

> **Going fully reversible buys factor four and loses factor three.**

#### The trilemma

| construction | in-degree 1 | cost varies | bounded state |
|---|---|---|---|
| this reversible language | **yes** | no | **yes** |
| `hailstone`, three-word program | no | **yes** | **yes** |
| reversible feedback (`AI4`), history operator (`AJ1`) | **yes** | no | **yes** |
| reversible + data-dependent | **yes** | **yes** | **no** |

Six constructions from this corpus and **none has all three** (`AK4`). Every *pair* is
demonstrated; no triple is.

The last row is Bennett's construction: a reversible machine **can** branch on data,
but only by keeping the record of which way it went. The history then grows at least
one trit per branch — **a thousand data-dependent steps costs 167 trytes that can
never be discarded** — and `AJ4` already measured what happens when bounded memory
meets a state that will not stop growing. It wraps at term fifteen.

> **In-degree one, a cost that varies, bounded state. Pick two.**

---

## How it was established

| | |
|---|---|
| tools | [`iterhash-audit.js`](../tools/iterhash-audit.js), [`reversible-audit.js`](../tools/reversible-audit.js), [`nonlinearity-audit.js`](../tools/nonlinearity-audit.js) |
| tests | `test-iterhash.js`, `test-reversible.js`, `test-nonlinearity.js` |
| sweeps | exhaustive at 729 states throughout; group orders by Schreier–Sims in BigInt |

The group-order instrument was verified against four known orders before any claim
rested on it — a 27-cycle giving 27, the symmetric group giving 27!, the alternating
group giving 27!/2, and `AGL(3,3)` giving 303,264 (`M0`) — and cross-checked by
brute-force enumeration of the 151,632-element group in `M3`, so two independent
methods agree.

**BigInt throughout.** 27! and 27!−1 collapse to the same double, so a floating-point
order comparison could not tell `A₂₇` from a group one element smaller.

---

## What it does not show

- **Reversible-universal is not quantum.** Reaching the symmetric group is the
  classical permutation core. Superposition and phase are untouched, and a ternary
  machine that reaches reversible universality has not simulated a quantum computer.
- **Nothing here is a security claim.** 729 states is a toy, and a toy cannot be
  evidence about resistance to an adversary. What `D` establishes is which family
  shapes *mix at all*.
- **A collision count cannot detect mixing.** Truncating any permutation to three
  trits gives 27 buckets of 27, uniform by construction — so a map proved to repeat
  every six calls scores 0.96× the ideal, identical to everything else (`D4`,
  failed). **The most obvious test of a hash is disqualified.** And read `D4`'s FAILED
  for what it is: the criterion could not have come out any other way, at P(the recorded
  outcome | any permutation-based candidate) = 1. This is the one place in the corpus
  where "the criterion was not evidence" and "the failure was valuable" are the same
  sentence — the non-discrimination *is* the finding, and it produced `AN1`. Part four of
  [`07-negative.md`](07-negative.md) has the sweep.
- **`AM2`'s verdict was a coin, and its finding was not.** As registered, "the affine task
  groks soonest" is a single paired comparison with everything but the algebra held fixed,
  so the null crosses the line 50% of the time and the recorded FAILED could as easily
  have been a HELD. What survives is stronger than the criterion ever asked for: the run's
  own five seeds put the non-affine task faster in **four of four paired seeds**, medians
  10,800 against 6,200 steps, with the affine task failing to generalise inside 40,000
  steps on one seed of five and the non-affine on none of five. **A line in the noise
  corrupts a verdict; it does not automatically corrupt a finding**, and `AM2`'s own entry
  records the two apart.
- **`AM3`'s line has no null anyone can draw**, and it is one of the eighteen the sweep
  refused to score rather than scoring badly. Unmeasured, not clear.
- **`M2`'s universality is about gate width in group theory**, not cost. What it
  costs is `O3`, and the answer is 1.2× resting on a free rail.
- **`O1` is about one-control conditionals only.** Binary nonlinearity is not
  expensive in general — `bAnd` is six switches.

---

## Owned sets

| set | subject | outcome |
|---|---|---|
| `D` | which self-referencing ternary maps mix at all | 2 held, `D3` and `D4` failed |
| `M` | reversible universality at two operands | all held |
| `O` | what that advantage costs, and where it comes from | all held |
| `AE` | the T/I group, and the harmonic vocabulary of a ternary space | 3 held, `AE4` failed |
| `AF` | which musical layers favour which base | 3 held, `AF4` failed |
| `AI` | the arity ladder, and the feedback that makes a trajectory graph tree-like | all four held |
| `AK` | the smallest reversible ternary language, and the trilemma it exposes | all four held |
| `AL` | the ternary operations as a labelled task ladder | 2 held, `AL3` and `AL4` failed |
| `AM` | whether a task algebra predicts when a network generalises | 2 held, `AM2` and `AM3` failed |

Full text in [`99-ledger.md`](99-ledger.md).
