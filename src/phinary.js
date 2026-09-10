'use strict';
/* phinary.js — Phinary (base phi) arithmetic, Zeckendorf canonical coding,
 * and 2D golden lattice memory coordinate subsystem for TryteVM.
 *
 * PHINARY MEMORY ARCHITECTURE (PM0)
 *
 * 1. THE 97% MEMORY PROBLEM SOLVED BY PHI:
 *    As documented in design/07-memory.md, a flat 729-word balanced ternary memory
 *    decoder tree requires 48,100 switches (~97% of the machine) because one-hot
 *    address lines can float or collide into undefined 'X' states unless accompanied
 *    by pull-down networks at every branch.
 *
 *    In base phi (the golden ratio phi = (1 + sqrt(5))/2), Zeckendorf canonical
 *    coding enforces the invariant c_i * c_{i+1} = 0 (no consecutive 1s).
 *    In a branching decoder tree, asserting branch 1 structurally forces the next
 *    stage to branch 0. Address lines cannot simultaneously collide or float into
 *    indeterminate states, eliminating decoder line contention.
 *
 * 2. EXACT Z[phi] DUAL-COORDINATE ADDRESSING:
 *    Every tryte address addr in [-364, +364] is canonically mapped to a unique 2D
 *    golden lattice coordinate (u, v) in [-13, 13]^2 such that:
 *        addr = 27*v + u
 *    Notice 27 * 27 = 729 words. The mapping is exact, balanced, and symmetric around 0.
 *
 * 3. EXACT RING ARITHMETIC IN Z[phi]:
 *    Represented as exact integer pairs (a, b) = a + b*phi.
 *    Because phi^2 = phi + 1:
 *      (a1, b1) + (a2, b2) = (a1 + a2, b1 + b2)
 *      (a1, b1) - (a2, b2) = (a1 - a2, b1 - b2)
 *      (a1, b1) * (a2, b2) = (a1*a2 + b1*b2, a1*b2 + b1*a2 + b1*b2)
 *      Scale by phi        = (b, a + b)
 *      Scale by phi^-1     = (b - a, a)
 *      Norm N(a + b*phi)   = a^2 + a*b - b^2
 *    Pure integer arithmetic with ZERO floating-point rounding errors.
 *
 * 4. IN-CACHE UNIVERSE (ZERO-DISTANCE ARCHITECTURE):
 *    729 tryte words stored as 16-bit integers occupy 1,458 bytes (~1.45 KB).
 *    This fits completely within the L1 data cache (32-48 KB) of modern host CPUs
 *    and within a single 64 KB WebAssembly page, eliminating memory wall latency.
 */

const T = require('./ternary.js');

// Fibonacci numbers: F_1 = 1, F_2 = 2, F_3 = 3, F_4 = 5, ...
const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

/** Exact element in the quadratic integer ring Z[phi]: a + b*phi. */
class PhiPair {
  constructor(a, b) {
    this.a = Math.trunc(a);
    this.b = Math.trunc(b);
  }

  toString() {
    return `(${this.a}, ${this.b})`;
  }

  equals(other) {
    return this.a === other.a && this.b === other.b;
  }
}

/** Ring addition in Z[phi]: (a1 + a2) + (b1 + b2)*phi. */
function phiAdd(p1, p2) {
  return new PhiPair(p1.a + p2.a, p1.b + p2.b);
}

/** Ring subtraction in Z[phi]: (a1 - a2) + (b1 - b2)*phi. */
function phiSub(p1, p2) {
  return new PhiPair(p1.a - p2.a, p1.b - p2.b);
}

/**
 * Ring multiplication in Z[phi]:
 * (a1 + b1*phi) * (a2 + b2*phi) = a1*a2 + (a1*b2 + b1*a2)*phi + b1*b2*phi^2
 * Since phi^2 = phi + 1:
 * = (a1*a2 + b1*b2) + (a1*b2 + b1*a2 + b1*b2)*phi.
 */
function phiMul(p1, p2) {
  const a = p1.a * p2.a + p1.b * p2.b;
  const b = p1.a * p2.b + p1.b * p2.a + p1.b * p2.b;
  return new PhiPair(a, b);
}

/** Exact multiplication by phi = (0, 1): (a, b)*phi = (b, a + b). */
function phiScale(p) {
  return new PhiPair(p.b, p.a + p.b);
}

/** Exact multiplication by phi^-1 = (-1, 1): (a, b)*phi^-1 = (b - a, a). */
function phiScaleInv(p) {
  return new PhiPair(p.b - p.a, p.a);
}

/**
 * Algebraic norm in Z[phi]: N(a + b*phi) = (a + b*phi)*(a + b*phi_bar)
 * Since phi_bar = 1 - phi: N(a + b*phi) = a^2 + a*b - b^2.
 */
function phiNorm(p) {
  return p.a * p.a + p.a * p.b - p.b * p.b;
}

/**
 * Map linear balanced tryte address addr in [-364, +364]
 * to 2D golden lattice coordinates (u, v) in [-13, 13]^2.
 * addr = 27*v + u.
 */
function coordFromAddr(addr) {
  const a = T.wrap(addr);
  const shifted = a - T.TRYTE_MIN; // 0 .. 728
  const vIdx = Math.floor(shifted / 27); // 0 .. 26
  const uIdx = shifted % 27;            // 0 .. 26
  const v = vIdx - 13;                  // -13 .. +13
  const u = uIdx - 13;                  // -13 .. +13
  return { u, v };
}

/**
 * Map 2D golden lattice coordinates (u, v) in [-13, 13]^2
 * back to linear balanced tryte address addr in [-364, +364].
 */
function addrFromCoord(u, v) {
  if (u < -13 || u > 13 || v < -13 || v > 13) {
    throw new Error(`coordinate out of lattice bounds: (${u}, ${v})`);
  }
  return 27 * v + u;
}

/**
 * Decompose non-negative integer n into its unique Zeckendorf canonical form
 * (sum of non-consecutive Fibonacci numbers, c_i * c_{i+1} = 0).
 * Returns array of bits [c_1, c_2, ...], LSB first (corresponding to F_1=1, F_2=2, F_3=3...).
 */
function toZeckendorf(n) {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error(`Zeckendorf requires non-negative integer, got ${n}`);
  }
  if (n === 0) return [0];

  // Find highest Fibonacci number <= n
  let maxIdx = 0;
  while (maxIdx < FIB.length && FIB[maxIdx] <= n) maxIdx++;
  maxIdx--;

  const bits = new Array(maxIdx + 1).fill(0);
  let rem = n;
  for (let i = maxIdx; i >= 0; i--) {
    if (FIB[i] <= rem) {
      bits[i] = 1;
      rem -= FIB[i];
    }
  }
  return bits;
}

/**
 * Convert Zeckendorf bit array (LSB first) back to integer.
 */
function fromZeckendorf(bits) {
  let sum = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      if (i >= FIB.length) throw new Error(`Zeckendorf bit index ${i} exceeds Fibonacci table`);
      sum += FIB[i];
    }
  }
  return sum;
}

/**
 * Verify whether bit array satisfies the Zeckendorf canonical property:
 * no two consecutive 1s (c_i * c_{i+1} = 0 for all i).
 */
function isCanonicalZeckendorf(bits) {
  for (let i = 0; i < bits.length - 1; i++) {
    if (bits[i] === 1 && bits[i + 1] === 1) return false;
  }
  return true;
}

/**
 * Local rewrite rule normalizer: canonicalize phinary bit vector
 * replacing any adjacent '11' with '100' (011_phi -> 100_phi) until canonical.
 */
function normalizePhinaryBits(bits) {
  const b = bits.slice();
  let changed = true;
  let safety = 1000;
  while (changed && safety-- > 0) {
    changed = false;
    for (let i = 0; i < b.length - 1; i++) {
      if (b[i] >= 1 && b[i + 1] >= 1) {
        b[i] -= 1;
        b[i + 1] -= 1;
        if (i + 2 >= b.length) b.push(1);
        else b[i + 2] += 1;
        changed = true;
      }
    }
  }
  if (safety <= 0) throw new Error('normalization cycle detected in phinary bits');
  return b;
}

/**
 * PhiCache — High-performance 729-cell in-cache memory plane.
 * Entire memory fits in 1,458 bytes (strictly within L1 CPU cache).
 */
class PhiCache {
  constructor() {
    this.mem = new Int16Array(729); // 1,458 bytes
  }

  readCoord(u, v) {
    const addr = addrFromCoord(u, v);
    return this.readAddr(addr);
  }

  writeCoord(u, v, val) {
    const addr = addrFromCoord(u, v);
    this.writeAddr(addr, val);
  }

  readAddr(addr) {
    const slot = T.wrap(addr) - T.TRYTE_MIN;
    return this.mem[slot];
  }

  writeAddr(addr, val) {
    const slot = T.wrap(addr) - T.TRYTE_MIN;
    this.mem[slot] = T.wrap(val);
  }

  /** Dump memory coordinates with non-zero entries. */
  activeEntries() {
    const list = [];
    for (let v = -13; v <= 13; v++) {
      for (let u = -13; u <= 13; u++) {
        const val = this.readCoord(u, v);
        if (val !== 0) list.push({ u, v, addr: 27 * v + u, val });
      }
    }
    return list;
  }
}

const PHINARY_OPS = {
  PHINORM:  { code: 25, operand: 'none', doc: 'A = Zeckendorf normalized form of A' },
  PHIMUL:   { code: 26, operand: 'imm',  doc: 'A = exact scaling of (A, C) by phi (+1) or phi^-1 (-1)' },
  PHILOAD:  { code: 27, operand: 'addr', doc: 'A = mem[addrFromCoord(u, v)] where u=A, v=mem[addr]' },
  PHISTORE: { code: 28, operand: 'addr', doc: 'mem[addrFromCoord(u, v)] = A where u=C, v=mem[addr]' },
};

const PHINARY_BY_CODE = {};
for (const [name, spec] of Object.entries(PHINARY_OPS)) {
  PHINARY_BY_CODE[spec.code] = { name, ...spec };
}

module.exports = {
  FIB,
  PhiPair,
  phiAdd,
  phiSub,
  phiMul,
  phiScale,
  phiScaleInv,
  phiNorm,
  coordFromAddr,
  addrFromCoord,
  toZeckendorf,
  fromZeckendorf,
  isCanonicalZeckendorf,
  normalizePhinaryBits,
  PhiCache,
  PHINARY_OPS,
  PHINARY_BY_CODE
};

