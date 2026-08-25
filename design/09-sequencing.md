<!-- kind: subsystem -->
# 09 — Sequencing: what a clock is in a model with no time

The hardest file here, because the model has already proved it cannot show the one
thing sequencing is usually about.

## Requirement

Advance the machine one instruction: fetch from `PC`, decode, execute, write back,
update `PC`. Repeatedly, deterministically, with the state at the end of one step
being the state at the start of the next.

Checkably: run a program in `programs/` on the switch-level machine and get the
same answer the JavaScript emulator gives, instruction for instruction.

## What the axioms force

- **There is no time.** Not "time is abstracted" — the model has no representation
  of it, and `Y2` proved the consequence exhaustively: a six-trit ripple adder
  settles in exactly seven passes whether the carry travels nowhere or all six
  positions. A stopwatch that reads the same for a sprint and a marathon.
  `MEASURED`
- **What the model does have is dependency depth**, and `E4` showed it can even
  vary with data. That is the nearest thing to a clock period available, and it is
  a property of the *network*, not of a signal. `MEASURED`
- `N7` — the machine cannot start itself. The first state must be given.
  `MEASURED`
- `N8` — `solve()` already accepts an initial state, and that is not a test seam:
  the fixed point is not unique and the seed is part of the semantics. **The
  mechanism sequencing needs already exists and was built for another reason.**
  `MEASURED`

## Options

| # | sequencing | where the step boundary lives | needs | status |
|---|---|---|---|---|
| **Q0** | **harness as clock** — one `solve()` per step, previous state seeded in | outside the circuit | nothing | PROPOSED |
| **Q1** | two-phase non-overlapping — two solves per step with different enables | outside, twice per step | nothing | PROPOSED |
| **Q2** | phase index inside the model — nodes carry a value per phase | inside the solver | `M5` | PROPOSED |
| **Q3** | self-timed handshake — request and acknowledge between stages | inside the circuit | storage plus loops that must settle | PROPOSED |
| **Q4** | unrolled — a bounded program becomes one combinational network, no state at all | nowhere; there are no steps | nothing | PROPOSED |
| **Q5** | microcoded — a state register plus a next-state table, stepped by `Q0` | inside for the state, outside for the step | `04`, `08` | PROPOSED |

**Q0 is the honest baseline and it concedes something.** If the step boundary
lives in the harness, then the machine is a combinational function and the
*sequencer* is JavaScript. That is a real concession and it should be written down
rather than discovered later: under `Q0`, "a computer built of simulated ternary
transistors" means a **datapath** built of them, driven by a loop that is not.

**Q1 is what actually makes writes safe.** Two-phase non-overlapping clocking
exists precisely so a value being written cannot race the value being read, and
the loop-breaking write from [`04-storage.md`](04-storage.md) is already a
two-phase structure — `we` and `hold` are the two phases. So `Q1` may not be an
option so much as a description of what the storage cell already requires.
`DERIVED`

**Q3 is the one that would make this a real machine** and it is also the one most
likely to be impossible here: a handshake is a feedback loop, and `N7` says a
feedback loop from a cold start lands on unresolved. Whether a *driven* handshake
settles is untested and is the most interesting single experiment in this folder.

**Q4 deserves more respect than it will get.** For a bounded program it is
genuinely correct, it needs no storage at all, and it would let the whole machine
be verified exhaustively the way everything else here has been. It fails only
because programs are not bounded — but `programs/multiply.tasm` is.

## Interactions

- **[`04-storage.md`](04-storage.md)**: `Q1` and the cell's `we`/`hold` pair are
  the same idea, which suggests the storage design has already chosen the
  sequencing without saying so.
- **[`05-registers.md`](05-registers.md)**: whether `R4` master–slave is needed
  depends entirely on `Q0` versus `Q1`. Under a single seeded solve, a read and a
  write in the same step may simply not race.
- **[`06-interconnect.md`](06-interconnect.md)**: `N6` requires bus enables to be
  settled before the bus resolves, which is a dependency-stage ordering constraint
  that only `Q1` and `Q2` can state.
- **[`03-model-options.md`](03-model-options.md)**: `M5` exists for `Q2` and for
  nothing else.

## What a measurement phase would register

1. **`Q0` end-to-end on the smallest program that has a loop** — `countdown.tasm`
   — with the switch-level datapath and a seeded state dictionary, checked
   instruction for instruction against the emulator. This is the experiment that
   turns a pile of subsystems into a machine.
2. **Whether a read and a write to the same register in one solve race.**
   Predicted under `Q0`: no, the read sees the seeded value deterministically. If
   that holds, `R4` is unnecessary and the register file halves.
3. **Whether a driven handshake settles** — the `Q3` question, and the one whose
   answer nobody can guess from the axioms.
4. **The dependency-stage cost of one instruction**, which is the machine's
   "clock period" in the only currency available, and which nothing has ever
   measured for anything larger than an adder.

## What is missing from this list

Pipelining, which needs a notion of *simultaneous* that this model lacks.
Interrupts. Any treatment of what happens when a step's solve fails to settle —
the model throws, and a machine whose clock can throw is a machine with a halt
condition nobody has designed.
