'use strict';
/* run.js — CLI: node src/run.js <program.tasm> [inputs...] */
const fs = require('fs');
const path = require('path');
const T = require('./ternary.js');
const { TryteVM } = require('./vm.js');
const { loadInto } = require('./assembler.js');

function runFile(file, input = [], opts = {}) {
  const src = fs.readFileSync(file, 'utf8');
  const vm = new TryteVM({ input, ...opts });
  loadInto(vm, src, 0);
  vm.run();
  return vm;
}

if (require.main === module) {
  const [, , file, ...rest] = process.argv;
  if (!file) { console.error('usage: node src/run.js <program.tasm> [inputs...]'); process.exit(2); }
  const vm = runFile(path.resolve(file), rest.map(Number));
  console.log(`${path.basename(file)}  —  ${vm.steps} instructions`);
  console.log('output:', vm.output.join(', '));
  console.log('trits :', vm.output.map(T.tritString).join('  '));
}

module.exports = { runFile };
