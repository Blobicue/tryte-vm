'use strict';
/* AXIOM AUDIT — the foundations of src/device.js, put at risk.
 *
 * src/device.js states eighteen axioms and theorems (D1-D6, N1-N8, T1-T4).
 * test/test-axioms.js proves each of them. This tool does the other job: it asks
 * whether the axioms are LOAD-BEARING and whether they are TRUE AS WORDED. An
 * axiom nothing depends on is decoration, and a proof that a gate works does not
 * tell you which axiom the gate was leaning on.
 *
 * The method is the one used everywhere else in this repository: break the model
 * on purpose and see what stops working. If nothing stops working, the axiom was
 * not doing anything.
 *
 * SWITCH-LEVEL, NOT SPICE. See the header of src/device.js.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   X1  D3 (INCLUSIVE THRESHOLD) IS LOAD-BEARING. Make the thresholds strict and
 *       the gates stop working. On this integer domain a strict n(t) is exactly an
 *       inclusive n(t+1), and a strict n(HIGH) can never conduct, which in this
 *       model is indistinguishable from the device being absent. So the mutation
 *       is a transformation of the device list, not a patch to the solver.
 *
 *       Three mutations: n-types only, p-types only, both. Registered numbers,
 *       DERIVED BY HAND before the run — the run checks the derivation, and the
 *       derivation is the thing at risk:
 *
 *         mutation     gates still computing their function (of 5)   rows still
 *                                                                   producing a
 *                                                                   level (of 27)
 *         n strict                    0                                  11
 *         p strict                    0                                  11
 *         both strict                 0                                   2
 *
 *       The row counts are the interesting half. "Everything breaks" is cheap;
 *       "everything breaks, and here is exactly how much of the output goes
 *       floating rather than merely wrong" is a claim that can be off by one.
 *
 *   X2  N8: THE FIXED POINT IS NOT UNIQUE, AND Z-INIT IS NOT X-INIT-IN-DISGUISE.
 *       Two predictions, one of which is a correction of an earlier draft of N8
 *       that claimed the solver settles on the most determined consistent
 *       assignment. It does not.
 *
 *       (a) The standard ternary inverter wired to its own input has at least two
 *           fixed points. From the default start it resolves to X. Seeded at MID
 *           it stays at MID — and MID is fully determined and fully consistent, so
 *           the solver is choosing the JUSTIFIED assignment, not the most
 *           determined one. Predicted: exactly one of the three seeds {-1, 0, +1}
 *           is self-consistent, namely 0.
 *
 *       (b) Seeding every non-driven node to 'X' gives results identical to the
 *           default Z start, for every gate and every input. Not because init does
 *           not matter — (a) says it does — but because `conducts` maps Z and X
 *           alike to 'unknown', so the two starts are the same state as far as any
 *           gate can tell. Predicted: identical on all 27 gate rows. This is the
 *           prediction most likely to be wrong, because it is a claim about a
 *           conflation rather than about a circuit.
 *
 *   X3  T3 (COMPOSITION) HOLDS FOR EVERY WIRING, not just the one already tested.
 *       Twenty-five composites: each unary into each unary (9), each unary into
 *       each argument of each binary (12), each binary into each binary (4). The
 *       composed network's table must equal the composition of the component
 *       tables, and the LINKING node must carry a level on every input — a pass
 *       network driving a pass network is where switch-level models produce
 *       half-driven nodes, and this one has no restoration to hide behind.
 *       Predicted: 25 of 25, with no linking node ever X or Z.
 *
 *   X4  THE SERIES MID PATH IS NOT REDUNDANT. The standard ternary inverter costs
 *       four switches because its middle level comes from a SERIES pair. Replace
 *       that pair with any single device between vmid and the output and the gate
 *       should break. There are six candidates, not twelve, because D4 says the
 *       terminals are interchangeable — and that halving is itself checked here by
 *       building both orders and requiring identical tables.
 *       Predicted: 0 of 6 work, and 6 of 6 order-pairs agree.
 *
 *   X5  FOUR SWITCHES IS MINIMAL FOR NEG IN THIS MODEL. Exhaustive search over
 *       every network of at most three switches whose gates are all the input and
 *       whose terminals are drawn from {vss, vmid, vdd, out, m}. Rail-to-rail
 *       devices are excluded from the search space because they are inert here —
 *       reachability stops at driven nodes, so an edge between two rails cannot
 *       change any node's value. That leaves 42 device types.
 *       Predicted: 0 networks of 3 switches compute NEG.
 *
 *       A search that finds nothing proves nothing unless it can find something,
 *       so the same search runs at 4 switches as a POSITIVE CONTROL. Predicted:
 *       at least one network found, and the standard ternary inverter among them.
 *       Not predicted, and reported as measured: how many others there are.
 * ------------------------------------------------------------------------------
 */

const D = require('../src/device.js');

const line = '='.repeat(78);
console.log('AXIOM AUDIT — breaking src/device.js on purpose, to find out what was holding it up.\n');

/* --- the five gates, and their reference functions -------------------------- */

const GATES = [
  { name: 'STI', arity: 1, build: D.sti, ref: a => -a },
  { name: 'NTI', arity: 1, build: D.nti, ref: a => (a === -1 ? 1 : -1) },
  { name: 'PTI', arity: 1, build: D.pti, ref: a => (a === 1 ? -1 : 1) },
  { name: 'MIN', arity: 2, build: D.tmin, ref: (a, b) => Math.min(a, b) },
  { name: 'MAX', arity: 2, build: D.tmax, ref: (a, b) => Math.max(a, b) },
];
const L = [-1, 0, 1];
const isLevel = v => v === -1 || v === 0 || v === 1;

/** Build a gate into a fresh net, with the conventional node names. */
function gateNet(g) {
  const net = new D.Net();
  if (g.arity === 1) g.build(net, 'a', 'o'); else g.build(net, 'a', 'b', 'o');
  return net;
}
/** Every input assignment for a gate, as a list of input maps. */
function rowsOf(g) {
  return g.arity === 1 ? L.map(a => ({ a })) : L.flatMap(a => L.map(b => ({ a, b })));
}
const want = (g, r) => (g.arity === 1 ? g.ref(r.a) : g.ref(r.a, r.b));

/* --- X1 --------------------------------------------------------------------- */

/**
 * Strict thresholds, as a transformation of the device list.
 *   strict n(t)  is  inclusive n(t+1);  n(HIGH) strict never conducts.
 *   strict p(t)  is  inclusive p(t-1);  p(LOW)  strict never conducts.
 * A device that never conducts is rejected by both the definite and the possible
 * reachability predicates, which is exactly what happens to a device that is not
 * there — so dropping it is not an approximation.
 */
function strictify(net, which) {
  const out = new D.Net(net.rails);
  for (const d of net.devices) {
    if (!(which === 'both' || which === d.kind)) { out.devices.push({ ...d }); continue; }
    const vt = d.kind === 'n' ? d.vt + 1 : d.vt - 1;
    if (vt > D.HIGH || vt < D.LOW) continue;
    out.devices.push({ ...d, vt });
  }
  return out;
}

console.log('--- X1  is the inclusive threshold (D3) load-bearing? ---');
{
  console.log('      mutation      gates correct   rows with a level   which gates survive');
  for (const which of ['n', 'p', 'both']) {
    let correct = 0, levels = 0; const survivors = [];
    for (const g of GATES) {
      const net = strictify(gateNet(g), which);
      let ok = true;
      for (const r of rowsOf(g)) {
        const got = net.solve(r).o;
        if (isLevel(got)) levels++;
        if (got !== want(g, r)) ok = false;
      }
      if (ok) { correct++; survivors.push(g.name); }
    }
    const label = (which === 'both' ? 'both strict' : `${which} strict`).padEnd(11);
    console.log(`      ${label}        ${String(correct).padStart(2)} of 5`
      + `         ${String(levels).padStart(2)} of 27`
      + `           ${survivors.length ? survivors.join(' ') : 'none'}`);
  }
}

/* --- X2 --------------------------------------------------------------------- */

console.log('\n--- X2  N8: the fixed point is not unique, and Z-init is not X-init in disguise ---');
{
  const self = new D.Net(); D.sti(self, 'o', 'o');
  const internals = new Set();
  for (const d of self.devices) { internals.add(d.a); internals.add(d.b); }
  for (const rail of Object.keys(self.rails)) internals.delete(rail);

  console.log(`      self-inverter, default start:  o = ${self.solve({}).o}`);
  const stable = [], oscillating = [];
  for (const seed of L) {
    const init = Object.fromEntries([...internals].map(n => [n, n === 'o' ? seed : 'Z']));
    let got;
    // A seeded start can fail to settle at all, which the registration did not
    // anticipate. Measuring that is not the same as revising the prediction.
    try { got = self.solve({}, 64, init).o; }
    catch (e) { got = 'DOES NOT SETTLE'; oscillating.push(seed); }
    console.log(`      seeded at ${String(seed).padStart(2)}:                   o = ${got}`
      + (got === seed ? '   <- self-consistent' : ''));
    if (got === seed) stable.push(seed);
  }
  console.log(`      self-consistent seeds: [${stable.join(', ')}]  (predicted exactly [0])`);
  console.log(`      seeds that never settle: [${oscillating.join(', ')}]  (not predicted at all)`);
  if (oscillating.length) {
    console.log('      X2a FAILED -- not on its answer but on its premise. It assumed every seed');
    console.log('      resolves to something. N7 said "X is absorbing, so resolution cannot');
    console.log('      oscillate", full stop. That holds only from the all-Z start, where a node');
    console.log('      on a gate CYCLE never gets a determined gate and so lands on X and stays.');
    console.log('      Seeded at a LEVEL the self-inverter runs -1 -> +1 -> -1 forever. N7 was');
    console.log('      false as worded, and has been reworded to say which half is true.');
  }

  let differ = 0, rows = 0;
  for (const g of GATES) {
    const net = gateNet(g);
    const nodes = new Set();
    for (const d of net.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
    for (const r of rowsOf(g)) {
      const driven = new Set([...Object.keys(net.rails), ...Object.keys(r)]);
      const init = Object.fromEntries([...nodes].filter(n => !driven.has(n)).map(n => [n, 'X']));
      rows++;
      if (net.solve(r).o !== net.solve(r, 64, init).o) differ++;
    }
  }
  console.log(`      X-init vs Z-init: ${differ} of ${rows} gate rows differ  (predicted 0)`);
}

/* --- X3 --------------------------------------------------------------------- */

console.log('\n--- X3  T3: composition, over every wiring ---');
{
  const unary = GATES.filter(g => g.arity === 1);
  const binary = GATES.filter(g => g.arity === 2);
  const composites = [];

  for (const f of unary) for (const h of unary) {
    composites.push({
      name: `${f.name} -> ${h.name}`,
      build: net => { f.build(net, 'a', 'm'); h.build(net, 'm', 'o'); },
      ins: L.map(a => ({ a })),
      ref: r => h.ref(f.ref(r.a)),
    });
  }
  for (const f of unary) for (const h of binary) for (const pos of [0, 1]) {
    composites.push({
      name: `${f.name} -> ${h.name} arg${pos}`,
      build: net => {
        f.build(net, 'a', 'm');
        if (pos === 0) h.build(net, 'm', 'b', 'o'); else h.build(net, 'b', 'm', 'o');
      },
      ins: L.flatMap(a => L.map(b => ({ a, b }))),
      ref: r => (pos === 0 ? h.ref(f.ref(r.a), r.b) : h.ref(r.b, f.ref(r.a))),
    });
  }
  for (const f of binary) for (const h of binary) {
    composites.push({
      name: `${f.name} -> ${h.name}`,
      build: net => { f.build(net, 'a', 'b', 'm'); h.build(net, 'm', 'c', 'o'); },
      ins: L.flatMap(a => L.flatMap(b => L.map(c => ({ a, b, c })))),
      ref: r => h.ref(f.ref(r.a, r.b), r.c),
    });
  }

  let held = 0, degraded = 0; const broken = [];
  for (const c of composites) {
    const net = new D.Net(); c.build(net);
    let ok = true;
    for (const r of c.ins) {
      const sol = net.solve(r);
      if (sol.o !== c.ref(r)) ok = false;
      if (!isLevel(sol.m)) degraded++;
    }
    if (ok) held++; else broken.push(c.name);
  }
  console.log(`      ${held} of ${composites.length} composites compute the composition`
    + `${broken.length ? '   BROKEN: ' + broken.join(', ') : ''}`);
  console.log(`      linking node degraded to X or Z on ${degraded} input rows  (predicted 0)`);
}

/* --- X4 --------------------------------------------------------------------- */

console.log('\n--- X4  is the series mid path redundant? ---');
{
  /** The standard ternary inverter with its series mid pair replaced by one device. */
  const oneDevice = (kind, vt, flip) => {
    const net = new D.Net();
    net.p('a', D.LOW, 'vdd', 'o');
    net.n('a', D.HIGH, 'vss', 'o');
    const [x, y] = flip ? ['o', 'vmid'] : ['vmid', 'o'];
    net[kind]('a', vt, x, y);
    return net;
  };
  const tableOf = net => L.map(a => net.solve({ a }).o).join(' ');
  const negTable = L.map(a => -a).join(' ');

  let works = 0, agree = 0; const rows = [];
  for (const kind of ['n', 'p']) for (const vt of L) {
    const t0 = tableOf(oneDevice(kind, vt, false));
    const t1 = tableOf(oneDevice(kind, vt, true));
    if (t0 === t1) agree++;
    if (t0 === negTable) works++;
    rows.push(`      ${kind}(${String(vt).padStart(2)}) vmid-out: [${t0}]`
      + `   reversed: [${t1}]   ${t0 === t1 ? 'same' : 'DIFFER'}`
      + `   ${t0 === negTable ? '<- computes NEG' : ''}`);
  }
  rows.forEach(r => console.log(r));
  console.log(`      single-device mid paths that work: ${works} of 6   (predicted 0)`);
  console.log(`      terminal orders that agree (D4):   ${agree} of 6   (predicted 6)`);
}

/* --- X5 --------------------------------------------------------------------- */

console.log('\n--- X5  is four switches minimal for NEG? ---');
{
  const NODES = ['vss', 'vmid', 'vdd', 'out', 'm'];
  const RAIL = new Set(['vss', 'vmid', 'vdd']);
  const SPACE = [];
  for (const kind of ['n', 'p']) for (const vt of L) {
    for (let i = 0; i < NODES.length; i++) for (let j = i + 1; j < NODES.length; j++) {
      if (RAIL.has(NODES[i]) && RAIL.has(NODES[j])) continue;   // inert: reach stops at rails
      SPACE.push({ kind, gate: 'in', vt, a: NODES[i], b: NODES[j] });
    }
  }
  // Terminals are interchangeable (D4), so the key must not care about their
  // order. It did, and the positive control reported the standard ternary
  // inverter ABSENT from a search that had in fact found it. Third time an
  // instrument here produced a false verdict on its own prediction.
  const key = d => { const [x, y] = [d.a, d.b].sort(); return `${d.kind}${d.vt}:${x}-${y}`; };
  const show = devs => devs.map(key).sort().join('  ');

  const NEG = L.map(a => -a);
  const computesNeg = devs => {
    if (!devs.some(d => d.a === 'out' || d.b === 'out')) return false;
    const net = new D.Net(); net.devices = devs;
    try { return L.every((a, i) => net.solve({ in: a }).out === NEG[i]); }
    catch (e) { return false; }
  };

  const search = k => {
    const found = []; const pick = [];
    let tried = 0;
    const rec = start => {
      if (pick.length === k) { tried++; if (computesNeg(pick)) found.push(show(pick)); return; }
      for (let i = start; i < SPACE.length; i++) { pick.push(SPACE[i]); rec(i); pick.pop(); }
    };
    rec(0);
    return { found, tried };
  };

  console.log(`      device space: ${SPACE.length} types`
    + ` (2 kinds x 3 thresholds x ${SPACE.length / 6} terminal pairs, rail-to-rail excluded as inert)`);
  for (const k of [1, 2, 3]) {
    const { found, tried } = search(k);
    console.log(`      ${k} switch${k === 1 ? ' ' : 'es'}: ${tried.toLocaleString().padStart(7)} networks,`
      + ` ${found.length} compute NEG`);
  }
  const { found, tried } = search(4);
  const stiKey = show([
    { kind: 'p', vt: D.LOW, a: 'vdd', b: 'out' },
    { kind: 'n', vt: D.HIGH, a: 'vss', b: 'out' },
    { kind: 'n', vt: D.MID, a: 'vmid', b: 'm' },
    { kind: 'p', vt: D.MID, a: 'm', b: 'out' },
  ]);
  console.log(`      4 switches: ${tried.toLocaleString().padStart(7)} networks,`
    + ` ${found.length} compute NEG   <- POSITIVE CONTROL`);
  console.log(`      the standard ternary inverter is among them: ${found.includes(stiKey)}`);
  if (found.length) {
    console.log('      first few solutions, so the reader can see they are real circuits:');
    for (const f of found.slice(0, 4)) console.log(`        ${f}`);
    if (found.length > 4) console.log(`        ... and ${found.length - 4} more`);
  }
}

console.log('\n' + line);
