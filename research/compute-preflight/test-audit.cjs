'use strict';
// NOT REGISTERED: synthetic instrument checks; never executes a timing run.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const file = path.join(__dirname,'audit.cjs');
const source = fs.readFileSync(file,'utf8');
const audit = require('./audit.cjs');
assert.match(audit.selfTest(), /fixtures passed/);
function isolated(src) {
  const m = {exports:{}};
  vm.runInNewContext(src,{require,module:m,exports:m.exports,__dirname,console,process,Buffer});
  return m.exports;
}
// Same-loader healthy control prevents a realm/loader fault counting as a kill.
assert.match(isolated(source).selfTest(), /fixtures passed/);
let caught = 0;
for(const [before,after] of [
  ['ratio >= threshold', 'ratio <= threshold'],
  ['r >= 0.90 && r <= 1.10', 'true'],
  ["assert(!keys.has(key), `duplicate ${key}`);", ''],
]) {
  assert(source.includes(before));
  const subject = isolated(source.replace(before,after));
  assert.throws(()=>subject.selfTest(), {code:'ERR_ASSERTION'}, `subject mutation not caught: ${before}`);
  caught++;
}
const child=spawnSync(process.execPath,[file,'--self-test'],{encoding:'utf8',timeout:5000,windowsHide:true});
assert.equal(child.status,0,child.stderr);
assert.match(child.stdout,/fixtures passed/);
console.log(JSON.stringify({status:'PASS',scope:'audit fixtures and CLI only',caughtSubjectMutations:caught,timing_measured:false}));
