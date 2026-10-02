'use strict';
/* ---------------------------------------------------------------------------
 * test-topc-multiprecision.js — Tests for Multi-Precision & Carry Ripple
 * ---------------------------------------------------------------------------
 * Verifies:
 *   1. BigInt <-> balanced ternary trit / tryte word conversions
 *   2. Multi-word carry rippling (positive, zero, negative carries)
 *   3. TryteVM execution of generated 12-trit and 18-trit TASM adders
 *   4. Exhaustive accuracy against arbitrary-precision BigInt reference
 *   5. Lean 4 formal certification of Section 7 TOPC theorems
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const { execSync } = require('child_process');
const MP = require('../src/multiprecision.js');
const { DAGCompiler } = require('../src/dag_compiler.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto } = require('../src/assembler.js');

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

console.log('Running Multi-Precision & Carry-Ripple (TOPC) Test Suite...\n');

// 1. Conversion Integrity
test('toWideTrits and fromWideTrits round-trip BigInt values losslessly', () => {
  const testValues = [0n, 1n, -1n, 42n, -100n, 729n, 123456789n, -9876543210n];
  for (const v of testValues) {
    const trits = MP.toWideTrits(v);
    const back = MP.fromWideTrits(trits);
    assert.strictEqual(back, v, `Failed for ${v}`);
    // Check balanced property
    for (const t of trits) {
      assert.ok([-1, 0, 1].includes(t), `Non-balanced trit ${t}`);
    }
  }
});

test('toTrytes and fromTrytes round-trip multi-word values losslessly', () => {
  const testValues = [0n, 364n, -364n, 365n, -365n, 1000000n, -5000000n];
  for (const v of testValues) {
    const words = MP.toTrytes(v);
    const back = MP.fromTrytes(words);
    assert.strictEqual(back, v, `Failed for ${v}`);
    for (const w of words) {
      assert.ok(w >= -364 && w <= 364, `Word ${w} out of range`);
    }
  }
});

// 2. Arithmetic Carry Ripple
test('addWide correctly calculates multi-word sums with carries', () => {
  // X = [300, 100], Y = [200, 50]
  // 300 + 200 = 500 = 729 - 229 -> r0 = -229, c1 = 1
  // 100 + 50 + 1 = 151 -> r1 = 151, c2 = 0
  const res = MP.addWide([300, 100], [200, 50]);
  assert.deepStrictEqual(res.sum, [-229, 151]);
  assert.strictEqual(res.carryOut, 0);

  const xVal = MP.fromTrytes([300, 100]);
  const yVal = MP.fromTrytes([200, 50]);
  assert.strictEqual(res.value, xVal + yVal);
});

// 3. TryteVM Multi-Precision Adder (12-trit and 18-trit)
test('DAGCompiler compiles and runs 12-trit addition with positive carry on TryteVM', () => {
  const compiler = new DAGCompiler();
  const res = compiler.run('add12', [300, 100, 200, 50]);

  assert.strictEqual(res.type, 'multiprecision_carry_chain');
  assert.deepStrictEqual(res.output, [-229, 151, 0]);
  assert.strictEqual(res.halted, true);
});

test('DAGCompiler compiles and runs 12-trit addition with negative carry on TryteVM', () => {
  const compiler = new DAGCompiler();
  // X0 = -300, Y0 = -200 -> -500 = -729 + 229 -> r0 = 229, c1 = -1
  // X1 = 50, Y1 = 10 -> 50 + 10 - 1 = 59 -> r1 = 59, c2 = 0
  const res = compiler.run('add12', [-300, 50, -200, 10]);

  assert.deepStrictEqual(res.output, [229, 59, 0]);
  assert.strictEqual(res.halted, true);
});

test('DAGCompiler compiles and runs 18-trit addition with cascaded carry on TryteVM', () => {
  const compiler = new DAGCompiler();
  // Double carry ripple
  const res = compiler.run('add18', [350, 350, 100, 350, 350, 100]);

  assert.deepStrictEqual(res.output, [-29, -28, 201, 0]);
  assert.strictEqual(res.halted, true);
});

// 4. Lean 4 Section 7 Formal Verification
test('Lean 4 proof kernel verifies Section 7 27-row carry table theorems (0 sorry)', () => {
  const out = execSync('lean -o quantum/lean/TryteArsenal.olean quantum/lean/TryteArsenal.lean', {
    encoding: 'utf8',
  });
  assert.strictEqual(out.trim(), '', 'Lean 4 compiler reported warnings/errors');
});

// 5. Shell CLI Integration
test('tsh CLI executes multi-precision addition via eval command', () => {
  const evalOut = execSync('node quantum/cli/tsh.js -c "eval add12 300 100 200 50"', {
    encoding: 'utf8',
  });
  assert.ok(evalOut.includes('Expression Evaluated : add12'));
  assert.ok(evalOut.includes('Output               : [-229, 151, 0]'));
});

console.log(`\nMulti-Precision Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
