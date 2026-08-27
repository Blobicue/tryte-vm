<!-- kind: results-index -->
# results — what this project established, organised by subject

`design/` looks forward and enumerates option spaces. **This folder looks back and
states what was measured.** Between them sits [`FINDINGS.json`](../FINDINGS.json),
which is the authoritative record and is ordered the only way a record can be
honestly ordered: chronologically, by when each prediction was registered.

Chronological order is right for a ledger and useless for a reader. Nobody can
answer *"what is known about adders?"* without reading every set in
sequence. This folder is that same corpus keyed by subject instead of by date.

---

## How to read a claim here

Every claim carries an **evidence class**. The vocabulary is the same three words
`design/` uses, because a claim's standing should not change when it moves between
folders.

| class | means |
|---|---|
| `MEASURED` | established by a run, against a stated sweep, with a tool and a test that assert it |
| `DERIVED` | arithmetic over `MEASURED` parts and nothing else |
| `PROPOSED` | a structural argument for something nobody has built |

A claim that mixes classes takes the weakest of them. That rule is enforced in
[`../tools/budget.js`](../tools/budget.js) and stated here because it is the whole
reason the vocabulary exists.

### The citation rule

**Every number in this folder appears with the prediction that produced it** —
`540 switches (E1)`, `crossover at 4.67 (N3)`. The citation is not decoration: it
is what makes a number checkable, and `test/test-results.js` verifies that every
cited id exists in the manifest.

**One genuine ambiguity, stated rather than papered over.** The device axioms are
`D1`–`D6`, `N1`–`N8` and `T1`–`T5`, and prediction sets `D` and `N` have ids of the
same shape. A bare `N4` could be either. The surrounding sentence says which every
time; the test accepts both, because both are real references.

This project has recorded `T-STALE-CONSTANT` four separate times — a number typed
into prose stops tracking the code that produced it and goes on looking right. The
citation rule is the cheapest defence that scales: a reader who doubts a figure has
the set id, the tool, and the commit in one hop.

---

## Ownership

Every set has exactly **one owning file**, where its results are stated in full.
Any file may cross-reference any set. This is the doctree's *link, do not copy*
doctrine applied to results, and it exists because a strict partition would force
false homes — the detector (`I`) is arithmetic by subject and economics by
consequence, and `B1a`'s control/data distinction founded three later sets.

`test/test-results.js` checks that every set is owned exactly once and that no
cross-reference names a set that does not exist.

| file | owns | depth |
|---|---|---|
| [`00-model.md`](00-model.md) — the device model and its axioms | `W` `X` `Z` | **rich** |
| [`01-vocabulary.md`](01-vocabulary.md) — what an instruction vocabulary generates | `P` `Q` `R` `S` `U` `V` | **rich** |
| [`02-arithmetic.md`](02-arithmetic.md) — gates, adders, the detector | `Y` `E` `F` `G` `I` | **rich** |
| [`03-sequential.md`](03-sequential.md) — storage, registers, an accumulator | `J` `K` `L` | **rich** |
| [`04-machine.md`](04-machine.md) — headroom, terminals, memory, interconnect, decode | `H` `B` `C` `A` `T` | **rich** |
| [`05-algebra.md`](05-algebra.md) — reversibility, universality, nonlinearity, mixing, and what music wants from a base | `D` `M` `O` `AE` `AF` | **rich** |
| [`06-economics.md`](06-economics.md) — currencies: the mid rail, erasure, and what an implied receipt rests on | `N` `AB` `AC` `AD` `AG` `AH` | **rich** |
| [`07-negative.md`](07-negative.md) — every failed prediction, and every lying instrument | — | **rich** |
| [`08-limits.md`](08-limits.md) — what this project does not show | — | seeded |
| [`99-ledger.md`](99-ledger.md) — the complete record, generated | — | generated |

### Depth is declared and allowed to be low

Same vocabulary as the doctree: **rich** means the subject is stated in full here;
**seeded** means substantial content with named gaps; **stub** means the territory
is named, its owned sets are declared, and little else.

A stub is not a failure and not padding. It is an honest statement that the results
exist in the ledger and have not yet been synthesised here. **No result is lost by a
stub** — the ownership check guarantees every set has a home, and
[`99-ledger.md`](99-ledger.md) carries every prediction in full regardless.

**Every topic file is now rich**; only `08-limits.md` remains seeded, and
deliberately so — it is an index of limits stated elsewhere, and writing fresh prose
there would create a second place limits live.

Two files are where a reader coming cold should start. `05-algebra.md` is what
ternary uniquely offers. `07-negative.md` is every failed prediction and every
lying instrument — the load-bearing evidence that the ones which held are worth
anything.

---

## The record in one table

| | |
|---|---|
| prediction sets | 34 |
| registered predictions | 145 — **122 held, 23 failed** |
| measured but never registered | 29 |
| defect classes | 18, recurring 46 times |

The suite's check count is deliberately **not** repeated here — it lives in
[`../README.md`](../README.md), where `run-all.js` verifies it, and a second copy
would be a fifth occurrence of the very defect the citation rule guards against.
Every other number in this table is checked against the manifest by
`test/test-results.js`.

Every failed prediction is **kept**. Four of them produced the result that replaced
them, and one — `Z2` — produced the best circuit in the repository by failing.
[`07-negative.md`](07-negative.md) is where that argument is made.

---

## What this folder is not

It is **not** the authoritative record. [`FINDINGS.json`](../FINDINGS.json) is, and
[`99-ledger.md`](99-ledger.md) renders it. If this folder and the manifest disagree,
the manifest is right and the test suite should have caught it.

It is **not** a method document. [`../METHOD.md`](../METHOD.md) describes the
discovery loop, its failure catalogue, and what parallelises.

It is **not** forward-looking. [`../design/`](../design/) enumerates what has not
been built, and [`../design/12-roadmap.md`](../design/12-roadmap.md) commits to an
order for building it.
