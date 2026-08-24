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
const { OPS } = require('./isa.js');
const { assemble } = require('./assembler.js');

const MEM_LO = -364, MEM_HI = 364;

/* The interpreter source is injected rather than read at load time, so this
 * module works unchanged in the browser bundle, where there is no filesystem.
 * Node falls back to reading the file lazily. */
/* Two interpreters. 'full' implements all 23 opcodes; 'core' implements the 14
 * it needs to interpret itself, which makes it small enough to stack three deep.
 * See programs/interp-core.tasm for why that subset is the right one. */
const FILES = { full: 'interp.tasm', core: 'interp-core.tasm' };
const _src = { full: null, core: null };

function setInterpSource(src, variant = 'full') { _src[variant] = src; }
function interpSource(variant = 'full') {
  if (_src[variant] === null) {
    _src[variant] = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'programs', FILES[variant]), 'utf8');
  }
  return _src[variant];
}

/** The interpreter source with its memory base rewritten for one level. */
function interpFor(base, variant = 'full') {
  const src = interpSource(variant);
  if (!/^IBASE:\s*\.equ\s*-?\d+/m.test(src)) {
    throw new Error(`${FILES[variant]} no longer declares IBASE with .equ`);
  }
  return src.replace(/^IBASE:(\s*)\.equ(\s*)-?\d+/m, `IBASE:$1.equ$2${base}`);
}

/** How many cells an interpreter occupies (independent of where it sits). */
function interpSize(variant = 'full') {
  return assemble(interpFor(0, variant), 0).cells.size;
}

/**
 * Work out where every layer sits for a given nesting depth.
 * depth 1 = native, 2 = one interpreter, 3 = an interpreter inside an interpreter.
 */
function plan(depth = 2, variant = 'full') {
  const I = interpSize(variant);
  let lo = MEM_LO, hi = MEM_HI;
  const levels = [];
  for (let k = 0; k < depth - 1; k++) {
    const size = hi - lo + 1;
    if (size < I) {
      throw new Error(
        `depth ${depth} is impossible with the ${variant} interpreter: level ${k + 1} ` +
        `has ${size} cells and the interpreter needs ${I}`);
    }
    const origin = lo;                       // interpreter sits at the bottom
    const base = Math.round((lo + I + hi) / 2);  // centre the window it hands on
    levels.push({ origin, base, lo, hi, free: size - I });
    lo = lo + I - base;
    hi = hi - base;
  }
  return { I, levels, innerLo: lo, innerHi: hi, innerCells: hi - lo + 1, depth, variant };
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
  // Prefer the full 23-opcode interpreter; fall back to the self-sufficient core
  // when the full one cannot be stacked that deep.
  const variant = opts.variant || pickVariant(src, depth);
  const P = plan(depth, variant);
  const vm = new TryteVM({ input: input.slice(), maxSteps: opts.maxSteps || 20000000 });

  let off = 0;                       // host address of this level's address 0
  const layers = [];
  for (let k = 0; k < depth - 1; k++) {
    const { origin, base } = P.levels[k];
    const asm = assemble(interpFor(base, variant), origin);
    for (const [a, v] of asm.cells) vm.write(off + a, v);
    // Each interpreter's emulated PC points at whatever it is running: the next
    // interpreter down, or (at the innermost layer) the program itself at 0.
    vm.write(off + asm.labels.ipc, k < depth - 2 ? P.levels[k + 1].origin : 0);
    vm.write(off + asm.labels.ia, 0);
    vm.write(off + asm.labels.ic, 0);
    if (k === 0) vm.PC = off + origin;
    layers.push({ level: k + 1, origin, base, hostOffset: off, labels: asm.labels, variant });
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

/** Which opcodes a variant actually implements, read from its jump table. */
function supportedOpcodes(variant = 'full') {
  const src = interpSource(variant);
  const block = src.slice(src.indexOf('jtbl:'));
  const handlers = [...block.matchAll(/h_[a-z0-9_]+/g)].map(m => m[0]);
  const names = Object.keys(OPS).sort((a, b) => OPS[a].code - OPS[b].code);
  const out = new Set();
  handlers.forEach((h, code) => { if (h !== 'h_bad' && names[code]) out.add(names[code]); });
  return out;
}

/** The opcodes a program uses. */
function programOpcodes(src) {
  const out = new Set();
  for (const line of src.split(/\r?\n/)) {
    const m = line.replace(/[;#].*/, '').trim()
      .replace(/^[A-Za-z_][A-Za-z0-9_]*:\s*/, '').split(/\s+/)[0];
    if (m && m.toUpperCase() in OPS) out.add(m.toUpperCase());
  }
  return out;
}

/**
 * Choose an interpreter for this program at this depth. Three things must hold,
 * and picking on depth alone is not enough: adding TOP grew the full interpreter
 * by 17 cells, which left depth 3 still reachable but shrank its innermost window
 * from 81 cells to 47 — enough to stop threeway.tasm fitting while `fits(3)`
 * still said yes.
 */
function pickVariant(src, depth) {
  const prog = assemble(src, 0);
  const addrs = [...prog.cells.keys()];
  const lo = Math.min(...addrs), hi = Math.max(...addrs);
  const used = programOpcodes(src);
  const reasons = [];
  for (const v of ['full', 'core']) {
    if (!fits(depth, v)) { reasons.push(`${v}: too big to stack ${depth} deep`); continue; }
    const P = plan(depth, v);
    if (lo < P.innerLo || hi > P.innerHi) {
      reasons.push(`${v}: program spans ${lo}..${hi}, window is ${P.innerLo}..${P.innerHi}`);
      continue;
    }
    const missing = [...used].filter(o => !supportedOpcodes(v).has(o));
    if (missing.length) { reasons.push(`${v}: does not implement ${missing.join(' ')}`); continue; }
    return v;
  }
  throw new Error(`no interpreter can host this program at depth ${depth}:\n  ` + reasons.join('\n  '));
}

/** Can `depth` levels of this interpreter variant be stacked at all? */
function fits(depth, variant = 'full') {
  try { plan(depth, variant); return true; } catch { return false; }
}

/** The greatest depth this machine can host with a given interpreter. */
function maxDepth(variant = 'full') {
  let d = 1;
  while (d < 10 && fits(d + 1, variant)) d++;
  return d;
}

module.exports = {
  runNative, runHosted, layout, plan, maxDepth, fits, interpSize,
  supportedOpcodes, programOpcodes, pickVariant,
  setInterpSource, interpSource, interpFor, FILES, MEM_LO, MEM_HI,
};
