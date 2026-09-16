'use strict';

/*
 * NOT REGISTERED: bounded local correctness/failure preflight, not an empirical
 * performance prediction. This is child-process IPC, not a LAN protocol, an
 * authentication system, a durable controller, or a scalable computation proof.
 * Hashes bind content; they do not identify a worker. The controller recomputes
 * every output independently and commits at most once in this process lifetime.
 */

const { createHash, randomBytes } = require('node:crypto');
const { fork } = require('node:child_process');

const LIMITS = Object.freeze({ width: 1024, jobs: 8, attempts: 3,
  jobBytes: 8192, frameBytes: 16384, receiptBytes: 1024,
  timeoutMs: 3000 });
const VERSION = 'compute-preflight/v1';
const ARITHMETIC = 'exact-integer-dot;trits=-1,0,1;zero=+0;no-wrap;no-clamp/v1';
const HASH = /^[a-f0-9]{64}$/;
const NONCE = /^[a-f0-9]{32}$/;

function fail(code) { throw Object.assign(new Error(code), { code }); }
function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  const actual = Object.keys(value).sort();
  const wanted = [...keys].sort();
  if (actual.length !== wanted.length || actual.some((k, i) => k !== wanted[i])) fail(code);
}
function parse(raw, bytes) {
  if (typeof raw !== 'string') fail('WIRE_STRING_REQUIRED');
  if (Buffer.byteLength(raw, 'utf8') > bytes) fail('WIRE_TOO_LARGE');
  try { return JSON.parse(raw); } catch { fail('MALFORMED_JSON'); }
}
function hash(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
function trits(value) {
  if (!Array.isArray(value) || value.length > LIMITS.width) fail('TRIT_WIDTH');
  for (let i = 0; i < value.length; ++i) {
    if (!Object.hasOwn(value, i) || ![-1, 0, 1].includes(value[i]) || Object.is(value[i], -0)) fail('TRIT_VALUE');
  }
  return Object.freeze([...value]);
}
function validateJob(value) {
  exactKeys(value, ['version', 'workload', 'arithmetic', 'inputs', 'weights', 'seed'], 'JOB_FIELDS');
  if (value.version !== VERSION || value.workload !== 'ternary-dot' || value.arithmetic !== ARITHMETIC) fail('JOB_CONTRACT');
  if (value.seed !== null && (!Number.isInteger(value.seed) || Object.is(value.seed, -0) || value.seed < 0 || value.seed > 0xffffffff)) fail('JOB_SEED');
  const inputs = trits(value.inputs), weights = trits(value.weights);
  if (inputs.length !== weights.length) fail('JOB_SHAPE');
  return Object.freeze({ version: VERSION, workload: 'ternary-dot', arithmetic: ARITHMETIC,
    inputs, weights, seed: value.seed });
}
function encodeJob(inputs, weights, seed = null) {
  return JSON.stringify(validateJob({ version: VERSION, workload: 'ternary-dot', arithmetic: ARITHMETIC,
    inputs, weights, seed }));
}
function validateOutput(value, width) {
  exactKeys(value, ['sum'], 'OUTPUT_FIELDS');
  if (!Number.isInteger(value.sum) || Object.is(value.sum, -0) || Math.abs(value.sum) > width) fail('OUTPUT_RANGE');
  return Object.freeze({ sum: value.sum });
}
function controllerOutput(job) {
  // A separate wide-integer oracle, not the worker's add/subtract loop.
  let sum = 0n;
  for (let i = 0; i < job.inputs.length; ++i) sum += BigInt(job.inputs[i]) * BigInt(job.weights[i]);
  return { sum: Number(sum) };
}
function outputHash(output) { return hash({ sum: output.sum }); }
function validateDispatch(raw) {
  const v = parse(raw, LIMITS.frameBytes);
  exactKeys(v, ['version', 'type', 'jobId', 'attempt', 'job'], 'DISPATCH_FIELDS');
  if (v.version !== VERSION || v.type !== 'job' || typeof v.jobId !== 'string' ||
      !HASH.test(v.jobId) || typeof v.attempt !== 'string' || !NONCE.test(v.attempt)) fail('DISPATCH_ID');
  const job = validateJob(v.job);
  if (hash(job) !== v.jobId) fail('DISPATCH_CONTENT');
  return Object.freeze({ version: VERSION, type: 'job', jobId: v.jobId, attempt: v.attempt, job });
}
function receiptFor(dispatch, output) {
  const v = validateDispatch(dispatch);
  const result = validateOutput(output, v.job.inputs.length);
  return JSON.stringify({ version: VERSION, jobId: v.jobId, attempt: v.attempt,
    output: result, outputHash: outputHash(result) });
}

class Controller {
  #records = new Map();
  get acceptedCount() { return [...this.#records.values()].filter(r => r.accepted !== null).length; }
  submit(raw) {
    const job = validateJob(parse(raw, LIMITS.jobBytes));
    const jobId = hash(job);
    if (!this.#records.has(jobId)) {
      if (this.#records.size >= LIMITS.jobs) fail('JOB_LIMIT');
      this.#records.set(jobId, { job, attempts: 0, current: null, accepted: null });
    }
    return jobId;
  }
  begin(jobId) {
    const record = this.#records.get(jobId);
    if (!record) fail('UNKNOWN_JOB');
    if (record.accepted !== null) fail('ALREADY_ACCEPTED');
    if (record.attempts >= LIMITS.attempts) fail('ATTEMPT_LIMIT');
    record.attempts++;
    record.current = randomBytes(16).toString('hex');
    return JSON.stringify({ version: VERSION, type: 'job', jobId,
      attempt: record.current, job: record.job });
  }
  assertActive(raw) {
    const dispatch = validateDispatch(raw);
    const record = this.#records.get(dispatch.jobId);
    if (!record) fail('UNKNOWN_JOB');
    if (record.accepted !== null) fail('ALREADY_ACCEPTED');
    if (record.current !== dispatch.attempt) fail('STALE_ATTEMPT');
  }
  cancel(raw) {
    const dispatch = validateDispatch(raw);
    const record = this.#records.get(dispatch.jobId);
    if (!record) fail('UNKNOWN_JOB');
    // Cancellation races are scoped to the attempt, not merely to the job.
    if (record.accepted !== null || record.current !== dispatch.attempt) return false;
    record.current = null;
    return true;
  }
  admit(raw) {
    const v = parse(raw, LIMITS.receiptBytes);
    exactKeys(v, ['version', 'jobId', 'attempt', 'output', 'outputHash'], 'RECEIPT_FIELDS');
    if (v.version !== VERSION || typeof v.jobId !== 'string' || !HASH.test(v.jobId) ||
        typeof v.attempt !== 'string' || !NONCE.test(v.attempt) ||
        typeof v.outputHash !== 'string' || !HASH.test(v.outputHash)) fail('RECEIPT_ID');
    const record = this.#records.get(v.jobId);
    if (!record) fail('UNKNOWN_JOB');
    if (record.accepted !== null) fail('DUPLICATE_RECEIPT');
    if (v.attempt !== record.current) fail('STALE_ATTEMPT');
    const output = validateOutput(v.output, record.job.inputs.length);
    if (outputHash(output) !== v.outputHash) fail('OUTPUT_HASH');
    const expected = controllerOutput(record.job);
    if (output.sum !== expected.sum) fail('WRONG_OUTPUT');
    record.accepted = Object.freeze({ jobId: v.jobId, attempt: v.attempt, output, outputHash: v.outputHash });
    return record.accepted;
  }
}

function runChildAttempt(raw, { controller, fault = 'none', timeoutMs = LIMITS.timeoutMs } = {}) {
  validateDispatch(raw);
  if (!(controller instanceof Controller)) fail('CONTROLLER_REQUIRED');
  controller.assertActive(raw);
  if (!['none', 'crash-after-progress', 'hang-after-progress'].includes(fault)) fail('UNKNOWN_FAULT');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > LIMITS.timeoutMs) fail('TIMEOUT_RANGE');
  return new Promise((resolve, reject) => {
    // Executable, module and argv come only from this file, never from a job.
    let child;
    try {
      child = fork(__filename, ['--worker', fault], { windowsHide: true, detached: false,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'], serialization: 'json' });
    } catch (e) { controller.cancel(raw); reject(e); return; }
    let progress = null, receipt = null, error = null;
    const timer = setTimeout(() => {
      error = Object.assign(new Error('CHILD_TIMEOUT'), { code: 'CHILD_TIMEOUT' });
      controller.cancel(raw);
      child.kill();
    }, timeoutMs);
    child.on('error', e => { error = e; controller.cancel(raw); child.kill(); });
    child.on('message', message => {
      try {
        const v = parse(message, LIMITS.frameBytes);
        if (v.type === 'progress') {
          exactKeys(v, ['type', 'jobId', 'attempt', 'completed'], 'PROGRESS_FIELDS');
          const d = validateDispatch(raw);
          if (v.jobId !== d.jobId || v.attempt !== d.attempt || !Number.isInteger(v.completed) ||
              v.completed < 0 || v.completed > d.job.inputs.length || progress !== null) fail('BAD_PROGRESS');
          progress = v.completed;
        } else {
          if (receipt !== null) fail('CHILD_DUPLICATE');
          // Admission remains the controller's responsibility.
          receipt = message;
        }
      } catch (e) { error = e; controller.cancel(raw); child.kill(); }
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const detail = { pid: child.pid, progress, exitCode: code, signal };
      if (error) { controller.cancel(raw); reject(Object.assign(error, detail)); }
      else if (code !== 0 || receipt === null) {
        controller.cancel(raw);
        reject(Object.assign(new Error('CHILD_EXIT'), { code: 'CHILD_EXIT', ...detail }));
      }
      else resolve({ receipt, ...detail });
    });
    child.send(raw, e => { if (e) { error = e; controller.cancel(raw); child.kill(); } });
  });
}

function startWorker(fault) {
  if (!process.send || !['none', 'crash-after-progress', 'hang-after-progress'].includes(fault)) fail('IPC_WORKER_ONLY');
  process.once('disconnect', () => process.exit(0));
  process.once('message', raw => {
    try {
      const d = validateDispatch(raw);
      const half = Math.floor(d.job.inputs.length / 2);
      let sum = 0;
      function portion(from, to) {
        for (let i = from; i < to; ++i) {
          if (d.job.weights[i] === 1) sum += d.job.inputs[i];
          else if (d.job.weights[i] === -1) sum -= d.job.inputs[i];
        }
      }
      portion(0, half);
      process.send(JSON.stringify({ type: 'progress', jobId: d.jobId, attempt: d.attempt, completed: half }), error => {
        if (error) process.exit(2);
        if (fault === 'crash-after-progress') process.exit(77);
        if (fault === 'hang-after-progress') return;
        portion(half, d.job.inputs.length);
        process.send(receiptFor(raw, { sum: sum === 0 ? 0 : sum }), e => process.exit(e ? 2 : 0));
      });
    } catch { process.exit(2); }
  });
}

module.exports = { LIMITS, VERSION, ARITHMETIC, Controller, encodeJob, validateJob,
  validateDispatch, controllerOutput, outputHash, receiptFor, runChildAttempt };
if (require.main === module) {
  if (process.argv.length !== 4 || process.argv[2] !== '--worker') {
    console.error('Local IPC worker only; run node research/compute-preflight/test-jobs.cjs');
    process.exitCode = 2;
  } else startWorker(process.argv[3]);
}
