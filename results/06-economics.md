<!-- kind: results-topic -->
# 06 — The currencies, and what the mid rail costs

**Owned sets:** `N`

Cross-references `Z` (which first priced the two limits), `O` (whose whole margin
turned out to be borrowed), `E`/`Y` (the adders it re-ranks), `C` (the memory it
prices), `B` (the decision it does not overturn).

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

## How it was established

| | |
|---|---|
| tools | [`midrail-price-audit.js`](../tools/midrail-price-audit.js), [`midrail-audit.js`](../tools/midrail-audit.js), [`budget.js`](../tools/budget.js) |
| tests | `test-midprice.js`, `test-midrail.js`, `test-budget.js` |
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
- **Anything about static power.** A real ternary mid level is typically generated
  with dividers that burn power continuously; this model has no notion of power at
  all, and the tap count is a proxy for a cost it cannot express.

---

## Owned sets

| set | subject | outcome |
|---|---|---|
| `N` | pricing the free mid rail, the model's largest assumption | 3 held, `N1` failed |

Full text in [`99-ledger.md`](99-ledger.md).
