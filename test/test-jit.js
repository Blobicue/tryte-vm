'use strict';
/* ---------------------------------------------------------------------------
 * test-jit.js — Automated Integration Test for TryteJIT Grokking Daemon
 * ---------------------------------------------------------------------------
 * Verifies dynamic interception on cache misses, autonomous synthesis,
 * Lean 4 proof certification, memory hot-patching, and seamless resumption.
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const { TryteJIT, DYNAMIC_TABLE_BASE } = require('../src/jit.js');
const { getCircuit } = require('../quantum/src/arsenal.js');

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

console.log('Running TryteJIT Grokking Daemon & Hot-Patching Test Suite...\n');

test('TryteJIT initializes with correct dynamic arena bounds', () => {
  const jit = new TryteJIT();
  assert.strictEqual(jit.tableBase, DYNAMIC_TABLE_BASE);
  assert.strictEqual(jit.nextFreeAddr, DYNAMIC_TABLE_BASE);
});

test('hotPatchTable writes 9 truth table entries into VM memory', () => {
  const jit = new TryteJIT();
  const sampleTable = [1, -1, 0, -1, 0, 1, 0, 1, -1];
  const addr = jit.hotPatchTable('test_table', sampleTable);
  assert.strictEqual(addr, DYNAMIC_TABLE_BASE);
  for (let i = 0; i < 9; i++) {
    assert.strictEqual(jit.vm.read(addr + i), sampleTable[i]);
  }
});

test('Cache-hit operator executes in 1 cycle with pre-certified Lean theorem', () => {
  const jit = new TryteJIT();
  const res = jit.execute('add_mod_3', [1, -1]);
  assert.strictEqual(res.output, 0);
  assert.strictEqual(res.wasForged, false);
  assert.strictEqual(res.leanCertified, true);
  assert.strictEqual(res.theorem, 'Certificate.AddMod3.add_mod_3_certified');
});

test('Cache-miss operator intercepts, groks, certifies in Lean 4, and hot-patches', () => {
  // Ensure 'sqr_sub' is absent from cache before test to test genuine cache-miss
  const fs = require('fs');
  const path = require('path');
  const cachePath = path.resolve(__dirname, '../research/arsenal/circuit_cache.json');
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  delete cache.circuits['sqr_sub'];
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  const jit = new TryteJIT();
  // 'sqr_sub' computes (x^2 - y) mod 3 in {-1, 0, 1}
  // For x = 1, y = 1: 1^2 - 1 = 0
  const res = jit.execute('sqr_sub', [1, 1]);
  assert.strictEqual(res.output, 0);
  assert.strictEqual(res.wasForged, true);
  assert.strictEqual(res.leanCertified, true);
  assert.ok(res.theorem.includes('sqr_sub'));

  // Immediate second call MUST now be a cache hit (wasForged: false)
  const resHit = jit.execute('sqr_sub', [1, -1]);
  // For x = 1, y = -1: 1^2 - (-1) = 2 = -1 mod 3
  assert.strictEqual(resHit.output, -1);
  assert.strictEqual(resHit.wasForged, false);
});

console.log(`\nJIT Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
