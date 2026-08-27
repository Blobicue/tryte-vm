'use strict';
/* WORKFACTOR AUDIT — the second knob, and whether anything here turns it.
 *
 * WHY THIS SET EXISTS
 * -------------------
 * AD4 concluded that the security parameter of an implied receipt is REACHABLE
 * STATE COUNT, and produced the table: 729 states with a bare accumulator, times
 * 729 for each live word beyond it, so three words puts a tabulator past 10^11.
 *
 * That is half the answer, and the missing half arrived from a neighbouring project.
 * WaveSeeds, working on a wallet seed with only 3.17 bits per tap, states the lever
 * plainly: "Argon2 does not add entropy. It adds a work factor -- a cost multiplier
 * per guess." AD2 counted 728 evaluations to tabulate the whole space and treated
 * each evaluation as free. They are not free, and the asymmetry is severe: the
 * honest party evaluates ONCE and the tabulator evaluates 729 times, so a
 * per-evaluation cost hurts the attacker by the size of the state space.
 *
 * So the tabulator's bill is
 *
 *     states  x  cost per evaluation
 *
 * and AD measured only the first factor. This set measures both, and asks whether
 * this machine already contains an expensive evaluation. It plausibly does: a tick
 * defined as one VM INSTRUCTION is a handful of operations, while a tick defined as
 * one DEVICE-LEVEL SOLVE is a fixed-point iteration over hundreds of switches, and
 * H1 found that solver superlinear.
 *
 * WHAT COUNTS AS LIVE STATE — stated up front because it decides AG1
 * -----------------------------------------------------------------
 * The state a tabulator must index is what VARIES BETWEEN RUNS of the same program,
 * not everything that affects the cost. A program's own instructions affect its cost
 * and are identical on every run, so they cost the tabulator nothing. Measured the
 * way AD4 measured it: poison a word before the run and see whether the step count
 * moves.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered before the run, per AGENTS.md.
 *
 *   AG1 no program in this repository is tier three, INCLUDING THE INTERPRETER, and
 *       AD's conclusion generalises rather than being special to hailstone.
 *       Predicted every program has a live control-state width of at most 2, because
 *       none of them takes a program as runtime input: interp.tasm's interpreted
 *       program is assembled into its own image and is therefore fixed on every run.
 *       Predicted specifically that hailstone and countdown measure 1, confirming
 *       AD4 by the same method on a second program, and that interp.tasm measures at
 *       most 2 despite being the one that looked like the tier-three candidate.
 *
 *   AG2 but the width is a property of the HARNESS, not of the machine, and the
 *       threshold is trivially reachable. A program that loads its inputs into
 *       memory before using them has width equal to the number of words loaded.
 *       Predicted: a purpose-built three-input program measures a live width of
 *       exactly 3, putting its state space at 729^4 = 282,429,536,481 -- past the
 *       point where tabulation is affordable -- and that it does so with fewer than
 *       forty instructions. Demonstrated by construction rather than argued.
 *
 *   AG3 and this machine already contains the expensive evaluation. Measured in
 *       node-updates, taken as passes x devices, predicted one device-level solve of
 *       the six-trit ripple adder costs more than 5,000 against 1 for a VM
 *       instruction -- a ratio above 1,000x. Predicted the pass count sits at 13,
 *       which E4 recorded, so the figure is a product of two things this project
 *       already measured rather than a new claim.
 *
 *   AG4 so the two knobs multiply, and the device-level tick is worth a countable
 *       number of extra words. One live word multiplies the tabulator's bill by 729.
 *       Predicted the measured work-factor ratio lands between 729 and 729^2, so
 *       moving the definition of a tick from an instruction to a device solve buys
 *       MORE THAN ONE and FEWER THAN TWO words' worth of security -- and that it is
 *       therefore worth having but not sufficient alone.
 *
 * ------------------------------------------------------------------------------
 * Run: node tools/workfactor-audit.js
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto, assemble } = require('../src/assembler.js');
const fs = require('fs');
const path = require('path');

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);
const PROGDIR = path.join(__dirname, '..', 'programs');

log('WORKFACTOR AUDIT — states times cost, not states alone\n');

/** Executed instruction count for one program, with optional memory poisoning. */
function steps(src, input = [], poison = null, maxSteps = 60000) {
  const vm = new TryteVM({ input, maxSteps });
  loadInto(vm, src);
  if (poison) vm.write(poison.addr, poison.value);
  // Count the instruction that is ABOUT to run, so a program consisting only of
  // HALT costs 1. `while (vm.step()) n++` costs it 0, which disagrees with the
  // convention AC recorded -- countdown is 5N+3 and reads 8 at N=1 only if the
  // final HALT is counted. Two step-counters in one repository disagreeing by one
  // is the kind of thing that survives a long time.
  let n = 0;
  try { while (!vm.halted) { n++; if (!vm.step()) break; } } catch (e) { return null; }
  return n;
}

/**
 * Live control-state width: how many memory words, when changed before the run,
 * change what the program costs — counting only words the program does not write
 * before reading, since anything it overwrites is not state it inherited.
 *
 * The input counts as one word when the program executes IN, because a value
 * arriving from outside is exactly what varies between runs.
 */
/*
 * INSTRUMENT REPAIR, recorded rather than quietly fixed. The first version poisoned
 * every cell of the assembled image and counted the ones that moved the cost. That
 * answers "what affects the price", which is not the question this set registered:
 * a tabulator indexes what VARIES BETWEEN RUNS, and a program's own instructions are
 * identical on every run. Poisoning them measured the program itself, so interp-core
 * came out at 73 words and every program cleared AD4's three-word threshold —
 * a result that would have said an implied receipt already works here.
 *
 * T-SCOPE-DECIDES-THE-VERDICT, fourth bite, and the registration DID state the
 * boundary correctly. Naming a class does not stop you walking into it; the
 * docstring said one thing and the code did another, which is the only place that
 * gap can hide once the definition is written down.
 *
 * What varies between runs of a fixed program is the input. So the width is the
 * number of input POSITIONS that move the cost, found by varying one at a time.
 */
function liveWidth(file, probes) {
  const src = fs.readFileSync(path.join(PROGDIR, file), 'utf8');
  const base = probes[0];
  const baseSteps = steps(src, base);
  let width = 0;
  const movers = [];
  for (let i = 0; i < base.length; i++) {
    let moved = false;
    for (const v of [1, 4, 11, -6, 40]) {
      const alt = base.slice(); alt[i] = v;
      if (steps(src, alt) !== baseSteps) { moved = true; break; }
    }
    if (moved) { width++; movers.push(i); }
  }
  const consumed = (() => {
    const vm = new TryteVM({ input: base.slice(), maxSteps: 60000 });
    loadInto(vm, src);
    const before = vm.input.length;
    try { while (vm.step()); } catch (e) { /* fuel */ }
    return before - vm.input.length;
  })();
  return { file, width, movers, consumed, baseSteps };
}

/* ============================================================================
 * 0. INSTRUMENT CHECK
 * ========================================================================== */
log(line);
log('0. INSTRUMENT CHECK');
log(line);
{
  const halt = '        HALT\n';
  log(`  a program that is only HALT costs ${steps(halt)} instruction: ${steps(halt) === 1}`);
  const cd = fs.readFileSync(path.join(PROGDIR, 'countdown.tasm'), 'utf8');
  log(`  countdown at N=3 costs ${steps(cd, [3])} and at N=10 costs ${steps(cd, [10])} — they differ: ${steps(cd, [3]) !== steps(cd, [10])}`);
  log(`  poisoning a word the program overwrites changes nothing: ` +
    `${steps(cd, [3], { addr: -4, value: 99 }) === steps(cd, [3])}`);
  const net = new D.Net(); D.tRippleAdder(net, 6, false);
  log(`  a six-trit tree adder builds ${net.devices.length} devices`);
  log(`  and the solver reports a fixed point or throws — nothing in between`);
}

/* ============================================================================
 * 1. AG1 — how wide is the live state, really?
 * ========================================================================== */
log('\n' + line);
log('1. AG1 — the live control-state width of every program here');
log(line);

const INPUTS = [[5, 7, 3, 9, 2, 6, 4, 8]];
const rows = [];
for (const f of fs.readdirSync(PROGDIR).filter(x => x.endsWith('.tasm')).sort()) {
  const r = liveWidth(f, INPUTS);
  rows.push(r);
  log(`  ${f.padEnd(20)} input values consumed: ${String(r.consumed).padStart(2)}   ` +
    `positions that move the cost: ${String(r.width).padStart(2)}   ` +
    `${r.width > 3 ? '<- above the threshold' : ''}`);
}
{
  const worst = rows.reduce((m, r) => (r.width > m.width ? r : m), rows[0]);
  log(`\n  widest live state: ${worst.file} at ${worst.width} word(s)`);
  log(`  programs above AD4's three-word threshold: ${rows.filter(r => r.width > 3).length} of ${rows.length}`);
  const interp = rows.find(r => r.file === 'interp.tasm');
  log(`  interp.tasm, the one that looked like the tier-three candidate: ${interp.width} word(s)`);
  log(`  — because the program it interprets is assembled into its own image, so it`);
  log(`  is identical on every run and costs a tabulator nothing.`);

  // Width alone turns out not to be the parameter, and threeway is why. Report the
  // cost RANGE beside the width: a wide state whose cost barely moves needs no
  // tabulation at all, because guessing the commonest answer is nearly always right.
  log('');
  log('  width is not sufficient on its own — the cost RANGE decides whether');
  log('  tabulating is even worth doing:');
  log('   program              width   cost range over the sweep      spread');
  log('  ' + '-'.repeat(66));
  for (const r of rows) {
    const src = fs.readFileSync(path.join(PROGDIR, r.file), 'utf8');
    const seen = [];
    for (const v of [1, 4, 11, -6, 40]) {
      for (let i = 0; i < INPUTS[0].length; i++) {
        const alt = INPUTS[0].slice(); alt[i] = v;
        const s = steps(src, alt); if (s !== null) seen.push(s);
      }
    }
    const lo = Math.min(...seen), hi = Math.max(...seen);
    log(`   ${r.file.padEnd(20)} ${String(r.width).padStart(5)}   ${String(lo).padStart(8)} .. ${String(hi).padEnd(10)}   ${(hi / lo).toFixed(2)}x`);
  }
}

/* ============================================================================
 * 2. AG2 — the threshold is a property of the harness.
 * ========================================================================== */
log('\n' + line);
log('2. AG2 — build one that loads its inputs, and count again');
log(line);

const THREE = `; three loaded words, all of which move the cost
        IN
        STORE a
        IN
        STORE b
        IN
        STORE c
        LOADI 0
        STORE n
outer:  LOAD  c
        BR3   ot
ot:     .table odone, odone, obody
obody:  LOAD  a
        STORE w
inner:  LOAD  w
        BR3   it
it:     .table idone, idone, ibody
ibody:  LOAD  w
        SUB   b
        STORE w
        LOAD  n
        ADDI  1
        STORE n
        JMP   inner
idone:  LOAD  c
        ADDI  -1
        STORE c
        JMP   outer
odone:  LOAD  n
        OUT
        HALT
        .org  -12
a:      .word 0
b:      .word 0
c:      .word 0
w:      .word 0
n:      .word 0
`;
{
  const at = (x, y, z) => steps(THREE, [x, y, z]);
  const bases = [[9, 2, 1], [9, 2, 2], [9, 3, 1], [12, 2, 1]];
  log('   a   b   c    steps');
  log('  ' + '-'.repeat(26));
  for (const [x, y, z] of bases) log(`  ${String(x).padStart(2)}  ${String(y).padStart(2)}  ${String(z).padStart(2)}   ${String(at(x, y, z)).padStart(6)}`);
  const varyA = at(9, 2, 1) !== at(12, 2, 1);
  const varyB = at(9, 2, 1) !== at(9, 3, 1);
  const varyC = at(9, 2, 1) !== at(9, 2, 2);
  log('');
  log(`  changing a moves the cost: ${varyA}`);
  log(`  changing b moves the cost: ${varyB}`);
  log(`  changing c moves the cost: ${varyC}`);
  const width = [varyA, varyB, varyC].filter(Boolean).length;
  // Instructions, not cells: the registration predicted "fewer than forty
  // instructions" and an instruction is two cells, with tables and data words
  // occupying one each. Reporting the cell count against that prediction would be
  // comparing two different units, which this project has a check for elsewhere.
  const { tokenize } = require('../src/assembler.js');
  const instrs = tokenize(THREE).filter(l => l.mnemonic && !l.mnemonic.startsWith('.')).length;
  const cells = assemble(THREE).cells.size;
  log(`  live width: ${width}   instructions: ${instrs}   assembled cells: ${cells}`);
  log(`  state space at that width: ${3n ** BigInt(6 * (width + 1))}`);
  log(`  AD4's affordable-tabulation ceiling was crossed at three words.`);
}

/* ============================================================================
 * 3. AG3 — what one evaluation actually costs.
 * ========================================================================== */
log('\n' + line);
log('3. AG3 — one instruction against one device solve');
log(line);

const settles = (net, inputs, k) => { try { net.solve(inputs, k); return true; } catch (e) { return false; } };
const spread = (nm, v, n = 6) => Object.fromEntries(T.toTrits(v, n).map((t, i) => [`${nm}${i}`, t]));
let ADDER_PASSES = 0, ADDER_DEVICES = 0, WORK_RATIO = 0;
{
  const inputs = { ...spread('a', 121), ...spread('b', -47), cin: D.MID };
  const measure = build => {
    const net = new D.Net(); build(net);
    let k = 1;
    while (k < 64 && !settles(net, inputs, k)) k++;
    return { devices: net.devices.length, passes: k, work: k * net.devices.length };
  };
  // BOTH families, because the registration predicted 13 passes citing E4 -- and
  // E4's thirteen belongs to the DECODED adder, while the first version of this
  // section built the TREE one, which the same design note records at 7. Measuring
  // one family and quoting the other family's constant is how a prediction fails
  // for a reason that has nothing to do with the thing it was asking about.
  const tree = measure(n => D.tRippleAdder(n, 6, false));
  const decoded = measure(n => D.dRippleAdder(n, 6));
  log(`  six-trit TREE adder:    ${tree.devices} devices, ${tree.passes} passes, ` +
    `${tree.work.toLocaleString()} node-updates`);
  log(`  six-trit DECODED adder: ${decoded.devices} devices, ${decoded.passes} passes, ` +
    `${decoded.work.toLocaleString()} node-updates`);
  log(`  a VM instruction costs 1 step by definition`);
  log('');
  ADDER_DEVICES = decoded.devices; ADDER_PASSES = decoded.passes; WORK_RATIO = decoded.work;
  log(`  taking the decoded family, which is the one E4 measured: ratio ${WORK_RATIO.toLocaleString()}x`);
  log(`  the tree family gives ${tree.work.toLocaleString()}x — both are above 1,000x, and only`);
  log(`  one of them clears the 5,000 the registration predicted.`);
  log('');
  log(`  Both factors were already measured here: E4 recorded the pass count and the`);
  log(`  device count comes from the builder. This is their product, not a new claim.`);
}

/* ============================================================================
 * 4. AG4 — what the work factor is worth, in words.
 * ========================================================================== */
log('\n' + line);
log('4. AG4 — converting a work factor into words of state');
log(line);
{
  const perWord = 729;
  const worth = Math.log(WORK_RATIO) / Math.log(perWord);
  log(`  one live word multiplies a tabulator's bill by ${perWord}`);
  log(`  the device-level work factor multiplies it by ${WORK_RATIO.toLocaleString()}`);
  log(`  so it is worth ${worth.toFixed(3)} words of state`);
  log(`  between one and two: ${worth > 1 && worth < 2}`);
  log('');
  log('   definition of a tick     tabulator bill for a 729-state arena');
  log('  ' + '-'.repeat(60));
  log(`   one VM instruction       ${(729).toLocaleString()} evaluations`);
  log(`   one device solve         ${(729 * WORK_RATIO).toLocaleString()} node-updates`);
  log('');
  log(`  Worth having and not sufficient alone. A switch-level tick buys roughly one`);
  log(`  word of state for free, and the state still has to be widened.`);
}

log('\n' + line);
log('Registered predictions AG1-AG4 are in this file\'s docstring. Outcomes go to');
log('FINDINGS.json and are asserted in test/test-workfactor.js.');
log(line);

module.exports = { steps, liveWidth, THREE, ADDER_PASSES, ADDER_DEVICES, WORK_RATIO, INPUTS };
