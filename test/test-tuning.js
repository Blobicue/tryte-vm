'use strict';
/* test-tuning.js — which musical layers favour which base?
 *
 * Set `AF`. `AE` measured one musical affordance and the write-up generalised it to
 * an entire art form. This set measures the layers that were skipped, because a
 * claim withdrawn without a replacement leaves the question open rather than
 * answered.
 *
 * Two checks are worth keeping. **`AF1` overturns the withdrawn claim in the
 * opposite direction**: summed over six just ratios, 27-EDO totals 45.48 cents of
 * error against 12-EDO's 64.41, and 81-EDO totals 22.84 — a ternary division of the
 * octave is a *better* consonance approximator than the twelve-tone one.
 *
 * And **`AF4` failed usefully**: the best consonance in 5..72 is 53-EDO, which is
 * prime. Harmonic symmetry and rhythm want compositeness; consonance does not care
 * about it at all. The layers decouple, and predicting that they would agree was
 * reaching for one sentence where the measurement supports two.
 *
 * The exhaustive version is `npm run audit:tuning`.
 */

const A = require('../tools/tuning-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;
const err = (n, r) => A.edoError(n, r).cents;

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY FINDING ===');
{
  check('a just fifth is 701.955 cents', near(A.CENTS(3 / 2), 701.955, 0.001));
  check('12-EDO reaches it in 7 steps, off by 1.955',
    A.edoError(12, 3 / 2).steps === 7 && near(err(12, 3 / 2), 1.955, 0.001));
  check('the octave is exact in every equal division, by construction',
    [5, 12, 27, 31, 81].every(n => err(n, 2) < 1e-9));
  check('1/3 terminates in base 3 and not base 2', A.exactIn(3, 3) && !A.exactIn(3, 2));
  check('1/8 terminates in base 2 and not base 3', A.exactIn(8, 2) && !A.exactIn(8, 3));
  check('1/6 terminates in NEITHER, because 6 = 2 x 3',
    !A.exactIn(6, 2) && !A.exactIn(6, 3) && A.exactIn(6, 6));
  check('and the harness would notice a wrong claim: 1/2 does terminate in base 2',
    A.exactIn(2, 2) === true);
  check('prime factors are found correctly: 12 is {2,3}, 27 is {3}',
    [...A.primeFactors(12)].join() === '2,3' && [...A.primeFactors(27)].join() === '3');
}

console.log('\n=== 0b. THE TOOL AS IT IS ACTUALLY RUN ===');
{
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'tools', 'tuning-audit.js')], { encoding: 'utf8' });
  } catch (e) { code = 1; out = (e.stdout || '') + (e.message || ''); }
  check('the audit runs to completion as a program, not only as an import',
    code === 0, out.split('\n').slice(-3).join(' | '));
  check('and all four sections printed, so every log path executed',
    [/1\. AF1/, /2\. AF2/, /3\. AF3/, /4\. AF4/].every(r => r.test(out)));
}

console.log('\n=== 1. AF1 — GOOD AT SOME INTERVALS, BAD AT OTHERS ===');
{
  check('27-EDO\'s fifth is 4.68x worse than 12-EDO\'s',
    near(err(27, 3 / 2) / err(12, 3 / 2), 4.68) && err(27, 3 / 2) / err(12, 3 / 2) > 4,
    `${(err(27, 3 / 2) / err(12, 3 / 2)).toFixed(2)}x`);
  check('but its harmonic seventh is 3.48x BETTER',
    near(err(12, 7 / 4) / err(27, 7 / 4), 3.48) && err(12, 7 / 4) / err(27, 7 / 4) > 3);
  check('and its minor third is better too — 4.53 against 15.64 cents',
    err(27, 6 / 5) < err(12, 6 / 5) && near(err(27, 6 / 5), 4.530) && near(err(12, 6 / 5), 15.641));
  check('so "ternary tuning is bad" is not a statement this measurement supports',
    err(27, 7 / 4) < err(12, 7 / 4) && err(27, 3 / 2) > err(12, 3 / 2));

  // The result nobody predicted, and the reason the withdrawn claim was not merely
  // too broad but pointed the wrong way.
  check('SUMMED over the six just ratios, 27-EDO BEATS 12-EDO: 45.48 against 64.41',
    near(A.totalError(27), 45.48, 0.02) && near(A.totalError(12), 64.41, 0.02) &&
    A.totalError(27) < A.totalError(12),
    `${A.totalError(27).toFixed(2)} vs ${A.totalError(12).toFixed(2)}`);
  check('and 81-EDO totals 22.84, roughly a third of 12-EDO\'s error',
    near(A.totalError(81), 22.84, 0.02) && A.totalError(81) < A.totalError(12) / 2);
  check('the single biggest reason is 12-EDO\'s harmonic seventh, 31 cents out',
    near(err(12, 7 / 4), 31.174, 0.01) &&
    err(12, 7 / 4) === Math.max(...A.JUST.filter(j => j.r !== 2).map(j => err(12, j.r))));
}

console.log('\n=== 2. AF2 — POWERS OF TWO ARE DIVISOR-POOR TOO ===');
{
  const pows = [2, 4, 8, 16, 32, 64, 3, 9, 27, 81].filter(n => n <= 100);
  const bestPow = Math.max(...pows.map(n => A.divisors(n).length));
  let best = 1;
  for (let n = 1; n <= 100; n++) if (A.divisors(n).length > A.divisors(best).length) best = n;
  check('no power of two or three below 100 exceeds 7 divisors', bestPow === 7, `${bestPow}`);
  check('while the best in that range is 60, with 12',
    best === 60 && A.divisors(60).length === 12);
  check('32 has 6 divisors and 27 has 4 — a difference of exactly 2',
    A.divisors(32).length === 6 && A.divisors(27).length === 4);
  check('so powers of two are poor on the SAME SCALE as powers of three',
    Math.abs(A.divisors(32).length - A.divisors(27).length) <= 2);
  check('and 12 = 2^2 x 3 is a power of neither radix',
    [...A.primeFactors(12)].length === 2 && 12 % 2 === 0 && 12 % 3 === 0);
  check('AE2 was never a binary-versus-ternary result: the advantage is compositeness',
    A.divisors(12).length > A.divisors(16).length && A.divisors(12).length > A.divisors(9).length);
}

console.log('\n=== 3. AF3 — RHYTHM DOES NOT FAVOUR TERNARY EITHER ===');
{
  const SUBS = [2, 3, 4, 6, 8, 12];
  const c2 = SUBS.filter(d => A.exactIn(d, 2)).length;
  const c3 = SUBS.filter(d => A.exactIn(d, 3)).length;
  check('base two represents 3 of the 6 common subdivisions exactly', c2 === 3, `${c2}`);
  check('base three represents exactly 1', c3 === 1, `${c3}`);
  check('so the offhand claim that rhythm favours base three is WRONG on the ' +
    'ordinary repertoire — Western notation is halves, quarters and eighths', c2 > c3);
  check('the two neither base gets are 1/6 and 1/12',
    SUBS.filter(d => !A.exactIn(d, 2) && !A.exactIn(d, 3)).join() === '6,12');
  check('and those are exactly the ones with BOTH 2 and 3 as factors',
    SUBS.filter(d => !A.exactIn(d, 2) && !A.exactIn(d, 3)).every(d => d % 2 === 0 && d % 3 === 0));
  check('base six gets all six — compositeness again, from a different direction',
    SUBS.every(d => A.exactIn(d, 6)));
}

console.log('\n=== 4. AF4 — FAILED: THE LAYERS DECOUPLE ===');
{
  const RANGE = []; for (let n = 5; n <= 72; n++) RANGE.push(n);
  const bestTune = RANGE.reduce((a, b) => (A.totalError(b) < A.totalError(a) ? b : a));
  const bestDiv = RANGE.reduce((a, b) => (A.divisors(b).length > A.divisors(a).length ? b : a));
  check('the lowest total consonance error in 5..72 is at n = 53',
    bestTune === 53, `${bestTune}`);
  check('AF4 FAILED and stays failed: 53 is PRIME, divisible by neither 2 nor 3',
    A.divisors(53).length === 2 && 53 % 2 !== 0 && 53 % 3 !== 0);
  check('and 31 is close behind at 18.19 cents — also prime',
    near(A.totalError(31), 18.19, 0.02) && A.divisors(31).length === 2);
  check('the divisor clause DID hold: the most divisors in range is 60, divisible by both',
    bestDiv === 60 && 60 % 6 === 0);
  check('so harmonic symmetry and rhythm want compositeness and consonance does not ' +
    'care about it at all — the layers decouple rather than agree',
    bestTune % 6 !== 0 && bestDiv % 6 === 0);
  check('consonance is a question about n*log2(r) landing near an integer, which has ' +
    'nothing to do with how n factors',
    A.totalError(53) < A.totalError(60) && A.divisors(53).length < A.divisors(60).length);
  check('the best pure power of three in range is beaten by smaller divisions',
    RANGE.filter(n => n < 27 && A.totalError(n) < A.totalError(27)).length === 3);
  check('and the best pure power of two is beaten by eighteen of them',
    RANGE.filter(n => n < 64 && A.totalError(n) < A.totalError(64)).length === 18);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
