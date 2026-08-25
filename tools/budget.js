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
  tmux: built(n => D.tmux(n, 's', 'l', 'm', 'h', 'o')),
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
// THE READ PATH USES `tmux`, NOT `dmux`, AND THAT IS A DECISION SET `B` FORCED.
//
// The decoded selector is cheaper — 3 switches against 4 — and it won the adder.
// It cannot be used here without a precondition. `B1a` measured it: with a stored
// value on a source terminal and the select cone left to resolve itself, `dmux`
// NEVER SETTLES on two of the three addresses, because its middle leg is gated by
// a computed detector output that is unknown on pass one, and unknown conduction
// bridges the selected word to a second word's rail. `tmux` gates every leg on the
// select INPUT, which is known on pass one, and reads correctly with no
// precondition at all.
//
// `dmux` does work once the select cone is resolved (`B1b`, 81 of 81). But
// "resolve the select cone first" is exactly the seeding discipline that
// `design/12-roadmap.md` names as the most likely way the assembled machine
// produces a plausible wrong answer — one missed seed, and nothing catches it but
// the answer being wrong. Paying 4 switches instead of 3 removes the failure mode
// rather than documenting it.
//
// Price at the target machine: +240 switches, 3,640 to 3,880, against a budget of
// 4,806. The safer structure fits, so it is not a trade at this size.
const READ_FAMILY = 'tmux';

const addressPath = W => {
  const t = Math.round(Math.log(W) / Math.log(3));
  const decoder = U.dmux * (3 * W - 3) / 2 + U.detector * t;
  const nodes = (W - 1) / 2;                       // 3-way mux tree over W inputs
  const read = 6 * (READ_FAMILY === 'tmux' ? U.tmux : U.dmux) * nodes;
  const readIfDecoded = 6 * U.dmux * nodes;        // kept visible: the price of the choice
  const write = 6 * W;
  return { t, decoder, read, readIfDecoded, write, total: decoder + read + write };
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
      // ALU op select stays DECODED: its source terminals are the ALU's outputs,
      // which `L2` measured as rail-driven, not stored nodes. `B1a`'s failure needs
      // a storage cell with a feedback loop on the terminal; a rail-driven source
      // has none, and the control diagnostic in `terminal-audit.js` confirms dmux
      // reads rail terminals cleanly with no precondition.
      ['ALU op select (dmux — rail-driven sources)', 6 * 2 * U.dmux + 3 * U.detector, 'PROPOSED'],
      ['decode (C1, 12 lines)', 12 * 39 + 12, 'PROPOSED'],
      // Interconnect moves to tmux for the same reason the read path did: `I0`'s
      // sources are REGISTER OUTPUTS — stored nodes — which is exactly the case
      // `B1a` measured never settling under the decoded family. Applying the rule
      // to the read path and not here would be the inconsistency this repo hunts.
      ['interconnect (I0, tmux — stored sources)', 3 * 6 * U.tmux * 2, 'PROPOSED'],
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

  console.log(`--- the read path is ${READ_FAMILY} (decided by set B) ---`);
  console.log(`      dmux costs ${U.dmux} and cannot read a stored value unless its select cone`);
  console.log(`      is resolved first — B1a measured it never settling on two of the three`);
  console.log(`      addresses. tmux costs ${U.tmux} and needs no precondition.`);

  console.log('\n--- the ladder ---');
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
