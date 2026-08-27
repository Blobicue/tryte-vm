'use strict';
/* TUNING AUDIT — which musical layers actually favour which base?
 *
 * WHY THIS SET EXISTS
 * -------------------
 * AE2 and AE4 measured one musical affordance -- how many chords transpose onto
 * themselves -- found Z/27 poor at it, and the write-up generalised that to "here
 * ternary is genuinely worse", which is T-CLAIM-NARROWED-BY-A-DESIGN's third bite
 * and the first scored against this project's prose. The claim has been narrowed.
 * This set measures the layers that were skipped, because a claim withdrawn without
 * a replacement leaves the question open rather than answered.
 *
 * Music is not one thing. A number system can be good at one layer and bad at
 * another, and the layers are independent:
 *
 *   harmonic symmetry  which chords map onto themselves      AE2, AE4 -- measured
 *   consonance         how close the fifths and thirds are   NEVER MEASURED HERE
 *   rhythm             which subdivisions are exact          NEVER MEASURED HERE
 *   addressing         how a pad set factors                 arithmetic, 9 = 3 x 3
 *
 * The two never measured are exactly the two the overclaim stepped on.
 *
 * THE MEASURES
 * ------------
 * Consonance: for an equal division of the octave into n steps and a just ratio r,
 * the nearest available interval is round(n*log2 r) steps, and the error in cents is
 * |1200*(round(n*log2 r)/n - log2 r)|. That is the standard construction and it is
 * not a convention: the just ratios are where coinciding harmonics actually fall.
 *
 * Rhythm: a subdivision 1/d is exactly representable in base b iff every prime
 * factor of d divides b. Nothing psychoacoustic, just whether the expansion
 * terminates.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered before the run, per AGENTS.md.
 *
 *   AF1 "ternary tuning is bad" is FALSE AS STATED, and the shape of its falseness
 *       is that a division is good at some intervals and bad at others. Predicted:
 *       Z/27's perfect fifth is worse than Z/12's by more than a factor of four,
 *       and Z/27's harmonic seventh (7:4) is BETTER than Z/12's by more than a
 *       factor of three. Predicted Z/27's minor third also beats Z/12's. Registered
 *       with the alternative: if Z/27 is worse on every one of the six ratios
 *       swept, then the withdrawn claim was right for a reason nobody had given and
 *       should be reinstated with that reason.
 *
 *   AF2 the divisor advantage AE2 found belongs to COMPOSITENESS, not to binary.
 *       Twelve is 2^2 x 3 -- neither a power of two nor a power of three, so it
 *       belongs to neither radix. Predicted: over n <= 100, no power of two and no
 *       power of three has more than 7 divisors, while the maximum over all n in
 *       that range is at least 12. Predicted the divisor counts of 32 and 27 differ
 *       by no more than 2, so POWERS OF TWO ARE POOR ON THE SAME SCALE AS POWERS OF
 *       THREE and the AE2 result never was a binary-versus-ternary result.
 *
 *   AF3 rhythm does not favour ternary either, and my own claim that it does was
 *       made without measuring. Over the common Western subdivisions of a beat --
 *       halves, thirds, quarters, sixths, eighths and twelfths -- predicted base 2
 *       represents exactly THREE of the six and base 3 exactly ONE, so the offhand
 *       claim that rhythm favours base three is wrong on the ordinary repertoire.
 *       Predicted the subdivisions neither base gets are exactly those with both 2
 *       and 3 as factors, which is again compositeness rather than either radix.
 *
 *   AF4 so music wants two and three TOGETHER at every layer measured. Predicted:
 *       the n minimising total consonance error over the six ratios, among all n
 *       from 5 to 72, is divisible by both 2 and 3; predicted the same of the n
 *       maximising divisor count in that range; and predicted that the best pure
 *       power of three and the best pure power of two are each beaten by at least
 *       one composite smaller than either. If all three hold, the honest statement
 *       is not that ternary is bad for music but that NO PURE RADIX IS, and 12
 *       earned its place by being 2^2 x 3.
 *
 * ------------------------------------------------------------------------------
 * Run: node tools/tuning-audit.js
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

log('TUNING AUDIT — which musical layers favour which base?\n');

/** The just intervals, as ratios. These are where coinciding harmonics fall. */
const JUST = [
  { name: 'octave', r: 2 / 1 },
  { name: 'perfect fifth', r: 3 / 2 },
  { name: 'perfect fourth', r: 4 / 3 },
  { name: 'major third', r: 5 / 4 },
  { name: 'minor third', r: 6 / 5 },
  { name: 'harmonic 7th', r: 7 / 4 },
];
const CENTS = r => 1200 * Math.log2(r);

/** Error in cents of n-EDO's nearest approximation to ratio r. */
function edoError(n, r) {
  const exact = n * Math.log2(r);
  const steps = Math.round(exact);
  return { steps, cents: Math.abs(1200 * (steps / n - Math.log2(r))) };
}
const totalError = n => JUST.filter(j => j.r !== 2).reduce((s, j) => s + edoError(n, j.r).cents, 0);

const divisors = n => { const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; };
const primeFactors = n => { const f = new Set(); let m = n; for (let p = 2; p <= m; p++) while (m % p === 0) { f.add(p); m /= p; } return f; };
/** 1/d terminates in base b iff every prime factor of d divides b. */
const exactIn = (d, b) => [...primeFactors(d)].every(p => b % p === 0);

/* ============================================================================
 * 0. INSTRUMENT CHECK
 * ========================================================================== */
log(line);
log('0. INSTRUMENT CHECK');
log(line);
{
  log(`  a just fifth is ${CENTS(3 / 2).toFixed(3)} cents  (must be 701.955)`);
  log(`  12-EDO's fifth is 7 steps = 700 cents, so it is off by ${edoError(12, 3 / 2).cents.toFixed(3)}`);
  log(`  and 12-EDO takes 7 steps to get there: ${edoError(12, 3 / 2).steps === 7}`);
  log(`  the octave is exact in every EDO by construction: ${[5, 12, 27, 31].every(n => edoError(n, 2).cents < 1e-9)}`);
  log(`  1/3 terminates in base 3 but not base 2: ${exactIn(3, 3) === true && exactIn(3, 2) === false}`);
  log(`  1/8 terminates in base 2 but not base 3: ${exactIn(8, 2) === true && exactIn(8, 3) === false}`);
  log(`  1/6 terminates in NEITHER, because 6 = 2 x 3: ${!exactIn(6, 2) && !exactIn(6, 3)}`);
  log(`  and the harness would notice a wrong claim: 1/2 does terminate in base 2 (${exactIn(2, 2)})`);
}

/* ============================================================================
 * 1. AF1 — consonance, the axis the overclaim stepped on.
 * ========================================================================== */
log('\n' + line);
log('1. AF1 — how close are the fifths and thirds?');
log(line);
{
  const EDOS = [12, 27, 9, 81, 8, 16, 32, 19, 31];
  log('  cents of error, nearest approximation:');
  log('   EDO    ' + JUST.map(j => j.name.padStart(15)).join('') + '      total');
  log('  ' + '-'.repeat(76));
  for (const n of EDOS) {
    const errs = JUST.map(j => edoError(n, j.r).cents);
    log(`  ${String(n).padStart(4)}    ` + errs.map(e => e.toFixed(2).padStart(15)).join('') +
      `  ${totalError(n).toFixed(2).padStart(9)}`);
  }
  log('');
  const f12 = edoError(12, 3 / 2).cents, f27 = edoError(27, 3 / 2).cents;
  const s12 = edoError(12, 7 / 4).cents, s27 = edoError(27, 7 / 4).cents;
  const m12 = edoError(12, 6 / 5).cents, m27 = edoError(27, 6 / 5).cents;
  log(`  perfect fifth:  12-EDO ${f12.toFixed(3)}   27-EDO ${f27.toFixed(3)}   ratio ${(f27 / f12).toFixed(2)}x WORSE for 27`);
  log(`  harmonic 7th:   12-EDO ${s12.toFixed(3)}   27-EDO ${s27.toFixed(3)}   ratio ${(s12 / s27).toFixed(2)}x BETTER for 27`);
  log(`  minor third:    12-EDO ${m12.toFixed(3)}   27-EDO ${m27.toFixed(3)}   ` +
    `${m27 < m12 ? 'BETTER for 27' : 'worse for 27'}`);
  log('');
  log(`  So a division is good at some intervals and bad at others, and "ternary`);
  log(`  tuning is bad" is not the kind of statement the measurement supports.`);
}

/* ============================================================================
 * 2. AF2 — whose advantage is compositeness?
 * ========================================================================== */
log('\n' + line);
log('2. AF2 — powers of two are divisor-poor too');
log(line);
{
  const pow2 = [2, 4, 8, 16, 32, 64], pow3 = [3, 9, 27, 81];
  log('   n     divisors   n     divisors');
  log('  ' + '-'.repeat(38));
  for (let i = 0; i < Math.max(pow2.length, pow3.length); i++) {
    const a = pow2[i], b = pow3[i];
    log(`  ${String(a ?? '').padStart(4)}   ${String(a ? divisors(a).length : '').padStart(8)}   ` +
      `${String(b ?? '').padStart(4)}   ${String(b ? divisors(b).length : '').padStart(8)}`);
  }
  const maxPow = Math.max(...[...pow2, ...pow3].filter(n => n <= 100).map(n => divisors(n).length));
  let best = 1;
  for (let n = 1; n <= 100; n++) if (divisors(n).length > divisors(best).length) best = n;
  log('');
  log(`  best divisor count among powers of 2 or 3 up to 100: ${maxPow}`);
  log(`  best divisor count among ALL n up to 100: ${divisors(best).length}, at n = ${best}`);
  log(`  32 has ${divisors(32).length} divisors; 27 has ${divisors(27).length} — a difference of ${Math.abs(divisors(32).length - divisors(27).length)}`);
  log(`  12 = 2^2 x 3 has ${divisors(12).length}, and is a power of NEITHER radix`);
  log('');
  log(`  AE2 was never a binary-versus-ternary result. Both pure radices are poor;`);
  log(`  the advantage belongs to compositeness.`);
}

/* ============================================================================
 * 3. AF3 — rhythm, and a claim I made without measuring it.
 * ========================================================================== */
log('\n' + line);
log('3. AF3 — which beat subdivisions are exact?');
log(line);
{
  const SUBS = [2, 3, 4, 6, 8, 12];
  log('   1/d    base 2    base 3    base 6    base 12');
  log('  ' + '-'.repeat(46));
  for (const d of SUBS)
    log(`  ${('1/' + d).padStart(5)}  ${(exactIn(d, 2) ? 'exact' : '  -  ').padStart(8)}  ` +
      `${(exactIn(d, 3) ? 'exact' : '  -  ').padStart(8)}  ${(exactIn(d, 6) ? 'exact' : '  -  ').padStart(8)}  ` +
      `${(exactIn(d, 12) ? 'exact' : '  -  ').padStart(8)}`);
  const c2 = SUBS.filter(d => exactIn(d, 2)).length;
  const c3 = SUBS.filter(d => exactIn(d, 3)).length;
  const c6 = SUBS.filter(d => exactIn(d, 6)).length;
  log('');
  log(`  base 2 gets ${c2} of ${SUBS.length};  base 3 gets ${c3};  base 6 gets ${c6}`);
  log(`  the ones neither base gets: ${SUBS.filter(d => !exactIn(d, 2) && !exactIn(d, 3)).map(d => '1/' + d).join(' ')}`);
  log(`  and those are exactly the d with BOTH 2 and 3 as factors: ` +
    `${SUBS.filter(d => !exactIn(d, 2) && !exactIn(d, 3)).every(d => d % 2 === 0 && d % 3 === 0)}`);
  log('');
  log(`  "Rhythm favours ternary" was said here without measuring it. On the ordinary`);
  log(`  repertoire base two gets more of the subdivisions, because Western notation`);
  log(`  is halves-quarters-eighths. Triplets need three; compound meter needs both.`);
}

/* ============================================================================
 * 4. AF4 — what music actually wants.
 * ========================================================================== */
log('\n' + line);
log('4. AF4 — the n that win, and what they have in common');
log(line);
{
  const RANGE = [];
  for (let n = 5; n <= 72; n++) RANGE.push(n);
  const bestTune = RANGE.reduce((a, b) => (totalError(b) < totalError(a) ? b : a));
  const bestDiv = RANGE.reduce((a, b) => (divisors(b).length > divisors(a).length ? b : a));
  const top = [...RANGE].sort((a, b) => totalError(a) - totalError(b)).slice(0, 6);
  log(`  lowest total consonance error, n = 5..72: ${bestTune}  (${totalError(bestTune).toFixed(2)} cents)`);
  log(`  the best six: ${top.map(n => `${n} (${totalError(n).toFixed(1)})`).join(', ')}`);
  log(`  most divisors in the same range: ${bestDiv}  (${divisors(bestDiv).length})`);
  log('');
  log(`  ${bestTune} divisible by 2 and 3: ${bestTune % 6 === 0}`);
  log(`  ${bestDiv} divisible by 2 and 3: ${bestDiv % 6 === 0}`);
  const bestP3 = [9, 27, 81].filter(n => n <= 72).reduce((a, b) => (totalError(b) < totalError(a) ? b : a));
  const bestP2 = [8, 16, 32, 64].reduce((a, b) => (totalError(b) < totalError(a) ? b : a));
  const beatsP3 = RANGE.filter(n => n < bestP3 && totalError(n) < totalError(bestP3));
  const beatsP2 = RANGE.filter(n => n < bestP2 && totalError(n) < totalError(bestP2));
  log('');
  log(`  best pure power of three in range: ${bestP3} (${totalError(bestP3).toFixed(2)}) — beaten by ${beatsP3.length} smaller n, e.g. ${beatsP3.slice(0, 4).join(' ')}`);
  log(`  best pure power of two in range:   ${bestP2} (${totalError(bestP2).toFixed(2)}) — beaten by ${beatsP2.length} smaller n, e.g. ${beatsP2.slice(0, 4).join(' ')}`);
  log('');
  log(`  Music wants two AND three, at every layer measured here. The honest claim is`);
  log(`  not that ternary is bad for music but that NO PURE RADIX IS GOOD FOR IT, and`);
  log(`  twelve earned its place by being 2^2 x 3.`);
}

log('\n' + line);
log('Registered predictions AF1-AF4 are in this file\'s docstring. Outcomes go to');
log('FINDINGS.json and are asserted in test/test-tuning.js.');
log(line);

module.exports = { JUST, CENTS, edoError, totalError, divisors, primeFactors, exactIn };
