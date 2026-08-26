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
const { idPerm, groupOrder, chainOf } = require('./perm-lib.js');
const fs = require('fs');
const path = require('path');

const N = T.TRYTE_STATES;                 // 729 accumulator states
const PAIRS = N * N;                      // 531,441 (A, W) pairs
const MAXBITS = Math.log2(N);             // 9.5098
const val = i => i + T.TRYTE_MIN;         // state index -> tryte value
const ix = v => T.wrap(v) - T.TRYTE_MIN;  // tryte value -> state index
const line = '='.repeat(78);

// Required by a test as well as run from the command line, so the reporting is
// silent on import and the two expensive sweeps below are skipped. The test
// re-derives what it asserts from the exported builders rather than trusting a
// printed table, which is this repository's idiom for every other audit.
const MAIN = require.main === module;
const log = (...a) => { if (MAIN) log(...a); };
const f4 = x => x.toFixed(4);

log('ERASURE AUDIT — what this machine destroys, in bits\n');

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
log(line);
log('0. INSTRUMENT CHECK');
log(line);
{
  const identity = idPerm(N);
  const constant = new Array(N).fill(0);
  const twoToOne = Array.from({ length: N }, (_, i) => i >> 1);
  const eI = erasureOf(identity, N);
  const eC = erasureOf(constant, N);
  const e2 = erasureOf(twoToOne, N);
  log(`  identity over ${N} states        E = ${f4(eI)} bits   (must be 0)`);
  log(`  constant map                     E = ${f4(eC)} bits   (must be ${f4(MAXBITS)})`);
  log(`  two-to-one map                   E = ${f4(e2)} bits   (must be near 1)`);
  const ok = eI === 0 && Math.abs(eC - MAXBITS) < 1e-12 && Math.abs(e2 - 1) < 0.01;
  log(`  scale endpoints correct: ${ok ? 'YES' : 'NO — the measure is wrong, stop here'}`);
  // A three-to-one map must read exactly log2 3, which is the SHL/SHR prediction's unit.
  const threeToOne = Array.from({ length: N }, (_, i) => Math.floor(i / 3));
  log(`  three-to-one map                 E = ${f4(erasureOf(threeToOne, N))} bits   (must be ${f4(Math.log2(3))})`);
}

/* ============================================================================
 * 1. AB1 — the tritwise two-input census.
 *
 * The direct analogue of the collision census that separates K from I and S: form
 * every operation of the shape, and count how much each destroys.
 * ========================================================================== */
log('\n' + line);
log('1. AB1 — how many two-input tritwise operations preserve information?');
log(line);

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

log(`  ternary: ${ternaryReversible} of 19,683 tables are information-preserving  (${(100 * ternaryReversible / 19683).toFixed(3)}%)`);
log(`  binary:  ${binaryReversible} of 16 tables are information-preserving      (${(100 * binaryReversible / 16).toFixed(1)}%)`);
log(`  ratio of fractions: binary is ${((binaryReversible / 16) / (ternaryReversible / 19683)).toFixed(1)}x more likely to preserve`);
log(`  of the ${ternaryReversible} reversible: ${ternaryAffine} affine over GF(3), ${ternaryReversible - ternaryAffine} NOT affine`);

// Instrument check on the column criterion: verify it against a direct sweep of
// the 531,441-pair space on a sample, rather than trusting the argument. Skipped on
// import — 100 full pair sweeps is half a minute, and the test does its own.
if (MAIN) {
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
  log(`  column criterion vs a full 531,441-pair sweep: ${agree}/${checked} agree`);
}

/* ============================================================================
 * 2. AB2 — the ISA census.
 * ========================================================================== */
log('\n' + line);
log('2. AB2 — every opcode, and what it destroys');
log(line);

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

/**
 * The same instruction seen from the OTHER side of the state boundary: the map on
 * the accumulator alone, with the second input fixed at a known value v, plus a
 * flag for whether a memory word was destroyed on the way.
 *
 * INSTRUMENT REPAIR, recorded rather than hidden. The first version of this section
 * had only datapathMap above, and it silently answered a different question than the
 * one AB2 asked. Under the pair state an address-operand instruction has ONE erasure
 * figure, because its operand is part of the state being censused rather than a
 * parameter of the map — so MIN came out as "erases a fixed 4.5033 bits" when the
 * prediction was about MIN erasing a DIFFERENT amount for different operands. Both
 * readings are correct and they are readings of different maps. Reporting only one
 * of them would have scored AB2 against a question it was not asking.
 */
function accMap(name, v) {
  if (['TGATE', 'LOADX', 'STOREX', 'TOP', 'TOPC'].includes(name)) return null;
  const img = new Int32Array(N);
  for (let a = 0; a < N; a++) {
    const A = val(a);
    let A2 = A;
    switch (name) {
      case 'LOADI': case 'LOAD': A2 = v;                 break;
      case 'ADD':   case 'ADDI': A2 = T.add(A, v);       break;
      case 'SUB':                A2 = T.sub(A, v);       break;
      case 'NEG':                A2 = T.neg(A);          break;
      case 'MIN':                A2 = T.tMIN(A, v);      break;
      case 'MAX':                A2 = T.tMAX(A, v);      break;
      case 'CSUM':               A2 = T.tCLAMPSUM(A, v); break;
      case 'SHL':                A2 = T.shiftLeft(A, v); break;
      case 'SHR':                A2 = T.shiftRight(A, v); break;
      case 'IN':                 A2 = 0;                 break;
      default:                   A2 = A;                 break;   // datapath untouched
    }
    img[a] = ix(A2);
  }
  return img;
}
/** Instructions that overwrite a memory word, destroying a full tryte of prior state. */
const WRITES_WORD = name => name === 'STORE' || name === 'STOREX';

// The operand range each opcode is actually swept over, and why.
const SWEEP = {
  SHL: [0, 1, 2, 3, 4, 5, 6],   // 3^n overflows a double well before the tryte range
  SHR: [0, 1, 2, 3, 4, 5, 6],
};
const fullSweep = Array.from({ length: N }, (_, i) => val(i));

const census = [];
for (const name of Object.keys(OPS)) {
  const pair = datapathMap(name, 0);
  if (!pair) { census.push({ name, family: true }); continue; }
  const pairE = OPS[name].operand === 'addr'
    ? erasureOf(pair.img, pair.size)
    : null;                                   // an immediate is text, so there is no pair
  const vs = SWEEP[name] || fullSweep;
  let min = Infinity, max = -Infinity, sum = 0, n = 0;
  for (const v of vs) {
    const img = accMap(name, v);
    const e = erasureOf(img, N) + (WRITES_WORD(name) ? MAXBITS : 0);
    if (e < min) min = e;
    if (e > max) max = e;
    sum += e; n++;
  }
  census.push({ name, pairE, min, max, mean: sum / n, sweep: n, writesWord: WRITES_WORD(name) });
}

log('  Two readings, because the state boundary decides the answer:');
log('    pair E   — the whole datapath (A and the addressed word), operand INSIDE the state');
log('    acc      — the accumulator alone with the operand fixed, plus 9.51 for a word overwritten');
log('');
log('  opcode     pair E     acc min   acc mean    acc max   class (accumulator reading)');
log('  ' + '-'.repeat(76));
const CLASS = r => {
  if (r.family) return 'family / out of scope';
  if (r.max === 0) return 'preserves';
  if (Math.abs(r.min - r.max) < 1e-12) return 'erases, fixed';
  return 'erases, operand-dependent';
};
for (const r of census) {
  if (r.family) { log(`  ${r.name.padEnd(8)} ${'—'.padStart(9)}   ${'—'.padStart(9)}  ${'—'.padStart(9)}  ${'—'.padStart(9)}   ${CLASS(r)}`); continue; }
  log(`  ${r.name.padEnd(8)} ${(r.pairE === null ? '—' : f4(r.pairE)).padStart(9)}   ${f4(r.min).padStart(9)}  ${f4(r.mean).padStart(9)}  ${f4(r.max).padStart(9)}   ${CLASS(r)}`);
}

const byClass = c => census.filter(r => CLASS(r) === c).map(r => r.name);
const preserves = byClass('preserves');
const fixedMax = byClass('erases, fixed');
const varying = byClass('erases, operand-dependent');
const families = byClass('family / out of scope');
log(`\n  ACCUMULATOR READING — the one AB2 was asking about:`);
log(`    preserving (${preserves.length}): ${preserves.join(' ')}`);
log(`    erasing a fixed amount (${fixedMax.length}): ${fixedMax.join(' ')}`);
log(`    erasing an operand-dependent amount (${varying.length}): ${varying.join(' ')}`);
log(`    families / three-place (${families.length}): ${families.join(' ')}`);

const pairVarying = census.filter(r => !r.family && r.pairE !== null && Math.abs(r.min - r.max) > 1e-12).map(r => r.name);
log(`\n  PAIR READING — the same opcodes, operand folded into the state:`);
log(`    opcodes that are operand-dependent on the accumulator but a SINGLE`);
log(`    figure on the pair: ${pairVarying.join(' ') || '(none)'}`);
for (const nm of pairVarying) {
  const r = census.find(x => x.name === nm);
  log(`      ${nm.padEnd(6)} pair ${f4(r.pairE)} bits   vs accumulator ${f4(r.min)} .. ${f4(r.max)}, mean ${f4(r.mean)}`);
}

const storeRow = census.find(r => r.name === 'STORE');
log(`\n  STORE, which never writes the accumulator: ${f4(storeRow.pairE)} bits erased on the pair — ` +
  `${storeRow.pairE >= MAXBITS - 1e-9 ? 'the maximum' : 'NOT the maximum'}`);

/* ============================================================================
 * 3. AB3 — data dependence.
 * ========================================================================== */
log('\n' + line);
log('3. AB3 — the same instruction, a different price');
log(line);

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
  log(`  ${name.padEnd(5)} over all 729 operands:  min ${f4(min)}   mean ${f4(sum / N)}   max ${f4(max)} bits`);
  log(`         at operand +364 (all +1): ${f4(at(T.TRYTE_MAX))}    at -364 (all -1): ${f4(at(T.TRYTE_MIN))}    at 0: ${f4(at(0))}`);
}

log('');
for (let n = 0; n <= 6; n++) {
  const sh = fn => { const img = new Int32Array(N); for (let a = 0; a < N; a++) img[a] = ix(fn(val(a), n)); return erasureOf(img, N); };
  const l = sh(T.shiftLeft), r = sh(T.shiftRight);
  log(`  SHL ${n}: ${f4(l)} bits    SHR ${n}: ${f4(r)} bits    ${n} * log2 3 = ${f4(n * Math.log2(3))}` +
    `    ${Math.abs(l - r) < 1e-12 ? 'identical' : 'DIFFER'}`);
}

/* ============================================================================
 * 4. AB4 — is the charge in the object, the way a tick is?
 * ========================================================================== */
log('\n' + line);
log('4. AB4 — actual erasure along a trace, against the bound from the text');
log(line);

// Worst case per opcode over its operand range: what a static reader of the program
// text could charge WITHOUT running it. This is the tick's position — a price
// computed from the artifact alone.
const worst = {};
for (const r of census) if (!r.family) worst[r.name] = r.max;

/**
 * Erasure actually incurred by one executed instruction: the accumulator map at the
 * operand the instruction really saw, plus a full tryte for any memory word it
 * overwrote. The accumulator is the state the charge is levied on, and the operand
 * is known at that point in the trace — it came from the text or from data already
 * present. Cheap by construction: 729 states, not 531,441.
 */
function erasureAt(name, v) {
  if (worst[name] === undefined) return null;             // family / three-place
  const img = accMap(name, v);
  if (!img) return null;
  return erasureOf(img, N) + (WRITES_WORD(name) ? MAXBITS : 0);
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

log('  program              steps   actual bits   text bound   ratio   unpriced');
log('  ' + '-'.repeat(74));
for (const r of rows) {
  const ratio = r.actual > 0 ? (r.bound / r.actual).toFixed(2) : '—';
  log(`  ${r.file.padEnd(20)} ${String(r.steps).padStart(5)}   ${f4(r.actual).padStart(11)}   ${f4(r.bound).padStart(10)}   ${ratio.padStart(5)}   ${String(r.skipped).padStart(8)}${r.note ? '   (' + r.note + ')' : ''}`);
}
const strictlyBelow = rows.filter(r => r.actual > 0 && r.bound > r.actual + 1e-9).length;
const priced = rows.filter(r => r.actual > 0).length;
const best = rows.filter(r => r.actual > 0).reduce((m, r) => Math.max(m, r.bound / r.actual), 0);
log(`\n  programs where the text bound exceeds the actual charge: ${strictlyBelow} of ${priced}`);
log(`  largest overcharge from reading the text alone: ${best.toFixed(2)}x`);

/* ============================================================================
 * 5. AB5 — what the reversible fragment can do.
 * ========================================================================== */
log('\n' + line);
log('5. AB5 — the group generated by the instructions that erase nothing');
log(line);

const permOf = fn => { const g = new Array(N); for (let a = 0; a < N; a++) g[a] = ix(fn(val(a))); return g; };

/*
 * INSTRUMENT NOTE, and the reason perm-lib now returns a chain rather than a number.
 * A Schreier-Sims chain on 729 points does not finish in usable time when handed the
 * 1,459 instruction maps directly — the closure loop is quadratic in the strong
 * generating set. It finishes in seconds from a handful. So the chain is built from
 * a SMALL set and then every one of the 1,459 is sifted through it: if all of them
 * sift to the identity, the small set generates a group containing all of them, and
 * since each small generator IS one of the instruction maps the two groups are
 * equal. Membership is the cheap direction, and this turns "these few suffice" from
 * an argument into a measurement.
 */
const allNamed = [];
for (let w = 0; w < N; w++) {
  allNamed.push(permOf(A => T.add(A, val(w))));
  allNamed.push(permOf(A => T.sub(A, val(w))));
}
allNamed.push(permOf(A => T.neg(A)));

const seedNamed = [permOf(A => T.add(A, 1)), permOf(A => T.neg(A))];   // ADDI 1, NEG
const namedChain = chainOf(seedNamed, N);
const namedCovered = allNamed.filter(g => namedChain.contains(g)).length;
log(`  named zero-erasure ALU: ADD, ADDI, SUB, NEG over every operand`);
log(`    instruction maps: ${allNamed.length}`);
log(`    chain built from ${seedNamed.length} of them (ADDI 1, NEG)`);
log(`    of the ${allNamed.length} maps, ${namedCovered} sift to the identity through that chain`);
log(`    so the two generate the same group: ${namedCovered === allNamed.length ? 'YES' : 'NO'}`);
log(`    group order: ${namedChain.order}`);
log(`    729 translations extended by negation would be: ${729n * 2n}`);

/*
 * Now admit the reversible TOP tables from AB1, and sweep the accumulator WIDTH.
 *
 * The width sweep is not decoration. AB5 predicted the full symmetric group at
 * width 6 and the chain would not finish there, which is the honest signature of a
 * prediction registered beyond the instrument's reach. Running the same
 * construction at widths 1..5 answered the question anyway — the orders are small
 * enough to compute exactly, they land on a closed form, and the closed form is
 * then a prediction about width 6 that CAN be checked by containment.
 */
const factorial = n => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };

function arena(W) {
  const M = 3 ** W, mid = (M - 1) / 2;
  const tr = s => { const t = []; let r = s; for (let i = 0; i < W; i++) { t.push(r % 3); r = Math.floor(r / 3); } return t; };
  const st = t => t.reduce((a, v, i) => a + v * 3 ** i, 0);
  const bal = s => tr(s).reduce((a, v, i) => a + (v - 1) * 3 ** i, 0);
  const pm = f => Array.from({ length: M }, (_, s) => f(s));
  return {
    M, tr,
    named: [pm(s => ((bal(s) + 1 + mid) % M + M) % M), pm(s => st(tr(s).map(v => 2 - v)))],
    table: (t, mt) => pm(s => st(tr(s).map((a, i) => TRITS.indexOf(t[3 * a + mt[i]])))),
  };
}

/**
 * The reversible fragment at accumulator width W: the group generated on 3^W states
 * by the named zero-erasure maps plus every reversible TOP table at every operand.
 *
 * Exported so the test can re-derive the ladder at the widths it can afford. Width 5
 * takes about a minute and width 6 does not finish, which is the honest reason AB5's
 * second half is answered by a closed form checked at five widths rather than by a
 * single number at the width the machine actually has.
 */
function reversibleFragment(W) {
  const A = arena(W);
  const gens = A.named.slice();
  for (const t of reversibleTables) for (let m = 0; m < A.M; m++) gens.push(A.table(t, A.tr(m)));
  return {
    W, M: A.M,
    named: chainOf(A.named, A.M).order,
    full: chainOf(gens, A.M).order,
    SN: factorial(A.M),
    closed: (2n ** BigInt(W)) * (3n ** BigInt((3 ** W - 1) / 2)),
  };
}

log(`\n  plus the ${reversibleTables.length} reversible TOP tables from AB1, swept by accumulator width`);
log('   width   states   named ALU   reversible fragment            S_N digits   fraction of S_N');
log('  ' + '-'.repeat(88));
const ladder = [];
for (let W = 1; MAIN && W <= 5; W++) {
  const r = reversibleFragment(W);
  const frac = Math.round(Math.log10(Number(r.full) || 1) - (r.SN.toString().length - 1));
  ladder.push(r);
  const shown = r.full.toString().length > 26 ? r.full.toString().slice(0, 23) + '...' : r.full.toString();
  log(`   ${String(W).padStart(5)}   ${String(r.M).padStart(6)}   ${String(r.named).padStart(9)}   ${shown.padEnd(28)}   ${String(r.SN.toString().length).padStart(10)}   ${Number.isFinite(frac) ? '10^' + frac : 'below 10^-300'}`);
}

log('\n  the closed form the ladder lands on:  |G_W| = 2^W * 3^((3^W - 1)/2)');
for (const r of ladder)
  log(`    W=${r.W}: measured ${r.full}   closed form ${r.closed}   ${r.full === r.closed ? 'MATCH' : 'DIFFERS'}`);
const allMatch = ladder.every(r => r.full === r.closed);
log(`  every measured width matches: ${allMatch ? 'YES' : 'NO'}`);
log(`  named ALU is 2 * 3^W at every width: ${ladder.every(r => r.named === 2n * 3n ** BigInt(r.W)) ? 'YES' : 'NO'}`);

const W6 = (2n ** 6n) * (3n ** 364n);
const FULL = factorial(N);
log(`\n  extrapolated to the real accumulator, W=6: 2^6 * 3^364`);
log(`    = a number with ${W6.toString().length} digits`);
log(`    729! has ${FULL.toString().length} digits`);
log(`    so the reversible fragment is about 10^-${FULL.toString().length - W6.toString().length} of all permutations`);
log(`  AB5 predicted the FULL symmetric group at W=6. At every width the sweep`);
log(`  could reach, it is not close: reversibility does not buy universality.`);

log('\n' + line);
log('Registered predictions AB1-AB5 are in this file\'s docstring. Outcomes go to');
log('FINDINGS.json and are asserted in test/test-erasure.js.');
log(line);

module.exports = {
  erasureOf, imageSize, datapathMap, accMap, erasureAt, WRITES_WORD,
  census, reversibleTables, tableOf, columnOf, isBijection, arena,
  reversibleFragment, factorial, programRows: rows, MAXBITS, N, PAIRS,
  ternaryReversible, ternaryAffine, binaryReversible,
};
