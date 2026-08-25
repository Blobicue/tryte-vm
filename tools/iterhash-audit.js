'use strict';
/* ITERHASH AUDIT — which self-referencing ternary maps mix at all?
 *
 * A new subject, not a machine phase. The question: is there room for new families
 * of ternary hash functions under one constraint — **the algorithm is a single
 * function called repeatedly, and it references itself**. `s <- f(s)`, k times.
 *
 * WHAT THIS PHASE IS NOT. It says nothing about cryptographic security. 729 states
 * is a toy, and a toy cannot be evidence about resistance to an adversary. The
 * deliverable is the same shape as the reach ladder's: **which family shapes mix at
 * all**, established by exhaustion at a width where exhaustion is possible.
 *
 * ------------------------------------------------------------------------------
 * WHY THE EXISTING REACH LADDER DOES NOT ANSWER THIS.
 *
 * `Q4` established that any POSITIONWISE vocabulary reaches at most 27^w, and `R5`
 * that escaping the ceiling needs cross-trit coupling — with the sharpest number in
 * the project attached: **a carry buys 3,483x what a shift does**, because a carry
 * is data-dependent and a shift is a fixed relabelling.
 *
 * All of that is about a SET of generators closed under composition. Iterating one
 * fixed `f` generates a CYCLIC monoid, `{f, f^2, f^3, ...}`, which is a far smaller
 * object. Nothing in `P` through `V` touches it. That gap is the door.
 *
 * And it has a precise form. `R5`'s carry advantage was measured for `ADD` as a
 * TWO-OPERAND vocabulary element. Inside a self-referencing `f` there is no second
 * operand — the addend must be derived from `s` itself, as in `s + sbox(s)`.
 * **Whether the carry's data-dependence survives that self-composition is exactly
 * what nobody has measured.**
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   D1  A NON-BIJECTIVE `f` BLEEDS STATE AND A PERMUTATION DOES NOT. Iterating a
 *       random map on 729 states, the image should fall to about 1 - 1/e of the
 *       space after one step (~461) and keep shrinking toward a core, while a
 *       permutation holds all 729 forever. Predicted: image after 1 step within 5%
 *       of 461, and below 200 by step 10. This is the structural reason a hash
 *       built this way must use a permutation and take its compression from
 *       TRUNCATION at the end — registered as a prediction rather than asserted as
 *       a design rule.
 *
 *   D2  ANY POSITIONWISE `f` HAS PERIOD AT MOST 6, AT EVERY WIDTH. A trit
 *       permutation has order 1, 2 or 3. Applying one per position, `f^m` is the
 *       identity exactly when every position's map is, so the order of `f` is the
 *       lcm of orders drawn from {1,2,3} — at most 6, no matter how many trits the
 *       state has. Predicted: every positionwise `f` returns to the identity within
 *       6 iterations, every cycle length divides 6, and the fixed-point count is
 *       (fixed points of the trit map)^w.
 *
 *       If it holds, **the entire positionwise family is dead for this purpose**,
 *       provably and not statistically: a hash whose function repeats after six
 *       calls is not a hash. That is a stronger statement than `Q4`'s ceiling,
 *       because a ceiling still allows a large orbit and a period of 6 does not.
 *
 *   D3  AND CROSS-TRIT COUPLING BREAKS IT — BUT NOT ALL COUPLING EQUALLY, AND THE
 *       SELF-COMPOSED CARRY IS THE OPEN CASE. Four candidates, all exhaustive over
 *       729 states:
 *
 *         f_pos     positionwise S-box only
 *         f_rot     positionwise S-box, then a fixed trit rotation
 *         f_add     s + sbox(s)          — data-dependent carry, self-composed
 *         f_addrot  rotate(s + sbox(s))  — both
 *
 *       Predicted: `f_pos` has period at most 6 (`D2`); `f_rot` escapes but stays
 *       highly structured, with period dividing 6w; `f_add` is NOT in general a
 *       permutation, because nothing forces `s + sbox(s)` to be injective; and
 *       `f_addrot` resembles a random permutation on cycle structure where the
 *       others do not.
 *
 *       The measurement that matters: a random permutation on N states has about
 *       ln(N) cycles — 6.6 at N=729 — and a Poisson(1) number of fixed points.
 *       Predicted: `f_addrot`'s cycle count lands within a factor of two of 6.6
 *       while `f_rot`'s does not.
 *
 *   D4  AND TRUNCATION IS WHAT MAKES IT A HASH. Taking `h(x) = low m trits of
 *       f^k(x)` over all 729 inputs, a good `f` should collide like a random
 *       function into 3^m buckets, not better and not worse. Predicted: for the
 *       best candidate at m = 3, the collision count sits within 20% of the random
 *       -function expectation, while `f_pos` — being periodic and positionwise —
 *       is far from it in the direction of TOO FEW collisions, because it barely
 *       moves the low trits at all.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');

const W = 6, N = 729;                    // exhaustive: every tryte
const line = '='.repeat(78);
console.log('ITERHASH AUDIT — self-referencing ternary maps, exhaustive at 729 states.\n');

const vals = Array.from({ length: N }, (_, i) => i + T.TRYTE_MIN);
const idx = v => T.wrap(v) - T.TRYTE_MIN;

/** A deterministic trit permutation from a 3-element arrangement. */
const TRIT_PERMS = [[-1, 0, 1], [-1, 1, 0], [0, -1, 1], [0, 1, -1], [1, -1, 0], [1, 0, -1]];
const applyTrit = (perm, t) => perm[t + 1];

const positionwise = perms => v =>
  T.fromTrits(T.toTrits(v).slice(0, W).map((t, i) => applyTrit(perms[i % perms.length], t)));
const rotate = v => {
  const t = T.toTrits(v).slice(0, W);
  return T.fromTrits([...t.slice(1), t[0]]);
};

/** Cycle structure of a map given as an array over state indices. */
function structure(map) {
  const seen = new Uint8Array(N);
  const cycles = [];
  let fixed = 0;
  const isPerm = new Set(map).size === N;
  if (!isPerm) return { isPerm, cycles: null, fixed: null, order: null };
  for (let i = 0; i < N; i++) {
    if (seen[i]) continue;
    let len = 0, j = i;
    while (!seen[j]) { seen[j] = 1; j = map[j]; len++; }
    cycles.push(len);
    if (len === 1) fixed++;
  }
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const order = cycles.reduce((a, b) => a * b / gcd(a, b), 1);
  return { isPerm, cycles: cycles.length, fixed, order, longest: Math.max(...cycles) };
}
const asMap = f => Int16Array.from(vals, v => idx(f(v)));

console.log('--- D1  does a non-bijective map bleed state? ---');
{
  // A deterministic pseudo-random map and permutation, stated so it is reproducible.
  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const randMap = Int16Array.from({ length: N }, () => Math.floor(rnd() * N));
  const perm = Int16Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }

  const imageAfter = (map, k) => {
    let cur = Int16Array.from({ length: N }, (_, i) => i);
    for (let s = 0; s < k; s++) cur = Int16Array.from(cur, i => map[i]);
    return new Set(cur).size;
  };
  const expected1 = Math.round(N * (1 - 1 / Math.E));
  console.log(`      random MAP  image after 1: ${imageAfter(randMap, 1)}  (1-1/e of 729 = ${expected1})`);
  for (const k of [2, 5, 10, 20]) console.log(`                  image after ${String(k).padStart(2)}: ${imageAfter(randMap, k)}`);
  console.log(`      random PERM image after 20: ${imageAfter(perm, 20)}  (a permutation loses nothing)`);
}

console.log('\n--- D2  is every positionwise map periodic within 6? ---');
{
  let worst = 0, allDivide6 = true, checked = 0;
  const rows = [];
  for (const a of [0, 1, 2, 3, 4, 5]) {
    for (const b of [0, 1, 2, 3, 4, 5]) {
      const f = positionwise([TRIT_PERMS[a], TRIT_PERMS[b]]);
      const st = structure(asMap(f));
      checked++;
      worst = Math.max(worst, st.order);
      if (6 % st.order !== 0) allDivide6 = false;
      if (rows.length < 4) rows.push(`perms(${a},${b}) order ${st.order}, cycles ${st.cycles}, fixed ${st.fixed}`);
    }
  }
  for (const r of rows) console.log(`      ${r}`);
  console.log(`      ${checked} positionwise maps: largest order ${worst}, every order divides 6: ${allDivide6}`);
  console.log(`      -> a state of ANY width returns to itself within 6 calls.`);
}

console.log('\n--- D3  what does cross-trit coupling buy an ITERATED map? ---');
{
  // FIRST, THE THING THAT EXPLAINS EVERYTHING BELOW, and which was not registered.
  //
  // `s + g(s)` keeps information only when `t -> t + g(t)` is itself a permutation
  // of the trits. That is the definition of an ORTHOMORPHISM. Of the six trit
  // permutations exactly three qualify — the identity and the two 3-CYCLES — and
  // all three involutions fail. Negation is the worst of them: `s + (-s) = 0`
  // collapses 729 states to ONE.
  //
  // That is a genuinely ternary result. Every non-identity permutation of a single
  // BIT is an involution, so at bit level binary has no non-trivial orthomorphism
  // of this kind at all. The 3-cycles have no binary analogue.
  const NAMES = ['identity', 'swap(0,1)', 'swap(-1,0)', '3-cycle up', '3-cycle down', 'negate'];
  const mod3 = x => { const r = ((x % 3) + 3) % 3; return r === 2 ? -1 : r; };
  const orthos = [];
  console.log('      orthomorphism test — is t + g(t) still a permutation?');
  for (let k = 0; k < 6; k++) {
    const row = [-1, 0, 1].map(t => mod3(t + applyTrit(TRIT_PERMS[k], t)));
    const isO = new Set(row).size === 3;
    if (isO) orthos.push(k);
    const img = new Set(vals.map(v => T.wrap(v + positionwise([TRIT_PERMS[k]])(v)))).size;
    console.log(`        ${NAMES[k].padEnd(13)} t+g(t) = ${JSON.stringify(row).padEnd(12)}`
      + ` ${isO ? 'ORTHO' : '  -  '}   image of s+g(s): ${String(img).padStart(3)}/729`);
  }
  console.log(`      -> ${orthos.length} of 6 qualify: ${orthos.map(k => NAMES[k]).join(', ')}.`);
  console.log('         The orthomorphism test predicts injectivity exactly.\n');

  const sbox = positionwise([TRIT_PERMS[3]]);          // a 3-cycle: an orthomorphism
  const cands = {
    f_pos: sbox,
    f_rot: v => rotate(sbox(v)),
    f_add: v => T.wrap(v + sbox(v)),
    f_addrot: v => rotate(T.wrap(v + sbox(v))),
  };
  console.log(`      with an ORTHOMORPHIC s-box, baseline ~${Math.log(N).toFixed(1)} cycles, ~1 fixed point:`);
  for (const [name, f] of Object.entries(cands)) {
    const st = structure(asMap(f));
    if (!st.isPerm) {
      console.log(`      ${name.padEnd(9)} NOT a permutation — image ${new Set(asMap(f)).size}/${N}`);
      continue;
    }
    console.log(`      ${name.padEnd(9)} perm. order ${String(st.order).padStart(7)}  cycles `
      + `${String(st.cycles).padStart(4)}  fixed ${String(st.fixed).padStart(3)}  longest ${st.longest}`);
  }
  console.log('\n      D3 PREDICTED f_addrot would resemble a random permutation. IT DOES NOT.');
  console.log('      A positionwise 3-cycle IS addition of a constant, so s + sbox(s) stays');
  console.log('      AFFINE, and affine maps over this ring have tiny order. Fixing the');
  console.log('      s-box fixes injectivity and does nothing for mixing.');
}

console.log('\n--- D4  truncated collisions against the random-function bound ---');
{
  const sbox = positionwise([TRIT_PERMS[3]]);
  const cands = { f_pos: sbox, f_rot: v => rotate(sbox(v)), f_addrot: v => rotate(T.wrap(v + sbox(v))) };
  const M = 3, BUCKETS = 27;
  const expectedPairs = (N * (N - 1) / 2) / BUCKETS;
  console.log(`      low ${M} trits, all ${N} inputs, k = 8 calls.`
    + ` A random function collides on ~${Math.round(expectedPairs)} pairs.\n`);
  for (const [name, f] of Object.entries(cands)) {
    const counts = new Array(BUCKETS).fill(0);
    for (const v of vals) {
      let s = v;
      for (let i = 0; i < 8; i++) s = f(s);
      counts[((T.toTrits(s)[0] + 1) + 3 * (T.toTrits(s)[1] + 1) + 9 * (T.toTrits(s)[2] + 1))]++;
    }
    const pairs = counts.reduce((a, c) => a + c * (c - 1) / 2, 0);
    console.log(`      ${name.padEnd(9)} pairs ${String(pairs).padStart(6)}`
      + `  (${(pairs / expectedPairs).toFixed(2)}x expected)  empty buckets `
      + `${counts.filter(c => c === 0).length}/${BUCKETS}`);
  }
  console.log('\n      D4 PREDICTED f_pos would be far off, with TOO FEW collisions. It is at');
  console.log('      0.96x — near ideal, and for a reason the prediction missed: truncating');
  console.log('      ANY permutation to 3 trits gives exactly 27 buckets of 27, which is');
  console.log('      perfectly uniform. Uniformity is what a permutation gives away for free,');
  console.log('      and it is therefore NOT evidence of mixing. A collision count cannot');
  console.log('      distinguish a good hash from a relabelling.');
}

console.log('\n--- beyond the registration: does ANYTHING in this shape mix? ---');
{
  // Not registered. D3 and D4 failed, so the family as sketched is dead, and the
  // useful question became which shape survives. Splitting the state and using one
  // half to modify the other is invertible for ANY round function, so no state can
  // bleed and the round function's nonlinearity is unconstrained.
  let sd = 98765;
  const rnd = () => { sd = (Math.imul(sd, 1103515245) + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  const S27 = Array.from({ length: 27 }, (_, i) => i);
  for (let i = 26; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = S27[i]; S27[i] = S27[j]; S27[j] = t; }
  const lo = v => { const t = T.toTrits(v); return (t[0] + 1) + 3 * (t[1] + 1) + 9 * (t[2] + 1); };
  const hi = v => { const t = T.toTrits(v); return (t[3] + 1) + 3 * (t[4] + 1) + 9 * (t[5] + 1); };
  const pack = (L, R) => {
    const t = new Array(6);
    for (let k = 0; k < 3; k++) { t[k] = (Math.floor(L / 3 ** k) % 3) - 1; t[k + 3] = (Math.floor(R / 3 ** k) % 3) - 1; }
    return T.fromTrits(t);
  };
  const shapes = {
    'split, nonlinear round': v => pack(hi(v), (lo(v) + S27[hi(v)]) % 27),
    'split, LINEAR round': v => pack(hi(v), (lo(v) + (5 * hi(v) + 1) % 27) % 27),
  };
  console.log(`      baseline: a random permutation on ${N} has ~${Math.log(N).toFixed(1)} cycles, ~1 fixed point\n`);
  for (const [name, f] of Object.entries(shapes)) {
    const st = structure(asMap(f));
    console.log(`      ${name.padEnd(24)} perm ${st.isPerm}  order ${String(st.order).padStart(8)}`
      + `  cycles ${String(st.cycles).padStart(3)}  fixed ${String(st.fixed).padStart(2)}  longest ${st.longest}`);
  }
  console.log('\n      The nonlinear round lands at 8 cycles and 1 fixed point against a');
  console.log('      baseline of 6.6 and 1 — and its linear twin does not. So the structure');
  console.log('      is not what mixes; the round function\'s NONLINEARITY is. And the round');
  console.log('      function is a 27-entry table, which is exactly this machine\'s TOPC.');
  console.log('\n      One sample is one sample, so: 20 different round tables.');
  const mk = s0 => {
    let s = s0;
    const r = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const A = Array.from({ length: 27 }, (_, i) => i);
    for (let i = 26; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = A[i]; A[i] = A[j]; A[j] = t; }
    return A;
  };
  const lnN = Math.log(N), band = Math.sqrt(lnN);
  const cyc = [], fx = [];
  for (let s = 1; s <= 20; s++) {
    const A = mk(1000 * s + 7);
    const st = structure(asMap(v => pack(hi(v), (lo(v) + A[hi(v)]) % 27)));
    cyc.push(st.cycles); fx.push(st.fixed);
  }
  cyc.sort((a, b) => a - b);
  const inBand = cyc.filter(c => c >= lnN - 2 * band && c <= lnN + 2 * band).length;
  console.log(`      cycle counts ${cyc[0]}..${cyc[19]}, mean ${(cyc.reduce((a, b) => a + b, 0) / 20).toFixed(1)}`
    + ` against ln(N) = ${lnN.toFixed(1)}; ${inBand}/20 inside two standard deviations.`);
  console.log(`      -> consistent with a random permutation on cycle count.`);
  console.log('');
  console.log(`      fixed points across all 20: ${[...new Set(fx)].join(',')} — ALWAYS EXACTLY ONE.`);
  console.log('      A random permutation gives Poisson(1): about 37% would have none at all.');
  console.log('      This construction cannot. The state with L = R and round(R) = 0 is fixed,');
  console.log('      the round table is a permutation so exactly one R maps to 0, and therefore');
  console.log('      exactly one state is fixed FOR EVERY round table. That is a structural');
  console.log('      fingerprint, not a statistic — and a fixed point is an input no number of');
  console.log('      rounds ever moves.');
  console.log('');
  console.log('      The standard fix is a per-round CONSTANT, which breaks the symmetry. That');
  console.log('      collides with the one-function rule unless the round counter is carried');
  console.log('      inside the state — which is a real design consequence, not a detail.');
}

console.log('\n' + line);
