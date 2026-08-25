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

Twenty prediction sets, **88 registered predictions, 81 held, 7 failed.** Sixteen
distinct failure classes, which bit **29 times** between them. Fifteen findings
measured but never registered, listed separately so the pre-registration record is
not inflated by things that were never at risk. Every number in this section is
recomputed from [`FINDINGS.json`](FINDINGS.json) by the test suite; if this
document drifts from the manifest, the suite fails.

**The five failures produced more than the forty-nine successes.** Each one is
still in the manifest, marked `FAILED`, with the result it led to:

| failed | what it claimed | what it produced |
|---|---|---|
| **P3** | a reach formula factored across digit positions | the corrected law, and Q3 explaining why the wrong one was plausible |
| **X2** | which seeds of a cyclic network are self-consistent | it assumed every seed resolves; two do not — this rewrote an axiom |
| **Z2** | a depth floor for ternary "at any price" | a different circuit design, **cheaper and shallower** than the one measured |
| **E4** | a fixed settling time for the new adder | settling turned out to depend on the data — and then to be derivable exactly |
| **E5** | the new design would use less of the scarce rail | it uses **more**; the design that wins on area wins by spending elsewhere |
| **J4** | a register read during a write sees the old value | it sees the **new** one — the write holds the feedback open, so the cell is a transparent latch. Master-slave is required and the register file doubles |
| **H1** | the solver is linear, with a spread and an exponent attached | it is — but both numbers missed, and one criterion sat so close to the noise that the same machine gave a pass and a fail on consecutive runs |

That is the single most important observation here. A method that only records
what it got right produces a scrapbook. The value is concentrated in the moments
where a registered claim met a measurement and lost.

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
fanned out; the *frontier did not*. Trace the twenty sets and they form very nearly
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

These are the sixteen classes that actually bit, stated so they transfer. The count
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
5. A reader who did not write the claim, with access to the code and not just the
   output.

Items 1 through 4 are mechanical and an agent can maintain them alone. Item 5 is
the one that cannot be self-served, and on this evidence it is where most of the
interesting errors live.
