'use strict';
/* BRANCHING AUDIT — how wide should an authenticated tree be, and does three ever win?
 *
 * Set `AQ`. Not to be confused with `AI`, whose `tools/arity-audit.js` climbs the
 * INPUT arity of a function, n -> n+1. This is the BRANCHING factor of a tree.
 *
 * WHY THIS SET EXISTS
 * -------------------
 * The Verkle direction wants an authenticated tree whose proofs stay small as the
 * ledger grows. The published constructions settled on 256-ary nodes, and the question
 * put to this project was whether it has to be 256 -- and whether a machine whose
 * natural ladder is 3, 9, 27, 81, 243, 729 ought to branch by powers of three instead.
 *
 * `bitblock`'s authenticated-state plan will not accept an answer from outside itself:
 * a Verkle candidate is admitted only after a `VectorCommitmentProfileDescriptorV1`
 * freezes the scheme, arity, curve, proof sizes, and whether a trusted setup exists,
 * and that plan states plainly that outside parameters and measurements are research
 * INPUTS and not its evidence. This set produces such an input, under this project's
 * own discipline, so that the arity line of a future descriptor has a measured sweep
 * behind it rather than an inherited constant.
 *
 * ------------------------------------------------------------------------------
 * WHAT THIS IS NOT
 *
 * This measures a COST MODEL. It says nothing about whether any of these trees is
 * secure, and nothing about whether one can be built on this substrate --
 * `F-REVERSIBLE-CANNOT-DESTROY` already settled that a machine made of bijections
 * cannot destroy a secret, so a ceremony is not merely unperformed here but
 * INEXPRESSIBLE, and every setup-requiring commitment is out before arity is even
 * asked. The shape modelled below is therefore the ceremony-free one: a per-level
 * opening whose SIZE does not grow with the branching factor, and a per-level VERIFY
 * that does.
 *
 * A cost model is program-relative in exactly the sense `N-program-relative` names.
 * The optimum found here is the optimum OF THIS MODEL. A different opening scheme is
 * a different model, and nothing in this set bounds it.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION
 *
 * Everything in this block is fixed before the run and none of it is at risk. It is
 * written down so that what IS at risk is unambiguous.
 *
 * THE TREE. `N` leaves, branching factor `b`, depth `d = ceil(log_b N)`. The depth is
 * a CEILING, and that is the whole reason this set exists: a step function is where
 * this project has twice been surprised -- at `AL4`, and at
 * `F-LAMPORT-BASE-ADVANTAGE-IS-NOT-PER-SIZE`, where three beats two by 5.4 percent
 * asymptotically and still loses at 256 and at 1024. An asymptotic argument does not
 * settle a particular width.
 *
 * THE THREE REGIMES.
 *
 *   merkle    the proof carries b-1 sibling hashes at every level
 *               bytes  = d * (b - 1) * H
 *               verify = d * (b - 1)                       compressions
 *
 *   vector    the proof carries one constant-size opening per level, and verifying a
 *             level must combine that level's b children
 *               bytes  = d * O + C
 *               verify = d * (ALPHA + b)                   child-operations
 *
 *   control   a per-level cost that is a fixed pseudorandom function of b, carrying no
 *             structure at all
 *
 * H = O = C = 32 bytes, the sizes a 256-bit primitive gives; ALPHA = 1. Changing them
 * scales the regimes together and cannot by itself move an argmin.
 *
 * GAMMA is the exchange rate: how many bytes of bandwidth one verify-operation is
 * worth. It is the only parameter that can move an optimum, so it is NOT chosen -- it
 * is SWEPT across eight decades, and every claim below is a claim about the whole
 * sweep rather than about a picked value.
 *
 *     total(b, N, gamma) = bytes(b, N) + gamma * verify(b, N)
 *
 * ARITIES. Every integer from 2 to 1024, so no width is cherry-picked and the powers
 * of two and three are scored against all their neighbours rather than only against
 * each other. Ten powers of two are in range and only six powers of three, which is a
 * handicap `AQ2` has to overcome rather than a fact it may lean on.
 *
 * LEAF COUNTS. 3^k and 2^k for k up to 20, plus decimal round numbers, so ceiling
 * effects are visible where they actually bite and not only at tidy sizes.
 *
 * THE CONTROL IS THE INSTRUMENT'S OWN CHECK. If the noise regime also reports a clean
 * interior optimum that moves smoothly with gamma, then this sweep is describing the
 * shape of its own arithmetic rather than the shape of the trees, and every number
 * here is an artifact. `T-INSTRUMENT-FALSE-VERDICT` has bitten seventeen times and
 * every single catch came from a second measurement disagreeing with the first.
 *
 * TWO THINGS ARE FORCED BY CONSTRUCTION and are therefore not registered. In the
 * merkle regime the per-level cost rises linearly in b while depth falls only as
 * 1/log b, so b = 2 minimises it in the continuous limit; that is calculus, not a
 * finding. And in the vector regime at gamma = 0 the size falls monotonically in b, so
 * the widest arity wins; that is the definition of the regime. What is at risk is
 * everything BETWEEN those two ends, and what the ceiling does to the boundary.
 *
 * ------------------------------------------------------------------------------
 * REGISTERED PREDICTIONS. Committed before the run, in a commit containing no
 * measurement.
 *
 *   AQ1  BINARY IS NEVER OPTIMAL FOR A VECTOR COMMITMENT, AND THE FLOOR IS THREE OR
 *        FOUR. Predicted that in the vector regime no cell in the sweep has argmin
 *        b = 2, and that as gamma grows the optimum does not descend past 3 -- the
 *        continuous stationary condition is b(ln b - 1) = 1 + H/gamma, whose right
 *        side tends to 1 and whose root tends to about 3.6, so the surviving integers
 *        are 3 and 4. Predicted further that across the swept leaf counts, THREE is
 *        the large-gamma optimum more often than four.
 *        AT RISK: the first half leans on a continuous argument and this set exists
 *        because ceilings break those. depth(N, 2) can fall well below the smooth law
 *        at particular N, and one cell with argmin 2 refutes it. The second half --
 *        which of 3 and 4 wins more leaf counts -- I cannot call at all.
 *
 *   AQ2  A POWER OF THREE IS THE ARGMIN IN MORE CELLS THAN A POWER OF TWO. Counting
 *        (leaf count, gamma) cells in the vector regime whose argmin is a power of
 *        three against those whose argmin is a power of two, predicted three takes
 *        strictly more.
 *        AT RISK: entirely, and the arithmetic starts against it. Ten powers of two
 *        sit in 2..1024 and only six powers of three, so the geometry has to overcome
 *        a handicap of almost two to one.
 *
 *   AQ3  UNIT INVARIANCE FAILS. Recomputing every cost in whole TRYTES rather than
 *        whole bytes -- one tryte being six trits, log2(729) = 9.5098 bits, so a
 *        32-byte hash is 26.92 and therefore 27 trytes -- predicted to move AT LEAST
 *        ONE argmin in the vector regime.
 *        AT RISK, and deliberately against the obvious answer: a unit is a scale
 *        factor and a scale factor cannot move an argmin. The escape is that a proof
 *        travels in whole units, so rounding each term up reintroduces a ceiling, and
 *        near-ties between adjacent arities are common enough that one should flip.
 *        If this fails, the unit is free and that is worth knowing too.
 *
 *   AQ4  SIXTY-FOUR AND TWO HUNDRED AND FIFTY-SIX ARE THE SAME CHOICE. Predicted that
 *        at every vector-regime cell where either arity is within 15% of that cell's
 *        optimum, the totals at b = 64 and b = 256 differ by no more than 15%.
 *        AT RISK: this is the question that was actually asked, and 15% is a number
 *        picked before looking -- wide enough to be interesting, narrow enough to
 *        fail.
 *
 * ------------------------------------------------------------------------------
 *     node tools/branching-audit.js
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };

/** Design constants: the sizes a 256-bit primitive gives. See the header. */
const H = 32, O = 32, C = 32, ALPHA = 1;
const BITS_PER_TRYTE = Math.log2(729);           // 9.5098..., six trits
const BYTES_PER_TRYTE = BITS_PER_TRYTE / 8;

const B_MIN = 2, B_MAX = 1024;
const ARITIES = Array.from({ length: B_MAX - B_MIN + 1 }, (_, i) => i + B_MIN);
const isPow2 = b => (b & (b - 1)) === 0;
const isPow3 = b => { let x = b; while (x % 3 === 0) x /= 3; return x === 1; };
const POW2 = ARITIES.filter(isPow2);
const POW3 = ARITIES.filter(isPow3);

/** Eight decades, eight samples per decade. Swept, not chosen. */
const GAMMAS = (() => {
  const g = [];
  for (let e = -4; e < 4; e++) for (let s = 0; s < 8; s++) g.push(10 ** (e + s / 8));
  return g;
})();

const LEAVES = (() => {
  const s = new Set();
  for (let k = 1; k <= 20; k++) { s.add(3 ** k); s.add(2 ** k); }
  for (const n of [10, 100, 1000, 1e4, 1e5, 1e6, 1e7, 1e8]) s.add(n);
  return [...s].filter(n => n >= 3 && n <= 1e9).sort((a, b) => a - b);
})();

/**
 * Depth as a CEILING, by repeated multiplication, because no logarithm is trustworthy
 * at an exact power. `Math.log(729) / Math.log(3)` is 6.0000000000000009 on this
 * machine, and a ceil of that cost set `AP` a whole key position -- in the direction
 * that flattered binary. Nothing here divides logarithms.
 */
function depth(n, b) {
  let d = 0, reach = 1;
  while (reach < n) { reach *= b; d++; }
  return d;
}

/** depth(n, b) for every swept pair, computed once. */
const DEPTH = (() => {
  const t = new Map();
  for (const n of LEAVES) { const row = new Int32Array(B_MAX + 1); for (const b of ARITIES) row[b] = depth(n, b); t.set(n, row); }
  return t;
})();

/** The control's per-level cost: fixed, deterministic, structureless. */
const NOISE = (() => {
  let s = 20260827;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const t = new Int32Array(B_MAX + 1);
  for (const b of ARITIES) t[b] = 1 + Math.floor(rnd() * 1024);
  return t;
})();

const REGIMES = {
  merkle: (d, b) => ({ bytes: d * (b - 1) * H, verify: d * (b - 1) }),
  vector: (d, b) => ({ bytes: d * O + C, verify: d * (ALPHA + b) }),
  control: (d, b) => ({ bytes: d * NOISE[b], verify: d * NOISE[b] }),
};

/**
 * Total cost of one arity at one leaf count and one exchange rate. In BYTES by
 * default; in whole TRYTES when asked, each term rounded UP, because a proof travels
 * in whole units and that rounding is the only way a unit change can do what a bare
 * scale factor cannot.
 */
function total(regime, n, b, gamma, trytes) {
  const d = DEPTH.get(n)[b];
  const { bytes, verify } = REGIMES[regime](d, b);
  if (!trytes) return bytes + gamma * verify;
  return Math.ceil(bytes / BYTES_PER_TRYTE) + gamma * Math.ceil(verify / BYTES_PER_TRYTE);
}

/**
 * The cheapest arity at one cell, and the cost there. Ties go to the SMALLER arity --
 * stated because a tie-break is a decision, and an undocumented decision is a hidden
 * parameter that could carry a verdict on its own.
 */
function argmin(regime, n, gamma, trytes) {
  let best = Infinity, at = 0;
  for (const b of ARITIES) {
    const t = total(regime, n, b, gamma, trytes);
    if (t < best) { best = t; at = b; }
  }
  return { arity: at, cost: best };
}

/** Every leaf count against every exchange rate, for one regime. */
function sweep(regime, trytes = false) {
  const cells = [];
  for (const n of LEAVES) for (const gamma of GAMMAS) cells.push({ n, gamma, ...argmin(regime, n, gamma, trytes) });
  return cells;
}

/** How many cells each family of arities wins, and how smoothly the optimum moves. */
function profile(cells) {
  const pow2 = cells.filter(c => isPow2(c.arity)).length;
  const pow3 = cells.filter(c => isPow3(c.arity)).length;
  const byLeaf = new Map();
  for (const c of cells) { if (!byLeaf.has(c.n)) byLeaf.set(c.n, []); byLeaf.get(c.n).push(c); }
  // A backward step is an optimum that RISES as verifying gets dearer. The smooth law
  // forbids it; a ceiling does not, which is exactly what AQ1 puts at risk.
  let backwardSteps = 0;
  for (const row of byLeaf.values()) {
    const sorted = row.slice().sort((a, b) => a.gamma - b.gamma);
    for (let i = 1; i < sorted.length; i++) if (sorted[i].arity > sorted[i - 1].arity) backwardSteps++;
  }
  const arities = [...new Set(cells.map(c => c.arity))].sort((a, b) => a - b);
  return {
    cells: cells.length, pow2, pow3, backwardSteps,
    distinctArities: arities.length, minArity: arities[0], maxArity: arities[arities.length - 1],
    everBinary: cells.some(c => c.arity === 2),
  };
}

module.exports = {
  H, O, C, ALPHA, BITS_PER_TRYTE, BYTES_PER_TRYTE,
  ARITIES, POW2, POW3, GAMMAS, LEAVES, NOISE, REGIMES, DEPTH,
  isPow2, isPow3, depth, total, argmin, sweep, profile,
};

if (MAIN) {
  log('BRANCHING AUDIT — set AQ, registered before it was run.\n');
  log(`  arities   ${ARITIES.length} (2..1024) — ${POW2.length} powers of two, ${POW3.length} powers of three`);
  log(`  gammas    ${GAMMAS.length} across eight decades, swept and not chosen`);
  log(`  leaves    ${LEAVES.length} counts, 3^k and 2^k up to k = 20`);
  log(`  cells     ${(LEAVES.length * GAMMAS.length).toLocaleString('en-US')} per regime\n`);
  log('  This file prints no results at registration time. The measurement lives in');
  log('  test/test-branching.js and lands in the results commit, after this one is');
  log('  pushed — which is the only part of the ceremony a later edit cannot fake.');
}
