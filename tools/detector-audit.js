'use strict';
/* DETECTOR AUDIT — is four switches minimal for the thing paid eighteen times?
 *
 * The decoded selector's whole advantage is that the series pair which isolates
 * the middle level is paid once per SIGNAL rather than once per selector. In the
 * six-trit adder that detector is instantiated eighteen times, so one switch saved
 * there is eighteen saved — the best leverage per unit of search effort available
 * in the circuit layer.
 *
 * Nobody has checked it. `X5` established that four switches is minimal for NEG by
 * exhaustive search; the same machinery, retargeted, answers this.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED. Established while setting this up:
 *
 *   - `dmux` gates its middle arm with `n(selMid, MID, ...)`, which conducts iff
 *     the detector's output is at or above MID. So the CONTRACT is "output >= 0
 *     exactly when the select is MID" — not the particular table that was built.
 *   - Four tables satisfy it. Two for an n-type middle arm, (-1, 0, -1) and
 *     (-1, +1, -1); and two more, (+1, 0, +1) and (+1, -1, +1), which would serve
 *     a p-type middle arm instead. Only the first was ever built, at 4 switches.
 *   - The search space is X5's: two kinds x three thresholds x terminal pairs from
 *     {vss, vmid, vdd, out, m}, rail-to-rail excluded because reachability stops
 *     at driven nodes and such an edge cannot change any value. 42 device types.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   I1  FOUR IS MINIMAL, FOR ALL FOUR CONTRACTS. No network of three switches or
 *       fewer computes any of the four acceptable detector tables. Predicted by
 *       analogy with X5 and by the same argument: isolating the middle level needs
 *       the D3 overlap, which needs two devices, and the two outer levels each
 *       need a definite path to a rail.
 *
 *       At risk because the contract is broader than the table that was built, and
 *       nobody has looked at the other three. If any of them costs 3, the adder
 *       gets 18 switches cheaper and the decoded design was leaving money on the
 *       table.
 *
 *   I2  AND THE POSITIVE CONTROL FINDS THE ONE ALREADY IN USE. The 4-switch search
 *       finds at least one network per contract, and the built detector is among
 *       the solutions for (-1, 0, -1). A search that finds nothing proves nothing
 *       unless it can find something. Not predicted, reported as measured: how many
 *       distinct 4-switch detectors exist for each contract.
 *
 *   I3  THE FOUR CONTRACTS ALL COST THE SAME. Predicted: minimum 4 switches for
 *       every one of them, so the choice between an n-type and a p-type middle arm
 *       is free and the decoded selector cannot be improved from this direction.
 *
 *   I4  SO THE DECODED ADDER'S 540 STANDS. If I1 and I3 hold, the detector is
 *       irreducible, the selector arm is already one device, and 540 switches is
 *       not improvable by making the decoder cheaper. Predicted: no change.
 *
 *       If I1 fails instead, the arithmetic is registered in advance so it cannot
 *       be massaged afterwards: a 3-switch detector saves 18 switches, taking the
 *       decoded six-trit adder from 540 to 522, and the ratio against binary from
 *       1.929 to 1.864.
 * ------------------------------------------------------------------------------
 */

const D = require('../src/device.js');

const line = '='.repeat(78);
const L = [-1, 0, 1];
console.log('DETECTOR AUDIT — four switches, paid eighteen times. Is it minimal?\n');

/* The four tables that satisfy the contract, as [f(-1), f(0), f(+1)]. */
const CONTRACTS = [
  { name: 'n-arm, (-1, 0, -1)', table: [-1, 0, -1], built: true },
  { name: 'n-arm, (-1, +1, -1)', table: [-1, 1, -1], built: false },
  { name: 'p-arm, (+1, 0, +1)', table: [1, 0, 1], built: false },
  { name: 'p-arm, (+1, -1, +1)', table: [1, -1, 1], built: false },
];

const NODES = ['vss', 'vmid', 'vdd', 'out', 'm'];
const RAIL = new Set(['vss', 'vmid', 'vdd']);
const SPACE = [];
for (const kind of ['n', 'p']) for (const vt of L) {
  for (let i = 0; i < NODES.length; i++) for (let j = i + 1; j < NODES.length; j++) {
    if (RAIL.has(NODES[i]) && RAIL.has(NODES[j])) continue;
    SPACE.push({ kind, gate: 'in', vt, a: NODES[i], b: NODES[j] });
  }
}
// Terminals are interchangeable (D4), so the key must not care about their order.
const key = d => { const [x, y] = [d.a, d.b].sort(); return `${d.kind}${d.vt}:${x}-${y}`; };
const show = devs => devs.map(key).sort().join('  ');

const computes = (devs, table) => {
  if (!devs.some(d => d.a === 'out' || d.b === 'out')) return false;
  const net = new D.Net(); net.devices = devs;
  try { return L.every((v, i) => net.solve({ in: v }).out === table[i]); }
  catch (e) { return false; }
};

function search(k, table) {
  const found = []; const pick = [];
  let tried = 0;
  const rec = start => {
    if (pick.length === k) { tried++; if (computes(pick, table)) found.push(show(pick)); return; }
    for (let i = start; i < SPACE.length; i++) { pick.push(SPACE[i]); rec(i); pick.pop(); }
  };
  rec(0);
  return { found, tried };
}

console.log(`--- I1, I3  the minimum, for every contract the selector accepts ---`);
console.log(`      device space: ${SPACE.length} types, rail-to-rail excluded as inert\n`);
const minima = [];
{
  console.log('      contract               1 sw   2 sw   3 sw   4 sw   minimum');
  for (const c of CONTRACTS) {
    const counts = [1, 2, 3, 4].map(k => search(k, c.table).found.length);
    const min = counts.findIndex(n => n > 0);
    minima.push({ ...c, counts, min: min < 0 ? null : min + 1 });
    console.log(`      ${c.name.padEnd(20)}  ${counts.map(n => String(n).padStart(5)).join('  ')}`
      + `   ${min < 0 ? 'none at <=4' : String(min + 1)}`);
  }
  const allFour = minima.every(m => m.min === 4);
  const anyCheaper = minima.some(m => m.min !== null && m.min < 4);
  console.log(`\n      I1: ${anyCheaper ? 'FAILS — a contract is cheaper than four'
    : 'holds — nothing under four switches computes any acceptable detector'}`);
  console.log(`      I3: ${allFour ? 'holds — all four contracts cost the same'
    : 'FAILS — the contracts differ in cost'}`);
}

console.log('\n--- I2  the positive control ---');
{
  const builtKey = show([
    { kind: 'p', vt: D.LOW, a: 'vss', b: 'out' },
    { kind: 'n', vt: D.HIGH, a: 'vss', b: 'out' },
    { kind: 'n', vt: D.MID, a: 'vmid', b: 'm' },
    { kind: 'p', vt: D.MID, a: 'm', b: 'out' },
  ]);
  const c0 = search(4, CONTRACTS[0].table);
  console.log(`      (-1, 0, -1) at 4 switches: ${c0.tried.toLocaleString()} networks searched,`
    + ` ${c0.found.length} compute it`);
  console.log(`      the detector actually in use is among them: ${c0.found.includes(builtKey)}`);
  for (const f of c0.found.slice(0, 4)) console.log(`        ${f}`);
  if (c0.found.length > 4) console.log(`        ... and ${c0.found.length - 4} more`);
}

console.log('\n--- I4  what it means for the adder ---');
{
  const min = Math.min(...minima.filter(m => m.min).map(m => m.min));
  const saved = (4 - min) * 18;
  const decoded = new D.Net(); D.dRippleAdder(decoded, 6);
  const bin = D.binaryNet(); D.bRippleAdder(bin, 10);
  const before = decoded.cost().switches;
  const after = before - saved;
  console.log(`      cheapest detector found: ${min} switches, so ${saved} saved across 18 of them`);
  console.log(`      decoded six-trit adder: ${before} -> ${after}`);
  console.log(`      ratio against the ten-bit binary adder: `
    + `${(before / bin.cost().switches).toFixed(3)} -> ${(after / bin.cost().switches).toFixed(3)}`);
  console.log(`      ${saved === 0
    ? 'I4 holds — the detector is irreducible and 540 stands.'
    : 'I4 FAILS — the decoded design was leaving switches on the table.'}`);
}

console.log('\n' + line);
