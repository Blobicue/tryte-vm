---
name: unbuilt-machine
description: Storage, registers, an accumulator and a 27-word addressed memory built at switch level. Interconnect, decode and sequencing enumerated in design/ and built nowhere.
type: reference
last_updated: 2026-08-25
---

# The machine, part-built

The datapath arithmetic exists. A **computer** needs storage, a register file,
addressed memory, instruction decode and sequencing, and none of those exists at
switch level. Owner: [`design/`](../../../../design/), fourteen documents — of which
[`12-roadmap.md`](../../../../design/12-roadmap.md) is the one that commits to an
order rather than enumerating a space.

## What is established

- **A trit can be stored, and three of the four obvious routes are forbidden.** A
  cross-coupled pair holds all three trits when seeded and goes unresolved from
  cold (`N7`). Writing from an input fails (`T5`). Writing by overpowering the loop
  fails (`N4`), because this model has no strength. **Opening the feedback loop
  works** - all three trits, 19 switches per cell. All measured.
- **Memory is the machine.** 729 words of six trits is roughly 48,000 switches
  against about 3,700 for everything else - about **93%**. The six-trit adder,
  three phases of work and the best result in the project, is about **1%**.
- **So the storage cell is the highest-leverage decision in the project** — and the
  H set measured it at **eleven times**, not the five the design phase estimated.
  Under charge retention a trit cell is **one switch**, taking the 729-word memory
  from 48,114 to **4,374**. And retention changes *nothing* in the existing corpus:
  zero differing node values across every gate, every input, and the adder swept.
- **Which machine is worth building has an answer, and it is narrow.** Two
  ladders — what fits the sweep budget, and which programs fit in how much memory —
  intersect in **exactly one configuration: 81 words under charge retention**, at
  roughly 3,562 switches. It runs `countdown`, `threeway` and `kleene` as placed.
  A 27-word machine fits the budget and runs **none** of the eight programs.
- **So the retention decision and the memory-scope decision are the same
  decision**, which the design phase had ranked as two.
- **Under retention the bottleneck moves rather than disappearing.** Storage stops
  dominating and the **address path** becomes the largest single term — at 243
  words it is 4,307 against storage's 1,458. Retention relocates the cost from a
  part with a known fix to a part nobody has built.
- **The sequencer may not be made of switches.** Under seeded semantics the step
  boundary lives in the harness, which means "a computer built of simulated ternary
  transistors" would mean a *datapath* built of them. That concession is written
  down rather than left to be discovered.

- **Addressed memory exists at 27 words.** 2,301 switches: a decoder (105), a
  complement plane, buffered write data, 162 loop-breaking cells and a `tmux` read
  tree (312). A write lands in its word and disturbs none of the other 26, at every
  pass of the solve, and write-then-read round trips through the address path work.
  The address path is **519**, against a formula that said 603 and was wrong three
  ways at once. `C`
- **But the array does not start on its own.** Every `hold` gate is a decoder
  output — computed, `Z` on pass one, unknown conduction — so by `N6` all 26
  unaddressed words go to `X` on every write. The cells hold perfectly when `hold`
  is a primary input and not at all when it is a decoder output. Solving the
  control cone first fixes it, which makes the seeding discipline a **requirement
  of the design** rather than a risk to it.

## Sub-topics (the rabbit hole)

- Ten storage-cell options, including one that costs zero switches by conceding
- Selector trees versus a decoded bus, and where contention lives
- Whether the address decoder and the read multiplexer are one structure
- Whether an ISA renumbering could make decode disappear entirely

## Open questions

- ~~Can a 50,000-device machine be simulated at all?~~ **Yes** (H set). But it
  cannot be exhaustively swept, so the machine is the first subject here that sits
  outside the method used on everything else.
- Does the seeded discipline compose across 4,374 state nodes? One missing seed
  poisons whatever it gates, and nothing would catch it but a wrong answer.
- ~~Do a register read and write in the same solve race?~~ **Yes** (`J4`). The
  cell is a transparent latch — the write holds its feedback open — so a read
  during a write sees the new value. Master-slave is required and the register file
  doubles.
- Is `T5` going to bite a third time? Three axioms have surfaced this way already.
- **Can a stored value drive a selector's source *terminal*, not just its gate?**
  Everything built so far feeds gates. `I0`, the read mux and the whole address
  path need the other thing, and it is untested. This is the cheapest experiment
  in the project and four of the six remaining phases assume its answer.
- **Are the address decoder and the read multiplexer one structure or two?** Now
  the highest-leverage unbuilt question, because it governs the term that
  dominates once retention lands.

## Related pillars

- [05-axioms.md](05-axioms.md) - which axioms constrain this, and how hard
- [08-cost-currencies.md](08-cost-currencies.md) - the currencies with no instrument
- [01-instruction-set.md](01-instruction-set.md) - what the machine must decode

## Depth status

**Seeded** (2026-08-25). No longer a stub. Built and checked at switch level: a
six-trit register (`J`), the master-slave register `J4` proved was required (`K`),
and an **accumulator** that performs `A <- A + B` in a two-phase step and holds
its own state between steps (`L`) — 672 switches, correct on every one of the 729
accumulator values, and never once reading the value it was in the middle of
replacing.

Still missing, and why this is not `rich`: interconnect, instruction decode and
sequencing. There is a datapath fragment and an addressed memory, not a machine —
and the memory is built at 27 words, which runs none of the eight programs. The
target size needs the charge-retention decision, which is a person's.
