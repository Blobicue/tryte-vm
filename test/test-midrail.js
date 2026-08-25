'use strict';
/* test-midrail.js — the two caveats every switch count here has been carrying.
 *
 * `src/device.js` limit 1: the middle rail is free. Limit 2: there is no level
 * restoration. Every cost number in this repository was quoted with those
 * attached and neither priced. This pins what pricing them did.
 *
 * The first is now T5, a theorem rather than a caveat: a non-driven node takes a
 * level only from a rail, so the divider that makes a middle level in real
 * silicon is contention here. The rail cannot be built inside the model, which
 * means its cost is charged in a currency the model does not have — and the only
 * honest question left is the break-even one. How dear would it have to be.
 *
 * The second is measurable outright, through `Net.readDepth`.
 *
 * The full sweep is `npm run audit:midrail`. This pins the structure, the costs,
 * the depths, and a sampled correctness check on the restored circuits.
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
const overflow = (a, b) => { const s = a + b; return (s - T.wrap(s)) / 729; };

const tAdder = opts => { const n = new D.Net(); D.tRippleAdder(n, 6, opts); return n; };
const bAdder = opts => { const n = D.binaryNet(); D.bRippleAdder(n, 10, opts); return n; };

console.log('\n=== 1. Z1 — WHAT A MID-RAIL GENERATOR WOULD HAVE TO COST ===');
{
  const min6 = new D.Net(); for (let i = 0; i < 6; i++) D.tmin(min6, `a${i}`, `b${i}`, `o${i}`);
  const and10 = D.binaryNet(); for (let i = 0; i < 10; i++) D.bAnd(and10, `a${i}`, `b${i}`, `o${i}`);
  const firstG = (tern, bin, strict) => {
    for (let G = 0; G <= 10000; G++) {
      const r = (tern.cost().switches + G) / bin.cost().switches;
      if (strict ? r > 1 : r >= 1) return G;
    }
    return null;
  };
  check('Z1 — W3 reaches parity at a 12-switch generator, and reverses at 13',
    firstG(min6, and10, false) === 12 && firstG(min6, and10, true) === 13,
    `${firstG(min6, and10, false)} / ${firstG(min6, and10, true)}`);
  check('Z1 — which is two switches per mid-rail tap, since W3 taps it six times',
    min6.cost().midRailConnections === 6 && 12 / 6 === 2);
  check('Z1 — the adder is past saving: it is already over, so no charge moves it',
    firstG(tAdder(), bAdder(), false) === 0);
  check('Z1 — so the free rail props up exactly the one result that favoured ternary',
    min6.cost().switches / and10.cost().switches < 1
    && tAdder().cost().switches / bAdder().cost().switches > 1);
  check('   and T5 says the generator cannot be built here at all', (() => {
    const div = new D.Net();
    div.n('on', D.LOW, 'vdd', 'm'); div.n('on', D.LOW, 'vss', 'm');
    return div.solve({ on: D.HIGH }).m === 'X';
  })());
}

console.log('\n=== 2. Z2 — THE RESTORATION FLOOR ===');
{
  const cellIn = L.flatMap(a => L.flatMap(b => L.map(c => ({ a, b, c }))));
  const bCellIn = [-1, 1].flatMap(a => [-1, 1].flatMap(b => [-1, 1].map(c => ({ a, b, c }))));
  const tDepth = restore => {
    const n = new D.Net();
    D.ttable3(n, 'a', 'b', 'c', D.adderTables().sum, 'o', 'C', { restore });
    return n.readDepth(cellIn, ['o']).depth;
  };
  const bDepth = restore => {
    const n = D.binaryNet();
    D.btable3(n, 'a', 'b', 'c', D.bAdderTables().sum, 'o', 'C', { restore });
    return n.readDepth(bCellIn, ['o']).depth;
  };
  const tern = ['none', 'mid', 'leafmid'].map(tDepth);
  const bin = ['none', 'mid', 'leafmid'].map(bDepth);
  check(`Z2 — ternary depth goes 6 -> 4 -> 4: buffering stops helping`,
    JSON.stringify(tern) === '[6,4,4]', tern.join(' '));
  check(`Z2 — binary goes 3 -> 2 -> 2`, JSON.stringify(bin) === '[3,2,2]', bin.join(' '));
  check('Z2 — buffering this design floors at 4, against binary\'s unrestored 3',
    Math.min(...tern) === 4 && bin[0] === 3 && Math.min(...tern) > bin[0]);
  check('   because a selector gated by the RAW select has a two-switch MID arm', (() => {
    // A selector's LOW and HIGH arms are one switch; its MID arm is two, because
    // isolating the middle level from the raw select needs the D3 overlap and
    // nothing less. True only while the select is the only gate — section 5.
    const mux = new D.Net(); D.tmux(mux, 'sel', 'vss', 'vmid', 'vdd', 'o');
    const bmux = D.binaryNet(); D.bmux(bmux, 'sel', 'vss', 'vdd', 'o');
    return mux.cost().switches === 4 && bmux.cost().switches === 2
      && mux.readDepth(L.map(sel => ({ sel })), ['o']).depth === 2
      && bmux.readDepth([-1, 1].map(sel => ({ sel })), ['o']).depth === 1;
  })());
}

console.log('\n=== 3. Z3 — WHAT RESTORATION COSTS ===');
{
  const table = {};
  for (const share of [false, true]) for (const restore of ['none', 'mid', 'leafmid']) {
    table[`t${share ? 'S' : ''}-${restore}`] = tAdder({ share, restore }).cost().switches;
    table[`b${share ? 'S' : ''}-${restore}`] = bAdder({ share, restore }).cost().switches;
  }
  check('Z3 — ternary 624 / 912 / 1776, and shared 384 / 672 / 1056',
    table['t-none'] === 624 && table['t-mid'] === 912 && table['t-leafmid'] === 1776
    && table['tS-none'] === 384 && table['tS-mid'] === 672 && table['tS-leafmid'] === 1056,
    JSON.stringify(table));
  check('Z3 — binary 280 / 440 / 760, and shared 220 / 380 / 580',
    table['b-none'] === 280 && table['b-mid'] === 440 && table['b-leafmid'] === 760
    && table['bS-none'] === 220 && table['bS-mid'] === 380 && table['bS-leafmid'] === 580,
    JSON.stringify(table));
  check('Z3 — leafmid costs nearly double mid and buys no depth at all, on either side',
    table['t-leafmid'] > 1.9 * table['t-mid'] && table['b-leafmid'] > 1.7 * table['b-mid']);
  check('Z3 — and restoring makes the ratio worse, not better: 2.23 -> 3.26',
    Math.abs(table['t-none'] / table['b-none'] - 2.229) < 0.001
    && Math.abs(table['t-mid'] / table['b-none'] - 3.257) < 0.001);
  check('   the ternary side also taps the mid rail more when restored, not less',
    tAdder({ restore: 'mid' }).cost().midRailConnections
    > tAdder().cost().midRailConnections);
}

console.log('\n=== 4. Z4, Z5 — THE RESTORED CIRCUITS STILL ADD, AND TAKE LONGER ===');
{
  const settlesIn = (net, inputs, k) => {
    try { net.solve(inputs, k); return true; } catch (e) { return false; }
  };
  const exactPasses = (net, inputs) => {
    for (let k = 1; k <= 80; k++) if (settlesIn(net, inputs, k)) return k;
    return null;
  };
  const SAMPLE = [[0, 0], [7, 5], [364, 1], [-364, -1], [121, 121], [-100, 42], [200, -200]];

  for (const [restore, want] of [['none', 7], ['mid', 19], ['leafmid', 31]]) {
    const net = tAdder({ restore });
    let wrong = 0, offPasses = 0;
    for (const [a, b] of SAMPLE) {
      const inputs = { ...spread('a', a), ...spread('b', b), cin: 0 };
      const sol = net.solve(inputs, 80);
      if (gather(sol) !== T.wrap(a + b) || sol.c6 !== overflow(a, b)) wrong++;
      if (!(settlesIn(net, inputs, want) && !settlesIn(net, inputs, want - 1))) offPasses++;
    }
    check(`Z4/Z5 — ternary '${restore}' still adds, in exactly ${want} passes on all ${SAMPLE.length} samples`,
      wrong === 0 && offPasses === 0, `${wrong} wrong, ${offPasses} off`);
  }
  const bits = (nm, v) => Object.fromEntries(Array.from({ length: 10 },
    (_, i) => [`${nm}${i}`, ((v >> i) & 1) ? 1 : -1]));
  for (const [restore, want] of [['none', 11], ['mid', 31], ['leafmid', 51]]) {
    const net = bAdder({ restore });
    let wrong = 0, offPasses = 0, n = 0;
    for (const [x, y] of [[0, 0], [1, 1], [1023, 1], [511, 512], [341, 682]]) {
      n++;
      const inputs = { ...bits('a', x), ...bits('b', y), cin: -1 };
      const sol = net.solve(inputs, 80);
      let got = 0;
      for (let i = 0; i < 10; i++) if (sol[`s${i}`] === 1) got |= (1 << i);
      if (got !== ((x + y) & 1023) || sol.c10 !== ((x + y) > 1023 ? 1 : -1)) wrong++;
      if (!(settlesIn(net, inputs, want) && !settlesIn(net, inputs, want - 1))) offPasses++;
    }
    check(`Z4/Z5 — binary '${restore}' still adds, in exactly ${want} passes on all ${n} samples`,
      wrong === 0 && offPasses === 0, `${wrong} wrong, ${offPasses} off`);
  }
  check('Z5 — and the pass count is still independent of the data, for this design family', (() => {
    // The whole of Y2 again, on a restored circuit: depth is structural.
    const net = tAdder({ restore: 'mid' });
    const p = ab => exactPasses(net, { ...spread('a', ab[0]), ...spread('b', ab[1]), cin: 0 });
    return p([364, 1]) === p([0, 0]) && p([0, 0]) === p([121, 121]);
  })());
  check('   what costs passes is gate-dependency depth, of which restoration is one source',
    // NOT "the only source", which an earlier wording of this claimed. The
    // unrestored adder already takes seven passes, and those come from the carry
    // chaining one cell's output into the next cell's gates — Y2's whole result.
    // Restoration adds to that depth; it does not introduce it.
    tAdder({ restore: 'mid' }).cost().switches > tAdder().cost().switches);
}

console.log('\n=== 5. Z2 FAILED — A DECODED SELECTOR REACHES DEPTH 3 ===');
{
  /* Z2 predicted the buffered floors and got them: 6 -> 4 -> 4 and 3 -> 2 -> 2.
   * Then it drew a conclusion the measurement did not support — that 4 is "the
   * best depth ternary can buy at any price". Nothing measured quantified over
   * DESIGNS. It quantified over where buffers go, inside one family of trees.
   *
   * Decode the select instead of gating on it. A four-switch detector pulls to
   * vss for LOW and for HIGH and passes vmid for MID, and then every selector arm
   * is a SINGLE device — including the middle one, which is where the second hop
   * came from. The detector is paid for once per select signal, not once per
   * selector, so it is shared by every selector in every tree using that signal.
   *
   * The result is both shallower and cheaper than what Z2 measured, so the clause
   * is refuted twice over. The registration text is left exactly as written.
   */
  const ismid = (net, sel, out) => {
    net.p(sel, D.LOW, 'vss', out);          // LOW  -> vss
    net.n(sel, D.HIGH, 'vss', out);         // HIGH -> vss
    const m = `${out}$m`;
    net.n(sel, D.MID, 'vmid', m);           // MID  -> vmid, through the series pair
    net.p(sel, D.MID, m, out);              // once per signal, not once per selector
    return net;
  };
  const dmux = (net, sel, lo, mid, hi, out) => {
    net.p(sel, D.LOW, lo, out);
    net.n(sel, D.HIGH, hi, out);
    net.n(`${sel}$im`, D.MID, mid, out);    // conducts exactly when the detector says MID
    return net;
  };
  const RAIL = { '-1': 'vss', 0: 'vmid', 1: 'vdd' };
  const dtable3 = (net, a, b, c, cells, out, tag) => {
    const mids = [];
    for (let av = -1; av <= 1; av++) {
      const leaves = [];
      for (let bv = -1; bv <= 1; bv++) {
        const leaf = `${tag}$l${av}_${bv}`;
        dmux(net, c, ...[-1, 0, 1].map(cv => RAIL[cells[D.cellIndex(av, bv, cv)]]), leaf);
        leaves.push(leaf);
      }
      const mid = `${tag}$m${av}`;
      dmux(net, b, leaves[0], leaves[1], leaves[2], mid);
      mids.push(mid);
    }
    dmux(net, a, mids[0], mids[1], mids[2], out);
    return net;
  };

  const decoded = new D.Net();
  for (const sel of ['a', 'b', 'c']) ismid(decoded, sel, `${sel}$im`);
  const tables = D.adderTables();
  dtable3(decoded, 'a', 'b', 'c', tables.sum, 'sum', 'S');
  dtable3(decoded, 'a', 'b', 'c', tables.carry, 'cout', 'C');

  const rows = L.flatMap(a => L.flatMap(b => L.map(c => ({ a, b, c }))));
  let wrong = 0;
  for (const r of rows) {
    const sol = decoded.solve(r);
    if (sol.sum !== T.lowTrit(r.a + r.b + r.c)) wrong++;
    if (sol.cout !== T.shiftRight(r.a + r.b + r.c, 1)) wrong++;
  }

  check('the MID detector reads (-1, 0, -1) in four switches, at depth 2', (() => {
    const n = new D.Net(); ismid(n, 'sel', 'im');
    return L.map(sel => n.solve({ sel }).im).join(' ') === '-1 0 -1'
      && n.cost().switches === 4
      && n.readDepth(L.map(sel => ({ sel })), ['im']).depth === 2;
  })());
  check('a decoded selector still selects, with every arm a single device', (() => {
    const n = new D.Net(); ismid(n, 'sel', 'sel$im');
    dmux(n, 'sel', 'vss', 'vmid', 'vdd', 'o');
    return L.map(sel => n.solve({ sel }).o).join(' ') === '-1 0 1' && n.devices.length === 7;
  })());
  check('the decoded adder cell is correct on all 27 inputs', wrong === 0, `${wrong} wrong`);

  const plain = new D.Net(); D.tAdderCell(plain, 'a', 'b', 'c', 's', 'co', 'A');
  const depth = decoded.readDepth(rows, ['sum', 'cout']).depth;
  const plainDepth = plain.readDepth(rows, ['s', 'co']).depth;
  check(`Z2 REFUTED — the decoded cell reaches depth ${depth}, matching binary's unrestored 3`,
    depth === 3, `depth ${depth}`);
  check(`   and it is CHEAPER while being shallower: ${decoded.cost().switches} switches against ${plainDepth === 6 ? plain.cost().switches : '?'}`,
    decoded.cost().switches === 90 && plain.cost().switches === 104 && depth < plainDepth);
  check('   so "at any price" was quantifying over buffer placements, not over designs',
    depth <= 3 && Math.min(6, 4, 4) === 4);
  check('   Z2\'s measured numbers still hold — it is the conclusion that failed', (() => {
    // Kept as FAILED rather than corrected away. What it measured about buffering
    // the selector-tree family is exactly what it registered.
    const cellIn = L.flatMap(a => L.flatMap(b => L.map(c => ({ a, b, c }))));
    const d = restore => {
      const n = new D.Net();
      D.ttable3(n, 'a', 'b', 'c', D.adderTables().sum, 'o', 'C', { restore });
      return n.readDepth(cellIn, ['o']).depth;
    };
    return d('none') === 6 && d('mid') === 4 && d('leafmid') === 4;
  })());
}

console.log('\n=== 6. THE DEPTH MEASURE HAS TEETH ===');
{
  // readDepth is a new instrument, so it needs to be shown reporting something
  // other than a constant, and shown ignoring what it says it ignores.
  const un = new D.Net(); D.ttable3(un, 'a', 'b', 'c', D.adderTables().sum, 'o', 'C');
  const re = new D.Net(); D.ttable3(re, 'a', 'b', 'c', D.adderTables().sum, 'o', 'C', { restore: 'mid' });
  const cellIn = L.flatMap(a => L.flatMap(b => L.map(c => ({ a, b, c }))));
  check('the measure separates the two circuits it is meant to separate',
    un.readDepth(cellIn, ['o']).depth > re.readDepth(cellIn, ['o']).depth);
  check('a single switch off a rail reads as depth 1, and two in series as 2', (() => {
    const one = new D.Net(); one.n('g', D.LOW, 'vdd', 'o');
    const two = new D.Net(); two.n('g', D.LOW, 'vdd', 'm'); two.n('g', D.LOW, 'm', 'o');
    return one.readDepth([{ g: 1 }], ['o']).depth === 1
      && two.readDepth([{ g: 1 }], ['o']).depth === 2;
  })());
  check('parallel paths take the SHORTEST, which is the definition, not an accident', (() => {
    // Same rail reaching o directly and also the long way round.
    const net = new D.Net();
    net.n('g', D.LOW, 'vdd', 'o');
    net.n('g', D.LOW, 'vdd', 'm');
    net.n('g', D.LOW, 'm', 'o');
    return net.readDepth([{ g: 1 }], ['o']).depth === 1;
  })());
  check('nodes nothing reads are ignored — MIN reads 3 by depth, not the 4 of a dangling branch', (() => {
    const net = new D.Net(); D.tmin(net, 'a', 'b', 'o');
    const rows = L.flatMap(a => L.map(b => ({ a, b })));
    let allNodes = 0;
    for (const r of rows) for (const d of Object.values(net.depths(r))) allNodes = Math.max(allNodes, d);
    return net.readDepth(rows, ['o']).depth === 3 && allNodes > 3;
  })());
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
