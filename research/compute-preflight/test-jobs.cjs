'use strict';

/* NOT REGISTERED: finite contract, mutation and owned-process fault checks.
 * No timing comparison, LAN/authentication claim, durable restart claim, or
 * proof of physical execution follows from a passing result.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const J = require('./jobs.cjs');
let checks = 0;
function check(name, fn) { fn(); ++checks; }
function throwsCode(fn, code) { assert.throws(fn, error => error.code === code); }
function prepared(subject = J, seed = null) {
  const controller = new subject.Controller();
  const jobId = controller.submit(J.encodeJob([1, 0, -1], [-1, 1, -1], seed));
  const dispatch = controller.begin(jobId);
  return { controller, jobId, dispatch };
}
function loadMutant(before, after) {
  const source = fs.readFileSync(require.resolve('./jobs.cjs'), 'utf8');
  assert.equal(source.split(before).length, 2, 'mutation must hit exactly one subject location');
  const module = { exports: {} };
  vm.runInNewContext('(function(require,module,exports,__filename){' + source.replace(before, after) + '\n})',
    { Buffer, process, console, setTimeout, clearTimeout })(require, module, module.exports, require.resolve('./jobs.cjs'));
  return module.exports;
}

async function main() {
  check('instrument reports wrong hand answer', () => assert.throws(() => assert.equal(2, 3)));
  check('independent oracle hand values and all local products', () => {
    for (const a of [-1, 0, 1]) for (const w of [-1, 0, 1]) {
      const job = J.validateJob(JSON.parse(J.encodeJob([a], [w])));
      assert.equal(J.controllerOutput(job).sum, a * w === 0 ? 0 : a * w);
    }
    assert.deepEqual(J.controllerOutput(J.validateJob(JSON.parse(J.encodeJob([1, -1, 1], [-1, 1, 1])))), { sum: -1 });
  });
  check('empty and maximum vectors preserve wide integer sums', () => {
    for (const width of [0, 1, J.LIMITS.width]) for (const sign of [-1, 1]) {
      const c = new J.Controller(), id = c.submit(J.encodeJob(Array(width).fill(1), Array(width).fill(sign)));
      const d = c.begin(id), expected = width === 0 ? 0 : sign * width;
      assert.equal(c.admit(J.receiptFor(d, { sum: expected })).output.sum, expected);
    }
  });
  check('canonical key order, content identity and immutable caller data', () => {
    const c = new J.Controller(), inputs = [1], weights = [-1];
    const raw = J.encodeJob(inputs, weights), id = c.submit(raw);
    const reversed = Object.fromEntries(Object.entries(JSON.parse(raw)).reverse());
    assert.equal(c.submit(JSON.stringify(reversed)), id);
    inputs[0] = -1; weights[0] = 1;
    assert.equal(JSON.parse(c.begin(id)).job.inputs[0], 1);
    const changedInput = JSON.parse(raw); changedInput.inputs[0] = -1;
    const changedWeight = JSON.parse(raw); changedWeight.weights[0] = 1;
    assert.notEqual(c.submit(JSON.stringify(changedInput)), id);
    assert.notEqual(c.submit(JSON.stringify(changedWeight)), id);
    assert.notEqual(c.submit(J.encodeJob([1], [-1], 1)), id);
  });
  check('jobs refuse bad wire, field, semantics, seed, trit and shape values', () => {
    const raw = J.encodeJob([1], [1]), c = new J.Controller();
    throwsCode(() => c.submit({}), 'WIRE_STRING_REQUIRED');
    throwsCode(() => c.submit('{'), 'MALFORMED_JSON');
    throwsCode(() => c.submit(' '.repeat(J.LIMITS.jobBytes + 1)), 'WIRE_TOO_LARGE');
    for (const extra of ['command', 'path', 'code']) {
      const v = JSON.parse(raw); v[extra] = 'not dispatchable';
      throwsCode(() => c.submit(JSON.stringify(v)), 'JOB_FIELDS');
    }
    for (const field of ['version', 'workload', 'arithmetic']) {
      const v = JSON.parse(raw); v[field] += '-changed';
      throwsCode(() => c.submit(JSON.stringify(v)), 'JOB_CONTRACT');
    }
    for (const bad of [null, 2, 0.5, '1', true]) {
      const v = JSON.parse(raw); v.inputs = [bad];
      throwsCode(() => c.submit(JSON.stringify(v)), 'TRIT_VALUE');
    }
    throwsCode(() => c.submit(raw.replace('"inputs":[1]', '"inputs":[-0]')), 'TRIT_VALUE');
    for (const seed of [-1, 0x100000000, 0.5, '0']) throwsCode(() => J.encodeJob([], [], seed), 'JOB_SEED');
    throwsCode(() => J.encodeJob([1], []), 'JOB_SHAPE');
    throwsCode(() => J.encodeJob(Array(J.LIMITS.width + 1).fill(0), []), 'TRIT_WIDTH');
    const missing = JSON.parse(raw); delete missing.seed;
    throwsCode(() => c.submit(JSON.stringify(missing)), 'JOB_FIELDS');
  });
  check('submission and retry budgets are finite', () => {
    const c = new J.Controller();
    for (let seed = 0; seed < J.LIMITS.jobs; ++seed) c.submit(J.encodeJob([], [], seed));
    throwsCode(() => c.submit(J.encodeJob([], [], J.LIMITS.jobs)), 'JOB_LIMIT');
    const id = c.submit(J.encodeJob([], [], 0));
    throwsCode(() => c.begin('unknown'), 'UNKNOWN_JOB');
    for (let i = 0; i < J.LIMITS.attempts; ++i) c.begin(id);
    throwsCode(() => c.begin(id), 'ATTEMPT_LIMIT');
  });
  check('stale retry, wrong job, invalid fields, output and digest fail closed', () => {
    const { controller: c, jobId: id, dispatch: d } = prepared();
    const good = JSON.parse(J.receiptFor(d, { sum: 0 }));
    const wrongJob = { ...good, jobId: 'f'.repeat(64) };
    throwsCode(() => c.admit(JSON.stringify(wrongJob)), 'UNKNOWN_JOB');
    const extra = { ...good, command: 'not dispatchable' };
    throwsCode(() => c.admit(JSON.stringify(extra)), 'RECEIPT_FIELDS');
    throwsCode(() => c.admit(' '.repeat(J.LIMITS.receiptBytes + 1)), 'WIRE_TOO_LARGE');
    throwsCode(() => c.admit(JSON.stringify({ ...good, attempt: 3 })), 'RECEIPT_ID');
    throwsCode(() => c.admit(JSON.stringify({ ...good, outputHash: '0'.repeat(64) })), 'OUTPUT_HASH');
    throwsCode(() => c.admit(JSON.stringify({ ...good, output: { sum: 4 } })), 'OUTPUT_RANGE');
    // A correctly hashed lie is still a lie: hash checking alone is insufficient.
    throwsCode(() => c.admit(J.receiptFor(d, { sum: 1 })), 'WRONG_OUTPUT');
    assert.equal(c.acceptedCount, 0);
    const retry = c.begin(id);
    throwsCode(() => c.admit(JSON.stringify(good)), 'STALE_ATTEMPT');
    const accepted = c.admit(J.receiptFor(retry, { sum: 0 }));
    assert.equal(accepted.output.sum, 0);
    throwsCode(() => c.admit(J.receiptFor(retry, { sum: 0 })), 'DUPLICATE_RECEIPT');
    throwsCode(() => c.begin(id), 'ALREADY_ACCEPTED');
    assert.equal(c.acceptedCount, 1);
  });
  check('changed job cannot reuse a receipt, even for the same numeric output', () => {
    const p = prepared(), c = new J.Controller();
    const changedId = c.submit(J.encodeJob([1, 0, -1], [-1, 1, -1], 9)); c.begin(changedId);
    throwsCode(() => c.admit(J.receiptFor(p.dispatch, { sum: 0 })), 'UNKNOWN_JOB');
    const d = JSON.parse(p.dispatch); d.job.inputs[0] = -1;
    throwsCode(() => J.validateDispatch(JSON.stringify(d)), 'DISPATCH_CONTENT');
  });
  check('dispatch and receipt envelopes reject malformed or noncanonical state', () => {
    const p = prepared(), d = JSON.parse(p.dispatch);
    for (const field of ['jobId', 'attempt']) {
      const bad = { ...d, [field]: [d[field]] };
      throwsCode(() => J.validateDispatch(JSON.stringify(bad)), 'DISPATCH_ID');
    }
    throwsCode(() => J.validateDispatch(' '.repeat(J.LIMITS.frameBytes + 1)), 'WIRE_TOO_LARGE');
    throwsCode(() => p.controller.admit('{'), 'MALFORMED_JSON');
    const r = J.receiptFor(p.dispatch, { sum: 0 });
    throwsCode(() => p.controller.admit(r.replace('"sum":0', '"sum":-0')), 'OUTPUT_RANGE');
    throwsCode(() => p.controller.admit(r.replace('"sum":0', '"sum":0.5')), 'OUTPUT_RANGE');
    throwsCode(() => J.runChildAttempt(p.dispatch), 'CONTROLLER_REQUIRED');
    throwsCode(() => J.runChildAttempt(p.dispatch, { controller: p.controller, fault: 'command' }), 'UNKNOWN_FAULT');
    throwsCode(() => J.runChildAttempt(p.dispatch, { controller: p.controller, timeoutMs: J.LIMITS.timeoutMs + 1 }), 'TIMEOUT_RANGE');
  });
  check('cancellation is exact-attempt, idempotent and preserves healthy later work', () => {
    const p = prepared();
    assert.equal(p.controller.cancel(p.dispatch), true);
    assert.equal(p.controller.cancel(p.dispatch), false);
    throwsCode(() => p.controller.admit(J.receiptFor(p.dispatch, { sum: 0 })), 'STALE_ATTEMPT');
    throwsCode(() => J.runChildAttempt(p.dispatch, { controller: p.controller }), 'STALE_ATTEMPT');
    const retry = p.controller.begin(p.jobId);
    assert.equal(p.controller.cancel(p.dispatch), false);
    assert.equal(p.controller.admit(J.receiptFor(retry, { sum: 0 })).output.sum, 0);
    assert.equal(p.controller.cancel(retry), false);
    assert.equal(p.controller.acceptedCount, 1);
  });
  check('subject mutation: independent recomputation gate is load-bearing', () => {
    const mutant = loadMutant("if (output.sum !== expected.sum) fail('WRONG_OUTPUT');", '/* recomputation gate removed */');
    const p = prepared(mutant);
    assert.throws(() => throwsCode(() => p.controller.admit(J.receiptFor(p.dispatch, { sum: 1 })), 'WRONG_OUTPUT'));
  });
  check('subject mutation: attempt invalidation gate is load-bearing', () => {
    const mutant = loadMutant("if (v.attempt !== record.current) fail('STALE_ATTEMPT');", '/* stale-attempt gate removed */');
    const p = prepared(mutant); p.controller.begin(p.jobId);
    assert.throws(() => throwsCode(() => p.controller.admit(J.receiptFor(p.dispatch, { sum: 0 })), 'STALE_ATTEMPT'));
  });
  check('subject mutation: commit-once gate is load-bearing', () => {
    const mutant = loadMutant("if (record.accepted !== null) fail('DUPLICATE_RECEIPT');", '/* duplicate gate removed */');
    const p = prepared(mutant), r = J.receiptFor(p.dispatch, { sum: 0 }); p.controller.admit(r);
    assert.throws(() => throwsCode(() => p.controller.admit(r), 'DUPLICATE_RECEIPT'));
  });
  check('subject mutation: removing cancellation makes the late-receipt check fail', () => {
    const mutant = loadMutant('record.current = null;', '/* cancellation removed */');
    const p = prepared(mutant); p.controller.cancel(p.dispatch);
    assert.throws(() => throwsCode(() => p.controller.admit(J.receiptFor(p.dispatch, { sum: 0 })), 'STALE_ATTEMPT'));
  });
  check('standalone path rejects non-IPC invocation cleanly', () => {
    const result = spawnSync(process.execPath, [require.resolve('./jobs.cjs')], { windowsHide: true, timeout: J.LIMITS.timeoutMs, encoding: 'utf8' });
    assert.equal(result.status, 2); assert.match(result.stderr, /Local IPC worker only/);
  });
  {
    const p = prepared(), result = await J.runChildAttempt(p.dispatch, { controller: p.controller });
    check('real child completes, exits and is admitted once', () => {
      assert.equal(result.exitCode, 0); assert.equal(result.progress, 1);
      assert.equal(p.controller.admit(result.receipt).output.sum, 0);
      assert.equal(p.controller.acceptedCount, 1);
    });
  }
  {
    const c = new J.Controller();
    for (const sign of [-1, 1]) {
      const id = c.submit(J.encodeJob(Array(J.LIMITS.width).fill(1), Array(J.LIMITS.width).fill(sign)));
      const result = await J.runChildAttempt(c.begin(id), { controller: c });
      check('real child preserves signed wide sums rather than a zero-only fixture', () => {
        assert.equal(result.exitCode, 0);
        assert.equal(result.progress, Math.floor(J.LIMITS.width / 2));
        assert.equal(c.admit(result.receipt).output.sum, sign * J.LIMITS.width);
      });
    }
  }
  {
    const p = prepared(); let failed;
    try { await J.runChildAttempt(p.dispatch, { controller: p.controller, fault: 'crash-after-progress' }); } catch (e) { failed = e; }
    check('real child crashes only after partial work with no accepted result', () => {
      assert.equal(failed.code, 'CHILD_EXIT'); assert.equal(failed.exitCode, 77);
      assert.equal(failed.progress, 1); assert.equal(p.controller.acceptedCount, 0);
      throwsCode(() => p.controller.admit(J.receiptFor(p.dispatch, { sum: 0 })), 'STALE_ATTEMPT');
    });
    const retry = p.controller.begin(p.jobId), result = await J.runChildAttempt(retry, { controller: p.controller });
    check('new child retry admits once; late predecessor and duplicate cannot commit', () => {
      assert.equal(result.exitCode, 0);
      assert.notEqual(JSON.parse(retry).attempt, JSON.parse(p.dispatch).attempt);
      throwsCode(() => p.controller.admit(J.receiptFor(p.dispatch, { sum: 0 })), 'STALE_ATTEMPT');
      p.controller.admit(result.receipt);
      throwsCode(() => p.controller.admit(result.receipt), 'DUPLICATE_RECEIPT');
      assert.equal(p.controller.acceptedCount, 1);
    });
  }
  {
    const p = prepared(); let failed;
    try { await J.runChildAttempt(p.dispatch, { controller: p.controller, fault: 'hang-after-progress', timeoutMs: 800 }); } catch (e) { failed = e; }
    check('deadline kills only the owned child and waits for process close', () => {
      assert.equal(failed.code, 'CHILD_TIMEOUT');
      assert.ok(failed.exitCode !== null || failed.signal !== null);
      assert.equal(p.controller.acceptedCount, 0);
      throwsCode(() => p.controller.admit(J.receiptFor(p.dispatch, { sum: 0 })), 'STALE_ATTEMPT');
    });
  }
  {
    const p = prepared();
    const oldChild = J.runChildAttempt(p.dispatch, { controller: p.controller, fault: 'hang-after-progress', timeoutMs: 800 });
    const retry = p.controller.begin(p.jobId);
    let failed; try { await oldChild; } catch (e) { failed = e; }
    check('old timeout cannot revoke a newer issued attempt', () => {
      assert.equal(failed.code, 'CHILD_TIMEOUT');
      p.controller.assertActive(retry);
      throwsCode(() => p.controller.admit(J.receiptFor(p.dispatch, { sum: 0 })), 'STALE_ATTEMPT');
    });
    const result = await J.runChildAttempt(retry, { controller: p.controller });
    check('healthy retry remains admissible after predecessor timeout', () => {
      assert.equal(result.exitCode, 0);
      assert.equal(p.controller.admit(result.receipt).output.sum, 0);
      assert.equal(p.controller.acceptedCount, 1);
    });
  }
  {
    const mutant = loadMutant('record.current = null;', '/* cancellation removed */');
    const p = prepared(mutant); let failed;
    try { await mutant.runChildAttempt(p.dispatch, { controller: p.controller, fault: 'hang-after-progress', timeoutMs: 100 }); }
    catch (e) { failed = e; }
    check('subject mutation: a killed child without invalidation fails the late-receipt assertion', () => {
      assert.equal(failed.code, 'CHILD_TIMEOUT');
      assert.throws(() => throwsCode(() => p.controller.admit(J.receiptFor(p.dispatch, { sum: 0 })), 'STALE_ATTEMPT'));
    });
  }
  console.log(JSON.stringify({ status: 'PASS', checks, scope: 'local IPC contract and owned-process recovery',
    limits: ['no LAN test', 'no authentication', 'no durable controller restart', 'full output recomputation', 'no performance claim'] }));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
