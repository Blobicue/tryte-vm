# What this repository's verification covers, and what it does not

The README makes two promises: **every claim here was registered before it was
measured**, and **every number is recomputed by a check**. Two lines of work arrived from
elsewhere and were merged without passing through that protocol. One of them, the
quantum line, has since been **moved out** to a repository of its own. The other, the
phinary subsystem, is still here and is **fenced**: listed below, so the promises are not
read as covering it.

`test/test-fence.js` holds this file to git history in both directions: every file the
quantum line added must be **absent** from this tree, every file phinary added must be
listed below and exist, and the README must point here.

---

## Inside the regime

The core machine — `src/ternary.js`, `src/isa.js`, `src/vm.js`, `src/assembler.js`,
`src/selfhost.js`, `src/device.js` and the solvers built on it — the programs and
interpreters in `programs/`, every audit in `tools/` that carries a `PREDICTED OUTCOMES`
block, every prediction set in `FINDINGS.json`, and every suite listed in
`test/run-all.js`.

**The instruction set is the table `OPS` in `src/isa.js`.** Code outside the core can
register further instructions at runtime through `registerExtension` in the same file.
An extension executes on this machine without being part of it, and no finding here
rests on one. The hook refuses any code or mnemonic already in use, which is the failure
that put two instructions on opcode 25 (`test/test-opcodes.js`).

---

## The quantum, cryptography and toolchain line — moved out

Developed on GitHub's `main` from `a7b452f`; its last commit before the merge is
`80a07c8`; merged in `b114e21` on 2026-10-01 and fenced in `1de3ab3`. It registered no
prediction sets. In `42a31da` its instruction, `QEXEC`, left the core tables and began
registering itself through the extension hook, and the core stopped requiring the
quantum compiler in order to load. In the commit that rewrote this section, all 141
files it added left this tree. They continue in **`tryte-quantum`**, a repository built
from this one's history, which uses this machine through the hook.

It was built with the Antigravity agent, which never read this repository's
`AGENTS.md`. While it was here, three of its batteries were found to contain a check that
could never fire, and its "true ternary quantum hypernetwork" was found to have nothing
to learn. The batteries' findings, with the seeded bugs that show them, travel with its
code. The hypernetwork finding stays on this record as
`F-QUTRIT-HYPERNET-NOTHING-TO-LEARN`: its test re-implements the circuit, and reads the
original source and session log out of this repository's own history at `c3c9b21`, so
it holds with the code gone.

**A correction.** This file and `test/test-quantum-line.js` once said the line's Lean
suites need a tool "no environment this repository has run in" provides. Lean 4.34.1 is
installed on the desktop this work is done from; it is the cluster that lacks it. Nobody
had checked. The line's harness in `tryte-quantum` runs the Lean suites where Lean
exists.

### What it changed inside, and what was kept

The quantum line also edited core files. Each change was examined when the line moved
out:

- **Kept: the shift functions in `src/ternary.js`.** Before them, a negative or
  oversized shift count produced a non-integer: undefined behaviour, now defined.
  `programs/interp.tasm`'s shift handlers depend on it.
- **Kept: `src/assembler.js` refuses a duplicate label.**
- **Kept: the SHL/SHR rewrite in `programs/interp.tasm`**, which shrank the interpreter
  and is covered by `test/test-selfhost.js`. Only its `QEXEC` handler was removed.
- **Reverted: `wrap` and `lowTrit` mapping `undefined` and `NaN` to 0, and `ttableC`
  treating a missing table entry as 0.** That is the shape of `T-SILENT-NAN`, and worse
  than the original: with the guard, a write through an address that does not exist went
  silently to cell 0 instead of doing nothing. The assembler's refusal of an unknown
  label is where that trap is actually stopped. Every earlier finding was measured
  against the reverted oracle. `test/test-fence.js` pins all four decisions.
- **Restored: `programs/interp-core.tasm`, to its exact pre-merge content.** The quantum
  line had kept it at 224 cells around an extra dispatch entry; 224 is the recorded
  figure, and the restored file is the form it was measured in.
- **Restored: `test/test-decode.js`, `test/test-erasure.js`, `test/test-selfhost.js`,
  `test/test-budget.js`, `tools/decode-audit.js` and `design/12-roadmap.md`**, whose only
  changes were for `QEXEC` or for the line's own programs.

---

## The phinary subsystem — fenced

Added in `1506225`, on top of `35a0c81`, by a separate writer: golden-ratio arithmetic,
2D lattice addressing and a WebAssembly engine. A different number base, not ternary.
Its suites are in `test/run-all.js`; no prediction set covers it. Its four opcodes are
still wired directly into the assembler and the VM. The extension hook's collision check
already covers its table, so moving it onto the hook would be mechanical.

Fenced paths:

- `src/phinary.js`
- `src/phinary-wasm.js`
- `test/test-phinary.js`
- `test/test-phinary-vm.js`
- `test/test-phinary-wasm.js`
