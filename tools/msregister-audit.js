'use strict';
/* MASTER-SLAVE AUDIT — the register J4 said was required.
 *
 * `J4` failed: a read in the same solve as a write sees the NEW value, because the
 * write holds the feedback loop open and the cell is transparent while it is being
 * written. That is a latch, not a flip-flop, and it means an instruction reading
 * and writing the same register in one step would read what it is writing.
 *
 * The textbook answer is two latches in series on opposite phases, so that at no
 * moment is there a path from input to output. This builds it and checks whether
 * the textbook answer survives contact with this model's axioms — which is not
 * automatic, since three of the four obvious ways to build the single cell were
 * forbidden.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED. Carried in from the J set:
 *
 *   - one loop-breaking cell is 11 switches in place, 19 with an input buffer that
 *     `T5` makes mandatory at a primary input;
 *   - six of them hold all 729 trytes and leak on none;
 *   - and are transparent while written, which is why this file exists.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   K1  IT READS THE OLD VALUE WHILE WRITING THE NEW. The property `J4` showed the
 *       single latch does not have. With the master transparent and the slave
 *       holding, the output is the value stored before this step, on every one of
 *       the 729 trytes and against a range of incoming data.
 *
 *       This is the whole point of the structure, so if it fails the master-slave
 *       answer does not survive this model and `design/05` needs a third option
 *       nobody has named.
 *
 *   K2  AND COSTS 180 SWITCHES BUILT FOR TEST, 132 IN PLACE. Per trit: an 8-switch
 *       input buffer, an 11-switch master, an 11-switch slave. The slave needs no
 *       buffer because its input is the master's output, which is already
 *       rail-driven. Six trits: 6 x 30 = 180, or 6 x 22 = 132 once the write data
 *       comes from inside the machine.
 *
 *       Against the single register's 114 and 66. So `design/05`'s R4 estimate of
 *       ~228 is high, and the register file doubles rather than quadruples.
 *
 *   K3  AND A FULL STEP MOVES THE VALUE THROUGH, EXACTLY ONCE. Phase A then phase
 *       B stores the new tryte; the value then survives any number of further
 *       solves with both phases low. All 729.
 *
 *   K4  AND OVERLAP IS WHAT BREAKS IT. With both phases asserted at once the
 *       structure degenerates to the transparent latch `J4` measured — input
 *       straight through to output. Predicted: with both high, the output is the
 *       NEW value on every case, which is precisely the failure two-phase
 *       non-overlapping clocking exists to prevent.
 *
 *       Registering the failure mode as well as the success is the point. A
 *       structure that only works under a discipline should be shown breaking when
 *       the discipline is dropped, or the discipline reads as superstition.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

const line = '='.repeat(78);
console.log('MASTER-SLAVE AUDIT — the register J4 said was required.\n');

/** One loop-breaking latch. `src` must already be rail-driven (T5). */
function latch(net, tag, src, q, we, hold) {
  const qb = `${q}b`;
  D.sti(net, q, `${tag}qbraw`);
  D.sti(net, qb, `${tag}qraw`);
  net.n(hold, D.HIGH, `${tag}qbraw`, qb);
  net.n(hold, D.HIGH, `${tag}qraw`, q);
  net.n(we, D.HIGH, src, q);
  return net;
}
/** Master-slave, six trits. phA loads the master, phB transfers to the slave. */
function msRegister(buffered = true, n = 6) {
  const net = new D.Net();
  for (let i = 0; i < n; i++) {
    const src = buffered ? `dbuf${i}` : `d${i}`;
    if (buffered) D.tBuffer(net, `d${i}`, src, `B${i}`);
    latch(net, `m${i}`, src, `m${i}`, 'phA', 'nphA');
    latch(net, `s${i}`, `m${i}`, `q${i}`, 'phB', 'nphB');
  }
  return net;
}
const spread = (nm, v) => Object.fromEntries(T.toTrits(v).map((t, i) => [`${nm}${i}`, t]));
const gather = (sol, nm = 'q') => T.fromTrits(Array.from({ length: 6 }, (_, i) => sol[`${nm}${i}`]));

function seed(net, inputs, master, slave) {
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  T.toTrits(master).forEach((t, i) => { init[`m${i}`] = t; init[`m${i}b`] = -t; });
  T.toTrits(slave).forEach((t, i) => { init[`q${i}`] = t; init[`q${i}b`] = -t; });
  return init;
}
// Phase encodings. nphA is the complement, supplied rather than generated.
const PH = {
  loadMaster: { phA: 1, nphA: -1, phB: -1, nphB: 1 },
  toSlave: { phA: -1, nphA: 1, phB: 1, nphB: -1 },
  idle: { phA: -1, nphA: 1, phB: -1, nphB: 1 },
  overlap: { phA: 1, nphA: -1, phB: 1, nphB: -1 },
};

console.log('--- K2  what it costs ---');
{
  const b = msRegister(true), p = msRegister(false);
  console.log(`      six trits, data on primary inputs: ${b.cost().switches} switches   (predicted 180)`);
  console.log(`      six trits, data from inside:       ${p.cost().switches} switches   (predicted 132)`);
  console.log(`      against the single latch's 114 and 66 — exactly double, plus nothing`);
  console.log(`      design/05 estimated R4 at ~228.`);
}

console.log('\n--- K1  does it read the old value while writing the new? ---');
{
  const net = msRegister(true);
  let n = 0, old = 0, fresh = 0, other = 0, first = '';
  for (let stored = T.TRYTE_MIN; stored <= T.TRYTE_MAX; stored += 7) {
    for (const data of [0, 121, -364, 364, 7, -100]) {
      if (data === stored) continue;
      n++;
      const inputs = { ...spread('d', data), ...PH.loadMaster };
      let got;
      try { got = gather(net.solve(inputs, 64, seed(net, inputs, 0, stored))); } catch (e) { got = null; }
      if (got === stored) old++;
      else if (got === data) { fresh++; if (!first) first = `stored ${stored}, data ${data}`; }
      else { other++; if (!first) first = `stored ${stored}, data ${data} -> ${got}`; }
    }
  }
  console.log(`      ${n.toLocaleString()} cases: old ${old}, new ${fresh}, neither ${other}`);
  if (first) console.log(`      first non-old: ${first}`);
  console.log(`      ${old === n ? 'K1 holds — the output is the value from before this step.'
    : 'K1 FAILS — master-slave does not give read-before-write in this model.'}`);
}

console.log('\n--- K3  does a full step move the value through, once? ---');
{
  const net = msRegister(true);
  let wrong = 0, first = '';
  for (let v = T.TRYTE_MIN; v <= T.TRYTE_MAX; v++) {
    const loadIn = { ...spread('d', v), ...PH.loadMaster };
    const afterA = net.solve(loadIn, 64, seed(net, loadIn, 0, 0));
    const m = gather(afterA, 'm');
    const xferIn = { ...spread('d', 0), ...PH.toSlave };
    const afterB = net.solve(xferIn, 64, seed(net, xferIn, m, 0));
    if (gather(afterB) !== v) { wrong++; if (!first) first = `${v} -> ${gather(afterB)}`; }
  }
  console.log(`      729 trytes through a full two-phase step: ${wrong} wrong`);
  if (first) console.log(`      first: ${first}`);

  let held = 0;
  for (let v = T.TRYTE_MIN; v <= T.TRYTE_MAX; v += 13) {
    const idleIn = { ...spread('d', 0), ...PH.idle };
    const s = net.solve(idleIn, 64, seed(net, idleIn, 0, v));
    if (gather(s) !== v) held++;
  }
  console.log(`      and idling with both phases low moves it: ${held} of 57 sampled`);
}

console.log('\n--- K4  and overlap is what breaks it ---');
{
  const net = msRegister(true);
  let n = 0, old = 0, fresh = 0, other = 0;
  for (let stored = T.TRYTE_MIN; stored <= T.TRYTE_MAX; stored += 23) {
    for (const data of [0, 121, -364, 364]) {
      if (data === stored) continue;
      n++;
      const inputs = { ...spread('d', data), ...PH.overlap };
      let got;
      try { got = gather(net.solve(inputs, 64, seed(net, inputs, 0, stored))); } catch (e) { got = null; }
      if (got === stored) old++; else if (got === data) fresh++; else other++;
    }
  }
  console.log(`      both phases asserted, ${n} cases: old ${old}, new ${fresh}, neither ${other}`);
  console.log(`      ${fresh === n ? 'K4 holds — it degenerates to the transparent latch J4 measured,'
    : 'K4 FAILS — overlap does something other than predicted,'}`);
  console.log(`      which is what two-phase NON-OVERLAPPING clocking exists to prevent.`);
}

console.log('\n' + line);
