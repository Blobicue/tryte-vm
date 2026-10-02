'use strict';
/* ---------------------------------------------------------------------------
 * certifier.js — Tryte-QOS Lean 4 Proof Certification Engine
 * ---------------------------------------------------------------------------
 * Interfaces with Lean 4 to certify and verify mathematical correctness
 * of grokked circuits in the Arsenal of Compute.
 * ------------------------------------------------------------------------- */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getCircuit, loadArsenal } = require('./arsenal.js');

const ROOT = path.resolve(__dirname, '../..');
const CERT_DIR = path.join(ROOT, 'quantum', 'lean', 'Certificates');

/**
 * Runs Lean 4 certification for a given circuit signature.
 * @param {string} signature
 * @returns {object} { signature, certified, certificateFile, theorem }
 */
function certifyCircuit(signature) {
  const pyCmd = `python3 -m research.arsenal.arsenal_certifier "${signature}"`;
  try {
    const out = execSync(pyCmd, { cwd: ROOT, encoding: 'utf8' });
    const c = getCircuit(signature);
    return {
      signature,
      certified: !!c?.lean_certified,
      certificateFile: c?.lean_certificate,
      theorem: c?.lean_theorem,
      output: out.trim(),
    };
  } catch (err) {
    throw new Error(`Certification failed for '${signature}': ${err.stderr || err.message}`);
  }
}

/**
 * Runs Lean 4 certification across all circuits in the Arsenal.
 * @returns {Array<object>}
 */
function certifyAll() {
  const pyCmd = `python3 -m research.arsenal.arsenal_certifier --all`;
  try {
    const out = execSync(pyCmd, { cwd: ROOT, encoding: 'utf8' });
    const arsenal = loadArsenal();
    const results = Object.values(arsenal.circuits || {}).map((c) => ({
      signature: c.signature,
      certified: !!c.lean_certified,
      certificateFile: c.lean_certificate,
      theorem: c.lean_theorem,
    }));
    return { results, rawOutput: out };
  } catch (err) {
    throw new Error(`Certification failed: ${err.stderr || err.message}`);
  }
}

/**
 * Checks if a circuit has a verified Lean 4 certificate.
 */
function isLeanCertified(signature) {
  const c = getCircuit(signature);
  return Boolean(c && c.lean_certified);
}

module.exports = {
  certifyCircuit,
  certifyAll,
  isLeanCertified,
};
