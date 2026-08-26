'use strict';
/* ERASURE AUDIT — what does this machine destroy, and is the price in the object?
 *
 * WHY THIS SET EXISTS
 * -------------------
 * A sister project of this one — the tick ceremony — prices a term by a static
 * count: expand to SK, weight the leaves I=2, K=4, S=5, and the price is one less
 * than the total. The virtue of that column is that it is a TOTAL FUNCTION OF THE
 * OBJECT. Anyone holding the term recomputes the price by hand; there is nothing to
 * attest and no meter to corrupt. Every deployed cost system prices work
 * extrinsically instead — proof-of-work prices energy burnt, gas prices instructions
 * executed — and therefore has to be trusted.
 *
 * But that spec is careful to scope itself: the tick is a static count, not an
 * invariant of reduction, and explicitly not wall-clock. A price tag says what a
 * thing cost to build. A conservation law says what can never be gotten back. They
 * are different objects and the tick is unambiguously the first.
 *
 * The second one is available here and has not been measured. Landauer prices
 * erasure at kT ln2 per bit, and that price does not have to be declared by anyone:
 * a map that loses states loses them whatever anybody agrees. This repository has
 * already measured the same law in a neighbouring form — D1 found that a permutation
 * over trytes preserves all 729 states forever while a random map falls to 461 after
 * one call and 116 by the tenth. What has never been asked is which of THIS MACHINE'S
 * OWN INSTRUCTIONS do that, and how much each one destroys.
 *
 * THE MEASURE
 * -----------
 * For a map phi on a state set S with the uniform prior, the erased information is
 *
 *     E(phi) = H(X) - H(phi(X)) = (1/|S|) * SUM_y n_y log2 n_y
 *
 * where n_y is the size of the preimage of y. It is zero exactly when phi is
 * injective and log2|S| exactly when phi is constant, and it is measured in bits.
 * Nothing about it is a convention: it is a property of the map.
 *
 * WHAT COUNTS AS THE STATE — stated up front because it decides the answers
 * ------------------------------------------------------------------------
 * The census is over the DATAPATH: the accumulator A, and — for an instruction whose
 * operand names a memory address — the addressed word W, which survives the
 * instruction and so is part of the state rather than a parameter. The pair space is
 * 729 x 729 = 531,441, the same arena F3 swept for the adder.
 *
 * Deliberately EXCLUDED, and each exclusion changes an answer:
 *   - PC. Every jump overwrites it, so counting PC would make JMP an eraser. That is
 *     a true statement about control and a separate question from this one.
 *   - C, the gate control register. SETC and LDC overwrite it.
 *   - The second cell of the instruction stream. An immediate is program text, not
 *     mutable state, so for an `imm` opcode the state is A alone and the immediate
 *     parameterises the map.
 * Widening the state can only ever ADD erasure, so every figure below is a LOWER
 * BOUND on what the whole machine destroys.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered before the run, per AGENTS.md.
 *
 *   AB1 information-preserving two-input operations are RARE in ternary, and much
 *       rarer than in binary. TOP applies a nine-entry table tritwise, so the
 *       instruction map is (A,W) -> (f(A,W), W), which is injective exactly when
 *       every column of the table — a -> f(a,m) at fixed m — is a bijection of
 *       {-1,0,+1}. Three columns, six permutations each.
 *       Predicted: 216 of the 19,683 tables are reversible (1.10%), against 4 of 16
 *       in the binary analogue (25.0%) — a factor of about 23. Predicted further
 *       that 18 of the 216 are affine over GF(3) and 198 are not, which is the
 *       shape M1 found on the 27-point arena arriving on the 729-point one.
 *
 *   AB2 the erasing instructions are NOT the ones that overwrite the accumulator.
 *       Predicted classification of all 25 opcodes under the datapath state:
 *         11 erase zero bits for every operand  (HALT ADD ADDI SUB NEG SETC JMP
 *                                                BR3 OUT LDC JMPX)
 *          4 erase the maximum, 9.51 bits, for every operand (LOADI LOAD STORE IN)
 *          5 erase an amount that depends on the operand   (MIN MAX CSUM SHL SHR)
 *          3 are table-parameterised families, not single maps (TGATE TOP TOPC)
 *          2 are three-place and out of scope for a pair census (LOADX STOREX)
 *       The load-bearing part is that STORE is in the maximal group. STORE never
 *       touches the accumulator and reads as the instruction that SAVES something;
 *       under the pair state it destroys the addressed word outright, and is the
 *       textbook Landauer erasure sitting in plain sight. Registered so that being
 *       wrong about the count is visible: if the four are exactly the accumulator
 *       overwrites and STORE is not among them, this prediction has failed.
 *
 *   AB3 erasure is DATA-DEPENDENT, exactly as settling time turned out to be in E4.
 *       Predicted: MIN and MAX each span the full range, 0 bits when the operand is
 *       all +1 (resp. all -1) and 9.5098 bits at the opposite corner, with a mean
 *       over uniform operands of 4.5033 bits — derived as 6 * (0 + 2/3 + log2 3)/3.
 *       Predicted: CSUM never reaches the maximum at all, spanning 0 to exactly 4
 *       bits with mean 8/3 = 2.6667. Predicted: SHL n and SHR n erase the SAME
 *       amount, n*log2 3, for n in 0..6 — one drops the high trits and one the low,
 *       and the count cannot tell them apart.
 *
 *   AB4 and therefore the charge is not recoverable from the program text, which is
 *       precisely the property the tick has and this does not. For every program in
 *       programs/, compare the erasure actually incurred along the trace against the
 *       bound obtained from the opcode alone (each executed instruction charged its
 *       worst case over all operands). Predicted: the actual total is strictly below
 *       the bound for every program that executes a data-dependent opcode, and below
 *       it by more than a factor of two for at least one. Registered with the
 *       alternative: if actual equals bound everywhere, erasure IS a static function
 *       of the text and the tick's virtue transfers intact.
 *
 *   AB5 the machine erases by CONVENTION, not by necessity — and the named
 *       instruction set is what makes it necessary. Take the accumulator maps that
 *       erase nothing and ask what group they generate on the 729 states.
 *       Predicted: the named zero-erasure ALU opcodes (ADD, ADDI, SUB, NEG over
 *       every operand) generate a group of order exactly 1,458 — the 729
 *       translations extended by negation — which is a vanishing fraction of 729!
 *       and cannot compute. THAT is this machine's version of the result that no
 *       term over {B,C,W,I} can select: without an eraser the named set is inert.
 *       Predicted: admitting the 216 reversible TOP tables from AB1 lifts it to the
 *       FULL SYMMETRIC GROUP, order 729!, so any permutation of the accumulator is
 *       reachable without destroying one bit. If both hold, erasure in this machine
 *       is a property of the opcode table rather than of computation.
 *
 * ------------------------------------------------------------------------------
 * Run: node tools/erasure-audit.js
 */

const T = require('../src/ternary.js');
const { OPS, BY_CODE } = require('../src/isa.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto } = require('../src/assembler.js');
const { idPerm, groupOrder } = require('./perm-lib.js');
const fs = require('fs');
const path = require('path');

const N = T.TRYTE_STATES;                 // 729 accumulator states
const PAIRS = N * N;                      // 531,441 (A, W) pairs
const MAXBITS = Math.log2(N);             // 9.5098
const val = i => i + T.TRYTE_MIN;         // state index -> tryte value
const ix = v => T.wrap(v) - T.TRYTE_MIN;  // tryte value -> state index
const line = '='.repeat(78);
const f4 = x => x.toFixed(4);

console.log('ERASURE AUDIT — what this machine destroys, in bits\n');

/**
 * Erased information in bits, for a map given as an array image[x] = phi(x).
 *
 * E = (1/|S|) * SUM_y n_y log2 n_y, the average over inputs of the log of the
 * preimage size of where that input lands. Zero iff injective.
 */
function erasureOf(image, size) {
  const n = new Int32Array(size);
  for (let x = 0; x < size; x++) n[image[x]]++;
  let s = 0;
  for (let y = 0; y < size; y++) if (n[y] > 1) s += n[y] * Math.log2(n[y]);
  return s / size;
}

/** Distinct images, for reporting alongside the entropy figure. */
function imageSize(image, size) {
  const seen = new Uint8Array(size);
  let c = 0;
  for (let x = 0; x < size; x++) if (!seen[image[x]]) { seen[image[x]] = 1; c++; }
  return c;
}

/* ============================================================================
 * 0. INSTRUMENT CHECK — before any finding, show the measure reports the two
 *    ends of its own scale and that a wrong answer is visible.
 * ========================================================================== */
console.log(line);
console.log('0. INSTRUMENT CHECK');
console.log(line);
{
  const identity = idPerm(N);
  const constant = new Array(N).fill(0);
  const twoToOne = Array.from({ length: N }, (_, i) => i >> 1);
  const eI = erasureOf(identity, N);
  const eC = erasureOf(constant, N);
  const e2 = erasureOf(twoToOne, N);
  console.log(`  identity over ${N} states        E = ${f4(eI)} bits   (must be 0)`);
  console.log(`  constant map                     E = ${f4(eC)} bits   (must be ${f4(MAXBITS)})`);
  console.log(`  two-to-one map                   E = ${f4(e2)} bits   (must be near 1)`);
  const ok = eI === 0 && Math.abs(eC - MAXBITS) < 1e-12 && Math.abs(e2 - 1) < 0.01;
  console.log(`  scale endpoints correct: ${ok ? 'YES' : 'NO — the measure is wrong, stop here'}`);
  // A three-to-one map must read exactly log2 3, which is the SHL/SHR prediction's unit.
  const threeToOne = Array.from({ length: N }, (_, i) => Math.floor(i / 3));
  console.log(`  three-to-one map                 E = ${f4(erasureOf(threeToOne, N))} bits   (must be ${f4(Math.log2(3))})`);
}

/* ============================================================================
 * 1. AB1 — the tritwise two-input census.
 *
 * The direct analogue of the collision census that separates K from I and S: form
 * every operation of the shape, and count how much each destroys.
 * ========================================================================== */
console.log('\n' + line);
console.log('1. AB1 — how many two-input tritwise operations preserve information?');
console.log(line);

const TRITS = [-1, 0, 1];

/** Decode table index 0..19682 into nine outputs, x-major as ttable expects. */
function tableOf(k) {
  const t = [];
  let r = k;
  for (let i = 0; i < 9; i++) { t.push(TRITS[r % 3]); r = Math.floor(r / 3); }
  return t;
}

/** Column m of a table: the map a -> f(a, m). Row order is x-major, so f(x,y) is t[3x+y]. */
const columnOf = (t, mIdx) => [0, 1, 2].map(aIdx => t[3 * aIdx + mIdx]);
const isBijection = col => new Set(col).size === 3;

let ternaryReversible = 0, ternaryAffine = 0;
const reversibleTables = [];
for (let k = 0; k < 19683; k++) {
  const t = tableOf(k);
  if ([0, 1, 2].every(m => isBijection(columnOf(t, m)))) {
    ternaryReversible++;
    reversibleTables.push(t);
    // affine over GF(3): f(a,m) = alpha*a + beta*m + gamma with alpha nonzero
    let affine = false;
    for (let al = 1; al < 3 && !affine; al++)
      for (let be = 0; be < 3 && !affine; be++)
        for (let ga = 0; ga < 3 && !affine; ga++) {
          let all = true;
          for (let a = 0; a < 3 && all; a++)
            for (let m = 0; m < 3 && all; m++) {
              const want = TRITS[(al * a + be * m + ga) % 3];
              if (t[3 * a + m] !== want) all = false;
            }
          if (all) affine = true;
        }
    if (affine) ternaryAffine++;
  }
}

let binaryReversible = 0;
for (let k = 0; k < 16; k++) {
  const t = [0, 1, 2, 3].map(i => (k >> i) & 1);       // t[2a+m]
  const cols = [0, 1].map(m => [0, 1].map(a => t[2 * a + m]));
  if (cols.every(c => new Set(c).size === 2)) binaryReversible++;
}

console.log(`  ternary: ${ternaryReversible} of 19,683 tables are information-preserving  (${(100 * ternaryReversible / 19683).toFixed(3)}%)`);
console.log(`  binary:  ${binaryReversible} of 16 tables are information-preserving      (${(100 * binaryReversible / 16).toFixed(1)}%)`);
console.log(`  ratio of fractions: binary is ${((binaryReversible / 16) / (ternaryReversible / 19683)).toFixed(1)}x more likely to preserve`);
console.log(`  of the ${ternaryReversible} reversible: ${ternaryAffine} affine over GF(3), ${ternaryReversible - ternaryAffine} NOT affine`);

// Instrument check on the column criterion: verify it against a direct sweep of
// the 531,441-pair space on a sample, rather than trusting the argument.
{
  let agree = 0, checked = 0;
  for (let k = 0; k < 19683; k += 197) {
    const t = tableOf(k);
    const img = new Int32Array(PAIRS);
    for (let a = 0; a < N; a++)
      for (let w = 0; w < N; w++)
        img[a * N + w] = ix(T.ttable(t, val(a), val(w))) * N + w;
    const byCriterion = [0, 1, 2].every(m => isBijection(columnOf(t, m)));
    const bySweep = erasureOf(img, PAIRS) === 0;
    if (byCriterion === bySweep) agree++;
    checked++;
  }
  console.log(`  column criterion vs a full 531,441-pair sweep: ${agree}/${checked} agree`);
}

/* ============================================================================
 * 2. AB2 — the ISA census.
 * ========================================================================== */
console.log('\n' + line);
console.log('2. AB2 — every opcode, and what it destroys');
console.log(line);

/**
 * The datapath map for one opcode at one value of its second input.
 *
 * Returns null when the opcode is a table-parameterised family or reaches a third
 * cell, because those are not two-place maps and pretending otherwise would be the
 * kind of quiet scope change this repository has a defect class for.
 */
function datapathMap(name, v) {
  const addr = OPS[name].operand === 'addr';
  const size = addr ? PAIRS : N;
  const img = new Int32Array(size);
  const put = (a, w, a2, w2) => { img[addr ? a * N + w : a] = addr ? ix(a2) * N + ix(w2) : ix(a2); };
  for (let a = 0; a < N; a++) {
    const A = val(a);
    const ws = addr ? N : 1;
    for (let w = 0; w < ws; w++) {
      const W = addr ? val(w) : v;            // addressed word, or the immediate
      let A2 = A, W2 = W;
      switch (name) {
        case 'HALT': case 'JMP': case 'BR3': case 'OUT': case 'JMPX':
        case 'SETC': case 'LDC':                       break;      // datapath untouched
        case 'LOADI': A2 = T.wrap(v);                  break;
        case 'LOAD':  A2 = W;                          break;
        case 'STORE': W2 = A;                          break;      // the word is gone
        case 'ADD':   A2 = T.add(A, W);                break;
        case 'ADDI':  A2 = T.add(A, v);                break;
        case 'SUB':   A2 = T.sub(A, W);                break;
        case 'NEG':   A2 = T.neg(A);                   break;
        case 'MIN':   A2 = T.tMIN(A, W);               break;
        case 'MAX':   A2 = T.tMAX(A, W);               break;
        case 'CSUM':  A2 = T.tCLAMPSUM(A, W);          break;
        case 'SHL':   A2 = T.shiftLeft(A, v);          break;
        case 'SHR':   A2 = T.shiftRight(A, v);         break;
        case 'IN':    A2 = 0;                          break;      // input is exogenous
        default: return null;                                       // families, third cell
      }
      put(a, w, A2, W2);
    }
  }
  return { img, size };
}

// The operand range each opcode is actually swept over, and why.
const SWEEP = {
  SHL: [0, 1, 2, 3, 4, 5, 6],   // 3^n overflows a double well before the tryte range
  SHR: [0, 1, 2, 3, 4, 5, 6],
};
const fullSweep = Array.from({ length: N }, (_, i) => val(i));

const census = [];
for (const name of Object.keys(OPS)) {
  const vs = OPS[name].operand === 'addr' ? [0] : (SWEEP[name] || fullSweep);
  let min = Infinity, max = -Infinity, sum = 0, imgAt = null, n = 0;
  let family = false;
  for (const v of vs) {
    const m = datapathMap(name, v);
    if (!m) { family = true; break; }
    const e = erasureOf(m.img, m.size);
    if (e < min) min = e;
    if (e > max) { max = e; imgAt = imageSize(m.img, m.size); }
    sum += e; n++;
  }
  census.push(family
    ? { name, family: true }
    : { name, min, max, mean: sum / n, states: OPS[name].operand === 'addr' ? PAIRS : N, imgAt, sweep: n });
}

console.log('  opcode   state space   min bits   mean bits   max bits   class');
console.log('  ' + '-'.repeat(70));
const CLASS = r => {
  if (r.family) return 'family / out of scope';
  if (r.max === 0) return 'preserves';
  if (r.min === r.max) return 'erases, fixed';
  return 'erases, operand-dependent';
};
for (const r of census) {
  if (r.family) { console.log(`  ${r.name.padEnd(8)} ${'—'.padStart(11)}   ${'—'.padStart(8)}   ${'—'.padStart(9)}   ${'—'.padStart(8)}   ${CLASS(r)}`); continue; }
  console.log(`  ${r.name.padEnd(8)} ${String(r.states).padStart(11)}   ${f4(r.min).padStart(8)}   ${f4(r.mean).padStart(9)}   ${f4(r.max).padStart(8)}   ${CLASS(r)}`);
}

const preserves = census.filter(r => !r.family && r.max === 0).map(r => r.name);
const fixedMax = census.filter(r => !r.family && r.min === r.max && r.max > 0).map(r => r.name);
const varying = census.filter(r => !r.family && r.min !== r.max).map(r => r.name);
const families = census.filter(r => r.family).map(r => r.name);
console.log(`\n  preserving (${preserves.length}): ${preserves.join(' ')}`);
console.log(`  erasing a fixed amount (${fixedMax.length}): ${fixedMax.join(' ')}`);
console.log(`  erasing an operand-dependent amount (${varying.length}): ${varying.join(' ')}`);
console.log(`  families / three-place (${families.length}): ${families.join(' ')}`);
const storeRow = census.find(r => r.name === 'STORE');
console.log(`\n  STORE, which never writes the accumulator: ${f4(storeRow.max)} bits erased — ` +
  `${storeRow.max >= MAXBITS - 1e-9 ? 'the maximum' : 'NOT the maximum'}`);

/* ============================================================================
 * 3. AB3 — data dependence.
 * ========================================================================== */
console.log('\n' + line);
console.log('3. AB3 — the same instruction, a different price');
console.log(line);

for (const name of ['MIN', 'MAX', 'CSUM']) {
  // Sweep the operand explicitly, over the accumulator map alone, so the corners
  // are nameable: all +1, all 0, all -1.
  const at = W => {
    const img = new Int32Array(N);
    for (let a = 0; a < N; a++) {
      const A = val(a);
      img[a] = ix(name === 'MIN' ? T.tMIN(A, W) : name === 'MAX' ? T.tMAX(A, W) : T.tCLAMPSUM(A, W));
    }
    return erasureOf(img, N);
  };
  let min = Infinity, max = -Infinity, sum = 0;
  for (let w = 0; w < N; w++) { const e = at(val(w)); if (e < min) min = e; if (e > max) max = e; sum += e; }
  console.log(`  ${name.padEnd(5)} over all 729 operands:  min ${f4(min)}   mean ${f4(sum / N)}   max ${f4(max)} bits`);
  console.log(`         at operand +364 (all +1): ${f4(at(T.TRYTE_MAX))}    at -364 (all -1): ${f4(at(T.TRYTE_MIN))}    at 0: ${f4(at(0))}`);
}

console.log('');
for (let n = 0; n <= 6; n++) {
  const sh = fn => { const img = new Int32Array(N); for (let a = 0; a < N; a++) img[a] = ix(fn(val(a), n)); return erasureOf(img, N); };
  const l = sh(T.shiftLeft), r = sh(T.shiftRight);
  console.log(`  SHL ${n}: ${f4(l)} bits    SHR ${n}: ${f4(r)} bits    ${n} * log2 3 = ${f4(n * Math.log2(3))}` +
    `    ${Math.abs(l - r) < 1e-12 ? 'identical' : 'DIFFER'}`);
}

/* ============================================================================
 * 4. AB4 — is the charge in the object, the way a tick is?
 * ========================================================================== */
console.log('\n' + line);
console.log('4. AB4 — actual erasure along a trace, against the bound from the text');
console.log(line);

// Worst case per opcode, over the operand range swept above. This is what a static
// reader of the program text could charge without running it.
const worst = {};
for (const r of census) if (!r.family) worst[r.name] = r.max;

/** Erasure of one instruction, given the opcode name and the effective second input. */
function erasureAt(name, v) {
  if (worst[name] === undefined) return null;             // family / three-place
  const m = datapathMap(name, v);
  if (!m) return null;
  return erasureOf(m.img, m.size);
}

const progDir = path.join(__dirname, '..', 'programs');
const rows = [];
for (const file of fs.readdirSync(progDir).filter(f => f.endsWith('.tasm')).sort()) {
  const src = fs.readFileSync(path.join(progDir, file), 'utf8');
  let actual = 0, bound = 0, steps = 0, skipped = 0, note = '';
  const cache = new Map();
  try {
    const vm = new TryteVM({ maxSteps: 20000 });
    loadInto(vm, src);
    while (!vm.halted) {
      const opcode = vm.read(vm.PC);
      const op = BY_CODE[opcode];
      if (!op) { note = 'illegal opcode'; break; }
      const operand = vm.read(vm.PC + 1);
      const v = op.operand === 'addr' ? vm.read(operand) : operand;
      const key = op.name + ':' + v;
      let e = cache.has(key) ? cache.get(key) : (cache.set(key, erasureAt(op.name, v)), cache.get(key));
      if (e === null) skipped++; else { actual += e; bound += worst[op.name]; }
      steps++;
      if (!vm.step()) break;
    }
  } catch (err) { note = err.message.slice(0, 40); }
  rows.push({ file, steps, actual, bound, skipped, note });
}

console.log('  program              steps   actual bits   text bound   ratio   unpriced');
console.log('  ' + '-'.repeat(74));
for (const r of rows) {
  const ratio = r.actual > 0 ? (r.bound / r.actual).toFixed(2) : '—';
  console.log(`  ${r.file.padEnd(20)} ${String(r.steps).padStart(5)}   ${f4(r.actual).padStart(11)}   ${f4(r.bound).padStart(10)}   ${ratio.padStart(5)}   ${String(r.skipped).padStart(8)}${r.note ? '   (' + r.note + ')' : ''}`);
}
const strictlyBelow = rows.filter(r => r.actual > 0 && r.bound > r.actual + 1e-9).length;
const priced = rows.filter(r => r.actual > 0).length;
const best = rows.filter(r => r.actual > 0).reduce((m, r) => Math.max(m, r.bound / r.actual), 0);
console.log(`\n  programs where the text bound exceeds the actual charge: ${strictlyBelow} of ${priced}`);
console.log(`  largest overcharge from reading the text alone: ${best.toFixed(2)}x`);

/* ============================================================================
 * 5. AB5 — what the reversible fragment can do.
 * ========================================================================== */
console.log('\n' + line);
console.log('5. AB5 — the group generated by the instructions that erase nothing');
console.log(line);

const permOf = fn => { const g = new Array(N); for (let a = 0; a < N; a++) g[a] = ix(fn(val(a))); return g; };

// The named ALU's zero-erasure accumulator maps, over every operand.
const namedGens = [];
for (let w = 0; w < N; w++) {
  namedGens.push(permOf(A => T.add(A, val(w))));
  namedGens.push(permOf(A => T.sub(A, val(w))));
}
namedGens.push(permOf(A => T.neg(A)));
const namedOrder = groupOrder(namedGens, N);
console.log(`  named zero-erasure ALU (ADD, ADDI, SUB, NEG over every operand)`);
console.log(`    generators: ${namedGens.length}`);
console.log(`    group order: ${namedOrder}`);
console.log(`    729 translations x negation would be: ${729n * 2n}`);

// Now admit the reversible TOP tables from AB1.
const topGens = namedGens.slice();
for (const t of reversibleTables)
  for (const w of [T.TRYTE_MIN, 0, T.TRYTE_MAX, 1, -1])
    topGens.push(permOf(A => T.ttable(t, A, w)));
const topOrder = groupOrder(topGens, N);
const factorial = n => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
const FULL = factorial(N);
console.log(`\n  plus the ${reversibleTables.length} reversible TOP tables`);
console.log(`    generators: ${topGens.length}`);
console.log(`    group order has ${topOrder.toString().length} digits`);
console.log(`    729! has ${FULL.toString().length} digits`);
console.log(`    is the full symmetric group: ${topOrder === FULL ? 'YES' : 'NO'}`);
console.log(`    is the alternating group:    ${topOrder === FULL / 2n ? 'YES' : 'NO'}`);

console.log('\n' + line);
console.log('Registered predictions AB1-AB5 are in this file\'s docstring. Outcomes go to');
console.log('FINDINGS.json and are asserted in test/test-erasure.js.');
console.log(line);

module.exports = { erasureOf, imageSize, datapathMap, erasureAt, census, reversibleTables, MAXBITS };
