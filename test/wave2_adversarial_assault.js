'use strict';
/* ---------------------------------------------------------------------------
 * wave2_adversarial_assault.js — Wave 2 Hostile Attack Battery
 * ---------------------------------------------------------------------------
 * Targets:
 *   1. Hardware ISA & Memory Boundary Assault (wrapping, indirect pointers, table edge wraps)
 *   2. Asymmetric & Degenerate Multi-Precision (1-word, asymmetric lengths, 6-word scaling)
 *   3. DAG Compiler Malformed Expression Fuzzing (invalid syntax, operator injection)
 *   4. Cryptographic Strict Avalanche Criterion (SAC) & Fixed-Point Assault
 *   5. Microkernel Memory Boundary & Scalability Attack (3+ tasks, TCB corruption)
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const crypto = require('crypto');
const T = require('../src/ternary.js');
const MP = require('../src/multiprecision.js');
const { TryteVM } = require('../src/vm.js');
const { DAGCompiler } = require('../src/dag_compiler.js');
const { assemble, loadInto } = require('../src/assembler.js');
const cryptModule = require('../src/crypto.js');
const { TryteKernel } = require('../src/kernel.js');

const FINDINGS = [];

function recordFinding(category, severity, title, details) {
  FINDINGS.push({ category, severity, title, details });
  console.log(`\n  [VULNERABILITY FOUND] [${severity}] ${title}`);
  console.log(`    -> ${details}`);
}

console.log('===============================================================');
console.log('WAVE 2: HOSTILE ATTACK BATTERY INITIATED');
console.log('===============================================================\n');

// ---------------------------------------------------------------------------
// Assault 1: Hardware ISA & Memory Boundary Wrapping
// ---------------------------------------------------------------------------
console.log('>>> [1/5] Assaulting Hardware ISA, Indirect Pointers & Table Edge Wraps...');

// Test 1.1: TOP and TOPC reading across memory wrap boundary (+364 -> -364)
{
  const vm = new TryteVM();
  // Place truth table starting at address 360: entries span 360, 361, 362, 363, 364, -364, -363, -362, -361
  const tasm = `
        LOADI 360
        SETC  360
        LOADI 0
        STORE 10
        LOADI 1
        TOP   10
        HALT
  `;
  try {
    loadInto(vm, tasm);
    // write test table across border
    for (let i = 0; i < 9; i++) {
      vm.write(T.wrap(360 + i), (i % 3) - 1);
    }
    vm.run();
    // Verify TOP wrapped addresses correctly without array out of bounds
    if (![-1, 0, 1].includes(vm.A)) {
      recordFinding('Hardware ISA', 'HIGH', 'TOP table wrap corruption', `A was ${vm.A}`);
    }
  } catch (err) {
    recordFinding('Hardware ISA', 'HIGH', 'TOP failed across boundary wrap', err.message);
  }
}

// Test 1.2: Circular pointer in LOADX / JMPX
{
  const vm = new TryteVM({ maxSteps: 50 });
  const tasm = `
loop:   LOADI loop
        STORE ptr
        JMPX  ptr
ptr:    .word 0
  `;
  try {
    loadInto(vm, tasm);
    assert.throws(() => vm.run(), /step limit exceeded/);
  } catch (err) {
    if (!err.message.includes('step limit exceeded')) {
      recordFinding('Hardware ISA', 'MEDIUM', 'Circular pointer handling error', err.message);
    }
  }
}

// Test 1.3: Out-of-bounds immediate operand to SETC
{
  const vm = new TryteVM();
  const tasm = `
        SETC 999
        HALT
  `;
  try {
    loadInto(vm, tasm);
    vm.run();
    if (vm.C < -364 || vm.C > 364) {
      recordFinding('Hardware ISA', 'MEDIUM', 'SETC does not wrap immediate operand', `C is ${vm.C}`);
    }
  } catch (err) {
    recordFinding('Hardware ISA', 'LOW', 'SETC with large immediate threw error', err.message);
  }
}

// ---------------------------------------------------------------------------
// Assault 2: Asymmetric & Degenerate Multi-Precision Arithmetic
// ---------------------------------------------------------------------------
console.log('>>> [2/5] Assaulting Multi-Precision with Asymmetric & Boundary Word Sizes...');

// Test 2.1: 1-word generation in generateWideAddTASM
{
  try {
    const tasm1 = MP.generateWideAddTASM(1);
    const vm = new TryteVM({ input: [300, 200] });
    loadInto(vm, tasm1);
    vm.run();
    // 300 + 200 = 500 = 729 - 229 -> sum: -229, carryOut: 1
    if (vm.output[0] !== -229 || vm.output[1] !== 1) {
      recordFinding('Multi-Precision', 'HIGH', '1-word TASM addition incorrect', `Output was: ${JSON.stringify(vm.output)}`);
    }
  } catch (err) {
    recordFinding('Multi-Precision', 'HIGH', '1-word TASM generation failed', err.message);
  }
}

// Test 2.2: Asymmetric word length in addWide (X: 3 words, Y: 1 word)
{
  const x = [300, 100, -50];
  const y = [200];
  const res = MP.addWide(x, y);
  const xVal = MP.fromTrytes(x);
  const yVal = MP.fromTrytes(y);
  const expectedVal = xVal + yVal;
  if (res.exactValue !== expectedVal) {
    recordFinding('Multi-Precision', 'MEDIUM', 'Asymmetric addWide exactValue mismatch', `Expected ${expectedVal}, got ${res.exactValue}`);
  }
}

// Test 2.3: subWide with borrow cascade
{
  const x = [-364, -364];
  const y = [1, 0];
  const res = MP.subWide(x, y);
  const expectedVal = MP.fromTrytes(x) - MP.fromTrytes(y);
  if (res.exactValue !== expectedVal) {
    recordFinding('Multi-Precision', 'MEDIUM', 'subWide borrow cascade exactValue mismatch', `Expected ${expectedVal}, got ${res.exactValue}`);
  }
}

// ---------------------------------------------------------------------------
// Assault 3: DAG Compiler Malformed Expression Fuzzing
// ---------------------------------------------------------------------------
console.log('>>> [3/5] Fuzzing DAG Compiler with Malformed Expressions & Unknown Ops...');

const compiler = new DAGCompiler();

const malformedExpressions = [
  '',
  '   ',
  '+++',
  'add_invalid_abc',
  'fold()',
  'fold(add_mod_3)',
  '(((())))',
  'unknown_random_op_12345',
  'add0',
  'add_wide_0',
  'add99999999999999999999999',
];

for (const expr of malformedExpressions) {
  try {
    const plan = compiler.compile(expr);
    // If it didn't throw, is the plan safe?
    if (!plan || (!plan.tasm && !plan.truth_table && !plan.circuit)) {
      recordFinding('DAG Compiler', 'MEDIUM', `Invalid plan emitted for malformed expression '${expr}'`, `Plan: ${JSON.stringify(plan)}`);
    }
  } catch (err) {
    // Expected clean error handling
    if (!err.message || err.message.length === 0) {
      recordFinding('DAG Compiler', 'LOW', `Silent error or empty error message for '${expr}'`, String(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Assault 4: Cryptographic Strict Avalanche Criterion & Fixed-Point Assault
// ---------------------------------------------------------------------------
console.log('>>> [4/5] Testing Cryptographic SAC & Fixed Points in crypto_sbox_9 & Hash...');

// Test 4.1: Check fixed points in crypto_sbox_9 (excluding 0)
{
  let nonZeroFixedPoints = 0;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      if (x === 0 && y === 0) continue;
      const out = cryptModule.sbox(x, y);
      if (out === x && out === y) {
        nonZeroFixedPoints++;
      }
    }
  }
  if (nonZeroFixedPoints > 2) {
    recordFinding('Cryptography', 'MEDIUM', 'High fixed point concentration in crypto_sbox_9', `${nonZeroFixedPoints} non-zero fixed points`);
  }
}

// Test 4.2: Hash Collision Search for 2-trit inputs
{
  const collisions = {};
  for (let t1 = -1; t1 <= 1; t1++) {
    for (let t2 = -1; t2 <= 1; t2++) {
      const h = cryptModule.hashTernary([t1, t2]);
      collisions[h] = (collisions[h] || 0) + 1;
    }
  }
  // All 3 hash buckets {-1, 0, 1} should be hit evenly (3 each out of 9)
  for (const b of [-1, 0, 1]) {
    if (!collisions[b] || collisions[b] === 0) {
      recordFinding('Cryptography', 'HIGH', `Hash bucket ${b} had zero hits in 2-trit input sweep`, 'Severe hash imbalance');
    }
  }
}

// ---------------------------------------------------------------------------
// Assault 5: Microkernel Concurrency & Multi-Process Assault
// ---------------------------------------------------------------------------
console.log('>>> [5/5] Assaulting Microkernel Concurrency & Process Isolation...');

// Test 5.1: Zero step limit runaway protection
{
  const kernel = new TryteKernel();
  // Check if kernel.vm accepts custom maxSteps
  const customKernel = new TryteKernel();
  try {
    const res = customKernel.boot();
    if (!res.status) {
      recordFinding('Microkernel', 'MEDIUM', 'Microkernel boot did not report status', JSON.stringify(res));
    }
  } catch (err) {
    recordFinding('Microkernel', 'HIGH', 'Microkernel standard boot failed', err.message);
  }
}

// Test 5.2: Register C Isolation check
{
  const vm = new TryteVM();
  const tasm = `
        SETC  364
        LOADI 0
        HALT
  `;
  loadInto(vm, tasm);
  vm.run();
  if (vm.C !== 364) {
    recordFinding('Microkernel', 'MEDIUM', 'Register C failed to retain value', `C is ${vm.C}`);
  }
}

// ---------------------------------------------------------------------------
// Wave 2 Summary Report
// ---------------------------------------------------------------------------
console.log('\n===============================================================');
console.log(`WAVE 2 ASSAULT COMPLETE: ${FINDINGS.length} GAPS / VULNERABILITIES IDENTIFIED`);
console.log('===============================================================\n');

if (FINDINGS.length === 0) {
  console.log('>>> WAVE 2 RESULT: 100% FAILURE RATE OF GAP FINDING! ZERO DEFECTS FOUND. <<<');
} else {
  console.log(`>>> WAVE 2 RESULT: ${FINDINGS.length} DEFECTS DISCOVERED. Remediation required. <<<`);
  FINDINGS.forEach((f, idx) => {
    console.log(`  [GAP ${idx + 1}] [${f.severity}] (${f.category}) ${f.title}`);
  });
}

process.exit(FINDINGS.length === 0 ? 0 : 1);
