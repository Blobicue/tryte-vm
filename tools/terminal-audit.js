'use strict';
/* TERMINAL AUDIT — can a stored value drive a selector's SOURCE, not just its gate?
 *
 * Every circuit in this repository feeds a selector's **gate**. `I0` interconnect,
 * the memory read path, and the whole address path need the other thing: a stored
 * trit sitting on a selector's source terminal, passed through to an output.
 * `design/05-registers.md` flagged that nothing establishes it, and
 * `design/12-roadmap.md` makes it phase 0 because four of the six remaining phases
 * assume the answer.
 *
 * ------------------------------------------------------------------------------
 * CARRIED IN (measured elsewhere, not re-established here):
 *
 *   - a loop-breaking storage cell holds all three trits when seeded, 19 switches
 *     built for test and 11 in place (`J1`, `J2`);
 *   - `dmux` is 3 switches and `isMid` is 4, and the detector is shared across
 *     every selector driven by the same select trit (`E`, `I`);
 *   - `tmux` is 4 switches and gates all three legs on the select input directly.
 *
 * THE PREMISE THIS PHASE IS REALLY ABOUT — stated, because `T-PREMISE-NOT-ANSWER`
 * bit once already when a prediction assumed its network resolves at all.
 *
 *   `T5` says reachability starts at rails AND ONLY AT RAILS, and that an input
 *   does not source. A stored `q` is NOT an input — it is an internal node with an
 *   inverter behind it — so the walk should continue through `q` to that inverter's
 *   rail. That is why B1 is expected to hold at all.
 *
 *   But the solver treats UNKNOWN conduction as possible (`N6`), and the two
 *   selector families differ in exactly the way that matters:
 *
 *     - `tmux` gates all three legs on the select INPUT. An input is known on pass
 *       one, so no leg is ever unknown.
 *     - `dmux` gates its middle leg on `selMid`, a COMPUTED detector output. Under
 *       naive state-only seeding that node is `Z` on pass one, so the middle leg's
 *       conduction is unknown, so a path exists from the selected word's `q`
 *       through `out` and back down into a SECOND word's `q` and its rail.
 *
 *   Two rails possibly reaching the selected `q` makes it `X` — the stored value
 *   transiently corrupted by being read, even though its own definite path is
 *   intact. Whether the cell recovers or the network fails to settle is the
 *   question, not a detail of it.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   B1a UNDER NAIVE SEEDING THE TWO FAMILIES SPLIT. With only state nodes seeded
 *       and the select cone left to resolve itself: `tmux` reads correctly for all
 *       three stored trits at every terminal position. `dmux` does NOT — predicted
 *       either a wrong/`X` read or a network that never settles, on the two
 *       address values that bridge two words (select = LOW and select = HIGH),
 *       and a clean read on select = MID, where only one word is bridged and there
 *       is no second rail to contend with.
 *
 *       If `dmux` reads cleanly under naive seeding, this prediction is simply
 *       wrong and the seeding discipline is looser than `N6` suggests. That is the
 *       more useful outcome of the two and it is registered as such.
 *
 *   B1b UNDER SELECT-RESOLVED SEEDING BOTH FAMILIES READ CORRECTLY. Seed the
 *       detector outputs to their settled values and every stored trit reads back
 *       through both families, at every terminal position, for all three values.
 *       This is the claim the roadmap actually needs, and it is expected to hold.
 *
 *   B2  AND READING DOES NOT DISTURB WHAT IS STORED — ALONG THE PATH, NOT ONLY AT
 *       THE END. A final-state check would pass while `q` passed through `X`
 *       mid-solve, which is the defect a suite of 481 fixed-point checks missed
 *       once already. So: `q` holds its value at EVERY pass of the solve, and
 *       still holds it after a second consecutive read.
 *
 *   B3  AND THE READ PATH COSTS WHAT `budget.js` SAYS. A 27-way, one-trit read
 *       mux built out of `dmux` is predicted at exactly 39 switches — the tool's
 *       `read` term for one trit — plus 3 shared detectors at 4 each. The point is
 *       to test a PROPOSED term in the budget against a built structure. If it
 *       misses, every total in `design/12-roadmap.md` moves.
 *
 *   B4  AND THE DECODER DOES NOT COLLAPSE INTO THE READ MUX. `design/07-memory.md`
 *       suspects `D0` and `D1` are one structure seen from two ends, and
 *       `12-roadmap.md` says the address path "roughly halves" if so. Predicted
 *       NO, on a counting argument: a 27-word read mux has (27-1)/2 = 13 internal
 *       nodes, while a write path needs 27 one-hot word selects, one per word.
 *       13 < 27, so the mux cannot supply them and `D0` survives in the write
 *       path. Predicted shared: the 3 MID detectors only — 12 switches out of a
 *       525-switch address path, about 2%, not half.
 *
 *       That decides 243 words, and therefore the target machine.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');
const B = require('./budget.js');

const line = '='.repeat(78);
console.log('TERMINAL AUDIT — a stored value on a selector source.\n');

// --- instruments -------------------------------------------------------------

/** The loop-breaking cell, as J built it. */
function latch(net, tag, src, q, we, hold) {
  const qb = `${q}b`;
  D.sti(net, q, `${tag}qbraw`);
  D.sti(net, qb, `${tag}qraw`);
  net.n(hold, D.HIGH, `${tag}qbraw`, qb);
  net.n(hold, D.HIGH, `${tag}qraw`, q);
  net.n(we, D.HIGH, src, q);
  return net;
}

/**
 * A staged solve: the same fixed point, recording every pass.
 *
 * This is a SECOND implementation of the solver's loop, which is the point — the
 * repository already holds a naive solver against the indexed one for exactly this
 * reason. It is checked against `solve()` below before any result rests on it.
 *
 * It reports three outcomes, never two: settled, hit the cap (which is an
 * oscillation or a cycle, NOT a big pass count), or threw. `T-EXHAUSTED-NOT-CLOSED`
 * came from conflating the middle one with the first.
 */
function staged(net, inputs, init = {}, cap = 40) {
  const value = { ...net.rails };
  for (const [k, v] of Object.entries(inputs)) value[k] = v;
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  for (const nm of nodes) if (!driven.has(nm)) value[nm] = 'Z';
  for (const [nm, v] of Object.entries(init)) if (!driven.has(nm)) value[nm] = v;

  const adj = new Map();
  net.devices.forEach((d, i) => {
    for (const [from, to] of [[d.a, d.b], [d.b, d.a]]) {
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from).push({ i, other: to });
    }
  });
  const conducts = d => {
    const g = value[d.gate];
    if (g === 'Z' || g === 'X' || g === undefined) return 'unknown';
    return d.kind === 'n' ? (g >= d.vt) : (g <= d.vt);
  };
  const reach = (rail, accept) => {
    const seen = new Set([rail]); const stack = [rail];
    while (stack.length) {
      const at = stack.pop();
      for (const e of (adj.get(at) || [])) {
        if (!accept(e.i)) continue;
        if (seen.has(e.other)) continue;
        seen.add(e.other);
        if (!driven.has(e.other)) stack.push(e.other);
      }
    }
    return seen;
  };
  const trace = [];
  for (let iter = 0; iter < cap; iter++) {
    const cond = net.devices.map(conducts);
    const definite = {}, possible = {};
    for (const rail of Object.keys(net.rails)) {
      definite[rail] = reach(rail, i => cond[i] === true);
      possible[rail] = reach(rail, i => cond[i] !== false);
    }
    let changed = false;
    for (const nm of nodes) {
      if (driven.has(nm)) continue;
      const def = Object.keys(net.rails).filter(r => definite[r].has(nm));
      const pos = Object.keys(net.rails).filter(r => possible[r].has(nm));
      const next = pos.length === 0 ? 'Z'
        : (def.length === 1 && pos.length === 1) ? net.rails[def[0]] : 'X';
      if (value[nm] !== next) { value[nm] = next; changed = true; }
    }
    trace.push({ ...value });
    if (!changed) return { outcome: 'settled', passes: iter + 1, value, trace };
  }
  return { outcome: 'hit-cap', passes: cap, value, trace };
}

/** One cell whose q sits on terminal `pos` of a single selector. */
function rig(family, pos) {
  const net = new D.Net();
  const terms = ['lo', 'mid', 'hi'];
  // Three cells so the non-selected terminals are also stored nodes, which is what
  // a real read path looks like — a rail there would hide the very contention B1a
  // is about.
  for (let i = 0; i < 3; i++) latch(net, `c${i}`, `w${i}`, `q${i}`, `we${i}`, `hold${i}`);
  const src = [0, 1, 2].map(i => `q${i}`);
  if (family === 'tmux') D.tmux(net, 'sel', src[0], src[1], src[2], 'out');
  else { D.isMid(net, 'sel', 'selMid'); D.dmux(net, 'sel', 'selMid', src[0], src[1], src[2], 'out'); }
  return { net, terminal: terms[pos] };
}

/** Seed every state node; optionally resolve the select cone too. */
function seed(net, inputs, held, resolveSelect) {
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  held.forEach((t, i) => { init[`q${i}`] = t; init[`q${i}b`] = -t; });
  if (resolveSelect && nodes.has('selMid')) {
    init.selMid = inputs.sel === D.MID ? D.LOW : D.HIGH;   // isMid's table: (-1, 0, -1)
    init['selMid$m'] = inputs.sel === D.MID ? D.MID : 'Z';
  }
  return init;
}

const HOLD_OFF = { we0: D.LOW, we1: D.LOW, we2: D.LOW, hold0: D.LOW, hold1: D.LOW, hold2: D.LOW,
  w0: D.LOW, w1: D.LOW, w2: D.LOW };

console.log('--- instrument check: the staged loop against solve() ---');
{
  let agree = 0, disagree = 0;
  for (const family of ['tmux', 'dmux']) {
    for (const sel of [D.LOW, D.MID, D.HIGH]) {
      const { net } = rig(family, 0);
      const inputs = { sel, ...HOLD_OFF };
      const init = seed(net, inputs, [1, 0, -1], true);
      const s = staged(net, inputs, init);
      let real = null;
      try { real = net.solve(inputs, 40, init); } catch (e) { real = 'threw'; }
      if (s.outcome === 'settled' && real !== 'threw'
        && Object.keys(real).every(k => real[k] === s.value[k])) agree++;
      else disagree++;
    }
  }
  console.log(`      staged agrees with solve() on ${agree} of ${agree + disagree} settled cases`);
  if (disagree) console.log(`      DISAGREEMENTS: ${disagree} — every result below is suspect`);
}

console.log('\n--- B1a  naive seeding: do the two families split? ---');
for (const family of ['tmux', 'dmux']) {
  const rows = [];
  for (const sel of [D.LOW, D.MID, D.HIGH]) {
    const pos = sel === D.LOW ? 0 : sel === D.MID ? 1 : 2;
    let ok = 0, wrong = 0, stuck = 0;
    for (const v of [-1, 0, 1]) {
      const held = [v, v, v].map((x, i) => (i === pos ? v : (v + 1 > 1 ? -1 : v + 1)));
      const { net } = rig(family, pos);
      const inputs = { sel, ...HOLD_OFF };
      const r = staged(net, inputs, seed(net, inputs, held, false));
      if (r.outcome !== 'settled') stuck++;
      else if (r.value.out === held[pos]) ok++;
      else wrong++;
    }
    rows.push(`sel=${String(sel).padStart(2)}: ${ok} read ${wrong} wrong ${stuck} never settled`);
  }
  console.log(`      ${family.padEnd(5)}  ${rows.join('   |   ')}`);
}

console.log('\n--- B1b  select-resolved seeding: does everything read? ---');
for (const family of ['tmux', 'dmux']) {
  let ok = 0, bad = 0, stuck = 0, first = '';
  for (const sel of [D.LOW, D.MID, D.HIGH]) {
    const pos = sel === D.LOW ? 0 : sel === D.MID ? 1 : 2;
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1]) {
      const held = [a, b, c];
      const { net } = rig(family, pos);
      const inputs = { sel, ...HOLD_OFF };
      const r = staged(net, inputs, seed(net, inputs, held, true));
      if (r.outcome !== 'settled') { stuck++; if (!first) first = `sel=${sel} held=${held} never settled`; }
      else if (r.value.out === held[pos]) ok++;
      else { bad++; if (!first) first = `sel=${sel} held=${held} out=${r.value.out} want ${held[pos]}`; }
    }
  }
  console.log(`      ${family.padEnd(5)}  ${ok} correct, ${bad} wrong, ${stuck} never settled` + (first ? `   first: ${first}` : ''));
}

console.log('\n--- B2  does reading disturb the stored value, at ANY pass? ---');
for (const family of ['tmux', 'dmux']) {
  let clean = 0, endOnly = 0, dirty = 0;
  for (const sel of [D.LOW, D.MID, D.HIGH]) {
    const pos = sel === D.LOW ? 0 : sel === D.MID ? 1 : 2;
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1]) {
      const held = [a, b, c];
      const { net } = rig(family, pos);
      const inputs = { sel, ...HOLD_OFF };
      const r = staged(net, inputs, seed(net, inputs, held, true));
      if (r.outcome !== 'settled') { dirty++; continue; }
      const everWrong = r.trace.some(v => held.some((t, i) => v[`q${i}`] !== t));
      const endWrong = held.some((t, i) => r.value[`q${i}`] !== t);
      // and a second consecutive read, from the state the first one left
      const again = staged(net, inputs, seed(net, inputs,
        [0, 1, 2].map(i => r.value[`q${i}`]), true));
      const secondWrong = again.outcome !== 'settled'
        || held.some((t, i) => again.value[`q${i}`] !== t);
      if (endWrong || secondWrong) dirty++;
      else if (everWrong) endOnly++;
      else clean++;
    }
  }
  console.log(`      ${family.padEnd(5)}  ${clean} never disturbed, ${endOnly} disturbed MID-SOLVE`
    + ` but recovered, ${dirty} left wrong`);
}

console.log('\n--- B3  what a 27-way one-trit read mux costs ---');
{
  // A 3-level tree of decoded selectors over 27 stored terminals.
  const net = new D.Net();
  const W = 27, t = 3;
  for (let i = 0; i < t; i++) D.isMid(net, `a${i}`, `a${i}m`);
  const detectors = net.cost().switches;
  let level = Array.from({ length: W }, (_, i) => `q${i}`);
  for (let i = 0; i < t; i++) {
    const next = [];
    for (let j = 0; j < level.length; j += 3) {
      const out = `n${i}_${j / 3}`;
      D.dmux(net, `a${i}`, `a${i}m`, level[j], level[j + 1], level[j + 2], out);
      next.push(out);
    }
    level = next;
  }
  const total = net.cost().switches;
  const mux = total - detectors;
  const internal = (W - 1) / 2;
  const formula = B.CONFIGS.find(c => c.W === 27).lines[1][1];
  console.log(`      mux ${mux} switches over ${internal} internal nodes, detectors ${detectors}`);
  console.log(`      budget.js read term for one trit: ${6 * B.U.dmux * (W - 1) / 2 / 6}`
    + `   detector term: ${B.U.detector * t}`);
  console.log(`      match: ${mux === B.U.dmux * (W - 1) / 2 ? 'yes' : 'NO'}`
    + `   (whole 27-word address path in budget.js: ${formula})`);
}

console.log('\n--- B4  can the read mux supply the write selects? ---');
{
  const W = 27;
  const internal = (W - 1) / 2;
  const t = 3;
  const shared = B.U.detector * t;
  const path = B.CONFIGS.find(c => c.W === 27).lines[1][1];
  console.log(`      a ${W}-way read mux has ${internal} internal nodes.`);
  console.log(`      a write path needs ${W} one-hot word selects, one per word.`);
  console.log(`      ${internal} < ${W}: ${internal < W ? 'the mux CANNOT supply them — D0 survives'
    : 'the mux could supply them'}`);
  console.log(`      shared between decoder and mux: ${t} MID detectors = ${shared} switches`);
  console.log(`      that is ${(100 * shared / path).toFixed(1)}% of the ${path}-switch address path,`);
  console.log(`      against the "roughly halves" the roadmap allowed for.`);
}

console.log('\n' + line);
