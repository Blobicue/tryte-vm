<!-- kind: reference -->
# 00 — What a design phase is

The measurement loop in [`../METHOD.md`](../METHOD.md) takes a claim and finds out
whether it is true. A design phase runs earlier and answers a different question:
**what are we choosing between, and what does each choice cost?**

It ends by handing the measurement loop a registered prediction. It does not end
by picking a winner. Picking is a separate act, done with the space on the table.

---

## The six steps

**1. State the requirement in checkable terms.** Not "storage" — *"holds one of
three levels across a solve, and returns the level it was given."* If you cannot
write the check, you do not yet have a requirement.

**2. Enumerate the space, and register it.** Every option you can name, including
the ones you already dislike, including the ones that need the model changed,
including the ones that are cheating. **This is the step the whole discipline
exists for.** A design phase that lists one option is a design *decision* wearing
a phase's clothes.

**3. Name the currencies.** Which cost is being optimised, and which are merely
reported. This project has six and they disagree; see
[`01-currencies.md`](01-currencies.md). A design claim that does not name its
currency means nothing.

**4. Find what the axioms already force.** Before comparing options, find out which
parts of the space are not actually available. This is cheap, it is often
surprising, and it is where [`02-forbidden.md`](02-forbidden.md) came from — three
of the four obvious ways to build storage turned out to be ruled out by axioms
that had never been leaned on before.

**5. Predict the winner, and the margin.** By hand, in advance, with the reasoning
shown. This is what makes the design phase falsifiable rather than a shopping list.

**6. Measure the space, not the choice.** Then the measurement loop takes over.

---

## Status vocabulary

Every claim in this folder carries one of three markers. The build fails if an
option table uses anything else.

| marker | means |
|---|---|
| **MEASURED** | run against the actual model, in this repository, and the result is reproducible |
| **DERIVED** | arithmetic or logic from something MEASURED, shown, and not independently run |
| **PROPOSED** | neither. A design idea with a rationale and no evidence |

Most of this folder is `PROPOSED`, and that is correct for a design phase. The
marker exists so that nobody reading it later mistakes a plausible cost estimate
for a measurement — which is the shape of failure this repository has recorded
thirteen times under different names.

---

## What this phase must not do

**It must not prune to a recommendation.** The value of a registered space is that
an outside reader can attack it. Pruning before registration destroys exactly the
thing that produced this project's best circuit.

**It must not quantify beyond what it measured.** Every option's cost is a cost
*under the currencies named*, at *the sizes stated*. "Cheapest" without both
qualifiers is the overclaim this repository has made five times.

**It must not confuse a forced constraint with a chosen one.** If an axiom rules
an option out, say which axiom and cite the measurement. If it is merely
unattractive, say that instead. The two get treated very differently by a reader
deciding whether to change the model.

---

## The failure this is designed against

From the record, stated plainly so this folder can be checked against it:

> The selector-tree adder cell was designed, built, checked exhaustively, and
> published. It cost 104 switches at read depth 6. Four phases later, an attack on
> an unrelated sentence produced a cell at **90 switches and read depth 3** — 13%
> less area and half the depth. Nothing in the verification loop could have found
> it, because the verification loop only ever saw one design.

Every subsystem file here therefore ends with an explicit invitation: *what is
missing from this list?*
