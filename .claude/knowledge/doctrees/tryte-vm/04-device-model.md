---
name: device-model
description: The switch-level simulator beneath the arithmetic. Threshold switches, three rails, and four things it deliberately assumes away.
type: reference
last_updated: 2026-08-25
---

# The device model

A transistor is a switch that conducts or does not, by its gate's level against a
threshold; a node takes the level of whichever rail reaches it. IRSIM's model with
a third rail. Owner: `src/device.js`.

## What is established

- **Three rails** (`vss`, `vmid`, `vdd`) and two non-levels: `Z` floating, `X`
  unresolved. Resolution is a fixed-point iteration from an all-`Z` start.
- **Four stated limits**, and they are the honest part: the middle rail is free
  here; there is no level restoration; there are no noise margins; multi-threshold
  devices count as one switch each. Every cost number inherits all four.
- **The solver was wrong twice and now has a second implementation to disagree
  with.** Reachability once ran *through* rails, which made correct circuits
  resolve unknown. `test/test-device.js` carries a deliberately naive solver and
  holds the two against each other on 400 random networks plus the seeded
  oscillator that random networks cannot produce.
- **It is indexed.** Rescanning every device from every node cost 53ms per solve on
  a 624-switch adder; an adjacency map built once per solve brought it to 1.8ms -
  the difference between an eight-hour sweep and a sixteen-minute one.

- **It scales linearly, which two design documents denied.** Both asserted the
  solver was superlinear in practice; neither had measured it. It is linear in
  devices x passes -- measured exponent 0.92 across 8 to 50,000 devices -- and
  50,000 devices solve in about 70ms. What that buys is *running* a machine. What
  it does not buy is **sweeping** one: a full 531,441-pair sweep stays inside an
  hour only to roughly 4,800 devices. `H1`, `H2`.
- **Charge retention is a one-rule patch and it changes nothing measurable.** Make
  an isolated node keep its previous value instead of becoming `Z`, and across
  every gate, every input, and the adder swept -- 221,938 node values compared --
  **zero differ**. It also makes a trit cell one switch instead of eleven. The
  model would become one where `Z` retains, which is a real change to what the
  model *is*, and that is a person's call rather than a measurement. `H3`, `H4`.

## Sub-topics (the rabbit hole)

- Why `Z` and `X` are conflated at the device level, and what that costs
- The iteration cap, and what it means that a machine's clock can throw
- Seven possible extensions, enumerated in `design/03-model-options.md`
- Whether charge retention would break any existing gate

## Open questions

- ~~Can a 50,000-device network be solved at all?~~ **Settled by the H set**: yes,
  and the solver is linear rather than superlinear. 50,000 devices solve in ~70ms.
  The live question is now that sweeping, not simulation, is the binding limit — a
  full 531,441-pair sweep fits in an hour only to ~4,800 devices.
- Does the model need strength? It is the only change that makes the middle rail
  expressible, and it demolishes three axioms.
- Nothing represents wire. Every area number is a lower bound of a lower bound.

## Related pillars

- [05-axioms.md](05-axioms.md) - what this model promises, proved
- [08-cost-currencies.md](08-cost-currencies.md) - what it can and cannot charge for
- [09-unbuilt-machine.md](09-unbuilt-machine.md) - three axioms constrain storage hard

## Depth status

**Rich** (2026-08-25). `test/test-device.js`, plus the whole of pillar 5.
