'use strict';
/* test-relax.js — what does replacing the reachability walk's worklist with frontier relaxation cost, before any lane is added?
 *
 * Set `AY`. Say which check here is the one worth keeping, and why — usually the
 * prediction that failed, because that is where this corpus has learned most.
 *
 * The exhaustive version is `npm run audit:relax`.
 */

const A = require('../tools/relax-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // 0a. The construction is the one the registration described. A set whose subject
  // is not the subject it cites is measuring something nobody registered.

  // 0b. THE TOOL AS IT IS ACTUALLY RUN. T-TOOL-CHECKED-ONLY-BY-IMPORT: importing a
  // tool sets MAIN false, so every log line is skipped and a fault in the report path
  // stays invisible to a suite that only imports. Run the real thing.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'relax-audit.js')],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('RELAXATION AUDIT') && out.includes('AY1'));

  // 0c. Check the pipeline against a case whose answer is known independently.
}

console.log('\n=== 1. AY1  the price of the traversal at one lane ===');
{
  check('AY1 ...', false, 'not yet measured');
}

console.log('\n=== 2. AY2  whether the change stayed inside its phase ===');
{
  check('AY2 ...', false, 'not yet measured');
}

console.log('\n=== 3. AY3  the same price on a network with more edges per node ===');
{
  check('AY3 ...', false, 'not yet measured');
}

console.log('\n=== 4. AY4  frontier depth, and whether it varies ===');
{
  check('AY4 ...', false, 'not yet measured');
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
