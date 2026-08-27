'use strict';
/* run-all.js — every suite, plus the one number no single suite can check.
 *
 * The README's headline check count has gone stale twice. It is not a constant
 * any suite owns, because it is the SUM of all of them — so it is checked here,
 * where the sum is already in hand. T-STALE-CONSTANT, third occurrence.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SUITES = ['test-device.js', 'test-axioms.js', 'test-adder.js', 'test-midrail.js', 'test-decoded.js', 'test-passcount.js', 'test-collision.js', 'test-design.js', 'test-doctree.js', 'test-headroom.js', 'test-detector.js', 'test-register.js', 'test-msregister.js', 'test-accumulator.js', 'test-budget.js', 'test-terminal.js', 'test-memory.js', 'test-interconnect.js', 'test-iterhash.js', 'test-reversible.js', 'test-nonlinearity.js', 'test-midprice.js', 'test-decode.js', 'test-sequencer.js', 'test-erasure.js', 'test-predict.js', 'test-hailstone.js', 'test-setclass.js', 'test-tuning.js', 'test-workfactor.js', 'test-results.js', 'test-core.js', 'test-vm.js',
  'test-selfhost.js', 'test-bench.js', 'test-logic.js', 'test-monoid.js',
  'test-fold.js', 'test-page.js', 'test-style.js', 'test-findings.js'];

let failed = false;
let total = 0;
const unparsed = [];
for (const suite of SUITES) {
  console.log(`\n########## ${suite} ##########`);
  let out;
  try { out = execFileSync(process.execPath, [path.join(__dirname, suite)], { encoding: 'utf8' }); }
  catch (e) { failed = true; out = e.stdout || e.message; }
  console.log(out);
  const m = /ALL (\d+) CHECKS PASSED/.exec(out);
  if (m) total += Number(m[1]); else unparsed.push(suite);
}

console.log('########## totals ##########');
if (unparsed.length) {
  // A suite whose count could not be read must not be silently dropped from the
  // sum — that would let the README claim a number nothing added up to.
  failed = true;
  console.log(`  [FAIL] no check count found in: ${unparsed.join(', ')}`);
} else {
  const README = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  // The count crossed a thousand and the README groups its digits. Match the grouped
  // form and strip the separators, rather than forcing the prose to read "1027".
  const claimed = /\*\*([\d,]+) checks\*\*/.exec(README);
  if (!claimed) { failed = true; console.log('  [FAIL] the README states no check count'); }
  else if (Number(claimed[1].replace(/,/g, '')) !== total) {
    failed = true;
    console.log(`  [FAIL] the README says ${claimed[1]} checks; the suites ran ${total}`);
  } else {
    console.log(`  [PASS] ${total} checks across ${SUITES.length} suites, matching the README`);
  }
}

console.log(failed ? '\n>>> SUITE FAILED' : '\n>>> ALL SUITES PASSED');
process.exit(failed ? 1 : 0);
