'use strict';

/*
 * NOT REGISTERED
 * Derived arithmetic and bounded implementation correctness, not empirical
 * predictions. This is a separate host-JavaScript reference/prototype: it does
 * not change the tryte ISA and does not establish speed, model quality, target
 * SIMD execution, training, power consumption, or fleet readiness.
 *
 * Feature lanes: each packed bit is one feature in a dot product, NOT one
 * completed neuron. All public operations validate inputs synchronously.
 * Caller arrays must not be concurrently modified; shared buffers are refused.
 * Functions never mutate caller inputs. Returned buffers belong to the caller
 * and are revalidated whenever consumed. Scalars use exact Number integers;
 * the caps below keep every accumulation inside the signed integer range.
 */

const WORD_BITS = Uint32Array.BYTES_PER_ELEMENT * 8;
const LIMITS = Object.freeze({
  maxWidth: 65536,
  maxRows: 256,
  maxLayerTerms: 1048576,
  maxAbsBias: 0x3fffffff,
  maxAbsSum: 0x7fffffff,
});

function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < min || value > max) {
    throw new RangeError(`${name} must be a canonical integer in [${min}, ${max}]`);
  }
  return value;
}

function width(value) {
  return integer(value, 'length', 0, LIMITS.maxWidth);
}

function noSharedBuffer(value, name) {
  if (typeof SharedArrayBuffer !== 'undefined' && value.buffer instanceof SharedArrayBuffer) {
    throw new TypeError(`${name} must not use a shared buffer`);
  }
}

function vector(values, name) {
  if (!Array.isArray(values) && !(values instanceof Int8Array)) {
    throw new TypeError(`${name} must be an Array or Int8Array`);
  }
  noSharedBuffer(values, name);
  width(values.length);
  for (let i = 0; i < values.length; i++) {
    if (Object.is(values[i], -0) || (values[i] !== -1 && values[i] !== 0 && values[i] !== 1)) {
      throw new RangeError(`${name}[${i}] must be a canonical ternary value`);
    }
  }
  return values;
}

function accumulationBounds(length, bias = 0) {
  width(length);
  integer(bias, 'bias', -LIMITS.maxAbsBias, LIMITS.maxAbsBias);
  return { min: bias - length, max: bias + length };
}

function scalarDot(a, b, bias = 0) {
  vector(a, 'a');
  vector(b, 'b');
  if (a.length !== b.length) throw new RangeError('dot length mismatch');
  accumulationBounds(a.length, bias);
  let sum = bias;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function activate(sum, threshold = 0) {
  integer(sum, 'sum', -LIMITS.maxAbsSum, LIMITS.maxAbsSum);
  integer(threshold, 'threshold', 0, LIMITS.maxAbsSum);
  // Inclusive dead zone: equality on either boundary yields canonical zero.
  return sum > threshold ? 1 : sum < -threshold ? -1 : 0;
}

function wordsFor(length) {
  return Math.ceil(length / WORD_BITS);
}

function tailMask(length) {
  const remainder = length % WORD_BITS;
  return remainder === 0 ? 0xffffffff : (2 ** remainder - 1) >>> 0;
}

function popcount(value) {
  let x = value >>> 0;
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return Math.imul(x, 0x01010101) >>> 24;
}

function packedHeader(packed, encoding, first, second) {
  if (!packed || typeof packed !== 'object' || packed.encoding !== encoding) {
    throw new TypeError(`expected ${encoding} packed record`);
  }
  width(packed.length);
  const wordCount = wordsFor(packed.length);
  for (const field of [first, second]) {
    const rail = packed[field];
    if (!(rail instanceof Uint32Array)) throw new TypeError(`${field} must be Uint32Array`);
    noSharedBuffer(rail, field);
    if (rail.length !== wordCount) throw new RangeError(`${field} word length mismatch`);
    if (wordCount && (rail[wordCount - 1] & ~tailMask(packed.length)) !== 0) {
      throw new RangeError(`${field} has nonzero unused tail bits`);
    }
  }
}

function validateDual(packed) {
  packedHeader(packed, 'dual-rail', 'positive', 'negative');
  for (let i = 0; i < packed.positive.length; i++) {
    if ((packed.positive[i] & packed.negative[i]) !== 0) {
      throw new RangeError('dual-rail overlap is an invalid ternary encoding');
    }
  }
  return packed;
}

function validateSign(packed) {
  packedHeader(packed, 'nonzero-sign', 'nonzero', 'negative');
  for (let i = 0; i < packed.nonzero.length; i++) {
    if ((packed.negative[i] & ~packed.nonzero[i]) !== 0) {
      throw new RangeError('nonzero-sign zero must have a canonical zero sign');
    }
  }
  return packed;
}

function packDual(values) {
  vector(values, 'values');
  const positive = new Uint32Array(wordsFor(values.length));
  const negative = new Uint32Array(positive.length);
  for (let i = 0; i < values.length; i++) {
    const word = Math.floor(i / WORD_BITS);
    const bit = 1 << (i % WORD_BITS);
    if (values[i] === 1) positive[word] |= bit;
    else if (values[i] === -1) negative[word] |= bit;
  }
  return { encoding: 'dual-rail', length: values.length, positive, negative };
}

function packSign(values) {
  vector(values, 'values');
  const nonzero = new Uint32Array(wordsFor(values.length));
  const negative = new Uint32Array(nonzero.length);
  for (let i = 0; i < values.length; i++) {
    const word = Math.floor(i / WORD_BITS);
    const bit = 1 << (i % WORD_BITS);
    if (values[i] !== 0) nonzero[word] |= bit;
    if (values[i] === -1) negative[word] |= bit;
  }
  return { encoding: 'nonzero-sign', length: values.length, nonzero, negative };
}

function unpackDual(packed) {
  validateDual(packed);
  const values = new Int8Array(packed.length);
  for (let i = 0; i < values.length; i++) {
    const word = Math.floor(i / WORD_BITS), bit = 1 << (i % WORD_BITS);
    values[i] = (packed.positive[word] & bit) ? 1 : (packed.negative[word] & bit) ? -1 : 0;
  }
  return values;
}

function unpackSign(packed) {
  validateSign(packed);
  const values = new Int8Array(packed.length);
  for (let i = 0; i < values.length; i++) {
    const word = Math.floor(i / WORD_BITS), bit = 1 << (i % WORD_BITS);
    values[i] = !(packed.nonzero[word] & bit) ? 0 : (packed.negative[word] & bit) ? -1 : 1;
  }
  return values;
}

function dotDual(a, b, bias = 0) {
  validateDual(a);
  validateDual(b);
  if (a.length !== b.length) throw new RangeError('dot length mismatch');
  accumulationBounds(a.length, bias);
  let sum = bias;
  for (let i = 0; i < a.positive.length; i++) {
    const positive = (a.positive[i] & b.positive[i]) | (a.negative[i] & b.negative[i]);
    const negative = (a.positive[i] & b.negative[i]) | (a.negative[i] & b.positive[i]);
    sum += popcount(positive) - popcount(negative);
  }
  return sum;
}

function dotSign(a, b, bias = 0) {
  validateSign(a);
  validateSign(b);
  if (a.length !== b.length) throw new RangeError('dot length mismatch');
  accumulationBounds(a.length, bias);
  let sum = bias;
  for (let i = 0; i < a.nonzero.length; i++) {
    const active = a.nonzero[i] & b.nonzero[i];
    const opposite = (a.negative[i] ^ b.negative[i]) & active;
    sum += popcount(active) - 2 * popcount(opposite);
  }
  return sum;
}

function integerVector(values, name, count, min, max) {
  if (!Array.isArray(values) && !(values instanceof Int32Array)) {
    throw new TypeError(`${name} must be an Array or Int32Array`);
  }
  noSharedBuffer(values, name);
  if (values.length !== count) throw new RangeError(`${name} length mismatch`);
  for (let i = 0; i < values.length; i++) integer(values[i], `${name}[${i}]`, min, max);
}

// A complete dense layer, including validation, input/weight packing when chosen,
// exact biased sums and ternary activation. Biases/thresholds are explicit per row.
function denseLayer(input, weights, { biases, thresholds, backend = 'scalar' } = {}) {
  vector(input, 'input');
  if (!Array.isArray(weights)) throw new TypeError('weights must be an Array of rows');
  integer(weights.length, 'rows', 0, LIMITS.maxRows);
  if (input.length * weights.length > LIMITS.maxLayerTerms) {
    throw new RangeError('layer terms exceed resource cap');
  }
  if (!['scalar', 'dual', 'sign'].includes(backend)) throw new TypeError('unknown layer backend');
  integerVector(biases, 'biases', weights.length, -LIMITS.maxAbsBias, LIMITS.maxAbsBias);
  integerVector(thresholds, 'thresholds', weights.length, 0, LIMITS.maxAbsSum);
  for (const row of weights) {
    vector(row, 'weight row');
    if (row.length !== input.length) throw new RangeError('weight row length mismatch');
  }
  const sums = new Int32Array(weights.length);
  const outputs = new Int8Array(weights.length);
  const packed = backend === 'dual' ? packDual(input) : backend === 'sign' ? packSign(input) : null;
  for (let i = 0; i < weights.length; i++) {
    sums[i] = backend === 'scalar' ? scalarDot(input, weights[i], biases[i])
      : backend === 'dual' ? dotDual(packed, packDual(weights[i]), biases[i])
      : dotSign(packed, packSign(weights[i]), biases[i]);
    outputs[i] = activate(sums[i], thresholds[i]);
  }
  return { sums, outputs };
}

module.exports = {
  LIMITS, WORD_BITS, accumulationBounds, scalarDot, activate,
  packDual, unpackDual, validateDual, dotDual,
  packSign, unpackSign, validateSign, dotSign, denseLayer,
};
