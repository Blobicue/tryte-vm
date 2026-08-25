# Working in this repository

Conventions for anyone — human or agent — changing this code. Deliberately free of
numbers: counts, sizes and measured values live in `FINDINGS.json`, which a test
validates, so nothing here can go stale.

Read `README.md` for what the project is. Read this before changing it.

---

## The one rule

**Nothing is claimed that is not checked.** Every number in the README, in a
commit message, or in a comment is either recomputed by a test or recorded in
`FINDINGS.json` with a pointer to the test that recomputes it. If you write a
number you cannot point at a check for, you have added a liability.

---

## Pre-registration protocol

Empirical claims about this machine follow a fixed order, because a prediction
written after the run is not a prediction:

1. **Write the predictions** into the audit tool's docstring, in a block headed
   `PREDICTED OUTCOMES`, each with a short id (`P1`, `Q3`, …).
2. **Commit that alone.** The commit must contain no measurement. Its message
   says so. Git then supplies the ordering an editable file cannot.
3. **Run the audit.**
4. **Commit the results separately**, reporting each prediction as held or
   failed.
5. **Add the outcomes to `FINDINGS.json`** and assert them in a test, using the
   prediction's id in the check name so the manifest validator can find it.

Two things this protocol exists to prevent, both of which have been tempting here:

- **Backdating.** If a fact was measured during design, it is not a prediction.
  Record it under `unregistered_findings` with outcome `MEASURED_NOT_REGISTERED`.
  Inflating the registered set with facts that were never at risk turns the
  discipline into decoration.
- **Quiet correction.** A failed prediction stays failed. Keep it in the manifest,
  keep a test asserting it still fails, and write down what the failure taught.
  The most useful result this repository has produced came from a prediction that
  was wrong.

## Tests

- **Exhaustive where exhaustive is possible.** The value space is small; sweep it
  rather than sampling it. Where sampling is unavoidable, say so and state which
  direction the bound goes.
- **Check the instrument before trusting it.** Each suite opens by asserting
  hand-computed values and demonstrating that the harness can report a failure.
- **Mutation-test new checks.** Break the thing deliberately and confirm the test
  notices. A test that cannot fail is worse than no test, because it reads as
  coverage.
- **Derive constants, never hardcode them.** Read the opcode set from the ISA, the
  window size from the layout, the prediction ids from the tool. Hardcoded counts
  go stale silently and assert against a past version of the code.
- **State limits rather than dropping cases.** If something no longer fits, assert
  the refusal *and* that the error names the reason.

## Commit messages

Long, and load-bearing. They carry the reasoning that does not belong in code:
what was predicted, what happened, what it cost, what was rejected and why. Assume
the reader has the diff and needs the argument. End with the `Co-Authored-By`
trailer.

---

## Traps this repository has actually fallen into

Each of these produced a wrong result that looked right. They are listed because
the next one will look right too.

**Comparing functions at a single point.** Two functions agreeing on one input are
not equal. This has bitten three separate times, most sharply where dozens of
distinct tables all matched the target at one chosen pair. Compare over a probe
set, or prove equality structurally.

**Hardcoding a count that the code can change.** A test listing the opcodes
literally kept passing against a number the source no longer had. Derive it. The
README's own tallies went stale the same way, twice — the total check count is
now summed in `run-all.js` and the manifest tally recomputed in
`test-findings.js`, because neither number belongs to any one suite.

**Writing through a label that does not exist.** A missing label yields an
undefined address; the write silently does nothing and the program runs on with
uninitialised state. Assert the label exists before writing through it.

**Reading past the end of a datum.** A short table borrowed the cells that
happened to follow it and produced a plausible wrong answer. Track how much space
a datum spans and refuse to over-read it.

**Confusing "ran out of budget" with "finished".** A search that exhausts its
depth limit, one that hits its size cap, and one that genuinely closes are three
different outcomes. Conflating them produced a false negative verdict on a
prediction. Report them separately.

**Letting a path run through an ideal source.** Switch-level reachability that
continues *out of* a rail makes every node that rail drives look contended, and
correct circuits resolve to unknown. Rails and inputs terminate a path.

**Believing the instrument before checking its shape.** Three times the measuring
tool, not the thing measured, produced the failure: a search reported exhausted as
closed, reachability ran through rails, and a network key ordered terminals that
have no order — each declaring FAILED or ABSENT for something that was fine. When
a result contradicts a prediction, suspect the instrument first; it is cheaper to
rule out than the finding is to publish.

**A prediction failing on a premise it never stated.** One asked which seeds of a
cyclic network are self-consistent and quietly assumed every seed resolves at all.
Two did not. The unstated assumption was the falsifiable part, and it falsified an
axiom. When registering, write down what the question takes for granted.

**Sampling with a generator that is not sampling.** A seeded pseudo-random source
multiplied a 31-bit seed by a 31-bit constant, which overflows the range a
JavaScript number represents exactly, so the low bits it handed back were rounding
noise. Three of its eight possible values were drawn essentially never, and a
comparison that looked like four hundred trials was closer to four hundred
repetitions of one. Check what a random instrument actually produced — every
outcome class it was supposed to reach — not how many times it ran.

**Stating a property of one design as a property of the subject.** Twice now a
measurement has been right and its noun too big. A sweep over where restoring
buffers can go inside one family of trees became a claim about what ternary can
reach "at any price" — a different selector reached further, and cost less. A
sweep over raw-select circuits became a claim that settling time in this model is
never data-dependent — a decoded selector made it data-dependent. Before writing
"ternary", or "this model", ask whether what you swept visited more than one
design.

**Trusting a build artifact that was not rebuilt.** The published page embeds the
source; after changing the source it will still pass its own tests until rebuilt.
There is a staleness check for exactly this — do not remove it.

---

## Layout, and why it is shaped this way

- `src/` — the machine. One definition of each thing; nothing here is duplicated
  elsewhere, including in the published page, which inlines these files verbatim.
- `programs/` — demo programs and the two interpreters. Anything here is a program
  a user might run.
- `bench/` — programs that exist only as benchmark *pairs*, solving one task two
  ways. Separated from `programs/` because they are measurements, not demos.
- `tools/` — the audits. Each has a registration block and is runnable on its own.
- `test/` — one suite per concern, plus `run-all.js`. `test-findings.js` validates
  the manifest against the repository.
- `docs/origin/` — **append-only provenance.** The conversation this project came
  from, its audit, and its code artifacts. Do not edit or reorganise it; it is
  evidence, and its value depends on being untouched.
- `build/` — inlines `src/` into the published page and fails if the two diverge.

## Before you commit

```bash
npm test          # everything, including the manifest validator
npm run build     # rebuild the page if src/ or programs/ changed
```

Work on a branch, merge only when the suite is green on `main`, and re-run it
after merging — line-ending normalisation on checkout has broken the build
artifact more than once.
