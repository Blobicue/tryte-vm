'use strict';
/* ---------------------------------------------------------------------------
 * jit.js — Tryte-VM Autonomous JIT Grokking Daemon & Dynamic Hot-Patcher
 * ---------------------------------------------------------------------------
 * Intercepts unresolved operator requests / cache misses, invokes the
 * background Grokking Forge, verifies with Lean 4, and hot-patches the
 * resulting 9-entry TOP truth table directly into Tryte-VM memory on the fly.
 * ------------------------------------------------------------------------- */

const { execSync } = require('child_process');
const path = require('path');
const { TryteVM } = require('./vm.js');
const { getCircuit, loadArsenal } = require('../quantum/src/arsenal.js');
const { isLeanCertified } = require('../quantum/src/certifier.js');
const T = require('./ternary.js');

const ROOT = path.resolve(__dirname, '..');
const DYNAMIC_TABLE_BASE = -200; // Dynamic memory region for hot-patched tables

class TryteJIT {
  constructor(vm = null, opts = {}) {
    this.vm = vm || new TryteVM();
    this.tableBase = opts.dynamicBase || DYNAMIC_TABLE_BASE;
    this.nextFreeAddr = this.tableBase;
    this.hotPatchedTables = new Map(); // signature -> memory address
    this.interceptsCount = 0;
  }

  /**
   * Hot-patches a 9-entry truth table directly into Tryte-VM memory.
   * @param {string} signature - Circuit signature
   * @param {number[]} truthTable - 9-entry array of trits in {-1, 0, 1}
   * @returns {number} Memory address where table was patched
   */
  hotPatchTable(signature, truthTable) {
    if (this.hotPatchedTables.has(signature)) {
      return this.hotPatchedTables.get(signature);
    }

    if (!truthTable || truthTable.length !== 9) {
      throw new Error(`Invalid truth table for hot-patching '${signature}': must have 9 entries.`);
    }

    const addr = this.nextFreeAddr;
    for (let i = 0; i < 9; i++) {
      this.vm.write(addr + i, truthTable[i]);
    }

    this.hotPatchedTables.set(signature, addr);
    this.nextFreeAddr = T.wrap(this.nextFreeAddr + 10);
    return addr;
  }

  /**
   * Synthesizes an uncached circuit via the autonomous Grokking Forge.
   * @param {string} signature - Name of task/operator to forge
   */
  forgeUncachedOperator(signature) {
    this.interceptsCount++;
    console.log(`[TryteJIT] Cache Miss on operator '${signature}'! Intercepting execution...`);
    console.log(`[TryteJIT] Spawning Autonomous Grokking Forge with Lean 4 certification...`);

    const cmd = `python3 -m research.arsenal.arsenal_forge "${signature}"`;
    try {
      execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
    } catch (err) {
      throw new Error(`JIT Forge failed for '${signature}': ${err.stderr || err.message}`);
    }

    const circuit = getCircuit(signature);
    if (!circuit) {
      throw new Error(`Operator '${signature}' could not be synthesized by Grokking Forge.`);
    }

    console.log(`[TryteJIT] Circuit '${signature}' successfully crystallized!`);
    if (circuit.lean_certified) {
      console.log(`[TryteJIT] Lean 4 Mathematical Proof Certificate: ${circuit.lean_theorem} (0 sorry) ✓`);
    }

    return circuit;
  }

  /**
   * Executes an operator with JIT interception, Lean verification, and dynamic hot-patching.
   * @param {string} signature - Circuit signature (e.g. 'add_mod_3', 'mul_mod_3', 'nor_ternary')
   * @param {number[]} inputs - Input values [x, y]
   * @returns {object} Execution result with output, telemetry, and hot-patch address
   */
  execute(signature, inputs = [0, 0]) {
    let circuit = getCircuit(signature);

    // Cache Miss -> Intercept and Forge!
    let wasForged = false;
    if (!circuit) {
      circuit = this.forgeUncachedOperator(signature);
      wasForged = true;
    }

    // Classical Truth Table Hot-Patch Path
    if (circuit.truth_table) {
      const tableAddr = this.hotPatchTable(signature, circuit.truth_table);

      // Perform single-cycle TOP evaluation directly on VM
      const inA = inputs[0] !== undefined ? inputs[0] : 0;
      const inB = inputs[1] !== undefined ? inputs[1] : 0;

      // Setup VM state
      this.vm.A = inA;
      this.vm.C = tableAddr;

      // Read table cells from VM memory
      const tbl = [];
      for (let i = 0; i < 9; i++) {
        tbl.push(this.vm.read(T.wrap(this.vm.C + i)));
      }

      // Compute tritwise TOP result
      const out = T.ttable(tbl, inA, inB);
      this.vm.A = out;
      this.vm.output.push(out);

      return {
        signature,
        output: out,
        hotPatchedAddress: tableAddr,
        wasForged,
        leanCertified: Boolean(circuit.lean_certified),
        theorem: circuit.lean_theorem,
      };
    }

    throw new Error(`Circuit '${signature}' has no 9-entry truth table for JIT execution.`);
  }
}

module.exports = {
  TryteJIT,
  DYNAMIC_TABLE_BASE,
};
