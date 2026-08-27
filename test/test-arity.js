'use strict';
/* test-arity.js — the n+1 arity ladder, and what makes a trajectory graph tree-like.
 *
 * Set `AI`. `AH2` found the binding constraint on an implied receipt: **trajectory
 * convergence**, not state size. A control space 500,000× larger than hailstone's
 * still handed a tabulator 3.20× reuse.
 *
 * The check worth keeping is `AI4`. Take an n-input function as shift-register
 * feedback — state (x1..xn), next (x2..xn, f(x1..xn)) — and if f is reversible in
 * its leading argument the state map is a **bijection**: every one of 531,441 states
 * has in-degree exactly 1, nothing merges, and a tabulator has nothing to amortise.
 * A collapsing feedback strands **91.22%** of the space instead.
 *
 * So `AB1`'s 216 tables were never a curiosity. They are exactly the feedback
 * functions that make a receipt possible, measured four sets before anyone knew what
 * they were for — and `AI3` shows that 216 = 6³ is one rung of a closed form.
 *
 * The exhaustive version is `npm run audit:arity`.
 */

const T = require('../src/ternary.js');
const E = require('../tools/erasure-audit.js');
const A = require('../tools/arity-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY FINDING ===');
{
  check('the operator is defined on the empty history and needs no genesis case',
    A.ladder(1)[0] === 0 && A.ladder(2)[1] === 0);
  check('an independent Fibonacci-with-two-zeros generator agrees on its own terms',
    A.fibTwoZeros(8).join() === '0,0,1,1,2,3,5,8');
  // The instrument that lied, kept because it refuted somebody else's finished work.
  check('the REJECTED reading is still visibly wrong — summing everything INCLUDING ' +
    'the last term gives the powers of two, not Fibonacci',
    (() => {
      const seq = [];
      while (seq.length < 8) seq.push(seq.reduce((a, b) => a + b, 0) + (seq.length > 0 ? 1 : 0));
      return seq.join() === '0,1,2,4,8,16,32,64';
    })());
  check('and it agrees with Fibonacci at only one term in forty, which is how a ' +
    'misread index announces itself',
    (() => {
      const seq = [];
      while (seq.length < 40) seq.push(seq.reduce((a, b) => a + b, 0) + (seq.length > 0 ? 1 : 0));
      const f = A.fibTwoZeros(40);
      return seq.filter((v, i) => v === f[i]).length === 1;
    })());
}

console.log('\n=== 0b. THE TOOL AS IT IS ACTUALLY RUN ===');
{
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'tools', 'arity-audit.js')], { encoding: 'utf8' });
  } catch (e) { code = 1; out = (e.stdout || '') + (e.message || ''); }
  check('the audit runs to completion as a program, not only as an import',
    code === 0, out.split('\n').slice(-3).join(' | '));
  check('and all four sections printed, so every log path executed',
    [/1\. AI1/, /2\. AI2/, /3\. AI3/, /4\. AI4/].every(r => r.test(out)));
}

console.log('\n=== 1. AI1 — THE HISTORY OPERATOR, REPLICATED ===');
{
  const h = A.ladder(40), f = A.fibTwoZeros(40);
  check('H(prev) = SUM prev + [prev != empty] reproduces Fibonacci with two zeros',
    h.join() === f.join());
  check('for all 40 terms, against the 9 the Ladder verified',
    h.filter((v, i) => v === f[i]).length === 40);
  check('the first twelve are 0, 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55',
    h.slice(0, 12).join() === '0,0,1,1,2,3,5,8,13,21,34,55');
  check('there is no special case at the genesis, which is the operator\'s whole ' +
    'claim to being more fundamental than the two-term recurrence',
    h[0] === 0 && h[1] === 0 && h[2] === 1);
  // The recurrence holds from the third term and FAILS at the second -- which is
  // exactly the Ladder's point: reading only the last two terms is what forces the
  // genesis to look like an exception. The operator has no such exception.
  check('the two-term recurrence holds from term three onward',
    h.slice(3).every((v, i) => v === h[i + 1] + h[i + 2]));
  check('and FAILS at term two, which is the genesis exception the operator does not have',
    h[2] !== h[0] + h[1] && h[2] === 1 && h[0] + h[1] === 0);
  // Three of four rivals fail exactly where the Ladder says.
  const sum = (L, n) => L.slice(0, n).reduce((a, b) => a + b, 0);
  const firstWrong = rule => { for (let n = 0; n < 9; n++) if (rule(f, n) !== f[n + 1]) return n; return null; };
  const wrongOf9 = rule => { let c = 0; for (let n = 0; n < 9; n++) if (rule(f, n) !== f[n + 1]) c++; return c; };
  check('rival "cur + last(prev)" first fails at step 1, as the Ladder records',
    firstWrong((L, n) => (n >= 1 ? L[n] + L[n - 1] : 0)) === 1);
  check('rival "sum(prev)" is wrong at 8 of 9 steps, as the Ladder records',
    wrongOf9(sum) === 8);
  check('rival "sum(prev) + 1" first fails at step 0, as the Ladder records',
    firstWrong((L, n) => sum(L, n) + 1) === 0);
  check('the fourth disagrees with the Ladder\'s stated step, and that is a fact ' +
    'about reading a four-word label rather than about its result',
    firstWrong((L, n) => L[n] + n) === 2);
}

console.log('\n=== 2. AI2 — THE ARITY LADDER CUBES ===');
{
  const F = n => 3n ** BigInt(3 ** n);
  check('n = 1, 2, 3 give 27, 19,683 and 7,625,597,484,987',
    F(1) === 27n && F(2) === 19683n && F(3) === 7625597484987n);
  check('every rung is exactly the cube of the last',
    [1, 2, 3].every(n => F(n + 1) === F(n) ** 3n));
  check('because 3^(3^(n+1)) = (3^(3^n))^3', F(2) === 27n ** 3n);
  check('AD4\'s width ladder multiplies by 729 per word instead',
    729n ** 4n === 282429536481n);
  check('so arity passes width at n = 3', F(3) > 729n ** 4n);
  check('and by n = 4 they are not in the same range — 39 digits against 15',
    F(4).toString().length === 39 && (729n ** 5n).toString().length === 15);
  check('one more input multiplies the space by the square of the whole current ' +
    'rung, where one more word multiplies it by 729 — a different operation, not a ' +
    'bigger one', F(4) / F(3) === F(3) ** 2n && F(3) ** 2n > 729n);
}

console.log('\n=== 3. AI3 — AB1 WAS ONE RUNG OF A CLOSED FORM ===');
{
  const revCount = n => 6n ** BigInt(3 ** (n - 1));
  const total = n => 3n ** BigInt(3 ** n);
  const frac = n => (2 / 9) ** (3 ** (n - 1));
  check('the count of leading-argument-reversible functions is 6^(3^(n-1))',
    revCount(1) === 6n && revCount(2) === 216n && revCount(3) === 10077696n);
  check('so the fraction is (2/9)^(3^(n-1)) — 22.22%, 1.097%, 0.000132%',
    Math.abs(100 * frac(1) - 22.22) < 0.01 &&
    Math.abs(100 * frac(2) - 1.097) < 0.001 &&
    Math.abs(100 * frac(3) - 0.0001322) < 1e-6);
  check('and it reproduces AB1\'s SWEPT figure of 216 of 19,683 exactly, from a ' +
    'formula rather than by enumerating every table',
    revCount(2) === 216n && total(2) === 19683n && E.reversibleTables.length === 216);
  check('216 is exactly 6^3', 6 ** 3 === 216);
  check('to four significant figures against the measurement',
    Math.abs(216 / 19683 - frac(2)) < 1e-9);
  check('the fraction collapses as arity grows — the arity version of the scarcity ' +
    'M1 found at fixed width', frac(3) < frac(2) / 1000);
}

console.log('\n=== 4. AI4 — THE FEEDBACK THAT MAKES A TREE ===');
{
  const revTable = E.reversibleTables[0];
  const r = A.inDegrees((a, b) => T.ttable(revTable, a, b));
  const nr = A.inDegrees((a, b) => T.tMIN(a, b));

  check('the two-input shift register has 531,441 states', r.total === 531441);
  check('with reversible feedback the state map is a BIJECTION: max in-degree 1',
    r.max === 1, `${r.max}`);
  check('zero unreachable states, and every state at in-degree exactly 1',
    r.unreachable === 0 && r.allOne);
  check('so nothing merges and a tabulator\'s reuse is exactly 1.00 — against ' +
    'AH2\'s 3.20 and hailstone\'s 10.43', r.allOne);
  check('a collapsing feedback is far worse than predicted: MIN reaches in-degree 729',
    nr.max === 729 && nr.max >= 3, `${nr.max}`);
  check('and strands 484,785 states — 91.22% unreachable, against a predicted quarter',
    nr.unreachable === 484785 && Math.abs(100 * nr.unreachableFrac - 91.22) < 0.01);
  check('so AB1\'s 216 tables are exactly the feedback functions that make the ' +
    'fourth factor come out right, measured four sets before anyone knew why',
    E.reversibleTables.length === 216 && r.allOne && !nr.allOne);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
