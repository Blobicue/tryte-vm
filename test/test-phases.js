'use strict';
/* test-phases.js — where does R2 actually spend its time, across the three phases of a pass?
 *
 * Set `AX`. Say which check here is the one worth keeping, and why — usually the
 * prediction that failed, because that is where this corpus has learned most.
 *
 * The exhaustive version is `npm run audit:phases`.
 */

const A = require('../tools/phases-audit.js');
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
    [path.join(__dirname, '..', 'tools', 'phases-audit.js')],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('PHASES AUDIT') && out.includes('AX1'));

  // 0c. Check the pipeline against a case whose answer is known independently.
}

console.log('\n=== 1. AX1 ===');
{
  check('AX1 ...', false, 'not yet measured');
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
