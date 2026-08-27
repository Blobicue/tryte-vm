'use strict';
/* PUZZLE AUDIT — does a purpose-built ternary search puzzle have the asymmetry?
 *
 * Set `AN`. The question is not the one `AD`, `AG`, `AH` and `AK` answered. Those
 * asked whether the COST OF RUNNING a program can be an unforgeable receipt, and the
 * answer was no, three separate ways, ending at `AK4`'s trilemma. This asks the
 * question Bitcoin actually answers, which is a different one:
 *
 *   A miner does not prove it ran a program. It proves it FOUND A RARE WITNESS,
 *   and the witness is cheap to check. The asymmetry is search-against-check,
 *   not run-against-run.
 *
 * Nothing in `AD` through `AK` bounds that. A search puzzle never claims a step
 * count, so in-degree, cost variance and bounded state are not its constraints.
 * The constraints are different and this set measures them.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * Everything below is fixed before the run and none of it is at risk. It is stated
 * here so that what IS at risk is unambiguous.
 *
 * WIDTH. Six trits everywhere -- message, nonce and digest are each one tryte, so
 * all 729 x 729 = 531,441 (message, nonce) pairs are enumerated. `F-SPLIT-ROUND-MIXES`
 * was measured at 729 states with a 27-entry round table; running wider would cite
 * `D`'s evidence for a construction `D` never ran.
 *
 * THE COMBINE is TRITWISE addition mod 3, not tryte `ADD`. `AL`'s affine label means
 * affine over GF(3), and a carrying add would take the affine control out of GF(3)
 * and make its refutation an artifact of the instrument rather than of the algebra.
 *
 * THE MIXER `P` is `D`'s split-round Feistel verbatim, same LCG seed, same 27-entry
 * nonlinear round table: low three trits and high three trits swap, and one half is
 * added to the other through the table. `F-SPLIT-ROUND-MIXES` measured this shape at
 * 8 cycles against a random permutation's 6.6, while its linear twin gave 92. Eight
 * rounds, which is `D4`'s iteration count. `P` is a permutation, so by `D1` nothing
 * bleeds.
 *
 * THE FOUR CANDIDATES, all sharing that mixer:
 *
 *   feedforward   h(m,n) = P(m + n) - n        the puzzle. NOT invertible in n.
 *   bijective     h(m,n) = P(m + n)            the same mixer, feed-forward removed
 *   affine        h(m,n) = A(m + n) - n + k    A = rot^2 + I over GF(3)^6
 *   random        a fixed pseudorandom table   the instrument's own control
 *
 * `A` was chosen so that both `A` and `A - I` are invertible over GF(3) -- checked
 * before registration, since a singular `A - I` would make the affine attack fail for
 * instrument reasons and refute nothing. `A - I` is exactly `rot^2`.
 *
 * DIFFICULTY `k` means the top k trits of the digest are zero, so the target set has
 * 3^(6-k) members and a random digest lands in it with probability 3^-k.
 *
 * TWO THINGS ARE FORCED BY CONSTRUCTION and are therefore NOT registered. First,
 * verification is one digest evaluation, by definition of the puzzle. Second, the
 * MEAN hit count per message is exactly 3^(6-k) for every candidate here, because
 * each h is a bijection in the MESSAGE for fixed nonce, so the 531,441 pairs cover
 * every digest exactly 729 times. The mean is a tautology. The VARIANCE is not, and
 * that is where this set puts its weight.
 *
 * THE NULL MODEL. Over a FINITE nonce space the naive 3^k is wrong, and registering
 * it would fail on arithmetic with a perfect function. Hits per message are
 * Binomial(729, 3^-k), a message is stranded when it draws zero, and the expected
 * first hit given w hits among N scanned nonces is (N+1)/(w+1). Computed numerically
 * before this commit, since a null model is arithmetic and not a measurement:
 *
 *      k   targets   E[W]   sd(W)   E[stranded msgs]   E[first hit | mineable]   3^k
 *      1       243  243.00   12.73             0.000                       3.0     3
 *      2        81   81.00    8.49             0.000                       9.0     9
 *      3        27   27.00    5.10             0.000                      27.0    27
 *      4         9    9.00    2.98             0.085                      80.9    81
 *      5         3    3.00    1.73            36.071                     205.1   243
 *      6         1    1.00    1.00           268.000                     305.2   729
 *
 * So 3^k is right to three figures only while k <= 4, and by k = 6 the truncated
 * search understates the true work by 58%. That is a property of the arena, not of
 * any candidate, and both are registered against the null rather than against 3^k.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AN1 THE VARIANCE OF HIT COUNTS IS THE TEST `D4` COULD NOT SUPPLY. `D4` failed
 *       because truncating ANY permutation gives perfectly uniform buckets, so a
 *       collision count cannot tell a hash from a relabelling. The hit count per
 *       MESSAGE can, and for a reason that is structural rather than statistical: if
 *       h is a bijection in the nonce, every message has EXACTLY 3^(6-k) hits and the
 *       variance is zero, while a compressing h scatters them binomially.
 *
 *       Predicted, exhaustively over all 531,441 pairs: the feedforward candidate's
 *       sd of hits per message lands within 25% of the binomial sd at every k from 1
 *       to 6 -- 12.73, 8.49, 5.10, 2.98, 1.73, 1.00 -- and its mean first hit over
 *       MINEABLE messages within 15% of the null column above. Predicted the
 *       bijective and affine candidates give sd EXACTLY 0 at every k.
 *
 *       Registered one-directional, and this matters more than the result: agreement
 *       is NOT a certificate. 729 states is a toy and no toy is evidence against an
 *       adversary. Disagreement is a refutation. That asymmetry is the whole reason
 *       to run it.
 *
 *   AN2 THE TABULATOR RETURNS, AND THE ALGEBRA IS WORSE THAN THE TABLE. Two attacks,
 *       both implemented rather than argued.
 *
 *       (a) Against the bijective candidate: build the 729-entry inverse of `P`
 *       once, then the nonce for any target digest is P^-1(d) - m. Predicted exactly
 *       1 lookup per solve at every k, success for 729 of 729 messages, and a
 *       speedup over brute force of at least 180x at k = 5. This is `AD2`'s
 *       tabulator, the same attack that killed the receipt, arriving at the puzzle.
 *
 *       (b) Against the affine candidate: no table at all. The digest is
 *       A(m) + (A - I)(n) + k, so the nonce is rot^-2 of a difference. Predicted 1
 *       solve per nonce, success for 729 of 729 at every k, and a break-even of ONE
 *       query against `AD2`'s seventy -- because the precomputation is a single 6x6
 *       inversion over GF(3) rather than a sweep of the state space.
 *
 *       So being affine is strictly worse than being merely reversible, and the gap
 *       is the 729-entry table.
 *
 *   AN3 IRREVERSIBILITY IS PAID FOR IN STRANDED MESSAGES. A puzzle needs h to be
 *       non-invertible in the nonce, or `AN2`(a) applies. But non-invertible means
 *       the image of h(m, .) is smaller than the nonce space, so a message can miss
 *       the target set entirely and be UNMINEABLE at that difficulty -- no nonce
 *       exists, and a miner holding it can grind forever.
 *
 *       Predicted the feedforward candidate strands messages at the null rate, within
 *       a factor of two at k = 5 and k = 6 -- about 36 and about 268 of 729 -- and
 *       monotonically nondecreasing in k. Predicted the bijective and affine
 *       candidates strand EXACTLY ZERO at every k.
 *
 *       If it holds, the headline is that at maximum difficulty roughly 37% of
 *       messages cannot be mined at all, and the property that fixes it is precisely
 *       the property `AN2`(a) uses to skip the mining. Registered with the
 *       alternative: if the feedforward candidate strands far MORE than the null, the
 *       mixer is structured and it is the mixer that is refuted, not the principle.
 *
 *   AN4 THE FIX IS MORE NONCE, NOT A DIFFERENT FUNCTION, AND ONE CHANGE CURES BOTH
 *       SYMPTOMS. Widening the nonce to twelve trits -- 531,441 values, absorbed in
 *       two blocks through the same compression function, with message and digest
 *       unchanged at six trits -- predicted to drive stranded messages to zero at
 *       k = 6, AND to raise the mean first hit from the truncated 305.2 to within 10%
 *       of 729, which is 3^6 and the value a proper lottery owes.
 *
 *       So `AN3`'s stranding and the null table's 58% shortfall at k = 6 are the same
 *       symptom of one cause, the nonce space failing to outrun the target rarity.
 *       Predicted the two move together. If they do, the design rule is measured
 *       rather than borrowed: nonce space must exceed target rarity by orders of
 *       magnitude, which is what Bitcoin's extraNonce field is for.
 * ------------------------------------------------------------------------------
 * Run:  npm run audit:puzzle
 */

const T = require('../src/ternary.js');

const W = 6, N = 729;
const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };

const VALS = Array.from({ length: N }, (_, i) => i + T.TRYTE_MIN);
const idx = v => T.wrap(v) - T.TRYTE_MIN;
const val = i => i + T.TRYTE_MIN;

// ---------------------------------------------------------------- GF(3) tritwise
const tadd = (a, b) => {
  const x = T.toTrits(a), y = T.toTrits(b);
  return T.fromTrits(Array.from({ length: W }, (_, i) => ((x[i] + y[i] + 4) % 3) - 1));
};
const tsub = (a, b) => {
  const x = T.toTrits(a), y = T.toTrits(b);
  return T.fromTrits(Array.from({ length: W }, (_, i) => ((x[i] - y[i] + 4) % 3) - 1));
};
const rotn = k => v => {
  const t = T.toTrits(v).slice(0, W);
  return T.fromTrits([...t.slice(k), ...t.slice(0, k)]);
};

// ---------------------------------------------------------------- D's mixer
/** D's LCG, seed and shuffle, copied so the round table is the one D measured. */
function roundTable(seed) {
  let s = seed;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const A = Array.from({ length: 27 }, (_, i) => i);
  for (let i = 26; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = A[i]; A[i] = A[j]; A[j] = t; }
  return A;
}
const S27 = roundTable(98765);
const lo = v => { const t = T.toTrits(v); return (t[0] + 1) + 3 * (t[1] + 1) + 9 * (t[2] + 1); };
const hi = v => { const t = T.toTrits(v); return (t[3] + 1) + 3 * (t[4] + 1) + 9 * (t[5] + 1); };
const pack = (L, R) => {
  const t = new Array(W);
  for (let k = 0; k < 3; k++) { t[k] = (Math.floor(L / 3 ** k) % 3) - 1; t[k + 3] = (Math.floor(R / 3 ** k) % 3) - 1; }
  return T.fromTrits(t);
};
const splitRound = v => pack(hi(v), (lo(v) + S27[hi(v)]) % 27);

const ROUNDS = 8;
/** P = splitRound^ROUNDS, as a 729-entry permutation table over state INDICES. */
const PT = (() => {
  const t = Int16Array.from(VALS, v => { let s = v; for (let i = 0; i < ROUNDS; i++) s = splitRound(s); return idx(s); });
  return t;
})();
const PINV = (() => { const t = new Int16Array(N); for (let i = 0; i < N; i++) t[PT[i]] = i; return t; })();
const P = v => val(PT[idx(v)]);

// ---------------------------------------------------------------- the affine map
const KAPPA = 91 + T.TRYTE_MIN;                       // the affine constant, fixed
const A = v => tadd(rotn(2)(v), v);                   // rot^2 + I over GF(3)^6
const AINV_MINUS_I = rotn(W - 2);                     // (A - I)^-1 = rot^-2 = rot^4

// ---------------------------------------------------------------- the candidates
/** A fixed pseudorandom function, the instrument's control. Not a candidate design. */
const RTAB = (() => {
  let s = 0x5eed1;
  const t = new Int16Array(N * N);
  for (let i = 0; i < N * N; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; t[i] = s % N; }
  return t;
})();

const CANDIDATES = {
  feedforward: (m, n) => idx(tsub(P(tadd(m, n)), n)),
  bijective:   (m, n) => idx(P(tadd(m, n))),
  affine:      (m, n) => idx(tadd(tsub(A(tadd(m, n)), n), KAPPA)),
  random:      (m, n) => RTAB[idx(m) * N + idx(n)],
};

/** The full 729 x 729 digest table for one candidate, indexed [m*N + n]. */
function digestTable(h) {
  const t = new Int16Array(N * N);
  for (let mi = 0; mi < N; mi++) {
    const m = val(mi);
    for (let ni = 0; ni < N; ni++) t[mi * N + ni] = h(m, val(ni));
  }
  return t;
}

/** Is the top k trits of digest index d all zero? */
function targetMask(k) {
  const mask = new Uint8Array(N);
  for (let d = 0; d < N; d++) {
    const t = T.toTrits(val(d));
    let ok = true;
    for (let i = W - k; i < W; i++) if (t[i] !== 0) ok = false;
    mask[d] = ok ? 1 : 0;
  }
  return mask;
}

/**
 * Per-message statistics at difficulty k, derived from one digest table.
 * SCOPE, stated because T-SCOPE-DECIDES-THE-VERDICT has bitten four times:
 * `meanFirstHit` averages over MINEABLE messages only. Stranded messages have no
 * first hit at all and are counted separately, never as a large number.
 */
function sweep(tbl, k) {
  const mask = targetMask(k);
  const hits = new Int32Array(N);
  const first = new Int32Array(N).fill(-1);
  for (let mi = 0; mi < N; mi++) {
    const base = mi * N;
    let h = 0, f = -1;
    for (let ni = 0; ni < N; ni++) {
      if (mask[tbl[base + ni]]) { h++; if (f < 0) f = ni; }
    }
    hits[mi] = h; first[mi] = f;
  }
  const stranded = [...hits].filter(h => h === 0).length;
  const mineable = [...first].filter(f => f >= 0);
  const meanW = [...hits].reduce((a, b) => a + b, 0) / N;
  const varW = [...hits].reduce((a, b) => a + (b - meanW) ** 2, 0) / N;
  // first hit is a 0-based index; the attempt count is one more
  const meanFirst = mineable.length
    ? mineable.reduce((a, b) => a + b + 1, 0) / mineable.length : null;
  return { k, targets: 3 ** (W - k), meanW, sdW: Math.sqrt(varW), stranded, meanFirst };
}

// ---------------------------------------------------------------- the two attacks
/**
 * AN2(a). The tabulator: invert P once, then read the nonce off. Returns the number
 * of messages solved and the operations charged per solve AFTER the precomputation.
 */
function tabulatorAttack(k) {
  const mask = targetMask(k);
  const targets = [];
  for (let d = 0; d < N; d++) if (mask[d]) targets.push(d);
  let solved = 0, ops = 0;
  for (let mi = 0; mi < N; mi++) {
    const m = val(mi);
    const d = targets[0];                       // any target will do; take the first
    ops++;                                      // one inverse lookup
    const n = tsub(val(PINV[d]), m);
    if (mask[CANDIDATES.bijective(m, n)]) solved++;
  }
  return { solved, opsPerSolve: ops / N, precompute: N };
}

/**
 * AN2(b). The linear solve: d = A(m) + (A - I)(n) + kappa, so n = (A - I)^-1 of
 * (d - kappa - A(m)). No table of the state space at all.
 */
function affineAttack(k) {
  const mask = targetMask(k);
  let target = -1;
  for (let d = 0; d < N; d++) if (mask[d]) { target = d; break; }
  let solved = 0, ops = 0;
  for (let mi = 0; mi < N; mi++) {
    const m = val(mi);
    ops++;                                      // one rot^-2 of one difference
    const n = AINV_MINUS_I(tsub(tsub(val(target), KAPPA), A(m)));
    if (mask[CANDIDATES.affine(m, n)]) solved++;
  }
  return { solved, opsPerSolve: ops / N, precompute: 1 };
}

// ---------------------------------------------------------------- AN4, wide nonce
/**
 * Two-block absorption through the same compression function:
 *   s = P(m + nHi) - nHi ;  digest = P(s + nLo) - nLo
 * Nonce is twelve trits, message and digest stay at six. Early exit, so the cost is
 * the expected search and not 729 * 531,441.
 */
function wideSweep(k) {
  const mask = targetMask(k);
  const compress = (s, x) => tsub(P(tadd(s, x)), x);
  let stranded = 0, totalFirst = 0, mineable = 0;
  for (let mi = 0; mi < N; mi++) {
    const m = val(mi);
    let attempts = 0, found = false;
    for (let hiI = 0; hiI < N && !found; hiI++) {
      const s = compress(m, val(hiI));
      for (let loI = 0; loI < N; loI++) {
        attempts++;
        if (mask[idx(compress(s, val(loI)))]) { found = true; break; }
      }
    }
    if (found) { mineable++; totalFirst += attempts; } else stranded++;
  }
  return { k, stranded, meanFirst: mineable ? totalFirst / mineable : null, nonceSpace: N * N };
}

// ------------------------------------------- beyond the registration: the shortcut
/**
 * NOT REGISTERED. `AN1` predicted the feedforward candidate's hit-count variance
 * would sit within 25% of binomial at every k. It came in LOW at k = 1 and k = 2 --
 * more uniform than chance -- and a puzzle that is more uniform than chance is
 * structured. This is what the deviation turned out to be.
 *
 * Substituting u = m + n into h(m,n) = P(m + n) - n gives
 *
 *      h(m,n) = P(u) - u + m  =  g(u) + m,   g(u) = P(u) - u
 *
 * so the MESSAGE enters through the same group operation as the nonce and commutes
 * straight out. Every message is the same puzzle, shifted.
 */
const gShift = u => tsub(P(u), u);

/** Does h(m,n) = g(m+n) + m hold on all 531,441 pairs? */
function shiftIdentity() {
  for (const m of VALS) for (const n of VALS) {
    if (idx(tadd(gShift(tadd(m, n)), m)) !== CANDIDATES.feedforward(m, n)) return false;
  }
  return true;
}

/** The inverted index of g, built once. Its IMAGE is the whole story. */
function gIndex() {
  const map = new Map();
  for (const u of VALS) {
    const k = idx(gShift(u));
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(u);
  }
  return map;
}

/**
 * The third attack, which the registration did not anticipate: one 729-entry index
 * of g, then read the nonce off. Charged honestly -- lookups are counted, and a
 * message the index declares unmineable is counted as such rather than as a failure.
 */
function shiftAttack(k, index = gIndex()) {
  const mask = targetMask(k);
  const targets = [];
  for (let d = 0; d < N; d++) if (mask[d]) targets.push(d);
  let solved = 0, unmineable = 0, lookups = 0;
  for (const m of VALS) {
    let hit = false;
    for (const d of targets) {
      lookups++;
      const want = idx(tsub(val(d), m));
      if (index.has(want)) {
        // gIndex stores u as a VALUE, not an index. Wrapping it in val() again
        // shifted every nonce by TRYTE_MIN and the attack reported itself as
        // solving nothing at k >= 5 -- while AN3's exhaustive sweep said 465 of
        // those messages were mineable. T-INSTRUMENT-FALSE-VERDICT again, and
        // caught by the CONTRADICTION between two measurements of one quantity
        // rather than by the code reading wrong, which it did not.
        const n = tsub(index.get(want)[0], m);
        if (mask[CANDIDATES.feedforward(m, n)]) { solved++; hit = true; break; }
      }
    }
    if (!hit) unmineable++;
  }
  return { solved, unmineable, lookupsPerMessage: lookups / N, precompute: N,
    imageSize: index.size };
}

/**
 * The antibody for the bug above. A fast attack and a slow exhaustive sweep must
 * agree on WHICH messages are solvable, not merely produce plausible numbers. The
 * first version of `shiftAttack` disagreed with `sweep` by 465 messages and looked
 * fine in isolation; only the cross-check makes that impossible to miss.
 */
function attackAgreesWithSweep(k, tbl) {
  const a = shiftAttack(k);
  const s = sweep(tbl, k);
  return { agrees: a.solved === N - s.stranded && a.unmineable === s.stranded,
    attackSolved: a.solved, sweepMineable: N - s.stranded };
}

/**
 * And the fix, which confirms the diagnosis by removing the symptom. True
 * Davies-Meyer: the message KEYS the permutation instead of entering its data path,
 * so there is no group operation for it to commute out of. h(m,n) = P_m(n) - n.
 */
function keyedDM(m, n) {
  const kl = lo(m), kh = hi(m);
  let s = n;
  for (let i = 0; i < ROUNDS; i++) {
    const K = (kl * (i + 1) + kh * (i * i + 1)) % 27;
    s = pack(hi(s), (lo(s) + S27[(hi(s) + K) % 27]) % 27);
  }
  return idx(tsub(s, n));
}

// ---------------------------------------------------------------- null model
/** Binomial(N, 3^-k) hits per message; E[first | w hits] = (N+1)/(w+1). */
function nullModel(nonces, k) {
  const p = Math.pow(3, -k);
  const lg = z => {
    const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012,
      9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lg(1 - z);
    z -= 1; let x = 0.99999999999980993;
    for (let i = 0; i < 8; i++) x += g[i] / (z + i + 1);
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  };
  const lchoose = (n, w) => lg(n + 1) - lg(w + 1) - lg(n - w + 1);
  const p0 = Math.exp(nonces * Math.log1p(-p));
  const wmax = Math.min(nonces, Math.ceil(nonces * p + 12 * Math.sqrt(nonces * p * (1 - p)) + 40));
  let num = 0, tot = 0;
  for (let w = 1; w <= wmax; w++) {
    const pw = Math.exp(lchoose(nonces, w) + w * Math.log(p) + (nonces - w) * Math.log1p(-p));
    tot += pw; num += pw * (nonces + 1) / (w + 1);
  }
  return {
    k, meanW: nonces * p, sdW: Math.sqrt(nonces * p * (1 - p)),
    stranded: N * p0, meanFirst: num / tot,
  };
}

// ---------------------------------------------------------------- report
function report() {
  const line = '='.repeat(78);
  log('PUZZLE AUDIT — a ternary proof-of-work puzzle, exhaustive over 531,441 pairs.');
  log(line);

  log('\n--- 0. THE INSTRUMENT, BEFORE ANY CANDIDATE ---');
  {
    // The pipeline is checked against a function whose answer is known: a
    // pseudorandom table must reproduce the null model. If it does not, every
    // number below is about the pipeline. AD2 was exactly this failure.
    const rnd = digestTable(CANDIDATES.random);
    log('      a fixed PSEUDORANDOM digest table, through the same pipeline:');
    log('      k   sd(W) meas / null      stranded meas / null     firstHit meas / null');
    for (let k = 1; k <= W; k++) {
      const s = sweep(rnd, k), nl = nullModel(N, k);
      log('      ' + k + '   ' + s.sdW.toFixed(2).padStart(7) + ' / ' + nl.sdW.toFixed(2).padStart(6)
        + '       ' + String(s.stranded).padStart(8) + ' / ' + nl.stranded.toFixed(1).padStart(7)
        + '        ' + (s.meanFirst === null ? '   n/a' : s.meanFirst.toFixed(1).padStart(6))
        + ' / ' + nl.meanFirst.toFixed(1).padStart(6));
    }
    // and the mixer really is D's
    let ok = true;
    for (let i = 0; i < N; i++) if (PINV[PT[i]] !== i) ok = false;
    log('      P is a permutation and PINV inverts it: ' + ok);
  }

  log('\n--- AN1  the variance of hit counts, and the mean first hit ---');
  const tables = {};
  for (const name of ['feedforward', 'bijective', 'affine']) tables[name] = digestTable(CANDIDATES[name]);
  for (const name of ['feedforward', 'bijective', 'affine']) {
    log('\n      ' + name);
    log('      k  targets   meanW      sd(W)   null sd    ratio    firstHit   null');
    for (let k = 1; k <= W; k++) {
      const s = sweep(tables[name], k), nl = nullModel(N, k);
      log('      ' + k + '  ' + String(s.targets).padStart(7) + '  ' + s.meanW.toFixed(2).padStart(6)
        + '   ' + s.sdW.toFixed(3).padStart(8) + '  ' + nl.sdW.toFixed(2).padStart(8)
        + '   ' + (nl.sdW ? (s.sdW / nl.sdW).toFixed(3) : '-').padStart(6)
        + '   ' + (s.meanFirst === null ? '    n/a' : s.meanFirst.toFixed(1).padStart(7))
        + '  ' + nl.meanFirst.toFixed(1).padStart(6));
    }
  }

  log('\n--- AN2  two attacks, implemented ---');
  log('      k   tabulator solved   ops/solve   affine solved   ops/solve   brute force');
  for (let k = 1; k <= W; k++) {
    const t = tabulatorAttack(k), a = affineAttack(k), nl = nullModel(N, k);
    log('      ' + k + '   ' + (t.solved + '/' + N).padStart(15) + '   ' + t.opsPerSolve.toFixed(1).padStart(9)
      + '   ' + (a.solved + '/' + N).padStart(13) + '   ' + a.opsPerSolve.toFixed(1).padStart(9)
      + '   ' + nl.meanFirst.toFixed(1).padStart(11));
  }
  log('      precomputation: tabulator ' + tabulatorAttack(1).precompute
    + ' entries, affine ' + affineAttack(1).precompute + ' inversion');

  log('\n--- AN3  stranded messages ---');
  log('      k    feedforward   null    bijective   affine');
  for (let k = 1; k <= W; k++) {
    const f = sweep(tables.feedforward, k), b = sweep(tables.bijective, k),
      a = sweep(tables.affine, k), nl = nullModel(N, k);
    log('      ' + k + '   ' + String(f.stranded).padStart(11) + '  ' + nl.stranded.toFixed(1).padStart(6)
      + '   ' + String(b.stranded).padStart(9) + '  ' + String(a.stranded).padStart(7));
  }

  log('\n--- AN4  widening the nonce to twelve trits ---');
  {
    const narrow = sweep(tables.feedforward, W), wide = wideSweep(W);
    const nlN = nullModel(N, W), nlW = nullModel(N * N, W);
    log('      at k = ' + W + ', target set = 1 digest of 729:');
    log('        narrow nonce (729)      stranded ' + String(narrow.stranded).padStart(4)
      + '   mean first hit ' + narrow.meanFirst.toFixed(1).padStart(7)
      + '   null ' + nlN.meanFirst.toFixed(1));
    log('        wide nonce (531,441)    stranded ' + String(wide.stranded).padStart(4)
      + '   mean first hit ' + wide.meanFirst.toFixed(1).padStart(7)
      + '   null ' + nlW.meanFirst.toFixed(1));
    log('        3^k = ' + 3 ** W);
  }

  log('\n--- beyond the registration: what the low variance at k = 1 and 2 WAS ---');
  {
    log('      h(m,n) = g(m + n) + m  with g(u) = P(u) - u,  on all ' + (N * N).toLocaleString()
      + ' pairs: ' + shiftIdentity());
    const index = gIndex();
    log('      so the message commutes out. g has an image of ' + index.size + ' of ' + N
      + ' digests,');
    log('      leaving ' + (N - index.size) + ' unreachable — and AN3 counted '
      + sweep(tables.feedforward, W).stranded + ' stranded messages at k = ' + W + '.');
    log('');
    log('      k   solved   declared unmineable   lookups/message   brute force   agrees');
    for (let k = 1; k <= W; k++) {
      const a = shiftAttack(k, index), nl = nullModel(N, k);
      const ag = attackAgreesWithSweep(k, tables.feedforward);
      log('      ' + k + '   ' + (a.solved + '/' + N).padStart(7) + '   '
        + String(a.unmineable).padStart(19) + '   ' + a.lookupsPerMessage.toFixed(2).padStart(15)
        + '   ' + nl.meanFirst.toFixed(1).padStart(11)
        + '   ' + String(ag.agrees).padStart(6));
    }
    log('\n      THE FIX, which confirms the cause by removing the symptom: key the');
    log('      permutation with the message instead of adding it to the data path.');
    const kt = digestTable(keyedDM);
    log('      k   sd(W)    null sd   ratio    firstHit    null   stranded   null');
    for (let k = 1; k <= W; k++) {
      const s = sweep(kt, k), nl = nullModel(N, k);
      log('      ' + k + '   ' + s.sdW.toFixed(3).padStart(6) + '   ' + nl.sdW.toFixed(2).padStart(7)
        + '   ' + (s.sdW / nl.sdW).toFixed(3).padStart(6)
        + '   ' + (s.meanFirst === null ? 'n/a' : s.meanFirst.toFixed(1)).padStart(9)
        + '   ' + nl.meanFirst.toFixed(1).padStart(6)
        + '   ' + String(s.stranded).padStart(8) + '   ' + nl.stranded.toFixed(1).padStart(5));
    }
    let shiftable = false;
    {
      const seen = new Map();
      outer: for (const m of VALS) for (const n of VALS) {
        const u = idx(tadd(m, n)), d = idx(tsub(val(keyedDM(m, n)), m));
        if (!seen.has(u)) seen.set(u, d);
        else if (seen.get(u) !== d) { shiftable = false; break outer; }
        shiftable = true;
      }
    }
    log('      the message still commutes out as a shift: ' + shiftable);
  }
  log('\n' + line);
}

if (MAIN) report();

module.exports = {
  W, N, ROUNDS, VALS, idx, val, tadd, tsub, rotn, S27, splitRound, P, PT, PINV,
  A, KAPPA, AINV_MINUS_I, CANDIDATES, digestTable, targetMask, sweep,
  tabulatorAttack, affineAttack, wideSweep, nullModel, report,
  gShift, shiftIdentity, gIndex, shiftAttack, attackAgreesWithSweep, keyedDM, lo, hi, pack,
};
