'use strict';
/* test-solver.js — what does the packed representation buy a switch-level solver,
 * and what does WebAssembly buy on top of it?
 *
 * Set `AV`. Say which check here is the one worth keeping, and why — usually the
 * prediction that failed, because that is where this corpus has learned most.
 *
 * SECTION 0 IS NOT OPTIONAL HERE. This set times three solvers against each other,
 * and a ratio between two solvers that disagree is a fact about neither. R1 and R2
 * must be held against R0 — exhaustively on every small builder, on all 27 input
 * triples of both adder cells, and on a network that does NOT settle, so the
 * throw-at-the-cap bound is compared and not just the levels — before any number
 * below is read as a measurement.
 *
 * The exhaustive version is `npm run audit:solver`.
 */

const A = require('../tools/solver-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // 0a. The construction is the one the registration described. A set whose subject
  // is not the subject it cites is measuring something nobody registered.

  // 0b. THE TOOL AS IT IS ACTUALLY RUN. T-TOOL-CHECKED-ONLY-BY-IMPORT: importing a
  // tool sets MAIN false, so every log line is skipped and a fault in the report path
  // stays invisible to a suite that only imports. Run the real thing.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'solver-audit.js')],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('SOLVER AUDIT') && out.includes('AV1'));

  // 0c. Check the pipeline against a case whose answer is known independently.
}

console.log('\n=== 1. AV1  where R0 spends its time ===');
{
  check('AV1 ...', false, 'not yet measured');
}

console.log('\n=== 2. AV2  R1 over R0: what the representation buys ===');
{
  check('AV2 ...', false, 'not yet measured');
}

console.log('\n=== 3. AV3  R2 over R1: what WebAssembly buys ===');
{
  check('AV3 ...', false, 'not yet measured');
}

console.log('\n=== 4. AV4  the same ratio at 2.8x the size ===');
{
  check('AV4 ...', false, 'not yet measured');
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
