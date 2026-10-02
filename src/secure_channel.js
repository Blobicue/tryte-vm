'use strict';
/* ---------------------------------------------------------------------------
 * secure_channel.js — Native Post-Quantum Secure Communications Channel
 * ---------------------------------------------------------------------------
 * Implements:
 *   1. Post-Quantum KEM Handshake via Ternary NTRU
 *   2. Non-Linear Key Derivation Function (KDF) using Rule 110 & hashTernary
 *   3. Ternary AEAD Stream Cipher with Non-Linear S-Box Mixing
 *   4. Multi-Trit Balanced Message Authentication Code (MAC)
 *   5. End-to-End Secure Client & Server Sessions with Anti-Replay Protection
 * ------------------------------------------------------------------------- */

const T = require('./ternary.js');
const { TernaryNTRU, TernaryPoly } = require('./lattice_crypto.js');
const { sbox, hashTernary, stepCellularAutomaton } = require('./crypto.js');

/**
 * Balanced ternary modular addition over Z_3 ({-1, 0, 1}).
 */
function addTritMod3(a, b) {
  let s = T.lowTrit(a) + T.lowTrit(b);
  if (s > 1) s -= 3;
  if (s < -1) s += 3;
  return s;
}

/**
 * Balanced ternary modular subtraction over Z_3 ({-1, 0, 1}).
 */
function subTritMod3(a, b) {
  let s = T.lowTrit(a) - T.lowTrit(b);
  if (s > 1) s -= 3;
  if (s < -1) s += 3;
  return s;
}

/**
 * Key Derivation Function (KDF):
 * Derives encryption key (kEnc), authentication key (kMac), and IV from shared secret K.
 * @param {number[]} sharedSecretTrits - Array of trits in {-1, 0, 1}
 * @param {number[]} salt - Optional salt trits
 * @returns {{ kEnc: number[], kMac: number[], iv: number[] }}
 */
function deriveSessionKeys(sharedSecretTrits, salt = []) {
  const N = Math.max(27, sharedSecretTrits.length);
  // Pad or wrap into 27-trit cellular grid
  const grid = new Array(27).fill(0);
  for (let i = 0; i < sharedSecretTrits.length; i++) {
    const s = salt[i % salt.length] || 0;
    grid[i % 27] = addTritMod3(grid[i % 27] + sharedSecretTrits[i], s);
  }

  // Step 1: Evolve Rule 110 grid by 4 steps for high non-linear mixing -> kEnc
  const state1 = stepCellularAutomaton(grid, 4);
  const kEnc = [...state1];

  // Step 2: Evolve further and mix through S-box -> kMac
  const state2 = stepCellularAutomaton(state1, 4);
  const kMac = new Array(27);
  for (let i = 0; i < 27; i++) {
    kMac[i] = sbox(state2[i], state1[i]);
  }

  // Step 3: Evolve further for 9-trit initial vector (IV)
  const state3 = stepCellularAutomaton(state2, 3);
  const iv = state3.slice(0, 9);

  return { kEnc, kMac, iv };
}

/**
 * Keystream Generator:
 * Generates arbitrary-length pseudo-random ternary keystream from (kEnc, iv, counter).
 */
function generateKeystream(kEnc, iv, length, counter = 0) {
  const grid = new Array(27).fill(0);
  for (let i = 0; i < 27; i++) {
    const ivTrit = iv[i % iv.length];
    const cntTrit = T.lowTrit(Math.floor(counter / (3 ** (i % 3))));
    grid[i] = addTritMod3(addTritMod3(kEnc[i], ivTrit), cntTrit);
  }

  const keystream = [];
  let cur = grid;

  while (keystream.length < length) {
    // Step Rule 110 cellular automaton
    cur = stepCellularAutomaton(cur, 1);
    for (let i = 0; i < 27 && keystream.length < length; i++) {
      const left = cur[i];
      const right = cur[(i + 1) % 27];
      // Non-linear S-box extraction
      const ksTrit = sbox(left, right);
      keystream.push(ksTrit);
    }
  }

  return keystream;
}

/**
 * Computes a 9-trit Message Authentication Code (MAC) over a transcript.
 * @param {number[]} kMac - Authentication key
 * @param {number[]} iv - Initial vector
 * @param {number[]} associatedData - Associated metadata trits
 * @param {number[]} ciphertext - Ciphertext trits
 * @param {number} seqNo - Sequence counter
 * @returns {number[]} 9-trit MAC tag
 */
function computeMAC(kMac, iv, associatedData = [], ciphertext = [], seqNo = 0) {
  const tag = new Array(9).fill(0);
  const seqTrits = [
    T.lowTrit(seqNo),
    T.lowTrit(Math.floor(seqNo / 3)),
    T.lowTrit(Math.floor(seqNo / 9)),
  ];

  const transcript = [
    ...kMac,
    ...seqTrits,
    ...associatedData,
    ...ciphertext,
  ];

  // 9 independent hashing lanes initialized with IV offsets
  for (let lane = 0; lane < 9; lane++) {
    const laneIV = addTritMod3(iv[lane % iv.length], lane - 4);
    tag[lane] = hashTernary(transcript, laneIV);
  }

  return tag;
}

/**
 * Ternary Authenticated Encryption with Associated Data (AEAD).
 */
class TernaryAEAD {
  /**
   * Encrypts plaintext trits with authenticated tag.
   */
  static encrypt(plaintextTrits, kEnc, kMac, iv, associatedData = [], seqNo = 0) {
    const P = plaintextTrits.map(T.lowTrit);
    const KS = generateKeystream(kEnc, iv, P.length, seqNo);

    // Symmetric balanced ternary stream encryption: C_i = (P_i + KS_i) mod 3
    const ciphertext = new Array(P.length);
    for (let i = 0; i < P.length; i++) {
      ciphertext[i] = addTritMod3(P[i], KS[i]);
    }

    const tag = computeMAC(kMac, iv, associatedData, ciphertext, seqNo);

    return {
      ciphertext,
      tag,
      seqNo,
    };
  }

  /**
   * Decrypts and authenticates ciphertext trits.
   * Throws Error if MAC tag does not match.
   */
  static decrypt(ciphertextTrits, tag, kEnc, kMac, iv, associatedData = [], seqNo = 0) {
    const C = ciphertextTrits.map(T.lowTrit);
    const expectedTag = computeMAC(kMac, iv, associatedData, C, seqNo);

    // Constant-time tag comparison
    let tagDiff = 0;
    for (let i = 0; i < expectedTag.length; i++) {
      if (expectedTag[i] !== tag[i]) {
        tagDiff++;
      }
    }

    if (tagDiff !== 0) {
      throw new Error(`TAMPERING_DETECTED: Authentication tag mismatch (${tagDiff} trit differences)`);
    }

    const KS = generateKeystream(kEnc, iv, C.length, seqNo);

    // Symmetric balanced ternary decryption: P_i = (C_i - KS_i) mod 3
    const plaintext = new Array(C.length);
    for (let i = 0; i < C.length; i++) {
      plaintext[i] = subTritMod3(C[i], KS[i]);
    }

    return plaintext;
  }
}

/**
 * Post-Quantum Secure Channel Session (Server side).
 */
class SecureServerSession {
  constructor(presetName = 'embedded_27') {
    this.ntru = TernaryNTRU.fromPreset(presetName);
    this.keypair = null;
    this.sessionKeys = null;
    this.rxSeq = 0;
    this.txSeq = 0;
    this.state = 'UNINITIALIZED';
  }

  init() {
    this.keypair = this.ntru.generateKeyPair();
    this.state = 'AWAITING_CLIENT_KEM';
    return {
      publicKey: this.keypair.publicKey,
    };
  }

  completeHandshake(kemCiphertext, salt = []) {
    if (this.state !== 'AWAITING_CLIENT_KEM') {
      throw new Error(`Invalid state: expected AWAITING_CLIENT_KEM, got ${this.state}`);
    }

    const { sharedSecret } = this.ntru.decapsulate(this.keypair.privateKey, kemCiphertext);
    this.sessionKeys = deriveSessionKeys(sharedSecret.coeffs, salt);
    this.state = 'ESTABLISHED';

    return {
      status: 'HANDSHAKE_COMPLETE',
    };
  }

  send(plaintextTrits, associatedData = []) {
    if (this.state !== 'ESTABLISHED') throw new Error('Channel not established');
    const seq = this.txSeq++;
    return TernaryAEAD.encrypt(
      plaintextTrits,
      this.sessionKeys.kEnc,
      this.sessionKeys.kMac,
      this.sessionKeys.iv,
      associatedData,
      seq
    );
  }

  receive(packet, associatedData = []) {
    if (this.state !== 'ESTABLISHED') throw new Error('Channel not established');
    if (packet.seqNo !== this.rxSeq) {
      throw new Error(`REPLAY_ATTACK_DETECTED: Expected sequence ${this.rxSeq}, got ${packet.seqNo}`);
    }

    const plaintext = TernaryAEAD.decrypt(
      packet.ciphertext,
      packet.tag,
      this.sessionKeys.kEnc,
      this.sessionKeys.kMac,
      this.sessionKeys.iv,
      associatedData,
      packet.seqNo
    );

    this.rxSeq++;
    return plaintext;
  }
}

/**
 * Post-Quantum Secure Channel Session (Client side).
 */
class SecureClientSession {
  constructor(presetName = 'embedded_27') {
    this.ntru = TernaryNTRU.fromPreset(presetName);
    this.sessionKeys = null;
    this.rxSeq = 0;
    this.txSeq = 0;
    this.state = 'UNINITIALIZED';
  }

  initiateHandshake(serverPublicKey, salt = []) {
    const kem = this.ntru.encapsulate(serverPublicKey);
    this.sessionKeys = deriveSessionKeys(kem.sharedSecret.coeffs, salt);
    this.state = 'ESTABLISHED';

    return {
      kemCiphertext: kem.ciphertext,
    };
  }

  send(plaintextTrits, associatedData = []) {
    if (this.state !== 'ESTABLISHED') throw new Error('Channel not established');
    const seq = this.txSeq++;
    return TernaryAEAD.encrypt(
      plaintextTrits,
      this.sessionKeys.kEnc,
      this.sessionKeys.kMac,
      this.sessionKeys.iv,
      associatedData,
      seq
    );
  }

  receive(packet, associatedData = []) {
    if (this.state !== 'ESTABLISHED') throw new Error('Channel not established');
    if (packet.seqNo !== this.rxSeq) {
      throw new Error(`REPLAY_ATTACK_DETECTED: Expected sequence ${this.rxSeq}, got ${packet.seqNo}`);
    }

    const plaintext = TernaryAEAD.decrypt(
      packet.ciphertext,
      packet.tag,
      this.sessionKeys.kEnc,
      this.sessionKeys.kMac,
      this.sessionKeys.iv,
      associatedData,
      packet.seqNo
    );

    this.rxSeq++;
    return plaintext;
  }
}

module.exports = {
  addTritMod3,
  subTritMod3,
  deriveSessionKeys,
  generateKeystream,
  computeMAC,
  TernaryAEAD,
  SecureServerSession,
  SecureClientSession,
};
