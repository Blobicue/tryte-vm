'use strict';
/* ---------------------------------------------------------------------------
 * test-crypto-arsenal.js — Tests for Cryptographic & Non-Linear Primitives
 * ---------------------------------------------------------------------------
 * Verifies:
 *   1. crypto_sbox_9 non-linear balanced S-Box execution on TryteVM
 *   2. ternary_hash_step iterative compression function
 *   3. ternary_rule_110 cellular automaton simulation
 *   4. Lean 4 formal certification of cryptographic certificates
 *   5. tsh CLI execution of hash and ca commands
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const { execSync } = require('child_process');
const crypto = require('../src/crypto.js');
const { getCircuit, runCircuit } = require('../quantum/src/arsenal.js');

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

console.log('Running Cryptographic & Non-Linear Arsenal Test Suite...\n');

// 1. S-Box Verification
test('crypto_sbox_9 is registered, balanced, preserves zero, and executes on TryteVM', () => {
  const c = getCircuit('crypto_sbox_9');
  assert.ok(c, 'crypto_sbox_9 must exist in Arsenal');
  assert.strictEqual(c.truth_table.length, 9);
  assert.strictEqual(c.truth_table[4], 0, 'Must preserve zero (0, 0) -> 0');

  // Check balanced distribution
  const counts = { '-1': 0, '0': 0, '1': 0 };
  for (const v of c.truth_table) counts[String(v)]++;
  assert.strictEqual(counts['-1'], 3);
  assert.strictEqual(counts['0'], 3);
  assert.strictEqual(counts['1'], 3);

  // Execute on TryteVM for (1, -1) -> index 6 -> -1
  const res = runCircuit('crypto_sbox_9', [1, -1]);
  assert.deepStrictEqual(res.output, [-1]);
  assert.strictEqual(res.steps, 9);
  assert.strictEqual(res.halted, true);
});

// 2. Cryptographic Hash Compression
test('ternary_hash_step compresses variable-length messages consistently', () => {
  const c = getCircuit('ternary_hash_step');
  assert.ok(c);
  assert.strictEqual(c.truth_table[4], 0);

  // Hash empty message -> iv
  assert.strictEqual(crypto.hashTernary([], 0), 0);
  assert.strictEqual(crypto.hashTernary([], 1), 1);

  // Hash arbitrary trit sequence
  const msg = [1, -1, 0, 1, 1, -1];
  const h = crypto.hashTernary(msg);
  assert.ok([-1, 0, 1].includes(h));

  // Verify execution on TryteVM
  const res = runCircuit('ternary_hash_step', [0, 1]);
  assert.deepStrictEqual(res.output, [-1]);
});

// 3. Cellular Automaton Rule 110
test('ternary_rule_110 evolves 1D periodic ring deterministically', () => {
  const initial = [0, 1, -1, 0, 1];
  const step1 = crypto.stepCellularAutomaton(initial, 1);
  const step2 = crypto.stepCellularAutomaton(initial, 2);

  assert.strictEqual(step1.length, initial.length);
  assert.strictEqual(step2.length, initial.length);
  assert.notDeepStrictEqual(step1, initial);

  // Evolution is deterministic
  const step1Again = crypto.stepCellularAutomaton(initial, 1);
  assert.deepStrictEqual(step1, step1Again);
});

// 4. Lean 4 Formal Verification
test('Lean 4 proof checker verifies all 3 cryptographic certificates (0 sorry)', () => {
  const cmd = 'LEAN_PATH=quantum/lean lean quantum/lean/Certificates/crypto_sbox_9_cert.lean && LEAN_PATH=quantum/lean lean quantum/lean/Certificates/ternary_hash_step_cert.lean && LEAN_PATH=quantum/lean lean quantum/lean/Certificates/ternary_rule_110_cert.lean';
  const out = execSync(cmd, { encoding: 'utf8' });
  assert.strictEqual(out.trim(), '', 'Lean 4 compiler reported errors');
});

// 5. Shell CLI Integration
test('tsh CLI executes arsenal hash and ca commands', () => {
  const hashOut = execSync('node quantum/cli/tsh.js -c "arsenal hash 1 -1 0"', {
    encoding: 'utf8',
  });
  assert.ok(hashOut.includes('Balanced Ternary Cryptographic Hash'));
  assert.ok(hashOut.includes('Hash Digest'));

  const caOut = execSync('node quantum/cli/tsh.js -c "arsenal ca 2"', {
    encoding: 'utf8',
  });
  assert.ok(caOut.includes('Ternary Cellular Automaton'));
  assert.ok(caOut.includes('t=2:'));
});

console.log(`\nCrypto Arsenal Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
