'use strict';
/* ADDER AUDIT — the carry, in switches.
 *
 * The monoid audits ended by making the truth table DATA: `TOPC` reads a 27-cell
 * table and addition falls out of it, which is where "ADD is one particular TOPC
 * table" came from. This is that sentence taken one layer down. The same 27 cells
 * become a tree of 1-of-3 selectors, the tree becomes a full-adder cell, six cells
 * ripple, and the result is checked against `T.add` — the same function the other
 * 484 checks are written against.
 *
 * It is also where the cost question finally gets asked in the right currency.
 * W3 measured MIN and found the raw switch ratio favouring ternary at 0.80, while
 * predicting that number should not be believed. MIN is POSITIONWISE: six wide
 * slices beat ten narrow ones. An adder is not positionwise, and a selector tree
 * over k inputs is 3^k wide in ternary against 2^k in binary.
 *
 * SWITCH-LEVEL, NOT SPICE. See the header of src/device.js, and note especially
 * that this model has no delays at all — which turns out to matter here.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED. Established while building the primitives, and recorded here so
 * the pre-registration record is not inflated by things that were never at risk:
 *
 *   - one full-adder cell is 104 switches, 28 of them touching the mid rail, and
 *     is correct on all 27 of its input combinations;
 *   - six cells rippled: 624 switches, 168 mid-rail taps; the binary ten-bit
 *     equivalent built the same way: 280 switches, no third rail;
 *   - sharing identical leaf selectors (the hash-consing `tableKey` does to
 *     tables, done to the circuit) takes the ternary side to 384 and the binary
 *     to 220. The sum tree's leaves depend only on a+b and collapse from nine to
 *     THREE, the carry tree's to five. A hand derivation said five and five, and
 *     was wrong about the sum tree, which is why it is recorded as measured;
 *   - the raw ratios are therefore 624/280 = 2.229 unshared and 384/220 = 1.745
 *     shared. Both exceed 1.0, so this reverses W3's 0.80;
 *   - on FIVE hand-picked operand pairs the network settled in exactly seven
 *     passes whether the carry travelled no positions or all six.
 *
 * Five pairs is not 531,441, and this repository has been bitten three times by
 * concluding from one point. That is what Y2 is for.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   Y1  THE ASSEMBLED SIX-TRIT ADDER IS T.add, EXHAUSTIVELY. All 531,441 operand
 *       pairs at carry-in 0, and a sampled sweep at carry-in +1 and -1, matching
 *       both the six sum trits AND the carry out of the top trit. The carry-out is
 *       part of the claim on purpose: without it this is a mod-729 unit, not an
 *       adder. Reference for the overflow trit is (a+b+cin - wrap(a+b+cin))/729.
 *       At risk because a correct one-trit cell guarantees nothing about six of
 *       them chained through pass transistors — the carry crosses five cell
 *       boundaries with no restoration anywhere, and this model has no gain.
 *
 *   Y2  RIPPLE DELAY IS INVISIBLE TO A TIMELESS MODEL. Every one of the 531,441
 *       pairs settles in exactly SEVEN passes, and not one of them settles in six.
 *       Not "about seven", not "at most seven": exactly seven, always, whether the
 *       carry propagates nowhere or all the way from the bottom trit to the top.
 *
 *       Derived rather than probed: resolution stages on gate-dependency depth
 *       (N7), and reachability is transitive closure, so a fully determined chain
 *       of conducting switches resolves in ONE pass however long it is. Every
 *       selector in cell i is gated by a_i, b_i or c_i; the first two are driven
 *       from the start and the third is the previous cell's output. So cell 0
 *       resolves on pass 1, cell i on pass i+1, cell 5 on pass 6, and pass 7 is
 *       the one that observes nothing changed. Data never enters it.
 *
 *       At risk because the derivation could be wrong in either direction, and
 *       because it is a universal claim standing on five sampled points.
 *
 *   Y3  SHARING LEAVES DOES NOT BREAK THE CIRCUIT. The shared variant computes
 *       the same function, over the same exhaustive sweep as Y1. Genuinely at
 *       risk, and the most likely of these to fail: sharing a leaf selector
 *       between two (a,b) positions ties two mid-level selectors to one node, so
 *       the shared circuit contains conducting paths BETWEEN mid nodes that the
 *       tree structure did not have. Identical tables do not imply identical
 *       circuits, and a pass network is exactly where that distinction bites.
 *
 *   Y4  AND SHARING DOES NOT CHANGE THE DEPTH. The shared variant also settles in
 *       exactly seven passes. It should follow from Y2's reasoning — sharing
 *       merges leaves, and leaves are all at the same gate-dependency depth — but
 *       it is registered separately because Y3 might hold while this fails, which
 *       would say the extra paths cost something even when they cost nothing.
 *
 *   Y5  THE REVERSAL IS STRUCTURAL, NOT AN ARTEFACT OF 6-vs-10. Sweeping width
 *       from one trit to six against the matching bit width (the smallest w with
 *       2^w >= 3^n), the ternary-to-binary switch ratio stays ABOVE 1.0 at every
 *       width, in both the shared and unshared forms. If it dips below at some
 *       width, then W3's 0.80 and this audit's 2.23 are two points on a curve
 *       rather than two kinds of circuit, and the structural story is wrong.
 *
 *       Registered with it, as a control: the binary adder being compared against
 *       is itself correct — exhaustively at five bits (1,024 pairs), sampled at
 *       ten. A cost comparison against a circuit that does not work is not a cost
 *       comparison.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

const line = '='.repeat(78);
const STEP = 11;                     // the sampled stride, as in test-device.js
console.log('ADDER AUDIT — the 27-cell carry table, built out of switches.\n');

const spread = (nm, v, n = 6) => Object.fromEntries(T.toTrits(v, n).map((t, i) => [`${nm}${i}`, t]));
const gather = (sol, n = 6) => T.fromTrits(Array.from({ length: n }, (_, i) => sol[`s${i}`]));
/** The carry out of the top trit: the overflow this model must also get right. */
const overflow = (a, b, cin) => { const s = a + b + cin; return (s - T.wrap(s)) / 729; };

/** Fewest passes the network needs, or null if it never settles inside the cap. */
function passesFor(net, inputs, cap = 24) {
  for (let k = 1; k <= cap; k++) {
    try { net.solve(inputs, k); return k; } catch (e) { /* not yet */ }
  }
  return null;
}

/**
 * One exhaustive pass over every operand pair, answering both questions at once:
 * does it compute T.add including the overflow trit, and does it take exactly the
 * predicted number of passes. Two solves per pair -- one at the cap that should
 * suffice, one at the cap that should not -- because "exactly seven" is a claim
 * in both directions, and only the second solve can refute the lower bound.
 */
function fullSweep(net, label, expectPasses) {
  const t0 = process.hrtime.bigint();
  let n = 0, wrongSum = 0, wrongCarry = 0, notExact = 0, first = '';
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a++) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b++) {
      n++;
      const inputs = { ...spread('a', a), ...spread('b', b), cin: 0 };
      let sol = null;
      try { sol = net.solve(inputs, expectPasses); } catch (e) { /* did not settle */ }
      let oneFewer = true;
      try { net.solve(inputs, expectPasses - 1); } catch (e) { oneFewer = false; }
      if (sol === null || oneFewer) {
        notExact++;
        if (!first) first = `${a}+${b}: ${sol === null ? 'needs more than' : 'settles in under'} ${expectPasses}`;
      }
      if (sol !== null) {
        if (gather(sol) !== T.wrap(a + b)) {
          wrongSum++;
          if (!first) first = `${a}+${b}: sum ${gather(sol)} vs ${T.wrap(a + b)}`;
        }
        if (sol.c6 !== overflow(a, b, 0)) {
          wrongCarry++;
          if (!first) first = `${a}+${b}: carry ${sol.c6} vs ${overflow(a, b, 0)}`;
        }
      }
    }
  }
  const secs = Number(process.hrtime.bigint() - t0) / 1e9;
  console.log(`      ${label}`);
  console.log(`        ${n.toLocaleString()} pairs in ${secs.toFixed(0)}s`
    + `   sum wrong ${wrongSum}   carry wrong ${wrongCarry}`
    + `   not exactly ${expectPasses} passes: ${notExact}`);
  if (first) console.log(`        first divergence: ${first}`);
  return { n, wrongSum, wrongCarry, notExact, secs };
}

console.log('--- Y1, Y2  the six-trit adder: right answer, and how many passes ---');
const unshared = new D.Net(); D.tRippleAdder(unshared, 6, false);
console.log(`      cost ${JSON.stringify(unshared.cost())}`);
fullSweep(unshared, 'carry-in 0, every operand pair, sum and overflow', 7);
{
  // Carry-in +1 and -1 sampled, and said so rather than quietly skipped.
  for (const cin of [1, -1]) {
    let n = 0, wrong = 0;
    for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += STEP) {
      for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += STEP) {
        n++;
        const sol = unshared.solve({ ...spread('a', a), ...spread('b', b), cin });
        if (gather(sol) !== T.wrap(a + b + cin) || sol.c6 !== overflow(a, b, cin)) wrong++;
      }
    }
    console.log(`      carry-in ${cin > 0 ? '+1' : '-1'}, every ${STEP}th pair:`
      + ` ${n.toLocaleString()} pairs, ${wrong} wrong`);
  }
  const far = passesFor(unshared, { ...spread('a', 364), ...spread('b', 1), cin: 0 });
  const near = passesFor(unshared, { ...spread('a', 0), ...spread('b', 0), cin: 0 });
  console.log(`      carry crossing all six positions: ${far} passes;`
    + ` no carry at all: ${near} passes`);
}

console.log('\n--- Y3, Y4  the shared variant: same function, same depth? ---');
const shared = new D.Net(); D.tRippleAdder(shared, 6, true);
console.log(`      cost ${JSON.stringify(shared.cost())}`);
fullSweep(shared, 'leaves shared, carry-in 0, every operand pair', 7);

console.log('\n--- Y5  does the ratio ever fall below 1? ---');
{
  // The smallest bit width that represents at least as many values as n trits.
  const bitsFor = n => { let w = 1; while (Math.pow(2, w) < Math.pow(3, n)) w++; return w; };
  console.log('      trits  values     bits  values     tern   bin    ratio   shared: tern  bin   ratio');
  let minRatio = Infinity;
  for (let n = 1; n <= 6; n++) {
    const w = bitsFor(n);
    const row = share => {
      const t = new D.Net(); D.tRippleAdder(t, n, share);
      const b = D.binaryNet(); D.bRippleAdder(b, w, share);
      return [t.cost().switches, b.cost().switches];
    };
    const [tu, bu] = row(false), [ts, bs] = row(true);
    minRatio = Math.min(minRatio, tu / bu, ts / bs);
    console.log(`      ${String(n).padStart(5)}  ${String(Math.pow(3, n)).padStart(6)}`
      + `     ${String(w).padStart(4)}  ${String(Math.pow(2, w)).padStart(6)}`
      + `     ${String(tu).padStart(4)}  ${String(bu).padStart(4)}   ${(tu / bu).toFixed(3)}`
      + `           ${String(ts).padStart(4)}  ${String(bs).padStart(4)}  ${(ts / bs).toFixed(3)}`);
  }
  console.log(`      lowest ratio at any width: ${minRatio.toFixed(3)}`
    + `   ${minRatio > 1 ? 'above 1 throughout, as predicted' : 'FALLS BELOW 1 — the structural story is wrong'}`);
  console.log(`      W3 measured 0.80 for MIN, which is positionwise. An adder is not.`);

  // The control: the binary adder being compared against has to work.
  const bitsOf = (v, w) => Object.fromEntries(Array.from({ length: w },
    (_, i) => [`a${i}`, ((v >> i) & 1) ? 1 : -1]));
  const bitsOfB = (v, w) => Object.fromEntries(Array.from({ length: w },
    (_, i) => [`b${i}`, ((v >> i) & 1) ? 1 : -1]));
  const readBits = (sol, w) => {
    let v = 0;
    for (let i = 0; i < w; i++) if (sol[`s${i}`] === 1) v |= (1 << i);
    return v;
  };
  for (const [w, stride] of [[5, 1], [10, 37]]) {
    const net = D.binaryNet(); D.bRippleAdder(net, w, false);
    const mask = (1 << w) - 1;
    let n = 0, wrong = 0;
    for (let x = 0; x <= mask; x += stride) for (let y = 0; y <= mask; y += stride) {
      n++;
      const sol = net.solve({ ...bitsOf(x, w), ...bitsOfB(y, w), cin: -1 });
      const want = (x + y) & mask;
      const wantCarry = (x + y) > mask ? 1 : -1;
      if (readBits(sol, w) !== want || sol[`c${w}`] !== wantCarry) wrong++;
    }
    console.log(`      CONTROL: the ${w}-bit binary adder, ${n.toLocaleString()} pairs`
      + `${stride > 1 ? ` (every ${stride}th)` : ' (every pair)'}: ${wrong} wrong`);
  }
}

console.log('\n' + line);
