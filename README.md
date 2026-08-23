# tryte-vm — a balanced ternary computer emulator

A working emulator for a computer that counts in **three states instead of two**.
Core arithmetic, an instruction set, a virtual machine, an assembler, and demo
programs. 210 tests, all passing, including exhaustive sweeps over the machine's
entire value space.

```bash
npm test                      # 210 checks
node src/run.js programs/multiply.tasm 7 5
npm run selfhost              # the machine emulating itself
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

## It emulates itself

`programs/interp.tasm` is a tryte VM written in this assembly, running on this
machine. Load a program into it and the same source file, given the same inputs,
produces the same output whether run natively or emulated. That equality is the
acceptance test, not a demo — `test-selfhost.js` checks it for **all 23 opcodes**
and for every demo program.

It nests. Two copies of the interpreter fit at once, so a program can run on a
machine emulated by a machine emulated by the real one, and still produce
identical output — for about 730× the instructions.

```bash
npm run selfhost
```

Two things came out of building it, both worth more than the emulator itself.

**The instruction set was missing something, and only bootstrapping found it.**
An interpreter must read memory at an address it *computes*. Every one of the
original 19 instructions bakes its address in when the program is assembled. So
the machine could not host an interpreter at all — and 117 passing tests had said
nothing about it, because no demo program ever needed to. `LOADX`, `STOREX` and
`JMPX` exist for that reason and no other.

**729 cells cannot hold 729 cells**, so the emulated machine is deliberately
smaller. At first that capped the nesting at one level — and then it didn't:

| | first working version | now |
|---|---|---|
| Interpreter | 412 cells | **324 cells** |
| Emulated machine | 317 cells | 405 cells |
| Cost per level | ~27× the instructions | ~27× |
| Depth 3 | **impossible** — 412 > 317 | **works** — 81 cells at the bottom |
| Depth 4 | impossible | impossible — 324 > 81 |

What bought the 88 cells was moving the operand decode — the effective address
and the value living there — out of twelve handlers and into `fetch`, where it
happens once. That is instruction decode arriving for exactly the reason it
arrived in real machines: the same work was being repeated in every handler.

Nesting also forced the interpreter to become **relocatable**. A single fixed
memory base can never nest, and the arithmetic is unambiguous: each level
addresses memory as `base + a`, so the usable window shifts by the base at every
level — away from the interpreter's own origin. No copy of `interp.tasm` could
ever be loaded into a machine `interp.tasm` was running. Each level now picks its
own origin and base, chosen to keep the next window centred.

**Deeper is not strictly stronger.** Found by mutation testing and kept as a
property test: an interpreter bug that is an *involution* on the emulated
semantics cancels when applied an even number of times. Swapping two arms of the
three-way branch is glaring at depth 2 and **invisible at depth 3**. A
three-cycle error, which does not cancel, is caught at both. So the acceptance
test compares depth 1, 2 *and* 3 — the deepest run alone would be a weaker
check, not a stronger one.

The dispatch loop is worth a look. A three-level `BR3` tree reaches 27
destinations in 3 branches where binary needs 5 — the prettier answer, and the
one this project was built to show off. Measured, it cost **149 cells against 30**
for an indexed jump through `JMPX`, so the indexed jump won. The ternary advantage
in branching is real but it is not free. `BR3` still does the work that suits it:
in `h_br3` the emulated three-way branch is implemented by the host's three-way
branch, one for one.

## Is any of it actually worth it?

Everything above checks that ternary is *correct*. `npm run bench` checks whether
it is *worth it* — the claim the source conversation made loudest and never
measured. It compares **three-way against two-way dispatch on the same machine**:
a two-way branch is `BR3` with two arms pointing at the same place, which is
exactly what a binary machine's conditional branch does. Same hardware, same
instruction set, same memory. Only the branch structure differs.

The two-way baseline is written to be as good as the machine allows — `BR3` leaves
the accumulator untouched, so it retests the value already in it and pays no
store/reload tax. A baseline the reader could improve would make the whole
exercise worthless.

| | three-way | two-way | |
|---|---|---|---|
| Classify one value | 21 cells, 5.50 steps | 26 cells, 6.00 steps | 19% smaller |
| Six in a loop | 41 cells, 68.0 steps | 46 cells, 71.0 steps | 4.2% fewer steps |
| A genuinely binary decision | — | — | **identical; no benefit exists** |
| Deep dispatch (27 ways) | 149 cells | 30 cells (indexed jump) | **three-way loses** |

**The three-way branch is a real win, and a modest one:** about half an
instruction and a fifth of the code per decision point, and only where the
decision genuinely has three outcomes. When the question is yes-or-no, the
two-way version of the program *is* the program. And when the dispatch gets deep,
the elegant `BR3` tree loses decisively to a boring indexed jump table.

Averaged over every tryte value the saving is 0.50 instructions per decision,
which is what the theory predicts: a negative value is settled by the first
two-way test, so only the other two outcomes save anything.

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
| Instructions | 23 (`src/isa.js`) |

## Layout

```
src/ternary.js     trit/tryte arithmetic and the tritwise gates
src/isa.js         the 23 opcodes
src/vm.js          fetch, decode, execute
src/assembler.js   text -> trytes, two passes, labels and directives
src/selfhost.js    run a program natively, or inside the emulated machine
src/run.js         CLI runner
programs/          threeway.tasm, multiply.tasm, tgate.tasm, interp.tasm
test/              test-core.js (27), test-vm.js (41), test-selfhost.js (60),
                   test-bench.js (15), test-page.js (39), test-style.js (28), run-all.js
bench/             the three-way vs two-way branching benchmark
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
- **The emulator is mutation-tested through its own acceptance test.** Making the
  interpreter subtract instead of add, swap two dispatch-table entries, reverse the
  three-way branch arms, or advance the emulated program counter by one instead of
  two each produces immediate failures. Without that, "identical output" could be
  vacuously true.
- **Both themes are checked arithmetically.** `test-style.js` computes WCAG contrast
  for every text/background pair in light and dark. This exists because three real
  defects shipped past visual inspection: a Cyrillic character inside a dark-mode hex
  literal, and two pairs below AA.

The whole suite has also been **mutation-tested**: deliberately breaking the shift
rounding, the three-way branch, the gate control, and a dark-theme colour each produced
immediate, specific failures. Tests that cannot fail are worse than no tests.
