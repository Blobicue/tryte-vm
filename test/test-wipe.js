'use strict';
/* test-wipe.js — can an erasing machine certify that a secret was wiped?
 *
 * Set `AO`. `F-REVERSIBLE-CANNOT-DESTROY` proved a reversible machine cannot delete;
 * this asks whether an erasing one can, and whether `AB`'s erasure measure is the right
 * certificate. A ceremony is modelled as a map from secret to public output over one
 * tryte, and what protects the secret afterwards is the PREIMAGE SIZE — the same
 * `n_y` that erasure is built from.
 *
 * The check worth keeping is `AO2` with `AO1`. Erasure is a MEAN and hiding is a
 * MINIMUM: the pseudorandom map reads a healthy 0.89 bits while 252 of 729 secrets are
 * recovered exactly from the output. Truncation — the construction `D4` disqualified
 * as evidence of mixing, because truncating a permutation is uniform by construction —
 * turns out to be exactly what a wipe needs, for that same reason.
 *
 * `AO1` failed, and the post-mortem is the methodological part: the band was fine and
 * the DRAW was not. A single fixed pseudorandom control cannot be scored against a
 * distributional null.
 *
 * The exhaustive version is `npm run audit:wipe`.
 */

const A = require('../tools/wipe-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.abs(b);

const { N, hiding, truncated, budget, CEREMONIES, RAND } = A;
const R = hiding(RAND);
const NULL_E = 0.8265, NULL_EXPOSED = 268.4, NULL_MISSING = 268.0;

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // A meter that cannot read both ends is not a meter. Erasure must be zero for a
  // bijection and log2(729) for a total collapse, or nothing below is a measurement.
  const perm = hiding(Int16Array.from({ length: N }, (_, i) => i));
  const konst = hiding(new Int16Array(N));
  check('a bijection reads exactly zero erasure and exposes every secret',
    perm.E === 0 && perm.exposed === N && perm.image === N);
  check('a total collapse reads log2(729) = 9.5098 and exposes none',
    Math.abs(konst.E - Math.log2(N)) < 1e-9 && konst.exposed === 0 && konst.image === 1);
  check('   so the two ends of the scale are pinned before any candidate is read',
    perm.E < konst.E && konst.E / Math.log2(N) === 1);

  // T-TOOL-CHECKED-ONLY-BY-IMPORT: importing sets MAIN false and skips the report.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'wipe-audit.js')], { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints every registered section',
    out.includes('WIPE AUDIT') && out.includes('AO1') && out.includes('AO4')
    && out.includes('beyond the registration'));

  // SCOPE, since T-SCOPE-DECIDES-THE-VERDICT has bitten four times: outputs that never
  // occur are not preimages of size zero. Counting them would report the safest map as
  // the most exposed, because a wipe with a small image has many unused outputs.
  check('outputs that never occur are excluded from the minimum, or a good wipe would '
    + 'score as fully exposed',
    hiding(truncated(3)).minPre === 27 && hiding(truncated(3)).image === 27);
}

console.log('\n=== 1. AO1 — FAILED, AND ON THE CONTROL RATHER THAN THE CLAIM ===');
{
  check('AO1 FAILED and stays failed: E is 0.8894 against a null of 0.8265, 7.6% out '
    + 'where 5% was registered',
    Math.abs(R.E - 0.8894) < 1e-4 && !near(R.E, NULL_E, 0.05),
    R.E.toFixed(4));
  check('   but the clause that carried the argument HELD: 252 secrets recovered '
    + 'exactly, within 10% of the 268 null',
    R.exposed === 252 && near(R.exposed, NULL_EXPOSED, 0.10));
  check('   which is 34.6% of every secret in the space, fully exposed while the '
    + 'average erasure reads healthy',
    Math.abs(100 * R.exposed / N - 34.6) < 0.1);
  check('   and the smallest preimage is 1, so the worst case is total exposure',
    R.minPre === 1);
  check('so E cannot certify a wipe — the third time a summary statistic has hidden '
    + 'the failure, after D4\'s collision count and AN1\'s mean',
    R.E > 0.8 && R.minPre === 1);
}

console.log('\n=== 2. AO2 — HELD: TRUNCATION IS THE WIPE ===');
{
  for (let m = 1; m <= 5; m++) {
    const h = hiding(truncated(m));
    if (m === 1) {
      check('AO2 HELD: truncating to m trits gives every output exactly 3^(6-m) '
        + 'preimages, minimum equal to maximum', h.flat && h.minPre === 3 ** (6 - m));
    } else if (!(h.flat && h.minPre === 3 ** (6 - m) && h.image === 3 ** m)) {
      check(`   still flat at m = ${m}`, false, `min ${h.minPre} max ${h.maxPre}`);
    }
  }
  check('   confirmed at every m from 1 to 5, not just the first',
    [1, 2, 3, 4, 5].every(m => { const h = hiding(truncated(m));
      return h.flat && h.minPre === 3 ** (6 - m) && h.image === 3 ** m; }));
  check('   and the pseudorandom map is not flat: preimages run 1 to 6',
    !R.flat && R.minPre === 1 && R.maxPre === 6);
  check('which is D4\'s disqualified uniformity, reused: worthless as evidence of '
    + 'mixing, and exactly what a wipe requires',
    hiding(truncated(3)).flat && hiding(truncated(3)).minPre === 27);
}

console.log('\n=== 3. AO3 — HELD: THE HIDING BUDGET, ATTAINED ONLY ON PURPOSE ===');
{
  check('the pigeonhole bound is image <= floor(729/h)',
    budget(1) === 729 && budget(3) === 243 && budget(9) === 81 && budget(27) === 27);
  check('AO3 HELD: truncation attains the bound exactly at every power of three',
    [1, 3, 9, 27].every(h => { const m = Math.round(Math.log(N / h) / Math.log(3));
      const t = hiding(truncated(Math.max(1, Math.min(6, m))));
      return t.minPre >= h && t.image === budget(h); }));
  check('   and the pseudorandom map attains it at none of them',
    [1, 3, 9, 27].every(h => !(R.minPre >= h && R.image === budget(h))));
  check('   so hiding costs output bits at a fixed rate: to hide each secret among 27, '
    + 'the output may carry only 4.755 of its 9.510 bits',
    Math.abs(Math.log2(budget(27)) - 4.7549) < 1e-3
    && Math.abs(Math.log2(budget(1)) - 9.5098) < 1e-3);
}

console.log('\n=== 4. AO4 — HELD: TWO RESULTS, ONE NUMBER ===');
{
  check('AO4 HELD: 252 fully-exposed secrets, within 10% of the 268 null',
    near(R.exposed, NULL_EXPOSED, 0.10));
  check('   and within 10% of AN3\'s measured 264 stranded blocks',
    near(R.exposed, 264, 0.10));
  check('   because P(Poisson(1) = 0) and P(= 1) are both 1/e, so the two tails are '
    + 'the same size by construction',
    Math.abs(NULL_MISSING - NULL_EXPOSED) / NULL_EXPOSED < 0.01);
  check('   and this map\'s own unused-output count is 283, the other tail of the '
    + 'same draw', N - R.image === 283);
}

console.log('\n=== 5. BEYOND THE REGISTRATION ===');
{
  check('a permutation exposes ALL 729 secrets, which is the reversibility corollary '
    + 'reached from the hiding side',
    hiding(CEREMONIES.permutation).exposed === N && hiding(CEREMONIES.permutation).E === 0);
  check('   and so does the affine map, for the same reason',
    hiding(CEREMONIES.affine).exposed === N && hiding(CEREMONIES.affine).E === 0);

  // 400 draws, to find out whether AO1 failed on the band or on the seed.
  const draws = [];
  for (let d = 0; d < 400; d++) {
    let s = 7000 + d * 9176;
    const m = new Int16Array(N);
    for (let i = 0; i < N; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; m[i] = s % N; }
    draws.push(hiding(m));
  }
  const Es = draws.map(d => d.E);
  const mean = Es.reduce((a, b) => a + b, 0) / Es.length;
  const sd = Math.sqrt(Es.reduce((a, b) => a + (b - mean) ** 2, 0) / Es.length);
  check('400 draws put the null dead on: mean E 0.8269 against a predicted 0.8265',
    near(mean, NULL_E, 0.01), mean.toFixed(4));
  check('   so the null model was right and the failure was not about the arithmetic',
    Math.abs(mean - NULL_E) < sd / 4);
  check('   the registered control sits 2.09 sd out — an atypical draw, not a typical one',
    Math.abs((R.E - mean) / sd - 2.09) < 0.05, ((R.E - mean) / sd).toFixed(2));
  check('   and 336 of 400 draws WOULD have passed the 5% band, so the band was '
    + 'reasonable and the seed was not',
    Es.filter(e => near(e, NULL_E, 0.05)).length === 336);
  check('T-CRITERION-IN-THE-NOISE: a single fixed pseudorandom map is one sample and '
    + 'the null is a spread — scoring one against the other is the defect',
    (R.E - mean) / sd > 2 && Es.filter(e => near(e, NULL_E, 0.05)).length / 400 > 0.8);
  check('   the exposed clause survived only because it was given a 10% band, on the '
    + 'same unlucky draw', near(R.exposed, NULL_EXPOSED, 0.10) && !near(R.E, NULL_E, 0.05));

  check('not one of 400 random maps is flat, so a balanced wipe never happens by accident',
    draws.filter(d => d.flat).length === 0);

  // The rule that replaces E.
  check('what certifies a wipe is the MINIMUM: for a flat map 2^E equals the worst case '
    + 'exactly, and for the pseudorandom map it overstates it by 1.85x',
    Math.abs(hiding(truncated(3)).avgHiding / hiding(truncated(3)).minPre - 1) < 1e-9
    && Math.abs(R.avgHiding / R.minPre - 1.85) < 0.01);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
