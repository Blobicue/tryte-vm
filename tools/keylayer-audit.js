'use strict';
/* KEYLAYER AUDIT — can a hash-only key layer give a minted coin an owner?
 *
 * Set `AP`. `AN` established that mint-by-search is available where mint-by-receipt is
 * not, and `AO` established what destroying a secret costs. Both left the same piece
 * missing: a minted coin with no owner is not a coin. The question here is whether
 * ownership can be added WITHOUT adding an assumption.
 *
 * IT CAN, AND THE CONSTRUCTION IS THE OLDEST ONE. A Lamport one-time signature needs
 * only a hash function -- no elliptic curve, no pairing, no trusted setup, nothing this
 * project would have to import and could not check. For each position of a digest you
 * publish `b` preimage hashes and reveal exactly one. Its famous defect is that a key
 * signs ONCE. Here that is not a defect: one mint, one key, one burn is the semantics
 * the ledger wants, and the construction enforces it rather than merely asking.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * A digest space of 729 values -- one tryte, the arena every figure in `AN` and `AO`
 * is measured over. In base b the digest has `pos = log_b 729` positions and the
 * private key is `pos * b` preimages; a signature reveals `pos` of them, one per
 * position, and the remaining `pos * (b - 1)` must be destroyed.
 *
 *     base 3    6 positions x 3 = 18 preimages, 6 revealed, 12 destroyed
 *     base 2   10 positions x 2 = 20 preimages, 10 revealed, 10 destroyed
 *
 * MEASURED DURING DESIGN AND THEREFORE NOT REGISTERED, recorded instead as
 * `F-LAMPORT-BASE-ADVANTAGE-IS-NOT-PER-SIZE`: the per-value cost is `b / ln b`, which
 * is minimised at b = e, so ternary beats binary asymptotically by 5.4%. But the
 * position count is an integer, and sweeping ten digest sizes shows the advantage is
 * NOT per-size: binary wins at 256 and at 1024, ties at 64 and 4096, and ternary takes
 * the other six. An asymptotic argument does not settle a particular width.
 *
 * THE NULL MODEL, arithmetic, computed before this commit. After two signatures under
 * one key the holder knows two preimages at each position where the two messages
 * differ, so every message mixing them is forgeable: 2^k for k differing positions.
 * With k ~ Binomial(pos, (b-1)/b),
 *
 *     E[2^k] = (1 + (b-1)/b) ^ pos
 *     base 3:  (5/3)^6  = 21.43 of 729   = 2.94%
 *     base 2:  (3/2)^10 = 57.67 of 1024  = 5.63%
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AP1 ONE SIGNATURE IS EXACTLY ONE MESSAGE. Predicted that an attacker holding a
 *       single valid signature can produce a valid signature for exactly 1 of the 729
 *       messages -- the one already signed -- and for no other, exhaustively over all
 *       729 signed messages and all 729 targets. Registered with the alternative: if
 *       any second message is forgeable from one signature, the scheme is broken at
 *       its first use and nothing below matters.
 *
 *   AP2 TWO SIGNATURES LEAK, AT THE BINOMIAL RATE. Predicted the mean number of
 *       forgeable messages over all 531,441 ordered pairs of signed messages lands
 *       within 5% of the 21.43 null; that the maximum is exactly 64, reached when the
 *       two messages differ in all six positions; and that the minimum is exactly 1,
 *       reached only when the two messages are the same. So the one-time restriction
 *       is not advisory: a second signature under the same key hands away 2.94% of
 *       the space on average and 8.8% at worst.
 *
 *   AP3 AND TERNARY LEAKS LESS THAN BINARY. Predicted the ternary scheme's mean leak,
 *       as a fraction of its own 729-message space, is smaller than the binary
 *       scheme's as a fraction of its 1,024 -- 2.94% against 5.63%, a factor of 1.91.
 *       The reason is registered too, so the number is not the only thing at risk: two
 *       random trits differ with probability 2/3 against two random bits at 1/2, which
 *       should raise the ternary leak, and it is instead lower because the position
 *       count falls faster than the per-position collision rate rises.
 *
 *   AP4 BUT TERNARY PAYS FOR IT IN DESTRUCTION. The unrevealed preimages must be
 *       erased or the key is reusable, and the fraction that must go is (b-1)/b.
 *       Predicted the ternary key destroys 12 of 18 preimages against binary's 10 of
 *       20 -- two thirds against one half -- and that measuring the destruction step
 *       with `AB`'s erasure gives strictly more erased bits for ternary at the same
 *       digest space. So the leak advantage in `AP3` is bought with a larger wipe, and
 *       `AO` already priced what a wipe costs.
 * ------------------------------------------------------------------------------
 * Run:  npm run audit:keylayer
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

const E = require('./erasure-audit.js');

/** Positions needed to hold `n` values in base `b`, by multiplication not logarithms.
 *  log(729)/log(3) is 6.0000000000000009 in floating point, and ceil makes that 7. */
function positions(n, b) {
  let pos = 0, cover = 1;
  while (cover < n) { cover *= b; pos++; }
  return pos;
}

const scheme = (n, b) => {
  const pos = positions(n, b);
  return { n, b, pos, preimages: pos * b, revealed: pos, destroyed: pos * (b - 1) };
};

/** Digits of `v` in base `b`, least significant first, padded to `pos`. */
function digits(v, b, pos) {
  const out = new Array(pos);
  let x = v;
  for (let i = 0; i < pos; i++) { out[i] = x % b; x = (x - out[i]) / b; }
  return out;
}

/**
 * What a holder of signatures for `msgs` can forge. Each signature reveals one
 * preimage per position; a target is forgeable exactly when every one of its digits
 * has already been revealed at that position.
 */
function forgeable(msgs, n, b, pos) {
  const known = Array.from({ length: pos }, () => new Set());
  for (const m of msgs) digits(m, b, pos).forEach((d, i) => known[i].add(d));
  let count = 0;
  for (let t = 0; t < n; t++) {
    if (digits(t, b, pos).every((d, i) => known[i].has(d))) count++;
  }
  return count;
}

/** E[2^k] for k ~ Binomial(pos, (b-1)/b) -- the null for a two-signature leak. */
const leakNull = (b, pos) => Math.pow(1 + (b - 1) / b, pos);

function report() {
  log('KEYLAYER AUDIT — can a hash-only key layer give a minted coin an owner?');
  log(line);

  const T3 = scheme(729, 3), T2 = scheme(1024, 2);

  log('\n--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  {
    // Positions must come from multiplication, not from a logarithm: the floating
    // point value of log(729)/log(3) exceeds 6 and a ceiling turns 18 preimages
    // into 21. The bug is silent and flatters ternary's rival.
    log(`      729 in base 3 needs ${T3.pos} positions (a logarithm says `
      + `${Math.ceil(Math.log(729) / Math.log(3))})`);
    log(`      3^${T3.pos} = ${3 ** T3.pos}, so the count is exact: ${3 ** T3.pos === 729}`);
    // A scheme that reveals nothing must forge nothing; one that reveals everything
    // must forge everything. Both ends pinned before any candidate is read.
    log(`      no signatures forge ${forgeable([], 729, 3, T3.pos)} of 729`);
    const all = Array.from({ length: 729 }, (_, i) => i);
    log(`      every signature forges ${forgeable(all, 729, 3, T3.pos)} of 729`);
  }

  log('\n--- AP1  one signature is exactly one message ---');
  {
    let worst = 0, offenders = 0;
    for (let m = 0; m < 729; m++) {
      const f = forgeable([m], 729, 3, T3.pos);
      if (f > worst) worst = f;
      if (f !== 1) offenders++;
    }
    log(`      over all 729 signed messages: worst-case forgeable ${worst}`);
    log(`      messages from which a SECOND forges: ${offenders}`);
  }

  log('\n--- AP2  two signatures leak, at the binomial rate ---');
  {
    let sum = 0, max = 0, min = Infinity, pairs = 0;
    for (let a = 0; a < 729; a++) {
      for (let c = 0; c < 729; c++) {
        const f = forgeable([a, c], 729, 3, T3.pos);
        sum += f; pairs++;
        if (f > max) max = f;
        if (f < min) min = f;
      }
    }
    const mean = sum / pairs;
    log(`      ${pairs.toLocaleString()} ordered pairs`);
    log(`        mean forgeable   ${mean.toFixed(3)}   null ${leakNull(3, T3.pos).toFixed(2)}`);
    log(`        maximum          ${max}   (2^${T3.pos} = ${2 ** T3.pos})`);
    log(`        minimum          ${min}`);
    log(`        mean as a share of the space  ${(100 * mean / 729).toFixed(2)}%`);
    log(`        worst as a share              ${(100 * max / 729).toFixed(2)}%`);
  }

  log('\n--- AP3  and ternary leaks less than binary ---');
  {
    for (const s of [T3, T2]) {
      const nul = leakNull(s.b, s.pos);
      log(`      base ${s.b}: ${s.pos} positions, digits differ with p = `
        + `${((s.b - 1) / s.b).toFixed(3)}, E[2^k] = ${nul.toFixed(2)} of ${s.n}`
        + `  = ${(100 * nul / s.n).toFixed(2)}%`);
    }
    const r = (leakNull(2, T2.pos) / T2.n) / (leakNull(3, T3.pos) / T3.n);
    log(`      binary leaks ${r.toFixed(2)}x more of its own space`);
  }

  log('\n--- AP4  but ternary pays for it in destruction ---');
  {
    for (const s of [T3, T2]) {
      log(`      base ${s.b}: ${s.preimages} preimages, ${s.revealed} revealed, `
        + `${s.destroyed} destroyed = ${(100 * s.destroyed / s.preimages).toFixed(1)}%`);
    }
    // The destruction step as a MAP, measured with AB's own erasure rather than
    // asserted. At one position the key is a b-tuple of preimages and signing keeps
    // exactly one, so the step is a projection from ALPHA^b onto ALPHA. Measuring the
    // projection is measuring the wipe.
    const ALPHA = 3;                       // preimages drawn from a 3-value alphabet
    for (const s of [T3, T2]) {
      const domain = ALPHA ** s.b;
      const image = new Int32Array(domain);
      for (let key = 0; key < domain; key++) image[key] = key % ALPHA;   // keep coord 0
      const perPosition = E.erasureOf(image, domain);
      log(`      base ${s.b}: one position wipes ${perPosition.toFixed(4)} bits`
        + `   (log2(${ALPHA}^${s.b - 1}) = ${((s.b - 1) * Math.log2(ALPHA)).toFixed(4)})`);
      log(`               over ${s.pos} positions: `
        + `${(perPosition * s.pos).toFixed(3)} bits of key material destroyed`);
    }
  }

  log('\n' + line);
}

if (MAIN) report();

module.exports = { positions, scheme, digits, forgeable, leakNull, report };
