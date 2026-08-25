---
name: arithmetic-circuits
description: The carry as a 27-cell table realised in switches. Adder cells, six-trit ripple, leaf sharing, restoration, and a settling time that depends on the data.
type: reference
last_updated: 2026-08-25
---

# Arithmetic circuits

`TOPC` made the carry a table; this is the same 27 cells one layer down. Owner:
`src/device.js`, the W, Y, Z, E and F sets in `FINDINGS.json`.

## What is established

- **The adder is the table.** A full-adder cell is two three-input trit functions,
  each a tree of selectors. Nobody designed the circuit - the table did.
- **Two cells, measured against each other.** Selector tree: **104** switches, read
  depth **6**. Decoded select: **90** switches, depth **3**. Cheaper and shallower.
- **Six-trit ripple**: 624 unshared, 384 with leaves shared, 540 decoded. Checked
  against `T.add` over **all 531,441 operand pairs**, sum and overflow, zero wrong
  - twice over, for two independent circuit families that also agree with each
  other.
- **Ripple delay is invisible to a timeless model.** The selector-tree adder settles
  in exactly seven passes whether the carry travels nowhere or all six positions.
  The one cost a ripple adder is famous for is the one this model cannot show.
- **Except in the decoded design, where it is not.** That one takes 9 to 13 passes
  depending on the operands, and the distribution is **derived exactly**: 128 of
  every 243 pairs settle early, from a three-state walk over the carry.
- **Wrap versus step.** The low trit wraps, so its rows repeat and nine leaves
  collapse to three - an area saving. The carry steps, so its rows never repeat but
  it is flat in patches - a timing saving. One fact, two invoices, neither buying
  both.

## Sub-topics (the rabbit hole)

- Restoration: buffering costs 624 to 912 to 1776 and floors at depth 4
- Why buffering both levels buys no depth over buffering one
- The carry chain does not accumulate pass depth, because it resets at every gate
- Multiplication, which exists only as a program and never as a circuit

## Open questions

- **No multiplier exists at switch level.** It is the obvious next arithmetic block
  and nothing has costed it.
- Is 90 switches minimal for an adder cell? Only two designs have ever been
  compared.
- The decoded design's data-dependent settling is derived at carry-in 0 only. The
  carry-in +-1 walk is a different walk and has never been run.

## Related pillars

- [06-gates-and-selectors.md](06-gates-and-selectors.md) - what these are built from
- [08-cost-currencies.md](08-cost-currencies.md) - where the comparisons live
- [03-vocabulary-reach.md](03-vocabulary-reach.md) - `TOPC` is where the table idea came from

## Depth status

**Rich** (2026-08-25). Five prediction sets, several exhaustive sweeps of half a
million operand pairs, and one derivation checked pair by pair at five widths.
