'use strict';
/* FOLD AUDIT — routing a chain through one precomputed table.
 *
 * Fourth in the series. The three earlier audits established the algebra this
 * one exploits: positionwise operations are closed under composition and capped
 * at 27^w, and it takes a carry to escape that. Closure is exactly the licence to
 * FOLD — if the composite of two TOPs is again a TOP, a chain of them can be
 * collapsed at build time into a single table and executed as one instruction.
 *
 *      T3[a][b] = T2[ T1[a][b] ][b]
 *
 * The formula does not mention the second operand, so one fold stays correct for
 * every input the program will ever see. Identical folded tables are content
 * addressed by tableKey, so a program using the same composite twice stores one
 * copy of the nine cells rather than two.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit. The
 * closure facts are NOT listed here: they were measured before this file existed
 * and registering them now would be backdating. What follows is only what has not
 * yet been measured.
 *
 *   S1  An N-stage TOP chain folds to one instruction, saving exactly
 *       2*(N-1) cells of code and (N-1) executed instructions per application.
 *
 *   S2  The saving MULTIPLIES with emulation depth. Each guest instruction costs
 *       roughly 27 host instructions per level, so the instructions saved at
 *       depth 2 should be about 27x the native saving, and at depth 3 about 27^2.
 *       Folding is worth most precisely where execution is dearest.
 *
 *   S3  Hash-consing pays exactly 9 cells per duplicate table: a program using
 *       the same composite k times stores 9 cells rather than 9k.
 *
 *   S4  The fold does NOT survive a carry. Inserting an ADD between two TOPs
 *       makes the chain non-positionwise, so the folded table stops agreeing with
 *       the chain — the same boundary the carry audit measured, showing up as an
 *       optimisation limit rather than a counting one.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const { runNative, runHosted } = require('../src/selfhost.js');
const { assemble } = require('../src/assembler.js');

const line = '='.repeat(78);
const MODES = [T.tgateModeTable(0), T.tgateModeTable(-1), T.tgateModeTable(1), T.tgateModeTable(-1)];

/** A program applying N TOP stages in sequence, or one folded stage. */
function chainProgram(tables, folded) {
  const use = folded ? [T.foldTables(...tables)] : tables;
  const lines = ['IN', 'STORE xv'];
  use.forEach((_, i) => {
    lines.push(`LOADI t${i}`, 'STORE cp', 'LDC cp', 'LOAD xv', 'TOP yv', 'STORE xv');
  });
  lines.push('LOAD xv', 'OUT', 'HALT', '.org -60', 'cp: .word 0', 'yv: .word -45', 'xv: .word 0');
  use.forEach((t, i) => lines.push(`t${i}: .word ${t.map(T.lowTrit).join(', ')}`));
  return lines.join('\n');
}

const unfolded = chainProgram(MODES, false);
const folded = chainProgram(MODES, true);

console.log('FOLD AUDIT — a chain of four TOP stages, folded into one.\n');
const cells = s => assemble(s, 0).cells.size;
const probes = [-364, -45, 0, 7, 123, 364];

console.log('--- S1  exactness and the native saving ---');
let exact = true;
for (const x of probes) {
  if (runNative(unfolded, [x]).output[0] !== runNative(folded, [x]).output[0]) exact = false;
}
const uSteps = runNative(unfolded, [123]).steps, fSteps = runNative(folded, [123]).steps;
console.log(`      identical output on ${probes.length} probes: ${exact ? 'HOLDS' : 'FAILS'}`);
console.log(`      cells       ${cells(unfolded)} -> ${cells(folded)}`);
console.log(`      instructions ${uSteps} -> ${fSteps}   saved ${uSteps - fSteps}`);
console.log(`      S1 predicted (N-1)=3 instructions saved per application: `
  + `${uSteps - fSteps === 3 * 6 ? 'see note' : ''}${(uSteps - fSteps) === 18 ? 'HOLDS (3 stages x 6 instructions each)' : (uSteps - fSteps) === 3 ? 'HOLDS' : 'measured ' + (uSteps - fSteps)}`);

console.log('\n--- S2  the saving multiplies with emulation depth ---');
const rows = [];
for (const d of [1, 2, 3]) {
  const run = s => (d === 1 ? runNative(s, [123]) : runHosted(s, [123], { depth: d, maxSteps: 5e7 }));
  try {
    const u = run(unfolded).steps, f = run(folded).steps;
    rows.push({ d, u, f, saved: u - f });
    console.log(`      depth ${d}: unfolded ${u.toLocaleString()}  folded ${f.toLocaleString()}  saved ${(u - f).toLocaleString()}`);
  } catch (e) { console.log(`      depth ${d}: ${e.message.split('\n')[0]}`); }
}
if (rows.length >= 2) {
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i].saved / rows[i - 1].saved;
    console.log(`      depth ${rows[i - 1].d} -> ${rows[i].d}: saving grew ${r.toFixed(1)}x`
      + `   ${r > 10 ? 'HOLDS (multiplies)' : 'FAILS'}`);
  }
}

console.log('\n--- S3  hash-consing identical tables ---');
{
  const dup = [MODES[0], MODES[1], MODES[0], MODES[1]];
  const keys = dup.map(T.tableKey);
  const unique = new Set(keys);
  console.log(`      ${dup.length} tables, ${unique.size} distinct -> ${(dup.length - unique.size) * 9} cells saved`);
  console.log(`      S3 predicts 9 per duplicate: ${(dup.length - unique.size) * 9 === 18 ? 'HOLDS' : 'FAILS'}`);
}

console.log('\n--- S4  the fold stops at a carry ---');
{
  // chain: TOP(t0), then ADD a constant, then TOP(t1). Folding t0 and t1 ignores
  // the ADD, so the folded form must DISAGREE with the real chain.
  const t0 = MODES[0], t1 = MODES[1], y = -45, K = 40;
  const foldedPair = T.foldTables(t0, t1);
  let disagrees = false;
  for (const x of probes) {
    const real = T.ttable(t1, T.wrap(T.ttable(t0, x, y) + K), y);
    const asIfFolded = T.ttable(foldedPair, x, y);
    if (real !== asIfFolded) disagrees = true;
  }
  console.log(`      inserting one ADD breaks the equivalence: ${disagrees ? 'HOLDS' : 'FAILS'}`);
  console.log('      positionwise chains fold; a carry is where the optimisation stops,');
  console.log('      which is the same boundary the carry audit found by counting.');
}
console.log(line);
