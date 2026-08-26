<!-- kind: results-topic -->
# 07 — What was wrong: eleven failed predictions, and seven lying instruments

**Owns no sets.** Cross-references `P`, `X`, `Z`, `E`, `H`, `J`, `A`, `D`, `N`.

This is the load-bearing file. Ninety-seven predictions held, and a reader has no
way to know whether that means the method works or the predictions were safe. **The
eleven that failed are the evidence.** Every one is kept, none was quietly corrected,
and four produced the result that replaced them.

A scientific negative-results section owes two lists, not one: **predictions that
failed**, and **instruments that lied**. The second kind never becomes a failed
prediction — it produces a confident wrong number that nobody registered — and it is
the more dangerous of the two.

---

## What is established

### Part one — the eleven failed predictions, ordered by what they taught

#### The ones that produced their own replacement

**`Z2` — "buffering cannot take ternary pass depth below 4, and binary gets 3 for
free."** The single most productive failure here. Refuting it required a selector
nobody had considered, and that selector — the **decoded** family, paying for a MID
detector once per *signal* rather than once per *selector* — became the best circuit
in the repository: a six-trit adder at 540 switches against the tree family's 624
(`E1`). The claim was narrowed by a design: a sweep over one family of trees had
been stated as a fact about ternary.

**`J4` — "a register read in the same solve as a write sees the old value."** It sees
the **new** one: the write holds the feedback loop open, so the cell is a transparent
latch. That forced the master-slave register (`K`), doubled the register file, and
made two-phase non-overlapping clocking *load-bearing rather than conventional* —
`K4` then produced the failure deliberately by asserting both phases at once.

**`X2` — "the fixed point is not unique, and an all-X start is indistinguishable from
all-Z."** Falsified an axiom as drafted, twice over: the correction — "a node
reaching X stays there" — was **also** false, because nodes pass *through* X. 481
existing checks were blind to it because every one inspected only final states. That
is where the staged-resolution instrument came from.

**`A2` — "a selector tree fed by a computed source inherits the bus's cold-start
precondition."** It does not. A computed **data** node is rail-driven through
whatever produced it and resolves; what poisons a network is an unresolved
**control** node. The boundary had been registered *explicitly so it could be wrong*,
and being wrong is what separated control from data — which is why the trap class is
named after control.

#### The ones that corrected the record

**`P3` — "reach is a direct product across trit positions."** 47 at width two, not
49. The positions are not independent, and the whole ceiling ladder (`Q`–`V`) is the
work of finding out what they actually are.

**`E4` / `E5` — "exactly 13 passes for every operand pair, independent of the data"**
and "it taps the mid rail less." Both wrong. The decoded adder's settling time
**depends on its operands** (9 to 13 passes), which is the first data-dependent cost
in the project and propagates all the way to `L3`: *a machine built on this design
has no fixed clock period.* And it taps the mid rail **more**, not less — 34% against
27% — which is what `N3` later turns into a crossover.

**`H1` — "the solver is linear, not superlinear as the design documents assert."**
Failed on both numeric criteria, and then failed *differently*: its spread threshold
measured 3.72 on one run and 2.89 on the next, either side of its own line. **The same
world produced both a pass and a fail.** That is a defect in the prediction, not a
fact about the subject, and it is the origin of `T-CRITERION-IN-THE-NOISE`.

**`D3` / `D4` — the hashing pair.** `D3` predicted that fixing injectivity would give
mixing; it does not, because a positionwise 3-cycle *is* addition of a constant and
the sum stays affine. `D4` predicted collision counts would separate a mixing map
from a periodic one; **they separate nothing** — truncating any permutation is
uniform by construction, so a map proved to repeat every six calls scores 0.96× the
ideal. The second failure **disqualifies the most obvious test of a hash**, which is
worth more than the prediction would have been.

**`N1` — "a tap is unavoidable iff some node must carry MID."** Failed two ways, and
the second is the instructive one. The test asked *"does this **build** put MID on a
node"*, which is not the rule as registered — the rule was *"must some node carry MID
for the **function** to compute"*. It scored the detector FORCED while the very next
section built the same function with **zero** taps. **A circuit that uses the mid rail
is not a circuit that needs it**, and separating the two requires a search over
equivalent circuits that the test did not do.

---

### Part two — the seven instruments that lied

None of these was ever a registered prediction. Each produced a confident, clean,
mechanistically plausible wrong answer. They are catalogued as
`T-INSTRUMENT-FALSE-VERDICT` (7 occurrences) and the detail lives in
[`99-ledger.md`](99-ledger.md); what follows is what they have in common.

| # | the instrument | what it reported | what was true |
|---|---|---|---|
| 1 | search reported *exhausted* as *closed* | a false FAILED verdict | the search had run out of budget |
| 2 | reachability ran *through* rails | correct circuits resolving to unknown | rails terminate a path |
| 3 | a network key ordered terminals that have no order | a false ABSENT | the key violated an axiom |
| 4 | memory rig held cells with the **write** control asserted | "nothing works", 81 of 81 reading empty | the feedback loop was open, so every cell floated |
| 5 | a detector's truth table hand-copied from a comment, inverted | 36 of 54 failures, **every one** where the middle word disagreed | a leg conducted on exactly the addresses where it must be off |
| 6 | decoder and read tree disagreed about **endianness** | writes landing in the wrong word, every read-back failing | each half was internally consistent |
| 7 | a verification case paired a 3-cycle with a **25**-cycle and called it `A₂₇` | the tool scored WRONG | the tool returned 25!/2, exactly right for what was built |

**The common shape, and the reason this list exists:** a wrong instrument does not
produce noise. **It produces a clean, mechanistic, entirely plausible finding.**

Number 5 is the sharpest illustration. Every one of its 36 failures was a case where
the middle word disagreed with the selected word, and none where they agreed — the
exact signature real contention would leave. It read as a publishable headline: *the
decoded selector cannot read storage.* It was an inverted seed.

Number 7 points the other way and is worth its own sentence: **a verification case is
as suspect as the thing it checks.** The tool was right and the check was wrong.

The operational rule this produced, now in [`../AGENTS.md`](../AGENTS.md): *when a
result contradicts a prediction, suspect the instrument first — it is cheaper to rule
out than the finding is to publish.*

---

### Part three — checks that failed for the right reason in the wrong place

Two more, distinct from both lists above, because the code was working as written and
the *specification* was wrong:

- **A check encoding "we are early."** The design suite required `PROPOSED` to be the
  commonest status marker, "which is correct for a design phase". It stopped being
  true at 53-to-53, because the design was being **built**. The check was asserting a
  phase of the project as though it were a property of it.
- **A check forbidding a healthy state.** One demanded that the number of tools equal
  the number of prediction sets. They are equal only *between* phases — during a
  registration there is deliberately one more tool than there are results. **The check
  was failing on the protocol working.** (`T-CHECK-FORBIDS-HEALTHY-STATE`, 2)

---

## How it was established

Every failed prediction is recorded with its measured values in
[`FINDINGS.json`](../FINDINGS.json) and rendered in
[`99-ledger.md`](99-ledger.md). The protocol that makes "it failed" meaningful is in
[`../AGENTS.md`](../AGENTS.md): a prediction is registered in its own commit, the run
happens after, and results land in a second commit. The ordering is checked
mechanically — and every recorded commit must be **reachable from the branch**, not
merely present in a local object store, which is itself a defect this project found
and fixed.

The defect classes and their occurrence counts are in
[`99-ledger.md`](99-ledger.md); the operational write-ups an agent reads before
working here are in [`../AGENTS.md`](../AGENTS.md).

---

## What it does not show

- **Eleven failures out of 108 is not a calibration claim.** The predictions were not
  drawn from any distribution, and there is no control arm. It is entirely possible
  the finite domain and the reference implementation did the work rather than the
  protocol.
- **The instrument list is not exhaustive.** It is the instruments that were *caught*.
  Every one was found because a result looked wrong; an instrument that lies in the
  direction of the expected answer would still be in the corpus.
- **"Kept, not corrected away" is checked only in one direction.** The suite verifies
  no failure quietly becomes a success. It cannot verify that a failure was recorded
  in the first place.

---

## Owned sets

None. This file states no result of its own — it cross-references the failures inside
`P`, `X`, `Z`, `E`, `H`, `J`, `A`, `D` and `N`, each of which is owned elsewhere.
