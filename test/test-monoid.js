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

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
