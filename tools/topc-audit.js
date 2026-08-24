'use strict';
/* TOPC CEILING AUDIT — is there a ceiling once the carry is table-driven?
 *
 * Sixth in the series, and it closes it. The earlier audits found a ladder of
 * ceilings, each one a fact about the vocabulary rather than about the machine:
 *
 *      TGATE, all 729 controls          77,687 at width 6
 *      any positionwise vocabulary      27^w, and TOP sits exactly on it
 *      positionwise + one carry         251,505 at width 2, and CLOSED
 *
 * That last number came from ADD — a single, particular carry. TOPC makes the
 * carry itself data: 3^18 distinct behaviours once the second operand is pinned.
 * The question is whether the ladder has another rung or simply stops.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit. No
 * measurement appears below this line.
 *
 *   V1  At width 1, TOPC reaches exactly 27 — the same as TOP. One position has
 *       no carry to receive and nothing above it to send one to, so the third
 *       input is inert. The carry needs a neighbour before it is worth anything.
 *
 *   V2  At width 2, TOPC tables alone exceed the positionwise ceiling of 729,
 *       without needing positionwise generators alongside them.
 *
 *   V3  positionwise + sampled arbitrary TOPC tables reaches MORE than 251,505 —
 *       the closed monoid that positionwise + ADD reaches. Freedom in the carry
 *       should buy reach beyond the one carry the machine happened to ship with.
 *
 *       If this FAILS and the number lands exactly on 251,505, that is the more
 *       interesting outcome and it is stated here in advance: it would mean ADD
 *       is already all the carry there is, and TOPC's table freedom adds
 *       expressiveness per instruction but no reach at all — the same shape as
 *       Q1, where 19,683 tables collapsed to 27.
 *
 *   V4  The sample is a LOWER bound, so whatever it reaches, the true reach of
 *       the full TOPC vocabulary is at least that. Any claim here is one-sided
 *       and is reported as such.
 * ------------------------------------------------------------------------------
 */

const { arena, audit, topSinglePos, topcSample, topcAddGens } = require('./monoid-lib.js');

const line = '='.repeat(78);
const SAMPLE = 300;
console.log('TOPC CEILING AUDIT — the carry as data, and whether the ladder has another rung.\n');

console.log('--- V1  at width 1 the carry is inert ---');
{
  const A = arena(1);
  const t = audit(topcSample(A, SAMPLE), A.N);
  console.log(`      TOPC sample, width 1: reached ${t.total}   ${t.total === 27 ? 'HOLDS (= 27, same as TOP)' : 'FAILS'}`);
  console.log('      one position has no neighbour, so the third input does nothing');
}

console.log('\n--- V2  at width 2 TOPC alone passes the positionwise ceiling ---');
const A2 = arena(2);
const topcOnly = audit(topcSample(A2, SAMPLE), A2.N);
console.log(`      TOPC sample alone: reached ${topcOnly.total}   ceiling 27^2 = 729`);
console.log(`      ${topcOnly.total > 729 ? 'HOLDS' : 'FAILS'}`);

console.log('\n--- V3  does table freedom in the carry buy reach beyond ADD? ---');
{
  const pw = topSinglePos(A2);
  const withAdd = audit(pw.concat(topcAddGens(A2)), A2.N);
  const withAny = audit(pw.concat(topcSample(A2, SAMPLE)), A2.N);
  console.log(`      positionwise + TOPC carrying ADD : ${withAdd.total}${withAdd.saturated ? ' (closed)' : ''}`);
  console.log(`      positionwise + ${SAMPLE} sampled TOPC : ${withAny.total}${withAny.saturated ? ' (closed)' : ' (unsaturated at the cap)'}`);
  if (withAny.total > withAdd.total) {
    console.log(`      V3 HOLDS — freedom buys ${(withAny.total - withAdd.total).toLocaleString()} more elements`
      + `, ${(withAny.total / withAdd.total).toFixed(2)}x`);
  } else if (withAny.total === withAdd.total) {
    console.log('      V3 FAILS, and this is the interesting way to fail:');
    console.log('      ADD is already all the carry there is. Table freedom adds expressiveness');
    console.log('      per instruction and no reach — the same shape as Q1.');
  } else {
    console.log('      V3 FAILS — the sample reached less, so it is simply too small a sample.');
  }
}

console.log('\n--- V4  the sample is one-sided ---');
console.log(`      ${SAMPLE} tables sampled from 3^18 = 387,420,489 possible behaviours,`);
console.log('      with a fixed seed. Whatever it reaches is a LOWER bound on the true reach;');
console.log('      no upper bound is claimed here.');
console.log(line);
