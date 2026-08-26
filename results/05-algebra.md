<!-- kind: results-topic -->
# 05 — The algebra of a trit: what three states actually buy

**Owned sets: `D`, `M`, `O`.** Cross-references `P`–`V` (the reach ladder), `E`/`I`
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
  failed). **The most obvious test of a hash is disqualified.**
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

Full text in [`99-ledger.md`](99-ledger.md).
