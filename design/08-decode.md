<!-- kind: subsystem -->
# 08 — Instruction decode

## Requirement

Turn an opcode into the control lines the rest of the machine needs: which
register is written, which source drives the interconnect, whether memory is read
or written, whether the `PC` takes the branch. Twenty-five opcodes today
(`src/isa.js`), which fits in three trits with two values to spare.

Checkably: for every opcode, every control line takes its intended value, and no
line is ever `X` or `Z`.

## What the axioms force

Almost nothing, and that is the point. Decode is the one subsystem this project
has already solved without knowing it.

- A control line is a **function of the opcode**, and this repository has proved
  that any three-input trit function is a tree of thirteen selectors — exhaustively,
  at two different selector designs. `MEASURED`
- `T1` guarantees a selector tree's output is always a level, so no control line
  can float. `MEASURED`
- `T3` guarantees the trees compose, so decode can feed the datapath directly.
  `MEASURED`
- The decoded-selector result applies directly: pay for the opcode's MID detector
  **once**, not once per control line. With a dozen control lines that is eleven
  detectors saved. `DERIVED`

## Options

| # | decode | mechanism | switches | status |
|---|---|---|---|---|
| **C0** | one selector tree per control line, raw select | 13 selectors × 4 switches × lines | ~52 per line | DERIVED |
| **C1** | one tree per control line, **decoded** select, detectors shared across all lines | 13 × 3 per line, plus 3 detectors total | **~39 per line + 12** | DERIVED |
| **C2** | one tree emitting a packed control **tryte**, unpacked positionally | one tree, then wiring | ~39 + unpack | PROPOSED |
| **C3** | a `TOPC`-style table read from memory — microcode | the control store is memory, and memory is `07` | ~0 logic, large memory | PROPOSED |
| **C4** | hardwired per-opcode: a one-hot opcode decoder driving OR-planes | the classic PLA | ~decoder + plane | PROPOSED |
| **C5** | no decode — the ISA is changed so the opcode's trits *are* the control lines | a design change upstream in the ISA, not the circuit | **~0** | PROPOSED |

**C1 is the default and it is nearly free.** At twelve control lines that is about
480 switches — comparable to the adder, and 1% of the memory. Decode is not where
this machine's cost is.

**C5 is the one worth arguing about.** The ISA was designed before there was a
device layer, and its opcodes are arbitrary integers. If the opcode's three trits
were *chosen* so that each trit position directly drives a control line, decode
disappears entirely. That is a real technique, it costs ISA readability, and it is
the only option here that changes something outside this folder.

**C3 folds decode into memory**, which given [`07-memory.md`](07-memory.md)'s
finding that memory is 97% of the machine is almost certainly the wrong trade — it
moves work from the 1% into the 97%.

## Interactions

- **[`06-interconnect.md`](06-interconnect.md)**: under `I2` the control lines
  must be one-hot-safe, and a decoder that cannot assert two is exactly what `C4`
  produces. Under `I0` no such guarantee is needed. The interconnect choice
  changes what decode must promise.
- **[`09-sequencing.md`](09-sequencing.md)**: if the machine is microcoded, decode
  and sequencing are one table, and `C3` stops looking wasteful.
- **`src/isa.js`**: `C5` requires renumbering the opcodes, which invalidates every
  assembled program in `programs/` unless the assembler absorbs it.

## What a measurement phase would register

1. **C1 exhaustively** over all 27 three-trit opcodes for a representative set of
   control lines, checking no line is ever `X` or `Z`.
2. **C0 against C1 on switches** at twelve lines — predicted ~624 against ~480,
   a 23% saving, which is `DERIVED` and should be run.
3. **How many control lines the machine actually needs**, which nobody has
   counted. Every cost in this file is per-line and the line count is a guess.
4. **Whether `C5` is achievable** — an assignment of 25 opcodes to three trits
   such that control lines fall out positionally. That is a search, it is small,
   and it may simply have no solution.

## What is missing from this list

Decode that is partly done by the assembler at build time. Two-level decode with
a shared first stage. And any recognition that the ISA's 25 opcodes were chosen
for a machine with no hardware, and that the right decode design might be to
change the ISA — which is a bigger and more interesting question than any option
in the table above.
