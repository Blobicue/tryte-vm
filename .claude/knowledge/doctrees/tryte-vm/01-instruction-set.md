---
name: instruction-set
description: 25 opcodes in src/isa.js. Three-way branching with no flags register, and truth tables as instruction operands.
type: reference
last_updated: 2026-08-25
---

# The instruction set

25 opcodes, two cells each (opcode, operand). Registers: `A` accumulator, `C`
gate/table control, `PC`. Owner: `src/isa.js`, `src/vm.js`.

## What is established

- **`BR3` is one test with three destinations.** A trit-valued comparison lands in
  one of three places directly, and the machine carries no flags register at all.
  Measured benefit: about half an instruction per decision point, and nothing when
  the decision is genuinely binary (`F-BRANCH-BENEFIT`).
- **`TOP` takes a truth table as its operand** - the table is data, not a fixed
  operation. `TOPC` extends it with a carry, at which point addition is one
  particular 27-cell table (`F-ADD-IS-A-TABLE`).
- **The indirect trio** `LOADX` / `STOREX` / `JMPX` is what makes an interpreter
  writable in this assembly at all; see [02-self-hosting.md](02-self-hosting.md).
- The assembler refuses labels that collide with trit-literal syntax, and refuses
  `.fold` over a table shorter than nine cells. Both are antibodies from
  [11-failure-catalogue.md](11-failure-catalogue.md).

## Sub-topics (the rabbit hole)

- Which opcodes are load-bearing and which are convenience
- Whether 25 opcodes fitting in three trits is deliberate or accidental
- The `.fold` directive, and folding a chain of tables into one
- Encoding: could the opcode's trits *be* the control lines? See `design/08-decode.md`

## Open questions

- The ISA was designed before there was a device layer. Which of its choices would
  a hardware-first design have made differently?
- No opcode has ever been removed. Is any of them dead?
- What would the cheapest ISA that still runs everything in `programs/` look like?

## Related pillars

- [02-self-hosting.md](02-self-hosting.md) - what the ISA must support to host itself
- [03-vocabulary-reach.md](03-vocabulary-reach.md) - what these opcodes generate
- [09-unbuilt-machine.md](09-unbuilt-machine.md) - decode, downstream of encoding

## Depth status

**Seeded** (2026-08-25). Every opcode is exercised in `test/test-vm.js`; the
design rationale for most of them is written down nowhere.
