'use strict';
/* test-radix.js — set AR, what happens when a tree's arity may vary by depth.
 *
 * THIS IS THE REGISTRATION STATE OF THIS FILE. It carries section 0 only: the
 * instrument, checked before any verdict exists to be read. The sections that score
 * `AR1` through `AR4` are added in the results commit, because a check written before
 * the run either asserts nothing or asserts a number nobody measured.
 *
 * What section 0 has to establish, given how this tool can lie:
 *
 *   MINSUM IS COMPUTED THREE WAYS. A closed form over near-equal partitions, an
 *   independent dynamic program over ceil-division that knows nothing about
 *   near-equality, and brute-force enumeration of every sequence for small cases. This
 *   whole set reduces to MINSUM, so a wrong MINSUM is a wrong set, and
 *   `T-TRANSCRIBED-TABLE` is on the record for exactly this: a wrong instrument does
 *   not look wrong, it produces clean mechanistic findings that are entirely false.
 *
 *   THE GENERALISATION REPRODUCES `AQ`. A constant sequence of length d and sum d*b
 *   must cost what `tools/branching-audit.js` charges for branching factor b, at every
 *   one of its 2,880 cells. If it does not, this set is measuring a different model
 *   and calling the difference a finding.
 *
 *   NO PRODUCT IS FORMED IN FULL. The unguarded version is kept in the tool and a
 *   check pins a case where the two disagree, so the guarded one cannot regress.
 *
 *   THE DEPTH BOUND IS A PROOF, NOT A BUDGET. `T-EXHAUSTED-NOT-CLOSED`, three bites.
 *
 *   THE CONTROL MOVES. `AQ`'s control could not -- its two cost terms were the same
 *   draw, so the swept rate factored out and it could only ever agree
 *   (`F-CONTROL-CANNOT-DISCRIMINATE`). This one is asserted responsive BEFORE its
 *   verdict is read, which is the antibody that failure produced.
 */

const A = require('../tools/radix-audit.js');
const AQ = require('../tools/branching-audit.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');

console.log('\n--- MINSUM, computed three ways ---');
{
  // Hand-computed, and the reason each is here. minsum(2, 11) = 7 because 3*4 = 12
  // covers 11 and no pair summing to 6 does. minsum(6, 486) = 17 because 2*3^5 is
  // exactly 486. minsum(5, 1024) = 20 because four is the fifth root exactly.
  check('minsum agrees with arithmetic done by hand at three known points',
    A.minsum(2, 11) === 7 && A.minsum(6, 486) === 17 && A.minsum(5, 1024) === 20,
    `${A.minsum(2, 11)} ${A.minsum(6, 486)} ${A.minsum(5, 1024)}`);

  let dpBad = null;
  for (const n of [5, 7, 11, 24, 37, 60, 100, 486, 730, 1025, 2187, 4097]) {
    for (let d = 1; d <= 6; d++) {
      if (A.minsum(d, n) !== A.minsumDP(d, n)) { dpBad = `n=${n} d=${d}`; break; }
    }
    if (dpBad) break;
  }
  check('the closed form agrees with an independent dynamic program over 12 leaf'
    + ' counts and six depths', dpBad === null, dpBad || '');

  let bruteBad = null;
  for (const n of [5, 7, 11, 17, 24, 37, 60, 96]) {
    for (let d = 1; d <= 3; d++) {
      if (A.minsum(d, n) !== A.minsumBrute(d, n)) { bruteBad = `n=${n} d=${d}`; break; }
    }
    if (bruteBad) break;
  }
  check('   and with brute-force enumeration of every sequence, where that is'
    + ' tractable', bruteBad === null, bruteBad || '');

  // A minimum-sum sequence must actually be admissible, and no cheaper one may be.
  let adm = true, tight = true;
  for (let n = 2; n <= 400; n++) for (let d = 1; d <= 5; d++) {
    const S = A.minsum(d, n);
    if (!Number.isFinite(S)) continue;
    if (!A.maxprodAtLeast(S, d, n)) adm = false;
    if (S > 2 * d && A.maxprodAtLeast(S - 1, d, n)) tight = false;
  }
  check('every minsum is admissible: its near-equal partition really covers N', adm);
  check('   and tight: one less never covers N', tight);
}

console.log('\n--- the generalisation reproduces set AQ term for term ---');
{
  // A constant sequence is the special case AQ swept. If this identity fails anywhere,
  // AR is costing a different model and every comparison between the two sets is void.
  // Every pair is visited rather than stopping at the first disagreement, so the
  // detail line reports how widespread a divergence is rather than only where the
  // scan happened to reach.
  let bad = null, cells = 0, wrong = 0;
  for (const regime of ['vector', 'merkle']) {
    for (const n of AQ.LEAVES) for (const gamma of AQ.GAMMAS) {
      for (const b of [2, 3, 4, 7, 64, 256, 1024]) {
        const d = AQ.depth(n, b);
        cells++;
        if (A.costOf(regime, d, d * b, gamma) !== AQ.total(regime, n, b, gamma)) {
          wrong++;
          if (!bad) bad = `${regime} n=${n} b=${b} gamma=${gamma}`;
        }
      }
    }
  }
  check(`a constant sequence costs exactly what AQ charges, at all ${cells} pairs`,
    wrong === 0, `${wrong} disagree, first at ${bad}`);
  check('   and the per-level weights sum to the same total as the closed form',
    ['vector', 'merkle'].every(r => [3, 9, 100].every(n => [0.01, 1, 100].every(g => {
      const s = A.bestSequence(r, n, g);
      return Math.abs(A.costOfSequence(r, s.seq, g) - s.cost) < 1e-9;
    }))));
  // Order is free in this model, and that is design rather than finding. Stated as a
  // check so the claim in the header is a thing the suite can lose.
  check('   and reversing a sequence changes nothing, because order is free here',
    ['vector', 'merkle'].every(r => [1, 100, 7498].every(g =>
      Math.abs(A.costOfSequence(r, [3, 9, 27], g) - A.costOfSequence(r, [27, 9, 3], g)) < 1e-9)));
}

console.log('\n--- no product is ever formed in full ---');
{
  // The guarded predicate exits the moment the running product reaches N; the
  // unguarded one completes it. At 13 levels of 1024 the full product is about 10^39,
  // which a JavaScript number cannot hold exactly, and past 2^1024 it is Infinity.
  check('the guarded predicate answers where the unguarded product is not an integer',
    A.maxprodAtLeast(13 * 1024, 13, 1000) === true
    && !Number.isSafeInteger(A.maxprodOverflow(13 * 1024, 13)));
  check('   and the unguarded one runs to Infinity at a width this sweep visits',
    A.maxprodOverflow(1024 * 400, 400) === Infinity);
  check('   while the guarded one still answers there', A.maxprodAtLeast(1024 * 400, 400, 1e9));
}

console.log('\n--- the depth bound is a proof, not an exhausted budget ---');
{
  check('depth never usefully exceeds depth(N, 2), demonstrated by costing past it',
    [11, 100, 486, 1025, 4097, 65536].every(n =>
      A.depthBoundIsProved('vector', n, A.GMAX) && A.depthBoundIsProved('merkle', n, 1)));
  check('   and the optimum never sits at the bound in the vector regime by accident:'
    + ' the bound is where the all-twos tree lands',
    A.maxUsefulDepth(1024) === 10 && A.maxUsefulDepth(1025) === 11);
}

console.log('\n--- the control, asserted responsive before its verdict is read ---');
{
  // AQ's registered control gave bytes and verify the SAME draw, so its total was a
  // constant times (1 + gamma) and the swept rate factored straight out: it could only
  // ever agree, whatever the trees did. F-CONTROL-CANNOT-DISCRIMINATE. This one draws
  // the two independently, and the three lines below are the antibody.
  const r = A.controlResponse();
  check(`the control's optimum MOVES with the exchange rate (${r.movedWithGamma} of`
    + ` ${r.leaves} leaf counts)`, r.movedWithGamma > r.leaves / 2,
    JSON.stringify(r));
  check('   and its optimal sequences are NOT near-equal partitions, so it does not'
    + ' reproduce the structure the closed form imposes on the real regimes',
    r.notNearEqual > r.leaves / 2, `${r.notNearEqual}/${r.leaves}`);
  check('   and the two noise draws are independent, which is what makes the first'
    + ' two possible', (() => {
      let same = 0;
      for (let b = 2; b <= A.BMAX; b++) if (A.NOISE_B[b] === A.NOISE_V[b]) same++;
      return same < 20;
    })());
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
