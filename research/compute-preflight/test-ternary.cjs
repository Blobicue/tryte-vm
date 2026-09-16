'use strict';

/*
 * NOT REGISTERED
 * Deterministic, bounded implementation checks of derived integer identities.
 * No neural training, timing, hardware-performance or fleet-readiness claim.
 * Exhaustiveness applies only to the explicitly enumerated small domains.
 * Mutation fixtures alter a loaded copy of the SUBJECT; repository files are
 * never overwritten. These checks are additional to, not part of, npm test.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const subjectPath = path.join(__dirname, 'ternary.cjs');
const T = require(subjectPath);
const VM = require('../../src/ternary.js');

function bigintOracle(a, b, bias = 0) {
  let sum = BigInt(bias);
  for (let i = 0; i < a.length; i++) sum += BigInt(a[i]) * BigInt(b[i]);
  return Number(sum);
}

function allVectors(length) {
  const out = [];
  for (let code = 0; code < 3 ** length; code++) {
    let rest = code;
    const row = [];
    for (let i = 0; i < length; i++) {
      row.push(rest % 3 - 1);
      rest = Math.floor(rest / 3);
    }
    out.push(row);
  }
  return out;
}

function packedSnapshot(packed) {
  return Object.fromEntries(Object.entries(packed).map(([key, value]) =>
    [key, value instanceof Uint32Array ? Array.from(value) : value]));
}

// Small targeted contract reused unchanged against valid and mutated subjects.
function contract(candidate) {
  assert.equal(candidate.scalarDot([1, 0, -1], [-1, 1, 1], 7), 5);
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) {
    const expected = bigintOracle([a], [b]);
    assert.equal(candidate.dotDual(candidate.packDual([a]), candidate.packDual([b])), expected);
    assert.equal(candidate.dotSign(candidate.packSign([a]), candidate.packSign([b])), expected);
  }
  const lastBit = Array(32).fill(0);
  lastBit[31] = -1;
  assert.deepEqual(Array.from(candidate.unpackDual(candidate.packDual(lastBit))), lastBit);
  assert.equal(candidate.activate(2, 2), 0);
  assert.equal(candidate.activate(-2, 2), 0);
  assert.equal(candidate.activate(3, 2), 1);
  assert.equal(candidate.activate(-3, 2), -1);
  const invalidTail = candidate.packDual([0]);
  invalidTail.positive[0] = 2;
  assert.throws(() => candidate.validateDual(invalidTail), /tail/);
  const invalidSign = candidate.packSign([0]);
  invalidSign.negative[0] = 1;
  assert.throws(() => candidate.validateSign(invalidSign), /canonical/);
  const overlap = candidate.packDual([1]);
  overlap.negative[0] = 1;
  assert.throws(() => candidate.validateDual(overlap), /overlap/);
  assert.throws(() => candidate.scalarDot([-0], [1]), /canonical/);
  assert.throws(() => candidate.scalarDot([1], []), /length/);
  for (const backend of ['scalar', 'dual', 'sign']) {
    const result = candidate.denseLayer([1, -1], [[1, 1], [1, -1], [-1, 1]], {
      biases: [3, -1, 0], thresholds: [3, 0, 1], backend,
    });
    assert.deepEqual(Array.from(result.sums), [3, 1, -2]);
    assert.deepEqual(Array.from(result.outputs), [0, 1, -1]);
  }
}

function mutatedSubject(source, before, after) {
  assert.ok(source.includes(before), `mutation anchor missing: ${before}`);
  const fixture = { exports: {} };
  // This isolated fixture is trusted local source with exactly one substitution.
  new Function('module', 'exports', source.replace(before, after))(fixture, fixture.exports);
  return fixture.exports;
}

function run() {
  let assertions = 0;
  let vectorPairs = 0;
  let layerCases = 0;
  const equal = (a, b) => { assert.equal(a, b); assertions++; };
  const deep = (a, b) => { assert.deepEqual(a, b); assertions++; };
  const rejects = (fn, reason) => { assert.throws(fn, reason); assertions++; };

  // Instrument sanity, before any coverage claim; hand-computed and independent.
  equal(bigintOracle([1, -1, 0, 1], [-1, -1, 1, 1], -2), -1);
  rejects(() => assert.equal(bigintOracle([1], [-1]), 1), assert.AssertionError);
  contract(T);

  function verifyPair(a, b, bias = 0) {
    vectorPairs++;
    const originalA = Array.from(a), originalB = Array.from(b);
    const expected = bigintOracle(a, b, bias);
    const dualA = T.packDual(a), dualB = T.packDual(b);
    const signA = T.packSign(a), signB = T.packSign(b);
    const before = [dualA, dualB, signA, signB].map(packedSnapshot);
    equal(T.scalarDot(a, b, bias), expected);
    equal(T.dotDual(dualA, dualB, bias), expected);
    equal(T.dotSign(signA, signB, bias), expected);
    deep(Array.from(T.unpackDual(dualA)), originalA);
    deep(Array.from(T.unpackSign(signA)), originalA);
    deep([dualA, dualB, signA, signB].map(packedSnapshot), before);
    deep(Array.from(a), originalA);
    deep(Array.from(b), originalB);
    const bounds = T.accumulationBounds(a.length, bias);
    equal(expected >= bounds.min && expected <= bounds.max, true);
    equal(Object.is(T.scalarDot(a, b, bias), -0), false);
  }

  const exhaustiveMaxLength = 4;
  let exhaustivePairs = 0;
  for (let length = 0; length <= exhaustiveMaxLength; length++) {
    const vectors = allVectors(length);
    for (const a of vectors) for (const b of vectors) {
      verifyPair(a, b);
      exhaustivePairs++;
    }
  }
  equal(exhaustivePairs, Array.from({ length: exhaustiveMaxLength + 1 }, (_, n) => 3 ** (2 * n))
    .reduce((sum, n) => sum + n, 0));

  const widths = [0, 1, 31, 32, 33, 63, 64, 65, 1024];
  for (const length of widths) {
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) {
      verifyPair(new Int8Array(length).fill(a), new Int8Array(length).fill(b));
    }
    const a = Array.from({ length }, (_, i) => i % 3 - 1);
    const b = Array.from({ length }, (_, i) => (i * 2 + 1) % 3 - 1);
    for (const bias of [-T.LIMITS.maxAbsBias, -7, 0, 7, T.LIMITS.maxAbsBias]) {
      verifyPair(a, b, bias);
    }
    for (const index of new Set([0, 30, 31, 32, 62, 63, 64, length - 1])) {
      if (index < 0 || index >= length) continue;
      const single = Array(length).fill(0);
      single[index] = -1;
      verifyPair(single, Array(length).fill(1));
      verifyPair(single, Array(length).fill(-1));
    }
  }

  // Exact wide boundary witnesses and the intentional incompatibility with ADD.
  const wrapLength = VM.TRYTE_MAX + 1;
  const ones = Array(wrapLength).fill(1);
  equal(T.scalarDot(ones, ones), wrapLength);
  equal(ones.reduce((sum, item) => VM.add(sum, item), 0), VM.TRYTE_MIN);
  equal(VM.tCLAMPSUM(VM.tCLAMPSUM(1, 1), -1), 0);
  equal(VM.tCLAMPSUM(1, VM.tCLAMPSUM(1, -1)), 1);
  verifyPair(new Int8Array(T.LIMITS.maxWidth).fill(1), new Int8Array(T.LIMITS.maxWidth).fill(-1),
    -T.LIMITS.maxAbsBias);
  verifyPair(new Int8Array(T.LIMITS.maxWidth).fill(1), new Int8Array(T.LIMITS.maxWidth).fill(1),
    T.LIMITS.maxAbsBias);
  equal(T.accumulationBounds(T.LIMITS.maxWidth, T.LIMITS.maxAbsBias).max < T.LIMITS.maxAbsSum, true);

  for (let threshold = 0; threshold <= 4; threshold++) {
    for (let sum = -6; sum <= 6; sum++) {
      const expected = Math.abs(sum) <= threshold ? 0 : Math.sign(sum);
      equal(T.activate(sum, threshold), expected);
      equal(Object.is(T.activate(sum, threshold), -0), false);
    }
  }

  // Whole-layer correctness includes intermediates: threshold saturation cannot
  // hide a bad dot product. Exhaustive inputs, fixed varied rows/biases/thresholds.
  const rows = Object.freeze([[1, 0, -1], [-1, 1, 1], [0, 0, 0], [1, 1, 1]].map(Object.freeze));
  const biases = Object.freeze([0, -1, 2, 1]);
  const thresholds = Object.freeze([0, 1, 2, 1]);
  for (const input of allVectors(rows[0].length)) {
    Object.freeze(input);
    const expectedSums = rows.map((row, i) => bigintOracle(input, row, biases[i]));
    const expectedOutputs = expectedSums.map((sum, i) =>
      Math.abs(sum) <= thresholds[i] ? 0 : Math.sign(sum));
    for (const backend of ['scalar', 'dual', 'sign']) {
      const result = T.denseLayer(input, rows, { biases, thresholds, backend });
      deep(Array.from(result.sums), expectedSums);
      deep(Array.from(result.outputs), expectedOutputs);
      layerCases++;
    }
  }
  for (const backend of ['scalar', 'dual', 'sign']) {
    deep(T.denseLayer([], [], { biases: [], thresholds: [], backend }),
      { sums: new Int32Array(), outputs: new Int8Array() });
    deep(Array.from(T.denseLayer([], [[], []], { biases: [-2, 2], thresholds: [1, 2], backend }).outputs), [-1, 0]);
    const wideLayer = T.denseLayer(new Int8Array(1024).fill(1), [new Int8Array(1024).fill(1)], {
      biases: new Int32Array([T.LIMITS.maxAbsBias]), thresholds: new Int32Array([T.LIMITS.maxAbsSum]), backend,
    });
    equal(wideLayer.sums[0], T.LIMITS.maxAbsBias + 1024);
    equal(wideLayer.outputs[0], 0);
  }

  for (const bad of [-0, 2, -2, 0.5, NaN, Infinity, undefined, null, '1', true, 1n]) {
    for (const operation of [T.packDual, T.packSign]) rejects(() => operation([bad]), /canonical/);
    rejects(() => T.scalarDot([1], [bad]), /canonical/);
  }
  for (const bad of [null, {}, '1', new Uint8Array([1]), new Float64Array([1])]) {
    rejects(() => T.packDual(bad), /Array/);
    rejects(() => T.packSign(bad), /Array/);
  }
  rejects(() => T.packDual(Array(1)), /canonical/);
  rejects(() => T.packDual(new Int8Array(T.LIMITS.maxWidth + 1)), /length/);
  for (const bad of [-0, -1, 1.5, NaN, T.LIMITS.maxWidth + 1]) {
    rejects(() => T.accumulationBounds(bad), /length/);
  }
  for (const bad of [-0, 0.1, NaN, Infinity, T.LIMITS.maxAbsBias + 1, -T.LIMITS.maxAbsBias - 1]) {
    rejects(() => T.scalarDot([], [], bad), /bias/);
    rejects(() => T.dotDual(T.packDual([]), T.packDual([]), bad), /bias/);
    rejects(() => T.dotSign(T.packSign([]), T.packSign([]), bad), /bias/);
  }
  for (const bad of [-0, -1, 0.1, NaN, T.LIMITS.maxAbsSum + 1]) {
    rejects(() => T.activate(0, bad), /threshold/);
  }
  for (const bad of [-0, 0.1, NaN, T.LIMITS.maxAbsSum + 1, -T.LIMITS.maxAbsSum - 1]) {
    rejects(() => T.activate(bad), /sum/);
  }
  rejects(() => T.scalarDot([], [0]), /length/);
  for (const [pack, unpack, validate, dot, first] of [
    [T.packDual, T.unpackDual, T.validateDual, T.dotDual, 'positive'],
    [T.packSign, T.unpackSign, T.validateSign, T.dotSign, 'nonzero'],
  ]) {
    rejects(() => dot(pack([]), pack([0])), /length/);
    for (const bad of [null, {}, { ...pack([0]), encoding: 'wrong' }]) {
      rejects(() => validate(bad), /packed record/);
    }
    rejects(() => validate({ ...pack([0]), length: -0 }), /length/);
    rejects(() => validate({ ...pack([0]), [first]: [0] }), /Uint32Array/);
    rejects(() => validate({ ...pack([0]), [first]: new Uint32Array(2) }), /length/);
    rejects(() => validate({ ...pack([]), [first]: new Uint32Array(1) }), /length/);
    for (const length of [1, 31, 33, 63, 65]) {
      for (const field of [first, 'negative']) {
        const malformed = pack(Array(length).fill(0));
        malformed[field][malformed[field].length - 1] = 1 << (length % T.WORD_BITS);
        rejects(() => validate(malformed), /tail/);
        rejects(() => unpack(malformed), /tail/);
        rejects(() => dot(malformed, pack(Array(length).fill(0))), /tail/);
      }
    }
    const healthy = pack(Array(32).fill(-1));
    equal(validate(healthy), healthy);
    if (typeof SharedArrayBuffer !== 'undefined') {
      const shared = { ...pack([0]), [first]: new Uint32Array(new SharedArrayBuffer(4)) };
      rejects(() => validate(shared), /shared/);
    }
  }
  const illegalDual = T.packDual([0]);
  illegalDual.positive[0] = illegalDual.negative[0] = 1;
  rejects(() => T.unpackDual(illegalDual), /overlap/);
  rejects(() => T.dotDual(T.packDual([0]), illegalDual), /overlap/);
  const illegalSign = T.packSign([0]);
  illegalSign.negative[0] = 1;
  rejects(() => T.unpackSign(illegalSign), /canonical/);
  rejects(() => T.dotSign(T.packSign([0]), illegalSign), /canonical/);
  if (typeof SharedArrayBuffer !== 'undefined') {
    rejects(() => T.packDual(new Int8Array(new SharedArrayBuffer(1))), /shared/);
    rejects(() => T.denseLayer([], [[]], {
      biases: new Int32Array(new SharedArrayBuffer(4)), thresholds: [0],
    }), /shared/);
  }

  const goodOptions = { biases: [0], thresholds: [0] };
  rejects(() => T.denseLayer([1], [[1, 0]], goodOptions), /length/);
  rejects(() => T.denseLayer([1], [[2]], goodOptions), /canonical/);
  rejects(() => T.denseLayer([1], null, goodOptions), /Array/);
  rejects(() => T.denseLayer([1], [[1]], { ...goodOptions, backend: 'avx2' }), /backend/);
  rejects(() => T.denseLayer([1], [[1]]), /biases/);
  rejects(() => T.denseLayer([1], [[1]], { biases: [], thresholds: [0] }), /length/);
  rejects(() => T.denseLayer([1], [[1]], { biases: [0], thresholds: [] }), /length/);
  rejects(() => T.denseLayer([1], [[1]], { biases: [-0], thresholds: [0] }), /canonical/);
  rejects(() => T.denseLayer([1], [[1]], { biases: [0], thresholds: [-1] }), /thresholds/);
  rejects(() => T.denseLayer([], Array(T.LIMITS.maxRows + 1).fill([]), {}), /rows/);
  const tooManyTerms = Math.floor(T.LIMITS.maxLayerTerms / T.LIMITS.maxWidth) + 1;
  rejects(() => T.denseLayer(new Int8Array(T.LIMITS.maxWidth), Array(tooManyTerms).fill([]), {}), /resource cap/);

  const source = fs.readFileSync(subjectPath, 'utf8');
  const mutations = [
    ['dual_product_sign', 'popcount(positive) - popcount(negative)', 'popcount(positive) + popcount(negative)'],
    ['sign_product_coefficient', 'popcount(active) - 2 * popcount(opposite)', 'popcount(active) - popcount(opposite)'],
    ['packing_shift', '1 << (i % WORD_BITS)', '1 << ((i + 1) % WORD_BITS)'],
    ['tail_admission', 'if (wordCount &&', 'if (false && wordCount &&'],
    ['canonical_sign', 'if ((packed.negative[i] & ~packed.nonzero[i]) !== 0)', 'if (false)'],
    ['dual_overlap', 'if ((packed.positive[i] & packed.negative[i]) !== 0)', 'if (false)'],
    ['threshold_equality', 'return sum > threshold ? 1', 'return sum >= threshold ? 1'],
    ['scalar_bias', 'let sum = bias;', 'let sum = 0;'],
    ['layer_threshold', 'activate(sums[i], thresholds[i])', 'activate(sums[i], 0)'],
  ];
  const caughtMutations = [];
  for (const [name, before, after] of mutations) {
    const mutant = mutatedSubject(source, before, after);
    rejects(() => contract(mutant), Error);
    caughtMutations.push(name);
  }
  // Valid subject still passes the same checks after every isolated mutation.
  contract(T);
  equal(fs.readFileSync(subjectPath, 'utf8'), source);

  return {
    status: 'PASS', scope: 'bounded deterministic correctness; no performance or hardware qualification',
    countedAssertions: assertions, vectorPairs, exhaustiveMaxLength, exhaustivePairs,
    checkedWidths: widths, layerCases, caughtMutations,
    limits: T.LIMITS,
  };
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run, bigintOracle, contract };
