# tryte-vm — a balanced ternary computer emulator

A working emulator for a computer that counts in **three states instead of two**.
Core arithmetic, an instruction set, a virtual machine, an assembler, and demo
programs. 117 tests, all passing, including exhaustive sweeps over the machine's
entire value space.

```bash
npm test                      # 117 checks
node src/run.js programs/multiply.tasm 7 5
```

---

## The idea, without the jargon

A normal computer digit is a light switch: **off or on**, 0 or 1. To write a
negative number you have to sacrifice one switch to mean "this whole thing is
negative", and then bolt on machinery to handle it.

A balanced ternary digit — a **trit** — is a **balance scale**. It can tip left,
sit level, or tip right: **−1, 0, +1**. Weights go on *either* pan, so negative
numbers aren't a special case that needs its own rules. They're just weights on
the other side.

Four things fall out of that, and they're the whole reason this number system is
interesting. All four are asserted as tests, not claimed in prose:

| Property | What it means |
|---|---|
| **Negation is flipping every digit** | To get −5 from 5, tip every scale the other way. No two's complement. |
| **There is no sign bit** | `5` is `000+--` and `−5` is `000-++` — an exact mirror. No digit is wasted on sign. |
| **Subtraction is not a separate operation** | `a − b` is just `a + (−b)`, and negation is free. One adder does both. |
| **Rounding is free** | Chopping off low digits lands on the *nearest* value automatically. No rounding logic anywhere. |

That last one isn't a curiosity. The multiplication program in `programs/`
extracts one digit at a time using `v − 3 × (v >> 1)`, which only works because
the shift rounds. Break the rounding and the multiply demo fails — the test suite
demonstrates exactly that.

---

## The instruction with no binary equivalent

Every ordinary CPU compares two numbers and gets one bit back: *was it true?*
Asking "is this negative, zero, or positive?" therefore takes at least two tests.

This machine has **`BR3`** — one test, **three destinations**:

```
        BR3   sgn          ; look at the accumulator once
sgn:    .table neg, zero, pos
```

Negative goes one way, zero goes another, positive goes a third. No flags
register, no chain of compares. It's the instruction a three-state machine gets
for free and a two-state machine cannot have, and it's tested against all 729
possible accumulator values.

---

## Where this came from

This project is the unfinished half of a Google AI Mode conversation
(`docs/origin/`). That conversation designed a "tryte ALU" and offered three
separate times to *"implement balanced ternary arithmetic, treating trits as
numerical values"* — and never did. Every artifact it actually produced was
ordinary binary logic wearing ternary vocabulary; its own Verilog encoded the
"trit" as two binary wires.

`docs/origin/REPORT.md` is the audit of that conversation: every piece of its
logic is correct, and its framing oversells a conventional ALU. **This project is
the part it kept promising.** Here the trits are real — data, arithmetic,
branching and all.

The one idea worth rescuing from it was the self-reconfiguring unit, which
appears here as **`TGATE`**: a control tryte whose six trits each select what
that slice of the machine does (negate / min / max). One control value names one
of 729 distinct circuits. On binary data with AND/OR/NOT that idea is just an
opcode driving a multiplexer; on ternary data it is a genuine three-way choice
per position.

**Prior art:** *Setun*, built in 1958 at Moscow State University under Sergei
Sobolev and Nikolay Brusentsov, was the first modern ternary computer and used
this same balanced ternary system, with digits −1, 0, +1. It was built from
ferrite cores and diodes; roughly 50 machines were produced between 1959 and
1965 and used for teaching at more than thirty universities. This emulator is
inspired by that lineage, not a reimplementation of it.

---

## Machine summary

| | |
|---|---|
| Trit | −1, 0, +1 |
| Tryte | 6 trits — 729 values, **−364 … +364** |
| Memory | 729 cells, addressed **−364 … +364**; address 0 is the *centre* |
| Registers | `A` accumulator, `C` gate control, `PC` |
| Instruction | two cells: opcode, operand |
| Instructions | 19 (`src/isa.js`) |

## Layout

```
src/ternary.js     trit/tryte arithmetic and the tritwise gates
src/isa.js         the 19 opcodes
src/vm.js          fetch, decode, execute
src/assembler.js   text -> trytes, two passes, labels and directives
src/run.js         CLI runner
programs/          threeway.tasm, multiply.tasm, tgate.tasm
test/              test-core.js (27), test-vm.js (36), test-page.js (26),
                   test-style.js (28), run-all.js
build/             inlines src/ into a single interactive HTML page
docs/tryte-vm.html the built page
docs/origin/       the source conversation, its audit, and its code artifacts
```

## Testing standard

The suite checks itself before it checks anything else, then sweeps exhaustively
where exhaustive is possible: all 729 values for representation and sign, all
**531,441** tryte pairs for add, subtract, multiply and each tritwise gate, all
729 accumulator values for the three-way branch, and all 1,521 in-range operand
pairs for the multiplication program.

Two further layers exist because inspection alone proved unreliable here:

- **The interactive page is tested, not eyeballed.** `test-page.js` runs the published
  page's own script against a small DOM shim and drives the controls — pressing Run
  really runs the program, Negate really negates, the trit strips really render the
  value they claim. 26 checks.
- **The build cannot ship a divergence.** `build-artifact.js` inlines `src/` into the
  page, then re-runs the demo programs through the *bundled* copy and compares against
  the modules. If the page ever drifts from the tested code, the build fails.
- **Both themes are checked arithmetically.** `test-style.js` computes WCAG contrast
  for every text/background pair in light and dark. This exists because three real
  defects shipped past visual inspection: a Cyrillic character inside a dark-mode hex
  literal, and two pairs below AA.

The whole suite has also been **mutation-tested**: deliberately breaking the shift
rounding, the three-way branch, the gate control, and a dark-theme colour each produced
immediate, specific failures. Tests that cannot fail are worse than no tests.
