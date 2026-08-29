<!-- kind: results-topic -->
# 07 — What was wrong: every failed prediction, and every lying instrument

**Owns no sets.** Cross-references `P`, `X`, `Z`, `E`, `H`, `J`, `A`, `D`, `N`.

This is the load-bearing file. The great majority of predictions held, and a reader has
no way to know whether that means the method works or the predictions were safe.
**The ones that failed are the evidence.** Every one is kept, none was quietly corrected,
and four produced the result that replaced them.

A scientific negative-results section owes two lists, not one: **predictions that
failed**, and **instruments that lied**. The second kind never becomes a failed
prediction — it produces a confident wrong number that nobody registered — and it is
the more dangerous of the two.

---

## What is established

### Part one — the failed predictions, ordered by what they taught

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

**`AB5` — "the reversible fragment of this instruction set reaches the full
symmetric group, so the machine erases by convention rather than necessity."** The
first clause held exactly — the named zero-erasure ALU generates 1,458, the 729
translations extended by negation. The second **failed, and inverted the
conclusion.** Admitting every one of the 216 information-preserving tritwise tables
at every operand does not come close: the orders land on a closed form,
**2^W · 3^((3^W − 1)/2)**, matching exactly at every width the stabiliser chain can
reach. Width 1 is the only place reversibility is free. By width 4 the fragment is
10⁻¹⁰⁰ of all permutations. So **the eraser is load-bearing** — take away the one
information-destroying primitive and what remains cannot compute, which is the same
shape as the classical result about selection. The closed form is the replacement
the failure produced, and nobody predicted it.

**`AB4` — "the erasure charge is not recoverable from the program text."** Predicted
a gap for every program and a factor above two somewhere. **Six of eight programs
charge exactly their text bound**, and the largest gap is 1.21×. The reason is the
instruction mix: the operand-dependent opcodes do not appear in those six, so the
worst case *is* the actual case. The corrected claim is conditional and sharper than
either the prediction or its negation — **a static price transfers exactly when the
instruction mix is operand-independent.** That distinction is the whole answer to
the question the set was opened to ask, and it only exists because the prediction
was too strong.

**`AC1` — "only two of the eight programs have an input-dependent step count, and
they are `countdown` and `fold`."** Failed on the count, on the membership, and on
its own premise. `fold` does not vary; `multiply` and `threeway` do. And the premise
that five of eight execute `IN` was itself the output of a broken detector — **all
eight do.** The corrected picture is sharper than the prediction: reading input is
universal here and **cost-invariance is still the norm**, with five of eight
programs costing exactly the same number of steps whatever data they are given.

**`AC3` — "a ratio above 300×."** The structural claim held and the number failed at
182.5×, for a reason worth keeping: **the cheap program's four-step floor sits in
the denominator**, so the ratio is 730/4 rather than 364/1. Predicting a ratio
without accounting for constant overhead is the same error as quoting a speedup
without the serial fraction.

**`AC4` — "erasure per step spans more than 2× across the programs."** It spans
**1.68×**. The eight programs are more alike in erasure intensity than in anything
else this project has measured about them. The ordering clause held — the
longest-running program is not the hungriest per step — so the finding survives at a
narrower margin than the prediction claimed.

**`AF4` — "the best consonance and the most divisors both land on a multiple of
six."** The best equal division for consonance between 5 and 72 is **53**, which
is **prime**; 31 is close behind and also prime. The divisor clause held at 60.
So the tidy unifying story was wrong and the layers **decouple**: harmonic
symmetry and rhythm want compositeness, consonance does not care about it at all.
Predicting that three layers would agree was reaching for a single sentence where
the measurement supports two — and the failure is what turned §7's withdrawal
into an actual answer rather than a gap.

**A claim this project made about itself, in prose.** `AE2` and `AE4` measured
**one** musical affordance — how many chords can be transposed onto themselves — and
the write-up headed the section *"and here ternary is genuinely worse"*, generalising
from one affordance to an entire art form. Consonance, rhythm, contour and timbre
were untouched, and so was the difference between ternary as a **tuning** and ternary
as an **addressing** scheme, which is the layer a 3×3 pad grid actually uses.
Narrowed to *"a prime-power pitch-class space is poor in transpositional symmetry"*,
and recorded as `T-CLAIM-NARROWED-BY-A-DESIGN`'s third bite — the first scored
against the prose rather than against a sweep. **The tell is the same every time: the
sweep visited one thing and the sentence named a category.**

**`AE4` — "above 2% of twelve-tone subsets have transpositional symmetry."** It is
**1.81%**, optimistic by a fifth. Every other clause held — ℤ/27 at 0.00038%, and
the gap at 3.7 orders of magnitude — so the direction and the magnitude both
survived a threshold that did not. **A number picked to sound decisive is a worse
prediction than the ratio it was standing in for**, which is
`T-CRITERION-IN-THE-NOISE` wearing a different costume: the claim was made
brittle for rhetorical reasons rather than measured ones.

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

**`T4` — "the best set of control fields packable into the opcode's spare trits
is six wide and separates every opcode."** It is **five**, and separates nothing on
its own. Six trits of spare capacity exist, but the fields are chunky — widths
1,1,1,1,3,1,1,2 — and no combination summing to six distinguishes all 25 opcodes.
Optimistic by exactly one trit, which still leaves a 45% cut to decode at zero
memory cost.

**`N1` — "a tap is unavoidable iff some node must carry MID."** Failed two ways, and
the second is the instructive one. The test asked *"does this **build** put MID on a
node"*, which is not the rule as registered — the rule was *"must some node carry MID
for the **function** to compute"*. It scored the detector FORCED while the very next
section built the same function with **zero** taps. **A circuit that uses the mid rail
is not a circuit that needs it**, and separating the two requires a search over
equivalent circuits that the test did not do.

---

### Part two — the instruments that lied

None of these was ever a registered prediction. Each produced a confident, clean,
mechanistically plausible wrong answer. They are catalogued as
`T-INSTRUMENT-FALSE-VERDICT` (16 occurrences) and the detail lives in
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
| 8 | an adder cell built **without its tag**, which names its internal nodes | the sequencer visiting 2 states instead of 27 | three cells shared node names and merged into one circuit |
| 9 | a handshake rig counted the driving values that **disable** the loop | a self-timed handshake reported as working | no handshake occurs in either of those two cases |
| 10 | a claim's own qualifier dropped between registration and check (`G4`) | a quantity restated in a second set scored as colliding with itself | the registered sentence carried the qualifier all along |
| 11 | an interconnect rig **seeded** its sources instead of driving them | both topologies routing Z — "interconnect does not work at all" | a seed is an initial value, not a driver; these were never sources |
| 12 | an erasure census folded the operand **into** the state | MIN as a single fixed 4.5033 bits | the clauses spoke of a range, 0 to 9.5098, and it held |
| 13 | a hand-rolled regex missed every **labelled** instruction | a deterministic program costing different amounts for data it never reads | `threeway.tasm` carries `body:   IN`, and all eight programs read input |
| 15 | a reuse instrument walked **divergent** trajectories to a 3,000-step guard | hailstone at 1,513x reuse, when a tabulator gains nothing from a cycle | the true figure is 10.43x, and 3,777 visits reproduces `AD2` exactly |
| 16 | an external spec's **indices** misread — `Σ prev` taken to include the last term | the Ladder's central operator reported as generating powers of two, not Fibonacci | `L(n+1) = 1 + Σ L(0..n−1)`; `prev` excludes the last term, and one term changes the species |
| 14 | a tabulator memoised only the **terminating** values | a patient predictor 300x **worse** than re-running — the answer that flattered the hypothesis | non-termination is an answer too; recording it costs 728 evaluations, not 1,098,362 |

**The common shape, and the reason this list exists:** a wrong instrument does not
produce noise. **It produces a clean, mechanistic, entirely plausible finding.**

Number 14 adds the sharpest corollary. Every other entry here was caught because
the result looked wrong. That one pointed **toward the hypothesis under test** —
it made an implied receipt look sound — and an instrument erring in the direction
you are hoping for will never be caught by finding the answer surprising, because
it is not surprising. It was caught by the number being absurd on its face: a
million evaluations to price 729 inputs. **Suspecting the instrument is not
enough; the arithmetic has to be checked against what it could possibly be.**

Number 5 is the sharpest illustration. Every one of its 36 failures was a case where
the middle word disagreed with the selected word, and none where they agreed — the
exact signature real contention would leave. It read as a publishable headline: *the
decoded selector cannot read storage.* It was an inverted seed.

Number 13 is the sharpest recent illustration of the first paragraph. The wrong
answer was **more interesting than the right one** — a deterministic machine whose
price depends on data it never touches would have been the finding of the set, and
it was a line-anchored regex sitting next to an exported tokenizer that would have
answered correctly. A hand-rolled parser beside a real one is the whole defect.

Number 7 points the other way and is worth its own sentence: **a verification case is
as suspect as the thing it checks.** The tool was right and the check was wrong.

Numbers 8 and 9 came from **one tool in one run**, pointing opposite ways — a false
negative and a false positive together. Number 8 is the quieter danger of the two: an
argument that *looks* optional, omitted, silently welding three circuits into one.

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
- **A duration asserted in a test.** `test-headroom` section 5 checked "the adder is
  sweepable inside an hour" against a live timing. It passed on an idle machine and
  failed at 1.84 h in a suite run on a loaded one — **the same world returning both
  verdicts**, which is `T-CRITERION-IN-THE-NOISE` sitting four sections below the
  comment in the same file explaining why not to do it. Section 4 of that file
  already refused to assert durations and enforced the refusal by grepping itself;
  section 5 was quietly doing what section 4 forbids. Repaired the way the class
  prescribes: assert the **ratio**, which survives any host, and report the hours
  without checking them.
- **A tool covered only where it was not broken.** Making the erasure audit silent
  on import, by mechanically renaming every `console.log` call to `log`, also
  rewrote the body of `log` itself into a call to itself. The tool crashed with a
  stack overflow on **every run**, and its whole suite stayed green — a test that
  imports the module sets the main-module flag false, so no print path ever
  executes. Every number it produced was correct; the program was broken in the
  half nobody looked at. Caught only by running it end to end before committing.
  (`T-TOOL-CHECKED-ONLY-BY-IMPORT`, 1)
- **A census whose universe grew underneath it.** `G4` counts integers appearing
  in both the vocabulary half of the manifest and the circuit half, and its
  classifier has a third bucket — `other` — for a tool requiring neither. The
  crossing test treated that bucket as a side. Set `AB` then recorded **19,683**,
  the size of the two-input tritwise function space, which `Q` already held; a set
  belonging to **neither half** read as a brand-new six-digit collision. The
  computation was right and the question was not the one registered.
  (`T-SCOPE-DECIDES-THE-VERDICT`, third bite — and the only one of the three found
  by a check going red rather than by reading.)
- **A check forbidding a healthy state.** One demanded that the number of tools equal
  the number of prediction sets. They are equal only *between* phases — during a
  registration there is deliberately one more tool than there are results. **The check
  was failing on the protocol working.** (`T-CHECK-FORBIDS-HEALTHY-STATE`, 2)

---

### Part four — the criteria that were not evidence

The three parts above ask whether a claim was wrong. This one asks something narrower and
worse: **was the criterion discriminating?** A line placed where the null clears it
routinely is not evidence, whichever side it lands on — and unlike a wrong claim it leaves
no mark, because a verdict is a verdict whether or not anything was at stake.

**The unit is the leg, not the prediction.** A prediction with three legs can hold on the
two that were evidence and fail on the one that was not, so scoring at prediction level
averages away exactly what is being measured. Of the 165 predictions standing as at risk,
50 place a magnitude line; 32 of those admit a null anyone can draw without inventing the
chance model. **Thirty-one of the 32 were scored**, and they carry **55 legs — 43 held, 12
failed**. The 32nd is `AQ4`, which arrived in this class after the sweep had run and has no
scored leg: a line-bearing prediction whose null is drawable and which nobody has drawn. It
is a gap, not a result, and it is not counted into the 55.

**Sixteen of the 55 are not discriminating** — the null crosses the registered line
between 5% and 95% of the time. Nine held and seven failed.

| leg | verdict | the registered line | the null | how often the null clears it |
|---|---|---|---|---|
| `H1(a)` | FAILED | time per device-pass within a factor of 3 of constant | host load | 3.72 on one run, 2.89 on the next |
| `H2(a)` | HELD | a 50,000-device solve under one second | host load | a duration line; margin 14.18x against a swing this corpus measured at 14.35x |
| `D4` | FAILED | truncated collisions separate a mixer from a positionwise map | any permutation | always — 27 buckets of 27 by construction |
| `AM2` | FAILED | the affine task groks soonest | one paired comparison | 50% |
| `AO1(a)` | FAILED | erasure within 5% of the 0.8265 null | a random ceremony map | 16% — 64 of the tool's own 400 draws |
| `AO4` | HELD | exposed secrets within 10% of both 268.4 and 264 | random map on 729 points, 8,000 draws | 6.54%, CI [6.02, 7.10]; measured 252 sits 1.27 sd inside |
| `AR1` | HELD | the varying optimum costs at least 85% of the constant one at every cell | 300 matched redraws over [2, 8192] × 8 decades | 9.0%, CI [6.3, 12.8] |
| `AR2` | HELD | the largest single-leaf jump less than half as large | 500 matched redraws | 87.5%, CI [71.9, 95.0] — but the recorded HELD is the null's *minority* outcome |
| `AT1(b)` | HELD | no ledger of 2,000 needs more than 12 insertions | uniform | 7.7%, CI [4.4, 10.9]; 2 of 12 seeds |
| `AT2(d)` | FAILED | no ledger anywhere needs more than 100 | uniform | about 58% |
| `AT3(a)` | FAILED | two free insertions accept within 2.0 of 28.0 | the true chance value is 30 | 5 of 12 seeds fail, 7 hold |
| `AU1(a)` | HELD | ops ratio in [0.93, 1.07] | the random head family | measured 0.9302; four further seeds straddle |
| `AU1(c)` | HELD | the split head inside the random family's min-to-max range | exchangeability, **exact** | a 25th draw falls outside the min-max of 24 with probability 2/25 = 8% per statistic |
| `AU2(b)` | HELD | collision slope in [0.45, 0.55] | the exact finite-N birthday law | the *ideal object* misses on 3 of 7 candidate windows |
| `AU2(c)` | FAILED | reshuffle ratio in [0.95, 1.05] at widths 1–3 | — | failed at width one where the statistic is 0/0; 0.0008 inside its line at width three |
| `AU3(c)` | HELD | slope gap at least 0.05 | the head family | measured 0.0545; 3 of 12 seeds cross |

**Four more could not have gone the other way at all**, at P(recorded verdict | null) at or
above 0.99. `AP2(a)`, `AP2(b)` and `AP2(c)` all held at P = 1: the base-3 digit map is a
bijection onto (Z/3)⁶ and the positions are independent under a uniform pair, so the
exhaustive mean over all 531,441 ordered pairs is *identically* (5/3)⁶ — 21.43347050754458
against 21.433470507544587, a difference of −7.1e-15 — while the maximum 64 and the minimum
1 have explicit witnesses. `AR4` failed at 500 of 500. **One is undetermined**: `AR3`
crosses at 4.2%, CI [2.8, 6.3], an interval straddling the bar, so what is undecided is the
classification and not the measurement.

#### Seven recorded failures rest entirely on a criterion that was not evidence

`AO1`, `AT2`, `AT3`, `AU2`, `AM2`, `D4` and `AR4`. Each says so in its own entry in
[`99-ledger.md`](99-ledger.md), and each says the second thing too, because they are
different things: **a line in the noise corrupts a verdict; it does not automatically
corrupt a finding.** All seven findings survive. `AT3(a)` was decided by the draw and
chasing it found c(ZERO) = 3 against a control's 0; `AT2(d)` produced the
draw-the-null's-tail rule out of the null's own draws rather than out of the measured
value; `AO1(a)` produced the distributional-null rule; `D4` produced `AN1`, and is the one
case where the criterion's inability to discriminate *is* the finding. `AM2`'s criterion is
a coin on a single paired comparison and its finding is four of four paired seeds —
stronger than the criterion ever asked for.

**Do not read these two sevens as one list.** The seven *failed non-discriminating legs*
are `H1(a)`, `D4`, `AM2`, `AO1(a)`, `AT2(d)`, `AT3(a)` and `AU2(c)`. Membership differs by
exactly one element on each side: `H1` also failed on leg (b), which is discriminating at
some five standard deviations, so `H1`'s FAILED is carried by a leg the null could not have
produced; `AR4` is not a noise line at all but a line the null clears with probability one,
and its single leg is the whole of its verdict.

#### The silence: eighteen lines with no null anyone can draw

`AH1`, `AH2`, `AH4`, `AC3`, `AC4`, `AE3`, `AE4`, `AG2`, `AG3`, `AG4`, `AJ2`, `AL4`, `R3`,
`G2`, `H4`, `N4`, `AD2`, `AM3`. Eighteen of the 50 line-bearing predictions carry a
magnitude line over a statistic that is an exhaustive deterministic fact, with no chance
model available that the auditor would not have had to invent — and inventing it would make
the auditor the author of the thing being audited. **They are unmeasured, not clear.**

**Nothing is claimed about how these eighteen came out, and the refusal is the result.** A
failure rate for the class was computed and published during this integration, and it is
retracted in full, including in any hedged form. Three reasons, and all three are properties
of the class *definition* rather than caveats appended to a result.

- **The classification was not outcome-blind in procedure.** The survey that assigned all
  165 read dumps carrying each claim's outcome label beside it, so the boundary of this
  class was drawn by someone who could see the answers, and no statistic over it can be
  cleaned of that afterwards.
- **The assignments the auditor was least sure of carried the whole result, and re-reading
  them changed the class rather than annotating it.** `AQ1` and `AQ2` are corrected out
  altogether — not disputed, *misclassified*: an exhaustive existence claim and two parity
  censuses, never line-bearing at all. `AQ4` is corrected into the drawable class, because
  "differ by no more than 15%" is a magnitude band whose null is drawable through
  [`../tools/radix-audit.js`](../tools/radix-audit.js)'s control, which uses exactly `AQ`'s
  constants. What remains disputed is smaller and stays unresolved: whether `AQ4` belonged
  in the drawable class from the start, and `AM1` and `AM4`, which sit there with "no null
  drawable" written beside them in the auditor's own leg table.
- **The two classes are defined on different axes and do not partition anything** — drawable
  is *stochastic, or names a chance value*, this one is *exhaustive and deterministic*.
  Zero of the 50 straddle, which rules out the failure mode a reader will otherwise assume.

The class sizes are published — 115 predictions with no line at all, 18 with a line and no
drawable null, 32 with both, summing to the 165 at risk — and **the outcome breakdown of the
middle class is withheld**, because that breakdown is the retracted statistic and a raw pair
of counts is one step from it.

One process flag is kept although it came out clean, which is the point of keeping it: `N4`
was assigned without its registered text being read, volunteered as such by the auditor
against its own interest, and has since been read and the assignment **confirmed**. A flag
on process is worth less if only the ones that turn out wrong get reported.

**And the reason `AQ` was misclassified is the most transferable thing in this section.**
The sweep's extractor recovered each set's registration with `git show <registered_at>:<tool>`
and searched it for the header `PREDICTED OUTCOMES`. `AQ`'s tool said `REGISTERED PREDICTIONS`
at the time it was registered, so the extractor found no block, fell back silently to the
manifest's one-line summary, and **`AQ` is the one set in the corpus whose registered criteria
were never read at any point in the audit** — the set whose classification was then disputed
and found wrong on all three predictions. The header was normalised at some later commit, so
at HEAD every tool looks fine and always did: **an extractor that reads history can be broken
by history in a way no check at HEAD can see.** Checked at each set's *own* `registered_at`,
exactly one of the 47 lacks the header. `F-AN-EXTRACTOR-THAT-READS-HISTORY-IS-BROKEN-BY-HISTORY`.

#### The boundary every count here stops at

**Every count is a floor, and the gap between it and the truth is exactly the competence of
whoever wrote the registrations.** A criterion that was in the noise, noticed by its
registrant, and widened before the registration commit is invisible by construction — there
is nothing in `git show <registered_at>:<tool>` to find. `AS1(c)` is the visible half: its
registrant drew the null's tail before placing the line at 40 — an exact Binomial(10920,
1/729) whose modal 2,000-draw maximum is 29 at p = 0.257 and whose P(max > 40) is 4.4e-5 —
and wrote the computation into the `AT RISK` annotation. Everyone who did that silently left
no trace.

So a low rate can mean the criteria were good, or that the bad ones were fixed in the hour
before they were committed. This sweep cannot separate those and does not try. **No estimate
of what is behind that boundary is offered**, because an estimate of the unrecorded is
exactly the kind of number this audit exists to catch.

The full record is `F-A-LINE-THE-NULL-CLEARS-IS-NOT-EVIDENCE`.

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

- **The ratio of failures to predictions is not a calibration claim.** The predictions were not
  drawn from any distribution, and there is no control arm. It is entirely possible
  the finite domain and the reference implementation did the work rather than the
  protocol.
- **The instrument list is not exhaustive.** It is the instruments that were *caught*.
  Every one was found because a result looked wrong; an instrument that lies in the
  direction of the expected answer would still be in the corpus.
- **"Kept, not corrected away" is checked only in one direction.** The suite verifies
  no failure quietly becomes a success. It cannot verify that a failure was recorded
  in the first place.
- **Part four's counts are floors on the held side and near-censuses on the failed side.**
  A criterion that failed was found *because* it failed; a criterion that passed was found
  only because one reader swept for it. The two columns are not comparable, and the
  imbalance runs further toward the held side than the table suggests.
- **Part four scored the criteria of one class and refused to score another.** Eighteen
  line-bearing predictions have no null that does not have to be invented, and they are
  unmeasured rather than clear. Nothing here says how they came out, and the section says
  why that refusal is the honest answer rather than a gap.
- **One set's registered criteria were never read.** `AQ`'s registration used a header the
  sweep's extractor did not recognise, and the fallback was silent. Its three predictions
  were classified from a one-line manifest summary and all three were wrong. Nothing rules
  out a second silent fallback that happened to land on the right answer.

---

## Owned sets

None. This file states no result of its own — it cross-references the failures inside
`P`, `X`, `Z`, `E`, `H`, `J`, `A`, `D` and `N`, each of which is owned elsewhere. Part four
reaches further still, into every set the criterion sweep scored; those sets are owned by
[`04-machine.md`](04-machine.md), [`05-algebra.md`](05-algebra.md) and
[`06-economics.md`](06-economics.md), and nothing here restates their results.
