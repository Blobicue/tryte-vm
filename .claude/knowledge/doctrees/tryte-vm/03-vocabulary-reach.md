---
name: vocabulary-reach
description: What a set of instructions can generate, measured as a monoid. The ceiling ladder, and the failed prediction that produced the corrected law.
type: reference
last_updated: 2026-08-25
---

# Vocabulary reach

Given a vocabulary of operations, how many distinct functions can composition
build? Measured exhaustively as a monoid closure. Owner: `tools/monoid-lib.js`,
and the P, Q, R, S, U, V sets in `FINDINGS.json`.

## What is established

- **The ceiling ladder.** Positionwise vocabularies saturate at `27^w`. One
  translation, or one carrying ADD, escapes it and closes at **251,505** at width
  2; arbitrary carries reach **531,441**. Each is a closed monoid, saturated and
  well under its search cap.
- **The source conversation's headline claim was wrong by 6.84x.** It asserted
  531,441 reachable where the truth is **77,687** (`P5`). Checking that is why the
  audit programme exists.
- **P3 failed** - a reach formula that factored across trit positions does not.
  The corrected law came out of the failure, and `Q3` later explained why the wrong
  one looked plausible.
- **Table freedom in the carry buys reach**; pinning the table does not (`V3`).
- **251,505 appears on the circuit side too, and it is a coincidence** - settled by
  the G set. The pairing that produces it holds at exactly one parameter value.

## Sub-topics (the rabbit hole)

- Positionwise versus cross-trit coupling as the thing that breaks a ceiling
- Sampled generators as lower bounds, and when a lower bound is enough
- Hash-consing tables by key, which later reappeared as circuit leaf sharing
- Why monoid growth and circuit-count growth are nothing alike

## Open questions

- No formula is known for how the arbitrary-carry ceiling grows with width. Two
  data points do not fix one, and width 3 is a monoid on 27 points.
- Is there a vocabulary that reaches everything at width 2, and what does it cost?
- The 531,441 collision is explained only as an exponent crossing.

## Related pillars

- [01-instruction-set.md](01-instruction-set.md) - the vocabularies are its opcodes
- [12-provenance.md](12-provenance.md) - the claim that started it
- [10-method.md](10-method.md) - P3 is the archetype of a productive failure

## Depth status

**Rich** (2026-08-25). Six prediction sets, all exhaustive, pinned in
`test/test-monoid.js` and `test/test-fold.js`.
