<!-- kind: plan -->
# 12 — The road from here to a machine

Everything else in this folder enumerates option spaces. This file does the one
thing they deliberately refuse to do: **it commits to an order.**

It is allowed to, because the phases behind it have made enough of the space
`MEASURED` that a sequence can be argued from numbers rather than taste. Where it
still rests on `PROPOSED` terms it says so, and every switch count here comes from
[`../tools/budget.js`](../tools/budget.js) rather than being typed — `test/test-budget.js`
fails the build if this file and that tool disagree.

---

## What is built

Switch-level, checked exhaustively unless noted, with the set that proved it.

| part | switches | standing |
|---|---|---|
| inverters `STI`/`NTI`/`PTI`, `MIN`/`MAX` | 4–8 | `MEASURED` `P`,`Q` |
| selector, tree (`tmux`) | 4 | `MEASURED` `R` |
| selector, decoded (`dmux`) + `isMid` detector | 3 + 4 shared | `MEASURED` `E`,`I` |
| any 3-input trit function (table tree) | varies | `MEASURED` `S` |
| 6-trit ripple adder, tree | 624 | `MEASURED` `V`,`W` |
| **6-trit ripple adder, decoded** | **540** | `MEASURED` `E`,`F` |
| storage cell, loop-breaking | 19 / **11 in place** | `MEASURED` `J` |
| 6-trit register (transparent latch) | 114 / **66 in place** | `MEASURED` `J` |
| 6-trit master-slave register | 180 / **132 in place** | `MEASURED` `K` |
| **accumulator `A <- A + B`** | **672** | `MEASURED` `L` |
| device axioms D1–D6, N1–N8, T1–T5 | — | proved, `axiom-audit.js` |

That is a **datapath fragment that computes and remembers**, and nothing else.

## What is missing

| # | subsystem | design file | built? | governs |
|---|---|---|---|---|
| 1 | interconnect | [`06`](06-interconnect.md) | no | whether parts can be wired at all |
| 2 | address path | [`07`](07-memory.md) | no | **the dominant cost** — see below |
| 3 | memory array | [`07`](07-memory.md) | no | scope of the machine |
| 4 | instruction decode | [`08`](08-decode.md) | no | ~480 switches, ~1% |
| 5 | sequencing | [`09`](09-sequencing.md) | partly — `Q1` forced by `J4`/`K1`/`K4` | whether the sequencer is switches or JavaScript |
| 6 | ALU beyond add | — | no | `MIN`/`MAX`/`NEG` exist as gates, not as selectable ops |
| 7 | program load and fetch | — | no | how a program gets into the array |
| 8 | whole-machine assembly | [`10`](10-integration.md) | no | the thing itself |

---

## Which machine: the ladder decides it

The open question from [`11-open.md`](11-open.md) was *"which **sweepable** machine
is worth building?"* Two ladders answer it together, and neither is a matter of
taste.

**Ladder one — what fits the sweep budget.** `H2` measured 4,806 devices as the
largest network a full 531,441-pair sweep clears inside an hour.

| words | trits | model | storage | address path | rest | total | sweepable |
|---|---|---|---|---|---|---|---|
| 27 | 3 | `M0` | 1,782 | 603 | 1,608 | **3,993** | yes |
| 27 | 3 | `M1` | 162 | 603 | 1,608 | **2,373** | yes |
| 81 | 4 | `M0` | 5,346 | 1,822 | 1,608 | **8,776** | no |
| **81** | **4** | **`M1`** | **486** | **1,822** | **1,608** | **3,916** | **yes** |
| 243 | 5 | `M1` | 1,458 | 5,471 | 1,608 | **8,537** | no |
| 729 | 6 | `M0` | 48,114 | 16,410 | 1,608 | **66,132** | no |

`PROPOSED` — the storage and register terms are `MEASURED`, the address path and
decode terms are formulas nobody has built. The **comparison** survives errors in
those formulas because the same formula is applied to every row; the absolute
digits do not. Read the ladder, not the digits.

**Ladder two — what actually runs.** Measured by assembling every program in
`programs/` and looking at where its cells land.

| words | range | programs that fit as placed |
|---|---|---|
| 27 | −13..13 | **none** — `countdown` fits only if relocated (span 23) |
| **81** | **−40..40** | **3** — `countdown`, `threeway`, `kleene` |
| 243 | −121..121 | 6 — adds `tgate`, `multiply`, `fold` |
| 729 | −364..364 | 8 — adds `interp-core`, `interp` (the self-interpreter) |

**The two ladders intersect in exactly one place: 81 words under `M1`.** It is the
only configuration that both fits the sweep budget and runs a program somebody
already wrote. That is the target.

### Three consequences, and the third is the surprise

1. **Rank 1 and rank 2 in [`11-open.md`](11-open.md) are one decision, not two.**
   Charge retention was ranked separately from memory scope. They are the same
   choice: under `M0` the only sweepable machine is 27 words, which runs *nothing*
   as placed. Retention is not a 5× saving on a line item — it is the difference
   between a machine that runs a program and one that runs a relocated toy.

2. **A 27-word machine is not worth building.** It was floated in
   [`10-integration.md`](10-integration.md) as "a real machine at ~2,000 switches".
   It is real and it is cheap and **zero of the eight programs fit in it.**

3. **The bottleneck moves rather than disappearing.** [`10-integration.md`](10-integration.md)
   says memory is 93% of the machine, which is true under `M0`. Under `M1` storage
   nearly vanishes and **the address path becomes the largest single term** — at
   243 words it is 5,471 against storage's 1,458, nearly four times bigger. Retention
   does not make the machine cheap; it *relocates* what makes it expensive, from a
   part with a known fix to a part nobody has built.

   This also means [`10-integration.md`](10-integration.md)'s address-path estimate
   of ~1,000–3,000 for 729 words is very likely low: the formula in `budget.js`
   gives 16,410, and unlike the estimate it is written down and can be argued with.
   Corrected there, with the disagreement noted rather than quietly replaced.

---

## What "swept" would even mean here

`H2`'s 4,806 is a **budget of solves**, not a verification contract. A machine with
81 words of memory has more states than there are atoms worth counting; nothing
sweeps it. Saying "a sweepable machine" without saying *over what* is the exact
overclaim shape this repository catalogues as `T-CLAIM-NARROWED-BY-A-DESIGN`.

So the contract has to be chosen and stated. Candidates, in descending strength:

| # | contract | solves | exhaustive in |
|---|---|---|---|
| **V0** | every opcode × every value of one register, memory sampled | ~25 × 729 | the ISA, and one operand |
| V1 | every (opcode, A, B) triple with memory fixed | 25 × 729² | the ALU's whole input space |
| V2 | every reachable state of a *specific bounded program* run to completion | program-dependent | that program, completely |
| V3 | the datapath as a combinational function, `Q4`-style, memory unrolled | huge | everything, for bounded programs only |

**V0 is the honest default** and V2 is the one that would actually convince: a
bounded program whose entire execution is checked step by step against the
existing VM. `programs/countdown.tasm` at 20 cells is the candidate, and
`multiply.tasm` is the one [`09-sequencing.md`](09-sequencing.md) already noticed
is bounded.

The claim to make at the end is therefore **not** "the machine is verified". It is
"the machine agrees with `src/vm.js` on V0 and on every step of V2", which is a
smaller and true thing.

---

## The sequence

Ordered by dependency, not by interest. Each phase registers before it runs, in
its own commit, per [`00-protocol.md`](00-protocol.md).

Prediction-set letters are chosen to avoid collisions rather than alphabetically:
`M` reads as the model options `M0`/`M1`, `N` as the network axioms `N1`–`N8`, `T`
as the theorems `T1`–`T5`, and `O` reads as a zero in an id like `O0`. So the next
sets take **`B`**, then `A`, `C`, `D`.

### Phase 0 — can a cell output drive a selector *terminal*? `<- the gate`

**One experiment, and everything after it depends on the answer.**
[`05-registers.md`](05-registers.md) flagged it and nothing has tested it:
everything built so far feeds a selector's **gate**. `I0`, the read mux, and the
whole address path need a stored value to drive a selector's **source terminal**,
which is a different thing in this model — `T5` charges for it and `N4` may
contend on it.

**DONE — set `B`, and the answer is yes with a condition attached.** `B1b`: every
one of 81 stored patterns reads back correctly through both selector families, and
`B2` shows the stored trit is not disturbed at any pass of the solve, nor by a
second consecutive read. `I0`, `D1` and the address path are all viable and the
four phases below are unblocked.

The condition is the finding. **The two families are not interchangeable here**,
and `B1a` measured the split:

| family | switches | reads a stored terminal with the select cone unresolved? |
|---|---|---|
| `tmux` (tree) | 4 | **yes**, at every address, no precondition | 
| `dmux` (decoded) | 3 | **no — never settles** at two of the three addresses |

`dmux` gates its middle leg on a *computed* detector output. On pass one that node
is `Z`, unknown conduction counts as possible (`N6`), and the selected word gets
bridged to a second word's rail — so the network oscillates instead of resolving.
At the middle address only one word is bridged, there is no second rail, and it
reads cleanly. `tmux` gates every leg on the select **input**, which is known on
pass one, so it is immune by construction.

**Decision: the read path is built from `tmux`.** `dmux` does work once the select
cone is resolved, but "resolve the select cone first" is precisely the seeding
discipline listed under *What would stop it* below as the most likely way this
machine produces a plausible wrong answer — one missed seed, and nothing catches it
but the answer being wrong. Paying 4 switches instead of 3 removes the failure mode
instead of documenting it. Price: **+240 switches at the target size, 3,640 to
3,916, against a budget of 4,806.** The safer structure fits, so at this scale it
is not a trade.

`B3` also put a number on the budget itself: a 27-way one-trit read mux builds to
exactly the 39 switches [`../tools/budget.js`](../tools/budget.js) predicted. The
read term is no longer a guess. The decoder and write-enable terms still are.

### Phase 1 — interconnect, `I0` vs `I2`  ← **next**

Register the crossover: `I0` (selector tree per destination) is predicted to win at
this machine's source and destination counts and to lose badly by eight sources.
**The crossover point is the useful output**, not the winner. Depends on phase 0.

### Phase 2 — the address path, and whether `D0` and `D1` are one structure

**ANSWERED by `B4`, and the answer is no.** [`07-memory.md`](07-memory.md)
suspected the decoder and the read mux were one object approached from opposite
ends, and this file allowed that the address path might "roughly halve" if so.

It does not, on a counting argument that needs no simulation: a 27-word read mux
has **(27−1)/2 = 13 internal nodes**, and a write path needs **27 one-hot word
selects**, one per word. 13 < 27, so the mux cannot supply them and `D0` survives
in the write path whatever `D1` does. The two share the MID detectors and nothing
else — **12 switches out of a 603-switch address path, about 2%.**

**So 243 words is decided: it stays out of reach**, at 8,537 against a 4,806
budget, and there is no structural saving left that would bring it back. The
target machine is 81 words, and the six-program configuration is not available at
any price this folder knows about.

What remains of this phase is the part `B4` did not touch: the decoder and
write-enable terms are still `PROPOSED` formulas, and they are now the largest
unmeasured numbers in the budget. Building a 27-word decoder would settle them the
way `B3` settled the read term.

### Phase 3 — the memory array, at 81 words

Depends on 1, 2, and on the retention decision being made. Builds the target
configuration. Registers the assembled cost against this file's 3,916.

### Phase 4 — decode `C1`, and the `C5` search

Independent of everything above; can run at any time. ~480 switches. The `C5`
question — could the ISA be renumbered so decode disappears? — is a search over
opcode assignments and is the only item here that changes something outside the
device layer.

### Phase 5 — sequencing, and the `Q3` handshake experiment

`Q1` is already forced and measured. The remaining question is whether a **driven**
handshake settles, which `N7` suggests it may not. If it does, `Q3` becomes
available and the sequencer stops being JavaScript. If it does not, `Q0`/`Q1` stand
and [`09-sequencing.md`](09-sequencing.md)'s concession is permanent — which should
be stated plainly rather than discovered by a reader.

### Phase 6 — assembly, and the V0/V2 run

Assemble, predict the total **before** counting it, then run the contract above.

---

## What would stop it

Stated so it can happen, which is the point.

- **Phase 0 fails.** A stored value cannot drive a selector terminal without
  restoration. Then every mux input needs a buffer, the address path grows by
  roughly a third, and the 81-word `M1` machine may leave the sweep budget.
- **Retention is refused.** Entirely legitimate — it changes the device model to
  buy the result. Then the ceiling is the 27-word machine, no program fits, and the
  honest move is `A3` (harness-held memory, build only the port) rather than a toy.
- **`D0` and `D1` are genuinely distinct.** The address path stays at its full
  formula and 243 words never becomes sweepable.
- **A fourth state-related axiom bites.** `T5`, `N4` and `N7` all sat inert through
  the combinational phases and then forbade the first thing storage needed.
  [`11-open.md`](11-open.md) notes there is no reason to think three is all of them.
- **The seeding discipline does not compose.** Every state node must be seeded on
  every solve. At a few thousand nodes, one missing seed is one node at `Z`, which
  by `N6` poisons whatever it gates, and **nothing catches it except the answer
  being wrong.** This is the single most likely way the assembled machine produces
  a plausible wrong result. A seed-completeness check should be written *before*
  phase 3, not after it bites.

## What this plan does not decide

Three calls belong to a person, and this file deliberately does not make them.

1. **Whether charge retention is allowed.** It is measured — 11× on storage, zero
   differences across the existing corpus — but it changes what the model *is*, and
   that is not a measurement question.
2. **What the exercise is for.** A machine that runs `countdown` end to end and a
   machine that runs its own interpreter are different projects. The ladder above
   prices both; it does not choose.
3. **Whether `Q0`'s concession is acceptable.** If the step boundary lives in the
   harness, the sequencer is JavaScript and "a computer built of simulated ternary
   transistors" means a *datapath* built of them. Phase 5 may remove the
   concession; if it does not, someone has to decide whether it matters.
