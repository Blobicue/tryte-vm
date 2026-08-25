---
name: axioms
description: 19 axioms and theorems stated in src/device.js and proved exhaustively. Two were false as first written, and the audit is what found them.
type: reference
last_updated: 2026-08-25
---

# The axioms

Six about a single switch (`D1`-`D6`), eight about how a network resolves
(`N1`-`N8`), five theorems a circuit may then rely on (`T1`-`T5`). Stated in
`src/device.js`, proved in `test/test-axioms.js`.

## What is established

- **All nineteen are proved exhaustively**, and the proved list is checked against
  the stated list in both directions, so neither can drift from the other.
- **Two were false as written, and the audit found them.** `N7` claimed resolution
  can never oscillate; seeded at a level, a self-inverter runs forever. Its
  *correction* was also false, claiming a node that reaches unresolved stays there
  - nodes firm up in dependency order and can pass through it. 481 passing checks
  said nothing, because every one looked only at final answers.
- **A defect map, pinned.** Breaking the solver three ways trips specific axioms:
  strict thresholds trip nine, treating unknown as off trips three, running
  reachability through rails trips three. *Which* axioms a defect trips is the part
  worth knowing - a proof that fails for everything is not telling you what it
  caught.
- **`T5` sat inert and then forbade the first thing storage needed.** An input
  gates and terminates a path but never sources one.

## Sub-topics (the rabbit hole)

- `D3` inclusive thresholds: the overlap at the threshold is the only way this
  model isolates the middle level, and strict thresholds break all five gates
- `N8`: the fixed point is not unique, so the initial state is part of the semantics
- Which axioms survive if strength is added - nobody has counted
- Whether the nineteen are minimal, or some are consequences of others

## Open questions

- Are there more axioms proved against combinational circuits whose consequences
  appear only once state arrives? Three have surfaced that way already.
- Is `T5` a theorem or a modelling choice? It follows from reachability starting at
  rails, which is itself a choice.
- Nothing checks the axiom set is **consistent**, only that each member holds.

## Related pillars

- [04-device-model.md](04-device-model.md) - what they are about
- [09-unbuilt-machine.md](09-unbuilt-machine.md) - `N4`, `N7` and `T5` constrain it
- [11-failure-catalogue.md](11-failure-catalogue.md) - two axioms were overclaims

## Depth status

**Rich** (2026-08-25). Nineteen proofs, a completeness check in both directions,
and a pinned defect map.
