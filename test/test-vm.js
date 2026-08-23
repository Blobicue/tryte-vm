'use strict';
/* Verification of the assembler, the instruction set, and every demo program.
 * No demo output is eyeballed; each one is an assertion. */

const path = require('path');
const T = require('../src/ternary.js');
const { TryteVM } = require('../src/vm.js');
const { assemble, loadInto } = require('../src/assembler.js');
const { runFile } = require('../src/run.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const prog = f => path.join(__dirname, '..', 'programs', f);
const runSrc = (src, input = []) => { const vm = new TryteVM({ input }); loadInto(vm, src, 0); vm.run(); return vm; };

console.log('\n=== 1. ASSEMBLER ===');
{
  const { cells, labels } = assemble(`
      LOADI 7
      STORE v
      HALT
      .org -5
v:    .word 0, -3, t+0-
`);
  check('instructions emit two cells each', cells.get(0) === 1 && cells.get(1) === 7);
  check('.org relocates emission', cells.get(-5) === 0 && cells.get(-4) === -3);
  check('trit literals parse (t+0- = 9-1 = 8)', cells.get(-3) === 8);
  check('labels resolve to addresses', labels.v === -5);
}
{
  const { labels, cells } = assemble(`
      BR3 tbl
tbl:  .table a, b, c
a:    HALT
b:    HALT
c:    HALT
`);
  check('.table label names the MIDDLE cell', labels.tbl === 3);
  check('.table emits three targets in order', cells.get(2) === labels.a && cells.get(3) === labels.b && cells.get(4) === labels.c);
}
check('unknown label is rejected', (() => { try { assemble('JMP nowhere'); return false; } catch { return true; } })());
check('unknown mnemonic is rejected', (() => { try { assemble('FLOOP 1'); return false; } catch { return true; } })());
check('operand-count errors are caught', (() => { try { assemble('NEG 5'); return false; } catch { return true; } })());

console.log('\n=== 2. INSTRUCTIONS ===');
check('LOADI / OUT', runSrc('LOADI -42\nOUT\nHALT').output[0] === -42);
check('LOAD / STORE round-trip', runSrc('LOADI 99\nSTORE d\nLOADI 0\nLOAD d\nOUT\nHALT\n.org -3\nd: .word 0').output[0] === 99);
check('ADD / ADDI / SUB', runSrc('LOADI 10\nADDI 5\nSTORE d\nLOADI 100\nSUB d\nOUT\nHALT\n.org -3\nd: .word 0').output[0] === 85);
check('NEG flips every trit', runSrc('LOADI 123\nNEG\nOUT\nHALT').output[0] === -123);
check('SHL multiplies by 3', runSrc('LOADI 7\nSHL 2\nOUT\nHALT').output[0] === 63);
check('SHR rounds to nearest', runSrc('LOADI 5\nSHR 1\nOUT\nHALT').output[0] === 2);
check('MIN / MAX are tritwise', (() => {
  const vm = runSrc('LOADI 123\nSTORE b\nLOADI -45\nMIN b\nOUT\nLOADI -45\nMAX b\nOUT\nHALT\n.org -3\nb: .word 0');
  return vm.output[0] === T.tMIN(-45, 123) && vm.output[1] === T.tMAX(-45, 123);
})());
check('CSUM is the clamped ternary sum', (() => {
  const vm = runSrc('LOADI 123\nSTORE b\nLOADI -45\nCSUM b\nOUT\nHALT\n.org -3\nb: .word 0');
  return vm.output[0] === T.tCLAMPSUM(-45, 123);
})());
check('SETC + TGATE apply the control tryte', (() => {
  const vm = runSrc('LOADI -45\nSTORE b\nSETC t+0-+0-\nLOADI 123\nTGATE b\nOUT\nHALT\n.org -3\nb: .word 0');
  return vm.output[0] === T.tgate(T.parseTritString('+0-+0-'), 123, -45);
})());
check('JMP transfers control', runSrc('JMP skip\nLOADI 1\nOUT\nskip: LOADI 2\nOUT\nHALT').output.join() === '2');
check('IN consumes the input queue in order', runSrc('IN\nOUT\nIN\nOUT\nHALT', [4, 9]).output.join() === '4,9');
check('arithmetic wraps at the tryte boundary', runSrc('LOADI 364\nADDI 1\nOUT\nHALT').output[0] === -364);
check('illegal opcode is rejected', (() => {
  try { const vm = new TryteVM(); vm.write(0, 99); vm.run(); return false; } catch (e) { return /illegal opcode/.test(e.message); }
})());
check('runaway programs hit the step limit', (() => {
  try { const vm = new TryteVM({ maxSteps: 500 }); loadInto(vm, 'here: JMP here'); vm.run(); return false; } catch (e) { return /step limit/.test(e.message); }
})());

console.log('\n=== 3. THE THREE-WAY BRANCH (all 729 accumulator values) ===');
{
  const src = `IN\nBR3 t\nt: .table n, z, p\nn: LOADI -1\nJMP e\nz: LOADI 0\nJMP e\np: LOADI 1\ne: OUT\nHALT`;
  let ok = true;
  for (let v = T.TRYTE_MIN; v <= T.TRYTE_MAX; v++) if (runSrc(src, [v]).output[0] !== Math.sign(v)) { ok = false; break; }
  check('BR3 picks the right arm for every possible accumulator value', ok);
  // A real assertion, not a tautology: exactly ONE BR3 executes per
  // classification, and the three signs reach three different destinations.
  const traceOf = v => { const vm = new TryteVM({ input: [v], trace: true }); loadInto(vm, src, 0); vm.run(); return vm.trace; };
  const br3s = v => traceOf(v).filter(e => e.op === 'BR3');
  check('exactly one BR3 executes per classification',
    [-9, 0, 9].every(v => br3s(v).length === 1));
  check('the three signs reach three distinct destinations',
    new Set([-9, 0, 9].map(v => br3s(v)[0].next)).size === 3);
}

console.log('\n=== 4. DEMO PROGRAMS ===');
{
  const vm = runFile(prog('threeway.tasm'), [7, -3, 0, 42, -100]);
  check('threeway.tasm classifies all five inputs', vm.output.join() === '1,-1,0,1,-1', vm.output.join());
}
{
  let bad = null, n = 0;
  for (let a = -19; a <= 19; a++) for (let b = -19; b <= 19; b++) {
    if (Math.abs(a * b) > T.TRYTE_MAX) continue;
    n++;
    const got = runFile(prog('multiply.tasm'), [a, b]).output[0];
    if (got !== a * b) { bad = `${a}*${b} gave ${got}`; break; }
  }
  check(`multiply.tasm is exact for all ${n} in-range operand pairs`, bad === null, bad || '');
  check('multiply.tasm needs no special case for negatives (same code path)',
    runFile(prog('multiply.tasm'), [-7, 5]).steps === runFile(prog('multiply.tasm'), [7, 5]).steps);
}
{
  const vm = runFile(prog('tgate.tasm'), [123, -45]);
  const ctl = s => T.parseTritString(s);
  check('tgate.tasm: control 000000 makes the unit MIN', vm.output[0] === T.tMIN(123, -45));
  check('tgate.tasm: control ++++++ makes the unit MAX', vm.output[1] === T.tMAX(123, -45));
  check('tgate.tasm: control ------ makes the unit NEG', vm.output[2] === T.neg(123));
  check('tgate.tasm: a mixed control gives a mixed circuit', vm.output[3] === T.tgate(ctl('+0-+0-'), 123, -45));
  check('the four circuits are genuinely different', new Set(vm.output).size === 4);
}

console.log('\n=== 5. SOURCE MAP (for listings) ===');
{
  const s1 = 'LOADI 7\nOUT\nHALT';
  const { lineOf } = assemble(s1);
  check('every emitted cell maps back to its source line',
    lineOf.get(0) === 1 && lineOf.get(1) === 1 && lineOf.get(2) === 2 && lineOf.get(4) === 3);
  const vm2 = new TryteVM(); loadInto(vm2, s1, 0);
  check('loadInto exposes the source map on the VM', vm2.lineOf instanceof Map && vm2.lineOf.size === 6);
}


console.log('\n=== 6. INDIRECT ADDRESSING (added for self-hosting) ===');
check('LOADX reads through a pointer cell', (() => {
  const vm3 = runSrc('LOADI 42\nSTORE cell\nLOADI 0\nLOADX ptr\nOUT\nHALT\n.org -6\nptr: .word cell\ncell: .word 0');
  return vm3.output[0] === 42;
})());
check('STOREX writes through a pointer cell', (() => {
  const vm3 = runSrc('LOADI 99\nSTOREX ptr\nLOADI 0\nLOAD cell\nOUT\nHALT\n.org -6\nptr: .word cell\ncell: .word 0');
  return vm3.output[0] === 99;
})());
check('JMPX jumps to a computed address', (() => {
  const vm3 = runSrc('JMPX tgt\nLOADI 1\nOUT\nHALT\nlate: LOADI 7\nOUT\nHALT\n.org -6\ntgt: .word late');
  return vm3.output.join() === '7';
})());
check('a pointer can be computed at run time, not just assembled', (() => {
  // walk a three-cell table by incrementing the pointer
  const vm3 = runSrc([
    'LOADI d0', 'STORE p',
    'lp: LOADX p', 'OUT',
    'LOAD p', 'ADDI 1', 'STORE p',
    'LOADI d2', 'SUB p', 'BR3 t',
    't: .table done, last, lp',
    'last: LOADX p', 'OUT',
    'done: HALT',
    '.org -8', 'p: .word 0', 'd0: .word 11', '.word 22', 'd2: .word 33',
  ].join('\n'));
  return vm3.output.join() === '11,22,33';
})(), 'pointer walk');
check('indirection composes: mem[mem[mem[x]]] via two steps', (() => {
  const vm3 = runSrc('LOADX pp\nSTORE q\nLOADX q\nOUT\nHALT\n.org -8\npp: .word p\np: .word v\nq: .word 0\nv: .word 55');
  return vm3.output[0] === 55;
})());

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
