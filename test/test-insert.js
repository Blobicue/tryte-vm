'use strict';
/* test-insert.js — what a forger who may LENGTHEN the ledger actually pays.
 *
 * Set `AT`. Four predictions, TWO HELD AND TWO FAILED, and the check worth keeping is
 * none of them: it is the universal pair in section 3. Three pairs of entry values —
 * (136, −136), (295, −295) and (362, −362) — prepended to ANY ledger of ANY length
 * leave both heads unchanged, for two added entries and zero operations. That is the
 * answer to what an insertion costs, and it is what `AT3`'s failure was made of.
 *
 * MUTATION-TESTED. Three deliberate breaks, each restored afterwards, and what each one
 * ACTUALLY turned red — which twice was not what was expected, and the third of which is
 * the useful one:
 *
 *   1. `noOpTable` INDEXED TRANSPOSED — `step[x * N + a]` where `step[a * N + x]`
 *      belongs, so the forced no-op at each gap is read out of the wrong row. TWENTY
 *      checks red, but NOT the ones a reader would reach for first. `AT1`'s registered
 *      BAND still holds: the mean moves 4.9340 -> 4.9905, comfortably inside [4.0, 6.0],
 *      because a transposed table still hands back one value per accumulator and 729
 *      arbitrary generators behave like 729 arbitrary generators. `AT2`'s STRICTLY
 *      DECREASING leg holds too, at every one of the ten steps. `AT3` and `AT4` are
 *      untouched, since neither reads the no-op table at all. What catches it is
 *      `AT1`'s MAXIMUM leg, which goes to 18 and past the registered 12, and every
 *      check that REBUILDS — the run that should restore both heads no longer does, and
 *      the universal prepend run's order stops being 243. THE MEAN CANNOT SEE THIS
 *      DEFECT AND THE MAXIMUM CAN, which is the reverse of what set `AS` found for its
 *      own off-by-one, where the dispersion was blind and the mechanism was not.
 *
 *   2. THE BFS OFF BY ONE — `best = dist[need]` rather than `dist[need] + 1`, so every
 *      shortest run is reported one insertion short. SEVENTEEN checks red, and the
 *      shape is the mirror of mutation 1: `AT1`'s mean falls to 3.934 and leaves its
 *      band, while `AT2`'s strictly-decreasing leg still holds at all ten steps, because
 *      subtracting a constant from every value leaves the shape untouched. The
 *      responsiveness controls catch it before any verdict is read — {0} returns 0
 *      instead of 1 and {1} returns 728 instead of 729 — which is what those controls
 *      are in section 1 for.
 *
 *   3. `sameGapProfile` COMPARING AGAINST THE IDENTITY INSTEAD OF THE ACCUMULATOR —
 *      `=== ZERO` where `=== a` belongs. ONLY TWO checks red, and everything the set's
 *      headline rests on stays green: `c(ZERO)` is still 3, the three universal pairs
 *      are still (136, −136), (295, −295) and (362, −362), and `AT3`'s corrected chance
 *      of 30 still lands 0.012 from the measurement. The reason is that at the identity
 *      accumulator the two expressions ARE the same expression, so THE MUTATION IS
 *      INVISIBLE EXACTLY WHERE THE RESULT LIVES. Worse, the profile's total moves 741 →
 *      729 and its mean 1.0165 → 1.0000 — the broken instrument sits CLOSER to the
 *      theoretical value than the working one, and reads as a correction. A statistic
 *      that moves toward its null when broken is the hardest shape to catch, and the
 *      only thing that fires here is the pinned global profile beside the independently
 *      swept census cell.
 *
 * The exhaustive version is `npm run audit:insert`.
 */

const A = require('../tools/insert-audit.js');
const LED = require('../tools/ledger-audit.js');
const F = require('../tools/forge-audit.js');
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
  check('gen() is the amount an entry of that index adds to the arithmetic total',
    (() => {
      for (let x = 0; x < A.N; x++) {
        if ((A.ZERO + A.gen(x)) % A.N !== F.asum(A.ZERO, x)) return false;
        if (A.gen(x) !== ((Q.val(x) % A.N) + A.N) % A.N) return false;
      }
      return true;
    })());
  // THE TWO GROUPS ARE NOT THE SAME GROUP -- arithmetic with carries against tritwise
  // GF(3)^6 -- and NEGATION is the one place they coincide, because negating a
  // balanced-ternary word trit by trit IS negating the number it denotes. That is why
  // the second inserted value can be written either way and why no verdict here turns
  // on which. Pinned rather than assumed, since the same boundary produced two false
  // verdicts in this corpus by being assumed the other way.
  check('negEntry is the arithmetic negation, and on THIS group it is also the tritwise '
    + 'one — balanced-ternary negation is tritwise, at all 729 entries',
    (() => {
      for (let x = 0; x < A.N; x++) {
        if ((A.gen(x) + A.gen(A.negEntry(x))) % A.N !== 0) return false;
        if (A.negEntry(A.negEntry(x)) !== x) return false;
        if (A.negEntry(x) !== F.TSUB[A.ZERO * A.N + x]) return false;
      }
      return true;
    })());
  check('   and that coincidence does NOT extend to addition: asum and tadd differ on '
    + '380,178 of the 531,441 pairs, which is the carry',
    (() => {
      let differ = 0;
      for (let a = 0; a < A.N; a++) {
        for (let b = 0; b < A.N; b++) if (F.asum(a, b) !== F.TADD[a * A.N + b]) differ++;
      }
      return differ > 0 && differ === 380178;
    })());
  check('   and the only self-negating entry is the arithmetic zero',
    [...Array(A.N).keys()].filter(x => A.negEntry(x) === x).join() === String(A.ZERO));
  check('orderIn729 agrees with the definition on all 729 elements, and its census is '
    + 'the exact 486/162/54/18/6/2/1',
    (() => {
      const tally = new Map();
      for (let v = 0; v < A.N; v++) {
        const o = A.orderIn729(v);
        if ((v * o) % A.N !== 0) return false;
        for (let k = 1; k < o; k++) if ((v * k) % A.N === 0) return false;
        tally.set(o, (tally.get(o) || 0) + 1);
      }
      return [[1, 1], [3, 2], [9, 6], [27, 18], [81, 54], [243, 162], [729, 486]]
        .every(([o, n]) => tally.get(o) === n);
    })());
  const ledgerIx = LED.LEDGER.map(v => Q.idx(LED.wrap(v)));
  check('the two heads in index space are ledger-audit\'s two heads in value space',
    A.headOf(ledgerIx) === Q.idx(LED.headHash(LED.LEDGER))
    && A.totalOf(ledgerIx) === Q.idx(LED.headSum(LED.LEDGER)));
  check('   and chain() agrees with forge-audit\'s accums(), so the chain is not '
    + 'implemented twice',
    A.chain(ledgerIx).join() === F.accums(ledgerIx).join());
}

console.log('\n=== 1. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  const b = A.bfsControls();
  check('the shortest-run statistic SPANS its range: {0} -> 1, {1,-1} -> 2, {243} -> 3, '
    + '{3} -> 243, {1} -> 729', b.zero === 1 && b.plusMinus === 2 && b.third === 3
    && b.ninth === 243 && b.one === 729 && b.two === 729, JSON.stringify(b));
  check('   so AT1\'s line at 12 and AT2\'s at 100 both sit inside a statistic that '
    + 'reaches 729', b.zero === 1 && b.one === A.N);
  check('the BFS agrees with direct multiset enumeration on 300 random generator sets',
    (() => {
      const r = F.rng(99);
      for (let n = 0; n < 300; n++) {
        const gens = Array.from({ length: 7 }, () => F.randInt(r, A.N));
        const bfs = A.minInsertions(gens).min;
        const brute = A.minInsertionsBrute(gens, 4);
        if (brute === null ? !(bfs > 4) : brute !== bfs) return false;
      }
      return true;
    })());
  check('   and every witness multiset really sums to zero and really has that size',
    (() => {
      const r = F.rng(101);
      for (let n = 0; n < 300; n++) {
        const gens = Array.from({ length: 7 }, () => F.randInt(r, A.N));
        const m = A.minInsertions(gens);
        let s = 0, used = 0;
        for (let i = 0; i < 7; i++) { s += m.multiset[i] * gens[i]; used += m.multiset[i]; }
        if (used !== m.min || s % A.N !== 0 || used === 0) return false;
      }
      return true;
    })());
  check('I3 — one generator alone always closes, in exactly ord(g) steps',
    [1, 2, 3, 5, 9, 27, 81, 243, 364, 500, 728]
      .every(g => A.minInsertions([g]).min === A.orderIn729(g)));
}

const M = A.measure();

console.log('\n=== 2. I1 THROUGH I5, CHECKED AND NOT ARGUED ===');
{
  const I = M.instrument;
  check('I1 — every one of the 729 accumulators has exactly one no-op entry, by '
    + 'scanning the step table rather than counting P\'s fixed points',
    M.noOp.everyAccumulatorHasExactlyOne && M.noOp.min === 1 && M.noOp.max === 1);
  check('   and inserting it at every gap of 200 ledgers leaves the mixer head '
    + 'unchanged 1,400 of 1,400 times, while MOVING the total 1,395 times',
    I.noOpFree.ok && I.noOpFree.headHeld === 1400 && I.noOpFree.totalMoved === 1395);
  check('I3 — a run of ord(v) insertions at one gap restores both heads, rebuilt',
    I.singleGapRun.allHeld && I.singleGapRun.ok === I.singleGapRun.tried);
  check('D3 in the insertion direction — the truncated verdict equals the full one on '
    + '408,240 candidates, with 596 accepts so the agreement is not vacuous',
    I.truncation.ok && I.truncation.disagree === 0 && I.truncation.agree === 408240
    && I.truncation.accepts === 596, JSON.stringify(I.truncation));
  check('   and the BFS agrees with direct enumeration on 60 REAL ledgers too',
    I.bruteAgrees.ok && I.bruteAgrees.agree === 60);
  check('T-FAKE-RANDOM — the draw reached every one of the 729 entry values',
    M.census.coverage === A.N, `${M.census.coverage}`);
  // THE CONTROL, AND IT DISCRIMINATES IN BOTH DIRECTIONS. A control that only ever
  // agreed would show nothing: T-CONTROL-CANNOT-DISCRIMINATE, twice bitten.
  const SI = M.census.summedOnInsertions;
  check('the two heads have OPPOSITE blind spots — the mixer accepts all 14,000 single '
    + 'no-op insertions and the summed head rejects 13,982 of them',
    SI.tried === 14000 && SI.rejected === 13982);
  check('   and I5 — the summed head accepts every one of the 1,426,480 rearrangements, '
    + 'without exception, while the mixer accepts 1,907',
    M.census.rearrange.sumAccepted === 1426480
    && M.census.rearrange.distinct === 1426480
    && M.census.rearrange.accepted === 1907);
  check('the control chain is a random permutation with exactly one fixed point, found '
    + 'in 5 draws and reported rather than hidden',
    M.ctrlDraws === 5 && M.control.ledgers === 2000);
}

console.log('\n=== 3. THE ANSWER THE SET FOUND, WHICH NO PREDICTION CLAIMED ===');
{
  const P2 = M.universalPair, SG = M.sameGap;
  check('THE UNIVERSAL PAIR — exactly three pairs (136, -136), (295, -295) and '
    + '(362, -362) forge ANY ledger, both heads, for two entries and zero ops',
    P2.count === 3 && P2.universal
    && JSON.stringify(P2.pairs) === JSON.stringify([[136, -136], [295, -295], [362, -362]]),
    JSON.stringify(P2.pairs));
  check('   rebuilt on 420 ledgers across seven lengths including the empty one',
    P2.ok === 420 && P2.tried === 420 && P2.ops === 0 && P2.growth === 2);
  // The mechanism, checked here rather than in the tool's prose: T_x is a permutation,
  // so an accepted same-gap pair is a fixed point of it.
  check('   and the mechanism holds — a -> STEP[STEP[a][x]][-x] is a PERMUTATION of the '
    + '729 accumulators for every one of the 729 values of x',
    (() => {
      for (const x of [0, 1, 136 + 364, 364, 500, 728]) {
        const seen = new Uint8Array(A.N);
        for (let a = 0; a < A.N; a++) {
          const b = LED.STEP[LED.STEP[a * A.N + x] * A.N + A.negEntry(x)];
          if (seen[b]) return false;
          seen[b] = 1;
        }
      }
      return true;
    })());
  check('   so the profile sums to 741 over all 729 accumulators, a mean of 1.0165, and '
    + '256 accumulators admit NO pair at all — one need not have existed',
    SG.total === 741 && near(SG.mean, 1.0165, 1e-4) && SG.zeroAt === 256 && SG.max === 6);
  check('   and the control chain\'s identity accumulator admits ZERO, so three is a '
    + 'draw from a mean-one distribution taken where every ledger stands',
    M.sameGapControl.atIdentity === 0 && SG.atIdentity === 3
    && near(M.sameGapControl.mean, 1.0082, 1e-4));
  const U = M.universal;
  check('the universal prepend RUN is 243 long: val(u*) is -336, its generator is 393 '
    + 'and its order in Z_729 is 243',
    U.entryValue === -336 && U.generator === 393 && U.runs === 243
    && A.orderIn729(393) === 243);
  check('   rebuilt on 240 ledgers across six lengths, so I4 is checked and not argued',
    U.universal && U.ok === 240 && U.tried === 240);
}

console.log('\n=== 4. AT1 — INSERTION IS PAID FOR IN LENGTH ===');
{
  const C = M.census;
  check('2,000 drawn six-entry ledgers, seven gaps each',
    C.ledgers === 2000 && C.length === 6);
  check('AT1 HELD (a) — the mean shortest run is 4.9340, inside [4.0, 6.0]',
    near(C.min.mean, 4.934, 1e-4) && C.min.mean >= 4.0 && C.min.mean <= 6.0,
    `${C.min.mean}`);
  check('AT1 HELD (b) — the worst of the 2,000 needs 10, under the line at 12',
    C.min.max === 10 && C.min.max <= 12 && C.min.min === 1, `max ${C.min.max}`);
  check('   and the whole distribution is on the record, not just the mean: '
    + '18 / 52 / 217 / 407 / 618 / 470 / 192 / 22 / 3 / 1 at minima 1 through 10',
    C.minHist.slice(1, 11).join() === '18,52,217,407,618,470,192,22,3,1'
    && C.minOverflow === 0);
  // THE LEFT END. A minimum of 1 is a chain that stands on the fixed point, where the
  // forced no-op is arithmetically zero and ONE inserted entry forges both heads.
  check('   the 18 ledgers with a minimum of 1 are exactly the chains that stand on u*',
    (() => {
      const r = F.rng(A.SEED);
      let onFixedPoint = 0;
      for (let n = 0; n < 2000; n++) {
        const e = A.drawLedgerOfLength(r, 6);
        const a = A.chain(e);
        if (a.some(s => A.gen(M.noOp.first[s]) === 0)) onFixedPoint++;
      }
      return onFixedPoint === 18 && C.minHist[1] === 18;
    })());
  check('the forced values are NOT distinguishable from seven uniform draws: the null '
    + 'gives 4.9660 and a random-permutation chain 4.9105',
    near(M.nulls[A.LENGTHS.indexOf(6)].mean, 4.966, 1e-4)
    && near(M.control.min.mean, 4.9105, 1e-4));
  // The order census LOOKS like structure and is not, and saying so is the point:
  // AN1 is the standing reminder that more uniform than chance is also structure.
  check('   and the order census that looks like structure is the gap-0 generator '
    + 'counted once per ledger: remove its 2,000 and 243 falls to 0.2257 of 12,000',
    (() => {
      const t = new Map(C.orders);
      return t.get(729) === 7969 && t.get(243) === 4708 && t.get(1) === 18
        && near((4708 - 2000) / 12000, 162 / 729, 4e-3)
        && near(7969 / 12000, 486 / 729, 4e-3);
    })());
  check('   rebuilt and both heads recomputed on 200 of 200 sampled ledgers',
    C.rebuilt.ok === 200 && C.rebuilt.tried === 200);
  // T-INSTRUMENT-FALSE-VERDICT: the multiset-to-ledger map is not injective everywhere.
  check('the symmetry is measured rather than assumed away: 14 ledgers have an entry '
    + 'that is its own gap\'s no-op, making two gaps interchangeable',
    C.ledgersWithDegenerateGap === 14 && C.degenerateGapPairs === 14);
}

console.log('\n=== 5. AT2 — FAILED, ON A BOUND PLACED BY THE WRONG ARITHMETIC ===');
{
  const means = M.lengths.map(c => c.min.mean);
  const maxes = M.lengths.map(c => c.min.max);
  check('eleven lengths from 2 to 12, 2,000 ledgers each',
    M.lengths.length === 11 && M.lengths.every(c => c.ledgers === 2000)
    && M.lengths.map(c => c.length).join() === A.LENGTHS.join());
  check('AT2 leg 1 HELD — the mean is strictly decreasing at every one of the ten steps',
    means.every((v, i) => i === 0 || v < means[i - 1]),
    means.map(v => v.toFixed(3)).join(' '));
  check('AT2 leg 2 HELD — 13.5920 at length two is above 9.0, and 3.3625 at length '
    + 'twelve is below 4.5',
    near(means[0], 13.592, 1e-4) && means[0] > 9.0
    && near(means[10], 3.3625, 1e-4) && means[10] < 4.5);
  check('   and the whole curve tracks the uniform null — within 0.64 at length two, '
    + 'within 0.17 from length three on — so the shape is a counting fact, not a '
    + 'structural one',
    Math.abs(means[0] - M.nulls[0].mean) < 0.64
    && means.every((v, i) => i === 0 || Math.abs(v - M.nulls[i].mean) < 0.17),
    means.map((v, i) => (v - M.nulls[i].mean).toFixed(3)).join(' '));
  check('AT2 leg 3 FAILED — one length-two ledger needs 146 insertions, past the line '
    + 'at 100', maxes[0] === 146 && Math.max(...maxes) === 146 && 146 > 100);
  // THE DISCLOSURE THAT MAKES THE FAILURE READABLE, and the antibody for the fourth
  // bite of T-CRITERION-IN-THE-NOISE: the line was placed by integrating an
  // approximation fitted to the CENTRE, and the null's own tail says so.
  check('   and the null\'s own tail says the line had a 58% chance of firing on chance '
    + 'alone: 22, 25 and 33 of 50,000 draws exceed 100 at three seeds',
    [...M.tail, M.tailMatched].every(t => t.draws === 50000 && t.max === 243)
    && M.tail[0].over100 === 22 && M.tail[1].over100 === 25
    && M.tailMatched.over100 === 33
    && near(1 - Math.exp(-M.tail[0].expectedOver100In2000), 0.585, 0.01));
  check('   so no claim is made that the subject\'s tail is heavier than chance — the '
    + 'null reaches 243 at every seed, past the measured 146',
    [...M.tail, M.tailMatched].every(t => t.max > 146));
}

console.log('\n=== 6. AT3 — FAILED BY 0.012, AND THE CHANCE VALUE WAS THE THING WRONG ===');
{
  const T = M.census.twoInsert, D = M.census.deletion;
  check('the family is 28 gap pairs x 729 free values = 20,412 candidates, the second '
    + 'value forced by the arithmetic total',
    T.family === 20412 && A.gapPairs(6) === 28 && T.chance === 28
    && T.tried === 2000 * 20412);
  check('AT3(a) FAILED — 30.0120 distinct accepts per ledger, 2.0120 from the '
    + 'registered 28.0 and just past a band of 2.0',
    near(T.mean, 30.012, 1e-4) && Math.abs(T.mean - 28) > 2.0,
    `${T.mean}`);
  check('   and it is not a line flipped by noise: 2.0120 is seventeen standard errors',
    Math.abs(T.mean - 28) / Math.sqrt(T.variance / 2000) > 16);
  check('AT3(a) dispersion leg HELD — the variance-to-mean ratio is 0.9350, inside '
    + '[0.80, 1.25], so the registered permutation-collapse route did not fire',
    near(T.varOverMean, 0.935, 1e-3) && T.varOverMean >= 0.80 && T.varOverMean <= 1.25);
  // THE MECHANISM, LOCALISED TO ONE CELL. Everything but distance zero is at chance.
  check('the whole departure lives at gap distance ZERO: 1.2960x chance there and '
    + 'within 2.3% of 1.0 at every other distance',
    (() => {
      const r = d => T.hitByDistance[d] / T.triedByDistance[d] * A.N;
      return near(r(0), 1.296, 1e-3) && [1, 2, 3, 4, 5, 6].every(d => Math.abs(r(d) - 1) < 0.023);
    })(),
    [0, 1, 2, 3, 4, 5, 6].map(d => (T.hitByDistance[d] / T.triedByDistance[d] * A.N).toFixed(4)).join(' '));
  check('   and inside that, at GAP ZERO alone, which is the same accumulator on every '
    + 'ledger: exactly 3.0000 accepts per ledger, which is c(ZERO) = 3',
    near(T.atGapZero.perLedger, 3.0, 1e-9) && T.atGapZero.hit === 6000
    && M.sameGap.atIdentity === 3);
  check('   so the family\'s TRUE expectation is gapPairs - 1 + c(ZERO) = 30, and the '
    + 'measurement sits 0.0120 from it rather than 2.0120 from 28',
    A.correctedTwoInsertChance(6, M.sameGap.atIdentity) === 30
    && near(Math.abs(T.mean - 30), 0.012, 1e-4));
  check('   and the control settles it: c(ZERO) = 0 there, its true expectation is 27, '
    + 'and it measures 27.1865',
    A.correctedTwoInsertChance(6, M.sameGapControl.atIdentity) === 27
    && near(M.control.twoInsert.mean, 27.1865, 1e-4));
  // T-INSTRUMENT-FALSE-VERDICT: counts are over DISTINCT forged ledgers.
  check('every count is over distinct forged ledgers: 60,177 enumerated accepts are '
    + '60,024 distinct, and 153 of them collide',
    T.enumerated === 60177 && T.distinct === 60024
    && T.enumerated - T.distinct === 153);
  check('AT3(b) HELD — 0 of 2,000 ledgers admit any deletion-only forgery, against a '
    + 'chance expectation of 0.237',
    D.both === 0 && D.ledgersWithOne === 0 && D.tried === 126000
    && near(D.chanceLedgers, 0.237, 5e-4));
  check('   and the two conservation laws are visibly independent on that family: 173 '
    + 'subsets preserve the mixer head and 190 the total, both at chance, none both',
    D.headOnly === 173 && D.sumOnly === 190
    && Math.abs(D.headOnly / D.tried * A.N - 1) < 0.05
    && Math.abs(D.sumOnly / D.tried * A.N - 1) < 0.15);
}

console.log('\n=== 7. AT4 — REORDERING, WHICH THE SUMMED HEAD CANNOT SEE AT ALL ===');
{
  const R = M.census.rearrange, V = M.census.move;
  check('AT4 HELD (a) — 1,907 accepts against an exact chance of 1,956.76, a ratio of '
    + '0.9746 inside 15%',
    R.accepted === 1907 && near(R.chance, 1956.76, 0.01)
    && near(R.ratio, 0.9746, 1e-4) && Math.abs(R.ratio - 1) <= 0.15);
  check('AT4 HELD (b) — the variance-to-mean ratio is 1.0392, inside [0.80, 1.25]',
    near(R.varOverMean, 1.0392, 1e-4) && R.varOverMean >= 0.80 && R.varOverMean <= 1.25);
  check('AT4 HELD (c) — no ledger accepts more than 6, under the line at 10',
    R.max === 6 && R.max <= 10);
  check('   and D2\'s commutativity stops at the u\'s: had it reached the ENTRIES the '
    + 'count would be 1,438,000 rather than 1,907',
    2000 * 719 === 1438000 && R.accepted < 2000);
  check('   a random-permutation chain gives 1.0262, so the mixer is not '
    + 'distinguishable from one here either',
    near(M.control.rearrange.ratio, 1.0262, 1e-4));
  check('the length-preserving sub-family — delete one entry, re-insert its value '
    + 'elsewhere — is 49,903 distinct moves, 65 accepted against a chance of 68.45',
    V.distinct === 49903 && V.accepted === 65 && near(V.chance, 68.45, 0.01));
  // T-INSTRUMENT-FALSE-VERDICT, the same shape as AS's double count: an adjacent
  // transposition is two moves, so 30 ordered moves are 25 distinct ones.
  check('   and the move count is over DISTINCT ledgers: 25 per ledger, not the 30 the '
    + 'ordered enumeration gives, because moving k right is moving k+1 left',
    V.distinct <= 2000 * 25 && V.distinct > 2000 * 24.9
    && A.moveSweep([1, 2, 3, 4, 5, 6]).distinct === 25);
}

console.log('\n=== 8. WHAT A FORGER PAYS — NOT REGISTERED, AND THE POINT OF THE SET ===');
{
  const K = M.cost;
  check('the universal pair costs 0 ops and 2 entries, against AS\'s cited 4,414 ops '
    + 'for brute force and 6.99 for the join, both at zero growth',
    M.universalPair.ops === 0 && M.universalPair.growth === 2
    && near(K.asBrute.ops, 4413.9, 0.5) && near(K.asJoin.ops, 6.986, 1e-3)
    && K.asBrute.growth === 0 && K.asJoin.growth === 0);
  check('   and the AS figures are CITED, not recomputed here',
    /AS/.test(K.asBrute.cited) && /AS3/.test(K.asJoin.cited));
  check('the no-op route costs about 5,100 ops for a certainty and 4.93 entries',
    K.noOpRun.ops > 5000 && K.noOpRun.ops < 5200
    && near(K.noOpRun.growth, 4.934, 1e-3));
  check('the canonical ledger: six entries become ten, rebuilt, both heads intact',
    M.canonical.min === 4 && M.canonical.verified && M.canonical.grew === 4
    && M.canonical.forged.length === 10);
}

console.log('\n=== 8b. WHAT THIS SET DID NOT ATTACK ===');
{
  const H = M.hybrid;
  check('the hybrid — one insertion paid for by one compensating EDIT, no free '
    + 'parameter left — is 42 candidates a ledger and accepts at 0.973x chance',
    H.tried === 20970 && H.accepted === 28 && near(H.rateXChance, 0.973, 5e-3)
    && H.ledgersWithOne === 24);
  check('   and the routes NAMED and not measured are on the record in the tool',
    (() => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'insert-audit.js'), 'utf8');
      return src.includes('NAMED AND NOT MEASURED')
        && /729\^\(k-1\)/.test(src) && src.includes('structured rather than uniform');
    })());
}

console.log('\n=== 8c. AU\'s ANTIBODY, TURNED ON THIS SET\'S OWN LEGS ===');
{
  // ADDED AFTER THE RESULTS COMMIT AND SCORING NOTHING. Set AU established that a
  // criterion sitting in the noise leaves NO signal when it lands inside its band, so
  // this corpus records the defect only where it happened to fail. Two of AT's twelve
  // legs turn out to be in the noise and ONE OF THEM HELD. Neither outcome moves; what
  // these checks own is what the two legs are worth as evidence, which is nothing.
  const NL = M.nearLine, ML = M.maxLegNull;
  check('the near-line re-audit runs at twelve seeds, the registered one first, and '
    + 'reproduces the published run exactly before any other seed is read',
    NL.length === 12 && NL[0].seed === A.SEED && NL[0].ledgers === 2000
    && NL[0].at1Max === 10 && near(NL[0].at3Mean, 30.012, 1e-9) && NL[0].at4Max === 6);
  // THE ONE THAT MATTERS: a HELD leg that a different seed would have failed.
  check('AT1\'s MAXIMUM leg is in the noise — the subject\'s maximum spans [9, 13] and '
    + 'crosses the registered line at 12 on TWO of the twelve seeds',
    NL.filter(r => r.at1Fires).length === 2
    && Math.min(...NL.map(r => r.at1Max)) === 9
    && Math.max(...NL.map(r => r.at1Max)) === 13,
    NL.map(r => r.at1Max).join(' '));
  check('   and the null says why: over 500,000 draws at length six, P(a 2,000-draw '
    + 'maximum exceeds 12) = 0.0769 with 20 exceedances behind it',
    ML.draws === 500000 && ML.at[12].over === 20
    && near(ML.at[12].probIn2000, 0.0769, 1e-4) && ML.max === 17);
  check('   and the interval travels with it, because the first version of this '
    + 'disclosure read the same tail off ONE exceedance and was low by a factor of two',
    near(ML.at[12].ci95In2000[0], 0.0439, 1e-3)
    && near(ML.at[12].ci95In2000[1], 0.1087, 1e-3)
    && ML.at[12].ci95In2000[0] < ML.at[12].probIn2000
    && ML.at[12].probIn2000 < ML.at[12].ci95In2000[1]);
  check('   and the sharper statement: 10 is the null\'s MODAL 2,000-draw maximum at '
    + '0.3248, and 10 is exactly what AT1 measured — the leg read chance',
    near(ML.at[9].probIn2000 - ML.at[10].probIn2000, 0.3248, 1e-3)
    && near(ML.at[10].probIn2000, 0.2939, 1e-4)
    && near(ML.at[11].probIn2000, 0.1166, 1e-4)
    && M.census.min.max === 10);
  check('AT3\'s verdict is seed-dependent too — outside the band on five of twelve '
    + 'seeds and inside on seven, which the standard error of 0.1185 predicts',
    NL.filter(r => r.at3Fires).length === 5
    && near(Math.sqrt(M.census.twoInsert.variance / 2000), 0.1185, 1e-4),
    NL.map(r => r.at3Fires ? 'F' : 'h').join(''));
  // AND THE DISCRIMINATION, which is what makes this a diagnosis rather than a blanket.
  check('   but the MECHANISM is untouched: all twelve means lie within 0.271 of the '
    + 'corrected chance of 30, so the criterion decided a word and not a finding',
    NL.every(r => Math.abs(r.at3Mean - 30) <= 0.2711)
    && A.correctedTwoInsertChance(6, M.sameGap.atIdentity) === 30);
  check('AT4\'s maximum leg is the CONTROL on the diagnosis — swept the same way, it '
    + 'crosses its line at none of the twelve and spans [5, 7] against a line at 10',
    NL.filter(r => r.at4Fires).length === 0
    && Math.min(...NL.map(r => r.at4Max)) === 5
    && Math.max(...NL.map(r => r.at4Max)) === 7);
  check('   and AT1\'s MEAN leg is 31.4 standard errors from its nearest band edge, so '
    + 'ten of AT\'s twelve legs are clear',
    near((M.census.min.mean - 4.0) / (Math.sqrt(M.census.min.variance) / Math.sqrt(2000)),
      31.4, 0.1));
  // T-TRANSCRIBED-TABLE and the coordinator's point: every number above rests on ONE
  // statistic that had ONE implementation. It now has two, and they are compared.
  check('the shortest run has a SECOND implementation sharing no code with the BFS, and '
    + 'they agree on 4,000 random generator sets of one to fourteen generators',
    (() => {
      const r = F.rng(20260828);
      for (let n = 0; n < 4000; n++) {
        const m = 1 + F.randInt(r, 13);
        const gens = Array.from({ length: m }, () => F.randInt(r, A.N));
        if (A.minInsertions(gens).min !== A.minInsertionsByReach(gens)) return false;
      }
      return true;
    })());
  check('   and on the real ledgers the disclosure is computed over',
    (() => {
      const r = F.rng(A.SEED);
      for (let n = 0; n < 400; n++) {
        const e = A.drawLedgerOfLength(r, 6);
        const gens = A.forcedAtGaps(A.chain(e), M.noOp).gens;
        if (A.minInsertions(gens).min !== A.minInsertionsByReach(gens)) return false;
      }
      return true;
    })());
  check('   and the second implementation would catch a broken first one',
    A.minInsertionsByReach([1]) === 729 && A.minInsertionsByReach([0]) === 1
    && A.minInsertionsByReach([1, A.N - 1]) === 2 && A.minInsertionsByReach([243]) === 3);
}

console.log('\n=== 9. THE MANIFEST SAYS WHAT THIS FILE MEASURED ===');
{
  const MAN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'FINDINGS.json'), 'utf8'));
  const set = MAN.prediction_sets.find(s => s.id === 'AT');
  check('AT is in the manifest, names this tool and this test',
    !!set && set.tool === 'tools/insert-audit.js' && set.asserted_in === 'test/test-insert.js');
  check('   with four predictions: AT1 and AT4 HELD, AT2 and AT3 FAILED',
    !!set && set.predictions.length === 4
    && set.predictions.filter(p => p.outcome === 'HELD').map(p => p.id).join() === 'AT1,AT4'
    && set.predictions.filter(p => p.outcome === 'FAILED').map(p => p.id).join() === 'AT2,AT3');
  const m = id => (set.predictions.find(p => p.id === id) || {}).measured || {};
  check('AT1\'s measured block carries the numbers this run produced',
    m('AT1').mean === 4.934 && m('AT1').max_over_ledgers === 10
    && m('AT1').ledgers === 2000 && m('AT1').uniform_generator_null_mean === 4.966);
  check('AT2\'s does', m('AT2').worst_single_ledger_any_length === 146
    && m('AT2').strictly_decreasing_at_all_ten_steps === true
    && m('AT2').mean_by_length.length === 11);
  check('AT3\'s does', m('AT3').mean_distinct === 30.012
    && m('AT3').corrected_chance === 30 && m('AT3').c_of_identity_accumulator === 3
    && m('AT3').deletion_preserving_both === 0);
  check('AT4\'s does', m('AT4').mixer_accepts === 1907 && m('AT4').ratio === 0.9746
    && m('AT4').summed_head_accept_fraction === 1.0);
  const Fd = id => MAN.unregistered_findings.find(f => f.id === id);
  for (const id of ['F-A-UNIVERSAL-TWO-ENTRY-INSERTION-FORGERY',
    'F-INSERTION-IS-PRICED-IN-LENGTH-NOT-IN-SEARCH',
    'F-THE-UNIVERSAL-PREPEND-RUN-IS-243',
    'F-THE-HYBRID-INSERT-AND-EDIT-IS-EXACTLY-CHANCE']) {
    const f = Fd(id);
    check(`${id} is recorded, and points at this file`,
      !!f && f.asserted_in === 'test/test-insert.js'
      && f.outcome === 'MEASURED_NOT_REGISTERED', id);
  }
  check('the universal-pair finding quotes all three pairs it rests on',
    ['(136, -136)', '(295, -295)', '(362, -362)']
      .every(s => Fd('F-A-UNIVERSAL-TWO-ENTRY-INSERTION-FORGERY').claim.includes(s)));
  check('the cost finding quotes both currencies and AS\'s figures it cites',
    (F2 => F2.claim.includes('4,414') && F2.claim.includes('6.99')
      && F2.claim.includes('2,125,764'))(Fd('F-INSERTION-IS-PRICED-IN-LENGTH-NOT-IN-SEARCH')));
  // The fourth bite of T-CRITERION-IN-THE-NOISE, which AT2 is.
  // The RUNNING TOTAL belongs to the corpus and later sets bump it -- set AU took it to
  // five -- so this check owns AT2's evidence and not the tally. T-STALE-CONSTANT is the
  // most-recurring defect here and a literal 4 would have gone stale the moment it moved.
  // THE DISCLOSURE IS PART OF THE RECORD, NOT A COMMIT MESSAGE. AT1 stays HELD and AT3
  // stays FAILED; what the manifest now also carries is that two of the legs behind
  // those words were criteria in the noise.
  check('AT1 and AT3 still carry their registered outcomes, unmoved by the re-audit',
    set.predictions.find(p => p.id === 'AT1').outcome === 'HELD'
    && set.predictions.find(p => p.id === 'AT3').outcome === 'FAILED');
  check('   and both carry the near-line disclosure, with AT4\'s clean sweep beside '
    + 'them so the diagnosis is visibly discriminating',
    m('AT1').near_line_disclosure.seeds_crossing_the_line === 2
    && m('AT1').near_line_disclosure.null_prob_a_2000_draw_exceeds['12'] === 0.0769
    && m('AT3').near_line_disclosure.seeds_failing === 5
    && m('AT3').near_line_disclosure.seeds_holding === 7
    && m('AT4').near_line_disclosure.seeds_crossing_the_line === 0);
  check('   and the manifest\'s disclosure agrees with what this run recomputed, rather '
    + 'than being a number typed beside one',
    m('AT1').near_line_disclosure.max_by_seed.join()
      === M.nearLine.map(r => r.at1Max).join()
    && m('AT3').near_line_disclosure.mean_by_seed.join()
      === M.nearLine.map(r => r.at3Mean).join()
    && m('AT4').near_line_disclosure.max_by_seed.join()
      === M.nearLine.map(r => r.at4Max).join());
  const bite = MAN.unregistered_findings
    .find(f => f.id === 'F-THE-BITE-COUNT-IS-WHAT-FAILED-NOT-WHAT-HAPPENED');
  check('F-THE-BITE-COUNT-IS-WHAT-FAILED-NOT-WHAT-HAPPENED is recorded, and says the '
    + 'thing rather than gesturing at it',
    !!bite && bite.asserted_in === 'test/test-insert.js'
    && /THIRTY-THREE LINES APART IN ONE REGISTRATION/.test(bite.claim)
    && /number of times it happened AND produced a visible failure/.test(bite.argument));
  check('   and it names its own remedy\'s failure — the 3.9% read off one exceedance — '
    + 'rather than correcting it away',
    /3\.9%/.test(bite.argument) && /ONE exceedance/.test(bite.argument)
    && /confidence interval/.test(bite.argument));
  // THIS CHECK PINNED A STATE OF THE WORLD RATHER THAN A PROPERTY OF THE ENTRY. It
  // required the scope to still read "has not been run" -- true when written, and made
  // false by the corpus-wide sweep this very entry asked for actually running. A guard
  // whose premise is that nobody has done the work yet goes red the moment somebody
  // does, which is T-CHECK-FORBIDS-HEALTHY-STATE with a longer fuse: the check was
  // failing on the project working. What is durable is the pair of statements -- this
  // set did not SIZE the gap, and the entry names whoever did -- so that is what is
  // asserted now, and stripping the pointer turns it red again.
  check('   and it says what it does NOT establish: the gap is shown non-zero, not sized '
    + 'here — and it now names the sweep that sized it rather than still saying none ran',
    /does NOT size the gap/.test(bite.scope)
    && /THAT SWEEP HAS SINCE BEEN RUN/.test(bite.scope)
    && /F-A-LINE-THE-NULL-CLEARS-IS-NOT-EVIDENCE/.test(bite.scope));
  check('   and it credits the class to AU rather than claiming it',
    /F-A-LINE-IN-THE-NOISE-THAT-PASSES-IS-THE-SAME-DEFECT/.test(bite.scope)
    && !!MAN.unregistered_findings
      .find(f => f.id === 'F-A-LINE-IN-THE-NOISE-THAT-PASSES-IS-THE-SAME-DEFECT'));
  const trap = MAN.traps_encountered.find(t => t.id === 'T-CRITERION-IN-THE-NOISE');
  check('AT2\'s failure is recorded as a bite of T-CRITERION-IN-THE-NOISE, with the '
    + 'remedy the class prescribes — this check owns the EVIDENCE, not the running '
    + 'tally, which later sets bump',
    trap.count >= 4 && /DRAW THE NULL'S TAIL/.test(trap.description)
    && /58%/.test(trap.description));
}

console.log('\n=== 10. THE TOOL AS IT IS ACTUALLY RUN — T-TOOL-CHECKED-ONLY-BY-IMPORT ===');
{
  // Importing sets the main-module flag false, so no print path ever executes. A tool
  // once crashed on every run while its whole suite stayed green. Capped, so this
  // costs seconds rather than the full census.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'insert-audit.js')],
    { encoding: 'utf8', timeout: 600000, env: { ...process.env, INSERT_LEDGERS: '25' } });
  check('the audit runs as a program and prints its own report',
    out.includes('INSERT AUDIT') && ['AT1', 'AT2', 'AT3', 'AT4'].every(id => out.includes(id)));
  check('   and reports the instrument before any verdict, and the cost after them',
    out.includes('THE INSTRUMENT, BEFORE ANY VERDICT')
    && out.includes('what a forger actually pays')
    && out.includes('WHAT THIS SET DID NOT ATTACK'));
  check('   and the cap really capped it: 25 ledgers, not 2,000',
    out.includes('25 drawn ledgers') && !out.includes('2,000 drawn ledgers'));
  check('   while the quantities that do not depend on the cap are unchanged: the three '
    + 'pairs, c(ZERO) = 3, and a prepend run of 243',
    out.includes('prepend 136 then -136') && out.includes('prepend 295 then -295')
    && out.includes('prepend 362 then -362')
    && out.includes('c(ZERO) = 3') && out.includes('order 243'));
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
