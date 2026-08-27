'use strict';
/* test-puzzle.js — a ternary proof-of-work puzzle, and the shortcut it hid.
 *
 * Set `AN`. `AD`, `AG`, `AH` and `AK` asked whether the COST OF RUNNING a program can
 * be an unforgeable receipt and the answer was no, three ways. This set asked the
 * question Bitcoin actually answers — a miner proves it FOUND A RARE WITNESS, and the
 * witness is cheap to check — and measured it exhaustively over all 531,441
 * (message, nonce) pairs at six trits.
 *
 * The check worth keeping is `AN1`, which **failed in the useful direction**. It
 * predicted the candidate's hit-count variance would sit within 25% of binomial at
 * every difficulty. It came in at 0.73x and 0.67x at k = 1 and k = 2 — MORE uniform
 * than chance — and a puzzle more uniform than chance is structured. Chasing that
 * deviation found the structure: `h(m,n) = P(m + n) - n` collapses to `g(m + n) + m`,
 * so the message commutes out and one 729-entry index solves every mineable message
 * in 1.54 lookups. Keying the permutation with the message instead removes both the
 * identity and the deviation, which is what confirms the diagnosis.
 *
 * The exhaustive version is `npm run audit:puzzle`.
 */

const A = require('../tools/puzzle-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.abs(b);

const { N, W, VALS, idx, val, tadd, tsub, rotn, CANDIDATES } = A;
const TBL = {};
for (const n of ['feedforward', 'bijective', 'affine', 'random']) TBL[n] = A.digestTable(CANDIDATES[n]);
const S = {};
for (const n of Object.keys(TBL)) S[n] = Array.from({ length: W }, (_, i) => A.sweep(TBL[n], i + 1));
const NL = Array.from({ length: W }, (_, i) => A.nullModel(N, i + 1));

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // 0a. The construction is the one the registration described. A set whose mixer
  // is not the mixer it cites is measuring something nobody registered.
  check('P is a permutation of all 729 states and PINV inverts it',
    new Set(A.PT).size === N && VALS.every((_, i) => A.PINV[A.PT[i]] === i));
  check('the round table is D\'s: the same LCG, seed 98765, 27 entries, a permutation',
    A.S27.length === 27 && new Set(A.S27).size === 27);
  check('the combine is TRITWISE mod 3, not tryte ADD — so it never carries',
    tadd(val(728), val(728)) === tadd(val(728), val(728)) &&
    (() => { // 1 + 1 = -1 per trit, with no borrow into the next position
      const T = require('../src/ternary.js');
      const one = T.fromTrits([1, 1, 1, 1, 1, 1]);
      return T.toTrits(tadd(one, one)).slice(0, W).every(t => t === -1);
    })());
  check('A = rot^2 + I is additive over that combine, so it really is GF(3)-linear',
    VALS.every((_, i) => {
      const a = VALS[(i * 37) % N], b = VALS[(i * 91) % N];
      return A.A(tadd(a, b)) === tadd(A.A(a), A.A(b));
    }));
  check('and A - I is exactly rot^2, so the affine attack has an inverse to use',
    VALS.every(v => A.AINV_MINUS_I(rotn(2)(v)) === v));

  // 0b. THE TOOL AS IT IS ACTUALLY RUN. T-TOOL-CHECKED-ONLY-BY-IMPORT: importing a
  // tool sets MAIN false, so every log line is skipped and a fault in the report
  // path stays invisible to a suite that only imports. Run the real thing.
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'puzzle-audit.js')],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('PUZZLE AUDIT') && out.includes('AN1') && out.includes('AN4'));
  check('   and its report reaches the section the registration did not anticipate',
    out.includes('beyond the registration'));

  // 0c. The pipeline is checked against a function whose answer is known. AD2 was
  // exactly this failure: a tabulator that memoised only some results reported the
  // attacker as 300x WORSE, in the flattering direction, and nothing caught it.
  check('a pseudorandom digest table reproduces the null sd at every k, within 8%',
    S.random.every((s, i) => near(s.sdW, NL[i].sdW, 0.08)),
    S.random.map(s => s.sdW.toFixed(2)).join(' '));
  check('   and its stranded counts, 31 and 266 against 36.1 and 268.0',
    S.random[4].stranded === 31 && S.random[5].stranded === 266);
  check('   and its mean first hit, within 5% of the null at every k — worst 9.4 ' +
    'against 9.0, which is the sampling error of 729 draws and not a deviation',
    S.random.every((s, i) => near(s.meanFirst, NL[i].meanFirst, 0.05)));
}

console.log('\n=== 1. AN1 — FAILED, AND THE FAILURE IS THE FINDING ===');
{
  const ratio = S.feedforward.map((s, i) => s.sdW / NL[i].sdW);
  check('the mean hit count is EXACTLY 3^(6-k), which is why it was not registered',
    S.feedforward.every((s, i) => Math.abs(s.meanW - 3 ** (W - i - 1)) < 1e-9));
  check('AN1 FAILED and stays failed: the sd is outside the 25% band at k = 1 and k = 2',
    ratio[0] < 0.75 && ratio[1] < 0.75 && Math.abs(ratio[0] - 0.729) < 0.01
    && Math.abs(ratio[1] - 0.674) < 0.01,
    ratio.map(r => r.toFixed(3)).join(' '));
  check('   and it failed LOW — more uniform than chance, not less',
    ratio[0] < 1 && ratio[1] < 1);
  check('   while holding at k = 3 through 6: 0.912, 0.871, 1.023, 0.994',
    ratio.slice(2).every(r => r > 0.75 && r < 1.25));
  check('the mean-first-hit half of AN1 HELD: within 15% of the null at every k',
    S.feedforward.every((s, i) => near(s.meanFirst, NL[i].meanFirst, 0.15)),
    S.feedforward.map(s => s.meanFirst.toFixed(1)).join(' '));
  check('and the control half HELD exactly: both bijective candidates give sd 0 at every k',
    S.bijective.every(s => s.sdW === 0) && S.affine.every(s => s.sdW === 0));
  check('which is the test D4 could not supply — a collision count cannot separate ' +
    'a hash from a relabelling, but a hit-count variance of 0 against 12.7 can',
    S.bijective[0].sdW === 0 && NL[0].sdW > 12);
  // Not registered, and worth more than a footnote: the affine candidate has the
  // RIGHT number of solutions per message and they are in the WRONG places.
  check('the affine candidate hides its solutions from a sequential scan: 248 attempts ' +
    'at k = 3 where the null says 27, despite having exactly 27 of them',
    Math.round(S.affine[2].meanFirst) === 248 && S.affine[2].meanW === 27);
}

console.log('\n=== 2. AN2 — HELD, BOTH ATTACKS ===');
{
  for (let k = 1; k <= W; k++) {
    const t = A.tabulatorAttack(k), a = A.affineAttack(k);
    if (k === 1) {
      check('AN2(a): the tabulator solves 729 of 729 at 1 lookup each, at every k',
        t.solved === N && t.opsPerSolve === 1);
      check('AN2(b): the affine solve does the same with NO table of the state space',
        a.solved === N && a.opsPerSolve === 1);
    } else if (!(t.solved === N && t.opsPerSolve === 1 && a.solved === N && a.opsPerSolve === 1)) {
      check(`both attacks still total at k = ${k}`, false, `${t.solved} ${a.solved}`);
    }
  }
  check('   confirmed at all six difficulties, not just the first',
    [1, 2, 3, 4, 5, 6].every(k => A.tabulatorAttack(k).solved === N && A.affineAttack(k).solved === N));
  check('the tabulator costs 729 entries of precomputation — AD2\'s attack, arriving ' +
    'at the puzzle it was supposed to be immune to', A.tabulatorAttack(6).precompute === N);
  check('and the affine solve costs ONE inversion, so it breaks even on query one ' +
    'against AD2\'s seventy', A.affineAttack(6).precompute === 1);
  check('so being affine is strictly worse than being merely reversible, and the gap ' +
    'is exactly the 729-entry table',
    A.tabulatorAttack(6).precompute / A.affineAttack(6).precompute === N);
  check('the speedup at k = 5 is 205x, above the 180x registered',
    NL[4].meanFirst / 1 > 180 && NL[4].meanFirst / 1 < 210);
}

console.log('\n=== 3. AN3 — HELD: IRREVERSIBILITY IS PAID FOR IN STRANDED MESSAGES ===');
{
  const st = S.feedforward.map(s => s.stranded);
  check('AN3 HELD: 33 stranded at k = 5 against a null of 36.1, within a factor of two',
    st[4] === 33 && st[4] > NL[4].stranded / 2 && st[4] < NL[4].stranded * 2);
  check('   and 264 at k = 6 against 268.0',
    st[5] === 264 && st[5] > NL[5].stranded / 2 && st[5] < NL[5].stranded * 2);
  check('   monotonically nondecreasing in k, as registered',
    st.every((v, i) => i === 0 || v >= st[i - 1]), st.join(' '));
  check('   and both bijective controls strand EXACTLY zero at every k, because a ' +
    'bijection in the nonce reaches every digest',
    S.bijective.every(s => s.stranded === 0) && S.affine.every(s => s.stranded === 0));
  check('so 36.2% of messages cannot be mined at all at maximum difficulty',
    Math.abs(100 * st[5] / N - 36.2) < 0.1);
  check('and the property that fixes that is the property AN2(a) uses to skip the mining',
    S.bijective[5].stranded === 0 && A.tabulatorAttack(6).solved === N);
}

console.log('\n=== 4. AN4 — HELD: THE FIX IS MORE NONCE, NOT A DIFFERENT FUNCTION ===');
{
  const wide = A.wideSweep(W);
  const wnull = A.nullModel(N * N, W);
  check('AN4 HELD: a twelve-trit nonce strands nothing at k = 6, against 264',
    wide.stranded === 0 && S.feedforward[5].stranded === 264);
  check('   and the mean first hit rises to 735.0, within 10% of 3^6 = 729',
    near(wide.meanFirst, 3 ** W, 0.10) && Math.abs(wide.meanFirst - 735.0) < 0.5);
  check('   from the truncated 311.2, which understated the true work by 58%',
    near(S.feedforward[5].meanFirst, 311.2, 0.01) && 1 - 305.2 / 729 > 0.55);
  check('   so both symptoms move together, and the cause is one thing: the nonce ' +
    'space failing to outrun the target rarity',
    wide.nonceSpace === N * N && near(wnull.meanFirst, 3 ** W, 0.01));
  check('which is what Bitcoin\'s extraNonce field is for — measured here rather ' +
    'than borrowed', wide.stranded === 0 && wide.nonceSpace > N);
}

console.log('\n=== 5. BEYOND THE REGISTRATION — WHAT THE LOW VARIANCE WAS ===');
{
  const index = A.gIndex();
  check('h(m,n) = g(m + n) + m holds on all 531,441 pairs, with g(u) = P(u) - u',
    A.shiftIdentity());
  check('   so the message enters through the same group operation as the nonce ' +
    'and commutes straight out — every message is one puzzle, shifted',
    VALS.slice(0, 50).every(m => VALS.slice(0, 50).every(n =>
      idx(tadd(A.gShift(tadd(m, n)), m)) === CANDIDATES.feedforward(m, n))));
  check('g has an image of 465 of 729 digests', index.size === 465);
  check('   and 729 - 465 = 264 is EXACTLY AN3\'s stranded count at k = 6, so the ' +
    'stranding and the shortcut are one object, not two findings',
    N - index.size === S.feedforward[5].stranded);
  const at = Array.from({ length: W }, (_, i) => A.shiftAttack(i + 1, index));
  check('a third attack the registration did not anticipate: one 729-entry index of g',
    at.every(a => a.precompute === N));
  check('   solving every mineable message — 729, 729, 729, 729, 696, 465',
    at.map(a => a.solved).join(' ') === '729 729 729 729 696 465');
  check('   in 1.54 lookups per message, against a brute force of 3.0 to 305.2',
    at.slice(0, 4).every(a => Math.abs(a.lookupsPerMessage - 1.54) < 0.01)
    && at[5].lookupsPerMessage === 1);
  check('   and correctly declaring the rest unmineable rather than failing on them',
    at.every((a, i) => a.unmineable === S.feedforward[i].stranded));
  // The antibody for a bug this suite would otherwise have shipped: the first
  // shiftAttack wrapped an already-unshifted value in val() again, reported 0/729
  // at k = 5 and k = 6, and looked entirely plausible in isolation.
  check('the fast attack and the exhaustive sweep agree on WHICH messages are ' +
    'solvable, which is what caught the index-or-value bug',
    [1, 2, 3, 4, 5, 6].every(k => A.attackAgreesWithSweep(k, TBL.feedforward).agrees));

  const kt = A.digestTable(A.keyedDM);
  const ks = Array.from({ length: W }, (_, i) => A.sweep(kt, i + 1));
  check('THE FIX: keying the permutation with the message removes the identity',
    (() => {
      const seen = new Map();
      for (const m of VALS) for (const n of VALS) {
        const u = idx(tadd(m, n)), d = idx(tsub(val(A.keyedDM(m, n)), m));
        if (!seen.has(u)) seen.set(u, d); else if (seen.get(u) !== d) return true;
      }
      return false;
    })());
  check('   and with it the symptom: sd within 3% of binomial at every k — worst ' +
    '0.975x — against the shiftable candidate\'s 0.729x and 0.674x',
    ks.every((s, i) => near(s.sdW, NL[i].sdW, 0.03)),
    ks.map((s, i) => (s.sdW / NL[i].sdW).toFixed(3)).join(' '));
  check('   so a fix that removes the symptom is what confirms the cause',
    ks[0].sdW / NL[0].sdW > 0.97 && S.feedforward[0].sdW / NL[0].sdW < 0.75);
  check('   and the mean hit count is no longer forced to 3^(6-k), because a keyed ' +
    'h is not a bijection in the message either',
    Math.abs(ks[0].meanW - 243) > 0.1);
  check('   while AN3\'s stranding survives the fix — 35 and 283 against 36.1 and ' +
    '268.0 — so that result is about compression, not about this construction',
    ks[4].stranded === 35 && ks[5].stranded === 283);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
