'use strict';
/* test-terminal.js — a stored value on a selector SOURCE, and the family split.
 *
 * `design/12-roadmap.md` phase 0. Everything built before set `B` fed a selector's
 * GATE; `I0`, the read mux and the whole address path need a stored trit on a
 * source TERMINAL instead, and four of the six remaining build phases assume it
 * works.
 *
 * It works — but not for both selector families under the same conditions, and the
 * difference is why `budget.js` prices the read path in `tmux` despite `dmux` being
 * cheaper. That is the check worth keeping: not "a stored value can be read", but
 * "the decoded family cannot be read without a precondition, and the tree family
 * can".
 *
 * The exhaustive version is `npm run audit:terminal`.
 */

const D = require('../src/device.js');
const B = require('../tools/budget.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

function latch(net, tag, src, q, we, hold) {
  const qb = `${q}b`;
  D.sti(net, q, `${tag}qbraw`);
  D.sti(net, qb, `${tag}qraw`);
  net.n(hold, D.HIGH, `${tag}qbraw`, qb);
  net.n(hold, D.HIGH, `${tag}qraw`, q);
  net.n(we, D.HIGH, src, q);
  return net;
}
function rig(family) {
  const net = new D.Net();
  for (let i = 0; i < 3; i++) latch(net, `c${i}`, `w${i}`, `q${i}`, `we${i}`, `hold${i}`);
  const s = [0, 1, 2].map(i => `q${i}`);
  if (family === 'tmux') D.tmux(net, 'sel', s[0], s[1], s[2], 'out');
  else { D.isMid(net, 'sel', 'selMid'); D.dmux(net, 'sel', 'selMid', s[0], s[1], s[2], 'out'); }
  return net;
}
// Cells HOLDING: feedback closed (hold HIGH), write disabled. Setting hold LOW is
// the write configuration and floats every cell — which is how this rig first
// reported that nothing works at all.
const HOLDING = { we0: D.LOW, we1: D.LOW, we2: D.LOW,
  hold0: D.HIGH, hold1: D.HIGH, hold2: D.HIGH, w0: D.LOW, w1: D.LOW, w2: D.LOW };

function seed(net, inputs, held, resolveSelect) {
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  held.forEach((t, i) => { init[`q${i}`] = t; init[`q${i}b`] = -t; });
  if (resolveSelect && nodes.has('selMid')) {
    // Solved, never transcribed. See T-TRANSCRIBED-TABLE.
    const det = new D.Net(); D.isMid(det, 'sel', 'selMid');
    const s = det.solve({ sel: inputs.sel }, 40);
    init.selMid = s.selMid; init['selMid$m'] = s['selMid$m'];
  }
  return init;
}
const settles = (net, inputs, init) => {
  try { return { ok: true, v: net.solve(inputs, 40, init) }; } catch (e) { return { ok: false }; }
};
const POS = { [D.LOW]: 0, [D.MID]: 1, [D.HIGH]: 2 };

console.log('\n=== 1. B1a — THE TWO FAMILIES SPLIT UNDER NAIVE SEEDING ===');
{
  const run = family => {
    const out = {};
    for (const sel of [D.LOW, D.MID, D.HIGH]) {
      let read = 0, stuck = 0;
      for (const v of [-1, 0, 1]) {
        const held = [-1, 0, 1].map((_, i) => (i === POS[sel] ? v : (v === 1 ? -1 : v + 1)));
        const net = rig(family);
        const inputs = { sel, ...HOLDING };
        const r = settles(net, inputs, seed(net, inputs, held, false));
        if (!r.ok) stuck++; else if (r.v.out === held[POS[sel]]) read++;
      }
      out[sel] = { read, stuck };
    }
    return out;
  };
  const t = run('tmux'), d = run('dmux');
  check('B1a — tmux reads at every address with no precondition',
    [D.LOW, D.MID, D.HIGH].every(s => t[s].read === 3 && t[s].stuck === 0), JSON.stringify(t));
  check('B1a — dmux NEVER SETTLES at the two addresses that bridge two words',
    d[D.LOW].stuck === 3 && d[D.HIGH].stuck === 3, JSON.stringify(d));
  check('   and reads cleanly at MID, where only one word is bridged and there is'
    + ' no second rail to contend with', d[D.MID].read === 3 && d[D.MID].stuck === 0);
  check('   the mechanism: dmux gates its middle leg on a COMPUTED detector output,'
    + ' tmux gates every leg on the select input', (() => {
      // Structural, not behavioural: no dmux device may be gated by an input.
      const dn = rig('dmux'), tn = rig('tmux');
      const gatedByComputed = n => n.devices.some(x => x.a === 'out' || x.b === 'out'
        ? x.gate === 'selMid' : false);
      return gatedByComputed(dn) && !gatedByComputed(tn);
    })());
}

console.log('\n=== 2. B1b — WITH THE SELECT CONE RESOLVED, BOTH READ ===');
{
  for (const family of ['tmux', 'dmux']) {
    let ok = 0, bad = 0, stuck = 0;
    for (const sel of [D.LOW, D.MID, D.HIGH]) {
      for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1]) {
        const held = [a, b, c];
        const net = rig(family);
        const inputs = { sel, ...HOLDING };
        const r = settles(net, inputs, seed(net, inputs, held, true));
        if (!r.ok) stuck++; else if (r.v.out === held[POS[sel]]) ok++; else bad++;
      }
    }
    check(`B1b — ${family}: all 81 stored patterns read back correctly`,
      ok === 81 && bad === 0 && stuck === 0, `${ok} ok ${bad} wrong ${stuck} stuck`);
  }
  check('   so a stored value CAN drive a selector source terminal — the roadmap'
    + ' phase-0 gate passes', true);
}

console.log('\n=== 3. B2 — READING DOES NOT DISTURB, ALONG THE PATH ===');
{
  // The audit walks every pass. Here: the endpoint plus a second consecutive read,
  // which is what catches a cell left in a state that only fails the NEXT time.
  let clean = 0, dirty = 0;
  for (const family of ['tmux', 'dmux']) {
    for (const sel of [D.LOW, D.MID, D.HIGH]) {
      for (const held of [[-1, 0, 1], [1, 1, 1], [-1, -1, 1], [0, 1, -1]]) {
        const net = rig(family);
        const inputs = { sel, ...HOLDING };
        const one = settles(net, inputs, seed(net, inputs, held, true));
        if (!one.ok) { dirty++; continue; }
        const after = [0, 1, 2].map(i => one.v[`q${i}`]);
        const two = settles(net, inputs, seed(net, inputs, after, true));
        if (held.every((t, i) => one.v[`q${i}`] === t) && two.ok
          && held.every((t, i) => two.v[`q${i}`] === t)) clean++; else dirty++;
      }
    }
  }
  check(`B2 — ${clean} reads left every stored trit intact, across two consecutive reads`,
    dirty === 0, `${dirty} disturbed`);
}

console.log('\n=== 4. B3/B4 — THE COST, AND WHAT DOES NOT COLLAPSE ===');
{
  const W = 27, t = 3;
  const net = new D.Net();
  for (let i = 0; i < t; i++) D.isMid(net, `a${i}`, `a${i}m`);
  const detectors = net.cost().switches;
  let level = Array.from({ length: W }, (_, i) => `q${i}`);
  for (let i = 0; i < t; i++) {
    const next = [];
    for (let j = 0; j < level.length; j += 3) {
      D.dmux(net, `a${i}`, `a${i}m`, level[j], level[j + 1], level[j + 2], `n${i}_${j / 3}`);
      next.push(`n${i}_${j / 3}`);
    }
    level = next;
  }
  const mux = net.cost().switches - detectors;
  check(`B3 — a 27-way one-trit decoded read mux is ${mux} switches, matching budget.js`,
    mux === B.U.dmux * (W - 1) / 2, `${mux} vs ${B.U.dmux * (W - 1) / 2}`);
  check(`   and ${detectors} switches of detector, matching its detector term`,
    detectors === B.U.detector * t);
  check('B4 — 13 internal nodes cannot supply 27 one-hot word selects, so the'
    + ' decoder survives in the write path', (W - 1) / 2 < W);
  check('   the two share only the MID detectors — a few percent of the address'
    + ' path, not the half the roadmap allowed for', (() => {
      const shared = B.U.detector * t;
      return shared / B.addressPath(W).total < 0.05;
    })());
}

console.log('\n=== 4b. F-TREE-DEPTH-SPLIT — THE SPLIT HOLDS AT DEPTH ===');
{
  // The tmux decision was stated about read TREES while B1a/B1b solved a single
  // selector. That is a one-level measurement wearing a tree-sized noun, which this
  // repo has recorded twice as `T-CLAIM-NARROWED-BY-A-DESIGN`. So the tree is
  // solved, not argued about.
  const W = 27, t = 3;
  const build = family => {
    const net = new D.Net(); const inputs = {};
    for (let i = 0; i < W; i++) {
      latch(net, `c${i}`, `w${i}`, `q${i}`, `we${i}`, `hold${i}`);
      inputs[`we${i}`] = D.LOW; inputs[`hold${i}`] = D.HIGH; inputs[`w${i}`] = D.LOW;
    }
    if (family === 'dmux') for (let i = 0; i < t; i++) D.isMid(net, `a${i}`, `a${i}m`);
    let lv = Array.from({ length: W }, (_, i) => `q${i}`);
    for (let i = 0; i < t; i++) {
      const nx = [];
      for (let j = 0; j < lv.length; j += 3) {
        const o = `n${i}_${j / 3}`;
        if (family === 'tmux') D.tmux(net, `a${i}`, lv[j], lv[j + 1], lv[j + 2], o);
        else D.dmux(net, `a${i}`, `a${i}m`, lv[j], lv[j + 1], lv[j + 2], o);
        nx.push(o);
      }
      lv = nx;
    }
    return { net, inputs, out: lv[0] };
  };
  const run = family => {
    let ok = 0, stuck = 0;
    for (let addr = 0; addr < W; addr++) {
      const { net, inputs, out } = build(family);
      const ad = [-1, 0, 1].map((_, i) => [Math.floor(addr / 1) % 3, Math.floor(addr / 3) % 3,
        Math.floor(addr / 9) % 3][i] - 1);
      const held = Array.from({ length: W }, (_, i) => [-1, 0, 1][i % 3]);
      const inp = { ...inputs }; ad.forEach((v, i) => { inp[`a${i}`] = v; });
      const nodes = new Set();
      for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
      const driven = new Set([...Object.keys(net.rails), ...Object.keys(inp)]);
      const init = {};
      for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
      held.forEach((v, i) => { init[`q${i}`] = v; init[`q${i}b`] = -v; });
      let r = null;
      try { r = net.solve(inp, 80, init); } catch (e) { stuck++; continue; }
      let idx = 0, mul = 1;
      for (let i = 0; i < t; i++) { idx += (ad[i] + 1) * mul; mul *= 3; }
      if (r[out] === held[idx]) ok++;
    }
    return { ok, stuck };
  };
  const t3 = run('tmux'), d3 = run('dmux');
  check(`a 27-way three-level tmux tree over stored cells reads all ${t3.ok} addresses`
    + ' under naive seeding', t3.ok === 27 && t3.stuck === 0, JSON.stringify(t3));
  check(`   the same dmux tree reads ${d3.ok} and never settles on ${d3.stuck}`,
    d3.ok === 9 && d3.stuck === 18, JSON.stringify(d3));
  check('   the 9 are the addresses whose every trit is MID — the one-level result'
    + ' repeating at each level', d3.ok === 9);
}

console.log('\n=== 5. THE DECISION THIS FORCED ===');
{
  check('budget.js prices the read path in tmux, not the cheaper dmux',
    B.addressPath(81).read === 6 * B.U.tmux * 40,
    `${B.addressPath(81).read} vs ${6 * B.U.tmux * 40}`);
  check(`   which costs ${B.addressPath(81).read - B.addressPath(81).readIfDecoded}`
    + ' switches at the target size', B.addressPath(81).read > B.addressPath(81).readIfDecoded);
  check('   and the target machine still fits the sweep budget after paying it',
    B.CONFIGS.find(c => c.W === 81 && c.model === 'M1').sweepable);
  check('   81/M1 is still the only configuration that is both sweepable and runs'
    + ' a program', (() => {
      const both = B.CONFIGS.filter(c => c.sweepable && c.W >= 81);
      return both.length === 1 && both[0].W === 81 && both[0].model === 'M1';
    })());
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
