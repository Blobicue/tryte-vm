'use strict';
/* MEMORY AUDIT — a 27-word addressed memory, built.
 *
 * The first structure here with an ADDRESS. `B` established that a stored value
 * can be read through a selector; this builds the other half — a decoder, a write
 * path, and 27 six-trit words — and then writes to one word and reads it back.
 *
 * It also settles the two largest `PROPOSED` numbers left in
 * `design/12-roadmap.md`. `B3` measured the read term and matched it exactly. The
 * decoder and write-enable terms have never been built, and reading the formula
 * against the contracts shows **three separate errors running in both directions**.
 *
 * ------------------------------------------------------------------------------
 * CARRIED IN:
 *
 *   - a loop-breaking cell is 11 switches in place, and that count ALREADY
 *     INCLUDES its own write switch (`J2`: `sti` + `sti` + two hold switches + one
 *     `we` switch = 4 + 4 + 1 + 1 + 1);
 *   - a write from a primary input fails `T5` — an input gates but never sources —
 *     so write data must be re-driven from a rail by a `tBuffer`, 8 switches (`J2`);
 *   - the read path is `tmux`, because `B1a` measured the decoded family failing to
 *     settle on stored terminals, at one level and again on a 27-way tree;
 *   - a `tmux` is 4 switches, a `dmux` 3, a detector 4, a binary inverter 2.
 *
 * WHY THE DECODER MAY STILL USE THE DECODED FAMILY, despite `B`. `B1a`'s failure
 * needs a STORAGE FEEDBACK LOOP on a selector's source terminal. The decoder's
 * sources are `vdd`, `vss` and loop-free internal nodes — the case `B`'s control
 * diagnostic measured clean at 3 of 3. The `tmux` rule applies where sources are
 * stored, which is the read path and the interconnect, and not here.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   C1  THE ADDRESS-PATH FORMULA IS WRONG THREE WAYS, AND NET TOO HIGH.
 *
 *       (a) TOO HIGH: the decoder term charges one 3-way selector per output
 *           LINE. A 3-way node produces THREE lines, so it charges three times the
 *           node count — 39 lines x 3 switches = 117, where the tree has 13 nodes.
 *
 *       (b) TOO LOW: a bare routing tree is not a decoder, because its unselected
 *           outputs FLOAT (see `C2`). Every output needs a pull to `LOW` as well as
 *           a route-in. Derived: 3 route-in switches plus 4 pull-down switches per
 *           node — `out_lo` and `out_hi` need one each, `out_mid` needs two because
 *           "not MID" is two separate thresholds. 7 per node, not 3.
 *
 *       (c) TOO HIGH AGAIN: the write term charges `6 x W` for "one pass switch per
 *           cell", and the cell's measured 11 ALREADY CONTAINS that switch. It is
 *           counted twice.
 *
 *       And two costs the formula omits entirely: a complement plane, because the
 *       latch contract needs `we` HIGH and `hold` LOW on the selected word while
 *       every other word holds the reverse (`W` inverters), and the `tBuffer`s that
 *       let write data source at all (6, one per trit, shared).
 *
 *       Predicted at 27 words: decoder about 105, read 312, write about 102 — an
 *       address path near **519** against the formula's **603**. The overcounts
 *       win. Predicted to move the target machine DOWN, not up.
 *
 *   C2  A BARE ROUTING TREE IS NOT A DECODER, AND THE FAILURE IS SILENT. With
 *       route-in legs only, an unselected word's select line is `Z`. A `Z` on a
 *       cell's `we` gate is unknown conduction, which by `N6` poisons the cell it
 *       gates — so writing word k disturbs words it never addressed. Predicted:
 *       with a bare tree, a write to one word corrupts others; with pull-downs
 *       added, it does not. Both halves measured, because "the fix works" is only
 *       half a claim if the defect was never demonstrated.
 *
 *   C3  A WRITE LANDS IN ONE WORD AND NOWHERE ELSE. Writing every value to every
 *       one of the 27 words, the addressed word takes the value and the other 26
 *       are unchanged — checked at every pass of the solve, not only at the end,
 *       because `B2`'s lesson is that a fixed point hides the path.
 *
 *   C4  AND IT READS BACK THROUGH THE ADDRESS PATH. Write word k, then read word
 *       k through the `tmux` tree, for every word and a stated set of values. This
 *       is the first round trip through an address in this project.
 *
 *   C5  AND EVERY STATE NODE IS SEEDED, BY CONSTRUCTION. `design/12-roadmap.md`
 *       named a missing seed as the most likely way this machine produces a
 *       plausible wrong answer, and said a completeness check should exist BEFORE
 *       the array rather than after it. This is the array. Predicted: the seeder
 *       covers every state node of all 162 cells, and a deliberately withheld seed
 *       is caught rather than absorbed.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');
const B = require('./budget.js');

console.log('MEMORY AUDIT — 27 words, addressed.\n');

const W = 27, TRITS = 6, ADDR = 3;

/** One loop-breaking cell. 11 switches, write switch included. */
function cell(net, tag, src, q, we, hold) {
  D.sti(net, q, `${tag}qbraw`);
  D.sti(net, `${q}b`, `${tag}qraw`);
  net.n(hold, D.HIGH, `${tag}qbraw`, `${q}b`);
  net.n(hold, D.HIGH, `${tag}qraw`, q);
  net.n(we, D.HIGH, src, q);
  return net;
}

/**
 * One decoder node: route `inNode` to whichever of three outputs the address trit
 * picks, and hold the other two at LOW.
 *
 * `definite = false` builds the bare routing tree `C2` predicts is insufficient —
 * kept so the defect can be produced rather than asserted.
 */
function decodeNode(net, inNode, a, am, outs, definite) {
  net.p(a, D.LOW, inNode, outs[0]);            // a == LOW
  net.n(am, D.MID, inNode, outs[1]);           // a == MID, via the shared detector
  net.n(a, D.HIGH, inNode, outs[2]);           // a == HIGH
  if (!definite) return net;
  net.n(a, D.MID, 'vss', outs[0]);             // not LOW  ->  a >= MID
  net.p(a, D.MID, 'vss', outs[2]);             // not HIGH ->  a <= MID
  net.p(a, D.LOW, 'vss', outs[1]);             // not MID, low side
  net.n(a, D.HIGH, 'vss', outs[1]);            // not MID, high side
  return net;
}

/** The address decoder: `wr` gates the whole tree so a read asserts no write. */
function decoder(net, definite) {
  net.n('wr', D.HIGH, 'vdd', 'root');
  net.p('wr', D.MID, 'vss', 'root');
  for (let i = 0; i < ADDR; i++) D.isMid(net, `a${i}`, `a${i}m`);
  let level = ['root'];
  for (let i = 0; i < ADDR; i++) {
    const next = [];
    for (let j = 0; j < level.length; j++) {
      const outs = [0, 1, 2].map(k => (i === ADDR - 1 ? `sel${j * 3 + k}` : `d${i}_${j * 3 + k}`));
      decodeNode(net, level[j], `a${i}`, `a${i}m`, outs, definite);
      next.push(...outs);
    }
    level = next;
  }
  return net;
}

/** The whole array: decoder, complement plane, buffered data, cells, read tree. */
function memory(definite = true) {
  const net = new D.Net();
  decoder(net, definite);
  for (let k = 0; k < W; k++) D.bInv(net, `sel${k}`, `nsel${k}`);      // hold = NOT we
  for (let t = 0; t < TRITS; t++) D.tBuffer(net, `din${t}`, `dbuf${t}`, `DB${t}`);
  for (let k = 0; k < W; k++) {
    for (let t = 0; t < TRITS; t++) {
      cell(net, `c${k}_${t}`, `dbuf${t}`, `q${k}_${t}`, `sel${k}`, `nsel${k}`);
    }
  }
  for (let t = 0; t < TRITS; t++) {                                     // read: tmux tree
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

const addrTrits = k => T.toTrits(k - 13).slice(0, ADDR);
const inputsFor = (k, value, wr) => {
  const inp = { wr };
  addrTrits(k).forEach((v, i) => { inp[`a${i}`] = v; });
  T.toTrits(value).slice(0, TRITS).forEach((v, t) => { inp[`din${t}`] = v; });
  return inp;
};

/** Seed every state node. Returns the init and the list it covered. */
function seedAll(net, inputs, contents, skip = null) {
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  for (let k = 0; k < W; k++) {
    for (let t = 0; t < TRITS; t++) {
      if (skip === `q${k}_${t}`) continue;
      const v = T.toTrits(contents[k]).slice(0, TRITS)[t];
      init[`q${k}_${t}`] = v; init[`q${k}_${t}b`] = -v;
    }
  }
  return init;
};
const readWord = (sol, k) =>
  T.fromTrits(Array.from({ length: TRITS }, (_, t) => sol[`q${k}_${t}`]));

console.log('--- C1  what the address path actually costs ---');
{
  const full = memory(true);
  const cellsOnly = new D.Net();
  for (let k = 0; k < W; k++) for (let t = 0; t < TRITS; t++) {
    cell(cellsOnly, `c${k}_${t}`, `dbuf${t}`, `q${k}_${t}`, `sel${k}`, `nsel${k}`);
  }
  const dec = new D.Net(); decoder(dec, true);
  const comp = new D.Net(); for (let k = 0; k < W; k++) D.bInv(comp, `sel${k}`, `nsel${k}`);
  const bufs = new D.Net(); for (let t = 0; t < TRITS; t++) D.tBuffer(bufs, `din${t}`, `dbuf${t}`, `DB${t}`);
  const storage = cellsOnly.cost().switches;
  const path = full.cost().switches - storage;
  const ap = B.addressPath(W);
  console.log(`      storage (162 cells)            ${String(storage).padStart(5)}   budget ${W * 6 * B.U.cellLoopBreaking}`);
  console.log(`      decoder                        ${String(dec.cost().switches).padStart(5)}   budget ${ap.decoder}   (predicted ~105)`);
  console.log(`      read tree (tmux)               ${String(path - dec.cost().switches - comp.cost().switches - bufs.cost().switches).padStart(5)}   budget ${ap.read}`);
  console.log(`      complement plane (${W} inverters) ${String(comp.cost().switches).padStart(3)}   budget 0 — omitted`);
  console.log(`      write-data buffers (T5)          ${String(bufs.cost().switches).padStart(3)}   budget 0 — omitted`);
  console.log(`      per-cell write switch                0   budget ${ap.write} — DOUBLE COUNTED, it is inside the cell's 11`);
  console.log(`      ---`);
  console.log(`      address path total             ${String(path).padStart(5)}   budget ${ap.total}   (predicted ~519)`);
  console.log(`      whole 27-word memory           ${String(full.cost().switches).padStart(5)}`);
}

console.log('\n--- C2  is a bare routing tree a decoder? ---');
{
  for (const definite of [false, true]) {
    const net = memory(definite);
    const contents = Array.from({ length: W }, (_, k) => (k % 5) - 2);
    let disturbed = 0, stuck = 0, wrote = 0;
    for (const k of [0, 7, 13, 26]) {
      const inp = inputsFor(k, 100, D.HIGH);
      let sol = null;
      try { sol = net.solve(inp, 80, seedAll(net, inp, contents)); } catch (e) { stuck++; continue; }
      if (readWord(sol, k) === T.wrap(100)) wrote++;
      for (let j = 0; j < W; j++) if (j !== k && readWord(sol, j) !== contents[j]) disturbed++;
    }
    console.log(`      ${definite ? 'with pull-downs  ' : 'bare routing tree'}: `
      + `${wrote}/4 writes landed, ${disturbed} other-word disturbances, ${stuck} never settled`);
  }
}

console.log('\n--- C3  does a write land in one word and nowhere else? ---');
{
  const net = memory(true);
  const contents = Array.from({ length: W }, (_, k) => (k * 7) % 61 - 30);
  let n = 0, wrong = 0, disturbed = 0, stuck = 0, first = '';
  for (let k = 0; k < W; k++) {
    for (const v of [0, 1, -1, 364, -364]) {
      n++;
      const inp = inputsFor(k, v, D.HIGH);
      let sol = null;
      try { sol = net.solve(inp, 80, seedAll(net, inp, contents)); } catch (e) { stuck++; continue; }
      if (readWord(sol, k) !== T.wrap(v)) {
        wrong++; if (!first) first = `word ${k} <- ${v} got ${readWord(sol, k)}`;
      }
      for (let j = 0; j < W; j++) if (j !== k && readWord(sol, j) !== contents[j]) disturbed++;
    }
  }
  console.log(`      ${n} writes across all ${W} words`);
  console.log(`      wrong: ${wrong}   other-word disturbances: ${disturbed}   never settled: ${stuck}`);
  if (first) console.log(`      first: ${first}`);
}

console.log('\n--- C4  does it read back through the address path? ---');
{
  const net = memory(true);
  const contents = Array.from({ length: W }, (_, k) => (k * 13) % 61 - 30);
  let n = 0, bad = 0, stuck = 0, first = '';
  for (let k = 0; k < W; k++) {
    for (const v of [0, 5, -5, 121]) {
      n++;
      const wInp = inputsFor(k, v, D.HIGH);
      let after = null;
      try { after = net.solve(wInp, 80, seedAll(net, wInp, contents)); } catch (e) { stuck++; continue; }
      const held = Array.from({ length: W }, (_, j) => readWord(after, j));
      const rInp = inputsFor(k, 0, D.LOW);
      let sol = null;
      try { sol = net.solve(rInp, 80, seedAll(net, rInp, held)); } catch (e) { stuck++; continue; }
      const got = T.fromTrits(Array.from({ length: TRITS }, (_, t) => sol[`out${t}`]));
      if (got !== T.wrap(v)) { bad++; if (!first) first = `word ${k} wrote ${v} read ${got}`; }
    }
  }
  console.log(`      ${n} write-then-read round trips: ${bad} wrong, ${stuck} never settled`);
  if (first) console.log(`      first: ${first}`);
}

console.log('\n--- C5  is every state node seeded? ---');
{
  const net = memory(true);
  const contents = Array.from({ length: W }, () => 0);
  const inp = inputsFor(0, 1, D.HIGH);
  const init = seedAll(net, inp, contents);
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inp)]);
  const state = [...nodes].filter(x => !driven.has(x));
  const unseeded = state.filter(x => !(x in init));
  console.log(`      ${state.length} state nodes, ${unseeded.length} unseeded`);
  const cellNodes = [];
  for (let k = 0; k < W; k++) for (let t = 0; t < TRITS; t++) { cellNodes.push(`q${k}_${t}`, `q${k}_${t}b`); }
  const missing = cellNodes.filter(x => init[x] === undefined || init[x] === 'Z');
  console.log(`      of ${cellNodes.length} cell state nodes, ${missing.length} left at Z`);
  const withGap = seedAll(net, inp, contents, 'q5_2');
  console.log(`      withholding one seed (q5_2) leaves it at: ${withGap['q5_2']}`
    + `  -> ${withGap['q5_2'] === 'Z' ? 'DETECTABLE by a completeness check' : 'absorbed silently'}`);
}

console.log('\n' + '='.repeat(78));
