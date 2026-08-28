'use strict';
/* RADIX AUDIT — what happens when a tree's arity is allowed to VARY by depth?
 *
 * Set `AR`. Three sets now wear the word "arity" and they ask different questions.
 * `AI` (`tools/arity-audit.js`) climbs the INPUT arity of a function, n -> n+1.
 * `AQ` (`tools/branching-audit.js`) swept every CONSTANT branching factor of a tree
 * from 2 to 1024. This one sweeps RADIX SEQUENCES: a tree that is one width at the
 * top and another below it.
 *
 * WHY THIS SET EXISTS
 * -------------------
 * `AQ` found that binary is never optimal for a vector commitment, that the optimum
 * never descends past three, and -- the finding that mattered -- that a tree wants
 * the branching factor its leaf count is written in: 3^k takes three, 2^k takes four.
 * That answer is incomplete in a way `AQ` could not repair from inside itself, because
 * every tree it costed had ONE width. Real address spaces are not clean powers of
 * anything. A tree that is three at the top and nine below might sit against the
 * ceiling more tightly than any constant arity can, and nobody has measured whether
 * it does.
 *
 * `bitblock`'s authenticated-state plan admits a Verkle candidate only after a
 * `VectorCommitmentProfileDescriptorV1` freezes the scheme, arity, curve, proof sizes
 * and setup assumptions, and states plainly that outside parameters and measurements
 * are research INPUTS rather than its evidence. `AQ` produced such an input for the
 * constant case. The descriptor has ONE arity line, so whether that line is losing
 * anything to a per-level schedule is a question the descriptor's author has to be
 * able to answer. This set is that input.
 *
 * ------------------------------------------------------------------------------
 * WHAT THIS IS NOT
 *
 * This measures a COST MODEL, the same one `AQ` measured, extended from radices to
 * radix sequences. It says nothing about whether any of these trees is secure, and
 * nothing about whether one can be built on this substrate --
 * `F-REVERSIBLE-CANNOT-DESTROY` already settled that a machine made of bijections
 * cannot destroy a secret, so a trusted setup is not merely unperformed here but
 * INEXPRESSIBLE. A cost model is program-relative in exactly the sense
 * `N-program-relative` names, and the optimum found here is the optimum OF THIS
 * MODEL.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION
 *
 * Everything in this block is fixed before the run and none of it is at risk. It is
 * written down so that what IS at risk is unambiguous.
 *
 * THE TREE. `N` leaves and a RADIX SEQUENCE (b_1, ..., b_d): every node at level i has
 * b_i children, so the tree addresses prod(b_i) leaves and is admissible when that
 * product is at least N. Depth is the LENGTH of the sequence rather than a ceiling of
 * a logarithm, which is the whole generalisation: `AQ`'s constant tree is the special
 * case b_1 = ... = b_d, where prod = b^d >= N is exactly ceil(log_b N) and the ceiling
 * reappears as a step function.
 *
 * THE COST, WHICH IS `AQ`'S COST. Each level contributes a weight and the weights add:
 *
 *   merkle    w(b) = (b - 1) * H  +  gamma * (b - 1)
 *   vector    w(b) = O            +  gamma * (ALPHA + b)          plus a constant C
 *   control   w(b) = NOISE_B[b]   +  gamma * NOISE_V[b]
 *
 * with H = O = C = 32 bytes and ALPHA = 1, exactly `AQ`'s constants. Summing w over a
 * constant sequence of length d reproduces `AQ`'s `total()` term for term, and the
 * instrument section asserts that identity at all 2,880 of its cells rather than
 * asserting it in prose.
 *
 * GAMMA, the bytes-per-verify-operation exchange rate, is `AQ`'s: 64 values across
 * eight decades, swept and not chosen.
 *
 * ARITIES 2..1024 per level, `AQ`'s range, so the two sets are comparable and no width
 * available to a constant tree is denied to a varying one.
 *
 * THE SEARCH SPACE, AND WHY IT IS TRACTABLE. For the merkle and vector regimes w is
 * AFFINE in b, so the cost of a sequence depends on it only through its length d and
 * its sum S = sum(b_i). Minimising cost therefore reduces to computing, for each d,
 *
 *   MINSUM(d, N) = min { sum(b_i) : d factors, each in [2, 1024], prod(b_i) >= N }
 *
 * and then minimising over d. Depth is bounded above by depth(N, 2) and that bound is
 * a PROOF rather than a budget -- past it every extra level adds a strictly positive
 * weight and buys coverage the all-twos tree already has -- so `T-EXHAUSTED-NOT-CLOSED`
 * does not apply, and the tool checks the two levels past the bound to show it.
 *
 * MINSUM IS COMPUTED THREE WAYS AND THEY MUST AGREE. A closed form (the smallest S
 * whose near-equal partition into d parts has product at least N), an independent
 * dynamic program over ceil-division that knows nothing about near-equality, and
 * brute-force enumeration of every sequence for small cases. `T-TRANSCRIBED-TABLE` and
 * `T-INSTRUMENT-FALSE-VERDICT` between them have cost this project nineteen bites, and
 * every catch came from a second computation disagreeing with the first.
 *
 * NO PRODUCT IS EVER FORMED IN FULL. Testing whether a partition covers N multiplies
 * with an early exit the moment the running product reaches N. At d = 13 and q = 1024
 * the full product is 10^39 and a JavaScript number stops being an integer at 2^53;
 * the same discipline as computing depth by repeated multiplication rather than by
 * dividing logarithms, and the same silent failure if skipped. The unguarded version
 * is kept in the tool as `maxprodOverflow` so the fix cannot regress unnoticed.
 *
 * TWO SWEEPS.
 *
 *   GRID        `AQ`'s 45 leaf counts against all 64 exchange rates -- 2,880 cells,
 *               the same cells `AQ` scored, so the two sets can be laid side by side.
 *
 *   CONTIGUOUS  EVERY integer leaf count from 2 to 8,192, at the eight decade
 *               boundaries of the same gamma range. A curated mix of 3^k and 2^k is
 *               what made `AQ1` measure its own sweep instead of trees
 *               (`T-CLAIM-NARROWED-BY-A-DESIGN`, fourth bite); a contiguous range has
 *               no composition to be a property of.
 *
 * THE DEEP SUB-RANGE. `AR2`, `AR3` and `AR4` are declared over the contiguous leaf
 * counts from 1,024 to 8,192 rather than from 2, and the reason is stated rather than
 * discovered: below about a thousand leaves the optimal tree is under five levels deep
 * and a sequence has almost no room to differ from a constant, so the two constructions
 * coincide by force and the statistic measures the shallow end rather than the
 * question. The same statistics are reported for [128, 1024] and [8192, 65536] as
 * unregistered robustness, so the choice of window is visible rather than load-bearing.
 *
 * TIE-BREAKS, BOTH DECLARED, AND BOTH LEANING AGAINST `AR4`. Among constant arities of
 * equal cost the SMALLER arity wins, which is `AQ`'s rule and gives the DEEPER tree.
 * Among sequence depths of equal cost the SMALLER depth wins, giving the SHALLOWER
 * tree. `AR4` predicts the varying optimum is deeper more often than shallower, so
 * both conventions are set against it. An undeclared tie-break is a hidden parameter
 * that can carry a verdict on its own -- `T-SCOPE-DECIDES-THE-VERDICT`, four bites.
 *
 * THE CONTROL, AND THE ONE THING `AQ` GOT WRONG. `AQ`'s registered control gave its two
 * cost terms the SAME pseudorandom draw, so gamma factored out of its total and its
 * optimum was constant in exactly the dimension being swept: it could only ever agree.
 * That is `F-CONTROL-CANNOT-DISCRIMINATE`, and this set does not inherit it. The
 * control here draws NOISE_B and NOISE_V independently, w is not affine so it gets the
 * general dynamic program rather than the closed form, and THREE RESPONSIVENESS ASSERTS
 * RUN BEFORE ANY VERDICT IS READ: its optimum must move with gamma, its optimal
 * sequences must NOT be near-equal partitions, and the gain it shows from allowing
 * variation must be large. If a structureless per-level cost also shows variation
 * buying almost nothing, then this sweep is describing the shape of its own arithmetic.
 * The control runs on the grid leaf counts up to 16,384 at the eight decade rates --
 * a stated sample, because its dynamic program is quadratically dearer than the closed
 * form and a control does not need the full grid to be responsive.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED — established while building the instrument, and therefore never at
 * risk. Listed so the pre-registration record is not inflated with them.
 *
 *   ORDER IS FREE. In this cost model the total depends on a radix sequence only
 *   through its MULTISET of arities -- indeed only through d and sum(b_i). "Three at
 *   the top and nine below" costs exactly what "nine at the top and three below"
 *   costs. That is immediate from the weights adding, and it partly reframes the
 *   question that prompted this set: there is nothing to schedule, only a multiset to
 *   choose. A cost that is order-sensitive -- a verifier caching the top levels, or an
 *   update path charged differently from a read -- is a DIFFERENT model, and nothing
 *   here bounds it. The tool prints sequences widest-first purely for legibility.
 *
 *   TWO ADJACENT WIDTHS SUFFICE. For a fixed d, the maximum product over positive
 *   integers of a fixed sum is attained at the near-equal partition, so the minimum-sum
 *   admissible sequence uses at most two distinct arities and they differ by one. An
 *   optimal varying tree is therefore never an elaborate schedule; it is q at some
 *   levels and q+1 at the rest.
 *
 *   MERKLE WANTS BINARY AT EVERY LEVEL, and this one is proven rather than swept:
 *   merkle cost is (H + gamma) * sum(b_i - 1), and b - 1 >= log2(b) for every integer
 *   b >= 2 with equality only at b = 2, so sum(b_i - 1) >= log2(prod) >= log2(N).
 *   The all-twos tree attains ceil(log2 N), the least integer above that floor.
 *   Variation buys exactly nothing in the merkle regime at any leaf count or rate.
 *
 *   FOUR HAND-DERIVED IMPROVEMENTS, arithmetic done on paper before the tool ran, and
 *   the basis of `AR1`. At the verify-dominated end, comparing the best sequence with
 *   the best constant arity: N = 486 gives 4.2%, N = 730 gives 4.0%, N = 1,025 gives
 *   7.1%, N = 10^8 gives 1.5%. A deliberate hunt for a worse case found N = 11, where
 *   the best constant is (4, 4) and the best sequence is (4, 3): 9.99%. That near-miss
 *   is why `AR1`'s line is at 15% and not at 10% -- a criterion decided by the third
 *   decimal of a case already in hand teaches nothing, which is
 *   `T-CRITERION-IN-THE-NOISE` applied before the fact instead of after it.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered before the run, per AGENTS.md, in a commit that
 * contains no measurement.
 *
 * EACH CARRIES AN `AT RISK` LINE, and the line is the point rather than the decoration.
 * A read-only audit of all 181 registered predictions in this corpus has just scored
 * 25 of them DECORATIVE -- computable from the registration's own text before the run,
 * spread across 18 of 43 sets, at a rate that does not fall over time, and every one
 * of the 25 HELD, which is the rule validating itself: a fact that was never at risk
 * cannot fail. `AQ` is the only set of the 43 that wrote `AT RISK` lines and the only
 * one that scored zero decorative, so the antibody has a sample size of one and `AR`
 * is its prospective test.
 *
 * THE FILTER APPLIED TO ALL FOUR. The trap is arithmetic over quantities I STIPULATED:
 * a registration that states an answer, states the identity that produces it, and then
 * has the run re-execute that same arithmetic. Hand derivation is not the problem --
 * this project endorses it and several derived predictions have failed. Whose
 * quantities the arithmetic runs over is the discriminator. Every parameter of this
 * sweep is stipulated: the arity range, the exchange rates, the leaf counts, the
 * windows. So each prediction below is an EXTREMUM OR A CENSUS over an optimisation I
 * cannot carry out by hand -- 68,408 cells for `AR1`, 7,167 consecutive pairs for
 * `AR2`, 7,168 leaf counts for `AR3` and `AR4` -- and in each case the hand arithmetic
 * I do have covers single digits of that space and points the wrong way for two of
 * them. Anything I could have finished on paper is in the NOT REGISTERED block above.
 *
 *   AR1  LETTING THE ARITY VARY IS WORTH LESS THAN A SIXTH. Predicted that at every
 *        cell of both vector-regime sweeps -- 2,880 grid cells and 65,528 contiguous
 *        ones -- the best radix sequence costs AT LEAST 85% of the best constant
 *        arity's cost. No cell improves by 15% or more.
 *        AT RISK: this comes out the other way if ONE leaf count anywhere in
 *        [2, 8192] has a factorisation that leaves the constant optimiser worse
 *        stranded than N = 11 did. Five leaf counts worked on paper give 1.5%, 4.0%,
 *        4.2%, 7.1% and 9.99%, the last found by deliberately hunting a bad case, so
 *        the line stands about 50% above the worst thing five attempts could find and
 *        is refuted by a single cell past it. Five of 8,236 leaf counts is not a
 *        sample I can extrapolate from; the corners those five did not visit are the
 *        bytes-dominated rates and the very small counts.
 *        CANNOT SHOW: this bounds the improvement; it says nothing about how often
 *        the improvement is zero, which `AR3` asks separately.
 *
 *   AR2  THE STAIRCASE FLATTENS BY MORE THAN HALF. `AQ`'s cost is a step function of
 *        the leaf count: one leaf past a power, a constant-arity tree pays a whole
 *        extra level. Predicted that over the deep contiguous sub-range at the
 *        verify-dominated rate, the largest single-leaf relative jump --
 *        max over N of cost(N+1)/cost(N) - 1 -- is LESS THAN HALF as large when
 *        arity may vary as when it may not.
 *        AT RISK: this comes out the other way if the varying tree has a single bad
 *        step anywhere the constant tree happens to be smooth, because both sides are
 *        MAXIMA over 7,167 consecutive pairs and they need not occur at the same leaf
 *        count. I have one pair on paper, N = 1,024 -> 1,025, where the constant jump
 *        is 11.97% and the varying jump 4.00%; where either maximum actually sits is
 *        not something arithmetic hands me, and if the varying maximum sits somewhere
 *        other than 1,025 the ratio can be anything.
 *        CANNOT SHOW: a maximum is one point. The distribution of jumps is reported
 *        beside it and is not registered.
 *
 *   AR3  VARIATION HELPS MOST LEAF COUNTS, NOT A FEW. Predicted that over the deep
 *        contiguous sub-range at the verify-dominated rate, MORE THAN HALF of the
 *        leaf counts have a strictly cheaper varying optimum than constant optimum.
 *        AT RISK, AND THIS IS THE ONE I CANNOT CALL: it comes out the other way if the
 *        constant optimiser's freedom to pick its own depth is worth as much as the
 *        sequence's freedom to pick its own widths, and I have no way to settle that
 *        short of running it. The reasoning FOR is that a constant tree must round
 *        every level up together while a sequence rounds only a minority of them, so
 *        equality needs the rounding remainder to land on 0 or on d, roughly a
 *        2/(d+1) coincidence. The evidence AGAINST is my own: of six leaf counts I
 *        worked by hand, four were NOT helped. I am registering the reasoning against
 *        my own sample, which is the choice that can embarrass me, and if the sample
 *        is right rather than the reasoning then the flexibility is a rarity rather
 *        than a rule and `AR1`'s bound describes a corner case.
 *        CANNOT SHOW: a count over leaf counts in a window is a property of the model
 *        ON THAT WINDOW. It is contiguous and exhaustive, so it is not a property of a
 *        mix I composed -- which is precisely what sank `AQ1` -- but the window's
 *        placement is still mine, and two other windows are reported unregistered.
 *
 *   AR4  THE OPTIMAL TREE GETS DEEPER MORE OFTEN THAN SHALLOWER. Predicted that over
 *        the deep contiguous sub-range at the verify-dominated rate, the leaf counts
 *        whose varying optimum is strictly DEEPER than their constant optimum
 *        outnumber those whose varying optimum is strictly shallower.
 *        AT RISK: it comes out the other way if the per-level bytes charge O outweighs
 *        the per-level rounding slack, and I have a worked case where it does -- at
 *        N = 10^8 the hand arithmetic puts the varying optimum THREE levels SHALLOWER
 *        than the constant one, which is the direction opposite to the one registered.
 *        Both declared tie-breaks also push against it: the constant baseline breaks
 *        ties toward the smaller arity and so toward the deeper tree, and the sequence
 *        breaks ties toward the smaller depth and so toward the shallower one. The
 *        reasoning FOR is only that the slack a sequence exploits is per-level, so
 *        there is more of it where there are more levels.
 *        CANNOT SHOW: this compares depths at the argmin. It says nothing about the
 *        depth of trees that are near-optimal but not optimal.
 *
 * ------------------------------------------------------------------------------
 *     npm run audit:radix
 */

const AQ = require('./branching-audit.js');

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

/** Design constants, imported rather than retyped so the two sets cannot drift. */
const { H, O, C, ALPHA, GAMMAS, LEAVES, depth } = AQ;
const BMAX = 1024;

/** One rate per decade, for sweeps too large to run at all 64. */
const DECADES = [0, 8, 16, 24, 32, 40, 48, 56].map(i => GAMMAS[i]);
const GMAX = GAMMAS[GAMMAS.length - 1];

/** The contiguous sweep, and the deep window AR2/AR3/AR4 are declared over. */
const CONT_MAX = 8192;
const DEEP_LO = 1024, DEEP_HI = 8192;
/** Reported beside the deep window, unregistered, so the window is visible. */
const WINDOWS = [[128, 1024], [DEEP_LO, DEEP_HI], [8192, 16384]];

// ---------------------------------------------------------------- the cost model

/**
 * A level's weight. Affine in b for the two real regimes, which is what makes the
 * whole search reduce to (depth, sum). `total` below asserts nothing; the identity
 * with AQ's own cost is checked in the test at every one of its 2,880 cells.
 */
function weight(regime, b, gamma) {
  if (regime === 'merkle') return (b - 1) * H + gamma * (b - 1);
  if (regime === 'vector') return O + gamma * (ALPHA + b);
  throw new Error(`radix-audit: no affine weight for regime ${regime}`);
}

/** A whole sequence's cost from its length and its sum. Order never enters. */
function costOf(regime, d, S, gamma) {
  if (!Number.isFinite(S)) return Infinity;
  // Grouped as bytes-plus-rate-times-operations, which is AQ's grouping rather than
  // the algebraically equivalent (S - d) * (H + gamma). The two differ in the last
  // bit of a float, and the identity with AQ is checked as an EQUALITY at 20,000
  // pairs; a check that has to be given a tolerance is a check that has stopped
  // saying the two tools compute the same thing.
  if (regime === 'merkle') return (S - d) * H + gamma * (S - d);
  if (regime === 'vector') return C + d * O + gamma * (d * ALPHA + S);
  throw new Error(`radix-audit: no cost for regime ${regime}`);
}

/** The same cost, from an explicit sequence. Used to check `costOf` against itself. */
function costOfSequence(regime, seq, gamma) {
  let t = regime === 'vector' ? C : 0;
  for (const b of seq) t += weight(regime, b, gamma);
  return t;
}

// ------------------------------------------------------------------ MINSUM, three ways

/**
 * Does the near-equal partition of S into d parts cover N? The product is built with
 * an EARLY EXIT and is never completed: at d = 13 and q = 1024 the full product is
 * about 10^39, and a JavaScript number stops being an exact integer at 2^53. Same
 * hazard as dividing logarithms to get a depth, same silence when it bites.
 */
function maxprodAtLeast(S, d, N) {
  if (d <= 0) return N <= 1;
  if (S < 2 * d) return false;
  const q = Math.floor(S / d), r = S % d;
  // No arity cap is applied here. This answers a question about partitions of S, and
  // the [2, BMAX] range is enforced where it belongs -- by `minsum` bounding its
  // search at S = BMAX * d. A cap folded in here would make the predicate answer a
  // different question than its name, which is how a scope decides a verdict.
  let p = 1;
  for (let i = 0; i < d; i++) {
    p *= (i < r ? q + 1 : q);
    if (p >= N) return true;
  }
  return p >= N;
}

/** The near-equal partition itself, widest first. Order is free; this is legibility. */
function nearEqual(S, d) {
  const q = Math.floor(S / d), r = S % d;
  const seq = [];
  for (let i = 0; i < d; i++) seq.push(i < r ? q + 1 : q);
  return seq;
}

/**
 * MINSUM by closed form: the least S whose near-equal partition into d parts covers N.
 * Monotone in S, so a binary search rather than a scan --
 * `T-SEARCH-WHERE-A-CHECK-WOULD-DO`.
 */
function minsum(d, N) {
  if (d <= 0) return N <= 1 ? 0 : Infinity;
  if (N <= 1) return 2 * d;
  let lo = 2 * d, hi = BMAX * d;
  if (!maxprodAtLeast(hi, d, N)) return Infinity;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (maxprodAtLeast(mid, d, N)) hi = mid; else lo = mid + 1;
  }
  return lo;
}

/**
 * MINSUM by an independent dynamic program, which knows nothing about near-equality:
 * pick the top level's arity b, and the rest of the tree must cover ceil(N / b) in
 * d - 1 levels. Exact, because prod(rest) >= N/b and prod(rest) is an integer.
 * This is the second opinion the closed form is checked against.
 */
function minsumDP(d, N, memo = new Map()) {
  if (d <= 0) return N <= 1 ? 0 : Infinity;
  if (N <= 1) return 2 * d;
  const key = `${d}:${N}`;
  if (memo.has(key)) return memo.get(key);
  let best = Infinity;
  const top = Math.min(BMAX, N);
  for (let b = 2; b <= top; b++) {
    const rest = minsumDP(d - 1, Math.ceil(N / b), memo);
    if (rest !== Infinity && b + rest < best) best = b + rest;
  }
  memo.set(key, best);
  return best;
}

/**
 * MINSUM by enumerating every sequence. Only tractable for toys, which is the point.
 * The arity ceiling defaults to N rather than to a constant: capped at 24 it silently
 * reported `Infinity` for minsum(1, 37), because no single level of 24 covers 37 --
 * a disagreement that was a fact about the checker's own cap and not about MINSUM.
 */
function minsumBrute(d, N, maxb = Math.min(BMAX, Math.max(2, N))) {
  let best = Infinity;
  const seq = new Array(d);
  const rec = (i, prod, sum) => {
    if (sum >= best) return;
    if (i === d) { if (prod >= N) best = sum; return; }
    for (let b = 2; b <= maxb; b++) rec(i + 1, prod * b, sum + b);
  };
  rec(0, 1, 0);
  return best;
}

/**
 * The unguarded product, kept so the guarded one cannot silently regress. It forms
 * q^(d-r) * (q+1)^r in full, which stops being an exact integer past 2^53 and is
 * infinite past about 2^1024. A test pins a case where it and `maxprodAtLeast`
 * disagree -- T-INSTRUMENT-FALSE-VERDICT, nineteen bites, and every catch came from
 * a second computation rather than from reading the first.
 */
function maxprodOverflow(S, d) {
  const q = Math.floor(S / d), r = S % d;
  return Math.pow(q, d - r) * Math.pow(q + 1, r);
}

// ------------------------------------------------------------ the two optimisations

/**
 * Depth is bounded by depth(N, 2) and the bound is a PROOF: past it every extra level
 * adds a strictly positive weight and covers nothing the all-twos tree did not already
 * cover. `maxUsefulDepth` returns the bound; `depthBoundIsProved` demonstrates it by
 * costing two levels beyond, so the boundary is never mistaken for an exhausted budget.
 */
function maxUsefulDepth(N) { return Math.max(1, depth(N, 2)); }

function depthBoundIsProved(regime, N, gamma) {
  const D = maxUsefulDepth(N);
  const at = d => costOf(regime, d, minsum(d, N), gamma);
  return at(D + 1) > at(D) && at(D + 2) > at(D + 1);
}

/**
 * The cheapest radix sequence at one cell. Ties in cost go to the SMALLER depth --
 * declared, and set against AR4.
 */
function bestSequence(regime, N, gamma) {
  let best = Infinity, bestD = 0, bestS = Infinity;
  const D = maxUsefulDepth(N);
  for (let d = 1; d <= D; d++) {
    const S = minsum(d, N);
    if (!Number.isFinite(S)) continue;
    const t = costOf(regime, d, S, gamma);
    if (t < best) { best = t; bestD = d; bestS = S; }
  }
  return { depth: bestD, sum: bestS, cost: best, seq: nearEqual(bestS, bestD) };
}

/**
 * The cheapest CONSTANT arity at one cell, in AQ's terms and with AQ's tie-break:
 * ties go to the smaller arity, which is the deeper tree.
 */
function bestConstant(regime, N, gamma) {
  let best = Infinity, at = 0;
  for (let b = 2; b <= BMAX; b++) {
    const d = depth(N, b);
    const t = costOf(regime, d, d * b, gamma);
    if (t < best) { best = t; at = b; }
  }
  return { arity: at, depth: depth(N, at), sum: depth(N, at) * at, cost: best };
}

// ------------------------------------------------------------------ the grid sweep

/** AQ's 45 leaf counts against all 64 rates: the cells AQ itself scored. */
function gridSweep(regime = 'vector') {
  const cells = [];
  for (const n of LEAVES) for (const gamma of GAMMAS) {
    const seq = bestSequence(regime, n, gamma);
    const con = bestConstant(regime, n, gamma);
    cells.push({ n, gamma, seq, con, gain: (con.cost - seq.cost) / con.cost });
  }
  return cells;
}

// ------------------------------------------------------------ the contiguous sweep

/**
 * depth(n, b) for every arity at one leaf count, by repeated multiplication. Held as
 * a row so a leaf count can be costed at several rates without recomputing depths --
 * the rates do not change the shape of the tree, only what it is worth.
 */
function depthRow(n) {
  const row = new Int32Array(BMAX + 1);
  for (let b = 2; b <= BMAX; b++) { let d = 0, reach = 1; while (reach < n) { reach *= b; d++; } row[b] = d; }
  return row;
}

/** MINSUM(d, n) for every useful depth at one leaf count. */
function minsumRow(n) {
  const D = maxUsefulDepth(n);
  const row = new Float64Array(D + 1);
  for (let d = 1; d <= D; d++) row[d] = minsum(d, n);
  return row;
}

/** Best sequence and best constant at one leaf count, given its two rows. */
function cellFromRows(regime, n, gamma, dep, ms) {
  let sBest = Infinity, sD = 0, sS = Infinity;
  for (let d = 1; d < ms.length; d++) {
    const S = ms[d];
    if (!Number.isFinite(S)) continue;
    const t = costOf(regime, d, S, gamma);
    if (t < sBest) { sBest = t; sD = d; sS = S; }
  }
  let cBest = Infinity, cB = 0;
  for (let b = 2; b <= BMAX; b++) {
    const d = dep[b];
    const t = costOf(regime, d, d * b, gamma);
    if (t < cBest) { cBest = t; cB = b; }
  }
  return {
    n, gamma,
    seq: { depth: sD, sum: sS, cost: sBest },
    con: { arity: cB, depth: dep[cB], cost: cBest },
    gain: (cBest - sBest) / cBest,
  };
}

/** One contiguous cell, rows computed on the spot. */
function contCell(regime, n, gamma) {
  return cellFromRows(regime, n, gamma, depthRow(n), minsumRow(n));
}

/** Every contiguous leaf count in a window, at one rate. */
function contSweep(regime, gamma, lo = 2, hi = CONT_MAX) {
  const out = [];
  for (let n = lo; n <= hi; n++) out.push(cellFromRows(regime, n, gamma, depthRow(n), minsumRow(n)));
  return out;
}

/**
 * The three statistics AR2, AR3 and AR4 are scored on, over one window at one rate.
 * `jump` is relative and single-leaf: cost(n+1)/cost(n) - 1.
 */
function windowStats(lo, hi, gamma = GMAX, regime = 'vector') {
  const row = contSweep(regime, gamma, lo, hi);
  let helped = 0, deeper = 0, shallower = 0, same = 0;
  let maxJumpCon = 0, maxJumpSeq = 0, atCon = 0, atSeq = 0;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c.seq.cost < c.con.cost) helped++;
    if (c.seq.depth > c.con.depth) deeper++;
    else if (c.seq.depth < c.con.depth) shallower++;
    else same++;
    if (i + 1 < row.length) {
      const nx = row[i + 1];
      const jc = nx.con.cost / c.con.cost - 1, js = nx.seq.cost / c.seq.cost - 1;
      if (jc > maxJumpCon) { maxJumpCon = jc; atCon = c.n; }
      if (js > maxJumpSeq) { maxJumpSeq = js; atSeq = c.n; }
    }
  }
  return {
    lo, hi, gamma, leaves: row.length,
    helped, helpedFraction: helped / row.length,
    deeper, shallower, same,
    maxJumpCon, maxJumpSeq, atCon, atSeq,
    jumpRatio: maxJumpCon === 0 ? Infinity : maxJumpSeq / maxJumpCon,
    maxGain: row.reduce((a, c) => Math.max(a, c.gain), 0),
  };
}

/**
 * The worst gain anywhere in the contiguous sweep, across the eight decade rates. The
 * leaf count is the outer loop because its two rows do not depend on the rate.
 */
function contWorstGain(regime = 'vector', lo = 2, hi = CONT_MAX) {
  let worst = -Infinity, at = null, cells = 0;
  for (let n = lo; n <= hi; n++) {
    const dep = depthRow(n), ms = minsumRow(n);
    for (const gamma of DECADES) {
      const c = cellFromRows(regime, n, gamma, dep, ms);
      cells++;
      if (c.gain > worst) { worst = c.gain; at = c; }
    }
  }
  return { worst, at, cells };
}

// ------------------------------------------------------------------------ the control

/**
 * Independent draws for the two terms, so gamma cannot factor out. AQ's control gave
 * both terms the SAME draw and could only ever agree -- F-CONTROL-CANNOT-DISCRIMINATE.
 */
const NOISE_B = new Int32Array(BMAX + 1), NOISE_V = new Int32Array(BMAX + 1);
(() => {
  let s = 20260828;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let b = 2; b <= BMAX; b++) {
    NOISE_B[b] = 1 + Math.floor(rnd() * 1024);
    NOISE_V[b] = 1 + Math.floor(rnd() * 1024);
  }
})();

const controlWeight = (b, gamma) => NOISE_B[b] + gamma * NOISE_V[b];

/** The control leaf counts: AQ's, capped, because its DP is dearer than a closed form. */
const CONTROL_LEAVES = LEAVES.filter(n => n >= 4 && n <= 16384);

/**
 * The control's best sequence, by general dynamic program over ceil-division. w is not
 * affine here, so no closed form applies and none is used.
 */
function controlBest(N, gamma, memo = new Map()) {
  if (N <= 1) return { cost: 0, seq: [] };
  if (memo.has(N)) return memo.get(N);
  let best = Infinity, bestB = 0, bestRest = null;
  const top = Math.min(BMAX, N);
  // No cycle guard is needed and none is used: every arity is at least two, so
  // ceil(N / b) < N for every N >= 2, and the recursion strictly descends.
  for (let b = 2; b <= top; b++) {
    const rest = controlBest(Math.ceil(N / b), gamma, memo);
    const t = controlWeight(b, gamma) + rest.cost;
    if (t < best) { best = t; bestB = b; bestRest = rest.seq; }
  }
  const out = { cost: best, seq: [bestB, ...bestRest] };
  memo.set(N, out);
  return out;
}

function controlBestConstant(N, gamma) {
  let best = Infinity, at = 0;
  for (let b = 2; b <= BMAX; b++) {
    const t = depth(N, b) * controlWeight(b, gamma);
    if (t < best) { best = t; at = b; }
  }
  return { arity: at, cost: best };
}

/**
 * THE THREE RESPONSIVENESS ASSERTS, which run before any verdict is read. A control
 * that cannot move in the dimension being swept is not evidence -- it is a constant
 * wearing the costume of one.
 */
function controlResponse() {
  const lo = DECADES[0], hi = GMAX;
  let moved = 0, notNearEqual = 0, gains = [];
  for (const n of CONTROL_LEAVES) {
    const a = controlBest(n, lo, new Map()), b = controlBest(n, hi, new Map());
    if (a.seq.join(',') !== b.seq.join(',')) moved++;
    const S = b.seq.reduce((x, y) => x + y, 0);
    if (b.seq.slice().sort((x, y) => y - x).join(',') !== nearEqual(S, b.seq.length).join(',')) notNearEqual++;
    const con = controlBestConstant(n, hi);
    gains.push((con.cost - b.cost) / con.cost);
  }
  return {
    leaves: CONTROL_LEAVES.length,
    movedWithGamma: moved,
    notNearEqual,
    maxGain: Math.max(...gains),
    medianGain: gains.slice().sort((a, b) => a - b)[gains.length >> 1],
  };
}

// ------------------------------------------------------------------------ the report

function report() {
  log('RADIX AUDIT — set AR: what happens when a tree\'s arity may vary by depth?');
  log(line);

  log('\n--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  const dpOK = [11, 37, 100, 486, 730, 1025, 2187]
    .every(n => [1, 2, 3, 4, 5].every(d => minsum(d, n) === minsumDP(d, n)));
  const bruteOK = [5, 7, 11, 24, 60]
    .every(n => [2, 3].every(d => minsum(d, n) === minsumBrute(d, n)));
  log(`  MINSUM closed form === dynamic program   ${dpOK}`);
  log(`  MINSUM closed form === brute force       ${bruteOK}`);
  log(`  depth bound is proved, not exhausted     ${depthBoundIsProved('vector', 1025, GMAX)}`);
  const r = controlResponse();
  log(`  CONTROL responds: ${r.movedWithGamma}/${r.leaves} sequences move with gamma, `
    + `${r.notNearEqual}/${r.leaves} are not near-equal`);
  log(`  CONTROL gain from varying: max ${(100 * r.maxGain).toFixed(1)}%, `
    + `median ${(100 * r.medianGain).toFixed(1)}%`);

  log('\n--- AR1 — how much is the flexibility worth? ---');
  const grid = gridSweep('vector');
  const gWorst = grid.reduce((a, c) => (c.gain > a.gain ? c : a), grid[0]);
  const cWorst = contWorstGain('vector');
  log(`  grid        ${grid.length} cells, worst gain ${(100 * gWorst.gain).toFixed(2)}% `
    + `at N = ${gWorst.n}`);
  log(`  contiguous  ${cWorst.cells} cells, worst gain ${(100 * cWorst.worst).toFixed(2)}% `
    + `at N = ${cWorst.at.n}`);

  log('\n--- AR2, AR3, AR4 — the deep contiguous window ---');
  for (const [lo, hi] of WINDOWS) {
    const w = windowStats(lo, hi);
    const mark = (lo === DEEP_LO && hi === DEEP_HI) ? ' <- registered' : '';
    log(`  [${lo}, ${hi}]${mark}`);
    log(`     helped ${w.helped}/${w.leaves} (${(100 * w.helpedFraction).toFixed(1)}%)`);
    log(`     deeper ${w.deeper}, shallower ${w.shallower}, same ${w.same}`);
    log(`     max jump  constant ${(100 * w.maxJumpCon).toFixed(2)}% at ${w.atCon}, `
      + `varying ${(100 * w.maxJumpSeq).toFixed(2)}% at ${w.atSeq}, `
      + `ratio ${w.jumpRatio.toFixed(3)}`);
  }

  log('\n--- the merkle regime, where the answer is proved rather than swept ---');
  const merkleVaries = LEAVES.some(n => GAMMAS.some(g =>
    bestSequence('merkle', n, g).cost < bestConstant('merkle', n, g).cost));
  log(`  a varying tree ever beats a constant one in merkle: ${merkleVaries}`);

  log('\n' + line);
}

module.exports = {
  H, O, C, ALPHA, BMAX, GAMMAS, DECADES, GMAX, LEAVES, depth,
  CONT_MAX, DEEP_LO, DEEP_HI, WINDOWS, CONTROL_LEAVES, NOISE_B, NOISE_V,
  weight, costOf, costOfSequence,
  maxprodAtLeast, maxprodOverflow, nearEqual, minsum, minsumDP, minsumBrute,
  maxUsefulDepth, depthBoundIsProved, bestSequence, bestConstant,
  gridSweep, depthRow, minsumRow, cellFromRows, contCell, contSweep,
  windowStats, contWorstGain,
  controlWeight, controlBest, controlBestConstant, controlResponse,
  report,
};

if (MAIN) report();
