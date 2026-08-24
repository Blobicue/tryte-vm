'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
let failed = false;
for (const suite of ['test-core.js', 'test-vm.js', 'test-selfhost.js', 'test-bench.js', 'test-logic.js', 'test-monoid.js', 'test-fold.js', 'test-page.js', 'test-style.js', 'test-findings.js']) {
  console.log(`\n########## ${suite} ##########`);
  try { console.log(execFileSync(process.execPath, [path.join(__dirname, suite)], { encoding: 'utf8' })); }
  catch (e) { failed = true; console.log(e.stdout || e.message); }
}
console.log(failed ? '\n>>> SUITE FAILED' : '\n>>> ALL SUITES PASSED');
process.exit(failed ? 1 : 0);
