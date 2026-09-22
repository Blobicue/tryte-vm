'use strict';
/* ---------------------------------------------------------------------------
 * fibonacci.js — Core Topological Physics & Complex Matrix Engine
 *
 * Implements the exact mathematics of Fibonacci Anyons:
 *   - Golden ratio: φ = (1 + √5) / 2
 *   - Fusion rule:  τ ⊗ τ = 1 ⊕ τ   (quantum dimension d_τ = φ)
 *   - Change-of-basis F-matrix:   F = [ [1/φ, 1/√φ], [1/√φ, -1/φ] ]
 *   - Topological twist R-matrix: R = diag( e^(-i 4π/5), e^(i 3π/5) )
 *   - Braid generators: σ₁ = R,  σ₂ = F R F
 *   - SU(2) projection and gauge-invariant trace distance
 *   - Unit quaternion mapping on S³ / Z₂
 * ------------------------------------------------------------------------- */

const PHI = (1 + Math.sqrt(5)) / 2; // Golden Ratio φ ≈ 1.618033988749895
const SQRT_PHI = Math.sqrt(PHI);
const INV_PHI = 1 / PHI;
const INV_SQRT_PHI = 1 / SQRT_PHI;

/** A complex number z = re + i * im. */
class Complex {
  constructor(re = 0, im = 0) {
    this.re = re;
    this.im = im;
  }

  static fromPolar(r, theta) {
    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }

  static zero() { return new Complex(0, 0); }
  static one() { return new Complex(1, 0); }
  static i() { return new Complex(0, 1); }

  clone() { return new Complex(this.re, this.im); }

  add(b) {
    return typeof b === 'number'
      ? new Complex(this.re + b, this.im)
      : new Complex(this.re + b.re, this.im + b.im);
  }

  sub(b) {
    return typeof b === 'number'
      ? new Complex(this.re - b, this.im)
      : new Complex(this.re - b.re, this.im - b.im);
  }

  mul(b) {
    if (typeof b === 'number') return new Complex(this.re * b, this.im * b);
    return new Complex(
      this.re * b.re - this.im * b.im,
      this.re * b.im + this.im * b.re
    );
  }

  div(b) {
    if (typeof b === 'number') return new Complex(this.re / b, this.im / b);
    const denom = b.re * b.re + b.im * b.im;
    if (denom === 0) throw new Error('Complex division by zero');
    return new Complex(
      (this.re * b.re + this.im * b.im) / denom,
      (this.im * b.re - this.re * b.im) / denom
    );
  }

  conj() { return new Complex(this.re, -this.im); }
  absSq() { return this.re * this.re + this.im * this.im; }
  abs() { return Math.hypot(this.re, this.im); }
  phase() { return Math.atan2(this.im, this.re); }

  exp() {
    const r = Math.exp(this.re);
    return new Complex(r * Math.cos(this.im), r * Math.sin(this.im));
  }

  sqrt() {
    const r = Math.sqrt(this.abs());
    const theta = this.phase() / 2;
    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }

  equals(b, eps = 1e-10) {
    const diff = this.sub(b);
    return diff.abs() <= eps;
  }

  toString(digits = 4) {
    const r = this.re.toFixed(digits);
    const s = this.im >= 0 ? '+' : '-';
    const i = Math.abs(this.im).toFixed(digits);
    return `${r}${s}${i}i`;
  }
}

/** A 2x2 complex matrix. */
class Mat2 {
  constructor(m00, m01, m10, m11) {
    this.m00 = m00 instanceof Complex ? m00 : new Complex(m00, 0);
    this.m01 = m01 instanceof Complex ? m01 : new Complex(m01, 0);
    this.m10 = m10 instanceof Complex ? m10 : new Complex(m10, 0);
    this.m11 = m11 instanceof Complex ? m11 : new Complex(m11, 0);
  }

  static identity() {
    return new Mat2(Complex.one(), Complex.zero(), Complex.zero(), Complex.one());
  }

  static zero() {
    return new Mat2(Complex.zero(), Complex.zero(), Complex.zero(), Complex.zero());
  }

  clone() {
    return new Mat2(this.m00.clone(), this.m01.clone(), this.m10.clone(), this.m11.clone());
  }

  add(b) {
    return new Mat2(
      this.m00.add(b.m00), this.m01.add(b.m01),
      this.m10.add(b.m10), this.m11.add(b.m11)
    );
  }

  sub(b) {
    return new Mat2(
      this.m00.sub(b.m00), this.m01.sub(b.m01),
      this.m10.sub(b.m10), this.m11.sub(b.m11)
    );
  }

  scale(s) {
    return new Mat2(
      this.m00.mul(s), this.m01.mul(s),
      this.m10.mul(s), this.m11.mul(s)
    );
  }

  mul(b) {
    return new Mat2(
      this.m00.mul(b.m00).add(this.m01.mul(b.m10)),
      this.m00.mul(b.m01).add(this.m01.mul(b.m11)),
      this.m10.mul(b.m00).add(this.m11.mul(b.m10)),
      this.m10.mul(b.m01).add(this.m11.mul(b.m11))
    );
  }

  /** Conjugate transpose (M†). */
  dagger() {
    return new Mat2(
      this.m00.conj(), this.m10.conj(),
      this.m01.conj(), this.m11.conj()
    );
  }

  trace() {
    return this.m00.add(this.m11);
  }

  det() {
    return this.m00.mul(this.m11).sub(this.m01.mul(this.m10));
  }

  isUnitary(eps = 1e-8) {
    const prod = this.dagger().mul(this);
    const id = Mat2.identity();
    return prod.sub(id).frobeniusNorm() <= eps;
  }

  frobeniusNorm() {
    return Math.sqrt(
      this.m00.absSq() + this.m01.absSq() +
      this.m10.absSq() + this.m11.absSq()
    );
  }

  /**
   * Project into SU(2) by factoring out the global phase √det(M).
   * Ensures det(M') = 1.
   */
  toSU2() {
    const d = this.det();
    const phase = d.phase();
    const factor = Complex.fromPolar(1, -phase / 2);
    return this.scale(factor);
  }

  /**
   * Map SU(2) matrix to unit quaternion (w, x, y, z) on S³.
   * Representation:
   *   U = [ [w + i*z,  y + i*x],
   *         [-y + i*x, w - i*z] ]
   */
  toQuaternion() {
    const su = this.toSU2();
    // w = Re(m00 + m11) / 2
    // z = Im(m00 - m11) / 2
    // y = Re(m01 - m10) / 2
    // x = Im(m01 + m10) / 2
    let w = (su.m00.re + su.m11.re) / 2;
    let z = (su.m00.im - su.m11.im) / 2;
    let y = (su.m01.re - su.m10.re) / 2;
    let x = (su.m01.im + su.m10.im) / 2;

    const norm = Math.hypot(w, x, y, z);
    if (norm > 0) {
      w /= norm; x /= norm; y /= norm; z /= norm;
    }
    // Canonicalize sign on S³ / Z₂ (antipodal symmetry): ensure w >= 0
    if (w < 0 || (w === 0 && (x < 0 || (x === 0 && (y < 0 || (y === 0 && z < 0)))))) {
      w = -w; x = -x; y = -y; z = -z;
    }
    return [w, x, y, z];
  }

  static fromQuaternion(w, x, y, z) {
    return new Mat2(
      new Complex(w, z),
      new Complex(y, x),
      new Complex(-y, x),
      new Complex(w, -z)
    );
  }

  equals(b, eps = 1e-8) {
    return this.sub(b).frobeniusNorm() <= eps;
  }

  toString(digits = 4) {
    return `[[${this.m00.toString(digits)}, ${this.m01.toString(digits)}],\n [${this.m10.toString(digits)}, ${this.m11.toString(digits)}]]`;
  }
}

/**
 * Gauge-invariant operator trace distance between two 2x2 unitaries:
 *   d(U, V) = √(1 - 1/2 |Tr(U† V)|)
 * Invariant under global phase (U ~ e^(iα) U).
 * Range: [0, 1], where 0 means physically identical, 1 means orthogonal.
 */
function traceDistance(u, v) {
  const tr = u.dagger().mul(v).trace();
  const overlap = tr.abs() / 2;
  const clamped = Math.max(0, Math.min(1, 1 - overlap));
  return Math.sqrt(clamped);
}

/* ---------------------------------------------------------------------------
 * Topological Physics: Fibonacci Anyon Matrices
 * ------------------------------------------------------------------------- */

/**
 * F-matrix (fusion tree basis change):
 *   F = [ [ 1/φ,    1/√φ ],
 *         [ 1/√φ,  -1/φ  ] ]
 */
const F_MATRIX = new Mat2(
  new Complex(INV_PHI, 0),
  new Complex(INV_SQRT_PHI, 0),
  new Complex(INV_SQRT_PHI, 0),
  new Complex(-INV_PHI, 0)
);

/**
 * R-matrix (topological phase twists):
 *   R = [ [ e^(-i 4π/5), 0          ],
 *         [ 0,           e^(i 3π/5) ] ]
 */
const R_MATRIX = new Mat2(
  Complex.fromPolar(1, -4 * Math.PI / 5),
  Complex.zero(),
  Complex.zero(),
  Complex.fromPolar(1, 3 * Math.PI / 5)
);

// Braid generators
const SIGMA_1 = R_MATRIX.clone();
const SIGMA_2 = F_MATRIX.mul(R_MATRIX).mul(F_MATRIX);

const SIGMA_1_INV = SIGMA_1.dagger();
const SIGMA_2_INV = SIGMA_2.dagger();

// Canonical generator map
const GENERATORS = {
  1: SIGMA_1,
  [-1]: SIGMA_1_INV,
  2: SIGMA_2,
  [-2]: SIGMA_2_INV,
};

/**
 * Evaluate a braid word to its resulting 2x2 unitary matrix.
 * @param {Array<number>} word - Array of generator indices, e.g. [1, -2, 1, 1, 2]
 * @returns {Mat2}
 */
function evaluateBraid(word) {
  let mat = Mat2.identity();
  for (const gen of word) {
    const gMat = GENERATORS[gen];
    if (!gMat) throw new Error(`Unknown braid generator: ${gen}`);
    mat = mat.mul(gMat);
  }
  return mat;
}

module.exports = {
  PHI,
  SQRT_PHI,
  INV_PHI,
  INV_SQRT_PHI,
  Complex,
  Mat2,
  traceDistance,
  F_MATRIX,
  R_MATRIX,
  SIGMA_1,
  SIGMA_2,
  SIGMA_1_INV,
  SIGMA_2_INV,
  GENERATORS,
  evaluateBraid,
};
