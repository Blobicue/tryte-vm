'use strict';
/**
 * test-native-simd.js — Differential Parity & Benchmark Test for Native SIMD Engine
 *
 * Runs TRUE differential execution testing between JavaScript TryteVM and native Rust TryteVM:
 * Every test program is assembled from TASM source, executed on BOTH machines, and asserted
 * to produce identical output queues and trap states.
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { TryteVM } = require('../src/vm.js');
const { assemble } = require('../src/assembler.js');
const { assembleToHex } = require('../tools/tasm_to_hex.js');

const NATIVE_BIN = path.join(__dirname, '../native/target/release/tryte');
const PROG_DIR = path.join(__dirname, '../programs');

console.log('===============================================================');
console.log('TESTING BLAZING FAST NATIVE SIMD ENGINE (TRYTE-SIMD)');
console.log('===============================================================\n');

function runJS(tasmSource, inputs = []) {
  try {
    const vm = new TryteVM({ input: inputs.slice() });
    const { cells } = assemble(tasmSource);
    for (const [addr, val] of cells) vm.write(addr, val);
    vm.run();
    return {
      output: vm.output.slice(),
      halted: vm.halted,
      trapped: false,
    };
  } catch (err) {
    return {
      output: [],
      halted: true,
      trapped: true,
      error: err.message,
    };
  }
}

function runNative(tasmSource, inputs = []) {
  const tmpHex = path.join('/tmp', `diff_test_${Date.now()}_${Math.random().toString(36).slice(2)}.hex`);
  try {
    const hex = assembleToHex(tasmSource);
    fs.writeFileSync(tmpHex, hex + '\n', 'utf8');

    const inputArg = inputs.length ? inputs.join(',') : '';
    const res = spawnSync(NATIVE_BIN, ['run', tmpHex, inputArg], { encoding: 'utf8' });
    const stdout = res.stdout || '';

    // Parse status
    const statusMatch = stdout.match(/Status: halted=(\w+), trapped=(\w+)/);
    const halted = statusMatch ? statusMatch[1] === 'true' : false;
    const trapped = statusMatch ? statusMatch[2] === 'true' : (res.status === 2);

    // Parse output queue
    const outMatch = stdout.match(/Output queue \((\d+) trytes\): \[(.*?)\]/);
    let output = [];
    if (outMatch && outMatch[2].trim()) {
      output = outMatch[2].trim().split(',').map(s => parseInt(s.trim(), 10));
    }

    return {
      output,
      halted,
      trapped,
      exitCode: res.status,
    };
  } finally {
    if (fs.existsSync(tmpHex)) fs.unlinkSync(tmpHex);
  }
}

function assertDifferential(name, tasmSource, inputs = []) {
  const jsRes = runJS(tasmSource, inputs);
  const nativeRes = runNative(tasmSource, inputs);

  assert.strictEqual(
    nativeRes.trapped,
    jsRes.trapped,
    `[${name}] Trap mismatch: JS trapped=${jsRes.trapped}, Native trapped=${nativeRes.trapped}`
  );

  if (!jsRes.trapped) {
    assert.deepStrictEqual(
      nativeRes.output,
      jsRes.output,
      `[${name}] Output mismatch: JS=${JSON.stringify(jsRes.output)}, Native=${JSON.stringify(nativeRes.output)}`
    );
  }
}

// 1. Program Parity: multiply.tasm
console.log('>>> [1/5] Differential Testing: multiply.tasm (JS VM vs Native Rust VM)...');
const mulSrc = fs.readFileSync(path.join(PROG_DIR, 'multiply.tasm'), 'utf8');
const mulTests = [
  [10, 20],
  [-15, 24],
  [-12, -12],
  [0, 364],
  [1, -364],
  [18, 18],
];

for (const [a, b] of mulTests) {
  assertDifferential(`multiply(${a}, ${b})`, mulSrc, [a, b]);
}
console.log('  ✓ 100% exact differential parity across multiplication test vectors');

// 2. Program Parity: threeway.tasm
console.log('\n>>> [2/5] Differential Testing: threeway.tasm (JS VM vs Native Rust VM)...');
const threewaySrc = fs.readFileSync(path.join(PROG_DIR, 'threeway.tasm'), 'utf8');
assertDifferential('threeway', threewaySrc, [1, -1, 0, 1, -1]);
console.log('  ✓ 100% exact differential parity for 3-way conditional branch engine');

// 3. Program Parity: tgate.tasm
console.log('\n>>> [3/5] Differential Testing: tgate.tasm (JS VM vs Native Rust VM)...');
const tgateSrc = fs.readFileSync(path.join(PROG_DIR, 'tgate.tasm'), 'utf8');
assertDifferential('tgate', tgateSrc, [123, -45]);
console.log('  ✓ 100% exact differential parity for reconfigurable TGATE modes');

// 4. Opcode Parity: TOPC (27-row carry table)
console.log('\n>>> [4/5] Differential Testing: TOPC opcode (JS VM vs Native Rust VM)...');
const topcProg = `
LOADI tbl
STORE cp
LDC cp
LOADI 123
STORE v
LOADI -45
STORE w
LOAD v
TOPC w
OUT
HALT
.org -50
cp: .word 0
v: .word 0
w: .word 0
tbl: .word -3, -2, -1, -2, -1, 0, -1, 0, 1, -2, -1, 0, -1, 0, 1, 0, 1, 2, -1, 0, 1, 0, 1, 2, 1, 2, 3
`;
assertDifferential('topc', topcProg, []);
console.log('  ✓ 100% exact differential parity for TOPC carry-table opcode');

// 5. Differential Trap Testing: Illegal Opcode Handling
console.log('\n>>> [5/5] Differential Testing: Illegal Opcode Trapping (JS VM vs Native Rust VM)...');
const trapProg = `
.word 99
.word 0
`;
const jsTrap = runJS(trapProg);
const nativeTrap = runNative(trapProg);
assert.strictEqual(jsTrap.trapped, true, 'JS VM must trap on illegal opcode');
assert.strictEqual(nativeTrap.trapped, true, 'Native VM must trap on illegal opcode');
console.log('  ✓ 100% exact trap parity on illegal opcode execution');

console.log('\n===============================================================');
console.log('RUNNING NATIVE BENCHMARKS');
console.log('===============================================================');
const benchSimdOut = execSync(`${NATIVE_BIN} bench-simd`, { encoding: 'utf8' });
console.log(benchSimdOut);

const benchCryptoOut = execSync(`${NATIVE_BIN} bench-crypto`, { encoding: 'utf8' });
console.log(benchCryptoOut);

console.log('===============================================================');
console.log('ALL NATIVE SIMD ENGINE DIFFERENTIAL PARITY TESTS & BENCHMARKS PASSED!');
console.log('===============================================================');
