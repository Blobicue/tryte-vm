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

### This tree has more than one writer, and the protocol depends on commit order

**Check `git log --oneline -3` before trusting HEAD to be where you left it.** During
set `AB` another writer committed the entire in-flight working set — a half-finished
result, mid-edit tools, a manifest field still reading `PENDING` — as one commit
messaged "Some things", and **pushed it**, inside a single session. Nothing warned
anyone. It was found because files just edited showed as clean.

This is a direct hazard to the protocol above, not merely an annoyance. The whole
method rests on git supplying an ordering an editable file cannot. A stray commit
landing between step 1 and step 2 bundles measurements into what is supposed to be a
registration, and the guarantee is gone silently — the commit still *looks* like a
registration.

**How to work here:**

- **Never rewrite what another writer committed.** Check `git branch -r --contains
  <sha>` first; if it is on a remote, amending or rebasing is off the table. Build
  the proper commit on top, and say in its message where the work actually landed.
- **Pin hashes to the commit that truly carries the thing**, even if its message is
  worthless. `results_at` may legitimately point at someone else's "Some things" —
  truthful beats tidy, and `PENDING` exists for the gap before a hash is known.
- **Stage explicit paths, never `-A` and never a bare directory**, and read
  `git status` before every commit to confirm every staged file is one you touched.
- **Re-render generated files and re-run the suite after any long gap**, because the
  tree can move under a run that is still going.
- **A mid-flight push can leave `origin` red.** If you find the published tip failing
  its own suite because someone pushed your work half-done, push the repair rather
  than leaving it broken for whoever arrives next.

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

## Where the knowledge lives

Four places, and they do different jobs. `README.md` narrates. `FINDINGS.json` is
the claim ledger and owns every number. `design/` looks forward at what is not
built. And `.claude/knowledge/doctrees/tryte-vm/` maps what is **known** — 13
pillars, each declaring its own depth as `rich`, `seeded` or `stub`, each carrying
an explicit list of open questions.

Start there if you are orienting. It links outward rather than restating, so it
cannot drift from the manifest; `test/test-doctree.js` fails the build if a
pillar's declared depth disagrees with the overview's table.

## The method, generalised

This file is the operating manual for *this* repository. The loop it describes —
register, run, record, antibody — is written up on its own terms in
[`METHOD.md`](METHOD.md), including which parts parallelise, which cannot, and what
the whole thing depends on that might not hold elsewhere. Read that if you are
running the loop somewhere else. Read this if you are changing code here.

One finding from it belongs at the top of this file, because it constrains how you
should use yourself. The defects in this repository sorted almost perfectly into
two kinds. Mechanical ones — wrong arithmetic, broken instruments, stale constants
— were caught by automated checks. Semantic ones — sentences claiming more than
was measured — were caught almost entirely by a reader who had not written them,
and essentially never by re-reading. **An overclaim is invisible from inside the
sentence that made it.** If you are working alone, treat every universal quantifier
you write ("never", "always", "at any price", "in this model") as a defect until
you have named the set it ranges over and confirmed your measurement visited it.

## Traps this repository has actually fallen into

Each of these produced a wrong result that looked right. They are listed because
the next one will look right too.

`T-ONE-POINT` **Comparing functions at a single point.** Two functions agreeing on one input are
not equal. This has bitten three separate times, most sharply where dozens of
distinct tables all matched the target at one chosen pair. Compare over a probe
set, or prove equality structurally.

`T-STALE-CONSTANT` **Hardcoding a count that the code can change.** A test listing the opcodes
literally kept passing against a number the source no longer had. Derive it. The
README's own tallies went stale the same way, twice — the total check count is
now summed in `run-all.js` and the manifest tally recomputed in
`test-findings.js`, because neither number belongs to any one suite.

`T-SILENT-NAN` **Writing through a label that does not exist.** A missing label yields an
undefined address; the write silently does nothing and the program runs on with
uninitialised state. Assert the label exists before writing through it.

`T-ADJACENCY` **Reading past the end of a datum.** A short table borrowed the cells that
happened to follow it and produced a plausible wrong answer. Track how much space
a datum spans and refuse to over-read it.

`T-EXHAUSTED-NOT-CLOSED` **Confusing "ran out of budget" with "finished".** A search that exhausts its
depth limit, one that hits its size cap, and one that genuinely closes are three
different outcomes. Conflating them produced a false negative verdict on a
prediction. Report them separately.

`T-SOURCE-NOT-TERMINAL` **Letting a path run through an ideal source.** Switch-level reachability that
continues *out of* a rail makes every node that rail drives look contended, and
correct circuits resolve to unknown. Rails and inputs terminate a path.

`T-INSTRUMENT-FALSE-VERDICT` **Believing the instrument before checking its shape.** Three times the measuring
tool, not the thing measured, produced the failure: a search reported exhausted as
closed, reachability ran through rails, and a network key ordered terminals that
have no order — each declaring FAILED or ABSENT for something that was fine. When
a result contradicts a prediction, suspect the instrument first; it is cheaper to
rule out than the finding is to publish.

`T-PREMISE-NOT-ANSWER` **A prediction failing on a premise it never stated.** One asked which seeds of a
cyclic network are self-consistent and quietly assumed every seed resolves at all.
Two did not. The unstated assumption was the falsifiable part, and it falsified an
axiom. When registering, write down what the question takes for granted.

`T-FAKE-RANDOM` **Sampling with a generator that is not sampling.** A seeded pseudo-random source
multiplied a 31-bit seed by a 31-bit constant, which overflows the range a
JavaScript number represents exactly, so the low bits it handed back were rounding
noise. Three of its eight possible values were drawn essentially never, and a
comparison that looked like four hundred trials was closer to four hundred
repetitions of one. Check what a random instrument actually produced — every
outcome class it was supposed to reach — not how many times it ran.

`T-CLAIM-NARROWED-BY-A-DESIGN` **Stating a property of one design as a property of the subject.** Twice now a
measurement has been right and its noun too big. A sweep over where restoring
buffers can go inside one family of trees became a claim about what ternary can
reach "at any price" — a different selector reached further, and cost less. A
sweep over raw-select circuits became a claim that settling time in this model is
never data-dependent — a decoded selector made it data-dependent. Before writing
"ternary", or "this model", ask whether what you swept visited more than one
design.

`T-CHECK-FORBIDS-HEALTHY-STATE` **A check that treats a legitimate state as a
defect.** One demanded that the number of tools and the number of prediction sets
be equal. They are equal only *between* phases: registering a tool and recording
its results are deliberately separate commits, so during a registration there is
one more tool than there are sets. The check was failing on the protocol working.
Before asserting an invariant, ask which legal intermediate states it forbids.

`T-SEARCH-WHERE-A-CHECK-WOULD-DO` **Searching for a value you could verify.**
Finding a settling count by scanning k upward from 1 cost up to eighty solves per
input and did not finish inside ten minutes. The count is the same for every
input: find it once, then check it twice thereafter -- settles at k, does not
settle at k-1. Two solves, not eighty. When an instrument is slow, check whether
it is searching for something it already knows how to confirm.

`T-TOOL-CHECKED-ONLY-BY-IMPORT` **A tool exercised only through require(), so the
path it takes when actually run is never covered.** Making an audit silent on import
by mechanically renaming every `console.log` call to `log` also rewrote the body of
`log` itself into a call to itself. The tool crashed with a stack overflow on every
run while its whole suite stayed green -- importing sets the main-module flag false,
so no print path ever executes. The numbers were all correct; the program was broken
in the half nobody looked at. If a tool has a run path and an import path, cover
both: spawn it as a subprocess, assert it exits cleanly and printed what it should,
and give its most expensive sweep a cap so that check costs seconds.

`T-SCOPE-DECIDES-THE-VERDICT` **A correct computation scoring a prediction wrongly,
because the measurement drew its state boundary somewhere the prediction did not.**
Bit twice. `N1` registered "must some node carry MID for the FUNCTION to compute"
and the test asked "does this BUILD put MID on a node" -- so it scored the detector
FORCED while the next section built the same function with zero taps. `AB2`
registered a classification of opcodes by whether their erasure depends on the
operand, and the first census folded the operand INTO the state being measured,
which is a defensible boundary under which the question is not even well-formed:
MIN came out as a single fixed figure where the prediction spoke of a range. Neither
instrument computed anything wrong. Declare the boundary in the registration, and
where a question admits more than one boundary report every reading rather than
picking one silently -- the tool now prints both, and their relationship (the fixed
figure is exactly the mean of the range) is itself a result.

`T-CENSUS-COUNTS-ITSELF` **A measurement over a corpus it is then written into.**
A survey of the manifest for repeated integers failed on its second run, because
recording the first run's result added those very integers back to the manifest --
as the values it had excluded. Nothing was wrong with the world or with the first
answer. If a result is stored where it will later be read as data, exclude the
storing record from the read, and derive that exclusion from something structural
rather than from an id.

`T-CRITERION-IN-THE-NOISE` **A threshold whose verdict depends on run-to-run
variation.** A prediction of "spread under 3x" measured 3.72 on one run and 2.89
on the next -- the same world returning both a pass and a fail -- and the attempt
to salvage a more robust shape from it flipped too. A line placed near the noise
floor is a defect in the prediction, not a fact about the subject. Either widen it
until it cannot flip, or measure the quantity and report it without asserting a
bound.

`T-COMPUTED-CONTROL-UNKNOWN-AT-PASS-ONE` **A control signal that is computed
rather than given is unknown on the first pass, and unknown conduction is treated
as possible -- so on pass one it bridges or breaks everything it gates.** Bit
twice. A decoded selector's middle leg, gated by a detector output, bridged the
word being read to a second word's rail and the network never settled. Then the
same shape at array scale: every hold gate in a 27-word memory is a decoder
output, and every unaddressed word went to X on every write -- the cells hold
perfectly when hold is a primary input and not at all when it is a decoder
output, same circuit, different reachability. The fix both times is to solve the
control cone on its own and seed it. **A circuit that is correct at its fixed
point can be unreachable from a cold start**, and the larger the control fan-out,
the more it takes down with it.

`T-TRANSCRIBED-TABLE` **A fact that could have been RUN was hand-copied
instead.** A detector's truth table was seeded from the table as written in a
comment. The comment was right; the transcription inverted it, putting an n-type
gate above its threshold so a selector leg conducted on exactly the addresses
where it must be off. The result was not noise -- 36 of 54 cases failed, every one
of them a case where the middle word disagreed with the selected word and none
where they agreed, which is the exact mechanistic signature real contention would
produce. It read as a clean headline finding: "the decoded selector cannot read
storage." **A wrong instrument does not look wrong.** If a value can be obtained by
running a two-line network, run it rather than copying it.

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

## Never type a count. Generate it.

Every number in the prose that restates something the manifest already knows —
prediction sets, predictions held and failed, unregistered findings, defect classes,
trap bites, the audit count — lives inside a generated region written by
`tools/render-docs.js`. The regions are HTML comments, invisible when the Markdown
renders:

```
<!--g:readme-tally-->Forty prediction sets, ... **141 held, 28 failed**<!--/g-->
```

**Do not edit the text between those markers.** Change `FINDINGS.json`, then:

```bash
npm run counts    # render-docs --write, then run-all --write
```

The suite's own check count is the one number a manifest cannot supply, because it
exists only after every suite has run. `test/run-all.js --write` stamps that one and
`render-docs.js` never touches it. Two writers, disjoint regions.

This replaced guarding with generation, and the reason is recorded inside one of the
guards it retires: **pinning one wording licenses the others to drift.** `METHOD.md`
once stated the trap count three ways; a check pinned one of them and the other two
went stale for four phases. A guard can only chase a phrasing somebody already wrote.
The guards in `test-findings.js` are kept — they still watch these files, and their
passing unchanged is what proved the generator reproduces the hand-written text
rather than quietly replacing it.

To add a generated phrase: wrap it in a marker, add a template under the same key in
`render-docs.js`, and run `npm run counts`. The tool refuses to run if a template is
never used, and refuses to spell a number it has no word for rather than writing
`undefined` into the README.

---

## Before you commit

```bash
npm test          # everything, including the manifest validator
npm run counts    # restamp every generated count
npm run build     # rebuild the page if src/ or programs/ changed
```

Work on a branch, merge only when the suite is green on `main`, and re-run it
after merging — line-ending normalisation on checkout has broken the build
artifact more than once.
