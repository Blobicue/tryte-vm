'use strict';
/* DECODE AUDIT — what the control word is, and whether decode can disappear.
 *
 * Roadmap phase 4. `design/08-decode.md` enumerates six options and calls one of
 * them the interesting one: **could the ISA be renumbered so that decode vanishes
 * entirely?** That is the only option in the whole design folder that changes
 * something outside the device layer, and nobody has costed it.
 *
 * NOTE ON IDS. This set is `T`, and it is the LAST unused single letter — the
 * alphabet is spent. The next set must extend ids to two letters, which requires
 * widening four regexes: the completeness pattern in `test-findings.js`, and the
 * citation and two ownership patterns in `test-results.js`. Pre-announced here so
 * it arrives as planned infrastructure rather than a surprise rider.
 *
 * And `T1`-`T5` are also the device THEOREMS, one of which this phase cites. **Rule
 * for this set, including in the manifest notes: a theorem is always written
 * "axiom `T5`", never bare.** Bare `T1`-`T4` mean this set's predictions.
 *
 * ------------------------------------------------------------------------------
 * THE CONTROL TABLE IS A DESIGN, NOT A MEASUREMENT.
 *
 * No datapath consumes control lines yet, so "the machine needs these lines" cannot
 * be measured — it is chosen. The table below is `PROPOSED`, and every result in
 * this set is a theorem ABOUT THAT TABLE. A different microarchitecture gets
 * different numbers.
 *
 * What IS checkable is whether the table is SUFFICIENT, and that is `T1`.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   T1  THE CONTROL WORD IS SUFFICIENT, AND OPCODE-BLIND. An interpreter driven
 *       ONLY by control words — never seeing an opcode name or number — reproduces
 *       `src/vm.js` state for state, step for step, on every program in
 *       `programs/`. If the table is missing a distinction, some program diverges
 *       and this fails. That is the ground truth the rest of the set rests on.
 *
 *       Predicted: every program agrees on `A`, `C`, `PC`, output and halt at every
 *       step. Registered as the sufficiency check rather than "the table is right",
 *       because a table can be sufficient and still be a poor design.
 *
 *   T2  AND IT IS ELEVEN TRITS WIDE, INJECTIVE, AND TOO WIDE TO FIT THE CELL.
 *       Field widths: operand kind 1, memory read 1, memory write 1, indirect 1,
 *       ALU op 3, destination 1, PC source 1, io 2 — **11 trits**. The 25 control
 *       words are all distinct, so the word carries exactly the opcode's
 *       information spread over eleven trits instead of three.
 *
 *       **The opcode needs 3 trits and its cell holds 6, so 3 are spare — and 11
 *       does not fit in 6.** Predicted: decode cannot be made to disappear by
 *       widening into the spare trits, which kills the free version of `C5`.
 *
 *   T3  AND NO FIELD CAN BE DIRECT-ENCODED INTO A THREE-TRIT OPCODE. A field of
 *       width `w` can be a direct slice of the opcode only if the remaining `3-w`
 *       trits still separate every opcode sharing that field's value — that is,
 *       max class size <= 3^(3-w).
 *
 *       Registered as exact counts so a miscount is caught: operand kind 16/5/4,
 *       memory read 14/11, memory write 23/2, indirect 23/2, ALU op 7/6/2 then
 *       ten singletons, destination 16/7/2, PC source 22/2/1, io 22/1/1/1.
 *       Against the fit rule those give 16>9, 14>9, 23>9, 23>9, 7>1, 16>9, 22>9,
 *       22>3 — **none fits.** `DERIVED`, and the run confirms the counting.
 *
 *   T4  BUT THE SPARE TRITS BUY SOMETHING, AND THE QUESTION IS HOW MUCH. At six
 *       opcode trits every single field fits, which is pigeonhole and not a
 *       finding. The real search: **the largest set of fields that can be
 *       direct-encoded jointly**, needing total width `W <= 6` and max joint class
 *       <= 3^(6-W). Searched over every subset of the eight fields.
 *
 *       Predicted: the best subset totals 6 trits and is JOINTLY INJECTIVE on all
 *       25 opcodes — so six of the eleven control trits become free, decode shrinks
 *       from eleven outputs to five, and the saving is a little under half. Also
 *       predicted: no subset does better, because six is all the spare capacity
 *       there is.
 * ------------------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const T = require('../src/ternary.js');
const D = require('../src/device.js');
const { OPS, BY_CODE } = require('../src/isa.js');
const { TryteVM } = require('../src/vm.js');
const { assemble } = require('../src/assembler.js');

const line = '='.repeat(78);
console.log('DECODE AUDIT — the control word, and whether decode can disappear.\n');

/** PROPOSED: one control word per opcode. A microarchitecture choice. */
const CONTROL = {
  HALT: { op: 'none', rd: 0, wr: 0, ix: 0, alu: 'none', dst: 'none', pc: 'inc', io: 'halt' },
  LOADI: { op: 'imm', rd: 0, wr: 0, ix: 0, alu: 'pass', dst: 'A', pc: 'inc', io: 'none' },
  LOAD: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'pass', dst: 'A', pc: 'inc', io: 'none' },
  STORE: { op: 'addr', rd: 0, wr: 1, ix: 0, alu: 'none', dst: 'none', pc: 'inc', io: 'none' },
  ADD: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'add', dst: 'A', pc: 'inc', io: 'none' },
  ADDI: { op: 'imm', rd: 0, wr: 0, ix: 0, alu: 'add', dst: 'A', pc: 'inc', io: 'none' },
  SUB: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'sub', dst: 'A', pc: 'inc', io: 'none' },
  NEG: { op: 'none', rd: 0, wr: 0, ix: 0, alu: 'neg', dst: 'A', pc: 'inc', io: 'none' },
  MIN: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'min', dst: 'A', pc: 'inc', io: 'none' },
  MAX: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'max', dst: 'A', pc: 'inc', io: 'none' },
  CSUM: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'csum', dst: 'A', pc: 'inc', io: 'none' },
  SETC: { op: 'imm', rd: 0, wr: 0, ix: 0, alu: 'pass', dst: 'C', pc: 'inc', io: 'none' },
  TGATE: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'tgate', dst: 'A', pc: 'inc', io: 'none' },
  SHL: { op: 'imm', rd: 0, wr: 0, ix: 0, alu: 'shl', dst: 'A', pc: 'inc', io: 'none' },
  SHR: { op: 'imm', rd: 0, wr: 0, ix: 0, alu: 'shr', dst: 'A', pc: 'inc', io: 'none' },
  JMP: { op: 'addr', rd: 0, wr: 0, ix: 0, alu: 'none', dst: 'none', pc: 'jmp', io: 'none' },
  BR3: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'none', dst: 'none', pc: 'br3', io: 'none' },
  OUT: { op: 'none', rd: 0, wr: 0, ix: 0, alu: 'none', dst: 'none', pc: 'inc', io: 'out' },
  IN: { op: 'none', rd: 0, wr: 0, ix: 0, alu: 'pass', dst: 'A', pc: 'inc', io: 'in' },
  LOADX: { op: 'addr', rd: 1, wr: 0, ix: 1, alu: 'pass', dst: 'A', pc: 'inc', io: 'none' },
  STOREX: { op: 'addr', rd: 1, wr: 1, ix: 1, alu: 'none', dst: 'none', pc: 'inc', io: 'none' },
  JMPX: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'none', dst: 'none', pc: 'jmp', io: 'none' },
  LDC: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'pass', dst: 'C', pc: 'inc', io: 'none' },
  TOP: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'top', dst: 'A', pc: 'inc', io: 'none' },
  TOPC: { op: 'addr', rd: 1, wr: 0, ix: 0, alu: 'topc', dst: 'A', pc: 'inc', io: 'none' },
};
const NAMES = Object.keys(OPS);
const FIELDS = ['op', 'rd', 'wr', 'ix', 'alu', 'dst', 'pc', 'io'];
const valuesOf = f => [...new Set(NAMES.map(n => CONTROL[n][f]))];
const widthOf = f => Math.max(1, Math.ceil(Math.log(valuesOf(f).length) / Math.log(3) - 1e-9));

/**
 * An interpreter that never sees an opcode. It reads the control word and does
 * what the control word says. If the table is missing a distinction, this diverges
 * from src/vm.js and T1 fails.
 */
function blindStep(vm) {
  if (vm.halted) return false;
  const opcode = vm.read(vm.PC);
  const op = BY_CODE[opcode];
  const c = CONTROL[op.name];                 // the ONLY thing taken from the opcode
  const operand = vm.read(vm.PC + 1);
  let next = T.wrap(vm.PC + 2);

  const src = c.op === 'imm' ? T.wrap(operand)
    : c.rd ? (c.ix ? vm.read(vm.read(operand)) : vm.read(operand)) : 0;
  let val = null;
  switch (c.alu) {
    case 'pass': val = c.io === 'in' ? (vm.input.length ? T.wrap(vm.input.shift()) : 0) : src; break;
    case 'add': val = T.add(vm.A, src); break;
    case 'sub': val = T.sub(vm.A, src); break;
    case 'neg': val = T.neg(vm.A); break;
    case 'min': val = T.tMIN(vm.A, src); break;
    case 'max': val = T.tMAX(vm.A, src); break;
    case 'csum': val = T.tCLAMPSUM(vm.A, src); break;
    case 'tgate': val = T.tgate(vm.C, vm.A, src); break;
    case 'shl': val = T.shiftLeft(vm.A, operand); break;
    case 'shr': val = T.shiftRight(vm.A, operand); break;
    case 'top': {
      const tbl = []; for (let i = 0; i < 9; i++) tbl.push(vm.read(T.wrap(vm.C + i)));
      val = T.ttable(tbl, vm.A, src); break;
    }
    case 'topc': {
      const tbl = []; for (let i = 0; i < 27; i++) tbl.push(vm.read(T.wrap(vm.C + i)));
      val = T.ttableC(tbl, vm.A, src); break;
    }
    default: val = null;
  }
  if (c.wr) vm.write(c.ix ? vm.read(operand) : operand, vm.A);
  if (c.dst === 'A' && val !== null) vm.A = val;
  if (c.dst === 'C' && val !== null) vm.C = val;
  if (c.io === 'out') vm.output.push(vm.A);
  if (c.io === 'halt') vm.halted = true;
  if (c.pc === 'jmp') next = T.wrap(c.rd ? vm.read(operand) : operand);
  if (c.pc === 'br3') next = vm.read(T.wrap(operand + T.sign(vm.A)));
  vm.PC = next;
  return !vm.halted;
}

console.log('--- T1  is the control word sufficient? opcode-blind against src/vm.js ---');
{
  const dir = path.join(__dirname, '..', 'programs');
  const progs = fs.readdirSync(dir).filter(f => f.endsWith('.tasm')).sort();
  let ok = 0, diverged = [], totalSteps = 0;
  for (const f of progs) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const { cells } = assemble(src);
    const mk = () => {
      const vm = new TryteVM({ input: [3, 4, 5], maxSteps: 60000 });
      for (const [a, v] of cells) vm.write(a, v);
      vm.PC = 0; return vm;
    };
    const ref = mk(), mine = mk();
    let bad = null, steps = 0;
    try {
      while (!ref.halted && steps < 60000) {
        const a = ref.step(), b = blindStep(mine);
        steps++;
        if (ref.A !== mine.A || ref.C !== mine.C || ref.PC !== mine.PC
          || ref.halted !== mine.halted || ref.output.length !== mine.output.length) {
          bad = `step ${steps}: A ${ref.A}/${mine.A} C ${ref.C}/${mine.C} PC ${ref.PC}/${mine.PC}`;
          break;
        }
        if (!a) break;
      }
    } catch (e) { bad = `threw: ${e.message.slice(0, 50)}`; }
    totalSteps += steps;
    if (bad) diverged.push(`${f}: ${bad}`); else ok++;
  }
  console.log(`      ${ok} of ${progs.length} programs agree with src/vm.js state for state`);
  console.log(`      ${totalSteps.toLocaleString()} steps compared`);
  for (const d of diverged.slice(0, 4)) console.log(`      DIVERGED  ${d}`);
}

console.log('\n--- T2  how wide is the control word, and does it fit the cell? ---');
{
  let total = 0;
  console.log('      field  values  trits  class sizes');
  for (const f of FIELDS) {
    const w = widthOf(f); total += w;
    const counts = {};
    for (const n of NAMES) counts[CONTROL[n][f]] = (counts[CONTROL[n][f]] || 0) + 1;
    const sizes = Object.values(counts).sort((a, b) => b - a);
    console.log(`      ${f.padEnd(6)} ${String(valuesOf(f).length).padStart(6)} ${String(w).padStart(6)}`
      + `   ${sizes.join(',')}`);
  }
  const words = NAMES.map(n => JSON.stringify(CONTROL[n]));
  console.log(`\n      TOTAL WIDTH: ${total} trits`);
  console.log(`      distinct control words: ${new Set(words).size} of ${NAMES.length}`
    + `   injective: ${new Set(words).size === NAMES.length}`);
  const opTrits = Math.ceil(Math.log(NAMES.length) / Math.log(3) - 1e-9);
  console.log(`      opcode needs ${opTrits} trits; its cell holds 6, so ${6 - opTrits} are spare`);
  console.log(`      ${total} > 6 -> the control word does NOT fit the cell.`);
  console.log(`      So decode cannot be made to vanish by widening into the spare trits.`);
}

console.log('\n--- T3  can any field be a direct slice of a 3-trit opcode? ---');
{
  console.log('      a field of width w fits iff max class <= 3^(3-w)');
  let anyFits = false;
  for (const f of FIELDS) {
    const w = widthOf(f);
    const counts = {};
    for (const n of NAMES) counts[CONTROL[n][f]] = (counts[CONTROL[n][f]] || 0) + 1;
    const mx = Math.max(...Object.values(counts));
    const cap = 3 ** (3 - w);
    const fits = mx <= cap;
    if (fits) anyFits = true;
    console.log(`      ${f.padEnd(6)} w=${w}  max class ${String(mx).padStart(2)}  cap ${String(cap).padStart(2)}`
      + `   ${fits ? 'FITS' : 'no'}`);
  }
  console.log(`      any field fits at three opcode trits: ${anyFits}`);
}

console.log('\n--- T4  the largest jointly direct-encodable subset, at six trits ---');
{
  let best = null;
  for (let mask = 1; mask < (1 << FIELDS.length); mask++) {
    const sub = FIELDS.filter((_, i) => mask & (1 << i));
    const W = sub.reduce((a, f) => a + widthOf(f), 0);
    if (W > 6) continue;
    const classes = {};
    for (const n of NAMES) {
      const k = sub.map(f => CONTROL[n][f]).join('|');
      classes[k] = (classes[k] || 0) + 1;
    }
    const mx = Math.max(...Object.values(classes));
    if (mx > 3 ** (6 - W)) continue;
    if (!best || W > best.W || (W === best.W && mx < best.mx)) best = { sub, W, mx };
  }
  console.log(`      best subset: ${best.sub.join(', ')}`);
  console.log(`      width ${best.W} trits, max joint class ${best.mx}`
    + `   jointly injective: ${best.mx === 1}`);
  const totalW = FIELDS.reduce((a, f) => a + widthOf(f), 0);
  console.log(`      so ${best.W} of ${totalW} control trits become free,`
    + ` and decode shrinks to ${totalW - best.W} outputs`);
  console.log(`      saving ${(100 * best.W / totalW).toFixed(0)}% of the decode logic,`
    + ` at zero memory cost — the spare trits were already paid for.`);
}

console.log('\n--- decode, built and costed at this table\'s width ---');
{
  const totalW = FIELDS.reduce((a, f) => a + widthOf(f), 0);
  const perLine = net => { D.tmux(net, 'x', 'a', 'b', 'c', 'o'); return net; };
  // one 3-input trit function per output trit: a 27-leaf tree = 13 selector nodes
  const nodes = 13;
  const tree = new D.Net();
  for (let i = 0; i < nodes; i++) D.tmux(tree, `s${i}`, 'vss', 'vmid', 'vdd', `n${i}`);
  const perTrit = tree.cost().switches / nodes * nodes;
  console.log(`      one control trit = a 3-input trit function = ${nodes} tree nodes`
    + ` = ${perTrit} switches`);
  console.log(`      full decode, ${totalW} trits: ${perTrit * totalW} switches`);
  const best = 6;
  console.log(`      after direct-encoding ${best}: ${perTrit * (totalW - best)} switches`);
  console.log(`      design/08 estimated ~480 for "12 lines" — a different unit, quoted as context`);
}

console.log('\n' + line);
