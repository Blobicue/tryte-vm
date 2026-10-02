'use strict';
/* qexec.js — registers QEXEC, the vTQPU braid instruction, as an extension of the tryte VM.
 *
 * QEXEC was opcode 25 inside the core (src/isa.js, src/vm.js), which made the core require
 * this line's quantum compiler to load. It is now registered through the core's extension
 * hook (isa.js registerExtension), and requiring this module is what makes QEXEC exist:
 * assemble or run a program containing it without requiring this first and the assembler
 * reports an unknown instruction, the VM an illegal opcode.
 *
 * Behaviour is unchanged from the in-core version. Settings are read from the options the
 * VM was constructed with: `deterministicQuantum` (take the most probable outcome, ties to
 * the lower trit) and `quantumRng` (a function returning [0,1); default Math.random).
 */

const T = require('../src/ternary.js');
const { registerExtension } = require('../src/isa.js');
const { evaluateBraid3 } = require('./src/unified-compiler.js');

function execQEXEC(vm, operand, ctx) {
  const len = vm.read(operand);
  if (len < 0 || len > 100) {
    throw new Error(`invalid QEXEC braid length ${len} at address ${ctx.pc}`);
  }
  const word = [];
  for (let i = 0; i < len; i++) {
    const g = vm.read(T.wrap(operand + 1 + i));
    if (![-3, -2, -1, 1, 2, 3].includes(g)) {
      throw new Error(`invalid QEXEC braid generator ${g} at address ${T.wrap(operand + 1 + i)}`);
    }
    word.push(g);
  }
  const mat = evaluateBraid3(word);
  const inTrit = Math.max(-1, Math.min(1, T.lowTrit(vm.A)));
  const col = inTrit + 1; // strictly 0, 1, 2
  const pNeg = mat.m[0][col].absSq();
  const pZero = mat.m[1][col].absSq();
  const pPos = mat.m[2][col].absSq();

  // Projective measurement into balanced ternary basis {-1, 0, +1}
  let outcome = 0;
  if (vm.opts.deterministicQuantum) {
    if (pNeg >= pZero && pNeg >= pPos) outcome = -1;
    else if (pZero >= pNeg && pZero >= pPos) outcome = 0;
    else outcome = 1;
  } else {
    const r = vm.opts.quantumRng ? vm.opts.quantumRng() : Math.random();
    if (r < pNeg) outcome = -1;
    else if (r < pNeg + pZero) outcome = 0;
    else outcome = 1;
  }

  // Preserve upper 5 trits of accumulator A and update lowest trit with measurement
  vm.A = T.wrap((vm.A - inTrit) + outcome);
}

const QEXEC = registerExtension('QEXEC', {
  code: 25, operand: 'addr',
  doc: 'A = vTQPU braid execution of program at addr',
  exec: execQEXEC,
});

module.exports = { QEXEC, execQEXEC };
