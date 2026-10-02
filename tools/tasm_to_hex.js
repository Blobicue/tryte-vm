'use strict';
/**
 * tasm_to_hex.js — Assembles TASM code to 12-bit dual-rail hex for Verilog $readmemh
 *
 * Each 6-trit word is encoded as 12 bits:
 * For each trit i in 0..5:
 *   trit =  0 => 2'b00
 *   trit = +1 => 2'b01 (bit 2*i is 1, bit 2*i+1 is 0)
 *   trit = -1 => 2'b10 (bit 2*i is 0, bit 2*i+1 is 1)
 */

const fs = require('fs');
const path = require('path');
const T = require('../src/ternary.js');
const { assemble } = require('../src/assembler.js');

function tryteToDualRail12(val) {
  const trits = T.toTrits(val);
  let bits = 0;
  for (let i = 0; i < 6; i++) {
    const t = trits[i];
    if (t === 1) {
      bits |= (1 << (2 * i));
    } else if (t === -1) {
      bits |= (2 << (2 * i));
    }
  }
  return bits;
}

function assembleToHex(tasmSource) {
  const { cells } = assemble(tasmSource);
  const lines = [];

  // Physical addresses 0..728 map to balanced addresses -364..+364
  for (let phys = 0; phys < 729; phys++) {
    const balancedAddr = phys - 364;
    const val = cells.has(balancedAddr) ? cells.get(balancedAddr) : 0;
    const dualRail = tryteToDualRail12(val);
    lines.push(dualRail.toString(16).padStart(3, '0'));
  }

  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node tools/tasm_to_hex.js <input.tasm> [output.hex]');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || inputFile.replace(/\.tasm$/, '.hex');

  const src = fs.readFileSync(inputFile, 'utf8');
  const hex = assembleToHex(src);

  fs.writeFileSync(outputFile, hex + '\n', 'utf8');
  console.log(`Assembled ${inputFile} -> ${outputFile} (729 cells)`);
}

if (require.main === module) {
  main();
}

module.exports = { tryteToDualRail12, assembleToHex };
