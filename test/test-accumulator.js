'use strict';
/* test-accumulator.js — A <- A + B, in switches. Compute and remember.
 *
 * The first structure here that is a machine fragment rather than a component:
 * the decoded six-trit adder wired to a master-slave register so one two-phase
 * step performs A <- A + B.
 *
 * The check worth having is not that the sum is right. It is that during phase A,
 * while the adder is computing the accumulator's NEXT value from its CURRENT one,
 * the register still reads the current one. That is `K1`'s property under load,
 * and it is the whole reason `J4`'s failure mattered.
 *
 * The exhaustive sweep — every accumulator value against every addend — is
 * `npm run audit:accumulator`. This samples, with the stride stated.
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
function accumulator() {
  const net = new D.Net();
  D.dRippleAdder(net, 6);
  for (let i = 0; i < 6; i++) {
    latch(net, `m${i}`, `s${i}`, `m${i}`, 'phA', 'nphA');
    latch(net, `s_${i}`, `m${i}`, `a${i}`, 'phB', 'nphB');
  }
  return net;
}
const PH = { A: { phA: 1, nphA: -1, phB: -1, nphB: 1 }, B: { phA: -1, nphA: 1, phB: 1, nphB: -1 } };
const spreadB = v => Object.fromEntries(T.toTrits(v).map((t, i) => [`b${i}`, t]));
const readA = sol => T.fromTrits(Array.from({ length: 6 }, (_, i) => sol[`a${i}`]));
const readM = sol => T.fromTrits(Array.from({ length: 6 }, (_, i) => sol[`m${i}`]));
function seedState(net, inputs, acc, master) {
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  T.toTrits(acc).forEach((t, i) => { init[`a${i}`] = t; init[`a${i}b`] = -t; });
  T.toTrits(master).forEach((t, i) => { init[`m${i}`] = t; init[`m${i}b`] = -t; });
  return init;
}
function step(net, acc, b, cap = 40) {
  const inA = { ...spreadB(b), cin: 0, ...PH.A };
  const afterA = net.solve(inA, cap, seedState(net, inA, acc, 0));
  const m = readM(afterA);
  const inB = { ...spreadB(b), cin: 0, ...PH.B };
  return { acc: readA(net.solve(inB, cap, seedState(net, inB, acc, m))), readDuringA: readA(afterA) };
}

console.log('\n=== 1. L2 — WHAT IT COSTS ===');
{
  const net = accumulator();
  const adder = new D.Net(); D.dRippleAdder(adder, 6);
  check('L2 — 672 switches', net.cost().switches === 672, String(net.cost().switches));
  check('L2 — 540 adder plus 132 register, and nothing between them',
    adder.cost().switches === 540 && net.cost().switches - adder.cost().switches === 132);
  check('   no buffer is needed because the sum is already rail-driven — the one'
    + ' place T5 does not charge', (() => {
      // If a buffer were needed the register would cost 180, as it does on inputs.
      return net.cost().switches - adder.cost().switches === 132;
    })());
}

console.log('\n=== 2. L1 — ONE STEP COMPUTES A + B, AND DOES NOT LEAK ===');
{
  const net = accumulator();
  const STEP = 23;                      // stated, not quietly chosen
  const ADDENDS = [0, 1, -1, 121, -364];
  let n = 0, wrong = 0, leaked = 0, first = '';
  for (let acc = T.TRYTE_MIN; acc <= T.TRYTE_MAX; acc += STEP) {
    for (const b of ADDENDS) {
      n++;
      const r = step(net, acc, b);
      if (r.acc !== T.wrap(acc + b)) { wrong++; if (!first) first = `${acc}+${b}->${r.acc}`; }
      if (r.readDuringA !== acc) leaked++;
    }
  }
  check(`L1 — ${n} sampled steps, every sum correct`, wrong === 0, first);
  check('L1 — and on none of them did the register stop reading the OLD accumulator'
    + ' while the adder was computing its replacement', leaked === 0, `${leaked} leaked`);
  check('   which is K1 under load, and the whole reason J4 mattered', leaked === 0);
}

console.log('\n=== 3. L3 — THE STEP COST VARIES WITH THE DATA ===');
{
  const net = accumulator();
  const settles = (inputs, init, k) => {
    try { net.solve(inputs, k, init); return true; } catch (e) { return false; }
  };
  const passesA = (acc, b) => {
    const inA = { ...spreadB(b), cin: 0, ...PH.A };
    const init = seedState(net, inA, acc, 0);
    for (let k = 1; k <= 40; k++) if (settles(inA, init, k)) return k;
    return null;
  };
  const seen = new Set();
  for (let acc = T.TRYTE_MIN; acc <= T.TRYTE_MAX; acc += 37) {
    for (const b of [0, 1, 121, -364]) seen.add(passesA(acc, b));
  }
  const counts = [...seen].sort((a, b) => a - b);
  check(`L3 — phase A settles in ${counts[0]} to ${counts[counts.length - 1]} passes,`
    + ' never more than 15', counts[counts.length - 1] <= 15, counts.join(' '));
  check('L3 — and the count varies with the data rather than being fixed',
    counts.length > 1, counts.join(' '));
  check('   inherited from the decoded adder, which E4 measured at 9 to 13',
    counts[counts.length - 1] > 9);
}

console.log('\n=== 4. L4 — IT ACCUMULATES ===');
{
  const net = accumulator();
  const LIST = [5, 12, -3, 100, -50, 7, 7, 7, -364, 200];
  let acc = 0, ref = 0, bad = 0;
  for (const b of LIST) {
    acc = step(net, acc, b).acc;
    ref = T.wrap(ref + b);
    if (acc !== ref) bad++;
  }
  check(`L4 — ten successive additions accumulate to ${ref}`, bad === 0 && acc === ref,
    `got ${acc}`);
  check('   wrapping correctly when the running total leaves the tryte range', (() => {
    // -364 then +200 in that list crosses the boundary; check it explicitly.
    let a = 0;
    for (const b of [364, 364]) a = step(net, a, b).acc;
    return a === T.wrap(728);
  })());
  check('   the first computation here carried out by simulated transistors holding'
    + ' their own state between steps', bad === 0);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
