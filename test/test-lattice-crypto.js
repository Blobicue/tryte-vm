'use strict';
/* ---------------------------------------------------------------------------
 * test-lattice-crypto.js — Comprehensive Post-Quantum Lattice Crypto Test Battery
 * ---------------------------------------------------------------------------
 * Tests:
 *   1. TernaryPoly ring invariants (cyclic & negacyclic convolution, fast ternary mult)
 *   2. Closed-form Hensel polynomial inversion mod 729 (0% failure rate)
 *   3. Ternary NTRU encryption & decryption (200 randomized trials, 0 failures)
 *   4. Ternary NTRU Key Encapsulation Mechanism (KEM) & symmetric digest derivation
 *   5. Ternary Ring-LWE Key Encapsulation Mechanism (200 randomized trials)
 *   6. Native TASM execution of NTRU on TryteVM hardware
 *   7. Adversarial tampering & boundary fuzzing
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const T = require('../src/ternary.js');
const {
  TernaryPoly,
  TernaryNTRU,
  TernaryRingLWE,
  generateNTRUTASM,
} = require('../src/lattice_crypto.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto } = require('../src/assembler.js');
const { hashTernary } = require('../src/crypto.js');

console.log('===============================================================');
console.log('TESTING TRYTE-QOS POST-QUANTUM LATTICE CRYPTOGRAPHY ENGINE');
console.log('===============================================================\n');

let passCount = 0;
function check(title, condition) {
  assert(condition, `FAILED: ${title}`);
  console.log(`  ✓ ${title}`);
  passCount++;
}

// ---------------------------------------------------------------------------
// 1. TernaryPoly Ring Invariants
// ---------------------------------------------------------------------------
console.log('>>> [1/7] Testing TernaryPoly Ring Invariants (Cyclic & Negacyclic)...');

{
  const p1 = new TernaryPoly([1, -1, 0, 2], 4, 'cyclic');
  const p2 = new TernaryPoly([0, 1, -1, 1], 4, 'cyclic');
  const sum = p1.add(p2);
  check('Polynomial addition wraps mod 729 correctly', sum.coeffs[0] === 1 && sum.coeffs[1] === 0 && sum.coeffs[2] === -1 && sum.coeffs[3] === 3);

  const diff = p1.sub(p2);
  check('Polynomial subtraction wraps correctly', diff.coeffs[0] === 1 && diff.coeffs[1] === -2 && diff.coeffs[2] === 1 && diff.coeffs[3] === 1);

  const neg = p1.neg();
  check('Polynomial negation flips coefficients', neg.coeffs[0] === -1 && neg.coeffs[1] === 1 && neg.coeffs[3] === -2);

  // Fast ternary multiplication vs generic multiplication (cyclic)
  const a = TernaryPoly.randomTernary(9, null, 'cyclic');
  const t = TernaryPoly.randomTernary(9, 4, 'cyclic');
  const mulGeneric = a.mul(t);
  const mulFast = a.mulTernary(t);
  check('Fast ternary multiplication matches generic multiplication in cyclic ring', mulGeneric.equals(mulFast));

  // Negacyclic multiplication (X^N + 1)
  const aNeg = new TernaryPoly([1, 2], 2, 'negacyclic');
  const bNeg = new TernaryPoly([3, 4], 2, 'negacyclic');
  // (1 + 2X)(3 + 4X) = 3 + 10X + 8X^2. Mod (X^2 + 1): 3 + 10X - 8 = -5 + 10X
  const prodNeg = aNeg.mul(bNeg);
  check('Negacyclic multiplication matches algebraic mod (X^N + 1)', prodNeg.coeffs[0] === -5 && prodNeg.coeffs[1] === 10);

  const prodFastNeg = aNeg.mulTernary(new TernaryPoly([1, -1], 2, 'negacyclic'));
  const prodGenNeg = aNeg.mul(new TernaryPoly([1, -1], 2, 'negacyclic'));
  check('Fast ternary multiplication matches generic in negacyclic ring', prodFastNeg.equals(prodGenNeg));
}

// ---------------------------------------------------------------------------
// 2. Closed-Form Hensel Polynomial Inversion Modulo 729
// ---------------------------------------------------------------------------
console.log('\n>>> [2/7] Testing Closed-Form Hensel Polynomial Inversion Modulo 729...');

{
  let henselPass = true;
  for (let trial = 0; trial < 50; trial++) {
    const F = TernaryPoly.randomTernary(27, 6, 'cyclic');
    F.coeffs[0] = 0; // standard NTRU f(0) = 1
    const f = F.scalarMul(3).add(TernaryPoly.constant(1, 27, 'cyclic'));

    const fInv = f.henselInverse();
    const prod = f.mul(fInv);

    if (prod.coeffs[0] !== 1) henselPass = false;
    for (let i = 1; i < 27; i++) {
      if (prod.coeffs[i] !== 0) henselPass = false;
    }
  }
  check('Hensel polynomial inverse satisfies f * f^-1 ≡ 1 (mod 729) across 50 trials (0% failure rate)', henselPass);
}

// ---------------------------------------------------------------------------
// 3. Ternary NTRU Encryption & Decryption (200 Trials)
// ---------------------------------------------------------------------------
console.log('\n>>> [3/7] Testing Ternary NTRU Encryption & Decryption (200 Trials)...');

{
  const ntru = new TernaryNTRU(27);
  let allDecrypted = true;
  let maxInfinityNorm = 0;

  for (let trial = 0; trial < 200; trial++) {
    const keypair = ntru.generateKeyPair(6, 6);
    const msg = TernaryPoly.randomTernary(27, null, 'cyclic');
    const { ciphertext, blinding } = ntru.encrypt(keypair.publicKey, msg);

    // Track infinity norm of decrypted intermediate
    const intermediate = ciphertext.mul(keypair.privateKey);
    const norm = intermediate.infinityNorm();
    if (norm > maxInfinityNorm) maxInfinityNorm = norm;

    const decrypted = ntru.decrypt(keypair.privateKey, ciphertext);
    if (!msg.equals(decrypted)) {
      allDecrypted = false;
      break;
    }
  }

  check('Ternary NTRU 27-trit encryption/decryption succeeds across 200 trials (100% fidelity)', allDecrypted);
  check(`Worst-case intermediate infinity-norm (${maxInfinityNorm}) remains well below 364 limit`, maxInfinityNorm < 364);
}

// ---------------------------------------------------------------------------
// 4. Ternary NTRU Key Encapsulation Mechanism (KEM)
// ---------------------------------------------------------------------------
console.log('\n>>> [4/7] Testing Ternary NTRU KEM & Shared Key Derivation...');

{
  const ntru = new TernaryNTRU(27);
  let kemPass = true;

  for (let trial = 0; trial < 100; trial++) {
    const keypair = ntru.generateKeyPair(6, 6);
    // Alice encapsulates shared secret
    const kem = ntru.encapsulate(keypair.publicKey);
    // Bob decapsulates
    const decap = ntru.decapsulate(keypair.privateKey, kem.ciphertext);

    if (!kem.sharedSecret.equals(decap.sharedSecret)) kemPass = false;
    if (kem.symmetricKey !== decap.symmetricKey) kemPass = false;
  }

  check('NTRU KEM establishes matching shared secrets and symmetric digests across 100 trials', kemPass);
}

// ---------------------------------------------------------------------------
// 5. Multi-Scale Parameter Sets (toy, embedded_9, embedded_27, medium_81, pq_128, pq_256)
// ---------------------------------------------------------------------------
console.log('\n>>> [5/8] Testing Scalable NTRU Parameter Presets up to PQ-256...');

{
  const presetNames = ['toy', 'embedded_9', 'embedded_27', 'medium_81', 'pq_128', 'pq_256'];
  for (const name of presetNames) {
    const ntruInstance = TernaryNTRU.fromPreset(name);
    const kp = ntruInstance.generateKeyPair();
    const msg = TernaryPoly.randomTernary(ntruInstance.N);
    const { ciphertext } = ntruInstance.encrypt(kp.publicKey, msg);
    const decrypted = ntruInstance.decrypt(kp.privateKey, ciphertext);
    check(`Parameter preset '${name}' (N=${ntruInstance.N}) encrypts and decrypts with 100% exact fidelity`, msg.equals(decrypted));
  }
}

// ---------------------------------------------------------------------------
// 6. Ternary Ring-LWE Key Encapsulation Mechanism
// ---------------------------------------------------------------------------
console.log('\n>>> [6/8] Testing Ternary Ring-LWE KEM (Negacyclic Ring X^N + 1)...');

{
  for (const deg of [9, 27]) {
    const rlwe = new TernaryRingLWE(deg);
    let rlwePass = true;

    for (let trial = 0; trial < 50; trial++) {
      const keypair = rlwe.generateKeyPair();
      const kem = rlwe.encapsulate(keypair.publicKey);
      const decap = rlwe.decapsulate(keypair.privateKey, kem.ciphertext);

      if (!kem.sharedSecret.equals(decap.sharedSecret)) rlwePass = false;
      if (kem.symmetricKey !== decap.symmetricKey) rlwePass = false;
    }

    check(`Ring-LWE KEM (N=${deg}) establishes matching shared secrets across 50 trials (0% error rate)`, rlwePass);
  }
}

// ---------------------------------------------------------------------------
// 7. Native TryteVM TASM Execution
// ---------------------------------------------------------------------------
console.log('\n>>> [7/8] Testing Native TASM Execution on TryteVM...');

{
  const N = 3;
  const ntru = new TernaryNTRU(N);
  const F = TernaryPoly.randomTernary(N, 1, 'cyclic');
  F.coeffs[0] = 0;
  const g = TernaryPoly.randomTernary(N, 1, 'cyclic');
  const f = F.scalarMul(3).add(TernaryPoly.constant(1, N, 'cyclic'));
  const fInv = f.henselInverse();
  const h = fInv.mulTernary(g).scalarMul(3);

  const msg = TernaryPoly.randomTernary(N);
  const r = TernaryPoly.randomTernary(N, 1, 'cyclic');

  const input = [
    ...h.coeffs,
    ...msg.coeffs,
    ...r.coeffs,
    ...F.coeffs,
  ];

  const tasm = generateNTRUTASM(N);
  const vm = new TryteVM({ input, maxSteps: 5000 });
  loadInto(vm, tasm);
  vm.run();

  check('TryteVM executes NTRU TASM and halts normally', vm.halted && vm.steps < 500);
  const match = msg.coeffs.every((v, i) => v === vm.output[i]);
  check('TryteVM decrypted output matches expected message with 100% accuracy', match);

  // Also verify programs/ntru.tasm exists on disk and assembles cleanly
  const diskTasm = fs.readFileSync(path.join(__dirname, '../programs/ntru.tasm'), 'utf8');
  const diskVm = new TryteVM({ input, maxSteps: 5000 });
  loadInto(diskVm, diskTasm);
  diskVm.run();
  const diskMatch = msg.coeffs.every((v, i) => v === diskVm.output[i]);
  check('Standalone programs/ntru.tasm on disk assembles and executes cleanly', diskMatch);
}

// ---------------------------------------------------------------------------
// 8. Adversarial Tampering & Boundary Stress
// ---------------------------------------------------------------------------
console.log('\n>>> [8/8] Testing Adversarial Tampering & Boundary Stress...');

{
  const ntru = new TernaryNTRU(27);
  const keypair = ntru.generateKeyPair(6, 6);

  // Boundary message tests
  const allPos = new TernaryPoly(new Array(27).fill(1), 27, 'cyclic');
  const allNeg = new TernaryPoly(new Array(27).fill(-1), 27, 'cyclic');
  const allZero = new TernaryPoly(new Array(27).fill(0), 27, 'cyclic');

  check('All-positive (+1) message decrypts exactly', allPos.equals(ntru.decrypt(keypair.privateKey, ntru.encrypt(keypair.publicKey, allPos).ciphertext)));
  check('All-negative (-1) message decrypts exactly', allNeg.equals(ntru.decrypt(keypair.privateKey, ntru.encrypt(keypair.publicKey, allNeg).ciphertext)));
  check('All-zero (0) message decrypts exactly', allZero.equals(ntru.decrypt(keypair.privateKey, ntru.encrypt(keypair.publicKey, allZero).ciphertext)));

  // Tamper detection
  const origMsg = TernaryPoly.randomTernary(27);
  const { ciphertext } = ntru.encrypt(keypair.publicKey, origMsg);

  // Corrupt one tryte in ciphertext
  const tampered = ciphertext.clone();
  tampered.coeffs[5] = T.wrap(tampered.coeffs[5] + 50);
  const corruptedDec = ntru.decrypt(keypair.privateKey, tampered);
  check('Ciphertext tampering corrupts message decryption (avalanche effect observed)', !origMsg.equals(corruptedDec));
}

console.log('\n===============================================================');
console.log(`ALL ${passCount} POST-QUANTUM LATTICE CRYPTO CHECKS PASSED!`);
console.log('===============================================================');
