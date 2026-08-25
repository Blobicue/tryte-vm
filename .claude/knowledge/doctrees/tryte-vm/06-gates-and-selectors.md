---
name: gates-and-selectors
description: Inverters, MIN and MAX from switches, and the two selector designs - one obvious, one 25 percent cheaper that nobody thought of for four phases.
type: reference
last_updated: 2026-08-25
---

# Gates and selectors

Everything above `src/ternary.js` is built on it; this is the layer below, built
from switches and checked against it. Owner: `src/device.js`.

## What is established

- **Three inverters**: the standard ternary inverter (`= NEG`) at 4 switches, the
  negative and positive ones at 2 each. `MIN` and `MAX` at 8 each. All exhaustive
  over their input space, and the six-trit versions over all 531,441 operand pairs.
- **Four switches is minimal for NEG** in this model, by exhaustive search over
  every network up to three switches - and the positive control finds **four
  distinct** four-switch networks, the standard inverter among them (`X5`).
- **No single device can isolate the middle level** (`X4`), so a selector gated on
  a raw trit needs a series pair for its middle arm. That one fact propagates all
  the way up to the machine's cost.
- **Two selector designs, and the second is much better.** Gated on the raw select:
  4 switches, depth 2. With the select **decoded once** by a 4-switch detector
  shared across every selector using that signal: 3 switches, depth 1. The series
  pair does not vanish - it moves to where it is paid once per *signal* instead of
  once per *selector*, and a tree has thirteen selectors.

## Sub-topics (the rabbit hole)

- Kleene logic realised in switches, and which gate the middle level costs most
- Table-as-tree: any three-input trit function is thirteen selectors
- Leaf sharing by hash-consing, which is `tableKey` applied to a circuit
- Whether the MID detector is itself minimal at 4 switches

## The families are not interchangeable

The decoded selector is cheaper (3 against 4) and won the adder. It **cannot read a
stored value** unless its select cone is resolved first: its middle leg is gated by
a computed detector output, `Z` on pass one, and unknown conduction bridges the
selected word to a second word's rail, so the network oscillates. Measured at one
level (`B1a`) and again on a 27-way three-level tree, where `tmux` reads all 27
addresses and `dmux` reads the 9 whose every address trit is MID.

`tmux` gates every leg on the select **input**, known on pass one, so it is immune
by construction — and that immunity, not the switch count, is why the read path and
the interconnect are budgeted in `tmux`. The cheaper part is the right choice only
where the sources are rail-driven, which is where the adder uses it.

## Open questions

- ~~Is the 4-switch MID detector minimal?~~ **Settled by the I set**: yes, and for
  all four tables the selector's contract accepts, not only the one that was built.
  Nothing under four switches computes any of them, and each has exactly four
  solutions — the same count `X5` found for `NEG`.
- Are there selector designs neither of the two found? The second came from
  attacking a sentence, not from search.
- `MIN` and `MAX` at 8 switches have never been searched for minimality the way
  `NEG` was.

## Related pillars

- [00-balanced-ternary.md](00-balanced-ternary.md) - Kleene logic
- [07-arithmetic-circuits.md](07-arithmetic-circuits.md) - what the selectors build
- [05-axioms.md](05-axioms.md) - `D3` is why the middle arm is a pair

## Depth status

**Rich** (2026-08-25). Exhaustive tables, an exhaustive minimality search, and two
designs measured against each other.
