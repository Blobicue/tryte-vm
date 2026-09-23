#!/usr/bin/env node
'use strict';
/**
 * cli.js — Command-Line Interface for the Tril Compiler
 *
 * Usage:
 *   node src/compiler/cli.js compile <file.tril> [-o output.tasm]
 *   node src/compiler/cli.js run <file.tril> [inputs...]
 *   node src/compiler/cli.js hex <file.tril> [-o output.hex]
 */

const fs = require('fs');
const path = require('path');
const { compile, compileAndRun, compileToHex } = require('./tril.js');

function usage() {
  console.log(`
Tril — Balanced Ternary Implementation Language Compiler

Commands:
  compile <file.tril> [-o output.tasm]   Compile Tril source to TASM assembly
  run <file.tril> [inputs...]            Compile and execute Tril program on TryteVM
  hex <file.tril> [-o output.hex]        Compile to 12-bit dual-rail hex image
`);
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();

  const cmd = args[0];
  const file = args[1];

  if (!fs.existsSync(file)) {
    console.error(`Error: File '${file}' not found.`);
    process.exit(1);
  }

  const src = fs.readFileSync(file, 'utf8');

  switch (cmd) {
    case 'compile': {
      const outIdx = args.indexOf('-o');
      const outFile = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : null;
      const tasm = compile(src);
      if (outFile) {
        fs.writeFileSync(outFile, tasm + '\n', 'utf8');
        console.log(`Compiled ${file} -> ${outFile}`);
      } else {
        console.log(tasm);
      }
      break;
    }

    case 'run': {
      const inputs = args.slice(2).map(Number);
      const vm = compileAndRun(src, inputs);
      console.log(`Execution completed in ${vm.steps} steps.`);
      console.log(`Output: [ ${vm.output.join(', ')} ]`);
      break;
    }

    case 'hex': {
      const outIdx = args.indexOf('-o');
      const outFile = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : file.replace(/\.tril$/, '.hex');
      const hex = compileToHex(src);
      fs.writeFileSync(outFile, hex + '\n', 'utf8');
      console.log(`Compiled ${file} -> ${outFile} (729 cells)`);
      break;
    }

    default:
      console.error(`Unknown command '${cmd}'`);
      usage();
  }
}

if (require.main === module) {
  main();
}
