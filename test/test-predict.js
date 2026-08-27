'use strict';
/* test-predict.js — can you learn what a program costs without paying for it?
 *
 * Set `AC`. A currency was proposed whose unit is one step of computation and whose
 * security rests on physics: you cannot perform unbounded steps per second, so a
 * large step count is evidence of large work. The receipt is IMPLIED — holding the
 * number is the proof, because the number could only have been obtained by paying.
 *
 * That argument is conditional on one thing, and this set measured it: **is the
 * cheapest way to learn a program's cost to run it?** Physics bounds what a machine
 * can DO; it says nothing about what anyone can CLAIM.
 *
 * Three of the four predictions failed, and together they answer the question in
 * two directions at once. `AC3` held structurally: a price computed from a
 * program's TEXT cannot track what running it costs — two programs of identical
 * shape differ by 183x. But `AC1` and `AC2` say the other half: five of the eight
 * programs cost a constant, and the one that varies is priced exactly by two runs.
 * So the cost is not in the shape, and is still cheap to obtain.
 *
 * The exhaustive version is `npm run audit:predict`.
 */

const T = require('../src/ternary.js');
const P = require('../tools/predict-audit.js');
const E = require('../tools/erasure-audit.js');
const P_ERASURE = E;
const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const PROGDIR = path.join(__dirname, '..', 'programs');
const src = f => fs.readFileSync(path.join(PROGDIR, f), 'utf8');
// The eight programs AC measured, pinned. `programs/` grew afterwards: set AD added
// hailstone.tasm precisely because it behaves unlike everything already there, and
// letting it in would silently rewrite AC1's counts, which are recorded in the
// manifest against a commit. A corpus that grows under a measurement written about
// it is the census-counting-itself shape, and the remedy is the same — an explicit
// exclusion carrying its reason, not a quiet recomputation.
const FILES = P_ERASURE.AB_CORPUS;
const PRESENT = fs.readdirSync(PROGDIR).filter(f => f.endsWith('.tasm')).sort();

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY FINDING ===');
{
  check('a program that is only HALT costs exactly one instruction',
    P.execute('        HALT\n').steps === 1);
  check('and adding one instruction costs exactly one more',
    P.execute('        LOADI 5\n        HALT\n').steps === 2);
  check('the counter responds to a loop: three turns cost more than one',
    P.execute(P.spin(3)).steps > P.execute(P.spin(1)).steps);
  check('and the harness can report a failure: a loop does NOT cost the same as no loop',
    P.execute(P.spin(3)).steps !== P.execute(P.spin(0)).steps);
  // The detector that lied. It is worth a check of its own, because the wrong
  // answer was more interesting than the right one.
  check('the input detector sees a LABELLED instruction — `body: IN` in threeway.tasm — ' +
    'which a line-anchored regex misses, and missing it invented a deterministic ' +
    'program that costs different amounts for data it never reads',
    /^\s*IN\s*(;.*)?$/m.test(src('threeway.tasm')) === false &&
    require('../src/assembler.js').tokenize(src('threeway.tasm')).some(l => l.mnemonic === 'IN'));
}

console.log('\n=== 0b. THE TOOL AS IT IS ACTUALLY RUN ===');
{
  // The antibody from T-TOOL-CHECKED-ONLY-BY-IMPORT, applied to the tool that
  // arrived after it. Importing this module sets its main-module flag false and no
  // print path executes, so every check above could pass while the program itself
  // crashed on every run. Three and a half seconds to rule that out.
  const { execFileSync } = require('child_process');
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'tools', 'predict-audit.js')], { encoding: 'utf8' });
  } catch (e) { code = 1; out = (e.stdout || '') + (e.message || ''); }
  check('the audit runs to completion as a program, not only as an import',
    code === 0, out.split('\n').slice(-3).join(' | '));
  check('and all four sections printed, so every log path executed',
    [/1\. AC1/, /2\. AC2/, /3\. AC3/, /4\. AC4/].every(r => r.test(out)));
}

console.log('\n=== 1. AC1 — FAILED: COST-INVARIANCE IS THE NORM ===');
{
  const stepsOf = f => P.INPUTS.map(inp => P.execute(src(f), inp).steps);
  const varies = f => new Set(stepsOf(f)).size > 1;
  const varying = FILES.filter(varies);
  const readsIn = f => require('../src/assembler.js').tokenize(src(f)).some(l => l.mnemonic === 'IN');

  check('all eight of the programs AC measured execute IN — not the five a broken regex reported',
    FILES.every(readsIn) && FILES.length === 8, `${FILES.filter(readsIn).length} of ${FILES.length}`);
  check('and the pinned corpus is a strict subset of what programs/ now holds, so a ' +
    'rename cannot rot it and a new program cannot silently join it',
    FILES.every(f => PRESENT.includes(f)) && PRESENT.length > FILES.length,
    `pinned ${FILES.length}, present ${PRESENT.length}`);
  check('hailstone.tasm is the one deliberately outside it, and it VARIES — which is ' +
    'why admitting it would have rewritten AC1 rather than confirmed it',
    !FILES.includes('hailstone.tasm') && PRESENT.includes('hailstone.tasm') &&
    varies('hailstone.tasm'));
  check('AC1 FAILED and stays failed: three programs vary, not the predicted two',
    varying.length === 3, varying.join(' '));
  check('and it named the wrong ones: fold does NOT vary, multiply and threeway do',
    !varies('fold.tasm') && varies('multiply.tasm') && varies('threeway.tasm'));
  check('FIVE of the eight read input and still cost a constant — the fact that ' +
    'matters most for a step count used as evidence of work',
    FILES.filter(f => readsIn(f) && !varies(f)).length === 5,
    FILES.filter(f => readsIn(f) && !varies(f)).join(' '));
  check('countdown spans the widest range, from 8 steps to over 1,800',
    (() => { const s = stepsOf('countdown.tasm'); return Math.min(...s) === 8 && Math.max(...s) > 1800; })());
  check('multiply varies only mildly — its loop is bounded by trit count, not operand size',
    (() => { const s = stepsOf('multiply.tasm'); return Math.max(...s) / Math.min(...s) < 1.1; })());
}

console.log('\n=== 2. AC2 — HELD: TWO RUNS PRICE TWO HUNDRED ===');
{
  const at = n => P.execute(src('countdown.tasm'), [n]).steps;
  const s1 = at(1), s2 = at(2);
  const a = (s2 - s1) / (2 - 1), b = s1 - a * 1;
  check('countdown is exactly affine in its input: steps = 5*N + 3',
    a === 5 && b === 3, `a=${a} b=${b}`);
  check('and the fit is EXACT across the sweep — zero error, not small error',
    (() => { for (let n = 1; n <= 120; n++) if (at(n) !== a * n + b) return false; return true; })());
  check('so a predictor costing two executions prices every input, which is the ' +
    'cheapest possible refutation of an implied receipt for this program',
    a * 120 + b === at(120));
  check('and the harness would notice a wrong model: 6*N + 3 does not fit',
    at(10) !== 6 * 10 + 3);
}

console.log('\n=== 3. AC3 — THE STRUCTURAL CLAIM HELD, THE NUMBER FAILED ===');
{
  const cheap = P.spin(1), dear = P.spin(T.TRYTE_MAX);
  const sc = P.staticShape(cheap), sd = P.staticShape(dear);
  const rc = P.execute(cheap).steps, rd = P.execute(dear).steps;
  const { tokenize } = require('../src/assembler.js');
  const tokHist = s => { const h = {}; for (const l of tokenize(s)) if (l.mnemonic) h[l.mnemonic] = (h[l.mnemonic] || 0) + 1; return h; };

  check('two programs differ in exactly one source line',
    cheap.split('\n').filter((l, i) => l !== dear.split('\n')[i]).length === 1);
  check('they have identical instruction counts', sc.count === sd.count);
  check('identical opcode histograms under a naive linear reader',
    P.histKey(sc.hist) === P.histKey(sd.hist));
  check('and identical histograms under the assembler\'s OWN tokenizer, so the claim ' +
    'does not rest on a parser that visibly desyncs on the jump table',
    P.histKey(tokHist(cheap)) === P.histKey(tokHist(dear)));
  check('yet they cost 4 steps and 730 — a factor of 182.5',
    rc === 4 && rd === 730 && Math.abs(rd / rc - 182.5) < 0.01, `${rc} vs ${rd}`);
  check('so any predictor reading only static shape is wrong on one of them by 183x — ' +
    'a counterexample, not a failed search',
    rd / rc > 100);
  check('AC3 FAILED and stays failed: the ratio is under the predicted 300x',
    rd / rc < 300, `${(rd / rc).toFixed(1)}x`);
  check('and the reason is the four-step floor sitting in the denominator: 730/4, not 364/1',
    rd / rc === 730 / 4 && 730 / 4 < 364);
}

console.log('\n=== 4. AC4 — FAILED: THE PROGRAMS ARE MORE ALIKE THAN PREDICTED ===');
{
  const rows = E.programRows.filter(r => r.steps > 0 && r.actual > 0)
    .map(r => ({ ...r, perStep: r.actual / r.steps }))
    .sort((x, y) => y.perStep - x.perStep);
  const spread = rows[0].perStep / rows[rows.length - 1].perStep;
  const mostSteps = rows.reduce((m, r) => (r.steps > m.steps ? r : m), rows[0]);

  check('every program is priced in both currencies', rows.length === 8);
  check('AC4 FAILED and stays failed: the spread is 1.68x, under the predicted 2x',
    spread < 2 && Math.abs(spread - 1.68) < 0.01, `${spread.toFixed(3)}x`);
  check('all eight fall between 3.6 and 6.1 bits per instruction — more alike in ' +
    'erasure intensity than in anything else measured about them',
    rows.every(r => r.perStep > 3.6 && r.perStep < 6.1));
  check('but the ordering clause HELD: the longest-running program is not the ' +
    'hungriest per step',
    mostSteps.file !== rows[0].file && mostSteps.file === 'interp-core.tasm' &&
    rows[0].file === 'fold.tasm');
  check('so steps and bits rank the same programs differently — a decision, not a ' +
    'units conversion, on a narrower margin than predicted',
    rows[0].file !== mostSteps.file);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
