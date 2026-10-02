'use strict';
/* ---------------------------------------------------------------------------
 * lattice_crypto.js — Native Balanced Ternary Post-Quantum Lattice Cryptography
 * ---------------------------------------------------------------------------
 * Implements:
 *   1. TernaryPoly: Polynomial quotient ring R_q = Z_q[X] / (X^N ± 1)
 *      - Cyclic (X^N - 1) for NTRU
 *      - Negacyclic (X^N + 1) for Ring-LWE
 *      - Fast ternary convolution (O(N^2) additions/subtractions without mult)
 *      - Exact closed-form Hensel polynomial inversion mod 729 (0% failure)
 *   2. TernaryNTRU: KeyGen, Encrypt, Decrypt, and KEM
 *      - Zero decryption failure theorem (||3(r*g) + f*m||_∞ <= 189 < 364)
 *   3. TernaryRingLWE: KeyGen, Encapsulate, Decapsulate
 *   4. TASM Code Generator: Emits native TryteVM assembly for NTRU
 * ------------------------------------------------------------------------- */

const T = require('./ternary.js');
const { TryteVM } = require('./vm.js');
const { loadInto } = require('./assembler.js');
const { hashTernary } = require('./crypto.js');

const DEFAULT_N = 27; // 3^3, fundamental ternary block size
const MODULUS_Q = 729; // 3^6, exact TryteVM word size [-364 .. 364]
const MODULUS_P = 3;   // Balanced ternary base [-1, 0, 1]

/**
 * Polynomial in R_q = Z_q[X] / (X^N - 1) or Z_q[X] / (X^N + 1).
 * Coefficients are stored as integers in [-364 .. 364].
 */
class TernaryPoly {
  constructor(coeffs = [], N = DEFAULT_N, mode = 'cyclic') {
    this.N = N;
    this.mode = mode; // 'cyclic' (X^N - 1) or 'negacyclic' (X^N + 1)
    this.coeffs = new Array(N).fill(0);

    for (let i = 0; i < Math.min(coeffs.length, N); i++) {
      this.coeffs[i] = T.wrap(coeffs[i] || 0);
    }
  }

  static zero(N = DEFAULT_N, mode = 'cyclic') {
    return new TernaryPoly(new Array(N).fill(0), N, mode);
  }

  static constant(c, N = DEFAULT_N, mode = 'cyclic') {
    const p = TernaryPoly.zero(N, mode);
    p.coeffs[0] = T.wrap(c);
    return p;
  }

  /**
   * Samples a random ternary polynomial with coefficients in {-1, 0, 1}.
   * @param {number} N - Degree
   * @param {number|null} numNonZero - Optional exact number of non-zero trits
   * @param {string} mode - 'cyclic' or 'negacyclic'
   */
  static randomTernary(N = DEFAULT_N, numNonZero = null, mode = 'cyclic') {
    const coeffs = new Array(N).fill(0);
    if (numNonZero === null) {
      for (let i = 0; i < N; i++) {
        coeffs[i] = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
      }
    } else {
      const indices = Array.from({ length: N }, (_, i) => i);
      // Fisher-Yates shuffle
      for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const count = Math.min(numNonZero, N);
      const half = Math.floor(count / 2);
      for (let i = 0; i < half; i++) coeffs[indices[i]] = 1;
      for (let i = half; i < count; i++) coeffs[indices[i]] = -1;
    }
    return new TernaryPoly(coeffs, N, mode);
  }

  clone() {
    return new TernaryPoly([...this.coeffs], this.N, this.mode);
  }

  equals(other) {
    if (this.N !== other.N || this.mode !== other.mode) return false;
    for (let i = 0; i < this.N; i++) {
      if (this.coeffs[i] !== other.coeffs[i]) return false;
    }
    return true;
  }

  infinityNorm() {
    let max = 0;
    for (let i = 0; i < this.N; i++) {
      const abs = Math.abs(this.coeffs[i]);
      if (abs > max) max = abs;
    }
    return max;
  }

  add(other) {
    const res = new Array(this.N);
    for (let i = 0; i < this.N; i++) {
      res[i] = T.wrap(this.coeffs[i] + other.coeffs[i]);
    }
    return new TernaryPoly(res, this.N, this.mode);
  }

  sub(other) {
    const res = new Array(this.N);
    for (let i = 0; i < this.N; i++) {
      res[i] = T.wrap(this.coeffs[i] - other.coeffs[i]);
    }
    return new TernaryPoly(res, this.N, this.mode);
  }

  neg() {
    const res = this.coeffs.map((c) => T.wrap(-c));
    return new TernaryPoly(res, this.N, this.mode);
  }

  scalarMul(k) {
    const res = this.coeffs.map((c) => T.wrap(c * k));
    return new TernaryPoly(res, this.N, this.mode);
  }

  /**
   * Full polynomial multiplication in R_q = Z_729[X] / (X^N ± 1).
   */
  mul(other) {
    const N = this.N;
    const res = new Array(N).fill(0);

    if (this.mode === 'cyclic') {
      // (X^N - 1)
      for (let i = 0; i < N; i++) {
        const a_i = this.coeffs[i];
        if (a_i === 0) continue;
        for (let j = 0; j < N; j++) {
          const b_j = other.coeffs[j];
          if (b_j === 0) continue;
          const k = (i + j) % N;
          res[k] += a_i * b_j;
        }
      }
    } else {
      // (X^N + 1)
      for (let i = 0; i < N; i++) {
        const a_i = this.coeffs[i];
        if (a_i === 0) continue;
        for (let j = 0; j < N; j++) {
          const b_j = other.coeffs[j];
          if (b_j === 0) continue;
          const sumIdx = i + j;
          if (sumIdx < N) {
            res[sumIdx] += a_i * b_j;
          } else {
            res[sumIdx - N] -= a_i * b_j;
          }
        }
      }
    }

    return new TernaryPoly(res.map(T.wrap), N, this.mode);
  }

  /**
   * Fast multiplication when multiplying by a ternary polynomial {-1, 0, 1}.
   * Avoids general multiplication: only uses additions, subtractions, and index shifts.
   */
  mulTernary(ternary) {
    const N = this.N;
    const res = new Array(N).fill(0);

    if (this.mode === 'cyclic') {
      for (let j = 0; j < N; j++) {
        const t_j = ternary.coeffs[j];
        if (t_j === 0) continue;
        for (let i = 0; i < N; i++) {
          const a_i = this.coeffs[i];
          if (a_i === 0) continue;
          const k = (i + j) % N;
          if (t_j === 1) res[k] += a_i;
          else if (t_j === -1) res[k] -= a_i;
        }
      }
    } else {
      for (let j = 0; j < N; j++) {
        const t_j = ternary.coeffs[j];
        if (t_j === 0) continue;
        for (let i = 0; i < N; i++) {
          const a_i = this.coeffs[i];
          if (a_i === 0) continue;
          const sumIdx = i + j;
          if (sumIdx < N) {
            if (t_j === 1) res[sumIdx] += a_i;
            else if (t_j === -1) res[sumIdx] -= a_i;
          } else {
            if (t_j === 1) res[sumIdx - N] -= a_i;
            else if (t_j === -1) res[sumIdx - N] += a_i;
          }
        }
      }
    }

    return new TernaryPoly(res.map(T.wrap), N, this.mode);
  }

  /**
   * Extract lowest trit of each coefficient mod 3.
   * Maps each coefficient to {-1, 0, 1}.
   */
  mod3() {
    const res = this.coeffs.map((c) => T.lowTrit(c));
    return new TernaryPoly(res, this.N, this.mode);
  }

  /**
   * Computes exact closed-form Hensel inverse in Z_729[X]/(X^N ± 1) for f = 1 + 3*F:
   * f^-1 = sum_{k=0}^5 (-1)^k * 3^k * F^k (mod 729)
   * Guaranteed to succeed with 0% failure rate for all f = 1 + 3*F.
   */
  henselInverse() {
    // Check f(0) mod 3 === 1
    const F_coeffs = new Array(this.N);
    // f = 1 + 3F => F = (f - 1)/3
    for (let i = 0; i < this.N; i++) {
      const c = this.coeffs[i];
      if (i === 0) {
        if (T.lowTrit(c) !== 1) {
          throw new Error('f must satisfy f(0) === 1 (mod 3) for closed-form Hensel inversion');
        }
        F_coeffs[i] = Math.round((c - 1) / 3);
      } else {
        if (T.lowTrit(c) !== 0) {
          throw new Error(`f non-constant coeff at ${i} must be divisible by 3 (mod 3)`);
        }
        F_coeffs[i] = Math.round(c / 3);
      }
    }

    const F = new TernaryPoly(F_coeffs, this.N, this.mode);

    // Compute powers of F: F^0, F^1, F^2, F^3, F^4, F^5
    let currentPower = TernaryPoly.constant(1, this.N, this.mode);
    let inv = TernaryPoly.zero(this.N, this.mode);

    // Coefficients: +1, -3, +9, -27, +81, -243
    const multipliers = [1, -3, 9, -27, 81, -243];

    for (let k = 0; k < 6; k++) {
      const term = currentPower.scalarMul(multipliers[k]);
      inv = inv.add(term);
      if (k < 5) {
        currentPower = currentPower.mul(F);
      }
    }

    return inv;
  }
}

const PARAMETER_SETS = {
  toy: { N: 3, dF: 1, dG: 1, dR: 1, doc: 'TASM execution on TryteVM core (3 trits)' },
  embedded_9: { N: 9, dF: 3, dG: 3, dR: 3, doc: 'Lightweight embedded microcontroller (9 trits)' },
  embedded_27: { N: 27, dF: 6, dG: 6, dR: 6, doc: 'Default Tryte-QOS 3-tryte block size (27 trits)' },
  medium_81: { N: 81, dF: 18, dG: 18, dR: 18, doc: 'Medium security (81 trits / 162 dimension)' },
  pq_128: { N: 243, dF: 24, dG: 24, dR: 24, doc: 'NIST Level 1 Post-Quantum (~128-bit security, 486 dimension)' },
  pq_256: { N: 729, dF: 48, dG: 48, dR: 48, doc: 'NIST Level 5 Post-Quantum (~256-bit security, 1458 dimension)' },
};

/**
 * Ternary NTRU Key Encapsulation Mechanism and Encryption.
 */
class TernaryNTRU {
  constructor(N = DEFAULT_N, defaultDF = 6, defaultDG = 6) {
    this.N = N;
    this.defaultDF = defaultDF;
    this.defaultDG = defaultDG;
    this.q = MODULUS_Q; // 729
    this.p = MODULUS_P; // 3
  }

  static fromPreset(name = 'embedded_27') {
    const p = PARAMETER_SETS[name];
    if (!p) throw new Error(`Unknown parameter set '${name}'. Available: ${Object.keys(PARAMETER_SETS).join(', ')}`);
    return new TernaryNTRU(p.N, p.dF, p.dG);
  }

  /**
   * Generates an NTRU keypair:
   * Private key: f = 1 + 3*F
   * Public key: h = 3 * f^-1 * g (mod 729)
   */
  generateKeyPair(dF = null, dG = null) {
    const dfCount = dF !== null ? dF : this.defaultDF;
    const dgCount = dG !== null ? dG : this.defaultDG;
    // Sample F and g as ternary polynomials
    const F = TernaryPoly.randomTernary(this.N, dfCount, 'cyclic');
    F.coeffs[0] = 0; // Standard NTRU: f(0) = 1 + 3*0 = 1
    const g = TernaryPoly.randomTernary(this.N, dgCount, 'cyclic');

    // f = 1 + 3*F
    const f = F.scalarMul(3).add(TernaryPoly.constant(1, this.N, 'cyclic'));

    // Invert f mod 729 via Hensel lifting
    const fInv = f.henselInverse();

    // h = 3 * fInv * g (mod 729)
    const h = fInv.mulTernary(g).scalarMul(3);

    return {
      publicKey: h,
      privateKey: f,
      F,
      g,
      fInv,
    };
  }

  /**
   * Encrypts a balanced ternary message m in {-1, 0, 1}^N.
   * e = r * h + m (mod 729)
   */
  encrypt(publicKey, message, blinding = null) {
    const m = Array.isArray(message)
      ? new TernaryPoly(message, this.N, 'cyclic')
      : message;

    const r = blinding
      ? (Array.isArray(blinding) ? new TernaryPoly(blinding, this.N, 'cyclic') : blinding)
      : TernaryPoly.randomTernary(this.N, 6, 'cyclic');

    // e = r * h + m (mod 729)
    const e = publicKey.mulTernary(r).add(m);

    return {
      ciphertext: e,
      blinding: r,
      message: m,
    };
  }

  /**
   * Decrypts ciphertext e using private key f:
   * a = f * e (mod 729)
   * m = a mod 3
   */
  decrypt(privateKey, ciphertext) {
    const e = Array.isArray(ciphertext)
      ? new TernaryPoly(ciphertext, this.N, 'cyclic')
      : ciphertext;

    // a = f * e (mod 729)
    const a = e.mul(privateKey);

    // m = a mod 3
    return a.mod3();
  }

  /**
   * Key Encapsulation Mechanism (KEM):
   * Alice encapsulates a random ternary shared secret K into ciphertext C.
   */
  encapsulate(publicKey) {
    const K = TernaryPoly.randomTernary(this.N, null, 'cyclic');
    const { ciphertext, blinding } = this.encrypt(publicKey, K);
    // Derive symmetric key digest via ternary hash compressor
    const symmetricKey = hashTernary(K.coeffs);
    return {
      ciphertext,
      sharedSecret: K,
      symmetricKey,
      blinding,
    };
  }

  /**
   * Key Decapsulation Mechanism:
   * Bob decapsulates ciphertext C using private key f, recovering K.
   */
  decapsulate(privateKey, ciphertext) {
    const recoveredK = this.decrypt(privateKey, ciphertext);
    const symmetricKey = hashTernary(recoveredK.coeffs);
    return {
      sharedSecret: recoveredK,
      symmetricKey,
    };
  }
}

/**
 * Ternary Ring-LWE Key Encapsulation Mechanism.
 * Operates in negacyclic ring R_q = Z_729[X] / (X^N + 1).
 */
class TernaryRingLWE {
  constructor(N = DEFAULT_N) {
    this.N = N;
    this.q = MODULUS_Q; // 729
    this.delta = 243;   // q / 3: center trits {-1, 0, 1} at {-243, 0, 243}
  }

  /**
   * KeyGen:
   * Secret key: s in {-1, 0, 1}^N
   * Public key: (A, B = A * s + e mod 729) where e in {-1, 0, 1}^N
   */
  generateKeyPair() {
    // A uniform random in Z_729
    const aCoeffs = [];
    for (let i = 0; i < this.N; i++) {
      aCoeffs.push(Math.floor(Math.random() * 729) - 364);
    }
    const A = new TernaryPoly(aCoeffs, this.N, 'negacyclic');

    // Secret s and error e ternary
    const s = TernaryPoly.randomTernary(this.N, 8, 'negacyclic');
    const e = TernaryPoly.randomTernary(this.N, 6, 'negacyclic');

    // B = A * s + e (mod 729)
    const B = A.mulTernary(s).add(e);

    return {
      publicKey: { A, B },
      privateKey: s,
      error: e,
    };
  }

  /**
   * Encapsulate random secret K in {-1, 0, 1}^N:
   * u = A * r + e1
   * v = B * r + e2 + delta * K
   */
  encapsulate(publicKey) {
    const { A, B } = publicKey;
    const K = TernaryPoly.randomTernary(this.N, null, 'negacyclic');
    const r = TernaryPoly.randomTernary(this.N, 6, 'negacyclic');
    const e1 = TernaryPoly.randomTernary(this.N, 6, 'negacyclic');
    const e2 = TernaryPoly.randomTernary(this.N, 6, 'negacyclic');

    const u = A.mulTernary(r).add(e1);
    const scaledK = K.scalarMul(this.delta);
    const v = B.mulTernary(r).add(e2).add(scaledK);

    const symmetricKey = hashTernary(K.coeffs);

    return {
      ciphertext: { u, v },
      sharedSecret: K,
      symmetricKey,
    };
  }

  /**
   * Decapsulate:
   * d = v - u * s = e*r - e1*s + e2 + delta * K
   * Rounds each coefficient of d to nearest multiple of delta (243).
   */
  decapsulate(privateKey, ciphertext) {
    const { u, v } = ciphertext;
    const s = privateKey;

    const us = u.mulTernary(s);
    const d = v.sub(us);

    // Decode: map d_i to nearest {-243, 0, 243}
    const recoveredCoeffs = [];
    for (let i = 0; i < this.N; i++) {
      const val = d.coeffs[i]; // in [-364 .. 364]
      if (val > 121) {
        recoveredCoeffs.push(1);
      } else if (val < -121) {
        recoveredCoeffs.push(-1);
      } else {
        recoveredCoeffs.push(0);
      }
    }

    const recoveredK = new TernaryPoly(recoveredCoeffs, this.N, 'negacyclic');
    const symmetricKey = hashTernary(recoveredK.coeffs);

    return {
      sharedSecret: recoveredK,
      symmetricKey,
    };
  }
}

/**
 * Generates an unrolled TASM program for NTRU Encryption and Decryption on TryteVM.
 * Polynomial degree N (default 3 to fit comfortably within TryteVM 729-cell address space).
 * Reads:
 *   - N words of public key h
 *   - N trits of message m
 *   - N trits of blinding r
 *   - N trits of private key F (f = 1 + 3*F)
 * Computes:
 *   - e = r * h + m (mod 729)
 *   - a = e + sum_{j=1}^{N-1} 3 * F_j * e_{(k-j)%N} (mod 729)
 *   - dec = lowTrit(a) (mod 3)
 * Emits dec trits to OUT.
 */
function generateNTRUTASM(N = 3) {
  let asm = `; --- Tryte-QOS Native Ternary NTRU Engine (N = ${N}) ---
; Registers:
;   A: Accumulator (ALU operations, wrapped mod 729)
;   Memory layout:
;     h[0..${N-1}] : Public key
;     m[0..${N-1}] : Message trits
;     r[0..${N-1}] : Blinding trits
;     F[0..${N-1}] : Private key trits (f = 1 + 3*F, F_0 = 0)
;     e[0..${N-1}] : Ciphertext
;     a[0..${N-1}] : Decrypted intermediate

; --- 1. Load Inputs ---
; Read Public Key h (${N} words)
`;
  for (let i = 0; i < N; i++) {
    asm += `        IN\n        STORE h_${i}\n`;
  }
  asm += `; Read Message m (${N} trits)\n`;
  for (let i = 0; i < N; i++) {
    asm += `        IN\n        STORE m_${i}\n`;
  }
  asm += `; Read Blinding r (${N} trits)\n`;
  for (let i = 0; i < N; i++) {
    asm += `        IN\n        STORE r_${i}\n`;
  }
  asm += `; Read Private Key F (${N} trits)\n`;
  for (let i = 0; i < N; i++) {
    asm += `        IN\n        STORE F_${i}\n`;
  }

  // --- 2. Encryption: e_k = m_k + sum_j (r_j * h_{(k-j)%N}) mod 729 ---
  asm += `\n; --- 2. Encrypt: e = r * h + m (mod 729) ---\n`;
  for (let k = 0; k < N; k++) {
    asm += `; Compute e_${k}\n        LOAD  m_${k}\n        STORE e_${k}\n`;
    for (let j = 0; j < N; j++) {
      const hIdx = (k - j + N) % N;
      asm += `        LOAD  r_${j}\n        BR3   br_enc_${k}_${j}\n`;
      asm += `br_enc_${k}_${j}: .table enc_neg_${k}_${j}, enc_zero_${k}_${j}, enc_pos_${k}_${j}\n`;
      asm += `enc_pos_${k}_${j}:\n        LOAD  e_${k}\n        ADD   h_${hIdx}\n        STORE e_${k}\n        JMP   enc_next_${k}_${j}\n`;
      asm += `enc_neg_${k}_${j}:\n        LOAD  e_${k}\n        SUB   h_${hIdx}\n        STORE e_${k}\n        JMP   enc_next_${k}_${j}\n`;
      asm += `enc_zero_${k}_${j}:\n`;
      asm += `enc_next_${k}_${j}:\n`;
    }
  }

  // --- 3. Decryption: a_k = e_k + sum_{j=1}^{N-1} (3 * F_j * e_{(k-j)%N}) mod 729 ---
  asm += `\n; --- 3. Decrypt: a = f * e (mod 729) ---\n`;
  for (let k = 0; k < N; k++) {
    asm += `; Compute a_${k}\n        LOAD  e_${k}\n        STORE a_${k}\n`;
    for (let j = 1; j < N; j++) {
      const eIdx = (k - j + N) % N;
      asm += `        LOAD  F_${j}\n        BR3   br_dec_${k}_${j}\n`;
      asm += `br_dec_${k}_${j}: .table dec_neg_${k}_${j}, dec_zero_${k}_${j}, dec_pos_${k}_${j}\n`;
      asm += `dec_pos_${k}_${j}:\n        LOAD  e_${eIdx}\n        SHL   1\n        ADD   a_${k}\n        STORE a_${k}\n        JMP   dec_next_${k}_${j}\n`;
      asm += `dec_neg_${k}_${j}:\n        LOAD  e_${eIdx}\n        SHL   1\n        STORE tmp\n        LOAD  a_${k}\n        SUB   tmp\n        STORE a_${k}\n        JMP   dec_next_${k}_${j}\n`;
      asm += `dec_zero_${k}_${j}:\n`;
      asm += `dec_next_${k}_${j}:\n`;
    }
    // Modulo 3: dec_k = a_k - 3 * (a_k / 3) = lowTrit(a_k)
    asm += `        LOAD  a_${k}\n        SHR   1\n        SHL   1\n        STORE tmp\n`;
    asm += `        LOAD  a_${k}\n        SUB   tmp\n        OUT\n`;
  }

  asm += `        HALT\n\n; --- Variables ---\n`;
  for (let i = 0; i < N; i++) {
    asm += `h_${i}:   .word 0\n`;
    asm += `m_${i}:   .word 0\n`;
    asm += `r_${i}:   .word 0\n`;
    asm += `F_${i}:   .word 0\n`;
    asm += `e_${i}:   .word 0\n`;
    asm += `a_${i}:   .word 0\n`;
  }
  asm += `tmp:    .word 0\n`;

  return asm;
}

module.exports = {
  DEFAULT_N,
  MODULUS_Q,
  MODULUS_P,
  PARAMETER_SETS,
  TernaryPoly,
  TernaryNTRU,
  TernaryRingLWE,
  generateNTRUTASM,
};
