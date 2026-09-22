'use strict';
// Validate the stored AV and AW runs, not fresh timing runs. Performance is not a CI gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const audit = require('../research/compute-preflight/audit.cjs');
const workerAudit = require('../research/compute-preflight/worker-audit.cjs');
const root = path.resolve(__dirname,'..');
const rel = 'research/compute-preflight/controller-20260915.json';
const receipt = JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const workerRel = 'research/compute-preflight/worker-node-ecd2b9-20260921.json';
const workerBytes = fs.readFileSync(path.join(root,workerRel));
const workerReceipt = JSON.parse(workerBytes);
const manifest = JSON.parse(fs.readFileSync(path.join(root,'FINDINGS.json'),'utf8'));
const avSet = manifest.prediction_sets.find(s=>s.id==='AV');
const awSet = manifest.prediction_sets.find(s=>s.id==='AW');
let count=0;
const check=(label,fn)=>{fn();count++;console.log(`  [PASS] ${label}`);};
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
check('the instrument distinguishes healthy, losing, invalid and malformed fixtures',()=>assert.match(audit.selfTest(),/fixtures passed/));
check('recorded receipt has a valid instrument, not merely a favorable prediction',()=>{
  assert.equal(receipt.schema,'compute-preflight-receipt/v1');
  assert.equal(receipt.status,'VALID');
  assert.equal(receipt.execution.exit,0);
  assert.equal(receipt.self_test.exit,0);
  assert.equal(receipt.failure,undefined);
});
check('saved raw stdout is the raw sample object being scored',()=>assert.deepEqual(JSON.parse(receipt.raw_stdout),receipt.raw));
check('the analysis is exactly recomputed from the retained samples',()=>assert.deepEqual(audit.grade(receipt.raw),receipt.analysis));
check('AV is attached to its immutable preregistration and exact receipt',()=>{
  assert(avSet,'AV is not recorded');
  assert.equal(avSet.registered_at,receipt.registration);
  assert.equal(avSet.tool,'research/compute-preflight/audit.cjs');
  assert.equal(avSet.asserted_in,'test/test-compute-preflight.js');
  assert.equal(avSet.receipt,rel);
  assert.equal(avSet.receipt_sha256,sha(fs.readFileSync(path.join(root,rel))));
});
check('recorded source hashes match the registration, not an assertion about current files',()=>{
  for(const [file,evidence] of Object.entries(receipt.artifacts)){
    const registered=execFileSync('git',['show',`${receipt.registration}:${file}`],{cwd:root});
    assert.equal(sha(registered.toString('utf8').replace(/\r\n/g,'\n')),evidence.normalized_sha256,file);
  }
});
check('the registration is reachable and precedes the recorded run head',()=>{
  execFileSync('git',['merge-base','--is-ancestor',receipt.registration,receipt.head],{cwd:root});
  execFileSync('git',['merge-base','--is-ancestor',receipt.registration,'HEAD'],{cwd:root});
});
check('compiler and host boundary are explicit, and no controller result is called a mini-PC run',()=>{
  assert.deepEqual(receipt.compiler.flags,audit.FLAGS);
  assert.match(receipt.host.cpu,/7800X3D/);
  assert.equal(receipt.host.platform,'win32');
  assert.equal(receipt.host.arch,'x64');
  assert.match(receipt.executable_sha256,/^[a-f0-9]{64}$/);
});
for(const id of ['AV1','AV2']) check(`${id} retains the outcome and margin computed from the original raw timing`,()=>{
  const result=receipt.analysis.predictions.find(p=>p.id===id);
  const stored=avSet.predictions.find(p=>p.id===id);
  assert(stored&&result);
  assert.equal(stored.outcome,result.outcome);
  assert.deepEqual(stored.measured,result);
});
check('scorer subject mutations and its same-loader healthy control execute without timing',()=>{
  const out=execFileSync(process.execPath,['research/compute-preflight/test-audit.cjs'],{cwd:root,encoding:'utf8',timeout:10000,windowsHide:true});
  const result=JSON.parse(out);assert.equal(result.status,'PASS');assert.equal(result.timing_measured,false);
  assert(result.caughtSubjectMutations>0);
});

function assertWorkerReplay(candidate,stored,bytes){
  assert.equal(candidate.schema,'compute-preflight-worker-receipt/v1');
  assert.equal(candidate.status,'VALID');
  assert.equal(candidate.timing_started,true);
  assert.equal(candidate.execution.exit,0);
  assert.equal(candidate.self_test.exit,0);
  assert.equal(candidate.failure,undefined);
  assert.equal(candidate.after_error,undefined);
  assert.equal(candidate.cleanup_error,undefined);
  assert.deepEqual(JSON.parse(candidate.raw_stdout),candidate.raw);
  assert.deepEqual(workerAudit.grade(candidate.raw),candidate.analysis);

  assert(stored,'AW is not recorded');
  assert.equal(stored.registered_at,candidate.registration);
  assert.equal(stored.results_at,'bd22d7ee600a2de05f3516849a52897b95b2c02d');
  assert.equal(stored.tool,'research/compute-preflight/worker-audit.cjs');
  assert.equal(stored.asserted_in,'test/test-compute-preflight.js');
  assert.equal(stored.receipt,workerRel);
  assert.equal(stored.receipt_sha256,sha(bytes));

  for(const [file,evidence] of Object.entries(candidate.artifacts)){
    const registered=execFileSync('git',['show',`${candidate.registration}:${file}`],{cwd:root});
    assert.equal(sha(registered.toString('utf8').replace(/\r\n/g,'\n')),evidence.normalized_sha256,file);
  }
  execFileSync('git',['merge-base','--is-ancestor',candidate.registration,candidate.head],{cwd:root});
  execFileSync('git',['merge-base','--is-ancestor',candidate.registration,stored.results_at],{cwd:root});
  execFileSync('git',['merge-base','--is-ancestor',stored.results_at,'HEAD'],{cwd:root});

  assert.deepEqual(candidate.compiler.flags,workerAudit.FLAGS);
  assert.deepEqual(candidate.expected_host,workerAudit.EXPECTED);
  assert.equal(candidate.host.hostname,workerAudit.EXPECTED.hostname);
  assert.equal(candidate.host.platform,workerAudit.EXPECTED.platform);
  assert.equal(candidate.host.arch,workerAudit.EXPECTED.arch);
  assert.match(candidate.host.cpu,/AMD Ryzen 7 5825U/);
  assert.equal(candidate.host.logical_cpus,workerAudit.EXPECTED.logicalCpus);
  assert.match(candidate.executable_sha256,/^[a-f0-9]{64}$/);
  assert.equal(candidate.preflight.valid,true);
  assert.equal(candidate.postflight.valid,true);
  assert.equal(candidate.head_after,candidate.registration);
  assert.equal(candidate.dirty_before,'');
  assert.equal(candidate.dirty_after,'');
  assert.deepEqual(candidate.before.governors,candidate.after.governors);
  assert.equal(Object.keys(candidate.before.governors).length,candidate.host.logical_cpus);
  assert(Object.values(candidate.before.governors).every(value=>typeof value==='string'&&value.length>0));

  for(const id of ['AW1','AW2']){
    const result=candidate.analysis.predictions.find(p=>p.id===id);
    const recorded=stored.predictions.find(p=>p.id===id);
    assert(recorded&&result);
    assert.equal(recorded.outcome,result.outcome);
    assert.deepEqual(recorded.measured,result);
  }
  return true;
}

check('AW is replayed from a valid one-node receipt with immutable registration and raw samples',()=>{
  assert.equal(assertWorkerReplay(workerReceipt,awSet,workerBytes),true);
});
for(const id of ['AW1','AW2']) check(`${id} retains the preregistered comparison, outcome and exact margin`,()=>{
  const result=workerReceipt.analysis.predictions.find(p=>p.id===id);
  const stored=awSet.predictions.find(p=>p.id===id);
  assert(stored&&result);
  assert.equal(stored.claim,id==='AW1'
    ? 'At width1024, median(native resident)/median(sign resident) >= 1.25.'
    : 'At width1024, median(native end_to_end)/median(sign end_to_end) <= 1.00.');
  assert.deepEqual(stored.measured,result);
});
check('AW records feature packing rather than independent-example bit slicing',()=>{
  assert.deepEqual(workerReceipt.raw.packing,{
    axis:'features',word_bits:64,end_to_end_weights:true,
    reuses_storage:true,boundary_validation_timed:false,
  });
  const nativeSource=execFileSync('git',['show',`${workerReceipt.registration}:research/compute-preflight/native.cpp`],{
    cwd:root,encoding:'utf8',
  });
  assert.doesNotMatch(nativeSource,/std::thread|pthread_|#pragma\s+omp/);
});
check('AW scorer and refusal controls execute without starting timing',()=>{
  const out=execFileSync(process.execPath,['research/compute-preflight/test-worker-audit.cjs'],{
    cwd:root,encoding:'utf8',timeout:10000,windowsHide:true,
  });
  assert.match(out,/ALL 6 CHECKS PASSED/);
});
check('AW replay checks reject altered verdicts, scope, host, provenance and governor state',()=>{
  const copy=value=>JSON.parse(JSON.stringify(value));
  const mutations=[
    value=>{value.status='INVALID';},
    value=>{value.analysis.predictions[0].ratio=1;},
    value=>{value.raw.packing.axis='examples';},
    value=>{value.host.cpu='not the registered CPU';},
    value=>{value.artifacts[Object.keys(value.artifacts)[0]].normalized_sha256='0'.repeat(64);},
    value=>{value.after.governors.policy0='performance';},
  ];
  for(const mutate of mutations){
    const specimen=copy(workerReceipt);mutate(specimen);
    assert.throws(()=>assertWorkerReplay(specimen,awSet,workerBytes));
  }
  const wrongManifest=copy(awSet);wrongManifest.receipt_sha256='0'.repeat(64);
  assert.throws(()=>assertWorkerReplay(workerReceipt,wrongManifest,workerBytes));
});
console.log(`ALL ${count} CHECKS PASSED`);
