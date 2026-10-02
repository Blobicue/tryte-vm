'use strict';
/* ---------------------------------------------------------------------------
 * test-secure-channel.js — Comprehensive Post-Quantum Secure Channel Test Battery
 * ---------------------------------------------------------------------------
 * Tests:
 *   1. Trit modular arithmetic & group laws over Z_3
 *   2. Non-linear Key Derivation Function (KDF)
 *   3. Ternary AEAD stream cipher & 9-lane MAC authentication
 *   4. Tamper detection: ciphertext, associated data, and IV corruption
 *   5. Anti-replay protection: sequence counter verification
 *   6. Full Post-Quantum Handshake across presets (embedded_27, pq_128, pq_256)
 *   7. Bi-directional secure packet transport (Client <-> Server)
 *   8. Hardware TryteVM execution of programs/secure_microkernel.tasm
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const T = require('../src/ternary.js');
const {
  addTritMod3,
  subTritMod3,
  deriveSessionKeys,
  generateKeystream,
  computeMAC,
  TernaryAEAD,
  SecureServerSession,
  SecureClientSession,
} = require('../src/secure_channel.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto } = require('../src/assembler.js');

console.log('===============================================================');
console.log('TESTING TRYTE-QOS POST-QUANTUM SECURE COMMUNICATIONS CHANNEL');
console.log('===============================================================\n');

let passCount = 0;
function check(title, condition) {
  assert(condition, `FAILED: ${title}`);
  console.log(`  ✓ ${title}`);
  passCount++;
}

// ---------------------------------------------------------------------------
// 1. Trit Modular Group Operations
// ---------------------------------------------------------------------------
console.log('>>> [1/8] Testing Balanced Trit Group Operations over Z_3...');

{
  const trits = [-1, 0, 1];
  let invPass = true;
  for (const m of trits) {
    for (const k of trits) {
      const c = addTritMod3(m, k);
      const dec = subTritMod3(c, k);
      if (dec !== m) invPass = false;
    }
  }
  check('Stream cipher involution subT(addT(m, k), k) = m holds over all 9 trit pairs', invPass);

  let commPass = true;
  for (const a of trits) {
    for (const b of trits) {
      if (addTritMod3(a, b) !== addTritMod3(b, a)) commPass = false;
    }
  }
  check('Keystream addition is commutative across all pairs', commPass);
}

// ---------------------------------------------------------------------------
// 2. Non-Linear Key Derivation Function (KDF)
// ---------------------------------------------------------------------------
console.log('\n>>> [2/8] Testing Non-Linear Key Derivation Function (KDF)...');

{
  const secret = [1, -1, 0, 1, 0, -1, 1, 1, 0, -1, 0, 1, 1, -1, 0, 0, 1, -1, 1, 0, -1, 0, 1, -1, 1, 0, -1];
  const keys1 = deriveSessionKeys(secret, [1, 0, -1]);
  const keys2 = deriveSessionKeys(secret, [1, 0, -1]);

  check('KDF produces deterministic 27-trit kEnc, 27-trit kMac, and 9-trit iv',
    keys1.kEnc.length === 27 && keys1.kMac.length === 27 && keys1.iv.length === 9);

  check('Identical secret and salt produce identical session keys',
    keys1.kEnc.every((v, i) => v === keys2.kEnc[i]) &&
    keys1.kMac.every((v, i) => v === keys2.kMac[i]) &&
    keys1.iv.every((v, i) => v === keys2.iv[i]));

  // Distinctness of derived keys
  const encVsMacMatch = keys1.kEnc.every((v, i) => v === keys1.kMac[i]);
  check('kEnc and kMac are cryptographically distinct', !encVsMacMatch);
}

// ---------------------------------------------------------------------------
// 3. Ternary AEAD Stream Cipher & Authentication
// ---------------------------------------------------------------------------
console.log('\n>>> [3/8] Testing Ternary AEAD Stream Cipher & Authentication...');

{
  const kEnc = Array.from({ length: 27 }, () => Math.floor(Math.random() * 3) - 1);
  const kMac = Array.from({ length: 27 }, () => Math.floor(Math.random() * 3) - 1);
  const iv = Array.from({ length: 9 }, () => Math.floor(Math.random() * 3) - 1);

  let aeadPass = true;
  for (let trial = 0; trial < 100; trial++) {
    const len = Math.floor(Math.random() * 50) + 1;
    const plaintext = Array.from({ length: len }, () => Math.floor(Math.random() * 3) - 1);
    const ad = [1, -1, 0];

    const encrypted = TernaryAEAD.encrypt(plaintext, kEnc, kMac, iv, ad, trial);
    const decrypted = TernaryAEAD.decrypt(encrypted.ciphertext, encrypted.tag, kEnc, kMac, iv, ad, trial);

    if (!plaintext.every((v, i) => v === decrypted[i])) {
      aeadPass = false;
      break;
    }
  }

  check('AEAD round-trip encryption/decryption succeeds across 100 random trials (100% fidelity)', aeadPass);
}

// ---------------------------------------------------------------------------
// 4. Tamper Detection & Integrity Verification
// ---------------------------------------------------------------------------
console.log('\n>>> [4/8] Testing Tamper Detection & Integrity Verification...');

{
  const kEnc = Array.from({ length: 27 }, () => Math.floor(Math.random() * 3) - 1);
  const kMac = Array.from({ length: 27 }, () => Math.floor(Math.random() * 3) - 1);
  const iv = Array.from({ length: 9 }, () => Math.floor(Math.random() * 3) - 1);

  const plaintext = [1, -1, 0, 1, 1, -1, 0, 1];
  const ad = [1, 0, -1];
  const enc = TernaryAEAD.encrypt(plaintext, kEnc, kMac, iv, ad, 0);

  // Test 1: Tamper with ciphertext
  let tamperedCiphertextDetected = false;
  try {
    const corruptedC = [...enc.ciphertext];
    corruptedC[0] = corruptedC[0] === 1 ? -1 : 1;
    TernaryAEAD.decrypt(corruptedC, enc.tag, kEnc, kMac, iv, ad, 0);
  } catch (err) {
    if (err.message.includes('TAMPERING_DETECTED')) tamperedCiphertextDetected = true;
  }
  check('Corrupted ciphertext is rejected by MAC tag verification', tamperedCiphertextDetected);

  // Test 2: Tamper with Associated Data
  let tamperedAdDetected = false;
  try {
    const corruptedAd = [0, 0, -1];
    TernaryAEAD.decrypt(enc.ciphertext, enc.tag, kEnc, kMac, iv, corruptedAd, 0);
  } catch (err) {
    if (err.message.includes('TAMPERING_DETECTED')) tamperedAdDetected = true;
  }
  check('Corrupted associated data is rejected by MAC tag verification', tamperedAdDetected);

  // Test 3: Tamper with IV
  let tamperedIvDetected = false;
  try {
    const corruptedIv = [...iv];
    corruptedIv[0] = corruptedIv[0] === 1 ? -1 : 1;
    TernaryAEAD.decrypt(enc.ciphertext, enc.tag, kEnc, kMac, corruptedIv, ad, 0);
  } catch (err) {
    if (err.message.includes('TAMPERING_DETECTED')) tamperedIvDetected = true;
  }
  check('Mismatched IV is rejected by MAC tag verification', tamperedIvDetected);
}

// ---------------------------------------------------------------------------
// 5. Anti-Replay Protection
// ---------------------------------------------------------------------------
console.log('\n>>> [5/8] Testing Anti-Replay Protection...');

{
  const server = new SecureServerSession('embedded_27');
  const client = new SecureClientSession('embedded_27');
  const sInit = server.init();
  const cInit = client.initiateHandshake(sInit.publicKey);
  server.completeHandshake(cInit.kemCiphertext);

  const packet1 = client.send([1, 0, -1]);
  server.receive(packet1); // Valid receive: increments server.rxSeq to 1

  let replayDetected = false;
  try {
    server.receive(packet1); // Replay packet1 with seqNo = 0
  } catch (err) {
    if (err.message.includes('REPLAY_ATTACK_DETECTED')) replayDetected = true;
  }
  check('Replayed frame with old sequence number is blocked with REPLAY_ATTACK_DETECTED', replayDetected);
}

// ---------------------------------------------------------------------------
// 6. Post-Quantum Handshake across NTRU Presets
// ---------------------------------------------------------------------------
console.log('\n>>> [6/8] Testing Post-Quantum Handshake across Presets (embedded_27, pq_128, pq_256)...');

{
  const presets = ['embedded_27', 'pq_128', 'pq_256'];
  for (const preset of presets) {
    const server = new SecureServerSession(preset);
    const client = new SecureClientSession(preset);

    const sInit = server.init();
    const cInit = client.initiateHandshake(sInit.publicKey);
    server.completeHandshake(cInit.kemCiphertext);

    check(`Post-Quantum Handshake establishes matching session keys for preset '${preset}'`,
      server.sessionKeys.kEnc.every((v, i) => v === client.sessionKeys.kEnc[i]) &&
      server.sessionKeys.kMac.every((v, i) => v === client.sessionKeys.kMac[i]));
  }
}

// ---------------------------------------------------------------------------
// 7. Bi-Directional Packet Transport
// ---------------------------------------------------------------------------
console.log('\n>>> [7/8] Testing Bi-Directional Packet Transport (Client <-> Server)...');

{
  const server = new SecureServerSession('embedded_27');
  const client = new SecureClientSession('embedded_27');
  server.completeHandshake(client.initiateHandshake(server.init().publicKey).kemCiphertext);

  // Client -> Server
  const c2sMsg = [1, 1, -1, 0, 1];
  const c2sPkt = client.send(c2sMsg, [1]);
  const sReceived = server.receive(c2sPkt, [1]);
  check('Client-to-Server packet successfully transmitted and decrypted', c2sMsg.every((v, i) => v === sReceived[i]));

  // Server -> Client
  const s2cMsg = [-1, -1, 0, 0, 1, 1];
  const s2cPkt = server.send(s2cMsg, [0]);
  const cReceived = client.receive(s2cPkt, [0]);
  check('Server-to-Client packet successfully transmitted and decrypted', s2cMsg.every((v, i) => v === cReceived[i]));
}

// ---------------------------------------------------------------------------
// 8. Native Hardware TryteVM Execution: Secure Microkernel IPC
// ---------------------------------------------------------------------------
console.log('\n>>> [8/8] Testing Hardware TryteVM Execution (programs/secure_microkernel.tasm)...');

{
  const src = fs.readFileSync(path.join(__dirname, '../programs/secure_microkernel.tasm'), 'utf8');
  const vm = new TryteVM({ maxSteps: 5000 });
  loadInto(vm, src);
  vm.run();

  check('Secure microkernel runs on TryteVM and halts normally', vm.halted && vm.steps < 1000);
  const expectedMsg = [1, -1, 1];
  const match = expectedMsg.every((v, i) => v === vm.output[i]);
  check('Process 1 transmitted encrypted payload over IPC mailbox; Process 2 decrypted and verified exactly [1, -1, 1]', match);
}

console.log('\n===============================================================');
console.log(`ALL ${passCount} POST-QUANTUM SECURE CHANNEL CHECKS PASSED!`);
console.log('===============================================================');
