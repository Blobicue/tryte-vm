'use strict';
/* test-insert.js — REGISTRATION ONLY. Set `AT`, four predictions, none measured yet.
 *
 * Every check in this file is an INSTRUMENT check and not one of them is a verdict.
 * The subject's census has not been run: nothing here touches `STEP`'s no-op table,
 * `val(u*)`, its order, or any statistic `AT1` through `AT4` are scored on. What it
 * does exercise, end to end, is the whole pipeline — the no-op table, the shortest-run
 * BFS, the two-insertion sweep, the deletion sweep, the rearrangement sweep, the
 * rebuild-and-recompute path — on a CONTROL chain built from a fresh random
 * permutation with exactly one fixed point, which has the same no-op structure the
 * subject has and none of its algebra.
 *
 * The controls are also asserted to MOVE here rather than after the run, because
 * `T-CONTROL-CANNOT-DISCRIMINATE` has bitten twice and the second bite was a control
 * that could only ever agree.
 *
 * `test/run-all.js` does NOT list this file yet, on purpose: a scaffolded test that
 * passes before the measurement reports success for work nobody did.
 */

const A = require('../tools/insert-audit.js');
const LED = require('../tools/ledger-audit.js');
const F = require('../tools/forge-audit.js');
const Q = require('../tools/puzzle-audit.js');
const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

console.log('\n=== 0. THE INDEX/VALUE BOUNDARY, WHICH HAS PRODUCED TWO FALSE VERDICTS ===');
{
  check('gen() is the amount an entry of that index adds to the arithmetic total',
    (() => {
      for (let x = 0; x < A.N; x++) {
        const t = F.asum(A.ZERO, x);
        if ((A.ZERO + A.gen(x)) % A.N !== t) return false;
        if (A.gen(x) !== ((Q.val(x) % A.N) + A.N) % A.N) return false;
      }
      return true;
    })());
  check('negEntry(x) is the entry whose generator is the negation of x\'s',
    (() => {
      for (let x = 0; x < A.N; x++) {
        if ((A.gen(x) + A.gen(A.negEntry(x))) % A.N !== 0) return false;
        if (A.negEntry(A.negEntry(x)) !== x) return false;
      }
      return true;
    })());
  check('   and the only self-negating entry is the arithmetic zero',
    [...Array(A.N).keys()].filter(x => A.negEntry(x) === x).join() === String(A.ZERO));
  check('orderIn729 agrees with the definition on all 729 elements, and its census is '
    + 'the exact 486/162/54/18/6/2/1',
    (() => {
      const tally = new Map();
      for (let v = 0; v < A.N; v++) {
        const o = A.orderIn729(v);
        if ((v * o) % A.N !== 0) return false;
        for (let k = 1; k < o; k++) if ((v * k) % A.N === 0) return false;
        tally.set(o, (tally.get(o) || 0) + 1);
      }
      return [[1, 1], [3, 2], [9, 6], [27, 18], [81, 54], [243, 162], [729, 486]]
        .every(([o, n]) => tally.get(o) === n);
    })());
  check('the two heads in index space are ledger-audit\'s two heads in value space',
    A.headOf(LED.LEDGER.map(v => Q.idx(LED.wrap(v)))) === Q.idx(LED.headHash(LED.LEDGER))
    && A.totalOf(LED.LEDGER.map(v => Q.idx(LED.wrap(v)))) === Q.idx(LED.headSum(LED.LEDGER)));
  check('   and chain() agrees with forge-audit\'s accums() on the same ledger, so this '
    + 'file does not reimplement the chain',
    A.chain(LED.LEDGER.map(v => Q.idx(LED.wrap(v)))).join()
    === F.accums(LED.LEDGER.map(v => Q.idx(LED.wrap(v)))).join());
}

console.log('\n=== 1. THE BFS SPANS ITS RANGE BEFORE ANY VERDICT IS READ ===');
{
  // T-CONTROL-CANNOT-DISCRIMINATE. A minimum that could only ever return one value
  // would make AT1 and AT2 unfalsifiable, so the statistic is shown to reach 1, 2, 3,
  // 243 and 729 on hand-computable generator sets first.
  const b = A.bfsControls();
  check('BFS controls: {0} -> 1, {1,-1} -> 2, {243} -> 3, {3} -> 243, {1} -> 729, {2} -> 729',
    b.zero === 1 && b.plusMinus === 2 && b.third === 3 && b.ninth === 243
    && b.one === 729 && b.two === 729, JSON.stringify(b));
  check('   so the statistic spans 1 to 729 and AT1\'s line at 12 is inside its range',
    b.zero === 1 && b.one === A.N);
  check('the BFS agrees with direct multiset enumeration on 300 random generator sets',
    (() => {
      const r = F.rng(99);
      for (let n = 0; n < 300; n++) {
        const gens = Array.from({ length: 7 }, () => F.randInt(r, A.N));
        const bfs = A.minInsertions(gens).min;
        const brute = A.minInsertionsBrute(gens, 4);
        if (brute === null ? !(bfs > 4) : brute !== bfs) return false;
      }
      return true;
    })());
  check('   and its witness multiset really sums to zero and really has that size',
    (() => {
      const r = F.rng(101);
      for (let n = 0; n < 300; n++) {
        const gens = Array.from({ length: 7 }, () => F.randInt(r, A.N));
        const m = A.minInsertions(gens);
        let s = 0, used = 0;
        for (let i = 0; i < gens.length; i++) { s += m.multiset[i] * gens[i]; used += m.multiset[i]; }
        if (used !== m.min || s % A.N !== 0 || used === 0) return false;
      }
      return true;
    })());
  check('I3 — a single generator alone always closes, in exactly ord(g) steps',
    [1, 2, 3, 5, 9, 27, 81, 243, 364, 500, 728]
      .every(g => A.minInsertions([g]).min === A.orderIn729(g)));
}

console.log('\n=== 2. THE CONTROL CHAIN, WHICH IS THE WHOLE PIPELINE ON A RANDOM PERMUTATION ===');
const C = A.controlChain();
{
  check('a random permutation with exactly one fixed point was found, and the number of '
    + 'draws is on the record rather than hidden',
    C.draws >= 1 && C.draws <= 200, `${C.draws} draw(s)`);
  check('   its permutation really is a permutation of all 729 states',
    new Set(C.perm).size === A.N);
  check('   and really has exactly one fixed point',
    [...Array(A.N).keys()].filter(u => C.perm[u] === u).length === 1);
  check('I1 — every accumulator of the control chain has exactly one no-op entry',
    C.noOp.everyAccumulatorHasExactlyOne && C.noOp.min === 1 && C.noOp.max === 1);
  check('   and the table was SCANNED, not derived from the fixed-point count: a '
    + 'permutation with two fixed points gives two',
    (() => {
      const p = Int16Array.from({ length: A.N }, (_, i) => i);
      // Swap a 3-cycle so exactly 726 states move and 3 stay put.
      const t = p[0]; p[0] = p[1]; p[1] = p[2]; p[2] = t;
      const { step } = F.stepTableFor(p);
      const n = A.noOpTable(step);
      return n.min === 726 && n.max === 726;
    })());
}

console.log('\n=== 3. I1, I2, I3 ON THE CONTROL CHAIN — REBUILT, NOT ARGUED ===');
{
  const free = A.checkNoOpIsFree(60, 5, C.step, C.noOp);
  check('I1 — the forced entry leaves the mixer head unchanged at every gap of 60 ledgers',
    free.ok && free.headHeld === free.tried, `${free.headHeld} of ${free.tried}`);
  check('   and it MOVES the arithmetic total almost every time, which is why it has to '
    + 'be paid for',
    free.totalMoved > free.tried * 0.9, `${free.totalMoved} of ${free.tried}`);
  const run = A.checkSingleGapRun(40, 7, C.step, C.noOp);
  check('I3 — a run of ord(v) insertions at one gap restores BOTH heads, rebuilt',
    run.allHeld, JSON.stringify({ ok: run.ok, tried: run.tried }));
  check('I2 — insertions at different gaps commute: the multiset determines the ledger',
    (() => {
      const r = F.rng(31);
      for (let n = 0; n < 200; n++) {
        const e = A.drawLedgerOfLength(r, 6);
        const a = A.chain(e, C.step);
        const { values } = A.forcedAtGaps(a, C.noOp);
        const k = new Int32Array(7);
        for (let i = 0; i < 4; i++) k[F.randInt(r, 7)]++;
        const f = A.applyNoOps(e, values, k);
        if (A.headOf(f, C.step) !== a[6]) return false;
        if (f.length !== 6 + 4) return false;
      }
      return true;
    })());
  check('   and a no-op insertion changes no accumulator at all, which is what makes '
    + 'that true',
    (() => {
      const r = F.rng(37);
      for (let n = 0; n < 100; n++) {
        const e = A.drawLedgerOfLength(r, 6), a = A.chain(e, C.step);
        const p = F.randInt(r, 7), x = C.noOp.first[a[p]];
        const f = e.slice(0, p).concat([x], e.slice(p));
        const b = A.chain(f, C.step);
        for (let q = 0; q <= p; q++) if (b[q] !== a[q]) return false;
        for (let q = p; q <= 6; q++) if (b[q + 1] !== a[q]) return false;
      }
      return true;
    })());
  const u = A.universalPrepend(C.step, C.noOp);
  check('I4 — one fixed run of prepends forges every ledger of six different lengths',
    u.universal && u.ok === u.tried && u.tried === 240,
    JSON.stringify({ ok: u.ok, tried: u.tried, runs: u.runs }));
}

console.log('\n=== 4. THE FAMILIES, ON THE CONTROL CHAIN ===');
{
  const r = F.rng(41);
  const e = A.drawLedgerOfLength(r, 6), a = A.chain(e, C.step);
  const ti = A.twoInsertSweep(e, a, C.step);
  check('the two-insertion family is 28 gap pairs x 729 free values = 20,412 candidates',
    ti.tried === A.twoInsertFamily(6) && ti.tried === 20412
    && A.gapPairs(6) === 28 && A.twoInsertChance(6) === 28);
  check('   and every accepted row rebuilds into a ledger with BOTH heads intact — a '
    + 'count alone cannot tell a working attack from a relabelled broken one',
    ti.rows.length > 0 && ti.rows.every(row => {
      const f = A.applyTwoInsert(e, row);
      return f.length === 8 && A.headOf(f, C.step) === a[6] && A.totalOf(f) === A.totalOf(e);
    }), `${ti.rows.length} accepted`);
  const trunc = A.checkTruncationAgrees(3, 3, C.step);
  check('D3 in the insertion direction — the truncated verdict equals the full one',
    trunc.ok && trunc.disagree === 0 && trunc.agree === 3 * 20412,
    `${trunc.agree} agree / ${trunc.disagree} disagree`);
  check('   and that agreement is not vacuous: the family really contains accepts',
    trunc.accepts > 0, `${trunc.accepts} accepts`);
  const del = A.deletionSweep(e, C.step);
  check('the deletion family is all 63 non-empty subsets of a six-entry ledger',
    del.tried === 63);
  const re = A.rearrangementSweep(e, C.step);
  check('I5 — the SUMMED head accepts every one of the 719 rearrangements, without '
    + 'exception, because the multiset of entries is unchanged',
    re.distinct === 719 && re.sumAccepted === 719);
  check('   while the mixer does not, so the two heads disagree on this family and the '
    + 'control MOVES',
    re.accepted < re.distinct, `${re.accepted} of ${re.distinct}`);
  check('   and a repeated entry gives FEWER than 719 distinct rearrangements, so the '
    + 'identity and the duplicates are excluded rather than counted',
    (() => {
      const dup = [5, 5, 7, 9, 11, 13];
      const s = A.rearrangementSweep(dup, C.step);
      return s.distinct === 359 && s.sumAccepted === 359;
    })());
  const mv = A.moveSweep(e, C.step);
  // T-INSTRUMENT-FALSE-VERDICT, the same shape as AS's double count: moving entry k
  // one place right IS moving entry k+1 one place left, so 6 x 6 ordered moves are 6
  // identities and 5 adjacent transpositions written twice, leaving 25 distinct.
  check('the move sub-family is 25 distinct non-identity moves, not the 30 the ordered '
    + 'enumeration suggests — an adjacent transposition is two moves',
    mv.distinct === 6 * 6 - 6 - 5 && mv.distinct === 25, String(mv.distinct));
}

console.log('\n=== 5. THE CENSUS RUNS END TO END, ON THE CONTROL CHAIN ONLY ===');
{
  const c = A.census(12, 4242, 6, C.step, C.noOp, true);
  check('a 12-ledger census on the control chain returns every family',
    c.ledgers === 12 && c.length === 6 && !!c.twoInsert && !!c.deletion
    && !!c.rearrange && !!c.move);
  check('   with the minimum rebuilt and both heads recomputed on every ledger',
    c.rebuilt.ok === 12 && c.rebuilt.tried === 12);
  check('   and every forced-value order it tallies is a power of three dividing 729',
    c.orders.length > 0
    && c.orders.every(([o, k]) => [1, 3, 9, 27, 81, 243, 729].includes(o) && k > 0)
    && c.orders.reduce((s, [, k]) => s + k, 0) === 12 * 7);
  const nl = A.uniformGeneratorNull(200, 4243, 6);
  check('the uniform-generator null runs and is a DISTRIBUTION, not one draw',
    nl.ledgers === 200 && nl.sd > 0 && nl.mean > 1 && nl.max >= nl.mean);
  check('   and it responds to the number of generators: more gaps, smaller minimum',
    A.uniformGeneratorNull(200, 4244, 12).mean < A.uniformGeneratorNull(200, 4244, 2).mean);
  const h = A.hybridInsertEdit(8, 4245, C.step, C.noOp);
  check('the hybrid insert-and-edit surface runs, at 42 candidates per ledger with no '
    + 'free parameter left',
    h.tried > 0 && h.tried <= 8 * 42);
}

console.log('\n=== 6. THE REGISTRATION ITSELF ===');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'insert-audit.js'), 'utf8');
  const R = require('../tools/at-risk.js');
  check('the tool carries a PREDICTED OUTCOMES block with all four ids',
    src.includes('PREDICTED OUTCOMES')
    && ['AT1', 'AT2', 'AT3', 'AT4'].every(id => src.includes(id)));
  const lines = R.registrationRisk(src);
  check('   and every one of the four registers an AT RISK line',
    ['AT1', 'AT2', 'AT3', 'AT4'].every(id => typeof lines[id] === 'string'));
  check('   and not one of them is the label restated — the floor test-findings applies',
    ['AT1', 'AT2', 'AT3', 'AT4'].every(id => !R.vacuous(lines[id])),
    ['AT1', 'AT2', 'AT3', 'AT4'].filter(id => R.vacuous(lines[id])).join(' '));
  check('   and each names a CANNOT SHOW as well, because T-SCOPE-DECIDES-THE-VERDICT '
    + 'has bitten four times',
    (src.match(/CANNOT SHOW:/g) || []).length === 4);
  check('the cost model and the forger class are stated BEFORE the predictions',
    src.indexOf('THE COST MODEL, STATED BEFORE ANY ATTACK RUNS')
    < src.indexOf('PREDICTED OUTCOMES')
    && src.indexOf('THE FORGER, STATED PLAINLY') < src.indexOf('PREDICTED OUTCOMES'));
  // The registration commit must contain no measurement OF THE SUBJECT. Every sweep
  // above runs on the control chain, and the one entry point that would touch STEP's
  // no-op table is the tool's cached full census. The needle is assembled rather than
  // written, or this check would find itself.
  const needle = 'A.' + 'measure(';
  check('no measurement of the subject is asserted anywhere in this file: every sweep '
    + 'names the control chain, and the tool\'s full census is never entered',
    !fs.readFileSync(__filename, 'utf8').includes(needle)
    && fs.readFileSync(__filename, 'utf8').includes('C.step'));
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
