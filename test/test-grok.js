'use strict';
/* test-grok.js — does the algebra of a task predict when a network generalises?
 *
 * Sets `AL` and `AM`. `AL` labelled all 19,683 two-input ternary operations by
 * properties this project had already measured; `AM` trained on one table from each
 * quadrant with everything but the algebra held fixed.
 *
 * The check worth keeping is `AM2`, which **inverted**. Ternary modular addition —
 * the affine task, and what the grokking literature studies almost exclusively — is
 * the **slower** of the two reversible tasks on every paired seed, median 10,800
 * steps against 6,200, and on one seed it never generalised at all inside 40,000
 * steps while the non-affine task succeeded on all five.
 *
 * These are recorded results from a run on separate hardware (an NVIDIA GB10). This
 * suite re-derives the labels from the tables and asserts the recorded figures; it
 * does not retrain, because retraining here would measure the host.
 *
 * The exhaustive versions are `npm run audit:tasks` and `bench/grok.py`.
 */

const A = require('../tools/tasks-audit.js');
const E = require('../tools/erasure-audit.js');
const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const RES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bench', 'grok-results.json'), 'utf8'));
const SEEDS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bench', 'grok-seeds.json'), 'utf8'));
const R = RES.results;

console.log('\n=== 0. THE TASK LABELS, RE-DERIVED FROM THE TABLES ===');
{
  // The tables trained on are recorded in the results. Re-derive their labels here
  // rather than trusting the filenames, because a mislabelled task would invert the
  // whole finding and nothing else would notice.
  const want = {
    affine_reversible: [true, true], affine_erasing: [true, false],
    nonaffine_reversible: [false, true], nonaffine_erasing: [false, false],
  };
  for (const [name, [wantAff, wantRev]] of Object.entries(want)) {
    const t = R[name].table;
    check(`${name} really is ${wantAff ? '' : 'non-'}affine and ${wantRev ? '' : 'ir'}reversible`,
      (A.affineCoeffs(t) !== null) === wantAff && A.reversible(t) === wantRev);
  }
  check('the run happened on a GPU, not silently on CPU', RES.device === 'cuda');
  check('and the four tasks are the four quadrants, none repeated',
    new Set(Object.values(R).map(v => v.table.join())).size === 4);
}

console.log('\n=== 1. AL1, AL2, AL3, AL4 — THE LADDER THE EXPERIMENT NEEDED ===');
{
  check('AL1: exactly 27 of 19,683 two-input ternary operations are affine over GF(3)',
    A.AFFINE.length === 27, `${A.AFFINE.length}`);
  check('AL2: which is 0.137% — the fraction the literature has been sampling from',
    Math.abs(100 * 27 / 19683 - 0.137) < 0.001);
  check('AL1: 216 are reversible, reproducing AB1 from an independent criterion',
    A.REV.length === 216 && A.REV.length === E.reversibleTables.length);
  check('and 18 are both, which is 2 x 3 x 3 because alpha must be nonzero',
    A.AFF_REV.length === 18);
  check('AL2 and AL3: the four quadrants are 18, 9, 198 and 19,458, totalling 19,683',
    A.QUAD.ar.length === 18 && A.QUAD.ae.length === 9 &&
    A.QUAD.nr.length === 198 && A.QUAD.ne.length === 19458);
  check('AL3 FAILED and stays failed: erasure does NOT vary within the reversible ' +
    'quadrants — both are pinned at log2(3) because every column is a bijection',
    A.QUAD.ar.every(t => Math.abs(A.erasureOf(t) - Math.log2(3)) < 1e-9) &&
    A.QUAD.nr.every(t => Math.abs(A.erasureOf(t) - Math.log2(3)) < 1e-9));
  check('AL4 FAILED and stays failed: 729 against mod-113\'s 12,769 is 17.5x, not ' +
    'within an order of magnitude', 12769 / 729 > 10);
}

console.log('\n=== 2. AM1 — GROKKING REPRODUCES OFF MODULAR ARITHMETIC ===');
{
  check('both reversible tasks memorise by step 200',
    R.affine_reversible.first_train_100 === 200 && R.nonaffine_reversible.first_train_100 === 200);
  check('and generalise thousands of steps later — 7,200 and 3,800',
    R.affine_reversible.first_test_90 === 7200 && R.nonaffine_reversible.first_test_90 === 3800);
  check('gaps of 36x and 19x, against a predicted 5x',
    R.affine_reversible.gap_ratio === 36 && R.nonaffine_reversible.gap_ratio === 19);
  check('on a 729-pair arena with 40% held for training',
    R.affine_reversible.train_examples === 291 && R.affine_reversible.test_examples === 438,
    `${R.affine_reversible.train_examples}/${R.affine_reversible.test_examples}`);
  check('so the phenomenon is not a fact about modular arithmetic', R.affine_reversible.gap_ratio > 5);
}

console.log('\n=== 3. AM2 — FAILED, AND INVERTED ===');
{
  const a = SEEDS.affine_reversible.map(x => x.test90);
  const n = SEEDS.nonaffine_reversible.map(x => x.test90);
  const paired = a.map((v, i) => [v, n[i]]).filter(([x, y]) => x !== null && y !== null);
  const med = v => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)];

  check('five seeds each, identical architecture, optimiser, split and budget',
    a.length === 5 && n.length === 5);
  check('AM2 FAILED and stays failed: the AFFINE task is slower on every paired seed',
    paired.every(([x, y]) => y < x) && paired.length === 4);
  check('median 10,800 steps against 6,200',
    med(a.filter(x => x !== null)) === 10800 && med(n) === 6200);
  check('and on one seed the affine task never reached 90% inside 40,000 steps',
    a.filter(x => x === null).length === 1);
  check('while the non-affine task generalised on all five',
    n.filter(x => x === null).length === 0);
  check('so the canonical grokking task is the HARDER one, and the algebraic label ' +
    'predicts the opposite of what was registered',
    med(a.filter(x => x !== null)) > med(n));
  check('run once this would be a draw; run five times it is a direction',
    paired.length === 4 && paired.every(([x, y]) => y < x));
}

console.log('\n=== 4. AM3 FAILED, AM4 HELD ===');
{
  check('AM3 FAILED and stays failed: the affine-erasing baseline is 0.0457, not above 0.40',
    Math.abs(R.affine_erasing.majority_baseline - 0.0457) < 0.001 &&
    R.affine_erasing.majority_baseline < 0.40);
  check('because f = b is a BIJECTION in its second argument, so the outputs are uniform',
    R.affine_erasing.majority_baseline === R.affine_reversible.majority_baseline);
  check('only MIN is genuinely skewed, at 0.1918 — and still short of 40%',
    Math.abs(R.nonaffine_erasing.majority_baseline - 0.1918) < 0.001);
  check('AM4 HELD: the degenerate quadrant reaches 90% at step 200 against 7,200',
    R.affine_erasing.first_test_90 === 200 && 200 / 7200 < 0.1);
  check('with no memorisation-to-generalisation gap at all', R.affine_erasing.gap_ratio === 1);
  check('and it is degenerate BY PROOF — all nine tables in that quadrant ignore ' +
    'their first input, because affine plus erasing forces alpha = 0',
    A.QUAD.ae.length === 9 &&
    A.QUAD.ae.every(t => [0, 1, 2].every(b => new Set([0, 1, 2].map(a => t[3 * a + b])).size === 1)));
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
