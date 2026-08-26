'use strict';
/* REVERSIBLE AUDIT — how many operands does ternary need to reach universality?
 *
 * A new subject. Every quantum gate is reversible, so the classical core of any
 * quantum-gate simulation is a PERMUTATION of states. Set `D` established that an
 * iterated hash of the shape asked for must also be a permutation. Reversibility is
 * the thing hashing, keys and quantum logic actually share, and it is measurable.
 *
 * ------------------------------------------------------------------------------
 * WHAT THIS PHASE DOES NOT SHOW — stated twice, because the framing invites both.
 *
 *   (a) REVERSIBLE-UNIVERSAL IS NOT QUANTUM. Reaching the full symmetric group on
 *       states is the classical permutation core. Quantum needs superposition and
 *       phase on top of it, and nothing here touches either. A ternary machine that
 *       reaches reversible universality has not simulated a quantum computer, and
 *       no result below should be read as saying so.
 *
 *   (b) UNIVERSAL IS NOT CHEAP. This measures which GATE WIDTHS suffice, in group
 *       theory. Whether a non-affine 2-trit gate is cheap in SWITCHES is a separate
 *       question nobody has asked, and set `C` already showed this project's costs
 *       do not follow its abstractions. Named as the open follow-up, not implied.
 *
 * NOTE ON IDS: this is set `M`, whose predictions are `M1`-style. `M0`/`M1` in
 * `design/03-model-options.md` are the MODEL options (charge retention) and are
 * unrelated. On first use elsewhere, write "set `M`'s `M1`".
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   M0  THE INSTRUMENT IS RIGHT BEFORE ANYTHING RESTS ON IT. Group orders come
 *       from a Schreier-Sims stabiliser chain, which is the load-bearing tool here
 *       and is being written for this phase. Predicted: it reproduces four known
 *       orders exactly, in BigInt — a single 27-cycle gives 27, two generators of
 *       the symmetric group give 27!, the alternating group gives 27!/2, and the
 *       affine group AGL(3,3) gives 303,264. Floats are not used anywhere: 27! is
 *       far past exact double precision, and comparing orders in floating point
 *       would be `T-CRITERION-IN-THE-NOISE` by construction.
 *
 *   M1  BINARY HAS NO NON-AFFINE TWO-BIT REVERSIBLE GATE AND TERNARY HAS 362,448.
 *       Two halves, and the second is the one that bites:
 *
 *       COUNT: reversible 2-bit gates are permutations of 4 states, 4! = 24, and
 *       |AGL(2,2)| = |GL(2,2)| x 4 = 6 x 4 = 24. Every one of them is affine.
 *       Reversible 2-trit gates are 9! = 362,880 and |AGL(2,3)| = 48 x 9 = 432, so
 *       0.119% are affine and 362,448 are not.
 *
 *       CLOSURE: affine maps compose to affine maps, so a gate set drawn entirely
 *       from affine gates generates a subgroup of AGL no matter how it is wired.
 *       Predicted: verified by MEMBERSHIP — every element of the generated group
 *       is of the form x -> Ax + b — not by an order bound, because an order bound
 *       is satisfied by any small group and would pass for the wrong reason.
 *
 *       Together those say binary 2-bit gate sets cannot reach the symmetric group
 *       at any width, which is why binary reversible computation needs a 3-bit gate.
 *
 *   M2  AND A TERNARY GATE SET OF WIDTH TWO REACHES UNIVERSALITY. One NAMED set,
 *       stated here rather than quantified over 362,448 candidates:
 *
 *         INC(t0)          (t0,t1,t2) -> (t0+1, t1, t2)
 *         C1INC(t0,t1)     if t0 == 1 then t1 += 1
 *         C1INC(t1,t2)     if t1 == 1 then t2 += 1
 *         C1INC(t2,t0)     if t2 == 1 then t0 += 1
 *
 *       `C1INC` is non-affine because the indicator of `t == 1` is quadratic over
 *       GF(3). Every generator is EVEN: `INC` is nine disjoint 3-cycles, and each
 *       `C1INC` is three disjoint 3-cycles, and a 3-cycle is even. So the generated
 *       group lies inside the alternating group, and the prediction is derived from
 *       that parity rather than left to chance:
 *
 *       **Predicted: exactly A_27, order 27!/2 = 5,444,434,725,209,176,080,384,000,000.**
 *       Not S_27 — predicting the symmetric group would be predicting something the
 *       parity forbids.
 *
 *       AND THE FAMILY, separately, so that one gate's behaviour is not read as the
 *       family's: 20 randomly drawn non-affine 2-trit gates, each combined with
 *       `INC` and placed on the same three pairs. Predicted: at least 15 of 20
 *       generate a group containing A_27.
 *
 *   M3  WHILE AN AFFINE TERNARY GATE SET STAYS IN THE AFFINE GROUP. Replace
 *       `C1INC` with `CINC` — `t1 += t0`, which IS affine — and predicted: the
 *       generated group has order at most |AGL(3,3)| = 303,264, every element
 *       passes the membership test, and the group is therefore a factor of about
 *       2.8e-23 of the symmetric group. Same wiring, same widths, one gate changed
 *       from non-affine to affine, and universality disappears.
 * ------------------------------------------------------------------------------
 */

const N = 27;                                 // a 3-trit register, states 0..26
const line = '='.repeat(78);
console.log('REVERSIBLE AUDIT — how many operands does ternary need?\n');

// --- permutation utilities (states are 0..N-1, trits are 0,1,2 for GF(3) work) --
const idPerm = n => Array.from({ length: n }, (_, i) => i);
const mul = (g, h) => h.map(x => g[x]);        // (g*h)(x) = g(h(x))
const inv = g => { const r = new Array(g.length); g.forEach((v, i) => { r[v] = i; }); return r; };
const isId = g => g.every((v, i) => v === i);
const trits = s => [s % 3, Math.floor(s / 3) % 3, Math.floor(s / 9) % 3];
const state = t => t[0] + 3 * t[1] + 9 * t[2];
const parity = g => {
  const seen = new Array(g.length).fill(false);
  let transpositions = 0;
  for (let i = 0; i < g.length; i++) {
    if (seen[i]) continue;
    let len = 0, j = i;
    while (!seen[j]) { seen[j] = true; j = g[j]; len++; }
    transpositions += len - 1;
  }
  return transpositions % 2 === 0 ? 'even' : 'odd';
};

/**
 * Group order by a Schreier-Sims stabiliser chain.
 *
 * Sifting is what keeps this tractable: a Schreier generator is only added to the
 * chain when it does NOT reduce to the identity, which holds the strong generating
 * set near n log n instead of letting it square at every level. The naive version
 * without sifting reaches tens of thousands of generators by level three.
 */
function groupOrder(gens, n) {
  const base = [], S = [], T = [];
  const rebuild = i => {
    const tr = new Array(n).fill(null);
    tr[base[i]] = idPerm(n);
    const q = [base[i]];
    while (q.length) {
      const x = q.shift();
      for (const g of S[i]) {
        const y = g[x];
        if (!tr[y]) { tr[y] = mul(g, tr[x]); q.push(y); }
      }
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
    if (level === base.length) {
      base.push(g.findIndex((v, i) => v !== i));
      S.push([]); T.push(null);
    }
    for (let i = 0; i <= level; i++) S[i].push(g);
    for (let i = level; i >= 0; i--) rebuild(i);
  };
  for (const g of gens) {
    if (isId(g)) continue;
    const { h, level } = sift(g);
    if (!isId(h)) addAt(h, level);
  }
  // Close the chain: every Schreier generator must sift to the identity.
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

/** Is this permutation of 27 states of the form x -> Ax + b over GF(3)? */
function isAffine(g) {
  const b = trits(g[0]);
  const cols = [1, 3, 9].map(e => trits(g[e]).map((v, i) => (v - b[i] + 3) % 3));
  for (let s = 0; s < N; s++) {
    const x = trits(s);
    const y = [0, 1, 2].map(r =>
      (cols[0][r] * x[0] + cols[1][r] * x[1] + cols[2][r] * x[2] + b[r]) % 3);
    if (state(y) !== g[s]) return false;
  }
  return true;
}

// --- the gates ---------------------------------------------------------------
const INC = i => idPerm(N).map(s => { const t = trits(s); t[i] = (t[i] + 1) % 3; return state(t); });
const C1INC = (a, b) => idPerm(N).map(s => {
  const t = trits(s);
  if (t[a] === 1) t[b] = (t[b] + 1) % 3;
  return state(t);
});
const CINC = (a, b) => idPerm(N).map(s => {           // affine: t_b += t_a
  const t = trits(s); t[b] = (t[b] + t[a]) % 3; return state(t);
});

const fact = n => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };

console.log('--- M0  the instrument, before anything rests on it ---');
{
  const cyc = idPerm(N).map(s => (s + 1) % N);
  const swap = idPerm(N); swap[0] = 1; swap[1] = 0;
  const threeA = idPerm(N); threeA[0] = 1; threeA[1] = 2; threeA[2] = 0;
  const threeB = idPerm(N); threeB[0] = 1; threeB[1] = 2; threeB[2] = 0;
  const rot = idPerm(N).map(s => (s + 1) % N);
  const affGens = [INC(0), INC(1), INC(2), CINC(0, 1), CINC(1, 2), CINC(2, 0),
    idPerm(N).map(s => { const t = trits(s); return state([t[1], t[0], t[2]]); })];
  const cases = [
    ['a single 27-cycle', [cyc], 27n],
    ['S_27 from a transposition and a 27-cycle', [swap, cyc], fact(27)],
    // The first version of this case paired a 3-cycle with a 25-CYCLE, which
    // between them move only 25 of the 27 points. The tool returned 25!/2 exactly
    // — the right answer to the question actually asked — and the case was scored
    // WRONG against an expectation of 27!/2. A test case that does not generate
    // what its name says generates is a `T-INSTRUMENT-FALSE-VERDICT` aimed at the
    // instrument instead of at itself. A 27-cycle is even (26 transpositions), so
    // pairing it with a 3-cycle stays inside A_27 and, by Jordan, fills it.
    ['A_27 from a 3-cycle and a 27-cycle', [threeA, cyc], fact(27) / 2n],
    ['   and the 25-point case the first version actually built', (() => {
      const c25 = idPerm(N); for (let i = 0; i < 25; i++) c25[i] = (i + 1) % 25;
      return [threeA, c25];
    })(), fact(25) / 2n],
    ['AGL(3,3) from its own generators', affGens, 303264n],
  ];
  for (const [name, gens, want] of cases) {
    const got = groupOrder(gens, N);
    console.log(`      ${name.padEnd(42)} ${got === want ? 'OK  ' : 'WRONG'} ${got}`
      + (got === want ? '' : `  expected ${want}`));
  }
}

console.log('\n--- M1  how many two-operand reversible gates are non-affine? ---');
{
  const glOrder = (n, q) => { let r = 1n; for (let i = 0; i < n; i++) r *= BigInt(q ** n - q ** i); return r; };
  for (const [name, q] of [['binary (2 bits)', 2], ['ternary (2 trits)', 3]]) {
    const states = q * q, all = fact(states), aff = glOrder(2, q) * BigInt(states);
    console.log(`      ${name.padEnd(18)} ${states} states   all ${String(all).padStart(7)}`
      + `   affine ${String(aff).padStart(7)}   non-affine ${String(all - aff).padStart(7)}`
      + `   (${(Number(aff) / Number(all) * 100).toFixed(3)}% affine)`);
  }
  console.log('      -> binary has NO non-affine two-bit reversible gate. Ternary has 362,448.');
}

console.log('\n--- M2  does a width-two ternary gate set reach universality? ---');
{
  const gens = [INC(0), C1INC(0, 1), C1INC(1, 2), C1INC(2, 0)];
  console.log(`      generator parities: ${gens.map(parity).join(', ')}`);
  console.log(`      non-affine generators: ${gens.filter(g => !isAffine(g)).length} of ${gens.length}`);
  const ord = groupOrder(gens, N);
  const A = fact(27) / 2n, S = fact(27);
  console.log(`      order ${ord}`);
  console.log(`      A_27  ${A}`);
  console.log(`      verdict: ${ord === A ? 'EXACTLY A_27' : ord === S ? 'S_27' : 'neither — a proper subgroup'}`);
}

console.log('\n--- M2 (family)  20 random non-affine gates ---');
{
  let sd = 4242;
  const rnd = () => { sd = (Math.imul(sd, 1103515245) + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  const A = fact(27) / 2n;
  let reached = 0, tried = 0;
  while (tried < 20) {
    const p = Array.from({ length: 9 }, (_, i) => i);
    for (let i = 8; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const lift = (a, b) => idPerm(N).map(s => {
      const t = trits(s);
      const v = p[t[a] + 3 * t[b]];
      t[a] = v % 3; t[b] = Math.floor(v / 3) % 3;
      return state(t);
    });
    if (isAffine(lift(0, 1))) continue;
    tried++;
    const ord = groupOrder([INC(0), lift(0, 1), lift(1, 2), lift(2, 0)], N);
    if (ord >= A) reached++;
  }
  console.log(`      ${reached} of ${tried} random non-affine gates reach at least A_27`);
}

console.log('\n--- M3  the same wiring with an AFFINE gate ---');
{
  const gens = [INC(0), CINC(0, 1), CINC(1, 2), CINC(2, 0)];
  console.log(`      non-affine generators: ${gens.filter(g => !isAffine(g)).length} of ${gens.length}`);
  const ord = groupOrder(gens, N);
  console.log(`      order ${ord}   |AGL(3,3)| = 303264   within it: ${ord <= 303264n}`);
  console.log(`      as a fraction of 27!: ${(Number(ord) / Number(fact(27))).toExponential(2)}`);

  // MEMBERSHIP, not an order bound. An order bound is satisfied by any small
  // group and would pass for the wrong reason. The group is small enough to
  // enumerate, so every element is tested for the form x -> Ax + b.
  const seen = new Map([[gens[0].join(','), idPerm(N)]]);
  seen.clear(); seen.set(idPerm(N).join(','), idPerm(N));
  const queue = [idPerm(N)];
  while (queue.length) {
    const g = queue.shift();
    for (const h of gens) {
      const p = mul(h, g), k = p.join(',');
      if (!seen.has(k)) { seen.set(k, p); queue.push(p); }
    }
  }
  const nonAffine = [...seen.values()].filter(g => !isAffine(g)).length;
  console.log(`      enumerated all ${seen.size} elements; matches the chain: ${BigInt(seen.size) === ord}`);
  console.log(`      elements failing the x -> Ax + b membership test: ${nonAffine}`);
  console.log('      one gate changed from non-affine to affine, same widths, same wiring.');
}

console.log('\n' + line);
