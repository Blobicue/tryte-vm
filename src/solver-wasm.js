'use strict';
/* solver-wasm.js — R2: R0's algorithm a third time, in WebAssembly, over R1's form.
 *
 * The module is written in the statement and expression layer of
 * `src/wasm-emit.js` and assembled at run time. Nothing here is a byte array by
 * hand: R2's only value is that it is THE SAME ALGORITHM, and a solver spelled as
 * opcodes is one nobody can hold against R0 by reading it.
 *
 * SAME ALGORITHM, and the list is R1's list because it is R0's list. Same
 * fixed-point loop, conduction evaluated once per device per pass from the state
 * at the start of the pass and read by both walks, `rails x 2` traversals per pass
 * and never fused, no incremental recomputation, Jacobi update, same termination
 * test, and the cap reported rather than swallowed.
 *
 * ONE GENERIC MODULE, NOT ONE PER NETWORK. Nothing network-specific is baked into
 * the bytes: a header at address 0 carries the counts and a base pointer per
 * array, and every function reads what it needs into locals on entry. Loading a
 * network is a copy of the packed typed arrays into linear memory. So the module
 * is emitted and instantiated ONCE per process, and the gate runs a hundred and
 * more networks through the same instance.
 *
 * THE CAP IS A RETURN VALUE, NOT A TRAP. `solve` answers 1 for settled and 0 for
 * ran out, and the JavaScript side raises R0's error. "Did not settle within k"
 * is a measurement -- `fullSweep` reads a pass count by catching exactly that
 * throw -- and a module that trapped would give the caller an error it could not
 * tell apart from a fault in the module.
 *
 * SEEDING AND REFUSALS STAY IN `netpack.js`. The gate's entry copies `P.value`
 * after `NP.seed` has filled it, so R2 inherits R0's `init` semantics and R0's two
 * refusals rather than carrying a second implementation of them that would then
 * need its own comparison. The sweep's seeding IS in the module, because that is
 * the loop being timed, and the gate checks it separately against R1's.
 */

const W = require('./wasm-emit.js');
const NP = require('./netpack.js');

/* --------------------------------------------------------------- the header
 *
 * Twenty i32 fields at address 0: five counts and fifteen base pointers. Named
 * rather than numbered here and read by name in the module below, because an
 * off-by-one in a hand-numbered header is a wrong answer and not an error.
 */
const HEADER = ['nodeCount', 'deviceCount', 'railCount', 'words', 'inputCount',
  'devGate', 'devIsN', 'devVt', 'adjStart', 'adjNode', 'adjDev',
  'driven', 'railId', 'railLevel', 'inputId',
  'value', 'cond', 'reachDef', 'reachPos', 'stack'];
const FIELD = Object.fromEntries(HEADER.map((nm, i) => [nm, i * 4]));
const HEADER_BYTES = 128;                       // 80 used, rounded up and aligned
const PAGE = 65536;

/** Read one header field. */
const hdr = nm => W.load32(W.konst(FIELD[nm]));
/** Byte address of element `i` of a 4-byte-wide array based at local `base`. */
const at4 = (base, i) => W.add(W.get(base), W.shl(i, W.konst(2)));
/** Byte address of element `i` of a 1-byte-wide array based at local `base`. */
const at1 = (base, i) => W.add(W.get(base), i);

/* ---------------------------------------------------------------- the module */

/**
 * `reach(rail, bitsPtr, definite)` — nodes reachable from a rail, following edges
 * the mode accepts, into one of the preallocated bitsets.
 *
 * DRIVEN NODES ARE TERMINALS (N2). A rail or an input is marked reached and is
 * NOT pushed, so signal stops there rather than passing through. Dropping that
 * guard makes every node a rail drives look contended and resolves correct
 * circuits to X, which is a bug this model actually had.
 */
const reachFn = W.fn('reach', {
  params: ['rail', 'bitsPtr', 'definite'],
  locals: ['words', 'base', 'start', 'w', 'sp', 'atNode', 'e', 'endE', 'c', 'acc',
    'other', 'wp', 'bit', 'cur', 'stackPtr', 'adjStartP', 'adjNodeP', 'adjDevP',
    'condP', 'drivenP', 'railIdP'],
  body: [
    W.set('words', hdr('words')),
    W.set('base', W.add(W.get('bitsPtr'),
      W.shl(W.mul(W.get('rail'), W.get('words')), W.konst(2)))),
    ...W.forUpTo('w', W.konst(0), W.get('words'),
      [W.store32(at4('base', W.get('w')), W.konst(0))]),
    W.set('railIdP', hdr('railId')),
    W.set('start', W.load32(at4('railIdP', W.get('rail')))),
    W.set('wp', W.add(W.get('base'), W.shl(W.shrU(W.get('start'), W.konst(5)), W.konst(2)))),
    W.store32(W.get('wp'), W.or(W.load32(W.get('wp')),
      W.shl(W.konst(1), W.and(W.get('start'), W.konst(31))))),
    W.set('stackPtr', hdr('stack')),
    W.store32(W.get('stackPtr'), W.get('start')),
    W.set('sp', W.konst(1)),
    W.set('adjStartP', hdr('adjStart')),
    W.set('adjNodeP', hdr('adjNode')),
    W.set('adjDevP', hdr('adjDev')),
    W.set('condP', hdr('cond')),
    W.set('drivenP', hdr('driven')),
    W.whileLoop(W.gtS(W.get('sp'), W.konst(0)), [
      W.set('sp', W.sub(W.get('sp'), W.konst(1))),
      W.set('atNode', W.load32(at4('stackPtr', W.get('sp')))),
      W.set('e', W.load32(at4('adjStartP', W.get('atNode')))),
      W.set('endE', W.load32(at4('adjStartP', W.add(W.get('atNode'), W.konst(1))))),
      W.whileLoop(W.ltS(W.get('e'), W.get('endE')), [
        W.set('c', W.load8u(at1('condP', W.load32(at4('adjDevP', W.get('e')))))),
        // definite: the edge conducts. possible: it is not known NOT to conduct.
        W.ifElse(W.ne(W.get('definite'), W.konst(0)),
          [W.set('acc', W.eq(W.get('c'), W.konst(1)))],
          [W.set('acc', W.ne(W.get('c'), W.konst(0)))]),
        W.ifThen(W.get('acc'), [
          W.set('other', W.load32(at4('adjNodeP', W.get('e')))),
          W.set('wp', W.add(W.get('base'),
            W.shl(W.shrU(W.get('other'), W.konst(5)), W.konst(2)))),
          W.set('bit', W.shl(W.konst(1), W.and(W.get('other'), W.konst(31)))),
          W.set('cur', W.load32(W.get('wp'))),
          W.ifThen(W.eq(W.and(W.get('cur'), W.get('bit')), W.konst(0)), [
            W.store32(W.get('wp'), W.or(W.get('cur'), W.get('bit'))),
            W.ifThen(W.eq(W.load8u(at1('drivenP', W.get('other'))), W.konst(0)), [
              W.store32(at4('stackPtr', W.get('sp')), W.get('other')),
              W.set('sp', W.add(W.get('sp'), W.konst(1))),
            ]),
          ]),
        ]),
        W.set('e', W.add(W.get('e'), W.konst(1))),
      ]),
    ]),
  ],
});

/**
 * `solve(maxIter)` — the fixed-point loop, over a value array something else has
 * seeded. 1 if it reached a fixed point inside the cap, 0 if it ran out.
 */
const solveFn = W.fn('solve', {
  params: ['maxIter'],
  results: ['i32'],
  locals: ['iter', 'i', 'n', 'r', 'g', 'level', 'vt', 'on', 'changed', 'next',
    'defCount', 'defRail', 'posCount', 'wOff', 'bit', 'off',
    'nodeCount', 'deviceCount', 'railCount', 'words', 'wordBytes',
    'valueP', 'condP', 'devGateP', 'devIsNP', 'devVtP', 'drivenP',
    'railLevelP', 'reachDefP', 'reachPosP'],
  body: [
    W.set('nodeCount', hdr('nodeCount')),
    W.set('deviceCount', hdr('deviceCount')),
    W.set('railCount', hdr('railCount')),
    W.set('words', hdr('words')),
    W.set('wordBytes', W.shl(W.get('words'), W.konst(2))),
    W.set('valueP', hdr('value')),
    W.set('condP', hdr('cond')),
    W.set('devGateP', hdr('devGate')),
    W.set('devIsNP', hdr('devIsN')),
    W.set('devVtP', hdr('devVt')),
    W.set('drivenP', hdr('driven')),
    W.set('railLevelP', hdr('railLevel')),
    W.set('reachDefP', hdr('reachDef')),
    W.set('reachPosP', hdr('reachPos')),
    ...W.forUpTo('iter', W.konst(0), W.get('maxIter'), [
      // Conduction is a function of the current state (D1), so it is fixed for
      // the whole pass: once per device, read by both walks. Z and X give
      // UNKNOWN, never off -- treating unknown as off is the classic
      // switch-simulator bug and it makes broken circuits look clean (D6).
      ...W.forUpTo('i', W.konst(0), W.get('deviceCount'), [
        W.set('g', W.load8u(at1('valueP', W.load32(at4('devGateP', W.get('i')))))),
        W.ifElse(W.ltS(W.get('g'), W.konst(2)),
          [W.store8(at1('condP', W.get('i')), W.konst(2))],
          [
            W.set('level', W.sub(W.get('g'), W.konst(3))),
            W.set('vt', W.load8s(at1('devVtP', W.get('i')))),
            W.ifElse(W.ne(W.load8u(at1('devIsNP', W.get('i'))), W.konst(0)),
              [W.set('on', W.geS(W.get('level'), W.get('vt')))],
              [W.set('on', W.leS(W.get('level'), W.get('vt')))]),
            W.store8(at1('condP', W.get('i')), W.get('on')),
          ]),
      ]),
      // rails x 2 traversals, never fused: the possible walk is not derived from
      // the definite one.
      ...W.forUpTo('r', W.konst(0), W.get('railCount'), [
        W.callStmt('reach', [W.get('r'), W.get('reachDefP'), W.konst(1)]),
        W.callStmt('reach', [W.get('r'), W.get('reachPosP'), W.konst(0)]),
      ]),
      // Every node re-derived from this pass's reachability sets. Jacobi: nothing
      // read here was written by another node in the same pass, so order is free.
      W.set('changed', W.konst(0)),
      ...W.forUpTo('n', W.konst(0), W.get('nodeCount'), [
        W.ifThen(W.eq(W.load8u(at1('drivenP', W.get('n'))), W.konst(0)), [
          W.set('wOff', W.shl(W.shrU(W.get('n'), W.konst(5)), W.konst(2))),
          W.set('bit', W.shl(W.konst(1), W.and(W.get('n'), W.konst(31)))),
          W.set('defCount', W.konst(0)),
          W.set('defRail', W.konst(0)),
          W.set('posCount', W.konst(0)),
          ...W.forUpTo('r', W.konst(0), W.get('railCount'), [
            W.set('off', W.add(W.mul(W.get('r'), W.get('wordBytes')), W.get('wOff'))),
            W.ifThen(W.ne(W.and(W.load32(W.add(W.get('reachDefP'), W.get('off'))),
              W.get('bit')), W.konst(0)), [
              W.set('defCount', W.add(W.get('defCount'), W.konst(1))),
              W.set('defRail', W.get('r')),
            ]),
            W.ifThen(W.ne(W.and(W.load32(W.add(W.get('reachPosP'), W.get('off'))),
              W.get('bit')), W.konst(0)), [
              W.set('posCount', W.add(W.get('posCount'), W.konst(1))),
            ]),
          ]),
          W.set('next', W.konst(1)),                                   // contended, or unknown
          W.ifElse(W.eq(W.get('posCount'), W.konst(0)),
            [W.set('next', W.konst(0))],                               // nothing can reach it
            [W.ifThen(W.and(W.eq(W.get('defCount'), W.konst(1)),
              W.eq(W.get('posCount'), W.konst(1))),
            [W.set('next', W.add(W.load8s(at1('railLevelP', W.get('defRail'))), W.konst(3)))])]),
          W.ifThen(W.ne(W.load8u(at1('valueP', W.get('n'))), W.get('next')), [
            W.store8(at1('valueP', W.get('n')), W.get('next')),
            W.set('changed', W.konst(1)),
          ]),
        ]),
      ]),
      W.ifThen(W.eq(W.get('changed'), W.konst(0)), [W.ret(W.konst(1))]),
    ]),
    W.ret(W.konst(0)),
  ],
});

/**
 * `seedCodes(codesPtr)` — rails at their declared levels, inputs from the codes
 * block, everything else at Z. The sweep's seeding, inside the module, because
 * the sweep is the loop being timed.
 */
const seedFn = W.fn('seedCodes', {
  params: ['codesPtr'],
  locals: ['n', 'r', 'i', 'nodeCount', 'railCount', 'inputCount',
    'valueP', 'railIdP', 'railLevelP', 'inputIdP'],
  body: [
    W.set('nodeCount', hdr('nodeCount')),
    W.set('railCount', hdr('railCount')),
    W.set('inputCount', hdr('inputCount')),
    W.set('valueP', hdr('value')),
    W.set('railIdP', hdr('railId')),
    W.set('railLevelP', hdr('railLevel')),
    W.set('inputIdP', hdr('inputId')),
    ...W.forUpTo('n', W.konst(0), W.get('nodeCount'),
      [W.store8(at1('valueP', W.get('n')), W.konst(0))]),
    ...W.forUpTo('r', W.konst(0), W.get('railCount'),
      [W.store8(at1('valueP', W.load32(at4('railIdP', W.get('r')))),
        W.add(W.load8s(at1('railLevelP', W.get('r'))), W.konst(3)))]),
    ...W.forUpTo('i', W.konst(0), W.get('inputCount'),
      [W.store8(at1('valueP', W.load32(at4('inputIdP', W.get('i')))),
        W.load8u(at1('codesPtr', W.get('i'))))]),
  ],
});

/**
 * `sweep(codesPtr, pairCount, outIdsPtr, outCount, outPtr, maxIter)` — the driver
 * INSIDE the module, so the boundary is crossed once per block rather than once
 * per pair. Returns how many pairs did not settle, which is a measurement and so
 * is counted rather than thrown.
 */
const sweepFn = W.fn('sweep', {
  params: ['codesPtr', 'pairCount', 'outIdsPtr', 'outCount', 'outPtr', 'maxIter'],
  results: ['i32'],
  locals: ['p', 'j', 'unsettled', 'inputCount', 'valueP'],
  body: [
    W.set('inputCount', hdr('inputCount')),
    W.set('valueP', hdr('value')),
    W.set('unsettled', W.konst(0)),
    ...W.forUpTo('p', W.konst(0), W.get('pairCount'), [
      W.callStmt('seedCodes', [W.add(W.get('codesPtr'),
        W.mul(W.get('p'), W.get('inputCount')))]),
      W.ifThen(W.eq(W.call('solve', [W.get('maxIter')]), W.konst(0)),
        [W.set('unsettled', W.add(W.get('unsettled'), W.konst(1)))]),
      ...W.forUpTo('j', W.konst(0), W.get('outCount'), [
        W.store8(W.add(W.get('outPtr'),
          W.add(W.mul(W.get('p'), W.get('outCount')), W.get('j'))),
        W.load8u(at1('valueP', W.load32(at4('outIdsPtr', W.get('j')))))),
      ]),
    ]),
    W.ret(W.get('unsettled')),
  ],
});

/**
 * The four functions, in the order their indices are assigned. Exported as a list
 * so a test can substitute ONE of them and rebuild -- mutation-testing a module
 * otherwise means editing this file, running the gate and editing it back, which
 * is a check that exists only while somebody is doing it.
 */
const FUNCS = [reachFn, solveFn, seedFn, sweepFn];

/** The module's bytes. Emitted, never committed. */
function moduleBytes(fns = FUNCS) {
  return W.emitModule(fns, { memoryPages: 1, exports: ['solve', 'sweep', 'seedCodes'] });
}

/* ------------------------------------------------------- loading a network */

/** Where each packed array sits in linear memory, and how much room it all needs. */
function layout(P) {
  let at = HEADER_BYTES;
  const region = bytes => { at = (at + 3) & ~3; const p = at; at += bytes; return p; };
  const n = P.nodeCount, m = P.deviceCount, rc = P.railCount, w = P.words;
  const L = {
    devGate: region(4 * m), devIsN: region(m), devVt: region(m),
    adjStart: region(4 * (n + 1)), adjNode: region(8 * m), adjDev: region(8 * m),
    driven: region(n), railId: region(4 * rc), railLevel: region(rc),
    inputId: region(4 * P.inputId.length),
    value: region(n), cond: region(m),
    reachDef: region(4 * rc * w), reachPos: region(4 * rc * w),
    stack: region(4 * (n + 1)),
  };
  L.end = (at + 3) & ~3;
  return L;
}

/**
 * Emit, instantiate, and hand back the four entries the audit and the gate need.
 *
 * `WebAssembly.instantiate(bytes)`, never `instantiateStreaming`: there is no
 * response to stream, the bytes were built here, and the streaming form would tie
 * this to a fetch the published page is not going to make.
 */
async function makeR2({ fns = FUNCS } = {}) {
  const bytes = moduleBytes(fns);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const ex = instance.exports;
  let mem = ex.memory;
  let loaded = null, L = null, scratch = 0;

  // Views are re-taken after every grow: `memory.grow` DETACHES the old buffer,
  // and a view held across it reads zeros forever without raising anything.
  let u8 = new Uint8Array(mem.buffer);
  const need = bytesNeeded => {
    if (bytesNeeded <= mem.buffer.byteLength) return;
    mem.grow(Math.ceil((bytesNeeded - mem.buffer.byteLength) / PAGE));
    u8 = new Uint8Array(mem.buffer);
  };

  /** Copy a packed network in, unless it is already the one in memory. */
  const load = (P, extra = 0) => {
    if (loaded === P && scratch >= extra) return L;
    L = layout(P);
    need(L.end + extra);
    scratch = extra;
    const i32 = new Int32Array(mem.buffer);
    const i8 = new Int8Array(mem.buffer);
    const put32 = (ptr, arr) => i32.set(arr, ptr >> 2);
    put32(0, Int32Array.from(HEADER.map(nm => (nm in L ? L[nm]
      : ({ nodeCount: P.nodeCount, deviceCount: P.deviceCount, railCount: P.railCount,
        words: P.words, inputCount: P.inputId.length })[nm]))));
    put32(L.devGate, P.devGate);
    u8.set(P.devIsN, L.devIsN);
    i8.set(P.devVt, L.devVt);
    put32(L.adjStart, P.adjStart);
    put32(L.adjNode, P.adjNode);
    put32(L.adjDev, P.adjDev);
    u8.set(P.driven, L.driven);
    put32(L.railId, P.railId);
    i8.set(P.railLevel, L.railLevel);
    put32(L.inputId, P.inputId);
    loaded = P;
    return L;
  };

  return {
    bytes,
    exports: ex,
    memory: () => mem,
    layoutOf: P => { load(P); return L; },

    /**
     * One solve, with `netpack.js` doing the seeding and the two refusals so that
     * R2 inherits R0's `init` semantics rather than carrying a second copy of them.
     * Throws R0's message at the cap.
     */
    solveNamed(P, inputs, maxIterations = 64, init = {}) {
      NP.seed(P, inputs, init);
      load(P);
      u8.set(P.value, L.value);
      const settled = ex.solve(maxIterations);
      if (!settled) throw new Error(NP.CAP_MESSAGE);
      const out = {};
      for (let i = 0; i < P.nodeCount; i++) out[P.names[i]] = NP.decodeState(u8[L.value + i]);
      return out;
    },

    /**
     * The block sweep: codes in, one call, results out. The driver is inside the
     * module, so this crosses the boundary once however many pairs there are.
     */
    sweep(P, codes, pairCount, outIds, out, maxIterations) {
      const k = outIds.length;
      const extra = codes.length + pairCount * k + 4 * k + 16;
      load(P, extra);
      let at = (L.end + 3) & ~3;
      const codesPtr = at; at += codes.length; at = (at + 3) & ~3;
      const outIdsPtr = at; at += 4 * k; at = (at + 3) & ~3;
      const outPtr = at;
      u8.set(codes, codesPtr);
      new Int32Array(mem.buffer).set(outIds, outIdsPtr >> 2);
      const unsettled = ex.sweep(codesPtr, pairCount, outIdsPtr, k, outPtr, maxIterations);
      out.set(u8.subarray(outPtr, outPtr + pairCount * k));
      return unsettled;
    },
  };
}

module.exports = { HEADER, FIELD, HEADER_BYTES, FUNCS, moduleBytes, layout, makeR2 };
