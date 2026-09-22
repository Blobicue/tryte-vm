'use strict';
/* WORKER COMPUTE PREFLIGHT AUDIT — set AW, one frozen Ryzen 7 5825U target.
 *
 * CONSTRUCTION: reuse native.cpp unchanged, built on node-ecd2b9 with
 * g++ -std=c++17 -O3 -march=znver3. Fixed seed 20260915; widths
 * 31,32,33,64,65,256,1024; rows32; batch16; warmup8; iterations128;
 * repeats7. The benchmark rotates and reverses backend order exactly as AV.
 * Features occupy uint64 bit positions; packed reductions use scalar POPCNT.
 * This is feature packing, not independent-example AVX2 bit slicing.
 *
 * The run is valid only on Linux/x64 host node-ecd2b9 with an AMD Ryzen 7
 * 5825U, 16 logical CPUs, AVX2 and POPCNT; native/native_control medians must
 * remain within [0.90,1.10] at width1024 for resident and end_to_end stages.
 * A detectable precondition failure is written as REFUSED before compilation
 * or timing. A bad output, incomplete sample set, noisy control, compile
 * failure, post-run checkout drift, governor drift, observation failure,
 * cleanup failure or timeout makes an attempted run INVALID. A REFUSED receipt
 * is not a measurement and may be retried only after its named precondition is
 * repaired, from the same registration. Preserve an INVALID attempted run and
 * do not rerun it to cross a criterion.
 *
 * NOT REGISTERED: the arithmetic identities and correctness fixtures already
 * checked by native.cpp. Package installation, idle checks and file transfer
 * are setup, not performance outcomes. This run does not measure sustained
 * thermals, energy, SMT/core scaling, network cost, model quality or a fleet.
 *
 * PREDICTED OUTCOMES — commit this instrument before any worker timing.
 *
 *   AW1 RESIDENT SIGN PACKING BEATS NATIVE INT8 BY AT LEAST 1.25X.
 *       At width1024, median(native resident)/median(sign resident) >= 1.25.
 *       AT RISK: Linux GCC can vectorize the native loop differently, while
 *       the 5825U's POPCNT throughput, dependencies and power envelope can
 *       reduce the ratio below 1.25 even when packed arithmetic is correct.
 *       CANNOT SHOW: another mini PC, another workload, or fleet performance.
 *
 *   AW2 REPACKING BOTH OPERANDS DOES NOT BEAT THE NATIVE INT8 BASELINE.
 *       At width1024, median(native end_to_end)/median(sign end_to_end) <= 1.00.
 *       AT RISK: this CPU's cache hierarchy and lower native throughput can
 *       make packing cheap enough that the ratio rises above one, reversing
 *       the controller's conversion-cost result.
 *       CANNOT SHOW: resident weights with only new activations repacked.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const FLAGS = ['-std=c++17', '-O3', '-march=znver3'];
const WIDTHS = [31, 32, 33, 64, 65, 256, 1024];
const EXPECTED = Object.freeze({
  hostname: 'node-ecd2b9',
  platform: 'linux',
  arch: 'x64',
  cpuPattern: 'AMD Ryzen 7 5825U',
  logicalCpus: 16,
});
const ARTIFACTS = [
  'research/compute-preflight/worker-audit.cjs',
  'research/compute-preflight/test-worker-audit.cjs',
  'research/compute-preflight/native.cpp',
  'research/compute-preflight/test-native.cjs',
];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function assessPreflight({ registration, head, dirtyBefore, host, artifactsRegistered, governorsBefore }) {
  const lscpu = String(host?.lscpu || '').toLowerCase();
  const checks = {
    registered_head: /^[a-f0-9]{40}$/.test(registration || '') && head === registration,
    clean_checkout: dirtyBefore === '',
    registered_artifacts: artifactsRegistered === true,
    hostname: host?.hostname === EXPECTED.hostname,
    platform: host?.platform === EXPECTED.platform,
    arch: host?.arch === EXPECTED.arch,
    cpu_model: typeof host?.cpu === 'string' && host.cpu.includes(EXPECTED.cpuPattern),
    logical_cpus: host?.logical_cpus === EXPECTED.logicalCpus,
    avx2: /\bavx2\b/.test(lscpu),
    popcnt: /\bpopcnt\b/.test(lscpu),
    governors_observable: governorsBefore && typeof governorsBefore === 'object'
      && Object.keys(governorsBefore).length > 0
      && Object.values(governorsBefore).every(value => typeof value === 'string' && value.length > 0),
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}

function decideStatus(receipt) {
  if (receipt.preflight?.valid !== true) return 'REFUSED';
  const governorsStable = receipt.before?.governors && receipt.after?.governors
    && JSON.stringify(receipt.after.governors) === JSON.stringify(receipt.before.governors);
  const complete = receipt.timing_started === true
    && receipt.self_test?.exit === 0
    && receipt.execution?.exit === 0
    && receipt.analysis?.instrument_valid === true
    && receipt.postflight?.valid === true
    && governorsStable
    && !receipt.failure
    && !receipt.after_error
    && !receipt.cleanup_error;
  return complete ? 'VALID' : 'INVALID';
}

function requireShape(raw) {
  assert.equal(raw.schema, 'compute-preflight-native/v1');
  assert.equal(raw.mode, 'bench');
  assert.equal(raw.seed, 20260915);
  assert.deepEqual(raw.widths, WIDTHS);
  for (const [key, value] of Object.entries({ rows: 32, batch: 16, repeats: 7, warmup: 8, iterations: 128 })) {
    assert.equal(raw[key], value, key);
  }
  assert.equal(raw.correct, true);
  assert.equal(typeof raw.checksum, 'string');
  for (const section of ['build', 'runtime']) {
    assert.equal(raw[section].avx2, true, `${section} AVX2`);
    assert.equal(raw[section].popcnt, true, `${section} POPCNT`);
  }
  assert.deepEqual(raw.packing, {
    axis: 'features', word_bits: 64, end_to_end_weights: true,
    reuses_storage: true, boundary_validation_timed: false,
  });
}

function grade(raw) {
  requireShape(raw);
  const stages = {
    resident: ['native', 'dual', 'sign', 'native_control'],
    pack_only: ['dual', 'sign'],
    end_to_end: ['native', 'dual', 'sign', 'native_control'],
  };
  const keys = new Set();
  for (const sample of raw.samples) {
    assert(WIDTHS.includes(sample.width));
    assert(Number.isInteger(sample.repeat) && sample.repeat >= 0 && sample.repeat < raw.repeats);
    assert(stages[sample.stage]?.includes(sample.backend));
    assert.equal(sample.iterations, raw.iterations);
    assert(Number.isFinite(sample.total_ns) && sample.total_ns > 0);
    assert.equal(typeof sample.checksum, 'string');
    const key = `${sample.width}/${sample.repeat}/${sample.stage}/${sample.backend}`;
    assert(!keys.has(key), `duplicate ${key}`);
    keys.add(key);
  }
  for (const width of WIDTHS) for (let repeat = 0; repeat < raw.repeats; repeat++) {
    for (const [stage, backends] of Object.entries(stages)) for (const backend of backends) {
      assert(keys.has(`${width}/${repeat}/${stage}/${backend}`), 'missing sample');
    }
    const outputWitnesses = raw.samples
      .filter(sample => sample.width === width && sample.repeat === repeat && sample.stage !== 'pack_only')
      .map(sample => sample.checksum);
    assert.equal(new Set(outputWitnesses).size, 1, 'output witnesses differ across equivalent runs');
  }
  const rows = WIDTHS.map(width => {
    const times = {};
    for (const [stage, backends] of Object.entries(stages)) {
      times[stage] = {};
      for (const backend of backends) {
        const values = raw.samples
          .filter(sample => sample.width === width && sample.stage === stage && sample.backend === backend)
          .map(sample => sample.total_ns / sample.iterations);
        times[stage][backend] = {
          median_ns: median(values), min_ns: Math.min(...values), max_ns: Math.max(...values),
        };
      }
    }
    return { width, times };
  });
  const main = rows.find(row => row.width === 1024).times;
  const control_ratios = Object.fromEntries(['resident', 'end_to_end'].map(stage => [
    stage, main[stage].native.median_ns / main[stage].native_control.median_ns,
  ]));
  const instrument_valid = Object.values(control_ratios).every(ratio => ratio >= 0.90 && ratio <= 1.10);
  const definitions = [
    { id: 'AW1', stage: 'resident', threshold: 1.25, comparison: '>=' },
    { id: 'AW2', stage: 'end_to_end', threshold: 1.00, comparison: '<=' },
  ];
  const predictions = definitions.map(definition => {
    const ratio = main[definition.stage].native.median_ns / main[definition.stage].sign.median_ns;
    const held = definition.comparison === '>=' ? ratio >= definition.threshold : ratio <= definition.threshold;
    const margin = definition.comparison === '>=' ? ratio - definition.threshold : definition.threshold - ratio;
    return { ...definition, ratio, margin, outcome: instrument_valid ? (held ? 'HELD' : 'FAILED') : 'INVALID' };
  });
  return { instrument_valid, control_ratios, predictions, rows };
}

function fixture() {
  const raw = {
    schema: 'compute-preflight-native/v1', mode: 'bench', seed: 20260915,
    widths: WIDTHS, rows: 32, batch: 16, repeats: 7, warmup: 8, iterations: 128,
    packing: { axis: 'features', word_bits: 64, end_to_end_weights: true, reuses_storage: true, boundary_validation_timed: false },
    build: { avx2: true, popcnt: true }, runtime: { avx2: true, popcnt: true },
    correct: true, checksum: 'fixture', samples: [],
  };
  for (const width of WIDTHS) for (let repeat = 0; repeat < raw.repeats; repeat++) {
    for (const stage of ['resident', 'pack_only', 'end_to_end']) {
      const backends = stage === 'pack_only' ? ['dual', 'sign'] : ['native', 'dual', 'sign', 'native_control'];
      for (const backend of backends) {
        let value = 200;
        if (backend === 'sign') value = stage === 'end_to_end' ? 300 : 100;
        raw.samples.push({ width, repeat, stage, backend, iterations: raw.iterations, total_ns: value * raw.iterations, checksum: 'fixture' });
      }
    }
  }
  return raw;
}

function selfTest() {
  const copy = value => JSON.parse(JSON.stringify(value));
  const healthy = fixture();
  assert.deepEqual(grade(healthy).predictions.map(row => row.outcome), ['HELD', 'HELD']);
  const reversed = copy(healthy);
  reversed.samples.filter(row => row.backend === 'sign' && row.stage === 'resident')
    .forEach(row => { row.total_ns *= 4; });
  reversed.samples.filter(row => row.backend === 'sign' && row.stage === 'end_to_end')
    .forEach(row => { row.total_ns /= 4; });
  assert.deepEqual(grade(reversed).predictions.map(row => row.outcome), ['FAILED', 'FAILED']);
  const noisy = copy(healthy);
  noisy.samples.filter(row => row.backend === 'native_control').forEach(row => { row.total_ns *= 2; });
  assert(grade(noisy).predictions.every(row => row.outcome === 'INVALID'));
  const duplicate = copy(healthy); duplicate.samples.push(duplicate.samples[0]);
  assert.throws(() => grade(duplicate), /duplicate/);
  const missing = copy(healthy); missing.samples.pop();
  assert.throws(() => grade(missing), /missing sample/);
  const wrong = copy(healthy); wrong.correct = false;
  assert.throws(() => grade(wrong));
  return 'worker scorer: held, failed, invalid, duplicate, missing and wrong-output fixtures passed';
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function readText(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 5000, ...options });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function temperatures() {
  const root = '/sys/class/thermal';
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(name => /^thermal_zone\d+$/.test(name)).map(name => {
    const zone = path.join(root, name);
    const type = fs.existsSync(path.join(zone, 'type')) ? fs.readFileSync(path.join(zone, 'type'), 'utf8').trim() : null;
    const raw = fs.existsSync(path.join(zone, 'temp')) ? Number(fs.readFileSync(path.join(zone, 'temp'), 'utf8').trim()) : NaN;
    return { zone: name, type, millidegrees_c: Number.isFinite(raw) ? raw : null };
  });
}

function governors() {
  const root = '/sys/devices/system/cpu/cpufreq';
  if (!fs.existsSync(root)) return null;
  const policies = fs.readdirSync(root).filter(name => /^policy\d+$/.test(name)).sort();
  if (!policies.length) return null;
  return Object.fromEntries(policies.map(name => {
    const target = path.join(root, name, 'scaling_governor');
    return [name, fs.existsSync(target) ? fs.readFileSync(target, 'utf8').trim() : null];
  }));
}

function observe() {
  return { governors: governors(), loadavg: os.loadavg(), uptime_s: os.uptime(), temperatures: temperatures() };
}

function cleanupScratch(scratch, paths) {
  const errors = [];
  if (!scratch) return errors;
  const resolved = path.resolve(scratch);
  const expectedParent = path.resolve(os.tmpdir());
  if (path.dirname(resolved) !== expectedParent || !path.basename(resolved).startsWith('tryte-worker-aw-')) {
    return [`refused unsafe scratch cleanup: ${resolved}`];
  }
  for (const target of paths) {
    try {
      if (target && fs.existsSync(target)) fs.unlinkSync(target);
    } catch (error) {
      errors.push(`${path.basename(target)}: ${error.message}`);
    }
  }
  try {
    const leftovers = fs.readdirSync(resolved);
    if (leftovers.length) errors.push(`scratch not empty: ${leftovers.join(',')}`);
    else fs.rmdirSync(resolved);
  } catch (error) {
    errors.push(`scratch directory: ${error.message}`);
  }
  return errors;
}

function run(output) {
  const destination = path.resolve(output);
  assert.equal(path.dirname(destination), __dirname, 'receipt must be in the preflight directory');
  assert(destination.endsWith('.json') && !fs.existsSync(destination), 'new JSON receipt required; no overwrite');
  const receipt = {
    schema: 'compute-preflight-worker-receipt/v1',
    started_utc: new Date().toISOString(), status: 'REFUSED', timing_started: false,
    compiler: { command: 'g++', flags: FLAGS },
  };
  let scratch = null;
  let source = null;
  let executable = null;
  const artifacts = {};
  const normalize = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n');
  const frozen = new Map();
  try {
    receipt.registration = git(['log', '-1', '--format=%H', '--', 'research/compute-preflight/worker-audit.cjs']);
    receipt.head = git(['rev-parse', 'HEAD']);
    receipt.dirty_before = git(['status', '--porcelain']);
    let artifactsRegistered = true;
    for (const relative of ARTIFACTS) {
      try {
        const bytes = fs.readFileSync(path.join(ROOT, relative));
        const committed = execFileSync('git', ['show', `${receipt.registration}:${relative}`], { cwd: ROOT });
        const matches = normalize(bytes) === normalize(committed);
        artifactsRegistered &&= matches;
        artifacts[relative] = {
          sha256: sha(bytes), normalized_sha256: sha(normalize(bytes)), registered: matches,
        };
        frozen.set(relative, bytes);
      } catch (error) {
        artifactsRegistered = false;
        artifacts[relative] = { registered: false, error: error.message };
      }
    }
    receipt.artifacts = artifacts;
    receipt.expected_host = EXPECTED;
    receipt.host = {
      hostname: os.hostname(), platform: process.platform, arch: process.arch,
      node: process.version, cpu: os.cpus()[0]?.model || null, logical_cpus: os.cpus().length,
      kernel: readText('uname', ['-r']), lscpu: readText('lscpu', []),
    };
    receipt.before = observe();
    receipt.preflight = assessPreflight({
      registration: receipt.registration, head: receipt.head, dirtyBefore: receipt.dirty_before,
      host: receipt.host, artifactsRegistered, governorsBefore: receipt.before.governors,
    });

    if (receipt.preflight.valid) {
      receipt.status = 'INVALID';
      scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tryte-worker-aw-'));
      source = path.join(scratch, 'native.cpp');
      executable = path.join(scratch, 'native');
      fs.writeFileSync(source, frozen.get('research/compute-preflight/native.cpp'), { flag: 'wx' });
      receipt.compiler.version = readText('g++', ['--version']);
      const build = spawnSync('g++', [...FLAGS, source, '-o', executable], { encoding: 'utf8', timeout: 60000 });
      assert.equal(build.status, 0, build.error?.message || build.stderr);
      receipt.compiler.diagnostics = build.stderr;
      receipt.executable_sha256 = sha(fs.readFileSync(executable));
      const check = spawnSync(executable, ['--self-test'], { encoding: 'utf8', timeout: 15000 });
      receipt.self_test = { exit: check.status, stdout: check.stdout, stderr: check.stderr };
      assert.equal(check.status, 0, 'native correctness failed');
      receipt.timing_started = true;
      const bench = spawnSync(executable, ['--bench', '--seed', '20260915'], {
        encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
      });
      receipt.execution = { exit: bench.status, stderr: bench.stderr, error: bench.error?.message || null };
      receipt.raw_stdout = bench.stdout;
      assert.equal(bench.status, 0, bench.error?.message || 'native timing failed');
      receipt.raw = JSON.parse(bench.stdout);
      receipt.analysis = grade(receipt.raw);
    } else {
      receipt.refusal = 'preflight failed before compilation or timing';
    }
  } catch (error) {
    receipt.failure = String(error.message);
    if (!receipt.preflight) {
      receipt.preflight = { valid: false, checks: {}, error: 'preflight could not be completed' };
    }
  } finally {
    if (receipt.preflight?.valid) {
      try {
        receipt.after = observe();
      } catch (error) {
        receipt.after_error = error.message;
      }
      try {
        receipt.head_after = git(['rev-parse', 'HEAD']);
        receipt.dirty_after = git(['status', '--porcelain']);
        receipt.postflight = {
          valid: receipt.head_after === receipt.registration && receipt.dirty_after === '',
          checks: {
            same_head: receipt.head_after === receipt.registration,
            clean_checkout: receipt.dirty_after === '',
          },
        };
      } catch (error) {
        receipt.postflight = { valid: false, error: error.message };
      }
      const cleanupErrors = cleanupScratch(scratch, [executable, source]);
      if (cleanupErrors.length) receipt.cleanup_error = cleanupErrors;
    }
    receipt.status = decideStatus(receipt);
    receipt.finished_utc = new Date().toISOString();
  }
  fs.writeFileSync(destination, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ receipt: destination, status: receipt.status, failure: receipt.failure, analysis: receipt.analysis }, null, 2));
  return receipt.status === 'VALID';
}

if (require.main === module) {
  try {
    if (process.argv.length === 3 && process.argv[2] === '--self-test') console.log(selfTest());
    else if (process.argv.length === 4 && process.argv[2] === '--run') process.exitCode = run(process.argv[3]) ? 0 : 1;
    else if (process.argv.length === 4 && process.argv[2] === '--score') {
      const receipt = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
      console.log(JSON.stringify(grade(receipt.raw), null, 2));
    } else throw new Error('usage: worker-audit.cjs --self-test | --run NEW_RECEIPT.json | --score RECEIPT.json');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { EXPECTED, FLAGS, WIDTHS, assessPreflight, decideStatus, grade, selfTest };
