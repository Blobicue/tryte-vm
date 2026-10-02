'use strict';
/* ---------------------------------------------------------------------------
 * test-dag-compiler.js — Automated Tests for Compositional DAG Compiler
 * ---------------------------------------------------------------------------
 * Verifies:
 *  1. AST parsing of algebraic expressions and fold expressions
 *  2. Monoid table folding (T.foldTables) reducing N stages to 1 cycle
 *  3. Bit-exact soundness across all 9 trit input pairs vs stepwise evaluation
 *  4. Folding associativity: fold(A, B, C) == fold(fold(A, B), C)
 *  5. TASM code emission and direct TryteVM execution
 *  6. TryteJIT integration on uncached operator synthesis
 *  7. Interactive shell integration via tsh CLI
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const { execSync } = require('child_process');
const { DAGCompiler, parseExpression, TABLE_PRESETS } = require('../src/dag_compiler.js');
const T = require('../src/ternary.js');

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

console.log('Running Compositional DAG Compiler Test Suite...\n');

// 1. AST Parsing
test('parseExpression correctly handles fold chains, infix, and identifiers', () => {
  const fAst = parseExpression('fold(min, neg, max)');
  assert.deepStrictEqual(fAst, ['fold', 'min', 'neg', 'max']);

  const addAst = parseExpression('x + y');
  assert.deepStrictEqual(addAst, ['+', 'x', 'y']);

  const mulAst = parseExpression('a * b');
  assert.deepStrictEqual(mulAst, ['*', 'a', 'b']);

  const identAst = parseExpression('add_mod_3');
  assert.strictEqual(identAst, 'add_mod_3');
});

// 2. Monoid Table Folding & Soundness
test('foldChain collapses 3 stages into 1 table with bit-exact correctness for all 9 trit inputs', () => {
  const compiler = new DAGCompiler();
  const plan = compiler.compile('fold(min, neg, max)');

  assert.strictEqual(plan.type, 'folded_table');
  assert.strictEqual(plan.stagesFolded, 3);
  assert.strictEqual(plan.foldedTable.length, 9);

  // Check all 9 combinations against sequential evaluation: y_out = max(-min(x, y), y)
  for (let x of [-1, 0, 1]) {
    for (let y of [-1, 0, 1]) {
      const step1 = Math.min(x, y);
      const step2 = -step1;
      const expected = Math.max(step2, y);

      const res = compiler.run('fold(min, neg, max)', [x, y]);
      assert.strictEqual(res.output[0], expected, `Mismatch for (${x}, ${y}): got ${res.output[0]}, expected ${expected}`);
    }
  }
});

// 3. Monoid Associativity
test('Table folding is strictly associative: fold(fold(A, B), C) == fold(A, B, C)', () => {
  const tA = TABLE_PRESETS.min;
  const tB = TABLE_PRESETS.neg;
  const tC = TABLE_PRESETS.max;

  const foldedAll = T.foldTables(tA, tB, tC);
  const foldedLeft = T.foldTables(T.foldTables(tA, tB), tC);
  const foldedRight = T.foldTables(tA, T.foldTables(tB, tC));

  assert.deepStrictEqual(foldedAll, foldedLeft);
  assert.deepStrictEqual(foldedAll, foldedRight);
});

// 4. Infix and Elementary Execution on TryteVM
test('Compiles and executes infix and elementary expressions on TryteVM', () => {
  const compiler = new DAGCompiler();

  // x + y on inputs [1, 1] -> 2 mod 3 = -1 in balanced ternary
  const resAdd = compiler.run('x + y', [1, 1]);
  assert.deepStrictEqual(resAdd.output, [-1]);
  assert.strictEqual(resAdd.halted, true);

  // x + y on inputs [-1, 1] -> 0
  const resAdd0 = compiler.run('x + y', [-1, 1]);
  assert.deepStrictEqual(resAdd0.output, [0]);

  // min on inputs [1, -1] -> -1
  const resMin = compiler.run('min', [1, -1]);
  assert.deepStrictEqual(resMin.output, [-1]);
});

// 5. JIT Grokking Integration for Uncached Operator
test('DAGCompiler seamlessly invokes TryteJIT to forge and execute uncached operators', () => {
  const fs = require('fs');
  const path = require('path');
  const cachePath = path.resolve(__dirname, '../research/arsenal/circuit_cache.json');
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

  // Ensure nor_ternary is removed to test genuine synthesis
  delete cache.circuits['nor_ternary'];
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  const compiler = new DAGCompiler();
  // nor_ternary: -max(x, y). For x = 1, y = 0 -> -max(1, 0) = -1
  const res = compiler.run('nor_ternary', [1, 0]);
  assert.deepStrictEqual(res.output, [-1]);

  // Verify it is now registered in cache
  const updatedCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  assert.ok(updatedCache.circuits['nor_ternary']);
  assert.strictEqual(updatedCache.circuits['nor_ternary'].lean_certified, true);
});

// 6. Shell CLI integration (tsh.js)
test('tsh CLI supports compile expr and eval commands', () => {
  const compileOut = execSync('node quantum/cli/tsh.js -c \'compile expr "fold(min, neg, max)"\'', {
    encoding: 'utf8',
  });
  assert.ok(compileOut.includes('Stages Folded       : 3 -> 1 single cycle'));
  assert.ok(compileOut.includes('Emitted TASM Bytecode:'));

  const evalOut = execSync('node quantum/cli/tsh.js -c \'eval "fold(min, neg, max)" 1 -1\'', {
    encoding: 'utf8',
  });
  assert.ok(evalOut.includes('Expression Evaluated : fold(min, neg, max)'));
  assert.ok(evalOut.includes('Output               : [1]'));
  assert.ok(evalOut.includes('Cycles               : 9 steps (folded: 3 stages)'));
});

console.log(`\nDAG Compiler Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
