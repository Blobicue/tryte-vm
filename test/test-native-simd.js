'use strict';
/**
 * test-native-simd.js — Parity & Benchmark Test for Blazing Fast Native SIMD Engine
 */

const { execSync } = require('child_process');
const path = require('path');
const assert = require('assert');
const T = require('../src/ternary.js');

const NATIVE_BIN = path.join(__dirname, '../native/target/release/tryte');

console.log('===============================================================');
console.log('TESTING BLAZING FAST NATIVE SIMD ENGINE (TRYTE-SIMD)');
console.log('===============================================================\n');

function runNative(hexPath, inputs = []) {
  const inputArg = inputs.length ? `"${inputs.join(',')}"` : '';
  const cmd = `${NATIVE_BIN} run ${hexPath} ${inputArg}`;
  const out = execSync(cmd, { encoding: 'utf8' });
  const match = out.match(/Output queue \((\d+) trytes\): \[(.*?)\]/);
  if (!match) return [];
  const rawVals = match[2].trim();
  if (!rawVals) return [];
  return rawVals.split(',').map(s => parseInt(s.trim(), 10));
}

// 1. Program Parity: multiply.tasm
console.log('>>> [1/4] Testing Native TASM Execution Parity: multiply.hex...');
const mulTests = [
  [10, 20, 200],
  [-15, 24, -360],
  [-12, -12, 144],
  [0, 364, 0],
  [1, -364, -364],
  [18, 18, 324]
];

for (const [a, b, expected] of mulTests) {
  const out = runNative('/tmp/multiply.hex', [a, b]);
  assert.strictEqual(out.length, 1, `Expected 1 output for ${a} * ${b}`);
  assert.strictEqual(out[0], expected, `Mismatch for ${a} * ${b}: expected ${expected}, got ${out[0]}`);
}
console.log('  ✓ 100% exact parity across multiplication test vectors');

// 2. Program Parity: threeway.hex
console.log('\n>>> [2/4] Testing Native TASM Execution Parity: threeway.hex...');
const threewayInputs = [1, -1, 0, 1, -1];
const threewayOut = runNative('/tmp/threeway.hex', threewayInputs);
assert.deepStrictEqual(threewayOut, threewayInputs, 'threeway output mismatch');
console.log('  ✓ 100% exact parity for 3-way conditional branch engine');

// 3. Program Parity: tgate.hex
console.log('\n>>> [3/4] Testing Native TASM Execution Parity: tgate.hex...');
const tgateOut = runNative('/tmp/tgate.hex', [123, -45]);
assert.deepStrictEqual(tgateOut, [-120, 198, -123, 195], 'tgate output mismatch');
console.log('  ✓ 100% exact parity for reconfigurable TGATE modes');

// 4. Program Parity: ntru.hex
console.log('\n>>> [4/4] Testing Native Post-Quantum NTRU Execution: ntru.hex...');
const ntruInputs = [156, 312, 261, 1, -1, 1, -1, 0, 1, 0, 1, -1];
const ntruOut = runNative('/tmp/ntru.hex', ntruInputs);
assert.deepStrictEqual(ntruOut, [1, -1, 1], 'NTRU decrypted output mismatch');
console.log('  ✓ 100% exact post-quantum decryption on native TryteVM [1, -1, 1]');

console.log('\n===============================================================');
console.log('RUNNING NATIVE BENCHMARKS');
console.log('===============================================================');
const benchSimdOut = execSync(`${NATIVE_BIN} bench-simd`, { encoding: 'utf8' });
console.log(benchSimdOut);

const benchCryptoOut = execSync(`${NATIVE_BIN} bench-crypto`, { encoding: 'utf8' });
console.log(benchCryptoOut);

console.log('===============================================================');
console.log('ALL NATIVE SIMD ENGINE PARITY TESTS & BENCHMARKS PASSED!');
console.log('===============================================================');
