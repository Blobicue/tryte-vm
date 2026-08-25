<!-- kind: reference -->
# 11 — What this phase does not settle

A design phase that ends with everything resolved did not enumerate a space, it
made a decision. Here is what is genuinely open, sorted by how much it moves.

---

## Decisions, in leverage order

| rank | decision | moves | who decides |
|---|---|---|---|
| 1 | **`M1` charge retention** — does `Z` retain, or float? | the whole machine, by ~5× | needs the blast-radius measurement first, then a person |
| 2 | **memory scope** — 729 words, or fewer, or harness-held? | the whole machine, by up to everything | a person; it is a question about what the exercise is for |
| 3 | **`Q0` vs `Q1` vs `Q3`** — where the step boundary lives | whether the sequencer is made of switches | a person, after the handshake experiment |
| 4 | **`I0` vs `I2`** — mux trees or a decoded bus | a few hundred switches, and one class of silent failure | measurable |
| 5 | **`C5`** — could the ISA be renumbered so decode disappears? | ~480 switches and the assembler | a search, then a person |

Ranks 1–3 are not measurement questions dressed as choices. They are choices about
what is being built and what the model is allowed to be.

---

## Questions nobody has an answer to

**Can the machine be simulated at all?** The largest network solved here is 1,776
devices. A full-memory machine is ~50,000. The solver rebuilds an adjacency index
per solve and iterates to a fixed point, and nothing has profiled it past 624
devices. If a single instruction takes minutes, the exhaustive-sweep discipline
this whole repository is built on stops being available, and every method claim in
[`../METHOD.md`](../METHOD.md) about exhaustibility stops applying to its own
subject.

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
- If a 4,374-node solve is too slow, everything above is moot and the real design
  question is which smaller machine is worth building.

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
