<!-- kind: reference -->
# 11 — What this phase does not settle

A design phase that ends with everything resolved did not enumerate a space, it
made a decision. Here is what is genuinely open, sorted by how much it moves.

---

## Decisions, in leverage order

| rank | decision | moves | who decides |
|---|---|---|---|
| 1 | **`M1` charge retention** — does `Z` retain, or float? | **measured: 11×**, and it breaks nothing | the measurement is done; it is now a person's call |
| 2 | **memory scope** — 729 words, or fewer, or harness-held? | the whole machine, by up to everything | a person; it is a question about what the exercise is for |
| 3 | **`Q0` vs `Q1` vs `Q3`** — where the step boundary lives | whether the sequencer is made of switches | a person, after the handshake experiment |
| 4 | **`I0` vs `I2`** — mux trees or a decoded bus | a few hundred switches, and one class of silent failure | measurable |
| 5 | **`C5`** — could the ISA be renumbered so decode disappears? | ~480 switches and the assembler | a search, then a person |

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
- If a register read and write in the same solve *do* race, `R4` is required, the
  register file doubles, and [`05-registers.md`](05-registers.md)'s prediction was
  wrong.
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
machine**. So the design has one decision in it, and the rest is bookkeeping.

That is a much smaller and clearer plan than it looked like at the start of this
folder, and the reason it is clear is that the option spaces were written down
before anything was chosen.
