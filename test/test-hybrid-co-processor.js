'use strict';
/* ---------------------------------------------------------------------------
 * test-hybrid-co-processor.js — Tests for Quantum Co-Processor (QEXEC)
 * ---------------------------------------------------------------------------
 * Verifies:
 *   1. QEXEC instruction opcode 25 in ISA and assembler
 *   2. Deterministic execution of identity and permutation anyon braids
 *   3. Born rule probability normalization on vTQPU qutrit states
 *   4. Classical BR3 conditional branching steering quantum state outcomes
 *   5. Execution of programs/hybrid_quantum.tasm on TryteVM
 *   6. Lean 4 formal certification of Section 8 quantum measurement theorems
 *   7. Interactive shell integration (tsh.js run hybrid)
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('../quantum/qexec.js');           // registers QEXEC with the VM
const { execSync } = require('child_process');
const { OPS } = require('../src/isa.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto } = require('../src/assembler.js');
const { evaluateBraid3 } = require('../quantum/src/unified-compiler.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('Running Hybrid Quantum-Classical Co-Processor (QEXEC) Test Suite...\n');

// 1. ISA & Assembler Integration
test('QEXEC is defined with opcode 25 and accepted by assembler', () => {
  // QEXEC is an extension of the VM now (quantum/qexec.js), not an entry in the core OPS table.
  const { EXTENSIONS, EXT_BY_CODE } = require('../src/isa.js');
  assert.ok(EXTENSIONS.QEXEC);
  assert.strictEqual(EXTENSIONS.QEXEC.code, 25);
  assert.strictEqual(EXTENSIONS.QEXEC.operand, 'addr');
  assert.strictEqual(EXT_BY_CODE[25].name, 'QEXEC');
  assert.ok(!('QEXEC' in OPS), 'QEXEC must not be in the core table');

  const tasm = `
        LOADI 0
        QEXEC braid
        HALT
braid:  .word 2, 1, -1
  `;
  const vm = new TryteVM();
  loadInto(vm, tasm);
  // Instruction at PC=0 is LOADI (opcode 1), at PC=2 is QEXEC (opcode 25)
  assert.strictEqual(vm.read(2), 25);
});

// 2. Identity Braid Preservation
test('QEXEC with identity braid word deterministically preserves any input trit', () => {
  const tasm = `
        IN
        QEXEC braid
        OUT
        HALT
braid:  .word 2, 2, -2
  `;

  for (const inputTrit of [-1, 0, 1]) {
    const vm = new TryteVM({ input: [inputTrit], deterministicQuantum: true });
    loadInto(vm, tasm);
    vm.run();
    assert.deepStrictEqual(vm.output, [inputTrit], `Failed to preserve trit ${inputTrit}`);
  }
});

// 3. Born Rule Probability Normalization
test('evaluateBraid3 produces exact unitary matrix with normalized Born probabilities', () => {
  const word = [1, 2, -1, -2, 3, -2];
  const mat = evaluateBraid3(word);
  assert.ok(mat.isUnitary(), 'Braid matrix must be unitary in SU(3)');

  // For each column (input basis state), check probabilities sum to 1
  for (let col = 0; col < 3; col++) {
    const pNeg = mat.m[0][col].absSq();
    const pZero = mat.m[1][col].absSq();
    const pPos = mat.m[2][col].absSq();
    const sum = pNeg + pZero + pPos;
    assert.ok(Math.abs(sum - 1.0) < 1e-10, `Probabilities sum to ${sum}, expected 1.0`);
  }
});

// 4. Classical BR3 Branching on Quantum Result
test('TryteVM branches conditionally via BR3 based on QEXEC measurement', () => {
  const tasm = `
        LOADI 0
        QEXEC braid
        BR3   target
target: .table on_neg, on_zero, on_pos
on_neg: LOADI -10
        OUT
        HALT
on_zero: LOADI 0
        OUT
        HALT
on_pos: LOADI 10
        OUT
        HALT
braid:  .word 2, 1, -1
  `;
  // With identity braid and input 0, state stays 0, so should jump to on_zero
  const vm = new TryteVM({ deterministicQuantum: true });
  loadInto(vm, tasm);
  vm.run();
  assert.deepStrictEqual(vm.output, [0]);
});

// 5. programs/hybrid_quantum.tasm Execution
test('programs/hybrid_quantum.tasm executes cleanly on TryteVM', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../programs/hybrid_quantum.tasm'), 'utf8');
  const vm = new TryteVM({ deterministicQuantum: true });
  loadInto(vm, src);
  vm.run();
  assert.strictEqual(vm.halted, true);
  assert.ok([-1, 0, 1].includes(vm.output[0]));
});

// 6. Lean 4 Section 8 Verification
test('Lean 4 proof kernel verifies Section 8 quantum measurement theorems (0 sorry)', () => {
  const out = execSync('lean -o quantum/lean/TryteArsenal.olean quantum/lean/TryteArsenal.lean', {
    encoding: 'utf8',
  });
  assert.strictEqual(out.trim(), '', 'Lean 4 compiler reported warnings/errors');
});

// 7. Shell CLI Integration
test('tsh CLI executes hybrid quantum program via run hybrid command', () => {
  const out = execSync('node quantum/cli/tsh.js -c "run hybrid 20"', {
    encoding: 'utf8',
  });
  assert.ok(out.includes('Topological Quantum-Classical Hybrid Co-Processor Execution'));
  assert.ok(out.includes('Status: PASS'));
});

// 8. Robustness & Error Handling
test('QEXEC rejects invalid braid lengths and illegal generators cleanly', () => {
  // Invalid length (> 100)
  const badLenTasm = `
        LOADI 0
        QEXEC bad_braid
        HALT
bad_braid: .word 150
  `;
  const vm1 = new TryteVM();
  loadInto(vm1, badLenTasm);
  assert.throws(() => vm1.run(), /invalid QEXEC braid length/);

  // Invalid generator (e.g. 5, not in {-3..3})
  const badGenTasm = `
        LOADI 0
        QEXEC bad_gen_braid
        HALT
bad_gen_braid: .word 1, 5
  `;
  const vm2 = new TryteVM();
  loadInto(vm2, badGenTasm);
  assert.throws(() => vm2.run(), /invalid QEXEC braid generator/);
});

// 9. Accumulator Preservation
test('QEXEC preserves upper trits of Accumulator A during projective measurement', () => {
  // In balanced ternary, 27 = 3^3 (trit 3 is +1, trit 0 is 0)
  // When measuring identity braid on |0>, lowest trit remains 0, upper trits (27) must remain intact!
  const tasm = `
        LOADI 27
        QEXEC id_braid
        HALT
id_braid: .word 0
  `;
  const vm = new TryteVM({ deterministicQuantum: true });
  loadInto(vm, tasm);
  vm.run();
  assert.strictEqual(vm.A, 27, 'Upper trits of A must be preserved');
});

console.log(`\nHybrid Co-Processor Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
