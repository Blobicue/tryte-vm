'use strict';
/* COMPUTE PREFLIGHT AUDIT — set AV, a controller-only native layer comparison.
 *
 * CONSTRUCTION: native.cpp, built with g++ -std=c++17 -O3 -march=znver3.
 * Fixed seed 20260915; widths 31,32,33,64,65,256,1024; rows32; batch16;
 * warmup8; iterations128; repeats7. Rotate [native,dual,sign,native_control]
 * by repeat modulo4, reverse on odd repeats. Stages: resident, pack_only,
 * end_to_end. The last repacks BOTH inputs and weights into reused buffers;
 * excludes allocation, boundary validation, process launch, disk and networking.
 * Features are packed into uint64 words. This is NOT independent-example SIMD.
 * Native int8 arithmetic may auto-vectorize; packed reductions use POPCNT.
 * All outputs, including wide sums, must agree before and after timed samples.
 * AV is local profiling, not useful-model quality, training, fleet or novelty proof.
 *
 * Only width1024 is confirmatory. Other widths/layout comparisons are descriptive.
 * For each claimed stage, median(native)/median(native_control) must be in
 * [0.90,1.10]. An out-of-band control, timeout, absent capability, schema fault or
 * wrong output INVALIDATES the run, rather than scoring the predictions. Keep
 * that result; do not rerun until a threshold passes. Samples are one process on
 * one controller, not independent machines or a population confidence interval.
 *
 * NOT REGISTERED: arithmetic identities, exhaustive small-domain correctness,
 * tail checks, instruction compatibility and fixed workload sizes. These are
 * construction/instrument checks, not empirical successes. No performance pilot
 * or parameter tuning is permitted before this registration commit.
 *
 * PREDICTED OUTCOMES — committed before any timing run.
 *
 *   AV1 RESIDENT SIGN PACKING BEATS THE NATIVE INT8 BASELINE BY AT LEAST 1.25X.
 *       At width1024, median(native resident)/median(sign resident) >= 1.25.
 *       AT RISK: the compiler can vectorize the native integer reduction while
 *       POPCNT throughput and packed-loop dependencies limit the sign kernel;
 *       the observed ratio can fall below 1.25 despite simpler Boolean products.
 *       CANNOT SHOW: target-mini-PC speed or performance outside this workload.
 *
 *   AV2 THE SAME ROUTE RETAINS AT LEAST 1.10X WHEN BOTH OPERANDS ARE REPACKED.
 *       At width1024, median(native end_to_end)/median(sign end_to_end) >= 1.10.
 *       AT RISK: scanning and packing all inputs and weights can cost more than
 *       the saved dot-product time, so the ratio can fall below 1.10 or below one.
 *       CANNOT SHOW: cold allocation, network throughput, or warmed resident-model
 *       inference; this boundary deliberately includes repacking the weights.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const FLAGS = ['-std=c++17', '-O3', '-march=znver3'];
const WIDTHS = [31, 32, 33, 64, 65, 256, 1024];
const SHA = data => crypto.createHash('sha256').update(data).digest('hex');
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function grade(raw) {
  assert.equal(raw.schema, 'compute-preflight-native/v1');
  assert.equal(raw.mode, 'bench');
  assert.equal(raw.seed, 20260915);
  assert.deepEqual(raw.widths, WIDTHS);
  for (const [k, v] of Object.entries({rows:32, batch:16, repeats:7, warmup:8, iterations:128})) assert.equal(raw[k], v, k);
  assert.equal(raw.correct, true);
  assert.equal(typeof raw.checksum, 'string');
  for (const section of ['build', 'runtime']) {
    assert.equal(raw[section].avx2, true, `${section} AVX2`);
    assert.equal(raw[section].popcnt, true, `${section} POPCNT`);
  }
  assert.deepEqual(raw.packing, {axis:'features', word_bits:64, end_to_end_weights:true, reuses_storage:true, boundary_validation_timed:false});
  const keys = new Set();
  const stages = {resident:['native','dual','sign','native_control'], pack_only:['dual','sign'], end_to_end:['native','dual','sign','native_control']};
  for (const s of raw.samples) {
    assert(WIDTHS.includes(s.width));
    assert(Number.isInteger(s.repeat) && s.repeat >= 0 && s.repeat < raw.repeats);
    assert(stages[s.stage]?.includes(s.backend));
    assert.equal(s.iterations, raw.iterations);
    assert(Number.isFinite(s.total_ns) && s.total_ns > 0);
    assert.equal(typeof s.checksum, 'string');
    const key = `${s.width}/${s.repeat}/${s.stage}/${s.backend}`;
    assert(!keys.has(key), `duplicate ${key}`); keys.add(key);
  }
  for (const width of WIDTHS) for (let r = 0; r < raw.repeats; r++) {
    for (const [stage, backends] of Object.entries(stages)) for (const backend of backends) {
      assert(keys.has(`${width}/${r}/${stage}/${backend}`), 'missing sample');
    }
    const outputs = raw.samples.filter(s => s.width === width && s.repeat === r && s.stage !== 'pack_only');
    assert.equal(new Set(outputs.map(s => s.checksum)).size, 1, 'output witnesses differ across equivalent runs');
  }
  const rows = WIDTHS.map(width => {
    const times = {};
    for (const [stage, backends] of Object.entries(stages)) {
      times[stage] = {};
      for (const backend of backends) {
        const samples = raw.samples.filter(s => s.width === width && s.stage === stage && s.backend === backend).map(s => s.total_ns / s.iterations);
        times[stage][backend] = {median_ns:median(samples), min_ns:Math.min(...samples), max_ns:Math.max(...samples)};
      }
    }
    return {width, times};
  });
  const main = rows.find(r => r.width === 1024).times;
  const control_ratios = Object.fromEntries(['resident','end_to_end'].map(s => [s, main[s].native.median_ns / main[s].native_control.median_ns]));
  const instrument_valid = Object.values(control_ratios).every(r => r >= 0.90 && r <= 1.10);
  const predictions = [ ['AV1','resident',1.25], ['AV2','end_to_end',1.10] ].map(([id,stage,threshold]) => {
    const ratio = main[stage].native.median_ns / main[stage].sign.median_ns;
    return {id, stage, threshold, ratio, margin:ratio-threshold, outcome:!instrument_valid ? 'INVALID' : ratio >= threshold ? 'HELD' : 'FAILED'};
  });
  return {instrument_valid, control_ratios, predictions, rows};
}

function selfTest() {
  // Realm-local JSON fixtures also work in the isolated mutation-test loader.
  const clone = value => JSON.parse(JSON.stringify(value));
  const raw = {schema:'compute-preflight-native/v1',mode:'bench',seed:20260915,widths:WIDTHS,rows:32,batch:16,repeats:7,warmup:8,iterations:128,
    packing:{axis:'features',word_bits:64,end_to_end_weights:true,reuses_storage:true,boundary_validation_timed:false},
    build:{avx2:true,popcnt:true},runtime:{avx2:true,popcnt:true},correct:true,checksum:'fixture',samples:[]};
  for(const width of WIDTHS) for(let repeat=0;repeat<7;repeat++) for(const stage of ['resident','pack_only','end_to_end']) {
    for(const backend of (stage==='pack_only'?['dual','sign']:['native','dual','sign','native_control'])) {
      raw.samples.push({width,repeat,stage,backend,iterations:128,total_ns:(backend==='sign'?100:200)*128,checksum:'fixture'});
    }
  }
  assert(grade(raw).predictions.every(p=>p.outcome==='HELD'));
  const loser=clone(raw); loser.samples.filter(s=>s.backend==='sign').forEach(s=>s.total_ns*=4);
  assert(grade(loser).predictions.every(p=>p.outcome==='FAILED'));
  const noisy=clone(raw); noisy.samples.filter(s=>s.backend==='native_control').forEach(s=>s.total_ns*=2);
  assert(grade(noisy).predictions.every(p=>p.outcome==='INVALID'));
  const duplicate=clone(raw); duplicate.samples.push(duplicate.samples[0]); assert.throws(()=>grade(duplicate));
  const missing=clone(raw); missing.samples.pop(); assert.throws(()=>grade(missing));
  assert.throws(()=>grade({...raw,correct:false}));
  assert.throws(()=>grade({...raw,seed:0}));
  assert.throws(()=>grade({...raw,packing:{...raw.packing,end_to_end_weights:false}}));
  return 'audit scorer: healthy, losing, noisy, duplicate, missing, incorrect and changed-contract fixtures passed';
}

function git(args) { return execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim(); }
function run(output) {
  const dest = path.resolve(output);
  assert.equal(path.dirname(dest), __dirname, 'receipt must be in the preflight directory');
  assert(dest.endsWith('.json') && !fs.existsSync(dest), 'new JSON receipt required; no overwrite');
  const registration = git(['log','-1','--format=%H','--','research/compute-preflight/audit.cjs']);
  assert(/^[a-f0-9]{40}$/.test(registration), 'registration must be committed first');
  const artifacts = {};
  const frozenSources = new Map();
  for(const rel of ['research/compute-preflight/audit.cjs','research/compute-preflight/native.cpp','research/compute-preflight/test-native.cjs']) {
    const bytes = fs.readFileSync(path.join(ROOT,rel));
    const committed = execFileSync('git',['show',`${registration}:${rel}`],{cwd:ROOT});
    // Git may normalize CRLF; hash both the actual bytes and normalized source.
    const normalize=b=>b.toString('utf8').replace(/\r\n/g,'\n');
    assert.equal(normalize(bytes),normalize(committed), `unregistered change: ${rel}`);
    artifacts[rel]={sha256:SHA(bytes),normalized_sha256:SHA(normalize(bytes))};
    frozenSources.set(rel, bytes);
  }
  const receipt={schema:'compute-preflight-receipt/v1',registration,head:git(['rev-parse','HEAD']),
    dirty_paths:git(['status','--porcelain']),artifacts,started_utc:new Date().toISOString(),
    host:{platform:process.platform,arch:process.arch,node:process.version,cpu:os.cpus()[0].model,logical_cpus:os.cpus().length},
    compiler:{command:'g++',flags:FLAGS},status:'INVALID'};
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'tryte-native-preflight-'));
  const exe=path.join(scratch,process.platform==='win32'?'native.exe':'native');
  const frozenNative=path.join(scratch,'native.cpp');
  try {
    // Compile precisely the registered bytes, not a concurrently mutable pathname.
    fs.writeFileSync(frozenNative,frozenSources.get('research/compute-preflight/native.cpp'),{flag:'wx'});
    const version=spawnSync('g++',['--version'],{encoding:'utf8',windowsHide:true,timeout:5000});
    assert.equal(version.status,0,version.error?.message||version.stderr); receipt.compiler.version=version.stdout.trim();
    const build=spawnSync('g++',[...FLAGS,frozenNative,'-o',exe],{encoding:'utf8',windowsHide:true,timeout:60000});
    assert.equal(build.status,0,build.error?.message||build.stderr); receipt.compiler.diagnostics=build.stderr;
    receipt.executable_sha256=SHA(fs.readFileSync(exe));
    const check=spawnSync(exe,['--self-test'],{encoding:'utf8',windowsHide:true,timeout:15000});
    receipt.self_test={exit:check.status,stdout:check.stdout,stderr:check.stderr}; assert.equal(check.status,0,'native correctness failed');
    const bench=spawnSync(exe,['--bench','--seed','20260915'],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024});
    receipt.execution={exit:bench.status,stderr:bench.stderr,error:bench.error?.message||null};
    receipt.raw_stdout=bench.stdout;
    assert.equal(bench.status,0,'native timing failed');
    receipt.raw=JSON.parse(bench.stdout);
    receipt.analysis=grade(receipt.raw);
    receipt.status=receipt.analysis.instrument_valid?'VALID':'INVALID';
  } catch(e) {receipt.failure=String(e.message);} finally {
    receipt.finished_utc=new Date().toISOString();
    // Only the explicitly-created binary and empty directory, never recursive removal.
    if(fs.existsSync(exe)) fs.unlinkSync(exe);
    if(fs.existsSync(frozenNative)) fs.unlinkSync(frozenNative);
    if(fs.readdirSync(scratch).length===0) fs.rmdirSync(scratch);
  }
  fs.writeFileSync(dest,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({receipt:dest,status:receipt.status,failure:receipt.failure,analysis:receipt.analysis&&{control_ratios:receipt.analysis.control_ratios,predictions:receipt.analysis.predictions}},null,2));
  return receipt.status==='VALID';
}

if(require.main===module) {
  try {
    if(process.argv.length===3&&process.argv[2]==='--self-test') console.log(selfTest());
    else if(process.argv.length===4&&process.argv[2]==='--run') process.exitCode=run(process.argv[3])?0:1;
    else if(process.argv.length===4&&process.argv[2]==='--score') console.log(JSON.stringify(grade(JSON.parse(fs.readFileSync(process.argv[3],'utf8')).raw),null,2));
    else throw new Error('usage: audit.cjs --self-test | --run NEW_RECEIPT.json | --score RECEIPT.json');
  }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={grade,selfTest,FLAGS,WIDTHS};
