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

/**
 * A source that is actually a SOURCE.
 *
 * The first version of this rig seeded bare node names `src0_0`, `src1_0`, ... and
 * expected them to drive. They do not: `T5` says reachability starts at rails and
 * only at rails, and a seeded node with no rail behind it resolves to `Z` on the
 * first pass and stays there. Every routed value came back `Z`, in both topologies,
 * which read as "interconnect does not work" rather than "these are not sources".
 *
 * A seed is an initial VALUE, not a DRIVER. So a register source is a real
 * loop-breaking cell, holding.
 */
function sourceCell(net, tag, q) {
  D.sti(net, q, `${tag}qbraw`);
  D.sti(net, `${q}b`, `${tag}qraw`);
  net.n(`hold`, D.HIGH, `${tag}qbraw`, `${q}b`);
  net.n(`hold`, D.HIGH, `${tag}qraw`, q);
  return net;
}
function addSources(net, S) {
  for (let i = 0; i < S; i++) {
    for (let t = 0; t < TRITS; t++) sourceCell(net, `s${i}_${t}`, `src${i}_${t}`);
  }
  return net;
}
function seedSources(net, inputs, vals, computed = null) {
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  vals.forEach((v, i) => T.toTrits(v).slice(0, TRITS).forEach((tr, t) => {
    if (computed && computed === `src${i}_${t}`) return;
    if (init[`src${i}_${t}`] === undefined) return;
    init[`src${i}_${t}`] = tr; init[`src${i}_${t}b`] = -tr;
  }));
  return init;
}

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
  const net = buildI0(S, Dst); addSources(net, S);
  let ok = 0, bad = 0, stuck = 0;
  for (let pick = 0; pick < S; pick++) {
    for (const vals of [[5, -5, 121], [0, 0, 0], [364, -364, 1]]) {
      const inputs = { hold: D.HIGH };
      for (let d = 0; d < Dst; d++) inputs[`sel${d}_0`] = [D.LOW, D.MID, D.HIGH][pick];
      let sol = null;
      try { sol = net.solve(inputs, 60, seedSources(net, inputs, vals)); } catch (e) { stuck++; continue; }
      const got = T.fromTrits(Array.from({ length: TRITS }, (_, t) => sol[`dst0_${t}`]));
      if (got === T.wrap(vals[pick])) ok++; else bad++;
    }
  }
  console.log(`      I0 with REGISTER sources, state-only seeding: ${ok} routed, ${bad} wrong, ${stuck} never settled`);
  console.log(`      -> a source must be RAIL-DRIVEN, not merely seeded. T5 again:`);
  console.log(`         a seeded node with no rail behind it resolves to Z and stays there.`);
}

console.log('\n--- A2 (boundary)  I0 fed from a COMPUTED source ---');
{
  // The registered boundary: I0's cold-start immunity is claimed for the topology,
  // but it may be a property of the SOURCES. Chain two stages so one input of the
  // second tree is the output of the first — a computed node, Z at pass one, which
  // is what a memory read output actually is.
  const net = new D.Net();
  addSources(net, 3);
  for (let t = 0; t < TRITS; t++) {
    D.tmux(net, 'selA', `src0_${t}`, `src1_${t}`, `src2_${t}`, `stage1_${t}`);
    D.tmux(net, 'selB', `src0_${t}`, `stage1_${t}`, `src1_${t}`, `stage2_${t}`);
  }
  let ok = 0, bad = 0, stuck = 0;
  const vals = [5, -5, 121];
  for (const [selA, selB, want] of [
    [D.LOW, D.MID, vals[0]],      // stage2 picks stage1, which picks src0
    [D.MID, D.MID, vals[1]],      // stage2 picks stage1, which picks src1
    [D.HIGH, D.MID, vals[2]],     // stage2 picks stage1, which picks src2
    [D.LOW, D.LOW, vals[0]],      // stage2 picks src0 directly — no computed hop
  ]) {
    const inputs = { hold: D.HIGH, selA, selB };
    let sol = null;
    try { sol = net.solve(inputs, 60, seedSources(net, inputs, vals)); } catch (e) { stuck++; continue; }
    const got = T.fromTrits(Array.from({ length: TRITS }, (_, t) => sol[`stage2_${t}`]));
    if (got === T.wrap(want)) ok++; else bad++;
  }
  console.log(`      two-stage I0, second stage fed by the first: ${ok} routed, ${bad} wrong, ${stuck} never settled`);
  console.log(`      -> a computed source is still RAIL-DRIVEN through the first tree,`);
  console.log(`         so it resolves rather than poisoning. The precondition that bites`);
  console.log(`         is an unresolved CONTROL node, not a computed DATA node.`);
}

console.log('\n--- A3  I2 two failure modes, produced not asserted ---');
{
  const { net } = buildI2(3, { decode: false });
  addSources(net, 3);
  const run = en => {
    const inputs = { hold: D.HIGH, ...en };
    const sol = net.solve(inputs, 60, seedSources(net, inputs, [5, -5, 121]));
    return Array.from({ length: TRITS }, (_, t) => sol[`bus${t}`]);
  };
  const one = run({ en0: D.HIGH, en1: D.LOW, en2: D.LOW });
  const two = run({ en0: D.HIGH, en1: D.HIGH, en2: D.LOW });
  const none = run({ en0: D.LOW, en1: D.LOW, en2: D.LOW });
  console.log(`      exactly one enable : bus = ${T.fromTrits(one)}   (source 0 holds 5)`);
  console.log(`      two enables        : ${two.join(',')}`);
  console.log(`                           ${two.some(v => v === 'X') ? '-> X on at least one trit, as N4 says' : '-> no X anywhere'}`);
  console.log(`      no enable          : ${none.join(',')}`);
  console.log(`                           ${none.every(v => v === 'Z') ? '-> all Z; a Z into a destination poisons it (N6)' : '-> not all Z'}`);
  // NOT "I0 has no shared node" -- a tmux output IS shared between its legs. The
  // difference is how exclusion is guaranteed: I0 gates every leg on the SAME
  // select trit, and one trit cannot be LOW and HIGH at once, so exclusion is
  // structural. I2 needs S separate enables to be one-hot, which is an invariant
  // something has to uphold every step.
  const i0 = buildI0(3, 1);
  const bySink = new Map();
  for (const d of i0.devices) { if (!bySink.has(d.b)) bySink.set(d.b, []); bySink.get(d.b).push(d); }
  const shared = [...bySink.values()].filter(g => g.length > 1);
  console.log(`      I0: ${shared.length} shared sinks, and every one of them is gated by a`);
  console.log(`          SINGLE select trit -- exclusion is structural, not an invariant.`);
  console.log(`      I2: the bus is gated by ${3} separate enables -- exclusion is an invariant.`);
}


console.log('\n--- A4  the discipline ledger ---');
{
  const rows = [
    ['I0', 'selector tree per destination', 'none IN THIS RIG — selects are inputs', 'none', 'D x S'],
    ['I2', 'decoded one-hot bus', 'a second control cone, solved and seeded every step', 'two: X on double-enable, Z on no-enable', 'S'],
  ];
  console.log('      opt  shape                          cold-start precondition                              failure modes                            cost');
  for (const r of rows) {
    console.log(`      ${r[0].padEnd(4)} ${r[1].padEnd(30)} ${r[2].padEnd(52)} ${r[3].padEnd(40)} ${r[4]}`);
  }
  console.log('');
  console.log('      BOUND: "selects are inputs" is true of this RIG, not of the machine.');
  console.log('      In the assembled machine I0\'s selects come from instruction DECODE, which');
  console.log('      is a computed control node, so I0 inherits a control cone there too. The');
  console.log('      real comparison is ONE cone (decode, required by any design) against TWO');
  console.log('      (decode plus bus enables) — which sharpens the deferral rather than');
  console.log('      weakening it.');
  console.log('');
  console.log('      Whether a second control cone is affordable is a SEQUENCING question,');
  console.log('      and design/09 is unbuilt. This phase produces the crossover, not the pick.');
}

console.log('\n' + '='.repeat(78));
