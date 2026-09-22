'use strict';
/* ---------------------------------------------------------------------------
 * arsenal.js — Tryte-QOS Arsenal of Compute Runtime Engine
 * ---------------------------------------------------------------------------
 * Dispatches and executes grokked circuits, truth tables, and anyon braids
 * directly on the Tryte-VM CPU (src/vm.js) or the Quantum Kernel (vTQPU).
 * ------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');
const { assemble, loadInto } = require('../../src/assembler.js');
const { TryteVM } = require('../../src/vm.js');
const { encodeBraidProgram } = require('./binary-format.js');
const { evaluateBraid } = require('./fibonacci.js');
const { evaluateBraid3 } = require('./unified-compiler.js');

const ROOT = path.resolve(__dirname, '../..');
const CACHE_PATH = path.join(ROOT, 'research', 'arsenal', 'circuit_cache.json');

function loadArsenal() {
  if (!fs.existsSync(CACHE_PATH)) {
    return { version: '1.0.0', circuits: {} };
  }
  return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
}

function listCircuits() {
  const cache = loadArsenal();
  return Object.values(cache.circuits || {});
}

function getCircuit(signature) {
  const cache = loadArsenal();
  return cache.circuits ? cache.circuits[signature] : null;
}

/**
 * Executes an Arsenal circuit on Tryte-VM or Quantum Kernel.
 * @param {string} signature - Circuit signature
 * @param {number[]} inputArgs - Array of input numbers
 */
function runCircuit(signature, inputArgs = []) {
  const circuit = getCircuit(signature);
  if (!circuit) {
    throw new Error(`Circuit '${signature}' not found in Arsenal.`);
  }

  // Path 1: Classical Tryte Assembly execution via Tryte-VM
  if (circuit.tasm) {
    const vm = new TryteVM({ input: inputArgs.map(Number) });
    loadInto(vm, circuit.tasm);
    vm.run();

    return {
      type: 'tryte_vm',
      signature,
      kind: circuit.kind,
      output: vm.output,
      steps: vm.steps,
      halted: vm.halted,
    };
  }

  // Path 2: Quantum Anyon Braid execution in SU(2) or SU(3)
  if (circuit.braid_word) {
    let mat;
    if (circuit.domain === 'SU(2)') {
      mat = evaluateBraid(circuit.braid_word);
    } else {
      mat = evaluateBraid3(circuit.braid_word);
    }

    return {
      type: 'quantum_qutrit',
      signature,
      kind: circuit.kind,
      braidWord: circuit.braid_word,
      unitaryMatrix: mat.toString(),
      isUnitary: mat.isUnitary(),
    };
  }

  throw new Error(`Circuit '${signature}' has no executable TASM or Braid definition.`);
}

/**
 * Exports a cached circuit to a file.
 */
function exportCircuit(signature, outPath, format = null) {
  const circuit = getCircuit(signature);
  if (!circuit) throw new Error(`Circuit '${signature}' not found.`);

  const fmt = format || (outPath.endsWith('.braid') ? 'braid' : 'tasm');

  if (fmt === 'tasm') {
    if (!circuit.tasm) throw new Error(`Circuit '${signature}' has no TASM code.`);
    fs.writeFileSync(outPath, circuit.tasm, 'utf8');
    return { format: 'tasm', path: outPath };
  } else if (fmt === 'braid') {
    const word = circuit.braid_word || [];
    const buf = encodeBraidProgram({
      name: signature,
      word,
      type: circuit.domain === 'SU(2)' ? 0x01 : 0x02,
    });
    fs.writeFileSync(outPath, buf);
    return { format: 'braid', path: outPath, crossings: word.length };
  }

  throw new Error(`Unsupported format: ${fmt}`);
}

module.exports = {
  loadArsenal,
  listCircuits,
  getCircuit,
  runCircuit,
  exportCircuit,
};
