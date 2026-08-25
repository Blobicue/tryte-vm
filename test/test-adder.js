'use strict';
/* test-adder.js — the carry, in switches.
 *
 * `TOPC` made the carry a table: 27 cells, and addition falls out of them. This
 * is the same 27 cells one layer down — a tree of 1-of-3 selectors, six trees
 * rippled, checked against `T.add`.
 *
 * The exhaustive sweep (every operand pair, twice, for both circuit variants) is
 * `npm run audit:adder` and takes about thirty-two minutes. This pins a
 * sampled sweep, every structural property, and the cost figures.
 *
 * SWITCH-LEVEL, NOT SPICE. src/device.js lists what that assumes away. Two of
 * those limits matter more here than anywhere else in this repository: there is
 * no level restoration, and the carry crosses five cell boundaries through pass
 * transistors with nothing to restore it; and there are no delays, which is why
 * the pass count below is the same whether the carry travels or not.
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const L = [-1, 0, 1];
const spread = (nm, v) => Object.fromEntries(T.toTrits(v).map((t, i) => [`${nm}${i}`, t]));
const gather = sol => T.fromTrits(Array.from({ length: 6 }, (_, i) => sol[`s${i}`]));
const overflow = (a, b, cin) => { const s = a + b + cin; return (s - T.wrap(s)) / 729; };

console.log('\n=== 1. ONE CELL, EVERY INPUT ===');
{
  const net = new D.Net(); D.tAdderCell(net, 'a', 'b', 'c', 'sum', 'cout', 'A');
  let wrong = 0, notLevel = 0;
  for (const a of L) for (const b of L) for (const c of L) {
    const s = net.solve({ a, b, c });
    if (s.sum !== T.lowTrit(a + b + c) || s.cout !== T.shiftRight(a + b + c, 1)) wrong++;
    if (!L.includes(s.sum) || !L.includes(s.cout)) notLevel++;
  }
  check('the full-adder cell is correct on all 27 input combinations', wrong === 0, `${wrong} wrong`);
  check('   and neither output ever floats or contends', notLevel === 0);
  check('   it costs 104 switches, 28 of them on the mid rail',
    net.cost().switches === 104 && net.cost().midRailConnections === 28,
    JSON.stringify(net.cost()));
  check('   the cell IS the table: its two trees are lowTrit and shiftRight of a+b+c', (() => {
    const t = D.adderTables();
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const i = D.cellIndex(a, b, c);
      if (t.sum[i] !== T.lowTrit(a + b + c) || t.carry[i] !== T.shiftRight(a + b + c, 1)) return false;
    }
    return true;
  })());
}

console.log('\n=== 2. Y1 — SIX CELLS RIPPLED, AGAINST T.add ===');
const unshared = new D.Net(); D.tRippleAdder(unshared, 6, false);
const shared = new D.Net(); D.tRippleAdder(shared, 6, true);
{
  const STEP = 17;                       // ~1,850 pairs; the tool sweeps all 531,441
  for (const [label, net] of [['unshared', unshared], ['shared', shared]]) {
    let n = 0, wrongSum = 0, wrongCarry = 0, first = '';
    for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += STEP) {
      for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += STEP) {
        n++;
        const sol = net.solve({ ...spread('a', a), ...spread('b', b), cin: 0 });
        if (gather(sol) !== T.wrap(a + b)) { wrongSum++; if (!first) first = `${a}+${b}`; }
        if (sol.c6 !== overflow(a, b, 0)) { wrongCarry++; if (!first) first = `${a}+${b} carry`; }
      }
    }
    check(`Y1 — the ${label} six-trit adder matches T.add over ${n.toLocaleString()} pairs,`
      + ' sum and overflow', wrongSum === 0 && wrongCarry === 0, first);
  }
  // Carry-in is an input, not a decoration.
  let cinWrong = 0;
  for (const cin of [-1, 1]) {
    for (const [a, b] of [[0, 0], [7, 5], [364, 0], [-364, 0], [121, 121], [-100, 42]]) {
      const sol = unshared.solve({ ...spread('a', a), ...spread('b', b), cin });
      if (gather(sol) !== T.wrap(a + b + cin) || sol.c6 !== overflow(a, b, cin)) cinWrong++;
    }
  }
  check('Y1 — carry-in +1 and -1 are carried in, not ignored', cinWrong === 0, `${cinWrong} wrong`);
  check('   and the overflow trit is a real claim: some pairs actually overflow', (() => {
    // Without this the carry check could pass by always being 0.
    return overflow(364, 364, 0) === 1 && overflow(-364, -364, 0) === -1
      && unshared.solve({ ...spread('a', 364), ...spread('b', 364), cin: 0 }).c6 === 1
      && unshared.solve({ ...spread('a', -364), ...spread('b', -364), cin: 0 }).c6 === -1;
  })());
}

console.log('\n=== 3. Y2, Y4 — HOW MANY PASSES, AND WHETHER THE DATA CHANGES IT ===');
{
  const STEP = 53;                       // ~200 pairs; the tool checks all of them
  for (const [label, net] of [['unshared', unshared], ['shared', shared]]) {
    let n = 0, notExactly7 = 0;
    for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += STEP) {
      for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += STEP) {
        n++;
        const inputs = { ...spread('a', a), ...spread('b', b), cin: 0 };
        let seven = true, six = true;
        try { net.solve(inputs, 7); } catch (e) { seven = false; }
        try { net.solve(inputs, 6); } catch (e) { six = false; }
        if (!seven || six) notExactly7++;
      }
    }
    check(`Y2 — the ${label} adder settles in exactly 7 passes on all ${n} sampled pairs`
      + ' — never 6, never more', notExactly7 === 0, `${notExactly7} off`);
  }
  check('Y2 — and the count does not move with how far the carry travels', (() => {
    // 364 + 1 propagates a carry through all six positions; 0 + 0 through none.
    const passes = inputs => {
      for (let k = 1; k <= 24; k++) { try { unshared.solve(inputs, k); return k; } catch (e) { /* no */ } }
      return null;
    };
    const far = passes({ ...spread('a', 364), ...spread('b', 1), cin: 0 });
    const none = passes({ ...spread('a', 0), ...spread('b', 0), cin: 0 });
    const every = passes({ ...spread('a', 121), ...spread('b', 121), cin: 0 });
    return far === 7 && none === 7 && every === 7;
  })());
  check('   which is what "no delays" means: depth is structural, not arithmetic',
    /no currents, capacitances, delays/.test(require('fs')
      .readFileSync(require('path').join(__dirname, '..', 'src', 'device.js'), 'utf8')));
}

console.log('\n=== 4. Y3 — SHARING LEAVES CHANGES THE CIRCUIT, NOT THE FUNCTION ===');
{
  check('Y3 — sharing really does change the circuit, so the comparison is not vacuous', (() => {
    const nodesOf = net => {
      const s = new Set();
      for (const d of net.devices) { s.add(d.a); s.add(d.b); }
      return s.size;
    };
    return shared.devices.length < unshared.devices.length && nodesOf(shared) < nodesOf(unshared);
  })());
  check('Y3 — the shared adder taps the mid rail less often, too',
    shared.cost().midRailConnections < unshared.cost().midRailConnections);
  check('Y3 — 384 switches shared against 624 unshared, a 38% saving',
    shared.cost().switches === 384 && unshared.cost().switches === 624
    && Math.abs(1 - 384 / 624 - 0.3846) < 0.001, JSON.stringify(shared.cost()));
  let differ = 0;
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += 29) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += 29) {
      const i = { ...spread('a', a), ...spread('b', b), cin: 0 };
      const u = unshared.solve(i), s = shared.solve(i);
      if (gather(u) !== gather(s) || u.c6 !== s.c6) differ++;
    }
  }
  check('Y3 — and the two circuits compute the same function anyway', differ === 0, `${differ} differ`);
}

console.log('\n=== 5. Y5 — THE COST REVERSAL, AT EVERY WIDTH ===');
{
  const bitsFor = n => { let w = 1; while (Math.pow(2, w) < Math.pow(3, n)) w++; return w; };
  const ratios = [];
  for (let n = 1; n <= 6; n++) {
    const w = bitsFor(n);
    for (const share of [false, true]) {
      const t = new D.Net(); D.tRippleAdder(t, n, share);
      const b = D.binaryNet(); D.bRippleAdder(b, w, share);
      ratios.push(t.cost().switches / b.cost().switches);
    }
  }
  check(`Y5 — the ternary/binary switch ratio stays above 1 at all six widths`
    + ` (lowest ${Math.min(...ratios).toFixed(3)})`, Math.min(...ratios) > 1);
  check('Y5 — at six trits against ten bits: 624 vs 280 unshared, 384 vs 220 shared', (() => {
    const t = new D.Net(); D.tRippleAdder(t, 6, false);
    const b = D.binaryNet(); D.bRippleAdder(b, 10, false);
    const ts = new D.Net(); D.tRippleAdder(ts, 6, true);
    const bs = D.binaryNet(); D.bRippleAdder(bs, 10, true);
    return t.cost().switches === 624 && b.cost().switches === 280
      && ts.cost().switches === 384 && bs.cost().switches === 220;
  })());
  check('Y5 — this REVERSES W3, which measured 0.80 for MIN', (() => {
    // Both numbers are real. MIN is positionwise, so six wide slices beat ten
    // narrow ones; an adder is a table, and a selector tree is 3^k wide against
    // 2^k. The currency did not change — the circuit did.
    const min6 = new D.Net(); for (let i = 0; i < 6; i++) D.tmin(min6, `a${i}`, `b${i}`, `o${i}`);
    const and10 = D.binaryNet(); for (let i = 0; i < 10; i++) D.bAnd(and10, `a${i}`, `b${i}`, `o${i}`);
    return min6.cost().switches / and10.cost().switches < 1 && 624 / 280 > 1;
  })());
  check('Y5 — and the ternary side still taps a rail the binary side does not have', (() => {
    const t = new D.Net(); D.tRippleAdder(t, 6, false);
    const b = D.binaryNet(); D.bRippleAdder(b, 10, false);
    return t.cost().midRailConnections === 168 && b.cost().midRailConnections === 0
      && t.cost().rails === 3 && b.cost().rails === 2;
  })());

  // Per digit, which is the currency the radix-economy argument is stated in --
  // and a unit trap worth pinning, because the two numbers look comparable and
  // are not. Radix economy charges a digit of radix b a cost of b, so its 3.077
  // already contains a factor of two on the binary side. The switch-currency
  // break-even is log2(3): a trit carries that many bits, so its circuit may cost
  // that much more before ternary stops paying.
  {
    const cell = new D.Net(); D.tAdderCell(cell, 'a', 'b', 'c', 's', 'co', 'A');
    const cellShared = new D.Net(); D.tAdderCell(cellShared, 'a', 'b', 'c', 's', 'co', 'A', true);
    const bit = D.binaryNet(); D.bRippleAdder(bit, 1, false);
    const bitShared = D.binaryNet(); D.bRippleAdder(bitShared, 1, true);
    const perDigit = cell.cost().switches / bit.cost().switches;
    const perDigitShared = cellShared.cost().switches / bitShared.cost().switches;
    check(`per digit: a ternary adder cell is 104 switches against a binary 28 — ${perDigit.toFixed(2)}x`,
      cell.cost().switches === 104 && bit.cost().switches === 28
      && Math.abs(perDigit - 3.714) < 0.001, `${cell.cost().switches} vs ${bit.cost().switches}`);
    check(`   shared, 64 against 22 — ${perDigitShared.toFixed(2)}x, still over the break-even of log2(3) = 1.585`,
      cellShared.cost().switches === 64 && bitShared.cost().switches === 22
      && perDigitShared > Math.log2(3) && perDigit > Math.log2(3));
    check('   and log2(3) is the bar, NOT the radix-economy 3.077, which is in another unit',
      Math.abs(Math.log2(3) - 1.585) < 0.001 && Math.abs(40 / 13 - 3.077) < 0.001
      && Math.abs((40 / 13) / 2 - 20 / 13) < 1e-12);
  }

  // The control: comparing against a binary adder that does not work is not a
  // comparison. Exhaustive at five bits.
  const w = 5, mask = 31;
  const net = D.binaryNet(); D.bRippleAdder(net, w, false);
  const bitsA = v => Object.fromEntries(Array.from({ length: w }, (_, i) => [`a${i}`, ((v >> i) & 1) ? 1 : -1]));
  const bitsB = v => Object.fromEntries(Array.from({ length: w }, (_, i) => [`b${i}`, ((v >> i) & 1) ? 1 : -1]));
  let bad = 0;
  for (let x = 0; x <= mask; x++) for (let y = 0; y <= mask; y++) {
    const sol = net.solve({ ...bitsA(x), ...bitsB(y), cin: -1 });
    let got = 0;
    for (let i = 0; i < w; i++) if (sol[`s${i}`] === 1) got |= (1 << i);
    if (got !== ((x + y) & mask) || sol[`c${w}`] !== ((x + y) > mask ? 1 : -1)) bad++;
  }
  check('Y5 CONTROL — the binary adder is itself correct, over all 1,024 five-bit pairs',
    bad === 0, `${bad} wrong`);
}

console.log('\n=== 6. THE SWEEP HAS TEETH ===');
{
  // A sweep that cannot fail proves nothing. Corrupt one cell of the carry table
  // and confirm the sampled sweep notices — and notices from the sample, not
  // only from the exhaustive run.
  const t = D.adderTables();
  const bent = t.carry.slice();
  const i = D.cellIndex(1, 1, 1);                  // a=b=c=+1, the row that must carry
  bent[i] = bent[i] === 1 ? 0 : 1;
  const broken = new D.Net();
  for (let k = 0; k < 6; k++) {
    const cin = k === 0 ? 'cin' : `c${k}`;
    D.ttable3(broken, `a${k}`, `b${k}`, cin, t.sum, `s${k}`, `A${k}S`);
    D.ttable3(broken, `a${k}`, `b${k}`, cin, bent, `c${k + 1}`, `A${k}C`);
  }
  let caught = 0, n = 0;
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += 17) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += 17) {
      n++;
      const sol = broken.solve({ ...spread('a', a), ...spread('b', b), cin: 0 });
      if (gather(sol) !== T.wrap(a + b) || sol.c6 !== overflow(a, b, 0)) caught++;
    }
  }
  check(`one wrong cell in the carry table is caught on ${caught} of ${n} sampled pairs`,
    caught > 0, 'the sweep is blind to a corrupted table');
  check('   and the corruption was to a row that matters, not a dead one',
    bent[i] !== t.carry[i] && t.carry[i] === 1);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
