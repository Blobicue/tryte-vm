---
name: cost-currencies
description: Six ways to price a circuit here, and every comparison made in them. They disagree, and a design has already improved two while worsening a third.
type: reference
last_updated: 2026-08-25
---

# Cost currencies

Any cost claim that does not name its currency is meaningless in this project, and
that is not a stylistic preference - it is a measured fact. Owner:
`design/01-currencies.md`, and the W, Y, Z, E sets.

## What is established

- **Six currencies**: switches, mid-rail taps, pass depth, dependency stages, state
  elements, seeded nodes. The first four have instruments; the last two are new
  with the unbuilt machine and have none.
- **They disagree, measurably.** The decoded adder is better on switches and pass
  depth and **worse** on dependency stages. It also taps the free middle rail
  **more**, 186 against 168 - winning on area partly by leaning on the one
  resource nobody charges for.
- **The verdict reverses between circuit kinds.** `MIN` favours ternary at 0.80;
  the adder favours binary at 2.23; the decoded adder narrows it to 1.93 and never
  drops below 1.36 at any width. `MIN` is positionwise, where fewer wider digits
  win. An adder is a table, and a three-input selector tree is 27 wide in ternary
  against 8 in binary.
- **Per digit: 3.71x**, or 3.21x decoded, against a break-even of log2(3) = 1.58.
  Not the radix-economy 3.077, which is in a unit that already carries a factor of
  two on the binary side. That near-miss is pinned as a check so nobody repeats it.
- **The free middle rail is load-bearing for exactly one published result.** A
  generator costing twelve switches erases `MIN`'s 0.80; no charge touches the
  adder, which is already over.

## Sub-topics (the rabbit hole)

- Why restoration makes the ratio worse rather than better
- The cost this model provably cannot show: ripple-carry delay
- What a currency for wire would look like, and why there isn't one
- Whether "report all six" is a position or an evasion

## Open questions

- Which currency should the machine actually be optimised in? Genuinely unsettled,
  and it is a choice rather than a measurement.
- State elements and seeded nodes have no instrument. The machine will be dominated
  by the first of those.
- Nothing prices fan-out, which this model gives away and silicon does not.

## Related pillars

- [04-device-model.md](04-device-model.md) - what the model can charge for
- [07-arithmetic-circuits.md](07-arithmetic-circuits.md) - where most comparisons live
- [09-unbuilt-machine.md](09-unbuilt-machine.md) - where the missing currencies bite

## Depth status

**Seeded** (2026-08-25). Four currencies instrumented and heavily used; two named
and unmeasured.
