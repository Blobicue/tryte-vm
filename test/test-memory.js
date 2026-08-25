'use strict';
/* test-memory.js — 27 words, addressed: write one, disturb none, read it back.
 *
 * The first structure here with an ADDRESS, and the first round trip through one.
 * Set `C`. The exhaustive version is `npm run audit:memory`.
 *
 * The check this suite exists for is not "a write works". It is the pair of things
 * that make the array different from everything before it:
 *
 *   - a bare routing tree is NOT a decoder, and the failure is silent and total
 *     (`C2`) — so the pull-downs must be shown load-bearing, not assumed;
 *   - every `hold` gate in the array is a COMPUTED node, unknown on pass one, and
 *     that poisons all 26 unaddressed words unless the select cone is resolved
 *     first. That is `T-COMPUTED-CONTROL-UNKNOWN-AT-PASS-ONE`, and it is the
 *     roadmap's top-ranked risk actually biting.
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');
const B = require('../tools/budget.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const W = 27, TRITS = 6, ADDR = 3;

function cell(net, tag, src, q, we, hold) {
  D.sti(net, q, `${tag}qbraw`);
  D.sti(net, `${q}b`, `${tag}qraw`);
  net.n(hold, D.HIGH, `${tag}qbraw`, `${q}b`);
  net.n(hold, D.HIGH, `${tag}qraw`, q);
  net.n(we, D.HIGH, src, q);
  return net;
}
function decodeNode(net, inNode, a, am, outs, definite) {
  net.p(a, D.LOW, inNode, outs[0]);
  net.n(am, D.MID, inNode, outs[1]);
  net.n(a, D.HIGH, inNode, outs[2]);
  if (!definite) return net;
  net.n(a, D.MID, 'vss', outs[0]);
  net.p(a, D.MID, 'vss', outs[2]);
  net.p(a, D.LOW, 'vss', outs[1]);
  net.n(a, D.HIGH, 'vss', outs[1]);
  return net;
}
function decoder(net, definite) {
  net.n('wr', D.HIGH, 'vdd', 'root');
  net.p('wr', D.MID, 'vss', 'root');
  for (let i = 0; i < ADDR; i++) D.isMid(net, `a${i}`, `a${i}m`);
  // a0 is the LEAST significant trit, matching the read tree's leaf grouping.
  let level = [{ name: 'root', idx: 0 }];
  for (let i = 0; i < ADDR; i++) {
    const stride = 3 ** i;
    const next = [];
    for (const node of level) {
      const outs = [0, 1, 2].map(k => {
        const idx = node.idx + k * stride;
        return i === ADDR - 1 ? `sel${idx}` : `d${i}_${idx}`;
      });
      decodeNode(net, node.name, `a${i}`, `a${i}m`, outs, definite);
      outs.forEach((name, k) => next.push({ name, idx: node.idx + k * stride }));
    }
    level = next;
  }
  return net;
}
function memory(definite = true) {
  const net = new D.Net();
  decoder(net, definite);
  for (let k = 0; k < W; k++) D.bInv(net, `sel${k}`, `nsel${k}`);
  for (let t = 0; t < TRITS; t++) D.tBuffer(net, `din${t}`, `dbuf${t}`, `DB${t}`);
  for (let k = 0; k < W; k++) {
    for (let t = 0; t < TRITS; t++) cell(net, `c${k}_${t}`, `dbuf${t}`, `q${k}_${t}`, `sel${k}`, `nsel${k}`);
  }
  for (let t = 0; t < TRITS; t++) {
    let level = Array.from({ length: W }, (_, k) => `q${k}_${t}`);
    for (let i = 0; i < ADDR; i++) {
      const next = [];
      for (let j = 0; j < level.length; j += 3) {
        const o = (i === ADDR - 1) ? `out${t}` : `r${t}_${i}_${j / 3}`;
        D.tmux(net, `a${i}`, level[j], level[j + 1], level[j + 2], o);
        next.push(o);
      }
      level = next;
    }
  }
  return net;
}
const inputsFor = (k, value, wr) => {
  const inp = { wr };
  T.toTrits(k - 13).slice(0, ADDR).forEach((v, i) => { inp[`a${i}`] = v; });
  T.toTrits(value).slice(0, TRITS).forEach((v, t) => { inp[`din${t}`] = v; });
  return inp;
};
function selectCone(inputs, definite) {
  const dec = new D.Net();
  decoder(dec, definite);
  for (let k = 0; k < W; k++) D.bInv(dec, `sel${k}`, `nsel${k}`);
  const inp = {};
  for (const k of ['wr', 'a0', 'a1', 'a2']) inp[k] = inputs[k];
  const nodes = new Set();
  for (const d of dec.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(dec.rails), ...Object.keys(inp)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  try { return dec.solve(inp, 80, init); } catch (e) { return null; }
}
function seedAll(net, inputs, contents, opts = {}) {
  const { skip = null, definite = true, resolveCone = true } = opts;
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  if (resolveCone) {
    const cone = selectCone(inputs, definite);
    if (cone) for (const x of nodes) {
      if (!driven.has(x) && cone[x] !== undefined && !(x in net.rails)) init[x] = cone[x];
    }
  }
  for (let k = 0; k < W; k++) {
    for (let t = 0; t < TRITS; t++) {
      if (skip === `q${k}_${t}`) continue;
      const v = T.toTrits(contents[k]).slice(0, TRITS)[t];
      init[`q${k}_${t}`] = v; init[`q${k}_${t}b`] = -v;
    }
  }
  return init;
}
const readWord = (sol, k) => T.fromTrits(Array.from({ length: TRITS }, (_, t) => sol[`q${k}_${t}`]));
const CONTENTS = Array.from({ length: W }, (_, k) => (k * 7) % 61 - 30);

console.log('\n=== 1. C1 — WHAT THE ADDRESS PATH COSTS, BUILT ===');
{
  const full = memory(true);
  const dec = new D.Net(); decoder(dec, true);
  const cells = new D.Net();
  for (let k = 0; k < W; k++) for (let t = 0; t < TRITS; t++) {
    cell(cells, `c${k}_${t}`, `dbuf${t}`, `q${k}_${t}`, `sel${k}`, `nsel${k}`);
  }
  const path = full.cost().switches - cells.cost().switches;
  const ap = B.addressPath(W);
  check(`the decoder builds to ${dec.cost().switches} switches`, dec.cost().switches === 105,
    String(dec.cost().switches));
  check(`the address path builds to ${path}, and budget.js now says the same`,
    path === ap.total && path === 519, `${path} vs ${ap.total}`);
  check(`   storage is ${cells.cost().switches}, matching the budget's ${W * 6 * B.U.cellLoopBreaking}`,
    cells.cost().switches === W * 6 * B.U.cellLoopBreaking);
  check('   the per-cell write switch is inside the cell, not an extra term —'
    + ' the old formula counted it twice', (() => {
      const one = new D.Net(); cell(one, 'x', 'd', 'q', 'we', 'hold');
      return one.cost().switches === B.U.cellLoopBreaking;
    })());
}

console.log('\n=== 2. C2 — A BARE ROUTING TREE IS NOT A DECODER ===');
{
  const trial = definite => {
    const net = memory(definite);
    let landed = 0, disturbed = 0;
    for (const k of [0, 13, 26]) {
      const inp = inputsFor(k, 100, D.HIGH);
      let sol = null;
      try { sol = net.solve(inp, 80, seedAll(net, inp, CONTENTS, { definite })); } catch (e) { continue; }
      if (readWord(sol, k) === T.wrap(100)) landed++;
      for (let j = 0; j < W; j++) if (j !== k && readWord(sol, j) !== CONTENTS[j]) disturbed++;
    }
    return { landed, disturbed };
  };
  const bare = trial(false), full = trial(true);
  check(`with a bare tree, ${bare.landed} of 3 writes land and ${bare.disturbed} other`
    + ' words are corrupted', bare.landed === 0 && bare.disturbed > 0, JSON.stringify(bare));
  check(`with pull-downs, ${full.landed} of 3 land and ${full.disturbed} are corrupted`,
    full.landed === 3 && full.disturbed === 0, JSON.stringify(full));
  check('   so the 4 pull-down switches per node are load-bearing, demonstrated'
    + ' rather than assumed', bare.disturbed > 0 && full.disturbed === 0);
}

console.log('\n=== 3. T-COMPUTED-CONTROL — THE COLD-START FAILURE ===');
{
  // Every hold gate in the array is a decoder output. Left to resolve itself it is
  // Z on pass one, unknown conduction, and by N6 that poisons every cell at once.
  const net = memory(true);
  const withCone = (() => {
    const inp = inputsFor(4, 55, D.HIGH);
    const sol = net.solve(inp, 80, seedAll(net, inp, CONTENTS));
    let bad = 0;
    for (let j = 0; j < W; j++) if (j !== 4 && readWord(sol, j) !== CONTENTS[j]) bad++;
    return { bad, wrote: readWord(sol, 4) === T.wrap(55) };
  })();
  const without = (() => {
    const inp = inputsFor(4, 55, D.HIGH);
    try {
      const sol = net.solve(inp, 80, seedAll(net, inp, CONTENTS, { resolveCone: false }));
      let bad = 0;
      for (let j = 0; j < W; j++) if (j !== 4 && readWord(sol, j) !== CONTENTS[j]) bad++;
      return { bad };
    } catch (e) { return { bad: -1 }; }
  })();
  check(`with the select cone resolved: the write lands and ${withCone.bad} words are disturbed`,
    withCone.wrote && withCone.bad === 0, JSON.stringify(withCone));
  check(`without it: ${without.bad} of the 26 unaddressed words are corrupted`,
    without.bad === 26, JSON.stringify(without));
  check('   the cells hold perfectly when hold is an input and not at all when it'
    + ' is a decoder output — same circuit, different reachability', (() => {
      const iso = new D.Net();
      for (let k = 0; k < 3; k++) cell(iso, `c${k}`, 'dbuf', `q${k}`, `we${k}`, `hold${k}`);
      D.tBuffer(iso, 'din', 'dbuf', 'DB');
      const inp = { din: 1, we0: D.LOW, we1: D.LOW, we2: D.LOW,
        hold0: D.HIGH, hold1: D.HIGH, hold2: D.HIGH };
      const nodes = new Set();
      for (const d of iso.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
      const driven = new Set([...Object.keys(iso.rails), ...Object.keys(inp)]);
      const init = {};
      for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
      [-1, 0, 1].forEach((v, k) => { init[`q${k}`] = v; init[`q${k}b`] = -v; });
      const s = iso.solve(inp, 80, init);
      return [-1, 0, 1].every((v, k) => s[`q${k}`] === v);
    })());
}

console.log('\n=== 4. C3/C4 — ONE WORD CHANGES, AND IT READS BACK ===');
{
  const net = memory(true);
  let wrong = 0, disturbed = 0, stuck = 0;
  for (let k = 0; k < W; k += 2) {
    for (const v of [0, 1, -364]) {
      const inp = inputsFor(k, v, D.HIGH);
      let sol = null;
      try { sol = net.solve(inp, 80, seedAll(net, inp, CONTENTS)); } catch (e) { stuck++; continue; }
      if (readWord(sol, k) !== T.wrap(v)) wrong++;
      for (let j = 0; j < W; j++) if (j !== k && readWord(sol, j) !== CONTENTS[j]) disturbed++;
    }
  }
  check('C3 — every sampled write lands in its word and disturbs no other',
    wrong === 0 && disturbed === 0 && stuck === 0, `${wrong} wrong ${disturbed} disturbed ${stuck} stuck`);

  let bad = 0;
  for (let k = 0; k < W; k += 3) {
    for (const v of [5, -5, 121]) {
      const wInp = inputsFor(k, v, D.HIGH);
      const after = net.solve(wInp, 80, seedAll(net, wInp, CONTENTS));
      const held = Array.from({ length: W }, (_, j) => readWord(after, j));
      const rInp = inputsFor(k, 0, D.LOW);
      const sol = net.solve(rInp, 80, seedAll(net, rInp, held));
      const got = T.fromTrits(Array.from({ length: TRITS }, (_, t) => sol[`out${t}`]));
      if (got !== T.wrap(v)) bad++;
    }
  }
  check('C4 — write-then-read round trips through the address path', bad === 0, `${bad} wrong`);
  check('   the first round trip through an address in this project', bad === 0);
}

console.log('\n=== 5. C5 — EVERY STATE NODE IS SEEDED ===');
{
  const net = memory(true);
  const inp = inputsFor(0, 1, D.HIGH);
  const init = seedAll(net, inp, CONTENTS);
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inp)]);
  const state = [...nodes].filter(x => !driven.has(x));
  check(`all ${state.length} state nodes appear in the seed`,
    state.every(x => x in init), String(state.filter(x => !(x in init)).length));
  const cellNodes = [];
  for (let k = 0; k < W; k++) for (let t = 0; t < TRITS; t++) cellNodes.push(`q${k}_${t}`, `q${k}_${t}b`);
  check(`   and none of the ${cellNodes.length} cell state nodes is left at Z`,
    cellNodes.every(x => init[x] !== 'Z' && init[x] !== undefined));
  check('   a withheld seed stays at Z and is detectable, not absorbed',
    seedAll(net, inp, CONTENTS, { skip: 'q5_2' })['q5_2'] === 'Z');
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
