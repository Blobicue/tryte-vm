<!-- kind: results-topic -->
# 00 — The device model, and the axioms it rests on

**Owned sets:** `W` `X` `Z`

Cross-references `Y`/`E` (what was built on it), `H` (how far it scales), `N`
(pricing its largest assumption).

Everything else in this project is quoted in switches, and a switch count is worth
exactly what the model beneath it is worth. **This file is that model: what it
assumes, which assumptions were shown load-bearing by breaking them, and what every
number here is therefore conditional on.**

---

## What is established

### 1. The gates work, and they compose

Six per-trit gates side by side compute the six-trit function, exhaustively — MIN
and MAX over all 531,441 pairs, NEG over all 729 values, zero mismatches (`W1`). And
a pass network driving a pass network does not degrade (`W2`). `MEASURED`

`W2` is worth its own sentence: **it first reported FAILED, and the circuit was
right.** The solver traversed reachability *through* rails, so correct circuits
resolved to unknown. Driven nodes terminate a path now. That was the second of seven
occasions an instrument here produced a false verdict on its own prediction — the
full list is in [`07-negative.md`](07-negative.md).

### 2. Nineteen axioms, and the load-bearing ones were broken on purpose

The model states six device axioms, eight network axioms and five theorems. Set `X`
did not check that they are *stated* — it checked that they are **doing work**, by
mutating each and seeing what stops working.

- **The inclusive threshold is load-bearing** (`X1`). Making thresholds strict breaks
  **every** gate: 0 of 5 still correct under each of three mutations. The row counts
  were derived by hand and written into the registration *before* the run, and were
  right. `MEASURED`
- **Composition holds for every wiring, not just the tested one** (`X3`): 25 of 25
  composites match, with no degradation at the linking node.
- **The series mid path is not redundant** (`X4`): no single device replaces it, over
  six candidates — six and not twelve because terminals are interchangeable, which is
  itself checked rather than assumed.
- **Four switches is minimal for NEG** (`X5`), exhaustive over a 42-device space:
  148,995 networks at four switches, four of which compute NEG. `MEASURED`

  The positive control first reported the standard ternary inverter **absent from a
  search that had found it** — the network key ordered its terminals, and the axioms
  say terminals have no order. Third false verdict.

### 3. An axiom was falsified, and its correction was falsified too

`X2` asked which seeds of a self-inverter are self-consistent. **It failed on its
premise, not its answer**: the question assumed every seed resolves to *something*,
and two of three do not — seeded at a level, the network runs −1 → +1 → −1 forever
and the solver throws.

That falsified the axiom claiming resolution cannot oscillate. The **correction was
also false**: "a node reaching X stays there" is untrue, because nodes pass *through*
X. 481 existing checks were blind to it because every one inspected only final
states, which is where the staged-resolution instrument came from.

Two axioms, both wrong as first drafted, both found by one prediction failing on
something it had not thought to state. `MEASURED`

### 4. The two limits every switch count is quoted under

Set `Z` exists because every number in this repository is conditional, and the
conditions had never been priced.

**The free mid rail is load-bearing for exactly one published result — and it is the
one that favoured ternary** (`Z1`). `W3` measured 48 ternary switches against 60
binary at equal representable range, a ratio of **0.80**. Charge the mid rail at
2 switches per tap and that ratio reaches parity at 12 generator switches; at 13 it
**reverses**. The adder comparison, by contrast, is at parity already and cannot be
reversed by any tap price.

The middle level **cannot be generated inside the model at all**: a divider between
the outer rails is two rails reaching one node, which is contention. So this
break-even is a charge from outside the vocabulary rather than a circuit that could
be drawn here — the point taken up in full by `N` and
[`06-economics.md`](06-economics.md). `MEASURED`

**Restoration costs, at each level** (`Z3`):

| | unrestored | mid restored | leaf+mid restored |
|---|---|---|---|
| ternary switches | 624 | 912 | 1,776 |
| binary switches | 280 | 440 | 760 |
| ternary depth | 6 | 4 | 4 |
| binary depth | 3 | 2 | 2 |
| ternary passes | 7 | 19 | 31 |
| binary passes | 11 | 31 | 51 |

**Restoring makes the ratio worse, not better** — 2.23× unrestored against 3.26×
restored — and *increases* the mid-rail tap count. Buffering both levels costs nearly
double buffering one and buys no depth at all on either side, because the cheaper
option already reaches both floors. `MEASURED`

The restored circuits still add (`Z4`), which was at risk because a restoring buffer
is an inverter driven *by* a pass network and driving another — exactly the
arrangement the second stated limit handles by assumption. If that assumption were
doing work, this is where it would have shown.

And all six pass counts were derived by hand before the run from gate-dependency
depth (`Z5`): each inverter is its own stage, so a two-inverter buffer adds two per
level, times the digits, plus the pass that observes nothing changed. Still
independent of the data — exactly as `Y2` found, and exactly what `E4` later scoped.

### 5. The failure that built the best circuit

`Z2` predicted that buffering cannot take ternary pass depth below 4, and that binary
gets 3 free. **The numbers were exactly right** — 6 → 4 → 4 ternary, 3 → 2 → 2 binary
— and the clause that followed was wrong: *that 4 is the best depth ternary can buy
at any price.*

Nothing measured had quantified over designs; it quantified over where buffers go
inside one family of trees. A **decoded** selector reaches depth 3 at 90 switches per
cell against 104. That failure created the decoded family, the 540-switch adder, and
sets `E`, `F` and `I` — the argument is made in [`07-negative.md`](07-negative.md).

### 6. The instrument, priced — and three of its four predictions wrong

Everything above was produced by `src/device.js` resolving a switch network by fixed
point, and several of those results are **samples because of that solver rather than
because of the question**: `Y1` swept every operand pair at carry-in 0 and then took
carry-in ±1 at one pair in 121, `E1` did the same, and every restored variant in `Z`
is sampled at that stride.

`AV` prices the solver itself. Three implementations of **one algorithm** —
`src/device.js` untouched as the oracle, the same fixed-point loop over dense integer
ids and CSR adjacency, and that loop a third time as WebAssembly emitted at run time
by JavaScript in `src/` — held against each other first, timed afterwards.

**The gate came first, and it is the part that will be cited.** The three agree on
313,697 node values across 128 networks with zero divergences, reproduce both of the
oracle's refusals about a seeded initial state, and stop on the same pass — checked at
*k* and at *k−1*, including networks that never settle at all, because "did not settle
within *k*" is how every pass count in this folder was measured
(`F-THE-GATE-IS-THE-RESULT-NOT-THE-RATIOS`).

Then the timings, over the first 20,000 operand pairs, interleaved in one process:

| | registered | measured |
|---|---|---|
| `AV1` the update loop is where the oracle's time goes | more than half the gap | 11.1% |
| `AV2` the representation is worth an order of magnitude | 15 to 40 times | 10.37 |
| `AV3` WebAssembly buys less than double on top | 1.0 to 2.0 times | 2.14 |
| `AV4` and that advantage does not depend on size | separation under 0.5 | 0.013 |

`AV1` and `AV2` were registered **in tension**: the registration argued that if
allocation dominated, the second would break high. Both failed instead, and what they
shared is what was wrong — allocation in the update loop is not where the oracle's
time goes. Stripping every array and every `Object.keys` call out of that loop moves
it 11.1% of the way to the packed solver (`AV1`).

`AV2` failed low, and its derivation was written down before the run so the miss can
be attributed rather than explained. The band came from an anchor of 75 nanoseconds
per edge visit and a target in the low single digits; the oracle measures 55.7 and the
packed solver 5.37 (`AV2`). The anchor was too slow and the target too fast, and the
product of those two errors is the whole of it.

`AV3` failed **high** — WebAssembly reached 2.14 times the packed JavaScript where at
most 2.0 was registered, by the route the registration itself named: a bounds check on
every typed-array index that a load into linear memory does not pay. It is the only
one of the four that landed near its boundary, so a second identical run was made
before the verdict was written down; the ratio came back 2.21 and did not flip
(`AV3`).

### 7. The rule off its own scope line — and the boundary cell that cannot save

`F` derived where the decoded adder's 128/243 comes from and checked it over every
operand pair, and then wrote its own limit into the record: *"carry-in 0 throughout;
with a non-zero carry-in the bottom position can save as well (six of its nine
digit-pairs qualify) and the walk is a different one."* `AW` spent the instrument
`AV` built on crossing that line — all 531,441 pairs at carry-in +1 and all 531,441
at carry-in −1, two solves each, no stride anywhere.

**The disclosure was honest and its guess was wrong, in the safest possible
direction.** The six digit-pairs really do satisfy the condition. The walk really is
a different one. And the bottom position still cannot save, so `F`'s rule needed no
amendment at all — it is exact, pair by pair, at all three carry-ins.

| | registered | measured |
|---|---|---|
| `AW1` the rule with position 0 admitted | exact, pair by pair | wrong on two thirds of every pair |
| `AW2` and the walk gives 46,899 | 46,899 | 223,803 |
| `AW3` the two carry-ins are exact mirrors | every bin equal, vectors reversed | every bin equal, vectors reversed — and not those vectors |
| `AW4` and the floor drops by one | 8 | 9 |

`AW1` failed on the observation its own risk line named: *"the condition can hold
while the saving does not happen."* It does hold — on twelve of the eighteen
(digit-pair, non-zero carry-in) combinations, which is `F`'s six of nine — and the
saving does not happen, on every one. Every disagreement is by exactly one pass, in
one direction, and `src/device.js` was asked directly on a sample of them rather
than the packed solver being believed about its own failure.

**The mechanism is measured, not argued, and it is why the exclusion is structural.**
A position saves when its carry's raw value is known while that carry's MID detector
is not — but the early leaf that buys is only usable if the selectors above it, gated
by the *operand* detectors, have already resolved. At position 0 the carry is a
primary input, so its detector and the operand detectors resolve on the **same pass**:
gap zero, and the saving has nowhere to go. At position 1 the gap is **two passes**,
and the saving is real — `c2` lands at pass 3 on all twelve qualifying combinations
and at pass 4 on the six that do not. So **position 0 is excluded because it is the
boundary cell, not because `c_0` is zero**, which is the reason `F` gave and the one
a carry-in-0 sweep structurally cannot tell apart from the real one.

`AW3` is the one worth reading twice. Its headline — the two carry-ins are exact
mirrors — **held exactly**: every bin equal, and the carry-state vectors one
another's reverse. What failed is the pair of numbers the sentence names, which it
inherited from `AW2`. It is scored `FAILED` on the whole sentence, and both readings
are in the manifest so the call can be overruled rather than re-derived.

**And the sweeps agreed with the samples everywhere.** The plan that bought this
instrument listed "the exhaustive sweeps disagree with the samples" as the outcome
that would retire results in `Y`, `E` and `Z`. It did not happen: every corner those
sets disclosed as sampled is now swept — both six-trit adders at both non-zero
carry-ins, all three restore variants, and the ten-bit binary adder — with zero
wrong sums, zero wrong overflow trits and zero pairs off their recorded pass count.

### 8. And inside that instrument, where the time actually goes

`AV` priced the solver from the outside. `AX` opens it. One pass of the WebAssembly
solver is three sequential loops with three different trip counts — conduction once per
device, the reachability walks twice per rail, and the per-node update once per node —
and nothing had ever measured which of them holds the time. Conduction had never been
named as a cost at all.

**The ablation `AV` used does not transfer, and that is the whole design problem.**
Removing a phase corrupts the input of the next: ablate conduction and the walks
traverse a stale graph, ablate the walks and the update loop takes different branches.
A subtractive decomposition would measure each phase against a perturbed neighbour and
report the perturbation as the phase. So this one is **additive**. Four modules are
emitted from one intermediate representation by substituting a single function — the
whole pass, conduction alone, the walks alone, the update alone — the early exit is
removed from every one of them *including* the whole, and each is seeded to the same
state captured after a full solve of one operand pair and then run for a fixed pass
count over that fixed state.

**That state is a fixed point of all four variants**, which is checked and not assumed,
and it is what makes the construction work: over a full settling count not one byte of
linear memory moves, so every pass does identical work and no phase is ever timed
against a neighbour something else has disturbed.

| | registered | measured |
|---|---|---|
| `AX1` the reachability walk is the majority | 0.55 to 0.80 of the whole | 0.6167 |
| `AX2` conduction is not negligible | at least 0.10 | 0.1131 |
| `AX3` the split belongs to the algorithm, not the network | each share within 0.10 | widest 0.0359 |
| `AX4` and the parts sum to the whole | within 0.15 | 1.0175 |

**The gate came first here too.** The whole pass, with its early exit restored, is
byte-for-byte the module `AV` proved, and it was held against `src/device.js` again on
this branch before any clock was read — the same 128 networks and 313,697 node values,
zero divergences.

**The harder question was whether the ablated modules had actually stopped.** Three of
the four compute a wrong answer by construction, so no gate can hold them against
anything, and *each part is faster than the whole* is a timing inequality offered as
evidence about timing. Two independent demonstrations answer it. The emitted bytes
satisfy an exact identity — the whole pass's function body is the empty variant's
prologue, then conduction's bytes, then the walks', then the update's, then the empty
variant's scaffolding, and the shipped function is that same run with the early exit
spliced in — so each variant carries exactly its own slice, encoded the way that slice
is encoded inside the whole. And a **write probe** fills one state region with a byte
that is neither a state code nor a conduction code, runs the variant, and reads back
what survived: a region a variant must not touch comes back byte-for-byte poisoned, and
a region it does write comes back *restored* to what the full solve produced. It is
checked against a mutant that did not stop, and it catches it.

**`AX3` is what makes `AX1` worth quoting anywhere else.** The two networks were chosen
to differ in the way that would break it — the decoded adder runs 540 devices over 208
nodes against 624 over 328, so proportionally more conduction per node and fewer node
updates per device — and the three shares move in the direction that shape predicts and
nothing like as far as the line. Their settling counts differ as well, so the split is
not a property of running seven passes.

**And the instrument came nearer to deciding this than the subject did.** The number of
passes in a timed run is a free parameter, and at a fifth of the one used here, one run
in five put the walk at 0.5474 — under `AX1`'s floor, on the same machine, from the same
state, with the same modules. Doubling the block moves the three shares by at most
0.0451 on any of the five runs, so the block length changes the *variance* and not the
value, and lengthening it is an estimator improvement rather than a thumb on the scale.
It is disclosed anyway, with the short-block runs kept beside the long ones, because
the choice was made after seeing that a short block could flip a verdict. `AX2`'s margin over its floor and the
spread between runs are the same order, so it should be read as a range and not as the
digit after it.

**What this does not say** is what any of it implies for a solver that slices across
operand pairs. That is arithmetic over `AX1`, and it belongs to whatever set proposes
one.

---

## How it was established

| | |
|---|---|
| tools | [`device-audit.js`](../tools/device-audit.js), [`axiom-audit.js`](../tools/axiom-audit.js), [`midrail-audit.js`](../tools/midrail-audit.js), [`solver-audit.js`](../tools/solver-audit.js), [`carryin-audit.js`](../tools/carryin-audit.js), [`phases-audit.js`](../tools/phases-audit.js) |
| tests | `test-device.js`, `test-axioms.js`, `test-midrail.js`, `test-solver.js`, `test-carryin.js`, `test-phases.js` |
| method | axioms are checked by **breaking them** and observing what stops working, not by restating them |

`test-device.js` also carries a deliberately naive second solver and holds the two
against each other on 400 random networks plus a seeded oscillator that random
networks cannot produce — the differential test that caught `W2`'s false verdict.

---

## What it does not show

The model states four limits and calls the first the largest:

1. **the middle rail is free** — priced by `Z1` and `N3`/`N4`, and unsettleable from
   inside the model;
2. **there is no level restoration** — `Z3`/`Z4` priced it;
3. **there are no noise margins** — nothing here is evidence about analogue behaviour;
4. **multi-threshold devices count as one switch each.**

Beyond those:

- **Wiring and power are unrepresented**, and in a real design at this device count
  wiring would dominate area.
- **"Passes" is not time.** It is a property of the fixed-point solver. Delay appears
  in this model only through restoration (`Z5`), and ripple delay is invisible (`Y2`).
- **Minimality results are over a stated 42-device space**, not over all physics.
- **`W3`'s 0.80 should not be believed as a general claim**, and its own registration
  said so before `Z1` priced it.
- **`AV` prices the instrument on one machine and says so.** The seconds behind its
  ratios are this machine's; the seconds recorded in `Y1` and `E1` are other hardware,
  and no ratio here is taken against them. What transfers is the shape — where the
  oracle's time is not, and that the two rewrites agree with it — not the figures.
- **`AV` did not run the sweeps the instrument was built for; `AW` did.** They were
  deliberately a later set, registered after this gate went green, because an
  instrument that has not been held against the oracle produces facts about the
  instrument. `AW` re-ran that gate on its own branch before reading a single count,
  and on the module it actually swept with rather than only on the stock one.
- **`AX`'s shares are shares of a pass over a CONVERGED state, on two networks.** The
  state is fixed by the construction and is the one the registration named, but at
  convergence no device on either network is unknown, so the definite and possible
  walks traverse identical edges. A decomposition seeded mid-solve is a different
  measurement and nobody has made it. And two networks are two networks: both are
  ripple adders, and `T-CLAIM-NARROWED-BY-A-DESIGN` has bitten twice for exactly the
  step from *the two things I swept* to *the algorithm*.

---

## Owned sets

| set | subject | outcome |
|---|---|---|
| `W` | the switch-level device layer beneath the arithmetic | all held |
| `X` | the axioms the device model rests on | 4 held, `X2` failed |
| `Z` | the two limits every switch count is quoted under | 4 held, `Z2` failed |
| `AV` | what the packed representation buys the solver, and what WebAssembly buys on top | 1 held, `AV1`, `AV2` and `AV3` failed |
| `AW` | whether the pass-count rule survives a non-zero carry-in, where `F` said the bottom position can save | all four failed |
| `AX` | where the WebAssembly solver spends a pass, decomposed into its three phases | all four held |

Full text in [`99-ledger.md`](99-ledger.md).
