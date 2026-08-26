<!-- kind: results-topic -->
# 01 — What an instruction vocabulary generates: the ceiling ladder

**Owned sets:** `P` `Q` `R` `S` `U` `V`

Cross-references `G` (which killed a coincidence between this ladder and the adder),
`D` (where the ladder stops applying), `F` (which reaches the same 251,505 from the
other end).

The original claim behind this project was that a six-trit control vocabulary
generates 531,441 functions. **It generates 77,687.** Establishing that, and then
finding what *does* break the ceiling, is what these six sets do — and the answer is
one word: **coupling**.

---

## What is established

### 1. The founding number was overstated by 6.84×

The source conversation claimed a six-trit control vocabulary reaches 531,441. It
reaches **77,687** (`P5`). `MEASURED`

Along the way the vocabulary was characterised exactly: the increment family
saturates at exactly `3^w` (`P1`), and the full control vocabulary saturates rather
than growing freely — 7, 47, 307 at widths 1, 2, 3 (`P2`).

**`P3` failed, and it is the reason the rest of the ladder exists.** It predicted the
reach is a direct product across trit positions — `reach(w) = reach(1)^w`. That gives
49 and 343; the truth is **47 and 307**. The positions are *not independent*, and
finding out what they actually are is the work of `Q` through `V`.

### 2. Tables as data reach further, and then stop

Once the truth table is itself an operand:

| vocabulary | width 1 | width 2 | width 3 |
|---|---|---|---|
| control vocabulary (`P2`) | 7 | 47 | 307 |
| table op, second operand pinned (`Q1`) | 27 | 27 | 27 |
| **table op, second operand free** (`Q3`) | **27** | **729** | **19,683** |

Pinning the second operand caps the reach at 27 **at every width** (`Q1`) — and that
is *fewer* than the plain control vocabulary from width 2 onward (`Q2`). Freeing it
gives exactly `27^w` (`Q3`). `MEASURED`

**And `27^w` is the ceiling for any positionwise vocabulary whatsoever** (`Q4`), with
the lower bound meeting the upper bound at widths 1, 2 and 3. At width 6 that ceiling
is 387,420,489 — so the founding claim of 531,441 was not only an overstatement of
what the control vocabulary reaches, it was an **understatement of the ceiling by
729×** (`Q5`).

### 3. What breaks the ceiling is coupling, and not all coupling is equal

This is the load-bearing result of the ladder, and the one that transferred furthest.

At width 2, against a positionwise ceiling of 729:

| addition to the vocabulary | reach | bought |
|---|---|---|
| 27 more **positionwise** generators (`R2`) | 729 | **0** |
| one **shift** (`R4`) | 801 | 72 |
| one **translation / carry** (`R3`) | **251,505** | **250,776** |

**More generators of the same kind buy nothing at all** (`R2`). What escapes the
ceiling is **cross-trit coupling** (`R5`) — and the carry buys **3,483× what the
shift does**, because *a carry is data-dependent and a shift is a fixed relabelling*.
`MEASURED`

That single sentence is the most transferable thing in this project. It is what set
`D` went looking for in iterated maps — and what `D3` then showed **does not survive
self-composition**, which is the sharp boundary on it.

### 4. The ladder has a further rung, and it is bounded honestly

The carry as a table (`U2`) reaches the same 251,505 at width 2 — the same monoid as
plain translation. At width 1 the carry is inert and reaches 27 like any table op
(`V1`); at width 2 it already exceeds the 729 ceiling (`V2`); and with **arbitrary**
carries rather than addition's, it reaches **531,441** — 2.11× more than addition
alone gives (`V3`). `MEASURED`

`V4` is the honest part: **the sample is a lower bound and no upper bound is
claimed.** It converged between 40 and 80 samples and the registration says so.

`U1` is the matching negative: **no table op equals addition**, over all 19,683
tables compared as functions. 81 of them match at a single chosen input pair — which
is where this project's most-recurring defect got its name.

### 5. Folding, and what it cannot cross

An N-stage chain of table ops folds to **one** instruction, saving N−1 stages (`S1`):
93 cells to 25, 27 instructions to 7. The saving **multiplies with emulation depth**
at 27× per level (`S2`), and de-duplicating identical tables pays exactly 9 cells per
duplicate (`S3`).

**`S4` is the limit that matters: the fold does not survive a carry.** One addition
between two table ops breaks the equivalence. Folding is a positionwise optimisation,
and the thing that escapes the positionwise ceiling is exactly the thing folding
cannot cross. `MEASURED`

---

## How it was established

| | |
|---|---|
| tools | [`monoid-lib.js`](../tools/monoid-lib.js) and the audits built on it, [`fold-audit.js`](../tools/fold-audit.js), [`topc-audit.js`](../tools/topc-audit.js) |
| tests | `test-monoid.js`, `test-fold.js`, `test-logic.js` |
| method | closure under composition, computed exhaustively where the arena permits and sampled with the convergence stated where it does not |

---

## What it does not show

- **Reach is not usefulness.** A vocabulary reaching more functions is not thereby a
  better instruction set; nothing here measures programs, only what the closure
  contains.
- **`V3`'s 531,441 is a lower bound from a converged sample**, not an exhaustive
  count. `V4` registers that explicitly.
- **The ladder is about *vocabularies closed under composition*.** It says nothing
  about a **single function iterated** — that is a cyclic monoid, a far smaller
  object, and set `D` had to be run because nothing in `P`–`V` touched it.
- **251,505 appearing here and in the adder's pass count is a coincidence**, checked
  four ways and killed by `G`.
- **Widths above 3 are mostly out of exhaustive reach**, and the claims that extend
  past them say which are derived and which are sampled.

---

## Owned sets

| set | subject | outcome |
|---|---|---|
| `P` | what the control vocabulary generates | 5 held, `P3` failed |
| `Q` | what a table op buys, once the truth table is data | all held |
| `R` | what breaks the positionwise ceiling | all held |
| `S` | folding a chain of tables into one | all held |
| `U` | the carry as a table | all held |
| `V` | whether the ceiling ladder has another rung | all held |

Full text in [`99-ledger.md`](99-ledger.md).
