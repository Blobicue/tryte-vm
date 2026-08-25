'use strict';
/* MID-RAIL AUDIT — the two things every cost number here has been leaning on.
 *
 * Limit 1 at the top of src/device.js says the middle rail is free. Limit 2 says
 * there is no level restoration. Every switch count in this repository has been
 * quoted with those two caveats attached and neither of them priced. This prices
 * them, as far as they can be priced, and is candid about the part that cannot.
 *
 * The first half is now a THEOREM rather than a caveat. T5 says a non-driven node
 * can take a level only from a rail — so a divider between vss and vdd, which is
 * how real silicon makes a middle level, is contention here and resolves to X.
 * The mid rail cannot be generated inside this model. It has to be given, and its
 * price is charged in a currency this vocabulary does not have.
 *
 * What CAN be done is a break-even: how expensive would a mid-rail generator have
 * to be before it changes a published verdict. That is Z1.
 *
 * The second half is measurable outright. Pass depth — how many conducting
 * switches a node's level arrived through, counted from the rail that drives it,
 * shortest path when there are several, over nodes that something actually READS
 * (a gate input or a named output). Restoring buffers cut it, and cost switches.
 *
 * SWITCH-LEVEL, NOT SPICE. See the header of src/device.js.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED. Established while building the measurement, and recorded here
 * so the pre-registration record is not inflated:
 *
 *   - T5 is proved in test/test-axioms.js: a vss/vdd divider resolves to X, no
 *     network of up to three switches that never touches vmid puts any node at
 *     MID, and an input gates but never sources — a conducting device between an
 *     input and a node transfers nothing;
 *   - read depths, unrestored: STI 2, MIN 3, MAX 3, one ternary full-adder cell
 *     6, one binary full-adder cell 3;
 *   - a ternary restoring buffer is two standard inverters in series, 8 switches;
 *     the binary one is 4. Two and not one, because one inverts.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit. The
 * numbers below are DERIVED BY HAND from figures already measured; the run checks
 * the derivation, and the derivation is the thing at risk.
 *
 *   Z1  THE FREE RAIL IS LOAD-BEARING FOR EXACTLY ONE PUBLISHED RESULT, AND IT IS
 *       THE ONE THAT FAVOURED TERNARY. W3's six-trit MIN is 48 switches against a
 *       ten-bit binary AND's 60, a ratio of 0.80, and it taps vmid six times. If
 *       generating that rail costs G switches for the datapath, parity is at
 *       48 + G = 60, so G = 12 — twelve switches, or two per tap, and W3's
 *       ternary-favouring number is gone. The adder cannot be rescued the same
 *       way in either direction: it is 624 against 280, and a charge can only be
 *       added to the ternary side, so no non-negative G changes its verdict.
 *
 *       Predicted: smallest integer G reaching parity for W3 is 12; smallest G
 *       reversing it is 13; and there is no G that reverses the adder.
 *
 *   Z2  TERNARY'S RESTORATION FLOOR IS WORSE THAN BINARY'S CEILING. Buffering
 *       cannot drive the ternary pass depth below 4, however much of it is
 *       inserted, because a selector's MID arm is a SERIES PAIR — the same series
 *       pair X4 proved irreducible — and a restoring buffer's own output already
 *       sits up to two hops from a rail. Two plus two. Binary's floor is 2, since
 *       every one of its arms is a single device.
 *
 *       Predicted: floors of 4 (ternary) and 2 (binary), and therefore that the
 *       best depth ternary can buy at any price, 4, is worse than the depth
 *       binary has for free, 3. D3's inclusive threshold bought the middle level;
 *       this is its invoice.
 *
 *   Z3  THE COST OF RESTORING. Buffering the mid-level selectors ('mid'), and
 *       both the leaf and mid levels ('leafmid'). Hand-derived switch counts:
 *
 *                              none   mid   leafmid
 *         ternary 6-trit        624   912      1776
 *         ternary, shared       384   672      1056
 *         binary 10-bit         280   440       760
 *         binary, shared        220   380       580
 *
 *       and hand-derived read depths: ternary 6 / 4 / 4, binary 3 / 2 / 2. The
 *       repeated 4 and 2 are Z2's floors — 'leafmid' costs nearly twice what
 *       'mid' costs and buys no depth at all, on either side.
 *
 *   Z4  THE RESTORED CIRCUITS STILL ADD. Every restored variant computes T.add,
 *       sum and overflow, over a sampled sweep. At risk: a buffer is an inverter
 *       driven BY a pass network and driving another one, which is exactly the
 *       arrangement stated limit 2 says this model handles by assumption. If the
 *       assumption were doing work, this is where it would show.
 *
 *   Z5  RESTORATION COSTS PASSES, AND THAT IS THE ONLY WAY DELAY APPEARS HERE.
 *       Y2 found the unrestored adder settles in exactly seven passes regardless
 *       of the data. Buffers add gate-dependency depth: each inverter is its own
 *       stage, so a two-inverter buffer adds two. Hand-derived totals:
 *
 *         ternary 'mid'      3 stages per cell  x 6 cells  + 1  =  19
 *         ternary 'leafmid'  5 stages per cell  x 6 cells  + 1  =  31
 *         binary  'mid'      3 stages per bit   x 10 bits  + 1  =  31
 *         binary  'leafmid'  5 stages per bit   x 10 bits  + 1  =  51
 *
 *       Still independent of the data — this is structural depth, not arithmetic.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

const line = '='.repeat(78);
const L = [-1, 0, 1];
const STEP = 11;
console.log('MID-RAIL AUDIT — pricing the two caveats every other number here carries.\n');

console.log('--- Z1  what would a mid-rail generator have to cost? ---');
{
  const min6 = new D.Net(); for (let i = 0; i < 6; i++) D.tmin(min6, `a${i}`, `b${i}`, `o${i}`);
  const and10 = D.binaryNet(); for (let i = 0; i < 10; i++) D.bAnd(and10, `a${i}`, `b${i}`, `o${i}`);
  const tAdd = new D.Net(); D.tRippleAdder(tAdd, 6);
  const bAdd = D.binaryNet(); D.bRippleAdder(bAdd, 10);

  const report = (name, tern, bin) => {
    const t = tern.cost(), b = bin.cost();
    let parity = null, reversal = null;
    for (let G = 0; G <= 10000; G++) {
      if (parity === null && (t.switches + G) / b.switches >= 1) parity = G;
      if (reversal === null && (t.switches + G) / b.switches > 1) { reversal = G; break; }
    }
    console.log(`      ${name.padEnd(24)} ternary ${String(t.switches).padStart(4)}`
      + `  binary ${String(b.switches).padStart(4)}`
      + `  ratio ${(t.switches / b.switches).toFixed(3)}`
      + `  taps ${String(t.midRailConnections).padStart(3)}`);
    console.log(`      ${' '.repeat(24)} parity at G = ${parity}`
      + `${parity > 0 ? ` (${(parity / t.midRailConnections).toFixed(2)} per tap)` : ''}`
      + `, reversal at G = ${reversal}`
      + `${parity === 0 ? '   <- already lost; no charge can change it' : ''}`);
  };
  report('W3: MIN 6t vs AND 10b', min6, and10);
  report('Y: adder 6t vs 10b', tAdd, bAdd);
  console.log('      T5 says the generator itself cannot be built here: a vss/vdd divider is');
  console.log('      contention, not a middle level. So G is a charge from outside the model.');
}

console.log('\n--- Z2, Z3  restoration: what it buys, and what it costs ---');
{
  const cellInputs = L.flatMap(a => L.flatMap(b => L.map(c => ({ a, b, c }))));
  const bCellInputs = [-1, 1].flatMap(a => [-1, 1].flatMap(b => [-1, 1].map(c => ({ a, b, c }))));

  console.log('      side      sharing   restore    switches   mid taps   read depth');
  const rows = [];
  for (const [side, shared] of [['ternary', false], ['ternary', true], ['binary', false], ['binary', true]]) {
    for (const restore of ['none', 'mid', 'leafmid']) {
      const opts = { share: shared, restore };
      let full, cell, depth;
      if (side === 'ternary') {
        full = new D.Net(); D.tRippleAdder(full, 6, opts);
        cell = new D.Net(); D.ttable3(cell, 'a', 'b', 'c', D.adderTables().sum, 'o', 'C', opts);
        depth = cell.readDepth(cellInputs, ['o']);
      } else {
        full = D.binaryNet(); D.bRippleAdder(full, 10, opts);
        cell = D.binaryNet(); D.btable3(cell, 'a', 'b', 'c', D.bAdderTables().sum, 'o', 'C', opts);
        depth = cell.readDepth(bCellInputs, ['o']);
      }
      const c = full.cost();
      rows.push({ side, shared, restore, switches: c.switches, taps: c.midRailConnections, depth: depth.depth });
      console.log(`      ${side.padEnd(9)} ${(shared ? 'shared' : 'plain').padEnd(9)} ${restore.padEnd(10)}`
        + ` ${String(c.switches).padStart(7)}   ${String(c.taps === undefined ? c.midRailConnections : c.midRailConnections).padStart(7)}`
        + `   ${String(depth.depth).padStart(9)}`);
    }
  }
  const floor = side => Math.min(...rows.filter(r => r.side === side).map(r => r.depth));
  const unrestored = side => rows.find(r => r.side === side && r.restore === 'none' && !r.shared).depth;
  console.log(`      ternary floor ${floor('ternary')}, binary floor ${floor('binary')},`
    + ` binary unrestored ${unrestored('binary')}`);
  console.log(`      ${floor('ternary') > unrestored('binary')
    ? 'ternary at any price is deeper than binary for free, as predicted'
    : 'ternary reaches binary depth — the prediction is wrong'}`);
}

console.log('\n--- Z4, Z5  do the restored adders still add, and in how many passes? ---');
{
  const spread = (nm, v) => Object.fromEntries(T.toTrits(v).map((t, i) => [`${nm}${i}`, t]));
  const gather = sol => T.fromTrits(Array.from({ length: 6 }, (_, i) => sol[`s${i}`]));
  const overflow = (a, b) => { const s = a + b; return (s - T.wrap(s)) / 729; };

  const settlesIn = (net, inputs, cap) => {
    try { net.solve(inputs, cap); return true; } catch (e) { return false; }
  };
  const exactPasses = (net, inputs, cap = 80) => {
    for (let k = 1; k <= cap; k++) if (settlesIn(net, inputs, k)) return k;
    return null;
  };

  for (const restore of ['none', 'mid', 'leafmid']) {
    const net = new D.Net(); D.tRippleAdder(net, 6, { restore });
    let n = 0, wrong = 0, offPasses = 0, expected = null;
    for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += STEP) {
      for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += STEP) {
        n++;
        const inputs = { ...spread('a', a), ...spread('b', b), cin: 0 };
        const p = exactPasses(net, inputs);
        if (expected === null) expected = p;
        if (p !== expected) offPasses++;
        const sol = net.solve(inputs, 80);
        if (gather(sol) !== T.wrap(a + b) || sol.c6 !== overflow(a, b)) wrong++;
      }
    }
    console.log(`      ternary ${restore.padEnd(8)} ${n.toLocaleString().padStart(6)} sampled pairs`
      + `   wrong ${wrong}   passes ${expected}`
      + `   pairs differing in pass count ${offPasses}`);
  }
  for (const restore of ['none', 'mid', 'leafmid']) {
    const net = D.binaryNet(); D.bRippleAdder(net, 10, { restore });
    const bits = (nm, v) => Object.fromEntries(Array.from({ length: 10 },
      (_, i) => [`${nm}${i}`, ((v >> i) & 1) ? 1 : -1]));
    let n = 0, wrong = 0, expected = null, offPasses = 0;
    for (let x = 0; x <= 1023; x += 37) for (let y = 0; y <= 1023; y += 37) {
      n++;
      const inputs = { ...bits('a', x), ...bits('b', y), cin: -1 };
      const p = exactPasses(net, inputs);
      if (expected === null) expected = p;
      if (p !== expected) offPasses++;
      const sol = net.solve(inputs, 80);
      let got = 0;
      for (let i = 0; i < 10; i++) if (sol[`s${i}`] === 1) got |= (1 << i);
      if (got !== ((x + y) & 1023) || sol.c10 !== ((x + y) > 1023 ? 1 : -1)) wrong++;
    }
    console.log(`      binary  ${restore.padEnd(8)} ${n.toLocaleString().padStart(6)} sampled pairs`
      + `   wrong ${wrong}   passes ${expected}`
      + `   pairs differing in pass count ${offPasses}`);
  }
  console.log(`      sampled every ${STEP}th ternary operand and every 37th binary one, not exhaustive:`);
  console.log('      the restored nets are up to 1776 switches and the exhaustive sweep is Y1\'s job.');
}

console.log('\n' + line);
