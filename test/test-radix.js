'use strict';
/* test-radix.js — set AR, what happens when a tree's arity may vary by depth.
 *
 * Three of the four held and the fourth failed, and the fourth is the one that
 * produced the mechanism.
 *
 *   AR1  HELD. No cell of either vector sweep improves by 15% or more: the worst is
 *        12.30% at N = 257, and 9.99% on `AQ`'s own grid. But the bound is worth less
 *        than it looks, because the post-hoc null's TAIL reaches 23.7% -- a
 *        structureless per-level cost can produce a bigger maximum than the real
 *        regime does. Magnitude does not discriminate here. Frequency does, which is
 *        `AR3`. Registering the line at 15% rather than 10% decided this verdict: a
 *        10% line would have FAILED at 12.30%, and the reason for widening it -- a
 *        hand case at 9.99% -- was on the record before the run.
 *
 *   AR2  HELD. Over [1024, 8192] at the verify-dominated rate the largest single-leaf
 *        jump falls from 11.97% to 4.00%, a ratio of 0.334 against a predicted 0.5.
 *        Both maxima land at the same leaf count, N = 1024, which the registration did
 *        not require and could not assume.
 *
 *   AR3  HELD, and it is the one I said I could not call. 6,144 of 7,169 leaf counts
 *        -- 85.7% -- have a strictly cheaper varying optimum. I registered the
 *        reasoning AGAINST my own hand sample, four of whose six leaf counts were not
 *        helped, and the reasoning was right: the sample was drawn at powers, which is
 *        exactly where a constant tree is at its best.
 *
 *   AR4  FAILED, and not narrowly: the varying optimum is SHALLOWER at 3,580 leaf
 *        counts and deeper at 2,176, a 1.6-to-1 inversion of the registered
 *        direction. The registered reasoning -- more levels means more per-level slack
 *        to exploit -- had the mechanism backwards. What a sequence actually buys is
 *        the SAME verify budget in FEWER levels: at 2,861 of 7,169 leaf counts the
 *        quantity gamma is charged on is identical to the constant tree's and the
 *        entire saving is level overhead, and 1,836 of the 3,580 shallower cells are
 *        of exactly that kind. The slack does not add a level, it removes one.
 *
 * WHAT THE FAILURE FOUND, beyond the direction. `AQ`'s headline was that a tree
 * branches in the base its address space is counted in -- 3^k takes three. Admit
 * sequences and that dissolves: 25 of `AQ`'s 45 leaf counts change shape, 11 of the 18
 * powers of three among them, and N = 729 wants [4,4,4,4,3] rather than six threes.
 * The cost of the change is 0.0178%. `AQ` was reading a preference off a surface flat
 * to four decimal places, and the preference is a constraint of the constant family
 * rather than a property of trees. `T-CLAIM-NARROWED-BY-A-DESIGN`, fifth bite.
 *
 * MUTATION-TESTED. Two checks were broken deliberately and watched go red:
 *
 *   1. `nearEqual` and `maxprodAtLeast` were changed to hand out `q` where they hand
 *      out `q + 1` -- dropping the larger part of the near-equal partition. The
 *      three-way MINSUM agreement went red at 3 checks; the closed form disagreed with
 *      both the dynamic program and brute force, which is the whole point of having
 *      three of them.
 *
 *   2. `NOISE_V` was made a copy of `NOISE_B`, which is precisely `AQ`'s defect. The
 *      control-responsiveness check went red: 0 of 24 sequences move with the exchange
 *      rate instead of 24 of 24, because gamma factors straight out of the total.
 *      `F-CONTROL-CANNOT-DISCRIMINATE` cannot come back unnoticed.
 *
 * Section 0 runs before any verdict, and it earned its place four times: a brute-force
 * cross-check whose own arity cap made it disagree with MINSUM at n = 37, a merkle cost
 * grouped so it differed from `AQ`'s in the last bit of a float, and -- after the run
 * -- a control whose dynamic program capped each level's arity at the residual leaf
 * count and so returned a sequence fifty times dearer than the best CONSTANT tree, an
 * answer whose sign is impossible because a constant tree is a sequence.
 */

const A = require('../tools/radix-audit.js');
const AQ = require('../tools/branching-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const GRID = A.gridSweep('vector');
const CONT = A.contWorstGain('vector');
const W = A.windowStats(A.DEEP_LO, A.DEEP_HI);
const GP = A.gainProfile();

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
  // The baseline this whole set is scored against is AQ's own optimiser, so it has to
  // BE AQ's own optimiser. A baseline that quietly differs would move every verdict.
  let mismatch = 0;
  for (const n of A.LEAVES) for (const g of A.GAMMAS) {
    const mine = A.bestConstant('vector', n, g), theirs = AQ.argmin('vector', n, g);
    if (mine.arity !== theirs.arity || Math.abs(mine.cost - theirs.cost) > 1e-9) mismatch++;
  }
  check('the constant baseline IS AQ\'s argmin, at all 2,880 of its cells',
    mismatch === 0, `${mismatch} cells differ`);
}

console.log('\n--- the sequence optimiser, checked against the slower honest route ---');
{
  // bestSequence uses the closed form. Recomputing it through the dynamic program is
  // the same comparison MINSUM already passes, run one level up at the cost the
  // verdicts are actually read from.
  let bad = 0, checked = 0;
  for (let n = A.DEEP_LO; n <= A.DEEP_HI; n += 37) {
    let best = Infinity, bd = 0;
    for (let d = 1; d <= A.maxUsefulDepth(n); d++) {
      const S = A.minsumDP(d, n);
      if (!Number.isFinite(S)) continue;
      const t = A.costOf('vector', d, S, A.GMAX);
      if (t < best) { best = t; bd = d; }
    }
    const via = A.bestSequence('vector', n, A.GMAX);
    checked++;
    if (Math.abs(best - via.cost) > 1e-9 || bd !== via.depth) bad++;
  }
  check(`the closed-form optimum equals the dynamic program's at ${checked} deep`
    + ' leaf counts, cost and depth both', bad === 0, `${bad} differ`);
  // A sequence can never lose to a constant tree, because a constant tree IS a
  // sequence. Any negative gain is an instrument fault, and that is how the control's
  // was found.
  check('   and no cell anywhere has a NEGATIVE gain, which containment forbids',
    GRID.every(c => c.gain >= -1e-12) && CONT.worst >= 0);
}

console.log('\n--- no product is ever formed in full ---');
{
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
  check('   and the bound is where the all-twos tree lands',
    A.maxUsefulDepth(1024) === 10 && A.maxUsefulDepth(1025) === 11);
}

console.log('\n--- the control, asserted responsive before its verdict is read ---');
{
  // AQ's registered control gave bytes and verify the SAME draw, so its total was a
  // constant times (1 + gamma) and the swept rate factored straight out: it could only
  // ever agree. F-CONTROL-CANNOT-DISCRIMINATE. This one draws the two independently.
  const r = A.controlResponse();
  check(`the control's optimum MOVES with the exchange rate (${r.movedWithGamma} of`
    + ` ${r.leaves} leaf counts)`, r.movedWithGamma === 24 && r.leaves === 24,
    JSON.stringify(r));
  check('   because the two noise draws are independent', (() => {
    let same = 0;
    for (let b = 2; b <= A.BMAX; b++) if (A.NOISE_B[b] === A.NOISE_V[b]) same++;
    return same < 20;
  })());

  // THE CAPPED DYNAMIC PROGRAM, kept so the fix cannot regress. Capping each level's
  // arity at the residual leaf count is sound when the weight rises with arity and
  // wrong when it does not; it returned a sequence dearer than the best CONSTANT
  // tree, which containment forbids. T-INSTRUMENT-FALSE-VERDICT.
  const capped = A.controlBestCapped(729, A.GMAX, new Map());
  const fixed = A.controlBest(729, A.GMAX, new Map());
  const con = A.controlBestConstant(729, A.GMAX);
  check('the capped dynamic program returns an impossible answer, and still does',
    capped.cost > con.cost && capped.cost / con.cost > 40,
    `${capped.cost.toFixed(0)} vs ${con.cost.toFixed(0)}`);
  check('   while the fixed one never exceeds the best constant tree',
    fixed.cost <= con.cost + 1e-9);

  // TWO OF THE THREE REGISTERED RESPONSIVENESS ASSERTS FAILED, and saying so is the
  // point. The frozen draw's cheapest arity landed at 604, 310 and 383 across the
  // three rates -- all wide enough to cover any swept leaf count in two levels -- so
  // repeating that one arity is optimal everywhere, its optimum is trivially a
  // constant sequence, and variation cannot help it BY CONSTRUCTION.
  // F-CONTROL-CANNOT-DISCRIMINATE, second bite, from degeneracy rather than algebra.
  check('the FROZEN control is degenerate: its optimum is constant and gains nothing',
    r.maxGain < 1e-12 && r.notNearEqual === 0,
    `maxGain ${r.maxGain}, notNearEqual ${r.notNearEqual}`);

  // The remedy, post-hoc and scoring nothing: a null over redraws rather than one
  // object. AO1 already paid for treating a single fixed pseudorandom object as a
  // distribution.
  const nul = A.controlNull();
  check('the NULL over 100 redraws: only 4 draws gain at all, median and p95 exactly 0',
    nul.trials === 100 && nul.drawsWithAnyGain === 4
    && nul.medianGain === 0 && nul.p95Gain === 0, JSON.stringify(nul));
  check('   so structureless per-level costs help 0.83% of draw-by-leaf pairs against'
    + ' the vector regime\'s 85.7% — a hundredfold, and THAT is the discrimination',
    Math.abs(nul.helpedFraction - 0.008333) < 1e-4
    && W.helpedFraction / nul.helpedFraction > 100);
  check('   but the null\'s TAIL reaches 23.7%, above the subject\'s worst cell, so'
    + ' magnitude alone would have discriminated nothing',
    Math.round(1000 * nul.maxGain) === 237 && nul.maxGain > CONT.worst);
}

console.log('\n--- the tool as it is actually RUN, not merely imported ---');
{
  // T-TOOL-CHECKED-ONLY-BY-IMPORT: importing sets MAIN false, so no print path ever
  // executes and a fault in the report stays invisible to a suite that only requires.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'radix-audit.js')],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('RADIX AUDIT') && out.includes('AR1') && out.includes('AR4'));
  check('   including the instrument section, before any verdict',
    out.indexOf('THE INSTRUMENT') < out.indexOf('AR1'));
}

console.log('\n=== 1. AR1 — HELD, AND WORTH LESS THAN IT LOOKS ===');
{
  const worstGrid = GRID.reduce((a, c) => (c.gain > a.gain ? c : a), GRID[0]);
  check('the two sweeps are the registered ones: 2,880 grid cells and 65,528 contiguous',
    GRID.length === 2880 && CONT.cells === 65528, `${GRID.length} / ${CONT.cells}`);
  check('no cell of either sweep improves by 15% or more — AR1 HELD',
    worstGrid.gain < 0.15 && CONT.worst < 0.15);
  check('   the worst contiguous cell is 12.30%, at N = 257',
    Math.round(10000 * CONT.worst) === 1230 && CONT.at.n === 257,
    `${(100 * CONT.worst).toFixed(2)}% at ${CONT.at.n}`);
  check('   and the worst on AQ\'s own grid is 9.99%, at N = 128',
    Math.round(10000 * worstGrid.gain) === 999 && worstGrid.n === 128,
    `${(100 * worstGrid.gain).toFixed(2)}% at ${worstGrid.n}`);
  // The line's placement decided the verdict, and the reason was registered before the
  // run: a hand case at 9.99% made a 10% line a coin toss. It would have lost.
  check('   A 10% LINE WOULD HAVE FAILED: 12.30% is past it, and the widening to 15%'
    + ' was registered with its reason', CONT.worst > 0.10 && CONT.worst < 0.15);
  check('   typically the flexibility is worth 3.15%, not 12%',
    Math.round(10000 * GP.median) === 315 && Math.round(10000 * GP.mean) === 287,
    JSON.stringify(GP));
}

console.log('\n=== 2. AR2 — HELD. THE STAIRCASE FLATTENS ===');
{
  check('over [1024, 8192] the largest constant-tree jump is 11.97%',
    Math.round(10000 * W.maxJumpCon) === 1197 && W.atCon === 1024,
    `${(100 * W.maxJumpCon).toFixed(2)}% at ${W.atCon}`);
  check('   and the largest varying-tree jump is 4.00%',
    Math.round(10000 * W.maxJumpSeq) === 400 && W.atSeq === 1024,
    `${(100 * W.maxJumpSeq).toFixed(2)}% at ${W.atSeq}`);
  check('   a ratio of 0.334, under the predicted half — AR2 HELD',
    Math.round(1000 * W.jumpRatio) === 334 && W.jumpRatio < 0.5);
  // Not required by the registration and not assumable: the two maxima could have sat
  // at different leaf counts, which is the case that would have made the ratio
  // meaningless.
  check('   and both maxima land at the same leaf count, which was not assumed',
    W.atCon === W.atSeq);
}

console.log('\n--- the scope the registration left ambiguous, measured rather than argued ---');
{
  // AR2, AR3 and AR4 name "the verify-dominated rate" in prose while the header
  // describes the contiguous sweep at eight decade boundaries. The registered CODE
  // pins them to GMAX = 10^3.875, which is not a decade boundary, so the code decides
  // the scope -- T-SCOPE-DECIDES-THE-VERDICT. Whether that mattered is a measurement,
  // not an argument: rerun the window at the nearest decade and compare.
  const D = A.windowStats(A.DEEP_LO, A.DEEP_HI, 1000);
  check('at gamma = 1000, the decade boundary, all three verdicts are unchanged',
    D.helped === W.helped && D.deeper === W.deeper && D.shallower === W.shallower
    && D.jumpRatio < 0.5, JSON.stringify({ helped: D.helped, deeper: D.deeper,
      shallower: D.shallower, ratio: D.jumpRatio }));
  check('   and the jump ratio moves only from 0.334 to 0.337',
    Math.round(1000 * D.jumpRatio) === 337);
}

console.log('\n=== 3. AR3 — HELD, AND IT IS THE ONE I COULD NOT CALL ===');
{
  check('6,144 of 7,169 leaf counts have a strictly cheaper varying optimum',
    W.helped === 6144 && W.leaves === 7169, `${W.helped}/${W.leaves}`);
  check('   85.7%, well past the predicted half — AR3 HELD',
    Math.round(1000 * W.helpedFraction) === 857 && W.helpedFraction > 0.5);
  // WHY THE HAND SAMPLE MISLED, stated after measuring rather than assumed. The first
  // version of this check asserted that exact powers are never helped, and it was
  // FALSE: 2187 = 3^7 is helped. The unhelped leaf counts are the powers of the arity
  // the optimum actually wants, which is four -- 1024 = 4^5 and 4096 = 4^6 -- and my
  // six hand-worked counts happened to include two of them.
  const helpedAt = n =>
    A.bestSequence('vector', n, A.GMAX).cost < A.bestConstant('vector', n, A.GMAX).cost - 1e-9;
  check('   the unhelped hand cases are powers of FOUR, not powers in general:'
    + ' 1024 and 4096 are unhelped and 2187 = 3^7 is helped',
    !helpedAt(1024) && !helpedAt(4096) && helpedAt(2187));
  check('   and a leaf count one past a power is always helped',
    [1025, 2188, 4097].every(helpedAt));
  // And the structural form of it, which is exact rather than illustrative.
  let mismatch = 0;
  for (let n = A.DEEP_LO; n <= A.DEEP_HI; n++) {
    const s = A.bestSequence('vector', n, A.GMAX);
    if (helpedAt(n) === (new Set(s.seq).size === 1)) mismatch++;
  }
  check('   a leaf count is helped EXACTLY when its optimal tree is not a constant'
    + ' one — no exceptions in 7,169', mismatch === 0, `${mismatch} exceptions`);
}

console.log('\n=== 4. AR4 — FAILED, AND THE MECHANISM WAS BACKWARDS ===');
{
  check('THE PREDICTION: deeper more often than shallower. It is the reverse —'
    + ' 3,580 shallower against 2,176 deeper',
    W.shallower === 3580 && W.deeper === 2176 && W.shallower > W.deeper,
    `deeper ${W.deeper}, shallower ${W.shallower}`);
  check('   and the three counts exhaust the window', W.deeper + W.shallower + W.same === W.leaves);
  check('   so it failed by 1.6 to 1, not by a margin', W.shallower / W.deeper > 1.5);

  // The mechanism. The registration argued that more levels means more per-level slack
  // to exploit, so the tree should grow. What a sequence actually buys is the same
  // gamma-charged quantity in fewer levels: the saving is level overhead, not work.
  let identical = 0, smaller = 0, larger = 0, shallowSame = 0;
  for (let n = A.DEEP_LO; n <= A.DEEP_HI; n++) {
    const s = A.bestSequence('vector', n, A.GMAX), c = A.bestConstant('vector', n, A.GMAX);
    const ws = s.depth + s.sum, wc = c.depth + c.depth * c.arity;
    if (ws === wc) identical++; else if (ws < wc) smaller++; else larger++;
    if (s.depth < c.depth && ws === wc) shallowSame++;
  }
  check('the verify budget a varying tree pays is NEVER larger than a constant tree\'s',
    larger === 0);
  check('   it is identical at 2,861 leaf counts and strictly smaller at 4,308',
    identical === 2861 && smaller === 4308, `${identical} / ${smaller}`);
  check('   and 1,836 of the 3,580 shallower cells buy the SAME budget in fewer levels'
    + ' — the slack removes a level rather than adding one',
    shallowSame === 1836, String(shallowSame));
}

console.log('\n=== 5. WHAT THE FAILURE FOUND: AQ\'S HEADLINE DOES NOT SURVIVE ===');
{
  const sh = A.limitShapes();
  const changed = sh.filter(r => !r.matchesAQ);
  check('25 of AQ\'s 45 leaf counts change shape once arity may vary',
    changed.length === 25 && sh.length === 45, `${changed.length}/${sh.length}`);
  const p3 = sh.filter(r => r.shape === '3^k');
  check('   including 11 of the 18 powers of three, which is AQ\'s own headline case',
    p3.length === 18 && p3.filter(r => !r.matchesAQ).length === 11);
  const t729 = sh.find(r => r.n === 729);
  check('   N = 729 wants [4,4,4,4,3], not six threes',
    t729.seq.join(',') === '4,4,4,4,3' && t729.conArity === 3 && t729.seqDepth === 5,
    t729.seq.join(','));

  // And the cost of that reversal, which is the part that matters: AQ was reading a
  // preference off a surface flat to four decimal places.
  const gapAt = n => {
    const s = A.bestSequence('vector', n, A.GMAX), c = A.bestConstant('vector', n, A.GMAX);
    return (c.cost - s.cost) / c.cost;
  };
  check('   and the whole reversal at N = 729 is worth 0.0178% of the total cost',
    Math.round(1e6 * gapAt(729)) === 178, (100 * gapAt(729)).toFixed(4) + '%');
  check('   T-CLAIM-NARROWED-BY-A-DESIGN: "a tree branches in its own base" is a'
    + ' property of CONSTANT trees, not of trees',
    [729, 2187, 6561].every(n => gapAt(n) > 0 && gapAt(n) < 0.0005));

  // What the optima are actually made of, which is the line a descriptor author needs.
  const cen = A.arityCensus();
  check('across 42,700 levels of 7,169 optimal trees, three arities appear and no more',
    cen.levels === 42700 && cen.trees === 7169 && cen.rows.length === 3);
  check('   four takes 69.0% of levels, five 22.1%, three 8.9%',
    cen.rows[0][0] === 4 && cen.rows[1][0] === 5 && cen.rows[2][0] === 3
    && Math.round(1000 * cen.rows[0][1] / cen.levels) === 690,
    JSON.stringify(cen.rows));
  check('   and 1,025 of the 7,169 optima turn out to be a constant arity after all',
    cen.constantTrees === 1025);

  // The merkle regime, where the answer is proved rather than swept: b - 1 >= log2(b)
  // for every integer b >= 2, equality only at 2, so sum(b_i - 1) >= log2(N) and the
  // all-twos tree attains the least integer above that floor.
  check('in the merkle regime variation buys exactly nothing, at any cell',
    A.LEAVES.every(n => A.GAMMAS.every(g =>
      A.bestSequence('merkle', n, g).cost >= A.bestConstant('merkle', n, g).cost - 1e-9)));
  check('   which is proved, not swept: b - 1 >= log2(b) with equality only at two',
    Array.from({ length: 1023 }, (_, i) => i + 2)
      .every(b => b - 1 >= Math.log2(b) - 1e-12)
    && Math.abs((2 - 1) - Math.log2(2)) < 1e-12);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
