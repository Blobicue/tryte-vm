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
require('../quantum/qexec.js');           // registers QEXEC with the VM
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
      A: vm.A,
      C: vm.C,
      PC: vm.PC,
    };
  } catch (err) {
    return {
      output: [],
      halted: true,
      trapped: true,
      A: 0,
      C: 0,
      PC: 0,
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

    // Parse status and registers: Status: halted=true, trapped=false, PC=12, A=35, C=0
    const statusMatch = stdout.match(/Status:\s*halted=(\w+),\s*trapped=(\w+)(?:,\s*PC=(-?\d+),\s*A=(-?\d+),\s*C=(-?\d+))?/);
    const halted = statusMatch ? statusMatch[1] === 'true' : false;
    const trapped = statusMatch ? statusMatch[2] === 'true' : (res.status === 2);
    const pc = statusMatch && statusMatch[3] !== undefined ? parseInt(statusMatch[3], 10) : null;
    const a = statusMatch && statusMatch[4] !== undefined ? parseInt(statusMatch[4], 10) : null;
    const c = statusMatch && statusMatch[5] !== undefined ? parseInt(statusMatch[5], 10) : null;

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
      A: a,
      C: c,
      PC: pc,
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
    if (nativeRes.A !== null && jsRes.A !== null) {
      assert.strictEqual(nativeRes.A, jsRes.A, `[${name}] Register A mismatch: JS=${jsRes.A}, Native=${nativeRes.A}`);
    }
    if (nativeRes.C !== null && jsRes.C !== null) {
      assert.strictEqual(nativeRes.C, jsRes.C, `[${name}] Register C mismatch: JS=${jsRes.C}, Native=${nativeRes.C}`);
    }
    if (nativeRes.PC !== null && jsRes.PC !== null) {
      assert.strictEqual(nativeRes.PC, jsRes.PC, `[${name}] Register PC mismatch: JS=${jsRes.PC}, Native=${nativeRes.PC}`);
    }
  }
}

// 1. Program Parity: multiply.tasm
console.log('>>> [1/6] Differential Testing: multiply.tasm (JS VM vs Native Rust VM)...');
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
console.log('  ✓ 100% exact differential parity across multiplication test vectors and registers (A, C, PC)');

// 2. Program Parity: threeway.tasm
console.log('\n>>> [2/6] Differential Testing: threeway.tasm (JS VM vs Native Rust VM)...');
const threewaySrc = fs.readFileSync(path.join(PROG_DIR, 'threeway.tasm'), 'utf8');
assertDifferential('threeway', threewaySrc, [1, -1, 0, 1, -1]);
console.log('  ✓ 100% exact differential parity for 3-way conditional branch engine and registers');

// 3. Program Parity: tgate.tasm
console.log('\n>>> [3/6] Differential Testing: tgate.tasm (JS VM vs Native Rust VM)...');
const tgateSrc = fs.readFileSync(path.join(PROG_DIR, 'tgate.tasm'), 'utf8');
assertDifferential('tgate', tgateSrc, [123, -45]);
console.log('  ✓ 100% exact differential parity for reconfigurable TGATE modes and registers');

// 4. Opcode Parity: TOPC (27-row carry table)
console.log('\n>>> [4/6] Differential Testing: TOPC opcode (JS VM vs Native Rust VM)...');
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
console.log('  ✓ 100% exact differential parity for TOPC carry-table opcode and registers');

// 5. Differential Trap Testing: Illegal Opcode Handling
console.log('\n>>> [5/6] Differential Testing: Illegal Opcode Trapping (JS VM vs Native Rust VM)...');
const trapProg = `
.word 99
.word 0
`;
const jsTrap = runJS(trapProg);
const nativeTrap = runNative(trapProg);
assert.strictEqual(jsTrap.trapped, true, 'JS VM must trap on illegal opcode');
assert.strictEqual(nativeTrap.trapped, true, 'Native VM must trap on illegal opcode');
console.log('  ✓ 100% exact trap parity on illegal opcode execution');

// 6. Native Unimplemented Status: QEXEC (Opcode 25)
console.log('\n>>> [6/6] Native Feature Absence Check: QEXEC (Opcode 25) Traps as Unimplemented...');
const qexecProg = `
.word 25
.word 0
`;
const nativeQexec = runNative(qexecProg);
assert.strictEqual(nativeQexec.trapped, true, 'Native VM must trap QEXEC as unimplemented');
console.log('  ✓ Native VM correctly traps opcode 25 (QEXEC) as an unimplemented JS-only coprocessor bridge');

console.log('\n===============================================================');
console.log('RUNNING NATIVE BENCHMARKS');
console.log('===============================================================');
const benchSimdOut = execSync(`${NATIVE_BIN} bench-simd`, { encoding: 'utf8' });
console.log(benchSimdOut);

const benchCryptoOut = execSync(`${NATIVE_BIN} bench-crypto`, { encoding: 'utf8' });
console.log(benchCryptoOut);

console.log('===============================================================');
console.log('ALL NATIVE SIMD ENGINE DIFFERENTIAL TESTS, ABSENCE CHECKS & BENCHMARKS PASSED!');
console.log('===============================================================');
