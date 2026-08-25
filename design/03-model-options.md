<!-- kind: reference -->
# 03 — Seven ways the device model could change

Storage works without changing anything ([`02-forbidden.md`](02-forbidden.md)), so
none of these is *required*. They are here because several unlock things the
current model cannot express at all, and because the cost of each should be on the
table before anyone commits to a machine shaped by the model's limits.

Ordered by how much of the axiom layer they disturb.

---

## The options

| # | change | unlocks | breaks | status |
|---|---|---|---|---|
| **M0** | nothing. Break loops for writes, accept seeded power-on | storage, registers, sequencing | nothing | MEASURED |
| **M1** | **charge retention** — an undriven node keeps its last value instead of floating | dynamic storage at 1–2 switches per trit; the whole memory array collapses in cost | `N5` (no rail is `Z`) stops being true; `Z` becomes a memory rather than an absence | PROPOSED |
| **M2** | **drive-enable as a device property** — a device can be explicitly off rather than merely non-conducting | clean tri-state buses without one-hot discipline | probably nothing; it may be expressible already as a gated pass | PROPOSED |
| **M3** | **two-level strength** — weak and strong drivers, contention resolved by strength | ratioed writes, pull-ups, and the `vmid` divider itself | `N3`, `N4`, `T5`; the pinned mutation sets; the axiom layer needs re-proving | PROPOSED |
| **M4** | **full strength lattice** — driven / charged / weak / high-impedance, as IRSIM has | everything M1–M3 do, and a genuinely standard switch-level semantics | the same, and more of it | PROPOSED |
| **M5** | **an explicit phase index** — nodes carry a value per phase, and the solver iterates phases | clocked semantics without seeding; two-phase non-overlapping discipline | nothing in the axioms, but `solve()` changes shape and every existing test's calling convention with it | PROPOSED |
| **M6** | **capacitance and delay** — arrival times per node | the one cost this model provably cannot show: ripple-carry delay | the model stops being switch-level and starts being timing simulation, which is a different project | PROPOSED |

---

## What each is really for

**M0** is the honest baseline and the plan in this folder assumes it. Its cost is
that the machine cannot model its own power-on, and that `vmid` remains free —
so every area number stays optimistic by an amount [`Z1`](../FINDINGS.json) already
bounded at twelve switches for a `MIN` datapath.

**M1 (charge retention)** is the most interesting and the most under-considered.
Real MOS nodes hold their charge; that is how dynamic logic and DRAM work. If `Z`
meant *"retains its last value"* rather than *"connected to nothing"*, a trit cell
becomes a pass gate and a capacitance — one or two switches instead of nineteen —
and the 729-word memory in [`07-memory.md`](07-memory.md) drops by roughly an
order of magnitude. It is also the change most likely to invalidate existing
results silently, because `Z` appears in gate internals everywhere and would
acquire a meaning nobody wrote those gates expecting.

**M3 (strength)** is what a serious switch-level model has, and it is the only
option that makes `Z1`'s central question answerable inside the model instead of
outside it. It is also the largest single act of demolition available: `T5` is
what makes the mid rail unbuildable, and `T5` is a consequence of the contention
rule M3 replaces.

**M5 (phases)** deserves attention because it competes directly with the seeded
discipline in [`09-sequencing.md`](09-sequencing.md), and it is the difference
between *"the machine's clock is the harness"* and *"the machine has a clock"*.

**M6** is out of scope and listed so that nobody proposes it as a small change.

---

## What a measurement phase would register

Each of these is a phase in its own right, and none should be entered without a
registered space of its own. The cheap ones first:

- **M1 feasibility**: does making `Z` retain break any existing gate? The answer is
  checkable in minutes by re-running the full suite against a patched solver, and
  the interesting outcome is *which* of the 634 checks notice.
- **M2 redundancy**: is drive-enable already expressible with a gated pass device?
  If yes, M2 is not a model change and should be deleted from this table.
- **M3 blast radius**: how many of the eighteen axioms survive two-level strength
  verbatim? Derivable by inspection, and worth knowing before anyone argues for it.

---

## What is missing from this list

Options nobody here has thought of yet, and specifically: anything that would let
the model represent **wire** as something other than a perfect equipotential node,
and anything that would let a design be **hierarchical** rather than a flat device
list. Both are ordinary in real tools and absent here, and both would change what
"cost" means in [`01-currencies.md`](01-currencies.md).
