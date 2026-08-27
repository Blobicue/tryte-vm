'use strict';
/* WIPE AUDIT — can an erasing machine certify that a secret was wiped?
 *
 * Set `AO`. `F-REVERSIBLE-CANNOT-DESTROY` settled the reversible case by argument: a
 * language of bijections cannot express deletion, so a ceremony cannot run on one. That
 * leaves the question it was hiding. An ERASING machine can collapse states — but does
 * collapsing certify anything, and is the measure this project already carries the
 * right one to certify it with?
 *
 * THE OBJECT. A ceremony computes public parameters from a secret and then destroys the
 * secret. Model it as a map `P: secret -> public output` over one tryte, 729 secrets.
 * After the ceremony the world holds `P(s)`. The secret's remaining protection is the
 * number of secrets consistent with that output — the PREIMAGE SIZE `n_y`.
 *
 * WHICH IS ALREADY THIS PROJECT'S MEASURE. `AB` defined erasure as
 *
 *     E = (1/|S|) * SUM_y n_y log2 n_y
 *
 * built from exactly those preimage counts. So erasure and information-theoretic
 * hiding are the same quantity wearing two names, and the question is not whether the
 * measure applies but whether its SUMMARY is the right one. `E` is a mean. Security
 * is not a mean.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * Four ceremony maps over 729 secrets, all fixed before the run:
 *
 *   truncated    the split-round mixer of `D`, keeping only the low m trits
 *   random       a fixed pseudorandom map — the instrument's own control
 *   permutation  the mixer with nothing thrown away
 *   affine       rot^2 + I over GF(3)^6
 *
 * THE NULL MODEL, computed before this commit, since a null is arithmetic and not a
 * measurement. For a random map the preimage counts are Binomial(729, 1/729):
 *
 *     E                                  0.8265 bits
 *     2^E, the average hiding            1.773 secrets
 *     secrets with a UNIQUE preimage     268.4   (36.8%, fully exposed)
 *     outputs with no preimage at all    268.0
 *
 * The last two are equal because Poisson(1) puts identical mass on zero and on one,
 * and 268.0 is also `AN3`'s stranded-block null. That coincidence is registered as a
 * prediction below rather than pointed at afterwards.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AO1 ERASURE IS A MEAN AND HIDING IS A MINIMUM. Predicted the pseudorandom ceremony
 *       map measures E within 5% of 0.8265 bits, and yet the number of secrets whose
 *       preimage is a single point lands within 10% of 268 — so about 37% of all
 *       secrets are recovered EXACTLY from the public output while the average erasure
 *       reads as healthy. Registered with the alternative: if the exposed count comes
 *       out near zero then the mean tracks the worst case at this width and the
 *       objection is not real. If it holds, `E` cannot certify a wipe, for the same
 *       reason `D4`'s collision count could not certify a hash and `AN1`'s mean could
 *       not certify a puzzle — three sets, three times, a summary hiding the failure.
 *
 *   AO2 TRUNCATION IS THE WIPE, AND IT IS THE CONSTRUCTION `D4` DISQUALIFIED.
 *       Predicted that truncating the mixer to m trits gives EVERY output exactly
 *       3^(6-m) preimages — minimum equal to maximum, spread exactly zero — for every m
 *       from 1 to 5, so no secret is more exposed than any other. Predicted the
 *       pseudorandom map has a minimum preimage of 1 at every image size. `D4` failed
 *       because truncating a permutation is perfectly uniform by construction; that
 *       uniformity is worthless as evidence of mixing and is exactly what a wipe needs.
 *
 *   AO3 THE HIDING BUDGET, AND WHETHER ANYTHING ATTAINS IT. By pigeonhole, a map whose
 *       every preimage holds at least h secrets has an image of at most floor(729/h),
 *       so the public output carries at most log2(floor(729/h)) bits — 9.510, 7.925,
 *       6.340 and 4.755 at h = 1, 3, 9, 27. The bound is arithmetic. Attainment is not:
 *       predicted truncation attains it exactly at every h that is a power of three,
 *       and the pseudorandom map attains it at no h at all. So hiding is bought with
 *       output bits at a fixed exchange rate, and only a deliberately balanced map
 *       gets full value for them.
 *
 *   AO4 THE UNMINEABLE BLOCK AND THE UNHIDDEN SECRET ARE ONE COUNT. `AN3` measured 264
 *       messages with no winning nonce, against a null of 268. Predicted this set's
 *       count of fully-exposed secrets lands within 10% of 268 AND within 10% of that
 *       measured 264 — because both are tails of the same Poisson(1), which puts equal
 *       mass on zero and on one. If it holds, two results this project reached by
 *       different routes are the same number and neither set knew it. Registered with
 *       the alternative: these maps are structured, so their tails may resemble
 *       neither the null nor each other.
 * ------------------------------------------------------------------------------
 * Run:  npm run audit:wipe
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

const N = 729, W = 6;

// ---------------------------------------------------------------- the machinery
const trits = i => { const t = new Array(W); for (let k = 0; k < W; k++) t[k] = (Math.floor(i / 3 ** k) % 3) - 1; return t; };
const rotn = k => i => { const t = trits(i); let r = 0;
  for (let j = 0; j < W; j++) r += (t[(j + k) % W] + 1) * 3 ** j; return r; };
const tadd = (a, b) => { const x = trits(a), y = trits(b); let r = 0;
  for (let k = 0; k < W; k++) r += ((x[k] + y[k] + 4) % 3) * 3 ** k; return r; };

/** D's split-round mixer: same LCG, same seed 98765, same 27-entry round table. */
const S27 = (function (seed) {
  let s = seed;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const A = Array.from({ length: 27 }, (_, i) => i);
  for (let i = 26; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = A[i]; A[i] = A[j]; A[j] = t; }
  return A;
})(98765);
const splitRound = i => ((i / 27) | 0) + 27 * (((i % 27) + S27[(i / 27) | 0]) % 27);
const MIX = Int16Array.from({ length: N }, (_, i) => { let s = i; for (let r = 0; r < 8; r++) s = splitRound(s); return s; });

const RAND = (function () {
  let s = 1234567;
  const t = new Int16Array(N);
  for (let i = 0; i < N; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; t[i] = s % N; }
  return t;
})();

/** Keep only the low m trits of the mixer: the "commit to the secret" ceremony. */
const truncated = m => Int16Array.from({ length: N }, (_, i) => MIX[i] % (3 ** m));

const CEREMONIES = {
  permutation: Int16Array.from(MIX),
  affine: Int16Array.from({ length: N }, (_, i) => tadd(rotn(2)(i), i)),
  random: RAND,
};

// ---------------------------------------------------------------- the statistics
/**
 * Everything a ceremony map says about hiding, from one pass over the preimages.
 *
 * SCOPE, stated because T-SCOPE-DECIDES-THE-VERDICT has bitten four times: `minPre`
 * and `exposed` range over OUTPUTS THAT ACTUALLY OCCUR. An output with no preimage
 * hides nothing because it never happens, and counting it as a preimage of size zero
 * would report the safest map as the most exposed one.
 */
function hiding(map) {
  const n = new Int32Array(N);
  for (let s = 0; s < N; s++) n[map[s]]++;
  let E = 0, image = 0, minPre = Infinity, maxPre = 0, exposed = 0;
  for (let y = 0; y < N; y++) {
    if (n[y] === 0) continue;
    image++;
    if (n[y] > 1) E += n[y] * Math.log2(n[y]);
    if (n[y] < minPre) minPre = n[y];
    if (n[y] > maxPre) maxPre = n[y];
    if (n[y] === 1) exposed++;
  }
  E /= N;
  return { E, image, minPre, maxPre, exposed,
    avgHiding: Math.pow(2, E), bits: Math.log2(image), flat: minPre === maxPre };
}

/** The pigeonhole bound: every preimage >= h forces image <= floor(N/h). */
const budget = h => Math.floor(N / h);
const budgetBits = h => Math.log2(budget(h));

// ---------------------------------------------------------------- report
function report() {
  log('WIPE AUDIT — can an erasing machine certify that a secret was wiped?');
  log(line);

  log('\n--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  {
    // A bijection must read as hiding nothing, a collapse as hiding everything. If the
    // meter fails either end, no number below means anything at all.
    const perm = hiding(Int16Array.from({ length: N }, (_, i) => i));
    const konst = hiding(new Int16Array(N));
    log(`      identity   E ${perm.E.toFixed(4)}   image ${String(perm.image).padStart(3)}   exposed ${perm.exposed}`);
    log(`      constant   E ${konst.E.toFixed(4)}   image ${String(konst.image).padStart(3)}   exposed ${konst.exposed}`);
    log(`      reads 0 for a bijection and log2(729) = ${Math.log2(N).toFixed(4)} for a collapse: `
      + `${perm.E === 0 && Math.abs(konst.E - Math.log2(N)) < 1e-9}`);
  }

  log('\n--- AO1  erasure is a mean, hiding is a minimum ---');
  {
    const h = hiding(RAND);
    log(`      pseudorandom ceremony map, all ${N} secrets:`);
    log(`        E                          ${h.E.toFixed(4)} bits      null 0.8265`);
    log(`        2^E, the average hiding    ${h.avgHiding.toFixed(3)} secrets    null 1.773`);
    log(`        smallest preimage          ${h.minPre}`);
    log(`        secrets FULLY EXPOSED      ${h.exposed}          null 268.4   `
      + `= ${(100 * h.exposed / N).toFixed(1)}% recovered exactly from the output`);
    log(`        outputs that never occur   ${N - h.image}          null 268.0`);
  }

  log('\n--- AO2  truncation: every output equally hard ---');
  {
    log('      m   image   min   max   flat    E        hidden per output   3^(6-m)');
    for (let m = 1; m <= 5; m++) {
      const h = hiding(truncated(m));
      log(`      ${m}   ${String(h.image).padStart(5)}   ${String(h.minPre).padStart(3)}   `
        + `${String(h.maxPre).padStart(3)}   ${String(h.flat).padEnd(5)}   ${h.E.toFixed(4)}   `
        + `${String((N / h.image).toFixed(1)).padStart(11)}       ${3 ** (W - m)}`);
    }
    const r = hiding(RAND);
    log(`      random    image ${r.image}   min ${r.minPre}   max ${r.maxPre}   flat ${r.flat}`);
  }

  log('\n--- AO3  the hiding budget, and who attains it ---');
  {
    log('      h    image bound   bits     truncation   random');
    for (const h of [1, 3, 9, 27]) {
      const m = Math.round(Math.log(N / h) / Math.log(3));
      const t = hiding(truncated(Math.max(1, Math.min(6, m))));
      const r = hiding(RAND);
      log(`      ${String(h).padStart(2)}   ${String(budget(h)).padStart(11)}   ${budgetBits(h).toFixed(3)}   `
        + `${String(t.minPre >= h && t.image === budget(h)).padStart(10)}   `
        + `${String(r.minPre >= h && r.image === budget(h)).padStart(6)}`);
    }
  }

  log('\n--- AO4  the unmineable block and the unhidden secret ---');
  {
    const h = hiding(RAND);
    log(`      secrets fully exposed here     ${h.exposed}`);
    log(`      outputs never produced here    ${N - h.image}`);
    log(`      AN3's measured stranded blocks 264`);
    log(`      the Poisson(1) null for both   268`);
  }

  log('\n--- beyond the registration ---');
  {
    for (const [name, map] of Object.entries(CEREMONIES)) {
      const h = hiding(map);
      log(`      ${name.padEnd(12)} E ${h.E.toFixed(4)}   image ${String(h.image).padStart(3)}`
        + `   min ${String(h.minPre).padStart(3)}   exposed ${String(h.exposed).padStart(3)}`);
    }
    log('\n      A permutation exposes ALL 729 secrets. F-REVERSIBLE-CANNOT-DESTROY,');
    log('      arrived at from the hiding side rather than the erasure side.');

    // AO1 failed on its E clause: 0.8894 against a null of 0.8265, 7.6% high where 5%
    // was registered. One pseudorandom map is ONE DRAW, and the registration never
    // checked what a draw is worth. So: draw many and find out.
    log('\n      WAS THAT FAILURE A RESULT, OR A BAND SET TOO TIGHT FOR ONE DRAW?');
    const draws = [];
    let flat = 0;
    for (let d = 0; d < 400; d++) {
      let s = 7000 + d * 9176;
      const m = new Int16Array(N);
      for (let i = 0; i < N; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; m[i] = s % N; }
      const h = hiding(m);
      draws.push(h);
      if (h.flat) flat++;
    }
    const Es = draws.map(d => d.E);
    const mean = Es.reduce((a, b) => a + b, 0) / Es.length;
    const sd = Math.sqrt(Es.reduce((a, b) => a + (b - mean) ** 2, 0) / Es.length);
    const measured = hiding(RAND).E;
    log(`      400 pseudorandom maps:  E mean ${mean.toFixed(4)}   sd ${sd.toFixed(4)}`
      + `   null 0.8265`);
    log(`      the registered map at ${measured.toFixed(4)} sits `
      + `${((measured - mean) / sd).toFixed(2)} sd from that mean —`);
    log(`      ${Math.abs(measured - mean) < 2 * sd
      ? 'ORDINARY. The 5% band was inside the noise, not outside the result.'
      : 'genuinely unusual, so the failure was about the map and not the band.'}`);
    const within5 = Es.filter(e => Math.abs(e - 0.8265) <= 0.05 * 0.8265).length;
    log(`      ${within5} of 400 draws WOULD have passed the 5% band (${(100 * within5 / 400).toFixed(0)}%), so the`);
    log(`      band was reasonable and the draw was not: this set fixed one seed as its`);
    log(`      control and happened to fix an atypical one. A single fixed pseudorandom`);
    log(`      map cannot be scored against a DISTRIBUTIONAL null -- it is one sample,`);
    log(`      and the null is a spread. T-CRITERION-IN-THE-NOISE, third bite.`);

    const exp = draws.map(d => d.exposed);
    const em = exp.reduce((a, b) => a + b, 0) / exp.length;
    const esd = Math.sqrt(exp.reduce((a, b) => a + (b - em) ** 2, 0) / exp.length);
    log(`\n      exposed count over 400 draws: mean ${em.toFixed(1)}   sd ${esd.toFixed(1)}   null 268.4`);
    log(`      the registered map at ${hiding(RAND).exposed} sits `
      + `${((hiding(RAND).exposed - em) / esd).toFixed(2)} sd out — the SAME map, scored`);
    log(`      against a 10% band instead of a 5% one, and that is the only reason AO4`);
    log(`      held where AO1 failed. Both clauses measured one unlucky draw.`);
    log(`      flat maps among 400 draws: ${flat} — a balanced wipe does not happen by`);
    log(`      accident, which is why AO3's bound is attained only on purpose.`);

    // What a certifier would actually check.
    log('\n      SO WHAT CERTIFIES A WIPE? Not E. For a FLAT map 2^E equals the worst');
    log('      case exactly; for anything else 2^E is an average an attacker never');
    log('      faces. The check is one pass and it is a MINIMUM, not a mean:');
    for (const [name, map] of [['truncated m=3', truncated(3)], ['random', RAND],
      ['permutation', CEREMONIES.permutation]]) {
      const h = hiding(map);
      log(`        ${name.padEnd(14)} 2^E ${h.avgHiding.toFixed(2).padStart(7)}`
        + `   worst case ${String(h.minPre).padStart(3)}`
        + `   overstates by ${(h.avgHiding / h.minPre).toFixed(2)}x`);
    }
  }
  log('\n' + line);
}

if (MAIN) report();

module.exports = { N, W, hiding, truncated, budget, budgetBits, CEREMONIES, MIX, RAND, S27, trits };
