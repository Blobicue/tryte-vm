'use strict';
/* PREDICT AUDIT — can you learn what a program costs without paying for it?
 *
 * WHY THIS SET EXISTS
 * -------------------
 * A currency has been proposed whose unit is one step of computation, and whose
 * security rests on an argument from physics: you cannot perform an unbounded
 * number of steps per second, so a large step count is evidence that a large
 * amount of work was done. The receipt is IMPLIED rather than issued — holding the
 * number is the proof, because the number could only have been obtained by paying.
 *
 * That argument is exactly right, and it is conditional on one thing nobody has
 * measured. Physics bounds what a machine can DO. It says nothing about what
 * anyone can CLAIM. The gap closes only if
 *
 *     the cheapest way to learn a program's cost is to run it.
 *
 * If the cost can be computed from the program text, then anybody can produce the
 * number without doing the work, physics never enters, and the receipt is
 * decoration. If it cannot, the number is unforgeable for the same reason a
 * kilometre run is unforgeable, and the whole design has a floor under it.
 *
 * This repository is unusually well placed to answer that, because AB already
 * found the neighbouring fact from the other direction: the ERASURE charge of six
 * of eight programs is exactly recoverable from their text (AB4), which was a
 * failed prediction and is bad news for any receipt built on erasure. The open
 * question is whether the STEP count behaves the same way.
 *
 * WHAT IS MEASURED
 * ----------------
 * Executed instructions, per program, over a sweep of inputs — the dynamic
 * quantity, not the static one. E4 already established that settling time inside
 * one instruction is data-dependent; this asks the same question one level up,
 * about whole programs.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered before the run, per AGENTS.md.
 *
 *   AC1 reading input is not the same as costing differently, and most of this
 *       repository's programs cost a CONSTANT. Five of the eight execute `IN`, but
 *       predicted that only TWO have an input-dependent step count — `countdown`,
 *       whose loop is bounded by its input, and `fold`. The rest loop a fixed
 *       number of times whatever they are given: `multiply` iterates once per trit,
 *       six times, for every operand pair. Registered with the alternative: if four
 *       or more vary, data-dependence is the norm here rather than the exception,
 *       and AC2 becomes the load-bearing question rather than a caveat.
 *
 *   AC2 and where the cost DOES vary, it is cheaply predictable — so
 *       input-dependence alone establishes nothing. Predicted: `countdown`'s step
 *       count is exactly affine in its input, steps = a*N + b. Fit a and b from two
 *       runs, then predict every other input in the sweep with ZERO error, not
 *       merely small error. A predictor costing two executions would then price all
 *       of them, which is the cheapest possible refutation of an implied receipt.
 *
 *   AC3 THE CONSTRUCTIVE REFUTATION, and the one this set exists for. Predicted:
 *       two programs exist with IDENTICAL instruction count and IDENTICAL opcode
 *       histogram, differing in one immediate operand, whose executed step counts
 *       differ by more than 100x. Predicted the achievable ratio inside the tryte
 *       range is above 300.
 *
 *       That is a counterexample rather than a failed search, and it settles the
 *       question against static counting: any predictor reading only the shape of
 *       a program — which is EXACTLY what a symbol-counting price reads — must be
 *       wrong on at least one of the two. The static tick and the dynamic one are
 *       therefore not merely different quantities, they are not even correlated
 *       across this pair.
 *
 *   AC4 and the tick and the bit are not interconvertible. Predicted: bits erased
 *       per executed instruction varies across the eight programs by more than 2x,
 *       and the program with the highest erasure per step is NOT the one with the
 *       most steps. So a currency denominated in steps and one denominated in
 *       destroyed information price the same programs differently, and choosing
 *       between them is a decision rather than a units conversion.
 *
 * ------------------------------------------------------------------------------
 * Run: node tools/predict-audit.js
 */

const T = require('../src/ternary.js');
const { BY_CODE } = require('../src/isa.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto } = require('../src/assembler.js');
const fs = require('fs');
const path = require('path');

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);
const PROGDIR = path.join(__dirname, '..', 'programs');

log('PREDICT AUDIT — can you learn what a program costs without paying for it?\n');

/**
 * Run one program to completion and report what it actually cost.
 *
 * Returns executed instruction count and the opcode histogram of what RAN, which
 * is a different object from the histogram of what was written — the distinction
 * AC3 turns on.
 */
function execute(src, input = [], maxSteps = 400000) {
  const vm = new TryteVM({ maxSteps, input });
  loadInto(vm, src);
  const ran = {};
  let steps = 0;
  try {
    while (!vm.halted) {
      const op = BY_CODE[vm.read(vm.PC)];
      if (!op) return { steps, ran, note: 'illegal opcode', ok: false };
      ran[op.name] = (ran[op.name] || 0) + 1;
      steps++;
      if (!vm.step()) break;
    }
  } catch (e) { return { steps, ran, note: e.message.slice(0, 40), ok: false }; }
  return { steps, ran, out: vm.output.slice(), ok: true };
}

/** The static shape of a program: how many instructions, and which opcodes. */
function staticShape(src) {
  const vm = new TryteVM({});
  loadInto(vm, src);
  const hist = {};
  let count = 0;
  // Walk the assembled image linearly from the origin until the first HALT, which
  // is what any cheap static reader would do.
  for (let pc = 0; pc < 400; pc += 2) {
    const op = BY_CODE[vm.read(pc)];
    if (!op) break;
    hist[op.name] = (hist[op.name] || 0) + 1;
    count++;
    if (op.name === 'HALT') break;
  }
  return { count, hist };
}

const histKey = h => Object.keys(h).sort().map(k => `${k}:${h[k]}`).join(',');

/* ============================================================================
 * 0. INSTRUMENT CHECK
 * ========================================================================== */
log(line);
log('0. INSTRUMENT CHECK');
log(line);
{
  const trivial = '        HALT\n';
  const r = execute(trivial);
  log(`  a program that is only HALT runs ${r.steps} instruction(s) — must be 1`);
  const two = '        LOADI 5\n        HALT\n';
  log(`  LOADI then HALT runs ${execute(two).steps} — must be 2`);
  // The counter must respond to a loop, or it is not counting execution at all.
  const spin3 = '        LOADI 3\nlp:     ADDI  -1\n        BR3   t\nt:      .table done, done, lp\ndone:   HALT\n';
  const spin1 = '        LOADI 1\nlp:     ADDI  -1\n        BR3   t\nt:      .table done, done, lp\ndone:   HALT\n';
  log(`  a three-turn loop runs ${execute(spin3).steps}, a one-turn loop ${execute(spin1).steps} — must differ`);
  log(`  and their STATIC shapes are identical: ${staticShape(spin3).count} instructions either way, ` +
    `same histogram: ${histKey(staticShape(spin3).hist) === histKey(staticShape(spin1).hist)}`);
}

/* ============================================================================
 * 1. AC1 — does the cost depend on the input at all?
 * ========================================================================== */
log('\n' + line);
log('1. AC1 — which programs cost a different amount for different inputs?');
log(line);

const FILES = fs.readdirSync(PROGDIR).filter(f => f.endsWith('.tasm')).sort();
const INPUTS = [[], [1, 1], [5, 7], [40, 3], [200, 11], [-6, 2], [364, 1]];

const varying = [];
for (const f of FILES) {
  const src = fs.readFileSync(path.join(PROGDIR, f), 'utf8');
  const counts = INPUTS.map(inp => execute(src, inp).steps);
  const uniq = [...new Set(counts)];
  const readsInput = /^\s*IN\s*(;.*)?$/m.test(src);
  if (uniq.length > 1) varying.push(f);
  log(`  ${f.padEnd(20)} reads IN: ${(readsInput ? 'yes' : 'no ')}   steps: ${counts.join(' ')}` +
    `   ${uniq.length > 1 ? '<- VARIES' : 'constant'}`);
}
log(`\n  programs whose step count depends on input: ${varying.length} of ${FILES.length}` +
  `  (${varying.join(' ') || 'none'})`);
log(`  programs that execute IN: ${FILES.filter(f => /^\s*IN\s*(;.*)?$/m.test(fs.readFileSync(path.join(PROGDIR, f), 'utf8'))).length}`);

/* ============================================================================
 * 2. AC2 — where it varies, how cheap is a predictor?
 * ========================================================================== */
log('\n' + line);
log('2. AC2 — fit two runs, predict the rest');
log(line);

const cdSrc = fs.readFileSync(path.join(PROGDIR, 'countdown.tasm'), 'utf8');
const at = n => execute(cdSrc, [n]).steps;
{
  // Two runs is the cheapest possible fit for a straight line.
  const n1 = 1, n2 = 2;
  const s1 = at(n1), s2 = at(n2);
  const a = (s2 - s1) / (n2 - n1);
  const b = s1 - a * n1;
  log(`  fitted from N=${n1} (${s1} steps) and N=${n2} (${s2} steps):  steps = ${a}*N + ${b}`);
  let exact = 0, checked = 0, worst = 0;
  const misses = [];
  for (let n = 1; n <= 200; n++) {
    const actual = at(n), pred = a * n + b;
    checked++;
    if (actual === pred) exact++; else { misses.push(n); worst = Math.max(worst, Math.abs(actual - pred)); }
  }
  log(`  predicted exactly on ${exact} of ${checked} inputs; worst error ${worst}` +
    `${misses.length ? '; first misses at N=' + misses.slice(0, 5).join(',') : ''}`);
  log(`  so pricing all ${checked} runs cost 2 executions: ${exact === checked ? 'a predictor beats paying' : 'the fit is not exact'}`);
}

/* ============================================================================
 * 3. AC3 — the constructive refutation.
 * ========================================================================== */
log('\n' + line);
log('3. AC3 — two programs of identical shape, wildly different cost');
log(line);

const spin = k => `        LOADI ${k}
lp:     ADDI  -1
        BR3   t
t:      .table done, done, lp
done:   HALT
`;
{
  const cheap = spin(1), dear = spin(T.TRYTE_MAX);
  const sc = staticShape(cheap), sd = staticShape(dear);
  const rc = execute(cheap), rd = execute(dear);
  log(`  program A: LOADI 1                 static ${sc.count} instructions, ran ${rc.steps}`);
  log(`  program B: LOADI ${T.TRYTE_MAX}               static ${sd.count} instructions, ran ${rd.steps}`);
  log(`  identical instruction count: ${sc.count === sd.count}`);
  log(`  identical opcode histogram:  ${histKey(sc.hist) === histKey(sd.hist)}   (${histKey(sc.hist)})`);
  log(`  cost ratio: ${(rd.steps / rc.steps).toFixed(1)}x`);
  log('');
  log(`  Any predictor reading only instruction count or opcode histogram returns ONE`);
  log(`  number for both, so it is wrong on at least one of them by a factor of`);
  log(`  ${(rd.steps / rc.steps).toFixed(0)}. That is a counterexample, not a failed search.`);
  // And the same texts differ only in one immediate, so even a reader that parsed
  // every opcode and every operand SHAPE, without evaluating, sees the same program.
  const diff = cheap.split('\n').filter((l, i) => l !== dear.split('\n')[i]);
  log(`  lines that differ between the two programs: ${diff.length}`);
}

/* ============================================================================
 * 4. AC4 — is a step a bit?
 * ========================================================================== */
log('\n' + line);
log('4. AC4 — bits erased per executed instruction, across the eight programs');
log(line);

const E = require('./erasure-audit.js');
{
  const rows = E.programRows.filter(r => r.steps > 0 && r.actual > 0)
    .map(r => ({ ...r, perStep: r.actual / r.steps }));
  rows.sort((a, b) => b.perStep - a.perStep);
  log('  program              steps   bits erased   bits per step');
  log('  ' + '-'.repeat(58));
  for (const r of rows)
    log(`  ${r.file.padEnd(20)} ${String(r.steps).padStart(5)}   ${r.actual.toFixed(2).padStart(11)}   ${r.perStep.toFixed(4).padStart(13)}`);
  const hi = rows[0], lo = rows[rows.length - 1];
  const mostSteps = rows.reduce((m, r) => (r.steps > m.steps ? r : m), rows[0]);
  log(`\n  spread: ${(hi.perStep / lo.perStep).toFixed(2)}x  (${hi.file} vs ${lo.file})`);
  log(`  most steps: ${mostSteps.file}; most bits per step: ${hi.file}` +
    `  ${mostSteps.file === hi.file ? '(the same program)' : '(NOT the same program)'}`);
}

log('\n' + line);
log('Registered predictions AC1-AC4 are in this file\'s docstring. Outcomes go to');
log('FINDINGS.json and are asserted in test/test-predict.js.');
log(line);

module.exports = { execute, staticShape, histKey, spin, INPUTS };
