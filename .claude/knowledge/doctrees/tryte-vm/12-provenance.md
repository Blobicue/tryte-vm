---
name: provenance
description: The source conversation this project came from, what it claimed, and how much of it survived checking.
type: reference
last_updated: 2026-08-25
---

# Provenance

The project began as an attempt to verify a conversation. Owner:
[`docs/origin/`](../../../../docs/origin/) - append-only, sixteen source artifacts,
plus a transcript and its audit.

## What is established

- **The headline claim was wrong by 6.84x.** The source asserted **531,441**
  distinct reachable behaviours where the measured truth is **77,687** (`P5`). That
  single discrepancy is why every claim in this repository is now registered before
  it is measured.
- **The source's code was recovered and preserved**, including three code blocks
  that had been collapsed in the original view and would otherwise have been lost.
- **Provenance is append-only.** `docs/origin/` is never edited, only added to, so
  the thing being checked cannot drift toward the checker.

## Sub-topics (the rabbit hole)

- Which of the source's other claims survived, and which were never testable
- The 531,441 coincidence: the wrong number is also a real ceiling elsewhere
- What an audit of a conversation should preserve, and in what form

## Open questions

- Several source claims have never been separately checked because no tool existed
  for them. Which are still open?
- Is 531,441 appearing both as the wrong claim and as a genuine monoid ceiling
  meaningful, or is it the same exponent arithmetic twice?

## Related pillars

- [03-vocabulary-reach.md](03-vocabulary-reach.md) - where the claim was checked
- [10-method.md](10-method.md) - the discipline this discrepancy produced

## Depth status

**Seeded** (2026-08-25). The artifacts are preserved and one claim was checked
exhaustively; a systematic sweep of the rest has never been done.
