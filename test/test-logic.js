'use strict';
/* test-logic.js — the machine's gates ARE three-valued logic.
 *
 *      -1 = false      0 = unknown      +1 = true
 *
 * Under that reading MIN, MAX and NEG are not analogies for AND, OR and NOT.
 * They are exactly the connectives of Kleene's strong three-valued logic, on all
 * twelve rows — which is also the logic SQL uses for NULL.
 *
 * A precision worth keeping: for these three connectives Kleene's K3 and
 * Łukasiewicz's Ł3 are identical. The two logics diverge only at implication,
 * and this machine has no implication operator, so naming either is fair.
 *
 * The tests that matter most are the ones that FAIL classically: the law of the
 * excluded middle and the law of non-contradiction both break at `unknown`. If
 * they held, this would be two-valued logic with a spare state lying around.
 */

const fs = require('fs');
const path = require('path');
const T = require('../src/ternary.js');
const { runNative } = require('../src/selfhost.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const F = -1, U = 0, TT = 1;
const VALS = [F, U, TT];
const nm = v => (v === F ? 'false' : v === U ? 'unknown' : 'true');

/* Single-trit values, so the gates act on one truth value. */
const AND = (a, b) => T.tMIN(a, b);
const OR  = (a, b) => T.tMAX(a, b);
const NOT = a => T.neg(a);

console.log('\n=== 1. THE PUBLISHED TRUTH TABLES OF KLEENE K3 ===');
// Transcribed from the standard tables, not derived from min/max.
const K_AND = { '-1,-1': F, '-1,0': F, '-1,1': F, '0,-1': F, '0,0': U, '0,1': U, '1,-1': F, '1,0': U, '1,1': TT };
const K_OR  = { '-1,-1': F, '-1,0': U, '-1,1': TT, '0,-1': U, '0,0': U, '0,1': TT, '1,-1': TT, '1,0': TT, '1,1': TT };
const K_NOT = { '-1': TT, '0': U, '1': F };
check('MIN reproduces Kleene AND on all nine rows',
  Object.entries(K_AND).every(([k, want]) => { const [a, b] = k.split(',').map(Number); return AND(a, b) === want; }));
check('MAX reproduces Kleene OR on all nine rows',
  Object.entries(K_OR).every(([k, want]) => { const [a, b] = k.split(',').map(Number); return OR(a, b) === want; }));
check('NEG reproduces Kleene NOT on all three rows',
  Object.entries(K_NOT).every(([k, want]) => NOT(Number(k)) === want));

console.log('\n=== 2. THE CLASSICAL LAWS THAT MUST BREAK ===');
check('excluded middle FAILS: unknown OR NOT unknown = unknown, not true',
  OR(U, NOT(U)) === U, nm(OR(U, NOT(U))));
check('...but still holds for the two definite values',
  OR(F, NOT(F)) === TT && OR(TT, NOT(TT)) === TT);
check('non-contradiction FAILS: unknown AND NOT unknown = unknown, not false',
  AND(U, NOT(U)) === U, nm(AND(U, NOT(U))));
check('...and holds for the definite values',
  AND(F, NOT(F)) === F && AND(TT, NOT(TT)) === F);
check('so this is genuinely three-valued, not binary with a spare state',
  OR(U, NOT(U)) !== TT && AND(U, NOT(U)) !== F);

console.log('\n=== 3. THE LAWS THAT MUST SURVIVE ===');
const pairs = [];
for (const a of VALS) for (const b of VALS) pairs.push([a, b]);
check('double negation: NOT NOT a = a', VALS.every(a => NOT(NOT(a)) === a));
check('De Morgan: NOT(a AND b) = NOT a OR NOT b',
  pairs.every(([a, b]) => NOT(AND(a, b)) === OR(NOT(a), NOT(b))));
check('De Morgan: NOT(a OR b) = NOT a AND NOT b',
  pairs.every(([a, b]) => NOT(OR(a, b)) === AND(NOT(a), NOT(b))));
check('commutative, associative, idempotent',
  pairs.every(([a, b]) => AND(a, b) === AND(b, a) && OR(a, b) === OR(b, a)) &&
  VALS.every(a => VALS.every(b => VALS.every(c =>
    AND(AND(a, b), c) === AND(a, AND(b, c)) && OR(OR(a, b), c) === OR(a, OR(b, c))))) &&
  VALS.every(a => AND(a, a) === a && OR(a, a) === a));
check('absorption: a AND (a OR b) = a',
  pairs.every(([a, b]) => AND(a, OR(a, b)) === a));
check('false annihilates AND, true annihilates OR — even against unknown',
  VALS.every(a => AND(F, a) === F && OR(TT, a) === TT));

console.log('\n=== 4. THIS IS SQL NULL SEMANTICS ===');
// The four rows every SQL tutorial teaches, checked against the machine.
check('unknown AND false = false   (the answer is settled either way)', AND(U, F) === F);
check('unknown AND true  = unknown (it still depends)', AND(U, TT) === U);
check('unknown OR  true  = true    (settled)', OR(U, TT) === TT);
check('unknown OR  false = unknown (still depends)', OR(U, F) === U);

console.log('\n=== 5. THE DEMO PROGRAM AGREES ===');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'programs', 'kleene.tasm'), 'utf8');
  let bad = null;
  for (const [a, b] of pairs) {
    const o = runNative(src, [a, b]).output;
    const want = [NOT(a), AND(a, b), OR(a, b), OR(a, NOT(a))];
    if (o.join() !== want.join()) { bad = `${nm(a)},${nm(b)} -> ${o} want ${want}`; break; }
  }
  check('kleene.tasm matches the logic on all nine input pairs', bad === null, bad || '');
  check('and reports unknown for the excluded middle when a is unknown',
    runNative(src, [U, TT]).output[3] === U);
}

console.log('\n=== 6. SIX CONJUNCTIONS IN ONE INSTRUCTION ===');
{
  // A tryte holds six independent truth values, and one MIN evaluates all six
  // conjunctions at once. The gates were always tritwise; naming them logic
  // makes that a feature rather than an implementation detail.
  let bad = null;
  for (let i = 0; i < 200; i++) {
    const x = T.TRYTE_MIN + (i * 7) % T.TRYTE_STATES;
    const y = T.TRYTE_MIN + (i * 13) % T.TRYTE_STATES;
    const got = T.toTrits(T.tMIN(x, y));
    const want = T.toTrits(x).map((t, j) => AND(t, T.toTrits(y)[j]));
    if (got.join() !== want.join()) { bad = `${x},${y}`; break; }
  }
  check('one MIN performs six independent Kleene conjunctions', bad === null, bad || '');
  check('...and TGATE can run a different connective in each of the six positions',
    T.toTrits(T.tgate(T.parseTritString('+0-+0-'), 40, -13))
      .every((t, i) => {
        const mode = T.toTrits(T.parseTritString('+0-+0-'))[i];
        const xs = T.toTrits(40)[i], ys = T.toTrits(-13)[i];
        return t === (mode === -1 ? NOT(xs) : mode === 0 ? AND(xs, ys) : OR(xs, ys));
      }));
}

console.log('\n=== 7. WHY BASE THREE AT ALL ===');
{
  // The actual historical argument for Setun. Cost of representing N values in
  // base b: b states per digit, times the digits needed.
  const cost = (b, N) => b * Math.ceil(Math.log(N) / Math.log(b));
  const N = 1e6;
  const costs = [2, 3, 4, 5, 6, 8, 10].map(b => [b, cost(b, N)]);
  const best = Math.min(...costs.map(c => c[1]));
  check(`base 3 is the cheapest integer radix (costs ${costs.map(c => c[0] + ':' + c[1]).join(' ')})`,
    costs.find(c => c[1] === best)[0] === 3);
  check('it beats base 2 and base 4, which tie with each other',
    cost(3, N) < cost(2, N) && cost(2, N) === cost(4, N));
  check('because the continuous optimum is e = 2.718..., and 3 is the nearest integer',
    Math.abs(Math.E - 3) < Math.abs(Math.E - 2));
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
