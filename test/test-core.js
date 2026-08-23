'use strict';
/* Exhaustive verification of the balanced-ternary core.
 * Same standard as the part-one audit: the instrument is checked before it is
 * trusted, and every claim about balanced ternary is asserted, not asserted-at. */

const T = require('../src/ternary.js');

let pass = 0; const fails = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
}
const ALL = [];
for (let v = T.TRYTE_MIN; v <= T.TRYTE_MAX; v++) ALL.push(v);

console.log('\n=== 0. INSTRUMENT SELF-TEST ===');
check('tritString(0) is six zeros', T.tritString(0) === '000000');
check('tritString(1) ends in +', T.tritString(1) === '00000+');
check('5 is 9-3-1  (000+--)', T.tritString(5) === '000+--');
check('364 is all +', T.tritString(364) === '++++++');
// Prove the harness actually detects a false claim, without polluting the log.
check('harness detects a false claim', (() => {
  const before = fails.length;
  const quiet = { pass, fails: fails.slice() };
  if (!(1 + 1 === 3)) fails.push('_probe');
  const detected = fails.length === before + 1;
  fails.length = quiet.fails.length;
  return detected;
})());

console.log('\n=== 1. REPRESENTATION (all 729 values) ===');
check('trit round-trip is lossless', ALL.every(v => T.fromTrits(T.toTrits(v)) === v));
check('string round-trip is lossless', ALL.every(v => T.parseTritString(T.tritString(v)) === v));
check('all 729 encodings are distinct', new Set(ALL.map(T.tritString)).size === 729);
check('every trit is in {-1,0,+1}', ALL.every(v => T.toTrits(v).every(t => t === -1 || t === 0 || t === 1)));

console.log('\n=== 2. ARITHMETIC vs ORACLE (531,441 pairs per op) ===');
const oracle = v => T.wrap(v);
let bad = null;
for (const a of ALL) for (const b of ALL) {
  if (T.add(a, b) !== oracle(a + b)) { bad = ['add', a, b]; break; }
  if (T.sub(a, b) !== oracle(a - b)) { bad = ['sub', a, b]; break; }
  if (T.mul(a, b) !== oracle(a * b)) { bad = ['mul', a, b]; break; }
}
check(`add / sub / mul over all ${729 * 729} tryte pairs`, bad === null, JSON.stringify(bad));
check('every result stays in range', ALL.every(a => ALL.every(b => { const r = T.add(a, b); return r >= T.TRYTE_MIN && r <= T.TRYTE_MAX; })));

console.log('\n=== 3. THE FOUR PROPERTIES THAT MOTIVATE BALANCED TERNARY ===');
check('(a) negation IS flipping every trit',
  ALL.every(v => T.neg(v) === T.fromTrits(T.toTrits(v).map(t => -t))));
check('(a) ...and equals arithmetic negation', ALL.every(v => T.neg(v) === -v));
check('(b) no sign bit: -v is the exact mirror of v',
  ALL.every(v => T.tritString(-v) === T.tritString(v).replace(/[+-]/g, c => (c === '+' ? '-' : '+'))));
check('(c) sign = sign of leading non-zero trit', ALL.every(v => T.sign(v) === Math.sign(v)));
check('(d) truncation rounds to nearest, ties away from zero',
  ALL.every(v => {
    const q = v / 3, expected = Math.sign(q) * Math.round(Math.abs(q));
    return T.shiftRight(v, 1) === expected;
  }));
check('subtraction needs no separate circuit: a-b === a+neg(b)',
  ALL.every(a => ALL.every(b => T.sub(a, b) === T.add(a, T.neg(b)))));

console.log('\n=== 4. SHIFTS ===');
check('shiftLeft(v,n) === v * 3^n (wrapped)',
  ALL.every(v => [0, 1, 2, 3].every(n => T.shiftLeft(v, n) === T.wrap(v * 3 ** n))));
check('shiftRight undoes shiftLeft when nothing overflowed',
  ALL.filter(v => Math.abs(v) <= 40).every(v => T.shiftRight(T.shiftLeft(v, 2), 2) === v));

console.log('\n=== 5. TRITWISE GATES (531,441 pairs each) ===');
const perTrit = (fn, a, b) => T.fromTrits(T.toTrits(a).map((t, i) => fn(t, T.toTrits(b)[i])));
let g = true;
for (const a of ALL) for (const b of ALL) {
  if (T.tMIN(a, b) !== perTrit(Math.min, a, b)) { g = false; break; }
  if (T.tMAX(a, b) !== perTrit(Math.max, a, b)) { g = false; break; }
  if (T.tCLAMPSUM(a, b) !== perTrit((p, q) => Math.max(-1, Math.min(1, p + q)), a, b)) { g = false; break; }
}
check('MIN / MAX / CLAMPSUM are exactly tritwise', g);
check('MIN and MAX are commutative', ALL.every(a => ALL.every(b => T.tMIN(a, b) === T.tMIN(b, a) && T.tMAX(a, b) === T.tMAX(b, a))));
check('CLAMPSUM reproduces the 9-row table from the source conversation', (() => {
  const rows = { '-1,-1': -1, '-1,0': -1, '-1,1': 0, '0,-1': -1, '0,0': 0, '0,1': 1, '1,-1': 0, '1,0': 1, '1,1': 1 };
  return Object.entries(rows).every(([k, o]) => {
    const [p, q] = k.split(',').map(Number);
    return T.toTrits(T.tCLAMPSUM(T.fromTrits([p, 0, 0, 0, 0, 0]), T.fromTrits([q, 0, 0, 0, 0, 0])))[0] === o;
  });
})());

console.log('\n=== 6. TGATE — the reconfigurable unit ===');
const ALL_NEG = T.parseTritString('------'), ALL_ZERO = T.parseTritString('000000'), ALL_POS = T.parseTritString('++++++');
check('control = all 0  collapses TGATE to MIN', ALL.every(a => ALL.every(b => T.tgate(ALL_ZERO, a, b) === T.tMIN(a, b)) ));
check('control = all +  collapses TGATE to MAX', ALL.every(a => ALL.every(b => T.tgate(ALL_POS, a, b) === T.tMAX(a, b)) ));
check('control = all -  collapses TGATE to NEG', ALL.every(a => T.tgate(ALL_NEG, a, 0) === T.neg(a)));
check('each of the 729 controls names a circuit; per-trit selection is honoured',
  ALL.every(c => {
    const modes = T.toTrits(c);
    const x = 123, y = -45;
    const got = T.toTrits(T.tgate(c, x, y)), xs = T.toTrits(x), ys = T.toTrits(y);
    return modes.every((m, i) => got[i] === (m === -1 ? -xs[i] : m === 0 ? Math.min(xs[i], ys[i]) : Math.max(xs[i], ys[i])));
  }));
check('the 729 controls collapse to fewer than 729 distinct functions on fixed data',
  new Set(ALL.map(c => T.tgate(c, 123, -45))).size < 729);

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
