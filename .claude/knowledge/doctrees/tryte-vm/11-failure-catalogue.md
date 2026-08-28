---
name: failure-catalogue
description: <!--g:doctree-desc-->Nineteen defect classes, fifty-three bites<!--/g-->, each now a permanent check. Substrate - the classes are not about ternary.
type: reference
last_updated: 2026-08-25
---

# The failure catalogue

**Substrate pillar.** Owner: `FINDINGS.json` `traps_encountered`, and the table in
[`METHOD.md`](../../../../METHOD.md).

## What is established

<!--g:doctree-lede-->Nineteen classes, fifty-three occurrences<!--/g-->. The ones that recurred after being
named are the interesting ones, because naming a thing is supposed to prevent it:

- **one point is not a function** - bit three times
- **hardcoded counts go stale** - three times, including a document stating its own totals
- **the instrument, not the subject** - four times; a tool declaring a failure that was its own
- **a claim narrowed by a design** - twice; the numbers right and the noun too big
- **out of budget is not finished** - twice; the second produced no wrong number, only an unverified one
- and ten others, each bitten once

**Most of them are arguably one class.** About ten of the nineteen reduce to *the
thing measured is narrower than the thing claimed* - a sample versus a function, a
parse versus a document, a budget versus a completion, one design versus a class,
a corpus minus itself versus a corpus. Four do not fit. That reduction is an
observation, not a finding, and it has not been tested.

**Every one is now a check that is shown to fail without its fix.** That is the
rule: not a fix, a *check*.

## Sub-topics (the rabbit hole)

- Antibodies: converting a defect to a check that demonstrably fails
- Why checks only guard what they parse - a tally check missed a wrong word one
  token away from the number it verified
- The census that counted itself, which is the newest class
- Whether the nineteen really are one

## Open questions

- Is the ten-of-nineteen reduction real? It would need testing against defects
  from a different project.
- Which classes are specific to *this* model and which generalise?
- No class has ever been retired. Are any of them obsolete?

## Related pillars

- [10-method.md](10-method.md) - the loop that produces the antibodies
- [05-axioms.md](05-axioms.md) - two axioms were themselves overclaims

## Depth status

**Rich** (2026-08-25). Every class has a recorded count, a description, and at
least one check that catches it.
