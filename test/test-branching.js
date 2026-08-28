'use strict';
/* test-branching.js — set AQ, the branching factor of an authenticated tree.
 *
 * REGISTRATION SKELETON. This file exists in the registering commit so that the
 * predictions and the shape of their test are both on the record before any number
 * is. The sections below are the four registered claims and the instrument checks
 * that have to pass before any of them may be scored; the assertions land in the
 * results commit.
 *
 * The predictions, in the words they were registered in, are in the header of
 * tools/branching-audit.js. They are:
 *
 *   AQ1  binary is never optimal for a vector commitment, and the floor is 3 or 4
 *   AQ2  a power of three is the argmin in more cells than a power of two
 *   AQ3  unit invariance FAILS -- whole trytes move at least one argmin
 *   AQ4  64 and 256 are the same choice, to within 15%
 *
 * Section 0 is not optional and does not depend on any of them. If the CONTROL
 * regime -- structureless per-level noise -- also produces a clean interior optimum
 * that moves smoothly with gamma, then this sweep is reporting the shape of its own
 * arithmetic and every verdict below is an artifact. That check is written first
 * because T-INSTRUMENT-FALSE-VERDICT has bitten seventeen times and not one of those
 * catches came from reading the code.
 */

const A = require('../tools/branching-audit.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
// depth() by multiplication, never by dividing logarithms -- the exact-power trap
// that cost AP a key position, in the direction that flattered binary.
check('depth is exact at the powers, where a logarithm would not be',
  A.depth(729, 3) === 6 && A.depth(1024, 2) === 10 && A.depth(3 ** 12, 3) === 12);
check('   and it is a CEILING, so one leaf over a power costs a whole level',
  A.depth(730, 3) === 7 && A.depth(1025, 2) === 11);
check('   and a wider tree is never deeper than a narrower one',
  A.LEAVES.every(n => A.ARITIES.every(b => b === 2 || A.depth(n, b) <= A.depth(n, b - 1))));

// TODO(results): the control must NOT look like the vector regime.
// TODO(results): every regime's cost must rise with gamma at fixed arity.

console.log('\n=== 1. AQ1 — BINARY IS NEVER OPTIMAL, AND THE FLOOR IS THREE OR FOUR ===');
// TODO(results): no vector cell has argmin 2; large-gamma optima lie in {3, 4};
//                which of 3 and 4 takes more leaf counts.

console.log('\n=== 2. AQ2 — POWERS OF THREE AGAINST POWERS OF TWO ===');
// TODO(results): cell counts, against the ten-to-six handicap.

console.log('\n=== 3. AQ3 — WHETHER THE UNIT IS FREE ===');
// TODO(results): argmins in bytes against argmins in whole trytes.

console.log('\n=== 4. AQ4 — SIXTY-FOUR AGAINST TWO HUNDRED AND FIFTY-SIX ===');
// TODO(results): the spread between them where either is near-optimal.

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
