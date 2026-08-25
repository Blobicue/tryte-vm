'use strict';
/* INTERCONNECT AUDIT — `I0` against `I2`, and where they actually cross.
 *
 * Phase 1 of `design/12-roadmap.md`. Get a tryte from any source to any
 * destination without the model declaring the result unknown.
 *
 * NOTE ON IDS: prediction ids here are `A1`-style; the interconnect OPTIONS are
 * `I0`-`I6` and live in `design/06-interconnect.md`. Letter `A` was chosen for the
 * set because `A0`-`A5` are the MEMORY options, which this phase does not touch.
 * Same collision-avoidance the `B` and `C` letters needed.
 *
 * ------------------------------------------------------------------------------
 * CARRIED IN:
 *
 *   - `I0`'s sources are register outputs — STORED nodes — so its selectors must
 *     be `tmux`: `B1a` measured the decoded family failing to settle on stored
 *     terminals, at one level and again on a 27-way tree;
 *   - a decoder's outputs must be DEFINITELY driven, not merely routed. `C2`
 *     measured a bare routing tree corrupting 104 words because unselected lines
 *     float and a floating gate is unknown conduction (`N6`);
 *   - `C1` built a decoder at 7 switches per node plus shared detectors;
 *   - a control signal that is a computed node is unknown at pass one, and by `N6`
 *     poisons what it gates until the cone is solved and seeded
 *     (`T-COMPUTED-CONTROL-UNKNOWN-AT-PASS-ONE`).
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   A1  THE CROSSOVER IS IN DESTINATIONS, NOT SOURCES — which falsifies two
 *       registered expectations. `design/06-interconnect.md` says "`I0` is the one
 *       this project is set up to win with", and `12-roadmap.md` registered "`I0`
 *       wins at this scale and loses badly by eight sources".
 *
 *       `I0` costs one selector tree PER DESTINATION, so it grows as D x S. `I2`
 *       costs one pass switch per source plus one decoder, so it grows as S alone.
 *       The destination count is the axis that decides it, and the source count is
 *       nearly irrelevant.
 *
 *       Predicted: at the machine's counts — 4 sources, 3 destinations — `I2` is
 *       roughly three times cheaper, and `I0` wins only in the corner where there
 *       is ONE destination and at most three sources.
 *
 *       The tree node counts are BUILT at S = 4 and S = 9 rather than taken from a
 *       formula, because the obvious formula `ceil((S-1)/2)` is wrong for
 *       non-powers of three: a 4-way tree is three nodes, not two.
 *
 *   A2  BUT `I0` COLD-STARTS, AND ONLY WITH REGISTER SOURCES. `I0`'s selects are
 *       address INPUTS, known at pass one, so it needs no resolved control cone.
 *       Predicted: `I0` routes correctly under state-only seeding for every
 *       (source, destination) pair and every value, while `I2` does not, because
 *       its enables are decoder outputs.
 *
 *       THE BOUNDARY, stated because `T-CLAIM-NARROWED-BY-A-DESIGN` is the most
 *       recorded trap here: that immunity holds only where `I0`'s sources are
 *       registers whose values are seeded. In the real machine at least one source
 *       is the MEMORY READ OUTPUT, a computed node unknown at pass one. Predicted:
 *       `I0` fed from a computed source inherits exactly the precondition `I2` has,
 *       so the immunity is a property of the source, not of the topology.
 *
 *   A3  AND `I2` HAS TWO FAILURE MODES `I0` CANNOT HAVE. Produced deliberately,
 *       not asserted: two enables asserted at once puts the bus at `X` (`N4`), and
 *       NO enable asserted leaves it at `Z`, which poisons any destination reading
 *       it (`N6`). `I0` has neither by construction, because `T2` holds for a
 *       selector tree and there is no shared node to contend for.
 *
 *   A4  AND THE DECISION MAY NOT BELONG TO THIS PHASE. `I2`'s discipline cost —
 *       a second control cone that must be solved and seeded every step — is a
 *       SEQUENCING question, and `design/09-sequencing.md` is unbuilt. Predicted:
 *       this phase produces the crossover and a per-option discipline ledger, and
 *       the pick stays `PROPOSED` pending sequencing rather than being forced here.
 *       Registered so that deferring is a result rather than an omission.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');
const B = require('./budget.js');

console.log('INTERCONNECT AUDIT — I0 against I2.\n');

const TRITS = 6;

/** How many 3-way nodes a tree over S leaves needs. Built, not assumed. */
function treeNodes(S) {
  let n = 0, level = S;
  while (level > 1) { const k = Math.ceil(level / 3); n += k; level = k; }
  return n;
}

/** I0: one tmux tree per destination. Sources sit on terminals, selects are inputs. */
function buildI0(S, Dst, sourceName = i => `src${i}`) {
  const net = new D.Net();
  for (let d = 0; d < Dst; d++) {
    for (let t = 0; t < TRITS; t++) {
      let level = Array.from({ length: S }, (_, i) => `${sourceName(i)}_${t}`);
      let lvl = 0;
      while (level.length > 1) {
        const next = [];
        for (let j = 0; j < level.length; j += 3) {
          const o = `d${d}t${t}l${lvl}n${j / 3}`;
          // Unused legs sit on vss. A tmux is 4 switches whatever is on its legs,
          // so padding is free in switches; it only fixes a don't-care value.
          D.tmux(net, `sel${d}_${lvl}`, level[j], level[j + 1] || 'vss', level[j + 2] || 'vss', o);
          next.push(o);
        }
        level = next; lvl++;
      }
      net.n('vdd', D.HIGH, level[0], `dst${d}_${t}`);      // tap the tree's root
    }
  }
  return net;
}

/** I2: one bus per trit, every source gated onto it, enables from a decoder. */
function buildI2(S, opts = {}) {
  const { decode = true } = opts;
  const net = new D.Net();
  const t3 = Math.max(1, Math.ceil(Math.log(S) / Math.log(3) - 1e-9));
  const lines = 3 ** t3;
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
        // Definite drive, per C2: route in, and pull the other two to LOW.
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
  for (let i = 0; i < S; i++) {
    for (let t = 0; t < TRITS; t++) net.n(`en${i}`, D.HIGH, `src${i}_${t}`, `bus${t}`);
  }
  return { net, lines, addrTrits: t3 };
}

console.log('--- A1  the crossover: built node counts, then the surface ---');
{
  for (const S of [3, 4, 9]) {
    const one = buildI0(S, 1);
    const perTrit = one.cost().switches / TRITS;
    console.log(`      S=${S}: treeNodes says ${treeNodes(S)}, built tree is `
      + `${perTrit} switches per trit = ${(perTrit - 1) / B.U.tmux} tmux nodes plus the tap`);
  }
  console.log('');
  console.log('      sources x destinations      I0      I2   winner');
  for (const S of [3, 4, 9]) {
    for (const Dst of [1, 2, 3]) {
      const i0 = buildI0(S, Dst).cost().switches;
      const i2 = buildI2(S).net.cost().switches;
      console.log(`      S=${S} D=${Dst}            ${String(i0).padStart(6)}  ${String(i2).padStart(6)}`
        + `   ${i0 < i2 ? 'I0' : 'I2'}`);
    }
  }
  const m = { S: 4, D: 3 };
  const i0 = buildI0(m.S, m.D).cost().switches, i2 = buildI2(m.S).net.cost().switches;
  console.log(`\n      at the machine's counts (${m.S} sources, ${m.D} destinations): `
    + `I0 ${i0}, I2 ${i2} — I2 is ${(i0 / i2).toFixed(1)}x cheaper`);
}

console.log('\n--- A2  does I0 cold-start? and with what sources? ---');
{
  const S = 3, Dst = 2;
  const net = buildI0(S, Dst);
  const seedFor = (inputs, vals) => {
    const nodes = new Set();
    for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
    const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
    const init = {};
    for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
    vals.forEach((v, i) => T.toTrits(v).slice(0, TRITS).forEach((tr, t) => { init[`src${i}_${t}`] = tr; }));
    return init;
  };
  let ok = 0, bad = 0, stuck = 0;
  for (let pick = 0; pick < S; pick++) {
    for (const vals of [[5, -5, 121], [0, 0, 0], [364, -364, 1]]) {
      const inputs = {}; for (let d = 0; d < Dst; d++) inputs[`sel${d}_0`] = [D.LOW, D.MID, D.HIGH][pick];
      let sol = null;
      try { sol = net.solve(inputs, 60, seedFor(inputs, vals)); } catch (e) { stuck++; continue; }
      const got = T.fromTrits(Array.from({ length: TRITS }, (_, t) => sol[`dst0_${t}`]));
      if (got === T.wrap(vals[pick])) ok++; else bad++;
    }
  }
  console.log(`      I0 with REGISTER sources, state-only seeding: ${ok} routed, ${bad} wrong, ${stuck} never settled`);

  // The boundary: one source is a computed node instead of a seeded register.
  const net2 = buildI0(S, 1);
  D.tBuffer(net2, 'raw', 'src2_0', 'CS');            // src2 trit 0 becomes computed
  let ok2 = 0, bad2 = 0, stuck2 = 0;
  for (const pick of [0, 2]) {
    const inputs = { sel0_0: [D.LOW, D.MID, D.HIGH][pick], raw: 1 };
    const nodes = new Set();
    for (const d of net2.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
    const driven = new Set([...Object.keys(net2.rails), ...Object.keys(inputs)]);
    const init = {};
    for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
    [5, -5, 0].forEach((v, i) => T.toTrits(v).slice(0, TRITS).forEach((tr, t) => {
      if (!(i === 2 && t === 0)) init[`src${i}_${t}`] = tr;
    }));
    let sol = null;
    try { sol = net2.solve(inputs, 60, init); } catch (e) { stuck2++; continue; }
    const got = sol.dst0_0;
    const want = pick === 2 ? 1 : T.toTrits(5)[0];
    if (got === want) ok2++; else bad2++;
  }
  console.log(`      I0 with one COMPUTED source, state-only seeding: ${ok2} routed, `
    + `${bad2} wrong, ${stuck2} never settled`);
}

console.log('\n--- A3  I2\'s two failure modes, produced not asserted ---');
{
  const { net } = buildI2(3, { decode: false });     // drive enables directly
  const seedFor = inputs => {
    const nodes = new Set();
    for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
    const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
    const init = {};
    for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
    [5, -5, 121].forEach((v, i) => T.toTrits(v).slice(0, TRITS).forEach((tr, t) => { init[`src${i}_${t}`] = tr; }));
    return init;
  };
  const busOf = sol => Array.from({ length: TRITS }, (_, t) => sol[`bus${t}`]);
  const one = net.solve({ en0: D.HIGH, en1: D.LOW, en2: D.LOW }, 60, seedFor({ en0: D.HIGH, en1: D.LOW, en2: D.LOW }));
  const two = net.solve({ en0: D.HIGH, en1: D.HIGH, en2: D.LOW }, 60, seedFor({ en0: D.HIGH, en1: D.HIGH, en2: D.LOW }));
  const none = net.solve({ en0: D.LOW, en1: D.LOW, en2: D.LOW }, 60, seedFor({ en0: D.LOW, en1: D.LOW, en2: D.LOW }));
  console.log(`      exactly one enable : bus = ${T.fromTrits(busOf(one))}  (source 0 holds 5)`);
  console.log(`      two enables        : bus = ${busOf(two).join(',')}  `
    + `${busOf(two).some(v => v === 'X') ? '-> X, as N4 says' : '-> NOT X'}`);
  console.log(`      no enable          : bus = ${busOf(none).join(',')}  `
    + `${busOf(none).every(v => v === 'Z') ? '-> Z, and a Z into a destination poisons it' : '-> not Z'}`);
  const i0 = buildI0(3, 1);
  console.log(`      I0 has no shared node to contend for: `
    + `${new Set(i0.devices.map(d => d.b)).size} distinct sinks, none written by two trees`);
}

console.log('\n--- A4  the discipline ledger ---');
{
  const rows = [
    ['I0', 'selector tree per destination', 'none — selects are inputs', 'none', 'D x S'],
    ['I2', 'decoded one-hot bus', 'a second control cone, solved and seeded every step', 'two: X on double-enable, Z on no-enable', 'S'],
  ];
  console.log('      opt  shape                          cold-start precondition                              failure modes                            cost');
  for (const r of rows) {
    console.log(`      ${r[0].padEnd(4)} ${r[1].padEnd(30)} ${r[2].padEnd(52)} ${r[3].padEnd(40)} ${r[4]}`);
  }
  console.log('\n      Whether a second control cone is affordable is a SEQUENCING question,');
  console.log('      and design/09 is unbuilt. This phase produces the crossover, not the pick.');
}

console.log('\n' + '='.repeat(78));
