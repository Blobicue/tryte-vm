'use strict';
/* ---------------------------------------------------------------------------
 * multiprecision.js — Arbitrary-Precision Balanced Ternary Arithmetic
 * ---------------------------------------------------------------------------
 * Provides:
 *   - Conversion between JS BigInt and balanced ternary words/trits
 *   - Multi-word balanced ternary addition, subtraction, and negation
 *   - Verified carry-ripple algorithms for TryteVM
 *   - TASM code emission for multi-precision carry chains (TOPC & ADD)
 * ------------------------------------------------------------------------- */

const T = require('./ternary.js');

const TRITS_PER_WORD = 6;
const WORD_RADIX = 729n; // 3^6
const HALF_RADIX = 364n; // (729 - 1) / 2

/**
 * Converts a JS BigInt or Number to an array of balanced trits {-1, 0, 1}.
 * Least significant trit first.
 */
function toWideTrits(value, minWidth = 0) {
  let v = BigInt(value);
  const trits = [];

  while (v !== 0n) {
    let rem = Number(((v % 3n) + 3n) % 3n);
    if (rem === 2) rem = -1;
    trits.push(rem);
    v = (v - BigInt(rem)) / 3n;
  }

  while (trits.length < minWidth) {
    trits.push(0);
  }

  return trits.length ? trits : [0];
}

/**
 * Converts an array of balanced trits {-1, 0, 1} back to a JS BigInt.
 * Least significant trit first.
 */
function fromWideTrits(trits) {
  let acc = 0n;
  let weight = 1n;
  for (let i = 0; i < trits.length; i++) {
    acc += BigInt(trits[i]) * weight;
    weight *= 3n;
  }
  return acc;
}

/**
 * Converts a JS BigInt to an array of 6-trit tryte words (least significant first).
 * Each word is in [-364 .. 364].
 */
function toTrytes(value, wordCount = 0) {
  let v = BigInt(value);
  const words = [];

  while (v !== 0n) {
    // Balanced modulo 729
    let rem = Number(((v % WORD_RADIX) + WORD_RADIX) % WORD_RADIX);
    if (rem > 364) rem -= 729;
    words.push(rem);
    v = (v - BigInt(rem)) / WORD_RADIX;
  }

  while (words.length < wordCount) {
    words.push(0);
  }

  return words.length ? words : [0];
}

/**
 * Converts an array of 6-trit tryte words back to a JS BigInt.
 */
function fromTrytes(words) {
  let acc = 0n;
  let weight = 1n;
  for (let i = 0; i < words.length; i++) {
    acc += BigInt(words[i]) * weight;
    weight *= WORD_RADIX;
  }
  return acc;
}

/**
 * Adds two multi-word balanced ternary numbers with full carry ripple.
 * @param {number[]} xWords - Array of trytes for X (least-sig first)
 * @param {number[]} yWords - Array of trytes for Y (least-sig first)
 * @returns {{ sum: number[], carryOut: number, value: bigint }}
 */
function addWide(xWords, yWords) {
  const len = Math.max(xWords.length, yWords.length);
  const sum = [];
  let cin = 0;

  for (let i = 0; i < len; i++) {
    const x = xWords[i] || 0;
    const y = yWords[i] || 0;
    const s = x + y + cin;
    const r = T.wrap(s);
    sum.push(r);
    cin = (s - r) / 729;
  }

  return {
    sum,
    carryOut: cin,
    value: fromTrytes(sum),
  };
}

/**
 * Subtracts Y from X (X - Y) with full borrow ripple.
 */
function subWide(xWords, yWords) {
  const negY = yWords.map((w) => -w);
  return addWide(xWords, negY);
}

/**
 * Generates an unrolled TASM multi-word addition program for N words.
 * Reads X words and Y words from input, ripples carries, and emits sum words to OUT.
 */
function generateWideAddTASM(wordCount = 2) {
  let asm = `; --- Multi-Precision Addition (${wordCount} words / ${wordCount * 6} trits) ---
; Read X words (x0 .. x${wordCount - 1})
`;
  for (let i = 0; i < wordCount; i++) {
    asm += `        IN\n        STORE x${i}\n`;
  }
  asm += `; Read Y words (y0 .. y${wordCount - 1})\n`;
  for (let i = 0; i < wordCount; i++) {
    asm += `        IN\n        STORE y${i}\n`;
  }

  asm += `; Initialize carry\n        LOADI 0\n        STORE c0\n\n`;

  for (let i = 0; i < wordCount; i++) {
    asm += `; --- Word ${i} Stage ---
        LOAD  x${i}
        ADD   y${i}
        ADD   c${i}
        STORE r${i}

        ; Detect Carry Out c${i + 1}
        ; Compute exact s = x${i} + y${i} + c${i}
        LOAD  x${i}
        BR3   chk_x_${i}
chk_x_${i}: .table x_neg_${i}, c_zero_${i}, x_pos_${i}

x_pos_${i}:
        LOAD  y${i}
        BR3   chk_y_pos_${i}
chk_y_pos_${i}: .table chk_cin_pos_${i}, chk_cin_pos_${i}, carry_pos_cand_${i}

carry_pos_cand_${i}:
        LOAD  r${i}
        BR3   chk_r_pos_${i}
chk_r_pos_${i}: .table carry_pos_${i}, carry_pos_${i}, c_zero_${i}

chk_cin_pos_${i}:
        LOAD  c${i}
        BR3   chk_c_only_pos_${i}
chk_c_only_pos_${i}: .table c_zero_${i}, c_zero_${i}, chk_r_pos_cin_${i}

chk_r_pos_cin_${i}:
        LOAD  r${i}
        BR3   chk_r_cin_pos_${i}
chk_r_cin_pos_${i}: .table carry_pos_${i}, carry_pos_${i}, c_zero_${i}

x_neg_${i}:
        LOAD  y${i}
        BR3   chk_y_neg_${i}
chk_y_neg_${i}: .table carry_neg_cand_${i}, chk_cin_neg_${i}, chk_cin_neg_${i}

carry_neg_cand_${i}:
        LOAD  r${i}
        BR3   chk_r_neg_${i}
chk_r_neg_${i}: .table c_zero_${i}, carry_neg_${i}, carry_neg_${i}

chk_cin_neg_${i}:
        LOAD  c${i}
        BR3   chk_c_only_neg_${i}
chk_c_only_neg_${i}: .table chk_r_neg_cin_${i}, c_zero_${i}, c_zero_${i}

chk_r_neg_cin_${i}:
        LOAD  r${i}
        BR3   chk_r_cin_neg_${i}
chk_r_cin_neg_${i}: .table c_zero_${i}, carry_neg_${i}, carry_neg_${i}

carry_pos_${i}:
        LOADI 1
        STORE c${i + 1}
        JMP   step_end_${i}

carry_neg_${i}:
        LOADI -1
        STORE c${i + 1}
        JMP   step_end_${i}

c_zero_${i}:
        LOADI 0
        STORE c${i + 1}

step_end_${i}:
`;
  }

  asm += `; Emit outputs\n`;
  for (let i = 0; i < wordCount; i++) {
    asm += `        LOAD  r${i}\n        OUT\n`;
  }
  asm += `; Emit final carry out\n        LOAD  c${wordCount}\n        OUT\n        HALT\n\n`;

  // Variables
  for (let i = 0; i < wordCount; i++) {
    asm += `x${i}:     .word 0\ny${i}:     .word 0\nr${i}:     .word 0\nc${i}:     .word 0\n`;
  }
  asm += `c${wordCount}:     .word 0\n`;

  return asm;
}

module.exports = {
  TRITS_PER_WORD,
  WORD_RADIX,
  HALF_RADIX,
  toWideTrits,
  fromWideTrits,
  toTrytes,
  fromTrytes,
  addWide,
  subWide,
  generateWideAddTASM,
};
