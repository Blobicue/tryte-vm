'use strict';
/* test-keylayer.js — a hash-only key layer, and what it costs.
 *
 * Set `AP`. `AN` found that mint-by-search is available where mint-by-receipt is not;
 * `AO` priced destroying a secret. Both left the same hole: a minted coin with no owner
 * is not a coin. A Lamport one-time signature fills it using nothing but a hash — no
 * curve, no pairing, no ceremony — and its one-shot restriction is the ledger's own
 * semantics rather than a defect: one mint, one key, one burn.
 *
 * ALL FOUR PREDICTIONS HELD, AND THAT IS THE FINDING WORTH KEEPING, IN THE UNFLATTERING
 * DIRECTION. `AP1` and `AP2` were genuine measurements. `AP3` and `AP4` were arithmetic
 * this file's own registration had already computed, and registering them was closer to
 * decoration than to prediction — which is the thing `AGENTS.md` warns about by name.
 * They are recorded as held and as ones that should not have been registered.
 *
 * The exhaustive version is `npm run audit:keylayer`.
 */

const A = require('../tools/keylayer-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.abs(b);

const T3 = A.scheme(729, 3), T2 = A.scheme(1024, 2);

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // The trap this set was most likely to fall into, pinned first: a logarithm cannot
  // be trusted to count positions. Math.log(729)/Math.log(3) is 6.0000000000000009,
  // and a ceiling turns 18 preimages into 21 — silently, and in the direction that
  // flatters ternary's rival.
  check('positions come from multiplication, not a logarithm: 729 in base 3 is 6',
    A.positions(729, 3) === 6 && Math.ceil(Math.log(729) / Math.log(3)) === 7);
  check('   and 3^6 is exactly 729, so the count is not a rounding',
    3 ** A.positions(729, 3) === 729);
  check('the two schemes are 18 and 20 preimages at their own digest spaces',
    T3.preimages === 18 && T2.preimages === 20 && T3.pos === 6 && T2.pos === 10);

  // A meter that cannot read both ends is not a meter.
  check('no signature forges nothing, and every signature forges everything',
    A.forgeable([], 729, 3, 6) === 0
    && A.forgeable(Array.from({ length: 729 }, (_, i) => i), 729, 3, 6) === 729);

  // T-TOOL-CHECKED-ONLY-BY-IMPORT.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'keylayer-audit.js')],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints every registered section',
    out.includes('KEYLAYER AUDIT') && out.includes('AP1') && out.includes('AP4'));
}

console.log('\n=== 1. AP1 — HELD: ONE SIGNATURE IS EXACTLY ONE MESSAGE ===');
{
  let worst = 0, offenders = 0;
  for (let m = 0; m < 729; m++) {
    const f = A.forgeable([m], 729, 3, 6);
    if (f > worst) worst = f;
    if (f !== 1) offenders++;
  }
  check('AP1 HELD: over all 729 signed messages the worst case forges exactly 1',
    worst === 1, String(worst));
  check('   and no signed message admits a second forgery', offenders === 0);
  check('   so the scheme is not broken at first use, which everything below assumes',
    worst === 1 && offenders === 0);
}

console.log('\n=== 2. AP2 — HELD: TWO SIGNATURES LEAK AT THE BINOMIAL RATE ===');
{
  let sum = 0, max = 0, min = Infinity, pairs = 0;
  for (let a = 0; a < 729; a++) {
    for (let c = 0; c < 729; c++) {
      const f = A.forgeable([a, c], 729, 3, 6);
      sum += f; pairs++;
      if (f > max) max = f;
      if (f < min) min = f;
    }
  }
  const mean = sum / pairs;
  check('all 531,441 ordered pairs swept', pairs === 729 * 729);
  check('AP2 HELD: the mean is 21.433 against a null of 21.43, inside 5%',
    near(mean, A.leakNull(3, 6), 0.05) && Math.abs(mean - 21.433) < 0.001,
    mean.toFixed(3));
  check('   and it agrees with the null to 0.01%, so the binomial model is the right one',
    near(mean, A.leakNull(3, 6), 0.0002));
  check('   the maximum is exactly 64 = 2^6, when the two messages differ everywhere',
    max === 64 && max === 2 ** 6);
  check('   and the minimum is exactly 1, reached only by signing the same message twice',
    min === 1);
  check('so a second signature hands away 2.94% of the space on average and 8.78% at worst',
    Math.abs(100 * mean / 729 - 2.94) < 0.01 && Math.abs(100 * max / 729 - 8.78) < 0.01);
}

console.log('\n=== 3. AP3 — HELD, BUT IT WAS ARITHMETIC ===');
{
  const l3 = A.leakNull(3, 6) / 729, l2 = A.leakNull(2, 10) / 1024;
  check('AP3 HELD: ternary leaks 2.94% of its space against binary\'s 5.63%',
    Math.abs(100 * l3 - 2.94) < 0.01 && Math.abs(100 * l2 - 5.63) < 0.01);
  check('   a factor of 1.92, against a registered 1.91', Math.abs(l2 / l3 - 1.92) < 0.01);
  check('   and the mechanism holds too: trits differ MORE often than bits, 2/3 to 1/2, '
    + 'yet leak less, because the position count falls faster than the rate rises',
    (3 - 1) / 3 > (2 - 1) / 2 && l3 < l2);
  // The honest note. Both sides of this comparison are closed forms the registration
  // itself computed before the run, so nothing here was ever at risk. AGENTS.md names
  // this failure directly: a fact that was never at risk inflates the record.
  check('AND IT SHOULD NOT HAVE BEEN REGISTERED: both figures are the closed form '
    + '(1+(b-1)/b)^pos, computed in the registration before the run',
    Math.abs(A.leakNull(3, 6) - Math.pow(5 / 3, 6)) < 1e-9
    && Math.abs(A.leakNull(2, 10) - Math.pow(3 / 2, 10)) < 1e-9);
}

console.log('\n=== 4. AP4 — HELD, AND ALSO ARITHMETIC ===');
{
  check('AP4 HELD: ternary destroys 12 of 18 preimages, binary 10 of 20',
    T3.destroyed === 12 && T3.preimages === 18
    && T2.destroyed === 10 && T2.preimages === 20);
  check('   two thirds against one half, which is (b-1)/b in both cases',
    Math.abs(T3.destroyed / T3.preimages - 2 / 3) < 1e-9
    && Math.abs(T2.destroyed / T2.preimages - 1 / 2) < 1e-9);

  // Measured with AB's own erasure rather than asserted: at one position the key is a
  // b-tuple of preimages and signing keeps exactly one, so the wipe IS a projection.
  const E = require('../tools/erasure-audit.js');
  const ALPHA = 3;
  const wipe = b => {
    const domain = ALPHA ** b;
    const image = new Int32Array(domain);
    for (let key = 0; key < domain; key++) image[key] = key % ALPHA;
    return E.erasureOf(image, domain);
  };
  const t3 = wipe(3) * T3.pos, t2 = wipe(2) * T2.pos;
  check('   and AB\'s erasure agrees the wipe is a projection: 3.1699 bits per ternary '
    + 'position, 1.5850 per binary one',
    Math.abs(wipe(3) - Math.log2(9)) < 1e-9 && Math.abs(wipe(2) - Math.log2(3)) < 1e-9);
  check('   so ternary destroys 19.020 bits of key material against binary\'s 15.850',
    Math.abs(t3 - 19.020) < 0.001 && Math.abs(t2 - 15.850) < 0.001);
  check('AP4 HELD: strictly more, so AP3\'s leak advantage is bought with a larger wipe',
    t3 > t2);
  check('AND THIS ONE WAS ARITHMETIC TOO: (b-1)/b and log2(ALPHA^(b-1)) are both closed '
    + 'forms, so the only thing measured was that erasureOf agrees with them',
    Math.abs(wipe(3) - (3 - 1) * Math.log2(ALPHA)) < 1e-9);
}

console.log('\n=== 5. THE DESIGN SWEEP, MEASURED BEFORE REGISTRATION ===');
{
  // F-LAMPORT-BASE-ADVANTAGE-IS-NOT-PER-SIZE. Recorded as unregistered because it was
  // run while choosing the arena, which is exactly when a fact stops being a prediction.
  const cost = (n, b) => A.positions(n, b) * b;
  const sizes = [27, 64, 81, 243, 256, 729, 1024, 2187, 4096, 6561];
  const ternaryWins = sizes.filter(n => cost(n, 3) < cost(n, 2));
  const binaryWins = sizes.filter(n => cost(n, 3) > cost(n, 2));
  const ties = sizes.filter(n => cost(n, 3) === cost(n, 2));
  check('the per-value cost b/ln(b) is minimised at 3 among integers, beating 2 by 5.4%',
    3 / Math.log(3) < 2 / Math.log(2)
    && Math.abs((1 - (3 / Math.log(3)) / (2 / Math.log(2))) * 100 - 5.4) < 0.1);
  check('but the advantage is NOT per-size: binary wins at 256 and 1024',
    binaryWins.join() === '256,1024');
  check('   ties at 64 and 4096', ties.join() === '64,4096');
  check('   and ternary takes the other six', ternaryWins.length === 6);
  check('so an asymptotic argument does not settle a particular width',
    binaryWins.length > 0 && 3 / Math.log(3) < 2 / Math.log(2));
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
