'use strict';
/* perm-lib.js — permutation utilities on n points, shared by the audits that ask
 * group-theoretic questions.
 *
 * Extracted from reversible-audit.js unchanged, by copying lines rather than
 * retyping them, because this repository has a defect class for facts that could
 * have been moved and were transcribed instead. Nothing here knows how many trits
 * a state has: every function takes n, so the same chain serves a 27-point
 * register and a 729-point accumulator.
 */

// --- permutation utilities (states are 0..n-1) -------------------------------
const idPerm = n => Array.from({ length: n }, (_, i) => i);
const mul = (g, h) => h.map(x => g[x]);        // (g*h)(x) = g(h(x))
const inv = g => { const r = new Array(g.length); g.forEach((v, i) => { r[v] = i; }); return r; };
const isId = g => g.every((v, i) => v === i);
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

module.exports = { idPerm, mul, inv, isId, parity, groupOrder };
