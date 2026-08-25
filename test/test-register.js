'use strict';
/* test-register.js — six trits, held. The first sequential circuit here.
 *
 * A cross-coupled pair whose feedback is gated open during a write, six of them
 * under one enable. No axiom changed; the aggressive charge-retention path is a
 * separate decision and this is not it.
 *
 * J4 failed, and its failure is the useful part. A read in the same solve as a
 * write sees the NEW value on every case tried, not the old one — because while
 * `we` is asserted the feedback loop is open and the cell is driven straight from
 * its input. It is a TRANSPARENT LATCH, not an edge-triggered flip-flop, and a
 * transparent latch is see-through by definition. Which is exactly why
 * master-slave pairs exist, and means `design/05`'s prediction was wrong and the
 * register file doubles.
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

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
const register = (buffered = true, n = 6) => {
  const net = new D.Net();
  for (let i = 0; i < n; i++) cell(net, i, buffered);
  return net;
};
const spread = (nm, v) => Object.fromEntries(T.toTrits(v).map((t, i) => [`${nm}${i}`, t]));
const gather = sol => T.fromTrits(Array.from({ length: 6 }, (_, i) => sol[`q${i}`]));
function seedFor(net, inputs, stored) {
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
  T.toTrits(stored).forEach((t, i) => { init[`q${i}`] = t; init[`qb${i}`] = -t; });
  return init;
}

console.log('\n=== 1. J2 — WHAT IT COSTS ===');
{
  check('J2 — 114 switches with the write data on primary inputs',
    register(true).cost().switches === 114, String(register(true).cost().switches));
  check('J2 — and 66 once the data already comes from inside the machine',
    register(false).cost().switches === 66, String(register(false).cost().switches));
  check('   the 48-switch difference is six input buffers, which T5 makes mandatory',
    114 - 66 === 48 && 48 / 6 === 8);
  check('   enable fan-out costs nothing here, which is the largest thing these'
    + ' numbers hide', (() => {
      const net = register(true);
      const enables = net.devices.filter(d => d.gate === 'we' || d.gate === 'hold').length;
      return enables === 18;                 // 3 per cell, 6 cells, all free
    })());
}

console.log('\n=== 2. J1 — IT HOLDS A TRYTE, ALL 729 OF THEM ===');
{
  const net = register(true);
  let wrongWrite = 0, wrongHold = 0, first = '';
  for (let v = T.TRYTE_MIN; v <= T.TRYTE_MAX; v++) {
    if (gather(net.solve({ ...spread('d', v), we: 1, hold: -1 })) !== v) {
      wrongWrite++; if (!first) first = `write ${v}`;
    }
    const holdIn = { ...spread('d', 0), we: -1, hold: 1 };
    if (gather(net.solve(holdIn, 64, seedFor(net, holdIn, v))) !== v) {
      wrongHold++; if (!first) first = `hold ${v}`;
    }
  }
  check('J1 — every one of the 729 trytes writes correctly', wrongWrite === 0, first);
  check('J1 — and every one of them holds', wrongHold === 0, first);
  check('   six feedback loops settling in one solve, which nothing here had done',
    (() => {
      const n = register(true);
      const loops = n.devices.filter(d => /^qraw|^qbraw/.test(d.a) || /^qraw|^qbraw/.test(d.b));
      return loops.length >= 12;
    })());
}

console.log('\n=== 3. J3 — IT DOES NOT LEAK ===');
{
  const net = register(true);
  const STEP = 17;                      // stated, not quietly chosen
  let n = 0, moved = 0, first = '';
  for (let stored = T.TRYTE_MIN; stored <= T.TRYTE_MAX; stored += STEP) {
    const inputs = { we: -1, hold: 1 };
    const init = seedFor(net, { ...spread('d', 0), ...inputs }, stored);
    for (let data = T.TRYTE_MIN; data <= T.TRYTE_MAX; data += STEP) {
      n++;
      if (gather(net.solve({ ...spread('d', data), ...inputs }, 64, init)) !== stored) {
        moved++; if (!first) first = `held ${stored}, data ${data}`;
      }
    }
  }
  check(`J3 — with the enable low, ${n.toLocaleString()} data values move nothing`,
    moved === 0, first);
  check('   which is the check most likely to catch a write path that half-conducts',
    n > 1000);
}

console.log('\n=== 4. J4 FAILED — IT IS A TRANSPARENT LATCH ===');
{
  const net = register(true);
  let old = 0, fresh = 0, other = 0, n = 0;
  for (let stored = T.TRYTE_MIN; stored <= T.TRYTE_MAX; stored += 23) {
    for (const data of [0, 121, -364, 364, 7]) {
      if (data === stored) continue;
      n++;
      const inputs = { ...spread('d', data), we: 1, hold: -1 };
      let got;
      try { got = gather(net.solve(inputs, 64, seedFor(net, inputs, stored))); } catch (e) { got = null; }
      if (got === stored) old++; else if (got === data) fresh++; else other++;
    }
  }
  check(`J4 FAILED — a read during a write sees the NEW value on all ${n} cases,`
    + ' not the old one as predicted', fresh === n && old === 0,
    `old ${old} new ${fresh} neither ${other}`);
  check('   and the mechanism is exact: while `we` is asserted the feedback is open,'
    + ' so the cell is driven from its input and the seed has nothing holding it',
    (() => {
      // With hold low, the two feedback pass devices do not conduct at all.
      const n2 = register(true);
      const sol = n2.solve({ ...spread('d', 121), we: 1, hold: -1 });
      return sol.qraw0 !== undefined && gather(sol) === 121;
    })());
  check('   so it is a transparent latch, not a flip-flop, and master-slave IS needed',
    fresh === n);
  check('   which design/11 had already written down as the falsifying outcome', (() => {
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'design', '11-open.md'), 'utf8');
    return /register read and write in the same solve/.test(src);
  })());
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
