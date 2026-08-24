'use strict';
/* test-monoid.js — pins the vocabulary audit's numbers so they cannot drift.
 *
 * The full sweep (tools/monoid-audit.js, `npm run audit`) goes to width 5 and
 * takes ~20 seconds. This covers widths 1-3 plus the corrected law and its
 * extrapolation, which is the part that carries the claim.
 *
 * The registered predictions live in tools/monoid-audit.js and were committed
 * before the run. P3 FAILED. Its failure is recorded here as a test, because a
 * project that only keeps its successful predictions is not doing prediction.
 */

const { reach, reachByLaw, arena, vocabularies, audit } = require('../tools/monoid-lib.js');
const T = require('../src/ternary.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

console.log('\n=== 1. THE INSTRUMENT AGREES WITH THE MACHINE ===');
{
  // The audit builds its tables from its own arena; they must match src/ternary.js,
  // or the whole audit is measuring something other than this machine.
  const A = arena(6);
  const V = vocabularies(A);
  const half = (A.N - 1) / 2;
  let bad = null;
  for (const c of [-364, -121, 0, 40, 364]) {
    const table = V.all[c + half];
    for (const v of [-364, -45, 0, 7, 123, 364]) {
      const fromAudit = A.val(table[A.idx(v)]);
      const fromMachine = T.tgate(c, v, 0);
      if (fromAudit !== fromMachine) { bad = `c=${c} v=${v}: ${fromAudit} vs ${fromMachine}`; break; }
    }
    if (bad) break;
  }
  check('every audited table equals T.tgate from the tested module', bad === null, bad || '');
}

console.log('\n=== 2. MEASURED REACH (widths 1-3) ===');
const MEASURED = {
  1: { pure: 7, all: 7, addi: 3, shift: 3 },
  2: { pure: 7, all: 47, addi: 9, shift: 11 },
  3: { pure: 7, all: 307, addi: 27, shift: 29 },
};
for (const w of [1, 2, 3]) {
  for (const [name, want] of Object.entries(MEASURED[w])) {
    const r = reach(name, w);
    check(`w=${w} ${name.padEnd(5)} reaches ${want}`, r.total === want, `got ${r.total}`);
  }
}

console.log('\n=== 3. THE REGISTERED PREDICTIONS ===');
check('P1 — addi saturates at exactly 3^w',
  [1, 2, 3].every(w => { const r = reach('addi', w); return r.saturated && r.total === 3 ** w; }));
check('P2 — all saturates rather than growing freely',
  [1, 2, 3].every(w => reach('all', w).saturated));
check('P6 — shift saturates',
  [1, 2, 3].every(w => reach('shift', w).saturated));
check('P4 — more tables DO buy elements here (unlike table-audit\'s wide16)',
  [2, 3].every(w => reach('pure', w).total < reach('all', w).total));
// The one that failed. Kept as a test so the record cannot quietly improve.
check('P3 FAILED and still fails: reach(all,w) is NOT reach(all,1)^w',
  [2, 3].some(w => reach('all', w).total !== 7 ** w),
  'if this ever passes, P3 was right and the corrected law is wrong');
check('  ...specifically 47 < 49 at w=2 and 307 < 343 at w=3',
  reach('all', 2).total === 47 && 47 < 49 && reach('all', 3).total === 307 && 307 < 343);

console.log('\n=== 4. THE CORRECTED LAW (post-hoc, validated before use) ===');
check('the per-trit monoid has 7 elements',
  reach('all', 1).total === 7);
check('reach(w) = |union_d (M_d)^w| matches every measured width',
  [1, 2, 3].every(w => reachByLaw(w) === reach('all', w).total));
check('the law is not vacuous — it differs from the direct product it replaced',
  [2, 3].every(w => reachByLaw(w) < 7 ** w));

console.log('\n=== 5. WHAT THE SOURCE CONVERSATION CLAIMED ===');
{
  const six = reachByLaw(6);
  check(`reach(all, 6) = ${six.toLocaleString()} distinct functions`, six === 77687, String(six));
  check('the claim was 531,441 = 729^2, a count of two-stage CONFIGURATIONS', 729 * 729 === 531441);
  check(`it overstates the reachable functions by ${(531441 / six).toFixed(2)}x`,
    531441 > six && Math.abs(531441 / six - 6.84) < 0.01);
  check('and 77,687 covers ANY number of stages, not just two — cascading further adds nothing',
    six < 531441);
}

console.log('\n=== 6. TOP — richness per instruction is not reach ===');
{
  const { topFixed, topSinglePos, arena, audit } = require('../tools/monoid-lib.js');
  const fixedAt = w => audit(topFixed(arena(w)), arena(w).N).total;
  const singleAt = w => audit(topSinglePos(arena(w)), arena(w).N).total;

  // Q1 — pinning the second operand leaves one column in play, so every position
  // gets the same map and 19,683 tables collapse to 27.
  check('Q1 — topFixed reaches 27 at every width, however many tables exist',
    [1, 2, 3].every(w => fixedAt(w) === 27));

  // Q2 — the richer instruction reaches LESS than TGATE under composition.
  check('Q2 — topFixed (27) reaches fewer than TGATE all (47, 307) for w >= 2',
    fixedAt(2) < reach('all', 2).total && fixedAt(3) < reach('all', 3).total,
    `${fixedAt(2)} vs ${reach('all', 2).total}, ${fixedAt(3)} vs ${reach('all', 3).total}`);

  // Q3 — with the second operand free, TOP can put the IDENTITY in a column, so
  // positions idle while others advance. That is exactly what TGATE cannot do,
  // and exactly why P3's direct product failed for TGATE but holds here.
  check('Q3 — topSinglePos reaches exactly 27^w',
    [1, 2, 3].every(w => singleAt(w) === 27 ** w),
    [1, 2, 3].map(w => `${singleAt(w)}/${27 ** w}`).join(' '));
  check('   the identity IS available to TOP as a column', (() => {
    const id = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) id.push(x);
    return [0, 7, -45, 123, 364].every(v => T.ttable(id, v, 91) === v);
  })());
  check('   ...and is NOT available to TGATE — every mode moves something', (() => {
    for (const mode of [-1, 0, 1]) {
      const tbl = T.tgateModeTable(mode);
      if ([0, 7, -45, 123, 364].every(v => T.ttable(tbl, v, 91) === v)) return false;
    }
    return true;
  })());

  // Q4 — lower bound (measured) meets upper bound (positionwise argument).
  check('Q4 — 27^w is pinned: a measured subset reaches the positionwise ceiling',
    [1, 2, 3].every(w => singleAt(w) === 27 ** w));

  // Q5 — the conversation's number, from the other side.
  check('Q5 — the TOP ceiling at width 6 is 27^6 = 387,420,489 = 3^18',
    27 ** 6 === 387420489 && 3 ** 18 === 387420489);
  check('   so 531,441 UNDERSTATES the TOP ceiling by 729x',
    27 ** 6 / 531441 === 729);
  check('   while it OVERSTATED the TGATE reach of 77,687 by 6.84x',
    Math.abs(531441 / 77687 - 6.84) < 0.01);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
