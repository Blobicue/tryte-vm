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
    exactValue: fromTrytes(cin === 0 ? sum : [...sum, cin]),
  };
}

/**
 * Subtracts Y from X (X - Y) with full borrow ripple.
 */
function subWide(xWords, yWords) {
  const negY = yWords.map((w) => -w);
  return addWide(xWords, negY);
}

let waddInstanceCounter = 0;

/**
 * Generates an unrolled TASM multi-word addition program for N words.
 * Reads X words and Y words from input, ripples carries via 2-step balanced carry detection,
 * and emits sum words + final carry out to OUT.
 * Accepts an optional label prefix to avoid symbol collisions when chaining adders.
 */
function generateWideAddTASM(wordCount = 2, prefix = null) {
  const pfx = prefix !== null ? prefix : `wadd_${++waddInstanceCounter}_`;
  let asm = `; --- Multi-Precision Addition (${wordCount} words / ${wordCount * 6} trits) ---
; Read X words (${pfx}x0 .. ${pfx}x${wordCount - 1})
`;
  for (let i = 0; i < wordCount; i++) {
    asm += `        IN\n        STORE ${pfx}x${i}\n`;
  }
  asm += `; Read Y words (${pfx}y0 .. ${pfx}y${wordCount - 1})\n`;
  for (let i = 0; i < wordCount; i++) {
    asm += `        IN\n        STORE ${pfx}y${i}\n`;
  }

  asm += `; Initialize carry\n        LOADI 0\n        STORE ${pfx}c0\n\n`;

  for (let i = 0; i < wordCount; i++) {
    asm += `; --- Word ${i} Stage (2-Step Balanced Carry) ---
        ; Step 1: w_${i} = wrap(x_${i} + y_${i})
        LOAD  ${pfx}x${i}
        ADD   ${pfx}y${i}
        STORE ${pfx}w${i}

        ; Detect cxy: +1 if (x>0 && y>0 && w<0), -1 if (x<0 && y<0 && w>0), else 0
        LOAD  ${pfx}x${i}
        BR3   ${pfx}chk_x_${i}
${pfx}chk_x_${i}: .table ${pfx}x_neg_${i}, ${pfx}cxy_zero_${i}, ${pfx}x_pos_${i}

${pfx}x_pos_${i}:
        LOAD  ${pfx}y${i}
        BR3   ${pfx}chk_y_pos_${i}
${pfx}chk_y_pos_${i}: .table ${pfx}cxy_zero_${i}, ${pfx}cxy_zero_${i}, ${pfx}chk_w_pos_${i}

${pfx}chk_w_pos_${i}:
        LOAD  ${pfx}w${i}
        BR3   ${pfx}chk_w_pos_br_${i}
${pfx}chk_w_pos_br_${i}: .table ${pfx}cxy_pos_${i}, ${pfx}cxy_zero_${i}, ${pfx}cxy_zero_${i}

${pfx}x_neg_${i}:
        LOAD  ${pfx}y${i}
        BR3   ${pfx}chk_y_neg_${i}
${pfx}chk_y_neg_${i}: .table ${pfx}chk_w_neg_${i}, ${pfx}cxy_zero_${i}, ${pfx}cxy_zero_${i}

${pfx}chk_w_neg_${i}:
        LOAD  ${pfx}w${i}
        BR3   ${pfx}chk_w_neg_br_${i}
${pfx}chk_w_neg_br_${i}: .table ${pfx}cxy_zero_${i}, ${pfx}cxy_zero_${i}, ${pfx}cxy_neg_${i}

${pfx}cxy_pos_${i}:
        LOADI 1
        STORE ${pfx}cxy_${i}
        JMP   ${pfx}step1_done_${i}

${pfx}cxy_neg_${i}:
        LOADI -1
        STORE ${pfx}cxy_${i}
        JMP   ${pfx}step1_done_${i}

${pfx}cxy_zero_${i}:
        LOADI 0
        STORE ${pfx}cxy_${i}

${pfx}step1_done_${i}:
        ; Step 2: r_${i} = wrap(w_${i} + c_${i})
        LOAD  ${pfx}w${i}
        ADD   ${pfx}c${i}
        STORE ${pfx}r${i}

        ; Detect cwc: +1 if (c=1 && w=364), -1 if (c=-1 && w=-364), else 0
        LOAD  ${pfx}c${i}
        BR3   ${pfx}chk_c_${i}
${pfx}chk_c_${i}: .table ${pfx}chk_c_neg_${i}, ${pfx}cwc_zero_${i}, ${pfx}chk_c_pos_${i}

${pfx}chk_c_pos_${i}:
        LOAD  ${pfx}w${i}
        ADDI  -364
        BR3   ${pfx}chk_w_is_364_${i}
${pfx}chk_w_is_364_${i}: .table ${pfx}cwc_zero_${i}, ${pfx}cwc_pos_${i}, ${pfx}cwc_zero_${i}

${pfx}chk_c_neg_${i}:
        LOAD  ${pfx}w${i}
        ADDI  364
        BR3   ${pfx}chk_w_is_neg_364_${i}
${pfx}chk_w_is_neg_364_${i}: .table ${pfx}cwc_zero_${i}, ${pfx}cwc_neg_${i}, ${pfx}cwc_zero_${i}

${pfx}cwc_pos_${i}:
        LOADI 1
        STORE ${pfx}cwc_${i}
        JMP   ${pfx}step2_done_${i}

${pfx}cwc_neg_${i}:
        LOADI -1
        STORE ${pfx}cwc_${i}
        JMP   ${pfx}step2_done_${i}

${pfx}cwc_zero_${i}:
        LOADI 0
        STORE ${pfx}cwc_${i}

${pfx}step2_done_${i}:
        ; Total Carry: c_${i+1} = cxy_${i} + cwc_${i}
        LOAD  ${pfx}cxy_${i}
        ADD   ${pfx}cwc_${i}
        STORE ${pfx}c${i + 1}
`;
  }

  asm += `; Emit outputs\n`;
  for (let i = 0; i < wordCount; i++) {
    asm += `        LOAD  ${pfx}r${i}\n        OUT\n`;
  }
  asm += `; Emit final carry out\n        LOAD  ${pfx}c${wordCount}\n        OUT\n        HALT\n\n`;

  // Variables
  for (let i = 0; i < wordCount; i++) {
    asm += `${pfx}x${i}:     .word 0\n${pfx}y${i}:     .word 0\n${pfx}w${i}:     .word 0\n${pfx}r${i}:     .word 0\n${pfx}c${i}:     .word 0\n${pfx}cxy_${i}:   .word 0\n${pfx}cwc_${i}:   .word 0\n`;
  }
  asm += `${pfx}c${wordCount}:     .word 0\n`;

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
