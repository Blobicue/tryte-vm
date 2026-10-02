'use strict';
/* quantum-seed.js — a deliberate bug, planted before a fenced battery loads.
 *
 * Not a suite. test-quantum-line.js runs a battery as
 *     node -r ./test/quantum-seed.js test/<battery>.js
 * with TVM_SEED naming one bug. Each bug is planted on a module's exported object or
 * a class prototype, which works because every battery reaches its target through the
 * module object (`MP.addWide`, `cryptModule.sbox`), not through a copy taken earlier.
 *
 * On exit it reports how many calls the seed intercepted. A seed that intercepted
 * nothing proves nothing about the battery -- it never reached the code -- so the
 * harness reads that line before it reads the battery's verdict.
 */

const seed = process.env.TVM_SEED;
let hits = 0;

const SEEDS = {
  // Every wide sum is off by one.
  'mp-add-off-by-one': () => {
    const MP = require('../src/multiprecision.js');
    const orig = MP.addWide;
    MP.addWide = (...a) => { hits++; const r = orig(...a); return { ...r, exactValue: r.exactValue + 1n }; };
  },
  // The low word of every wide sum is off by one; the value fields are left alone. A
  // battery that compares words catches this and one that compares values does not,
  // which is why there are two arithmetic seeds rather than one.
  'mp-low-word-off-by-one': () => {
    const MP = require('../src/multiprecision.js');
    const orig = MP.addWide;
    MP.addWide = (...a) => {
      hits++; const r = orig(...a);
      const sum = r.sum.slice(); sum[0] = sum[0] === 364 ? -364 : sum[0] + 1;
      return { ...r, sum };
    };
  },
  // The hash collapses to one bucket.
  'hash-constant': () => {
    const C = require('../src/crypto.js');
    C.hashTernary = () => { hits++; return 0; };
  },
  // The S-box is the constant 0: every differential has probability one.
  'sbox-constant': () => {
    const C = require('../src/crypto.js');
    C.sbox = () => { hits++; return 0; };
  },
  // The S-box returns its first input, so every diagonal point is fixed -- the most
  // fixed points the battery's own fixed-point condition can ever count.
  'sbox-identity': () => {
    const C = require('../src/crypto.js');
    C.sbox = (x) => { hits++; return x; };
  },
  // Booting the kernel reports no status.
  'kernel-boot-silent': () => {
    const { TryteKernel } = require('../src/kernel.js');
    TryteKernel.prototype.boot = function () { hits++; return {}; };
  },
  // The first few runs die with a host error the VM never raises.
  'vm-host-fault': () => {
    const { TryteVM } = require('../src/vm.js');
    const orig = TryteVM.prototype.run;
    TryteVM.prototype.run = function () {
      if (hits < 5) { hits++; throw new Error('seeded host fault'); }
      return orig.call(this);
    };
  },
  // Every run completes, then reports that it did not halt.
  'vm-never-halts': () => {
    const { TryteVM } = require('../src/vm.js');
    const orig = TryteVM.prototype.run;
    TryteVM.prototype.run = function () { hits++; const r = orig.call(this); this.halted = false; return r; };
  },
};

if (seed) {
  if (!SEEDS[seed]) { console.error(`quantum-seed: no seed named '${seed}'`); process.exit(97); }
  SEEDS[seed]();
  process.on('exit', () => console.log(`[seed] ${seed} intercepted ${hits} calls`));
}

module.exports = { SEEDS: Object.keys(SEEDS) };
