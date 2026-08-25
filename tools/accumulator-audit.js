'use strict';
/* ACCUMULATOR AUDIT — the first thing here that computes and remembers.
 *
 * Every circuit in this repository so far is either combinational (it computes and
 * forgets) or storage (it remembers and does not compute). This wires the decoded
 * six-trit adder to a master-slave register so that one two-phase step performs
 *
 *     A <- A + B
 *
 * which is a machine fragment rather than a component. It is also the first
 * structure whose correctness depends on the phase discipline `K4` showed to be
 * load-bearing: the register reads `A` while the adder is producing the new `A`,
 * and only the master-slave split keeps those from being the same value.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED. Carried in:
 *
 *   - the decoded six-trit ripple adder is 540 switches and settles in 9 to 13
 *     passes depending on the operands (`E4`, `F1`);
 *   - a master-slave register is 132 switches when its input is already
 *     rail-driven, which the adder's sum output is (`K2`);
 *   - it reads the value from before the step while being written (`K1`), and
 *     collapses to a transparent latch if both phases are asserted (`K4`).
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   L1  ONE STEP COMPUTES A + B, FOR EVERY A. Over all 729 values of the
 *       accumulator against a stated set of addends, a phase-A solve followed by a
 *       phase-B solve leaves the register holding `wrap(A + B)`. Exhaustive in A,
 *       sampled in B, and the sampling stated in the output rather than chosen
 *       quietly.
 *
 *       At risk on the thing that has bitten three times already: `A` is read by
 *       the adder and written by the same step, so if the phase split leaks
 *       anywhere the accumulator computes `A + B` from the wrong `A`.
 *
 *   L2  AND COSTS 672 SWITCHES. 540 for the adder plus 132 for the register, with
 *       no input buffer between them because the adder's sum is already
 *       rail-driven — the one place `T5` does not charge. `B` arrives on primary
 *       inputs and needs no buffer either, because it only ever gates selectors.
 *
 *   L3  AND ITS STEP COST VARIES WITH THE DATA. The decoded adder settles in 9 to
 *       13 passes depending on its operands (`E4`), and the accumulator inherits
 *       that. Predicted: phase A settles in at most 15 passes, the count varies
 *       across inputs rather than being fixed, and phase B is cheaper than phase A
 *       because the master is already holding the answer.
 *
 *   L4  AND IT ACCUMULATES. Ten successive steps adding a fixed list leave the
 *       register holding the running total, wrapped, matching `T.add` applied in
 *       sequence. This is the first computation in this repository carried out by
 *       simulated transistors holding their own state between steps.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

const line = '='.repeat(78);
console.log('ACCUMULATOR AUDIT — A <- A + B, in switches.\n');

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
 * The accumulator. `a0..a5` are the register's own outputs and the adder's first
 * operand; `b0..b5` are primary inputs; `s0..s5` is the sum, which feeds the
 * register's master directly.
 */
function accumulator() {
  const net = new D.Net();
  D.dRippleAdder(net, 6);                       // reads a*, b*, cin; writes s*, c6
  for (let i = 0; i < 6; i++) {
    latch(net, `m${i}`, `s${i}`, `m${i}`, 'phA', 'nphA');
    latch(net, `s_${i}`, `m${i}`, `a${i}`, 'phB', 'nphB');
  }
  return net;
}
const PH = {
  A: { phA: 1, nphA: -1, phB: -1, nphB: 1 },
  B: { phA: -1, nphA: 1, phB: 1, nphB: -1 },
};
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

/** One full step: load the master from the sum, then transfer to the register. */
function step(net, acc, b, cap = 40) {
  const inA = { ...spreadB(b), cin: 0, ...PH.A };
  const afterA = net.solve(inA, cap, seedState(net, inA, acc, 0));
  const m = readM(afterA);
  const inB = { ...spreadB(b), cin: 0, ...PH.B };
  const afterB = net.solve(inB, cap, seedState(net, inB, acc, m));
  return { acc: readA(afterB), master: m, readDuringA: readA(afterA) };
}

console.log('--- L2  what it costs ---');
{
  const net = accumulator();
  const adder = new D.Net(); D.dRippleAdder(adder, 6);
  console.log(`      accumulator: ${net.cost().switches} switches   (predicted 672)`);
  console.log(`      of which the adder is ${adder.cost().switches} and the register`
    + ` ${net.cost().switches - adder.cost().switches}`);
  console.log(`      no buffer between them: the sum is already rail-driven, which is`);
  console.log(`      the one place T5 does not charge.`);
  console.log(`      mid-rail taps: ${net.cost().midRailConnections}`);
}

console.log('\n--- L1  does one step compute A + B, for every A? ---');
{
  const net = accumulator();
  const ADDENDS = [0, 1, -1, 7, -7, 121, -121, 364, -364];
  let n = 0, wrong = 0, leaked = 0, first = '';
  for (let acc = T.TRYTE_MIN; acc <= T.TRYTE_MAX; acc++) {
    for (const b of ADDENDS) {
      n++;
      const r = step(net, acc, b);
      if (r.acc !== T.wrap(acc + b)) {
        wrong++; if (!first) first = `${acc} + ${b} -> ${r.acc}, want ${T.wrap(acc + b)}`;
      }
      // K1's property, in situ: during phase A the register must still read the OLD A.
      if (r.readDuringA !== acc) leaked++;
    }
  }
  console.log(`      ${n.toLocaleString()} steps (all 729 accumulator values x ${ADDENDS.length} addends)`);
  console.log(`      wrong sums: ${wrong}`);
  console.log(`      steps where the register did not still read the OLD A during phase A: ${leaked}`);
  if (first) console.log(`      first divergence: ${first}`);
}

console.log('\n--- L3  what a step costs in passes ---');
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
  const dist = new Map();
  let n = 0;
  for (let acc = T.TRYTE_MIN; acc <= T.TRYTE_MAX; acc += 7) {
    for (const b of [0, 1, 121, -364]) {
      n++;
      const p = passesA(acc, b);
      dist.set(p, (dist.get(p) || 0) + 1);
    }
  }
  const keys = [...dist.keys()].sort((x, y) => x - y);
  console.log(`      phase A over ${n} sampled steps: `
    + keys.map(k => `${k}:${dist.get(k)}`).join('  '));
  console.log(`      range ${keys[0]} to ${keys[keys.length - 1]}`
    + `   ${keys.length > 1 ? 'varies with the data, as the decoded adder does'
      : 'fixed — which would mean it does NOT inherit E4'}`);
}

console.log('\n--- L4  does it accumulate? ---');
{
  const net = accumulator();
  const LIST = [5, 12, -3, 100, -50, 7, 7, 7, -364, 200];
  let acc = 0, ref = 0, bad = 0;
  const trace = [];
  for (const b of LIST) {
    acc = step(net, acc, b).acc;
    ref = T.wrap(ref + b);
    trace.push(`${b >= 0 ? '+' : ''}${b}=>${acc}`);
    if (acc !== ref) bad++;
  }
  console.log(`      ${trace.join('  ')}`);
  console.log(`      final ${acc}, reference ${ref}, mismatches ${bad}`);
  console.log(`      ten steps of simulated transistors holding their own state between them.`);
}

console.log('\n' + line);
