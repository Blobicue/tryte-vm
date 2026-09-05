<!-- kind: plan -->
# 13 — The instrument, and what it cannot currently afford

Every other file in this folder designs the *machine*. This one designs the
**instrument that measures it**, because the instrument has started to bound what
the corpus is allowed to claim.

`src/device.js` resolves a switch network by fixed point. It is correct, it is
proved against its own axioms, and it is slow enough that several results in this
repository rest on a **stride through the operand space rather than the whole of
it**. That is disclosed everywhere it happens — `midrail-audit.js` says outright
that its restored nets are not swept exhaustively and that "the exhaustive sweep
is Y1's job" — but a disclosed sample is still a sample, and the reason it is a
sample is the instrument rather than the question.

This file commits to building a second solver that can afford the sweeps the
first one cannot, and to the three-way comparison that keeps the result
attributable.

---

## What is built

The solver, and the sampling the corpus currently lives with.

| network | switches | passes | standing |
|---|---|---|---|
| 6-trit ripple adder, tree (`restore: none`) | 624 | 7 | `MEASURED` `V`,`W`,`Y`,`Z` |
| 6-trit ripple adder, decoded | 540 | — | `MEASURED` `E`,`F` |
| 6-trit ripple adder, `restore: mid` | 912 | 19 | `MEASURED` `Z` |
| 6-trit ripple adder, `restore: leafmid` | 1776 | 31 | `MEASURED` `Z` |
| 10-bit binary ripple adder | 280 | 11 | `MEASURED` `W`,`Z` |

Every number in that table is `Z3`'s or `Y`'s and is recomputed by an existing
check. Node counts are deliberately absent: nothing in the repository records
them, and this file does not introduce a number no test recomputes.

Exhaustive today, over all 3^12 operand pairs:

- `Y1`/`Y2` — the tree adder at carry-in 0: sum, overflow trit, and pass count,
  two solves per pair because "exactly seven passes" is a claim in both
  directions and only the second solve can refute the lower bound.
- `E1` — the decoded adder at carry-in 0.

Sampled when this file was written — and swept since, by `AW`, which is step 5
below. The strides are left here because they are what the plan was written against:

- ~~**Carry-in +1 and −1, on both six-trit adders.** Stride 11 in each operand, so
  one pair in 121.~~ **Swept.** Every pair at both carry-ins on both adders.
- ~~**Every restored variant in `Z`.** All three of `none`, `mid` and `leafmid`,
  at stride 11 — and `leafmid` is the largest network in the repository.~~
  **Swept.** All three exhaustively at carry-in 0; `leafmid` is still the largest
  network here and it is the one sweep that costs a quarter of an hour.
- ~~The 10-bit binary adder, stride 37.~~ **Swept**, every pair at carry-in 0.
- Read depth on the decoded adder, over a sample rather than the sweep. **Still
  sampled**: `AW` swept pass counts and outputs, not depths, and `depths()` is
  deliberately out of scope below.

What is still sampled, said plainly rather than left to be inferred from what the
list above no longer says: the binary adder at carry-in +1, the binary restored
variants at anything but stride 37, and read depth.

## What is missing

**An instrument that can exhaust those five.** The obstruction is representation,
not arithmetic. `Net.solve()` keys nodes by string, holds levels in a plain
object, builds adjacency as a `Map` of arrays of objects, and allocates a fresh
`Set` per rail per mode per iteration. The fixed point on the tree adder settles
in seven passes; each pass walks three rails in two modes, so one solve is
forty-two traversals of a 624-edge graph. The per-edge cost that follows from
those numbers is two orders of magnitude above what following a pointer costs,
and the whole of it is bookkeeping.

The consequence is a straight line: `leafmid` is 1776 switches and thirty-one
passes, the largest and slowest network here, one exhaustive sweep of it takes
hours, three restore variants times three carry-ins is most of a day, and so `Z`
sampled.

**And the fix must not be allowed to launder itself.** Moving to integer node
ids, CSR adjacency and word-packed reachability would speed up *JavaScript* by a
large factor with no WebAssembly anywhere. A two-way comparison would measure the
rewrite and report it as the runtime. So the plan builds three:

| | what it is | what it prices |
|---|---|---|
| **R0** | `src/device.js`, untouched. The oracle. Never optimised. | — |
| **R1** | the same algorithm over the packed representation | the representation |
| **R2** | the same algorithm again, in WebAssembly, over the same packed form | WebAssembly |

R1 is a negative control, not a stepping stone. It must be R0's algorithm
exactly — same fixed-point loop, same six traversals per pass, same termination
test, same `init` and `driven` semantics. No incremental recomputation, no
fusing the definite and possible walks. If R1 changes the algorithm, R1-against-R0
measures algorithm and representation together and the split stops isolating
anything.

**Where the bytes come from.** A runtime emitter in `src/`, not a toolchain.
WebAssembly is generated by JavaScript that ships in the bundle, so the published
page emits its own module at load time: no committed binary, no base64 blob, no
build step that a reader cannot follow. This is `PROPOSED` on cost — an emitter,
a small statement and expression layer above it so the solver stays readable, and
the solver itself is the bulk of the work — and `DERIVED` on feasibility, since
the module needs integer arithmetic, linear memory and structured control flow
and nothing else.

**Non-convergence is a measurement, not an error.** `fullSweep` probes the pass
count by solving at *k* and again at *k−1* and catching the throw. R1 and R2 must
reproduce "did not settle within *k*" exactly. A solver that returns a
half-settled state instead of reporting the bound is not a port of this one; it
is a different instrument that agrees with it on the easy cases.

## The sequence

0. **Register `AV` first, before a line of the instrument is written.** Done, in
   `tools/solver-audit.js`: four predictions about what each layer of the rewrite
   buys, registered while no part of it exists and nothing about its speed can be
   peeked at. Building R1 first and registering afterwards would have let the
   band be fitted to the answer.
1. **`src/netpack.js`** — lower a `Net` to dense integer ids, parallel typed
   arrays for the device table, CSR adjacency, and rail and driven masks computed
   once per network rather than once per solve. R1 lives here. **Done.**
2. **The R0-against-R1 gate, green before any timing is reported.** Exhaustive on
   every small builder, on all twenty-seven input triples of both adder cells, and
   on a network that does not settle, so the bound is compared and not just the
   levels. A ratio between two solvers that disagree is a fact about neither.
   **Done**, in `test/test-solver.js` section 0 and runnable from the tool; it
   grew two things this file did not ask for and should have. Both selector
   families are wired with their arms on RAILS and again on INPUTS, because `T5`
   says an input gates and terminates a path but does not source, and a packed
   form that quietly sourced from inputs would pass every rail-armed case. And the
   corpus is checked for producing all five node states, because a gate that never
   saw an `X` cannot have checked how `X` is handled.
3. **`src/wasm-emit.js`**, then **`src/solver-wasm.js`**. R2 passes the same gate
   R1 passed, and the sweep driver loops over operand pairs *inside* the module —
   crossing the boundary once per chunk, not once per pair. **Done.** One generic
   module rather than one per network: a header at address zero carries the counts
   and a base pointer per array, so loading a network is a copy and the module is
   instantiated once per process rather than once per solve.
4. **Run `AV` and record it.** Results commit separate from the registration
   commit, then the manifest entry and the assertions in `test/test-solver.js`.
   **Done: `AV4` held and `AV1`, `AV2` and `AV3` failed.** The instrument works and
   three of the four predictions about what it would cost were wrong — see
   [`../results/00-model.md`](../results/00-model.md) and
   [`../results/07-negative.md`](../results/07-negative.md).
5. **Then, and only then, a second set for the sweeps. Done: `AW`, and three of
   its four predictions failed.** The carry-in ±1 sweeps
   on both six-trit adders and the restored variants exhaustively are what the
   instrument is *for*, but they are not in `AV` and must not be: an instrument
   that has not been held against the oracle produces facts about the instrument,
   and this repository has been bitten by that sixteen times. Register them once
   R1 and R2 have passed step 2, and **read the `Y1`, `Y2`, `Z3`, `E1` and `F`
   entries in `results/99-ledger.md` before writing a single prediction** — find
   them by id, not by line number, because that file is generated from
   `FINDINGS.json` and every entry below a new one moves when the manifest grows.
   Between them they record: the carry-in-0 sweeps are exhaustive and clean, the
   pass counts for all three restore variants were *derived by hand* from
   gate-dependency depth before being measured, and `pairs_differing_by_data` is
   already zero. Three separate candidate predictions were drafted for this file
   and discarded against those five entries. What remains genuinely open in this
   neighbourhood is the carry-in ±1 space at stride 1, and nothing else.

   **What it found.** `F`'s rule survives the crossing *unchanged*, and every one of
   `AW`'s four predictions about how it would have to change is wrong. `AW1`
   admitted position 0 to the rule and the registered form is wrong on exactly two
   thirds of every pair at both carry-ins; `AW2`'s and `AW3`'s numbers follow it
   down; `AW4` predicted the floor would drop to eight and it stays at nine. The
   mechanism is measured rather than argued: position 0's carry is a primary input,
   so the detector that would let its early leaf through resolves on the *same pass*
   as the operand detectors gating the selectors above it, and the saving has
   nowhere to go. One position up that gap is two passes and the saving is real.
   **Position 0 is excluded because it is the boundary cell, not because `c_0` is
   zero** — and the four sweeps this file bought are what could tell those apart.
6. **A page. Done: `docs/tryte-lab.html`**, built by `build/build-lab.js` out of
   `build/lab-template.html`, with its own suite in `test/test-lab.js`. A new one,
   because `test-page.js` pins the existing page's markup in detail and the two are
   different documents. `build/bundle.js` had a hardcoded file list that never
   included `device.js`, so the bundler was parameterised rather than extended:
   `buildLabBundle()` sits beside `buildBundle()`, wraps each module in an IIFE
   because `add`, `sub` and `mul` are declared at top level in both `ternary.js` and
   `wasm-emit.js`, and leaves the flat form byte for byte as it was.

   **It is a second copy of the instrument, so it is gated like one.**
   `build/build-lab.js` runs real switch-level sweeps through the BUNDLED code and
   through the module code — every design the page offers, at every carry-in — and
   refuses to write the page when the two disagree, on the bytes, on the pass
   counts, or against `T.add`. `test/test-lab.js` then runs that gate as a
   subprocess, so the comparison cannot be skipped by not rebuilding. Same
   arrangement `docs/tick-argument.html` has and for the same reason: a second
   implementation that is never compared is just an unchecked claim.

   **What the page reports, and the shape of each.** Progress while it runs;
   divergence from the oracle, which is `T.add` out of `src/ternary.js` and not a
   second addition written for the browser; the switch count and the mid-rail tap
   count as SEPARATE columns beside the narrowest binary adder covering the same
   state count, because folding those two together would turn the comparison into
   an assertion about the one currency this model prices at zero; and the pass-count
   **histogram** rather than a single pass count — got without a second solver, by
   replacing exactly one node of `solve`'s own body so the loop that takes the
   passes is the thing that counts them.

   **What the constraints of a `file://` URL decided.** `WebAssembly.instantiate`
   and never `instantiateStreaming`, which wants a `Response`; no worker, so the
   chunking is on `requestAnimationFrame`; no `SharedArrayBuffer`, which wants
   headers a local file cannot send; and no committed binary or base64 blob, since
   a page that shipped the bytes would be a page whose emitter is decoration.

## What would stop it

- ~~**R2 lands on R1.**~~ **It did not.** WebAssembly bought more than `AV3`
  registered, not less, so step 4 is not dead weight. The route that broke the
  prediction was the one its own registration named: a bounds check on every
  typed-array index that a load into linear memory does not pay.
- ~~**R1 lands on R0.**~~ **It did not, but the premise of this file was weaker
  than it looks.** The representation is worth an order of magnitude and `AV2`
  still failed, because it failed LOW — the band was drawn around an anchor that
  was too slow and a target that was too fast. What this file predicted about
  *where* the cost is was also wrong: `AV1` ruled out the update loop's allocation,
  which is the thing the "What is missing" section above names first.
- ~~**The packed form cannot express the model.**~~ **It can, and that is checked
  rather than assumed.** `init` seeds any of the five node states onto any
  non-driven node, the self-inverter gives its three different answers to its three
  seeds, and both of `solve()`'s refusals are reproduced. A solver that dropped the
  seed is one of the mutants the gate is shown to catch.
- ~~**The exhaustive sweeps disagree with the samples.**~~ **They did not, and the
  consequence this bullet asked to be accepted before the run was never called in.**
  Every corner `Y`, `E` and `Z` disclosed as sampled is now swept: sum, overflow and
  pass count over every operand pair, on both six-trit adders at both non-zero
  carry-ins, on all three restore variants, and on the ten-bit binary adder — zero
  disagreements anywhere. Nothing in `Y`, `E` or `Z` is retired. What the sweeps did
  overturn was a *scope line* rather than a measurement: `F1`'s guess about what lay
  past the carry-in it fixed.
- ~~**A number in this file rots.**~~ **Pinned.** `test/test-solver.js` reads the
  five switch counts and four pass counts out of the table above and recomputes
  them, the way `test-budget.js` pins `12-roadmap.md`. The pass counts are checked
  rather than searched: the table supplies *k*, and each network is solved twice —
  at *k*, where it must settle, and at *k−1*, where it must not. Node counts are
  still absent from that table on purpose and are recorded as
  measured-not-registered instead.

## What this plan does not decide

- **Whether the sampled results are wrong.** The stride is a reason to check, not
  evidence of a defect. Five sweeps are being bought; what they say is theirs.
- **Whether `depths()` moves to the packed form.** It is used in
  `test-decoded.js` and `test-midrail.js` and in none of the expensive audits, so
  it is out of scope here — and therefore the packed form is not a drop-in
  replacement for `device.js` and must not be described as one.
- **Whether `device.js` is ever retired.** R0 is the oracle. A faster solver that
  replaces the thing it is checked against has removed its own check.
- **What the page is for.** Running a sweep in a browser is a different artifact
  from arguing a result in one, and this file does not choose between them.
- **Whether any of this belongs in the machine.** It is an instrument. Nothing
  here is a switch-level design and nothing here changes what the machine costs.
