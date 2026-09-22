'use strict';
/* ---------------------------------------------------------------------------
 * crypto.js — Balanced Ternary Cryptographic & Non-Linear Primitives
 * ---------------------------------------------------------------------------
 * Implements:
 *   1. Non-linear balanced ternary S-Box (crypto_sbox_9)
 *   2. Iterative ternary cryptographic hash compression (ternary_hash_step)
 *   3. Turing-complete ternary cellular automaton (ternary_rule_110)
 *   4. Direct execution on TryteVM via Arsenal circuits
 * ------------------------------------------------------------------------- */

const { getCircuit, runCircuit } = require('../quantum/src/arsenal.js');
const T = require('./ternary.js');

/**
 * Applies the 9-element non-linear S-Box to inputs (x, y) in {-1, 0, 1}.
 */
function sbox(x, y) {
  const c = getCircuit('crypto_sbox_9');
  if (!c) throw new Error('crypto_sbox_9 not registered in Arsenal');
  const idx = (T.lowTrit(x) + 1) * 3 + (T.lowTrit(y) + 1);
  return c.truth_table[idx];
}

/**
 * Computes an iterative balanced ternary hash over an array of trits.
 * Mixes state with message blocks using the non-linear ternary_hash_step table.
 * @param {number[]} trits - Array of trits in {-1, 0, 1}
 * @param {number} iv - Initial state trit (default 0)
 * @returns {number} 1-trit final digest in {-1, 0, 1}
 */
function hashTernary(trits, iv = 0) {
  const c = getCircuit('ternary_hash_step');
  if (!c) throw new Error('ternary_hash_step not registered in Arsenal');

  let state = T.lowTrit(iv);
  for (const m of trits) {
    const idx = (state + 1) * 3 + (T.lowTrit(m) + 1);
    state = c.truth_table[idx];
  }
  return state;
}

/**
 * Steps a 1D periodic ring of balanced ternary trits under Ternary Rule 110.
 * @param {number[]} state - Array of trits representing the cellular grid
 * @param {number} steps - Number of time steps to evolve
 * @returns {number[]} New state after evolution
 */
function stepCellularAutomaton(state, steps = 1) {
  const c = getCircuit('ternary_rule_110');
  if (!c) throw new Error('ternary_rule_110 not registered in Arsenal');
  const tbl = c.truth_table;
  const n = state.length;
  let cur = state.map(T.lowTrit);

  for (let s = 0; s < steps; s++) {
    const next = new Array(n);
    for (let i = 0; i < n; i++) {
      const left = cur[(i - 1 + n) % n];
      const center = cur[i];
      const right = cur[(i + 1) % n];
      // Index in 27-row table: (left+1)*9 + (center+1)*3 + (right+1)
      const idx = (left + 1) * 9 + (center + 1) * 3 + (right + 1);
      next[i] = tbl[idx];
    }
    cur = next;
  }
  return cur;
}

module.exports = {
  sbox,
  hashTernary,
  stepCellularAutomaton,
};
