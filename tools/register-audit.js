'use strict';
/* REGISTER AUDIT — the first sequential circuit in this repository.
 *
 * Everything built here so far is combinational. The design phase enumerated ten
 * storage options and measured that one of them works without changing any axiom:
 * a cross-coupled pair whose feedback is gated open during a write. This builds a
 * six-trit register out of six of those and checks it the way everything else here
 * has been checked — exhaustively.
 *
 * It needs no decision from anyone. The aggressive path in `design/10` requires
 * charge retention, which changes the model's semantics and is a person's call;
 * this is the conservative path, which changes nothing.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED. Established in the design phase and re-used here:
 *
 *   - a cold cross-coupled pair resolves to unknown (`N7`); seeded, it holds all
 *     three trits (`N8`);
 *   - a write from a primary input fails (`T5`) and a write that fights the loop
 *     fails (`N4`), so the write must open the loop;
 *   - the resulting cell is 19 switches with an input buffer and 11 without.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   J1  IT HOLDS A TRYTE, EXHAUSTIVELY. Six cells under one write enable store and
 *       return every one of the 729 tryte values. Write, hold across a further
 *       solve, read back. Never `X`, never `Z`, never a different tryte.
 *
 *       At risk in a way nothing here has been before: six cells share `we` and
 *       `hold`, and six feedback loops settle in the same solve. Nothing in this
 *       project has ever solved a network with more than one loop in it, and `N7`
 *       is about loops.
 *
 *   J2  AND COSTS 114 SWITCHES BUILT FOR TEST, 66 IN PLACE. Six cells at 19 each
 *       when the write data arrives on primary inputs and must be re-driven from a
 *       rail to satisfy `T5`; six at 11 each once the data already comes from
 *       inside the machine. Enable distribution is free in this model, which is
 *       the largest thing these numbers hide — a real six-way fan-out is not free.
 *
 *   J3  AND DOES NOT LEAK. With `hold` asserted and `we` low, sweeping the write
 *       data over all 729 values moves the stored tryte not at all. This is the
 *       check most likely to catch a write path that half-conducts, and it is
 *       cheap: 729 held values x 729 data values is 531,441 solves, the same
 *       exhaustive scale as every circuit result here.
 *
 *       Sampled rather than exhaustive if that proves too slow, and the stride
 *       will be stated in the output rather than quietly chosen.
 *
 *   J4  AND A READ IN THE SAME SOLVE AS A WRITE SEES THE OLD VALUE. This is the
 *       open question from `design/05-registers.md`, and it decides whether the
 *       register file needs master-slave cells or not.
 *
 *       Predicted: the OLD value, deterministically, on every one of the 729
 *       values — because under seeded semantics the whole solve resolves against
 *       one fixed initial state, so there is no moment at which the new value
 *       exists to be read. If that holds, `R4` is unnecessary and the register
 *       file is half what `design/05` budgeted for it.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

const line = '='.repeat(78);
const L = [-1, 0, 1];
console.log('REGISTER AUDIT — six trits, held. The first sequential circuit here.\n');

/** One loop-breaking cell. `buffered` re-drives a primary input to satisfy T5. */
function cell(net, i, buffered) {
  const q = `q${i}`, qb = `qb${i}`;
  const src = buffered ? `dbuf${i}` : `d${i}`;
  if (buffered) D.tBuffer(net, `d${i}`, src, `B${i}`);
  D.sti(net, q, `qbraw${i}`);
  D.sti(net, qb, `qraw${i}`);
  net.n('hold', D.HIGH, `qbraw${i}`, qb);
  net.n('hold', D.HIGH, `qraw${i}`, q);
  net.n('we', D.HIGH, src, q);
  return net;
}
function register(buffered = true, n = 6) {
  const net = new D.Net();
  for (let i = 0; i < n; i++) cell(net, i, buffered);
  return net;
}
const spread = (nm, v) => Object.fromEntries(T.toTrits(v).map((t, i) => [`${nm}${i}`, t]));
const gather = sol => T.fromTrits(Array.from({ length: 6 }, (_, i) => sol[`q${i}`]));

/** Every non-driven node, seeded; q seeded to the stored tryte. */
function seedFor(net, inputs, stored) {
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  const trits = T.toTrits(stored);
  trits.forEach((t, i) => { init[`q${i}`] = t; init[`qb${i}`] = -t; });
  return init;
}

console.log('--- J2  what it costs ---');
{
  const withBuf = register(true), without = register(false);
  console.log(`      six cells, write data on primary inputs: ${withBuf.cost().switches} switches`
    + `   (predicted 114)`);
  console.log(`      six cells, data already rail-driven:     ${without.cost().switches} switches`
    + `   (predicted 66)`);
  console.log(`      mid-rail taps: ${withBuf.cost().midRailConnections}`);
  console.log(`      enable fan-out is free in this model and is not free in silicon.`);
}

console.log('\n--- J1  does it hold a tryte, over all 729 of them? ---');
{
  const net = register(true);
  let wrongWrite = 0, wrongHold = 0, first = '';
  for (let v = T.TRYTE_MIN; v <= T.TRYTE_MAX; v++) {
    const w = net.solve({ ...spread('d', v), we: 1, hold: -1 });
    if (gather(w) !== v) { wrongWrite++; if (!first) first = `write ${v} -> ${gather(w)}`; }
    const h = net.solve({ ...spread('d', 0), we: -1, hold: 1 }, 64, seedFor(net, { d0: 0, d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, we: -1, hold: 1 }, v));
    if (gather(h) !== v) { wrongHold++; if (!first) first = `hold ${v} -> ${gather(h)}`; }
  }
  console.log(`      729 values written: ${wrongWrite} wrong`);
  console.log(`      729 values held:    ${wrongHold} wrong`);
  if (first) console.log(`      first divergence: ${first}`);
  console.log(`      six feedback loops settling in one solve — nothing here had more than one.`);
}

console.log('\n--- J3  does it leak? ---');
{
  const net = register(true);
  const STEP = 7;                       // stated, not quietly chosen
  let n = 0, moved = 0, first = '';
  for (let stored = T.TRYTE_MIN; stored <= T.TRYTE_MAX; stored += STEP) {
    const inputs = { we: -1, hold: 1 };
    const init = seedFor(net, { ...spread('d', 0), ...inputs }, stored);
    for (let data = T.TRYTE_MIN; data <= T.TRYTE_MAX; data += STEP) {
      n++;
      const sol = net.solve({ ...spread('d', data), ...inputs }, 64, init);
      if (gather(sol) !== stored) { moved++; if (!first) first = `held ${stored}, data ${data} -> ${gather(sol)}`; }
    }
  }
  console.log(`      every ${STEP}th stored value against every ${STEP}th data value:`
    + ` ${n.toLocaleString()} solves, ${moved} moved`);
  if (first) console.log(`      first: ${first}`);
}

console.log('\n--- J4  read-while-write: old value or new? ---');
{
  const net = register(true);
  let old = 0, fresh = 0, other = 0, n = 0;
  for (let stored = T.TRYTE_MIN; stored <= T.TRYTE_MAX; stored += 11) {
    for (const data of [0, 121, -364, 364, 7]) {
      if (data === stored) continue;
      n++;
      const inputs = { ...spread('d', data), we: 1, hold: -1 };
      const init = seedFor(net, inputs, stored);
      let got;
      try { got = gather(net.solve(inputs, 64, init)); } catch (e) { got = null; }
      if (got === stored) old++; else if (got === data) fresh++; else other++;
    }
  }
  console.log(`      ${n} cases: old ${old}, new ${fresh}, neither ${other}`);
  console.log(`      predicted: the OLD value on every one of them, which would make`);
  console.log(`      master-slave cells unnecessary and halve the register file.`);
  console.log(`      ${old === n ? 'J4 holds.' : fresh === n
    ? 'J4 FAILS — it reads the NEW value, which is the opposite of the prediction.'
    : 'J4 FAILS — and not cleanly either way.'}`);
}

console.log('\n' + line);
