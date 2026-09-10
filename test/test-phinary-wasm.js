'use strict';
/* test-phinary-wasm.js — WebAssembly compilation and execution tests for
 * the Phinary TryteVM in-cache memory system (PM0).
 */

const { emitPhinaryWasm, instantiatePhinaryWasm } = require('../src/phinary-wasm.js');
const { assemble } = require('../src/assembler.js');
const P = require('../src/phinary.js');

let pass = 0;
const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log(`  [PASS] ${name}`);
  } else {
    fails.push(name);
    console.log(`  [FAIL] ${name}  ${detail}`);
  }
};

(async () => {
  console.log('\n=== 1. WEBASSEMBLY COMPILATION & FOOTPRINT ===');
  const bytes = emitPhinaryWasm();
  check('emitted Wasm binary is valid Uint8Array', bytes instanceof Uint8Array);
  check(`Wasm binary size is under 3.0 KB (${bytes.length} bytes)`, bytes.length < 3072);
  check('Wasm binary starts with standard magic 0x00 0x61 0x73 0x6d',
    bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d);

  const { exports: vm } = await instantiatePhinaryWasm();
  check('WebAssembly module instantiates cleanly without errors', typeof vm.step === 'function');

  console.log('\n=== 2. IN-CACHE MEMORY & 2D LATTICE ADDRESSING IN WASM ===');
  vm.init();
  check('init zeroes A, C, PC, halted',
    vm.getA() === 0 && vm.getC() === 0 && vm.getPC() === 0 && vm.getHalted() === 0);

  // Direct address read/write
  vm.writeCell(42, 100);
  check('writeCell / readCell round-trips value 100 at address 42', vm.readCell(42) === 100);

  // 2D Golden lattice coordinates (u, v)
  // (u=7, v=-3) -> addr = 27*(-3) + 7 = -74
  vm.writeCoord(7, -3, -250);
  check('writeCoord stores to 27*v + u', vm.readCell(-74) === -250);
  check('readCoord reads back value from (7, -3)', vm.readCoord(7, -3) === -250);

  // Address wrap around tryte boundaries
  vm.writeCell(365, 50); // wraps 365 -> -364
  check('writeCell wraps address 365 to -364', vm.readCell(-364) === 50);

  console.log('\n=== 3. EXACT Z[phi] SCALING IN WASM ===');
  vm.setA(1);
  vm.setC(1);
  vm.phiScale(); // (1, 1) -> (1, 2)
  check('phiScale updates A=1, C=2', vm.getA() === 1 && vm.getC() === 2);
  vm.phiScale(); // (1, 2) -> (2, 3)
  check('phiScale updates A=2, C=3', vm.getA() === 2 && vm.getC() === 3);
  vm.phiScale(); // (2, 3) -> (3, 5)
  check('phiScale updates A=3, C=5', vm.getA() === 3 && vm.getC() === 5);
  vm.phiScaleInv(); // (3, 5) -> (2, 3)
  check('phiScaleInv inverts back to A=2, C=3', vm.getA() === 2 && vm.getC() === 3);

  console.log('\n=== 4. ASSEMBLED PHINARY PROGRAM EXECUTION IN WASM ===');
  // Load and execute a program that builds Fibonacci numbers in (A, C) and emits them
  const prog1 = `
    LOADI 1
    SETC  1
    PHIMUL 1    ; A=1, C=2
    OUT
    PHIMUL 1    ; A=2, C=3
    OUT
    PHIMUL 1    ; A=3, C=5
    OUT
    PHIMUL 1    ; A=5, C=8
    OUT
    HALT
  `;
  vm.init();
  const { cells: cells1 } = assemble(prog1);
  for (const [addr, val] of cells1) vm.writeCell(addr, val);

  const steps = vm.run(100);
  check('program halted after executing steps', vm.getHalted() === 1 && steps > 0);
  check('emitted output count is 4', vm.getOutCount() === 4);
  check('output[0] is 1', vm.getOutput(0) === 1);
  check('output[1] is 2', vm.getOutput(1) === 2);
  check('output[2] is 3', vm.getOutput(2) === 3);
  check('output[3] is 5', vm.getOutput(3) === 5);

  console.log('\n=== 5. 2D LATTICE IN-CACHE MEMORY ACCESS IN WASM ===');
  const prog2 = `
    ; Store 77 at lattice coord (u=4, v=2) -> addr = 27*2 + 4 = 58
    LOADI 77
    SETC  4            ; u = C = 4
    PHISTORE row1      ; v = mem[row1] = 2 -> writes to 58

    ; Load back from (u=4, v=2)
    LOADI 4            ; u = A = 4
    PHILOAD row1       ; v = mem[row1] = 2 -> reads from 58
    OUT

    HALT

    .org -5
row1: .word 2
  `;
  vm.init();
  const { cells: cells2 } = assemble(prog2);
  for (const [addr, val] of cells2) vm.writeCell(addr, val);

  vm.run(100);
  check('PHISTORE and PHILOAD executed in Wasm', vm.getHalted() === 1);
  check('output emitted is 77', vm.getOutput(0) === 77);
  check('cell 58 in linear memory holds 77', vm.readCell(58) === 77);
  check('readCoord(4, 2) in Wasm returns 77', vm.readCoord(4, 2) === 77);

  console.log('\n================================================================');
  if (fails.length === 0) {
    console.log(`ALL ${pass} CHECKS PASSED`);
  } else {
    console.log(`${fails.length} CHECKS FAILED out of ${pass + fails.length}`);
    process.exit(1);
  }
})();
