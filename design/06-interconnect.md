<!-- kind: subsystem -->
# 06 — Interconnect: how values move, and where contention lives

## Requirement

Get a tryte from any source — a register, memory, the adder's output, an
immediate — to any destination, one at a time, without the model declaring the
result unknown.

Checkably: for every (source, destination) pair and every tryte value, the
destination receives exactly the source's value and nothing else resolves to `X`.

## What the axioms force

This is the subsystem the axioms constrain hardest, and it is the reason a bus is
not the obvious answer here that it is in silicon.

- `N4` — **two sources reaching one node is unknown, not a fight.** A shared bus
  works only if exactly one driver is ever enabled. There is no arbitration to
  fall back on and no strength to break a tie. `MEASURED`
- `N6` — an *unknown* enable is as bad as a wrong one. A driver whose enable has
  not resolved yet poisons the bus for that pass, so bus enables must be settled
  before the bus is read. That is a sequencing constraint hiding in a wiring
  decision. `MEASURED`
- `T2` — every gate built so far has exactly one rail definitely connected to its
  output. A bus is the first structure in this project that could violate that by
  construction rather than by bug. `MEASURED`
- `D5` — but a value *read as a gate* costs nothing and cannot contend. Routing
  by gating instead of by driving sidesteps the whole problem. `MEASURED`

## Options

| # | scheme | mechanism | cost shape | contention risk | status |
|---|---|---|---|---|---|
| **I0** | **selector tree per destination** | each destination has a mux choosing among sources — the structure already built and proved | grows with sources × destinations × 6 trits | **none by construction** | PROPOSED |
| **I1** | one-hot shared bus | every source gated onto a common node; exactly one enable high | grows with sources + destinations | high — one bad enable is `X` | PROPOSED |
| **I2** | decoded one-hot bus | as I1, but enables come from a decoder that cannot assert two | same as I1 plus the decoder | low — the decoder enforces the invariant | PROPOSED |
| **I3** | point-to-point, no sharing | a dedicated path per (source, destination) | worst area, best isolation | none | PROPOSED |
| **I4** | two buses — one read, one write | halves the mux width at each end | between I1 and I3 | as I1 | PROPOSED |
| **I5** | tri-state with an explicit off state | needs `M2` | as I1 | none, if `M2` is real | PROPOSED |
| **I6** | no interconnect — the datapath is one big combinational function of the seed | `S7`/`R3` taken to its conclusion | zero wiring, maximal logic | none | PROPOSED |

**~~I0 is the one this project is set up to win with.~~ Not on cost, and the axis
was the wrong one.** Set `A` built both: `I0` grows as **destinations x sources**,
`I2` as **sources alone**, so the destination count decides it. At the machine's
4 sources and 3 destinations, `I2` is **3.8x cheaper** — 62 against 234 — and `I0`
wins in exactly one corner of the surface, one destination with three sources.
`MEASURED`

What `I0` does buy is measured too, and it is not what this file said either.
Its safety is **not** that nothing is shared: a selector's output is shared between
its legs. It is that every leg is gated by the *same select trit*, and one trit
cannot be LOW and HIGH at once — so exclusion is **structural**. `I2` needs `S`
separate enables to be one-hot, which is an **invariant something must uphold every
step**. That is the real trade, and it is a sequencing cost rather than a switch
cost.

The original text follows.

**I0 is the one this project is set up to win with.** A selector tree is already
built, proved exhaustively, and — critically — cannot contend, because `T2` holds
for it by construction. It trades area for the complete absence of the failure
mode `N4` describes. The cost grows as sources × destinations, which for three
registers, a memory port and an ALU output is small; it would be ruinous at scale
and this machine is not at scale.

**I2 is what real machines do**, and the interesting question is whether the
decoder that enforces one-hot is cheaper than the mux tree that makes one-hot
unnecessary. ~~That is a clean, registrable comparison and nobody has run it.~~
**Run — set `A`. The decoder is cheaper, by 3.8x at this machine's counts.**

**I1 should probably be rejected outright** and is listed to make the rejection
explicit: it has a failure mode the model turns into silent `X` rather than a
detectable error, and this repository has been bitten three times by results that
looked clean because a defect resolved to something plausible.

## Interactions

- **[`05-registers.md`](05-registers.md)**: ~~I0 makes register reads free (they
  gate the mux)~~ — **they do not gate it, they pass through it.** `B` measured a
  stored value driving a selector's source TERMINAL, which is what `I0` actually
  needs, and it is the reason `I0` must be `tmux` rather than the cheaper `dmux`.
  Reads are not free; they are a pass-network read at 4 switches a node. `I1` makes
  them drivers onto a shared node, which is the contention case. `MEASURED`
- **[`09-sequencing.md`](09-sequencing.md)**: `N6` means bus enables must be
  settled before the bus resolves, which is a dependency-stage cost, not a switch
  cost. Under I0 that cost disappears because there is nothing to enable.
- **[`07-memory.md`](07-memory.md)**: a memory read is the widest interconnect in
  the machine — 729 possible sources into one destination. ~~I0 at that width is a
  729-way selector, which is exactly the address decoder, so the two subsystems may
  be the same structure seen twice.~~ **They are not** — `B4` settled it by
  counting: a `W`-way mux has `(W-1)/2` internal nodes and a write path needs `W`
  one-hot selects. `MEASURED`
- **[`01-currencies.md`](01-currencies.md)**: I0 is the option that trades the
  `switches` currency for the *absence of a risk*, which none of the six
  currencies can express.

## What a measurement phase would register

1. **I0 against I2 on switches**, at the machine's actual source and destination
   counts. Predicted: I0 wins at this scale and loses badly by eight sources.
   Registering the crossover point is the useful output.
2. **Whether a one-hot bus with a correct decoder ever produces `X`** — swept over
   every enable pattern the decoder can emit. This is the check that decides
   whether I2 is safe or merely usually safe.
3. **What a *wrong* enable pattern does**, deliberately: two drivers, and confirm
   the model reports `X` rather than something plausible. A failure mode that
   announces itself is worth switches.
4. **Whether a register value can drive a selector terminal** — the open question
   from [`05-registers.md`](05-registers.md), which I0 depends on completely.

## What is missing from this list

Serial interconnect: move a tryte one trit at a time and pay in steps instead of
wires. Time-multiplexed buses. Any scheme where the interconnect is also the
storage, which is what a shift register really is. And the possibility that the
right answer is no interconnect at all because the machine is small enough to
inline — which is I6, and which nobody has costed.
