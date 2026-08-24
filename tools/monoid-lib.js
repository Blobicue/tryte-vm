'use strict';
/* monoid-lib.js — the mechanics behind tools/monoid-audit.js.
 *
 * Separated so the CLI and test/test-monoid.js share ONE implementation. The
 * registered predictions stay in monoid-audit.js; only the machinery lives here.
 *
 * A vocabulary of k tables on N points generates a monoid under composition.
 * Chaining stages, however many, cannot leave it. Shape borrowed from
 * gameladder's tools/table-audit.py, which credits unit:braid_relation_miner.
 */

const CAP = 300000;                  // ball cap; truncation is REPORTED, never silent

/* --- arena: width-w trytes, index i meaning balanced value i - (3^w-1)/2 --- */
function arena(w) {
  const N = 3 ** w, half = (N - 1) / 2;
  const val = i => i - half;
  const idx = v => (((v + half) % N) + N) % N;
  const trits = v => {
    const t = []; let x = v;
    for (let k = 0; k < w; k++) {
      let r = ((x % 3) + 3) % 3;
      if (r === 2) r = -1;
      t.push(r); x = (x - r) / 3;
    }
    return t;
  };
  const fromTrits = t => t.reduceRight((a, x) => a * 3 + x, 0);
  return { w, N, val, idx, trits, fromTrits };
}

const compose = (a, b) => a.map(x => b[x]);            // apply a, then b
const ident = N => Array.from({ length: N }, (_, i) => i);

/** v -> tgate(control, v, y), as a table over the arena's indices. */
function tgateTable(A, control, y) {
  const cT = A.trits(control), yT = A.trits(y);
  return Array.from({ length: A.N }, (_, i) => {
    const out = A.trits(A.val(i)).map((t, p) => {
      const m = cT[p];
      return m === -1 ? -t : m === 0 ? Math.min(t, yT[p]) : Math.max(t, yT[p]);
    });
    return A.idx(A.fromTrits(out));
  });
}
const addTable = (A, k) => Array.from({ length: A.N }, (_, i) => A.idx(A.val(i) + k));

function vocabularies(A) {
  const half = (A.N - 1) / 2;
  const allControls = [];
  for (let c = -half; c <= half; c++) allControls.push(c);
  const uniform = m => A.fromTrits(Array.from({ length: A.w }, () => m));
  const y = 0;                                          // fixed second operand
  return {
    pure: [-1, 0, 1].map(m => tgateTable(A, uniform(m), y)),
    all: allControls.map(c => tgateTable(A, c, y)),
    addi: [1, 3, 9].filter(k => k < A.N).map(k => addTable(A, k)),
    shift: [
      Array.from({ length: A.N }, (_, i) => A.idx(-A.val(i))),
      Array.from({ length: A.N }, (_, i) => A.idx(A.val(i) * 3)),
      Array.from({ length: A.N }, (_, i) =>
        A.idx(A.fromTrits(A.trits(A.val(i)).slice(1).concat([0])))),
    ],
  };
}

/* --- the audit ------------------------------------------------------------ */
function audit(gens, N, maxdepth = 16) {
  const seen = new Set([ident(N).join(',')]);
  let frontier = [ident(N)];
  const sizes = []; let rules = 0, capped = false, shortest = null;
  for (let d = 0; d < maxdepth; d++) {
    const fresh = new Map();
    for (const t of frontier) {
      for (const g of gens) {
        const nt = compose(t, g), key = nt.join(',');
        if (seen.has(key) || fresh.has(key)) {
          rules++;
          if (shortest === null) shortest = d + 1;
        } else if (seen.size + fresh.size >= CAP) {
          capped = true;
        } else {
          fresh.set(key, nt);
        }
      }
    }
    if (capped || fresh.size === 0) { sizes.push(seen.size); break; }
    for (const k of fresh.keys()) seen.add(k);
    frontier = [...fresh.values()];
    sizes.push(seen.size);
  }
  const saturated = !capped && sizes.length >= 2 && sizes[sizes.length - 1] === sizes[sizes.length - 2];
  return { sizes, rules, total: seen.size, capped, shortest, saturated };
}

/** Audit one vocabulary at one width. */
function reach(name, w) {
  const A = arena(w);
  return audit(vocabularies(A)[name], A.N);
}

/* --- the corrected law ---------------------------------------------------- */
/* Derived AFTER the run, and labelled so throughout. One composition step
 * applies ONE control across ALL trit positions, so after d steps every position
 * has been acted on by a word of length exactly d. The reachable tuples are
 * therefore those whose positions agree on word LENGTH — a union over depths of
 * products, not the full direct product the registered P3 assumed. */
function perTritDepths(depth = 14) {
  const key = f => f.join(',');
  const ap = (f, g) => [0, 1, 2].map(i => g[f[i]]);
  const GENS = [[2, 1, 0], [0, 1, 1], [1, 1, 2]];       // NEG, MIN(.,0), MAX(.,0)
  const out = []; let cur = new Map([['0,1,2', [0, 1, 2]]]);
  for (let d = 0; d < depth; d++) {
    out.push([...cur.values()]);
    const nxt = new Map();
    for (const f of cur.values()) for (const g of GENS) { const h = ap(f, g); nxt.set(key(h), h); }
    cur = nxt;
  }
  return out;
}

function reachByLaw(w) {
  const depths = perTritDepths();
  const seen = new Set();
  for (const level of depths) {
    const rec = pre => {
      if (pre.length === w) { seen.add(pre.join('/')); return; }
      for (const a of level) rec(pre.concat([a.join(',')]));
    };
    rec([]);
  }
  return seen.size;
}

/* --- TOP vocabularies ------------------------------------------------------ */
/* A TOP table has three COLUMNS, one per value of the second operand's trit.
 * Column j is a unary map on trits. So one TOP instruction picks three arbitrary
 * unary maps and assigns one to each position according to the second operand.
 * TGATE is the same shape with the three columns nailed to NEG / MIN / MAX. */

/** Every unary map on {-1,0,+1}: all 27 of them, as index triples. */
function allUnary() {
  const out = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) out.push([a, b, c]);
  return out;
}

/** Apply a per-position tuple of unary trit maps, as a table over arena indices. */
function positionwise(A, maps) {
  return Array.from({ length: A.N }, (_, i) =>
    A.idx(A.fromTrits(A.trits(A.val(i)).map((t, p) => maps[p][t + 1] - 1))));
}

/** TOP with the second operand pinned to 0: one table, so every position gets
 *  the SAME column. The generators are diagonal however many tables exist. */
function topFixed(A) {
  return allUnary().map(m => positionwise(A, Array.from({ length: A.w }, () => m)));
}

/** TOP with the second operand free, restricted to SINGLE-POSITION updates:
 *  one position takes an arbitrary map while the rest take the identity column.
 *  A strict SUBSET of what TOP+free-y can do, so whatever it reaches is a lower
 *  bound on the real reach. Used with the positionwise ceiling to pin equality. */
function topSinglePos(A) {
  const ID = [0, 1, 2];
  const gens = [];
  for (let p = 0; p < A.w; p++) {
    for (const m of allUnary()) {
      gens.push(positionwise(A, Array.from({ length: A.w }, (_, q) => (q === p ? m : ID))));
    }
  }
  return gens;
}

module.exports = { CAP, arena, compose, ident, tgateTable, addTable,
                   vocabularies, audit, reach, perTritDepths, reachByLaw,
                   allUnary, positionwise, topFixed, topSinglePos };
