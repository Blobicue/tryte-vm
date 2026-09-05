# The method

This repository is two things. One is a balanced-ternary computer. The other is a
worked record of how it was found out about — a discovery loop run almost entirely
by an agent, with every claim registered before it was measured and every failure
kept.

This document is the second thing, written so it can be run somewhere else. It is
deliberately separate from [`AGENTS.md`](AGENTS.md), which is the operating manual
for *this* repository. What follows is the part that is not about ternary.

---

## What it produced

<!--g:method-tally-->Fifty prediction sets, **209 registered predictions, 165 held, 44 failed.** Nineteen
distinct failure classes, which bit **71 times** between them. Seventy-two findings
measured but never registered<!--/g-->, listed separately so the pre-registration record is
not inflated by things that were never at risk. Every number in this section is
recomputed from [`FINDINGS.json`](FINDINGS.json) by the test suite; if this
document drifts from the manifest, the suite fails.

**That last clause was not true of the registered set itself, and a read-only audit
found it out.** <!--g:method-at-risk-->Twenty-five of those 209 were never at risk at all, and seven cannot be called either way. Corrected to what a run could
actually have refuted, the record is **177 at risk, 133 held, 44 failed — a 24.9%
failure rate** against 21.1% over everything registered<!--/g-->. The raw counts above are
not lowered: every one of those predictions was registered before its run, and that is
a fact about what happened. (This sentence used to carry the total as a literal, and it
went stale by eight the moment two more sets landed — `T-STALE-CONSTANT` inside the
document that names it. The count it wanted is generated two paragraphs up.)
The failures were never the problem — every one of them is real, and not one is among
the decorative, which is the rule validating itself, because a fact that was never at
risk cannot fail. What is not evidence is a sixth of the successes. `at_risk` is now a
compulsory per-prediction field and the audit is `F-REGISTRATION-IS-NOT-RISK`.

**And that correction was itself only half a correction.** A second read-only sweep asked,
of the predictions still standing as at risk, whether their criteria *discriminated* —
whether the null crosses the registered line often enough that the recorded verdict is a
draw rather than a finding. The arithmetic above cannot answer that. It weights every
prediction equally, and neither its numerator nor its denominator knows whether a
criterion could have come out the other way. Scored at the level a criterion actually
lives at — the **leg**, because a prediction with three legs can hold on the two that
were evidence and fail on the one that was not — 55 legs carry a magnitude line and a
null that can be drawn without inventing the chance model, and **16 of them are not
discriminating**: nine held, seven failed. Four more could not have gone the other way at
all, and one is undecided at the draw count run.

**The correction is asymmetric, and the asymmetry runs the wrong way.** The failed column
is close to a census — those legs were found *because* they failed, and somebody went
looking. The held column is one auditor's sweep of a corpus nobody had swept. So the held
figure is a floor and the failed figure is nearly complete, and the true imbalance runs
further toward the held side than the recorded split suggests. The corrective sentence
two paragraphs up moved only the held column: it subtracted the decorative from the
successes and left the failures untouched. **It needed fixing on both sides, and this is
the other side.** Neither figure is a rate, and
`F-A-LINE-THE-NULL-CLEARS-IS-NOT-EVIDENCE` states the boundary that keeps it from being
one — a criterion noticed by its own registrant and widened before the registration
commit leaves nothing behind to find, so every count here is a floor whose distance from
the truth is the competence of whoever wrote the registrations. No estimate of what is
behind that boundary is offered, because an estimate of the unrecorded is exactly the
kind of number the audit exists to catch.

**One consequence for the occurrence count in the paragraph above.** That sweep added
eight instances of a single defect class at once, from one reader looking rather than
from anything going wrong, so the total is a census of attention and not a running rate.
A rise in it does not mean the project got worse; here it means somebody swept.

A prediction carries two independent labels, and running them together was costing
something. `outcome` is the prediction against the run — held or failed. **`basis` is
the scope of the claim**: swept at the width it was swept at, or argued at every width.
<!--g:method-basis-->Ten of those 209 carry an argument that holds at every width rather than a sweep at one, and are marked `proven` in the manifest<!--/g-->,
each with its argument written out beside its measurement. The measurement is still
required. A proof does not excuse running it — an argument is also a thing that can be
wrong, and the run is what would say so.

**<!--g:method-failures-lede-->The 44 failures produced more than the 133 successes that were genuinely at risk<!--/g-->.** Each one is
still in the manifest, marked `FAILED`, with the result it led to:

| failed | what it claimed | what it produced |
|---|---|---|
| **AW1** | the decoded adder's pass-count rule survives a non-zero carry-in with position 0 admitted to it, exactly, pair by pair | it is wrong on exactly two thirds of every pair at both carry-ins, and what it produced is that the rule needed no amendment at all. `F` had scoped itself honestly — "with a non-zero carry-in the bottom position can save as well (six of its nine digit-pairs qualify) and the walk is a different one" — and this set was registered to cross that line. The six digit-pairs really do qualify and the bottom position still cannot save. The exclusion is about the BOUNDARY, not about the zero: position 0's carry is a primary input, so its MID detector resolves on the same pass as the operand detectors gating the selectors above it, and the early leaf has nowhere to go; one position up that gap is two passes and the saving is real. **A careful disclosure of a limit is not a prediction about what lies past it**, and a sweep that fixes the carry-in at 0 cannot tell the two reasons apart even in principle |
| **AW2** | exactly 46,899 pairs take the full thirteen passes at each non-zero carry-in | 223,803, and its own AT RISK line had named the arithmetic — "the number of constrained positions is four rather than five" — while getting the reason wrong. **The walk was not wrong; the start vector was.** Run from the vector position 0 actually hands on, with four applications rather than five, `F`'s own matrix gives 223,803 to the digit at both carry-ins |
| **AW3** | the two carry-ins are exact mirrors, bin for bin, with carry-state vectors (695, 3789, 727) and its reverse | every bin IS equal and the vectors ARE one another's reverse — the half the prediction is about held exactly, and its own refutation condition, "any single bin differing", was never met. What failed is the two numbers the sentence names, inherited from AW2. Kept `FAILED` on the whole sentence following `X2` and `E5`, with **both readings recorded** so the call can be overruled rather than re-derived. It is the clearest case in the corpus of a verdict that must not be read without its note |
| **AW4** | the pass-count floor drops from nine to eight once a fifth position can save | it stays at nine, which is the first of the two routes the prediction's own risk line named, and it did not drop below eight either — so `F2` stands and position 5 still cannot save. Four positions can save, and 13 − 4 = 9 |
| **AV1** | more than half of the switch-level oracle's per-solve time is spent in the per-node update loop rather than in the six reachability walks | 11.1%, and a second identical run agreed at 10.2%. The registration wrote its AT RISK line against its own arithmetic — edge visits outnumber update operations five to one, so traversal is the larger term BY COUNT — and predicted that allocation would be dear enough per operation to invert that. It is not. So the count was right and the claim built on it was wrong, which localises the cost: what actually separates the oracle from the packed solver is the per-solve `Map` of arrays of objects, the fresh `Set` per rail per mode per pass, and the string-keyed value object — the three things the ablation was deliberately forbidden to touch, because the next prediction's upper route was about exactly those |
| **AV2** | the packed representation is worth between 15 and 40 times the oracle | 10.37, and the derivation was on the record before the run so the miss is attributable rather than explicable. The band was one quotient: an anchor of 75 nanoseconds per edge visit over a target in the low single digits. The oracle measures 55.7 and the packed solver 5.37, so the anchor was too slow AND the target too fast, and the product of those two errors is the whole of it. **AV1 and AV2 were registered in tension on purpose** — the registration argued about which of them would give if allocation dominated — and both failed instead, consistently, because the premise they SHARED was the wrong one. A tension registered between two predictions still rests on everything they agree about |
| **AV3** | WebAssembly buys between 1.0 and 2.0 times on top of the rewrite | 2.14 — it failed HIGH, by the bounds-check route the registration itself named, and the outcome the registrant said they would least like, a hand-rolled emitter losing outright to TurboFan, did not happen. It is the only one of the four that landed near its line, so a second identical run was made BEFORE the verdict was written down: 2.21, no flip, both recorded. That is `T-CRITERION-IN-THE-NOISE` checked in the forward direction and coming out clean, rather than discovered afterwards by a threshold that returned a pass and a fail from the same world |
| **AU2** | the collision cost tracks the exact birthday null at the wide widths, the two attack goals separate by one square root, and the narrow-end shortfall is a multiplicity effect measurable at widths one, two and three | two legs held and the third failed **on a statistic that does not exist**. The first-repeat index tracks the exact finite-N birthday expectation to within 0.6% at widths four to six with zero collision-free rows in 25,272, and the two fitted slopes come out at 0.4642 and 1.0031 — so a forger who may choose BOTH ledgers pays the square root of what a forger handed one pays, measured rather than assumed. The third leg included width one, where the row map is injective: 72 of 72 measured rows and 14,400 of 14,400 reshuffled rows have no repeat, so the ratio is 0/0. THE LEG FAILED BECAUSE OF THE MECHANISM IT WAS ASSERTING, and the registration had already named width one as degenerate in the same prediction's rationale |
| **AU4** | a majority of heads at every width from two to six admit a two-entry, zero-operation universal forgery, in a band placed around AT's own measured 0.35117 | it failed at width TWO, at 0.5275 against [0.56, 0.70] — and the failure is a property of the head family the set CHOSE rather than of width. The random family is conditioned on having exactly one fixed point, because a head with none has no insertion family at all; the UNCONDITIONED family at the same nine states reads 0.6450. At nine states one constraint is a ninth of the object and the same conditioning is invisible at 729. **T-CLAIM-NARROWED-BY-A-DESIGN caught by a control rather than by a reader**, for the first time — and the answer survives: from 27 states up about two heads in three admit the zero-cost forgery and width six is not rarer than width three |
| **AT2** | insertion-forgery length falls with ledger length, and no ledger anywhere needs more than 100 insertions | three legs held — the curve is strictly decreasing at all ten steps and tracks the uniform null to within 0.17 from length three on — and the bound on the MAXIMUM was placed by a heuristic that is only about a MEAN. The same exponential approximation that predicts 4.87 at length six, accurate to 0.03, puts the chance of exceeding 100 at length two at essentially zero; drawn directly, the null exceeds 100 in 22, 25 and 33 of 50,000 draws, so 2,000 draws expect about one and **the line had a 58% chance of firing on the null alone**. The measured 146 is not evidence about the subject: the null's own maximum is 243. DRAW THE NULL'S TAIL BEFORE REGISTERING A BOUND ON A MAXIMUM |
| **AT3** | two free insertions accept at their chance value of 28 | 30.0120, missing by 0.012 — and it is seventeen standard errors, so the line was fine and the CHANCE VALUE was wrong. The fact that breaks it stood in the same set's own registration two hundred lines above: gap zero is the tritwise identity on every ledger, so one of the 28 gap pairs is never a random accumulator. The true expectation is 30, and the measured value sits 0.012 from it. Chasing that found **three pairs of entry values that forge any ledger of any length at zero cost in search**, which is worth more than the prediction was |
| **P3** | a reach formula factored across digit positions | the corrected law, and Q3 explaining why the wrong one was plausible |
| **X2** | which seeds of a cyclic network are self-consistent | it assumed every seed resolves; two do not — this rewrote an axiom |
| **Z2** | a depth floor for ternary "at any price" | a different circuit design, **cheaper and shallower** than the one measured |
| **E4** | a fixed settling time for the new adder | settling turned out to depend on the data — and then to be derivable exactly |
| **E5** | the new design would use less of the scarce rail | it uses **more**; the design that wins on area wins by spending elsewhere |
| **J4** | a register read during a write sees the old value | it sees the **new** one — the write holds the feedback open, so the cell is a transparent latch. Master-slave is required and the register file doubles |
| **T4** | the best set of control fields packable directly into the opcode's spare trits is six wide and separates every opcode | it is **five**, and separates nothing on its own. Six trits of spare capacity exist, but the fields are chunky and no combination summing to six distinguishes all 25 opcodes. Optimistic by exactly one trit |
| **AL3** | all four quadrants are non-empty and the erasure varies within each | the counts held exactly at 18, 9, 198 and 19,458, and the variation clause failed: both REVERSIBLE quadrants are pinned at exactly log2(3) with no spread, because every column being a bijection makes each output appear exactly three times among the nine pairs. Constant by construction, which is a better fact than the one predicted |
| **AL4** | the three-trit arena is within an order of magnitude of mod-113 addition | 729 against 12,769 is 17.5x. The canonical setup sits BETWEEN the three-trit arena and the six-trit one rather than beside either, and the arithmetic was available before the sentence was written |
| **AM2** | the affine task groks soonest, so the algebraic label predicts the outcome | it INVERTED. Ternary modular addition — what the grokking literature studies almost exclusively — is the SLOWER task on every paired seed, median 10,800 steps against 6,200, and on one seed it never generalised inside 40,000 steps while the non-affine task succeeded on all five. THE CANONICAL GROKKING TASK IS THE HARDER ONE |
| **AM3** | erasing tasks have a majority-class baseline above 40% | it is 0.0457, identical to the reversible tasks, because f = b is a bijection in its second argument so its outputs are uniform. Conflating "erases in the leading argument" with "has a skewed output distribution" — different properties, and AL3 had the information on the record already |
| **AN1** | the hit-count variance of a proof-of-work candidate sits within 25% of binomial at every difficulty | it came in at 0.729x and 0.674x at the two easiest, MORE uniform than chance. A puzzle more uniform than chance is structured, and chasing the deviation found the structure: the message commuted out of the feed-forward, so one 729-entry index solved every mineable message in 1.54 lookups. THE PREDICTION THAT FAILED IS THE ONE THAT DETECTED THE BREAK |
| **AO1** | a pseudorandom ceremony map measures erasure within 5% of its null while exposing a third of all secrets | the exposing clause held — 252 of 729 recovered EXACTLY while E read a healthy 0.89 — and the erasure clause missed at 7.6%. Then 400 draws showed the null was exact and 336 of 400 would have passed: the band was fine, the frozen seed was a 2.09-sigma draw. A SINGLE FIXED PSEUDORANDOM OBJECT IS ONE SAMPLE AND A NULL IS A DISTRIBUTION |
| **AQ1** | binary is never optimal for a vector commitment, the optimum never descends past three, and three is the large-gamma optimum more often than four | the first three clauses held across all 2,880 cells — 0 with binary, none below three, none widening as verifying got dearer — and the last one TIED, 21 leaf counts each. Chasing the tie found the better answer: a leaf count of 3^k wants branching factor three in 15 of 18 cases and 2^k wants four in 13 of 19. A TREE BRANCHES IN THE BASE ITS ADDRESS SPACE IS COUNTED IN, and the tie measured how many of each shape I put in the sweep |
| **AQ2** | a power of three is the cost-minimising branching factor in more cells than a power of two | two takes 1,044 cells to three's 821, so the ten-to-six handicap held. But per arity in range the ordering reverses — 137 cells for each power of three against 104 for each power of two — which the registered wording could not express. The claim counted how many of each I had swept as much as it counted trees |
| **AQ4** | branching factors 64 and 256 differ by no more than 15% wherever either is near optimal | 571 of 909 near-optimal cells exceed the band, worst case 149%. But 426 of those 571 are cells where the two sit at DIFFERENT DEPTHS: when 256 saves a whole level it wins by that level, and when it does not it pays four times the verify for nothing. THE QUESTION HAS NO ANSWER THAT DOES NOT NAME THE LEAF COUNT |
| **AR4** | letting a tree's arity vary by depth makes the optimal tree deeper more often than shallower | it INVERTED, 3,580 shallower against 2,176 deeper. The registered reasoning had the mechanism backwards: a sequence does not spend its slack on an extra level, it buys the SAME verify budget in FEWER levels -- the charged quantity is never larger than the constant tree's and is identical at 2,861 of 7,169 leaf counts. That mechanism overturned AQ's own headline. Admit sequences and 25 of AQ's 45 leaf counts change shape, 11 of the 18 powers of three among them, and 729 wants [4,4,4,4,3] rather than six threes -- for 0.0178% of the cost. A TREE BRANCHES IN ITS OWN BASE WAS A PROPERTY OF CONSTANT TREES |
| **AH2** | widening the live state to three words collapses the memoisation a tabulator lives on, to under 1.5x reuse | it falls only to 3.20x from hailstone's 10.43x, on a control space 500,000x larger. A subtractive inner loop converges onto a shared suffix whenever two inputs agree on the subtrahend, so A TABULATOR EXPLOITS TRAJECTORY CONVERGENCE AND NOT A SMALL STATE SPACE — the receipt rests on four things, not three |
| **AH4** | tabulating costs above 10^11 state-evaluations against under 300 honest steps, a margin above 10^8 | the control space is 729^3 = 387 million, not 10^11 — that figure was 729^4, counting a fourth word the program does not have. One honest run is 1,150 steps. The margin is 3.37 x 10^5, three orders short. The structural clause held: it is identical at either tick level, because a ratio cannot see a factor charged to both sides |
| **AG1** | every program here has a live control-state width of at most two, so none is tier three | threeway measures FIVE — it classifies five values and each changes the path. But its cost spread is 1.02x, from 55 steps to 56, while countdown has width ONE and a spread of 25.38x. WIDTH AND COST VARIANCE ARE INDEPENDENT and neither is the security parameter alone: a tabulator facing 729^6 states to learn a number that is always 55 or 56 would guess instead |
| **AG3** | one device solve costs more than 5,000 node-updates, at 13 passes | 5,400 for the decoded family and 4,368 for the tree one, at 10 passes not 13. Two errors about importing a constant across the conditions it was measured under: the registration cited E4 while the tool built the OTHER adder family, and 13 was E4 MAXIMUM over operand pairs rather than a typical value — quoting a result against its own headline, since E4 finding WAS the data-dependence |
| **AF4** | the best consonance and the most divisors both land on a multiple of six, so music wants two and three at every layer | the best equal division for consonance between 5 and 72 is 53, which is PRIME, with 31 close behind and also prime. The divisor clause held at 60. The layers DECOUPLE: harmonic symmetry and rhythm want compositeness, consonance does not care about it at all |
| **AE4** | above 2% of twelve-tone subsets have nontrivial transpositional symmetry | it is 1.81%, optimistic by a fifth. Every other clause held — Z/27 at 0.00038%, the gap at 3.7 orders of magnitude — so direction and magnitude survived a threshold that did not. A number picked to sound decisive is a worse prediction than the ratio it stands for |
| **AC1** | only two of the eight programs have an input-dependent step count, and they are countdown and fold | wrong on the count, the membership, and its own premise. fold does not vary; multiply and threeway do; and ALL EIGHT programs execute IN, not the five a broken detector reported. Cost-invariance turned out to be the norm — five of eight cost the same number of steps whatever data they are handed |
| **AC3** | two programs of identical static shape differ in cost by more than 300x | the structural claim held and the number failed at 182.5x. The cheap program's four-step floor sits in the denominator, so the ratio is 730/4 and not 364/1 — quoting a ratio without accounting for constant overhead |
| **AC4** | erasure per executed instruction spans more than 2x across the eight programs | it spans 1.68x. They are more alike in erasure intensity than in anything else measured about them, all between 3.6 and 6.1 bits per instruction. The ordering clause held — the longest-running program is not the hungriest per step — so the finding survives at a narrower margin than claimed |
| **AB4** | the erasure charge is not recoverable from a program's text, the way a static count is | **six of eight programs charge exactly their text bound**, and the largest gap is 1.21x rather than the predicted 2x. The operand-dependent opcodes simply do not appear in those six, so the worst case IS the actual case. A static price transfers exactly when the instruction mix is operand-independent — conditional, and sharper than either the prediction or its negation |
| **AB5** | admitting every information-preserving operation lifts the reversible fragment to the full symmetric group, so the machine erases by convention | it does not come close. The orders land on a closed form, **2^W · 3^((3^W − 1)/2)**, matching at every width the stabiliser chain reaches; width 1 is the only place reversibility is free, and by width 4 the fragment is 10^-100 of all permutations. **The eraser is load-bearing.** The closed form is the replacement the failure produced |
| **N1** | a mid-rail tap is unavoidable exactly where a node must carry MID, and the selectors need none | the test asked "does this BUILD put MID on a node", not "does the FUNCTION require it" — and scored the detector FORCED while the very next section built the same function with zero taps. A circuit that uses the mid rail is not a circuit that needs it |
| **D3** | `rotate(s + sbox(s))` mixes, once the s-box is chosen so the sum stays injective | it does not — 130 cycles against a random permutation's 6.6. A positionwise 3-cycle *is* addition of a constant, so the sum stays affine. Fixing injectivity does nothing for mixing |
| **D4** | a truncated-collision count separates a mixing map from a positionwise one | it separates nothing — truncating **any** permutation is uniform by construction, so a map that provably repeats every six calls scores 0.96x, same as everything else. The obvious test is disqualified |
| **A2** | a selector tree fed by a *computed* source inherits the cold-start precondition a bus has | it does not — a computed **data** node is rail-driven through whatever produced it and resolves. What poisons a network is an unresolved **control** node. The boundary was registered precisely so it could be wrong here, and being wrong is what separated control from data |
| **H1** | the solver is linear, with a spread and an exponent attached | it is — but both numbers missed, and one criterion sat so close to the noise that the same machine gave a pass and a fail on consecutive runs |

That is the single most important observation here. A method that only records
what it got right produces a scrapbook. The value is concentrated in the moments
where a registered claim met a measurement and lost.

**Seven of the failures in that table rest entirely on a criterion that was not
evidence** — `AO1`, `AT2`, `AT3`, `AU2`, `AM2`, `D4` and `AR4` — **and the observation
survives all seven.** Every one of them still produced a finding. `AT3`'s criterion was
decided by the draw and chasing it found three entry pairs that forge any ledger at zero
cost in search. `AT2`'s bound had roughly an even chance of firing on the null alone, and
the rule it produced — draw the null's tail before registering a bound on a maximum —
rests on the null's own draws rather than on the measured value. `AO1` produced the rule
that a null is a distribution and a frozen sample is one draw. `D4` is the sharpest case
of all, because there the criterion's inability to discriminate **is** the finding:
truncating any permutation is uniform by construction, which disqualifies the most
obvious test anyone would reach for, and that disqualification produced `AN1`.

So the productivity claim stands and the arithmetic under it does not, and the two must
be disclosed apart. **A line in the noise corrupts a verdict; it does not automatically
corrupt what chasing that verdict found.** `AM2` is the cleanest illustration: as
registered it is one paired comparison, which is a coin, and the run's own five seeds put
the non-affine task faster in four of four paired seeds — evidence considerably stronger
than the criterion ever asked for. Each of the seven carries that distinction in its own
entry rather than only here, because a reader who arrives at one prediction should not
have to find a summary to learn what its criterion was worth.

---

## The loop

Five steps. The separation between steps 2 and 4 is the whole mechanism; everything
else is hygiene.

**1. Build the instrument.** Whatever measures the thing. Record what you learn
while building it in a `NOT REGISTERED` block — those facts were never at risk and
must not be counted as predictions.

**2. Register.** Write the predictions down, with the reasoning, and **commit them
alone**. No measurement *of the registered predictions* in that commit — what
building the instrument taught you goes in the labelled `NOT REGISTERED` block
from step 1, which belongs in the registration commit and is not a violation of
it. An agent reading "no results in that commit" literally will either strip that
block or flag every registration as broken; this repository's own tool-count check
did exactly that the first time it met a healthy registration gap. Predictions derived by hand are fine and often
better — say so, and put the derivation in, because then the arithmetic is on the
record and not just the answer.

**3. Run.** Measure. Do not touch the registration.

**4. Record.** Results in their own commit, pointing back at the registration
commit. Failures are kept verbatim. A prediction with a refuted half is `FAILED`,
not trimmed to the half that survived.

**5. Antibody.** Every defect found becomes a permanent check. Not a fix — a
*check*, that would have caught it, and that is shown to fail when the defect is
reintroduced.

The commit separation is not ceremony. It is the only thing that makes step 4
honest, because it is verifiable afterwards by anyone: the registration commit is
an ancestor of the results commit, and it contains no measurements. The suite
checks exactly that for every set.

---

## Two error classes, and who catches them

This is the part that matters for running the loop with more than one agent.

Across this session the defects sorted almost perfectly into two kinds, and they
were caught by two different things.

**Mechanical defects — wrong arithmetic, broken instruments, stale constants —
were caught by automated checks.** A tally check caught a check count that said
476 when the answer was 481. A vacuity check caught a random generator that was
not random: it multiplied a 31-bit seed by a 31-bit constant, overflowing what a
JavaScript number holds exactly, so three of its eight values were drawn
essentially never and four hundred trials were closer to four hundred repetitions
of one. A duplicate-id check caught two ids that had been sitting duplicated in
the manifest because nothing had ever looked.

**Semantic defects — sentences whose scope exceeded the measurement — were caught
almost entirely by a separate reader.** Not by re-reading. Every one of these was
invisible from inside the sentence that made it:

- an axiom asserting a network can never oscillate, when it can;
- the *correction* to that axiom, which was also false, and which 481 passing
  checks had nothing to say about because every one of them looked only at final
  answers and the false clause was about intermediate ones;
- "at any price", when the sweep had visited one design;
- "the only thing that costs time", when an earlier result already said otherwise;
- a rule stated for a circuit when every measurement had fixed one of its inputs.

**An overclaim is invisible from inside the sentence that made it.** The author
knows what they meant; the reader only has what was written. That is why the split
is so clean, and it is the strongest argument for separating the roles rather than
asking one agent to check its own work.

Two parameters of that reader mattered and are worth naming, because they are what
you would provision rather than the count: it was a **stronger model**, and it had
the **full transcript** — every tool call and result, not a summary. The catch
described at the end of the previous section required reading a loop's source. A
weaker critic, or one handed only conclusions, would not have made it. On this
evidence the useful dial is critic capability and artifact access, not how many
critics there are.

---

## What parallelizes

**Serial, per prediction set:** register → run → record. This cannot be
compressed. The value comes from the ordering being verifiable afterwards.

**Parallel across sets:** independent questions run independently. Nothing in this
loop couples one prediction set to another except the shared manifest.

**Embarrassingly parallel — and where the leverage is:**

- **Critics, one per claim.** Each takes a single sentence and tries to find a case
  it does not cover. This is the role that produced the best circuit in the
  repository: attacking "at any price" is what surfaced a design that was cheaper
  *and* faster than the one being defended.
- **Instrument auditors.** Given a tool, ask what it would report if the thing it
  measures were fine and the tool were broken. Three separate times a tool here
  declared a failure that was its own: a search reported exhausted as closed,
  reachability traversed through a node it should have stopped at, and a lookup
  keyed a circuit by an ordering that carried no meaning.
- **Replication at other parameters.** A rule fitted rather than derived comes
  apart at a width it was not fitted to. Checking four other widths cost minutes
  and converted a plausible rule into a derived one.

**And one thing that did NOT parallelize here — the important one.** Verification
fanned out; the *frontier did not*. Trace <!--g:method-trace-->the fifty sets<!--/g--> and they form very nearly
a single chain. Q was asked because P3 failed, and Q3 turned out to explain the
failure. R followed Q. Z was spawned by caveats Y had left standing. E exists only
because Z2 failed, and F exists only because E4 failed. Two questions came from
outside as pivots; every other one was generated by the previous answer.

So the honest reading of this record is that **checking parallelizes and asking
does not** — at least, it was never tested. Nothing here shows that independent
frontiers, run side by side, produce anything; the questions worth asking kept
turning out to be the ones the last result had just made askable. If you are
provisioning agents on the strength of this document, fan out the critics, the
instrument audits and the replications with confidence, and treat parallel
*exploration* as an open question rather than a recommendation.

**One constraint that is not optional: critics need the artifacts, not the
summary.** The most valuable single catch in this session came from reading a
*loop* and noticing it folded three outcomes into one counter — settled-early,
settled-on-time, and never-settled — and skipped the correctness check for the
third. The published result was true, but it had been resting on a decomposition
nothing had measured. No summary of that loop's output would have shown it. The
critic had to see the code.

---

## Preconditions

Be honest about where this works.

**It needs a domain you can check exhaustively, or nearly.** The strongest results
here rest on sweeps of every case: 531,441 operand pairs, 148,995 candidate
circuits, all 27 inputs to a cell. Where exhaustion is possible, a failed
prediction is *decisive*. Where it is not, the loop degrades to sampling plus
adversarial verification, which is weaker and should be labelled as such. This
repository states its sample strides in the output every time it uses one.

**And this project has now walked off the edge of that precondition.** Every
circuit result here rests on exhaustive sweeping. The `H` set measured what the
solver can carry, and the two facts do not fit together: a 50,000-device machine
*solves* in about 70 ms, but a full 531,441-pair sweep stays inside an hour only up
to roughly **4,800 devices**. So the machine this method was built to study can be
run and cannot be swept.

That is worth stating as a general lesson rather than a local inconvenience: **a
method whose authority comes from exhaustion has a size limit, and the subject
grows toward it.** The failure mode is not noticing — continuing to write "checked"
in the tone earned by sweeps, while actually sampling.

What replaces it is not a weaker version of the same sentence. It is a **stated
verification contract**: name the dimensions that are exhaustive and the ones that
are sampled, in the claim itself. "The machine is verified" is unavailable. "The
machine agrees with the reference on every opcode against every value of one
register, and on every step of one bounded program" is smaller, checkable, and
true. See [`design/12-roadmap.md`](design/12-roadmap.md), which had to choose one.

**It needs cheap ground truth.** Every claim here could be checked against an
independent reference implementation. Without something to be wrong against, the
loop has nothing to bite on.

**It needs the cost to be acceptable.** A full sweep here runs 20–45 minutes. The
device layer took 27 commits. Pre-registration adds a commit and real friction per
phase. That is affordable when a phase produces a result worth keeping and
wasteful when it does not.

---

## The failure catalogue, off ternary

These are the nineteen classes that actually bit, stated so they transfer. The count
is how many times each recurred *after* being named — which is itself a measure of
how well naming a thing prevents it.

| class | the shape |
|---|---|
| **one point is not a function** | two things agreeing at one input are not equal. Bit three times, once where dozens of distinct candidates all matched the target at a single chosen pair. |
| **hardcoded counts go stale** | a constant that the code can change. Bit three times, including a document stating its own totals. Derive them, and put the total where the sum actually exists. |
| **writing through a name that does not exist** | the write silently does nothing and everything downstream runs on uninitialised state. |
| **reading past the end** | a short datum borrows whatever follows it and returns a plausible wrong answer. |
| **out of budget ≠ finished** | a search that exhausted its limit, one that hit a cap, and one that genuinely closed are three outcomes. Bit twice; the second time it did not produce a wrong number, only an unverified one, which is quieter and worse. |
| **paths through an ideal source** | in a simulation, letting signal continue *through* a thing that should terminate it. Correct inputs resolve to garbage. |
| **the instrument, not the subject** | the measuring tool produced the failure. Bit three times. When a result contradicts a prediction, suspect the instrument first — it is cheaper to rule out than the finding is to publish. |
| **failing on a premise, not an answer** | a question that quietly assumes something. The assumption, not the answer, was the falsifiable part. |
| **sampling that is not sampling** | a generator that looked random and was not. Check what it *produced* — every outcome class it should have reached — not how many times it ran. |
| **checks that forbid healthy states** | a consistency check treating a legitimate intermediate state as a defect. During a registration there is deliberately one more tool than there are results; that gap *is* the protocol working. |
| **searching where a check would do** | finding a value by scanning when two probes would confirm it. Cost eighty solves per case where two would do, and did not finish. |
| **a claim narrowed by a design** | the numbers right and the noun too big. Bit twice. Before writing "X can never" or "this model always", ask whether what you swept visited more than one design. |
| **a criterion in the noise** | a registered threshold whose verdict depends on run-to-run variation. The same world produced both a pass and a fail. Widen it until it cannot flip, or measure the quantity and report it without asserting a bound. |
| **computed control, unknown at pass one** | a control signal that is derived rather than given is unknown on the first pass of a fixed point, and unknown conduction counts as possible -- so it bridges or breaks everything it gates before it settles. Bit twice, the second time taking down 26 of 27 memory words at once. A circuit correct at its fixed point can be unreachable from a cold start. |
| **a transcribed table** | a fact that could have been *run* was hand-copied. A detector's truth table, copied from a comment into a seed, came out inverted -- and produced 36 failures out of 54 whose pattern exactly matched what a real contention bug would look like. Wrong instruments do not produce noise; they produce clean, mechanistic, entirely wrong findings. |
| **a tool checked only by import** | a tool exercised only through require(), so the path it takes when actually run is never covered. A mechanical rename made an audit silent on import and rewrote the body of the logging function into a call to itself; it crashed on every run while every check stayed green. Cover both paths, and cap the expensive sweep so covering the run path is cheap. |
| **the scope decides the verdict** | a correct computation scoring a prediction wrongly, because the measurement drew its state boundary somewhere the prediction did not. Bit twice. Neither instrument computed anything wrong; both answered a question adjacent to the one registered. Declare the boundary in the registration, and where a question admits more than one, report every reading. |
| **a control that cannot fail** | a control whose two terms share a draw, so the parameter the claim is about cancels out of it algebraically. A sweep over an exchange rate gave its control the same value on both sides of that rate, so the control's answer was constant in exactly the dimension being measured and could only ever agree. Check that a control MOVES when the thing it controls for moves, before reading its verdict. |
| **a census that counts itself** | a measurement over a corpus that the measurement is then written into. A survey of repeated numbers in the record failed on its next run, because recording its own answer added those numbers to the record. Nothing was wrong with the first answer, or with the world. |

Two further shapes, from the prose rather than the code:

- **fixed-point checks miss the path.** A suite that only inspects converged
  results cannot test any claim about how convergence happens. 481 passing checks
  said nothing about a false sentence describing intermediate states.
- **numbers in different units look comparable.** A per-digit efficiency figure
  and a per-circuit switch count differed by an embedded factor of two. The
  comparison was tempting, wrong, and is now pinned as a check so nobody makes it.

---

## What is not established

The honest section, and the method requires it.

**This is one project.** Every claim above about the *method* is an observation
from a single sustained run, not a controlled result. There was no arm of this
work that skipped pre-registration for comparison. The failure-to-value link is
the strongest thing here and it is still an observation, not a measurement.

**The role split is observed, not tested.** The claim that mechanical defects fall
to automated checks and semantic ones to a separate reader describes what happened
here. It was not set up as an experiment, the two catchers were not equivalent in
capability, and the sample is a few dozen defects.

**Whether swarms help is untested.** The parallelism described above is derived
from which activities were logically independent, not from having run them in
parallel. It is a design proposal with a rationale, and it should be registered
and measured like anything else before being believed. The serial-frontier
observation is the sharper half of this: the record shows a chain of questions,
each made askable by the previous answer, and says nothing at all about what
happens when you run several frontiers at once.

**The exhaustibility precondition may be the whole story.** It is entirely
possible that what worked here was having a finite domain and a reference
implementation, and that the protocol around it contributed less than it appears
to. That would be a good thing to find out, and this document is not evidence
either way.

---

## If you run it

The minimum viable version, for a domain you can check:

1. One machine-readable manifest of every claim, its outcome, the commit that
   registered it and the commit that measured it.
2. A validator that fails the build when the manifest and the repository disagree
   — including that registrations really do precede results.
3. Every prediction id mentioned in the test that asserts it, checked both ways.
4. Every defect converted to a check that is demonstrated to fail without the fix.
5. **A per-claim record of how it could have come out the other way**, written at
   registration, and a check that fails on a claim registered without one. This is
   the item added last and it is the one this record most needed: a sixth of the
   successes here were arithmetic the registration had already performed. The
   discriminator is not confidence, it is *whose quantities the arithmetic runs
   over*. A derivation over someone else's numbers is a real prediction; a
   derivation over numbers you fixed yourself is decoration in a registration's
   clothes, and it will always hold.
6. A reader who did not write the claim, with access to the code and not just the
   output.

Items 1 through 5 are mechanical and an agent can maintain them alone. Item 6 is
the one that cannot be self-served, and on this evidence it is where most of the
interesting errors live — including this one, which the record could not see about
itself for forty-three phases.
