'use strict';
// Validate the stored AV run, not a fresh timing run. Performance is not a CI gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const audit = require('../research/compute-preflight/audit.cjs');
const root = path.resolve(__dirname,'..');
const rel = 'research/compute-preflight/controller-20260915.json';
const receipt = JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root,'FINDINGS.json'),'utf8'));
const set = manifest.prediction_sets.find(s=>s.id==='AV');
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
  assert(set,'AV is not recorded');
  assert.equal(set.registered_at,receipt.registration);
  assert.equal(set.tool,'research/compute-preflight/audit.cjs');
  assert.equal(set.asserted_in,'test/test-compute-preflight.js');
  assert.equal(set.receipt,rel);
  assert.equal(set.receipt_sha256,sha(fs.readFileSync(path.join(root,rel))));
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
  const stored=set.predictions.find(p=>p.id===id);
  assert(stored&&result);
  assert.equal(stored.outcome,result.outcome);
  assert.deepEqual(stored.measured,result);
});
check('scorer subject mutations and its same-loader healthy control execute without timing',()=>{
  const out=execFileSync(process.execPath,['research/compute-preflight/test-audit.cjs'],{cwd:root,encoding:'utf8',timeout:10000,windowsHide:true});
  const result=JSON.parse(out);assert.equal(result.status,'PASS');assert.equal(result.timing_measured,false);
  assert(result.caughtSubjectMutations>0);
});
console.log(`ALL ${count} CHECKS PASSED`);
