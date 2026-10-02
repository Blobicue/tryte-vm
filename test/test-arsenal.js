'use strict';
/* ---------------------------------------------------------------------------
 * test-arsenal.js — Integration Test Suite for Arsenal of Compute Subsystem
 * ---------------------------------------------------------------------------
 * Verifies circuit catalog loading, execution on Tryte-VM CPU & Quantum Kernel,
 * and export/import round-trips for both TASM and .braid formats.
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  loadArsenal,
  listCircuits,
  getCircuit,
  runCircuit,
  exportCircuit,
} = require('../quantum/src/arsenal.js');
const { loadBraidFile } = require('../quantum/src/binary-format.js');

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

console.log('Running Arsenal of Compute Test Suite...\n');

// 1. Catalog Verification
test('Catalog loads and contains verified grokked circuits', () => {
  const arsenal = loadArsenal();
  assert.ok(arsenal && arsenal.circuits, 'Arsenal catalog structure valid');
  const list = listCircuits();
  assert.ok(list.length >= 8, `Expected at least 8 circuits, found ${list.length}`);
  for (const c of list) {
    assert.ok(c.signature, 'Circuit must have signature');
    assert.ok(c.kind, 'Circuit must have kind');
    assert.ok(c.domain, 'Circuit must have domain');
    assert.strictEqual(c.verified, true, `Circuit ${c.signature} must be verified`);
  }
});

test('getCircuit retrieves specific circuit by signature', () => {
  const c = getCircuit('add_mod_3');
  assert.ok(c, 'add_mod_3 must exist');
  assert.strictEqual(c.signature, 'add_mod_3');
  assert.strictEqual(c.kind, 'truth_table');
  assert.deepStrictEqual(c.truth_table, [1, -1, 0, -1, 0, 1, 0, 1, -1]);
});

// 2. Classical Tryte-VM Execution
test('add_mod_3 evaluates correctly on Tryte-VM across Z_3 x Z_3', () => {
  // Test cases: (x, y) -> (x + y) mod 3 in {-1, 0, 1}
  const testCases = [
    [-1, -1, 1],
    [-1,  0, -1],
    [-1,  1, 0],
    [ 0, -1, -1],
    [ 0,  0, 0],
    [ 0,  1, 1],
    [ 1, -1, 0],
    [ 1,  0, 1],
    [ 1,  1, -1],
  ];

  for (const [x, y, expected] of testCases) {
    const res = runCircuit('add_mod_3', [x, y]);
    assert.strictEqual(res.type, 'tryte_vm');
    assert.strictEqual(res.halted, true);
    assert.deepStrictEqual(res.output, [expected], `add_mod_3(${x}, ${y}) failed`);
  }
});

test('t_neg evaluates correctly on Tryte-VM', () => {
  assert.deepStrictEqual(runCircuit('t_neg', [-1]).output, [1]);
  assert.deepStrictEqual(runCircuit('t_neg', [0]).output, [0]);
  assert.deepStrictEqual(runCircuit('t_neg', [1]).output, [-1]);
});

test('t_cycle evaluates correctly on Tryte-VM', () => {
  assert.deepStrictEqual(runCircuit('t_cycle', [-1]).output, [0]);
  assert.deepStrictEqual(runCircuit('t_cycle', [0]).output, [1]);
  assert.deepStrictEqual(runCircuit('t_cycle', [1]).output, [-1]);
});

test('add_mod_9 evaluates correctly on Tryte-VM', () => {
  const res = runCircuit('add_mod_9', [4, 3]);
  assert.strictEqual(res.type, 'tryte_vm');
  assert.deepStrictEqual(res.output, [7]);
});

// 3. Quantum Kernel Execution
test('qutrit_h3 compiles to unitary SU(3) operator on vTQPU', () => {
  const res = runCircuit('qutrit_h3');
  assert.strictEqual(res.type, 'quantum_qutrit');
  assert.strictEqual(res.isUnitary, true);
  assert.deepStrictEqual(res.braidWord, [2, 1, -2, 1, -2]);
});

test('anyon_hadamard compiles to unitary SU(2) operator', () => {
  const res = runCircuit('anyon_hadamard');
  assert.strictEqual(res.type, 'quantum_qutrit');
  assert.strictEqual(res.isUnitary, true);
  assert.ok(res.braidWord.length === 12);
});

test('anyon_bell_state compiles to unitary SU(3) entangler', () => {
  const res = runCircuit('anyon_bell_state');
  assert.strictEqual(res.type, 'quantum_qutrit');
  assert.strictEqual(res.isUnitary, true);
});

test('learned_qutrit_add compiles to unitary SU(3) grokked circuit', () => {
  const res = runCircuit('learned_qutrit_add');
  assert.strictEqual(res.type, 'quantum_qutrit');
  assert.strictEqual(res.isUnitary, true);
  assert.deepStrictEqual(res.braidWord, [-1, 2, -3, 1, 2, -3]);
});

// 4. Export & Round-Trip Verification
test('exportCircuit exports TASM and round-trips correctly', () => {
  const tmpPath = path.join(os.tmpdir(), `test_export_${Date.now()}.tasm`);
  try {
    const res = exportCircuit('add_mod_3', tmpPath);
    assert.strictEqual(res.format, 'tasm');
    assert.ok(fs.existsSync(tmpPath));
    const content = fs.readFileSync(tmpPath, 'utf8');
    assert.ok(content.includes('TOP'));
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('exportCircuit exports .braid binary and round-trips via loadBraidFile', () => {
  const tmpPath = path.join(os.tmpdir(), `test_export_${Date.now()}.braid`);
  try {
    const res = exportCircuit('qutrit_h3', tmpPath);
    assert.strictEqual(res.format, 'braid');
    assert.ok(fs.existsSync(tmpPath));
    const prog = loadBraidFile(tmpPath);
    assert.strictEqual(prog.name, 'qutrit_h3');
    assert.deepStrictEqual(prog.word, [2, 1, -2, 1, -2]);
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

console.log(`\nArsenal Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
