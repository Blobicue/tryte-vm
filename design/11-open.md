<!-- kind: reference -->
# 11 — What this phase does not settle

A design phase that ends with everything resolved did not enumerate a space, it
made a decision. Here is what is genuinely open, sorted by how much it moves.

---

## Decisions, in leverage order

| rank | decision | moves | who decides |
|---|---|---|---|
| 1 | **`M1` charge retention *and* memory scope — one decision, not two** | whether the machine runs a real program at all | a person; see below |
| 1= | ~~memory scope — 729 words, or fewer, or harness-held?~~ **merged into rank 1** | — | — |
| 3 | **`Q0` vs `Q1` vs `Q3`** — where the step boundary lives | whether the sequencer is made of switches | a person, after the handshake experiment |
| 4 | **`I0` vs `I2`** — mux trees or a decoded bus | a few hundred switches, and one class of silent failure | measurable |
| 5 | **`C5`** — could the ISA be renumbered so decode disappears? | ~480 switches and the assembler | a search, then a person |

**Why 1 and 2 merged.** They were listed as separate decisions and they are not.
[`12-roadmap.md`](12-roadmap.md) crosses two ladders — what fits `H2`'s sweep
budget, and which programs fit in how much memory — and they intersect in exactly
one configuration: **81 words under `M1`**. Under `M0` the only sweepable machine
is 27 words, and **none of the eight programs fit in it**. So retention is not a
line-item saving to be weighed against others; it is the difference between a
machine that runs `countdown`, `threeway` and `kleene` and one that runs a
relocated toy. Choosing the scope *is* choosing the model.

Ranks 1–3 are not measurement questions dressed as choices. They are choices about
what is being built and what the model is allowed to be.

---

## Questions nobody has an answer to

**~~Can the machine be simulated at all?~~ Answered — and the answer moved the
question rather than closing it.** The solver is linear in devices × passes, not
superlinear as this document asserted without checking, and 50,000 devices solve in
about 70ms. So the machine can be **run**.

What it cannot be is **swept**. A full 531,441-pair sweep fits inside an hour only
up to roughly **4,800 devices**; the machine is ten times that. Every circuit result
in this repository rests on exhaustive sweeping, so the machine is the first subject
here that sits outside its own method — and the exhaustibility precondition in
[`../METHOD.md`](../METHOD.md) stops applying to the thing the method was built to
study. `MEASURED`

**~~Is the address path one structure or two?~~ Two** — `B4`. A read mux has too
few internal nodes to supply a write path's one-hot selects: 13 against 27 at that
size. They share about 2%, not half. This was the only structural saving anyone had
found for the term that dominates once retention lands, and it does not exist, so
**243 words is settled — it stays outside the budget.** `MEASURED`

**~~Can a stored value drive a selector's source terminal?~~ Yes** — `B1b`, with
nothing disturbed at any pass (`B2`). But the two selector families are not
interchangeable for it: the decoded one never settles unless its select cone is
resolved first, and the tree one is immune by construction. The read path and the
interconnect are now budgeted in `tmux` at 4 switches rather than `dmux` at 3,
which buys the removal of a failure mode nothing else would catch. `MEASURED`

**~~What do the decoder and write-enable terms actually cost?~~ Built** — `C1`,
at 27 words. Decoder 105, write path 102, address path 519 against the formula's
603, which was wrong three ways at once and net too high. The target machine got
**cheaper**, not dearer: 81 words under `M1` is 3,562. `MEASURED`

**What is still open is whether the array starts.** It does not, on its own: every
`hold` gate is a decoder output, unknown on pass one, and all 26 unaddressed words
corrupt on every write. Solving the control cone first fixes it — but that makes
the seeding discipline a **requirement of the design** rather than a risk to it,
and it scales with control fan-out rather than with anything the budget counts.

**Does the seeded discipline compose?** Every state node must be seeded on every
solve. At 4,374 nodes, one missing seed is one node at `Z`, which by `N6` poisons
whatever it gates. There is no mechanism that would catch a missing seed except
the answer being wrong.

**Is `T5` going to bite again?** It was proved, sat inert for a phase, and then
turned out to forbid the first thing storage needed. Two other axioms — `N4` and
`N7` — did the same thing in the same file. The pattern is that axioms proved
against combinational circuits have consequences that only appear when state
arrives, and there is no reason to think the three found so far are all of them.

**What is the equivalent of the decoded selector, here?** The selector tree was
obvious, correct, checked exhaustively, and 13% worse and twice as deep as
something nobody thought of for four phases. Every option table in this folder is
a list of things that were thought of. The one that matters may not be on it.

---

## What would falsify this plan

Stated so that it can be, which is the point.

- If `M1` turns out to break more than a handful of the 634 existing checks, the
  aggressive path in [`10-integration.md`](10-integration.md) is not a path and
  the machine is ~50,000 switches or smaller in scope.
- If a driven handshake settles, `Q3` becomes available and the concession in
  [`09-sequencing.md`](09-sequencing.md) — that the sequencer is JavaScript —
  stops being necessary.
- ~~If a register read and write in the same solve do race, `R4` is required and
  the register file doubles.~~ **They do.** A read during a write sees the new
  value on every case tried, because the write holds the feedback loop open and
  the cell is transparent. `R4` is required, the register file doubles, and
  [`05-registers.md`](05-registers.md)'s prediction was wrong — as this line
  anticipated it might be. `MEASURED`
- If the address decoder and the read mux turn out to be the same structure, the
  address path halves and [`07-memory.md`](07-memory.md) was double-counting.
- ~~If a 4,374-node solve is too slow, everything above is moot.~~ It is not too
  slow. The live question became a better one: which **sweepable** machine is worth
  building, given that a full one can be run but never exhaustively checked.

---

## The honest summary

Storage works, and works without changing the model — which was not obvious, and
three of the four obvious ways to build it are forbidden by axioms that had never
mattered before.

Everything downstream is arithmetic, except memory, and **memory is 93% of the
machine** — under `M0`. Under `M1` that sentence stops being true and the address
path takes over, which is the one thing this folder did not anticipate.

So the design has one decision in it — scope-and-model, together — and one
unbuilt structure that nobody has priced honestly, and the rest is bookkeeping.

That is a much smaller and clearer plan than it looked like at the start of this
folder, and the reason it is clear is that the option spaces were written down
before anything was chosen.
