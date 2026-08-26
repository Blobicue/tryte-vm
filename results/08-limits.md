<!-- kind: results-topic -->
# 08 — What this project does not show

**Owns no sets.** An *index of limits already stated elsewhere*, with owners.

Deliberately not new prose. Every limit below is stated in the tool that carries it
or the axiom that forces it; restating them in fresh words here would create a
second place limits live, and that place would drift. This file exists so that a
reader can find them all at once, and each row says where the real statement is.

---

## What is established

### The model's four stated limits

`src/device.js` states them and calls the first the largest.

| # | limit | consequence |
|---|---|---|
| 1 | **the middle rail is free** | priced in `N3`/`N4`; 99.1% of the built memory's taps are forced, and the model cannot settle the assumption from the inside |
| 2 | **there is no level restoration** | `Z` priced it; every switch count is quoted under it |
| 3 | **there are no noise margins** | nothing here is evidence about analogue behaviour |
| 4 | **multi-threshold devices count as one switch each** | every cost number inherits this |

### The boundary the method itself hit

**Exhaustive sweeping stops working at machine scale.** `H2` measured the solver as
linear — 50,000 devices solve in about 70 ms — but a full 531,441-pair sweep fits in
an hour only to roughly 4,806 devices, and a machine is larger than that.

So the subject outgrew the method. What replaces exhaustion is a **stated
verification contract** — naming which dimensions are exhaustive and which are
sampled, inside the claim — not a quieter version of the same sentence.
[`../METHOD.md`](../METHOD.md) owns this; [`../design/12-roadmap.md`](../design/12-roadmap.md)
had to choose a contract.

### The explicit not-claiming blocks

Each was registered *before* its run, so the limit is part of the prediction rather
than a caveat added afterwards.

| set | does not claim |
|---|---|
| `D` | anything about cryptographic security — 729 states is a toy, and a toy cannot be evidence about an adversary |
| `M` | that reversible-universal is quantum (superposition and phase are untouched), or that universal is cheap |
| `O` | that binary nonlinearity is expensive in general; the claim is about **one-control** conditionals only |
| `N` | that the free-mid-rail assumption is true or false — only how much rests on it |
| `A` | that the interconnect pick is decided; `A4` deferred it to sequencing on purpose |

### Standing gaps in the record

- **No control arm.** Whether the pre-registration protocol *caused* any result is
  untested; the finite domain and the reference implementation may have done the work.
- **Wiring and power are unrepresented.** In a real design at this device count they
  would dominate area.
- **The machine is designed, not assembled.** Storage, registers, an accumulator, a
  27-word addressed memory and both interconnect options exist; decode, sequencing and
  the whole-machine assembly do not.
- **The target machine is not available.** 81 words under charge retention is the one
  configuration that both fits the sweep budget and runs an existing program — and it
  requires a model change that is a person's decision, not a measurement.

---

## How it was established

By collection. Sources: `src/device.js` for the four limits, `H2` for the sweep
boundary, the registration blocks of `D`, `M`, `O`, `N` and `A` for the not-claiming
statements, and [`../design/11-open.md`](../design/11-open.md) for the standing gaps.

---

## What it does not show

That the list is complete. Limits enter this project by being noticed, and the ones
that have not been noticed are by definition absent. The four model limits are
enumerated in the source and can be trusted as a closed set; nothing else here can.

---

## Owned sets

None.
