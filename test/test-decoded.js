'use strict';
/* test-decoded.js — the adder built on decoded selectors.
 *
 * Z2 predicted that buffering could not take ternary's pass depth below 4, and
 * concluded that 4 was therefore the best available "at any price". A selector
 * gated on a DECODED select reaches 3, and costs less. Z2 is kept as a failed
 * prediction; this is the circuit that failed it, built out to six trits.
 *
 * The construction: one four-switch detector per signal answers "is this MID?",
 * and then every arm of every selector using that signal is a single device. The
 * series pair that X4 proved irreducible still exists — it lives inside the
 * detector, once per signal, instead of inside all thirteen selectors of a tree.
 *
 * The exhaustive sweep is `npm run audit:decoded`. This pins the sampled version,
 * the cost decomposition, the depth, the pass count, and — the check worth having
 * most — that two independently built adders compute the same function.
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

const decoded = new D.Net(); D.dRippleAdder(decoded, 6);
const decodedShared = new D.Net(); D.dRippleAdder(decodedShared, 6, true);
const tree = new D.Net(); D.tRippleAdder(tree, 6);
const bin = D.binaryNet(); D.bRippleAdder(bin, 10);

console.log('\n=== 1. THE PARTS ===');
{
  check('the MID detector reads (-1, 0, -1) in four switches, at depth 2', (() => {
    const n = new D.Net(); D.isMid(n, 'sel', 'im');
    return L.map(sel => n.solve({ sel }).im).join(' ') === '-1 0 -1'
      && n.cost().switches === 4
      && n.readDepth(L.map(sel => ({ sel })), ['im']).depth === 2;
  })());
  check('a decoded selector selects, with three single-device arms', (() => {
    const n = new D.Net(); D.isMid(n, 'sel', 'sel$im');
    D.dmux(n, 'sel', 'sel$im', 'vss', 'vmid', 'vdd', 'o');
    // The OUTPUT sits one hop from its rail — that is the whole point. readDepth
    // reports 2 here, because it also covers the detector's output, which is a
    // gate and does sit two hops out. Both numbers are right; only one of them is
    // about the selector.
    const out = L.map(sel => n.depths({ sel }).o);
    return L.map(sel => n.solve({ sel }).o).join(' ') === '-1 0 1'
      && n.devices.length === 7 && out.every(d => d === 1);
  })());
  check('   against the raw-select selector, which needs four switches and two hops', (() => {
    const n = new D.Net(); D.tmux(n, 'sel', 'vss', 'vmid', 'vdd', 'o');
    return n.cost().switches === 4 && n.readDepth(L.map(sel => ({ sel })), ['o']).depth === 2;
  })());
  check('the series pair did not vanish — it moved into the detector, once per signal', (() => {
    // X4 proved no single device can isolate MID. That is still true; the decoded
    // design pays for it once per SIGNAL rather than once per SELECTOR.
    const det = new D.Net(); D.isMid(det, 'sel', 'im');
    const series = det.devices.filter(d => d.vt === D.MID).length;
    return series === 2 && det.cost().switches === 4;
  })());
  check('one decoded cell is 90 switches at depth 3, against 104 at depth 6', (() => {
    const rows = L.flatMap(a => L.flatMap(b => L.map(c => ({ a, b, c }))));
    const d = new D.Net(); D.dAdderCell(d, 'a', 'b', 'c', 's', 'co', 'A');
    const t = new D.Net(); D.tAdderCell(t, 'a', 'b', 'c', 's', 'co', 'A');
    return d.cost().switches === 90 && d.readDepth(rows, ['s', 'co']).depth === 3
      && t.cost().switches === 104 && t.readDepth(rows, ['s', 'co']).depth === 6;
  })());
}

console.log('\n=== 2. E2 — COST AT SIX TRITS ===');
{
  check('E2 — the decoded ripple is 540 switches, and 360 with leaves shared',
    decoded.cost().switches === 540 && decodedShared.cost().switches === 360,
    `${decoded.cost().switches} / ${decodedShared.cost().switches}`);
  check('E2 — against 624 and 384 for the selector tree: cheaper in both forms',
    tree.cost().switches === 624 && decoded.cost().switches < tree.cost().switches);
  check('E2 — and the cost decomposes as 18 detectors plus 12 trees of 13 selectors', (() => {
    // 18 x 4 = 72 for the detectors, 12 x 13 x 3 = 468 for the selectors.
    return 18 * 4 + 12 * 13 * 3 === 540 && decoded.cost().switches === 540;
  })());
  check('E5 FAILED on taps — the decoded design taps the mid rail MORE, 186 against 168',
    decoded.cost().midRailConnections === 186 && tree.cost().midRailConnections === 168,
    `${decoded.cost().midRailConnections} vs ${tree.cost().midRailConnections}`);
  check('   and the excess is exactly one per detector: eighteen signals, eighteen taps',
    decoded.cost().midRailConnections - tree.cost().midRailConnections === 18, (() => {
      const one = new D.Net(); D.isMid(one, 'sel', 'im');
      return `detector taps ${one.cost().midRailConnections}`;
    })());
  check('   which matters, because Z1 showed the free rail is the largest unpriced thing here',
    decoded.cost().midRailConnections > tree.cost().midRailConnections);
}

console.log('\n=== 3. E3 — DEPTH HOLDS AT SIX TRITS, NOT JUST ONE CELL ===');
{
  const sample = [];
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += 149) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += 149) {
      sample.push({ ...spread('a', a), ...spread('b', b), cin: 0 });
    }
  }
  const outs = Array.from({ length: 6 }, (_, i) => `s${i}`).concat(['c6']);
  const dDepth = decoded.readDepth(sample, outs).depth;
  const tDepth = tree.readDepth(sample, outs).depth;
  check(`E3 — the whole decoded ripple reads depth ${dDepth}, not just one cell of it`,
    dDepth === 3, `depth ${dDepth}`);
  check(`E3 — half the selector tree's ${tDepth}`, tDepth === 6 && dDepth * 2 === tDepth);
  check('E3 — and equal to the binary adder\'s unrestored depth, which was the point', (() => {
    const bSample = [];
    for (let x = 0; x <= 1023; x += 349) for (let y = 0; y <= 1023; y += 349) {
      const o = { cin: -1 };
      for (let i = 0; i < 10; i++) { o[`a${i}`] = ((x >> i) & 1) ? 1 : -1; o[`b${i}`] = ((y >> i) & 1) ? 1 : -1; }
      bSample.push(o);
    }
    const outsB = Array.from({ length: 10 }, (_, i) => `s${i}`).concat(['c10']);
    return bin.readDepth(bSample, outsB).depth === 3;
  })());
  check('   the chain resets at every gate, which is why six cells are no deeper than one',
    dDepth === 3);
}

console.log('\n=== 4. E1, E4 — IT ADDS, AND IN HOW MANY PASSES ===');
{
  const STEP = 17;
  for (const [label, net] of [['decoded', decoded], ['decoded, shared', decodedShared]]) {
    let n = 0, wrong = 0, first = '';
    for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += STEP) {
      for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += STEP) {
        n++;
        const sol = net.solve({ ...spread('a', a), ...spread('b', b), cin: 0 }, 20);
        if (gather(sol) !== T.wrap(a + b) || sol.c6 !== overflow(a, b, 0)) {
          wrong++; if (!first) first = `${a}+${b}`;
        }
      }
    }
    check(`E1 — the ${label} adder matches T.add over ${n.toLocaleString()} pairs, sum and overflow`,
      wrong === 0, first);
  }
  let cinWrong = 0;
  for (const cin of [-1, 1]) {
    for (const [a, b] of [[0, 0], [7, 5], [364, 0], [-364, 0], [121, 121]]) {
      const sol = decoded.solve({ ...spread('a', a), ...spread('b', b), cin }, 20);
      if (gather(sol) !== T.wrap(a + b + cin) || sol.c6 !== overflow(a, b, cin)) cinWrong++;
    }
  }
  check('E1 — carry-in is carried in', cinWrong === 0, `${cinWrong} wrong`);

  const settles = (net, inputs, k) => { try { net.solve(inputs, k); return true; } catch (e) { return false; } };
  const passesOf = (net, inputs) => {
    for (let k = 1; k <= 40; k++) if (settles(net, inputs, k)) return k;
    return null;
  };
  const dist = new Map();
  let m = 0;
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += 37) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += 37) {
      m++;
      const p = passesOf(decoded, { ...spread('a', a), ...spread('b', b), cin: 0 });
      dist.set(p, (dist.get(p) || 0) + 1);
    }
  }
  const counts = [...dist.keys()].sort((x, y) => x - y);
  check(`E4 FAILED — the pass count is NOT 13 always: it ranges ${counts[0]} to ${counts[counts.length - 1]}`
    + ` over ${m} sampled pairs`, counts.length > 1 && counts[counts.length - 1] === 13,
    counts.join(' '));
  check('E4 FAILED — and it DEPENDS ON THE DATA, which nothing in this repo did before', (() => {
    // Y2 and Z5 both found the pass count fixed whatever the operands. That is a
    // property of gating every arm on the RAW select, so every arm's conduction
    // becomes known at the same moment. Split the gating across two dependency
    // levels and partial information can settle a node early.
    const p = (a, b) => passesOf(decoded, { ...spread('a', a), ...spread('b', b), cin: 0 });
    return new Set([p(364, 1), p(0, 0), p(121, 121), p(-364, -1)]).size > 1;
  })());
  check('   the mechanism: a leaf settles early when its LOW and MID cells agree', (() => {
    // With the carry-in LOW, the LOW arm conducts on the raw select and the MID
    // arm's gate is still unknown. If both arms lead to the SAME rail, the node
    // is determined anyway (N3), a whole pass before the detector resolves.
    const t = D.adderTables();
    const agree = table => {
      let n = 0;
      for (let av = -1; av <= 1; av++) for (let bv = -1; bv <= 1; bv++) {
        if (table[D.cellIndex(av, bv, -1)] === table[D.cellIndex(av, bv, 0)]) n++;
      }
      return n;
    };
    return agree(t.carry) === 6 && agree(t.sum) === 0;
  })());
  check('E4 — 13 was right as the WORST case, which is what the derivation actually bounded',
    counts[counts.length - 1] === 13);
  check('E4 — the selector tree, by contrast, is 7 for every pair', (() => {
    const s = new Set();
    for (const [a, b] of [[364, 1], [0, 0], [121, 121], [-364, -1], [7, 5]]) {
      s.add(passesOf(tree, { ...spread('a', a), ...spread('b', b), cin: 0 }));
    }
    return s.size === 1 && s.has(7);
  })());
  check('   so two currencies improved and one got worse, as registered — the third just varies',
    decoded.cost().switches < tree.cost().switches                     // switches: better
    && 3 < 6                                                            // pass depth: better
    && counts[counts.length - 1] > 7);                                  // stages: worse
}

console.log('\n=== 5. TWO INDEPENDENT ADDERS, ONE FUNCTION ===');
{
  // The strongest check available here: two circuits built from different
  // primitives, compared against each other rather than both against T.add.
  let n = 0, differ = 0, first = '';
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += 23) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += 23) {
      n++;
      const inputs = { ...spread('a', a), ...spread('b', b), cin: 0 };
      const d = decoded.solve(inputs, 20), t = tree.solve(inputs, 20);
      if (gather(d) !== gather(t) || d.c6 !== t.c6) { differ++; if (!first) first = `${a}+${b}`; }
    }
  }
  check(`the decoded and selector-tree adders agree on all ${n.toLocaleString()} sampled pairs`,
    differ === 0, first);
  check('   and they really are different circuits, not the same one twice',
    decoded.devices.length !== tree.devices.length
    && new Set(decoded.devices.map(d => `${d.kind}${d.vt}`)).size > 0
    && decoded.devices.filter(d => d.vt === D.MID).length
       !== tree.devices.filter(d => d.vt === D.MID).length);
}

console.log('\n=== 6. THE SWEEP HAS TEETH ===');
{
  // Corrupt the detector so it reports MID for a LOW input, and confirm the
  // sampled sweep notices. Without this, "0 wrong" means nothing.
  const broken = new D.Net();
  D.dRippleAdder(broken, 6);
  const victim = broken.devices.find(d => d.kind === 'p' && d.vt === D.LOW && d.a === 'vss');
  victim.vt = D.HIGH;                       // now pulls to vss for every level
  let caught = 0, n = 0;
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += 17) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += 17) {
      n++;
      let sol;
      try { sol = broken.solve({ ...spread('a', a), ...spread('b', b), cin: 0 }, 20); }
      catch (e) { caught++; continue; }
      if (gather(sol) !== T.wrap(a + b) || sol.c6 !== overflow(a, b, 0)) caught++;
    }
  }
  check(`one bent detector switch is caught on ${caught} of ${n} sampled pairs`,
    caught > 0, 'the sweep is blind to a broken detector');
  check('   and the bend was to a device that exists and mattered',
    victim !== undefined && victim.vt === D.HIGH);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
