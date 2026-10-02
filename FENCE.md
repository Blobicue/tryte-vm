# What this repository's verification covers, and what it does not

The README makes two promises: **every claim here was registered before it was
measured**, and **every number is recomputed by a check**. Those promises are true of
the core machine and the instrument work. They are **not** true of everything in this
tree, because two lines of work arrived from elsewhere and were merged without passing
through the protocol. This file draws the line, so that neither promise is read as
covering more than it does.

It is kept honest by `test/test-fence.js`, which derives from git history every file
those lines added and fails if any is missing from the list below, if any listed path
does not exist, or if the README stops pointing here.

---

## Inside the regime

The core machine — `src/ternary.js`, `src/isa.js`, `src/vm.js`, `src/assembler.js`,
`src/selfhost.js`, `src/device.js` and the solvers built on it — the programs and
interpreters in `programs/` that predate these lines, every audit in `tools/` that
carries a `PREDICTED OUTCOMES` block, every prediction set in `FINDINGS.json`, and
every suite listed in `test/run-all.js`.

**The instruction set, for the purposes of every finding in this repository, is the
core instructions in `src/isa.js` other than `QEXEC`.** `QEXEC` and the phinary opcodes
are extensions: they execute, and they are tested, but no prediction set rests on them.

---

## Outside the regime

### The quantum, cryptography and toolchain line

Developed on GitHub's `main` from `a7b452f` and merged on 2026-10-01; its last commit
before the merge is `80a07c8`. It registered no prediction sets. Its own description of
itself is in `AUDIT.md` and `WALKTHROUGH.md`; those are its claims, and nothing in
`FINDINGS.json` checks them.

Seven of its suites need only Node, and `test/test-quantum-line.js` runs them with
everything else, reading each one's own summary. The other nine need Lean, Python with
numpy, or a built Rust binary, and do not pass in any environment this repository has
run in; that file lists each with its reason. Only the harness's own checks count toward
the README's total. The fenced suites' self-reported counts are printed beside it and
never added.

Three of its batteries report "zero defects" without giving a count, so the harness
plants a bug for each (`test/quantum-seed.js`) to see whether they can find one. Most of
their checks can. **Three cannot:** wave 2's S-box fixed-point check can never exceed
its own threshold, wave 3's scheduling stress counts halted runs but never records a
failure, and wave 3's arithmetic fuzz compares only one field of the sum. Each is
asserted to stay silent with its seed planted, so a repair shows up rather than passing
unnoticed.

Fenced paths:

- `AUDIT.md`
- `WALKTHROUGH.md`
- `audit.sh`
- `lean-toolchain`
- `hardware/`
- `image/`
- `native/`
- `quantum/`
- `research/`
- `src/compiler/`
- `src/crypto.js`
- `src/dag_compiler.js`
- `src/jit.js`
- `src/kernel.js`
- `src/lattice_crypto.js`
- `src/multiprecision.js`
- `src/secure_channel.js`
- `programs/countdown.tril`
- `programs/hybrid_quantum.tasm`
- `programs/microkernel.tasm`
- `programs/multiply.tril`
- `programs/ntru.tasm`
- `programs/secure_microkernel.tasm`
- `programs/stdlib.tril`
- `programs/stdlib_demo.tril`
- `programs/tgate.tril`
- `programs/threeway.tril`
- `programs/trilc.tril`
- `test/adversarial_fuzz.js`
- `test/test-arsenal.js`
- `test/test-certifier.js`
- `test/test-crypto-arsenal.js`
- `test/test-dag-compiler.js`
- `test/test-hybrid-co-processor.js`
- `test/test-jit.js`
- `test/test-lattice-crypto.js`
- `test/test-microkernel.js`
- `test/test-native-simd.js`
- `test/test-secure-channel.js`
- `test/test-topc-multiprecision.js`
- `test/test-tril-compiler.js`
- `test/test-tril-stdlib.js`
- `test/wave2_adversarial_assault.js`
- `test/wave3_chaos_adversarial_battery.js`
- `tools/tasm_to_hex.js`

### The phinary subsystem

Added in `1506225`, on top of `35a0c81`, by a separate writer: golden-ratio
arithmetic, 2D lattice addressing and a WebAssembly engine. A different number base,
not ternary. Its suites are in `test/run-all.js`; no prediction set covers it.

Fenced paths:

- `src/phinary.js`
- `src/phinary-wasm.js`
- `test/test-phinary.js`
- `test/test-phinary-vm.js`
- `test/test-phinary-wasm.js`

---

## Where the outside lines changed the inside

These are files inside the regime that the quantum line edited. The suite passes over
every one of them, so they are checked — but each change is named here, because three of
them alter behaviour the corpus rests on, and a passing suite says only that nothing
recorded depended on the old behaviour.

- **`src/ternary.js`, the oracle.** `wrap` now returns 0 for `undefined` and `NaN`
  instead of propagating them — the shape of this repository's trap `T-SILENT-NAN`,
  where a missing value silently becomes a plausible one. `ttableC` now treats a missing
  table entry as 0 and clamps each carry to one trit; for a well-formed table that is
  identical, for a malformed one it is not. The shifts now accept negative and
  out-of-range counts. **None of this is reverted here**: it is published oracle
  behaviour, and changing it back is a decision, not a cleanup.
- **`src/isa.js`, `src/vm.js`, `src/assembler.js`** gained `QEXEC`. Its opcode once
  collided with phinary's `PHINORM`; `test/test-opcodes.js` now fails on any such clash.
- **`src/selfhost.js`, `programs/interp.tasm`, `programs/interp-core.tasm`** — the
  self-interpreters — were extended alongside it.
- **`test/test-decode.js`** exempts `QEXEC` from the decode audit's coverage, because it
  is not deterministic. **`test/test-erasure.js`** classes it out of scope for the
  two-operand census. **`test/test-budget.js`** raises two program counts, because the
  line added programs. All three are reasonable; all three narrow or move what the
  checks see.
- **`test/test-slate-query.js`** was changed so that, with the sibling repositories
  absent, its reachability check passed rather than failed. It now reports that case as
  **skipped**, counted neither as a pass nor a failure.
