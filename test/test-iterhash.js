'use strict';
/* test-iterhash.js — which self-referencing ternary maps mix, and which cannot.
 *
 * Set `D`. A new subject: is there room for new families of ternary hash functions
 * where the algorithm is a SINGLE function called repeatedly and referencing
 * itself, `s <- f(s)`?
 *
 * NOT a security claim. 729 states is a toy and cannot be evidence about an
 * adversary. What is established is which family shapes mix at all.
 *
 * The two results worth pinning are the ones that closed doors:
 *
 *   - every positionwise `f` has period at most SIX, at any width. That kills the
 *     whole positionwise family by an argument, not a statistic.
 *   - a truncated-collision count cannot tell a mixing function from a relabelling,
 *     because truncating any permutation is uniform by construction. That
 *     disqualifies the most obvious test anyone would reach for.
 */

const T = require('../src/ternary.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const W = 6, N = 729;
const vals = Array.from({ length: N }, (_, i) => i + T.TRYTE_MIN);
const idx = v => T.wrap(v) - T.TRYTE_MIN;
const TRIT_PERMS = [[-1, 0, 1], [-1, 1, 0], [0, -1, 1], [0, 1, -1], [1, -1, 0], [1, 0, -1]];
const positionwise = perms => v =>
  T.fromTrits(T.toTrits(v).slice(0, W).map((t, i) => perms[i % perms.length][t + 1]));
const rotate = v => { const t = T.toTrits(v).slice(0, W); return T.fromTrits([...t.slice(1), t[0]]); };
function structure(map) {
  const seen = new Uint8Array(N); const cycles = []; let fixed = 0;
  if (new Set(map).size !== N) return { isPerm: false, image: new Set(map).size };
  for (let i = 0; i < N; i++) {
    if (seen[i]) continue;
    let len = 0, j = i;
    while (!seen[j]) { seen[j] = 1; j = map[j]; len++; }
    cycles.push(len); if (len === 1) fixed++;
  }
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  return { isPerm: true, cycles: cycles.length, fixed,
    order: cycles.reduce((a, b) => a * b / gcd(a, b), 1), longest: Math.max(...cycles) };
}
const asMap = f => Int16Array.from(vals, v => idx(f(v)));

console.log('\n=== 1. D1 — A NON-BIJECTION BLEEDS STATE ===');
{
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
  const one = imageAfter(randMap, 1);
  check(`a random map keeps ${one} of ${N} after one call — N(1-1/e) is ${Math.round(N * (1 - 1 / Math.E))}`,
    Math.abs(one - N * (1 - 1 / Math.E)) / N < 0.05, String(one));
  check(`   and is down to ${imageAfter(randMap, 10)} by the tenth`, imageAfter(randMap, 10) < 200);
  check('   a permutation keeps all 729 forever — which is why an iterated hash of'
    + ' this shape must be a permutation and compress by truncation',
    imageAfter(perm, 20) === N);
}

console.log('\n=== 2. D2 — EVERY POSITIONWISE MAP REPEATS WITHIN SIX ===');
{
  let worst = 0, allDivide = true, n = 0;
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
    const st = structure(asMap(positionwise([TRIT_PERMS[a], TRIT_PERMS[b]])));
    n++; worst = Math.max(worst, st.order);
    if (6 % st.order !== 0) allDivide = false;
  }
  check(`${n} positionwise maps, largest order ${worst}, every order divides 6`,
    worst === 6 && allDivide, String(worst));
  check('   so a state of ANY width returns to itself within six calls — the'
    + ' positionwise family is dead by argument, not by statistic', allDivide);
  check('   which is strictly stronger than Q4\'s 27^w ceiling, since a ceiling'
    + ' still permits a large orbit and a period of six does not', worst <= 6);
}

console.log('\n=== 3. F-ORTHOMORPHISM-GATE — WHEN s + g(s) KEEPS INFORMATION ===');
{
  const mod3 = x => { const r = ((x % 3) + 3) % 3; return r === 2 ? -1 : r; };
  const results = TRIT_PERMS.map((p, k) => {
    const isOrtho = new Set([-1, 0, 1].map(t => mod3(t + p[t + 1]))).size === 3;
    const image = new Set(vals.map(v => T.wrap(v + positionwise([p])(v)))).size;
    return { k, isOrtho, image };
  });
  check('the orthomorphism test predicts injectivity exactly, for all six',
    results.every(r => r.isOrtho === (r.image === N)), JSON.stringify(results));
  check(`   exactly ${results.filter(r => r.isOrtho).length} of 6 qualify: the identity`
    + ' and the two 3-CYCLES', results.filter(r => r.isOrtho).length === 3
    && results[3].isOrtho && results[4].isOrtho);
  check('   every involution fails — and negation is the worst, collapsing 729'
    + ' states to one', results[5].image === 1 && !results[5].isOrtho);
  check('   which is a ternary door: every non-identity permutation of a single BIT'
    + ' is an involution, so binary has no analogue of the 3-cycle here',
    TRIT_PERMS.filter((p, k) => results[k].isOrtho && k !== 0).length === 2);
}

console.log('\n=== 4. D3 FAILED — CARRY ALONE DOES NOT MIX ===');
{
  const sbox = positionwise([TRIT_PERMS[3]]);            // an orthomorphism
  const addrot = structure(asMap(v => rotate(T.wrap(v + sbox(v)))));
  check(`rotate(s + sbox(s)) has ${addrot.cycles} cycles against a baseline of 6.6`
    + ' — it does NOT resemble a random permutation', addrot.cycles > 100, JSON.stringify(addrot));
  check('   because a positionwise 3-cycle IS addition of a constant, so the sum'
    + ' stays affine and affine maps here have tiny order', addrot.order <= 6);
  check('   so fixing the s-box fixes injectivity and does nothing for mixing',
    structure(asMap(v => T.wrap(v + sbox(v)))).isPerm && addrot.order <= 6);
}

console.log('\n=== 5. D4 FAILED — UNIFORMITY IS NOT MIXING ===');
{
  const sbox = positionwise([TRIT_PERMS[3]]);
  const BUCKETS = 27;
  const expected = (N * (N - 1) / 2) / BUCKETS;
  const score = f => {
    const counts = new Array(BUCKETS).fill(0);
    for (const v of vals) {
      let s = v;
      for (let i = 0; i < 8; i++) s = f(s);
      const t = T.toTrits(s);
      counts[(t[0] + 1) + 3 * (t[1] + 1) + 9 * (t[2] + 1)]++;
    }
    return counts.reduce((a, c) => a + c * (c - 1) / 2, 0) / expected;
  };
  const pos = score(sbox), rot = score(v => rotate(sbox(v)));
  check(`a map proved to repeat every six calls scores ${pos.toFixed(2)}x the`
    + ' random-function expectation — near ideal', Math.abs(pos - 1) < 0.1, String(pos));
  check('   and is indistinguishable from every other permutation tested',
    Math.abs(pos - rot) < 0.001);
  check('   because truncating ANY permutation is uniform by construction, so a'
    + ' collision count cannot tell mixing from relabelling', Math.abs(pos - 1) < 0.1);
}

console.log('\n=== 6. F-SPLIT-ROUND-MIXES — WHAT DOES WORK ===');
{
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
  const nonlinear = structure(asMap(v => pack(hi(v), (lo(v) + S27[hi(v)]) % 27)));
  const linear = structure(asMap(v => pack(hi(v), (lo(v) + (5 * hi(v) + 1) % 27) % 27)));
  check(`a split state with a NONLINEAR round table: ${nonlinear.cycles} cycles,`
    + ` ${nonlinear.fixed} fixed point, order ${nonlinear.order}`,
    nonlinear.isPerm && nonlinear.cycles < 2 * Math.log(N) && nonlinear.fixed <= 3,
    JSON.stringify(nonlinear));
  check(`   the LINEAR-round control gives ${linear.cycles} cycles and order`
    + ` ${linear.order} — so the structure is not what mixes`,
    linear.cycles > 10 * Math.log(N) || linear.order < 100, JSON.stringify(linear));
  check('   it is a permutation for ANY round function, so no state can bleed and'
    + ' the round function\'s nonlinearity is unconstrained',
    nonlinear.isPerm && linear.isPerm);
  check('   and that round function is a 27-entry table — exactly this machine\'s'
    + ' TOPC primitive', S27.length === 27 && new Set(S27).size === 27);

  // One sample is one sample. `T-ONE-POINT` is this repository's most-bitten trap,
  // and the winner above rested on a single shuffled round table.
  const mk = s0 => {
    let z = s0;
    const r = () => { z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff; return z / 0x7fffffff; };
    const A = Array.from({ length: 27 }, (_, i) => i);
    for (let i = 26; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = A[i]; A[i] = A[j]; A[j] = t; }
    return A;
  };
  const lnN = Math.log(N), band = Math.sqrt(lnN);
  const cyc = [], fx = [];
  for (let z = 1; z <= 20; z++) {
    const A = mk(1000 * z + 7);
    const st = structure(asMap(v => pack(hi(v), (lo(v) + A[hi(v)]) % 27)));
    cyc.push(st.cycles); fx.push(st.fixed);
  }
  const inBand = cyc.filter(c => c >= lnN - 2 * band && c <= lnN + 2 * band).length;
  check(`   across 20 round tables, ${inBand}/20 cycle counts sit within two standard`
    + ' deviations of ln(N) — consistent with random, on 20 samples not one',
    inBand >= 18, cyc.join(' '));
  check('F-ALWAYS-ONE-FIXED-POINT — every one of the 20 has EXACTLY one fixed point,'
    + ' where a random permutation would have none about 37% of the time',
    fx.every(x => x === 1), fx.join(' '));
  check('   structural, not luck: L = R with round(R) = 0 is fixed, and a permutation'
    + ' sends exactly one R to 0', (() => {
      const A = mk(1007);
      const r0 = A.indexOf(0);
      const st = pack(r0, r0);
      return pack(hi(st), (lo(st) + A[hi(st)]) % 27) === st;
    })());
  check('   so a fixed point here is an input no number of rounds ever moves — and'
    + ' the usual remedy, a per-round constant, collides with the one-function rule',
    fx.every(x => x === 1));
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
