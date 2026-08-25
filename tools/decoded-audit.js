'use strict';
/* DECODED-SELECTOR AUDIT — the circuit that refuted Z2, built out to six trits.
 *
 * Z2 measured where buffers can go inside one family of selector trees, and then
 * said 4 was the best depth ternary could reach AT ANY PRICE. A decoded selector
 * reached 3, cheaper, and Z2 is kept as a failed prediction. This asks whether
 * that one cell scales — whether the thing that beat the floor is an adder or an
 * anecdote.
 *
 * The idea in one line: a selector gated on a raw trit needs a SERIES PAIR for
 * its middle arm, because isolating the middle level from a raw select needs the
 * D3 overlap and nothing less (X4). Decode the select once — four switches
 * answering "is this MID?" — and every arm of every selector using that signal
 * becomes a single device. The detector is paid per SIGNAL, the saving is per
 * SELECTOR, and a tree has thirteen selectors.
 *
 * SWITCH-LEVEL, NOT SPICE. See the header of src/device.js. In particular this
 * still hands out vmid free, and Z1 already showed what that is worth.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED. Established while building the counterexample that failed Z2:
 *
 *   - the MID detector is (-1, 0, -1) in four switches, read depth 2;
 *   - a decoded selector selects correctly with three single-device arms;
 *   - ONE decoded full-adder cell is 90 switches at read depth 3, correct on all
 *     27 of its input combinations, against 104 at depth 6 for the selector-tree
 *     cell.
 *
 * One cell is not six. Nothing below was measured before it was registered.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit. Numbers
 * are DERIVED BY HAND; the run checks the derivation.
 *
 *   E1  IT IS STILL AN ADDER AT SIX TRITS. The decoded ripple computes T.add over
 *       all 531,441 operand pairs at carry-in 0, sum and overflow trit, plus a
 *       sampled sweep at carry-in +1 and -1. At risk for a reason the selector
 *       tree did not have: the carry now feeds a DETECTOR as well as three raw
 *       arms, so cell i depends on cell i-1 through two different paths that must
 *       agree. A correct cell in isolation says nothing about six of them chained
 *       that way.
 *
 *   E2  COST. 90 switches per cell x 6 = 540 unshared. Shared, the sum tree keeps
 *       3 distinct leaves and the carry tree 5, so 7 and 9 selectors at 3
 *       switches each plus 3 detectors at 4: 60 per cell, 360 in total.
 *       Predicted: 540 and 360, against 624 and 384 for the selector tree.
 *
 *   E3  DEPTH HOLDS AT SIX TRITS. Read depth 3 for the whole ripple, not just for
 *       one cell — the chain resets at every gate, and a carry is read as a gate.
 *       Predicted: 3, equal to the binary adder's unrestored depth, and half the
 *       selector tree's 6.
 *
 *   E4  AND IT COSTS PASSES. Decoding is an extra dependency stage: the carry
 *       resolves, then its detector, then the selectors gated on that detector.
 *       Two stages per cell instead of one. Predicted: cell i settles on pass
 *       2i+2, so the six-trit adder takes 2x6 + 1 = 13 passes, against 7 for the
 *       selector tree — and still independent of the data, as Y2 and Z5 found.
 *
 *       This is the trade, and it is worth stating plainly before the run: the
 *       decoded design is cheaper in switches and shallower in pass depth, and
 *       DEEPER in dependency stages. Two of this model's three currencies improve
 *       and the third gets worse.
 *
 *   E5  IT NARROWS THE GAP AND DOES NOT CLOSE IT. Against the ten-bit binary
 *       adder the ratio becomes 540/280 = 1.93 unshared and 360/220 = 1.64
 *       shared, down from 2.23 and 1.75 — still above 1.0 at every width from one
 *       trit to six. Per digit, 90 against 28 is 3.21, down from 3.71 and still
 *       above the log2(3) = 1.585 break-even. Predicted also: fewer mid-rail taps
 *       than the selector tree's 168, since a leaf arm is now one device rather
 *       than a series pair through vmid.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

const line = '='.repeat(78);
const STEP = 11;
console.log('DECODED-SELECTOR AUDIT — the circuit that failed Z2, at full width.\n');

const spread = (nm, v) => Object.fromEntries(T.toTrits(v).map((t, i) => [`${nm}${i}`, t]));
const gather = sol => T.fromTrits(Array.from({ length: 6 }, (_, i) => sol[`s${i}`]));
const overflow = (a, b, cin) => { const s = a + b + cin; return (s - T.wrap(s)) / 729; };

const decoded = new D.Net(); D.dRippleAdder(decoded, 6);
const decodedShared = new D.Net(); D.dRippleAdder(decodedShared, 6, true);
const tree = new D.Net(); D.tRippleAdder(tree, 6);
const treeShared = new D.Net(); D.tRippleAdder(treeShared, 6, true);
const bin = D.binaryNet(); D.bRippleAdder(bin, 10);
const binShared = D.binaryNet(); D.bRippleAdder(binShared, 10, true);

console.log('--- E2, E3, E5  cost, depth, and the comparison ---');
{
  const rows = [['decoded', decoded, decodedShared], ['selector tree', tree, treeShared]];
  console.log('      design           plain  shared   mid taps   vs binary (plain / shared)');
  for (const [name, plain, shared] of rows) {
    console.log(`      ${name.padEnd(15)} ${String(plain.cost().switches).padStart(5)}`
      + `  ${String(shared.cost().switches).padStart(6)}`
      + `   ${String(plain.cost().midRailConnections).padStart(8)}`
      + `   ${(plain.cost().switches / bin.cost().switches).toFixed(3)}`
      + ` / ${(shared.cost().switches / binShared.cost().switches).toFixed(3)}`);
  }
  console.log(`      binary 10-bit   ${String(bin.cost().switches).padStart(5)}`
    + `  ${String(binShared.cost().switches).padStart(6)}`
    + `   ${String(bin.cost().midRailConnections).padStart(8)}`);

  // Depth over a sample: readDepth solves once per input, and the full sweep is E1's job.
  const sample = [];
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += 97) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += 97) {
      sample.push({ ...spread('a', a), ...spread('b', b), cin: 0 });
    }
  }
  const outs = Array.from({ length: 6 }, (_, i) => `s${i}`).concat(['c6']);
  for (const [name, net] of [['decoded', decoded], ['selector tree', tree]]) {
    console.log(`      ${name.padEnd(15)} read depth ${JSON.stringify(net.readDepth(sample, outs))}`
      + `  over ${sample.length} sampled inputs`);
  }
  const bSample = [];
  for (let x = 0; x <= 1023; x += 149) for (let y = 0; y <= 1023; y += 149) {
    const o = { cin: -1 };
    for (let i = 0; i < 10; i++) { o[`a${i}`] = ((x >> i) & 1) ? 1 : -1; o[`b${i}`] = ((y >> i) & 1) ? 1 : -1; }
    bSample.push(o);
  }
  console.log(`      binary 10-bit   read depth ${JSON.stringify(bin.readDepth(bSample,
    Array.from({ length: 10 }, (_, i) => `s${i}`).concat(['c10'])))}`);

  // E5's width sweep, pure counting.
  const bitsFor = n => { let w = 1; while (Math.pow(2, w) < Math.pow(3, n)) w++; return w; };
  let lowest = Infinity;
  console.log('      trits  bits    decoded  binary   ratio    shared ratio');
  for (let n = 1; n <= 6; n++) {
    const w = bitsFor(n);
    const d = new D.Net(); D.dRippleAdder(d, n);
    const ds = new D.Net(); D.dRippleAdder(ds, n, true);
    const b = D.binaryNet(); D.bRippleAdder(b, w);
    const bs = D.binaryNet(); D.bRippleAdder(bs, w, true);
    const r = d.cost().switches / b.cost().switches, rs = ds.cost().switches / bs.cost().switches;
    lowest = Math.min(lowest, r, rs);
    console.log(`      ${String(n).padStart(5)}  ${String(w).padStart(4)}`
      + `    ${String(d.cost().switches).padStart(7)}  ${String(b.cost().switches).padStart(6)}`
      + `   ${r.toFixed(3)}    ${rs.toFixed(3)}`);
  }
  console.log(`      lowest ratio at any width: ${lowest.toFixed(3)}`
    + `   ${lowest > 1 ? 'still above 1, as predicted' : 'BELOW 1 — the gap closes'}`);
  const perDigit = (decoded.cost().switches / 6) / (bin.cost().switches / 10);
  console.log(`      per digit: ${(decoded.cost().switches / 6).toFixed(0)} against`
    + ` ${(bin.cost().switches / 10).toFixed(0)} = ${perDigit.toFixed(3)}x,`
    + ` break-even log2(3) = ${Math.log2(3).toFixed(3)}`);
}

console.log('\n--- E1, E4  every operand pair, and how many passes ---');
{
  const t0 = process.hrtime.bigint();
  const EXPECT = 13;
  let n = 0, wrongSum = 0, wrongCarry = 0, notExact = 0, first = '';
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a++) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b++) {
      n++;
      const inputs = { ...spread('a', a), ...spread('b', b), cin: 0 };
      let sol = null;
      try { sol = decoded.solve(inputs, EXPECT); } catch (e) { /* did not settle */ }
      let fewer = true;
      try { decoded.solve(inputs, EXPECT - 1); } catch (e) { fewer = false; }
      if (sol === null || fewer) { notExact++; if (!first) first = `${a}+${b}: passes`; }
      if (sol !== null) {
        if (gather(sol) !== T.wrap(a + b)) { wrongSum++; if (!first) first = `${a}+${b}: sum`; }
        if (sol.c6 !== overflow(a, b, 0)) { wrongCarry++; if (!first) first = `${a}+${b}: carry`; }
      }
    }
  }
  const secs = Number(process.hrtime.bigint() - t0) / 1e9;
  console.log(`      carry-in 0, every operand pair`);
  console.log(`        ${n.toLocaleString()} pairs in ${secs.toFixed(0)}s`
    + `   sum wrong ${wrongSum}   carry wrong ${wrongCarry}`
    + `   not exactly ${EXPECT} passes: ${notExact}`);
  if (first) console.log(`        first divergence: ${first}`);

  for (const cin of [1, -1]) {
    let m = 0, wrong = 0;
    for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += STEP) {
      for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += STEP) {
        m++;
        const sol = decoded.solve({ ...spread('a', a), ...spread('b', b), cin }, 20);
        if (gather(sol) !== T.wrap(a + b + cin) || sol.c6 !== overflow(a, b, cin)) wrong++;
      }
    }
    console.log(`      carry-in ${cin > 0 ? '+1' : '-1'}, every ${STEP}th pair:`
      + ` ${m.toLocaleString()} pairs, ${wrong} wrong`);
  }
  const passesFor = inputs => {
    for (let k = 1; k <= 40; k++) { try { decoded.solve(inputs, k); return k; } catch (e) { /* no */ } }
    return null;
  };
  const far = passesFor({ ...spread('a', 364), ...spread('b', 1), cin: 0 });
  const none = passesFor({ ...spread('a', 0), ...spread('b', 0), cin: 0 });
  console.log(`      carry crossing all six: ${far} passes; no carry at all: ${none} passes`);
  console.log(`      selector tree took 7. Decoding is cheaper and shallower in pass DEPTH,`);
  console.log(`      and deeper in dependency STAGES. Two currencies improve, one worsens.`);
}

console.log('\n' + line);
