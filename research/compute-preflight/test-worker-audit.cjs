'use strict';

// Registration-only checks. This file never invokes --run or starts timing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const audit = require('./worker-audit.cjs');

let checks = 0;
const check = (label, fn) => { fn(); checks++; console.log(`  [PASS] ${label}`); };
const source = fs.readFileSync(path.join(__dirname, 'worker-audit.cjs'), 'utf8');

check('synthetic scorer distinguishes held, failed, invalid and malformed receipts', () => {
  assert.match(audit.selfTest(), /fixtures passed/);
});
check('the command-line self-test executes without timing', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'worker-audit.cjs'), '--self-test'], {
    encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fixtures passed/);
});
check('two predictions each carry a concrete at-risk boundary', () => {
  assert.equal((source.match(/^ \*   AW\d /gm) || []).length, 2);
  assert.equal((source.match(/^ \*       AT RISK:/gm) || []).length, 2);
});
check('the registered host and compiler contract are frozen', () => {
  assert.deepEqual(audit.EXPECTED, {
    hostname: 'node-ecd2b9', platform: 'linux', arch: 'x64',
    cpuPattern: 'AMD Ryzen 7 5825U', logicalCpus: 16,
  });
  assert.deepEqual(audit.FLAGS, ['-std=c++17', '-O3', '-march=znver3']);
});
check('each frozen preflight condition can independently refuse timing', () => {
  const healthy = {
    registration: 'a'.repeat(40), head: 'a'.repeat(40), dirtyBefore: '', artifactsRegistered: true,
    governorsBefore: { policy0: 'powersave', policy1: 'powersave' },
    host: {
      hostname: 'node-ecd2b9', platform: 'linux', arch: 'x64', cpu: 'AMD Ryzen 7 5825U with Radeon Graphics',
      logical_cpus: 16, lscpu: 'Flags: avx2 popcnt',
    },
  };
  assert.equal(audit.assessPreflight(healthy).valid, true);
  const mutations = [
    value => { value.head = 'b'.repeat(40); },
    value => { value.dirtyBefore = ' M native.cpp'; },
    value => { value.artifactsRegistered = false; },
    value => { value.host.hostname = 'node-other'; },
    value => { value.host.platform = 'win32'; },
    value => { value.host.arch = 'arm64'; },
    value => { value.host.cpu = 'not the registered CPU'; },
    value => { value.host.logical_cpus = 8; },
    value => { value.host.lscpu = 'Flags: popcnt'; },
    value => { value.host.lscpu = 'Flags: avx2'; },
    value => { value.governorsBefore = null; },
    value => { value.governorsBefore.policy1 = null; },
  ];
  for (const mutate of mutations) {
    const specimen = JSON.parse(JSON.stringify(healthy));
    mutate(specimen);
    assert.equal(audit.assessPreflight(specimen).valid, false);
  }
});
check('final status cannot bypass preflight, postflight, or governor validity', () => {
  const healthy = {
    preflight: { valid: true }, timing_started: true,
    analysis: { instrument_valid: true }, postflight: { valid: true },
    self_test: { exit: 0 }, execution: { exit: 0 },
    before: { governors: { policy0: 'powersave', policy1: 'powersave' } },
    after: { governors: { policy0: 'powersave', policy1: 'powersave' } },
  };
  assert.equal(audit.decideStatus(healthy), 'VALID');
  const refused = JSON.parse(JSON.stringify(healthy)); refused.preflight.valid = false;
  assert.equal(audit.decideStatus(refused), 'REFUSED');
  const driftedTree = JSON.parse(JSON.stringify(healthy)); driftedTree.postflight.valid = false;
  assert.equal(audit.decideStatus(driftedTree), 'INVALID');
  const driftedGovernor = JSON.parse(JSON.stringify(healthy)); driftedGovernor.after.governors.policy1 = 'performance';
  assert.equal(audit.decideStatus(driftedGovernor), 'INVALID');
  const failedCleanup = JSON.parse(JSON.stringify(healthy)); failedCleanup.cleanup_error = ['leftover'];
  assert.equal(audit.decideStatus(failedCleanup), 'INVALID');
  const failedSelfTest = JSON.parse(JSON.stringify(healthy)); failedSelfTest.self_test.exit = 1;
  assert.equal(audit.decideStatus(failedSelfTest), 'INVALID');
  const failedExecution = JSON.parse(JSON.stringify(healthy)); failedExecution.execution.exit = 1;
  assert.equal(audit.decideStatus(failedExecution), 'INVALID');
});

console.log(`ALL ${checks} CHECKS PASSED`);
