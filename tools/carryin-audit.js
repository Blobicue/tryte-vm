'use strict';
/* CARRY-IN AUDIT — the pass-count rule off its own scope line.
 *
 * Set `AW`. `F` derived where the decoded adder's 128/243 comes from and checked it
 * exhaustively, and its measured record carries a scope clause in its own words:
 *
 *     "scope: carry-in 0 throughout; with a non-zero carry-in the bottom position
 *      can save as well (six of its nine digit-pairs qualify) and the walk is a
 *      different one"
 *
 * So `F` named this set's question and declined to answer it. `Y1` and `E1` sampled
 * carry-in +1 and -1 at stride 11 -- one pair in 121 -- and every restored variant in
 * `Z` is sampled at that stride too. The reason was never the question: at the oracle's
 * speed the six sweeps below are most of a day. `AV` built and proved a solver that
 * does them in about an hour, and then deliberately did not spend it. This spends it.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * THE RULE, as `F` states it. Write s_i = a_i + b_i and carry(x) = shiftRight(x, 1).
 * Cell i produces its carry one pass early exactly when
 *
 *     c_i != 0   AND   carry(s_i + c_i) == carry(s_i)
 *
 * At carry-in 0, position 0 can never satisfy it, because c_0 = 0. Position 5's saving
 * buys nothing, because the sum tree never settles early (`F2`, checked over both
 * non-zero carries already). That leaves positions 1..4 constrained, a start vector of
 * (1, 7, 1) for position 0's nine unconstrained pairs, four applications of the
 * transfer matrix, and a factor of nine for the free top digit: 251,505.
 *
 * WHAT A NON-ZERO CARRY-IN CHANGES, and it is one thing. Position 0's carry is no
 * longer 0, so position 0 becomes a CONSTRAINED position like any other. The walk
 * therefore starts from the single determined state c_0 = cin rather than from a
 * distribution over nine pairs, and runs FIVE applications rather than four. Nothing
 * else moves: the matrix is `F`'s, unchanged, and the factor of nine for position 5 is
 * unchanged.
 *
 * THE MATRIX IS `F`'s, restated so this set is readable on its own:
 *
 *        from     -> -1    -> 0    -> +1     total
 *          0         1        7        1        9
 *         -1         2        1        0        3
 *         +1         0        1        2        3
 *
 * THE WALK, HAND-COMPUTED BEFORE THE RUN. Carry-in +1 starts at (0, 0, 1):
 *
 *     w0 = (0, 0, 1)            sum 1
 *     w1 = (0, 1, 2)            sum 3
 *     w2 = (1, 9, 5)            sum 15
 *     w3 = (11, 69, 19)         sum 99
 *     w4 = (91, 513, 107)       sum 711
 *     w5 = (695, 3789, 727)     sum 5211
 *
 * and 9 x 5211 = 46,899. Carry-in -1 starts at (1, 0, 0) and gives the reverse of
 * every vector, the same sums, and the same 46,899.
 *
 * THE METHOD WAS CONTROLLED BEFORE IT WAS EXTENDED. Run on `F`'s own starting vector
 * it returns 251,505, which is `F3`'s measured number. A derivation that could not
 * reproduce the case already on the record would not be worth registering on the case
 * that is not.
 *
 * FIXED, and not at risk:
 *   - The subject is `dRippleAdder(net, 6)`, the decoded adder, 540 switches. `E1`
 *     swept it exhaustively at carry-in 0; this sweeps the two carry-ins it sampled.
 *   - The pass count of a pair is the smallest k at which `solve` settles, probed as
 *     every pass count in `results/` was: solve at k, and again at k-1, which must
 *     throw. Two solves per pair.
 *   - R2 from `AV` is the instrument, and the gate `AV` built is re-run here before
 *     any count below is read. An instrument proved on one branch is not proved on
 *     this one.
 *   - All 531,441 pairs at each carry-in. No stride anywhere in this set.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 * Everything below is DERIVED BY HAND from the rule above; the run checks the
 * derivation, exactly as `F1` through `F4` were checked.
 *
 *   AW1 THE RULE SURVIVES, WITH POSITION 0 ADMITTED AND NOTHING ELSE CHANGED. For all
 *       531,441 pairs at carry-in +1 and all 531,441 at carry-in -1, the solver's pass
 *       count equals 13 minus the number of positions i in 0..4 satisfying `F`'s
 *       condition. Pair by pair, not in aggregate.
 *       AT RISK: `F` established the rule only where position 0 is inert, so this
 *       moves it onto the one position whose behaviour was never exercised. Position 0
 *       is the boundary cell -- its carry comes from outside the adder rather than from
 *       another cell -- and if the carry-in arrives already determined while an
 *       internal carry does not, the detector timing that the whole rule turns on is
 *       different there and the condition can hold while the saving does not happen.
 *       `E4` already failed once by predicting a pass count for this adder. Refuted by
 *       a single disagreeing pair.
 *
 *   AW2 AND THE WALK GIVES 46,899. Exactly 46,899 of the 531,441 pairs take the full
 *       13 passes at carry-in +1, and exactly 46,899 at carry-in -1.
 *       AT RISK: this is one number from five matrix applications and it is refuted by
 *       being off by one. It is not implied by AW1 -- AW1 could hold pair by pair while
 *       this is wrong, if the number of constrained positions is four rather than five
 *       because position 0's saving is real but does not cost a pass. That is the
 *       likeliest way to be wrong and it lands here rather than on AW1.
 *
 *   AW3 THE TWO CARRY-INS ARE EXACT MIRRORS. The pass-count distribution at carry-in
 *       -1 is identical to the one at carry-in +1, bin for bin, and the carry-state
 *       vectors are reverses: (695, 3789, 727) against (727, 3789, 695).
 *       AT RISK: negating both operands and the carry-in maps one sweep onto the other
 *       and balanced ternary has no sign bit, so the symmetry ought to be exact -- but
 *       it is a claim about the DEVICE, not about the arithmetic. `sti` is four
 *       switches and `nti`/`pti` are two, the n-type and p-type thresholds are not
 *       placed symmetrically about MID, and the decoded selector's detector pulls LOW
 *       and HIGH both to vss. A device model asymmetric in the sign is the ordinary
 *       case, not the exotic one, and any single bin differing refutes this.
 *
 *   AW4 AND THE FLOOR DROPS BY ONE. The minimum pass count over the sweep is 8 at both
 *       non-zero carry-ins, against 9 at carry-in 0, because a fifth position can now
 *       save; and at least one pair attains it.
 *       AT RISK: refuted if the floor stays at 9, which is what happens if position 0's
 *       saving is unrealisable in the device for the reason AW1's risk line describes,
 *       and refuted equally if the floor drops below 8, which is what happens if
 *       position 5 can save after all at a non-zero carry-in -- `F2` checked eighteen
 *       of eighteen digit-pairs and both non-zero carries, so that would overturn `F2`
 *       rather than merely surprise this set.
 *
 * NOT REGISTERED — derivable, already on the record, or measured while building the
 * instrument, and listed so the registered set is not inflated:
 *   - That the decoded adder still computes `T.add` at both non-zero carry-ins. `E1`
 *     proved the cell exhaustively over all 27 input triples and the ripple chains
 *     cells, so correctness follows by induction; the sweep reports it and it is not a
 *     prediction. The same applies to the tree adder and to every restored variant.
 *   - That the tree adder's pass count stays 7 at a non-zero carry-in. `Y2` derived it
 *     from gate-dependency depth, which does not mention the data.
 *   - 251,505 at carry-in 0. That is `F3`, reproduced here only as a control on the
 *     method before it was extended.
 *   - The wall-clock of the sweeps. `AV` priced the instrument; this set spends it.
 *
 * Run:  npm run audit:carryin
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

/* ---------------------------------------------------------------- the derivation
 *
 * F's transfer matrix, and the walk over it. This is arithmetic, not measurement:
 * it is the content of AW2 and AW3 and it runs before anything is solved. Kept as
 * code rather than as a comment so the registered numbers and the numbers the run
 * is checked against cannot drift apart.
 */
const STEP = v => [
  2 * v[0] + 1 * v[1] + 0 * v[2],
  1 * v[0] + 7 * v[1] + 1 * v[2],
  0 * v[0] + 1 * v[1] + 2 * v[2],
];
const SUM = v => v[0] + v[1] + v[2];

/** The walk. `start` is the carry state before position 0; `n` applications. */
function walk(start, n) {
  const trail = [start];
  let v = start;
  for (let i = 0; i < n; i++) { v = STEP(v); trail.push(v); }
  return { trail, full: SUM(v) * 9 };
}

/* Carry-in 0 is F's own case and is the CONTROL: position 0 is unconstrained, so the
 * walk starts from its nine pairs sorted by the carry they produce and runs four
 * times. It must return F3's measured 251,505. */
const CONTROL = walk([1, 7, 1], 4);

/* A non-zero carry-in makes position 0 constrained like any other, so the walk starts
 * from the single determined state and runs five times. */
const PLUS = walk([0, 0, 1], 5);
const MINUS = walk([1, 0, 0], 5);

// ---------------------------------------------------------------- the measurement

const T = require('../src/ternary.js');
const D = require('../src/device.js');
const W = require('../src/wasm-emit.js');
const SW = require('../src/solver-wasm.js');
const NP = require('../src/netpack.js');
const SA = require('./solver-audit.js');

const { hdr, at4, at1 } = SW;
const carry = x => T.shiftRight(x, 1);
const comma = x => x.toLocaleString('en-US');

/* ------------------------------------------------------------------- the rule
 *
 * `F`'s condition, with the first position allowed to save left OPEN.
 *
 *   from = 1  is `F`'s rule exactly as `F1` published it -- positions 1..n-2 -- with
 *             the carry-in SEEDED rather than assumed zero. Nothing here is fitted:
 *             it is already in `tools/passcount-audit.js`, and at cin = 0 the two are
 *             the same function, which section 0 checks over all 531,441 pairs.
 *   from = 0  is AW1's amendment, admitting position 0. That is the REGISTERED claim.
 *
 * Both are run over the whole sweep. Scoring the registered one needs the other only
 * to say what the pass count actually is where they differ, and the oracle is asked
 * directly for a sample of those rather than inferred from the pair.
 */
function passesUnder(a, b, n, cin, from) {
  const A = T.toTrits(a, n), B = T.toTrits(b, n);
  let c = cin, saved = 0;
  for (let i = 0; i < n; i++) {
    const s = A[i] + B[i];
    if (i >= from && i < n - 1 && c !== 0 && carry(s + c) === carry(s)) saved++;
    c = carry(s + c);
  }
  return (2 * n + 1) - saved;
}

/** The carry entering position `i`, by arithmetic, for checking the node against. */
function carryInto(a, b, n, cin, i) {
  const A = T.toTrits(a, n), B = T.toTrits(b, n);
  let c = cin;
  for (let k = 0; k < i; k++) c = carry(A[k] + B[k] + c);
  return c;
}

/**
 * `F`'s transfer matrix, DERIVED from the adder's own tables rather than read off
 * the registration. `F3` derived it inside its own check for the same reason, and
 * `T-TRANSCRIBED-TABLE` is on the record because a detector's table was hand-copied
 * once and inverted: a value that can be RUN is not copied. Section 0 holds this
 * against the `STEP` the registration hardcoded, so a transcription slip in the
 * registered walk is a failed check rather than a wrong number nobody looks at.
 */
function derivedMatrix() {
  const STATES = [-1, 0, 1];
  return STATES.map(c => {
    const row = { '-1': 0, 0: 0, 1: 0 };
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const s = a + b;
        if (c !== 0 && carry(s + c) === carry(s)) continue;   // this pair would save
        row[carry(s + c)] += 1;
      }
    }
    return STATES.map(x => row[x]);
  });
}

/** Position 0's nine digit-pairs sorted by the carry they hand to position 1. */
function startVector(cin) {
  const v = [0, 0, 0];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) v[carry(a + b + cin) + 1]++;
  return v;
}

/* --------------------------------------------------------------- the driver
 *
 * `probe(codesPtr, kPtr, pairCount, outIdsPtr, outCount, outPtr, flagsPtr)` -- the
 * pass-count probe, INSIDE the module, so the boundary is crossed once per chunk
 * rather than twice per pair.
 *
 * TWO SOLVES PER PAIR, which is how every pass count in `results/` was probed and
 * what the registration fixed: seed, solve at k, seed AGAIN, solve at k-1. The
 * re-seed is the whole of the correctness of this function. Without it the second
 * solve starts from the settled state the first one left, converges in one pass and
 * reports "settles at k-1" for every pair alive -- a clean, total, mechanistic-looking
 * refutation of whatever rule was being checked. `T-INSTRUMENT-FALSE-VERDICT`.
 *
 * The outputs are read BETWEEN the two solves, because the k-1 solve overwrites the
 * value array with a state that did not settle.
 *
 * Flags per pair: bit 0 settled at k, bit 1 settled at k-1. So 1 -- and only 1 --
 * is "takes exactly k passes". The return is how many pairs were NOT 1, which is a
 * measurement and so is counted rather than thrown, exactly as `sweep` counts its
 * own non-settlers.
 */
const probeFn = W.fn('probe', {
  params: ['codesPtr', 'kPtr', 'pairCount', 'outIdsPtr', 'outCount', 'outPtr', 'flagsPtr'],
  results: ['i32'],
  locals: ['p', 'j', 'k', 'f', 'off', 'unconfirmed', 'inputCount', 'valueP'],
  body: [
    W.set('inputCount', hdr('inputCount')),
    W.set('valueP', hdr('value')),
    W.set('unconfirmed', W.konst(0)),
    ...W.forUpTo('p', W.konst(0), W.get('pairCount'), [
      W.set('off', W.add(W.get('codesPtr'), W.mul(W.get('p'), W.get('inputCount')))),
      W.set('k', W.load32(at4('kPtr', W.get('p')))),
      W.callStmt('seedCodes', [W.get('off')]),
      W.set('f', W.call('solve', [W.get('k')])),
      ...W.forUpTo('j', W.konst(0), W.get('outCount'), [
        W.store8(W.add(W.get('outPtr'),
          W.add(W.mul(W.get('p'), W.get('outCount')), W.get('j'))),
        W.load8u(at1('valueP', W.load32(at4('outIdsPtr', W.get('j')))))),
      ]),
      W.callStmt('seedCodes', [W.get('off')]),
      W.set('f', W.add(W.get('f'),
        W.shl(W.call('solve', [W.sub(W.get('k'), W.konst(1))]), W.konst(1)))),
      W.store8(at1('flagsPtr', W.get('p')), W.get('f')),
      W.ifThen(W.ne(W.get('f'), W.konst(1)),
        [W.set('unconfirmed', W.add(W.get('unconfirmed'), W.konst(1)))]),
    ]),
    W.ret(W.get('unconfirmed')),
  ],
});

/**
 * The module `AW` sweeps with: `AV`'s four functions unchanged, plus the probe.
 * `makeR2()` with no argument still emits `AV`'s 1,386 bytes, which `test-solver.js`
 * pins -- this is a fifth function appended, not an edit to the four. Section 0 runs
 * `AV`'s gate over THIS module, not only over the stock one, because the module that
 * does the sweeping is the one that has to have been held against the oracle.
 */
let INSTANCE = null;
async function instrument() {
  if (!INSTANCE) {
    INSTANCE = await SW.makeR2({ fns: [...SW.FUNCS, probeFn],
      exports: [...SW.EXPORTS, 'probe'] });
  }
  return INSTANCE;
}

const CHUNK = 1 << 14;

/**
 * Run the probe over `pairCount` pairs of one network, in chunks.
 *
 * `codesAt(u8, at, i)` writes pair `i`'s input codes, `kFor(i)` is the pass count to
 * probe, and `onPair(i, flags, u8, outAt)` reads the result back. The reservation
 * happens once, up front, for the largest block this sweep asks for, so no view here
 * is held across a `memory.grow` that would detach it.
 */
function probeSweep(inst, P, opts) {
  const { pairCount, codesAt, kFor, outIds, onPair, chunk = CHUNK } = opts;
  const ic = P.inputId.length, oc = outIds.length;
  const n = Math.min(chunk, pairCount);
  const need = n * ic + 4 * n + 4 * oc + n * oc + n + 64;
  const { base, u8, i32 } = inst.reserve(P, need);
  let at = base;
  const codesPtr = at; at += n * ic; at = (at + 3) & ~3;
  const kPtr = at; at += 4 * n;
  const outIdsPtr = at; at += 4 * oc;
  const outPtr = at; at += n * oc;
  const flagsPtr = at;
  i32.set(outIds, outIdsPtr >> 2);

  let unconfirmed = 0;
  for (let i0 = 0; i0 < pairCount; i0 += n) {
    const m = Math.min(n, pairCount - i0);
    for (let p = 0; p < m; p++) {
      codesAt(u8, codesPtr + p * ic, i0 + p);
      i32[(kPtr >> 2) + p] = kFor(i0 + p);
    }
    unconfirmed += inst.exports.probe(codesPtr, kPtr, m, outIdsPtr, oc, outPtr, flagsPtr);
    for (let p = 0; p < m; p++) onPair(i0 + p, u8[flagsPtr + p], u8, outPtr + p * oc);
  }
  return unconfirmed;
}

/* ------------------------------------------------------------- the networks */

const TERN_IN = [...Array.from({ length: 6 }, (_, i) => `a${i}`),
  ...Array.from({ length: 6 }, (_, i) => `b${i}`), 'cin'];
const TERN_PAIRS = 531441;
const BIN_W = 10;
const BIN_IN = [...Array.from({ length: BIN_W }, (_, i) => `a${i}`),
  ...Array.from({ length: BIN_W }, (_, i) => `b${i}`), 'cin'];
const BIN_PAIRS = 1 << (2 * BIN_W);

/** Pair index to operands, in `fullSweep`'s order: a outer from TRYTE_MIN, b inner. */
const aOf = i => T.TRYTE_MIN + Math.floor(i / 729);
const bOf = i => T.TRYTE_MIN + (i % 729);

/** One ternary pair's thirteen input codes, by index rather than by object. */
const ternCodes = cin => (u8, at, i) => {
  const A = T.toTrits(aOf(i), 6), B = T.toTrits(bOf(i), 6);
  for (let t = 0; t < 6; t++) { u8[at + t] = A[t] + 3; u8[at + 6 + t] = B[t] + 3; }
  u8[at + 12] = cin + 3;
};

const idsOf = (P, names) => Int32Array.from(names.map(nm => NP.nodeId(P, nm)));

/** A packed output byte back to a trit, or null if it is Z or X. */
const level = c => (c >= 2 ? c - 3 : null);

/** The overflow trit: the carry out of the top position. */
const overflow = (a, b, cin) => { const s = a + b + cin; return (s - T.wrap(s)) / 729; };

const distObject = d => Object.fromEntries([...d.keys()].sort((x, y) => x - y)
  .map(k => [k, d.get(k)]));
const distString = d => [...d.keys()].sort((x, y) => x - y)
  .map(k => `${k}:${comma(d.get(k))}`).join('  ');
const sameDist = (x, y) => JSON.stringify(distObject(x)) === JSON.stringify(distObject(y));

/**
 * One ternary sweep: pairs at one carry-in, probed against `rule`.
 *
 * Correctness is REPORTED, not predicted -- the registration lists it under NOT
 * REGISTERED, because both adder cells are exhaustive over all 27 input triples
 * already and a ripple chains cells. It is swept anyway, because a sweep that reads
 * outputs and does not check them is a sweep whose results nothing reads.
 */
function ternarySweep(inst, P, outIds, cin, rule, opts = {}) {
  const { pairCount = TERN_PAIRS, indexOf = i => i, wantC5 = true } = opts;
  const dist = new Map(), byCarry = new Map(), flags = new Map();
  const bad = [];
  let wrongSum = 0, wrongCarry = 0, wrongC5 = 0, confirmed = 0;
  const t0 = process.hrtime.bigint();
  probeSweep(inst, P, {
    pairCount,
    outIds,
    codesAt: (u8, at, p) => ternCodes(cin)(u8, at, indexOf(p)),
    kFor: p => rule(aOf(indexOf(p)), bOf(indexOf(p))),
    onPair: (p, f, u8, o) => {
      const i = indexOf(p), a = aOf(i), b = bOf(i), k = rule(a, b);
      flags.set(f, (flags.get(f) || 0) + 1);
      if (f === 1) { confirmed++; dist.set(k, (dist.get(k) || 0) + 1); }
      else if (bad.length < 8) bad.push({ a, b, k, f });
      // The outputs are the k-solve's, whether or not k turned out to be the right k.
      const trits = [];
      for (let j = 0; j < 6; j++) trits.push(level(u8[o + j]));
      const c6 = level(u8[o + 6]);
      if (trits.some(x => x === null) || T.fromTrits(trits) !== T.wrap(a + b + cin)) wrongSum++;
      if (c6 !== overflow(a, b, cin)) wrongCarry++;
      if (wantC5) {
        const c5 = level(u8[o + 7]);
        if (c5 !== carryInto(a, b, 6, cin, 5)) wrongC5++;
        if (k === 13 && f === 1) byCarry.set(c5, (byCarry.get(c5) || 0) + 1);
      }
    },
  });
  return { seconds: Number(process.hrtime.bigint() - t0) / 1e9, pairCount,
    confirmed, unconfirmed: pairCount - confirmed, dist, byCarry, flags, bad,
    wrongSum, wrongCarry, wrongC5 };
}

/** The binary sweep, at one carry-in and one stride, against a constant pass count. */
function binarySweep(inst, P, outIds, cin, k, stride) {
  const side = Math.ceil((1 << BIN_W) / stride);
  const pairCount = side * side;
  const mask = (1 << BIN_W) - 1;
  const xOf = p => (Math.floor(p / side) * stride) & mask;
  const yOf = p => ((p % side) * stride) & mask;
  const flags = new Map();
  let wrong = 0, confirmed = 0;
  const bad = [];
  const t0 = process.hrtime.bigint();
  probeSweep(inst, P, {
    pairCount,
    outIds,
    codesAt: (u8, at, p) => {
      const x = xOf(p), y = yOf(p);
      for (let i = 0; i < BIN_W; i++) {
        u8[at + i] = (((x >> i) & 1) ? 1 : -1) + 3;
        u8[at + BIN_W + i] = (((y >> i) & 1) ? 1 : -1) + 3;
      }
      u8[at + 2 * BIN_W] = cin + 3;
    },
    kFor: () => k,
    onPair: (p, f, u8, o) => {
      flags.set(f, (flags.get(f) || 0) + 1);
      if (f === 1) confirmed++; else if (bad.length < 8) bad.push({ x: xOf(p), y: yOf(p), f });
      const x = xOf(p), y = yOf(p);
      let got = 0, ok = true;
      for (let i = 0; i < BIN_W; i++) {
        const v = level(u8[o + i]);
        if (v === null) ok = false; else if (v === 1) got |= (1 << i);
      }
      const total = x + y + (cin === 1 ? 1 : 0);
      if (!ok || got !== (total & mask) || level(u8[o + BIN_W]) !== (total > mask ? 1 : -1)) wrong++;
    },
  });
  return { seconds: Number(process.hrtime.bigint() - t0) / 1e9, pairCount, stride,
    confirmed, unconfirmed: pairCount - confirmed, flags, bad, wrong };
}

/** The oracle, asked directly: the smallest k at which `src/device.js` settles. */
function oraclePasses(net, inputs, cap = 80) {
  for (let k = 1; k <= cap; k++) {
    try { net.solve(inputs, k); return k; } catch (e) { /* not yet */ }
  }
  return null;
}
const ternInputs = (a, b, cin) => ({
  ...Object.fromEntries(T.toTrits(a, 6).map((t, i) => [`a${i}`, t])),
  ...Object.fromEntries(T.toTrits(b, 6).map((t, i) => [`b${i}`, t])),
  cin,
});

/**
 * WHEN each carry node first holds a level, pass by pass. This is the MECHANISM
 * behind whatever AW1 turns out to say, and it is measured rather than argued:
 * `E4` established that a position saves a pass when its carry's raw value is known
 * while that carry's MID detector is not, so "does position 0 save" is answerable by
 * watching the node rather than only by counting passes at the far end. It also
 * separates the two ways AW1 can fail -- a saving that does not HAPPEN, and a saving
 * that happens and costs nothing, which is what `F2` found at the top position.
 */
function arrivalProfile(P, watchIds, watchNames, inputs, cap = 20) {
  const at = {};
  for (let k = 1; k <= cap; k++) {
    NP.seed(P, inputs, {});
    NP.run(P, k);
    watchNames.forEach((nm, j) => {
      if (at[nm] === undefined && P.value[watchIds[j]] >= 2) at[nm] = k;
    });
  }
  return at;
}

/* =============================================================== the measurement */

// Y1's stride cubed. Coprime to 3^12, so a strided index still moves BOTH operands
// rather than sweeping one with the other pinned, and the whole quick run costs
// seconds -- AGENTS.md asks the most expensive sweep for a cap, and `leafmid` is it.
const QUICK_STRIDE = 1331;

/**
 * Everything the run computes. `quick` strides the sweeps so every print path below
 * executes in seconds -- `test-carryin.js` spawns the tool and a check that costs the
 * whole audit is a check nobody runs. Nothing in quick mode is a measurement, and the
 * banner says so, exactly as `solver-audit.js --quick` does.
 */
async function runAudit({ quick = false } = {}) {
  const inst = await instrument();
  const A = { quick, module_bytes: inst.bytes.length,
    stock_module_bytes: SW.moduleBytes().length };

  const stride = quick ? QUICK_STRIDE : 1;
  const ternCount = quick ? Math.ceil(TERN_PAIRS / stride) : TERN_PAIRS;
  const ternIndex = quick ? (i => i * stride) : (i => i);
  const sweepOpts = { pairCount: ternCount, indexOf: ternIndex };

  /* --- 0. the instrument ----------------------------------------------------- */

  const dec = new D.Net(); D.dRippleAdder(dec, 6);
  const decP = NP.pack(dec, TERN_IN);
  const decOut = idsOf(decP, ['s0', 's1', 's2', 's3', 's4', 's5', 'c6', 'c5']);
  A.subject = { switches: dec.cost().switches, nodes: decP.nodeCount,
    mid_rail_connections: dec.cost().midRailConnections };

  // AV's gate, on THIS branch, and on BOTH modules: the stock one AV proved, and the
  // one with the probe appended, which is the module that actually does the sweeping.
  const stock = await SA.makeR2();
  const probeSolve = (net, names, inputs, cap, init) =>
    inst.solveNamed(SA.packedFor(net, names), inputs, cap, init);
  A.gate = {};
  for (const [nm, solve] of [['R2', SA.R2], ['R2+probe', probeSolve]]) {
    const g = SA.runGate(solve), p = SA.passAgreement(solve);
    A.gate[nm] = { networks: g.groups, rows: g.rows, values: g.values,
      refusals_matched: g.threwBoth, divergences: g.diffs.length + p.bad.length,
      states: [...g.coverage].map(x => JSON.stringify(x)).sort().join(' '),
      pass_cases: p.checked, pass_settling: p.settles, pass_never_settling: p.never,
      diffs: [...g.diffs.slice(0, 5), ...p.bad.slice(0, 5)] };
  }
  A.gate.stock_exports = WebAssembly.Module.exports(new WebAssembly.Module(SW.moduleBytes()))
    .map(e => `${e.name}:${e.kind}`).sort().join(' ');

  // The registered walk, controlled on F's own case, and the matrix DERIVED.
  A.control_walk = CONTROL.full;
  A.derived_matrix = derivedMatrix();
  A.registered_matrix = [[2, 1, 0], [1, 7, 1], [0, 1, 2]];
  A.matrix_agrees = JSON.stringify(A.derived_matrix) === JSON.stringify(A.registered_matrix)
    && JSON.stringify(STEP([1, 0, 0])) === JSON.stringify(A.derived_matrix[0])
    && JSON.stringify(STEP([0, 1, 0])) === JSON.stringify(A.derived_matrix[1])
    && JSON.stringify(STEP([0, 0, 1])) === JSON.stringify(A.derived_matrix[2]);

  // The probe against the GATED path: the same two solves, done through the entry the
  // gate compared against the oracle. The probe is a fifth function nothing has held
  // against anything yet, and the sweeps below are all it.
  {
    let checked = 0, disagree = 0;
    const rule = (a, b) => passesUnder(a, b, 6, 1, 0);
    probeSweep(inst, decP, {
      pairCount: 300, outIds: decOut,
      codesAt: (u8, at, p) => ternCodes(1)(u8, at, p * 1777),
      kFor: p => rule(aOf(p * 1777), bOf(p * 1777)),
      onPair: (p, f) => {
        const i = p * 1777, a = aOf(i), b = bOf(i), k = rule(a, b);
        const ins = ternInputs(a, b, 1);
        const settles = kk => {
          try { inst.solveNamed(decP, ins, kk); return true; } catch (e) { return false; }
        };
        const want = (settles(k) ? 1 : 0) + (settles(k - 1) ? 2 : 0);
        checked++;
        if (want !== f) disagree++;
      },
    });
    A.probe_vs_gated_path = { checked, disagree };
  }

  // MUTATION. Probing at k+1 must report "settles at k+1 AND settles at k", flag 3;
  // probing at k-1 must report "did not settle at k-1", flag 0 or 2. A probe that
  // could not tell those apart is a probe that cannot refute anything.
  {
    const rule = (a, b) => passesUnder(a, b, 6, 1, 1);
    const run = delta => {
      const seen = new Map();
      probeSweep(inst, decP, {
        pairCount: 200, outIds: decOut,
        codesAt: (u8, at, p) => ternCodes(1)(u8, at, p * 2657),
        kFor: p => rule(aOf(p * 2657), bOf(p * 2657)) + delta,
        onPair: (p, f) => seen.set(f, (seen.get(f) || 0) + 1),
      });
      return distObject(seen);
    };
    A.mutation = { at_k: run(0), at_k_plus_1: run(1), at_k_minus_1: run(-1) };
  }

  /* --- the control sweep, at carry-in 0 -------------------------------------- */
  //
  // F1's own case, run through THIS driver. It has to reproduce F1's distribution bin
  // for bin and F3's 251,505 -- a driver that cannot reproduce the case already on the
  // record is no evidence about the case that is not. It also grounds AW4's "9 at
  // carry-in 0" in this run rather than in the record, and it is the check that the
  // rule below collapses to F's exactly when the carry-in is zero.
  A.control = ternarySweep(inst, decP, decOut, 0, (a, b) => passesUnder(a, b, 6, 0, 0),
    sweepOpts);
  A.control_reference = { 9: 108, 10: 4428, 11: 54108, 12: 221292, 13: 251505 };
  A.control_matches = !quick
    && JSON.stringify(distObject(A.control.dist)) === JSON.stringify(A.control_reference);

  /* --- AW1..AW4: the two non-zero carry-ins ---------------------------------- */

  A.sweeps = {};
  for (const cin of [1, -1]) {
    const key = cin > 0 ? 'plus' : 'minus';
    // The REGISTERED rule, with position 0 admitted. This is what AW1 claims.
    const registered = ternarySweep(inst, decP, decOut, cin,
      (a, b) => passesUnder(a, b, 6, cin, 0), sweepOpts);
    // F's rule UNCHANGED, seeded with the carry-in. Not a prediction of this set: it
    // is what the sweep had to fall back on to say what the pass count actually is.
    const measured = ternarySweep(inst, decP, decOut, cin,
      (a, b) => passesUnder(a, b, 6, cin, 1), sweepOpts);
    // How the registered rule is wrong, where it is wrong: by how many passes.
    const delta = new Map();
    for (let p = 0; p < ternCount; p++) {
      const i = ternIndex(p), a = aOf(i), b = bOf(i);
      const d = passesUnder(a, b, 6, cin, 1) - passesUnder(a, b, 6, cin, 0);
      delta.set(d, (delta.get(d) || 0) + 1);
    }
    // THE ORACLE, on a sample of the pairs the registered rule got wrong. Suspect the
    // instrument first: R0 is src/device.js and is what every earlier sweep used.
    const oracle = [];
    for (const c of registered.bad.slice(0, 6)) {
      const k = oraclePasses(dec, ternInputs(c.a, c.b, cin));
      oracle.push({ a: c.a, b: c.b, registered_k: c.k,
        corrected_k: passesUnder(c.a, c.b, 6, cin, 1),
        oracle_k: k === null ? 'did not settle inside the cap' : k });
    }
    A.sweeps[key] = { cin, registered, measured, delta: distObject(delta), oracle };
  }

  // The walk, run on the start vector the CORRECTED rule implies: position 0 free and
  // four constrained positions, which is F's own shape with a different start.
  A.corrected_walk = {};
  for (const cin of [1, -1]) {
    const key = cin > 0 ? 'plus' : 'minus';
    A.corrected_walk[key] = walk(startVector(cin), 4);
  }

  /* --- the mechanism: when does each carry arrive? --------------------------- */
  //
  // Exhaustive over the same 18 combinations F2 used -- nine digit-pairs by two
  // non-zero carries -- at position 0, and the same 18 at position 1 as the positive
  // control. A check that only ever saw position 0 could not tell "the saving never
  // happens here" from "this instrument cannot see a saving at all".
  {
    // The DETECTORS are watched alongside the carries, because the mechanism claim is
    // about them and a claim about them is not measured by watching only the carries.
    // E4: a position saves when its carry's raw value is known while that carry's MID
    // detector is not -- and the early leaf that buys is only usable if the selectors
    // ABOVE it, gated by the operand detectors, have already resolved. So the quantity
    // that decides it is the GAP between the operand detectors and the carry's own.
    const watchNames = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 's5',
      'cin$im', 'a0$im', 'b0$im', 'c1$im', 'a1$im', 'b1$im'];
    const watchIds = watchNames.map(nm => NP.nodeId(decP, nm));
    const rows = [];
    for (const cin of [1, -1]) {
      for (let a0 = -1; a0 <= 1; a0++) {
        for (let b0 = -1; b0 <= 1; b0++) {
          const s = a0 + b0;
          const qualifies = carry(s + cin) === carry(s);
          const ins = ternInputs(0, 0, cin); ins.a0 = a0; ins.b0 = b0;
          const at = arrivalProfile(decP, watchIds, watchNames, ins);
          rows.push({ position: 0, cin, a: a0, b: b0, qualifies, arrives: at.c1,
            carry_detector: at['cin$im'],
            operand_detector: Math.max(at['a0$im'], at['b0$im']) });
        }
      }
    }
    const control = [];
    for (const c1 of [1, -1]) {
      // cin 0, and a bottom digit-pair that hands position 1 the carry c1.
      const seed = c1;                       // a0 = b0 = c1 gives carry(2*c1) = c1
      for (let a1 = -1; a1 <= 1; a1++) {
        for (let b1 = -1; b1 <= 1; b1++) {
          const s = a1 + b1;
          const qualifies = carry(s + c1) === carry(s);
          const ins = ternInputs(0, 0, 0);
          ins.a0 = seed; ins.b0 = seed; ins.a1 = a1; ins.b1 = b1;
          const at = arrivalProfile(decP, watchIds, watchNames, ins);
          control.push({ position: 1, carry_in: c1, a: a1, b: b1, qualifies,
            arrives: at.c2, carry_detector: at['c1$im'],
            operand_detector: Math.max(at['a1$im'], at['b1$im']) });
        }
      }
    }
    const early = rs => rs.filter(r => r.qualifies && r.arrives < (r.position === 0 ? 2 : 4));
    const gaps = rs => [...new Set(rs.map(r => r.carry_detector - r.operand_detector))].sort();
    A.mechanism = {
      position0_detector_gap: gaps(rows),
      position1_detector_gap: gaps(control),
      position0: rows, position1: control,
      position0_combinations: rows.length,
      position0_qualifying: rows.filter(r => r.qualifies).length,
      position0_arriving_early: early(rows).length,
      position0_arrival_passes: [...new Set(rows.map(r => r.arrives))].sort(),
      position1_combinations: control.length,
      position1_qualifying: control.filter(r => r.qualifies).length,
      position1_arriving_early: early(control).length,
      position1_arrival_when_qualifying:
        [...new Set(control.filter(r => r.qualifies).map(r => r.arrives))].sort(),
      position1_arrival_when_not:
        [...new Set(control.filter(r => !r.qualifies).map(r => r.arrives))].sort(),
    };
  }

  /* --- the closures --------------------------------------------------------- */
  //
  // NOT PREDICTIONS. Each closes a corner an earlier set disclosed as SAMPLED, and
  // each follows by induction from a cell already exhaustive over all 27 of its input
  // triples -- so they are reported and recorded as MEASURED_NOT_REGISTERED. What
  // makes them worth the machine time is that a disclosed sample is a place a defect
  // can hide, and this instrument can afford to look.
  A.closures = {};
  {
    const treeOut = ['s0', 's1', 's2', 's3', 's4', 's5', 'c6'];
    // Y1 and Y2: the selector-tree adder, sampled at stride 11 at both non-zero
    // carry-ins. Seven passes, which Y2 derived from gate-dependency depth.
    const tree = new D.Net(); D.tRippleAdder(tree, 6, false);
    const treeP = NP.pack(tree, TERN_IN);
    const treeIds = idsOf(treeP, treeOut);
    A.closures.tree = {};
    for (const cin of [1, -1]) {
      A.closures.tree[cin > 0 ? 'plus' : 'minus'] =
        ternarySweep(inst, treeP, treeIds, cin, () => 7,
          { ...sweepOpts, wantC5: false });
    }
    A.closures.tree_switches = tree.cost().switches;
    A.closures.tree_nodes = treeP.nodeCount;

    // Z4 and Z5: all three restore variants, sampled at stride 11 at carry-in 0.
    A.closures.restore = {};
    for (const [restore, k] of [['none', 7], ['mid', 19], ['leafmid', 31]]) {
      const net = new D.Net(); D.tRippleAdder(net, 6, { restore });
      const P = NP.pack(net, TERN_IN);
      const r = ternarySweep(inst, P, idsOf(P, treeOut), 0, () => k,
        { ...sweepOpts, wantC5: false });
      A.closures.restore[restore] = Object.assign(r,
        { switches: net.cost().switches, nodes: P.nodeCount, registered_passes: k });
    }

    // Z4, Z5 and adder-audit's own control: the ten-bit binary adder, sampled at
    // stride 37. Eleven passes. Binary carry-in 0 is spelled -1 in this device model.
    const bin = D.binaryNet(); D.bRippleAdder(bin, BIN_W, false);
    const binP = NP.pack(bin, BIN_IN);
    const binIds = idsOf(binP, [...Array.from({ length: BIN_W }, (_, i) => `s${i}`), `c${BIN_W}`]);
    A.closures.binary = binarySweep(inst, binP, binIds, -1, 11, quick ? 37 : 1);
    A.closures.binary.switches = bin.cost().switches;
    A.closures.binary.nodes = binP.nodeCount;
  }

  /* --- the verdicts --------------------------------------------------------- */

  const P1 = A.sweeps.plus, M1 = A.sweeps.minus;
  const kMin = s => Math.min(...s.measured.dist.keys());
  A.result = {
    aw1_disagreements: P1.registered.unconfirmed + M1.registered.unconfirmed,
    aw1_pairs: P1.registered.pairCount + M1.registered.pairCount,
    aw2_plus: P1.measured.dist.get(13) || 0,
    aw2_minus: M1.measured.dist.get(13) || 0,
    aw2_registered: PLUS.full,
    aw3_same_distribution: sameDist(P1.measured.dist, M1.measured.dist),
    // TWO UNITS, and the registration's is the second. The sweep bins PAIRS by the
    // carry entering position 5; the registered vector counts the prefixes
    // (a0..a4, b0..b4) that reach each carry state, which is the same thing divided by
    // the nine free choices of the top digit. Comparing a pair count against a prefix
    // count would report a factor of nine as a miss, so both are recorded and the
    // registered one is scored in its own units.
    aw3_carry_plus_pairs: [-1, 0, 1].map(c => P1.measured.byCarry.get(c) || 0),
    aw3_carry_minus_pairs: [-1, 0, 1].map(c => M1.measured.byCarry.get(c) || 0),
    aw3_carry_plus: [-1, 0, 1].map(c => (P1.measured.byCarry.get(c) || 0) / 9),
    aw3_carry_minus: [-1, 0, 1].map(c => (M1.measured.byCarry.get(c) || 0) / 9),
    aw4_floor_plus: kMin(P1), aw4_floor_minus: kMin(M1),
    aw4_floor_carry_in_0: Math.min(...A.control.dist.keys()),
    corrected_rule_disagreements: P1.measured.unconfirmed + M1.measured.unconfirmed,
  };
  // The top digit is free, so every prefix must carry exactly nine pairs. If that
  // did not divide, the bin would not be the quantity the registration named.
  A.result.aw3_top_digit_is_free =
    [...A.result.aw3_carry_plus, ...A.result.aw3_carry_minus].every(Number.isInteger);
  // Compared in PAIRS, which are integers whatever the sweep visited; the prefix form
  // is the registration's unit and is a division that only comes out whole on a sweep
  // that actually visited every top digit.
  A.result.aw3_carry_is_reverse =
    JSON.stringify(A.result.aw3_carry_plus_pairs) ===
    JSON.stringify([...A.result.aw3_carry_minus_pairs].reverse());
  A.result.aw3_registered_vectors_hold =
    JSON.stringify(A.result.aw3_carry_plus) === JSON.stringify(PLUS.trail[5]);
  // AW3 admits two readings and this reports both rather than picking one silently:
  // T-SCOPE-DECIDES-THE-VERDICT bit twice by letting a measurement draw a boundary
  // the prediction did not. The SYMMETRY reading is the claim's headline and its own
  // AT RISK line's refutation condition -- "any single bin differing refutes this".
  // The LITERAL reading is the whole sentence, which names two specific vectors it
  // inherited from AW2's arithmetic. The verdict below takes the literal one, on the
  // X2 and E5 precedent that a prediction with a refuted half is not trimmed to the
  // half that survived; both are on the record so a reader can overrule it.
  A.result.aw3_symmetry_reading = A.result.aw3_same_distribution
    && A.result.aw3_carry_is_reverse;
  A.result.aw3_literal_reading = A.result.aw3_symmetry_reading
    && A.result.aw3_registered_vectors_hold;
  A.verdict = {
    AW1: A.result.aw1_disagreements === 0 ? 'HELD' : 'FAILED',
    AW2: (A.result.aw2_plus === PLUS.full && A.result.aw2_minus === MINUS.full)
      ? 'HELD' : 'FAILED',
    AW3: A.result.aw3_literal_reading ? 'HELD' : 'FAILED',
    AW4: (A.result.aw4_floor_plus === 8 && A.result.aw4_floor_minus === 8
      && A.result.aw4_floor_carry_in_0 === 9) ? 'HELD' : 'FAILED',
  };
  return A;
}

/* ------------------------------------------------------------------ the report */

function report(argv = []) {
  const quick = argv.includes('--quick');
  log('CARRY-IN AUDIT: the pass-count rule off its own scope line.');
  log(line);
  if (quick) {
    log('QUICK MODE — every print path runs, the sweeps are strided, and NOTHING BELOW');
    log('IS A MEASUREMENT. `npm run audit:carryin` is the audit.');
  }
  return runAudit({ quick }).then(A => {
    const R = A.result;
    const pct = (x, n) => `${((100 * x) / n).toFixed(1)}%`;

    log('');
    log('--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
    // AV's gate, re-run on THIS branch. An instrument proved elsewhere is not proved
    // here, and every count below is R2's rather than the oracle's.
    //
    // AND THE DERIVATION IS CONTROLLED BEFORE IT IS USED: the same walk, run on F's
    // starting vector, must return F3's 251,505. A method that cannot reproduce the
    // case already on the record is not evidence about the case that is not.
    // AD2 memoised only terminating values and reported the attacker as 300x WORSE --
    // in the flattering direction, which is the direction nothing catches by surprise.
    log(`      control: F's walk reproduces ${comma(CONTROL.full)}`
      + `  (F3 measured 251,505)`);
    log(`      derived: carry-in +1 gives ${comma(PLUS.full)},`
      + ` carry-in -1 gives ${comma(MINUS.full)}`);
    log(`      subject: dRippleAdder(net, 6) — ${A.subject.switches} switches`
      + ` (E2), ${A.subject.nodes} nodes`);
    for (const nm of ['R2', 'R2+probe']) {
      const g = A.gate[nm];
      log(`      gate ${nm.padEnd(9)} ${comma(g.rows)} rows over ${g.networks} networks,`
        + ` ${comma(g.values)} node values, ${g.refusals_matched} refusals matched`);
      log(`                     states ${g.states};`
        + ` ${g.pass_settling} of ${g.pass_cases} pass counts checked at k and k-1,`
        + ` ${g.pass_never_settling} never settle`);
      log(`                     DIVERGENCES: ${g.divergences}`);
      for (const d of g.diffs.slice(0, 5)) log(`                       ${d}`);
    }
    log(`      the stock module is unchanged: ${A.stock_module_bytes} bytes,`
      + ` exports ${A.gate.stock_exports}`);
    log(`      the module that sweeps is that one plus the probe: ${A.module_bytes} bytes`);
    log(`      F's matrix, DERIVED from the adder's own tables rather than transcribed:`);
    for (const [i, c] of [[0, -1], [1, 0], [2, 1]]) {
      log(`        from ${String(c).padStart(2)}   ${A.derived_matrix[i]
        .map(x => String(x).padStart(5)).join('   ')}`);
    }
    log(`        agrees with the STEP the registration hardcoded: ${A.matrix_agrees}`);
    log(`      the probe against the gated path: ${A.probe_vs_gated_path.checked} pairs,`
      + ` ${A.probe_vs_gated_path.disagree} disagreements`);
    log(`      and the probe can refute: at k ${JSON.stringify(A.mutation.at_k)},`
      + ` at k+1 ${JSON.stringify(A.mutation.at_k_plus_1)},`
      + ` at k-1 ${JSON.stringify(A.mutation.at_k_minus_1)}`);
    log(`        (flag 1 = settles at k and not at k-1; 3 = settles at both; 0 = neither)`);
    log('');
    log(`      THE CONTROL SWEEP, at carry-in 0, through this driver:`);
    log(`        ${comma(A.control.pairCount)} pairs in ${A.control.seconds.toFixed(1)}s,`
      + ` ${A.control.unconfirmed} disagreements with F's rule`);
    log(`        distribution ${distString(A.control.dist)}`);
    log(`        F1 measured  ${distString(new Map(Object.entries(A.control_reference)
      .map(([k, v]) => [Number(k), v])))}`);
    log(`        reproduces F1 bin for bin: ${A.control_matches}`);
    log(`        sum wrong ${A.control.wrongSum}, overflow wrong ${A.control.wrongCarry},`
      + ` c5 wrong ${A.control.wrongC5}`);

    log('');
    log('--- AW1  the rule, pair by pair, at both non-zero carry-ins ---');
    for (const key of ['plus', 'minus']) {
      const s = A.sweeps[key], r = s.registered;
      log(`      carry-in ${s.cin > 0 ? '+1' : '-1'}: ${comma(r.pairCount)} pairs in`
        + ` ${r.seconds.toFixed(1)}s — the registered rule is wrong on`
        + ` ${comma(r.unconfirmed)} (${pct(r.unconfirmed, r.pairCount)})`);
      log(`        flags ${JSON.stringify(distObject(r.flags))}`
        + `   sum wrong ${r.wrongSum}, overflow wrong ${r.wrongCarry}`);
      log(`        F's rule minus the registered rule, pair by pair: ${JSON.stringify(s.delta)}`);
      log(`        THE ORACLE on the first disagreements — src/device.js, not R2:`);
      for (const o of s.oracle) {
        log(`          ${o.a}+${o.b}+${s.cin}: registered says ${o.registered_k},`
          + ` F's rule unchanged says ${o.corrected_k}, R0 settles at ${o.oracle_k}`);
      }
    }
    log(`      AW1 ${A.verdict.AW1}`);
    log(`      and F's rule UNCHANGED — position 0 excluded, carry-in seeded — is wrong`);
    log(`      on ${R.corrected_rule_disagreements} of`
      + ` ${comma(R.aw1_pairs)} pairs across both carry-ins.`);

    log('');
    log('--- AW2  the walk: 46,899 at the full thirteen passes ---');
    for (const key of ['plus', 'minus']) {
      const s = A.sweeps[key];
      log(`      carry-in ${s.cin > 0 ? '+1' : '-1'}: ${comma(s.measured.dist.get(13) || 0)}`
        + ` pairs take the full thirteen   (registered ${comma(PLUS.full)})`);
      log(`        measured distribution ${distString(s.measured.dist)}`);
      const w = A.corrected_walk[key];
      log(`        the same walk from the start vector position 0 actually hands on,`
        + ` (${startVector(s.cin).join(', ')}), four applications: ${comma(w.full)}`);
    }
    log(`      AW2 ${A.verdict.AW2}`);

    log('');
    log('--- AW3  the two carry-ins as exact mirrors ---');
    log(`      distributions identical bin for bin: ${R.aw3_same_distribution}`);
    log(`      pairs at thirteen passes, binned by the carry entering position 5:`);
    log(`        carry-in +1  (${R.aw3_carry_plus_pairs.map(comma).join(', ')})`
      + `   carry-in -1  (${R.aw3_carry_minus_pairs.map(comma).join(', ')})`);
    log(`      the same in the REGISTRATION'S units — prefixes, so divided by the nine`);
    log(`      free choices of the top digit, which divides exactly:`
      + ` ${R.aw3_top_digit_is_free}`);
    log(`        carry-in +1  (${R.aw3_carry_plus.map(comma).join(', ')})`
      + `   carry-in -1  (${R.aw3_carry_minus.map(comma).join(', ')})`);
    log(`        registered   (${PLUS.trail[5].map(comma).join(', ')})`
      + `   against         (${MINUS.trail[5].map(comma).join(', ')})`);
    log(`      one is the reverse of the other: ${R.aw3_carry_is_reverse}`);
    log(`      and they are the registered (695, 3789, 727):`
      + ` ${R.aw3_registered_vectors_hold}`);
    log(`      TWO READINGS, both reported rather than one picked silently:`);
    log(`        the SYMMETRY reading — every bin equal, the vectors reversed, which is`);
    log(`        what the AT RISK line names as refuting it: ${R.aw3_symmetry_reading}`);
    log(`        the LITERAL reading — that AND the two vectors it names,`
      + ` which are AW2's: ${R.aw3_literal_reading}`);
    log(`      AW3 ${A.verdict.AW3}  (scored on the literal reading, X2 and E5 precedent:`);
    log(`      a prediction with a refuted half is not trimmed to the half that survived)`);

    log('');
    log('--- AW4  the floor, at eight rather than nine ---');
    log(`      minimum pass count: carry-in +1 ${R.aw4_floor_plus},`
      + ` carry-in -1 ${R.aw4_floor_minus}, carry-in 0 ${R.aw4_floor_carry_in_0}`);
    log(`      (registered: 8 at both non-zero carry-ins against 9 at carry-in 0)`);
    log(`      AW4 ${A.verdict.AW4}`);

    log('');
    log('--- THE MECHANISM: when does each carry actually arrive? ---');
    // Not a prediction. It separates the two ways AW1 can fail, which the pass count
    // at the far end cannot: a saving that never happens, and one that happens and
    // costs nothing -- F2's finding at the top position.
    const M = A.mechanism;
    log(`      position 0, all ${M.position0_combinations} (digit-pair, non-zero carry-in)`
      + ` combinations — F2's own 18:`);
    log(`        ${M.position0_qualifying} satisfy F's condition;`
      + ` c1 is determined at pass ${M.position0_arrival_passes.join(' or ')} in every one,`);
    log(`        and ${M.position0_arriving_early} of them arrive early.`);
    log(`      position 1, the positive control, the same 18:`);
    log(`        ${M.position1_qualifying} satisfy it; c2 arrives at pass`
      + ` ${M.position1_arrival_when_qualifying.join(' or ')} when it holds and`
      + ` ${M.position1_arrival_when_not.join(' or ')} when it does not,`);
    log(`        so ${M.position1_arriving_early} of the qualifying ones arrive early.`);
    log(`      AND THE GAP THAT DECIDES IT, measured rather than argued: a carry's early`);
    log(`      leaf is only usable if the selectors above it, gated by the OPERAND`);
    log(`      detectors, have already resolved.`);
    log(`        position 0: the carry-in's detector minus the operand detectors`
      + ` = ${M.position0_detector_gap.join(', ')}`);
    log(`        position 1: c1's detector minus the operand detectors`
      + ` = ${M.position1_detector_gap.join(', ')}`);
    log(`      The saving is real one position up and absent at the boundary cell.`);

    log('');
    log('--- THE CLOSURES: sampled corners in Y, Z and E, swept ---');
    // MEASURED_NOT_REGISTERED, every one. Each follows by induction from a cell that
    // is already exhaustive over all 27 of its input triples; what the sweep buys is
    // that a disclosed sample stops being a place a defect can hide.
    const C = A.closures;
    log(`      E1: the decoded adder at both non-zero carry-ins was sampled at stride 11.`);
    log(`          Now every pair: sum wrong ${A.sweeps.plus.measured.wrongSum
      + A.sweeps.minus.measured.wrongSum}, overflow wrong`
      + ` ${A.sweeps.plus.measured.wrongCarry + A.sweeps.minus.measured.wrongCarry},`
      + ` c5 wrong ${A.sweeps.plus.measured.wrongC5 + A.sweeps.minus.measured.wrongC5}`);
    log(`      Y1, Y2: the selector-tree adder, ${C.tree_switches} switches,`
      + ` ${C.tree_nodes} nodes, at both non-zero carry-ins:`);
    for (const key of ['plus', 'minus']) {
      const s = C.tree[key];
      log(`          carry-in ${key === 'plus' ? '+1' : '-1'}: ${comma(s.pairCount)} pairs`
        + ` in ${s.seconds.toFixed(1)}s, sum wrong ${s.wrongSum},`
        + ` overflow wrong ${s.wrongCarry}, not exactly seven passes ${s.unconfirmed}`);
    }
    log(`      Z4, Z5: all three restore variants at carry-in 0, exhaustively:`);
    for (const nm of ['none', 'mid', 'leafmid']) {
      const s = C.restore[nm];
      log(`          ${nm.padEnd(8)} ${String(s.switches).padStart(4)} switches,`
        + ` ${String(s.nodes).padStart(4)} nodes: ${comma(s.pairCount)} pairs in`
        + ` ${s.seconds.toFixed(1)}s, sum wrong ${s.wrongSum}, overflow wrong`
        + ` ${s.wrongCarry}, not exactly ${s.registered_passes} passes ${s.unconfirmed}`);
    }
    const b = C.binary;
    log(`      Z4, Z5 and adder-audit's own control: the ${BIN_W}-bit binary adder,`
      + ` ${b.switches} switches, ${b.nodes} nodes,`);
    log(`          at stride ${b.stride}: ${comma(b.pairCount)} pairs in`
      + ` ${b.seconds.toFixed(1)}s, wrong ${b.wrong},`
      + ` not exactly eleven passes ${b.unconfirmed}`);

    log('');
    log(line);
    return A;
  });
}

/**
 * Everything the record needs and nothing that cannot be written down. Every number a
 * commit message or `FINDINGS.json` will carry comes out of here, so the manifest and
 * the run cannot drift apart.
 */
function summary(A) {
  const os = require('os');
  const d = m => distObject(m);
  const sw = s => ({ pairs: s.pairCount, seconds: Number(s.seconds.toFixed(1)),
    disagreements: s.unconfirmed, distribution: d(s.dist),
    sum_wrong: s.wrongSum, overflow_wrong: s.wrongCarry, carry_node_wrong: s.wrongC5 });
  const R = A.result;
  return {
    machine: os.cpus()[0].model, node_version: process.version,
    subject: A.subject,
    module_bytes: A.module_bytes, stock_module_bytes: A.stock_module_bytes,
    gate: A.gate,
    matrix_derived_agrees_with_registration: A.matrix_agrees,
    probe_vs_gated_path: A.probe_vs_gated_path,
    mutation: A.mutation,
    control_carry_in_0: sw(A.control),
    control_reproduces_F1: A.control_matches,
    carry_in_plus_1: { registered_rule: sw(A.sweeps.plus.registered),
      corrected_rule: sw(A.sweeps.plus.measured),
      corrected_minus_registered: A.sweeps.plus.delta, oracle: A.sweeps.plus.oracle },
    carry_in_minus_1: { registered_rule: sw(A.sweeps.minus.registered),
      corrected_rule: sw(A.sweeps.minus.measured),
      corrected_minus_registered: A.sweeps.minus.delta, oracle: A.sweeps.minus.oracle },
    corrected_walk: { plus: A.corrected_walk.plus.full, minus: A.corrected_walk.minus.full,
      start_plus: startVector(1), start_minus: startVector(-1),
      trail_plus: A.corrected_walk.plus.trail },
    mechanism: {
      position0_combinations: A.mechanism.position0_combinations,
      position0_qualifying: A.mechanism.position0_qualifying,
      position0_arriving_early: A.mechanism.position0_arriving_early,
      position0_arrival_passes: A.mechanism.position0_arrival_passes,
      position0_detector_gap: A.mechanism.position0_detector_gap,
      position1_detector_gap: A.mechanism.position1_detector_gap,
      position1_combinations: A.mechanism.position1_combinations,
      position1_qualifying: A.mechanism.position1_qualifying,
      position1_arriving_early: A.mechanism.position1_arriving_early,
      position1_arrival_when_qualifying: A.mechanism.position1_arrival_when_qualifying,
      position1_arrival_when_not: A.mechanism.position1_arrival_when_not,
    },
    closures: {
      tree_switches: A.closures.tree_switches, tree_nodes: A.closures.tree_nodes,
      tree_plus: sw(A.closures.tree.plus), tree_minus: sw(A.closures.tree.minus),
      restore: Object.fromEntries(Object.entries(A.closures.restore).map(([k, s]) =>
        [k, Object.assign(sw(s), { switches: s.switches, nodes: s.nodes,
          registered_passes: s.registered_passes })])),
      binary: { width: BIN_W, switches: A.closures.binary.switches,
        nodes: A.closures.binary.nodes, stride: A.closures.binary.stride,
        pairs: A.closures.binary.pairCount,
        seconds: Number(A.closures.binary.seconds.toFixed(1)),
        wrong: A.closures.binary.wrong,
        not_exactly_eleven: A.closures.binary.unconfirmed },
    },
    result: R, verdict: A.verdict,
    aw3_units: { pairs_plus: R.aw3_carry_plus_pairs, prefixes_plus: R.aw3_carry_plus,
      registered_prefixes: PLUS.trail[5], top_digit_is_free: R.aw3_top_digit_is_free },
  };
}

if (MAIN) {
  report(process.argv.slice(2)).then(A => {
    if (process.argv.includes('--json')) console.log(JSON.stringify(summary(A), null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { report, runAudit, summary, walk, STEP, SUM, CONTROL, PLUS, MINUS,
  passesUnder, carryInto, derivedMatrix, startVector, probeFn, instrument, probeSweep,
  ternarySweep, binarySweep, oraclePasses, ternInputs, arrivalProfile,
  TERN_IN, TERN_PAIRS, BIN_IN, BIN_W, BIN_PAIRS, distObject, idsOf, aOf, bOf };
