'use strict';
/* TOP VOCABULARY AUDIT — does making the truth table DATA buy any reach?
 *
 * Companion to tools/monoid-audit.js, same instrument, new vocabulary. That
 * audit measured TGATE: three fixed choices per trit, reaching 77,687 maps at
 * width 6. This one measures TOP, which makes the function itself data and so
 * offers all 3^9 = 19,683 two-input trit functions.
 *
 * THE STRUCTURE THAT MATTERS. A TOP table has three COLUMNS, one per value of
 * the second operand's trit, and each column is a unary map on trits. So one TOP
 * instruction picks three arbitrary unary maps and assigns one to each position
 * according to the second operand. TGATE is that same shape with its three
 * columns nailed to NEG / MIN / MAX. The question is therefore not "how many
 * tables" but "what varies per position".
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, exactly as
 * P1..P6 were. This block contains no measurement.
 *
 *   Q1  topFixed reaches 27 at EVERY width.
 *       With the second operand pinned to 0 there is one column in play, so every
 *       position receives the same map and the generators are diagonal. 19,683
 *       tables collapse to 27 distinct maps and width buys nothing. This is a
 *       wide16-style result, and sharper: more tables, LESS reach than TGATE.
 *
 *   Q2  topFixed reaches FEWER elements than TGATE's `all` for width >= 2.
 *       27 against 47, 307, 1967, ... — the richer instruction loses, because
 *       richness per instruction is not reach under composition.
 *
 *   Q3  topSinglePos reaches exactly 27^w.
 *       And the reason is the one that explains why P3 failed for TGATE: TOP can
 *       express the IDENTITY as a column, so positions can idle while others
 *       advance. That dissolves the equal-word-length constraint which forced
 *       TGATE's reach below its direct product. TGATE has no identity mode —
 *       NEG, MIN(.,0) and MAX(.,0) all move something — which is precisely why
 *       its reach was 47 rather than 49.
 *
 *   Q4  27^w is the CEILING for any positionwise vocabulary.
 *       An operation computing out_p from (x_p, y_p) alone can induce at most the
 *       27 unary maps per position, and positions compose independently, so no
 *       table-driven positionwise instruction can exceed 27^w. Beating it needs
 *       cross-trit interaction — a carry.
 *
 *   Q5  At width 6 that ceiling is 27^6 = 387,420,489 = 3^18, which EXCEEDS the
 *       source conversation's 531,441. With TOP the famous figure flips from a
 *       6.84x overstatement to an understatement.
 * ------------------------------------------------------------------------------
 */

const { arena, audit, reach, topFixed, topSinglePos } = require('./monoid-lib.js');

const WIDTHS = [1, 2, 3];
const line = '='.repeat(78);
console.log('TOP VOCABULARY AUDIT — richness per instruction vs reach under composition.\n');

const fixed = {}, single = {}, tgateAll = {};
for (const w of WIDTHS) {
  const A = arena(w);
  fixed[w] = audit(topFixed(A), A.N);
  single[w] = audit(topSinglePos(A), A.N);
  tgateAll[w] = reach('all', w);
  console.log(`--- width ${w} (N = ${A.N}) ---`);
  console.log(`  topFixed      k=${String(topFixed(A).length).padEnd(4)} reached ${fixed[w].total}   ball ${JSON.stringify(fixed[w].sizes.slice(0, 6))}`);
  console.log(`  topSinglePos  k=${String(topSinglePos(A).length).padEnd(4)} reached ${single[w].total}   ball ${JSON.stringify(single[w].sizes.slice(0, 6))}`);
  console.log(`  TGATE all     k=${String(3 ** w).padEnd(4)} reached ${tgateAll[w].total}`);
  console.log();
}

console.log(line);
console.log('Q1  topFixed reaches 27 at every width');
for (const w of WIDTHS) console.log(`      w=${w}: ${fixed[w].total}   ${fixed[w].total === 27 ? 'HOLDS' : 'FAILS'}`);

console.log('\nQ2  topFixed reaches FEWER elements than TGATE all, for w >= 2');
for (const w of WIDTHS) {
  const a = fixed[w].total, b = tgateAll[w].total;
  console.log(`      w=${w}: TOP ${a} vs TGATE ${b}   ${w < 2 ? '(n/a)' : (a < b ? 'HOLDS' : 'FAILS')}`);
}

console.log('\nQ3  topSinglePos reaches exactly 27^w  (identity column dissolves the length constraint)');
let q3 = true;
for (const w of WIDTHS) {
  const got = single[w].total, want = 27 ** w;
  if (got !== want) q3 = false;
  console.log(`      w=${w}: ${got} vs 27^${w}=${want}   ${got === want ? 'HOLDS' : 'FAILS'}`);
}

console.log('\nQ4  27^w is the ceiling for any positionwise vocabulary');
console.log('      topSinglePos is a strict SUBSET of what TOP with a free second operand can do,');
console.log('      so its reach is a LOWER bound; the positionwise argument is the UPPER bound.');
for (const w of WIDTHS) {
  const got = single[w].total, ceil = 27 ** w;
  console.log(`      w=${w}: lower ${got} = upper ${ceil}   ${got === ceil ? 'PINNED' : 'not pinned'}`);
}

console.log("\nQ5  against the source conversation's 531,441");
if (q3) {
  const six = 27 ** 6;
  console.log(`      ceiling at width 6 = 27^6 = ${six.toLocaleString()} = 3^18`);
  console.log(`      TGATE reached          77,687   (claim overstates by 6.84x)`);
  console.log(`      claimed                531,441`);
  console.log(`      TOP ceiling            ${six.toLocaleString()}   ${six > 531441 ? '-> the claim UNDERSTATES this by ' + (six / 531441).toFixed(0) + 'x  Q5 HOLDS' : 'Q5 FAILS'}`);
} else {
  console.log('      Q3 failed, so the width-6 ceiling is not extrapolated.');
}
console.log(line);
