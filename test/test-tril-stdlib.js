'use strict';
/**
 * test-tril-stdlib.js — Test Suite for Tril Standard Library Extensions
 *
 * Verifies:
 * 1. Language syntax: array declarations, indexing read/write, pointer dereference
 * 2. Math routines: abs, sgn, clamp, pow, div, mod
 * 3. Memory routines: alloc (bump heap), memset, memcpy, memcmp
 * 4. String routines: strlen, strcpy, strcmp, print_str
 * 5. Cryptographic primitives: aead_enc, aead_dec stream cipher round-trip
 * 6. Demo program: programs/stdlib_demo.tril execution
 * 7. Native Rust TryteVM SIMD execution parity via compiled hex images
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { compile, compileAndAssemble, compileAndRun, compileToHex } = require('../src/compiler/tril.js');
const { TryteVM } = require('../src/vm.js');

let totalChecks = 0;
let passedChecks = 0;

function check(desc, condition, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ ${desc}`);
  } else {
    console.error(`  ✗ FAIL: ${desc} ${details ? '(' + details + ')' : ''}`);
    process.exitCode = 1;
  }
}

console.log('===============================================================');
console.log('TESTING TRIL STANDARD LIBRARY EXTENSIONS & PARITY');
console.log('===============================================================\n');

// ---------------------------------------------------------------------------
// 1. Array Declarations, Indexing, and Pointer Dereferencing
// ---------------------------------------------------------------------------
console.log('>>> [1/7] Testing Array Memory Layout & Pointer Dereferencing...');

{
  const src = `
    fn main() {
      array buf[4] = [10, 20, 30, 40];
      out(buf[0]);
      out(buf[2]);
      buf[1] = 99;
      out(buf[1]);

      let p = buf;
      *p = 77;
      out(*p);
      out(buf[0]);

      *(p + 3) = 88;
      out(buf[3]);
      halt();
    }
  `;
  const vm = compileAndRun(src);
  check('Static array indexed read (buf[0], buf[2])', vm.output[0] === 10 && vm.output[1] === 30, `got ${vm.output}`);
  check('Static array indexed write (buf[1] = 99)', vm.output[2] === 99, `got ${vm.output[2]}`);
  check('Pointer dereference write (*p = 77)', vm.output[3] === 77 && vm.output[4] === 77, `got ${vm.output[3]}`);
  check('Pointer arithmetic write (*(p + 3) = 88)', vm.output[5] === 88, `got ${vm.output[5]}`);
}

// ---------------------------------------------------------------------------
// 2. Balanced Ternary Mathematics (abs, sgn, clamp)
// ---------------------------------------------------------------------------
console.log('\n>>> [2/7] Testing Ternary Mathematics (abs, sgn, clamp)...');

{
  const src = `
    fn main() {
      out(abs(-42));
      out(abs(0));
      out(abs(99));

      out(sgn(-15));
      out(sgn(0));
      out(sgn(120));

      out(clamp(-50, 0, 100));
      out(clamp(45, 0, 100));
      out(clamp(150, 0, 100));
      halt();
    }
  `;
  const vm = compileAndRun(src);
  check('abs(-42) = 42, abs(0) = 0, abs(99) = 99', vm.output[0] === 42 && vm.output[1] === 0 && vm.output[2] === 99);
  check('sgn(-15) = -1, sgn(0) = 0, sgn(120) = 1', vm.output[3] === -1 && vm.output[4] === 0 && vm.output[5] === 1);
  check('clamp bounded saturation in [0..100]', vm.output[6] === 0 && vm.output[7] === 45 && vm.output[8] === 100);
}

// ---------------------------------------------------------------------------
// 3. Extended Arithmetic (pow, div, mod)
// ---------------------------------------------------------------------------
console.log('\n>>> [3/7] Testing Extended Arithmetic (pow, div, mod)...');

{
  const src = `
    fn main() {
      out(pow(3, 3));
      out(pow(2, 4));
      out(pow(5, 0));

      out(div(7, 3));
      out(mod(7, 3));

      out(div(100, 10));
      out(mod(100, 10));

      out(div(-14, 3));
      out(mod(-14, 3));
      halt();
    }
  `;
  const vm = compileAndRun(src);
  check('pow(3,3)=27, pow(2,4)=16, pow(5,0)=1', vm.output[0] === 27 && vm.output[1] === 16 && vm.output[2] === 1, `got ${vm.output}`);
  check('div(7, 3) = 2 and mod(7, 3) = 1', vm.output[3] === 2 && vm.output[4] === 1, `got div=${vm.output[3]}, mod=${vm.output[4]}`);
  check('div(100, 10) = 10 and mod(100, 10) = 0', vm.output[5] === 10 && vm.output[6] === 0, `got div=${vm.output[5]}, mod=${vm.output[6]}`);
  check('Signed division: div(-14, 3) = -4, mod(-14, 3) = -2', vm.output[7] === -4 && vm.output[8] === -2, `got div=${vm.output[7]}, mod=${vm.output[8]}`);
}

// ---------------------------------------------------------------------------
// 4. Memory Management (alloc, memset, memcpy, memcmp)
// ---------------------------------------------------------------------------
console.log('\n>>> [4/7] Testing Memory Management (alloc, memset, memcpy, memcmp)...');

{
  const src = `
    fn main() {
      let p1 = alloc(4);
      let p2 = alloc(4);
      out(p2 - p1);

      memset(p1, 42, 4);
      memcpy(p2, p1, 4);

      out(*p2);
      out(*(p2 + 3));
      out(memcmp(p1, p2, 4));

      *(p2 + 3) = 99;
      out(memcmp(p1, p2, 4));
      halt();
    }
  `;
  const vm = compileAndRun(src);
  check('alloc() bumps heap pointer by size (4 cells)', vm.output[0] === 4, `got ${vm.output[0]}`);
  check('memset() and memcpy() populate block memory (42)', vm.output[1] === 42 && vm.output[2] === 42, `got ${vm.output}`);
  check('memcmp() reports 0 on identical blocks', vm.output[3] === 0, `got ${vm.output[3]}`);
  check('memcmp() reports -1 when second block differs', vm.output[4] === -1, `got ${vm.output[4]}`);
}

// ---------------------------------------------------------------------------
// 5. String Routines (strlen, strcpy, strcmp, print_str)
// ---------------------------------------------------------------------------
console.log('\n>>> [5/7] Testing String Routines (strlen, strcpy, strcmp, print_str)...');

{
  const src = `
    fn main() {
      array s1[6] = "hello";
      array s2[6];
      strcpy(s2, s1);
      out(strlen(s2));
      out(strcmp(s1, s2));

      array s3[6] = "world";
      out(strcmp(s1, s3));

      print_str(s2);
      halt();
    }
  `;
  const vm = compileAndRun(src);
  check('strlen("hello") = 5', vm.output[0] === 5, `got ${vm.output[0]}`);
  check('strcmp(s1, s2) = 0 for identical copied string', vm.output[1] === 0, `got ${vm.output[1]}`);
  check('strcmp("hello", "world") = -1 (lexicographic comparison)', vm.output[2] === -1, `got ${vm.output[2]}`);
  const printed = String.fromCharCode(...vm.output.slice(3));
  check('print_str() emits sequential ASCII characters ("hello")', printed === 'hello', `got '${printed}'`);
}

// ---------------------------------------------------------------------------
// 6. Cryptographic Stream Cipher (aead_enc, aead_dec)
// ---------------------------------------------------------------------------
console.log('\n>>> [6/7] Testing Cryptographic Stream Cipher (aead_enc, aead_dec)...');

{
  const src = `
    fn main() {
      array buf[4] = [10, 20, 30, 40];
      let key = 5;

      aead_enc(buf, key, 4);
      out(buf[0]);
      out(buf[1]);
      out(buf[2]);
      out(buf[3]);

      aead_dec(buf, key, 4);
      out(buf[0]);
      out(buf[1]);
      out(buf[2]);
      out(buf[3]);
      halt();
    }
  `;
  const vm = compileAndRun(src);
  const ct = vm.output.slice(0, 4);
  const pt = vm.output.slice(4, 8);
  check('Ciphertext differs from plaintext', ct.some((c, i) => c !== [10, 20, 30, 40][i]), `ct=${ct}`);
  check('Decryption recovers exact original plaintext [10, 20, 30, 40]',
    pt.every((p, i) => p === [10, 20, 30, 40][i]), `pt=${pt}`);
}

// ---------------------------------------------------------------------------
// 7. Full Demo & Native Rust SIMD Cross-Execution Parity
// ---------------------------------------------------------------------------
console.log('\n>>> [7/7] Verifying Demo Program & Native Rust SIMD Engine Parity...');

{
  const demoPath = path.join(__dirname, '../programs/stdlib_demo.tril');
  const demoSrc = fs.readFileSync(demoPath, 'utf8');

  // Run on JavaScript TryteVM
  const jsVM = compileAndRun(demoSrc);
  const expected = [42, -1, 7, 9, 10, 40];
  check('programs/stdlib_demo.tril executes on JS TryteVM',
    jsVM.output.length === expected.length && jsVM.output.every((v, i) => v === expected[i]),
    `got ${jsVM.output}`);

  // Run on Native Rust TryteVM
  const hex = compileToHex(demoSrc);
  const tmpHex = path.join('/tmp', `stdlib_demo_${Date.now()}.hex`);
  fs.writeFileSync(tmpHex, hex);

  const cargoBin = process.env.CARGO || '/home/juzz/.cargo/bin/cargo';
  const rustOutput = execFileSync(cargoBin, [
    'run', '--quiet',
    '--manifest-path', path.join(__dirname, '../native/Cargo.toml'),
    '--bin', 'tryte',
    '--', 'run', tmpHex
  ], { encoding: 'utf8' });

  fs.unlinkSync(tmpHex);

  const match = rustOutput.match(/Output queue \(\d+ trytes\):\s*\[(.*?)\]/);
  const rustArr = match ? match[1].split(',').map(s => parseInt(s.trim(), 10)) : [];

  check('programs/stdlib_demo.tril executes on Native Rust SIMD TryteVM with exact parity',
    rustArr.length === jsVM.output.length && rustArr.every((v, i) => v === jsVM.output[i]),
    `Rust output: [${rustArr}] vs JS output: [${jsVM.output}]`);
}

console.log('\n===============================================================');
console.log(`ALL ${passedChecks}/${totalChecks} TRIL STDLIB CHECKS PASSED!`);
console.log('===============================================================\n');
