'use strict';
/* test-selfhost.js — the acceptance test for the emulator written in its own
 * assembly: for the same source and the same inputs, running natively and
 * running inside programs/interp.tasm must produce identical output.
 *
 * Every opcode gets its own program, because the demo programs between them
 * exercise only 13 of the 23.
 */

const fs = require('fs');
const path = require('path');
const T = require('../src/ternary.js');
const { OPS } = require('../src/isa.js');
const { runNative, runHosted, layout, plan, maxDepth, interpSize,
        interpSource, setInterpSource } = require('../src/selfhost.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
/** The core assertion of this file. */
function agrees(name, src, input = []) {
  let a, b;
  try { a = runNative(src, input); } catch (e) { return check(name, false, 'native threw: ' + e.message); }
  try { b = runHosted(src, input); } catch (e) { return check(name, false, 'hosted threw: ' + e.message); }
  check(name, a.output.join() === b.output.join(), `native [${a.output}] vs hosted [${b.output}]`);
  return { a, b };
}

console.log('\n=== 1. LAYOUT ===');
const L = layout();
check('the interpreter assembles', L.interpCells > 0);
check(`it occupies ${L.interpCells} cells (${L.interpLo}..${L.interpHi})`, L.interpHi < 364);
check(`the emulated machine gets ${L.innerCells} cells, addresses ${L.innerLo}..${L.innerHi}`,
  L.innerCells > 200);
check('interpreter and emulated memory do not overlap', L.IBASE + L.innerLo > L.interpHi);

console.log('\n=== 2. EVERY OPCODE, NATIVE vs EMULATED ===');
const D = '\n.org -60\nv: .word 0\nw: .word 0\np: .word v\nq: .word 0\n';
const PROG = {
  HALT:   'LOADI 5\nOUT\nHALT\nLOADI 9\nOUT\nHALT',
  LOADI:  'LOADI -364\nOUT\nLOADI 364\nOUT\nHALT',
  LOAD:   'LOADI 42\nSTORE v\nLOADI 0\nLOAD v\nOUT\nHALT' + D,
  STORE:  'LOADI 77\nSTORE v\nLOADI 0\nLOAD v\nOUT\nHALT' + D,
  ADD:    'LOADI 20\nSTORE v\nLOADI 7\nADD v\nOUT\nHALT' + D,
  ADDI:   'LOADI 20\nADDI -25\nOUT\nHALT',
  SUB:    'LOADI 20\nSTORE v\nLOADI 7\nSUB v\nOUT\nHALT' + D,
  NEG:    'LOADI 123\nNEG\nOUT\nNEG\nOUT\nHALT',
  MIN:    'LOADI -45\nSTORE v\nLOADI 123\nMIN v\nOUT\nHALT' + D,
  MAX:    'LOADI -45\nSTORE v\nLOADI 123\nMAX v\nOUT\nHALT' + D,
  CSUM:   'LOADI -45\nSTORE v\nLOADI 123\nCSUM v\nOUT\nHALT' + D,
  SETC:   'SETC t+0-+0-\nLOADI -45\nSTORE v\nLOADI 123\nTGATE v\nOUT\nHALT' + D,
  TGATE:  'SETC t++++++\nLOADI -45\nSTORE v\nLOADI 123\nTGATE v\nOUT\nHALT' + D,
  SHL:    'LOADI 7\nSHL 2\nOUT\nLOADI 4\nSHL 0\nOUT\nHALT',
  SHR:    'LOADI 5\nSHR 1\nOUT\nLOADI 100\nSHR 3\nOUT\nHALT',
  JMP:    'JMP a\nLOADI 1\nOUT\na: LOADI 2\nOUT\nHALT',
  BR3:    'IN\nBR3 t\nt: .table n,z,p\nn: LOADI -1\nJMP e\nz: LOADI 0\nJMP e\np: LOADI 1\ne: OUT\nHALT',
  OUT:    'LOADI 1\nOUT\nLOADI 2\nOUT\nLOADI 3\nOUT\nHALT',
  IN:     'IN\nOUT\nIN\nOUT\nHALT',
  LOADX:  'LOADI 88\nSTORE v\nLOADI 0\nLOADX p\nOUT\nHALT' + D,
  STOREX: 'LOADI 66\nSTOREX p\nLOADI 0\nLOAD v\nOUT\nHALT' + D,
  JMPX:   'JMPX tg\nLOADI 1\nOUT\nHALT\nlate: LOADI 9\nOUT\nHALT\n.org -60\ntg: .word late',
  LDC:    'LOADI t+0-+0-\nSTORE w\nLDC w\nLOADI -45\nSTORE v\nLOADI 123\nTGATE v\nOUT\nHALT' + D,
};
const INPUTS = { BR3: [42], IN: [11, -22] };
for (const op of Object.keys(OPS)) {
  if (!PROG[op]) { check(`${op} has a program`, false, 'MISSING'); continue; }
  agrees(op.padEnd(6) + ' behaves identically', PROG[op], INPUTS[op] || []);
}
check('every opcode in the ISA is covered', Object.keys(OPS).every(o => o in PROG));

console.log('\n=== 3. THE DEMO PROGRAMS ===');
const prog = f => fs.readFileSync(path.join(__dirname, '..', 'programs', f), 'utf8');
agrees('threeway.tasm classifies five values identically', prog('threeway.tasm'), [7, -3, 0, 42, -100]);
agrees('tgate.tasm builds four circuits identically', prog('tgate.tasm'), [123, -45]);
for (const [x, y] of [[7, 5], [-7, 5], [7, -5], [-7, -5], [13, 19], [0, 100]]) {
  agrees(`multiply.tasm ${x} x ${y} identically`, prog('multiply.tasm'), [x, y]);
}

console.log('\n=== 4. THE EMULATED MACHINE IS A REAL MACHINE ===');
{
  // Not just "runs the demos": arithmetic swept inside the emulator.
  const src = prog('multiply.tasm');
  let bad = null, n = 0;
  for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) {
    n++;
    const got = runHosted(src, [a, b]).output[0];
    if (got !== a * b) { bad = `${a}*${b} gave ${got}`; break; }
  }
  check(`${n} multiplications computed inside the emulator are all exact`, bad === null, bad || '');
}
{
  const r = agrees('a program using indirect addressing runs emulated',
    'LOADI d0\nSTORE p\nlp: LOADX p\nOUT\nLOAD p\nADDI 1\nSTORE p\nLOADI d2\nSUB p\nBR3 t\n' +
    't: .table done, last, lp\nlast: LOADX p\nOUT\ndone: HALT\n' +
    '.org -40\np: .word 0\nd0: .word 11\n.word 22\nd2: .word 33');
  if (r) check('...and produces 11, 22, 33', r.b.output.join() === '11,22,33', r.b.output.join());
}

console.log('\n=== 5. THE LIMITS, STATED AND CHECKED ===');
check('a program that will not fit is rejected with a clear message', (() => {
  const big = Array.from({ length: 200 }, () => 'LOADI 1').join('\n') + '\nHALT';
  try { runHosted(big); return false; }
  catch (e) { return /outside the emulated machine's memory/.test(e.message); }
})());
check('depth 3 is possible — an interpreter inside an interpreter',
  maxDepth() >= 3, `maxDepth() = ${maxDepth()}`);
check('depth 4 is not, and the pigeonhole says why',
  maxDepth() === 3 && plan(3).innerCells < interpSize(),
  `level-3 window ${plan(3).innerCells} cells vs interpreter ${interpSize()}`);
check('plan(4) refuses with a message that names the shortfall', (() => {
  try { plan(4); return false; }
  catch (e) { return /impossible/.test(e.message) && /interpreter needs/.test(e.message); }
})());
{
  const a = runNative(prog('multiply.tasm'), [7, 5]);
  const b = runHosted(prog('multiply.tasm'), [7, 5]);
  const ratio = b.steps / a.steps;
  check(`emulation costs ${ratio.toFixed(1)}x the instructions (under 40x)`, ratio < 40, String(ratio));
}

console.log('\n=== 6. AN INTERPRETER INSIDE AN INTERPRETER ===');
{
  const P3 = plan(3);
  check(`depth 3 lays out two interpreter layers`, P3.levels.length === 2);
  check(`each layer relocates: origins ${P3.levels.map(l => l.origin).join(', ')}`,
    P3.levels[0].origin !== P3.levels[1].origin);
  check(`the innermost machine has ${P3.innerCells} cells (${P3.innerLo}..${P3.innerHi})`,
    P3.innerCells > 40);

  const src = prog('threeway.tasm');
  const inp = [7, -3, 0, 42, -100];
  const n = runNative(src, inp);
  const d2 = runHosted(src, inp, { depth: 2 });
  const d3 = runHosted(src, inp, { depth: 3 });
  check('depth 1, 2 and 3 all produce the same output',
    n.output.join() === d2.output.join() && d2.output.join() === d3.output.join(),
    `${n.output} | ${d2.output} | ${d3.output}`);
  check(`each level multiplies the work (${n.steps} -> ${d2.steps} -> ${d3.steps})`,
    d3.steps > d2.steps && d2.steps > n.steps);
  const r2 = d2.steps / n.steps, r3 = d3.steps / d2.steps;
  check(`the per-level cost is roughly constant (${r2.toFixed(0)}x then ${r3.toFixed(0)}x)`,
    Math.abs(r2 - r3) / r2 < 0.15, `${r2} vs ${r3}`);

  // A different program, so depth 3 is not a one-program fluke.
  const cd = 'IN\nSTORE n\nlp: LOAD n\nOUT\nADDI -1\nSTORE n\nBR3 t\nt: .table done, done, lp\ndone: HALT\n.org -6\nn: .word 0';
  const a = runNative(cd, [4]), b = runHosted(cd, [4], { depth: 3 });
  check('a countdown also agrees at depth 3', a.output.join() === b.output.join(),
    `${a.output} vs ${b.output}`);
  check('...and actually counted down', a.output.join() === '4,3,2,1', a.output.join());

  check('a program too big for the innermost machine is refused', (() => {
    try { runHosted(prog('multiply.tasm'), [7, 5], { depth: 3 }); return false; }
    catch (e) { return /outside the emulated machine's memory/.test(e.message); }
  })());
}

console.log('\n=== 7. DEEPER IS NOT STRICTLY STRONGER ===');
{
  // Found by mutation testing, and worth keeping as a property: an error that is
  // an INVOLUTION on the emulated semantics cancels when applied an even number
  // of times. Depth 3 runs two interpreter layers, so such a bug disappears at
  // depth 3 while being obvious at depth 2. Agreement at the deepest level is
  // therefore not a superset of agreement at shallower ones, and the acceptance
  // test above compares depth 1, 2 AND 3 rather than just the deepest.
  const good = interpSource();
  const involution = good.replace('br_t:   .table br_n, br_z, br_p',
                                  'br_t:   .table br_n, br_p, br_z');
  const rotation  = good.replace('br_t:   .table br_n, br_z, br_p',
                                 'br_t:   .table br_z, br_p, br_n');
  check('both mutations apply cleanly', involution !== good && rotation !== good);

  const src = prog('threeway.tasm'), inp = [7, -3, 0, 42, -100];
  const want = runNative(src, inp).output.join();
  const run = (source, depth) => {
    setInterpSource(source);
    try { return runHosted(src, inp, { depth }).output.join(); }
    catch { return 'THREW'; }
    finally { setInterpSource(good); }
  };

  check('an involution in the interpreter is caught at depth 2',
    run(involution, 2) !== want);
  check('...but MASKED at depth 3, where it is applied twice and cancels',
    run(involution, 3) === want);
  check('a three-cycle error does not cancel, and is caught at depth 2',
    run(rotation, 2) !== want);
  check('...and at depth 3 as well', run(rotation, 3) !== want);
  check('the interpreter source was restored afterwards', interpSource() === good);
  check('and the restored interpreter still agrees at every depth',
    [1, 2, 3].map(d => (d === 1 ? runNative(src, inp) : runHosted(src, inp, { depth: d })).output.join())
      .every(o => o === want));
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
