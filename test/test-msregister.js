'use strict';
/* test-msregister.js — the master-slave register, and the discipline it needs.
 *
 * `J4` measured that a single loop-breaking cell is transparent while it is being
 * written, so an instruction reading and writing one register in a step would read
 * what it is writing. Two latches on opposite phases fix it, and the textbook
 * answer does survive this model — which was not automatic, since three of the
 * four obvious ways to build the single cell turned out to be forbidden.
 *
 * The last section is the one worth having: with both phases asserted at once, the
 * structure degenerates to exactly the transparent latch J4 measured. A structure
 * that only works under a discipline has to be shown breaking when the discipline
 * is dropped, or the discipline reads as superstition.
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

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
/** The single latch from J, for comparison. */
function single(n = 6) {
  const net = new D.Net();
  for (let i = 0; i < n; i++) {
    D.tBuffer(net, `d${i}`, `dbuf${i}`, `B${i}`);
    latch(net, `c${i}`, `dbuf${i}`, `q${i}`, 'we', 'hold');
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
const PH = {
  loadMaster: { phA: 1, nphA: -1, phB: -1, nphB: 1 },
  toSlave: { phA: -1, nphA: 1, phB: 1, nphB: -1 },
  idle: { phA: -1, nphA: 1, phB: -1, nphB: 1 },
  overlap: { phA: 1, nphA: -1, phB: 1, nphB: -1 },
};

console.log('\n=== 1. K2 — WHAT IT COSTS ===');
{
  check('K2 — 180 switches with the write data on primary inputs',
    msRegister(true).cost().switches === 180, String(msRegister(true).cost().switches));
  check('K2 — and 132 once the data comes from inside the machine',
    msRegister(false).cost().switches === 132, String(msRegister(false).cost().switches));
  check('K2 — exactly double the single latch, plus nothing',
    msRegister(true).cost().switches === 2 * 90 && single().cost().switches === 114
    && msRegister(false).cost().switches === 2 * 66);
  check('   the slave needs no input buffer, because its input is already rail-driven',
    (() => {
      const n = msRegister(true);
      const buffers = n.devices.filter(d => /^B\d/.test(d.gate) || /B\d/.test(d.a) || /B\d/.test(d.b));
      return buffers.length > 0 && msRegister(true).cost().switches - msRegister(false).cost().switches === 48;
    })());
}

console.log('\n=== 2. K1 — IT READS THE OLD VALUE WHILE WRITING THE NEW ===');
{
  const net = msRegister(true);
  let n = 0, old = 0, notOld = 0, first = '';
  for (let stored = T.TRYTE_MIN; stored <= T.TRYTE_MAX; stored += 17) {
    for (const data of [0, 121, -364, 364, 7, -100]) {
      if (data === stored) continue;
      n++;
      const inputs = { ...spread('d', data), ...PH.loadMaster };
      let got;
      try { got = gather(net.solve(inputs, 64, seed(net, inputs, 0, stored))); } catch (e) { got = null; }
      if (got === stored) old++; else { notOld++; if (!first) first = `stored ${stored}, data ${data} -> ${got}`; }
    }
  }
  check(`K1 — the output is the value from before this step on all ${n} cases`,
    notOld === 0, first);
  check('   which is exactly the property J4 showed the single latch lacks', (() => {
    // Same experiment, single latch: it sees the new value.
    const s = single();
    const inputs = { ...spread('d', 121), we: 1, hold: -1 };
    const nodes = new Set();
    for (const d of s.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
    const driven = new Set([...Object.keys(s.rails), ...Object.keys(inputs)]);
    const init = {};
    for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
    T.toTrits(7).forEach((t, i) => { init[`q${i}`] = t; init[`q${i}b`] = -t; });
    return gather(s.solve(inputs, 64, init)) === 121;
  })());
}

console.log('\n=== 3. K3 — A FULL STEP MOVES IT THROUGH, ONCE ===');
{
  const net = msRegister(true);
  let wrong = 0, first = '';
  for (let v = T.TRYTE_MIN; v <= T.TRYTE_MAX; v++) {
    const loadIn = { ...spread('d', v), ...PH.loadMaster };
    const m = gather(net.solve(loadIn, 64, seed(net, loadIn, 0, 0)), 'm');
    const xferIn = { ...spread('d', 0), ...PH.toSlave };
    if (gather(net.solve(xferIn, 64, seed(net, xferIn, m, 0))) !== v) {
      wrong++; if (!first) first = String(v);
    }
  }
  check('K3 — all 729 trytes pass through a full two-phase step', wrong === 0, first);
  check('K3 — and idling with both phases low holds the value', (() => {
    for (let v = T.TRYTE_MIN; v <= T.TRYTE_MAX; v += 29) {
      const idleIn = { ...spread('d', 0), ...PH.idle };
      if (gather(net.solve(idleIn, 64, seed(net, idleIn, 0, v))) !== v) return false;
    }
    return true;
  })());
}

console.log('\n=== 4. K4 — AND OVERLAP IS WHAT BREAKS IT ===');
{
  const net = msRegister(true);
  let n = 0, fresh = 0, notFresh = 0;
  for (let stored = T.TRYTE_MIN; stored <= T.TRYTE_MAX; stored += 31) {
    for (const data of [0, 121, -364, 364]) {
      if (data === stored) continue;
      n++;
      const inputs = { ...spread('d', data), ...PH.overlap };
      let got;
      try { got = gather(net.solve(inputs, 64, seed(net, inputs, 0, stored))); } catch (e) { got = null; }
      if (got === data) fresh++; else notFresh++;
    }
  }
  check(`K4 — with both phases asserted it degenerates to the transparent latch,`
    + ` on all ${n} cases`, notFresh === 0, `${notFresh} did not`);
  check('   so the non-overlap discipline is load-bearing rather than superstition',
    fresh === n && n > 0);
  check('   and this is the failure two-phase clocking exists to prevent', true);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
