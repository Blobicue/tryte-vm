---
name: balanced-ternary
description: The number system underneath everything. Trits are -1, 0, +1; a tryte is six of them. Negation is a digit flip, there is no sign bit, and truncation rounds to nearest.
type: reference
last_updated: 2026-08-25
---

# Balanced ternary

Digits are **-1, 0, +1** rather than 0, 1, 2. A **tryte** is six trits: 729 values,
**-364 to +364**, centred on zero. Owner: `src/ternary.js`.

## What is established

- **Negation is free.** Flip every trit. There is no sign bit to maintain, no
  two's-complement asymmetry, and subtraction needs no separate circuit.
- **Truncation rounds to nearest**, which is load-bearing rather than incidental:
  `programs/multiply.tasm` extracts a trit as `v - 3*(v >> 1)`, and that identity
  holds only under round-to-nearest division.
- **MIN, MAX and NEG are exactly Kleene's strong three-valued logic.** Excluded
  middle and non-contradiction both fail at the middle value, which is the point
  of it rather than a defect.
- **Base 3 is the cheapest integer radix** by the measure Setun was argued on:
  representing a million values costs 40 in base 2, 39 in base 3, 40 in base 4.
  Recorded as `F-RADIX-ECONOMY`.
- **The break-even in switch currency is log2(3)**, not the radix-economy figure.
  Those are different units and mixing them is a trap this project nearly fell
  into; see [08-cost-currencies.md](08-cost-currencies.md).

## Sub-topics (the rabbit hole)

- Balanced representations in other bases, and why 3 is the only practical one
- Rounding behaviour of balanced division against the truncating kind
- Whether the centred address space (address 0 at the middle of memory) buys
  anything a machine actually uses
- Trit-serial versus trit-parallel arithmetic

## Open questions

- Does anything in the ISA actually exploit the free negation, or is it merely
  available? Nobody has counted.
- Is there a balanced-ternary multiplication algorithm materially better than
  repeated shift-and-add, and would it change the cost story?

## Related pillars

- [01-instruction-set.md](01-instruction-set.md) - the machine built on it
- [06-gates-and-selectors.md](06-gates-and-selectors.md) - Kleene logic in switches
- [08-cost-currencies.md](08-cost-currencies.md) - where the radix argument lives

## Depth status

**Rich** (2026-08-25). Exhaustively checked in `test/test-core.js` and
`test/test-logic.js`.
