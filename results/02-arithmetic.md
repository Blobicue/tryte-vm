<!-- kind: results-topic -->
# 02 — Gates, adders, and the detector they all pay for

**Owned sets:** `Y` `E` `F` `G` `I`

Cross-references `W` (the gates beneath these), `Z` (whose failure created the
decoded family), `N` (which prices it).

This is where the project's best circuit lives, and where its most productive
failure happened. **Two independent adder families were built, checked against each
other rather than both against the reference, and the cheaper one exists only
because a prediction was wrong.**

---

## What is established

### 1. Two adders, both exhaustively correct

| family | switches | leaves shared | read depth | settling |
|---|---|---|---|---|
| selector tree | 624 (`Y3`) | 384 (`Y3`) | 6 (`E3`) | exactly 7 passes, always (`Y2`) |
| **decoded** | **540** (`E2`) | **360** (`E2`) | **3** (`E3`) | 9–13 passes, data-dependent (`E4`) |

Both match `T.add` over **all 531,441 operand pairs** at carry-in 0, sampled at ±1,
with the overflow trit inside the claim — deliberately, because without it the
circuit is a mod-729 unit and a sweep that ignored it would pass on a circuit that
silently discards overflow (`Y1`, `E1`). `MEASURED`

The stronger check is that the two families are held against **each other**, not both
against the reference: different primitives, same function on every sampled pair
(`E1`). Two constructions agreeing is evidence a reference cannot supply.

**Sharing identical leaf selectors saves 38% and breaks nothing** (`Y3`) — registered
as the likeliest of its five to fail, because a shared leaf ties two mid-level
selectors to one node, creating conducting paths *between* mid nodes the tree did not
have. Identical tables do not in general imply identical circuits, and a pass network
is exactly where that bites. Here it did not. `MEASURED`

### 2. Ripple delay is invisible to this model, and that was derived, not probed

Every pair settles in **exactly seven passes, never six**, whether the carry crosses
all six positions or none (`Y2`). Reachability is transitive closure, so a fully
determined chain resolves in **one** pass however long it is; staging happens only
where a gate is still unknown. Cell 0 resolves on pass 1, cell *i* on pass *i+1*, and
pass 7 observes that nothing changed. `MEASURED`

### 3. The decoded adder's settling time is arithmetic, not structural

`E4` predicted 13 passes for every pair, independent of the data. **It failed on
universality, not on arithmetic**: 13 is the correct *worst* case, and the range is
**9 to 13, depending on the operands.**

That makes it the first circuit here whose cost is a property of the computation
rather than of the structure — and it retroactively scoped `Y2` and `Z5`, whose
independence-of-data results turned out to be properties of the raw-select family
rather than of the model.

Then it was **derived**, exactly, pair by pair (`F1`):

> at carry-in 0, `passes = (2n+1) − #{ i ∈ 1..n−2 : cᵢ ≠ 0 and carry(sᵢ+cᵢ) = carry(sᵢ) }`

Zero disagreements against the real solver over **597,861 pairs across five widths**,
every one exhaustive. Reproducing a total is much weaker than reproducing it term by
term, so it was registered in the strong form. `MEASURED`

**Why the asymmetry exists** (`F2`): early settling needs the arm conducting on the
raw select and the arm still waiting on the detector to reach the *same* rail. For
the carry tree that is `carry(s+c) = carry(s)` — true for **12 of 18**, because the
carry function is flat over stretches. For the sum tree it is
`lowTrit(s+c) = lowTrit(s)` — true for **none**. The sum tree can never settle early,
and that asymmetry is the whole result.

The count then follows from a three-state walk over the carry (`F3`), its transfer
matrix derived *inside the check* from the adder's own tables — nine ways from the
middle carry state, three from each end:

```
(1,7,1) → (9,51,9) → (69,375,69) → (513,2763,513) → (3789,20367,3789)
                                        sum 27,945 × 9 = 251,505
```

251,505 pairs take the full thirteen passes, so 279,936 settle early — **128/243**,
exactly the measured figure. The same walk predicts every other width (`F4`): 81,
621, 4,617, 34,101, 251,505 — derived and measured identical at all five. A rule
fitted to six trits rather than derived would come apart there. It does not.

### 4. Four switches is minimal for the detector, for every contract the selector accepts

The decoded adder pays for a MID detector **eighteen times** (`I4`, counted from the
netlist rather than assumed), so its minimality matters.

Reading `dmux` before searching is what made this worth doing properly. Its middle
arm conducts iff the detector output is **at or above MID** — so the *contract* is
"non-negative exactly at MID", not the particular table that was built. **Four tables
satisfy that contract, and only one had ever been considered** (`I1`).

Exhaustive over a stated 42-device space: **nothing works at one, two or three
switches, for any of the four contracts** (`I1`, `I3`). The positive control matters
as much — a search that finds nothing proves nothing unless it can find something —
and at four switches it searches 148,995 networks and finds four solutions, the
detector in use among them (`I2`). `MEASURED`

So the choice between an n-type and a p-type middle arm is free, and **the adder
stands at 540** (`I4`). A negative result, with the arithmetic for the other outcome
registered *in advance* so it could not be massaged afterwards: a three-switch
detector would have given 522 switches and a ratio of 1.864.

### 5. Ternary loses to binary on adders, and the reversal against the gates is structural

Against a binary baseline at matched information capacity, the decoded adder is
**1.93× the switches unshared and 1.64× shared**, never below **1.36×** at any width
from one to six trits (`E5`). Per digit it is 3.21× against a break-even of
log₂3 = 1.585.

That reverses `W3`, where MIN came out at **0.80** — ternary *cheaper*. Both numbers
are real and the currency never changed (`Y5`): **MIN is positionwise, so six wide
slices beat ten narrow ones; an adder is a table, and a selector tree over three
inputs is 3³ wide in ternary against 2³ in binary.** The per-digit saving is spent on
tree width. Measured at six widths, so it is structural rather than an artefact of
six trits against ten bits. `MEASURED`

### 6. A coincidence, checked and killed

251,505 appeared twice from unrelated constructions — a monoid reach and an adder
pass count. Set `G` asked whether that meant anything. **It does not**, four
independent ways:

- the correspondence dies at the first other parameter, and not narrowly (`G1`);
- the families grow at **incompatible rates** (`G2`). The adder counts satisfy
  `s(k+1) = 9s(k) − 12s(k−1)`, derived by hand from the transfer matrix's
  characteristic polynomial *before* the run and reproducing every count to width 12.
  Its dominant root `(9+√33)/2 ≈ 7.372` is **irrational**, so the adder family
  multiplies by ~7.37 per step while the monoid multiplies by ~9,315 — a factor of
  1,264 apart;
- as powers of three the two sequences differ at the first width and agree at the
  second, so it is **two exponent curves crossing once** (`G3`);
- and collisions of that size are rare here: only four integers over 1,000 appear in
  two or more sets, and only two cross the corpus's two halves (`G4`).

`MEASURED`. Registering *"is this anything?"* as a falsifiable question, and
answering **no** four ways, is the cheapest available defence against a numerological
result.

---

## How it was established

| | |
|---|---|
| tools | [`adder-audit.js`](../tools/adder-audit.js), [`decoded-audit.js`](../tools/decoded-audit.js), [`passcount-audit.js`](../tools/passcount-audit.js), [`collision-audit.js`](../tools/collision-audit.js), [`detector-audit.js`](../tools/detector-audit.js) |
| tests | `test-adder.js`, `test-decoded.js`, `test-passcount.js`, `test-collision.js`, `test-detector.js` |
| sweeps | 531,441 pairs per adder family (~20 and ~24 minutes); 597,861 pairs across five widths for the pass rule; 148,995 networks for the detector |

Both adders are additionally checked against **each other**, and the pass rule is
checked pair-by-pair rather than in aggregate.

---

## What it does not show

- **Nothing here is about time.** "Passes" is a property of the fixed-point solver,
  not a propagation delay. Ripple delay being invisible (`Y2`) is a statement about
  the *model*, and is one of the limits collected in
  [`08-limits.md`](08-limits.md).
- **The 540 figure is quoted under two limits**: the free mid rail and the absence of
  level restoration. The decoded family is the **more** mid-hungry of the two — 34%
  against 27% — and loses to the selector tree above a tap price of 4.67 (`N3`). Its
  win is real and conditional.
- **`E5`'s ratio half held and its mid-rail half was backwards.** The decoded design
  taps `vmid` 186 times against 168, one more per detector across eighteen of them.
  That error is what `N` later turned into a crossover.
- **Detector minimality is over a stated 42-device space**, not over all possible
  physics. It is minimal among networks this model can express.
- **`G` shows one coincidence is not a pattern.** It does not show the two families
  are unrelated in every sense — only that they are not one sequence.

---

## Owned sets

| set | subject | outcome |
|---|---|---|
| `Y` | the carry cell and the six-trit adder, built out of switches | all held |
| `E` | the decoded-selector adder at full width | 3 held, `E4` and `E5` failed |
| `F` | where 128/243 comes from — the pass count, derived | all held |
| `G` | whether 251,505 appearing twice is anything | all held |
| `I` | whether four switches is minimal for the MID detector | all held |

Full text in [`99-ledger.md`](99-ledger.md).
