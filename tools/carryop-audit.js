'use strict';
/* CARRY-OP AUDIT — does making the carry table-driven widen the routing space?
 *
 * Fifth in the series. The carry audit showed that a positionwise vocabulary is
 * capped at 27^w and that ONE carrying generator breaks it: at width 2, adding
 * 27 more positionwise tables bought +0 elements while a single translation
 * bought +250,776. TOPC packages that escape into one instruction — a 27-row
 * table taking the carry from the position below and emitting one above.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 * NOT registered, because it was measured during design and backdating it would
 * be dishonest: ADD equals TTABLEC(addCarryTable) exactly, checked over 76,545
 * operand pairs. The machine's arithmetic is a table.
 *
 *   U1  No TOP table equals ADD as a function. Checked over all 3^9 = 19,683 of
 *       them, on enough probes to compare functions rather than points — the trap
 *       an earlier test in this project fell into by comparing at one input.
 *
 *   U2  One TOPC instruction reaches past the positionwise ceiling. Concretely:
 *       the vocabulary {positionwise maps} + {TOPC with the ADD table, over all
 *       second operands} should reach 251,505 at width 2 — the SAME number the
 *       carry audit measured for {positionwise} + {translation}, because they are
 *       the same monoid arrived at from one instruction instead of two.
 *
 *   U3  Putting TOPC in the CORE interpreter would end depth 4. The core is 223
 *       cells and a handler costs about 16, and the depth-4 window is 729 - 3I,
 *       so ~239 cells leaves ~12 — smaller than any demo program. TOPC therefore
 *       goes in the full interpreter only, and that split is a measured decision
 *       rather than an oversight.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const { arena, audit, topSinglePos, addTable } = require('./monoid-lib.js');
const { interpSize, plan } = require('../src/selfhost.js');

const line = '='.repeat(78);
console.log('CARRY-OP AUDIT — one instruction that couples trit positions.\n');

console.log('--- U1  no TOP table equals ADD ---');
{
  const probes = [];
  for (let i = 0; i < 40; i++) probes.push([i * 53 - 364, i * 137 - 364]);
  let matches = 0, pointwise = 0;
  for (let i = 0; i < 19683; i++) {
    const tbl = []; let n = i;
    for (let k = 0; k < 9; k++) { tbl.push((n % 3) - 1); n = Math.floor(n / 3); }
    if (probes.every(([x, y]) => T.ttable(tbl, x, y) === T.add(x, y))) matches++;
    if (T.ttable(tbl, 123, -45) === T.add(123, -45)) pointwise++;
  }
  console.log(`      tables agreeing with ADD on all ${probes.length} probes: ${matches}   ${matches === 0 ? 'U1 HOLDS' : 'U1 FAILS'}`);
  console.log(`      tables agreeing at the single pair (123,-45): ${pointwise}`);
  console.log(`      -> comparing at one input would have "found" ${pointwise} false matches.`);
}

console.log('\n--- U2  one TOPC instruction reaches past 27^w ---');
{
  const A = arena(2);
  const pw = topSinglePos(A);
  const ceiling = 27 ** 2;

  // TOPC carrying the ADD table, over every second operand: v -> v + y.
  const addTbl = T.addCarryTable();
  const half = (A.N - 1) / 2;
  const topcGens = [];
  for (let y = -half; y <= half; y++) {
    topcGens.push(Array.from({ length: A.N }, (_, i) => {
      // width-2 arena, so use the arena's own trit arithmetic rather than 6-trit
      const xs = A.trits(A.val(i)), ys = A.trits(y);
      const out = []; let c = 0;
      for (let k = 0; k < A.w; k++) {
        const cell = addTbl[(xs[k] + 1) * 9 + (ys[k] + 1) * 3 + (c + 1)];
        const o = cell - 3 * Math.sign(cell) * Math.round(Math.abs(cell) / 3);
        c = Math.sign(cell) * Math.round(Math.abs(cell) / 3);
        out.push(o);
      }
      return A.idx(A.fromTrits(out));
    }));
  }
  const justPw = audit(pw, A.N);
  const withTopc = audit(pw.concat(topcGens), A.N);
  const withPlainAdd = audit(pw.concat([addTable(A, 1)]), A.N);
  console.log(`      positionwise alone            ${justPw.total}   (ceiling 27^2 = ${ceiling})`);
  console.log(`      + TOPC carrying the ADD table ${withTopc.total}`);
  console.log(`      + a plain translation         ${withPlainAdd.total}   (the carry audit's number)`);
  console.log(`      exceeds the ceiling: ${withTopc.total > ceiling ? 'HOLDS' : 'FAILS'}`);
  console.log(`      same monoid from one instruction: ${withTopc.total === withPlainAdd.total ? 'HOLDS' : 'FAILS'}`);
}

console.log('\n--- U3  TOPC cannot go in the core without ending depth 4 ---');
{
  const core = interpSize('core');
  const handler = 16;                       // LOAD/ADDI/STORE/LDC/LOAD/TOPC/STORE/JMP
  const wouldBe = core + handler;
  const window4 = 729 - 3 * wouldBe;
  console.log(`      core now ${core} cells, depth-4 window ${plan(4, 'core').innerCells}`);
  console.log(`      with a TOPC handler: ~${wouldBe} cells, depth-4 window ~${window4}`);
  console.log(`      smallest demo program (countdown) spans 24 cells`);
  console.log(`      ${window4 < 24 ? 'U3 HOLDS — depth 4 would be unusable, so TOPC stays in the full interpreter only' : 'U3 FAILS'}`);
}
console.log(line);
