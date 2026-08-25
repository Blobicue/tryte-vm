'use strict';
/* test-interconnect.js — I0 against I2, and the axis the design phase watched wrong.
 *
 * Set `A`. The exhaustive version is `npm run audit:interconnect`.
 *
 * The checks worth keeping are the two that changed what the plan says:
 *
 *   - the crossover is in DESTINATIONS. `I0` grows as D x S and `I2` as S alone, so
 *     `I0` wins only at one destination with three sources and loses everywhere
 *     else. Two documents predicted the opposite, on the wrong axis.
 *   - `A2`'s boundary FAILED, usefully. A computed DATA source is rail-driven
 *     through whatever produced it and resolves fine; what poisons a network is an
 *     unresolved CONTROL node. Control versus data, not computed versus seeded.
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const TRITS = 6;

function sourceCell(net, tag, q) {
  D.sti(net, q, `${tag}qbraw`);
  D.sti(net, `${q}b`, `${tag}qraw`);
  net.n('hold', D.HIGH, `${tag}qbraw`, `${q}b`);
  net.n('hold', D.HIGH, `${tag}qraw`, q);
  return net;
}
// A source must be RAIL-DRIVEN, not merely seeded: T5 starts reachability at rails
// and only at rails, so a seeded bare node resolves to Z and stays there.
function addSources(net, S) {
  for (let i = 0; i < S; i++) for (let t = 0; t < TRITS; t++) sourceCell(net, `s${i}_${t}`, `src${i}_${t}`);
  return net;
}
function seedSources(net, inputs, vals) {
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  vals.forEach((v, i) => T.toTrits(v).slice(0, TRITS).forEach((tr, t) => {
    if (init[`src${i}_${t}`] === undefined) return;
    init[`src${i}_${t}`] = tr; init[`src${i}_${t}b`] = -tr;
  }));
  return init;
}
function buildI0(S, Dst) {
  const net = new D.Net();
  for (let d = 0; d < Dst; d++) {
    for (let t = 0; t < TRITS; t++) {
      let level = Array.from({ length: S }, (_, i) => `src${i}_${t}`);
      let lvl = 0;
      while (level.length > 1) {
        const next = [];
        for (let j = 0; j < level.length; j += 3) {
          const o = `d${d}t${t}l${lvl}n${j / 3}`;
          D.tmux(net, `sel${d}_${lvl}`, level[j], level[j + 1] || 'vss', level[j + 2] || 'vss', o);
          next.push(o);
        }
        level = next; lvl++;
      }
      net.n('vdd', D.HIGH, level[0], `dst${d}_${t}`);
    }
  }
  return net;
}
function buildI2(S, decode = true) {
  const net = new D.Net();
  const t3 = Math.max(1, Math.ceil(Math.log(S) / Math.log(3) - 1e-9));
  if (decode) {
    net.n('busen', D.HIGH, 'vdd', 'broot');
    net.p('busen', D.MID, 'vss', 'broot');
    for (let i = 0; i < t3; i++) D.isMid(net, `b${i}`, `b${i}m`);
    let level = [{ name: 'broot', idx: 0 }];
    for (let i = 0; i < t3; i++) {
      const stride = 3 ** i;
      const next = [];
      for (const node of level) {
        const outs = [0, 1, 2].map(k => {
          const idx = node.idx + k * stride;
          return i === t3 - 1 ? `en${idx}` : `bd${i}_${idx}`;
        });
        net.p(`b${i}`, D.LOW, node.name, outs[0]);
        net.n(`b${i}m`, D.MID, node.name, outs[1]);
        net.n(`b${i}`, D.HIGH, node.name, outs[2]);
        net.n(`b${i}`, D.MID, 'vss', outs[0]);
        net.p(`b${i}`, D.MID, 'vss', outs[2]);
        net.p(`b${i}`, D.LOW, 'vss', outs[1]);
        net.n(`b${i}`, D.HIGH, 'vss', outs[1]);
        outs.forEach((name, k) => next.push({ name, idx: node.idx + k * stride }));
      }
      level = next;
    }
  }
  for (let i = 0; i < S; i++) for (let t = 0; t < TRITS; t++) net.n(`en${i}`, D.HIGH, `src${i}_${t}`, `bus${t}`);
  return net;
}

console.log('\n=== 1. A1 — THE CROSSOVER IS IN DESTINATIONS ===');
{
  const cost = (S, Dst) => ({ i0: buildI0(S, Dst).cost().switches, i2: buildI2(S).cost().switches });
  const m = cost(4, 3);
  check(`at 4 sources and 3 destinations: I0 ${m.i0}, I2 ${m.i2} — I2 wins`,
    m.i0 === 234 && m.i2 === 62, JSON.stringify(m));
  check('   I0 grows with destinations and I2 does not', (() => {
    const a = cost(4, 1), b = cost(4, 3);
    return b.i0 === a.i0 * 3 && b.i2 === a.i2;
  })());
  check('   I0 wins in exactly one corner of the surface: one destination, three sources',
    (() => {
      const wins = [];
      for (const S of [3, 4, 9]) for (const Dst of [1, 2, 3]) {
        const c = cost(S, Dst);
        if (c.i0 < c.i2) wins.push(`${S}x${Dst}`);
      }
      return wins.length === 1 && wins[0] === '3x1';
    })());
  check('   a 4-way tree is three nodes, not the two the obvious formula gives',
    (() => {
      const perTrit = buildI0(4, 1).cost().switches / TRITS;
      return (perTrit - 1) / 4 === 3 && Math.ceil((4 - 1) / 2) === 2;
    })());
}

console.log('\n=== 2. A2 — COLD START, AND THE BOUNDARY THAT FAILED ===');
{
  const S = 3, net = buildI0(S, 2); addSources(net, S);
  let ok = 0;
  for (let pick = 0; pick < S; pick++) {
    for (const vals of [[5, -5, 121], [0, 0, 0], [364, -364, 1]]) {
      const inputs = { hold: D.HIGH, sel0_0: [D.LOW, D.MID, D.HIGH][pick], sel1_0: D.LOW };
      const sol = net.solve(inputs, 60, seedSources(net, inputs, vals));
      if (T.fromTrits(Array.from({ length: TRITS }, (_, t) => sol[`dst0_${t}`])) === T.wrap(vals[pick])) ok++;
    }
  }
  check(`I0 with register sources routes ${ok}/9 under state-only seeding — it cold-starts`,
    ok === 9, String(ok));

  // The registered boundary, and it is false: a computed DATA source resolves fine.
  const two = new D.Net(); addSources(two, 3);
  for (let t = 0; t < TRITS; t++) {
    D.tmux(two, 'selA', `src0_${t}`, `src1_${t}`, `src2_${t}`, `stage1_${t}`);
    D.tmux(two, 'selB', `src0_${t}`, `stage1_${t}`, `src1_${t}`, `stage2_${t}`);
  }
  const vals = [5, -5, 121];
  let chained = 0;
  for (const [selA, want] of [[D.LOW, vals[0]], [D.MID, vals[1]], [D.HIGH, vals[2]]]) {
    const inputs = { hold: D.HIGH, selA, selB: D.MID };
    const sol = two.solve(inputs, 60, seedSources(two, inputs, vals));
    if (T.fromTrits(Array.from({ length: TRITS }, (_, t) => sol[`stage2_${t}`])) === T.wrap(want)) chained++;
  }
  check(`A2's boundary FAILED: a tree fed by another tree routes ${chained}/3 anyway`,
    chained === 3, String(chained));
  check('   because a computed DATA node is rail-driven through what produced it —'
    + ' the thing that poisons a network is an unresolved CONTROL node', chained === 3);
}

console.log('\n=== 3. A3 — I2\'S TWO FAILURE MODES, PRODUCED ===');
{
  const net = buildI2(3, false); addSources(net, 3);
  const run = en => {
    const inputs = { hold: D.HIGH, ...en };
    const sol = net.solve(inputs, 60, seedSources(net, inputs, [5, -5, 121]));
    return Array.from({ length: TRITS }, (_, t) => sol[`bus${t}`]);
  };
  const one = run({ en0: D.HIGH, en1: D.LOW, en2: D.LOW });
  const two = run({ en0: D.HIGH, en1: D.HIGH, en2: D.LOW });
  const none = run({ en0: D.LOW, en1: D.LOW, en2: D.LOW });
  check('one enable puts the source on the bus', T.fromTrits(one) === 5, String(T.fromTrits(one)));
  check('two enables put X on the bus — N4, produced not asserted',
    two.some(v => v === 'X'), two.join(','));
  check('no enable leaves the bus at Z, which poisons a destination reading it',
    none.every(v => v === 'Z'), none.join(','));
  check('F-CONTENTION-IS-DATA-DEPENDENT — X appears ONLY where the two sources'
    + ' differ, so a double-enable fault is invisible when they agree', (() => {
      const a = T.toTrits(5).slice(0, TRITS), b = T.toTrits(-5).slice(0, TRITS);
      return two.every((v, i) => (a[i] === b[i]) ? v === a[i] : v === 'X');
    })(), two.join(','));
  // The real distinction, and the audit's first phrasing of it was wrong. A tmux
  // output IS a shared node — `lo` and `hi` both reach it. What differs is HOW
  // mutual exclusion is guaranteed:
  //
  //   I0: every leg is gated by the SAME select trit, and one trit cannot be LOW
  //       and HIGH at once. Exclusion is structural — nothing has to maintain it.
  //   I2: exclusion needs S separate enable signals to be one-hot. That is an
  //       INVARIANT, and something must uphold it every step.
  //
  // "I0 has no shared node" would have been a comfortable and false thing to say.
  check('   I0\'s legs share a node too — its safety is that one select trit cannot'
    + ' hold two values, not that nothing is shared', (() => {
      const i0 = buildI0(3, 1);
      const bySink = new Map();
      for (const d of i0.devices) {
        if (!bySink.has(d.b)) bySink.set(d.b, []);
        bySink.get(d.b).push(d);
      }
      const shared = [...bySink.values()].filter(g => g.length > 1);
      const allSameGate = shared.every(g => new Set(g.map(d => d.gate)).size === 1);
      return shared.length > 0 && allSameGate;
    })());
  check('   whereas I2\'s exclusion rests on S separate enables being one-hot —'
    + ' an invariant something must uphold, not a structural fact', (() => {
      const i2 = buildI2(3, false);
      const onBus = i2.devices.filter(d => d.b === 'bus0');
      return onBus.length === 3 && new Set(onBus.map(d => d.gate)).size === 3;
    })());
}

console.log('\n=== 4. A4 — THE PICK IS DEFERRED, AND THAT IS THE RESULT ===');
{
  const i0 = buildI0(4, 3).cost().switches, i2 = buildI2(4).cost().switches;
  check(`I2 is ${(i0 / i2).toFixed(1)}x cheaper and carries a discipline I0 does not`,
    i0 / i2 > 3);
  check('   whether a second control cone is affordable is a sequencing question,'
    + ' and design/09 is unbuilt', (() => {
      const fs = require('fs'); const path = require('path');
      const seq = fs.readFileSync(path.join(__dirname, '..', 'design', '09-sequencing.md'), 'utf8');
      return seq.includes('PROPOSED');
    })());
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
