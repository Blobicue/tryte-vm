'use strict';
/* TRYTE VOCABULARY AUDITOR — what does TGATE actually generate?
 *
 * Instrument borrowed from gameladder's tools/table-audit.py, which credits
 * unit:braid_relation_miner for the shape. Same question, different arena.
 *
 * THE QUESTION. TGATE takes a control tryte and applies a per-trit choice of
 * NEG / MIN / MAX. Fix the second data operand and each of the 3^w controls
 * becomes a unary map on trytes — a TABLE. A vocabulary of k tables on N points
 * generates a MONOID under composition, and chaining stages can never leave it.
 *
 * The source conversation this project grew out of claimed that two cascaded
 * 6-trit stages give "729 x 729 = 531,441 unique cascading logic networks."
 * That counts CONFIGURATIONS. This counts ELEMENTS. They are not the same number
 * and the difference is the whole point of the instrument.
 *
 * WHY JAVASCRIPT AND NOT PYTHON, unlike the tool this is modelled on: the tryte
 * semantics already exist in src/ternary.js and are covered by 261 tests.
 * Re-implementing tgate in Python to audit it would create a second definition
 * that could drift from the one under test. The auditor's SHAPE is ported; the
 * semantics are imported.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, so git
 * supplies the ordering that an editable source file cannot. If a later commit
 * changes a value here, the git history says so; that is the mechanism
 * gameladder's check-registration.py exists to enforce, and the same rule is
 * being followed by hand.
 *
 *   P1  addi        saturates at exactly 3^w        (translations; cyclic group)
 *   P2  all         saturates; does not grow freely
 *   P3  reach(all, w) = reach(all, 1) ^ w           THE RISKY ONE. Generators act
 *                                                    independently per trit, so the
 *                                                    monoid should be a direct
 *                                                    product across positions.
 *   P4  reach(pure, w) < reach(all, w) for w >= 2   Unlike table-audit's wide16,
 *                                                    where 10 extra tables bought
 *                                                    +0 elements, here the extra
 *                                                    tables SHOULD buy elements,
 *                                                    because they are independent
 *                                                    per position rather than all
 *                                                    drawn from one linear group.
 *   P5  reach(all, 6) != 531441                     the conversation's figure is
 *                                                    a configuration count, not an
 *                                                    element count
 *   P6  shift       saturates                       SHR is many-to-one and drives
 *                                                    everything to 0 eventually
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');

const CAP = 300000;          // ball cap; any truncation is REPORTED, never silent

/* --- arena ------------------------------------------------------------------ */
/* Width-w trytes. Values are indices 0..3^w-1; index i is the balanced value
 * i - (3^w-1)/2, so the arena is the real tryte arithmetic, just narrower. */
function arena(w) {
  const N = 3 ** w, half = (N - 1) / 2;
  const val = i => i - half;
  const idx = v => (((v + half) % N) + N) % N;
  const trits = v => { const t = []; let x = v; for (let k = 0; k < w; k++) { let r = ((x % 3) + 3) % 3; if (r === 2) r = -1; t.push(r); x = (x - r) / 3; } return t; };
  const fromTrits = t => t.reduceRight((a, x) => a * 3 + x, 0);
  return { w, N, val, idx, trits, fromTrits };
}

const compose = (a, b) => a.map(x => b[x]);          // apply a, then b
const ident = N => Array.from({ length: N }, (_, i) => i);

/* --- vocabularies ----------------------------------------------------------- */
/** v -> tgate(control, v, y), as a table over the arena's indices. */
function tgateTable(A, control, y) {
  const cT = A.trits(control), yT = A.trits(y);
  return Array.from({ length: A.N }, (_, i) => {
    const vT = A.trits(A.val(i));
    const out = vT.map((t, p) => {
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
  const y = 0;                                        // fixed second operand
  return {
    // the three uniform controls: whole unit becomes NEG, MIN or MAX
    pure: [-1, 0, 1].map(m => tgateTable(A, uniform(m), y)),
    // every control the machine can express
    all: allControls.map(c => tgateTable(A, c, y)),
    // translations
    addi: [1, 3, 9].filter(k => k < A.N).map(k => addTable(A, k)),
    // the arithmetic vocabulary: negate and the two shifts
    shift: [
      Array.from({ length: A.N }, (_, i) => A.idx(-A.val(i))),
      Array.from({ length: A.N }, (_, i) => A.idx(A.val(i) * 3)),
      Array.from({ length: A.N }, (_, i) => A.idx(A.fromTrits(A.trits(A.val(i)).slice(1).concat([0])))),
    ],
  };
}

/* --- the audit -------------------------------------------------------------- */
function audit(gens, N, maxdepth = 16) {
  const seen = new Map([[ident(N).join(','), true]]);
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
    for (const [k] of fresh) seen.set(k, true);
    frontier = [...fresh.values()];
    sizes.push(seen.size);
  }
  return { sizes, rules, total: seen.size, capped, shortest };
}

function report(name, gens, N) {
  const r = audit(gens, N);
  const saturated = !r.capped && r.sizes.length >= 2 && r.sizes[r.sizes.length - 1] === r.sizes[r.sizes.length - 2];
  const state = saturated ? `SATURATED at ${r.total}`
    : r.capped ? `no saturation (cap ${CAP})`
      : `growing, ${r.total} at d=${r.sizes.length}`;
  console.log(`  ${name.padEnd(7)} k=${String(gens.length).padEnd(4)} ${state}`);
  console.log(`          ball ${JSON.stringify(r.sizes.slice(0, 8))}${r.sizes.length > 8 ? ' ...' : ''}   rules ${r.rules}, shortest len ${r.shortest}`);
  return { name, k: gens.length, ...r, saturated };
}

/* --- run -------------------------------------------------------------------- */
const WIDTHS = [1, 2, 3];
const results = {};
console.log('TRYTE VOCABULARY AUDIT — a vocabulary reaches only the monoid it generates.');
console.log('Cascading stages, however many, cannot exceed it.\n');
for (const w of WIDTHS) {
  const A = arena(w);
  const V = vocabularies(A);
  console.log(`--- width ${w}  (N = ${A.N} trytes, ${A.N ** A.N} maps in total) ---`);
  results[w] = {};
  for (const [name, gens] of Object.entries(V)) results[w][name] = report(name, gens, A.N);
  console.log();
}

console.log('='.repeat(78));
console.log('P1  addi saturates at exactly 3^w');
for (const w of WIDTHS) {
  const r = results[w].addi;
  console.log(`      w=${w}: reached ${r.total}, 3^${w} = ${3 ** w}  ${r.saturated && r.total === 3 ** w ? 'HOLDS' : 'FAILS'}`);
}
console.log('\nP2  all saturates');
for (const w of WIDTHS) console.log(`      w=${w}: ${results[w].all.saturated ? 'HOLDS' : 'FAILS'} (${results[w].all.total})`);
console.log('\nP6  shift saturates');
for (const w of WIDTHS) console.log(`      w=${w}: ${results[w].shift.saturated ? 'HOLDS' : 'FAILS'} (${results[w].shift.total})`);

const m = results[1].all.total;
console.log(`\nP3  reach(all, w) = reach(all, 1)^w   with reach(all,1) = ${m}`);
let productLaw = true;
for (const w of WIDTHS) {
  const got = results[w].all.total, want = m ** w;
  if (got !== want) productLaw = false;
  console.log(`      w=${w}: reached ${got}, predicted ${want}  ${got === want ? 'HOLDS' : 'FAILS'}`);
}

console.log('\nP4  reach(pure, w) < reach(all, w) for w >= 2 — extra tables DO buy elements here');
for (const w of WIDTHS) {
  const p = results[w].pure.total, a = results[w].all.total;
  console.log(`      w=${w}: pure ${p} vs all ${a}   ${w < 2 ? '(n/a)' : (p < a ? 'HOLDS' : 'FAILS')}`);
}

console.log('\nP5  the conversation\'s 531,441');
if (productLaw) {
  const six = m ** 6;
  console.log(`      product law holds, so reach(all, 6) = ${m}^6 = ${six.toLocaleString()}`);
  console.log(`      claimed "unique cascading networks"  = 531,441`);
  console.log(`      ${six === 531441 ? 'EQUAL — P5 FAILS' : 'DIFFERENT — P5 HOLDS'}` +
    (six !== 531441 ? `   (the claim ${six < 531441 ? 'OVERSTATES' : 'UNDERSTATES'} by a factor of ${(Math.max(six, 531441) / Math.min(six, 531441)).toFixed(2)})` : ''));
} else {
  console.log('      product law failed, so width 6 cannot be extrapolated — P5 undecided here');
}
console.log('='.repeat(78));
