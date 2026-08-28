'use strict';
/* test-forge.js — attacking the ledger head, instead of counting collisions against it.
 *
 * Set `AS`, REGISTRATION PHASE. This file currently contains INSTRUMENT CHECKS ONLY.
 * None of `AS1`..`AS4` is asserted here, because none of them has been run: a
 * registration commit that carried a verdict would not be a registration. What is
 * checked is everything the registration block calls derivable — D1, D2, D3, the
 * double count, the generator, and the two controls' responsiveness — because a
 * verdict from an unchecked instrument is a fact about the instrument, and
 * `T-INSTRUMENT-FALSE-VERDICT` has bitten twenty-one times.
 *
 * The suite does not run this file yet; `test/run-all.js` picks it up in the results
 * commit. That is deliberate — a scaffolded test that passes before the measurement
 * would be reporting success for work nobody did.
 *
 * The exhaustive version is `npm run audit:forge`.
 */

const A = require('../tools/forge-audit.js');
const LED = require('../tools/ledger-audit.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

console.log('\n=== 0. THE INDEX/VALUE BOUNDARY, WHICH HAS PRODUCED TWO FALSE VERDICTS ===');
{
  check('idx and val are inverse over the whole tryte range',
    Array.from({ length: A.N }, (_, i) => i).every(i => require('../tools/puzzle-audit.js')
      .idx(require('../tools/puzzle-audit.js').val(i)) === i));
  check('the tritwise identity sits at index 364, not at index 0',
    A.ZERO === 364 && A.OFF === 364);
  check('the arithmetic helpers really carry: asum, asub and adel agree with wrap',
    (() => {
      const Q = require('../tools/puzzle-audit.js');
      for (let n = 0; n < 4000; n++) {
        const a = n * 7 % A.N, b = n * 13 % A.N, d = 1 + n % (A.N - 1);
        if (A.asum(a, b) !== Q.idx(LED.wrap(Q.val(a) + Q.val(b)))) return false;
        if (A.asub(A.asum(a, b), b) !== a) return false;
        if (A.adel(a, d) !== Q.idx(LED.wrap(Q.val(a) + d))) return false;
      }
      return true;
    })());
  // A carry-free delta is the ONLY case where the arithmetic and tritwise groups
  // agree, and the partitions in the tool turn on detecting it.
  check('dIdx and negIdx name the same tritwise element the arithmetic delta would',
    (() => {
      const Q = require('../tools/puzzle-audit.js');
      for (let d = 1; d < A.N; d++) {
        const dv = d <= 364 ? d : d - A.N;
        if (A.dIdx(d) !== Q.idx(dv) || A.negIdx(d) !== Q.idx(-dv)) return false;
      }
      return true;
    })());
}

console.log('\n=== 1. THE DERIVED IDENTITIES, CHECKED AND NOT TRUSTED ===');
{
  check('D1 — the step is a + g(a + e), over all 531,441 (accumulator, entry) pairs',
    A.checkStepIsGShift());
  check('   and every step is a bijection in the accumulator, for all 729 entries',
    A.checkStepBijective());
  const d2 = A.checkHeadIsGSum(5000);
  check('D2 — head = sum of g(u_k): exhaustive at length two, sampled at length six',
    d2.ok && d2.exhaustiveAtLengthTwo === A.N * A.N, JSON.stringify(d2));
  const d3 = A.checkMergePointEquivalence(6);
  check('D3 — head\' = head exactly when the merge-point accumulator is restored',
    d3.ok && d3.disagree === 0 && d3.agree === 6 * A.FAMILY,
    `${d3.agree} agree / ${d3.disagree} disagree`);
  check('   and the family it agreed over really contains accepted forgeries, so the '
    + 'agreement is not vacuous', d3.accepts > 0, `${d3.accepts} accepts`);
  check('the published sweep counts every forgery twice: forge(i,j,d) === forge(j,i,-d)',
    A.checkDoubleCount());
}

console.log('\n=== 2. THE CANONICAL LEDGER REPRODUCES ledger-audit ===');
{
  const Q = require('../tools/puzzle-audit.js');
  const ledgerIx = LED.LEDGER.map(v => Q.idx(LED.wrap(v)));
  check('the mixer head, computed in index space, is ledger-audit\'s value-space head',
    A.headIx(ledgerIx) === Q.idx(LED.headHash(LED.LEDGER)));
  check('the summed head, computed in index space, is ledger-audit\'s',
    A.totalIx(ledgerIx) === Q.idx(LED.headSum(LED.LEDGER)));
}

console.log('\n=== 3. THE GENERATOR — T-FAKE-RANDOM ===');
{
  const r = A.rng(12345);
  const seen = new Uint8Array(A.N);
  let distinct = 0;
  for (let i = 0; i < 200000; i++) { const v = A.randInt(r, A.N); if (!seen[v]) { seen[v] = 1; distinct++; } }
  check('the draw reaches every one of the 729 entry values, not merely runs 200,000 times',
    distinct === A.N, `${distinct} of ${A.N}`);
  check('two seeds do not produce the same first ledger',
    A.drawLedger(A.rng(1)).join() !== A.drawLedger(A.rng(2)).join());
  check('the same seed does', A.drawLedger(A.rng(9)).join() === A.drawLedger(A.rng(9)).join());
}

console.log('\n=== 4. THE CONTROLS MOVE — T-CONTROL-CANNOT-DISCRIMINATE ===');
{
  // The summed head must accept every compensating forgery. If it did not, every rate
  // the census reports would be measuring a broken accumulator rather than a
  // forgeable one -- and this is the control's whole job.
  const sc = A.summedControl(3);
  check('the summed head accepts 100% of the compensating family, on 3 drawn ledgers',
    sc.accepted === sc.tried && sc.tried === 3 * A.FAMILY, JSON.stringify(sc));
  // And it must be capable of reporting something else, or 100% means nothing.
  check('   and the same statistic reports 0% for a single edit, which moves the total',
    LED.sweepSingle().sum === 0);
  // The differential statistic must be able to reach 729, or "at most 27" is a claim
  // about a ceiling nothing could ever touch. AN's affine map is LINEAR, so its
  // residual g = rot^2 sends each input difference to exactly one output difference.
  const affine = A.ddtStats(A.ddtOf(A.G_AFFINE));
  check('the differential statistic reaches 729 on a LINEAR g, so its range is real',
    affine.max === A.N, `max ${affine.max}`);
  check('   and that same linear table is almost entirely empty, as a linear map forces',
    affine.emptyFraction > 0.99, `${affine.emptyFraction}`);
  // The join statistic must be able to leave 1.0. Feeding one half's counts to itself
  // is the degenerate case the AS3 registration names, and it must return 2.
  const r = A.rng(999);
  const perm = A.randomPermutation(r);
  const ctrl = A.stepTableFor(perm);
  const j = A.mitm([100, 200, 300, 400, 500, 600], ctrl.step, ctrl.back);
  check('the join statistic returns 2.0 when its two halves are identical',
    Math.abs(A.degenerateJoinRatio(j.Lc) - 2) < 0.05, `${A.degenerateJoinRatio(j.Lc)}`);
  check('   and every one of 200 joined keys really is a forgery of the control chain',
    (() => {
      const run = e => { let s = 364; for (const v of e) s = ctrl.step[s * A.N + v]; return s; };
      const led = [100, 200, 300, 400, 500, 600];
      let seen = 0;
      for (let k = 0; k < A.N * A.N && seen < 200; k++) {
        const f = A.mitmForgery(led, j, k);
        if (!f) continue;
        seen++;
        if (run(f) !== run(led) || A.totalIx(f) !== A.totalIx(led)) return false;
      }
      return seen === 200;
    })());
}

console.log('\n=== 5. THE RANK STATISTIC, ON CASES WHOSE ANSWER IS KNOWN BY HAND ===');
{
  const row = { cells: new Int32Array(A.N), hit: new Uint8Array(A.N), hits: 1 };
  row.cells[5] = 3; row.cells[9] = 3; row.cells[11] = 1; row.hit[9] = 1;
  check('one hit inside a two-member top bucket ranks at (2 + 1) / (1 + 1) = 1.5',
    A.rankOfFirstHit(row, 3) === 1.5, `${A.rankOfFirstHit(row, 3)}`);
  row.hit[9] = 0; row.hit[11] = 1;
  check('   and a hit one bucket down ranks at 2 + (1 + 1) / (1 + 1) = 3',
    A.rankOfFirstHit(row, 3) === 3, `${A.rankOfFirstHit(row, 3)}`);
  row.hit[11] = 0;
  check('   and a row with no hit at all returns null rather than a large number',
    A.rankOfFirstHit(row, 3) === null);
  check('the uniform null is 729 / (k + 1), which is 364.5 for a single accept',
    A.rankUniform(1) === 364.5 && A.rankUniform(2) === 243);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
