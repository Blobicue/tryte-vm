'use strict';
/* HEADROOM AUDIT — can the model carry a machine, and what would charge
 * retention cost?
 *
 * The design phase left two questions at the top of the research queue, and both
 * decide whether the unbuilt machine is buildable at all rather than merely
 * designable. This answers both, plus a claim this project made about its own
 * solver and never checked.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED. Established while setting this up:
 *
 *   - solve() builds its adjacency index once per call, then per pass evaluates
 *     conduction once per device and runs six reachability walks. Every one of
 *     those is linear in the device count. Read from the source, not measured;
 *     the shape of the algorithm is the basis for H1 rather than a result.
 *   - the largest network solved anywhere in this repository so far is 1,776
 *     devices, in the doubly-restored six-trit adder.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   H1  THE SOLVER IS LINEAR, AND THIS PROJECT HAS SAID OTHERWISE IN WRITING.
 *       `design/04-device-model.md` and `design/11-open.md` both assert that the
 *       solver is "superlinear in practice". That was PROPOSED and never checked.
 *       From the algorithm it should be O(devices x passes): the index is built
 *       once, and each pass costs one conduction sweep plus six walks, all linear.
 *
 *       Predicted: across networks spanning roughly 10 to 50,000 devices at fixed
 *       pass depth, the time per device-pass stays within a factor of 3 of
 *       constant, and a log-log fit gives an exponent between 1.0 and 1.2. If it
 *       holds, two design documents are wrong and get corrected.
 *
 *   H2  SO THE MACHINE IS SIMULATABLE, AND WHAT IS LOST IS SWEEPING IT.
 *       Predicted: a 50,000-device network solves in under one second per solve
 *       at modest pass depth. A machine can therefore be RUN. But the exhaustive
 *       531,441-pair sweep that every circuit result in this repository rests on
 *       would take over ten hours at that size, so it is not available.
 *
 *       Registered as the useful output: the largest device count at which a full
 *       531,441-pair sweep still fits in one hour. That number is the boundary of
 *       this project's own method, in devices.
 *
 *   H3  CHARGE RETENTION CHANGES NOTHING IN THE EXISTING CORPUS.
 *       Retention means an isolated node keeps its last value instead of floating.
 *       But every circuit here is solved from a cold all-Z start, and a node with
 *       no previous value is Z under either semantics. The two rules can only
 *       diverge where a node is driven on one pass and isolated on a later one.
 *
 *       Predicted: over every gate and every input, and over the six-trit adder
 *       on a sampled sweep, ZERO resolved values differ between retaining and
 *       floating. Genuinely at risk — gate internals change drive status as the
 *       iteration proceeds, and one node driven then isolated mid-solve would
 *       falsify it.
 *
 *   H4  AND IT MAKES STORAGE NEARLY FREE, WHICH IS WHY IT MATTERS.
 *       Predicted: under retention a single pass gate onto an isolated node holds
 *       all three trits across a seeded solve, at ONE switch against the nineteen
 *       the loop-breaking cell costs. Which would take the 729-word memory from
 *       roughly 48,000 switches to roughly 4,400, and the machine from ~51,000 to
 *       under 8,000 — the factor-of-five the design phase said this decision was
 *       worth, and probably more.
 * ------------------------------------------------------------------------------
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const D = require('../src/device.js');

const line = '='.repeat(78);
console.log('HEADROOM AUDIT — can this model carry a machine?\n');

/** A wide MIN datapath: 8 devices per slice, pass depth independent of width. */
function wideMin(slices) {
  const net = new D.Net();
  for (let i = 0; i < slices; i++) D.tmin(net, `a${i}`, `b${i}`, `o${i}`);
  const inputs = {};
  for (let i = 0; i < slices; i++) { inputs[`a${i}`] = 1; inputs[`b${i}`] = 0; }
  return { net, inputs };
}
const timeSolve = (net, inputs, reps) => {
  net.solve(inputs);                                   // warm
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < reps; i++) net.solve(inputs);
  return Number(process.hrtime.bigint() - t0) / 1e6 / reps;
};
const passesOf = (net, inputs) => {
  for (let k = 1; k <= 200; k++) {
    try { net.solve(inputs, k); return k; } catch (e) { /* not yet */ }
  }
  return null;
};

console.log('--- H1  is the solver linear in devices x passes? ---');
const scale = [];
{
  console.log('      slices    devices   passes      ms/solve   ns per device-pass');
  for (const slices of [1, 8, 64, 512, 2048, 6250]) {
    const { net, inputs } = wideMin(slices);
    const d = net.devices.length;
    const p = passesOf(net, inputs);
    const reps = d > 20000 ? 3 : d > 2000 ? 20 : 200;
    const ms = timeSolve(net, inputs, reps);
    const per = (ms * 1e6) / (d * p);
    scale.push({ d, p, ms, per });
    console.log(`      ${String(slices).padStart(6)}   ${String(d).padStart(8)}`
      + `   ${String(p).padStart(6)}   ${ms.toFixed(3).padStart(11)}   ${per.toFixed(1).padStart(18)}`);
  }
  const pers = scale.map(s => s.per);
  const spread = Math.max(...pers) / Math.min(...pers);
  const first = scale[0], last = scale[scale.length - 1];
  const exponent = Math.log(last.ms / first.ms) / Math.log(last.d / first.d);
  console.log(`      spread in ns per device-pass: ${spread.toFixed(2)}x   (predicted under 3)`);
  console.log(`      log-log exponent over the whole range: ${exponent.toFixed(3)}`
    + `   (predicted 1.0 to 1.2)`);
  console.log(`      ${exponent < 1.2 ? 'LINEAR — the design documents saying otherwise are wrong'
    : 'superlinear, as the design documents claimed'}`);
}

console.log('\n--- H2  what is simulatable, and what is sweepable ---');
{
  const big = scale[scale.length - 1];
  console.log(`      largest measured: ${big.d.toLocaleString()} devices at ${big.ms.toFixed(1)} ms/solve`);
  const per = big.ms / big.d;
  const at = n => n * per;
  for (const n of [1776, 50000]) {
    console.log(`      ${String(n).toLocaleString().padStart(7)} devices -> ${at(n).toFixed(1)} ms/solve`
      + `   full 531,441-pair sweep: ${(at(n) * 531441 / 3.6e6).toFixed(1)} hours`);
  }
  // The boundary of this project's own method, in devices.
  const oneHourMs = 3.6e6;
  const budget = oneHourMs / 531441;
  const maxDevices = Math.floor(budget / per);
  console.log(`      a 531,441-pair sweep fits in one hour up to ~${maxDevices.toLocaleString()} devices`);
  console.log(`      the six-trit adder is 624; the machine is ~50,000.`);
  console.log(`      So the machine can be RUN and cannot be SWEPT, which is the boundary`);
  console.log(`      of the exhaustive discipline every result here rests on.`);
}

console.log('\n--- H3, H4  charge retention: what it breaks, and what it buys ---');
{
  // A retaining solver, built by patching the one rule that decides an isolated
  // node's value. Everything else is untouched.
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'device.js'), 'utf8');
  const FROM = "        if (pos.length === 0) next = 'Z';";
  const TO = "        if (pos.length === 0) next = value[nm];";
  if (!SRC.includes(FROM)) {
    console.log('      CANNOT PATCH — the isolation rule is not where this expects it.');
    console.log('      Refusing to guess; H3 and H4 are unmeasured this run.');
  } else {
    const file = path.join(os.tmpdir(), `tryte-retain-${process.pid}.js`);
    fs.writeFileSync(file, SRC.replace(FROM, TO));
    const R = require(file);
    try {
      const L = [-1, 0, 1];
      const GATES = [
        ['STI', 1, D.sti, R.sti], ['NTI', 1, D.nti, R.nti], ['PTI', 1, D.pti, R.pti],
        ['MIN', 2, D.tmin, R.tmin], ['MAX', 2, D.tmax, R.tmax],
      ];
      let rows = 0, differ = 0, firstDiff = '';
      for (const [name, arity, base, ret] of GATES) {
        const ins = arity === 1 ? L.map(a => ({ a })) : L.flatMap(a => L.map(b => ({ a, b })));
        for (const r of ins) {
          const nb = new D.Net(); const nr = new R.Net();
          if (arity === 1) { base(nb, 'a', 'o'); ret(nr, 'a', 'o'); }
          else { base(nb, 'a', 'b', 'o'); ret(nr, 'a', 'b', 'o'); }
          const sb = nb.solve(r), sr = nr.solve(r);
          for (const k of new Set([...Object.keys(sb), ...Object.keys(sr)])) {
            rows++;
            if (sb[k] !== sr[k]) { differ++; if (!firstDiff) firstDiff = `${name} ${JSON.stringify(r)} node ${k}: ${sb[k]} vs ${sr[k]}`; }
          }
        }
      }
      console.log(`      gates: ${differ} of ${rows} resolved node values differ   (predicted 0)`);
      if (firstDiff) console.log(`        first: ${firstDiff}`);

      // The adder, sampled — the largest circuit with internal nodes that change
      // drive status as the iteration proceeds.
      const T = require('../src/ternary.js');
      const spread = (nm, v) => Object.fromEntries(T.toTrits(v).map((t, i) => [`${nm}${i}`, t]));
      const ab = new D.Net(); D.tRippleAdder(ab, 6);
      const ar = new R.Net(); R.tRippleAdder(ar, 6);
      let n = 0, adderDiff = 0;
      for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += 29) {
        for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += 29) {
          const inp = { ...spread('a', a), ...spread('b', b), cin: 0 };
          const sb = ab.solve(inp), sr = ar.solve(inp);
          for (const k of Object.keys(sb)) { n++; if (sb[k] !== sr[k]) adderDiff++; }
        }
      }
      console.log(`      adder: ${adderDiff} of ${n.toLocaleString()} node values differ`
        + `   (predicted 0)`);

      // H4 — the dynamic cell.
      const cell = new R.Net();
      cell.n('we', R.HIGH, 'dsrc', 'q');            // one pass gate
      R.tBuffer(cell, 'din', 'dsrc', 'B');          // rail-driven source
      const wrote = [];
      for (const v of L) {
        const w = cell.solve({ we: 1, din: v });
        wrote.push(w.q);
      }
      console.log(`      dynamic cell, write phase: ${wrote.join(' ')}   (want -1 0 1)`);
      const held = [];
      for (const v of L) {
        const c2 = new R.Net();
        c2.n('we', R.HIGH, 'dsrc', 'q');
        R.tBuffer(c2, 'din', 'dsrc', 'B');
        const nodes = new Set();
        for (const d of c2.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
        const driven = new Set(['vss', 'vmid', 'vdd', 'we', 'din']);
        const init = {};
        for (const x of nodes) if (!driven.has(x)) init[x] = 'Z';
        init.q = v;
        let r; try { r = c2.solve({ we: -1, din: 0 }, 64, init).q; } catch (e) { r = 'no settle'; }
        held.push(r);
      }
      console.log(`      dynamic cell, hold phase:  ${held.join(' ')}   (want -1 0 1)`);
      const one = new R.Net(); one.n('we', R.HIGH, 'dsrc', 'q');
      console.log(`      cost: ${one.cost().switches} switch for the cell itself,`
        + ` against 19 for the loop-breaking one`);
      const cells = 729 * 6;
      console.log(`      729 words x 6 trits: ${(cells * 1).toLocaleString()} against`
        + ` ${(cells * 11).toLocaleString()} switches`);
    } finally {
      delete require.cache[require.resolve(file)];
      fs.unlinkSync(file);
    }
  }
}

console.log('\n' + line);
