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
  const sboxPerms = [TRIT_PERMS[1], TRIT_PERMS[3], TRIT_PERMS[5]];
  const sbox = positionwise(sboxPerms);
  const cands = {
    f_pos: sbox,
    f_rot: v => rotate(sbox(v)),
    f_add: v => T.wrap(v + sbox(v)),
    f_addrot: v => rotate(T.wrap(v + sbox(v))),
  };
  const lnN = Math.log(N);
  console.log(`      random-permutation baseline at N=${N}: about ${lnN.toFixed(1)} cycles, ~1 fixed point\n`);
  for (const [name, f] of Object.entries(cands)) {
    const st = structure(asMap(f));
    if (!st.isPerm) {
      const img = new Set(asMap(f)).size;
      console.log(`      ${name.padEnd(9)} NOT a permutation — image ${img}/${N}, so it bleeds state every call`);
      continue;
    }
    console.log(`      ${name.padEnd(9)} permutation. order ${String(st.order).padStart(6)}  cycles `
      + `${String(st.cycles).padStart(3)}  fixed ${String(st.fixed).padStart(3)}  longest ${st.longest}`);
  }
}

console.log('\n--- D4  truncated collisions against the random-function bound ---');
{
  const sbox = positionwise([TRIT_PERMS[1], TRIT_PERMS[3], TRIT_PERMS[5]]);
  const cands = {
    f_pos: sbox,
    f_rot: v => rotate(sbox(v)),
    f_addrot: v => rotate(T.wrap(v + sbox(v))),
  };
  const M = 3, BUCKETS = 27;                      // low 3 trits
  const low3 = v => T.fromTrits(T.toTrits(v).slice(0, M).concat([0, 0, 0]));
  // Expected colliding PAIRS for a random function: C(N,2)/BUCKETS.
  const expectedPairs = (N * (N - 1) / 2) / BUCKETS;
  console.log(`      truncating to ${M} trits (${BUCKETS} buckets), all ${N} inputs, k = 8 calls`);
  console.log(`      a random function collides on about ${Math.round(expectedPairs)} pairs\n`);
  for (const [name, f] of Object.entries(cands)) {
    const counts = new Array(BUCKETS).fill(0);
    for (const v of vals) {
      let s = v;
      for (let i = 0; i < 8; i++) s = f(s);
      counts[idx(low3(s)) % BUCKETS]++;
    }
    const pairs = counts.reduce((a, c) => a + c * (c - 1) / 2, 0);
    const empty = counts.filter(c => c === 0).length;
    console.log(`      ${name.padEnd(9)} colliding pairs ${String(pairs).padStart(6)}  `
      + `(${(pairs / expectedPairs).toFixed(2)}x expected)  empty buckets ${empty}/${BUCKETS}`);
  }
}

console.log('\n' + line);
