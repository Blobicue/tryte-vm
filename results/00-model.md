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

---

## How it was established

| | |
|---|---|
| tools | [`device-audit.js`](../tools/device-audit.js), [`axiom-audit.js`](../tools/axiom-audit.js), [`midrail-audit.js`](../tools/midrail-audit.js) |
| tests | `test-device.js`, `test-axioms.js`, `test-midrail.js` |
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

---

## Owned sets

| set | subject | outcome |
|---|---|---|
| `W` | the switch-level device layer beneath the arithmetic | all held |
| `X` | the axioms the device model rests on | 4 held, `X2` failed |
| `Z` | the two limits every switch count is quoted under | 4 held, `Z2` failed |

Full text in [`99-ledger.md`](99-ledger.md).
