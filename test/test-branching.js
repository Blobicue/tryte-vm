'use strict';
/* test-branching.js — set AQ, the branching factor of an authenticated tree.
 *
 * Three of the four registered predictions FAILED, and they did the work.
 *
 *   AQ1  FAILED. Binary is never optimal and the floor is three, both as predicted
 *        and across all 2,880 cells. The clause that failed is the last one: three is
 *        NOT the large-gamma optimum more often than four, it is exactly as often --
 *        21 leaf counts each. Chasing that tie found the real answer, which is better
 *        than the one predicted: a leaf count of 3^k wants branching factor 3 in 15 of
 *        18 cases and a leaf count of 2^k wants 4 in 13 of 19. The tree branches in
 *        the base its address space is counted in, and the 21-21 tie was a property of
 *        how many of each shape this sweep happens to contain.
 *        T-CLAIM-NARROWED-BY-A-DESIGN, fourth bite.
 *
 *   AQ2  FAILED. Powers of two take 1,044 cells against powers of three's 821. The
 *        handicap was real and the geometry did not overcome it -- though per arity in
 *        range, three wins 137 cells each against two's 104, which is the fact the
 *        registered wording could not express.
 *
 *   AQ3  HELD, and survived an instrument fix that would have inflated it. The
 *        registered conversion divided a COUNT OF OPERATIONS by bytes-per-tryte and
 *        rounded it -- a category error twice over -- and reported 103 moved argmins.
 *        The honest conversion reports 8. The prediction was right for the reason
 *        given, on an effect thirteen times smaller than the broken instrument showed.
 *        T-INSTRUMENT-FALSE-VERDICT, eighteenth bite, caught before scoring because a
 *        19% unit change cannot honestly move an optimum from three to six.
 *
 *   AQ4  FAILED, and not narrowly: 571 of the 909 cells where either arity is near
 *        optimal have them differing by more than 15%, worst case 149%. But 426 of
 *        those 571 are cells where 64 and 256 sit at DIFFERENT DEPTHS. They are the
 *        same choice when they land on the same depth and a completely different one
 *        when they do not, which is a fact about the leaf count rather than about
 *        either arity.
 *
 * Section 0 runs before any verdict. The registered control turned out to be unable
 * to discriminate at all -- its two terms are the same draw, so gamma cancels out of
 * its total and its optimum cannot move with gamma no matter what the sweep does. A
 * post-hoc control with independent draws is what actually establishes that the vector
 * regime's smooth descent is structure rather than the shape of the arithmetic.
 */

const A = require('../tools/branching-audit.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const V = A.sweep('vector');
const VT = A.sweep('vector', true);
const M = A.sweep('merkle');
const K = A.sweep('control');
const vp = A.profile(V), mp = A.profile(M), kp = A.profile(K);
const GMAX = Math.max(...A.GAMMAS);

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');

check('depth is exact at the powers, where a logarithm would not be',
  A.depth(729, 3) === 6 && A.depth(1024, 2) === 10 && A.depth(3 ** 12, 3) === 12);
check('   and it is a CEILING, so one leaf over a power costs a whole level',
  A.depth(730, 3) === 7 && A.depth(1025, 2) === 11);
check('   and a wider tree is never deeper than a narrower one',
  A.LEAVES.every(n => A.ARITIES.every(b => b === 2 || A.depth(n, b) <= A.depth(n, b - 1))));
check('the sweep is the one that was registered: 45 leaf counts, 64 rates, 2,880 cells',
  A.LEAVES.length === 45 && A.GAMMAS.length === 64 && V.length === 2880);
check('   over every integer arity from 2 to 1024',
  A.ARITIES.length === 1023 && A.ARITIES[0] === 2 && A.ARITIES[1022] === 1024);
check('   with ten powers of two in range against six of three, the registered handicap',
  A.POW2.length === 10 && A.POW3.length === 6);
check('the merkle regime pins b = 2 at every one of the 2,880 cells, as forced',
  mp.distinctArities === 1 && mp.minArity === 2);

console.log('\n--- the controls, which is where this instrument was weakest ---');
// The registered control sets bytes === verify, so total = d*NOISE[b]*(1+gamma) and
// gamma factors straight out. It could never have detected the failure it was written
// for. That is F-CONTROL-CANNOT-DISCRIMINATE, and the check below states it as a fact
// rather than leaving the control looking like evidence.
check('the REGISTERED control cannot respond to the exchange rate at all',
  A.LEAVES.every(n => {
    const first = A.argmin('control', n, A.GAMMAS[0]).arity;
    return A.GAMMAS.every(g => A.argmin('control', n, g).arity === first);
  }), 'if this ever fails, the control has become able to discriminate');
check('   so its two distinct optima are a fact about the noise, not about the sweep',
  kp.distinctArities === 2 && kp.pow2 === 0 && kp.pow3 === 0);
const c2 = A.control2Profile();
check('the POST-HOC control, drawn independently, moves — 7 optima and 131 backward steps',
  c2.distinctArities === 7 && c2.backwardSteps === 131, JSON.stringify(c2));
check('   and it never comes near the narrow end: its narrowest optimum is 207',
  c2.minArity === 207);
check('   so the vector regime\'s descent to 3 with ZERO backward steps is structure',
  vp.minArity === 3 && vp.backwardSteps === 0 && c2.backwardSteps > 100);

console.log('\n=== 1. AQ1 — FAILED, ON ITS LAST CLAUSE ===');

check('binary is never optimal for a vector commitment: 0 cells of 2,880',
  V.filter(c => c.arity === 2).length === 0 && vp.everBinary === false);
check('   and the optimum never descends past three', vp.minArity === 3);
check('   and never widens as verifying gets dearer, across every leaf count',
  vp.backwardSteps === 0);
check('   and it does reach the far end, so the sweep spans the whole model',
  vp.maxArity === 1024 && vp.distinctArities === 61);

const atLimit = A.LEAVES.map(n => A.argmin('vector', n, GMAX).arity);
const three = atLimit.filter(a => a === 3).length, four = atLimit.filter(a => a === 4).length;
check('THE CLAUSE THAT FAILED: three does not beat four at the limit — it TIES, 21 to 21',
  three === 21 && four === 21, `three ${three}, four ${four}`);
check('   and the two of them take 42 of the 45 leaf counts between them',
  three + four === 42);

console.log('\n--- chasing the tie: what the leaf count actually decides ---');
const pref = A.limitPreference();
const shape = (s, a) => pref.filter(r => r.shape === s && r.arity === a).length;
const shapeN = s => pref.filter(r => r.shape === s).length;
check(`a leaf count of 3^k wants branching factor THREE — 15 of ${shapeN('3^k')}`,
  shape('3^k', 3) === 15 && shapeN('3^k') === 18);
check(`a leaf count of 2^k wants FOUR — 13 of ${shapeN('2^k')}`,
  shape('2^k', 4) === 13 && shapeN('2^k') === 19);
check('   so the tie measured this sweep\'s mix of shapes, not the geometry of trees',
  Math.abs(shapeN('3^k') - shapeN('2^k')) <= 1 && three === four);
// The registered claim was about a count over leaf counts I chose. That makes it a
// property of the design, which is the fourth time this class has bitten.
check('   T-CLAIM-NARROWED-BY-A-DESIGN: swapping the mix would swap the verdict',
  shape('3^k', 3) > shape('3^k', 4) && shape('2^k', 4) > shape('2^k', 3));

console.log('\n=== 2. AQ2 — FAILED. THE HANDICAP HELD ===');

check('powers of two take 1,044 cells and powers of three 821',
  vp.pow2 === 1044 && vp.pow3 === 821, `${vp.pow2} / ${vp.pow3}`);
check('   so the prediction that three takes strictly more is refuted', vp.pow3 < vp.pow2);
check('   but PER ARITY IN RANGE three wins more, 137 cells each against 104',
  Math.round(vp.pow3 / A.POW3.length) === 137 && Math.round(vp.pow2 / A.POW2.length) === 104);
check('   which the registered wording could not express, and is the honest reading',
  vp.pow3 / A.POW3.length > vp.pow2 / A.POW2.length);

console.log('\n=== 3. AQ3 — HELD, AND SURVIVED THE INSTRUMENT ===');

let moved = 0;
for (let i = 0; i < V.length; i++) if (V[i].arity !== VT[i].arity) moved++;
check('recomputing in whole trytes moves 8 argmins of 2,880', moved === 8, `moved ${moved}`);
check('   so at least one moves, and the prediction against the obvious answer holds',
  moved >= 1);
check('   and it is the ROUNDING that does it, not the scale: 0.28% of cells, not none and not many',
  moved / V.length < 0.01 && moved > 0);

// The registered conversion is kept in the tool precisely so this cannot regress.
let naiveMoved = 0;
for (const n of A.LEAVES) for (const g of A.GAMMAS) {
  if (A.argmin('vector', n, g).arity !== A.argminNaive('vector', n, g)) naiveMoved++;
}
check('the REGISTERED conversion moved 103 — thirteen times more, and wrongly',
  naiveMoved === 103, `naive moved ${naiveMoved}`);
check('   because it divided a COUNT OF OPERATIONS by bytes-per-tryte, and rounded it',
  naiveMoved > 12 * moved);
// Mutation-tested: restoring the naive conversion inside total() turns the 8 red.

console.log('\n=== 4. AQ4 — FAILED, AND THE REASON IS DEPTH ===');

let near = 0, over = 0, worst = 0, diffDepth = 0;
for (const c of V) {
  const t64 = A.total('vector', c.n, 64, c.gamma), t256 = A.total('vector', c.n, 256, c.gamma);
  if (t64 > 1.15 * c.cost && t256 > 1.15 * c.cost) continue;
  near++;
  const spread = Math.max(t64, t256) / Math.min(t64, t256) - 1;
  if (spread > worst) worst = spread;
  if (spread > 0.15) { over++; if (A.depth(c.n, 64) !== A.depth(c.n, 256)) diffDepth++; }
}
check('909 cells have 64 or 256 within 15% of that cell\'s optimum', near === 909, `${near}`);
check('   and 571 of them have the two arities differing by MORE than 15%',
  over === 571, `${over}`);
check('   worst case 148.8%, so they are not the same choice', Math.round(1000 * worst) === 1488,
  (100 * worst).toFixed(1) + '%');
check('   BUT 426 of those 571 are cells where the two sit at different DEPTHS',
  diffDepth === 426, `${diffDepth}`);
check('   so the gap is a step in the leaf count, not a property of either arity',
  diffDepth / over > 0.7);

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
