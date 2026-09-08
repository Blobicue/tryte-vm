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

const fs = require('fs');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'FINDINGS.json'), 'utf8'));
const AY = MANIFEST.prediction_sets.find(s => s.id === 'AY');
const of = id => (AY ? AY.predictions.find(p => p.id === id) : null);

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
  // `--quick` shrinks the sample and nothing else: every print path runs, including
  // all four verdict lines, so the report path is covered without this check costing
  // the audit's ten minutes. It matters here more than usual -- at the short sample
  // BOTH failed predictions come out HELD, so the quick run's verdicts contradict the
  // manifest. That is why the tool tags every verdict line rather than printing one
  // banner: AX shipped a quick run whose banner was three screens above the table.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'relax-audit.js'), '--quick'],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('RELAXATION AUDIT') && out.includes('AY1'));
  check('   and its four verdict sections all reach the print path',
    ['AY1', 'AY2', 'AY3', 'AY4'].every(id => out.includes(`--- ${id} `)));
  check('   and every quick verdict says on its own line that it is not a measurement',
    out.split('\n').filter(l => /\b(HELD|FAILED)\b/.test(l))
      .every(l => /QUICK — NOT A MEASUREMENT/.test(l)),
    'a verdict line without the marker');

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
    const p = of('AY1'), m = p && p.measured;
  check('AY1 is recorded, and it FAILED', p && p.outcome === 'FAILED');
  check('   relaxation is slower, and past the floor rather than at it: the ratio is '
    + 'below the registered 0.35',
    m && m.ratio < 0.35 && m.registered_band[0] === 0.35 && m.registered_band[1] === 0.75,
    m && `${m.ratio}`);
  check('   and the slowdown the ratio implies is the one recorded beside it',
    m && Math.abs(1 / m.ratio - m.times_slower) < 0.01,
    m && `${(1 / m.ratio).toFixed(3)} against ${m.times_slower}`);
}

console.log('\n=== 2. AY2  whether the change stayed inside its phase ===');
{
    const p = of('AY2');
  check('AY2 is recorded as HELD on a proof rather than a run',
    p && p.outcome === 'HELD' && p.basis === 'proven');
  // THE CHECK IN THIS SECTION WORTH KEEPING. AY2 quotes its REGISTERED line, not the
  // verdict on it -- the drift check in test-findings.js compares that field against
  // the tool at `registered_at`, so a later judgement written into it would read as
  // the registrant having predicted something they did not.
  check('   and its at_risk field still quotes the registration rather than the verdict',
    p && /independent of `AY1` by construction/.test(p.at_risk));
  check('   and the verdict that it was decorative lives in the note, where it belongs',
    p && /DECORATIVE/.test(p.note) && /nowhere to live but a note/.test(p.note));
  check('   and the argument says why no run could have refuted it',
    p && typeof p.argument === 'string' && /ISOLATION/.test(p.argument)
    && p.measured.measurable_by_registered_method === false);
}

console.log('\n=== 3. AY3  the same price on a network with more edges per node ===');
{
    const p = of('AY3'), m = p && p.measured;
  check('AY3 is recorded, and it FAILED', p && p.outcome === 'FAILED');
  check('   the two networks separate by more than the registered tolerance',
    m && m.separation > m.registered_tolerance && m.registered_tolerance === 0.15,
    m && `${m.separation}`);
  // THE DIRECTION IS THE FINDING, not the verdict. The risk line expected the DENSER
  // network to punish relaxation, because relaxation sweeps edges. It is the denser
  // network that relaxation does BETTER on, because that network is shallower.
  check('   and relaxation does BETTER on the denser network, against the risk line',
    m && m.decoded_ratio > m.tree_ratio,
    m && `tree ${m.tree_ratio}, decoded ${m.decoded_ratio}`);
  check('   which is sweep count beating edge density: the decoded adder is shallower',
    (() => {
      const four = of('AY4').measured;
      return Math.max(...four.decoded_sweeps) < Math.min(...four.tree_sweeps);
    })());
}

console.log('\n=== 4. AY4  frontier depth, and whether it varies ===');
{
    const p = of('AY4'), m = p && p.measured;
  check('AY4 is recorded, and it HELD', p && p.outcome === 'HELD');
  check('   the depth never reaches the registered ceiling of 6',
    m && Math.max(...m.tree_sweeps, ...m.decoded_sweeps) < m.ceiling,
    m && `${Math.max(...m.tree_sweeps, ...m.decoded_sweeps)} against ${m.ceiling}`);
  // HELD ON THE POOLED READING AND FAILED ON THE PER-NETWORK ONE, and both are pinned
  // so that neither can be quietly dropped. The sentence said "over the sixty-four
  // states on both networks", which pools them; the reading that matters for a lane is
  // the other one, because a word of lanes holds pairs from ONE network.
  check('   and it varies across the pooled population, which is what the sentence said',
    m && new Set([...m.tree_sweeps, ...m.decoded_sweeps]).size > 1);
  check('   and does NOT vary within the decoded adder, which a per-network reading '
    + 'would have failed on',
    m && m.varies_within_tree === true && m.varies_within_decoded === false
    && m.decoded_sweeps.length === 1);
  check('   and the note says the ambiguity was the registrant\'s',
    p && /ambiguity/.test(p.note) && /registrant/.test(p.note));
}

/* R2f is a WebAssembly module and `WebAssembly.instantiate` is a promise, so the part
 * of this suite that touches it is one async function. Everything above is synchronous
 * and has already run by the time this is called. */
async function wasmSection() {
  console.log('\n=== 0b. R2f: THE SAME RELAXATION, IN THE MODULE ===');
  const SW = require('../src/solver-wasm.js');
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

  check('R2f emits and validates as a module', (() => {
    const bytes = SW.moduleBytes(A.RELAX_FUNCS);
    return bytes.length > 0 && WebAssembly.validate(bytes);
  })());
  // THE SUBSTITUTION IS THE ONLY CHANGE. Everything but `reach` is AV's, and the stock
  // emission is still exactly what AV timed -- test-solver.js pins that length, so a
  // module edited rather than appended to would go red over there instead of here.
  check('   and it is AV\'s module with one function swapped, not a rebuilt one',
    A.RELAX_FUNCS.length === SW.FUNCS.length
    && A.RELAX_FUNCS.slice(1).every((f, i) => f === SW.FUNCS[i + 1])
    && A.RELAX_FUNCS[0] !== SW.FUNCS[0]
    && A.RELAX_FUNCS[0].name === 'reach'
    && A.RELAX_FUNCS[0].params.length === SW.FUNCS[0].params.length);
  check('   and the stock module is untouched at the length AV timed',
    SW.moduleBytes().length === 1386);

  // THE DIFFERENTIAL, AND IT IS RUN AGAINST THE JS REFERENCE FIRST ON PURPOSE. A
  // disagreement with `relaxReach` localises to a line of IR; a disagreement three
  // layers up, with the oracle, does not. Both are checked, per rail, in both modes,
  // over mid-solve states as well as converged ones.
  const EXPORTS = ['solve', 'sweep', 'seedCodes', 'reach'];
  const r2f = await SW.makeR2({ fns: A.RELAX_FUNCS, exports: EXPORTS });
  let compared = 0, vsRef = 0, vsWalk = 0, unknown = false;
  for (const kind of ['tree', 'decoded']) {
    const P = packFor(kind);
    const rails = P.railId.length;
    const jsRelax = new Uint32Array(rails * P.words);
    const jsWalk = new Uint32Array(rails * P.words);
    for (let s = 0; s < 8; s++) {
      const idx = s * 4096;
      const a = T.TRYTE_MIN + (idx % 729);
      const b = T.TRYTE_MIN + Math.floor(idx / 729) % 729;
      const inputs = { ...spread('a', a), ...spread('b', b), cin: 0 };
      try { NP.solveNamed(P, inputs, 1 + (s % 5)); } catch (e) { /* mid-solve: the point */ }
      for (let i = 0; i < P.cond.length; i++) if (P.cond[i] === NP.UNKNOWN) unknown = true;
      for (let r = 0; r < rails; r++) {
        for (const definite of [true, false]) {
          NP.reach(P, r, jsWalk, definite);
          A.relaxReach(P, r, jsRelax, definite);
          const L = r2f.layoutOf(P);
          const u8 = new Uint8Array(r2f.memory().buffer);
          u8.set(P.value.subarray(0, P.nodeCount), L.value);
          u8.set(P.cond.subarray(0, P.cond.length), L.cond);
          r2f.exports.reach(r, L.reachDef, definite ? 1 : 0);
          const got = new Uint32Array(r2f.memory().buffer,
            L.reachDef + r * P.words * 4, P.words);
          compared++;
          for (let w = 0; w < P.words; w++) if (got[w] !== jsRelax[r * P.words + w]) { vsRef++; break; }
          for (let w = 0; w < P.words; w++) if (got[w] !== jsWalk[r * P.words + w]) { vsWalk++; break; }
        }
      }
    }
  }
  check(`R2f's reach matches the JS reference over ${compared} rail-mode-state comparisons`,
    vsRef === 0, `${vsRef} differ`);
  check('   and matches the walk it replaces, which is the claim that matters',
    vsWalk === 0, `${vsWalk} differ`);
  check('   over states that include an undetermined device, so the two modes differ',
    unknown);
}

wasmSection().then(() => {
  console.log(`\n${'='.repeat(64)}`);
  console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
  process.exit(fails.length ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
