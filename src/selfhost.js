'use strict';
/* selfhost.js — run a tryte program inside a tryte machine that is itself
 * running on the tryte VM.
 *
 * Layer 0  the JavaScript TryteVM in vm.js
 * Layer 1  programs/interp.tasm, executing on layer 0
 * Layer 2  the caller's program, executing on layer 1
 *
 * runNative and runHosted take the same source and the same inputs. If the
 * emulator is correct they produce the same output, and that equality is the
 * acceptance test — see test/test-selfhost.js.
 */

const { TryteVM } = require('./vm.js');
const { assemble } = require('./assembler.js');

const INTERP_ORIGIN = -364;

/* The interpreter source is injected rather than read at load time, so this
 * module works unchanged in the browser bundle, where there is no filesystem.
 * Node falls back to reading the file lazily. */
let _interpSrc = null;
function setInterpSource(src) { _interpSrc = src; }
function interpSource() {
  if (_interpSrc === null) {
    _interpSrc = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'programs', 'interp.tasm'), 'utf8');
  }
  return _interpSrc;
}

/** Assemble the interpreter once and report where everything sits. */
function layout() {
  const { cells, labels } = assemble(interpSource(), INTERP_ORIGIN);
  const addrs = [...cells.keys()];
  const top = Math.max(...addrs);
  return {
    cells, labels,
    IBASE: labels.IBASE,
    interpLo: Math.min(...addrs),
    interpHi: top,
    innerLo: top + 1 - labels.IBASE,      // lowest inner address that is safe
    innerHi: 364 - labels.IBASE,          // highest inner address that exists
    interpCells: cells.size,
    innerCells: 364 - top,
  };
}

/** Run a program directly on the JavaScript VM. */
function runNative(src, input = [], opts = {}) {
  const vm = new TryteVM({ input: input.slice(), maxSteps: opts.maxSteps || 200000 });
  const { cells } = assemble(src, 0);
  for (const [addr, val] of cells) vm.write(addr, val);
  vm.PC = 0;
  vm.run();
  return vm;
}

/** Run the same program inside the emulated machine. */
function runHosted(src, input = [], opts = {}) {
  const L = layout();
  const vm = new TryteVM({ input: input.slice(), maxSteps: opts.maxSteps || 5000000 });

  for (const [addr, val] of L.cells) vm.write(addr, val);        // layer 1

  const inner = assemble(src, 0);                                // layer 2
  for (const [addr, val] of inner.cells) {
    if (addr < L.innerLo || addr > L.innerHi) {
      throw new Error(
        `inner address ${addr} is outside the emulated machine's memory ` +
        `(${L.innerLo}..${L.innerHi}); the program is too large or reaches too low`);
    }
    vm.write(L.IBASE + addr, val);
  }

  vm.write(L.labels.ipc, 0);            // inner program counter starts at 0
  vm.write(L.labels.ia, 0);
  vm.write(L.labels.ic, 0);
  vm.PC = INTERP_ORIGIN;
  vm.run();
  return vm;
}

module.exports = { runNative, runHosted, layout, setInterpSource, interpSource, INTERP_ORIGIN };
