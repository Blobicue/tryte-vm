<!-- kind: subsystem -->
# 07 — Memory, and why it is the machine

## Requirement

729 words of six trits, addressed −364 … +364, with address 0 at the centre. One
read and one write per machine step.

Checkably: write a tryte to an address, read it back from that address, and
confirm no other address moved.

## What the axioms force

Nothing new — memory inherits every constraint from
[`04-storage.md`](04-storage.md) and [`06-interconnect.md`](06-interconnect.md).
What it adds is scale, and scale changes which constraints matter.

- The **enable fan-out** problem from [`05-registers.md`](05-registers.md) becomes
  a 4,374-way fan-out, and this model charges nothing for it. Every number below
  is optimistic by an amount the model structurally cannot express. `DERIVED`
- `N4` at this width means **one mis-decoded address is `X`, silently**. A memory
  is 729 potential contenders on one bus. `MEASURED` for the axiom.
- `N7` means the whole array must be seeded. A 4,374-node seed is the largest
  initial state this project would ever have handed `solve()`, and nothing has
  tested whether that composes. `DERIVED`

## Options

| # | memory | mechanism | switches (storage only) | status |
|---|---|---|---|---|
| **A0** | full array of `S0` cells | 4,374 cells at 11 switches | **~48,100** | DERIVED from `04` |
| **A1** | full array of `S3` dynamic cells | needs `M1` | **~8,700** | PROPOSED |
| **A2** | reduced address space — 81 or 243 words | the ISA's 729 becomes an aspiration | ~5,300 / ~16,000 | PROPOSED |
| **A6** | **27 words — BUILT** | decoder + complement plane + buffered data + 162 cells + `tmux` read tree | **2,301 total, of which 519 is the address path** | MEASURED `C` |
| **A3** | memory held by the harness; only the **port** is built | the switch layer ends at the address decoder | **0** | PROPOSED |
| **A4** | ROM for program, RAM for data | program memory becomes a selector tree with no cells at all | ~half, plus a large tree | PROPOSED |
| **A5** | banked — a small fast array plus a harness-held backing store | the cache idea, applied to a model with no timing to justify it | small | PROPOSED |

And the address path, separately, because it is a different structure:

| # | addressing | mechanism | status |
|---|---|---|---|
| **D0** | 729-way one-hot decoder from 6 trits | tree of 3 → 9 → 27 → 81 → 243 → 729 | PROPOSED |
| **D1** | selector tree read, decoder-free | the read path *is* a 729-way mux; no one-hot needed | PROPOSED |
| **D2** | two-stage: decode 3 trits to 27 rows, 3 to 27 columns | the classic array, and it halves the decode | PROPOSED |

~~**D1 and D0 may be the same object.**~~ **They are not** — `B4`, and it took
counting rather than a phase. A `W`-way read mux has `(W-1)/2` internal nodes; a
write path needs `W` one-hot word selects, one per word. At 27 words that is 13
against 27, so the mux cannot supply them and `D0` survives in the write path
whatever `D1` does. The two share the MID detectors and nothing else — about **2%**
of the address path, against the "roughly halves" this file hoped for.

The consequence is not local. The address path was the term that dominates once
charge retention lands, this was the only structural saving anyone had identified
for it, and it is not there. **243 words stays outside the sweep budget for good**,
and with it the six-program configuration. `MEASURED`

## Interactions

This is the file that reorders the whole plan.

> **Memory is ~97% of the machine under `A0`.** 48,100 switches for storage
> against roughly 1,300 for the ALU, registers, decode and interconnect combined.
> The six-trit adder — three phases of work, two exhaustive sweeps, the best result
> in the repository — is **1.1%** of the total. `DERIVED`

Which means the highest-leverage decision in this entire folder is not the adder,
not the interconnect and not the sequencer. It is **whether `M1` charge retention
is admissible**, because A1 against A0 moves the machine by a factor of five and
nothing else moves it by more than a few percent.

- **[`03-model-options.md`](03-model-options.md)**: `M1` was listed fourth by blast
  radius. By leverage it is first.
- **[`04-storage.md`](04-storage.md)**: the per-cell choice is multiplied by 4,374
  here, which is the whole reason it matters.
- **[`10-integration.md`](10-integration.md)** carries the totals.

## What a measurement phase would register

1. **A 3-word × 6-trit array** — the smallest thing that has an address decoder,
   a shared read path and a write enable. Exhaustive over addresses and values.
   Everything that will go wrong at 729 words goes wrong at three.
2. **Whether a 4,374-node seed composes.** Predicted to work and predicted to be
   slow; the interesting number is how slow, since `solve()` is `O(devices)` per
   pass and this is 90× the largest network yet solved.
3. **D0 against D1 on switches** at width 6 — the decoder-versus-mux question,
   which is the same shape as the collision in `06`.
4. **A1's cost under a patched solver**, which is the cheapest possible read on
   whether `M1` is worth its demolition.

## What is missing from this list

Content-addressable schemes. Memory that stores trits as something other than
levels. Any recognition that a real 729-word memory would be laid out in two
dimensions with shared lines, which this flat device-list model cannot represent
at all — so **every area number in this file is a lower bound of a lower bound.**
