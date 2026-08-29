'use strict';
/* test-width.js — what does the WIDTH of a ledger head buy a forger, and what does it not?
 *
 * Set `AU`. Four predictions, TWO HELD AND TWO FAILED, and the two failures are worth
 * more than the two successes. `AU2` failed on a statistic that does not exist — at width
 * one the collision scan's row map is injective, so 72 of 72 measured rows and 14,400 of
 * 14,400 reshuffled rows have no repeat and the ratio is 0/0. `AU4` failed at width two
 * on the head family this set CHOSE rather than on width, and the unconditioned control
 * run beside it is what says so: 0.5275 conditioned against 0.6450 unconditioned, at the
 * same nine states.
 *
 * The headline is neither of those and no prediction claimed it. In the OPS currency
 * width is worth exactly its own state count against a forger handed a ledger, and its
 * square root against a forger who may choose both ledgers — two laws measured across six
 * widths and separated by a fitted 1.0031 against 0.4642. In the GROWTH currency width is
 * worth almost nothing: about two heads in three at EVERY width admit a two-entry,
 * zero-operation, zero-knowledge forgery, and width six is not rarer than width three.
 *
 * MUTATION-TESTED. Three deliberate breaks, each restored afterwards, and what each one
 * ACTUALLY turned red — which in all three cases was NOT the registered band:
 *
 *   1. THE COLLISION SCAN OFF BY ONE — `hit = x` where `hit = x + 1` belongs, so every
 *      first-repeat index is reported one early. SIX checks red, and the registered
 *      criteria are almost blind to it. `AU2`(b)'s SLOPE moves 0.4642 -> 0.5142 and stays
 *      INSIDE its registered [0.45, 0.55]; `AU2`(a)'s ratio band [0.95, 1.06] is left at
 *      width four, 1.0057 -> 0.9221, and NOT at widths five or six, which go to 0.9522
 *      and 0.9648 and stay inside. Subtracting one from a quantity that grows as sqrt(N)
 *      is a shrinking relative error, so THE WIDE END CANNOT SEE THIS DEFECT AND THE
 *      NARROW END CAN — the reverse of the usual intuition, and the reason the per-width
 *      values are pinned rather than only banded. The two responsiveness controls fire
 *      immediately: the identity head stops repeating at the second try and the affine
 *      head's 84.472 moves. Nothing in `AU1`, `AU3` or `AU4` notices, and neither does
 *      the anchor.
 *
 *   2. THE UNIVERSAL PAIR'S SECOND ENTRY NOT NEGATED — `cAt` looks for
 *      `STEP[STEP[a][x]][x]` instead of `STEP[STEP[a][x]][-x]`, so it counts pairs that
 *      restore the mixer head and MOVE the arithmetic total. NINE checks red, and the
 *      broken instrument lands EXACTLY ON ITS OWN THEORETICAL VALUE: the profile total
 *      goes 741 -> 729 and the mean 1.0165 -> 1.0000, which is the Poisson figure the
 *      registration argues for. The set's headline inverts into a stronger and entirely
 *      false one — the fraction of heads admitting a pair goes to 1.0000 at EVERY width
 *      and the fraction of accumulators admitting none to 0.00000 at every width, so
 *      `AU4`'s width-two failure disappears and the object looks universal. What fires is
 *      the ANCHOR: c(ZERO) goes 3 -> 1 and the witnesses (136, 295, 362) become the
 *      single value -336, which is val(u*), the fixed point itself. A STATISTIC THAT
 *      MOVES ONTO ITS NULL WHEN BROKEN IS THE HARDEST SHAPE TO CATCH, which is `AT`'s
 *      third mutation again and the reason the anchor reproduces published numbers rather
 *      than checking internal consistency.
 *
 *   3. THE BACKWARD TABLE TRANSPOSED — `back[e * N + nx] = a` where `back[nx * N + e] = a`
 *      belongs, so the join's right half pulls back through a relabelled table. FIVE
 *      checks red and NOT the yield: the join ratios become 1.0000, 1.0015, 1.0011,
 *      0.9989, 1.0003 and 1.0000, every one of them inside `AU1`(b)'s registered 0.03
 *      band, and the anchor's match count moves only 532,485 -> 531,349, two parts in a
 *      thousand. This is `AS`'s own mutation 3 reproduced at six widths — `D4`, a yield
 *      count cannot tell a working attack from a relabelled broken one — and what fires
 *      is the check that REBUILDS joined keys and recomputes both heads, which goes from
 *      20,199 of 20,199 to 354 of 20,055.
 *
 * The exhaustive version is `npm run audit:width`.
 */

const A = require('../tools/width-audit.js');
const LED = require('../tools/ledger-audit.js');
const INS = require('../tools/insert-audit.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const near = (a, b, eps) => Math.abs(a - b) <= eps;
const seq = (got, want, eps) => got.length === want.length
  && got.every((v, i) => (want[i] === null ? v === null : v !== null && near(v, want[i], eps)));

console.log('\n=== 0. THE ARENA, AND THE TWO GROUPS THAT ARE NOT ONE GROUP ===');
{
  check('the arena is balanced ternary at every width: N = 3^w, val and idx invert, and '
    + 'the trit decomposition rebuilds every state',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w);
      if (X.N !== 3 ** w) return false;
      for (let i = 0; i < X.N; i++) {
        if (X.idx(X.val(i)) !== i) return false;
        if (X.fromTrits(X.trits(X.val(i))) !== X.val(i)) return false;
      }
      return true;
    }));
  // NEGATION is the one place the arithmetic and tritwise groups coincide, at every
  // width, because negating a balanced-ternary word trit by trit IS negating the number
  // it denotes. The second entry of a universal pair is written as a negation, so this is
  // load-bearing rather than decorative — mutation 2 is exactly this going wrong.
  check('negation coincides in both groups at every width from one to six',
    A.WIDTHS.every(w => A.negationAgrees(A.arenaOf(w))));
  // AND ADDITION DOES NOT — except at width one, which is the design line AU1 named as
  // its route and which turned out to matter more than the registration expected.
  check('addition does NOT coincide above width one, and at width ONE it does — 0 of 9 '
    + 'pairs differ at w=1 and 380,178 of 531,441 at w=6',
    A.carryCells(A.arenaOf(1)) === 0
    && A.carryCells(A.arenaOf(6)) === 380178
    && [2, 3, 4, 5].every(w => A.carryCells(A.arenaOf(w)) > 0),
    A.WIDTHS.map(w => A.carryCells(A.arenaOf(w))).join(' '));
  check('the step table is a bijection in the accumulator for every entry, at every '
    + 'width — AS\'s D3, which the backward walk and the join both rest on',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(11 + w);
      const { step, back } = A.stepTable(X, A.randomPermutation(r, X.N));
      for (let e = 0; e < X.N; e++) {
        const seen = new Uint8Array(X.N);
        for (let a = 0; a < X.N; a++) {
          const b = step[a * X.N + e];
          if (seen[b] || back[b * X.N + e] !== a) return false;
          seen[b] = 1;
        }
      }
      return true;
    }));
  check('an entry is a no-op at an accumulator exactly when their tritwise sum is a '
    + 'FIXED POINT of the head — so a head with no fixed point has no no-op family at '
    + 'all, which is why the random family is conditioned',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(23 + w);
      const p = A.randomPermutation(r, X.N);
      const { step } = A.stepTable(X, p);
      let noops = 0;
      for (let a = 0; a < X.N; a++) for (let x = 0; x < X.N; x++) {
        if (step[a * X.N + x] === a) { noops++; if (p[X.TADD[a * X.N + x]] !== X.TADD[a * X.N + x]) return false; }
      }
      return noops === X.N * A.fixedPoints(p);
    }));
}

console.log('\n=== 1. THE NULLS, WHICH ARE ARITHMETIC AND WERE COMPUTED BEFORE THE RUN ===');
{
  check('the exact finite-N birthday expectation is 2.8889, 4.4583, 7.1981, 11.9577, '
    + '20.2105 and 34.5100 at widths one to six',
    A.WIDTHS.map(w => A.exactBirthday(3 ** w).toFixed(4)).join(' ')
    === '2.8889 4.4583 7.1981 11.9577 20.2105 34.5100',
    A.WIDTHS.map(w => A.exactBirthday(3 ** w).toFixed(4)).join(' '));
  // TWO FILES MAY NOT DISAGREE ABOUT ONE NUMBER. `ladderlang`'s HASH27.md registered
  // against 34.51 for 729 digests and 914.3328 for 531,441; the same routine here returns
  // both, or one of the two documents is wrong about the same object.
  check('   and the same routine returns 914.3328 at 531,441 digests, which is the '
    + 'figure ladderlang\'s HASH27.md registered its second width against',
    near(A.exactBirthday(531441), 914.3328, 5e-4) && near(A.exactBirthday(729), 34.51, 5e-3));
  check('the second-preimage null is the state count itself to three decimals at every '
    + 'width: 3.000 9.000 27.000 81.000 243.000 729.000',
    A.WIDTHS.map(w => A.spNull(3 ** w).toFixed(3)).join(' ')
    === '3.000 9.000 27.000 81.000 243.000 729.000');
  check('AT\'s counting heuristic reproduces its own published 4.87 at width six, and '
    + 'gives 1.0970 1.4799 2.0574 2.8138 3.7479 4.8720 across the sweep',
    A.WIDTHS.map(w => A.countingNull(6, 3 ** w).toFixed(4)).join(' ')
    === '1.0970 1.4799 2.0574 2.8138 3.7479 4.8720'
    && near(A.countingNull(6, 729), 4.87, 5e-3));
  check('   and at ledger length twelve it is 1.0131 1.2359 1.6391 2.1297 2.7000 3.3521',
    A.WIDTHS.map(w => A.countingNull(12, 3 ** w).toFixed(4)).join(' ')
    === '1.0131 1.2359 1.6391 2.1297 2.7000 3.3521');
  check('the log-log fit recovers a planted exponent exactly, and DROPS a point that is '
    + 'not finite and positive rather than fitting through it',
    (() => {
      const xs = [3, 9, 27, 81, 243, 729];
      const half = A.logFit(xs, xs.map(n => 2.5 * Math.sqrt(n)));
      const one = A.logFit(xs, xs.map(n => 0.7 * n));
      const holed = A.logFit(xs, xs.map((n, i) => (i === 0 ? null : 2.5 * Math.sqrt(n))));
      return near(half.slope, 0.5, 1e-12) && near(one.slope, 1.0, 1e-12)
        && holed.dropped === 1 && holed.points === 5 && near(holed.slope, 0.5, 1e-12);
    })());
}

console.log('\n=== 2. THE CONTROLS, ASSERTED TO MOVE BEFORE ANY VERDICT IS READ ===');
{
  const aff = {}, ide = {};
  for (const w of A.WIDTHS) {
    const X = A.arenaOf(w);
    const p = A.affinePerm(X);
    aff[w] = p ? A.collisionScan(X, A.stepTable(X, p).step) : null;
    ide[w] = A.collisionScan(X, A.stepTable(X, A.identityPerm(X.N)).step);
  }
  check('the affine head is a permutation at widths 1, 2, 3, 5 and 6 and NOT one at '
    + 'width four — rot^2 + I is singular over GF(3)^4, and the tool refuses to build '
    + 'it rather than returning a non-permutation',
    A.affinePerm(A.arenaOf(4)) === null
    && [1, 2, 3, 5, 6].every(w => {
      const p = A.affinePerm(A.arenaOf(w));
      return p !== null && A.isPermutation(p, 3 ** w) && A.fixedPoints(p) === 1;
    }));
  // AND IT REACHES THE DEGENERATE END ONLY AT THE NARROW WIDTHS, which is worth pinning
  // rather than asserting away.
  check('   and the affine head drives the collision statistic to its degenerate end at '
    + 'widths one and two, every row collision-free, and to one row in nine at widths '
    + 'three, five and six — where width six means 84.47 against a null of 34.51',
    aff[1].none === aff[1].rows && aff[1].mean === null
    && aff[2].none === aff[2].rows && aff[2].mean === null
    && [3, 5, 6].every(w => near(aff[w].none / aff[w].rows, 1 / 9, 1e-12))
    && near(aff[6].mean, 84.472, 5e-3) && aff[6].mean / A.exactBirthday(729) > 2.4,
    [1, 2, 3, 5, 6].map(w => `${w}:${aff[w].none}/${aff[w].rows}`).join(' '));
  check('the identity head sits at the OTHER end: the chain never moves, so every scan '
    + 'repeats at the second try, at every width',
    A.WIDTHS.every(w => ide[w].mean === 2 && ide[w].none === 0));
  check('the widened split round DEGENERATES to the identity at width two — eight rounds '
    + 'of a one-trit Feistel over a three-entry S-box return all nine states to '
    + 'themselves — so the anchor family is widths four and six',
    (() => {
      const s2 = A.splitPerm(A.arenaOf(2)), s4 = A.splitPerm(A.arenaOf(4)), s6 = A.splitPerm(A.arenaOf(6));
      return A.fixedPoints(s2) === 9 && A.isPermutation(s2, 9)
        && A.fixedPoints(s4) === 1 && A.isPermutation(s4, 81)
        && A.fixedPoints(s6) === 1 && A.isPermutation(s6, 729)
        && A.splitPerm(A.arenaOf(3)) === null && A.splitPerm(A.arenaOf(5)) === null;
    })());
  check('the Cayley BFS SPANS its range at every width: {0} -> 1, {1, -1} -> 2, '
    + '{N/3} -> 3, {1} -> N',
    A.WIDTHS.every(w => {
      const N = 3 ** w, b = A.bfsControls(N);
      return b.zero === 1 && b.plusMinus === 2 && b.one === N && (N < 9 || b.third === 3);
    }), A.WIDTHS.map(w => JSON.stringify(A.bfsControls(3 ** w))).join(' '));
  check('   and one generator alone always closes in exactly its order, at every width',
    A.WIDTHS.every(w => {
      const N = 3 ** w;
      return [1, 2, 3, N - 1].filter(g => g > 0 && g < N)
        .every(g => A.minInsertions([g], N).min === A.orderIn(g, N));
    }));
  // THE RESPONSIVENESS CONTROL IS ITSELF WIDTH-DEPENDENT, and discovering that BEFORE the
  // run is why AU1(b) is registered at widths two to six. At width one the left key map is
  // a BIJECTION — nine rows onto nine keys — so the yield is N^2 by construction and a
  // band there could not fail. A check asserting 2.0 at every width would have hidden it.
  check('the join REBUILDS its degenerate control across width: 2.0 from width three up, '
    + 'about 1.8 at width two, and exactly 1.0 at width one, where the left key map is a '
    + 'BIJECTION so the yield ratio is forced and AU1(b) is not registered there',
    (() => {
      for (const w of A.WIDTHS) {
        const X = A.arenaOf(w), r = A.rng(31 + w);
        const { step, back } = A.stepTable(X, A.drawHead(r, X.N).perm);
        const m = A.mitm(X, step, back, A.drawLedger(r, X.N, 6));
        const d = A.degenerateJoinRatio(m.Lc), occ = m.keysL / (X.N * X.N);
        if (w === 1) { if (!(d === 1 && occ === 1 && m.ratio === 1)) return false; }
        else if (w === 2) { if (!(d > 1.6 && d < 1.95)) return false; }
        else if (!near(d, 2.0, 0.06)) return false;
      }
      return true;
    })());
  check('the conditioning really conditions: every drawn head has exactly one fixed '
    + 'point, so every accumulator has exactly one no-op entry, at every width',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(41 + w);
      for (let k = 0; k < 5; k++) {
        const d = A.drawHead(r, X.N);
        if (A.fixedPoints(d.perm) !== 1) return false;
        if (!A.noOpTable(X, A.stepTable(X, d.perm).step).everyAccumulatorHasExactlyOne) return false;
      }
      return true;
    }));
}

const M = A.measure();

console.log('\n=== 3. THE ANCHOR — A SECOND IMPLEMENTATION THAT IS COMPARED, NOT TRUSTED ===');
{
  const AN = M.anchor;
  check('the tritwise group agrees with puzzle-audit\'s on all 531,441 pairs, both ways, '
    + 'and the widened split round at width six IS D\'s mixer, all 729 entries',
    AN.taddMismatches === 0 && AN.tsubMismatches === 0 && AN.permMismatches === 0);
  check('and the width-parametric STEP equals ledger-audit\'s cell by cell, all 531,441',
    AN.stepCells === 531441 && AN.stepMismatches === 0 && AN.headAgrees);
  check('AS3 comes back out of the new code path: 532,485 matches, ratio 1.0020, '
    + '3,720,087 operations and 2,125,764 slots',
    AN.as3Matches === 532485 && near(AN.as3Ratio, 1.0020, 5e-5)
    && AN.as3Ops === 3720087 && AN.as3Memory === 2125764,
    `${AN.as3Matches} ${AN.as3Ratio}`);
  check('AT comes back too: c(ZERO) = 3 with witnesses (136, 295, 362), profile total '
    + '741, 256 accumulators admitting none, canonical run 4, prepend run 243',
    AN.atPairCount === 3 && AN.atWitnesses.join() === '136,295,362'
    && AN.atProfileTotal === 741 && AN.atZeroAt === 256
    && AN.atCanonicalMin === 4 && AN.atPrependRun === 243,
    JSON.stringify([AN.atPairCount, AN.atWitnesses, AN.atProfileTotal, AN.atZeroAt]));
  check('   and the order function agrees with insert-audit\'s at width six',
    AN.insertAgrees && A.orderIn(393, 729) === INS.orderIn729(393));
  check('T-FAKE-RANDOM — the draw reached every state at every width, and the '
    + 'conditioning took 76, 61, 56, 61, 45 and 60 draws for 24 heads',
    M.widths.every(r => r.coverage === r.N)
    && M.widths.map(r => r.permDraws).join() === '76,61,56,61,45,60',
    M.widths.map(r => `${r.coverage}/${r.N}`).join(' '));
  // D4: A COUNT CANNOT TELL A WORKING ATTACK FROM A RELABELLED BROKEN ONE. Mutation 3
  // transposes the backward table and the join's yield does not move; only this fires.
  check('every joined key that was rebuilt reproduces BOTH heads — 20,199 of 20,199 '
    + 'across the six widths, not merely matched',
    M.widths.reduce((s, r) => s + r.joinRebuilt, 0) === 20199
    && M.widths.reduce((s, r) => s + r.joinRebuiltTried, 0) === 20199);
}

console.log('\n=== 4. AU1 HELD — THE OPS CURRENCY IS LINEAR IN THE STATE COUNT ===');
{
  const spr = M.widths.map(r => r.spRatio.mean);
  const jr = M.widths.map(r => r.join.mean);
  check('24 heads at each of six widths, 3 to 729 states, and not one of the 5,760 '
    + 'second-preimage scans exhausted its family',
    M.widths.every(r => r.heads === 24) && M.widths.map(r => r.N).join() === '3,9,27,81,243,729'
    && M.widths.reduce((s, r) => s + r.spExhausted, 0) === 0);
  check('AU1 HELD (a) — the first-accept index is 3.000, 8.372, 27.854, 82.058, 241.540 '
    + 'and 702.564 against nulls of 3, 9, 27, 81, 243 and 729',
    seq(M.widths.map(r => r.sp.mean), [3.0, 8.372, 27.854, 82.058, 241.54, 702.564], 5e-3),
    M.widths.map(r => r.sp.mean.toFixed(3)).join(' '));
  check('   so the ratio is 1.0000, 0.9302, 1.0316, 1.0131, 0.9940 and 0.9637, every one '
    + 'inside the registered [0.93, 1.07]',
    seq(spr, [1.0, 0.9302, 1.0316, 1.0131, 0.994, 0.9637], 5e-4)
    && spr.every(v => v >= 0.93 && v <= 1.07));
  // THE DISCLOSURE. AU1(a) held at width two by 0.0002 and a redraw straddles the line.
  // T-CRITERION-IN-THE-NOISE, fifth bite, and the first on a line that PASSED.
  check('   AND THE WIDTH-TWO LEG HELD BY 0.0002 AND IS NOT EVIDENCE: redrawn at four '
    + 'seeds the same statistic gives 0.9684, 0.9243, 1.0275 and 0.9693, one of them '
    + 'below the line',
    near(spr[1] - 0.93, 0.0002, 5e-5)
    && seq(M.thinMargins.map(t => t.spRatioW2), [0.9684, 0.9243, 1.0275, 0.9693], 5e-4)
    && M.thinMargins.some(t => t.spRatioW2 < 0.93),
    M.thinMargins.map(t => t.spRatioW2.toFixed(4)).join(' '));
  check('   and width one held for a structural reason no prediction claimed: 4,800 of '
    + '4,800 scans return index 3, every time, so there is no distribution to fit',
    M.widthOne.tried === 4800 && M.widthOne.hist.length === 1
    && M.widthOne.hist[0][0] === 3 && M.widthOne.hist[0][1] === 4800,
    JSON.stringify(M.widthOne.hist));
  check('AU1 HELD (b) — the join returns 0.9933, 1.0105, 1.0005, 0.9998 and 1.0004 of '
    + 'ideal at widths two to six, every one within 0.03 of 1.0',
    seq(jr.slice(1), [0.9933, 1.0105, 1.0005, 0.9998, 1.0004], 5e-4)
    && jr.slice(1).every(v => Math.abs(v - 1) <= 0.03)
    && jr[0] === 1.0);
  check('   so AS\'s 6.99 operations per forgery is 6.94 to 7.17 at EVERY width, while '
    + 'the table it needs goes 36, 324, 2,916, 26,244, 236,196, 2,125,764',
    M.widths.every(r => r.joinOpsPerForgery.mean > 6.9 && r.joinOpsPerForgery.mean < 7.2)
    && M.widths.map(r => r.joinMemory).join() === '36,324,2916,26244,236196,2125764',
    M.widths.map(r => r.joinOpsPerForgery.mean.toFixed(3)).join(' '));
  check('AU1 HELD (c) — the split-round head lies inside the random family\'s range on '
    + 'both statistics at widths four and six, so the law is about width and not about '
    + 'D\'s mixer',
    [3, 5].every(i => {
      const r = M.widths[i], s = r.control.split && r.control.split.row;
      if (!s) return false;
      const sp = s.sp.mean / A.spNull(r.N);
      return sp >= r.spRatio.min && sp <= r.spRatio.max
        && s.join.ratio >= r.join.min && s.join.ratio <= r.join.max;
    }),
    [3, 5].map(i => {
      const r = M.widths[i], s = r.control.split.row;
      return `w${r.w}:${(s.sp.mean / A.spNull(r.N)).toFixed(4)}/${s.join.ratio.toFixed(4)}`;
    }).join(' '));
}

console.log('\n=== 5. AU2 FAILED — ON A STATISTIC THAT DOES NOT EXIST ===');
{
  const cr = M.widths.map(r => r.collisionRatio.n ? r.collisionRatio.mean : null);
  check('AU2 HELD (a) — the first-repeat index is 12.026, 20.244 and 34.296 at widths '
    + 'four, five and six against exact nulls of 11.9577, 20.2105 and 34.5100, ratios '
    + '1.0057, 1.0017 and 0.9938, all inside [0.95, 1.06]',
    seq(cr.slice(3), [1.0057, 1.0017, 0.9938], 5e-4)
    && cr.slice(3).every(v => v >= 0.95 && v <= 1.06));
  check('   and no row is collision-free at those widths: 0 of 1,944, 0 of 5,832 and 0 '
    + 'of 17,496',
    [3, 4, 5].every(i => M.widths[i].collisionNoneRows === 0)
    && M.widths.slice(3).map(r => r.collisionRows).join() === '1944,5832,17496');
  check('AU2 HELD (b) — the two slopes over widths two to six are 0.4642 for the '
    + 'collision and 1.0031 for the second preimage, inside [0.45, 0.55] and '
    + '[0.95, 1.05]. THE TWO ATTACK GOALS SEPARATE BY EXACTLY ONE SQUARE ROOT',
    near(M.fits.collision.slope, 0.4642, 5e-4) && near(M.fits.sp.slope, 1.0031, 5e-4)
    && M.fits.collision.slope >= 0.45 && M.fits.collision.slope <= 0.55
    && M.fits.sp.slope >= 0.95 && M.fits.sp.slope <= 1.05
    && M.fits.collision.dropped === 0 && M.fits.sp.dropped === 0,
    `${M.fits.collision.slope} ${M.fits.sp.slope}`);
  // THE FAILURE. The registration named width one as degenerate in AU2(a)'s own
  // rationale and then included it in leg (c) anyway. There is nothing to divide.
  check('AU2 FAILED (c) — at width one the ratio is 0/0: the measured scan finds no '
    + 'collision in any of 72 rows AND the reshuffled null finds none in any of 14,400, '
    + 'because the row map is injective and no ordering can produce a repeat',
    M.widths[0].collision.n === 0 && !Number.isFinite(M.widths[0].collision.mean)
    && M.widths[0].collisionNoneRows === 72 && M.widths[0].collisionRows === 72
    && M.widths[0].collisionRatio.n === 0
    && M.widths[0].shuffle.ratio === null && M.widths[0].shuffle.measuredMean === null
    && M.widths[0].shuffle.perHead.reduce((s, x) => s + x.shufNone, 0) === 14400,
    JSON.stringify([M.widths[0].collisionNoneRows,
      M.widths[0].shuffle.perHead.reduce((s, x) => s + x.shufNone, 0)]));
  check('   and the leg held at widths two and three, 1.0208 and 1.0492, so the '
    + 'narrow-end shortfall really is a MULTIPLICITY effect and not an ordering one',
    near(M.widths[1].shuffle.ratio, 1.0208, 5e-4) && near(M.widths[2].shuffle.ratio, 1.0492, 5e-4)
    && [1, 2].every(i => M.widths[i].shuffle.ratio >= 0.95 && M.widths[i].shuffle.ratio <= 1.05));
  check('   and the width-three value is 0.0008 inside its line, with a four-seed spread '
    + 'of 1.0492, 1.0034, 1.0320 and 0.9875 — thin, and reported as thin',
    near(1.05 - M.widths[2].shuffle.ratio, 0.0008, 5e-5)
    && seq(M.thinMargins.map(t => t.shuffleRatioW3), [1.0492, 1.0034, 1.032, 0.9875], 5e-4));
}

console.log('\n=== 6. AU3 HELD — GROWTH IS NEARLY FREE OF WIDTH, AND LENGTH BEATS WIDTH ===');
{
  const g6 = M.widths.map(r => r.growth6.mean), g12 = M.widths.map(r => r.growth12.mean);
  check('AU3 HELD (a) — the shortest insertion-only forgery is 1.0640, 1.4951, 2.0714, '
    + '2.7989, 3.8172 and 4.9607 entries, tracking AT\'s counting null to within 0.0887 '
    + 'at every width against a registered 0.30',
    seq(g6, [1.064, 1.4951, 2.0714, 2.7989, 3.8172, 4.9607], 5e-4)
    && g6.every((v, i) => Math.abs(v - M.nulls.counting6[i]) <= 0.30)
    && near(Math.max(...g6.map((v, i) => Math.abs(v - M.nulls.counting6[i]))), 0.0887, 5e-4),
    g6.map((v, i) => (v - M.nulls.counting6[i]).toFixed(4)).join(' '));
  check('   and at ledger length twelve too: 1.0060, 1.2308, 1.6296, 2.1413, 2.7419 and '
    + '3.3663 against 1.0131 to 3.3521',
    seq(g12, [1.006, 1.2308, 1.6296, 2.1413, 2.7419, 3.3663], 5e-4)
    && g12.every((v, i) => Math.abs(v - M.nulls.counting12[i]) <= 0.30));
  // AT2's registered failure route, run where it must be largest — and it does not fire.
  check('   AT2\'s un-fired failure route runs here where it must be largest and STILL '
    + 'does not fire: at width one a seven-gap chain visits 2.822 distinct accumulators '
    + 'of seven, so five generators are duplicates, and it costs the forger nothing',
    near(M.widths[0].distinctGens6.mean, 2.822, 5e-4)
    && near(M.widths[5].distinctGens6.mean, 6.969, 5e-4)
    && Math.abs(g6[0] - M.nulls.counting6[0]) < 0.05,
    M.widths.map(r => r.distinctGens6.mean.toFixed(3)).join(' '));
  check('AU3 HELD (b) — the slope of the growth cost against the state count is 0.2812, '
    + 'under the registered 0.32, against 0.5 for the birthday law and 1.0031 measured '
    + 'for the ops law. FIVE MORE TRITS MULTIPLY THE STATE COUNT BY 243 AND THE GROWTH '
    + 'COST BY 4.66',
    near(M.fits.growth6.slope, 0.2812, 5e-4) && M.fits.growth6.slope < 0.32
    && near(g6[5] / g6[0], 4.662, 5e-3));
  check('AU3 HELD (c) — the same slope at length twelve is 0.2266, a gap of 0.0545 past '
    + 'the registered 0.05, so adding gaps defeats width faster than width defends',
    near(M.fits.growth12.slope, 0.2266, 5e-4) && near(M.fits.growthGap, 0.0545, 5e-4)
    && M.fits.growthGap >= 0.05);
  check('   AND THAT LEG IS ALSO A LINE IN THE NOISE: three further seeds give gaps of '
    + '0.0494, 0.0441 and 0.0597, two of them under the line. The DIRECTION is stable at '
    + 'every seed and the size of the gap is not',
    seq(M.slopeSpread.map(s => s.gap), [0.0494, 0.0441, 0.0597], 5e-4)
    && M.slopeSpread.every(s => s.growth12 < s.growth6)
    && M.slopeSpread.some(s => s.gap < 0.05),
    M.slopeSpread.map(s => s.gap.toFixed(4)).join(' '));
}

console.log('\n=== 7. AU4 FAILED — ON THE FAMILY THIS SET CHOSE, NOT ON WIDTH ===');
{
  const any = M.widths.map(r => r.cZeroCondAny);
  const none = M.widths.map(r => r.pairZeroFraction.mean);
  const unc = M.widths.map(r => r.cZeroUncondAny);
  check('400 heads at each width, conditioned and unconditioned, both run',
    M.widths.every(r => r.cZeroCond.n === 400 && r.cZeroUncond.n === 400));
  check('AU4 FAILED (a) — the fraction of heads admitting a universal pair is 1.0000, '
    + '0.5275, 0.6075, 0.6625, 0.6000 and 0.6450, and 0.5275 at width two is outside '
    + 'the registered [0.56, 0.70]',
    seq(any, [1.0, 0.5275, 0.6075, 0.6625, 0.6, 0.645], 5e-5)
    && any[1] < 0.56 && [2, 3, 4, 5].every(i => any[i] >= 0.56 && any[i] <= 0.70),
    any.map(v => v.toFixed(4)).join(' '));
  check('AU4 FAILED (c) — and the accumulator fraction with 0.45833 at width two, '
    + 'outside [0.335, 0.395], while widths three to six read 0.35185, 0.37397, 0.35340 '
    + 'and 0.35900, all inside',
    seq(none, [0.0, 0.45833, 0.35185, 0.37397, 0.3534, 0.359], 5e-5)
    && none[1] > 0.395 && [2, 3, 4, 5].every(i => none[i] >= 0.335 && none[i] <= 0.395));
  // THE FAILURE IS A PROPERTY OF THE DESIGN AND THE CONTROL IS WHAT SAYS SO.
  check('   AND THE FAILURE IS THE CONDITIONING, NOT THE WIDTH: the UNCONDITIONED family '
    + 'at the same nine states reads 0.6450 with a mean c(ZERO) of 0.9650, comfortably '
    + 'where the closed form says. T-CLAIM-NARROWED-BY-A-DESIGN, caught by a control',
    near(unc[1], 0.645, 5e-5) && near(M.widths[1].cZeroUncond.mean, 0.965, 5e-4)
    && unc[1] >= 0.56 && unc[1] <= 0.70
    && unc.every((v, i) => i === 0 || (v >= 0.56 && v <= 0.70)),
    unc.map(v => v.toFixed(4)).join(' '));
  check('AU4 HELD (b) — width six is not the smallest of the five: 0.6450 against width '
    + 'two\'s 0.5275, so there is no monotone width trend',
    any[5] > Math.min(...any.slice(1)) && Math.min(...any.slice(1)) === any[1]);
  check('SO THE ANSWER SURVIVES ITS OWN FAILURE — from 27 states up, about two heads in '
    + 'three admit a two-entry, zero-operation, zero-knowledge forgery, and the mean '
    + 'c(ZERO) is 0.9175, 0.9700, 0.9300 and 1.0225 against a Poisson one',
    [2, 3, 4, 5].every(i => any[i] > 0.59 && any[i] < 0.67)
    && seq(M.widths.slice(2).map(r => r.cZeroCond.mean), [0.9175, 0.97, 0.93, 1.0225], 5e-4));
  check('   and width one is the other end of the same degeneracy, reported and not '
    + 'registered: every head has exactly one pair at every accumulator',
    any[0] === 1.0 && none[0] === 0 && M.widths[0].cZeroCond.mean === 1.0);
  check('   and the split-round head has them too: 2 at width four and 3 at width six',
    M.widths[3].control.split.row.pair.atIdentity.c === 2
    && M.widths[5].control.split.row.pair.atIdentity.c === 3);
}

console.log('\n=== 7b. THE CORRECTION TWO READERS FOUND, REPRODUCED BEFORE IT WAS ACCEPTED ===');
{
  // AU2(b)'s band [0.45, 0.55] was drawn round the birthday law's ASYMPTOTIC exponent,
  // and six points spanning 2.4 decades do not measure an asymptote. The exact
  // expectation is about sqrt(pi N / 2) + 2/3 and the additive term lifts the small-N
  // points hardest, so THE IDEAL OBJECT'S OWN log-log slope over a narrow window is
  // under 0.5. Fitted here from the same exactBirthday() the verdict is scored against.
  const NS = M.nullSlopes;
  const at = (a, b) => NS.rows.find(r => r.from === a && r.to === b).birthday;
  check('the exact null\'s OWN slope over the registered window 2..6 is 0.4665, not the '
    + '0.5 the band was drawn around \u2014 and 0.4537 over 1..6, which is the figure a '
    + 'reader offered for a window this set did not register',
    near(at(2, 6), 0.4665, 5e-4) && near(at(1, 6), 0.4537, 5e-4)
    && near(at(3, 6), 0.4758, 5e-4),
    NS.rows.map(r => `${r.from}..${r.to}:${r.birthday.toFixed(4)}`).join(' '));
  check('   so the measured 0.4642 sits 0.0023 BELOW the ideal null on its own window, '
    + 'not 7% below the asymptote \u2014 agreement to half a percent',
    near(Math.abs(M.fits.collision.slope - at(2, 6)), 0.0023, 5e-4)
    && M.fits.collision.slope < at(2, 6));
  // THE DEFECT, AND IT IS NOT THAT THE BAND WAS MISSED. It was not missed. It was drawn
  // round a limit the range cannot reach, and on three of the seven windows this sweep
  // could have used the IDEAL OBJECT scores under the band's own lower edge.
  check('and on three of the seven candidate windows \u2014 1..5, 1..4 and 2..4 \u2014 the IDEAL '
    + 'object itself scores 0.4439, 0.4315 and 0.4490, under the registered 0.45',
    NS.belowBand.join() === '1..5,1..4,2..4'
    && near(at(1, 5), 0.4439, 5e-4) && near(at(1, 4), 0.4315, 5e-4)
    && near(at(2, 4), 0.449, 5e-4));
  check('   and it is a property of the WINDOW, not of the family: 0.4770, 0.4877 and '
    + '0.4950 as the fit runs out to widths 8, 12 and 20',
    seq(NS.wide.map(w => w.birthday), [0.477, 0.4877, 0.495], 5e-4)
    && NS.wide.every((w, i) => i === 0 || w.birthday > NS.wide[i - 1].birthday));
  check('   while the SECOND-PREIMAGE null has no such bias \u2014 its own slope is 1.000000 '
    + 'on every one of the seven windows, so AU2(b)\'s other half needed no correction',
    NS.rows.every(r => near(r.sp, 1.0, 1e-5)),
    NS.rows.map(r => r.sp.toFixed(6)).join(' '));
  check('AU2(b)\'s VERDICT does not move: 0.4642 is inside [0.45, 0.55] and the leg HELD '
    + 'as registered, scored against the null that was registered',
    M.fits.collision.slope >= NS.registeredBand[0]
    && M.fits.collision.slope <= NS.registeredBand[1]);
}

console.log('\n=== 8. THE MANIFEST SAYS WHAT THIS FILE MEASURED ===');
{
  const MAN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'FINDINGS.json'), 'utf8'));
  const set = MAN.prediction_sets.find(s => s.id === 'AU');
  check('AU is in the manifest, names this tool and this test',
    !!set && set.tool === 'tools/width-audit.js' && set.asserted_in === 'test/test-width.js');
  check('   with four predictions: AU1 and AU3 HELD, AU2 and AU4 FAILED',
    !!set && set.predictions.length === 4
    && set.predictions.filter(p => p.outcome === 'HELD').map(p => p.id).join() === 'AU1,AU3'
    && set.predictions.filter(p => p.outcome === 'FAILED').map(p => p.id).join() === 'AU2,AU4');
  const m = id => (set.predictions.find(p => p.id === id) || {}).measured || {};
  check('AU1\'s measured block carries the numbers this run produced',
    m('AU1').first_accept_ratio[1] === 0.9302 && m('AU1').width_two_leg_margin === 0.0002
    && m('AU1').join_ops_per_forgery.length === 6);
  check('AU2\'s does', m('AU2').collision_slope_widths_two_to_six === 0.4642
    && m('AU2').second_preimage_slope_widths_two_to_six === 1.0031
    && m('AU2').reshuffled_rows_with_no_repeat_at_width_one === '14400 of 14400');
  check('AU3\'s does', m('AU3').slope_length_six === 0.2812
    && m('AU3').slope_gap === 0.0545 && m('AU3').largest_gap_from_null === 0.0887);
  check('AU4\'s does', m('AU4').fraction_of_heads_with_a_universal_pair[1] === 0.5275
    && m('AU4').unconditioned_family_fraction_with_a_pair[1] === 0.645);
  const Fd = id => MAN.unregistered_findings.find(f => f.id === id);
  for (const id of ['F-THE-TWO-ATTACK-GOALS-SEPARATE-BY-ONE-SQUARE-ROOT',
    'F-WIDTH-BUYS-THE-FORGERS-MEMORY-NOT-HIS-TIME',
    'F-WIDTH-DOES-NOT-KILL-THE-ZERO-OP-FORGERY',
    'F-A-LINE-IN-THE-NOISE-THAT-PASSES-IS-THE-SAME-DEFECT',
    'F-AT-WIDTH-ONE-THE-SECOND-PREIMAGE-IS-DETERMINISTIC',
    'F-A-BAND-DRAWN-ROUND-AN-ASYMPTOTE-THE-WINDOW-CANNOT-REACH',
    'F-A-WIDENED-FAMILY-CAN-COLLAPSE-WHERE-INFLUENCE-STILL-REACHES']) {
    const f = Fd(id);
    check(`${id} is recorded, and points at this file`,
      !!f && f.asserted_in === 'test/test-width.js'
      && f.outcome === 'MEASURED_NOT_REGISTERED', id);
  }
  check('the two-goal finding quotes both fitted slopes and cites AS\'s figures rather '
    + 'than re-running them',
    (f => /0\.4642/.test(f.claim) && /1\.0031/.test(f.claim)
      && /4,414/.test(Fd('F-WIDTH-BUYS-THE-FORGERS-MEMORY-NOT-HIS-TIME').argument
        + Fd('F-THE-TWO-ATTACK-GOALS-SEPARATE-BY-ONE-SQUARE-ROOT').argument))
      (Fd('F-THE-TWO-ATTACK-GOALS-SEPARATE-BY-ONE-SQUARE-ROOT')));
  // AU's bite of T-CRITERION-IN-THE-NOISE, and the first on a line that PASSED.
  // THE RUNNING TOTAL IS NOT THIS SET'S TO PIN, and asserting it as a literal is the
  // same T-STALE-CONSTANT this set removed from test-insert.js an hour earlier. AT's
  // own re-audit, prompted by the finding below, took the count from five to six while
  // this file was being written. The check owns AU's EVIDENCE and not the tally.
  const trap = MAN.traps_encountered.find(t => t.id === 'T-CRITERION-IN-THE-NOISE');
  check('AU\'s bite of T-CRITERION-IN-THE-NOISE is recorded, and says the new thing: '
    + 'the line PASSED, so nothing made anybody look',
    trap.count >= 5 && /THE LINE PASSED/.test(trap.description)
    && /0\.9302/.test(trap.description));
  check('AU2\'s note carries the correction and says the verdict did NOT move',
    /0\.4665/.test(m('AU2').exact_null_own_slope_over_registered_window_two_to_six ? 'ok0.4665' : '')
    && m('AU2').exact_null_own_slope_over_registered_window_two_to_six === 0.4665
    && m('AU2').exact_null_own_slope_over_widths_one_to_six === 0.4537
    && m('AU2').windows_where_the_ideal_null_falls_below_the_registered_band.length === 3
    && /THE VERDICT DOES NOT MOVE/.test(set.predictions.find(p => p.id === 'AU2').note));
  check('   and the width-two identity collapse is a finding in its own right, not a '
    + 'footnote to the sweep',
    (f => /NINE fixed points on nine states/.test(f.claim)
      && /cancel/i.test(f.argument) && /EVERY width/.test(f.argument))
      (Fd('F-A-WIDENED-FAMILY-CAN-COLLAPSE-WHERE-INFLUENCE-STILL-REACHES')));
  const t2 = MAN.traps_encountered.find(t => t.id === 'T-CLAIM-NARROWED-BY-A-DESIGN');
  check('and AU4\'s failure is recorded as a bite of T-CLAIM-NARROWED-BY-A-DESIGN, '
    + 'caught by the control rather than by a reader',
    t2.count >= 6 && /UNCONDITIONED family at the same width reads 0\.6450/.test(t2.description));
}

console.log('\n=== 9. THE TOOL AS IT IS ACTUALLY RUN — T-TOOL-CHECKED-ONLY-BY-IMPORT ===');
{
  // Importing sets the main-module flag false, so no print path ever executes. A tool
  // once crashed on every run while its whole suite stayed green. Capped, so this costs
  // seconds rather than the full sweep.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'width-audit.js')],
    { encoding: 'utf8', timeout: 600000,
      env: { ...process.env, WIDTH_HEADS: '2', WIDTH_CZERO_HEADS: '5',
        WIDTH_LEDGERS: '10', WIDTH_SCAN_LEDGERS: '3' } });
  check('the audit runs as a program and prints its own report',
    out.includes('WIDTH AUDIT') && ['AU1', 'AU2', 'AU3', 'AU4'].every(id => out.includes(id)));
  check('   and reports the instrument before any verdict, the nulls, and the silences',
    out.includes('THE INSTRUMENT, BEFORE ANY VERDICT')
    && out.includes('THE EXACT NULLS, computed before the registration commit')
    && out.includes('WHAT THIS SET DID NOT ATTACK'));
  check('   and the cap really capped it: 2 heads a width, not 24',
    /heads: 2\b|for 2 heads/.test(out) && !out.includes('for 24 heads'));
  check('   while the quantities that do not depend on the cap are unchanged: the anchor, '
    + 'the exact nulls, and the affine control\'s degenerate rows',
    out.includes('0 mismatches') && out.includes('532,485 matches')
    && out.includes('c(ZERO) = 3') && out.includes('34.5100')
    && out.includes('914.3328'));
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
