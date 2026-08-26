'use strict';
/* test-reversible.js — ternary reaches reversible universality at two operands.
 *
 * Set `M`. Every quantum gate is reversible, so the classical core of any
 * quantum-gate simulation is a PERMUTATION of states — and set `D` established
 * that an iterated hash of the shape asked for must be a permutation too.
 * Reversibility is what hashing, keys and quantum logic share, and unlike
 * amplitudes it is measurable at this scale.
 *
 * TWO THINGS THIS DOES NOT SHOW, kept here because the subject invites both:
 *   - reversible-universal is NOT quantum. Reaching the symmetric group is the
 *     classical permutation core; superposition and phase are untouched.
 *   - universal is NOT cheap. This is about gate WIDTH in group theory. Whether a
 *     non-affine 2-trit gate is cheap in SWITCHES is unasked.
 *
 * The exhaustive version is `npm run audit:reversible`.
 */

const N = 27;
let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const idPerm = n => Array.from({ length: n }, (_, i) => i);
const mul = (g, h) => h.map(x => g[x]);
const inv = g => { const r = new Array(g.length); g.forEach((v, i) => { r[v] = i; }); return r; };
const isId = g => g.every((v, i) => v === i);
const trits = s => [s % 3, Math.floor(s / 3) % 3, Math.floor(s / 9) % 3];
const state = t => t[0] + 3 * t[1] + 9 * t[2];
const parity = g => {
  const seen = new Array(g.length).fill(false);
  let tr = 0;
  for (let i = 0; i < g.length; i++) {
    if (seen[i]) continue;
    let len = 0, j = i;
    while (!seen[j]) { seen[j] = true; j = g[j]; len++; }
    tr += len - 1;
  }
  return tr % 2 === 0 ? 'even' : 'odd';
};
function groupOrder(gens, n) {
  const base = [], S = [], T = [];
  const rebuild = i => {
    const tr = new Array(n).fill(null);
    tr[base[i]] = idPerm(n);
    const q = [base[i]];
    while (q.length) {
      const x = q.shift();
      for (const g of S[i]) { const y = g[x]; if (!tr[y]) { tr[y] = mul(g, tr[x]); q.push(y); } }
    }
    T[i] = tr;
  };
  const sift = g => {
    let h = g.slice();
    for (let i = 0; i < base.length; i++) {
      const y = h[base[i]];
      if (!T[i][y]) return { h, level: i };
      h = mul(inv(T[i][y]), h);
      if (isId(h)) return { h, level: base.length };
    }
    return { h, level: base.length };
  };
  const addAt = (g, level) => {
    if (level === base.length) { base.push(g.findIndex((v, i) => v !== i)); S.push([]); T.push(null); }
    for (let i = 0; i <= level; i++) S[i].push(g);
    for (let i = level; i >= 0; i--) rebuild(i);
  };
  for (const g of gens) {
    if (isId(g)) continue;
    const { h, level } = sift(g);
    if (!isId(h)) addAt(h, level);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = base.length - 1; i >= 0 && !changed; i--) {
      for (let x = 0; x < n && !changed; x++) {
        if (!T[i][x]) continue;
        for (const g of S[i]) {
          const sg = mul(inv(T[i][g[x]]), mul(g, T[i][x]));
          if (isId(sg)) continue;
          const { h, level } = sift(sg);
          if (!isId(h)) { addAt(h, level); changed = true; break; }
        }
      }
    }
  }
  let order = 1n;
  for (let i = 0; i < base.length; i++) order *= BigInt(T[i].filter(Boolean).length);
  return order;
}
function isAffine(g) {
  const b = trits(g[0]);
  const cols = [1, 3, 9].map(e => trits(g[e]).map((v, i) => (v - b[i] + 3) % 3));
  for (let s = 0; s < N; s++) {
    const x = trits(s);
    const y = [0, 1, 2].map(r => (cols[0][r] * x[0] + cols[1][r] * x[1] + cols[2][r] * x[2] + b[r]) % 3);
    if (state(y) !== g[s]) return false;
  }
  return true;
}
const INC = i => idPerm(N).map(s => { const t = trits(s); t[i] = (t[i] + 1) % 3; return state(t); });
const C1INC = (a, b) => idPerm(N).map(s => { const t = trits(s); if (t[a] === 1) t[b] = (t[b] + 1) % 3; return state(t); });
const CINC = (a, b) => idPerm(N).map(s => { const t = trits(s); t[b] = (t[b] + t[a]) % 3; return state(t); });
const fact = n => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };

console.log('\n=== 1. M0 — THE INSTRUMENT, BEFORE ANYTHING RESTS ON IT ===');
{
  const cyc = idPerm(N).map(s => (s + 1) % N);
  const swap = idPerm(N); swap[0] = 1; swap[1] = 0;
  const three = idPerm(N); three[0] = 1; three[1] = 2; three[2] = 0;
  const c25 = idPerm(N); for (let i = 0; i < 25; i++) c25[i] = (i + 1) % 25;
  check('a single 27-cycle gives 27', groupOrder([cyc], N) === 27n);
  check('a transposition and a 27-cycle give 27!', groupOrder([swap, cyc], N) === fact(27));
  check('a 3-cycle and a 27-cycle give 27!/2 — both are even', groupOrder([three, cyc], N) === fact(27) / 2n);
  check('   and a 3-cycle with a 25-CYCLE gives 25!/2, because between them they'
    + ' move only 25 of the 27 points', groupOrder([three, c25], N) === fact(25) / 2n);
  check('   that case was first written as "A_27" and scored the tool WRONG — a'
    + ' verification case is as suspect as the thing it checks',
    groupOrder([three, c25], N) !== fact(27) / 2n);
  // The condition demonstrates the hazard rather than denying it: 27! and 27!-1
  // collapse to the SAME double, so an order comparison in floating point cannot
  // tell A_27 from a group one element smaller. Written the other way round first,
  // which asserted they differ — and it failed, correctly.
  check('BigInt throughout — 27! and 27!-1 are the same double, so a float'
    + ' comparison could not tell A_27 from a group one element smaller',
    typeof groupOrder([cyc], N) === 'bigint' && Number(fact(27)) === Number(fact(27) - 1n));
}

console.log('\n=== 2. M1 — BINARY HAS NO NON-AFFINE TWO-BIT REVERSIBLE GATE ===');
{
  const glOrder = (n, q) => { let r = 1n; for (let i = 0; i < n; i++) r *= BigInt(q ** n - q ** i); return r; };
  const binAll = fact(4), binAff = glOrder(2, 2) * 4n;
  const terAll = fact(9), terAff = glOrder(2, 3) * 9n;
  check(`all ${binAll} reversible 2-bit gates are affine — none is left over`,
    binAll === binAff && binAll === 24n, `${binAll} vs ${binAff}`);
  check(`of ${terAll} reversible 2-trit gates only ${terAff} are affine, leaving`
    + ` ${terAll - terAff}`, terAff === 432n && terAll - terAff === 362448n);
  check('   which is 0.119% against binary\'s 100%',
    Math.abs(Number(terAff) / Number(terAll) * 100 - 0.119) < 0.001);
  check('   and affine composes to affine, so an all-affine set cannot reach the'
    + ' symmetric group at any width — the reason binary needs a 3-bit gate',
    isAffine(CINC(0, 1)) && isAffine(INC(0)) && isAffine(mul(CINC(0, 1), INC(0))));
}

console.log('\n=== 3. M2 — A WIDTH-TWO TERNARY SET REACHES UNIVERSALITY ===');
{
  const gens = [INC(0), C1INC(0, 1), C1INC(1, 2), C1INC(2, 0)];
  check('C1INC is non-affine — the indicator of t == 1 is quadratic over GF(3)',
    !isAffine(C1INC(0, 1)));
  check('every generator is even, so the group is confined to the alternating group'
    + ' before it is computed', gens.every(g => parity(g) === 'even'));
  const ord = groupOrder(gens, N);
  check(`the set generates EXACTLY A_27, order ${ord}`, ord === fact(27) / 2n, String(ord));
  check('   predicted from parity, not discovered — S_27 was forbidden in advance',
    ord === fact(27) / 2n && ord !== fact(27));
  check('   so ternary reaches reversible universality at TWO operands', ord >= fact(27) / 2n);
}

console.log('\n=== 4. M3 — ONE GATE AFFINE INSTEAD, AND IT COLLAPSES ===');
{
  const gens = [INC(0), CINC(0, 1), CINC(1, 2), CINC(2, 0)];
  check('every generator is now affine', gens.every(isAffine));
  const ord = groupOrder(gens, N);
  check(`the same wiring generates ${ord}, inside |AGL(3,3)| = 303,264`,
    ord === 151632n && ord <= 303264n, String(ord));
  // Membership, not an order bound: an order bound passes for any small group.
  const seen = new Set([idPerm(N).join(',')]);
  const queue = [idPerm(N)];
  let bad = 0;
  while (queue.length) {
    const g = queue.shift();
    if (!isAffine(g)) bad++;
    for (const h of gens) {
      const p = mul(h, g), k = p.join(',');
      if (!seen.has(k)) { seen.add(k); queue.push(p); }
    }
  }
  check(`   all ${seen.size} elements enumerated and every one is x -> Ax + b`,
    bad === 0 && BigInt(seen.size) === ord, `${bad} failed membership`);
  check('   brute-force enumeration matches the Schreier-Sims chain — two methods,'
    + ' one answer', BigInt(seen.size) === ord);
  check('   a factor of about 1.4e-23 of the symmetric group: one gate changed,'
    + ' same widths, same wiring, universality gone',
    Number(ord) / Number(fact(27)) < 1e-22);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
