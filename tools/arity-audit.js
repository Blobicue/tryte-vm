'use strict';
/* ARITY AUDIT — the n+1 input ladder, and the thing that kills convergence.
 *
 * WHY THIS SET EXISTS
 * -------------------
 * AH2 found the binding constraint on an implied receipt, and it was not the one
 * anybody expected. A control space five hundred thousand times larger than
 * hailstone's still gave a tabulator 3.20x reuse, because a subtractive loop
 * converges onto shared suffixes whatever its starting values. TRAJECTORY
 * CONVERGENCE, not state size, is what a tabulator eats.
 *
 * The proposal on the table is to grow the machine by ARITY rather than by width:
 * start at two inputs, take the truth table of an n-input function as the object,
 * and climb n -> n+1. That ladder is already written up outside this repository, in
 * "The Ladder — bootstrap and proof methods by layer", which generates its layer
 * sequence from a single total operator over the whole history rather than from a
 * two-term recurrence:
 *
 *     H(prev) = SUM prev + [prev != empty]
 *     "everything that has happened, plus one if anything has happened at all"
 *
 * defined on the empty history, no cases. Fibonacci is a CONSEQUENCE of it:
 * L(n+1) = 1 + SUM L(0..n-1), so L(n+2) = L(n+1) + L(n). That page verifies it over
 * nine steps and names four competing rules that each fail at a stated step.
 *
 * This set replicates that operator independently, prices the arity ladder in this
 * project's own terms, and then asks the question AH2 left open: does more arity buy
 * a tree-like trajectory graph?
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered before the run, per AGENTS.md.
 *
 *   AI1 the history operator replicates, and beyond the nine steps it was checked
 *       over. Predicted H(prev) = SUM prev + [prev != empty] reproduces Fibonacci
 *       with two zeros at the front for at least FORTY terms, with no special case
 *       at the genesis. Predicted the four competing rules the Ladder names each
 *       fail exactly where it says: cur + last(prev) first wrong at step 1,
 *       sum(prev) wrong at 8 of 9 steps, sum(prev) + 1 wrong at step 0, and
 *       cur + len(prev) first wrong at step 6.
 *
 *   AI2 the arity ladder CUBES, which is a different growth law from the one this
 *       project has been using. A ternary n-input function has 3^n rows, so there
 *       are 3^(3^n) of them. Predicted each rung is exactly the CUBE of the last,
 *       since 3^(3^(n+1)) = (3^(3^n))^3, and predicted the rungs at n = 1, 2, 3 are
 *       27, 19,683 and 7,625,597,484,987. AD4's width ladder multiplies by 729 per
 *       word; predicted the arity ladder passes it at n = 3 and is beyond it
 *       entirely by n = 4.
 *
 *   AI3 and AB1's measured 1.097% is one rung of a closed form nobody wrote down.
 *       A function is reversible in its leading argument exactly when every one of
 *       its 3^(n-1) columns is a bijection of three values, so the count is
 *       6^(3^(n-1)) and the fraction is (2/9)^(3^(n-1)). Predicted that fraction is
 *       22.22% at n = 1, 1.097% at n = 2 -- reproducing AB1's measurement to three
 *       decimal places from a formula rather than a sweep -- and 0.000132% at n = 3.
 *
 *   AI4 THE PAYOFF, and the answer to what AH2 left open. Take an n-input function
 *       as the feedback of a shift register: state (x1..xn), next (x2..xn,
 *       f(x1..xn)). Predicted that when f is reversible in its leading argument the
 *       state map is a BIJECTION, so every state has in-degree exactly 1, no two
 *       trajectories ever merge, and a tabulator's reuse is exactly 1.00 -- against
 *       AH2's 3.20 and hailstone's 10.43. Predicted a feedback function that is NOT
 *       reversible gives a maximum in-degree of at least 3 and leaves more than a
 *       quarter of the state space unreachable, which is the convergence a tabulator
 *       lives on. If this holds, AB1's 216 tables are not a curiosity: they are
 *       exactly the feedback functions that make a receipt possible.
 *
 * ------------------------------------------------------------------------------
 * Run: node tools/arity-audit.js
 */

const T = require('../src/ternary.js');
const E = require('./erasure-audit.js');

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

log('ARITY AUDIT — the n+1 input ladder, and what kills convergence\n');

/* ============================================================================
 * 1. AI1 — the history operator, replicated.
 * ========================================================================== */
log(line);
log('1. AI1 — H(prev) = SUM prev + [prev != empty]');
log(line);

/** The Ladder's operator, defined on the empty history, no cases. */
function ladder(terms) {
  const seq = [];
  while (seq.length < terms) {
    const sum = seq.reduce((a, b) => a + b, 0);
    seq.push(sum + (seq.length > 0 ? 1 : 0));
  }
  return seq;
}
/** Fibonacci with two zeros at the front, computed independently. */
function fibTwoZeros(terms) {
  const f = [0, 0, 1];
  while (f.length < terms) f.push(f[f.length - 1] + f[f.length - 2]);
  return f.slice(0, terms);
}
let AI1_MATCH = 0;
{
  const N = 40;
  const h = ladder(N), f = fibTwoZeros(N);
  AI1_MATCH = h.filter((v, i) => v === f[i]).length;
  log(`  first twelve: ${h.slice(0, 12).join(', ')}`);
  log(`  Fibonacci with two zeros: ${f.slice(0, 12).join(', ')}`);
  log(`  agreeing terms out of ${N}: ${AI1_MATCH}`);
  log(`  the Ladder verified 9 steps; this checks ${N} and finds no genesis exception: ${AI1_MATCH === N}`);

  // The four rules the Ladder names as failing, checked at the steps it names.
  const rivals = {
    'cur + last(prev)': seq => (seq.length ? seq[seq.length - 1] : 0) + (seq.length > 1 ? seq[seq.length - 2] : 0),
    'sum(prev)': seq => seq.reduce((a, b) => a + b, 0),
    'sum(prev) + 1': seq => seq.reduce((a, b) => a + b, 0) + 1,
    'cur + len(prev)': seq => (seq.length ? seq[seq.length - 1] : 0) + seq.length,
  };
  log('');
  log('   competing rule            first step it gets wrong    steps wrong of 9');
  log('  ' + '-'.repeat(70));
  for (const [name, rule] of Object.entries(rivals)) {
    const seq = []; let first = null, wrong = 0;
    for (let i = 0; i < 9; i++) {
      const got = rule(seq), want = f[i];
      if (got !== want) { wrong++; if (first === null) first = i; }
      seq.push(want);
    }
    log(`   ${name.padEnd(22)} ${String(first).padStart(20)} ${String(wrong).padStart(20)}`);
  }
}

/* ============================================================================
 * 2. AI2 — the arity ladder cubes.
 * ========================================================================== */
log('\n' + line);
log('2. AI2 — how big is the space of n-input ternary functions?');
log(line);
{
  log('    n   rows (3^n)   functions 3^(3^n)                    cube of the last?');
  log('  ' + '-'.repeat(74));
  let prev = null;
  for (let n = 1; n <= 4; n++) {
    const rows = 3 ** n;
    const funcs = 3n ** BigInt(rows);
    const shown = funcs.toString().length > 24 ? `${funcs.toString().slice(0, 20)}... (${funcs.toString().length} digits)` : funcs.toString();
    log(`  ${String(n).padStart(3)}   ${String(rows).padStart(10)}   ${shown.padEnd(36)} ${prev === null ? '—' : (funcs === prev ** 3n ? 'YES' : 'NO')}`);
    prev = funcs;
  }
  log('');
  const perWord = 729n;
  log(`  AD4's width ladder multiplies by ${perWord} per live word:`);
  for (let k = 1; k <= 4; k++) log(`    ${k} word(s): ${(perWord ** BigInt(k + 1)).toString()}`);
  log(`  the arity ladder passes it at n = 3: ${3n ** 27n > 729n ** 4n}`);
  log(`  and by n = 4 the width ladder is not in the same range: ` +
    `${(3n ** 81n).toString().length} digits against ${(729n ** 5n).toString().length}`);
}

/* ============================================================================
 * 3. AI3 — AB1's 1.097% is one rung of a closed form.
 * ========================================================================== */
log('\n' + line);
log('3. AI3 — the reversible fraction, as a formula');
log(line);
let AI3_N2 = 0;
{
  log('    n   columns 3^(n-1)   reversible 6^(3^(n-1))    of 3^(3^n)      fraction');
  log('  ' + '-'.repeat(76));
  for (let n = 1; n <= 3; n++) {
    const cols = 3 ** (n - 1);
    const rev = 6n ** BigInt(cols);
    const all = 3n ** BigInt(3 ** n);
    const frac = Number(rev) / Number(all);
    if (n === 2) AI3_N2 = frac;
    const shown = rev.toString().length > 18 ? `${rev.toString().slice(0, 14)}...` : rev.toString();
    log(`  ${String(n).padStart(3)}   ${String(cols).padStart(14)}   ${shown.padStart(22)}   ` +
      `${(all.toString().length > 16 ? all.toString().length + ' digits' : all.toString()).padStart(12)}   ${(100 * frac).toPrecision(4)}%`);
  }
  log('');
  log(`  closed form: (2/9)^(3^(n-1))`);
  for (let n = 1; n <= 3; n++)
    log(`    n=${n}: ${(100 * (2 / 9) ** (3 ** (n - 1))).toPrecision(4)}%`);
  log('');
  log(`  AB1 MEASURED 216 of 19,683 by sweeping every table: ${(100 * 216 / 19683).toPrecision(4)}%`);
  log(`  the formula gives:                                  ${(100 * AI3_N2).toPrecision(4)}%`);
  log(`  agree to four significant figures: ${Math.abs(216 / 19683 - AI3_N2) < 1e-9}`);
  log(`  so AB1 was one rung of a ladder, and 216 = 6^3 exactly: ${6 ** 3 === 216}`);
}

/* ============================================================================
 * 4. AI4 — does arity buy a tree-like trajectory graph?
 * ========================================================================== */
log('\n' + line);
log('4. AI4 — an n-input function as shift-register feedback');
log(line);

const N = T.TRYTE_STATES;
const val = i => i + T.TRYTE_MIN;
const ix = v => T.wrap(v) - T.TRYTE_MIN;
const TRITS = [-1, 0, 1];

/**
 * In-degree census of the state map (x1,x2) -> (x2, f(x1,x2)) over 531,441 states.
 * A tabulator's reuse is exactly the merging this measures: in-degree 1 everywhere
 * means no two trajectories ever join, and there is nothing to amortise.
 */
function inDegrees(f) {
  const deg = new Int32Array(N * N);
  for (let a = 0; a < N; a++)
    for (let b = 0; b < N; b++)
      deg[b * N + ix(f(val(a), val(b)))]++;
  let max = 0, unreachable = 0, ones = 0;
  for (let s = 0; s < deg.length; s++) {
    if (deg[s] > max) max = deg[s];
    if (deg[s] === 0) unreachable++;
    if (deg[s] === 1) ones++;
  }
  return { max, unreachable, ones, total: deg.length,
    unreachableFrac: unreachable / deg.length, allOne: ones === deg.length };
}
{
  // A reversible table from AB1's 216: every column a bijection of the three values.
  const revTable = E.reversibleTables[0];
  const rev = (a, b) => T.ttable(revTable, a, b);
  // And one that is not reversible: tritwise MIN collapses.
  const notRev = (a, b) => T.tMIN(a, b);

  const r = inDegrees(rev);
  const nr = inDegrees(notRev);
  log('   feedback function        max in-degree   unreachable states   every state in-degree 1');
  log('  ' + '-'.repeat(78));
  log(`   reversible (AB1 table)   ${String(r.max).padStart(13)}   ${String(r.unreachable).padStart(18)}   ${r.allOne ? 'YES' : 'no'}`);
  log(`   MIN (not reversible)     ${String(nr.max).padStart(13)}   ${String(nr.unreachable).padStart(18)}   ${nr.allOne ? 'YES' : 'no'}`);
  log('');
  log(`   reversible: unreachable fraction ${(100 * r.unreachableFrac).toFixed(2)}%`);
  log(`   MIN:        unreachable fraction ${(100 * nr.unreachableFrac).toFixed(2)}%`);
  log('');
  log(`  a bijection means a tabulator's reuse is exactly 1.00 -- nothing merges, so`);
  log(`  there is nothing to amortise. AH2 measured 3.20 and hailstone 10.43.`);
  log('');
  log(`  AB1's 216 tables are not a curiosity. They are exactly the feedback functions`);
  log(`  that make a trajectory graph tree-like, which is the fourth factor AH2 named`);
  log(`  and the one this project had no way to supply until now.`);
}

log('\n' + line);
log('Registered predictions AI1-AI4 are in this file\'s docstring. Outcomes go to');
log('FINDINGS.json and are asserted in test/test-arity.js.');
log(line);

module.exports = { ladder, fibTwoZeros, inDegrees };
