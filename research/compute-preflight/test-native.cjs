'use strict';

// NOT REGISTERED: derived correctness and instrument mutation checks only.
// This command never starts --bench. Root owns empirical registration and runs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function run(exe, args, options = {}) {
  const result = spawnSync(exe, args, {
    encoding: 'utf8', timeout: 60000, windowsHide: true, ...options,
  });
  assert.equal(result.error, undefined, `${exe}: ${result.error}`);
  return result;
}

function main() {
  const compiler = process.env.CXX || 'g++';
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tryte-native-preflight-'));
  const source = path.join(__dirname, 'native.cpp');
  const executable = path.join(temporary, process.platform === 'win32' ? 'native.exe' : 'native');
  const mutant = path.join(temporary, process.platform === 'win32' ? 'mutant.exe' : 'mutant');
  const timedMutant = path.join(temporary, process.platform === 'win32' ? 'timed-mutant.exe' : 'timed-mutant');
  const flags = ['-std=c++17', '-O3', '-march=znver3'];
  let checks = 0;
  const check = (fn) => { fn(); checks++; };
  try {
    const compile = run(compiler, [...flags, source, '-o', executable]);
    check(() => assert.equal(compile.status, 0, compile.stderr));
    const result = run(executable, ['--self-test']);
    check(() => assert.equal(result.status, 0, result.stderr));
    const receipt = JSON.parse(result.stdout);
    check(() => assert.equal(receipt.schema, 'compute-preflight-native/v1'));
    check(() => assert.equal(receipt.mode, 'self-test'));
    check(() => assert.equal(receipt.correct, true));
    check(() => assert.equal(receipt.timing_measured, false));
    check(() => assert(Number.isSafeInteger(receipt.checks) && receipt.checks > 0));
    for (const args of [[], ['--unknown'], ['--bench'], ['--bench', '--seed', '-1'],
      ['--bench', '--seed', '0'], ['--bench', '--seed', '4294967296'],
      ['--bench', '--seed', '1.5'], ['--self-test', 'extra']]) {
      const bad = run(executable, args);
      check(() => assert.notEqual(bad.status, 0, `accepted ${JSON.stringify(args)}`));
      check(() => assert.match(bad.stderr, /preflight refused:/));
    }
    const altered = run(compiler, [...flags, '-DCOMPUTE_PREFLIGHT_MUTATE_DUAL_SIGN', source, '-o', mutant]);
    check(() => assert.equal(altered.status, 0, altered.stderr));
    const broken = run(mutant, ['--self-test']);
    check(() => assert.notEqual(broken.status, 0, 'subject mutation was not detected'));
    check(() => assert.match(broken.stderr, /packed\/oracle mismatch/));
    const alteredTimed = run(compiler, [...flags, '-DCOMPUTE_PREFLIGHT_MUTATE_TIMED_CHECK', source, '-o', timedMutant]);
    check(() => assert.equal(alteredTimed.status, 0, alteredTimed.stderr));
    const brokenTimed = run(timedMutant, ['--self-test']);
    check(() => assert.notEqual(brokenTimed.status, 0, 'timed-output guard mutation was not detected'));
    check(() => assert.match(brokenTimed.stderr, /timed result check accepted corruption/));
    // Healthy traffic is the unmutated executable, run again after the mutant.
    const healthy = run(executable, ['--self-test']);
    check(() => assert.equal(healthy.status, 0, healthy.stderr));
    console.log(JSON.stringify({ schema: 'compute-preflight-native-test/v1', correct: true,
      checks, native_checks: receipt.checks, subject_mutation_caught: true,
      timed_output_mutation_caught: true,
      timing_measured: false, compiler, flags }));
  } finally {
    const resolved = path.resolve(temporary);
    const root = path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved), root, 'cleanup must stay in exact temporary child');
    assert(path.basename(resolved).startsWith('tryte-native-preflight-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

if (require.main === module) main();
