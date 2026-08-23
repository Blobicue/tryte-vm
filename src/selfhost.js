'use strict';
/* selfhost.js — run a tryte program inside a tryte machine, to any depth.
 *
 * Layer 0  the JavaScript TryteVM in vm.js
 * Layer 1  programs/interp.tasm, executing on layer 0
 * Layer 2  either the caller's program, or ANOTHER copy of interp.tasm
 * ...
 *
 * runNative and runHosted take the same source and the same inputs. If the
 * emulator is correct they produce the same output at every depth, and that
 * equality is the acceptance test — see test/test-selfhost.js.
 *
 * WHY THE INTERPRETER RELOCATES. Each machine addresses its memory through a
 * base: inner address `a` lives at host address `base + a`. A single fixed base
 * therefore shifts the usable window at every level, and it shifts it away from
 * the interpreter's own origin — with one fixed base, no copy of interp.tasm can
 * ever be loaded into a machine that interp.tasm is running. So each level gets
 * its own origin and its own base, chosen to keep the next window centred.
 */

const { TryteVM } = require('./vm.js');
const { assemble } = require('./assembler.js');

const MEM_LO = -364, MEM_HI = 364;

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

/** The interpreter source with its memory base rewritten for one level. */
function interpFor(base) {
  const out = interpSource().replace(/^IBASE:(\s*)\.equ(\s*)-?\d+/m, `IBASE:$1.equ$2${base}`);
  if (out === interpSource() && !/^IBASE:\s*\.equ\s*/m.test(out)) {
    throw new Error('interp.tasm no longer declares IBASE with .equ');
  }
  return out;
}

/** How many cells the interpreter occupies (independent of where it sits). */
function interpSize() {
  return assemble(interpFor(0), 0).cells.size;
}

/**
 * Work out where every layer sits for a given nesting depth.
 * depth 1 = native, 2 = one interpreter, 3 = an interpreter inside an interpreter.
 */
function plan(depth = 2) {
  const I = interpSize();
  let lo = MEM_LO, hi = MEM_HI;
  const levels = [];
  for (let k = 0; k < depth - 1; k++) {
    const size = hi - lo + 1;
    if (size < I) {
      throw new Error(
        `depth ${depth} is impossible: level ${k + 1} has ${size} cells and the ` +
        `interpreter needs ${I}`);
    }
    const origin = lo;                       // interpreter sits at the bottom
    const base = Math.round((lo + I + hi) / 2);  // centre the window it hands on
    levels.push({ origin, base, lo, hi, free: size - I });
    lo = lo + I - base;
    hi = hi - base;
  }
  return { I, levels, innerLo: lo, innerHi: hi, innerCells: hi - lo + 1, depth };
}

/** Depth-2 layout, kept for the page and for readable reporting. */
function layout() {
  const P = plan(2);
  const { origin, base } = P.levels[0];
  const asm = assemble(interpFor(base), origin);
  const addrs = [...asm.cells.keys()];
  return {
    cells: asm.cells, labels: asm.labels, IBASE: base,
    interpLo: Math.min(...addrs), interpHi: Math.max(...addrs),
    interpCells: asm.cells.size,
    innerLo: P.innerLo, innerHi: P.innerHi, innerCells: P.innerCells,
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

/**
 * Run the same program inside `depth - 1` nested copies of the interpreter.
 * Returns the host VM; `.output` is the emulated program's output.
 */
function runHosted(src, input = [], opts = {}) {
  const depth = opts.depth || 2;
  if (depth < 2) return runNative(src, input, opts);
  const P = plan(depth);
  const vm = new TryteVM({ input: input.slice(), maxSteps: opts.maxSteps || 20000000 });

  let off = 0;                       // host address of this level's address 0
  const layers = [];
  for (let k = 0; k < depth - 1; k++) {
    const { origin, base } = P.levels[k];
    const asm = assemble(interpFor(base), origin);
    for (const [a, v] of asm.cells) vm.write(off + a, v);
    // Each interpreter's emulated PC points at whatever it is running: the next
    // interpreter down, or (at the innermost layer) the program itself at 0.
    vm.write(off + asm.labels.ipc, k < depth - 2 ? P.levels[k + 1].origin : 0);
    vm.write(off + asm.labels.ia, 0);
    vm.write(off + asm.labels.ic, 0);
    if (k === 0) vm.PC = off + origin;
    layers.push({ level: k + 1, origin, base, hostOffset: off, labels: asm.labels });
    off += base;
  }

  const prog = assemble(src, 0);
  for (const [a, v] of prog.cells) {
    if (a < P.innerLo || a > P.innerHi) {
      throw new Error(
        `inner address ${a} is outside the emulated machine's memory ` +
        `(${P.innerLo}..${P.innerHi}) at depth ${depth}; the program is too large ` +
        `or reaches too far from its origin`);
    }
    vm.write(off + a, v);
  }

  vm.run();
  vm.layers = layers;
  vm.plan = P;
  return vm;
}

/** The greatest depth this machine can host, and why it stops there. */
function maxDepth() {
  let d = 1;
  for (;;) {
    try { plan(d + 1); d++; } catch { return d; }
    if (d > 10) return d;
  }
}

module.exports = {
  runNative, runHosted, layout, plan, maxDepth, interpSize,
  setInterpSource, interpSource, interpFor, MEM_LO, MEM_HI,
};
