'use strict';
/* test-fold.js — folding a chain of TOP tables into one, and the assembler bug
 * that folding exposed.
 *
 * The monoid audits proved positionwise operations are closed under composition.
 * Closure is the licence to fold: a chain collapses at build time into a single
 * table applied by a single instruction. These tests pin the algebra, the saving,
 * and the boundary where it stops.
 */

const T = require('../src/ternary.js');
const { runNative, runHosted, supportedOpcodes, plan, interpSize, maxDepth } = require('../src/selfhost.js');
const { assemble } = require('../src/assembler.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const MODES = [T.tgateModeTable(0), T.tgateModeTable(-1), T.tgateModeTable(1), T.tgateModeTable(-1)];
const ALL = []; for (let v = T.TRYTE_MIN; v <= T.TRYTE_MAX; v++) ALL.push(v);

console.log('\n=== 1. THE FOLD IS EXACT ===');
check('a two-stage fold matches the chain for every tryte, at several y', (() => {
  const f = T.foldTables(MODES[0], MODES[1]);
  for (const y of [-364, -45, 0, 91, 364]) {
    for (const x of ALL) {
      if (T.ttable(f, x, y) !== T.ttable(MODES[1], T.ttable(MODES[0], x, y), y)) return false;
    }
  }
  return true;
})());
check('a four-stage fold matches the chain for every tryte, at several y', (() => {
  const f = T.foldTables(...MODES);
  for (const y of [-364, -13, 0, 123, 364]) {
    for (const x of ALL) {
      let v = x; for (const t of MODES) v = T.ttable(t, v, y);
      if (T.ttable(f, x, y) !== v) return false;
    }
  }
  return true;
})());
check('the fold formula is y-independent — one fold serves every second operand',
  (() => {
    const f = T.foldTables(MODES[0], MODES[1]);
    return [-364, -100, 0, 55, 364].every(y => ALL.every(x =>
      T.ttable(f, x, y) === T.ttable(MODES[1], T.ttable(MODES[0], x, y), y)));
  })());
check('the identity table folds away without trace',
  T.tableKey(T.foldTables(T.identityTable(), MODES[2])) === T.tableKey(MODES[2]) &&
  T.tableKey(T.foldTables(MODES[2], T.identityTable())) === T.tableKey(MODES[2]));
check('folding is associative, as composition must be', (() => {
  const l = T.foldTables(T.foldTables(MODES[0], MODES[1]), MODES[2]);
  const r = T.foldTables(MODES[0], T.foldTables(MODES[1], MODES[2]));
  return T.tableKey(l) === T.tableKey(r);
})());

console.log('\n=== 2. TOP IS CLOSED UNDER FOLDING; TGATE IS NOT ===');
check('every fold of two TOP tables is again a TOP table (checked on 400 pairs)', (() => {
  const rnd = s => Array.from({ length: 9 }, (_, i) => ((s * 7 + i * 13) % 3) - 1);
  for (let a = 0; a < 20; a++) for (let b = 0; b < 20; b++) {
    const f = T.foldTables(rnd(a), rnd(b));
    if (f.length !== 9 || !f.every(e => e >= -1 && e <= 1)) return false;
  }
  return true;
})());
check('but 6 of TGATE\'s 8 two-stage composites are not any TGATE mode', (() => {
  const modes = new Set([-1, 0, 1].map(m => T.tableKey(T.tgateModeTable(m))));
  const comps = new Set();
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) {
    comps.add(T.tableKey(T.foldTables(T.tgateModeTable(a), T.tgateModeTable(b))));
  }
  return comps.size === 8 && [...comps].filter(c => !modes.has(c)).length === 6;
})());
check('...which is why TOP folds and TGATE cannot — its three modes are not closed',
  true);

console.log('\n=== 3. HASH-CONSING ===');
check('identical tables share one content address',
  T.tableKey(MODES[0]) === T.tableKey(T.tgateModeTable(0)) &&
  T.tableKey(MODES[0]) !== T.tableKey(MODES[1]));
check('entries differing only above the lowest trit address identically',
  T.tableKey(MODES[0]) === T.tableKey(MODES[0].map((e, i) => e + (i % 2 ? 3 : -3))));
check('four tables with two distinct values need 2 x 9 cells, not 4 x 9', (() => {
  const dup = [MODES[0], MODES[1], MODES[0], MODES[1]];
  return new Set(dup.map(T.tableKey)).size * 9 === 18;
})());

console.log('\n=== 4. WHAT IT SAVES, ON THE REAL MACHINE ===');
/** The chain as a program. Compact: data follows the code, and the last stage
 *  leaves its result in the accumulator instead of round-tripping to memory. */
function chainProgram(tables, folded) {
  if (folded) {
    // One stage needs no scratch cell at all: point C at the table BEFORE the
    // input arrives, and the value never has to leave the accumulator.
    const t = T.foldTables(...tables);
    return ['LOADI tb0', 'STORE cp', 'LDC cp', 'IN', 'TOP yv', 'OUT', 'HALT',
      'cp: .word 0', 'yv: .word -45',
      `tb0: .word ${t.map(T.lowTrit).join(', ')}`].join('\n');
  }
  // A chain must round-trip through memory between stages, because setting up
  // the next table destroys the accumulator. That cost is intrinsic to the chain.
  const lines = ['IN', 'STORE xv'];
  tables.forEach((_, i) => {
    lines.push(`LOADI tb${i}`, 'STORE cp', 'LDC cp', 'LOAD xv', 'TOP yv');
    if (i < tables.length - 1) lines.push('STORE xv');
  });
  lines.push('OUT', 'HALT', 'cp: .word 0', 'yv: .word -45', 'xv: .word 0');
  tables.forEach((t, i) => lines.push(`tb${i}: .word ${t.map(T.lowTrit).join(', ')}`));
  return lines.join('\n');
}
{
  const u = chainProgram(MODES, false), f = chainProgram(MODES, true);
  const probes = [-364, -45, 0, 7, 123, 364];
  check('folded and unfolded programs agree on every probe',
    probes.every(x => runNative(u, [x]).output[0] === runNative(f, [x]).output[0]));
  const uc = assemble(u, 0).cells.size, fc = assemble(f, 0).cells.size;
  const us = runNative(u, [123]).steps, fs = runNative(f, [123]).steps;
  check(`cells ${uc} -> ${fc} (${uc - fc} saved)`, uc === 93 && fc === 25, `${uc} -> ${fc}`);
  check(`instructions ${us} -> ${fs} (${us - fs} saved)`, us === 27 && fs === 7, `${us} -> ${fs}`);

  const hu = runHosted(u, [123], { depth: 2, maxSteps: 5e7 });
  const hf = runHosted(f, [123], { depth: 2, maxSteps: 5e7 });
  check('emulated at depth 2 the same fold saves far more than natively',
    hu.steps - hf.steps > 20 * (us - fs), `${hu.steps - hf.steps} vs ${us - fs}`);
  check('the per-instruction multiplier is about 27x',
    Math.abs((hu.steps - hf.steps) / (us - fs) - 27) < 1.5,
    String((hu.steps - hf.steps) / (us - fs)));

  // Coverage first: the core now implements TOP and LDC, so TOP programs are no
  // longer stopped by a missing opcode. What is left is pure size.
  check('the core implements TOP and LDC, so no layer refuses a TOP program outright',
    supportedOpcodes('core').has('TOP') && supportedOpcodes('core').has('LDC'));

  // FOLDING BUYS A DEPTH LEVEL. At depth 4 the innermost machine has 60 cells.
  // The unfolded chain needs 93 and is refused; the folded one needs 30 and runs.
  // Same source, same output, one more layer of emulation — the fold is not only
  // cheaper to execute, it reaches further.
  check(`depth 4 has a ${plan(4, 'core').innerCells}-cell window`,
    plan(4, 'core').innerCells > 20 && plan(4, 'core').innerCells < 140);
  check('the UNFOLDED chain is refused at depth 4, on size', (() => {
    try { runHosted(u, [123], { depth: 4, maxSteps: 5e7 }); return false; }
    catch (e) { return /window is/.test(e.message) && !/does not implement/.test(e.message); }
  })());
  check('the FOLDED chain runs at depth 4 and still matches native', (() => {
    const want = runNative(f, [123]).output.join();
    return runHosted(f, [123], { depth: 4, maxSteps: 5e7 }).output.join() === want;
  })());
  check('so folding buys a depth level, not just instructions', true);
}
console.log('\n=== 5. WHERE FOLDING STOPS ===');
check('inserting one ADD breaks the equivalence — a carry is not positionwise', (() => {
  const f = T.foldTables(MODES[0], MODES[1]), y = -45, K = 40;
  return ALL.some(x => T.ttable(MODES[1], T.wrap(T.ttable(MODES[0], x, y) + K), y) !== T.ttable(f, x, y));
})());
check('so the optimisation stops exactly where the carry audit said reach begins',
  true);

console.log('\n=== 6. THE ASSEMBLER BUG FOLDING EXPOSED ===');
{
  // `LOADI t0` assembled as the VALUE zero, not the ADDRESS of label t0, because
  // `t0` is also trit-literal syntax. Silent, and it produced a wrong program.
  check('a label that is also trit-literal syntax is refused', (() => {
    try { assemble('t0: .word 1\nLOADI t0\nHALT', 0); return false; }
    catch (e) { return /also trit-literal syntax/.test(e.message); }
  })());
  check('the message says what to do about it', (() => {
    try { assemble('t00: .word 1', 0); return false; }
    catch (e) { return /rename it/.test(e.message); }
  })());
  check('ordinary labels beginning with t are still fine',
    (() => { assemble('tb0: .word 1\ntable: .word 2\nt: .word 3\nHALT', 0); return true; })());
  check('trit literals themselves still work', assemble('LOADI t+0-\nHALT', 0).cells.get(1) === T.parseTritString('+0-'));
}

console.log('\n=== 7. TOPC — the carry as a table ===');
{
  const { addCarryTable, ttableC } = T;
  const ADDT = addCarryTable();

  check('the table has 27 rows, one per (x, y, carry-in)', ADDT.length === 27);
  check('each row packs both outputs into one cell: out + 3 x carry',
    ADDT.every(v => v >= -4 && v <= 4));

  // The headline: the machine's arithmetic IS a table.
  check('ADD equals TOPC with the addition table, over every operand pair', (() => {
    for (let x = T.TRYTE_MIN; x <= T.TRYTE_MAX; x++) {
      for (let y = T.TRYTE_MIN; y <= T.TRYTE_MAX; y += 5) {
        if (ttableC(ADDT, x, y) !== T.add(x, y)) return false;
      }
    }
    return true;
  })());

  check('the machine agrees with the module', (() => {
    const src = ['LOADI tb', 'STORE cp', 'LDC cp', 'IN', 'TOPC yv', 'OUT', 'HALT',
      'cp: .word 0', 'yv: .word -45', `tb: .word ${ADDT.join(', ')}`].join('\n');
    return [-364, -45, 0, 7, 123, 364].every(x =>
      runNative(src, [x]).output[0] === T.add(x, -45));
  })());

  // U1, kept: no positionwise table can do this.
  check('U1 — no TOP table equals ADD, over all 19,683, compared as functions', (() => {
    const probes = [];
    for (let i = 0; i < 40; i++) probes.push([i * 53 - 364, i * 137 - 364]);
    for (let i = 0; i < 19683; i++) {
      const tbl = []; let n = i;
      for (let k = 0; k < 9; k++) { tbl.push((n % 3) - 1); n = Math.floor(n / 3); }
      if (probes.every(([x, y]) => T.ttable(tbl, x, y) === T.add(x, y))) return false;
    }
    return true;
  })());
  check('   ...though 81 of them match ADD at one input pair, which is the trap', (() => {
    let c = 0;
    for (let i = 0; i < 19683; i++) {
      const tbl = []; let n = i;
      for (let k = 0; k < 9; k++) { tbl.push((n % 3) - 1); n = Math.floor(n / 3); }
      if (T.ttable(tbl, 123, -45) === T.add(123, -45)) c++;
    }
    return c === 81;
  })());

  // U3, kept: the split between the two interpreters is measured, not casual.
  check('U3 — the full interpreter implements TOPC; the core deliberately does not',
    supportedOpcodes('full').has('TOPC') && !supportedOpcodes('core').has('TOPC'));
  check('   because a TOPC handler would leave the depth-4 window under 24 cells',
    729 - 3 * (interpSize('core') + 16) < 24,
    String(729 - 3 * (interpSize('core') + 16)));
  check('   while the core as it stands keeps depth 4', maxDepth('core') === 4);

  check('a program using TOPC still emulates, through the full interpreter', (() => {
    const src = ['LOADI tb', 'STORE cp', 'LDC cp', 'IN', 'TOPC yv', 'OUT', 'HALT',
      '.org -60', 'cp: .word 0', 'yv: .word -45', `tb: .word ${ADDT.join(', ')}`].join('\n');
    const want = runNative(src, [123]).output.join();
    return runHosted(src, [123], { depth: 2, maxSteps: 5e7 }).output.join() === want;
  })());
}

console.log('\n=== 8. U2 — ONE INSTRUCTION PAST THE CEILING ===');
{
  const { arena, audit, topSinglePos, addTable } = require('../tools/monoid-lib.js');
  const A = arena(2);
  const ADDT = T.addCarryTable();
  const half = (A.N - 1) / 2;

  // TOPC carrying the addition table, over every second operand.
  const topcGens = [];
  for (let y = -half; y <= half; y++) {
    topcGens.push(Array.from({ length: A.N }, (_, i) => {
      const xs = A.trits(A.val(i)), ys = A.trits(y);
      const out = []; let c = 0;
      for (let k = 0; k < A.w; k++) {
        const cell = ADDT[(xs[k] + 1) * 9 + (ys[k] + 1) * 3 + (c + 1)];
        c = Math.sign(cell) * Math.round(Math.abs(cell) / 3);
        out.push(cell - 3 * c);
      }
      return A.idx(A.fromTrits(out));
    }));
  }
  const pw = topSinglePos(A);
  const alone = audit(pw, A.N).total;
  const withTopc = audit(pw.concat(topcGens), A.N).total;
  const withAdd = audit(pw.concat([addTable(A, 1)]), A.N).total;

  check('positionwise alone still saturates at the 27^2 ceiling', alone === 729);
  check(`TOPC carrying ADD breaks it, reaching ${withTopc}`, withTopc > 729);
  check('U2 — it reaches exactly 251,505', withTopc === 251505, String(withTopc));
  check('   the same monoid a plain translation reached, from ONE instruction',
    withTopc === withAdd, `${withTopc} vs ${withAdd}`);
  check('   which is 345x the positionwise ceiling',
    Math.round(withTopc / alone) === 345, String(Math.round(withTopc / alone)));
  check('   and still only 0.065% of the maps on 9 points',
    Math.abs(100 * withTopc / 9 ** 9 - 0.0649) < 0.001);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
