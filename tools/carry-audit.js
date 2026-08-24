'use strict';
/* CARRY AUDIT — what does it take to beat the positionwise ceiling?
 *
 * Third in the series, same instrument. monoid-audit.js measured TGATE and found
 * 77,687 at width 6. top-audit.js measured TOP and found the ceiling for ANY
 * positionwise vocabulary: 27^w, because an operation computing out_p from
 * (x_p, y_p) alone induces at most the 27 unary maps per position, and positions
 * then compose independently.
 *
 * That ceiling holds no matter how many tables you have. This audit asks what
 * breaks it, and the candidate is the obvious one: an operation whose output at
 * one position depends on trits at OTHER positions. A carry.
 *
 * The machine already has such operations — ADD, SUB and ADDI carry, SHL and SHR
 * move trits between positions. So the question is not academic: it is whether
 * the gate vocabulary or the ARITHMETIC is what makes this machine general.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit. This block
 * contains no measurement.
 *
 *   R1  pw saturates at exactly 27^w.
 *       The positionwise control, re-measured here so the comparison is internal
 *       rather than quoted from another file.
 *
 *   R2  pwWide saturates at exactly 27^w TOO — the same number, from 27 extra
 *       generators. This is table-audit's wide16 reproduced in this arena: the
 *       count of generators is not the size of what they generate. It is the
 *       control that makes R3 mean something, because without it "we added a
 *       generator and reach went up" proves nothing.
 *
 *   R3  pwAdd — pw plus the single translation v -> v+1 — exceeds 27^w at w=2 by
 *       at least 10x. One carrying generator, added to a vocabulary that 27 extra
 *       non-carrying ones could not move.
 *
 *   R4  pwShl — pw plus the shift v -> 3v — also exceeds 27^w at w=2. Shifts move
 *       trits between positions, so they couple too; the escape should not be
 *       peculiar to addition.
 *
 *   R5  Therefore the escape is CROSS-TRIT COUPLING, not generator count, and
 *       this machine's generality comes from its arithmetic rather than its
 *       gates. TGATE and TOP, however many tables, are bounded by 27^w.
 * ------------------------------------------------------------------------------
 */

const { arena, audit, topSinglePos, topFixed, addTable } = require('./monoid-lib.js');

const WIDTHS = [1, 2];
const line = '='.repeat(78);

/** v -> 3v, wrapped: the shift, which moves every trit one position up. */
const shlTable = A => Array.from({ length: A.N }, (_, i) => A.idx(A.val(i) * 3));

const VOCABS = A => ({
  pw:     topSinglePos(A),
  pwWide: topSinglePos(A).concat(topFixed(A)),
  pwAdd:  topSinglePos(A).concat([addTable(A, 1)]),
  pwShl:  topSinglePos(A).concat([shlTable(A)]),
});

console.log('CARRY AUDIT — positionwise vocabularies are capped at 27^w. What breaks the cap?\n');
const res = {};
for (const w of WIDTHS) {
  const A = arena(w);
  res[w] = {};
  console.log(`--- width ${w}  (N = ${A.N}, all maps = ${A.N ** A.N}) ---`);
  for (const [name, gens] of Object.entries(VOCABS(A))) {
    const r = audit(gens, A.N);
    res[w][name] = r;
    const state = r.saturated ? `SATURATED at ${r.total}`
      : r.capped ? `UNSATURATED, past ${r.total} (capped)`
        : `growing, ${r.total}`;
    console.log(`  ${name.padEnd(7)} k=${String(gens.length).padEnd(4)} ${state}`);
    console.log(`          ball ${JSON.stringify(r.sizes.slice(0, 7))}${r.sizes.length > 7 ? ' ...' : ''}`);
  }
  console.log();
}

console.log(line);
console.log('R1  pw saturates at exactly 27^w');
for (const w of WIDTHS) {
  const r = res[w].pw;
  console.log(`      w=${w}: ${r.total} vs 27^${w}=${27 ** w}   ${r.saturated && r.total === 27 ** w ? 'HOLDS' : 'FAILS'}`);
}

console.log('\nR2  pwWide saturates at the SAME 27^w — 27 more generators, +0 elements');
for (const w of WIDTHS) {
  const a = res[w].pw, b = res[w].pwWide;
  console.log(`      w=${w}: pw(k=${a.total === undefined ? '?' : topSinglePos(arena(w)).length}) ${a.total}`
    + ` vs pwWide ${b.total}   ${b.saturated && b.total === a.total ? 'HOLDS' : 'FAILS'}`
    + `   (${b.total - a.total >= 0 ? '+' : ''}${b.total - a.total} elements)`);
}

console.log('\nR3  pwAdd — one translation — exceeds 27^w at w=2 by at least 10x');
{
  const w = 2, a = res[w].pw.total, b = res[w].pwAdd.total;
  console.log(`      w=${w}: pw ${a} -> pwAdd ${b}   ratio ${(b / a).toFixed(1)}x   ${b >= 10 * a ? 'HOLDS' : 'FAILS'}`);
}

console.log('\nR4  pwShl — one shift — also exceeds 27^w at w=2');
{
  const w = 2, a = res[w].pw.total, b = res[w].pwShl.total;
  console.log(`      w=${w}: pw ${a} -> pwShl ${b}   ratio ${(b / a).toFixed(1)}x   ${b > a ? 'HOLDS' : 'FAILS'}`);
}

console.log('\nR5  the escape is cross-trit coupling, not generator count');
{
  const w = 2;
  const wideGain = res[w].pwWide.total - res[w].pw.total;
  const addGain = res[w].pwAdd.total - res[w].pw.total;
  console.log(`      w=2: +27 positionwise generators bought ${wideGain >= 0 ? '+' : ''}${wideGain} elements`);
  console.log(`           + 1 carrying generator bought ${addGain >= 0 ? '+' : ''}${addGain} elements`);
  console.log(`      ${wideGain === 0 && addGain > 0 ? 'HOLDS' : 'FAILS'}`);
  console.log('      So TGATE and TOP are bounded by 27^w however many tables they carry,');
  console.log("      and this machine's generality comes from ADD/SUB/SHL/SHR, not its gates.");
}
console.log(line);
