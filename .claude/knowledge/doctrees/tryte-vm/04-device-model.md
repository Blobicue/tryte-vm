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

## Sub-topics (the rabbit hole)

- Why `Z` and `X` are conflated at the device level, and what that costs
- The iteration cap, and what it means that a machine's clock can throw
- Seven possible extensions, enumerated in `design/03-model-options.md`
- Whether charge retention would break any existing gate

## Open questions

- **Can a 50,000-device network be solved at all?** The largest solved is 1,776 and
  nothing has profiled past it. If not, the exhaustive-sweep discipline stops
  applying to this project's own subject.
- Does the model need strength? It is the only change that makes the middle rail
  expressible, and it demolishes three axioms.
- Nothing represents wire. Every area number is a lower bound of a lower bound.

## Related pillars

- [05-axioms.md](05-axioms.md) - what this model promises, proved
- [08-cost-currencies.md](08-cost-currencies.md) - what it can and cannot charge for
- [09-unbuilt-machine.md](09-unbuilt-machine.md) - three axioms constrain storage hard

## Depth status

**Rich** (2026-08-25). `test/test-device.js`, plus the whole of pillar 5.
