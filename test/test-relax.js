'use strict';
/* test-relax.js — what does replacing the reachability walk's worklist with frontier relaxation cost, before any lane is added?
 *
 * Set `AY`. Say which check here is the one worth keeping, and why — usually the
 * prediction that failed, because that is where this corpus has learned most.
 *
 * The exhaustive version is `npm run audit:relax`.
 */

const A = require('../tools/relax-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // 0a. The construction is the one the registration described. A set whose subject
  // is not the subject it cites is measuring something nobody registered.

  // 0b. THE TOOL AS IT IS ACTUALLY RUN. T-TOOL-CHECKED-ONLY-BY-IMPORT: importing a
  // tool sets MAIN false, so every log line is skipped and a fault in the report path
  // stays invisible to a suite that only imports. Run the real thing.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'relax-audit.js')],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('RELAXATION AUDIT') && out.includes('AY1'));

  // 0c. Check the pipeline against a case whose answer is known independently.
  //
  // THE REFERENCE RELAXATION AGAINST THE WALK, which is the one thing in this set that
  // has to be true before anything else can be measured. `relaxReach` reaches the same
  // fixed point as `NP.reach` by sweeping edges instead of walking a stack; if it does
  // not, then R2f is a different solver and `AY1` would be timing two answers rather
  // than two routes to one.
  //
  // Compared as SETS, bit for bit, on both networks, at every rail, in both the
  // definite and possible modes, over states a real solve actually produced. Node
  // values are not enough: two solvers can agree on every value while disagreeing
  // about which rails could reach what, and the bitsets are the only thing this set
  // changes.
  const D = require('../src/device.js');
  const NP = require('../src/netpack.js');
  const T = require('../src/ternary.js');
  const spread = (nm, v) =>
    Object.fromEntries(T.toTrits(v, 6).map((t, i) => [`${nm}${i}`, t]));
  const packFor = kind => {
    const net = new D.Net();
    if (kind === 'tree') D.tRippleAdder(net, 6, false); else D.dRippleAdder(net, 6);
    const names = [];
    for (let i = 0; i < 6; i++) names.push(`a${i}`);
    for (let i = 0; i < 6; i++) names.push(`b${i}`);
    names.push('cin');
    return NP.pack(net, names);
  };

  let compared = 0, differed = 0, sawUnknown = false;
  const sweepsSeen = { tree: new Set(), decoded: new Set() };
  for (const kind of ['tree', 'decoded']) {
    const P = packFor(kind);
    const rails = P.railId.length;
    const walk = new Uint32Array(rails * P.words);
    const relax = new Uint32Array(rails * P.words);
    for (let s = 0; s < 8; s++) {
      const idx = s * 8192;
      const a = T.TRYTE_MIN + (idx % 729);
      const b = T.TRYTE_MIN + Math.floor(idx / 729) % 729;
      const inputs = { ...spread('a', a), ...spread('b', b), cin: 0 };
      // MID-SOLVE, NOT CONVERGED, and the difference is the whole strength of this
      // gate. At a converged state `cond` holds only OFF and ON -- measured: 312 and
      // 312 on the tree adder, not one UNKNOWN -- so `definite` and `possible` accept
      // the same edges and half of what is compared below is the same comparison
      // twice. Capping the solve short leaves undetermined devices in the state, which
      // is what every pass but the last of a real solve actually sees.
      const cap = 1 + (s % 4);
      try { NP.solveNamed(P, inputs, cap); } catch (e) { /* did not settle: the point */ }
      for (let i = 0; i < P.cond.length; i++) if (P.cond[i] === NP.UNKNOWN) sawUnknown = true;
      for (let r = 0; r < rails; r++) {
        for (const definite of [true, false]) {
          NP.reach(P, r, walk, definite);
          sweepsSeen[kind].add(A.relaxReach(P, r, relax, definite));
          compared++;
          for (let w = 0; w < P.words; w++) {
            if (walk[r * P.words + w] !== relax[r * P.words + w]) { differed++; break; }
          }
        }
      }
    }
  }
  check(`relaxation reaches the walk's set exactly, over ${compared} rail-mode-state `
    + 'comparisons on both networks', differed === 0, `${differed} differed`);
  check('   and it terminates in a handful of sweeps rather than one per node',
    [...sweepsSeen.tree, ...sweepsSeen.decoded].every(n => n >= 1 && n <= 8),
    `tree ${[...sweepsSeen.tree]} decoded ${[...sweepsSeen.decoded]}`);
  // A CHECK THAT PASSES ON A DEGENERATE CORPUS IS NOT A CHECK. If no device were ever
  // undetermined, the definite and possible modes would traverse identical edges and
  // half of what is compared above would be the same comparison twice.
  check('   and the states compared are not degenerate: some device is undetermined',
    sawUnknown);
  // AND IT CATCHES THE TWO WAYS THE RULE GETS LOST, shown rather than asserted: a
  // relaxation that lets every driven node propagate runs paths THROUGH a rail, and
  // one that collapses the two modes stops distinguishing them.
  check('   and a relaxation that propagates through driven nodes is caught', (() => {
    const P = packFor('tree');
    const rails = P.railId.length;
    const walk = new Uint32Array(rails * P.words), bad = new Uint32Array(rails * P.words);
    // Mid-solve for the same reason: at convergence no rail reaches another rail, so
    // the rule this mutant breaks is never exercised and the bug goes undetected.
    try { NP.solveNamed(P, { ...spread('a', 123), ...spread('b', -45), cin: 0 }, 2); }
    catch (e) { /* did not settle: the point */ }
    const leaky = (railIdx, bits, definite) => {
      const { adjStart, adjNode, adjDev, cond, words, nodeCount } = P;
      const base = railIdx * words;
      for (let w = 0; w < words; w++) bits[base + w] = 0;
      const start = P.railId[railIdx];
      bits[base + (start >>> 5)] |= (1 << (start & 31));
      let changed = true;
      while (changed) {
        changed = false;
        for (let at = 0; at < nodeCount; at++) {          // no driven guard: the bug
          if (!(bits[base + (at >>> 5)] & (1 << (at & 31)))) continue;
          for (let e = adjStart[at]; e < adjStart[at + 1]; e++) {
            const c = cond[adjDev[e]];
            if (definite ? c !== 1 : c === 0) continue;
            const o = adjNode[e], w = base + (o >>> 5), bit = 1 << (o & 31);
            if (bits[w] & bit) continue;
            bits[w] |= bit; changed = true;
          }
        }
      }
    };
    // Both modes. `possible` accepts every edge not known to be off, so it is where a
    // rail first becomes reachable from another rail and where the missing guard
    // therefore shows; checking only `definite` would report this mutant as
    // undetectable when it is merely being looked for in the wrong mode.
    let caught = false;
    for (let r = 0; r < rails && !caught; r++) {
      for (const definite of [true, false]) {
        NP.reach(P, r, walk, definite);
        leaky(r, bad, definite);
        for (let w = 0; w < P.words; w++) {
          if (walk[r * P.words + w] !== bad[r * P.words + w]) { caught = true; break; }
        }
      }
    }
    return caught;
  })());
}

console.log('\n=== 1. AY1  the price of the traversal at one lane ===');
{
  check('AY1 ...', false, 'not yet measured');
}

console.log('\n=== 2. AY2  whether the change stayed inside its phase ===');
{
  check('AY2 ...', false, 'not yet measured');
}

console.log('\n=== 3. AY3  the same price on a network with more edges per node ===');
{
  check('AY3 ...', false, 'not yet measured');
}

console.log('\n=== 4. AY4  frontier depth, and whether it varies ===');
{
  check('AY4 ...', false, 'not yet measured');
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
