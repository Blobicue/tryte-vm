'use strict';
/* TRYTE VOCABULARY AUDITOR — what does TGATE actually generate?
 *
 * Instrument borrowed from gameladder's tools/table-audit.py, which credits
 * unit:braid_relation_miner for the shape. Same question, different arena.
 *
 * THE QUESTION. TGATE takes a control tryte and applies a per-trit choice of
 * NEG / MIN / MAX. Fix the second data operand and each of the 3^w controls
 * becomes a unary map on trytes — a TABLE. A vocabulary of k tables on N points
 * generates a MONOID under composition, and chaining stages can never leave it.
 *
 * The source conversation this project grew out of claimed that two cascaded
 * 6-trit stages give "729 x 729 = 531,441 unique cascading logic networks."
 * That counts CONFIGURATIONS. This counts ELEMENTS. They are not the same number
 * and the difference is the whole point of the instrument.
 *
 * WHY JAVASCRIPT AND NOT PYTHON, unlike the tool this is modelled on: the tryte
 * semantics already exist in src/ternary.js and are covered by 261 tests.
 * Re-implementing tgate in Python to audit it would create a second definition
 * that could drift from the one under test. The auditor's SHAPE is ported; the
 * semantics are imported.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, so git
 * supplies the ordering that an editable source file cannot. If a later commit
 * changes a value here, the git history says so; that is the mechanism
 * gameladder's check-registration.py exists to enforce, and the same rule is
 * being followed by hand.
 *
 *   P1  addi        saturates at exactly 3^w        (translations; cyclic group)
 *   P2  all         saturates; does not grow freely
 *   P3  reach(all, w) = reach(all, 1) ^ w           THE RISKY ONE. Generators act
 *                                                    independently per trit, so the
 *                                                    monoid should be a direct
 *                                                    product across positions.
 *   P4  reach(pure, w) < reach(all, w) for w >= 2   Unlike table-audit's wide16,
 *                                                    where 10 extra tables bought
 *                                                    +0 elements, here the extra
 *                                                    tables SHOULD buy elements,
 *                                                    because they are independent
 *                                                    per position rather than all
 *                                                    drawn from one linear group.
 *   P5  reach(all, 6) != 531441                     the conversation's figure is
 *                                                    a configuration count, not an
 *                                                    element count
 *   P6  shift       saturates                       SHR is many-to-one and drives
 *                                                    everything to 0 eventually
 * ------------------------------------------------------------------------------
 */

const { arena, vocabularies, audit, reachByLaw } = require('./monoid-lib.js');

const WIDTHS = [1, 2, 3, 4, 5];
const results = {};

function report(name, gens, N) {
  const r = audit(gens, N);
  const state = r.saturated ? `SATURATED at ${r.total}`
    : r.capped ? 'no saturation (capped)'
      : `growing, ${r.total} at d=${r.sizes.length}`;
  console.log(`  ${name.padEnd(7)} k=${String(gens.length).padEnd(4)} ${state}`);
  console.log(`          ball ${JSON.stringify(r.sizes.slice(0, 8))}${r.sizes.length > 8 ? ' ...' : ''}`
    + `   rules ${r.rules}, shortest len ${r.shortest}`);
  return { name, k: gens.length, ...r };
}

console.log('TRYTE VOCABULARY AUDIT — a vocabulary reaches only the monoid it generates.');
console.log('Cascading stages, however many, cannot exceed it.\n');
for (const w of WIDTHS) {
  const A = arena(w);
  console.log(`--- width ${w}  (N = ${A.N} trytes) ---`);
  results[w] = {};
  for (const [name, gens] of Object.entries(vocabularies(A))) results[w][name] = report(name, gens, A.N);
  console.log();
}

const line = '='.repeat(78);
console.log(line);
console.log('P1  addi saturates at exactly 3^w');
for (const w of WIDTHS) {
  const r = results[w].addi;
  console.log(`      w=${w}: ${r.total} vs 3^${w}=${3 ** w}   ${r.saturated && r.total === 3 ** w ? 'HOLDS' : 'FAILS'}`);
}
console.log('\nP2  all saturates');
for (const w of WIDTHS) console.log(`      w=${w}: ${results[w].all.saturated ? 'HOLDS' : 'FAILS'} (${results[w].all.total})`);
console.log('\nP6  shift saturates');
for (const w of WIDTHS) console.log(`      w=${w}: ${results[w].shift.saturated ? 'HOLDS' : 'FAILS'} (${results[w].shift.total})`);

const m = results[1].all.total;
console.log(`\nP3  reach(all, w) = reach(all, 1)^w   with reach(all,1) = ${m}`);
let productLaw = true;
for (const w of WIDTHS) {
  const got = results[w].all.total, want = m ** w;
  if (got !== want) productLaw = false;
  console.log(`      w=${w}: reached ${got}, predicted ${want}   ${got === want ? 'HOLDS' : 'FAILS'}`);
}
console.log(productLaw ? '      P3 HOLDS' : '      >>> P3 FAILS. The failure produced the real law; see below.');

console.log('\nP4  reach(pure, w) < reach(all, w) for w >= 2');
for (const w of WIDTHS) {
  const p = results[w].pure.total, a = results[w].all.total;
  console.log(`      w=${w}: pure(k=3) ${p} vs all(k=${results[w].all.k}) ${a}   ${w < 2 ? '(n/a)' : (p < a ? 'HOLDS' : 'FAILS')}`);
}

console.log('\nCORRECTED LAW — post-hoc, NOT a prediction: reach(w) = |union_d (M_d)^w|');
console.log('    One step applies one control to ALL positions, so after d steps every position');
console.log('    carries a word of length exactly d. The positions must agree on word LENGTH,');
console.log('    which is weaker than the full direct product P3 assumed.');
let lawOk = true;
for (const w of WIDTHS) {
  const got = results[w].all.total, law = reachByLaw(w);
  if (got !== law) lawOk = false;
  console.log(`      w=${w}: measured ${got}, law ${law}   ${got === law ? 'MATCH' : 'MISMATCH'}`);
}

console.log("\nP5  the source conversation's 531,441");
if (lawOk) {
  const six = reachByLaw(6);
  console.log(`      law validated on ${WIDTHS.length} widths, so reach(all, 6) = ${six.toLocaleString()}`);
  console.log('      claimed "unique cascading logic networks" = 531,441');
  console.log(`      ${six === 531441 ? 'EQUAL — P5 FAILS' : 'DIFFERENT — P5 HOLDS'}`
    + (six !== 531441 ? `   (overstates by ${(531441 / six).toFixed(2)}x)` : ''));
  console.log('      531,441 = 729^2 counts CONFIGURATIONS OF TWO STAGES.');
  console.log(`      ${six.toLocaleString()} is every function reachable by ANY number of stages.`);
} else {
  console.log('      corrected law did not validate — width 6 not extrapolated.');
}
console.log(line);
