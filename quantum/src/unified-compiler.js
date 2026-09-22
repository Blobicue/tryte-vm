'use strict';
/* ---------------------------------------------------------------------------
 * unified-compiler.js — Unified Qutrit & Classical Ternary Compiler
 * ---------------------------------------------------------------------------
 * Compiles both Classical Balanced Ternary logic (permutations) and Quantum
 * Qutrit algorithms (continuous SU(3) rotations) into 4-strand anyon braids in B₄.
 * ------------------------------------------------------------------------- */

const { Complex } = require('./fibonacci.js');

/**
 * 3x3 Complex Matrix for Qutrit Operations in SU(3)
 */
class Mat3 {
  constructor(elements) {
    // elements is a 3x3 array of Complex numbers
    this.m = elements;
  }

  static identity() {
    return new Mat3([
      [new Complex(1, 0), new Complex(0, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(1, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(0, 0), new Complex(1, 0)],
    ]);
  }

  static fromPermutation(p) {
    // p is an array of 3 indices: [p[0], p[1], p[2]]
    const m = [
      [new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)],
    ];
    for (let i = 0; i < 3; i++) {
      m[p[i]][i] = new Complex(1, 0);
    }
    return new Mat3(m);
  }

  mul(other) {
    const res = [
      [new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)],
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = new Complex(0, 0);
        for (let k = 0; k < 3; k++) {
          sum = sum.add(this.m[i][k].mul(other.m[k][j]));
        }
        res[i][j] = sum;
      }
    }
    return new Mat3(res);
  }

  dagger() {
    const res = [
      [new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)],
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        res[i][j] = this.m[j][i].conj();
      }
    }
    return new Mat3(res);
  }

  trace() {
    return this.m[0][0].add(this.m[1][1]).add(this.m[2][2]);
  }

  /**
   * Gauge-invariant distance in SU(3): d(U, V) = sqrt(1 - 1/3 |Tr(U† V)|)
   */
  distance(other) {
    const prod = this.dagger().mul(other);
    const tr = prod.trace();
    const overlap = tr.abs() / 3.0;
    return Math.sqrt(Math.max(0, 1 - overlap));
  }

  isUnitary(tol = 1e-10) {
    const prod = this.dagger().mul(this);
    const id = Mat3.identity();
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const diff = prod.m[i][j].sub(id.m[i][j]).abs();
        if (diff > tol) return false;
      }
    }
    return true;
  }

  toString(decimals = 3) {
    return this.m.map(row =>
      row.map(c => c.toString(decimals).padStart(12)).join(' ')
    ).join('\n');
  }
}

// ---------------------------------------------------------------------------
// Canonical Classical Reversible Ternary Gates (Permutations in SU(3))
// Basis indexing: 0 = |-1>, 1 = |0>, 2 = |+1>
// ---------------------------------------------------------------------------

// 1. Trit Negation: |-1> <-> |+1>, |0> -> |0|
const T_NEG = new Mat3([
  [new Complex(0, 0), new Complex(0, 0), new Complex(1, 0)],
  [new Complex(0, 0), new Complex(1, 0), new Complex(0, 0)],
  [new Complex(1, 0), new Complex(0, 0), new Complex(0, 0)],
]);

// 2. Trit Cycle (+1 increment mod 3): |-1> -> |0>, |0> -> |+1>, |+1> -> |-1>
const T_CYCLE = new Mat3([
  [new Complex(0, 0), new Complex(0, 0), new Complex(1, 0)],
  [new Complex(1, 0), new Complex(0, 0), new Complex(0, 0)],
  [new Complex(0, 0), new Complex(1, 0), new Complex(0, 0)],
]);

// 3. Trit Cycle Inverse (-1 decrement mod 3)
const T_CYCLE_INV = new Mat3([
  [new Complex(0, 0), new Complex(1, 0), new Complex(0, 0)],
  [new Complex(0, 0), new Complex(0, 0), new Complex(1, 0)],
  [new Complex(1, 0), new Complex(0, 0), new Complex(0, 0)],
]);

// 4. Swap |-1> and |0>
const T_SWAP_NEG_ZERO = new Mat3([
  [new Complex(0, 0), new Complex(1, 0), new Complex(0, 0)],
  [new Complex(1, 0), new Complex(0, 0), new Complex(0, 0)],
  [new Complex(0, 0), new Complex(0, 0), new Complex(1, 0)],
]);

// 5. Swap |0> and |+1>
const T_SWAP_ZERO_POS = new Mat3([
  [new Complex(1, 0), new Complex(0, 0), new Complex(0, 0)],
  [new Complex(0, 0), new Complex(0, 0), new Complex(1, 0)],
  [new Complex(0, 0), new Complex(1, 0), new Complex(0, 0)],
]);

// ---------------------------------------------------------------------------
// Canonical Quantum Qutrit Gates in SU(3)
// ---------------------------------------------------------------------------

// Cube root of unity: omega = e^{i 2pi/3} = -1/2 + i sqrt(3)/2
const OMEGA = new Complex(-0.5, Math.sqrt(3) / 2);
const OMEGA2 = OMEGA.mul(OMEGA); // e^{i 4pi/3} = -1/2 - i sqrt(3)/2

// Chrestenson / Qutrit Hadamard gate H₃:
// H₃ = 1/sqrt(3) * [ [1,  1,       1      ],
//                   [1,  omega,   omega² ],
//                   [1,  omega²,  omega  ] ]
const invSqrt3 = 1 / Math.sqrt(3);
const H3 = new Mat3([
  [new Complex(invSqrt3, 0), new Complex(invSqrt3, 0), new Complex(invSqrt3, 0)],
  [new Complex(invSqrt3, 0), OMEGA.mul(invSqrt3), OMEGA2.mul(invSqrt3)],
  [new Complex(invSqrt3, 0), OMEGA2.mul(invSqrt3), OMEGA.mul(invSqrt3)],
]);

// Qutrit Phase Gate S₃ = diag(1, omega, omega²)
const S3 = new Mat3([
  [new Complex(1, 0), new Complex(0, 0), new Complex(0, 0)],
  [new Complex(0, 0), OMEGA, new Complex(0, 0)],
  [new Complex(0, 0), new Complex(0, 0), OMEGA2],
]);

// Qutrit Generalized Pauli-X (Shift): same as T_CYCLE
const X3 = T_CYCLE;

// Qutrit Generalized Pauli-Z (Clock): same as S3
const Z3 = S3;

// ---------------------------------------------------------------------------
// 4-Strand Anyon Braid Generators B₄ acting on Qutrit Space (Dim = 3)
// In a 4-Fibonacci-anyon cluster (τ ⊗ τ ⊗ τ ⊗ τ), the 3-dimensional fusion
// space admits an irreducible, unitary representation of the braid group B₄
// via the Temperley-Lieb algebra TL₄(φ) with Kauffman parameter A = e^{i 2π/5}.
// Generators satisfy:
//   e_i² = φ e_i
//   e_i e_{i±1} e_i = e_i
//   e_i e_j = e_j e_i (|i - j| ≥ 2)
//   σ_i = A I + A⁻¹ e_i (strictly unitary since A² + A⁻² = -φ)
// ---------------------------------------------------------------------------

const phi = (1 + Math.sqrt(5)) / 2;
const invPhi = 1 / phi;
const invPhi2 = invPhi * invPhi;
const invPhi3_2 = Math.pow(phi, -1.5);

// Kauffman bracket parameter A for Fibonacci anyons
const TL_A = Complex.fromPolar(1, 2 * Math.PI / 5);
const TL_A_INV = Complex.fromPolar(1, -2 * Math.PI / 5);

function makeB4Generator(eReal) {
  const elements = [];
  for (let i = 0; i < 3; i++) {
    const row = [];
    for (let j = 0; j < 3; j++) {
      const diag = (i === j) ? TL_A : new Complex(0, 0);
      const off = TL_A_INV.mul(eReal[i][j]);
      row.push(diag.add(off));
    }
    elements.push(row);
  }
  return new Mat3(elements);
}

// Temperley-Lieb algebra generators on 3D fusion space V₄(τ)
const E1_TL = [
  [phi, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

const E2_TL = [
  [invPhi, invPhi3_2, invPhi],
  [invPhi3_2, invPhi2, invPhi3_2],
  [invPhi, invPhi3_2, invPhi],
];

const E3_TL = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, phi],
];

// Exact unitary braid generators for B₄
const SIGMA1_3 = makeB4Generator(E1_TL);
const SIGMA2_3 = makeB4Generator(E2_TL);
const SIGMA3_3 = makeB4Generator(E3_TL);

const B4_GENERATORS = {
  1: SIGMA1_3,
  [-1]: SIGMA1_3.dagger(),
  2: SIGMA2_3,
  [-2]: SIGMA2_3.dagger(),
  3: SIGMA3_3,
  [-3]: SIGMA3_3.dagger(),
};

/**
 * Evaluate a 4-strand braid word into a 3x3 unitary matrix in SU(3).
 * @param {number[]} word - Array of signed generator indices, e.g. [1, -2, 3]
 */
function evaluateBraid3(word) {
  let mat = Mat3.identity();
  for (const gen of word) {
    const g = B4_GENERATORS[gen];
    if (!g) throw new Error(`Invalid generator ${gen} in B4`);
    mat = mat.mul(g);
  }
  return mat;
}

/**
 * Reduce a B4 braid word by canceling adjacent inverse pairs: [g, -g] -> []
 */
function reduceBraid4(word) {
  const stack = [];
  for (const g of word) {
    if (stack.length > 0 && stack[stack.length - 1] === -g) {
      stack.pop();
    } else {
      stack.push(g);
    }
  }
  return stack;
}

/**
 * Unified Compiler: Compiles Classical Ternary Operations & Quantum Qutrit Gates
 */
class UnifiedQutritCompiler {
  constructor(maxDepth = 6) {
    this.maxDepth = maxDepth;
    this.table = [];
    this.isIndexed = false;
  }

  /**
   * Index forward braid tree in B4.
   */
  index(depth = this.maxDepth) {
    this.maxDepth = depth;
    let current = [{ word: [], matrix: Mat3.identity(), lastGen: 0 }];
    this.table = [current[0]];

    const gens = [1, -1, 2, -2, 3, -3];

    for (let d = 1; d <= depth; d++) {
      const next = [];
      for (const node of current) {
        for (const g of gens) {
          if (node.lastGen === -g) continue; // Skip trivial cancel
          const nextWord = node.word.concat([g]);
          const nextMat = node.matrix.mul(B4_GENERATORS[g]);
          const entry = { word: nextWord, matrix: nextMat, lastGen: g };
          this.table.push(entry);
          next.push(entry);
        }
      }
      current = next;
    }
    this.isIndexed = true;
    return this;
  }

  /**
   * Compile any target 3x3 unitary matrix (classical permutation or quantum gate).
   */
  compile(targetMat3, epsilon = 0.1) {
    if (!this.isIndexed) this.index();

    let best = null;
    let bestDist = Infinity;

    for (const entry of this.table) {
      const d = targetMat3.distance(entry.matrix);
      if (d < bestDist) {
        bestDist = d;
        best = entry;
        if (d <= epsilon) break;
      }
    }

    return {
      word: reduceBraid4(best.word),
      depth: best.word.length,
      distance: bestDist,
      matrix: best.matrix,
      verified: bestDist <= epsilon,
    };
  }

  /**
   * Compile a named classical ternary gate: 'NEG', 'CYCLE', 'CYCLE_INV', 'SWAP01', 'SWAP02'
   */
  compileClassical(name, epsilon = 0.15) {
    const map = {
      NEG: T_NEG,
      CYCLE: T_CYCLE,
      CYCLE_INV: T_CYCLE_INV,
      SWAP01: T_SWAP_NEG_ZERO,
      SWAP02: T_SWAP_ZERO_POS,
    };
    const target = map[name.toUpperCase()];
    if (!target) throw new Error(`Unknown classical gate '${name}'`);
    return {
      name,
      type: 'CLASSICAL_REVERSIBLE_TERNARY',
      ...this.compile(target, epsilon),
    };
  }

  /**
   * Compile a named quantum qutrit gate: 'H3', 'S3', 'X3', 'Z3'
   */
  compileQuantum(name, epsilon = 0.15) {
    const map = {
      H3: H3,
      S3: S3,
      X3: X3,
      Z3: Z3,
    };
    const target = map[name.toUpperCase()];
    if (!target) throw new Error(`Unknown quantum qutrit gate '${name}'`);
    return {
      name,
      type: 'QUANTUM_QUTRIT_SU3',
      ...this.compile(target, epsilon),
    };
  }
}

// ---------------------------------------------------------------------------
// 2-Qutrit Multi-Particle Algebra & Entangling Gates in SU(9)
// Computational basis: |c, t> mapped to index (3 * c + t) for c, t in {0, 1, 2}
// ---------------------------------------------------------------------------

class Mat9 {
  constructor(elements) {
    this.m = elements;
  }

  static identity() {
    const res = [];
    for (let i = 0; i < 9; i++) {
      const row = [];
      for (let j = 0; j < 9; j++) {
        row.push(i === j ? new Complex(1, 0) : new Complex(0, 0));
      }
      res.push(row);
    }
    return new Mat9(res);
  }

  static kron(a, b) {
    const res = [];
    for (let i = 0; i < 9; i++) {
      const row = [];
      const ai = Math.floor(i / 3);
      const bi = i % 3;
      for (let j = 0; j < 9; j++) {
        const aj = Math.floor(j / 3);
        const bj = j % 3;
        row.push(a.m[ai][aj].mul(b.m[bi][bj]));
      }
      res.push(row);
    }
    return new Mat9(res);
  }

  mul(other) {
    const res = [];
    for (let i = 0; i < 9; i++) {
      const row = [];
      for (let j = 0; j < 9; j++) {
        let sum = new Complex(0, 0);
        for (let k = 0; k < 9; k++) {
          sum = sum.add(this.m[i][k].mul(other.m[k][j]));
        }
        row.push(sum);
      }
      res.push(row);
    }
    return new Mat9(res);
  }

  dagger() {
    const res = [];
    for (let i = 0; i < 9; i++) {
      const row = [];
      for (let j = 0; j < 9; j++) {
        row.push(this.m[j][i].conj());
      }
      res.push(row);
    }
    return new Mat9(res);
  }

  trace() {
    let sum = new Complex(0, 0);
    for (let i = 0; i < 9; i++) {
      sum = sum.add(this.m[i][i]);
    }
    return sum;
  }

  distance(other) {
    const prod = this.dagger().mul(other);
    const tr = prod.trace();
    const overlap = tr.abs() / 9.0;
    return Math.sqrt(Math.max(0, 1 - overlap));
  }

  isUnitary(tol = 1e-10) {
    const prod = this.dagger().mul(this);
    const id = Mat9.identity();
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        const diff = prod.m[i][j].sub(id.m[i][j]).abs();
        if (diff > tol) return false;
      }
    }
    return true;
  }
}

// 1. Qutrit Controlled-Shift Gate CX₃ (Controlled-NOT for qutrits):
// Block diagonal: diag(I, X₃, X₃²)
const CX3 = (function() {
  const X3_sq = X3.mul(X3);
  const elements = [];
  for (let i = 0; i < 9; i++) {
    const row = [];
    const ci = Math.floor(i / 3);
    const ti = i % 3;
    for (let j = 0; j < 9; j++) {
      const cj = Math.floor(j / 3);
      const tj = j % 3;
      if (ci !== cj) {
        row.push(new Complex(0, 0));
      } else if (ci === 0) {
        row.push(ti === tj ? new Complex(1, 0) : new Complex(0, 0));
      } else if (ci === 1) {
        row.push(X3.m[ti][tj]);
      } else {
        row.push(X3_sq.m[ti][tj]);
      }
    }
    elements.push(row);
  }
  return new Mat9(elements);
})();

// 2. Qutrit Controlled-Clock/Phase Gate CZ₃:
// |c, t> -> omega^{c * t} |c, t>
const CZ3 = (function() {
  const elements = [];
  for (let i = 0; i < 9; i++) {
    const row = [];
    const ci = Math.floor(i / 3);
    const ti = i % 3;
    for (let j = 0; j < 9; j++) {
      if (i === j) {
        const phaseExponent = (ci * ti) % 3;
        if (phaseExponent === 0) row.push(new Complex(1, 0));
        else if (phaseExponent === 1) row.push(OMEGA);
        else row.push(OMEGA2);
      } else {
        row.push(new Complex(0, 0));
      }
    }
    elements.push(row);
  }
  return new Mat9(elements);
})();

// 3. 2-Qutrit SWAP Gate:
// |i, j> -> |j, i>
const SWAP3 = (function() {
  const elements = [];
  for (let i = 0; i < 9; i++) {
    const row = [];
    const ci = Math.floor(i / 3);
    const ti = i % 3;
    for (let j = 0; j < 9; j++) {
      const cj = Math.floor(j / 3);
      const tj = j % 3;
      row.push((ci === tj && ti === cj) ? new Complex(1, 0) : new Complex(0, 0));
    }
    elements.push(row);
  }
  return new Mat9(elements);
})();

/**
 * Creates the 2-Qutrit Maximally Entangled Bell State Circuit:
 * (H₃ ⊗ I) followed by CX₃ on state |0, 0> creates (|0,0> + |1,1> + |2,2>) / √3.
 */
function createQutritBellCircuit() {
  const H3_kron_I = Mat9.kron(H3, Mat3.identity());
  const bellOp = CX3.mul(H3_kron_I);
  return {
    operator: bellOp,
    isUnitary: bellOp.isUnitary(),
  };
}

module.exports = {
  Mat3,
  Mat9,
  T_NEG,
  T_CYCLE,
  T_CYCLE_INV,
  T_SWAP_NEG_ZERO,
  T_SWAP_ZERO_POS,
  H3,
  S3,
  X3,
  Z3,
  CX3,
  CZ3,
  SWAP3,
  createQutritBellCircuit,
  B4_GENERATORS,
  evaluateBraid3,
  reduceBraid4,
  UnifiedQutritCompiler,
};

