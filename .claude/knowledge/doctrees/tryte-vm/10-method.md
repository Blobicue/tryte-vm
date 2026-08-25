---
name: method
description: Register, run, record. The verification loop that produced everything here, and the two error classes it revealed. Substrate - not about ternary.
type: reference
last_updated: 2026-08-25
---

# The method

**Substrate pillar.** Nothing here is about ternary; the examples are, and they
should stay cross-linked rather than pasted in. Owner:
[`METHOD.md`](../../../../METHOD.md).

## What is established

- **The loop**: build the instrument, **register the predictions in their own
  commit**, run, record results in a second commit, turn every defect into a
  permanent check. The separation between registering and recording is the whole
  mechanism; the rest is hygiene, and the ordering is verifiable afterwards by
  anyone.
- **Failures outproduce successes.** 58 predictions, 53 held, 5 failed - and four
  of the five produced the result that replaced them, including a circuit design
  cheaper and twice as fast as the one it refuted.
- **Two error classes, two catchers.** Mechanical defects - arithmetic, broken
  instruments, stale constants - fall to automated checks. Semantic defects -
  sentences claiming more than was measured - were caught almost entirely by a
  reader who had not written them, and essentially never by re-reading.
- **An overclaim is invisible from inside the sentence that made it.** Demonstrated
  five times, including inside the document describing the failure mode.
- **A design phase is a separate thing** and this project lacked one for most of
  its life. Register the design *space*, not the design *choice*.

## Sub-topics (the rabbit hole)

- What parallelises: critics per claim, instrument audits, replication at other
  parameters
- What did not: the frontier advanced serially, each question made askable by the
  previous answer
- The status vocabulary (MEASURED / DERIVED / PROPOSED) and why prose needs one
- Preconditions: an exhaustible domain and cheap ground truth

## Open questions

- **Whether the protocol caused any of the results.** There was no control arm. It
  is entirely possible the finite domain and the reference implementation did the
  work.
- Is the critic's useful property being *stronger*, or having *uncorrelated*
  errors? The record supports only the first; the second is speculation.
- Does any of this transfer to a domain that cannot be swept exhaustively?

## Related pillars

- [11-failure-catalogue.md](11-failure-catalogue.md) - the antibodies this produced
- [03-vocabulary-reach.md](03-vocabulary-reach.md) - where the loop was first run

## Depth status

**Rich** (2026-08-25). `METHOD.md`, whose own figures are checked against
`FINDINGS.json` by the test suite.
