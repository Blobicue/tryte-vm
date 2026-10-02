'use strict';
/* phinary-wasm.js — Native WebAssembly emitter for the Phinary TryteVM
 * and in-cache golden lattice memory subsystem (PM0).
 *
 * Emits a self-contained WebAssembly binary using `src/wasm-emit.js`.
 * NO EXTERNAL TOOLCHAINS, NO EMSCRIPTEN, NO PRECOMPILED BLOBS.
 *
 * MEMORY LAYOUT (1 Wasm page = 64 KB):
 *   [0x00 .. 0x03]  A: Accumulator (i32)
 *   [0x04 .. 0x07]  C: Gate / Coordinate control register (i32)
 *   [0x08 .. 0x0B]  PC: Program Counter (i32)
 *   [0x0C .. 0x0F]  HALTED: Halted flag (i32)
 *   [0x10 .. 0x13]  STEPS: Executed step counter (i32)
 *   [0x14 .. 0x17]  OUT_COUNT: Output count (i32)
 *   [0x100.. 0x4FF] Output buffer (up to 256 values, 4 bytes each)
 *   [0x800.. 0x1363] Memory Plane (729 cells * 4 bytes = 2,916 bytes, [-364..+364])
 *
 * TOTAL FOOTPRINT:
 *   Entire VM state + 729-cell Phinary Memory occupies < 5 KB.
 *   Strictly resides inside the CPU L1 data cache (32-48 KB).
 *   Total emitted Wasm binary size: < 2.5 KB.
 */

const W = require('./wasm-emit.js');
// The phinary opcode numbers are READ from phinary.js, never typed here. This engine
// kept its own copy of them once, and when phinary's codes had to move to clear a
// collision with QEXEC, a renumber of phinary.js alone would have left this dispatch
// matching the old codes -- the same bug, one file over.
const { PHINARY_OPS } = require('./phinary.js');

// Memory pointers
const A_PTR = 0;
const C_PTR = 4;
const PC_PTR = 8;
const HALTED_PTR = 12;
const STEPS_PTR = 16;
const OUT_COUNT_PTR = 20;
const OUT_BUF_PTR = 256;
const MEM_BASE_PTR = 2048;

// Constants
const TRYTE_STATES = 729;
const TRYTE_MIN = -364;
const TRYTE_MAX = 364;

/** Emit the WebAssembly module byte array. */
function emitPhinaryWasm() {
  // Helper: wrap value v into [-364, 364]
  const wrapFn = W.fn('wrapTryte', {
    params: ['v'],
    locals: ['shifted', 'rem'],
    results: ['i32'],
    body: [
      W.set('shifted', W.add(W.get('v'), W.konst(364))),
      W.set('rem', W.remS(W.get('shifted'), W.konst(TRYTE_STATES))),
      ...[
        W.ifThen(W.ltS(W.get('rem'), W.konst(0)), [
          W.set('rem', W.add(W.get('rem'), W.konst(TRYTE_STATES)))
        ])
      ],
      W.ret(W.sub(W.get('rem'), W.konst(364)))
    ]
  });

  // Helper: slot address in bytes for tryte address `addr`
  const slotFn = W.fn('slotOf', {
    params: ['addr'],
    locals: ['w', 'slot'],
    results: ['i32'],
    body: [
      W.set('w', W.call('wrapTryte', [W.get('addr')])),
      W.set('slot', W.add(W.get('w'), W.konst(364))),
      W.ret(W.add(W.konst(MEM_BASE_PTR), W.shl(W.get('slot'), W.konst(2))))
    ]
  });

  // Read tryte cell at address `addr`
  const readCellFn = W.fn('readCell', {
    params: ['addr'],
    results: ['i32'],
    body: [
      W.ret(W.load32(W.call('slotOf', [W.get('addr')])))
    ]
  });

  // Write tryte cell at address `addr` with value `val`
  const writeCellFn = W.fn('writeCell', {
    params: ['addr', 'val'],
    body: [
      W.store32(W.call('slotOf', [W.get('addr')]), W.call('wrapTryte', [W.get('val')]))
    ]
  });

  // Read cell by 2D golden lattice coordinate (u, v)
  const readCoordFn = W.fn('readCoord', {
    params: ['u', 'v'],
    results: ['i32'],
    body: [
      W.ret(W.call('readCell', [W.add(W.mul(W.konst(27), W.get('v')), W.get('u'))]))
    ]
  });

  // Write cell by 2D golden lattice coordinate (u, v)
  const writeCoordFn = W.fn('writeCoord', {
    params: ['u', 'v', 'val'],
    body: [
      W.callStmt('writeCell', [
        W.add(W.mul(W.konst(27), W.get('v')), W.get('u')),
        W.get('val')
      ])
    ]
  });

  // Exact Z[phi] scaling by phi: (A, C) -> (C, A + C)
  const phiScaleFn = W.fn('phiScale', {
    locals: ['oldA', 'oldC'],
    body: [
      W.set('oldA', W.load32(W.konst(A_PTR))),
      W.set('oldC', W.load32(W.konst(C_PTR))),
      W.store32(W.konst(A_PTR), W.get('oldC')),
      W.store32(W.konst(C_PTR), W.call('wrapTryte', [W.add(W.get('oldA'), W.get('oldC'))]))
    ]
  });

  // Exact Z[phi] scaling by phi^-1: (A, C) -> (C - A, A)
  const phiScaleInvFn = W.fn('phiScaleInv', {
    locals: ['oldA', 'oldC'],
    body: [
      W.set('oldA', W.load32(W.konst(A_PTR))),
      W.set('oldC', W.load32(W.konst(C_PTR))),
      W.store32(W.konst(A_PTR), W.call('wrapTryte', [W.sub(W.get('oldC'), W.get('oldA'))])),
      W.store32(W.konst(C_PTR), W.get('oldA'))
    ]
  });

  // Reset VM state and clear memory
  const initFn = W.fn('init', {
    locals: ['i'],
    body: [
      W.store32(W.konst(A_PTR), W.konst(0)),
      W.store32(W.konst(C_PTR), W.konst(0)),
      W.store32(W.konst(PC_PTR), W.konst(0)),
      W.store32(W.konst(HALTED_PTR), W.konst(0)),
      W.store32(W.konst(STEPS_PTR), W.konst(0)),
      W.store32(W.konst(OUT_COUNT_PTR), W.konst(0)),
      ...W.forUpTo('i', W.konst(0), W.konst(TRYTE_STATES), [
        W.store32(W.add(W.konst(MEM_BASE_PTR), W.shl(W.get('i'), W.konst(2))), W.konst(0))
      ])
    ]
  });

  // Register getters & setters
  const getAFn = W.fn('getA', { results: ['i32'], body: [W.ret(W.load32(W.konst(A_PTR)))] });
  const setAFn = W.fn('setA', { params: ['v'], body: [W.store32(W.konst(A_PTR), W.call('wrapTryte', [W.get('v')]))] });
  const getCFn = W.fn('getC', { results: ['i32'], body: [W.ret(W.load32(W.konst(C_PTR)))] });
  const setCFn = W.fn('setC', { params: ['v'], body: [W.store32(W.konst(C_PTR), W.call('wrapTryte', [W.get('v')]))] });
  const getPCFn = W.fn('getPC', { results: ['i32'], body: [W.ret(W.load32(W.konst(PC_PTR)))] });
  const setPCFn = W.fn('setPC', { params: ['v'], body: [W.store32(W.konst(PC_PTR), W.call('wrapTryte', [W.get('v')]))] });
  const getHaltedFn = W.fn('getHalted', { results: ['i32'], body: [W.ret(W.load32(W.konst(HALTED_PTR)))] });
  const getStepsFn = W.fn('getSteps', { results: ['i32'], body: [W.ret(W.load32(W.konst(STEPS_PTR)))] });
  const getOutCountFn = W.fn('getOutCount', { results: ['i32'], body: [W.ret(W.load32(W.konst(OUT_COUNT_PTR)))] });
  const getOutputFn = W.fn('getOutput', {
    params: ['idx'],
    results: ['i32'],
    body: [
      W.ret(W.load32(W.add(W.konst(OUT_BUF_PTR), W.shl(W.get('idx'), W.konst(2)))))
    ]
  });

  // Single instruction execution step
  const stepFn = W.fn('step', {
    locals: ['pc', 'op', 'imm', 'nextPC', 'a', 'c', 'v', 'u', 'cnt', 'sign'],
    results: ['i32'],
    body: [
      // If already halted, return 0
      W.ifThen(W.load32(W.konst(HALTED_PTR)), [
        W.ret(W.konst(0))
      ]),

      W.store32(W.konst(STEPS_PTR), W.add(W.load32(W.konst(STEPS_PTR)), W.konst(1))),
      W.set('pc', W.load32(W.konst(PC_PTR))),
      W.set('op', W.call('readCell', [W.get('pc')])),
      W.set('imm', W.call('readCell', [W.add(W.get('pc'), W.konst(1))])),
      W.set('nextPC', W.call('wrapTryte', [W.add(W.get('pc'), W.konst(2))])),

      // Opcode 0: HALT
      W.ifThen(W.eq(W.get('op'), W.konst(0)), [
        W.store32(W.konst(HALTED_PTR), W.konst(1))
      ]),

      // Opcode 1: LOADI
      W.ifThen(W.eq(W.get('op'), W.konst(1)), [
        W.store32(W.konst(A_PTR), W.call('wrapTryte', [W.get('imm')]))
      ]),

      // Opcode 2: LOAD
      W.ifThen(W.eq(W.get('op'), W.konst(2)), [
        W.store32(W.konst(A_PTR), W.call('readCell', [W.get('imm')]))
      ]),

      // Opcode 3: STORE
      W.ifThen(W.eq(W.get('op'), W.konst(3)), [
        W.callStmt('writeCell', [W.get('imm'), W.load32(W.konst(A_PTR))])
      ]),

      // Opcode 4: ADD
      W.ifThen(W.eq(W.get('op'), W.konst(4)), [
        W.store32(W.konst(A_PTR), W.call('wrapTryte', [
          W.add(W.load32(W.konst(A_PTR)), W.call('readCell', [W.get('imm')]))
        ]))
      ]),

      // Opcode 5: ADDI
      W.ifThen(W.eq(W.get('op'), W.konst(5)), [
        W.store32(W.konst(A_PTR), W.call('wrapTryte', [
          W.add(W.load32(W.konst(A_PTR)), W.get('imm'))
        ]))
      ]),

      // Opcode 6: SUB
      W.ifThen(W.eq(W.get('op'), W.konst(6)), [
        W.store32(W.konst(A_PTR), W.call('wrapTryte', [
          W.sub(W.load32(W.konst(A_PTR)), W.call('readCell', [W.get('imm')]))
        ]))
      ]),

      // Opcode 7: NEG
      W.ifThen(W.eq(W.get('op'), W.konst(7)), [
        W.store32(W.konst(A_PTR), W.call('wrapTryte', [
          W.sub(W.konst(0), W.load32(W.konst(A_PTR)))
        ]))
      ]),

      // Opcode 11: SETC
      W.ifThen(W.eq(W.get('op'), W.konst(11)), [
        W.store32(W.konst(C_PTR), W.call('wrapTryte', [W.get('imm')]))
      ]),

      // Opcode 15: JMP
      W.ifThen(W.eq(W.get('op'), W.konst(15)), [
        W.set('nextPC', W.call('wrapTryte', [W.get('imm')]))
      ]),

      // Opcode 16: BR3 (three-way branch based on sign of A)
      W.ifThen(W.eq(W.get('op'), W.konst(16)), [
        W.set('a', W.load32(W.konst(A_PTR))),
        W.set('sign', W.konst(0)),
        ...[
          W.ifThen(W.ltS(W.get('a'), W.konst(0)), [
            W.set('sign', W.konst(-1))
          ]),
          W.ifThen(W.gtS(W.get('a'), W.konst(0)), [
            W.set('sign', W.konst(1))
          ])
        ],
        W.set('nextPC', W.call('readCell', [W.call('wrapTryte', [W.add(W.get('imm'), W.get('sign'))])]))
      ]),

      // Opcode 17: OUT
      W.ifThen(W.eq(W.get('op'), W.konst(17)), [
        W.set('cnt', W.load32(W.konst(OUT_COUNT_PTR))),
        ...[
          W.ifThen(W.ltS(W.get('cnt'), W.konst(256)), [
            W.store32(
              W.add(W.konst(OUT_BUF_PTR), W.shl(W.get('cnt'), W.konst(2))),
              W.load32(W.konst(A_PTR))
            ),
            W.store32(W.konst(OUT_COUNT_PTR), W.add(W.get('cnt'), W.konst(1)))
          ])
        ]
      ]),

      // PHIMUL (imm >= 0 -> phiScale, imm < 0 -> phiScaleInv)
      W.ifThen(W.eq(W.get('op'), W.konst(PHINARY_OPS.PHIMUL.code)), [
        W.ifElse(
          W.geS(W.get('imm'), W.konst(0)),
          [W.callStmt('phiScale', [])],
          [W.callStmt('phiScaleInv', [])]
        )
      ]),

      // PHILOAD (loads mem[27*mem[imm] + A])
      W.ifThen(W.eq(W.get('op'), W.konst(PHINARY_OPS.PHILOAD.code)), [
        W.set('v', W.call('readCell', [W.get('imm')])),
        W.set('u', W.load32(W.konst(A_PTR))),
        W.store32(W.konst(A_PTR), W.call('readCell', [
          W.add(W.mul(W.konst(27), W.get('v')), W.get('u'))
        ]))
      ]),

      // PHISTORE (writes mem[27*mem[imm] + C] = A)
      W.ifThen(W.eq(W.get('op'), W.konst(PHINARY_OPS.PHISTORE.code)), [
        W.set('v', W.call('readCell', [W.get('imm')])),
        W.set('u', W.load32(W.konst(C_PTR))),
        W.callStmt('writeCell', [
          W.add(W.mul(W.konst(27), W.get('v')), W.get('u')),
          W.load32(W.konst(A_PTR))
        ])
      ]),

      W.store32(W.konst(PC_PTR), W.get('nextPC')),
      W.ret(W.eqz(W.load32(W.konst(HALTED_PTR))))
    ]
  });

  // Run loop until halted or maxSteps reached
  const runFn = W.fn('run', {
    params: ['maxSteps'],
    locals: ['running'],
    results: ['i32'],
    body: [
      W.set('running', W.konst(1)),
      ...[
        W.whileLoop(
          W.and(W.get('running'), W.ltS(W.load32(W.konst(STEPS_PTR)), W.get('maxSteps'))),
          [
            W.set('running', W.call('step', []))
          ]
        )
      ],
      W.ret(W.load32(W.konst(STEPS_PTR)))
    ]
  });

  const fns = [
    wrapFn, slotFn, readCellFn, writeCellFn, readCoordFn, writeCoordFn,
    phiScaleFn, phiScaleInvFn, initFn,
    getAFn, setAFn, getCFn, setCFn, getPCFn, setPCFn,
    getHaltedFn, getStepsFn, getOutCountFn, getOutputFn,
    stepFn, runFn
  ];

  const exportsList = [
    'init', 'readCell', 'writeCell', 'readCoord', 'writeCoord',
    'phiScale', 'phiScaleInv',
    'getA', 'setA', 'getC', 'setC', 'getPC', 'setPC',
    'getHalted', 'getSteps', 'getOutCount', 'getOutput',
    'step', 'run'
  ];

  return W.emitModule(fns, { pages: 1, exports: exportsList, exportMemory: 'memory' });
}

/** Create an instantiated Phinary Wasm VM instance. */
async function instantiatePhinaryWasm() {
  const bytes = emitPhinaryWasm();
  const mod = await WebAssembly.instantiate(bytes);
  const exp = mod.instance.exports;
  exp.init();
  return { instance: mod.instance, exports: exp, bytes };
}

module.exports = {
  emitPhinaryWasm,
  instantiatePhinaryWasm,
  A_PTR,
  C_PTR,
  PC_PTR,
  HALTED_PTR,
  STEPS_PTR,
  OUT_COUNT_PTR,
  OUT_BUF_PTR,
  MEM_BASE_PTR
};
