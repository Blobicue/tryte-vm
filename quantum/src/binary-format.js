'use strict';
/* ---------------------------------------------------------------------------
 * binary-format.js — Tryte-QOS Executable Binary Format (.braid)
 * ---------------------------------------------------------------------------
 * Serializes and deserializes compiled anyon braid streams into a native,
 * compact binary format for execution by the Tryte-QOS virtual kernel (vTQPU).
 * ------------------------------------------------------------------------- */

const fs = require('fs');

const MAGIC = Buffer.from([0x54, 0x51, 0x4F, 0x53]); // 'TQOS'
const VERSION = 0x01;

const PROGRAM_TYPES = {
  CLASSICAL_TERNARY: 0x01,
  QUANTUM_QUTRIT: 0x02,
  HYBRID_TOPOLOGICAL: 0x03,
};

/**
 * Packs an array of signed generator indices into a compact Buffer.
 * Generator values: ±1, ±2, ±3
 * Each generator crossing is encoded into 4 bits (nibble):
 *   bits [3]: sign (0 = positive (+1), 1 = negative (-1))
 *   bits [2..0]: generator index (1, 2, or 3)
 * Two crossings per byte!
 */
function packBraidWord(word) {
  const numCrossings = word.length;
  const numBytes = Math.ceil(numCrossings / 2);
  const buf = Buffer.alloc(numBytes);

  for (let i = 0; i < numCrossings; i++) {
    const gen = word[i];
    const signBit = gen < 0 ? 1 : 0;
    const absGen = Math.abs(gen) & 0x07;
    const nibble = (signBit << 3) | absGen;

    const byteIdx = Math.floor(i / 2);
    if (i % 2 === 0) {
      buf[byteIdx] = (nibble << 4);
    } else {
      buf[byteIdx] |= nibble;
    }
  }
  return buf;
}

/**
 * Unpacks a compact Buffer back into an array of signed generator indices.
 */
function unpackBraidWord(buf, numCrossings) {
  const word = [];
  for (let i = 0; i < numCrossings; i++) {
    const byteIdx = Math.floor(i / 2);
    const byte = buf[byteIdx];
    const nibble = (i % 2 === 0) ? ((byte >> 4) & 0x0F) : (byte & 0x0F);

    const signBit = (nibble >> 3) & 0x01;
    const absGen = nibble & 0x07;
    const gen = signBit === 1 ? -absGen : absGen;
    word.push(gen);
  }
  return word;
}

/**
 * Serialize a Tryte-QOS program into a .braid binary Buffer.
 */
function encodeBraidProgram(program) {
  const {
    name = 'untitled',
    type = PROGRAM_TYPES.QUANTUM_QUTRIT,
    qutritCount = 1,
    tryteRegisterCount = 1,
    word = [],
  } = program;

  const nameBuf = Buffer.from(name.slice(0, 31), 'utf8');
  const nameLen = nameBuf.length;

  const packedBraid = packBraidWord(word);
  const wordLength = word.length;

  // Header layout:
  // [0..3]: Magic 'TQOS' (4 bytes)
  // [4]: Version (1 byte)
  // [5]: Program Type (1 byte)
  // [6]: Qutrit Count (1 byte)
  // [7]: Tryte Register Count (1 byte)
  // [8..9]: Word Length (2 bytes, Uint16 BE)
  // [10]: Name Length (1 byte)
  // [11 .. 11+nameLen-1]: Program Name
  // [...]: Packed Braid Stream
  // [last 2 bytes]: Simple 16-bit additive checksum

  const headerLen = 11 + nameLen;
  const totalLen = headerLen + packedBraid.length + 2;
  const buf = Buffer.alloc(totalLen);

  MAGIC.copy(buf, 0);
  buf.writeUInt8(VERSION, 4);
  buf.writeUInt8(typeof type === 'number' ? type : (PROGRAM_TYPES[type] || 0x02), 5);
  buf.writeUInt8(qutritCount, 6);
  buf.writeUInt8(tryteRegisterCount, 7);
  buf.writeUInt16BE(wordLength, 8);
  buf.writeUInt8(nameLen, 10);
  nameBuf.copy(buf, 11);

  packedBraid.copy(buf, headerLen);

  // Compute 16-bit checksum
  let checksum = 0;
  for (let i = 0; i < totalLen - 2; i++) {
    checksum = (checksum + buf[i]) & 0xFFFF;
  }
  buf.writeUInt16BE(checksum, totalLen - 2);

  return buf;
}

/**
 * Deserialize a .braid binary Buffer into a Tryte-QOS program.
 */
function decodeBraidProgram(buf) {
  if (buf.length < 13) throw new Error('Buffer too small for valid Tryte-QOS binary');

  // Verify Magic
  if (!buf.subarray(0, 4).equals(MAGIC)) {
    throw new Error('Invalid magic header: expected TQOS');
  }

  const version = buf.readUInt8(4);
  const typeByte = buf.readUInt8(5);
  const qutritCount = buf.readUInt8(6);
  const tryteRegisterCount = buf.readUInt8(7);
  const wordLength = buf.readUInt16BE(8);
  const nameLen = buf.readUInt8(10);

  const headerLen = 11 + nameLen;
  const name = buf.subarray(11, headerLen).toString('utf8');

  // Verify Checksum
  const storedChecksum = buf.readUInt16BE(buf.length - 2);
  let computedChecksum = 0;
  for (let i = 0; i < buf.length - 2; i++) {
    computedChecksum = (computedChecksum + buf[i]) & 0xFFFF;
  }
  if (storedChecksum !== computedChecksum) {
    throw new Error(`Checksum mismatch: expected ${storedChecksum}, got ${computedChecksum}`);
  }

  const packedBraid = buf.subarray(headerLen, buf.length - 2);
  const word = unpackBraidWord(packedBraid, wordLength);

  let typeName = 'UNKNOWN';
  for (const [k, v] of Object.entries(PROGRAM_TYPES)) {
    if (v === typeByte) typeName = k;
  }

  return {
    name,
    version,
    type: typeName,
    qutritCount,
    tryteRegisterCount,
    wordLength,
    word,
  };
}

function saveBraidFile(filePath, program) {
  const buf = encodeBraidProgram(program);
  fs.writeFileSync(filePath, buf);
  return buf.length;
}

function loadBraidFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return decodeBraidProgram(buf);
}

module.exports = {
  PROGRAM_TYPES,
  packBraidWord,
  unpackBraidWord,
  encodeBraidProgram,
  decodeBraidProgram,
  saveBraidFile,
  loadBraidFile,
};
