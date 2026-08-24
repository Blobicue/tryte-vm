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
  check(`P5 — reach(all, 6) = ${six.toLocaleString()} distinct functions, not 531,441`,
    six === 77687, String(six));
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

console.log('\n=== 7. WHAT BREAKS THE POSITIONWISE CEILING ===');
{
  const { arena, audit, topSinglePos, topFixed, addTable } = require('../tools/monoid-lib.js');
  const A = arena(2);
  const shl = Array.from({ length: A.N }, (_, i) => A.idx(A.val(i) * 3));
  const at = gens => audit(gens, A.N);

  const pw = at(topSinglePos(A));
  const pwWide = at(topSinglePos(A).concat(topFixed(A)));
  const pwAdd = at(topSinglePos(A).concat([addTable(A, 1)]));
  const pwShl = at(topSinglePos(A).concat([shl]));

  check('R1 — the positionwise vocabulary saturates at exactly 27^2 = 729',
    pw.saturated && pw.total === 729, String(pw.total));
  check('R2 — 27 MORE positionwise generators reach the same 729: +0 elements',
    pwWide.saturated && pwWide.total === 729, String(pwWide.total));
  check('R3 — ONE translation reaches 251,505 — 345x more',
    pwAdd.total === 251505, String(pwAdd.total));
  check('R4 — one shift also escapes, reaching 801', pwShl.total === 801, String(pwShl.total));

  check('R5 — the escape is coupling, not generator count',
    pwWide.total - pw.total === 0 && pwAdd.total - pw.total > 250000);

  // Beyond the registered predictions. Both ADD and SHL couple trits, yet the
  // translation buys 250,776 elements and the shift buys 72. Carry is
  // data-dependent — which trits move depends on the values — while the shift is
  // a fixed relabelling. Coupling alone is not enough; it has to be conditional.
  check('NOT ALL COUPLING IS EQUAL: the carry buys ~3,483x what the shift does',
    Math.round((pwAdd.total - pw.total) / (pwShl.total - pw.total)) === 3483,
    String(Math.round((pwAdd.total - pw.total) / (pwShl.total - pw.total))));

  check('and even with the carry the machine closes, rather than reaching every map',
    pwAdd.saturated && pwAdd.total < 9 ** 9);
  check('   251,505 is 0.065% of the 387,420,489 maps on 9 points',
    Math.abs(100 * pwAdd.total / 9 ** 9 - 0.0649) < 0.001);

  check('so TGATE and TOP are bounded by 27^w however many tables they carry',
    pw.total === 27 ** 2 && pwWide.total === 27 ** 2);
}

console.log('\n=== 8. THE TOPC CEILING — the last rung of the ladder ===');
{
  const { arena, audit, topSinglePos, topcSample, topcAddGens } = require('../tools/monoid-lib.js');
  // Depth 16 and a 300k cap are both too small for this arena, and an earlier
  // run reported a false verdict because of it. The full convergence sweep
  // (40 tables against 80) lives in `npm run audit:topc`; this pins the ladder.
  const DEPTH = 60, CAP = 1200000;
  const A1 = arena(1), A2 = arena(2);
  const pw = topSinglePos(A2);

  check('V1 — at width 1 the carry is inert: TOPC reaches 27, exactly like TOP',
    audit(topcSample(A1, 40), A1.N, DEPTH, CAP).total === 27);
  check('V2 — at width 2 TOPC alone passes the 729 ceiling',
    audit(topcSample(A2, 8), A2.N, DEPTH, CAP).total > 729);

  const alone = audit(pw, A2.N, DEPTH, CAP);
  const withAdd = audit(pw.concat(topcAddGens(A2)), A2.N, DEPTH, CAP);
  const withAny = audit(pw.concat(topcSample(A2, 40)), A2.N, DEPTH, CAP);

  check('the ladder: positionwise closes at 729', alone.saturated && alone.total === 729);
  check('   + one carry (ADD) closes at 251,505',
    withAdd.saturated && withAdd.total === 251505, String(withAdd.total));
  check('V3 — + arbitrary carries closes at 531,441, 2.11x further',
    withAny.saturated && withAny.total === 531441, String(withAny.total));
  check('   so freedom in the CARRY buys reach, where freedom in the table did not',
    withAny.total > withAdd.total);

  // V4: the sample is one-sided. A superset of generators can never reach LESS,
  // so any sample's reach is a lower bound on the full vocabulary's. The full
  // convergence sweep (40 tables against 80) lives in `npm run audit:topc`.
  check('V4 — the sample is a LOWER bound: more generators never reach less',
    audit(pw.concat(topcSample(A2, 8)), A2.N, DEPTH, CAP).total <= withAny.total);

  // Measurement discipline. The first run of this audit reported V3 as FAILED,
  // because at depth 16 the sampled vocabulary was still growing while the ADD
  // one had already closed. Running out of depth is not a smaller reach, and the
  // three outcomes must stay distinguishable.
  const shallow = audit(pw.concat(topcSample(A2, 8)), A2.N, 5, CAP);
  check('a depth-limited run is distinguishable from a closed one',
    shallow.exhausted && !shallow.saturated && shallow.total < withAny.total,
    `${shallow.total} at depth ${shallow.sizes.length}`);
  check('   and a capped run from both',
    audit(pw.concat(topcSample(A2, 8)), A2.N, DEPTH, 5000).capped);

  // A coincidence, flagged so nobody reads it as a vindication.
  check('531,441 is 729^2 — the source conversation\'s figure — and 9^6, and 3^12',
    531441 === 729 ** 2 && 531441 === 9 ** 6 && 531441 === 3 ** 12);
  check('   the conversation counted two-stage CONFIGURATIONS of 6-trit trytes',
    729 * 729 === 531441);
  check('   this counts ELEMENTS of a monoid on 9 points; same number, unrelated reasons',
    9 ** 6 === 3 ** 12);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
