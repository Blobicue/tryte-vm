'use strict';
/* FORGE AUDIT — attacking the ledger head, instead of counting collisions against it.
 *
 * Set `AS`. `tools/ledger-audit.js` measured two accumulators over one six-entry
 * ledger and reported that the summed head accepts all 21,840 compensating forgeries
 * while `D`'s split-round mixer accepts 26, against a chance rate of 29.96. That file
 * says in its own header what it does NOT measure: `AN2` found this mixer's
 * feed-forward collapses to `P(m + n) - n = g(m + n) + m`, so the chain step is
 * `g(a + e) + a` with the accumulator fed forward rather than the entry, and whether
 * that residual structure gives a forger anything over the chance rate was left open.
 *
 * IT HAS BEEN OPEN SINCE THE LEDGER WAS BUILT, AND 26 AGAINST 30 IS AN UNEXAMINED
 * NUMBER A DESIGN IS RESTING ON. A brute-force sweep is not an attack; it is what
 * produced the 26. This set designs attacks, prices them, and asks whether any of them
 * beats chance.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * Everything in this section is fixed before the run, is derivable on paper, or is a
 * null model computed before the registration. None of it is at risk. It is written
 * down so that what IS at risk is unambiguous, and every derived identity below is
 * ALSO checked exhaustively by the tool rather than trusted — `T-TRANSCRIBED-TABLE`.
 *
 * TWO GROUPS, AND THEY ARE NOT THE SAME GROUP. This is the single most important
 * structural fact in the file and it decides how every attack is scored.
 *
 *   - The LEDGER's conservation law is ARITHMETIC: `headSum` adds entries with carries,
 *     wrapped into one tryte. A compensating forgery preserves that total.
 *   - The MIXER's algebra is TRITWISE GF(3)^6: `tadd`, `tsub`, and `g`.
 *
 * A delta `d` applied arithmetically to an entry induces a tritwise difference that
 * equals `d` only when the addition carries nowhere. That mismatch is a real obstacle
 * to a forger and it is not a property of the mixer.
 *
 * THE CHAIN, IN THE ONLY FORM WORTH ATTACKING. With `g(u) = P(u) - u` (`AN`'s
 * `gShift`), the step `a' = P(a + e) - e` is exactly
 *
 *      a_k = a_{k-1} + g(a_{k-1} + e_k)                                        (D1)
 *
 * Substituting `u_k = a_{k-1} + e_k` — a TRIANGULAR change of variable, invertible in
 * both directions because `a_{k-1}` is determined by `u_1..u_{k-1}` — gives
 *
 *      head = g(u_1) + g(u_2) + ... + g(u_L)                                   (D2)
 *
 * so the mixer's head is a COMMUTATIVE SUM of `g`-values over a reparametrisation of
 * the entries. That is the residual of `AN2`'s collapse in the ledger direction: the
 * entry does not commute out, but the chain still linearises into a sum once you look
 * at it in `u`.
 *
 * `P` IS A PERMUTATION, so `a -> P(a + e) - e` is a BIJECTION IN THE ACCUMULATOR for
 * every fixed entry. Composing bijections, the map from any intermediate accumulator to
 * the head is a bijection, so for a forgery that touches entries at positions `i` and
 * `j` and nothing after `m = max(i, j)`:
 *
 *      head' = head   <=>   a'_{m+1} = a_{m+1}                                 (D3)
 *
 * A forger never has to evaluate the tail, and every accepted forgery is an internal
 * collision at the merge point. Both directions of D3 are checked exhaustively.
 *
 * THE SWEEP THE 26 CAME FROM COUNTS EACH FORGERY TWICE. `forge(E, i, j, d)` and
 * `forge(E, j, i, -d)` produce the same forged ledger, so the 21,840 ordered tries are
 * 10,920 distinct forgeries and the 26 accepts are 13. Ratios are unaffected — 29.96 is
 * double-counted the same way — but the DISPERSION is not, and a Poisson claim written
 * over the doubled count would predict a variance-to-mean ratio of 2 for a process that
 * is perfectly Poisson. Every count below is over DISTINCT forgeries: 15 unordered
 * position pairs times 728 non-zero deltas = 10,920, chance 10,920 / 729 = 14.979.
 *
 * THE COST MODEL, STATED BEFORE ANY ATTACK RUNS. One OP is one lookup into a
 * precomputed table (the 531,441-entry `STEP`, its inverse `BACK`, the 729-entry `G`,
 * the 531,441-entry differential table) or one index arithmetic operation. Evaluating
 * a candidate forgery by brute force costs one op per chain step from the earliest
 * modified position to the merge point. PRECOMPUTATION IS CHARGED SEPARATELY AND
 * REPORTED, never amortised silently — `AD2`'s tabulator was scored wrongly once by
 * hiding exactly that. Memory is charged in table slots. A forger who can hold 531,441
 * slots is assumed, because the state is one tryte and a 531,441-slot table is the size
 * of the state space squared.
 *
 * THE FOUR ATTACKS, all of them designed rather than swept:
 *
 *   1. MERGE-POINT TRUNCATION (D3). Free, and used by every sweep here.
 *   2. THE CROSS-LEDGER CENSUS. 26 is one ledger. `T-CLAIM-NARROWED-BY-A-DESIGN` has
 *      bitten twice by stating a property of one design as a property of the subject,
 *      so the family is swept over 2,000 independently drawn ledgers.
 *   3. DIFFERENTIAL CRYPTANALYSIS OF `g`. For an adjacent position pair the accept
 *      condition reduces exactly to a two-round differential: with `A` the change the
 *      first edited entry makes to the accumulator and `t` the tritwise input difference
 *      it induces at the second, the forgery is accepted if and only if `g` realises
 *      `t -> -A` at that ledger's own `u`. So the forger can rank deltas by the
 *      differential table of `g` before spending anything on the chain.
 *   4. MEET IN THE MIDDLE. Entries 1, 2 and 5, 6 are modified; entries 3 and 4 are not.
 *      The left half is pushed forward to the accumulator after entry 4 and the right
 *      half is pulled BACKWARDS from the head through `BACK`, which exists because of
 *      D3. Both halves are keyed on (accumulator, arithmetic partial sum) and joined.
 *      Each half enumerates 729^2 = 531,441 rows into 531,441 keys, so the IDEAL yield
 *      of the join is 531,441 forgeries.
 *
 * THE NULL MODELS, computed before this commit because a null model is arithmetic.
 * Accepts per ledger over the distinct compensating family are Binomial(10,920, 1/729),
 * mean 14.979 and sd 3.870, which at this rate is Poisson to three figures. Over 2,000
 * ledgers the sd of the mean is 0.087 and the sd of the variance-to-mean ratio is about
 * 0.035. For a random function on 729 points the differential table's cells are
 * Poisson(1), so about 36.8% of them are empty, and the maximum over the 728 x 729 =
 * 530,712 cells sits at 9 to 11. Ordering 728 candidates uniformly at random, the
 * expected rank of the first accept given `k` accepts is 729 / (k + 1).
 *
 * THE RANDOMNESS. `T-FAKE-RANDOM`: a seeded generator here once multiplied a 31-bit
 * seed by a 31-bit constant and returned rounding noise. This uses mulberry32 with all
 * arithmetic forced through `>>> 0`, seed 20260828, and the tool asserts the draw
 * actually visited every one of the 729 entry values before any verdict is read.
 *
 * THE CONTROLS, and each one is asserted to MOVE before its verdict is read, because
 * `T-CONTROL-CANNOT-DISCRIMINATE` has bitten twice and the fix for the first bite was
 * not enough for the second. The summed head runs the census beside the mixer and must
 * accept 10,920 of 10,920 on every ledger it is run over. The differential statistic is
 * run against a fresh random permutation AND against the affine map `A` of set `AN`,
 * whose `g` is the linear `rot^2` and whose table must therefore max out at 729. The
 * meet-in-the-middle ratio is run against a chain built on a fresh random permutation
 * and against a synthetic degenerate join whose two halves are identical, which must
 * return exactly 2. The delta-ordering statistic is reported against a uniform order,
 * against a perfect oracle and against an anti-oracle, so its span is on the record
 * rather than assumed.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AS1 THE 26 IS A FACT ABOUT THE MIXER AND NOT ABOUT ONE LEDGER, AND THERE IS NO
 *       WEAK LEDGER CLASS. Over 2,000 independently drawn six-entry ledgers, swept
 *       exhaustively over all 10,920 distinct compensating forgeries each, predicted:
 *       the mean accept count lands within 0.6 of the chance value 14.979; the
 *       variance-to-mean ratio lands in [0.80, 1.25]; and no single ledger of the 2,000
 *       accepts more than 40. The alternative is registered: a ratio above 1.25 or any
 *       ledger past 40 means the accept rate is a property of the ledger rather than of
 *       the accumulator, and some ledgers are structurally cheap to forge.
 *       AT RISK: it comes out the other way if the chain's non-flatness reaches the
 *       forgery neighbourhood. `F-MIXER-HEAD-IS-NOT-FLAT` measured this same chain
 *       running 629 to 851 preimages against a flat 729 at length two — a spread of
 *       about 17% — and if a six-entry ledger's accept rate inherits a spread of that
 *       size then the per-ledger rate is 1/729 times (1 + e) with e of order 0.17, the
 *       variance-to-mean ratio is 1 + 15 x 0.17^2 = 1.43 rather than 1, and the line at
 *       1.25 fails. The evidence I have pointing the other way is one ledger: 13
 *       distinct accepts against 14.979, which is 0.5 sd low and tells me nothing about
 *       dispersion, since a single draw has no dispersion. The line at 40 is placed
 *       where noise cannot reach it — Poisson(14.979) puts under one ledger in four
 *       million there — so it can only fire on a real class of weak ledgers.
 *       CANNOT SHOW: 2,000 ledgers of ONE length, six, and one forgery family, the two
 *       edited entries the published sweep uses. Nothing here speaks to longer ledgers
 *       or to families where more than two entries move; `AS3` is the only thing in this
 *       set that does.
 *
 *   AS2 THERE IS NO STRONG DIFFERENTIAL IN THE RESIDUAL ALGEBRA. Predicted that the
 *       differential table of `g` over GF(3)^6, taken over all 728 non-zero input
 *       differences and all 729 output differences, has a maximum cell of at most 27:
 *       no input-to-output difference through `g` holds with probability better than
 *       1/27. Predicted alongside, and not as part of the claim, that the empty-cell
 *       fraction sits near a random function's 36.8%.
 *       AT RISK: the split round is a Feistel over Z27 x Z27 — (lo, hi) becomes (hi, lo
 *       + S[hi]) mod 27 — and in THAT group it has a two-round characteristic that holds
 *       with probability one, since an input difference confined to `lo` leaves `hi`
 *       untouched, so the S-box is never active and the difference merely swaps halves.
 *       Eight rounds contain four such windows. If that characteristic survives into the
 *       tritwise metric this table maxes out in the hundreds and the prediction fails by
 *       an order of magnitude. What I have pointing the other way is that the round's
 *       addition is mod 27 while the difference here is measured digit-wise mod 3, so a
 *       fixed tritwise difference does not even correspond to a fixed mod-27 difference,
 *       and a random function's maximum over 530,712 cells is only about 10. I cannot
 *       settle which effect wins without running it; the line at 27 is placed at one
 *       active S-box's worth of probability, well above the random maximum and well
 *       below what one surviving free round would produce, so neither outcome is noise.
 *       CANNOT SHOW: a bound on ONE table's maximum cell is not a bound on a multi-round
 *       characteristic. Two rounds chained can beat the product of two cells, and nothing
 *       in this set searches for characteristics — it reads one table.
 *
 *   AS3 THE MEET-IN-THE-MIDDLE JOIN DOES NOT BEAT ITS OWN IDEAL YIELD. Predicted the
 *       four-position join returns between 0.97 and 1.10 times the ideal 531,441
 *       forgeries, on the canonical ledger and on every one of eight independently drawn
 *       ones. The forger gets what an unstructured accumulator of the same width would
 *       have given and no more, so the non-flatness `F-MIXER-HEAD-IS-NOT-FLAT` found is
 *       not cashable here.
 *       AT RISK: both halves of the join are images of the same `g` — the left is a
 *       four-step push forward and the right a two-step pull backward — and the key
 *       counts average exactly one per key, so this is a join of two sparse tables. If
 *       their reachable key sets coincide rather than being independent, the join
 *       returns the sum of squared counts rather than the product of means, which for
 *       counts distributed Poisson(1) is 2.0 times ideal, not 1.0. That is a factor of
 *       two in a forger's yield sitting on whether two derived distributions are
 *       correlated, and I have nothing on paper that settles it: the argument for
 *       independence is that the left key's second coordinate is an arithmetic partial
 *       sum which is exactly flat and carries no `g` structure at all, and the argument
 *       against is that both accumulator coordinates are sums of `g`-values over the
 *       same 729-point image. A ratio below 0.97 refutes it in the other direction and
 *       would mean the two halves ANTI-correlate, which would be a stronger structural
 *       finding than the prediction.
 *       CANNOT SHOW: one SPLIT of one length. Entries 1, 2 and 5, 6 are modified and the
 *       join meets after entry 4; a different split, or a longer ledger, is a different
 *       pair of distributions and is not swept.
 *
 *   AS4 ORDERING DELTAS BY THE DIFFERENTIAL TABLE MORE THAN HALVES THE FORGER'S TRIALS.
 *       Over the same 2,000 ledgers, restricted to the five adjacent position pairs and
 *       to cases where at least one of the 728 deltas is accepted, predicted that the
 *       mean rank of the first accepted delta under a differential-table-descending
 *       order, with ties broken uniformly, is less than 0.5 times the mean rank under a
 *       uniformly random order. So the residual algebra buys a forger a real cut in
 *       trials on this family, even though `AS1` says it buys no rate.
 *       AT RISK: the exclusion of empty cells alone caps the gain at 0.63, because
 *       about 36.8% of cells are empty for a random function and a delta whose cell is
 *       empty cannot be accepted at all. Everything below 0.63 has to come from the
 *       table's TAIL being heavy enough that the top-ranked cells carry a share of the
 *       accepts far above their share of the deltas — for Poisson(1) cells the 8% of
 *       cells holding 3 or more carry 26.4% of the mass, which lands the ratio near 0.30
 *       and holds. If instead `g`'s table is FLATTER than a random function's, the
 *       ordering degenerates to the empty-cell filter and the ratio lands at 0.63 and
 *       this fails. That is not hypothetical: `AN1` registered this same mixer's hit
 *       variance as binomial and it came in LOW at two difficulties — more uniform than
 *       chance — which is the exact direction that refutes this. I am registering
 *       against that observation.
 *       CANNOT SHOW: ADJACENT position pairs only. A non-adjacent pair needs a
 *       characteristic across the entries between them, which is a different and harder
 *       object, and this set does not build it.
 * ------------------------------------------------------------------------------
 * NOT REGISTERED, because each is derivable from the construction above before the run
 * and a fact that was never at risk cannot fail. All are checked anyway, and the
 * checking is the point: D1, D2 and D3 are the identities every attack here rests on,
 * the double-count is what makes the dispersion claim well-formed, and the cost per
 * forgery follows from `AS3` and the op counts once both are in hand.
 *
 *   - D1, D2, D3 and the exact 2x double count of the published sweep.
 *   - The cost a forger pays per accepted forgery, for each attack, against a measured
 *     brute-force baseline. Derived from `AS3`'s yield and the stated cost model.
 *   - That the empty cells of the differential table exclude deltas for free.
 *   - Partitions of the compensating family by merge distance and by whether the
 *     arithmetic delta carried, reported as rates so that a reader can see which
 *     structural cuts were looked at and which were not.
 * ------------------------------------------------------------------------------
 * Run:  npm run audit:forge          FORGE_LEDGERS=25 npm run audit:forge   (capped)
 */

const Q = require('./puzzle-audit.js');
const LED = require('./ledger-audit.js');

const { N, W, idx, val, tadd, tsub, gShift } = Q;
const { STEP, LEDGER, headHash, forge, wrap } = LED;

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

/** How many ledgers the cross-ledger census draws. Capped for the suite's spawn check. */
const LEDGERS = Number(process.env.FORGE_LEDGERS || 2000);
const SEED = 20260828;
/** Distinct compensating forgeries of a six-entry ledger, and the chance rate. */
const PAIRS = 15, DELTAS = N - 1, FAMILY = PAIRS * DELTAS;
const CHANCE = FAMILY / N;

// ---------------------------------------------------------------- index-space algebra
/**
 * Everything below runs in INDEX space, 0..728. `CANDIDATES.feedforward` takes VALUES
 * and returns an INDEX and that asymmetry has produced a false verdict twice in this
 * corpus, so the conversion happens once, here, and never inside a sweep.
 */
const OFF = -val(0);                          // 364: idx(v) = v + OFF
const ZERO = idx(0);                          // the tritwise identity, at index OFF

const TADD = (() => {
  const t = new Int16Array(N * N);
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) t[a * N + b] = idx(tadd(val(a), val(b)));
  return t;
})();
const TSUB = (() => {
  const t = new Int16Array(N * N);
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) t[a * N + b] = idx(tsub(val(a), val(b)));
  return t;
})();

/** g in index space: G[u] = idx(P(val(u)) - val(u)), the residual `AN2` exposed. */
const G = Int16Array.from({ length: N }, (_, u) => idx(gShift(val(u))));

/** The chain step read backwards: BACK[a' * N + e] is the accumulator a' came from. */
const BACK = (() => {
  const t = new Int16Array(N * N).fill(-1);
  for (let a = 0; a < N; a++) for (let e = 0; e < N; e++) t[STEP[a * N + e] * N + e] = a;
  return t;
})();

/** ARITHMETIC add and subtract of two entry INDICES: carrying, wrapped to one tryte. */
const asum = (a, b) => (a + b - OFF + N) % N;
const asub = (a, b) => ((a - b + OFF) % N + N) % N;
/** An arithmetic delta d, 1..728, applied to an entry index. */
const adel = (a, d) => (a + d) % N;
/** The same delta as a tritwise element, so a carry can be detected by comparison. */
const dIdx = d => (d + OFF) % N;
const negIdx = d => (N - d + OFF) % N;

// ---------------------------------------------------------------- the generator
/** mulberry32. Every step forced through >>> 0: T-FAKE-RANDOM was a 31-bit overflow. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t) >>> 0;
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (r, n) => Math.min(n - 1, Math.floor(r() * n));
/** A drawn ledger, as six entry INDICES. */
const drawLedger = r => [randInt(r, N), randInt(r, N), randInt(r, N),
  randInt(r, N), randInt(r, N), randInt(r, N)];

// ---------------------------------------------------------------- chains
/** acc[0] = 0; acc[k] is the mixer head of the first k entries. */
function accums(e) {
  const a = new Array(e.length + 1);
  a[0] = idx(0);
  for (let k = 0; k < e.length; k++) a[k + 1] = STEP[a[k] * N + e[k]];
  return a;
}
const headIx = e => accums(e)[e.length];
/** The arithmetic total, which is the summed head in index space. */
const totalIx = e => e.reduce((s, x) => asum(s, x), idx(0));

// ------------------------------------------------------- the derived identities (D1-D3)
/** D1: the step is a + g(a + e), exhaustively over all 531,441 (a, e). */
function checkStepIsGShift() {
  for (let a = 0; a < N; a++) for (let e = 0; e < N; e++) {
    if (STEP[a * N + e] !== TADD[a * N + G[TADD[a * N + e]]]) return false;
  }
  return true;
}
/** What D3 rests on: every step is a bijection in the accumulator, for every entry. */
function checkStepBijective() {
  const seen = new Uint8Array(N);
  for (let e = 0; e < N; e++) {
    seen.fill(0);
    for (let a = 0; a < N; a++) {
      const b = STEP[a * N + e];
      if (seen[b] || BACK[b * N + e] !== a) return false;
      seen[b] = 1;
    }
  }
  return true;
}
/** D2: head = sum of g(u_k). Exhaustive at length two, sampled at length six. */
function checkHeadIsGSum(samples = 20000, seed = 7) {
  for (let e0 = 0; e0 < N; e0++) {
    const a1 = TADD[idx(0) * N + G[e0]];
    for (let e1 = 0; e1 < N; e1++) {
      if (TADD[G[e0] * N + G[TADD[a1 * N + e1]]] !== headIx([e0, e1])) {
        return { ok: false, at: [e0, e1] };
      }
    }
  }
  const r = rng(seed);
  for (let s = 0; s < samples; s++) {
    const e = drawLedger(r);
    const a = accums(e);
    let acc = ZERO;
    for (let k = 0; k < e.length; k++) acc = TADD[acc * N + G[TADD[a[k] * N + e[k]]]];
    if (acc !== a[e.length]) return { ok: false, at: e };
  }
  return { ok: true, exhaustiveAtLengthTwo: N * N, sampledAtLengthSix: samples };
}
/**
 * D3: head' = head exactly when the accumulator after max(i, j) is restored. Both
 * directions, exhaustively over whole compensating families of drawn ledgers.
 */
function checkMergePointEquivalence(ledgers = 20, seed = 11) {
  const r = rng(seed);
  let agree = 0, disagree = 0, accepts = 0;
  for (let n = 0; n < ledgers; n++) {
    const e = drawLedger(r);
    const a = accums(e);
    const h = a[6];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let d = 1; d < N; d++) {
      const f = e.slice();
      f[i] = adel(e[i], d); f[j] = adel(e[j], N - d);
      const full = headIx(f) === h;
      const merge = accums(f)[j + 1] === a[j + 1];
      if (full === merge) agree++; else disagree++;
      if (full) accepts++;
    }
  }
  return { agree, disagree, accepts, ok: disagree === 0 };
}
/** The published sweep counts each forgery twice: forge(E,i,j,d) === forge(E,j,i,-d). */
function checkDoubleCount() {
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    if (i === j) continue;
    for (const d of [1, -1, 7, -364, 364, 201, -73]) {
      if (forge(LEDGER, i, j, d).join() !== forge(LEDGER, j, i, -d).join()) return false;
    }
  }
  return true;
}

// ------------------------------------------------------ AS2, the differential table of g
/**
 * DDT[alpha * N + beta] = #{ u : g(u + alpha) - g(u) = beta }, tritwise throughout.
 * The derivation, stated so a reader knows this is the MIXER's table and not only the
 * residual's: g(u+a) - g(u) = P(u+a) - P(u) - a, so DDT_g[a][b] = DDT_P[a][b + a] and
 * the two tables are a relabelling of each other with the same maximum.
 */
function ddtOf(gtab) {
  const t = new Int32Array(N * N);
  for (let u = 0; u < N; u++) {
    const gu = gtab[u], row = u * N;
    for (let a = 0; a < N; a++) t[a * N + TSUB[gtab[TADD[row + a]] * N + gu]]++;
  }
  return t;
}
function ddtStats(t) {
  let max = 0, argA = -1, argB = -1, empty = 0, cells = 0, atLeast3 = 0, mass3 = 0, mass = 0;
  for (let a = 0; a < N; a++) {
    if (a === ZERO) continue;                    // the zero difference is not an attack
    for (let b = 0; b < N; b++) {
      const c = t[a * N + b];
      cells++; mass += c;
      if (c === 0) empty++;
      if (c >= 3) { atLeast3++; mass3 += c; }
      if (c > max) { max = c; argA = a; argB = b; }
    }
  }
  return { max, cells, empty, emptyFraction: empty / cells, atLeast3,
    tailShare: mass3 / mass, tailCellShare: atLeast3 / cells, argA, argB };
}
/** A control table: g built from an arbitrary permutation of the 729 states. */
const gFromPermutation = perm => Int16Array.from({ length: N }, (_, u) => TSUB[perm[u] * N + u]);
function randomPermutation(r) {
  const p = Int16Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = randInt(r, i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; }
  return p;
}
/** Set `AN`'s affine map: A = rot^2 + I, so g_A = rot^2, which is LINEAR. */
const G_AFFINE = Int16Array.from({ length: N }, (_, u) => idx(tsub(Q.A(val(u)), val(u))));

// ------------------------------------------------- AS1 and AS4, the cross-ledger census
/**
 * One ledger, over all 10,920 DISTINCT compensating forgeries. The chain is truncated
 * at the merge point by D3, which `checkMergePointEquivalence` verifies rather than
 * assumes. `adjacentRows` carries, for each of the five adjacent pairs, the differential
 * cell and the outcome of every one of the 728 deltas: that is what `AS4` ranks.
 *
 * SCOPE: unordered position pairs i < j only. The published sweep's ordered 21,840 is
 * this same set twice over, and running it ordered would put a factor of two into any
 * dispersion statistic.
 */
function sweepLedger(e, ddt, wantAdjacent = false) {
  const a = accums(e);
  let hash = 0;
  const hitByDistance = new Int32Array(6), triedByDistance = new Int32Array(6);
  const hitByCarry = new Int32Array(4), triedByCarry = new Int32Array(4);
  const adjacentRows = wantAdjacent ? [] : null;
  for (let i = 0; i < 6; i++) {
    for (let j = i + 1; j < 6; j++) {
      const dist = j - i, target = a[j + 1];
      const rows = wantAdjacent && dist === 1
        ? { cells: new Int32Array(N), hit: new Uint8Array(N), hits: 0 } : null;
      for (let d = 1; d < N; d++) {
        const ei = adel(e[i], d), ej = adel(e[j], N - d);
        let x = STEP[a[i] * N + ei];
        for (let k = i + 1; k < j; k++) x = STEP[x * N + e[k]];
        x = STEP[x * N + ej];
        const ok = x === target;
        if (ok) hash++;
        triedByDistance[dist]++; if (ok) hitByDistance[dist]++;
        const cf = (TSUB[ei * N + e[i]] === dIdx(d) ? 2 : 0)
          + (TSUB[ej * N + e[j]] === negIdx(d) ? 1 : 0);
        triedByCarry[cf]++; if (ok) hitByCarry[cf]++;
        if (rows) {
          const ui = TADD[a[i] * N + e[i]], uip = TADD[a[i] * N + ei];
          const A = TSUB[G[uip] * N + G[ui]];
          const aip = TADD[a[i] * N + G[uip]];
          const uj = TADD[a[i + 1] * N + e[j]], ujp = TADD[aip * N + ej];
          rows.cells[d] = ddt[TSUB[ujp * N + uj] * N + TSUB[ZERO * N + A]];
          rows.hit[d] = ok ? 1 : 0;
          if (ok) rows.hits++;
        }
      }
      if (rows) adjacentRows.push(rows);
    }
  }
  return { hash, hitByDistance, triedByDistance, hitByCarry, triedByCarry, adjacentRows };
}

/**
 * THE CONTROL for the census, run on its own ledgers rather than folded into the hot
 * loop: a compensating pair leaves the arithmetic total alone, so the summed head must
 * accept all 10,920. If it did not, every rate above would be measuring a broken
 * accumulator rather than a forgeable one. Recomputed from scratch per forgery, so it
 * is a measurement and not the identity restated.
 */
function summedControl(ledgers, seed = 13) {
  const r = rng(seed);
  let tried = 0, accepted = 0, ledgersRun = 0;
  for (let n = 0; n < ledgers; n++) {
    const e = drawLedger(r), total = totalIx(e);
    ledgersRun++;
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let d = 1; d < N; d++) {
      const f = e.slice();
      f[i] = adel(e[i], d); f[j] = adel(e[j], N - d);
      tried++;
      if (totalIx(f) === total) accepted++;
    }
  }
  return { ledgers: ledgersRun, tried, accepted, rate: accepted / tried };
}

/**
 * AS4's statistic. Ranks are EXPECTATIONS over uniform tie-breaking rather than one
 * shuffle: with buckets ordered by cell value descending, if the first bucket holding
 * a hit has n members and h of them hit, the expected rank of the first hit is the
 * number of deltas in the earlier buckets plus (n + 1) / (h + 1). The uniform-order
 * null is the same formula over one bucket of 728, which is 729 / (k + 1).
 * `T-SEARCH-WHERE-A-CHECK-WOULD-DO`: this is checked, not sampled.
 */
function rankOfFirstHit(row, maxCell) {
  const n = new Int32Array(maxCell + 2), h = new Int32Array(maxCell + 2);
  for (let d = 1; d < N; d++) { const c = row.cells[d]; n[c]++; if (row.hit[d]) h[c]++; }
  let before = 0;
  for (let c = maxCell; c >= 0; c--) {
    if (h[c] > 0) return before + (n[c] + 1) / (h[c] + 1);
    before += n[c];
  }
  return null;                                    // no hit anywhere in this row
}
/**
 * The same quantity under a uniformly random order, and under the two oracles that
 * bound it. The span matters: a statistic whose best and worst cases are close together
 * cannot discriminate, and saying so is cheaper than discovering it afterwards.
 */
const rankUniform = k => (DELTAS + 1) / (k + 1);
const rankOracle = () => 1;
const rankAntiOracle = k => DELTAS - k + 1;

/**
 * The census. Returns everything `AS1` and `AS4` are scored on, plus the partitions
 * that are reported but not registered.
 */
function census(ledgers = LEDGERS, seed = SEED, ddt = null) {
  const table = ddt || ddtOf(G);
  const maxCell = ddtStats(table).max;
  const r = rng(seed);
  const counts = new Int32Array(ledgers);
  const seenEntry = new Uint8Array(N);
  const hitByDistance = new Int32Array(6), triedByDistance = new Int32Array(6);
  const hitByCarry = new Int32Array(4), triedByCarry = new Int32Array(4);
  const hitByCell = new Int32Array(maxCell + 2), triedByCell = new Int32Array(maxCell + 2);
  let sumDDT = 0, sumUniform = 0, sumOracle = 0, sumAnti = 0, cases = 0, casesWithHit = 0;
  const rankD = [], rankU = [];
  for (let n = 0; n < ledgers; n++) {
    const e = drawLedger(r);
    for (const x of e) seenEntry[x] = 1;
    const s = sweepLedger(e, table, true);
    counts[n] = s.hash;
    for (let k = 0; k < 6; k++) {
      hitByDistance[k] += s.hitByDistance[k]; triedByDistance[k] += s.triedByDistance[k];
    }
    for (let k = 0; k < 4; k++) {
      hitByCarry[k] += s.hitByCarry[k]; triedByCarry[k] += s.triedByCarry[k];
    }
    for (const row of s.adjacentRows) {
      cases++;
      for (let d = 1; d < N; d++) {
        const c = Math.min(row.cells[d], maxCell + 1);
        triedByCell[c]++; if (row.hit[d]) hitByCell[c]++;
      }
      if (row.hits === 0) continue;
      casesWithHit++;
      const rd = rankOfFirstHit(row, maxCell), ru = rankUniform(row.hits);
      rankD.push(rd); rankU.push(ru);
      sumDDT += rd;
      sumUniform += ru;
      sumOracle += rankOracle();
      sumAnti += rankAntiOracle(row.hits);
    }
  }
  let tot = 0; for (const c of counts) tot += c;
  const mean = tot / ledgers;
  let ss = 0; for (const c of counts) ss += (c - mean) ** 2;
  const variance = ss / (ledgers - 1 || 1);
  let min = Infinity, max = -1;
  for (const c of counts) { if (c < min) min = c; if (c > max) max = c; }
  let coverage = 0; for (let i = 0; i < N; i++) if (seenEntry[i]) coverage++;
  return {
    ledgers, family: FAMILY, chance: CHANCE, mean, variance, varOverMean: variance / mean,
    min, max, total: tot, coverage,
    hitByDistance, triedByDistance, hitByCarry, triedByCarry, hitByCell, triedByCell,
    maxCell,
    ranks: {
      cases, casesWithHit,
      ddt: sumDDT / casesWithHit, uniform: sumUniform / casesWithHit,
      oracle: sumOracle / casesWithHit, anti: sumAnti / casesWithHit,
      ratio: (sumDDT / casesWithHit) / (sumUniform / casesWithHit),
      // A RATIO OF TWO MEANS HAS NO CLOSED-FORM STANDARD ERROR HERE, because the two
      // are correlated through the same accept count. Bootstrapped over the cases
      // instead. AS4's line sits at 0.5 and the measured value is not far from it, so
      // a number without a spread beside it would be exactly the defect
      // T-CRITERION-IN-THE-NOISE names.
      se: bootstrapRatioSE(rankD, rankU, 400, seed ^ 0x9e3779b9),
    },
  };
}

/** Percentile bootstrap of the mean-rank ratio over cases. */
function bootstrapRatioSE(a, b, B = 400, seed = 1) {
  if (!a.length) return null;
  const r = rng(seed), n = a.length, out = new Float64Array(B);
  for (let t = 0; t < B; t++) {
    let sa = 0, sb = 0;
    for (let i = 0; i < n; i++) { const k = randInt(r, n); sa += a[k]; sb += b[k]; }
    out[t] = sa / sb;
  }
  let m = 0; for (const v of out) m += v; m /= B;
  let ss = 0; for (const v of out) ss += (v - m) ** 2;
  const sorted = Array.from(out).sort((x, y) => x - y);
  return { sd: Math.sqrt(ss / (B - 1)), lo: sorted[Math.floor(0.025 * B)],
    hi: sorted[Math.floor(0.975 * B)], resamples: B };
}

/**
 * POST HOC, DECLARED, AND SCORING NOTHING. `AR`'s control was one frozen object where
 * the claim needed a distribution, and the lesson was that a single draw is one sample.
 * The census is therefore rerun at further seeds so a reader can see whether either
 * registered line sits inside the seed-to-seed spread.
 */
function robustness(seeds, ddt, ledgers = LEDGERS) {
  return seeds.map(s => {
    const c = census(ledgers, s, ddt);
    return { seed: s, mean: c.mean, varOverMean: c.varOverMean, min: c.min, max: c.max,
      as4: c.ranks.ratio };
  });
}

/**
 * What the differential table is worth to a forger who USES it, rather than to one who
 * ranks with it. Derived from the census's own cell tallies: the share of deltas whose
 * cell is empty (excluded with certainty, not merely with high probability), and the
 * share of accepts sitting in the heavy cells.
 */
function targeted(c, floor = 3) {
  let triedAll = 0, hitAll = 0, triedTop = 0, hitTop = 0;
  const empty = { tried: c.triedByCell[0], hit: c.hitByCell[0] };
  for (let k = 0; k < c.triedByCell.length; k++) {
    triedAll += c.triedByCell[k]; hitAll += c.hitByCell[k];
    if (k >= floor) { triedTop += c.triedByCell[k]; hitTop += c.hitByCell[k]; }
  }
  return {
    floor, triedAll, hitAll, triedTop, hitTop, empty,
    deltaShare: triedTop / triedAll, acceptShare: hitTop / hitAll,
    concentration: (hitTop / hitAll) / (triedTop / triedAll),
    topRateXChance: (hitTop / triedTop) * N,
    freeExclusion: empty.tried / triedAll,
  };
}

// ------------------------------------------------------------------ AS3, meet in the middle
/**
 * Modify entries 1, 2, 5 and 6 of a six-entry ledger, keeping the arithmetic total and
 * the mixer head. The left half is pushed forward through the two unmodified entries to
 * the accumulator after entry 4; the right half is pulled BACKWARDS from the head, which
 * is only possible because every step is a bijection in the accumulator (D3). Both are
 * keyed on (accumulator, arithmetic partial sum of the two entries that half owns).
 *
 * Cost, under the model stated in the header: 4 ops per left row, 2 per right row, one
 * pass over 531,441 keys to join. Memory: four arrays of 531,441 slots.
 */
function mitm(e, step = STEP, back = BACK) {
  // The head is computed through the SAME step table the join uses. Taking it from the
  // global chain instead would silently make the control's join impossible to satisfy,
  // and a control that cannot be satisfied reports a ratio of zero and looks decisive.
  let head = idx(0);
  for (const x of e) head = step[head * N + x];
  const S4 = asum(asum(e[0], e[1]), asum(e[4], e[5]));
  const Lc = new Int32Array(N * N), Rc = new Int32Array(N * N);
  const Lr = new Int32Array(N * N).fill(-1), Rr = new Int32Array(N * N).fill(-1);
  let ops = 0;
  for (let x = 0; x < N; x++) {
    const a1 = step[idx(0) * N + x];
    for (let y = 0; y < N; y++) {
      const a2 = step[a1 * N + y];
      const a4 = step[step[a2 * N + e[2]] * N + e[3]];
      ops += 4;
      const key = a4 * N + asum(x, y);
      Lc[key]++; if (Lr[key] < 0) Lr[key] = x * N + y;
    }
  }
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const need = back[back[head * N + y] * N + x];
      ops += 2;
      const key = need * N + asub(S4, asum(x, y));
      Rc[key]++; if (Rr[key] < 0) Rr[key] = x * N + y;
    }
  }
  let matches = 0, keysBoth = 0, keysL = 0, keysR = 0;
  for (let k = 0; k < N * N; k++) {
    ops++;
    if (Lc[k]) keysL++;
    if (Rc[k]) keysR++;
    if (Lc[k] && Rc[k]) { keysBoth++; matches += Lc[k] * Rc[k]; }
  }
  return { matches, ideal: N * N, ratio: matches / (N * N), ops, keysL, keysR, keysBoth,
    memory: 4 * N * N, Lc, Rc, Lr, Rr, head, S4 };
}
/**
 * The join over several ledgers, because `T-CLAIM-NARROWED-BY-A-DESIGN` has bitten
 * twice by reading one design's property as the subject's. Only summary numbers are
 * kept per ledger; the four half-tables are 531,441 slots each and holding nine copies
 * would buy nothing.
 */
function mitmSweep(k = 8, seed = SEED ^ 0x2545f491) {
  const r = rng(seed);
  const out = [];
  for (let n = 0; n < k; n++) {
    const e = drawLedger(r);
    const m = mitm(e);
    out.push({ ledger: e, matches: m.matches, ratio: m.ratio,
      keysL: m.keysL, keysR: m.keysR, keysBoth: m.keysBoth });
  }
  const ratios = out.map(o => o.ratio);
  return { runs: out, min: Math.min(...ratios), max: Math.max(...ratios),
    mean: ratios.reduce((a, b) => a + b, 0) / ratios.length };
}
/** Rebuild a forged ledger from one joined key, so a match can be checked and not trusted. */
function mitmForgery(e, m, key) {
  if (!(m.Lc[key] && m.Rc[key])) return null;
  const f = e.slice();
  f[0] = Math.floor(m.Lr[key] / N); f[1] = m.Lr[key] % N;
  f[4] = Math.floor(m.Rr[key] / N); f[5] = m.Rr[key] % N;
  return f;
}
/** The degenerate control: a join whose two halves are identical must return 2x ideal. */
function degenerateJoinRatio(counts) {
  let sq = 0, tot = 0;
  for (const c of counts) { sq += c * c; tot += c; }
  return sq / (tot * tot / counts.length);
}
/** A chain built on an arbitrary permutation, for the structureless control. */
function stepTableFor(perm) {
  const s = new Int16Array(N * N), b = new Int16Array(N * N);
  for (let a = 0; a < N; a++) for (let e = 0; e < N; e++) {
    const nxt = TSUB[perm[TADD[a * N + e]] * N + e];
    s[a * N + e] = nxt; b[nxt * N + e] = a;
  }
  return { step: s, back: b };
}

// ------------------------------------------------- WHAT WAS NOT ATTACKED, MEASURED
/**
 * An unexamined attack surface reported as silence is how the 26 got here, so the one
 * this set leaves open is measured rather than merely named.
 *
 * A fixed point of `P` is a `u` with `g(u) = 0`, and by D1 the step from accumulator
 * `a` with entry `e = u - a` then leaves `a` unchanged. So for each fixed point there
 * is, FROM EVERY ACCUMULATOR, exactly one entry value that is a mixer no-op: a forger
 * who may INSERT an entry rather than edit one has a free move at every position of
 * every ledger. Every forgery in set `AS` keeps the ledger's length, so none of them
 * uses it.
 *
 * The other half of the same object is `g`'s image, which is what makes the chain's
 * increments a proper subset of the group.
 */
function noOpEntries() {
  let fixedPoints = 0;
  const image = new Set();
  const witnesses = [];
  for (let u = 0; u < N; u++) {
    image.add(G[u]);
    if (G[u] === ZERO) { fixedPoints++; witnesses.push(u); }
  }
  // Checked at every accumulator rather than argued: the entry is forced, and the claim
  // is that it does nothing, which is exactly the kind of thing a transcription gets
  // backwards.
  let verified = true;
  for (const u of witnesses) {
    for (let a = 0; a < N; a++) if (STEP[a * N + TSUB[u * N + a]] !== a) { verified = false; break; }
  }
  return { fixedPoints, witnesses, verified,
    imageOfG: image.size, unreachableIncrements: N - image.size };
}

// ----------------------------------------------------- the brute-force baseline, measured
/**
 * What a forger pays WITHOUT the join: draw four-position modifications that keep the
 * arithmetic total (three entries free, the fourth forced) and evaluate the chain. The
 * rate is SAMPLED, not exhaustive — 729^3 = 387,420,489 candidates is the whole family
 * and enumerating it is the thing the attack is supposed to avoid — so the direction of
 * the bound is stated: the sample estimates the rate, and the cost per accepted forgery
 * it implies is an estimate with a standard error the report prints.
 */
function bruteBaseline(e, samples = 3000000, seed = 17) {
  const r = rng(seed);
  const a = accums(e), head = a[6];
  const S4 = asum(asum(e[0], e[1]), asum(e[4], e[5]));
  let accepted = 0, ops = 0;
  for (let s = 0; s < samples; s++) {
    const x = randInt(r, N), y = randInt(r, N), z = randInt(r, N);
    const w = asub(S4, asum(asum(x, y), z));
    let acc = STEP[STEP[idx(0) * N + x] * N + y];
    acc = STEP[STEP[acc * N + e[2]] * N + e[3]];
    acc = STEP[STEP[acc * N + z] * N + w];
    ops += 6;
    if (acc === head) accepted++;
  }
  return { samples, accepted, rate: accepted / samples, ops,
    opsPerAccept: accepted ? ops / accepted : Infinity,
    seSamples: Math.sqrt(samples * (1 / N) * (1 - 1 / N)) };
}

// ---------------------------------------------------------------- report
let CACHE = null;
function measure() {
  if (CACHE) return CACHE;
  const ddt = ddtOf(G);
  const stats = ddtStats(ddt);
  const r = rng(SEED ^ 0x5f3759df);
  const perm = randomPermutation(r);
  const ctrl = stepTableFor(perm);
  const ledgerIx = LEDGER.map(v => idx(wrap(v)));
  CACHE = {
    identities: {
      d1: checkStepIsGShift(),
      bijective: checkStepBijective(),
      d2: checkHeadIsGSum(),
      d3: checkMergePointEquivalence(20),
      doubleCount: checkDoubleCount(),
    },
    canonical: {
      ledgerIx,
      distinct: sweepLedger(ledgerIx, ddt, false).hash,
      publishedOrdered: LED.sweepCompensating().hash,
      headMatches: headIx(ledgerIx) === idx(headHash(LEDGER)),
    },
    ddt: { stats, table: ddt,
      random: ddtStats(ddtOf(gFromPermutation(perm))),
      affine: ddtStats(ddtOf(G_AFFINE)) },
    census: census(LEDGERS, SEED, ddt),
    control: summedControl(Math.min(LEDGERS, 200)),
    mitm: mitm(ledgerIx),
    mitmControl: mitm(ledgerIx, ctrl.step, ctrl.back),
    mitmSweep: mitmSweep(8),
    brute: bruteBaseline(ledgerIx, LEDGERS >= 500 ? 3000000 : 200000),
    noOp: noOpEntries(),
    controlMaxima: Array.from({ length: 12 }, () =>
      ddtStats(ddtOf(gFromPermutation(randomPermutation(r)))).max),
  };
  CACHE.robustness = robustness([1, 424242], ddt, LEDGERS);
  CACHE.targeted = targeted(CACHE.census, 3);
  return CACHE;
}

function report() {
  const M = measure();
  log('FORGE AUDIT — attacking the ledger head, instead of counting collisions against it.');
  log(line);

  log('\n--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  const I = M.identities;
  log(`      D1  step(a,e) = a + g(a + e), over all ${(N * N).toLocaleString('en-US')} pairs: ${I.d1}`);
  log(`      D3  every step is a bijection in the accumulator, all 729 entries: ${I.bijective}`);
  log(`      D2  head = sum of g(u_k): exhaustive at length two, ${I.d2.sampledAtLengthSix.toLocaleString('en-US')} sampled at six: ${I.d2.ok}`);
  log(`      D3  head' = head  <=>  merge-point accumulator restored: ${I.d3.ok}`
    + `  (${I.d3.agree.toLocaleString('en-US')} agree, ${I.d3.disagree} disagree, ${I.d3.accepts} accepts)`);
  log(`      the published sweep counts every forgery twice: ${I.doubleCount}`);
  log(`      the canonical ledger's head reproduces ledger-audit's: ${M.canonical.headMatches}`);
  log(`      ledger-audit reports ${M.canonical.publishedOrdered} ordered accepts;`
    + ` this file finds ${M.canonical.distinct} distinct — a factor of`
    + ` ${(M.canonical.publishedOrdered / M.canonical.distinct).toFixed(2)}`);
  log(`      the summed head, run over ${M.control.ledgers} ledgers and`
    + ` ${M.control.tried.toLocaleString('en-US')} forgeries, accepts`
    + ` ${(100 * M.control.rate).toFixed(2)}% — the control MOVES`);
  log(`      the draw visited ${M.census.coverage} of ${N} entry values`);

  log('\n--- AS1  the cross-ledger census ---');
  const C = M.census;
  log(`      ${C.ledgers.toLocaleString('en-US')} drawn ledgers x ${C.family.toLocaleString('en-US')} distinct compensating forgeries`);
  log(`      mean accepts        ${C.mean.toFixed(3)}   chance ${C.chance.toFixed(3)}   |diff| ${Math.abs(C.mean - C.chance).toFixed(3)}`);
  log(`      variance            ${C.variance.toFixed(3)}   variance / mean ${C.varOverMean.toFixed(3)}`);
  log(`      min ${C.min}   max ${C.max}`);
  log('\n      by merge distance (unregistered, reported so the cuts looked at are on record)');
  log('      dist    tried      accepts    rate x chance');
  for (let d = 1; d <= 5; d++) {
    const t = C.triedByDistance[d], h = C.hitByDistance[d];
    log(`      ${d}     ${String(t).padStart(9)}  ${String(h).padStart(9)}   ${(h / t * N).toFixed(3)}`);
  }
  log('\n      by whether the arithmetic delta carried at each edited entry');
  log('      carry-free at i / j     tried      accepts    rate x chance');
  for (let k = 3; k >= 0; k--) {
    const t = C.triedByCarry[k], h = C.hitByCarry[k];
    if (!t) continue;
    log(`      ${k & 2 ? 'yes' : 'no '} / ${k & 1 ? 'yes' : 'no '}          ${String(t).padStart(9)}  ${String(h).padStart(9)}   ${(h / t * N).toFixed(3)}`);
  }

  log('\n--- AS2  the differential table of g ---');
  const D = M.ddt;
  log(`      cells ${D.stats.cells.toLocaleString('en-US')} (728 non-zero input differences x 729 outputs)`);
  log(`      maximum cell            ${D.stats.max}   = probability ${(D.stats.max / N).toFixed(5)}`);
  log(`      empty cells             ${(100 * D.stats.emptyFraction).toFixed(2)}%   a random function gives 36.79%`);
  log(`      cells holding 3 or more ${(100 * D.stats.tailCellShare).toFixed(2)}% of cells, ${(100 * D.stats.tailShare).toFixed(2)}% of the mass`);
  log(`      control, a random permutation's g   max ${D.random.max}   empty ${(100 * D.random.emptyFraction).toFixed(2)}%`);
  log(`      and over 12 random permutations the maximum runs ${M.controlMaxima.join(' ')}`);
  log(`      control, AN's LINEAR affine g       max ${D.affine.max}   empty ${(100 * D.affine.emptyFraction).toFixed(2)}%   (the statistic can reach 729)`);

  log('\n--- AS3  meet in the middle ---');
  const J = M.mitm, JC = M.mitmControl;
  log(`      four positions modified (1, 2, 5, 6); two left alone`);
  log(`      matches             ${J.matches.toLocaleString('en-US')}   ideal ${J.ideal.toLocaleString('en-US')}   ratio ${J.ratio.toFixed(4)}`);
  log(`      keys occupied       left ${J.keysL.toLocaleString('en-US')}  right ${J.keysR.toLocaleString('en-US')}  both ${J.keysBoth.toLocaleString('en-US')}`);
  const JS = M.mitmSweep;
  log(`      over ${JS.runs.length} further drawn ledgers: min ${JS.min.toFixed(4)}`
    + `  mean ${JS.mean.toFixed(4)}  max ${JS.max.toFixed(4)}`);
  log(`      control, a random permutation's chain: ratio ${JC.ratio.toFixed(4)}`);
  log(`      responsiveness: a join whose halves are identical returns`
    + ` ${degenerateJoinRatio(J.Lc).toFixed(4)} — the statistic MOVES`);

  log('\n--- AS4  ordering deltas by the differential table ---');
  const R = C.ranks;
  log(`      ${R.cases.toLocaleString('en-US')} adjacent-pair cases, ${R.casesWithHit.toLocaleString('en-US')} of them with at least one accept`);
  log(`      mean rank of first accept, differential order   ${R.ddt.toFixed(2)}`);
  log(`      mean rank of first accept, uniform order        ${R.uniform.toFixed(2)}`);
  log(`      ratio                                          ${R.ratio.toFixed(4)}`
    + `   bootstrap 95% [${R.se.lo.toFixed(4)}, ${R.se.hi.toFixed(4)}], sd ${R.se.sd.toFixed(4)}`);
  log(`      span: a perfect oracle gives ${R.oracle.toFixed(2)}, an anti-oracle ${R.anti.toFixed(2)}`);
  log('\n      accept rate by the differential cell the delta lands in');
  log('      cell     tried      accepts   rate x chance');
  for (let c = 0; c <= C.maxCell + 1; c++) {
    const t = C.triedByCell[c], h = C.hitByCell[c];
    if (!t) continue;
    log(`      ${String(c).padStart(3)}  ${String(t).padStart(10)}  ${String(h).padStart(9)}   ${(h / t * N).toFixed(3)}`);
  }

  log('\n--- POST HOC, DECLARED, SCORING NOTHING: the same statistics at other seeds ---');
  log('      seed          mean   var/mean   min   max   AS4 ratio');
  for (const row of [{ seed: SEED, mean: C.mean, varOverMean: C.varOverMean, min: C.min,
    max: C.max, as4: C.ranks.ratio }, ...M.robustness]) {
    log(`      ${String(row.seed).padStart(9)}  ${row.mean.toFixed(3).padStart(7)}`
      + `   ${row.varOverMean.toFixed(3).padStart(8)}   ${String(row.min).padStart(3)}`
      + `   ${String(row.max).padStart(3)}   ${row.as4.toFixed(4).padStart(9)}`);
  }

  log('\n--- NOT REGISTERED: the differential table as a FILTER, which is what a forger buys ---');
  const G4 = M.targeted;
  log(`      cells that are empty exclude ${(100 * G4.freeExclusion).toFixed(2)}% of deltas WITH CERTAINTY:`
    + ` ${G4.empty.hit} accepts in ${G4.empty.tried.toLocaleString('en-US')} tries`);
  log(`      deltas whose cell holds ${G4.floor} or more are ${(100 * G4.deltaShare).toFixed(2)}% of the family`
    + ` and carry ${(100 * G4.acceptShare).toFixed(2)}% of the accepts`);
  log(`      concentration ${G4.concentration.toFixed(2)}x, and inside that band the accept rate is`
    + ` ${G4.topRateXChance.toFixed(2)}x chance`);

  log('\n--- WHAT THIS SET DID NOT ATTACK, measured rather than left as silence ---');
  const NO = M.noOp;
  log(`      P has ${NO.fixedPoints} fixed point(s), so from EVERY accumulator exactly ${NO.fixedPoints}`);
  log('      entry value is a mixer no-op — verified at all 729 accumulators: ' + NO.verified);
  log(`      and g's image is ${NO.imageOfG} of ${N}, so ${NO.unreachableIncrements} increments are unreachable in one step`);
  log('      Every forgery here keeps the ledger at six entries. A forger who may INSERT');
  log('      has that free move at every position and this set never uses it.');

  log('\n--- NOT REGISTERED: what a forger actually pays ---');
  const B = M.brute;
  log(`      brute force over four-position sum-preserving forgeries, ${B.samples.toLocaleString('en-US')} sampled`);
  log(`        accepted ${B.accepted.toLocaleString('en-US')}   rate x chance ${(B.rate * N).toFixed(3)}   ops per accepted forgery ${B.opsPerAccept.toFixed(0)}`);
  log(`      meet in the middle over the SAME family, exhaustively`);
  log(`        accepted ${J.matches.toLocaleString('en-US')}   ops ${J.ops.toLocaleString('en-US')}   ops per accepted forgery ${(J.ops / J.matches).toFixed(2)}`);
  log(`        memory ${J.memory.toLocaleString('en-US')} slots`);
  log(`      speed-up ${(B.opsPerAccept / (J.ops / J.matches)).toFixed(0)}x`);
  log(`      the SUMMED head needs no search at all — a compensating pair is a forgery by`);
  log(`      construction, about 1 op. So the mixer's advantage over the sum is`
    + ` ${(J.ops / J.matches).toFixed(1)} ops per`);
  log(`      forgery, not the 840x per-try findability gap ledger-audit measured on a`);
  log('      family with one free parameter.');
  log('\n' + line);
  return M;
}

if (MAIN) report();

module.exports = {
  N, W, OFF, ZERO, LEDGERS, SEED, FAMILY, CHANCE, PAIRS, DELTAS,
  TADD, TSUB, G, BACK, G_AFFINE, asum, asub, adel, dIdx, negIdx,
  rng, randInt, drawLedger, accums, headIx, totalIx,
  checkStepIsGShift, checkStepBijective, checkHeadIsGSum, checkMergePointEquivalence,
  checkDoubleCount, ddtOf, ddtStats, gFromPermutation, randomPermutation, stepTableFor,
  sweepLedger, summedControl, rankOfFirstHit, rankUniform, rankAntiOracle, census,
  bootstrapRatioSE, robustness, targeted,
  mitm, mitmSweep, mitmForgery, degenerateJoinRatio, bruteBaseline, noOpEntries,
  measure, report,
};
