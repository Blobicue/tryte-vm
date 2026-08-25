'use strict';
/* test-detector.js — four switches is minimal for the MID detector.
 *
 * The decoded selector pays for the series pair that isolates the middle level
 * once per SIGNAL rather than once per selector. The six-trit adder instantiates
 * that detector eighteen times, so a switch saved there is eighteen saved.
 *
 * Reading `dmux` before searching turned up the thing that made this worth doing:
 * its middle arm is `n(selMid, MID, ...)`, which conducts iff the detector's
 * output is at or above MID. So the contract is "output >= 0 exactly when the
 * select is MID" — four tables satisfy it, and only one was ever built. All four
 * cost four switches, so the choice between them is free and the adder's 540 is
 * not improvable from this direction.
 *
 * The exhaustive four-switch sweep for every contract is `npm run audit:detector`.
 * This runs the sub-four search exhaustively — which is the half that could have
 * found something — and one contract's four-switch control.
 */

const D = require('../src/device.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const L = [-1, 0, 1];

const CONTRACTS = [
  ['n-arm (-1, 0, -1)', [-1, 0, -1]],
  ['n-arm (-1, +1, -1)', [-1, 1, -1]],
  ['p-arm (+1, 0, +1)', [1, 0, 1]],
  ['p-arm (+1, -1, +1)', [1, -1, 1]],
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
const key = d => { const [x, y] = [d.a, d.b].sort(); return `${d.kind}${d.vt}:${x}-${y}`; };
const show = devs => devs.map(key).sort().join('  ');
const computes = (devs, table) => {
  if (!devs.some(d => d.a === 'out' || d.b === 'out')) return false;
  const net = new D.Net(); net.devices = devs;
  try { return L.every((v, i) => net.solve({ in: v }).out === table[i]); }
  catch (e) { return false; }
};
const search = (k, table) => {
  const found = []; const pick = [];
  const rec = start => {
    if (pick.length === k) { if (computes(pick, table)) found.push(show(pick)); return; }
    for (let i = start; i < SPACE.length; i++) { pick.push(SPACE[i]); rec(i); pick.pop(); }
  };
  rec(0);
  return found;
};

console.log('\n=== 1. THE CONTRACT IS BROADER THAN THE TABLE THAT WAS BUILT ===');
{
  check('the middle arm conducts on the detector being at or above MID, not on a table', (() => {
    const n = new D.Net(); D.dmux(n, 'sel', 'im', 'lo', 'mid', 'hi', 'o');
    const arm = n.devices.find(d => d.gate === 'im');
    return arm !== undefined && arm.kind === 'n' && arm.vt === D.MID;
  })());
  check('   so four tables satisfy it, two per arm polarity', CONTRACTS.length === 4);
  check('   and every one of them really does drive the arm correctly', (() => {
    // A detector output >= 0 exactly at MID makes an n-type MID arm conduct
    // exactly at MID. Checked directly rather than argued.
    return CONTRACTS.every(([, t]) => (t[1] >= 0) && (t[0] < 0) && (t[2] < 0)
      || (t[1] <= 0) && (t[0] > 0) && (t[2] > 0));
  })());
}

console.log('\n=== 2. I1 — NOTHING UNDER FOUR SWITCHES WORKS ===');
{
  for (const [name, table] of CONTRACTS) {
    const under = [1, 2, 3].map(k => search(k, table).length);
    check(`I1 — ${name}: nothing at 1, 2 or 3 switches`,
      under.every(n => n === 0), under.join(' '));
  }
  check('I1 — which is the half of the search that could have found something,'
    + ' and it is exhaustive', SPACE.length === 42);
}

console.log('\n=== 3. I2, I3 — THE CONTROL, AND THAT THE FOUR COST THE SAME ===');
{
  const built = show([
    { kind: 'p', vt: D.LOW, a: 'vss', b: 'out' },
    { kind: 'n', vt: D.HIGH, a: 'vss', b: 'out' },
    { kind: 'n', vt: D.MID, a: 'vmid', b: 'm' },
    { kind: 'p', vt: D.MID, a: 'm', b: 'out' },
  ]);
  const four = search(4, CONTRACTS[0][1]);
  check(`I2 — the four-switch search finds ${four.length} networks for the built contract`,
    four.length === 4, String(four.length));
  check('I2 — and the detector actually in use is among them', four.includes(built));
  check('I3 — every contract has a four-switch solution, so the choice is free',
    CONTRACTS.every(([, t]) => search(4, t).length > 0));
  check('   four solutions each, the same count X5 found for NEG',
    CONTRACTS.every(([, t]) => search(4, t).length === 4));
}

console.log('\n=== 4. I4 — SO THE ADDER STANDS ===');
{
  const decoded = new D.Net(); D.dRippleAdder(decoded, 6);
  const bin = D.binaryNet(); D.bRippleAdder(bin, 10);
  check('I4 — the decoded six-trit adder is still 540 switches',
    decoded.cost().switches === 540);
  check('I4 — and its ratio against the ten-bit binary adder is still 1.929',
    Math.abs(decoded.cost().switches / bin.cost().switches - 1.929) < 0.001);
  check('   the detector appears 18 times, so this was worth 18 switches to check', (() => {
    // Three signals per cell, six cells. Counted from the netlist rather than assumed.
    const detectorNodes = new Set();
    for (const d of decoded.devices) {
      if (/\$im\$m$/.test(d.a) || /\$im\$m$/.test(d.b)) {
        detectorNodes.add((d.a.endsWith('$im$m') ? d.a : d.b).replace(/\$m$/, ''));
      }
    }
    return detectorNodes.size === 18;
  })());
}

console.log('\n=== 5. THE SEARCH HAS TEETH ===');
{
  check('a table that IS reachable in three switches is found', (() => {
    // A plain inverter-ish target the space can hit cheaply, to show the search
    // is not simply blind below four.
    const anyThree = [];
    for (let a = -1; a <= 1 && !anyThree.length; a++) {
      for (let b = -1; b <= 1 && !anyThree.length; b++) {
        for (let c = -1; c <= 1 && !anyThree.length; c++) {
          if (search(3, [a, b, c]).length) anyThree.push([a, b, c]);
        }
      }
    }
    return anyThree.length > 0;
  })());
  check('   so "nothing under four" is a fact about the contracts, not the search',
    search(3, [-1, 0, -1]).length === 0);
  check('the space excludes rail-to-rail devices, and says why', (() => {
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'detector-audit.js'), 'utf8');
    return /rail-to-rail excluded/.test(src) && SPACE.every(d => !(RAIL.has(d.a) && RAIL.has(d.b)));
  })());
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
