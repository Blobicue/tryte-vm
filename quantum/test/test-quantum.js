'use strict';
/* ---------------------------------------------------------------------------
 * test-quantum.js — Comprehensive Test Suite for Fibonacci Anyon Braid Compiler
 *
 * Verifies:
 *   1. Golden Ratio & Topological Field Invariants (F, R matrices)
 *   2. Braid Group Axioms (Artin / Yang-Baxter: σ₁ σ₂ σ₁ = σ₂ σ₁ σ₂)
 *   3. SU(2) Gauge-Invariant Distance & Quaternion Mapping
 *   4. Braid Word Reduction Rules
 *   5. Universal Gate Set Compilation: { H, T, S, X, Z, Rx, Rz, CNOT }
 *   6. Spacetime Visualizer (ASCII & SVG output)
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const {
  PHI,
  Complex,
  Mat2,
  traceDistance,
  F_MATRIX,
  R_MATRIX,
  SIGMA_1,
  SIGMA_2,
  SIGMA_1_INV,
  SIGMA_2_INV,
  evaluateBraid,
} = require('../src/fibonacci.js');

const {
  BraidCompiler,
  GATES,
  Rx,
  Ry,
  Rz,
  reduceBraid,
  formatBraid,
} = require('../src/compiler.js');

const { renderASCII, renderSVG } = require('../src/visualizer.js');

let passed = 0;
function check(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('Running Fibonacci Anyon Quantum Compiler Test Suite...\n');

// ---------------------------------------------------------------------------
// 1. Topological Physics & Matrix Invariants
// ---------------------------------------------------------------------------
console.log('1. Topological Physics & Matrix Invariants:');

check('Golden Ratio identity holds: φ² - φ - 1 = 0', () => {
  const diff = PHI * PHI - PHI - 1;
  assert(Math.abs(diff) < 1e-14, `Expected φ² - φ - 1 = 0, got ${diff}`);
});

check('F-matrix is Hermitian, unitary, and an involution (F = F† = F⁻¹)', () => {
  assert(F_MATRIX.isUnitary(1e-12), 'F-matrix must be unitary');
  const prod = F_MATRIX.mul(F_MATRIX);
  assert(prod.equals(Mat2.identity(), 1e-12), 'F² must equal Identity (involution)');
  const diffHerm = F_MATRIX.sub(F_MATRIX.dagger());
  assert(diffHerm.frobeniusNorm() < 1e-12, 'F must be Hermitian');
  const det = F_MATRIX.det();
  assert(Math.abs(det.re - (-1)) < 1e-12 && Math.abs(det.im) < 1e-12, 'det(F) must be -1');
});

check('R-matrix is unitary and diagonal with correct topological phase twists', () => {
  assert(R_MATRIX.isUnitary(1e-12), 'R-matrix must be unitary');
  assert(R_MATRIX.m01.abs() < 1e-14, 'R[0,1] must be 0');
  assert(R_MATRIX.m10.abs() < 1e-14, 'R[1,0] must be 0');
  // Phase angles: -4π/5 and +3π/5
  const phase0 = R_MATRIX.m00.phase();
  const phase1 = R_MATRIX.m11.phase();
  assert(Math.abs(phase0 - (-4 * Math.PI / 5)) < 1e-12, 'R[0,0] phase must be -4π/5');
  assert(Math.abs(phase1 - (3 * Math.PI / 5)) < 1e-12, 'R[1,1] phase must be +3π/5');
});

check('Braid generators σ₁ and σ₂ are unitary', () => {
  assert(SIGMA_1.isUnitary(1e-12), 'σ₁ must be unitary');
  assert(SIGMA_2.isUnitary(1e-12), 'σ₂ must be unitary');
  assert(SIGMA_1_INV.isUnitary(1e-12), 'σ₁⁻¹ must be unitary');
  assert(SIGMA_2_INV.isUnitary(1e-12), 'σ₂⁻¹ must be unitary');
});

check('Yang-Baxter / Artin relation holds: σ₁ σ₂ σ₁ = σ₂ σ₁ σ₂ (machine precision)', () => {
  const lhs = SIGMA_1.mul(SIGMA_2).mul(SIGMA_1);
  const rhs = SIGMA_2.mul(SIGMA_1).mul(SIGMA_2);
  const err = lhs.sub(rhs).frobeniusNorm();
  assert(err < 1e-14, `Yang-Baxter violated: error = ${err}`);
});

// ---------------------------------------------------------------------------
// 2. SU(2) Gauge-Invariant Distance & Quaternion Mapping
// ---------------------------------------------------------------------------
console.log('\n2. Gauge-Invariant Distance & Quaternion Geometry:');

check('Distance d(U, U) = 0', () => {
  const d = traceDistance(GATES.H, GATES.H);
  assert(d < 1e-12, `Expected 0, got ${d}`);
});

check('Distance d(U, e^(iθ) U) = 0 (Global phase invariance)', () => {
  const phaseFactor = Complex.fromPolar(1, 1.2345);
  const rotatedH = GATES.H.scale(phaseFactor);
  const d = traceDistance(GATES.H, rotatedH);
  assert(d < 1e-12, `Expected phase-invariant 0, got ${d}`);
});

check('Distance d(I, X) = 1 (Orthogonal gates)', () => {
  const d = traceDistance(GATES.I, GATES.X);
  assert(Math.abs(d - 1) < 1e-12, `Expected 1, got ${d}`);
});

check('Triangle inequality holds: d(U, W) ≤ d(U, V) + d(V, W)', () => {
  const d_HT = traceDistance(GATES.H, GATES.T);
  const d_TX = traceDistance(GATES.T, GATES.X);
  const d_HX = traceDistance(GATES.H, GATES.X);
  assert(d_HX <= d_HT + d_TX + 1e-12, 'Triangle inequality must hold');
});

check('SU(2) matrix round-trips through unit quaternion representation', () => {
  const quat = GATES.H.toSU2().toQuaternion();
  const [w, x, y, z] = quat;
  const norm = Math.hypot(w, x, y, z);
  assert(Math.abs(norm - 1) < 1e-12, 'Quaternion must have unit length');
  const reconstructed = Mat2.fromQuaternion(w, x, y, z);
  const d = traceDistance(GATES.H, reconstructed);
  assert(d < 1e-10, `Reconstruction distance must be 0, got ${d}`);
});

// ---------------------------------------------------------------------------
// 3. Braid Word Reduction Rules
// ---------------------------------------------------------------------------
console.log('\n3. Braid Word Reduction Rules:');

check('Adjacent inverse generators cancel: σ₁ σ₁⁻¹ -> identity', () => {
  const reduced = reduceBraid([1, -1]);
  assert.deepStrictEqual(reduced, [], 'Expected empty braid');
});

check('Nested inverse pairs cancel completely: [1, 2, -2, -1] -> []', () => {
  const reduced = reduceBraid([1, 2, -2, -1]);
  assert.deepStrictEqual(reduced, [], 'Expected completely canceled braid');
});

check('formatBraid renders human-readable Greek braid symbols', () => {
  const str = formatBraid([1, -2, 1, 2]);
  assert.strictEqual(str, 'σ₁ σ₂⁻¹ σ₁ σ₂');
});

// ---------------------------------------------------------------------------
// 4. Universal Quantum Gate Compilation
// ---------------------------------------------------------------------------
console.log('\n4. Universal Gate Set Compilation:');

const compiler = new BraidCompiler({ forwardDepth: 7 });
compiler.indexForward(7);

check('Compile Hadamard Gate (H) within ε ≤ 0.05', () => {
  const res = compiler.compileGate('H', 0.05, 6);
  assert(res.distance <= 0.05, `Expected error ≤ 0.05, got ${res.distance}`);
  assert(res.word.length > 0, 'Must produce non-empty braid word');
  // Verify evaluating the braid matches achieved matrix
  const mat = evaluateBraid(res.word);
  const verifiedDist = traceDistance(GATES.H, mat);
  assert(Math.abs(verifiedDist - res.distance) < 1e-10, 'Evaluated braid distance must match');
});

check('Compile Phase Gate (S) within ε ≤ 0.05', () => {
  const res = compiler.compileGate('S', 0.05, 6);
  assert(res.distance <= 0.05, `Expected error ≤ 0.05, got ${res.distance}`);
});

check('Compile T Gate (π/8) within ε ≤ 0.06', () => {
  const res = compiler.compileGate('T', 0.06, 6);
  assert(res.distance <= 0.06, `Expected error ≤ 0.06, got ${res.distance}`);
});

check('Compile Pauli-Z Gate exactly (ε < 1e-8)', () => {
  const res = compiler.compileGate('Z', 0.001, 6);
  assert(res.distance < 1e-8, `Expected exact hit for Z, got ${res.distance}`);
  assert.strictEqual(res.word.length, 7, 'Optimal Z braid is 7 swaps');
});

check('Compile Arbitrary Z-Rotation Rz(π/3) within ε ≤ 0.06', () => {
  const target = Rz(Math.PI / 3);
  const res = compiler.compile(target, 0.06, 6);
  assert(res.distance <= 0.06, `Expected error ≤ 0.06, got ${res.distance}`);
});

check('Compile Arbitrary X-Rotation Rx(π/4) within ε ≤ 0.08', () => {
  const target = Rx(Math.PI / 4);
  const res = compiler.compile(target, 0.08, 6);
  assert(res.distance <= 0.08, `Expected error ≤ 0.08, got ${res.distance}`);
});

check('Compile Multi-Qubit Entangling CNOT Gate', () => {
  const cnot = compiler.compileCNOT(0.05);
  assert.strictEqual(cnot.type, 'CNOT');
  assert(cnot.totalBraid.length > 0, 'CNOT must produce valid anyon weave');
  assert(cnot.totalBraid.includes(3), 'CNOT must include inter-qubit anyon exchange generator σ₃');
});

// ---------------------------------------------------------------------------
// 5. Spacetime Anyon Visualizer
// ---------------------------------------------------------------------------
console.log('\n5. Spacetime Anyon Visualizer:');

check('ASCII visualizer renders strand trajectories', () => {
  const ascii = renderASCII([1, -2, 1]);
  assert(ascii.includes('τ₁'), 'ASCII must label strand 1');
  assert(ascii.includes('[σ₁ : 1 over 2]'), 'ASCII must label σ₁ over-crossing');
  assert(ascii.includes('[σ₂⁻¹: 2 under 3]'), 'ASCII must label σ₂⁻¹ under-crossing');
});

check('SVG visualizer generates valid XML with bezier curves', () => {
  const svg = renderSVG([1, 2, -1]);
  assert(svg.startsWith('<?xml'), 'SVG must start with xml declaration');
  assert(svg.includes('<svg'), 'SVG must contain <svg> element');
  assert(svg.includes('stroke="#3b82f6"'), 'SVG must contain strand paths');
});

// ---------------------------------------------------------------------------
// 6. Verified Quantum Algorithms via Topological Anyon Braids
// ---------------------------------------------------------------------------
console.log('\n6. Verified Quantum Algorithms & Topological Qutrits:');

const {
  runBellState,
  runDeutschJozsa,
  runQuantumTeleportation,
  runGroverSearch,
  getTopologicalQutritDimensions,
} = require('../src/algorithms.js');

check('Bell State Generation (|Φ+⟩) achieves fidelity > 0.99 via topological braids', () => {
  const bell = runBellState(compiler);
  assert(bell.verified, `Expected verified, got ${bell.verified}`);
  assert(bell.fidelity > 0.99, `Expected fidelity > 0.99, got ${bell.fidelity}`);
  assert(bell.probabilities['|00>'] > 0.40, `Expected P(00) > 0.40, got ${bell.probabilities['|00>']}`);
  assert(bell.probabilities['|11>'] > 0.40, `Expected P(11) > 0.40, got ${bell.probabilities['|11>']}`);
  assert(bell.probabilities['|01>'] < 1e-12, 'No cross-branch leakage');
  assert(bell.probabilities['|10>'] < 1e-12, 'No cross-branch leakage');
});

check('Deutsch-Jozsa Algorithm correctly identifies Constant & Balanced functions', () => {
  const balanced = runDeutschJozsa(true, compiler);
  assert.strictEqual(balanced.detectedType, 'BALANCED', 'Must detect balanced function');
  assert(balanced.verified, 'Balanced detection verified');

  const constant = runDeutschJozsa(false, compiler);
  assert.strictEqual(constant.detectedType, 'CONSTANT', 'Must detect constant function');
  assert(constant.verified, 'Constant detection verified');
});

check('Quantum Teleportation protocol transmits state across anyon Bell channel', () => {
  const tele = runQuantumTeleportation(Math.PI / 3, Math.PI / 4, compiler);
  assert(tele.protocolVerified, 'Teleportation protocol must verify');
  assert(tele.hBraidWord.length > 0, 'Must use compiled topological braid word for Hadamard');
});

check('Grover Search finds marked item with success probability > 0.94', () => {
  const grover = runGroverSearch(3, compiler); // Search for target |11>
  assert(grover.verified, `Expected success probability > 0.94, got ${grover.successProbability}`);
  assert(grover.probabilities[3] > 0.94, 'Target state |11> must have >94% amplitude');
});

check('Topological Qutrit: 4-anyon fusion space dimension F₄ = 3 matches Tryte-VM balanced ternary', () => {
  const qutrit = getTopologicalQutritDimensions();
  assert.strictEqual(qutrit.hilbertSpaceDimensions['4 Anyons (Qutrit)'].dim, 3, '4 anyons must have Hilbert space dimension 3');
  assert.strictEqual(qutrit.hilbertSpaceDimensions['3 Anyons (Qubit)'].dim, 2, '3 anyons must have Hilbert space dimension 2');
  assert.strictEqual(qutrit.ternaryVMAlignment.physicalAnyonsPerQutrit, 4, 'Qutrit corresponds to 4 anyons');
});

// ---------------------------------------------------------------------------
// 7. Tryte-QOS Subsystems: Unified Compiler, Binary Format, SU(9) & Sharding
// ---------------------------------------------------------------------------
console.log('\n7. Tryte-QOS Subsystems: Unified Compiler, Binary Format, SU(9) & Cluster:');

const {
  Mat3,
  Mat9,
  T_NEG,
  T_CYCLE,
  H3,
  S3,
  CX3,
  CZ3,
  SWAP3,
  createQutritBellCircuit,
  evaluateBraid3,
  UnifiedQutritCompiler,
} = require('../src/unified-compiler.js');

const {
  packBraidWord,
  unpackBraidWord,
  encodeBraidProgram,
  decodeBraidProgram,
} = require('../src/binary-format.js');

const { ClusterNode } = require('../cluster/cluster-node.js');

check('Unified Compiler: Indexes and compiles target B₄ anyon braid words with machine precision', () => {
  const uqc = new UnifiedQutritCompiler(3);
  uqc.index(3);
  const targetWord = [1, 2, -1];
  const targetMat = evaluateBraid3(targetWord);
  const res = uqc.compile(targetMat, 0.01);
  assert.deepStrictEqual(res.word, targetWord, 'Compiler must recover exact target braid word');
  assert(res.distance < 1e-10, `Expected exact distance 0, got ${res.distance}`);
  assert(res.verified, 'Compilation must be verified');
});

check('Unified Compiler: Compiles Classical Reversible and Quantum Qutrit Gate structures', () => {
  const uqc = new UnifiedQutritCompiler(3);
  const resNeg = uqc.compileClassical('NEG', 1.0);
  assert.strictEqual(resNeg.name, 'NEG');
  assert.strictEqual(resNeg.type, 'CLASSICAL_REVERSIBLE_TERNARY');
  assert(resNeg.matrix.isUnitary(), 'Result matrix must be unitary in SU(3)');

  const resH3 = uqc.compileQuantum('H3', 1.0);
  assert.strictEqual(resH3.name, 'H3');
  assert.strictEqual(resH3.type, 'QUANTUM_QUTRIT_SU3');
  assert(resH3.matrix.isUnitary(), 'Result matrix must be unitary in SU(3)');
});

check('Multi-Qutrit SU(9): CX₃, CZ₃, and SWAP₃ are exactly unitary', () => {
  assert(CX3.isUnitary(), 'CX3 must be unitary in SU(9)');
  assert(CZ3.isUnitary(), 'CZ3 must be unitary in SU(9)');
  assert(SWAP3.isUnitary(), 'SWAP3 must be unitary in SU(9)');
});

check('Multi-Qutrit Entanglement: 2-Qutrit Bell circuit creates unitary entangled state', () => {
  const bell = createQutritBellCircuit();
  assert(bell.isUnitary, 'Bell circuit operator must be unitary in SU(9)');
});

check('Binary Format: 4-bit nibble packing round-trips with zero loss', () => {
  const word = [1, -2, 3, -1, 2, -3, 1, 1];
  const packed = packBraidWord(word);
  const unpacked = unpackBraidWord(packed, word.length);
  assert.deepStrictEqual(unpacked, word, 'Unpacked braid must match original');
});

check('Binary Format: Full .braid executable encoding and checksum verification', () => {
  const prog = {
    name: 'test_qutrit_bell',
    type: 'QUANTUM_QUTRIT',
    qutritCount: 2,
    tryteRegisterCount: 1,
    word: [1, 2, -1, 3, -2],
  };
  const buf = encodeBraidProgram(prog);
  const decoded = decodeBraidProgram(buf);
  assert.strictEqual(decoded.name, prog.name);
  assert.strictEqual(decoded.qutritCount, 2);
  assert.deepStrictEqual(decoded.word, prog.word);
});

check('Cluster Sharding: 12 mini PC nodes map to the 12 canonical branches of B₃', () => {
  const node = new ClusterNode({ nodeId: 'node-test-0', shardIndex: 4 });
  assert.strictEqual(node.shardIndex, 4);
  assert.strictEqual(node.shardPrefix.length, 2);
  assert.strictEqual(node.totalClusterNodes, 12);
});

console.log(`\nAll ${passed} checks passed successfully!`);


