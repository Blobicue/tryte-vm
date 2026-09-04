<!-- kind: index -->
# design/

The switch-level machine that does not exist yet, designed before it is built.

`src/device.js` and everything above it is arithmetic: gates, selectors, an adder.
A **computer** needs four things this repository has never built at switch level —
storage, a register file, instruction decode, and sequencing. This folder is the
design phase for all four, plus the interconnect that carries values between them
and the device-model questions they force.

Nothing here is built. Nothing here is chosen. The point of a design phase under
this repository's protocol is to **enumerate the space and register it**, so that
the choice can be attacked before it is committed to rather than four phases
after.

---

## Why this folder exists

The loop in [`../METHOD.md`](../METHOD.md) — register, run, record — is a
*verification* loop. It answers "is this claim true?" It says nothing about what
to build. Every design decision in this project so far was made mid-phase, ad hoc,
and the protocol did nothing for any of them.

The record shows the cost exactly. Where a design **space** was enumerated and
measured — the three restoration placements — the answer was good and the floor
was found. Where a single design was **picked and validated** — the selector tree,
at 104 switches and read depth 6 — every check passed and a design at **90
switches and depth 3** sat undiscovered for four phases, surfacing by accident
from an attack on a sentence.

So the missing discipline is one line: **register the design space, not the design
choice.** Then an outside reader can attack the space — *"you did not consider
decoding the select"* — which is the catch that eventually happened by luck.

---

## How to read this

| file | what it settles |
|---|---|
| [`00-protocol.md`](00-protocol.md) | what a design phase is, and the status vocabulary every claim here carries |
| [`01-currencies.md`](01-currencies.md) | the six costs this machine is measured in, and where they disagree |
| [`02-forbidden.md`](02-forbidden.md) | what the axioms already rule out — measured, not asserted |
| [`03-model-options.md`](03-model-options.md) | seven ways the device model could change, and what each costs |
| [`04-storage.md`](04-storage.md) | the trit cell |
| [`05-registers.md`](05-registers.md) | n-trit registers and the write discipline |
| [`06-interconnect.md`](06-interconnect.md) | how values move, and where contention lives |
| [`07-memory.md`](07-memory.md) | addressed storage, and why it dominates everything |
| [`08-decode.md`](08-decode.md) | opcode to control lines |
| [`09-sequencing.md`](09-sequencing.md) | what a clock is in a model with no time |
| [`10-integration.md`](10-integration.md) | the whole-machine budget under each combination |
| [`11-open.md`](11-open.md) | what this phase does not settle |
| [`12-roadmap.md`](12-roadmap.md) | **the order to build the rest in, and which machine is worth building** |
| [`13-instrument.md`](13-instrument.md) | the solver that bounds what the corpus may claim, and the plan to replace it |

Read `00` and `02` first. `02` is the short one and it is the one that constrains
everything else: storage turned out to be blocked by an axiom nobody had ever
leaned on, and the way round it was measured rather than guessed.

---

## The one thing already established

A trit **can** be stored in the current model, without changing any axiom, and the
route is not the obvious one.

- A cross-coupled inverter pair holds all three trits — but only when seeded, and
  from a cold start it resolves to unknown.
- Writing to it by passing data from an input **fails**, because `T5` says an
  input gates and never sources.
- Writing to it by overpowering the feedback **fails**, because `N4` says two
  drivers on one node is contention and this model has no notion of strength.
- Writing to it by **opening the feedback loop** works, on all three trits, at 19
  switches per cell.

That is measured, in [`04-storage.md`](04-storage.md). Everything downstream —
registers, memory, the state machine — inherits it.

---

## Structure is enforced

`test/test-design.js` reads every file in this folder, checks that each declares
its kind, that subsystem files carry all five required sections, and that every
option table marks each row `MEASURED`, `DERIVED` or `PROPOSED`. A design document
that quietly drops the sections it found inconvenient fails the build.
