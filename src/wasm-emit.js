'use strict';
/* wasm-emit.js — WebAssembly bytes, emitted at run time by JavaScript.
 *
 * NO TOOLCHAIN, NO COMMITTED BINARY, NO BASE64. The module this file builds is
 * assembled in memory when something asks for it, from source a reader can
 * follow, so the published page emits its own solver at load time rather than
 * shipping an opaque blob nobody can check. That constraint is
 * `design/13-instrument.md`'s and it is the reason this file exists at all.
 *
 * TWO LAYERS, and the second is the point.
 *
 *   THE ENCODER  — LEB128, the section layout, and one byte per instruction. Six
 *                  sections of the eleven, because the module needs integer
 *                  arithmetic, linear memory and structured control flow and
 *                  nothing else: no tables, no globals, no imports, no data.
 *
 *   THE LANGUAGE — a statement and expression layer over it. `src/solver-wasm.js`
 *                  is written in THAT, not in opcode arrays. A solver spelled as
 *                  a list of bytes is a solver nobody can hold against R0 by
 *                  reading it, and the whole value of R2 is that it is the same
 *                  algorithm; an unreadable R2 could differ anywhere and the gate
 *                  would be the only thing that ever knew.
 *
 * THE ENCODING TRAP, named because it is the one that costs the hours: sizes,
 * indices and local counts are UNSIGNED LEB128, and `i32.const` is SIGNED. The
 * two agree on 0..63 and diverge at 64, so a module that works on every small
 * constant fails on the first one past 63 -- and it fails as a validation error
 * far from the constant that caused it. Both encoders are checked on the values
 * either side of every boundary in `test/test-solver.js`.
 */

/* ------------------------------------------------------------------ LEB128 */

/** Unsigned LEB128: sizes, indices, counts, alignments, offsets. */
function uleb(n) {
  if (n < 0 || !Number.isInteger(n)) throw new Error(`uleb of ${n}`);
  const out = [];
  do { let b = n & 0x7f; n >>>= 7; if (n !== 0) b |= 0x80; out.push(b); } while (n !== 0);
  return out;
}

/** Signed LEB128: every `i32.const`, and nothing else in this module. */
function sleb(n) {
  if (!Number.isInteger(n)) throw new Error(`sleb of ${n}`);
  const out = [];
  let more = true;
  while (more) {
    let b = n & 0x7f;
    n >>= 7;
    if ((n === 0 && (b & 0x40) === 0) || (n === -1 && (b & 0x40) !== 0)) more = false;
    else b |= 0x80;
    out.push(b);
  }
  return out;
}

/** A length-prefixed run of bytes, which is how every wasm vector and section is framed. */
const sized = bytes => uleb(bytes.length).concat(bytes);
/** A vector: its element count, then the elements. */
const vec = items => uleb(items.length).concat(...items);

/* ------------------------------------------------------------------ opcodes */

const OP = {
  block: 0x02, loop: 0x03, if: 0x04, else: 0x05, end: 0x0b,
  br: 0x0c, br_if: 0x0d, return: 0x0f, call: 0x10,
  drop: 0x1a,
  local_get: 0x20, local_set: 0x21, local_tee: 0x22,
  i32_load: 0x28, i32_load8_s: 0x2c, i32_load8_u: 0x2d,
  i32_store: 0x36, i32_store8: 0x3a,
  i32_const: 0x41,
  i32_eqz: 0x45, i32_eq: 0x46, i32_ne: 0x47,
  i32_lt_s: 0x48, i32_lt_u: 0x49, i32_gt_s: 0x4a, i32_gt_u: 0x4b,
  i32_le_s: 0x4c, i32_le_u: 0x4d, i32_ge_s: 0x4e, i32_ge_u: 0x4f,
  i32_add: 0x6a, i32_sub: 0x6b, i32_mul: 0x6c,
  i32_and: 0x71, i32_or: 0x72, i32_xor: 0x73,
  i32_shl: 0x74, i32_shr_s: 0x75, i32_shr_u: 0x76,
};
const I32 = 0x7f;          // the only value type this module uses
const VOID = 0x40;         // block type: produces nothing

/* ------------------------------------------- the language: expressions
 *
 * Every expression node leaves EXACTLY ONE i32 on the stack. Every statement
 * node leaves the stack as it found it. That discipline is what lets the solver
 * be written as nested calls instead of as a byte list, and it is the property a
 * validation error is usually complaining about when one is raised.
 */

const konst = v => ({ k: 'const', v });
const get = i => ({ k: 'get', i });
const bin = (op, a, b) => ({ k: 'bin', op, a, b });
const un = (op, a) => ({ k: 'un', op, a });

const add = (a, b) => bin('i32_add', a, b);
const sub = (a, b) => bin('i32_sub', a, b);
const mul = (a, b) => bin('i32_mul', a, b);
const and = (a, b) => bin('i32_and', a, b);
const or = (a, b) => bin('i32_or', a, b);
const shl = (a, b) => bin('i32_shl', a, b);
const shrU = (a, b) => bin('i32_shr_u', a, b);
const eq = (a, b) => bin('i32_eq', a, b);
const ne = (a, b) => bin('i32_ne', a, b);
const ltS = (a, b) => bin('i32_lt_s', a, b);
const gtS = (a, b) => bin('i32_gt_s', a, b);
const leS = (a, b) => bin('i32_le_s', a, b);
const geS = (a, b) => bin('i32_ge_s', a, b);
const eqz = a => un('i32_eqz', a);

/** A 32-bit load. `addr` is a byte address; alignment is declared, never assumed. */
const load32 = addr => ({ k: 'load', op: 'i32_load', align: 2, addr });
/** One unsigned byte: node states and conduction codes. */
const load8u = addr => ({ k: 'load', op: 'i32_load8_u', align: 0, addr });
/** One SIGNED byte: device thresholds and rail levels, which are -1, 0 or +1. */
const load8s = addr => ({ k: 'load', op: 'i32_load8_s', align: 0, addr });

/* -------------------------------------------- the language: statements */

const set = (i, e) => ({ k: 'set', i, e });
const store32 = (addr, v) => ({ k: 'store', op: 'i32_store', align: 2, addr, v });
const store8 = (addr, v) => ({ k: 'store', op: 'i32_store8', align: 0, addr, v });
const ret = e => ({ k: 'return', e });
const call = (name, args) => ({ k: 'call', name, args });
const callStmt = (name, args) => ({ k: 'callStmt', name, args });
const ifThen = (c, body) => ({ k: 'if', c, body, otherwise: null });
const ifElse = (c, body, otherwise) => ({ k: 'if', c, body, otherwise });
const inc = i => set(i, add(get(i), konst(1)));

/**
 * `while (cond) { body }`, and the reason it is spelled out rather than assumed:
 * WebAssembly has no while loop. It has a `block` whose branch target is its END
 * and a `loop` whose branch target is its START, and a while loop is one nested
 * inside the other with the test inverted. `br_if` takes a RELATIVE depth, so a
 * literal label index in a nested loop is the classic way to write a program that
 * validates and jumps to the wrong place; every branch here is by name and the
 * depth is computed when the bytes are laid out.
 */
let labelSeq = 0;
function whileLoop(cond, body) {
  const brk = `brk${labelSeq}`, cont = `cont${labelSeq}`;
  labelSeq++;
  return {
    k: 'block',
    label: brk,
    body: [{
      k: 'loop',
      label: cont,
      body: [{ k: 'brIf', label: brk, c: eqz(cond) }, ...body, { k: 'br', label: cont }],
    }],
  };
}

/** `for (i = from; i < to; i++) { body }`, with `to` re-read each iteration. */
const forUpTo = (i, from, to, body) =>
  [set(i, from), whileLoop(ltS(get(i), to), [...body, inc(i)])];

/* ---------------------------------------------------------- the layout pass */

/**
 * One function: its parameters, its extra locals, and its body. Locals are named
 * rather than numbered, because the solver has enough of them that an off-by-one
 * in an index would be a silent wrong answer rather than an error.
 */
function fn(name, { params = [], locals = [], results = [], body = [] }) {
  const slots = new Map();
  params.forEach((p, i) => slots.set(p, i));
  locals.forEach((l, i) => slots.set(l, params.length + i));
  return { name, params, locals, results, body, slots };
}

/** Lay one function's body out as bytes, resolving names to indices and depths. */
function compile(f, funcIndex) {
  const out = [];
  const slot = nm => {
    const i = f.slots.get(nm);
    if (i === undefined) throw new Error(`${f.name}: no local named ${nm}`);
    return i;
  };
  // `labels` is the enclosing block/loop stack, innermost last. A branch's
  // immediate is how many of those to unwind, so it is the distance from the end.
  const emit = (node, labels) => {
    if (typeof node === 'number') throw new Error(`${f.name}: raw byte in the tree`);
    switch (node.k) {
      case 'const': out.push(OP.i32_const, ...sleb(node.v)); return;
      case 'get': out.push(OP.local_get, ...uleb(slot(node.i))); return;
      case 'bin': emit(node.a, labels); emit(node.b, labels); out.push(OP[node.op]); return;
      case 'un': emit(node.a, labels); out.push(OP[node.op]); return;
      case 'load':
        emit(node.addr, labels);
        out.push(OP[node.op], ...uleb(node.align), ...uleb(0));
        return;
      case 'store':
        emit(node.addr, labels); emit(node.v, labels);
        out.push(OP[node.op], ...uleb(node.align), ...uleb(0));
        return;
      case 'set': emit(node.e, labels); out.push(OP.local_set, ...uleb(slot(node.i))); return;
      case 'return': if (node.e) emit(node.e, labels); out.push(OP.return); return;
      case 'call':
      case 'callStmt': {
        for (const a of node.args) emit(a, labels);
        const idx = funcIndex.get(node.name);
        if (idx === undefined) throw new Error(`${f.name}: calls unknown ${node.name}`);
        out.push(OP.call, ...uleb(idx));
        return;
      }
      case 'if': {
        emit(node.c, labels);
        out.push(OP.if, VOID);
        const inner = labels.concat(['$if']);
        for (const s of node.body) emit(s, inner);
        if (node.otherwise) { out.push(OP.else); for (const s of node.otherwise) emit(s, inner); }
        out.push(OP.end);
        return;
      }
      case 'block':
      case 'loop': {
        out.push(node.k === 'block' ? OP.block : OP.loop, VOID);
        const inner = labels.concat([node.label]);
        for (const s of node.body) emit(s, inner);
        out.push(OP.end);
        return;
      }
      case 'br':
      case 'brIf': {
        const at = labels.lastIndexOf(node.label);
        if (at === -1) throw new Error(`${f.name}: branch to ${node.label}, which is not open here`);
        if (node.k === 'brIf') emit(node.c, labels);
        out.push(node.k === 'br' ? OP.br : OP.br_if, ...uleb(labels.length - 1 - at));
        return;
      }
      default: throw new Error(`${f.name}: unknown node ${node.k}`);
    }
  };
  for (const s of f.body) emit(s, []);
  out.push(OP.end);
  // Locals are declared in runs of one type. This module has one type, so one run.
  const decls = f.locals.length ? vec([uleb(f.locals.length).concat([I32])]) : vec([]);
  return sized(decls.concat(out));
}

/* --------------------------------------------------------------- the module */

/**
 * Assemble a module from a list of functions. Sections go out in the order the
 * format fixes -- type, function, memory, export, code -- because a decoder reads
 * them in that order and does not look for them.
 */
function emitModule(fns, { memoryPages = 1, exports: exported = [], exportMemory = 'memory' } = {}) {
  const funcIndex = new Map();
  fns.forEach((f, i) => funcIndex.set(f.name, i));

  // One type per distinct signature, deduplicated so the section stays small.
  const types = [];
  const typeOf = new Map();
  for (const f of fns) {
    const sig = `${f.params.length}->${f.results.length}`;
    if (!typeOf.has(sig)) {
      typeOf.set(sig, types.length);
      types.push([0x60].concat(vec(f.params.map(() => [I32])), vec(f.results.map(() => [I32]))));
    }
  }

  const typeSec = vec(types);
  const funcSec = vec(fns.map(f => uleb(typeOf.get(`${f.params.length}->${f.results.length}`))));
  const memSec = vec([[0x00].concat(uleb(memoryPages))]);          // min only, no maximum
  const exportSec = vec([
    ...exported.map(nm => {
      const bytes = [...Buffer.from(nm, 'utf8')];
      return vec(bytes.map(b => [b])).concat([0x00], uleb(funcIndex.get(nm)));
    }),
    ...(exportMemory
      ? [vec([...Buffer.from(exportMemory, 'utf8')].map(b => [b])).concat([0x02], uleb(0))]
      : []),
  ]);
  const codeSec = vec(fns.map(f => compile(f, funcIndex)));

  const section = (id, payload) => [id].concat(sized(payload));
  return Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,               // magic, version 1
    ...section(1, typeSec),
    ...section(3, funcSec),
    ...section(5, memSec),
    ...section(7, exportSec),
    ...section(10, codeSec),
  ]);
}

/**
 * The smallest module this emitter can produce that does something checkable:
 * `add(a, b)`. It exists so the encoder is validated against a known answer
 * BEFORE the solver is, because a validation failure in a four-hundred-line
 * function says nothing about where the fault is.
 */
function demoAddModule() {
  return emitModule([
    fn('add', { params: ['a', 'b'], results: ['i32'], body: [ret(add(get('a'), get('b')))] }),
    // and one with a constant past the signed/unsigned LEB boundary in both
    // directions, because that is the encoding this file is most likely to get
    // wrong and the failure would otherwise show up somewhere else entirely.
    fn('boundaries', { params: ['x'], results: ['i32'],
      body: [ret(add(add(get('x'), konst(-64)), konst(200)))] }),
  ], { exports: ['add', 'boundaries'] });
}

module.exports = {
  uleb, sleb, sized, vec, OP, I32, VOID,
  konst, get, bin, un, add, sub, mul, and, or, shl, shrU,
  eq, ne, ltS, gtS, leS, geS, eqz,
  load32, load8u, load8s,
  set, store32, store8, ret, call, callStmt, ifThen, ifElse, inc,
  whileLoop, forUpTo, fn, compile, emitModule, demoAddModule,
};
