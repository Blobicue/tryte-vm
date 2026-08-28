'use strict';
/* test-forge.js — attacking the ledger head, instead of counting collisions against it.
 *
 * Set `AS`. Four predictions, all four HELD, and the check worth keeping is not any of
 * them: it is the cell-zero row in section 4. Across 2,669,929 tries whose differential
 * cell is empty there are ZERO accepted forgeries. That is the one place in this set
 * where the mixer's residual algebra gives a forger something with certainty rather
 * than on average, and it is what `AS4`'s halving is made of.
 *
 * MUTATION-TESTED. Three deliberate breaks, each restored afterwards, and what each one
 * ACTUALLY turned red — which twice was not what was expected, and the surprises are the
 * useful part:
 *
 *   1. MERGE POINT OFF BY ONE. `sweepLedger` compares against `a[j]` instead of
 *      `a[j + 1]`, so the census asks whether the accumulator BEFORE the second edited
 *      entry is restored rather than after it. Twelve checks red — but NOT the ones
 *      that were expected to catch it. `AS1`'s three registered LINES all still hold
 *      under the break: the mean is 15.121 and the variance-to-mean ratio 1.029, both
 *      well inside their registered bands, because "the accumulator one step earlier is
 *      restored" is also a 1-in-729 event and produces a statistically identical
 *      process. What catches it is the pinned exact values, the canonical ledger's 13,
 *      and above all `AS4`: the differential ordering stops predicting anything and its
 *      ratio goes from 0.4506 to 0.9970, one, at every seed. THE DISPERSION STATISTIC
 *      CANNOT SEE THIS DEFECT AND THE MECHANISM CAN. `checkMergePointEquivalence` also
 *      stays green, because it computes the equivalence independently and never calls
 *      `sweepLedger`, so the identity check and the pinned census are not one check
 *      twice.
 *
 *   2. RANK ORDER REVERSED. `rankOfFirstHit` walks its buckets from the emptiest cell
 *      upward instead of from the fullest down, which is the anti-forger. Three checks
 *      red and nothing else: the ratio goes to 1.6933, so `AS4` fails in exactly the
 *      direction its registration named a flat table would push it, and the bootstrap
 *      interval [1.6832, 1.7054] moves with it.
 *
 *   3. THE JOIN'S BACKWARD WALK TRANSPOSED. `mitm` pulls back through entry 5 before
 *      entry 6 rather than after. The match count does not merely stay inside `AS3`'s
 *      band — IT IS UNCHANGED, 532,485 exactly, along with every key-occupancy figure,
 *      because transposing the walk relabels the join without resizing it. Exactly ONE
 *      check goes red, the one that rebuilds 500 joined keys and recomputes their head.
 *      That is `D4` in a new costume: a yield count cannot tell a working attack from a
 *      relabelled broken one, and only reconstructing the forgeries can.
 *
 * The exhaustive version is `npm run audit:forge`.
 */

const A = require('../tools/forge-audit.js');
const LED = require('../tools/ledger-audit.js');
const Q = require('../tools/puzzle-audit.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const near = (a, b, eps) => Math.abs(a - b) <= eps;

console.log('\n=== 0. THE INDEX/VALUE BOUNDARY, WHICH HAS PRODUCED TWO FALSE VERDICTS ===');
{
  check('idx and val are inverse over the whole tryte range',
    Array.from({ length: A.N }, (_, i) => i).every(i => Q.idx(Q.val(i)) === i));
  check('the tritwise identity sits at index 364, not at index 0',
    A.ZERO === 364 && A.OFF === 364);
  check('the arithmetic helpers really carry: asum, asub and adel agree with wrap',
    (() => {
      for (let n = 0; n < 4000; n++) {
        const a = n * 7 % A.N, b = n * 13 % A.N, d = 1 + n % (A.N - 1);
        if (A.asum(a, b) !== Q.idx(LED.wrap(Q.val(a) + Q.val(b)))) return false;
        if (A.asub(A.asum(a, b), b) !== a) return false;
        if (A.adel(a, d) !== Q.idx(LED.wrap(Q.val(a) + d))) return false;
      }
      return true;
    })());
  // A carry-free delta is the ONLY case where the arithmetic and tritwise groups agree,
  // and the census partition turns on detecting it.
  check('dIdx and negIdx name the same tritwise element the arithmetic delta would',
    (() => {
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
  check('   and that family really contains accepted forgeries, so the agreement is not '
    + 'vacuous', d3.accepts > 0, `${d3.accepts} accepts`);
  check('the published sweep counts every forgery twice: forge(i,j,d) === forge(j,i,-d)',
    A.checkDoubleCount());
}

console.log('\n=== 2. THE GENERATOR, AND THE CANONICAL LEDGER ===');
{
  const r = A.rng(12345);
  const seen = new Uint8Array(A.N);
  let distinct = 0;
  for (let i = 0; i < 200000; i++) { const v = A.randInt(r, A.N); if (!seen[v]) { seen[v] = 1; distinct++; } }
  check('T-FAKE-RANDOM — the draw reaches every one of the 729 entry values',
    distinct === A.N, `${distinct} of ${A.N}`);
  check('   and two seeds do not agree while one seed does',
    A.drawLedger(A.rng(1)).join() !== A.drawLedger(A.rng(2)).join()
    && A.drawLedger(A.rng(9)).join() === A.drawLedger(A.rng(9)).join());
  const ledgerIx = LED.LEDGER.map(v => Q.idx(LED.wrap(v)));
  check('the mixer head, in index space, is ledger-audit\'s value-space head',
    A.headIx(ledgerIx) === Q.idx(LED.headHash(LED.LEDGER)));
  check('the summed head, in index space, is ledger-audit\'s',
    A.totalIx(ledgerIx) === Q.idx(LED.headSum(LED.LEDGER)));
}

const M = A.measure();

console.log('\n=== 3. AS1 — THE 26 IS THE MIXER, NOT THE LEDGER ===');
{
  const C = M.census;
  check('ledger-audit\'s 26 ordered accepts are 13 DISTINCT forgeries, exactly halved',
    M.canonical.publishedOrdered === 26 && M.canonical.distinct === 13);
  check(`the family is ${A.FAMILY.toLocaleString('en-US')} distinct forgeries and chance is 14.979`,
    A.FAMILY === 10920 && near(A.CHANCE, 14.9794, 1e-4));
  check('2,000 drawn ledgers, and the draw visited all 729 entry values',
    C.ledgers === 2000 && C.coverage === A.N);
  check('AS1 HELD (a) — the mean is 15.1115, within 0.6 of chance',
    near(C.mean, 15.1115, 1e-3) && Math.abs(C.mean - C.chance) < 0.6,
    `${C.mean} vs ${C.chance}`);
  check('AS1 HELD (b) — the variance-to-mean ratio is 1.018, inside [0.80, 1.25]',
    near(C.varOverMean, 1.0185, 1e-3) && C.varOverMean >= 0.80 && C.varOverMean <= 1.25,
    `${C.varOverMean}`);
  check('AS1 HELD (c) — the worst ledger of 2,000 accepts 30, under the line at 40',
    C.max === 30 && C.max <= 40 && C.min === 3, `min ${C.min} max ${C.max}`);
  check('   so there is no weak-ledger class: 30,223 accepts over 21,840,000 forgeries',
    C.total === 30223);
  // The line at 1.25 is what the F-MIXER-HEAD-IS-NOT-FLAT spread would have broken. The
  // registered arithmetic put a 17% per-ledger spread at a ratio of 1.43.
  check('   and the 17% spread the registration named would have put the ratio at 1.43, '
    + 'so the line could fire', near(1 + 15 * 0.17 ** 2, 1.4335, 1e-3));
  // Every structural cut looked at, so a reader can see which ones were tried.
  check('no merge distance accepts at more than 1.05x chance',
    [1, 2, 3, 4, 5].every(d => C.hitByDistance[d] / C.triedByDistance[d] * A.N < 1.05),
    [1, 2, 3, 4, 5].map(d => (C.hitByDistance[d] / C.triedByDistance[d] * A.N).toFixed(3)).join(' '));
  check('   and neither does any carry pattern, so the group mismatch is not a lever',
    [0, 1, 2, 3].every(k => C.hitByCarry[k] / C.triedByCarry[k] * A.N < 1.05),
    [0, 1, 2, 3].map(k => (C.hitByCarry[k] / C.triedByCarry[k] * A.N).toFixed(3)).join(' '));
  check('the verdict does not turn on the seed: two further seeds give 14.816 and 15.195',
    M.robustness.length === 2
    && M.robustness.every(r => Math.abs(r.mean - C.chance) < 0.6 && r.max <= 40
      && r.varOverMean >= 0.80 && r.varOverMean <= 1.25),
    JSON.stringify(M.robustness));
}

console.log('\n=== 4. AS2 AND AS4 — THE DIFFERENTIAL TABLE ===');
{
  const D = M.ddt.stats, C = M.census;
  check('the table covers 728 non-zero input differences x 729 outputs',
    D.cells === 530712 && D.cells === (A.N - 1) * A.N);
  check('AS2 HELD — the maximum cell is 8, under the registered line of 27',
    D.max === 8 && D.max <= 27, `${D.max}`);
  check('   and a random permutation\'s g gives 8 too, over a spread of 7 to 9 in twelve '
    + 'draws — so g is not distinguishable from one here',
    M.ddt.random.max === 8 && Math.min(...M.controlMaxima) === 7
    && Math.max(...M.controlMaxima) === 9, M.controlMaxima.join(' '));
  check('   the empty-cell fraction is 36.74% against a random function\'s 36.79%',
    near(D.emptyFraction, 0.36736, 1e-4) && near(M.ddt.random.emptyFraction, 0.36811, 1e-4));
  // The control that shows the statistic is not pinned near its floor by construction.
  check('   and the same statistic returns 729 for AN\'s LINEAR affine map',
    M.ddt.affine.max === A.N);
  // The registration's own null arithmetic said 9 to 11 for a random function's maximum.
  // The measured controls say 7 to 9. Recorded rather than quietly dropped: the null was
  // slightly wrong and it decided nothing, because AS2's line is at 27.
  check('the registration\'s null put the random maximum at 9 to 11 and the measurement '
    + 'says 7 to 9 — disclosed, and it decides nothing at a line of 27',
    Math.max(...M.controlMaxima) < 9 + 1 && D.max <= 27);

  const R = C.ranks;
  check('10,000 adjacent-pair cases, 6,265 with at least one accept',
    R.cases === 10000 && R.casesWithHit === 6265);
  check('AS4 HELD — the differential order finds the first accept at rank 137.49 '
    + 'against a uniform order\'s 305.16, a ratio of 0.4506',
    near(R.ddt, 137.492, 1e-2) && near(R.uniform, 305.157, 1e-2)
    && near(R.ratio, 0.45056, 1e-4) && R.ratio < 0.5, `${R.ratio}`);
  // T-CRITERION-IN-THE-NOISE: 0.4506 against a line at 0.5 needs a spread beside it.
  check('   and the bootstrap 95% interval [0.4425, 0.4589] does not reach the line',
    R.se.hi < 0.5 && near(R.se.lo, 0.4425, 2e-3) && near(R.se.hi, 0.4589, 2e-3),
    JSON.stringify(R.se));
  check('   nor does either further seed: 0.4495 and 0.4566',
    M.robustness.every(r => r.as4 < 0.5), M.robustness.map(r => r.as4.toFixed(4)).join(' '));
  check('   and the statistic spans: a perfect oracle gives 1.00, an anti-oracle 727.42',
    R.oracle === 1 && near(R.anti, 727.42, 0.01));
  // THE CHECK WORTH KEEPING. An empty cell cannot accept, and the sweep says so over
  // 2.7 million tries rather than by argument.
  check('AN EMPTY DIFFERENTIAL CELL NEVER ACCEPTS: 0 in 2,669,929 tries',
    C.hitByCell[0] === 0 && C.triedByCell[0] === 2669929);
  check('   and the accept rate rises with the cell, 0.98x to 6.65x chance at cells 1..7',
    [1, 2, 3, 4, 5, 6, 7].every(c => C.triedByCell[c] > 0)
    && near(C.hitByCell[1] / C.triedByCell[1] * A.N, 0.983, 2e-3)
    && near(C.hitByCell[7] / C.triedByCell[7] * A.N, 6.651, 2e-3));
  check('   which is what a forger buys: 36.67% of deltas excluded with certainty, and '
    + 'the top 8.04% carry 26.86% of the accepts',
    near(M.targeted.freeExclusion, 0.36675, 1e-4)
    && near(M.targeted.deltaShare, 0.08040, 1e-4)
    && near(M.targeted.acceptShare, 0.26862, 1e-4)
    && near(M.targeted.concentration, 3.341, 1e-3));
}

console.log('\n=== 5. AS3 — MEET IN THE MIDDLE ===');
{
  const J = M.mitm;
  check('AS3 HELD — the join returns 532,485 forgeries against an ideal 531,441, '
    + 'a ratio of 1.0020 inside [0.97, 1.10]',
    J.matches === 532485 && J.ideal === 531441 && near(J.ratio, 1.00196, 1e-5)
    && J.ratio >= 0.97 && J.ratio <= 1.10, `${J.ratio}`);
  check('   and every one of eight further drawn ledgers lands inside it too',
    near(M.mitmSweep.min, 0.99856, 1e-4) && near(M.mitmSweep.max, 1.00150, 1e-4)
    && M.mitmSweep.runs.length === 8
    && M.mitmSweep.runs.every(r => r.ratio >= 0.97 && r.ratio <= 1.10));
  check('   the halves are sparse, as the registration said: 335,881 and 335,763 keys '
    + 'occupied of 531,441, meeting on 212,371',
    J.keysL === 335881 && J.keysR === 335763 && J.keysBoth === 212371);
  check('   a chain built on a random permutation gives 0.9999, so the mixer is not '
    + 'distinguishable from one here either',
    near(M.mitmControl.ratio, 0.99989, 1e-4));
  // T-CONTROL-CANNOT-DISCRIMINATE: the statistic must be able to leave 1.0, or "the
  // preimage bias is not cashable" is a claim about a number that could not move.
  check('   and the statistic MOVES — identical halves return 2.0003, which is the '
    + 'value the AS3 registration named as the failure mode',
    near(A.degenerateJoinRatio(J.Lc), 2.0003, 1e-3));
  // MUTATION 3 lives here: the count survives a transposed backward walk and this does not.
  check('every one of 500 joined keys rebuilds into a ledger with the SAME head and the '
    + 'SAME total — the count alone cannot tell a working attack from a broken one',
    (() => {
      const led = LED.LEDGER.map(v => Q.idx(LED.wrap(v)));
      let seen = 0;
      for (let k = 0; k < A.N * A.N && seen < 500; k++) {
        const f = A.mitmForgery(led, J, k);
        if (!f) continue;
        seen++;
        if (A.headIx(f) !== A.headIx(led) || A.totalIx(f) !== A.totalIx(led)) return false;
      }
      return seen === 500;
    })());
  check('   and at least one of them really differs from the ledger it forges',
    (() => {
      const led = LED.LEDGER.map(v => Q.idx(LED.wrap(v)));
      let differs = 0, seen = 0;
      for (let k = 0; k < A.N * A.N && seen < 500; k++) {
        const f = A.mitmForgery(led, J, k);
        if (!f) continue;
        seen++;
        if (f.join() !== led.join()) differs++;
      }
      return differs >= 499;
    })());
}

console.log('\n=== 6. WHAT A FORGER PAYS — NOT REGISTERED, AND THE POINT OF THE SET ===');
{
  const B = M.brute, J = M.mitm;
  check('brute force over the same four-position family accepts at chance: 4,078 of '
    + '3,000,000, which is 0.99x',
    B.accepted === 4078 && near(B.rate * A.N, 0.991, 2e-3));
  check('   costing 4,414 ops per accepted forgery', near(B.opsPerAccept, 4413.9, 0.5));
  check('the join costs 6.99 ops per accepted forgery, a 632x cut, for 2,125,764 slots',
    near(J.ops / J.matches, 6.986, 1e-3) && J.memory === 2125764
    && near(B.opsPerAccept / (J.ops / J.matches), 631.8, 0.5));
  check('   so the mixer\'s advantage over the summed head is about 7 ops per forgery, '
    + 'not the 840x per-try gap measured on a one-parameter family',
    J.ops / J.matches < 10 && LED.sweepCompensating().tried / LED.sweepCompensating().hash > 800);
}

console.log('\n=== 6b. WHAT THIS SET DID NOT ATTACK ===');
{
  // An unexamined attack surface reported as silence is how the 26 got here, so the one
  // this set leaves open is pinned rather than merely mentioned in prose.
  const NO = M.noOp;
  check('P has exactly one fixed point, so exactly one entry is a mixer no-op from any '
    + 'accumulator — verified at all 729, not argued',
    NO.fixedPoints === 1 && NO.verified === true && NO.witnesses.length === 1,
    JSON.stringify({ fixedPoints: NO.fixedPoints, verified: NO.verified }));
  check('   and g\'s image is 465 of 729, so 264 increments are unreachable in one step',
    NO.imageOfG === 465 && NO.unreachableIncrements === 264);
  check('   which is a move only an INSERTION can make, and every forgery in this set '
    + 'keeps the ledger at six entries',
    A.FAMILY === 15 * 728 && LED.LEDGER.length === 6);
}

console.log('\n=== 7. THE MANIFEST SAYS WHAT THIS FILE MEASURED ===');
{
  const MAN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'FINDINGS.json'), 'utf8'));
  const set = MAN.prediction_sets.find(s => s.id === 'AS');
  check('AS is in the manifest, names this tool and this test',
    !!set && set.tool === 'tools/forge-audit.js' && set.asserted_in === 'test/test-forge.js');
  check('   with four predictions, all four HELD',
    !!set && set.predictions.length === 4
    && set.predictions.every(p => p.outcome === 'HELD'));
  const m = id => (set.predictions.find(p => p.id === id) || {}).measured || {};
  check('AS1\'s measured block carries the numbers this run produced',
    m('AS1').mean === 15.1115 && m('AS1').variance_over_mean === 1.018
    && m('AS1').max_over_ledgers === 30 && m('AS1').ledgers === 2000);
  check('AS2\'s does', m('AS2').max_cell === 8 && m('AS2').random_permutation_max === 8
    && m('AS2').affine_max === 729);
  check('AS3\'s does', m('AS3').matches === 532485 && m('AS3').ratio === 1.002);
  check('AS4\'s does', m('AS4').ratio === 0.4506 && m('AS4').empty_cell_accepts === 0);
  const F = id => MAN.unregistered_findings.find(f => f.id === id);
  for (const id of ['F-LEDGER-CHAIN-IS-A-SUM-IN-U', 'F-COMPENSATING-SWEEP-DOUBLE-COUNTS',
    'F-EMPTY-DIFFERENTIAL-CELLS-CANNOT-ACCEPT', 'F-MITM-PRICES-THE-MIXER-AT-SEVEN-OPS',
    'F-EVERY-ACCUMULATOR-HAS-A-NO-OP-ENTRY']) {
    const f = F(id);
    check(`${id} is recorded, and points at this file`,
      !!f && f.asserted_in === 'test/test-forge.js'
      && f.outcome === 'MEASURED_NOT_REGISTERED', id);
  }
  check('the double-count finding quotes both numbers ledger-audit publishes',
    (F('F-COMPENSATING-SWEEP-DOUBLE-COUNTS') || {}).claim.includes('21,840')
    && F('F-COMPENSATING-SWEEP-DOUBLE-COUNTS').claim.includes('10,920')
    && F('F-COMPENSATING-SWEEP-DOUBLE-COUNTS').claim.includes('13'));
  check('the cost finding quotes the ops per forgery and the memory it charges',
    (F('F-MITM-PRICES-THE-MIXER-AT-SEVEN-OPS') || {}).claim.includes('6.99')
    && F('F-MITM-PRICES-THE-MIXER-AT-SEVEN-OPS').claim.includes('2,125,764'));
}

console.log('\n=== 8. THE TOOL AS IT IS ACTUALLY RUN — T-TOOL-CHECKED-ONLY-BY-IMPORT ===');
{
  // Importing sets the main-module flag false, so no print path ever executes. A tool
  // once crashed with a stack overflow on every run while its whole suite stayed green.
  // Capped, so this check costs seconds rather than the full census.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'forge-audit.js')],
    { encoding: 'utf8', timeout: 300000, env: { ...process.env, FORGE_LEDGERS: '25' } });
  check('the audit runs as a program and prints its own report',
    out.includes('FORGE AUDIT') && ['AS1', 'AS2', 'AS3', 'AS4'].every(id => out.includes(id)));
  check('   and reports the instrument before any verdict, and the cost after them',
    out.includes('THE INSTRUMENT, BEFORE ANY VERDICT')
    && out.includes('what a forger actually pays')
    && out.includes('WHAT THIS SET DID NOT ATTACK'));
  check('   and the cap really capped it: 25 ledgers, not 2,000',
    out.includes('25 drawn ledgers') && !out.includes('2,000 drawn ledgers'));
  check('   while the quantities that do not depend on the cap are unchanged',
    out.includes('maximum cell            8') && out.includes('ideal 531,441'));
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
