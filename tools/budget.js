'use strict';
/* BUDGET — what the machine costs, parametric in how much memory it has.
 *
 * This is NOT a measurement of a built machine. Nothing here has been assembled
 * or swept. It is arithmetic over parts, and the parts have different standing:
 *
 *   MEASURED  built by src/device.js and counted by Net.cost() right here, in
 *             this process. The adder, the registers, the selectors, the cell.
 *   DERIVED   arithmetic over MEASURED parts and nothing else.
 *   PROPOSED  a structural formula for something nobody has built. The formula
 *             is written out so it can be argued with, and the reasoning is in
 *             the comment above it.
 *
 * A total that sums MEASURED and PROPOSED lines is PROPOSED. The weakest status
 * propagates, because a number is only as good as its softest term — the whole
 * reason this repository has a status vocabulary at all.
 *
 * WHY THIS IS A TOOL AND NOT A TABLE IN A MARKDOWN FILE. `T-STALE-CONSTANT` has
 * bitten three times: a number typed into prose stops tracking the code that
 * produced it and keeps looking right. Every switch count in `design/` that came
 * from a builder should come from the builder. `test/test-budget.js` asserts that
 * the numbers in the roadmap match what this prints.
 *
 * WHAT THE ABSOLUTE TOTALS ARE WORTH: less than the comparisons between them.
 * The PROPOSED formulas could each be off by a factor, but they are applied
 * identically across configurations, so "which of these fits in the sweep budget"
 * survives errors that "how many switches exactly" does not. Read the ladder, not
 * the digits.
 */

const D = require('../src/device.js');

/** Build something and count it. This is where MEASURED comes from. */
const built = fn => { const net = new D.Net(); fn(net); return net.cost().switches; };

// --- MEASURED: parts that exist -------------------------------------------
const U = {
  adder: built(n => D.dRippleAdder(n, 6)),        // decoded 6-trit ripple, E/F
  dmux: built(n => D.dmux(n, 's', 'sm', 'l', 'm', 'h', 'o')),
  detector: built(n => D.isMid(n, 's', 'o')),
  inverter: built(n => D.sti(n, 'a', 'o')),
};
// The register and cell costs cannot be re-derived from a builder here: `latch`
// and the master-slave pair are local functions inside their audits, not exports
// of device.js. So they come from the LEDGER instead — the recorded measurement,
// read by id — which is the next best source and the only other one that is not a
// typed literal.
//
// The first version of this file typed them as constants under a comment claiming
// they were re-derived. They were not, and `test-budget.js` "checked" them against
// the same literals, so the check compared a number to itself and could never
// fire. `T-STALE-CONSTANT` inside the tool written to prevent it.
const M = require('../FINDINGS.json');
const measured = (setId, predId) => {
  const set = M.prediction_sets.find(s => s.id === setId);
  const p = set && set.predictions.find(x => x.id === predId);
  if (!p || !p.measured) throw new Error(`no measured record for ${predId}`);
  return p.measured;
};
U.msRegister = measured('K', 'K2').without;              // 132, in place
U.cellLoopBreaking = measured('J', 'J2').without / 6;    // 66 / 6 trits = 11
U.cellRetained = measured('H', 'H4').dynamic_cell_switches;   // 1, needs M1

// --- The sweep budget, from H2 ---------------------------------------------
// H2 measured 4,806 devices as the largest network for which a full 531,441-pair
// sweep fits inside an hour. That is a BUDGET of solves, not a verification
// contract: no machine is exhaustive over its own state space, and what the
// budget gets spent on is a choice the roadmap has to make explicitly.
const SWEEP_DEVICE_BUDGET = 4806;

// --- PROPOSED: structural formulas for what is not built --------------------
//
// t = address trits. A W-word memory needs W = 3^t.
//
// decoder (D0): a tree 3 -> 9 -> ... -> W. The number of select lines across all
//   levels is 3 + 9 + ... + 3^t = (3W - 3)/2, each produced by one decoded
//   3-way selector, plus one MID detector per address trit (shared down the tree,
//   which is the whole point of the decoded family).
// read (D1): a W-to-1 mux per output trit. A 3-way mux tree over W inputs has
//   (W - 1)/2 internal nodes; six trits.
// write: one pass switch per cell, gated by that word's select line.
//
// D0 and D1 may be the SAME STRUCTURE — design/07 flags it and nobody has
// checked. If they are, the address path roughly halves. Both are counted here,
// which is the pessimistic reading and is marked as such.
const addressPath = W => {
  const t = Math.round(Math.log(W) / Math.log(3));
  const decoder = U.dmux * (3 * W - 3) / 2 + U.detector * t;
  const read = 6 * U.dmux * (W - 1) / 2;
  const write = 6 * W;
  return { t, decoder, read, write, total: decoder + read + write };
};

const CONFIGS = [];
for (const W of [27, 81, 243, 729]) {
  for (const model of ['M0', 'M1']) {
    const cell = model === 'M0' ? U.cellLoopBreaking : U.cellRetained;
    const ap = addressPath(W);
    const lines = [
      ['storage', W * 6 * cell, model === 'M0' ? 'DERIVED' : 'PROPOSED'],
      ['address path', ap.total, 'PROPOSED'],
      ['registers (3 x master-slave)', 3 * U.msRegister, 'MEASURED'],
      ['ALU adder', U.adder, 'MEASURED'],
      ['ALU op select', 6 * 2 * U.dmux + 3 * U.detector, 'PROPOSED'],
      ['decode (C1, 12 lines)', 12 * 39 + 12, 'PROPOSED'],
      ['interconnect (I0)', 3 * 6 * U.dmux * 2, 'PROPOSED'],
    ];
    const total = lines.reduce((a, l) => a + l[1], 0);
    const rank = { MEASURED: 2, DERIVED: 1, PROPOSED: 0 };
    const status = lines.reduce((w, l) => rank[l[2]] < rank[w] ? l[2] : w, 'MEASURED');
    CONFIGS.push({ W, model, t: ap.t, lines, total, status, cell,
      sweepable: total <= SWEEP_DEVICE_BUDGET });
  }
}

module.exports = { U, CONFIGS, addressPath, SWEEP_DEVICE_BUDGET };

if (require.main === module) {
  console.log('MACHINE BUDGET — parametric in memory size.\n');
  console.log('--- measured unit costs, built and counted in this process ---');
  for (const [k, v] of Object.entries(U)) console.log(`      ${k.padEnd(20)} ${String(v).padStart(5)}`);
  console.log(`\n--- the sweep budget (H2) ---`);
  console.log(`      ${SWEEP_DEVICE_BUDGET} devices is the largest network a full 531,441-pair`);
  console.log(`      sweep clears inside an hour. It is a budget of solves, not a proof.\n`);

  console.log('--- the ladder ---');
  console.log('  words  trits  model  storage   addr    rest   TOTAL   status     sweepable');
  for (const c of CONFIGS) {
    const st = c.lines[0][1], ad = c.lines[1][1];
    console.log(`  ${String(c.W).padStart(5)}  ${String(c.t).padStart(5)}  ${c.model}`
      + `   ${String(st).padStart(7)} ${String(ad).padStart(6)} ${String(c.total - st - ad).padStart(7)}`
      + ` ${String(c.total).padStart(7)}   ${c.status.padEnd(9)}  ${c.sweepable ? 'yes' : 'no'}`);
  }
  console.log('\n--- a single configuration, itemised (243 words, M1) ---');
  const ex = CONFIGS.find(c => c.W === 243 && c.model === 'M1');
  for (const [name, n, s] of ex.lines) console.log(`      ${name.padEnd(30)} ${String(n).padStart(6)}   ${s}`);
  console.log(`      ${'TOTAL'.padEnd(30)} ${String(ex.total).padStart(6)}   ${ex.status}`
    + '   <- weakest term wins');
}
