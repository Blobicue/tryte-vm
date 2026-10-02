'use strict';
/* SOLVER AUDIT — what does the packed representation buy a switch-level solver, and
 * what does WebAssembly buy on top of it?
 *
 * Set `AV`. Every earlier set measures the MACHINE. This one measures the
 * INSTRUMENT, because the instrument has started to bound what the corpus may
 * claim: `Y1` swept all 531,441 operand pairs at carry-in 0 and then sampled
 * carry-in +1 and -1 at one pair in 121, `E1` did the same, and every restored
 * variant in `Z` is sampled at that stride on networks up to 1,776 switches. Those
 * are disclosed samples, and the reason each one is a sample is `Net.solve()`
 * rather than the question being asked.
 *
 * WHAT THIS SET DELIBERATELY DOES NOT DO: it does not run those sweeps. An
 * instrument that has not been held against the oracle produces facts about the
 * instrument -- T-INSTRUMENT-FALSE-VERDICT, sixteen bites and counting -- so the
 * sweeps belong to a later set, registered once R1 and R2 have been proved against
 * `src/device.js` and not before. This set asks only what building them costs and
 * what each layer of the rewrite is worth.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * THREE IMPLEMENTATIONS, because two cannot separate the two effects.
 *
 *   R0  `src/device.js` as it stands. The oracle. Never optimised, never replaced.
 *   R1  the SAME ALGORITHM over a packed representation: dense integer node ids,
 *       parallel typed arrays for the device table, CSR adjacency, word-packed
 *       reachability, and rail and driven masks computed once per network.
 *   R2  the same algorithm again, emitted as WebAssembly by JavaScript in `src/`,
 *       over the same packed form.
 *
 * R1 is a NEGATIVE CONTROL, not a stepping stone. Same fixed-point loop, same six
 * traversals per pass (three rails x definite/possible), same termination test,
 * same `init` and `driven` semantics, same throw-at-the-cap behaviour. No
 * incremental recomputation and no fusing the two walks. Without R1 the comparison
 * measures a data-structure rewrite and reports it as WebAssembly.
 *
 * FIXED BEFORE THE RUN, and not at risk:
 *   - The benchmark network for AV2 and AV3 is the unrestored six-trit tree ripple
 *     adder, `tRippleAdder(net, 6, false)`: 624 switches, 328 nodes, seven passes.
 *   - The second network for AV4 is the same adder at `restore: 'leafmid'`: 1,776
 *     switches, thirty-one passes. Both are Z3's, already on the record; this set
 *     does not re-measure them. Its node count is not on the record and is listed
 *     under NOT REGISTERED below rather than used to carry an argument here.
 *   - The sample is the first 20,000 operand pairs of the carry-in-0 sweep in
 *     the audit's own iteration order, one solve per pair, no pass-count probe.
 *   - ALL THREE ARE TIMED IN ONE PROCESS ON ONE MACHINE, interleaved rather than
 *     run back to back. The seconds recorded in `Y1` (1,170) and `E1` (1,420) are
 *     from other hardware and are NOT a baseline for anything here; a ratio taken
 *     against them would be measuring the machine.
 *   - Wall-clock median of five repetitions, discarding the first as warm-up.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AV1 THE COST IS IN THE UPDATE LOOP, NOT THE TRAVERSAL. More than half of R0's
 *       per-solve wall-clock is spent in the per-node update that closes each pass,
 *       and not in the six reachability walks. Measured by ablation: a copy of R0
 *       with only the update loop's allocation removed -- the two
 *       `Object.keys(this.rails).filter(...)` calls per node per pass replaced by a
 *       preallocated scan producing identical values -- recovers more than half the
 *       gap between R0 and R1. Refuted if it recovers half or less.
 *       AT RISK: my own count points the OTHER WAY and I am registering against it.
 *       One solve on this network is about 26,000 edge visits (seven passes, six
 *       walks, 624 edges) against about 4,600 array allocations and 13,800 `Set`
 *       lookups in the update loop (328 nodes, seven passes, two filters each).
 *       Edge visits outnumber update operations five to one, so the traversal is
 *       the larger term BY COUNT. The prediction is that allocation is expensive
 *       enough per operation to invert that, and if allocation is cheap under a
 *       generational nursery it will not, and this fails.
 *
 *   AV2 THE REPRESENTATION IS WORTH MORE THAN AN ORDER OF MAGNITUDE. The R1-over-R0
 *       median wall-clock ratio on the benchmark lands in [15, 40]. Below 15 or
 *       above 40 refutes it.
 *       AT RISK: both bounds have a route, and the band is deliberately narrow
 *       enough to be reachable from either side. The anchor is R0 at roughly 75
 *       nanoseconds per edge visit, measured while planning this set; a packed walk
 *       that gets an edge visit into the low single-digit nanoseconds lands near the
 *       middle of the band, and that is the whole of the derivation.
 *       BELOW 15 -- R0's `Set`-based `seen` can abandon a traversal early where a
 *       bitset walk still has to finish the frontier, so R1 may do strictly MORE
 *       work per pass than R0 does, and V8's inline caches handle a monomorphic
 *       `Map`-to-array walk better than the object-churn description suggests.
 *       ABOVE 40 -- this is where AV1 and AV2 are IN TENSION BY CONSTRUCTION, which
 *       is registered here rather than reconciled later. If AV1 holds and allocation
 *       is the dominant term, then removing every allocation from the update loop
 *       AND the six fresh `Set`s per pass should compound past 40 and break this.
 *       Both cannot comfortably hold at the top of their ranges, and I am
 *       registering both rather than hedging one against the other.
 *
 *   AV3 WEBASSEMBLY BUYS LESS THAN THE REWRITE DID, AND LESS THAN A FACTOR OF TWO.
 *       The R2-over-R1 median ratio on the same benchmark lands in [1.0, 2.0].
 *       AT RISK: BELOW 1.0 refutes it, and that is the outcome I would least like
 *       and cannot rule out -- a hand-rolled emitter does no register allocation and
 *       no strength reduction, TurboFan does both, and wasm losing outright to
 *       optimised typed-array JavaScript on a pointer-chasing loop is a real
 *       result rather than a formality. ABOVE 2.0 refutes it the other way, and the
 *       route is bounds-checking: every `Uint32Array` index in R1 is checked and
 *       every `i32.load` into R2's single linear memory is not. I am registering
 *       the answer that makes step 4 of `design/13-instrument.md` dead weight.
 *
 *   AV4 AND THE ADVANTAGE IS A CONSTANT, NOT A FUNCTION OF SIZE. The R2-over-R1
 *       ratio on the `leafmid` adder (1,776 switches, thirty-one passes) differs
 *       from the same ratio on the unrestored adder (624 switches, seven passes) by
 *       less than 0.5 in absolute terms. Refuted if the two separate by 0.5 or more.
 *       AT RISK: and WEAK BY CONSTRUCTION, which is registered here rather than
 *       discovered in the write-up. `leafmid` is 2.85x the switches of the
 *       unrestored adder and its node count grows by close to the same factor, so
 *       the traversal term and the update term grow at nearly the same rate between
 *       these two and this pair cannot separate them. What it can still catch is a
 *       working set falling out of cache on one side and not the other -- both
 *       reachability bitsets are small enough to sit in L1 on both networks, so I
 *       predict no separation, and any separation at all refutes it. A pair chosen
 *       to vary switches and nodes independently would be the better instrument and
 *       this set does not build one.
 *
 * NOT REGISTERED — computable before the run, or already on the record, and listed
 * here so the registered set is not inflated with facts that were never at risk:
 *   - Switch and pass counts for every network above. All `Z3`, already measured,
 *     and the pass counts were derived by hand from gate-dependency depth before
 *     that run. This set does not re-measure them.
 *   - NODE counts, which are NOT on the record: 328 for the unrestored tree adder,
 *     904 for `leafmid`, 208 for the decoded adder. Counted while planning this set
 *     by walking `net.devices` and collecting `a`, `b` and `gate`. They are
 *     structure, they are arithmetic over a network nobody chose for this purpose,
 *     and they were known before any prediction here was written -- so they are
 *     recorded as measured-not-registered rather than counted as findings.
 *   - That pass counts are independent of the operand data. `Y2` derived it and
 *     `Z3` measured `pairs_differing_by_data: 0`.
 *   - That R1 and R2 agree with R0. That is the anti-divergence GATE, not a
 *     prediction: if it fails there is no instrument and nothing to report.
 *   - The 26,000 / 4,600 / 13,800 operation counts quoted in AV1's risk line, which
 *     are arithmetic over structure this set stipulated.
 * ------------------------------------------------------------------------------
 * Run:  npm run audit:solver
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

const D = require('../src/device.js');
const NP = require('../src/netpack.js');
const SW = require('../src/solver-wasm.js');
const T = require('../src/ternary.js');

/* ============================================================== R0, ABLATED
 *
 * AV1 names ONE change and nothing else: the two
 * `Object.keys(this.rails).filter(...)` calls in the per-node update, replaced by
 * a scan over a rail list hoisted out of the loop. Identical values, and no array
 * and no `Object.keys` per node per pass.
 *
 * EVERYTHING ELSE IS R0's, to the letter: the `Map` of arrays of objects rebuilt
 * per solve, the fresh `Set` per rail per mode per pass, the
 * `devices.map(conducts)` array, the object-keyed value map. AV2's upper route is
 * about removing THOSE as well, so an ablation that took them too would be
 * measuring two predictions with one instrument and could not separate them.
 *
 * Copied rather than parameterised, because R0 is the oracle and a flag inside it
 * is a change to it. The gate holds this copy against R0 on the same corpus R1
 * has to pass — an ablation that diverges would put AV1's number on a solver
 * nobody checked.
 */
function solveAblated(net, inputs, maxIterations = 64, init = {}) {
  const value = { ...net.rails };
  for (const [k, v] of Object.entries(inputs)) value[k] = v;
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);

  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  for (const nm of nodes) if (!driven.has(nm)) value[nm] = 'Z';
  for (const [nm, v] of Object.entries(init)) {
    if (driven.has(nm)) throw new Error(`init names a driven node: ${nm}`);
    if (!nodes.has(nm)) throw new Error(`init names a node no device mentions: ${nm}`);
    value[nm] = v;
  }

  const conducts = d => {
    const g = value[d.gate];
    if (g === 'Z' || g === 'X' || g === undefined) return 'unknown';
    return d.kind === 'n' ? (g >= d.vt) : (g <= d.vt);
  };

  const adj = new Map();
  const link = (from, to, i) => {
    let list = adj.get(from);
    if (!list) { list = []; adj.set(from, list); }
    list.push({ i, other: to });
  };
  net.devices.forEach((d, i) => { link(d.a, d.b, i); link(d.b, d.a, i); });

  const reach = (rail, accept) => {
    const seen = new Set([rail]);
    const stack = [rail];
    while (stack.length) {
      const at = stack.pop();
      const edges = adj.get(at);
      if (edges === undefined) continue;
      for (const e of edges) {
        if (!accept(e.i)) continue;
        const other = e.other;
        if (seen.has(other)) continue;
        seen.add(other);
        if (!driven.has(other)) stack.push(other);
      }
    }
    return seen;
  };

  // THE ABLATION, and the whole of it: one rail list, read once.
  const railNames = Object.keys(net.rails);

  for (let iter = 0; iter < maxIterations; iter++) {
    const cond = net.devices.map(conducts);
    const definite = {}, possible = {};
    for (const rail of railNames) {
      definite[rail] = reach(rail, i => cond[i] === true);
      possible[rail] = reach(rail, i => cond[i] !== false);
    }
    let changed = false;
    for (const nm of nodes) {
      if (driven.has(nm)) continue;
      // R0 builds two arrays here, per node, per pass. This scan produces the
      // same two facts -- how many rails, and which one when there is exactly
      // one -- and builds nothing.
      let defCount = 0, defRail = null, posCount = 0;
      for (let r = 0; r < railNames.length; r++) {
        const rail = railNames[r];
        if (definite[rail].has(nm)) { defCount++; defRail = rail; }
        if (possible[rail].has(nm)) posCount++;
      }
      let next;
      if (posCount === 0) next = 'Z';
      else if (defCount === 1 && posCount === 1) next = net.rails[defRail];
      else next = 'X';
      if (value[nm] !== next) { value[nm] = next; changed = true; }
    }
    if (!changed) return value;
  }
  throw new Error('switch-level network did not settle — oscillation or a cycle');
}

/* ================================================== THE SOLVERS, ONE INTERFACE
 *
 * Every solver the gate compares answers the same call:
 *
 *     solve(net, inputNames, inputs, maxIterations, init) -> { node: state }
 *
 * `inputNames` is redundant for R0 and for the ablation, which take their driven
 * set from `inputs` on every solve, and load-bearing for R1 and R2, which compute
 * the driven mask once per network. Passing it to all four keeps the gate calling
 * one signature rather than branching on which solver it is holding.
 */
const packCache = new WeakMap();
/** One packed form per (net, input list). Packing is per-network by construction. */
function packedFor(net, inputNames) {
  let byKey = packCache.get(net);
  if (!byKey) { byKey = new Map(); packCache.set(net, byKey); }
  const key = inputNames.join(',');
  let p = byKey.get(key);
  if (!p) { p = NP.pack(net, inputNames); byKey.set(key, p); }
  return p;
}

const R0 = (net, inputNames, inputs, cap, init) => net.solve(inputs, cap, init);
const R0ABL = (net, inputNames, inputs, cap, init) => solveAblated(net, inputs, cap, init);
const R1 = (net, inputNames, inputs, cap, init) =>
  NP.solveNamed(packedFor(net, inputNames), inputs, cap, init);

/**
 * R2 needs a module instantiated before it can answer anything, and
 * `WebAssembly.instantiate` is a promise -- so ONE instance is built here and the
 * adapter over it is synchronous, which keeps every timed path free of an `await`
 * it would otherwise be measuring. One instance, not one per network: the module
 * has nothing network-specific in it.
 */
let R2INSTANCE = null;
async function makeR2() {
  if (!R2INSTANCE) R2INSTANCE = await SW.makeR2();
  return R2INSTANCE;
}
const R2 = (net, inputNames, inputs, cap, init) =>
  R2INSTANCE.solveNamed(packedFor(net, inputNames), inputs, cap, init);

/* ======================================================= THE GATE'S CORPUS
 *
 * A ratio between two solvers that disagree is a fact about neither, so this is
 * built before any timing and every number below it is read only if this is clean.
 *
 * What it has to cover, and why each piece is here rather than assumed:
 *
 *   - EVERY SMALL BUILDER, exhaustively over its own inputs. Cheap and total.
 *   - The selector and detector builders wired BOTH ways: arms on rails, and arms
 *     on inputs. The second is T5 -- an input gates and terminates a path but does
 *     not SOURCE -- so those rows resolve to Z, and a packed form that quietly
 *     sourced from inputs would pass every rail-armed case and fail here.
 *   - ALL 27 INPUT TRIPLES OF BOTH ADDER CELLS, in every share and restore
 *     variant, because sharing ties mid-level nodes together and restoring puts an
 *     inverter between two pass networks.
 *   - THE TABLE BUILDERS OVER A SWEEP of tables, not one table. Two functions
 *     agreeing at one point are not equal (T-ONE-POINT, three bites), and a table
 *     builder is exactly a family of circuits indexed by its cells.
 *   - A NETWORK THAT DOES NOT SETTLE. `fullSweep` learns the pass count by
 *     catching the throw, so "did not settle within k" is a measurement and the
 *     bound is compared, not just the levels.
 *   - INIT-SEEDED SOLVES, including the self-inverter at each of the five states.
 *     N8 makes the starting state part of the semantics; a packed form that cannot
 *     seed an arbitrary non-driven node to an arbitrary state has silently dropped
 *     an axiom, and every unseeded case in this corpus would still pass.
 *
 * NOT HERE, deliberately: the exhaustive operand sweeps. They are the later set,
 * registered once this gate is green. Running them inside AV would be measuring
 * with an uncalibrated instrument, which is T-INSTRUMENT-FALSE-VERDICT.
 */

/** Cartesian product of `levels` over `names`, as input objects. */
function rowsOver(names, levels) {
  const out = [];
  const rec = pre => {
    if (pre.length === names.length) {
      const o = {}; names.forEach((n, i) => { o[n] = pre[i]; });
      out.push(o); return;
    }
    for (const l of levels) rec(pre.concat([l]));
  };
  rec([]);
  return out;
}

const TRI = [-1, 0, 1];
const BIN = [-1, 1];

/**
 * A family of 27-cell tables to sweep the table builders over. Every cell is
 * fixed by a RULE rather than drawn from a generator: a pseudo-random corpus
 * would need its own coverage argument (T-FAKE-RANDOM), and these do not.
 */
function tableFamily() {
  const t = D.adderTables();
  const fam = [['adder sum', null], ['adder carry', null]];
  fam[0][1] = t.sum; fam[1][1] = t.carry;
  const rules = [
    ['constant LOW', () => -1],
    ['constant MID', () => 0],
    ['constant HIGH', () => 1],
    ['first input', a => a],
    ['third input', (a, b, c) => c],
    ['min', (a, b, c) => Math.min(a, b, c)],
    ['max', (a, b, c) => Math.max(a, b, c)],
    ['sum mod 3', (a, b, c) => ((a + b + c + 4) % 3) - 1],
    ['c, negated when a and b differ', (a, b, c) => (c === 0 ? 0 : (a === b ? c : -c))],
    ['LOW except one HIGH cell', (a, b, c) => (a === 1 && b === 1 && c === 1 ? 1 : -1)],
    ['MID except one LOW cell', (a, b, c) => (a === -1 && b === 0 && c === 1 ? -1 : 0)],
  ];
  for (const [label, f] of rules) {
    const cells = new Array(27);
    for (const a of TRI) for (const b of TRI) for (const c of TRI) cells[D.cellIndex(a, b, c)] = f(a, b, c);
    fam.push([label, cells]);
  }
  return fam;
}

/** The same, eight cells wide, for the binary table builder. */
function binaryTableFamily() {
  const t = D.bAdderTables();
  const fam = [['binary adder sum', t.sum], ['binary adder carry', t.carry]];
  const rules = [
    ['constant LOW', () => -1],
    ['constant HIGH', () => 1],
    ['first input', a => a],
    ['parity', (a, b, c) => (a * b * c)],
    ['majority', (a, b, c) => (a + b + c > 0 ? 1 : -1)],
  ];
  for (const [label, f] of rules) {
    const cells = new Array(8);
    for (const a of BIN) for (const b of BIN) for (const c of BIN) {
      cells[((a + 1) / 2) * 4 + ((b + 1) / 2) * 2 + (c + 1) / 2] = f(a, b, c);
    }
    fam.push([label, cells]);
  }
  return fam;
}

/**
 * Every state this corpus can seed a non-driven node to, as `init` objects over a
 * network's own non-driven mentioned nodes. The rotating pattern is the one that
 * matters: all-Z and all-X are uniform, and a representation that could only seed
 * uniformly would pass both and still not express N8.
 */
function seedPatterns(net, inputNames) {
  const nodes = new Set();
  for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
  const driven = new Set([...Object.keys(net.rails), ...inputNames]);
  const free = [...nodes].filter(n => !driven.has(n));
  const pat = (f) => Object.fromEntries(free.map((n, i) => [n, f(i)]));
  const ROT = ['Z', 'X', -1, 0, 1];
  return [
    { label: 'no seed', init: {} },
    { label: 'all Z', init: pat(() => 'Z') },
    { label: 'all X', init: pat(() => 'X') },
    { label: 'all MID', init: pat(() => 0) },
    { label: 'rotating Z X -1 0 +1', init: pat(i => ROT[i % 5]) },
  ];
}

/** One group: a network, the names it is driven by, and the rows to compare on. */
function group(label, build, inputNames, levels, opts = {}) {
  const net = opts.binary ? D.binaryNet() : new D.Net();
  build(net);
  let rows = (opts.rows || rowsOver(inputNames, levels)).map(inputs => ({ inputs, cap: 64, init: {} }));
  if (opts.seeded) {
    const pats = seedPatterns(net, inputNames);
    const seeded = [];
    for (const r of rows) for (const p of pats) seeded.push({ inputs: r.inputs, cap: 64, init: p.init });
    rows = seeded;
  }
  return { label, net, inputNames, rows };
}

/** Every operand pair the six-trit sweep would visit, at a stride. */
function stridedPairs(stride) {
  const out = [];
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += stride) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += stride) out.push([a, b]);
  }
  return out;
}

const spread = (nm, v, n) => Object.fromEntries(T.toTrits(v, n).map((t, i) => [`${nm}${i}`, t]));
const rippleInputs = n => [...Array.from({ length: n }, (_, i) => `a${i}`),
  ...Array.from({ length: n }, (_, i) => `b${i}`), 'cin'];

let GROUPS = null;
function gateGroups() {
  if (GROUPS) return GROUPS;
  const G = [];

  // --- the one-and-two-input builders, exhaustive, and seeded five ways each
  for (const [nm, f] of [['sti', D.sti], ['nti', D.nti], ['pti', D.pti]]) {
    G.push(group(nm, n => f(n, 'a', 'o'), ['a'], TRI, { seeded: true }));
  }
  for (const [nm, f] of [['tmin', D.tmin], ['tmax', D.tmax]]) {
    G.push(group(nm, n => f(n, 'a', 'b', 'o'), ['a', 'b'], TRI, { seeded: true }));
  }
  G.push(group('isMid', n => D.isMid(n, 's', 'o'), ['s'], TRI, { seeded: true }));
  G.push(group('tBuffer', n => D.tBuffer(n, 'a', 'o', 'B'), ['a'], TRI, { seeded: true }));

  // --- selectors, arms on rails and arms on inputs. The second is T5.
  G.push(group('tmux, arms on rails', n => D.tmux(n, 's', 'vss', 'vmid', 'vdd', 'o'),
    ['s'], TRI, { seeded: true }));
  G.push(group('tmux, arms on inputs', n => D.tmux(n, 's', 'lo', 'mid', 'hi', 'o'),
    ['s', 'lo', 'mid', 'hi'], TRI));
  G.push(group('dmux, arms on rails', n => D.dmux(n, 's', 'sm', 'vss', 'vmid', 'vdd', 'o'),
    ['s', 'sm'], TRI, { seeded: true }));
  G.push(group('dmux, arms on inputs', n => D.dmux(n, 's', 'sm', 'lo', 'mid', 'hi', 'o'),
    ['s', 'sm', 'lo', 'mid', 'hi'], TRI));
  // The detector and the selector it decodes, wired together as dtable3 wires them.
  G.push(group('isMid into dmux', n => { D.isMid(n, 's', 's$im'); D.dmux(n, 's', 's$im', 'vss', 'vmid', 'vdd', 'o'); },
    ['s'], TRI, { seeded: true }));

  // --- the binary builders, over their own two levels
  G.push(group('bInv', n => D.bInv(n, 'a', 'o'), ['a'], BIN, { binary: true, seeded: true }));
  G.push(group('bNand', n => D.bNand(n, 'a', 'b', 'o'), ['a', 'b'], BIN, { binary: true, seeded: true }));
  G.push(group('bAnd', n => D.bAnd(n, 'a', 'b', 'o'), ['a', 'b'], BIN, { binary: true, seeded: true }));
  G.push(group('bmux, arms on rails', n => D.bmux(n, 's', 'vss', 'vdd', 'o'), ['s'], BIN, { binary: true, seeded: true }));
  G.push(group('bmux, arms on inputs', n => D.bmux(n, 's', 'lo', 'hi', 'o'), ['s', 'lo', 'hi'], BIN, { binary: true }));
  G.push(group('bBuffer', n => D.bBuffer(n, 'a', 'o', 'B'), ['a'], BIN, { binary: true, seeded: true }));

  // --- both adder cells, all 27 triples, every share and restore variant
  for (const share of [false, true]) {
    for (const restore of ['none', 'mid', 'leafmid']) {
      G.push(group(`tAdderCell share=${share} restore=${restore}`,
        n => D.tAdderCell(n, 'a', 'b', 'cin', 's', 'co', 'A', { share, restore }),
        ['a', 'b', 'cin'], TRI));
    }
    G.push(group(`dAdderCell share=${share}`,
      n => D.dAdderCell(n, 'a', 'b', 'cin', 's', 'co', 'A', { share }),
      ['a', 'b', 'cin'], TRI));
  }
  // and the two cells seeded, because a cell is where a restored buffer sits
  G.push(group('tAdderCell restore=leafmid, seeded',
    n => D.tAdderCell(n, 'a', 'b', 'cin', 's', 'co', 'A', { restore: 'leafmid' }),
    ['a', 'b', 'cin'], TRI, { seeded: true, rows: rowsOver(['a', 'b', 'cin'], [-1, 1]) }));
  G.push(group('dAdderCell, seeded',
    n => D.dAdderCell(n, 'a', 'b', 'cin', 's', 'co', 'A'),
    ['a', 'b', 'cin'], TRI, { seeded: true, rows: rowsOver(['a', 'b', 'cin'], [-1, 1]) }));

  // --- the table builders over a SWEEP of tables, not one table
  for (const [label, cells] of tableFamily()) {
    for (const share of [false, true]) {
      G.push(group(`ttable3 ${label} share=${share}`,
        n => D.ttable3(n, 'a', 'b', 'c', cells, 'o', 'Tb', { share }), ['a', 'b', 'c'], TRI));
      G.push(group(`dtable3 ${label} share=${share}`,
        n => { for (const s of ['a', 'b', 'c']) D.isMid(n, s, `${s}$im`);
          D.dtable3(n, 'a', 'b', 'c', cells, 'o', 'Tb', { share }); }, ['a', 'b', 'c'], TRI));
    }
    G.push(group(`ttable3 ${label} restore=leafmid`,
      n => D.ttable3(n, 'a', 'b', 'c', cells, 'o', 'Tb', { restore: 'leafmid' }), ['a', 'b', 'c'], TRI));
  }
  for (const [label, cells] of binaryTableFamily()) {
    for (const restore of ['none', 'mid', 'leafmid']) {
      G.push(group(`btable3 ${label} restore=${restore}`,
        n => D.btable3(n, 'a', 'b', 'c', cells, 'o', 'Tb', { restore }),
        ['a', 'b', 'c'], BIN, { binary: true }));
    }
  }

  // --- ripple adders: narrow ones exhaustively, six trits at a stride
  for (const n of [1, 2]) {
    G.push(group(`tRippleAdder n=${n}`, net => D.tRippleAdder(net, n), rippleInputs(n), TRI));
    G.push(group(`dRippleAdder n=${n}`, net => D.dRippleAdder(net, n), rippleInputs(n), TRI));
  }
  for (const b of [3, 4]) {
    G.push(group(`bRippleAdder n=${b}`, net => D.bRippleAdder(net, b),
      rippleInputs(b), BIN, { binary: true }));
  }
  const six = stridedPairs(101).map(([a, b]) => ({ ...spread('a', a, 6), ...spread('b', b, 6), cin: 0 }));
  const sixCin = [1, -1].flatMap(cin =>
    stridedPairs(181).map(([a, b]) => ({ ...spread('a', a, 6), ...spread('b', b, 6), cin })));
  for (const restore of ['none', 'mid', 'leafmid']) {
    G.push(group(`tRippleAdder n=6 restore=${restore}, strided`,
      net => D.tRippleAdder(net, 6, { restore }), rippleInputs(6), TRI,
      { rows: restore === 'none' ? six.concat(sixCin) : sixCin }));
  }
  G.push(group('dRippleAdder n=6, strided',
    net => D.dRippleAdder(net, 6), rippleInputs(6), TRI, { rows: six.concat(sixCin) }));
  G.push(group('bRippleAdder n=10, strided',
    net => D.bRippleAdder(net, 10), rippleInputs(10), BIN,
    { binary: true,
      rows: [0, 137, 512, 1023, 733].flatMap(x => [0, 91, 1023, 466].map(y => Object.fromEntries([
        ...Array.from({ length: 10 }, (_, i) => [`a${i}`, ((x >> i) & 1) ? 1 : -1]),
        ...Array.from({ length: 10 }, (_, i) => [`b${i}`, ((y >> i) & 1) ? 1 : -1]),
        ['cin', -1]]))) }));

  // --- A NETWORK THAT DOES NOT SETTLE, and the staged one beside it.
  //
  // The self-inverter is D5's exception: its gate IS its terminal. Seeded at a
  // LEVEL it runs -1 -> +1 -> -1 forever and solve() throws rather than hand back
  // a half-settled state, and that throw is what `fullSweep` reads as a pass
  // count. Seeded at MID it settles at MID -- a fixed point the all-Z start will
  // not invent (N8) -- and unseeded it lands on X. All five states, and the caps
  // around the cliff, because the bound is being compared and not just the levels.
  {
    const net = new D.Net(); D.sti(net, 'o', 'o');
    const rows = [];
    for (const seed of ['Z', 'X', -1, 0, 1]) {
      for (const cap of [1, 2, 3, 4, 8, 64]) rows.push({ inputs: {}, cap, init: { o: seed, 'o$mid': 'Z' } });
    }
    for (const cap of [1, 2, 3, 4, 8, 64]) rows.push({ inputs: {}, cap, init: {} });
    G.push({ label: 'self-inverter (N7, N8)', net, inputNames: [], rows });
  }
  {
    // N7's staged pair: a lone gate settles inside two passes, the same gate fed
    // by another needs three. Both caps, both networks, so the gate compares the
    // exact pass at which each solver stops rather than only that it stops.
    const lone = new D.Net(); D.tmin(lone, 'a', 'b', 'o');
    const chain = new D.Net(); D.sti(chain, 'a', 'na'); D.tmin(chain, 'na', 'b', 'o');
    const caps = [1, 2, 3, 4, 64];
    G.push({ label: 'lone gate, every cap', net: lone, inputNames: ['a', 'b'],
      rows: rowsOver(['a', 'b'], TRI).flatMap(inputs => caps.map(cap => ({ inputs, cap, init: {} }))) });
    G.push({ label: 'chained gate, every cap', net: chain, inputNames: ['a', 'b'],
      rows: rowsOver(['a', 'b'], TRI).flatMap(inputs => caps.map(cap => ({ inputs, cap, init: {} }))) });
  }

  GROUPS = G;
  return G;
}

/** The two refusals R0 makes about `init`, which a port has to make identically. */
function refusalCases() {
  const net = new D.Net(); D.tmin(net, 'a', 'b', 'o');
  return [
    { label: 'init names a rail', net, inputNames: ['a', 'b'], inputs: { a: 1, b: 1 }, init: { vss: 1 } },
    { label: 'init names an input', net, inputNames: ['a', 'b'], inputs: { a: 1, b: 1 }, init: { a: 0 } },
    { label: 'init names an unknown node', net, inputNames: ['a', 'b'], inputs: { a: 1, b: 1 }, init: { nope: 0 } },
  ];
}

/**
 * Hold a solver against R0 over the whole corpus. Returns what it compared, what
 * diverged, and WHICH OF THE FIVE STATES R0 actually produced along the way --
 * because a gate that never saw an X or a Z cannot have checked how they are
 * handled, and would report clean either way.
 */
function runGate(solve, opts = {}) {
  // `stopAfterDiffs` is for MUTATION TESTING only: a deliberately broken solver
  // does not need the whole corpus run past the first thing it gets wrong. The
  // real gate never passes it, and a zero here would mean "stop before starting".
  const stopAfter = opts.stopAfterDiffs || 0;
  const groups = gateGroups();
  let rows = 0, values = 0, threwBoth = 0;
  const diffs = [];
  const coverage = new Set();
  for (const g of groups) {
    if (stopAfter && diffs.length >= stopAfter) break;
    for (const row of g.rows) {
      if (stopAfter && diffs.length >= stopAfter) break;
      rows++;
      let a = null, ea = null, b = null, eb = null;
      try { a = R0(g.net, g.inputNames, row.inputs, row.cap, row.init); } catch (e) { ea = e.message; }
      try { b = solve(g.net, g.inputNames, row.inputs, row.cap, row.init); } catch (e) { eb = e.message; }
      if (ea !== null || eb !== null) {
        if (ea !== eb) {
          diffs.push(`${g.label}: R0 ${ea === null ? 'returned' : `threw "${ea}"`},`
            + ` subject ${eb === null ? 'returned' : `threw "${eb}"`}`);
        } else threwBoth++;
        continue;
      }
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) {
        values++;
        coverage.add(a[k]);
        if (a[k] !== b[k]) {
          if (diffs.length < 20) {
            diffs.push(`${g.label} ${JSON.stringify(row.inputs)} cap ${row.cap}: `
              + `${k} is ${JSON.stringify(a[k])} in R0, ${JSON.stringify(b[k])} in the subject`);
          }
        }
      }
    }
  }
  for (const c of refusalCases()) {
    rows++;
    let ea = null, eb = null;
    try { R0(c.net, c.inputNames, c.inputs, 64, c.init); } catch (e) { ea = e.message; }
    try { solve(c.net, c.inputNames, c.inputs, 64, c.init); } catch (e) { eb = e.message; }
    if (ea !== eb) diffs.push(`${c.label}: R0 ${JSON.stringify(ea)}, subject ${JSON.stringify(eb)}`);
    else if (ea !== null) threwBoth++;
  }
  return { groups: groups.length, rows, values, threwBoth, diffs, coverage };
}

/**
 * The pass count, compared rather than only the levels. R0 finds each network's
 * minimum ONCE by probing upward; the subject is then CHECKED twice -- it settles
 * at k, and it does not settle at k-1. Two solves per case, not eighty:
 * T-SEARCH-WHERE-A-CHECK-WOULD-DO is on the record for exactly this shape.
 */
function passAgreement(solve) {
  const cases = [];
  for (const g of gateGroups()) {
    // Five rows spread across each group rather than one. A single row picked from
    // the middle put every self-inverter case on the MID seed, which settles -- so
    // the branch that compares a network that NEVER settles had no traffic through
    // it and would have reported clean whatever the subject did there.
    const n = g.rows.length;
    const at = [...new Set([0, n >> 2, n >> 1, n - (n >> 2) - 1, n - 1].filter(i => i >= 0 && i < n))];
    for (const i of at) cases.push({ label: `${g.label} [row ${i}]`, net: g.net, inputNames: g.inputNames, row: g.rows[i] });
  }
  // AND THE NON-SETTLING CASES BY NAME, not by where the sampler happens to land.
  // The spread above hit ONE of the two oscillating seeds, which is a check that
  // was right for no reason: the branch comparing a network that never settles had
  // one row of traffic and would read the same with none.
  {
    const net = new D.Net(); D.sti(net, 'o', 'o');
    for (const seed of [-1, 1]) {
      cases.push({ label: `self-inverter seeded at ${seed} (never settles)`,
        net, inputNames: [], row: { inputs: {}, cap: 64, init: { o: seed, 'o$mid': 'Z' } } });
    }
  }
  const CAP = 72;
  let checked = 0, settles = 0, never = 0;
  const bad = [];
  for (const c of cases) {
    let k = null;
    for (let i = 1; i <= CAP; i++) {
      try { R0(c.net, c.inputNames, c.row.inputs, i, c.row.init); k = i; break; } catch (e) { /* not yet */ }
    }
    checked++;
    if (k === null) {
      // Never settles: the subject must not settle either, at the same cap.
      never++;
      let threw = false;
      try { solve(c.net, c.inputNames, c.row.inputs, CAP, c.row.init); } catch (e) { threw = true; }
      if (!threw) bad.push(`${c.label}: R0 never settles inside ${CAP}, the subject did`);
      continue;
    }
    settles++;
    let atK = true, atKminus = true;
    try { solve(c.net, c.inputNames, c.row.inputs, k, c.row.init); } catch (e) { atK = false; }
    if (k > 1) { try { solve(c.net, c.inputNames, c.row.inputs, k - 1, c.row.init); } catch (e) { atKminus = false; } }
    if (!atK) bad.push(`${c.label}: R0 settles in ${k}, the subject did not`);
    if (k > 1 && atKminus) bad.push(`${c.label}: R0 needs ${k}, the subject settled in ${k - 1}`);
  }
  return { checked, settles, never, bad };
}

/* ====================================================== THE BENCHMARK, AS FIXED
 *
 * The registration fixes it and this section does not get to reinterpret it: the
 * first N operand pairs of the carry-in-0 sweep IN THE AUDIT'S OWN ITERATION
 * ORDER -- `adder-audit.js`'s `fullSweep`, a from TRYTE_MIN upward and b from
 * TRYTE_MIN upward -- one solve per pair, no pass-count probe.
 *
 * EACH SOLVER PREPARES ITS OWN INPUTS INSIDE ITS OWN TIMED REGION. R0 has no
 * interface but an object per pair; R1 writes state codes into a byte array. That
 * asymmetry IS the representation, and hoisting one side's preparation out of the
 * clock while leaving the other's in would be the rewrite laundering itself.
 *
 * Every sweep returns a checksum over the seven output nodes it read. Three
 * checksums that agree is the benchmark's own anti-divergence check, and a sweep
 * whose results nothing reads is a sweep an optimiser may delete.
 */
const BENCH_PAIRS = 20000;
const BENCH_REPS = 6;            // five kept, the first discarded as warm-up
const OUTS = ['s0', 's1', 's2', 's3', 's4', 's5', 'c6'];

function benchPairs(n) {
  const out = [];
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a++) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b++) {
      out.push([a, b]);
      if (out.length === n) return out;
    }
  }
  return out;
}

/** R0's sweep, and the ablation's: one input object per pair, as `fullSweep` does. */
function sweepObject(solve, net, inputNames, pairs) {
  let sum = 0;
  for (let i = 0; i < pairs.length; i++) {
    const inputs = { ...spread('a', pairs[i][0], 6), ...spread('b', pairs[i][1], 6), cin: 0 };
    const v = solve(net, inputNames, inputs, 64, {});
    for (let j = 0; j < OUTS.length; j++) {
      const x = v[OUTS[j]];
      sum = (sum * 31 + (x === 'Z' ? 0 : x === 'X' ? 1 : x + 3)) | 0;
    }
  }
  return sum;
}

/**
 * Operand integers to the state codes the packed form is seeded from. Shared, so
 * R1 and R2 are handed byte-identical work and neither gets a cheaper input path
 * than the other by accident.
 */
function pairCodes(P, pairs) {
  const k = P.inputId.length;
  const width = (k - 1) / 2;
  const codes = new Uint8Array(pairs.length * k);
  for (let i = 0; i < pairs.length; i++) {
    const ta = T.toTrits(pairs[i][0], width), tb = T.toTrits(pairs[i][1], width);
    for (let j = 0; j < width; j++) { codes[i * k + j] = ta[j] + 3; codes[i * k + width + j] = tb[j] + 3; }
    codes[i * k + 2 * width] = 3;                                  // cin at MID
  }
  return codes;
}

const checksum = out => {
  let sum = 0;
  for (let i = 0; i < out.length; i++) sum = (sum * 31 + out[i]) | 0;
  return sum;
};

/** R1's sweep: operand integers to state codes to answers, all inside the clock. */
function sweepPackedR1(P, pairs) {
  const codes = pairCodes(P, pairs);
  const outIds = Int32Array.from(OUTS.map(nm => NP.nodeId(P, nm)));
  const out = new Uint8Array(pairs.length * OUTS.length);
  NP.sweepPacked(P, codes, pairs.length, outIds, out, 64);
  return checksum(out);
}

/** R2's sweep: the same, with the driver inside the module. One boundary crossing. */
function sweepWasmR2(inst, P, pairs) {
  const codes = pairCodes(P, pairs);
  const outIds = Int32Array.from(OUTS.map(nm => NP.nodeId(P, nm)));
  const out = new Uint8Array(pairs.length * OUTS.length);
  inst.sweep(P, codes, pairs.length, outIds, out, 64);
  return checksum(out);
}

/**
 * Wall-clock over interleaved repetitions, and three things about HOW rather than
 * how many, because each of them can move a ratio on its own.
 *
 * ROTATION IS NOT ENOUGH, so the order is rotated AND reversed on alternate
 * repetitions. Under a plain rotation every subject has the same predecessor
 * every time -- with four subjects and `(i + r) % 4`, R1 always follows R0abl --
 * so a collection that the previous sweep provoked lands on the same subject at
 * every repetition and reads as that subject being slow. Reversing on odd
 * repetitions gives each subject more than one predecessor.
 *
 * ONE UNTIMED ROUND FIRST, of every subject. The registration says the first
 * repetition is discarded as warm-up; discarding it PER SUBJECT still leaves the
 * subject that runs first genuinely cold while the one that runs last has three
 * full sweeps of tier-up behind it. The untimed round removes that asymmetry, and
 * the first timed repetition is still discarded on top of it.
 *
 * AND A CHECKSUM THAT MOVED BETWEEN REPETITIONS IS NOT A TIMING. If a subject
 * returned two different answers across its repetitions, the median is over runs
 * that did different things, so this raises rather than reporting it.
 */
function interleaved(subjects, reps) {
  const order = r => {
    const rot = subjects.map((_, i) => subjects[(i + r) % subjects.length]);
    return r % 2 ? rot.reverse() : rot;
  };
  for (const s of order(0)) s.run();                       // untimed, and every subject
  const times = new Map(subjects.map(s => [s.name, []]));
  const sums = new Map();
  for (let r = 0; r < reps; r++) {
    for (const s of order(r)) {
      const t0 = process.hrtime.bigint();
      const sum = s.run();
      times.get(s.name).push(Number(process.hrtime.bigint() - t0) / 1e9);
      if (!sums.has(s.name)) sums.set(s.name, sum);
      else if (sums.get(s.name) !== sum) sums.set(s.name, NaN);
    }
  }
  const out = {};
  for (const s of subjects) {
    if (Number.isNaN(sums.get(s.name))) {
      throw new Error(`${s.name} returned different answers across repetitions`);
    }
    const kept = times.get(s.name).slice(1).sort((a, b) => a - b);
    out[s.name] = {
      median: kept[Math.floor(kept.length / 2)],
      kept: kept.length,
      all: times.get(s.name),
      checksum: sums.get(s.name),
    };
  }
  return out;
}

const ADDER_IN = rippleInputs(6);

/** The four measurements, in one process, on one machine, interleaved. */
function measure(pairCount, reps, inst) {
  const pairs = benchPairs(pairCount);

  const plain = new D.Net(); D.tRippleAdder(plain, 6, false);
  const leaf = new D.Net(); D.tRippleAdder(leaf, 6, { restore: 'leafmid' });
  const Pplain = NP.pack(plain, ADDER_IN);
  const Pleaf = NP.pack(leaf, ADDER_IN);

  const small = interleaved([
    { name: 'R0', run: () => sweepObject(R0, plain, ADDER_IN, pairs) },
    { name: 'R0abl', run: () => sweepObject(R0ABL, plain, ADDER_IN, pairs) },
    { name: 'R1', run: () => sweepPackedR1(Pplain, pairs) },
    { name: 'R2', run: () => sweepWasmR2(inst, Pplain, pairs) },
  ], reps);

  // AV4 is a ratio against a ratio, so only the two solvers that ratio is over
  // run here. R0 on `leafmid` is not registered and would cost most of an hour.
  const big = interleaved([
    { name: 'R1', run: () => sweepPackedR1(Pleaf, pairs) },
    { name: 'R2', run: () => sweepWasmR2(inst, Pleaf, pairs) },
  ], reps);

  return { pairs: pairs.length, reps, small, big, plain, leaf, Pplain, Pleaf };
}

// ---------------------------------------------------------------- the measurement

/* ======================================================== THE BANDS, AS REGISTERED
 *
 * Read out of the registration block above rather than typed again here. A
 * threshold transcribed by hand is a threshold that can be transcribed wrongly,
 * and this repository has a trap on the record for exactly that -- a truth table
 * copied out of a comment came back inverted and read as a clean headline finding.
 * If a regex below stops matching, this throws rather than scoring against a
 * default, because a verdict computed from a band nobody supplied is worse than
 * no verdict.
 */
function registeredBands() {
  const src = require('fs').readFileSync(__filename, 'utf8');
  const flat = src.slice(0, src.indexOf('Run:  npm run audit:solver'))
    .replace(/^ \* ?/gm, '').replace(/\s+/g, ' ');
  const grab = (re, what) => {
    const m = re.exec(flat);
    if (!m) throw new Error(`the registration no longer states ${what}`);
    return m.slice(1).map(Number);
  };
  const [lo2, hi2] = grab(/R1-over-R0 median wall-clock ratio on the benchmark lands in \[([\d.]+), ([\d.]+)\]/, "AV2's band");
  const [lo3, hi3] = grab(/R2-over-R1 median ratio on the same benchmark lands in \[([\d.]+), ([\d.]+)\]/, "AV3's band");
  const [sep] = grab(/differs from the same ratio on the unrestored adder \(624 switches, seven passes\) by less than ([\d.]+)/, "AV4's separation");
  if (!/recovers more than half the gap between R0 and R1/.test(flat)) {
    throw new Error("the registration no longer states AV1's threshold");
  }
  return { av1: 0.5, av2: [lo2, hi2], av3: [lo3, hi3], av4: sep };
}

/* ---------------------------------------------------------------- the measurement */

/**
 * The gate, then the benchmark, then the four verdicts. Returns them rather than
 * only printing them, so the record and the report are the same computation and
 * a number can be lifted into `FINDINGS.json` without being retyped.
 */
async function runAudit({ pairs = BENCH_PAIRS, reps = BENCH_REPS } = {}) {
  const inst = await makeR2();
  const gate = {};
  for (const [name, solve] of [['R0abl', R0ABL], ['R1', R1], ['R2', R2]]) {
    const g = runGate(solve);
    const p = passAgreement(solve);
    gate[name] = { g, p, divergences: g.diffs.length + p.bad.length };
  }
  const M = measure(pairs, reps, inst);
  const band = registeredBands();

  const gap = M.small.R0.median - M.small.R1.median;
  const av1 = (M.small.R0.median - M.small.R0abl.median) / gap;
  const av2 = M.small.R0.median / M.small.R1.median;
  const av3 = M.small.R1.median / M.small.R2.median;
  const av3big = M.big.R1.median / M.big.R2.median;
  const av4 = Math.abs(av3big - av3);

  return {
    gate, M, band, pairs: M.pairs, reps: M.reps,
    av1, av2, av3, av3big, av4,
    verdict: {
      AV1: av1 > band.av1 ? 'HELD' : 'FAILED',
      AV2: av2 >= band.av2[0] && av2 <= band.av2[1] ? 'HELD' : 'FAILED',
      AV3: av3 >= band.av3[0] && av3 <= band.av3[1] ? 'HELD' : 'FAILED',
      AV4: av4 < band.av4 ? 'HELD' : 'FAILED',
    },
  };
}

async function report(argv = []) {
  const quick = argv.includes('--quick');
  log('SOLVER AUDIT — what the packed representation buys, and what WebAssembly buys on top.');
  log(line);
  if (quick) {
    log('QUICK MODE — every print path runs, the sample is a fraction of the registered');
    log('one, and NOTHING BELOW IS A MEASUREMENT. `npm run audit:solver` is the audit.');
  }

  // Every verdict line carries this in quick mode, as relax-audit's do. Two hundred
  // pairs over two repetitions put the timing ratios in the noise, so a quick verdict
  // can disagree with the manifest -- and the banner above is three screens up by the
  // time a reader reaches the verdicts. The marker goes on the line that can be misread.
  const tag = quick ? '  (QUICK — NOT A MEASUREMENT)' : '';

  const A = await runAudit(quick ? { pairs: 200, reps: 2 } : {});

  log('\n--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  // R1 and R2 are held against R0 here, exhaustively on every small builder and on
  // all 27 input triples of both adder cells, BEFORE any timing is reported. A
  // ratio between two solvers that disagree is a fact about neither.
  // AD2 memoised only terminating values and reported the attacker as 300x WORSE --
  // in the flattering direction, which is the direction nothing catches by surprise.
  const WHO = { R0abl: 'R0abl  (the AV1 ablation)', R1: 'R1     (the packed solver)',
    R2: 'R2     (the emitted module)' };
  for (const name of ['R0abl', 'R1', 'R2']) {
    const { g, p, divergences } = A.gate[name];
    log(`      ${WHO[name]}`);
    log(`        ${g.rows.toLocaleString()} rows over ${g.groups} networks,`
      + ` ${g.values.toLocaleString()} node values compared, ${g.threwBoth} refusals matched`);
    log(`        states R0 produced: ${[...g.coverage].map(x => JSON.stringify(x)).sort().join(' ')}`);
    log(`        pass counts: ${p.settles} of ${p.checked} cases settle and are checked`
      + ` at k and at k-1; ${p.never} never settle and are checked at the cap`);
    log(`        DIVERGENCES: ${divergences}`);
    for (const d of g.diffs.slice(0, 5)) log(`          ${d}`);
    for (const d of p.bad.slice(0, 5)) log(`          ${d}`);
  }

  const M = A.M;
  const sec = x => `${x.toFixed(3)}s`;
  log(`\n      benchmark: the first ${M.pairs.toLocaleString()} operand pairs of the`
    + ` carry-in-0 sweep, ${M.reps} repetitions, first discarded`);
  log(`      checksums: ${['R0', 'R0abl', 'R1', 'R2'].map(n => `${n} ${M.small[n].checksum}`).join('   ')}`
    + `   leafmid: R1 ${M.big.R1.checksum}  R2 ${M.big.R2.checksum}`);

  log('\n--- AV1  where R0 spends its time: the ablation ---');
  log(`      R0 ${sec(M.small.R0.median)}   R0 ablated ${sec(M.small.R0abl.median)}`
    + `   R1 ${sec(M.small.R1.median)}`);
  log(`      the ablation recovers ${(A.av1 * 100).toFixed(1)}% of the R0-to-R1 gap`
    + `   (more than half was registered)   ${A.verdict.AV1}${tag}`);

  log('\n--- AV2  R1 over R0: what the representation buys ---');
  log(`      R1 is ${A.av2.toFixed(2)}x R0 on the benchmark`
    + `   (registered band [${A.band.av2.join(', ')}])   ${A.verdict.AV2}${tag}`);

  log('\n--- AV3  R2 over R1: what WebAssembly buys ---');
  log(`      R2 ${sec(M.small.R2.median)}   R2 is ${A.av3.toFixed(2)}x R1 on the benchmark`
    + `   (registered band [${A.band.av3.join(', ')}])   ${A.verdict.AV3}${tag}`);

  log('\n--- AV4  the same ratio at 2.8x the size ---');
  log(`      leafmid: R1 ${sec(M.big.R1.median)}   R2 ${sec(M.big.R2.median)}`
    + `   R2 is ${A.av3big.toFixed(2)}x R1`);
  log(`      the two ratios separate by ${A.av4.toFixed(2)}`
    + `   (refuted at ${A.band.av4} or more)   ${A.verdict.AV4}${tag}`);
  log('\n' + line);
  return A;
}

/**
 * Everything the record needs, and nothing that cannot be written down: the
 * medians, every raw repetition behind them, the ratios, the bands they are
 * scored against, the checksums, what the gate compared, and WHICH MACHINE. The
 * registration says the seconds in `Y1` and `E1` are other hardware and are not a
 * baseline for anything here, which cuts both ways -- these seconds are this
 * machine's and the manifest has to say so.
 */
function summary(A) {
  const os = require('os');
  const t = x => ({ median_seconds: Number(x.median.toFixed(4)),
    repetitions_kept: x.kept, all_seconds: x.all.map(v => Number(v.toFixed(4))),
    checksum: x.checksum });
  const g = name => {
    const { g: gate, p, divergences } = A.gate[name];
    return { divergences, rows: gate.rows, node_values: gate.values,
      refusals_matched: gate.threwBoth, pass_cases: p.checked,
      pass_never_settling: p.never };
  };
  return {
    machine: { node: process.version, platform: process.platform,
      cpu: (os.cpus()[0] || {}).model },
    pairs: A.pairs,
    repetitions: A.reps,
    gate: {
      networks: A.gate.R1.g.groups,
      states_seen: [...A.gate.R1.g.coverage].map(x => (typeof x === 'string' ? x : String(x))).sort(),
      R0abl: g('R0abl'), R1: g('R1'), R2: g('R2'),
    },
    seconds: {
      R0: t(A.M.small.R0), R0_ablated: t(A.M.small.R0abl),
      R1: t(A.M.small.R1), R2: t(A.M.small.R2),
      leafmid_R1: t(A.M.big.R1), leafmid_R2: t(A.M.big.R2),
    },
    av1_fraction_of_gap_recovered: Number(A.av1.toFixed(4)),
    av1_threshold: A.band.av1,
    av2_r1_over_r0: Number(A.av2.toFixed(3)),
    av2_band: A.band.av2,
    av3_r2_over_r1: Number(A.av3.toFixed(3)),
    av3_band: A.band.av3,
    av4_r2_over_r1_leafmid: Number(A.av3big.toFixed(3)),
    av4_separation: Number(A.av4.toFixed(3)),
    av4_refuted_at: A.band.av4,
    verdict: A.verdict,
  };
}

if (MAIN) {
  report(process.argv.slice(2)).then(A => {
    // `--json` prints the record IN THE SAME PROCESS that produced the report, so
    // a number in the manifest is the number that was printed and not one retyped
    // from a terminal.
    if (process.argv.includes('--json')) {
      console.log('\n----- RECORD -----');
      console.log(JSON.stringify(summary(A), null, 2));
    }
  }).catch(e => { console.error(e); process.exit(1); });
}

module.exports = {
  report, runAudit, summary, registeredBands, makeR2, solveAblated, packedFor, R0, R0ABL, R1, R2,
  gateGroups, refusalCases, runGate, passAgreement, seedPatterns,
  tableFamily, binaryTableFamily, benchPairs, sweepObject, sweepPackedR1,
  interleaved, measure, pairCodes, sweepWasmR2, BENCH_PAIRS, BENCH_REPS, OUTS, ADDER_IN,
};
