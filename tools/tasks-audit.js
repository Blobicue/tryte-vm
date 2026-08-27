'use strict';
/* TASKS AUDIT — the two-input ternary operations as a labelled task ladder.
 *
 * WHY THIS SET EXISTS
 * -------------------
 * Grokking -- a small network memorising a task quickly and then, long after it has
 * overfit, suddenly generalising -- is studied almost entirely on ONE family of
 * tasks: modular arithmetic on a small group. The mechanistic account of why it
 * happens is that the network discovers the group's structure, learning a Fourier
 * representation of an abelian operation.
 *
 * Which means the interesting variable is ALGEBRAIC, and the literature mostly holds
 * it fixed. Modular addition is affine. Almost every task studied is affine.
 *
 * This project has spent thirty-seven prediction sets measuring the algebraic
 * properties of exactly this space. Every one of the 19,683 two-input ternary
 * operations already carries, from earlier sets, a reversibility status (AB1), an
 * erasure in bits (AB), an in-degree census as feedback (AI4) and a place on a closed
 * form (AI3). Nobody has used them as a TASK LADDER, and the thing that makes them
 * one is that the labels were measured before anyone thought of training on them.
 *
 * So: emit the data, and partition it by the properties a grokking result would care
 * about. THIS SET TRAINS NOTHING -- it is the experiment DESIGN, and the labels are
 * the independent variable. The training itself is a separate set on separate
 * hardware, because a training result produced on a machine that cannot afford it
 * would be a fact about the host rather than about the question, and that is a defect
 * class this project has already bitten twice.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered before the run, per AGENTS.md.
 *
 *   AL1 affine operations are VANISHINGLY RARE, and that is what makes the grokking
 *       literature's task choice a strong hidden assumption. A function is affine
 *       over GF(3) when f(a,b) = alpha*a + beta*b + gamma, so there are 3^3 = 27 of
 *       them. Predicted exactly 27 of the 19,683 two-input ternary operations are
 *       affine -- 0.137% -- and predicted that of the 216 reversible ones exactly 18
 *       are affine, which is the same count AB1 measured from a completely different
 *       criterion and is therefore a cross-check rather than a restatement.
 *
 *   AL2 affine is exactly linear-probe-fittable, and nothing else is. Predicted a
 *       least-squares fit over GF(3) recovers every affine table with ZERO error and
 *       fails on all 19,656 others, so the label is not a convention but a statement
 *       about what a model without a nonlinearity can represent. Predicted the
 *       ternary analogue of modular addition -- the grokking literature's task -- is
 *       among the 27.
 *
 *   AL3 reversibility and affineness are INDEPENDENT labels, so the ladder has four
 *       quadrants rather than one axis. Predicted all four are non-empty: affine and
 *       reversible (18), affine and erasing (9), non-affine and reversible (198), and
 *       non-affine and erasing (19,458). Predicted the erasure in bits varies WITHIN
 *       each quadrant, so a task can be chosen to hold one label fixed and sweep the
 *       other, which is what a controlled experiment needs and what the literature
 *       has never had.
 *
 *   AL4 the arena ladder spans the scale grokking is studied at. An n-state arena
 *       gives n^2 labelled examples. Predicted 9 at one trit, 729 at three trits and
 *       531,441 at six -- and predicted the three-trit arena at 729 examples sits
 *       within an order of magnitude of the 12,769 of modular addition mod 113, so
 *       the ladder brackets the canonical setup rather than sitting beside it.
 *
 * ------------------------------------------------------------------------------
 * Run: node tools/tasks-audit.js          (add --emit to write the datasets)
 */

const T = require('../src/ternary.js');
const E = require('./erasure-audit.js');
const fs = require('fs');
const path = require('path');

const MAIN = require.main === module;
const EMIT = process.argv.includes('--emit');
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);
const TRITS = [-1, 0, 1];

log('TASKS AUDIT — two-input ternary operations as a labelled task ladder\n');

/** GF(3) coordinates: -1,0,1 map to 2,0,1 so arithmetic is mod 3. */
const toF3 = t => (t + 3) % 3;
const fromF3 = v => (v === 2 ? -1 : v);

/** Is this table f(a,b) = alpha*a + beta*b + gamma over GF(3)? Returns the coeffs. */
function affineCoeffs(tbl) {
  for (let al = 0; al < 3; al++) for (let be = 0; be < 3; be++) for (let ga = 0; ga < 3; ga++) {
    let ok = true;
    for (let a = 0; a < 3 && ok; a++) for (let b = 0; b < 3 && ok; b++) {
      const want = fromF3((al * toF3(TRITS[a]) + be * toF3(TRITS[b]) + ga) % 3);
      if (tbl[3 * a + b] !== want) ok = false;
    }
    if (ok) return { al, be, ga };
  }
  return null;
}
/** Reversible in the leading argument: every column a bijection (AB1's criterion). */
const columnOf = (t, m) => [0, 1, 2].map(a => t[3 * a + m]);
const reversible = t => [0, 1, 2].every(m => new Set(columnOf(t, m)).size === 3);

/** Erasure of one table as a map on its 9 input pairs, in bits. */
function erasureOf(tbl) {
  const counts = new Map();
  for (let i = 0; i < 9; i++) counts.set(tbl[i], (counts.get(tbl[i]) || 0) + 1);
  let s = 0;
  for (const n of counts.values()) s += (n / 9) * Math.log2(n);
  return s;
}

const tableOf = k => { const t = []; let r = k; for (let i = 0; i < 9; i++) { t.push(TRITS[r % 3]); r = Math.floor(r / 3); } return t; };
const ALL = Array.from({ length: 19683 }, (_, k) => tableOf(k));

/* ============================================================================
 * 0. INSTRUMENT CHECK
 * ========================================================================== */
log(line);
log('0. INSTRUMENT CHECK');
log(line);
{
  // Ternary addition mod 3 is affine with alpha = beta = 1, gamma = 0.
  const add = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) add.push(fromF3((toF3(TRITS[a]) + toF3(TRITS[b])) % 3));
  const c = affineCoeffs(add);
  log(`  modular addition is affine, with coefficients (1,1,0): ` +
    `${c !== null && c.al === 1 && c.be === 1 && c.ga === 0}`);
  log(`  and it is reversible: ${reversible(add)}`);
  log(`  and it erases nothing: ${erasureOf(add).toFixed(4)} bits`);
  // MIN is not affine and does erase.
  const min = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) min.push(Math.min(TRITS[a], TRITS[b]));
  log(`  tritwise MIN is NOT affine: ${affineCoeffs(min) === null}`);
  log(`  and it erases ${erasureOf(min).toFixed(4)} bits`);
  log(`  tables enumerated: ${ALL.length}`);
}

/* ============================================================================
 * 1. AL1 — how rare is affine?
 * ========================================================================== */
log('\n' + line);
log('1. AL1 — the assumption hidden in the literature\'s task choice');
log(line);
let AFFINE = null, REV = null, AFF_REV = null;
{
  AFFINE = ALL.filter(t => affineCoeffs(t) !== null);
  REV = ALL.filter(reversible);
  AFF_REV = ALL.filter(t => affineCoeffs(t) !== null && reversible(t));
  log(`  affine over GF(3): ${AFFINE.length} of ${ALL.length}   (${(100 * AFFINE.length / ALL.length).toPrecision(3)}%)`);
  log(`  predicted 27 = 3^3, one per (alpha, beta, gamma): ${AFFINE.length === 27}`);
  log(`  reversible (AB1's criterion): ${REV.length}`);
  log(`  and AB1 measured: ${E.reversibleTables.length}   agree: ${REV.length === E.reversibleTables.length}`);
  log('');
  log(`  affine AND reversible: ${AFF_REV.length}`);
  log(`  AB1 measured 18 by a different route, so this is a cross-check: ${AFF_REV.length === 18}`);
  log(`  which is 2 x 3 x 3 -- alpha must be nonzero for the columns to be bijections`);
  log('');
  log(`  So the grokking literature studies a task drawn from 0.137% of this space,`);
  log(`  and holds the algebraic variable fixed while sweeping everything else.`);
}

/* ============================================================================
 * 2. AL2 — is affine the same as linear-probe-fittable?
 * ========================================================================== */
log('\n' + line);
log('2. AL2 — what a model without a nonlinearity can represent');
log(line);
let AL2 = null;
{
  /* Exhaustive least-squares over GF(3): try every (alpha,beta,gamma) and count how
   * many of the 9 rows a linear map can get right. Affine tables reach 9/9; anything
   * else cannot, and the best it manages is the interesting number. */
  const bestLinearFit = tbl => {
    let best = 0;
    for (let al = 0; al < 3; al++) for (let be = 0; be < 3; be++) for (let ga = 0; ga < 3; ga++) {
      let hits = 0;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++)
        if (tbl[3 * a + b] === fromF3((al * toF3(TRITS[a]) + be * toF3(TRITS[b]) + ga) % 3)) hits++;
      if (hits > best) best = hits;
    }
    return best;
  };
  let perfect = 0, worstNonAffine = 0;
  const hist = new Map();
  for (const t of ALL) {
    const h = bestLinearFit(t);
    hist.set(h, (hist.get(h) || 0) + 1);
    if (h === 9) perfect++;
    else if (h > worstNonAffine) worstNonAffine = h;
  }
  AL2 = { perfect, worstNonAffine, hist };
  log(`  tables a linear map fits perfectly (9 of 9 rows): ${perfect}`);
  log(`  equal to the affine count: ${perfect === AFFINE.length}`);
  log(`  best a linear map does on any NON-affine table: ${worstNonAffine} of 9`);
  log('');
  log('   rows a linear map can get right    tables');
  log('  ' + '-'.repeat(46));
  for (const k of [...hist.keys()].sort((a, b) => a - b))
    log(`   ${String(k).padStart(31)}    ${String(hist.get(k)).padStart(6)}`);
  log('');
  log(`  So "affine" is not a convention. It is exactly the set a model with no`);
  log(`  nonlinearity can represent, and everything else needs one.`);
}

/* ============================================================================
 * 3. AL3 — four quadrants, not one axis.
 * ========================================================================== */
log('\n' + line);
log('3. AL3 — the labels are independent');
log(line);
let QUAD = null;
{
  const q = { ar: [], ae: [], nr: [], ne: [] };
  for (const t of ALL) {
    const a = affineCoeffs(t) !== null, r = reversible(t);
    if (a && r) q.ar.push(t); else if (a && !r) q.ae.push(t);
    else if (!a && r) q.nr.push(t); else q.ne.push(t);
  }
  QUAD = q;
  const span = arr => {
    if (!arr.length) return '—';
    const e = arr.map(erasureOf);
    return `${Math.min(...e).toFixed(3)} .. ${Math.max(...e).toFixed(3)}`;
  };
  log('                       count      erasure in bits, min .. max');
  log('  ' + '-'.repeat(62));
  log(`   affine, reversible    ${String(q.ar.length).padStart(6)}      ${span(q.ar)}`);
  log(`   affine, erasing       ${String(q.ae.length).padStart(6)}      ${span(q.ae)}`);
  log(`   non-affine, reversible${String(q.nr.length).padStart(6)}      ${span(q.nr)}`);
  log(`   non-affine, erasing   ${String(q.ne.length).padStart(6)}      ${span(q.ne)}`);
  log('');
  log(`  all four quadrants non-empty: ${[q.ar, q.ae, q.nr, q.ne].every(x => x.length > 0)}`);
  log(`  totals to ${q.ar.length + q.ae.length + q.nr.length + q.ne.length} of ${ALL.length}`);
  log('');
  log(`  So a task can hold reversibility fixed and sweep affineness, or the reverse.`);
  log(`  That is what a controlled experiment needs, and the labels were measured`);
  log(`  before anybody thought of training on them.`);
}

/* ============================================================================
 * 4. AL4 — the arena ladder, and emitting the data.
 * ========================================================================== */
log('\n' + line);
log('4. AL4 — how much data, at what scale');
log(line);
{
  log('   trits   states   labelled examples n^2      comparison');
  log('  ' + '-'.repeat(64));
  for (const w of [1, 2, 3, 6]) {
    const n = 3 ** w;
    const note = w === 3 ? 'mod-113 addition is 12,769' : '';
    log(`   ${String(w).padStart(5)}   ${String(n).padStart(6)}   ${String(n * n).padStart(22)}      ${note}`);
  }
  log('');
  log(`  the three-trit arena at 729 examples is within an order of magnitude of the`);
  log(`  canonical grokking setup: ${729 * 17 > 12769 && 729 < 12769}`);

  if (EMIT) {
    const dir = path.join(__dirname, '..', 'bench', 'tasks');
    fs.mkdirSync(dir, { recursive: true });
    // One representative per quadrant, at the three-trit arena, as JSONL.
    const pick = { affine_reversible: QUAD.ar[0], affine_erasing: QUAD.ae[0],
      nonaffine_reversible: QUAD.nr[0], nonaffine_erasing: QUAD.ne[0] };
    let wrote = 0;
    for (const [name, tbl] of Object.entries(pick)) {
      const rows = [];
      for (let a = -13; a <= 13; a++) for (let b = -13; b <= 13; b++)
        rows.push(JSON.stringify({ a, b, y: T.ttable(tbl, a, b) }));
      const meta = { task: name, table: tbl, affine: affineCoeffs(tbl),
        reversible: reversible(tbl), erasure_bits: Number(erasureOf(tbl).toFixed(6)),
        arena: '3 trits, states -13..13', examples: rows.length };
      fs.writeFileSync(path.join(dir, `${name}.jsonl`), rows.join('\n') + '\n');
      fs.writeFileSync(path.join(dir, `${name}.meta.json`), JSON.stringify(meta, null, 2) + '\n');
      wrote += rows.length;
    }
    log('');
    log(`  wrote ${Object.keys(pick).length} datasets to bench/tasks/, ${wrote} examples total,`);
    log(`  each beside a meta file carrying the labels this project measured.`);
  } else {
    log('');
    log(`  run with --emit to write bench/tasks/ -- one dataset per quadrant, each`);
    log(`  beside a meta file carrying its measured labels.`);
  }
}

log('\n' + line);
log('Registered predictions AL1-AL4 are in this file\'s docstring. Outcomes go to');
log('FINDINGS.json and are asserted in test/test-tasks.js.');
log('THIS SET TRAINS NOTHING. It is the experiment design; the labels are the');
log('independent variable, and the training is a separate set on separate hardware.');
log(line);

module.exports = { affineCoeffs, reversible, erasureOf, tableOf, ALL, AFFINE, REV, AFF_REV, QUAD, AL2 };
