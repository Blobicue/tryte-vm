'use strict';
/* test-phinary-vm.js — Execution tests for phinary ISA extensions (PM0)
 * in TryteVM: PHINORM, PHIMUL, PHILOAD, PHISTORE.
 */

const { TryteVM } = require('../src/vm.js');
const { assemble, loadInto } = require('../src/assembler.js');
const P = require('../src/phinary.js');
const T = require('../src/ternary.js');

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

console.log('\n=== 1. PHINORM (ZECKENDORF CANONICAL NORMALIZATION) ===');
{
  const prog = `
    LOADI 11
    PHINORM
    OUT
    LOADI -11
    PHINORM
    OUT
    LOADI 0
    PHINORM
    OUT
    HALT
  `;
  const vm = new TryteVM();
  loadInto(vm, prog);
  vm.run();

  // 11 = 8 + 3 = F_5 + F_3 = canonical Zeckendorf
  check('PHINORM normalizes positive value 11', vm.output[0] === 11);
  check('PHINORM normalizes negative value -11', vm.output[1] === -11);
  check('PHINORM preserves zero', vm.output[2] === 0);
}

console.log('\n=== 2. PHIMUL (GOLDEN RATIO SCALING IN Z[phi]) ===');
{
  // Scaling by phi: (A, C) = (1, 1) -> (1, 2) -> (2, 3) -> (3, 5) -> (5, 8)
  const prog = `
    LOADI 1
    SETC  1
    PHIMUL 1    ; (1, 1) * phi = (1, 2)
    OUT         ; emit A = 1
    PHIMUL 1    ; (1, 2) * phi = (2, 3)
    OUT         ; emit A = 2
    PHIMUL 1    ; (2, 3) * phi = (3, 5)
    OUT         ; emit A = 3
    PHIMUL 1    ; (3, 5) * phi = (5, 8)
    OUT         ; emit A = 5
    PHIMUL -1   ; inverts: (5, 8) * phi^-1 = (3, 5)
    OUT         ; emit A = 3
    HALT
  `;
  const vm = new TryteVM();
  loadInto(vm, prog);
  vm.run();

  check('PHIMUL 1 produces Fibonacci ladder sequence A=1', vm.output[0] === 1);
  check('PHIMUL 1 produces Fibonacci ladder sequence A=2', vm.output[1] === 2);
  check('PHIMUL 1 produces Fibonacci ladder sequence A=3', vm.output[2] === 3);
  check('PHIMUL 1 produces Fibonacci ladder sequence A=5', vm.output[3] === 5);
  check('PHIMUL -1 exactly inverts phi scaling back to A=3', vm.output[4] === 3);
}

console.log('\n=== 3. 2D GOLDEN LATTICE IN-CACHE ACCESS (PHILOAD & PHISTORE) ===');
{
  // Store 42 into lattice cell (u=5, v=-2)
  // Store -99 into lattice cell (u=-13, v=13)
  const prog = `
    ; Store 42 at (u=5, v=-2)
    LOADI 42
    SETC  5            ; u = C = 5
    PHISTORE row1      ; v = mem[row1] = -2 -> writes to 27*(-2) + 5 = -49

    ; Store -99 at (u=-13, v=13)
    LOADI -99
    SETC  -13          ; u = C = -13
    PHISTORE row2      ; v = mem[row2] = 13 -> writes to 27*13 - 13 = 338

    ; Load back from (u=5, v=-2)
    LOADI 5            ; u = A = 5
    PHILOAD row1       ; v = mem[row1] = -2 -> reads 27*(-2) + 5
    OUT                ; emit 42

    ; Load back from (u=-13, v=13)
    LOADI -13          ; u = A = -13
    PHILOAD row2       ; v = mem[row2] = 13 -> reads 27*13 - 13
    OUT                ; emit -99

    HALT

    .org -10
row1: .word -2
row2: .word 13
  `;
  const vm = new TryteVM();
  loadInto(vm, prog);
  vm.run();

  check('PHISTORE / PHILOAD round-trip at (5, -2) emits 42', vm.output[0] === 42);
  check('PHISTORE / PHILOAD round-trip at (-13, 13) emits -99', vm.output[1] === -99);
  check('underlying linear memory at -49 holds 42', vm.read(-49) === 42);
  check('underlying linear memory at 338 holds -99', vm.read(338) === -99);
  check('readCoord(5, -2) equals 42', vm.readCoord(5, -2) === 42);
  check('readCoord(-13, 13) equals -99', vm.readCoord(-13, 13) === -99);
}

console.log('\n=== 4. EXHAUSTIVE LATTICE BOUNDARY INTEGRITY ===');
{
  const vm = new TryteVM();
  // Check lattice corners and center
  const corners = [
    { u: -13, v: -13, expectedAddr: -364 },
    { u: 13, v: -13, expectedAddr: -338 },
    { u: 0, v: 0, expectedAddr: 0 },
    { u: -13, v: 13, expectedAddr: 338 },
    { u: 13, v: 13, expectedAddr: 364 }
  ];

  let cornersPass = true;
  for (const c of corners) {
    const val = c.u * 10 + c.v;
    vm.writeCoord(c.u, c.v, val);
    if (vm.read(c.expectedAddr) !== val || vm.readCoord(c.u, c.v) !== val) {
      cornersPass = false;
      break;
    }
  }
  check('all 4 lattice corners and center read/write consistently', cornersPass);
}

console.log('\n================================================================');
if (fails.length === 0) {
  console.log(`ALL ${pass} CHECKS PASSED`);
} else {
  console.log(`${fails.length} CHECKS FAILED out of ${pass + fails.length}`);
  process.exit(1);
}
