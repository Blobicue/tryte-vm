---
name: tryte-vm
description: Doctree mapping what is known about the tryte-vm project — balanced ternary arithmetic, a 25-opcode machine, a switch-level device layer with a proved axiom set, and the discovery method that produced them. 13 pillars. Project-scope; the method pillars are candidates for migration to user scope.
type: overview
last_updated: 2026-08-25
---

# tryte-vm — overview

A map of the territory, not a copy of it. Every pillar here **summarises and
links**; the authoritative text stays in `README.md`, `METHOD.md`,
`FINDINGS.json`, `design/` and the source. A doctree that restates its sources
drifts from them, and this repository has recorded that failure three times under
the name *stale constant*.

What this adds that those files do not: **a single view of what is known, how well
established each part is, and where the frontier sits.** `README.md` is a
narrative, `FINDINGS.json` is a claim ledger, `design/` looks forward. None of
them answers *"how well mapped is this territory?"*

**Origin:** scaffolded 2026-08-25, after the project had accumulated 13 prediction
sets, 58 registered predictions, a proved 19-axiom device layer and a design phase
for the machine that does not exist yet — at which point nobody could say what was
known without reading everything.

---

## Depth vocabulary

Depth is declared and it is allowed to be low. A stub is an honest statement that
the territory is named and not mapped; it is not a failure and it is not padding.

| depth | means |
|---|---|
| **rich** | the pillar's subject is exhaustively established somewhere in the repo, and this file says where and what |
| **seeded** | substantial established content, with named gaps |
| **stub** | the territory is named, the sub-topics are listed, and little else |

---

## The 13 pillars

| # | Pillar | What it covers | Depth | Scope |
|---|---|---|---|---|
| 0 | [Balanced ternary](00-balanced-ternary.md) | the number system: trits, trytes, why negation is free | rich | substrate |
| 1 | [Instruction set](01-instruction-set.md) | 25 opcodes, three-way branch, tables as data | seeded | project |
| 2 | [Self-hosting](02-self-hosting.md) | interpreters in their own assembly, nesting, order-*k* masking | seeded | project |
| 3 | [Vocabulary reach](03-vocabulary-reach.md) | what an instruction vocabulary generates; the ceiling ladder | rich | project |
| 4 | [Device model](04-device-model.md) | the switch-level simulator, and what it assumes away | rich | substrate |
| 5 | [Axioms](05-axioms.md) | 19 stated, all proved, with a map of which defect trips which | rich | substrate |
| 6 | [Gates and selectors](06-gates-and-selectors.md) | inverters, MIN/MAX, the two selector designs | rich | project |
| 7 | [Arithmetic circuits](07-arithmetic-circuits.md) | adder cells, ripple, leaf sharing, restoration | rich | project |
| 8 | [Cost currencies](08-cost-currencies.md) | six costs that disagree, and every comparison made in them | seeded | substrate |
| 9 | [The machine, part-built](09-unbuilt-machine.md) | storage, registers, an accumulator and a 27-word addressed memory built; interconnect, decode and sequencing not | seeded | project |
| 10 | [Method](10-method.md) | register, run, record; the two error classes | rich | **substrate** |
| 11 | [Failure catalogue](11-failure-catalogue.md) | 16 classes, 30 bites, each now an antibody | rich | **substrate** |
| 12 | [Provenance](12-provenance.md) | the source conversation, and what of it survived checking | seeded | project |

Plus [research-topics.md](research-topics.md) — the intake queue for questions
that cut across pillars or are not yet shaped enough to be one.

---

## How to use this doctree

**As an orientation surface.** A session starting work here reads this file and
one pillar, not 600 lines of README. If a pillar is a stub, that absence is data.

**As a depth queue.** Stubs get pulled into deep treatment when work hits friction
in that area — *not* in numerical order. Pillar 9 went from stub to seeded by being
*built*, not by being written about: storage, a register, a master-slave register
and an accumulator, in that order, each one answering a question the previous one
raised.

**As a frontier map.** Every pillar carries an *Open questions* section. Those are
the actual edges of what is known, and they are the intake for
[research-topics.md](research-topics.md).

**Not as a source of truth.** Numbers live in `FINDINGS.json` and are checked by
the test suite. If a number appears here it is a signpost, and the pillar says
which file owns it.

---

## Substrate and project

Two pillars — **10 (Method)** and **11 (Failure catalogue)** — describe things
that are not about ternary at all. They are the candidates for migration to user
scope, where they would sit beside the agentic-engineering doctrees as a
cross-project substrate.

The discipline that keeps that migration possible: **when you find yourself adding
a ternary example to pillar 10 or 11, stop.** It belongs in the pillar the example
is actually about, cross-linked. Pillars 4, 5 and 8 are also substrate-shaped —
switch-level modelling and cost accounting are not project-specific — but they are
less proven outside this project and are marked substrate provisionally.

---

## Anti-patterns this doctree exists to prevent

1. **Re-reading everything to answer "what do we know about X?"** — which was the
   state that prompted it.
2. **Restating what `FINDINGS.json` owns**, which produces two numbers that drift
   apart. Pillars link; they do not copy.
3. **Pretending uniform depth.** A map that does not show which parts are unmapped
   is worse than no map, and this project has recorded five overclaims that all
   had the same shape as that.
4. **Losing the frontier.** Open questions scattered across thirteen commit
   messages are not a frontier; a per-pillar section is.

---

## Maintenance

- Depth in the table above must match the `Depth status` in each pillar file.
  `test/test-doctree.js` fails the build if they disagree.
- Every pillar carries `Open questions` and `Related pillars`; the same test
  enforces both.
- Cross-link aggressively. The pillars are not independent — 5 constrains 9, 8
  mediates every comparison in 6 and 7, and 11 is downstream of everything.
- **Re-check the structure after any five pillars change depth.** Thirteen may
  collapse to nine once 9 is built, or grow if the machine acquires subsystems
  nobody has named.
- When a pillar's Open questions empty out, that is a signal to raise its depth,
  not to delete the section.
