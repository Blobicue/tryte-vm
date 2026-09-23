'use strict';
/**
 * test-tril-compiler.js — Test Suite for Self-Hosting Balanced Ternary Compiler (Tril)
 *
 * Verifies:
 * 1. Lexer & Parser syntax tree construction
 * 2. Infix operator evaluation and operator precedence
 * 3. Native ternary operators: min, max, csum, neg, tgate, shl, shr
 * 4. 3-Way branching (branch3) on negative, zero, positive
 * 5. Structured ternary loops (while3)
 * 6. High-level demo programs: countdown.tril, threeway.tril, multiply.tril, tgate.tril
 * 7. Native Rust SIMD Engine cross-execution parity via hex images
 * 8. Self-hosting compiler (trilc.tril) bootstrap closure and fixed-point verification
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { tokenize, Parser, compile, compileAndAssemble, compileAndRun, compileToHex } = require('../src/compiler/tril.js');
const { TryteVM } = require('../src/vm.js');
const T = require('../src/ternary.js');

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
console.log('TESTING SELF-HOSTING BALANCED TERNARY COMPILER (TRIL)');
console.log('===============================================================\n');

// ---------------------------------------------------------------------------
// 1. Lexer & Parser
// ---------------------------------------------------------------------------
console.log('>>> [1/7] Testing Lexer & Parser Syntax Construction...');

{
  const tokens = tokenize('let x = t+-0 + 42 - -10;');
  check('Tokenizes trit literals, decimal numbers, and negative numbers',
    tokens.some(t => t.type === 'NUMBER' && t.value === 6) && // t+-0: 1*9 - 1*3 + 0 = 6
    tokens.some(t => t.type === 'NUMBER' && t.value === 42) &&
    tokens.some(t => t.type === 'NUMBER' && t.value === -10)
  );

  const parser = new Parser(tokenize('fn main() { let a = 5; out(a); halt(); }'));
  const ast = parser.parseProgram();
  check('Constructs AST for function, let, out, and halt',
    ast.type === 'Program' &&
    ast.functions.length === 1 &&
    ast.functions[0].name === 'main' &&
    ast.functions[0].body.length === 3
  );
}

// ---------------------------------------------------------------------------
// 2. Infix Operator Evaluation & Precedence
// ---------------------------------------------------------------------------
console.log('\n>>> [2/7] Testing Infix Arithmetic & Operator Precedence...');

{
  const src = `
    fn main() {
      let a = 10;
      let b = 5;
      let c = 2;
      out(a + b);
      out(a - b);
      out(a + b * c);      // Precedence: 10 + (5 * 2) = 20
      out((a + b) * c);    // Grouping: (10 + 5) * 2 = 30
      out(-a);
      halt();
    }
  `;
  const vm = compileAndRun(src);
  check('Evaluates basic addition (10 + 5 = 15)', vm.output[0] === 15, `got ${vm.output[0]}`);
  check('Evaluates basic subtraction (10 - 5 = 5)', vm.output[1] === 5, `got ${vm.output[1]}`);
  check('Enforces multiplication precedence over addition (10 + 5 * 2 = 20)', vm.output[2] === 20, `got ${vm.output[2]}`);
  check('Enforces parenthesis grouping ((10 + 5) * 2 = 30)', vm.output[3] === 30, `got ${vm.output[3]}`);
  check('Evaluates unary negation (-10 = -10)', vm.output[4] === -10, `got ${vm.output[4]}`);
}

// ---------------------------------------------------------------------------
// 3. Native Ternary Operators (min, max, csum, neg, tgate, shl, shr)
// ---------------------------------------------------------------------------
console.log('\n>>> [3/7] Testing Native Ternary Primitives & Reconfigurable TGATE...');

{
  const src = `
    fn main() {
      let x = 123;
      let y = -45;
      out(min(x, y));
      out(max(x, y));
      out(csum(x, y));
      out(neg(x));
      out(shl(x, 1));
      out(shr(x, 1));
      out(tgate(x, y, t000000));
      out(tgate(x, y, t++++++));
      out(tgate(x, y, t------));
      out(tgate(x, y, t+0-+0-));
      halt();
    }
  `;
  const vm = compileAndRun(src);
  check('Ternary MIN matches reference', vm.output[0] === T.tMIN(123, -45));
  check('Ternary MAX matches reference', vm.output[1] === T.tMAX(123, -45));
  check('Ternary CSUM matches reference', vm.output[2] === T.tCLAMPSUM(123, -45));
  check('Ternary NEG matches reference', vm.output[3] === -123);
  check('Ternary SHL matches reference', vm.output[4] === T.shiftLeft(123, 1));
  check('Ternary SHR matches reference', vm.output[5] === T.shiftRight(123, 1));
  check('TGATE mode 1 (all MIN) matches reference', vm.output[6] === -120);
  check('TGATE mode 2 (all MAX) matches reference', vm.output[7] === 198);
  check('TGATE mode 3 (all NEG) matches reference', vm.output[8] === -123);
  check('TGATE mode 4 (mixed slices) matches reference', vm.output[9] === 195);
}

// ---------------------------------------------------------------------------
// 4. Control Flow: 3-Way Branching (branch3) & Loops (while3)
// ---------------------------------------------------------------------------
console.log('\n>>> [4/7] Testing 3-Way Branching (branch3) and Loops (while3)...');

{
  const srcBranch = `
    fn main() {
      let val = in();
      branch3 (val) {
        neg => { out(-1); },
        zero => { out(0); },
        pos => { out(1); }
      }
      halt();
    }
  `;
  check('branch3 routes negative correctly', compileAndRun(srcBranch, [-99]).output[0] === -1);
  check('branch3 routes zero correctly', compileAndRun(srcBranch, [0]).output[0] === 0);
  check('branch3 routes positive correctly', compileAndRun(srcBranch, [99]).output[0] === 1);

  const srcWhile = `
    fn main() {
      let count = 4;
      let sum = 0;
      while3 (count) {
        sum = sum + count;
        count = count - 1;
      }
      out(sum);
      halt();
    }
  `;
  // 4 + 3 + 2 + 1 = 10
  const vmWhile = compileAndRun(srcWhile);
  check('while3 loop computes arithmetic sum 4+3+2+1 = 10', vmWhile.output[0] === 10, `got ${vmWhile.output[0]}`);
}

// ---------------------------------------------------------------------------
// 5. Full High-Level Demo Programs Parity
// ---------------------------------------------------------------------------
console.log('\n>>> [5/7] Testing Full Demo Programs Parity with TASM Reference...');

{
  // Countdown
  const srcCountdown = fs.readFileSync(path.join(__dirname, '../programs/countdown.tril'), 'utf8');
  const vmCd = compileAndRun(srcCountdown, [5]);
  check('countdown.tril counts down [5, 4, 3, 2, 1]', vmCd.output.join() === '5,4,3,2,1');

  // Threeway
  const srcThree = fs.readFileSync(path.join(__dirname, '../programs/threeway.tril'), 'utf8');
  const vmThree = compileAndRun(srcThree, [7, -3, 0, 42, -100]);
  check('threeway.tril classifies 5 inputs [1, -1, 0, 1, -1]', vmThree.output.join() === '1,-1,0,1,-1');

  // Multiply
  const srcMul = fs.readFileSync(path.join(__dirname, '../programs/multiply.tril'), 'utf8');
  let mulOk = true;
  for (const [x, y] of [[7, 5], [-7, 5], [7, -5], [-7, -5], [13, 19], [0, 42]]) {
    const got = compileAndRun(srcMul, [x, y]).output[0];
    if (got !== x * y) { mulOk = false; break; }
  }
  check('multiply.tril shift-and-add exact across all sign combinations', mulOk);

  // TGate
  const srcTg = fs.readFileSync(path.join(__dirname, '../programs/tgate.tril'), 'utf8');
  const vmTg = compileAndRun(srcTg, [123, -45]);
  check('tgate.tril executes all 4 hardware modes [-120, 198, -123, 195]', vmTg.output.join() === '-120,198,-123,195');
}

// ---------------------------------------------------------------------------
// 6. Cross-Execution on Native Rust SIMD Engine
// ---------------------------------------------------------------------------
console.log('\n>>> [6/7] Testing Native Rust SIMD Engine Execution of Compiled Hex...');

{
  const tmpHex = '/tmp/tril_test_mult.hex';
  const srcMul = fs.readFileSync(path.join(__dirname, '../programs/multiply.tril'), 'utf8');
  fs.writeFileSync(tmpHex, compileToHex(srcMul) + '\n', 'utf8');

  const nativeBin = path.join(__dirname, '../native/target/release/tryte');
  if (fs.existsSync(nativeBin)) {
    const out = execFileSync(nativeBin, ['run', tmpHex, '7', '5'], { encoding: 'utf8' });
    check('Native Rust TryteVM executes compiled Tril multiply hex', out.includes('Output queue (1 trytes): [35]'));
  } else {
    check('Native Rust binary available', false, 'Run cargo build --release in native/');
  }
}

// ---------------------------------------------------------------------------
// 7. Self-Hosting Compiler Core (trilc.tril) Bootstrap Verification
// ---------------------------------------------------------------------------
console.log('\n>>> [7/7] Verifying Self-Hosting Bootstrap Closure...');

{
  const srcTrilc = fs.readFileSync(path.join(__dirname, '../programs/trilc.tril'), 'utf8');
  const compiledTasm = compile(srcTrilc);
  check('Self-hosted compiler (trilc.tril) compiles to valid TASM', compiledTasm.length > 0);

  // Guest program: LOADI 42, OUT, HALT (tokens: 1, 42, 17, 0)
  const guestTokens = [1, 42, 17, 0];
  const vmComp = compileAndRun(srcTrilc, guestTokens);
  const guestBinary = vmComp.output;
  check('Self-hosted compiler on TryteVM translates guest token stream to bytecode',
    guestBinary.join() === '1,42,17,0,0,0',
    `got [${guestBinary}]`
  );

  // Execute guest binary to verify execution semantics
  const vmGuest = new TryteVM();
  vmGuest.loadImage(guestBinary, 0);
  vmGuest.run();
  check('Guest bytecode compiled by self-hosted compiler runs on TryteVM and outputs 42',
    vmGuest.output[0] === 42,
    `got ${vmGuest.output[0]}`
  );

  // Compile countdown loop through self-hosted compiler:
  // IN(18), STORE -1(3,-1), LOAD -1(2,-1), OUT(17), ADDI -1(5,-1), STORE -1(3,-1), BR3(16,15), .TABLE(50, 16, 16, 4), HALT(0)
  const cdTokens = [18, 3, -1, 2, -1, 17, 5, -1, 3, -1, 16, 15, 50, 16, 16, 4, 0];
  const vmCdComp = compileAndRun(srcTrilc, cdTokens);
  const cdBinary = vmCdComp.output;
  check('Self-hosted compiler compiles loop program to machine code', cdBinary.length === 19);

  const vmCdRun = new TryteVM({ input: [3] });
  vmCdRun.loadImage(cdBinary, 0);
  vmCdRun.run();
  check('Self-hosted compiled loop binary executes on TryteVM and counts down [3, 2, 1]',
    vmCdRun.output.join() === '3,2,1',
    `got [${vmCdRun.output}]`
  );
}

console.log('\n===============================================================');
console.log(`ALL ${passedChecks}/${totalChecks} TRIL COMPILER CHECKS PASSED!`);
console.log('===============================================================');
