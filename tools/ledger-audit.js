'use strict';
/* LEDGER AUDIT — what does the accumulator actually have to be?
 *
 * `AI`, `AJ` and `AK` measured reversibility as a COST question: does a step that
 * merges states let a tabulator amortise, and can a receipt survive that. The ledger
 * asks it in the opposite direction and the answer inverts. A ledger is not trying
 * to be cheap and it is not trying to be reversible. Its only job is that a change
 * to any entry changes the head. Detection, not inversion.
 *
 * Two accumulators, both folding a list of entries into one tryte:
 *
 *   summed    a' = a + e            the history operator, `F-SUM-IS-A-LADDER`
 *   hashed    a' = P(a + e) - e     `D`'s split-round mixer, fed forward
 *
 * BOTH ARE HONEST NINE-AND-A-HALF-BIT HEADS. Each carries log2(729) = 9.5098 bits
 * about a history of any length, so each has the same ASTRONOMICAL number of
 * colliding ledgers -- against an ideal hash into the same range, exactly N^(L-1) of
 * N^L, since fixing L-1 entries determines the last. A collision COUNT therefore
 * cannot separate them, which is `D4` again in a new costume and the reason this
 * audit does not report one.
 *
 * WHAT SEPARATES THEM IS FINDABILITY. The forgery a ledger actually fears is the
 * compensating pair: mint d to yourself, burn d from somebody else, leave the total
 * untouched. Against the sum that is one linear equation and it is not a search at
 * all. Against the mixer it is a search, and this audit measures how big.
 *
 * SCOPE, because scope has decided four verdicts in this corpus already. The sweep
 * ranges over ORDERED pairs of DISTINCT entries and non-zero deltas -- 6 x 5 x 728 =
 * 21,840 forgeries of one fixed six-entry ledger. It is a census of that ledger's
 * neighbourhood, not of ledger space, and the single-entry control below is what
 * says the compensating structure is doing the work rather than the arithmetic.
 *
 * WHAT THIS DOES NOT MEASURE, named so the silence is not mistaken for evidence.
 * `AN2` showed this mixer's feed-forward collapses: P(m+n) - n = g(m+n) + m, so the
 * chain step is g(a + e) + a and the entry does NOT commute out the way the message
 * did. Whether that residual structure gives a forger anything over the chance rate
 * measured here is a real question, it is at risk, and it is therefore a prediction
 * set rather than a line in this file.
 *
 *     node tools/ledger-audit.js
 */

const Q = require('./puzzle-audit.js');
const { N, W, VALS, idx, val, tadd, tsub, P } = Q;

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };

/** The fixed six-entry ledger. Mints and burns, nothing special about the values. */
const LEDGER = [12, -40, 7, 155, -3, 88];

const wrap = v => ((v + 364) % N + N) % N - 364;

/**
 * The chain step in INDEX space, tabulated once. `STEP[a*N + e]` is the next
 * accumulator index. Both heads and every sweep below read this table, so the two
 * accumulators are never implemented twice in this file.
 */
const STEP = (() => {
  const t = new Int16Array(N * N);
  for (let a = 0; a < N; a++) {
    const av = val(a);
    for (let e = 0; e < N; e++) {
      const ev = val(e);
      t[a * N + e] = idx(tsub(P(tadd(av, ev)), ev));
    }
  }
  return t;
})();

const headSum = entries => wrap(entries.reduce((a, e) => wrap(a + e), 0));

const headHash = entries => {
  let a = idx(0);
  for (const e of entries) a = STEP[a * N + idx(e)];
  return val(a);
};

/** One compensating pair: +d at `i`, -d at `j`. The forgery that keeps the total. */
const forge = (entries, i, j, d) => {
  const f = entries.slice();
  f[i] = wrap(f[i] + d);
  f[j] = wrap(f[j] - d);
  return f;
};

/**
 * Every compensating pair over one ledger. `chance` is what an accumulator with no
 * structure at all would accept -- tried / N -- and is the only thing the hashed
 * column can honestly be compared against.
 */
function sweepCompensating(entries = LEDGER) {
  const s0 = headSum(entries), h0 = headHash(entries);
  const L = entries.length;
  let tried = 0, sum = 0, hash = 0;
  for (let i = 0; i < L; i++) {
    for (let j = 0; j < L; j++) {
      if (i === j) continue;
      for (let d = -364; d <= 364; d++) {
        if (d === 0) continue;
        const f = forge(entries, i, j, d);
        tried++;
        if (headSum(f) === s0) sum++;
        if (headHash(f) === h0) hash++;
      }
    }
  }
  return { tried, sum, hash, chance: tried / N, s0, h0 };
}

/**
 * The control. A single edit does not preserve the total, so the summed head must
 * catch every one of them -- and if it did not, the sweep above would be measuring
 * a broken accumulator rather than a forgeable one.
 */
function sweepSingle(entries = LEDGER) {
  const s0 = headSum(entries), h0 = headHash(entries);
  let tried = 0, sum = 0, hash = 0;
  for (let i = 0; i < entries.length; i++) {
    for (let d = -364; d <= 364; d++) {
      if (d === 0) continue;
      const f = entries.slice();
      f[i] = wrap(f[i] + d);
      tried++;
      if (headSum(f) === s0) sum++;
      if (headHash(f) === h0) hash++;
    }
  }
  return { tried, sum, hash, chance: tried / N };
}

/**
 * How flat is each head over ALL ledgers of length two? The summed head is exactly
 * flat by construction, 729 preimages each. The mixer is not ideal and this says by
 * how much, which is the honest correction to treating N^(L-1) as its count too.
 */
function preimageProfile(L = 2) {
  const tallySum = new Int32Array(N), tallyHash = new Int32Array(N);
  const walk = (depth, aHash, aSum) => {
    if (depth === L) { tallyHash[aHash]++; tallySum[idx(aSum)]++; return; }
    for (let e = 0; e < N; e++) walk(depth + 1, STEP[aHash * N + e], wrap(aSum + val(e)));
  };
  walk(0, idx(0), 0);
  const stat = t => {
    let min = Infinity, max = 0, zero = 0;
    for (let i = 0; i < N; i++) { if (t[i] < min) min = t[i]; if (t[i] > max) max = t[i]; if (!t[i]) zero++; }
    return { min, max, zero, mean: N ** (L - 1), flat: min === max };
  };
  return { ledgers: N ** L, sum: stat(tallySum), hash: stat(tallyHash) };
}

function report() {
  const comp = sweepCompensating(), one = sweepSingle(), pre = preimageProfile(2);
  log('LEDGER AUDIT — detection, not inversion.\n');
  log(`  ledger        ${LEDGER.join(', ')}`);
  log(`  summed head   ${comp.s0}`);
  log(`  hashed head   ${comp.h0}\n`);

  const pct = (n, d) => `${(100 * n / d).toFixed(2)}%`;
  log('  compensating pairs (+d here, -d there, total unchanged)');
  log(`    forgeries tried   ${comp.tried.toLocaleString('en-US')}`);
  log(`    summed accepts    ${comp.sum.toLocaleString('en-US')}  ${pct(comp.sum, comp.tried).padStart(7)}   every single one`);
  log(`    hashed accepts    ${String(comp.hash).padStart(6)}  ${pct(comp.hash, comp.tried).padStart(7)}   chance is ${comp.chance.toFixed(1)}\n`);

  log('  single edits (the control -- the total moves, so both must catch all)');
  log(`    forgeries tried   ${one.tried.toLocaleString('en-US')}`);
  log(`    summed accepts    ${String(one.sum).padStart(6)}`);
  log(`    hashed accepts    ${String(one.hash).padStart(6)}   chance is ${one.chance.toFixed(1)}\n`);

  log(`  preimages over all ${pre.ledgers.toLocaleString('en-US')} two-entry ledgers (ideal would be ${pre.sum.mean} each)`);
  log(`    summed   min ${pre.sum.min}  max ${pre.sum.max}  unreachable heads ${pre.sum.zero}   ${pre.sum.flat ? 'exactly flat' : 'NOT flat'}`);
  log(`    hashed   min ${pre.hash.min}  max ${pre.hash.max}  unreachable heads ${pre.hash.zero}   ${pre.hash.flat ? 'exactly flat' : 'NOT flat'}`);
  return { comp, one, pre };
}

if (MAIN) report();

module.exports = {
  LEDGER, wrap, STEP, headSum, headHash, forge,
  sweepCompensating, sweepSingle, preimageProfile, report,
};
