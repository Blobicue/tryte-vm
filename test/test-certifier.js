'use strict';
/* ---------------------------------------------------------------------------
 * test-certifier.js — Integration Test Suite for Lean 4 Circuit Certifier
 * ---------------------------------------------------------------------------
 * Verifies that automated Lean 4 proof generation, compilation, and
 * machine-checking succeed across the Arsenal of Compute with 0 sorry.
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { certifyCircuit, certifyAll, isLeanCertified } = require('../quantum/src/certifier.js');
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

console.log('Running Arsenal Lean 4 Certifier Test Suite...\n');

test('add_mod_3 certificate generates and verifies in Lean 4', () => {
  const res = certifyCircuit('add_mod_3');
  assert.strictEqual(res.certified, true);
  assert.strictEqual(res.theorem, 'Certificate.AddMod3.add_mod_3_certified');
  const certPath = path.resolve(__dirname, '..', res.certificateFile);
  assert.ok(fs.existsSync(certPath), `Certificate file ${certPath} must exist`);
  const content = fs.readFileSync(certPath, 'utf8');
  assert.ok(!content.includes('sorry'), 'Certificate must have zero sorry');
  assert.ok(!content.includes('axiom'), 'Certificate must have zero axioms');
});

test('t_neg certificate generates and verifies in Lean 4', () => {
  const res = certifyCircuit('t_neg');
  assert.strictEqual(res.certified, true);
  assert.strictEqual(res.theorem, 'Certificate.TNeg.t_neg_certified');
});

test('t_cycle certificate generates and verifies in Lean 4', () => {
  const res = certifyCircuit('t_cycle');
  assert.strictEqual(res.certified, true);
  assert.strictEqual(res.theorem, 'Certificate.TCycle.t_cycle_certified');
});

test('certifyAll successfully certifies all circuits in the Arsenal', () => {
  const { results } = certifyAll();
  assert.ok(results.length >= 8, `Expected at least 8 results, got ${results.length}`);
  for (const r of results) {
    assert.strictEqual(r.certified, true, `Circuit ${r.signature} failed Lean 4 certification`);
    assert.ok(isLeanCertified(r.signature), `isLeanCertified(${r.signature}) must be true`);
  }
});

console.log(`\nCertifier Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
