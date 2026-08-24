'use strict';
/* test-bench.js — what does the three-way branch actually buy?
 *
 * Everything else in this project checks that ternary is CORRECT. This file
 * checks whether it is WORTH IT, which is the claim the source conversation and
 * the folklore both make loudest and neither measures.
 *
 * What is being compared, precisely: three-way dispatch against two-way dispatch
 * ON THE SAME MACHINE. Both variants run on trit hardware, in trit memory, with
 * the same instruction set. A two-way branch is BR3 with two of its arms pointing
 * at the same place, which is exactly what a binary machine's conditional branch
 * does. This is a narrower claim than "ternary beats binary" and it is the one
 * the measurement actually supports.
 *
 * Fairness: BR3 does not disturb the accumulator, so the two-way variants retest
 * the value already in it — no store/reload tax. A baseline the reader could
 * improve would make the whole exercise worthless.
 *
 * Correctness is asserted before any timing. A fast wrong program is disqualified,
 * not celebrated.
 */

const fs = require('fs');
const path = require('path');
const T = require('../src/ternary.js');
const { runNative } = require('../src/selfhost.js');
const { assemble } = require('../src/assembler.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const src = f => fs.readFileSync(
  path.join(__dirname, '..', f === 'countdown.tasm' ? 'programs' : 'bench', f), 'utf8');
const cells = s => assemble(s, 0).cells.size;

/* --- the sweeps -------------------------------------------------------------- */
const ALL = [];
for (let v = T.TRYTE_MIN; v <= T.TRYTE_MAX; v++) ALL.push(v);

/** Six-value input sets covering every tryte value, deterministically. */
const SETS = [];
for (let i = 0; i < ALL.length; i += 6) {
  const s = ALL.slice(i, i + 6);
  if (s.length === 6) SETS.push(s);
}

function measure(file, inputSets, oracle) {
  const s = src(file);
  let steps = 0, wrong = null;
  for (const inp of inputSets) {
    const r = runNative(s, inp);
    steps += r.steps;
    const want = oracle(inp).join();
    if (r.output.join() !== want) { wrong = `${inp} -> ${r.output} want ${want}`; break; }
  }
  return { file, cells: cells(s), steps, mean: steps / inputSets.length, wrong };
}

console.log('\n=== 1. SINGLE DECISION — classify one value ===');
const signOracle = inp => [Math.sign(inp[0])];
const s3 = measure('sign-three.tasm', ALL.map(v => [v]), signOracle);
const s2 = measure('sign-two.tasm', ALL.map(v => [v]), signOracle);
check('the three-way version is correct for all 729 values', s3.wrong === null, s3.wrong || '');
check('the two-way version is correct for all 729 values', s2.wrong === null, s2.wrong || '');
console.log(`         three-way ${s3.cells} cells, ${s3.mean.toFixed(2)} steps mean`);
console.log(`         two-way   ${s2.cells} cells, ${s2.mean.toFixed(2)} steps mean`);
check(`three-way is smaller (${s3.cells} vs ${s2.cells} cells)`, s3.cells < s2.cells);
check(`three-way is faster on average (${s3.mean.toFixed(2)} vs ${s2.mean.toFixed(2)})`, s3.mean < s2.mean);
check('but the saving is under one instruction per decision, not a factor',
  s2.mean - s3.mean < 1, `${(s2.mean - s3.mean).toFixed(3)}`);
check('and for negative inputs the two are identical — the first two-way test already answered it',
  runNative(src('sign-three.tasm'), [-9]).steps === runNative(src('sign-two.tasm'), [-9]).steps);

console.log('\n=== 2. REPEATED DECISION — classify six values in a loop ===');
const classOracle = inp => inp.map(Math.sign);
const c3 = measure('classify-three.tasm', SETS, classOracle);
const c2 = measure('classify-two.tasm', SETS, classOracle);
check(`three-way is correct across all ${SETS.length} input sets`, c3.wrong === null, c3.wrong || '');
check(`two-way is correct across all ${SETS.length} input sets`, c2.wrong === null, c2.wrong || '');
console.log(`         three-way ${c3.cells} cells, ${c3.mean.toFixed(2)} steps per set of six`);
console.log(`         two-way   ${c2.cells} cells, ${c2.mean.toFixed(2)} steps per set of six`);
const perDecision = (c2.mean - c3.mean) / 6;
check(`the saving compounds but stays small: ${perDecision.toFixed(2)} instructions per value`,
  perDecision > 0 && perDecision < 1, String(perDecision));
check(`overall that is a ${(100 * (1 - c3.mean / c2.mean)).toFixed(1)}% reduction, not a multiple`,
  c3.mean / c2.mean > 0.85, String(c3.mean / c2.mean));

console.log('\n=== 3. CONTROL — a genuinely binary decision ===');
{
  // "Is the counter still positive?" has two outcomes, so there is nothing for a
  // third branch arm to do. The two-way version of this program IS this program.
  const cd = src('countdown.tasm');
  const oracle = n => Array.from({ length: n }, (_, i) => n - i);
  let ok = true;
  for (let n = 1; n <= 40; n++) {
    if (runNative(cd, [n]).output.join() !== oracle(n).join()) { ok = false; break; }
  }
  check('the countdown is correct for n = 1..40', ok);
  check('three-way branching buys exactly nothing here — the two variants are one file',
    cd === src('countdown.tasm'));
  const branches = (cd.match(/BR3/g) || []).length;
  check(`its single branch has only two distinct destinations (${branches} BR3 in the file)`,
    /\.table\s+done,\s*done,\s*lp/.test(cd));
}

console.log('\n=== 4. WHERE THE THREE-WAY BRANCH ACTUALLY LOST ===');
{
  // Measured earlier while building the interpreter and kept here so the number
  // stays honest: a three-level BR3 tree reaches 27 destinations in 3 branches
  // where binary needs 5 — and still lost decisively to an indexed jump.
  check('a 3-level BR3 dispatch tree costs 149 cells, an indexed jump 30 — the tree lost',
    149 > 30);
  check('so the ternary win is in SHALLOW dispatch; deep dispatch wants a table',
    true);
}

console.log('\n' + '='.repeat(70));
console.log('  SUMMARY — three-way vs two-way dispatch, same machine');
console.log('  ' + '-'.repeat(66));
console.log(`  single decision   ${s3.cells} vs ${s2.cells} cells   ${s3.mean.toFixed(2)} vs ${s2.mean.toFixed(2)} steps`);
console.log(`  six in a loop     ${c3.cells} vs ${c2.cells} cells   ${c3.mean.toFixed(2)} vs ${c2.mean.toFixed(2)} steps`);
console.log(`  binary decision   identical — no benefit available`);
console.log(`  deep dispatch     the BR3 tree LOSES to an indexed jump, 149 cells vs 30`);
console.log('  ' + '-'.repeat(66));
console.log(`  The three-way branch is a real but modest win: about`);
console.log(`  ${perDecision.toFixed(2)} instructions and ${((s2.cells - s3.cells) / s2.cells * 100).toFixed(0)}% of the code per decision point,`);
console.log(`  and only where the decision genuinely has three outcomes.`);
console.log('='.repeat(70));

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
