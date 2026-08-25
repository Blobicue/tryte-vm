---
name: unbuilt-machine
description: Storage, registers, interconnect, memory, decode and sequencing. Designed and enumerated in design/, built nowhere.
type: reference
last_updated: 2026-08-25
---

# The unbuilt machine

The datapath arithmetic exists. A **computer** needs storage, a register file,
addressed memory, instruction decode and sequencing, and none of those exists at
switch level. Owner: [`design/`](../../../../design/), twelve documents.

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
- **The sequencer may not be made of switches.** Under seeded semantics the step
  boundary lives in the harness, which means "a computer built of simulated ternary
  transistors" would mean a *datapath* built of them. That concession is written
  down rather than left to be discovered.

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

Still missing, and why this is not `rich`: interconnect, addressed memory,
instruction decode and sequencing. There is a datapath fragment, not a machine.
