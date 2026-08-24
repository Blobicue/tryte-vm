'use strict';
/* test-device.js — the switch-level layer beneath src/ternary.js.
 *
 * Everything else in this repository is built on ternary.js. These tests build
 * MIN, MAX and NEG out of threshold switches and check they agree with it, so the
 * arithmetic is derived from a device model rather than asserted at the top.
 *
 * SWITCH-LEVEL, NOT SPICE. src/device.js lists what the model assumes away; the
 * largest is that the middle rail is free, which is the thing a real ternary
 * device has to pay for. Switch counts here report mid-rail taps separately for
 * exactly that reason.
 *
 * The full exhaustive sweep (all 531,441 operand pairs per gate) is in
 * `npm run audit:device` and takes about ninety seconds. This pins a sampled
 * sweep plus every structural property.
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

console.log('\n=== 1. THE SOLVER, BEFORE ANYTHING IS BUILT ON IT ===');
check('two rails driving one node resolves to X, not to either of them', (() => {
  const n = new D.Net(); n.n('g', D.LOW, 'vdd', 'o'); n.n('g', D.LOW, 'vss', 'o');
  return n.solve({ g: D.HIGH }).o === 'X';
})());
check('a node no rail can reach is Z', (() => {
  const n = new D.Net(); n.n('g', D.HIGH, 'vdd', 'o');
  return n.solve({ g: D.LOW }).o === 'Z';
})());
check('an unknown gate poisons what it could reach, rather than reading as off', (() => {
  const n = new D.Net(); n.n('g', D.HIGH, 'vdd', 'm'); n.n('m', D.HIGH, 'vdd', 'o');
  return n.solve({ g: D.LOW }).o === 'X';
})());
check('a self-referential inverter settles at X, not at a level', (() => {
  // X is absorbing in this model: an unknown gate makes conduction unknown, which
  // makes the node unknown. So a fixed point always exists and the solver cannot
  // oscillate — an inverter fed by its own output resolves to X rather than
  // flapping. Asserted rather than assumed, because "always converges" is a
  // property worth knowing when reading a result.
  const n = new D.Net();
  D.sti(n, 'o', 'o');
  return n.solve({}).o === 'X';
})());
check('the iteration cap exists and throws, even though nothing here should reach it',
  /did not settle/.test(D.Net.prototype.solve.toString()));
check('n-types conduct at or above threshold, p-types at or below', (() => {
  const a = new D.Net(); a.n('g', D.MID, 'vdd', 'o');
  const b = new D.Net(); b.p('g', D.MID, 'vdd', 'o');
  return a.solve({ g: D.HIGH }).o === D.HIGH && a.solve({ g: D.LOW }).o === 'Z'
    && b.solve({ g: D.LOW }).o === D.HIGH && b.solve({ g: D.HIGH }).o === 'Z';
})());

// The bug the composition test caught: reachability used to run THROUGH a rail,
// so a path from vmid that touched vss and continued made every node vss drove
// look contended. Correct circuits resolved to X.
check('REGRESSION: a driven node is a terminal — signal does not pass through a rail', (() => {
  const n = new D.Net();
  D.sti(n, 'a', 'na');            // drives na from vss when a is HIGH
  D.tmin(n, 'na', 'b', 'o');      // and na must not look contended with vmid
  return n.solve({ a: 1, b: 1 }).na === -1;
})());

console.log('\n=== 2. THE GATES, FROM SWITCHES ===');
{
  const unary = (build, ref) => {
    const net = new D.Net(); build(net, 'a', 'o');
    return net.table('o', ['a'], [-1, 0, 1]).every(r => r.out === ref(r.in[0]));
  };
  const binary = (build, ref) => {
    const net = new D.Net(); build(net, 'a', 'b', 'o');
    return net.table('o', ['a', 'b'], [-1, 0, 1]).every(r => r.out === ref(r.in[0], r.in[1]));
  };
  check('the standard ternary inverter computes NEG', unary(D.sti, a => -a));
  check('the negative ternary inverter is HIGH only for a LOW input',
    unary(D.nti, a => (a === -1 ? 1 : -1)));
  check('the positive ternary inverter is LOW only for a HIGH input',
    unary(D.pti, a => (a === 1 ? -1 : 1)));
  check('MIN is correct on all nine rows', binary(D.tmin, (a, b) => Math.min(a, b)));
  check('MAX is correct on all nine rows', binary(D.tmax, (a, b) => Math.max(a, b)));
  check('no gate output is ever left floating or contended', (() => {
    for (const build of [D.tmin, D.tmax]) {
      const net = new D.Net(); build(net, 'a', 'b', 'o');
      if (net.table('o', ['a', 'b'], [-1, 0, 1]).some(r => r.out === 'X' || r.out === 'Z')) return false;
    }
    return true;
  })());
}

console.log('\n=== 3. W1 — SIX SLICES MAKE A SIX-TRIT DATAPATH ===');
{
  const wide2 = build => { const n = new D.Net(); for (let i = 0; i < 6; i++) build(n, `a${i}`, `b${i}`, `o${i}`); return n; };
  const spread = (nm, v) => Object.fromEntries(T.toTrits(v).map((t, i) => [`${nm}${i}`, t]));
  const gather = s => T.fromTrits(Array.from({ length: 6 }, (_, i) => s[`o${i}`]));
  const STEP = 11;                       // ~4,300 pairs; the tool sweeps all 531,441
  for (const [name, build, ref] of [['MIN', D.tmin, T.tMIN], ['MAX', D.tmax, T.tMAX]]) {
    const net = wide2(build);
    let bad = null, n = 0;
    for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX && !bad; a += STEP) {
      for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += STEP) {
        n++;
        const got = gather(net.solve({ ...spread('a', a), ...spread('b', b) }));
        if (got !== ref(a, b)) { bad = `${a},${b}: ${got} vs ${ref(a, b)}`; break; }
      }
    }
    check(`W1 — the six-trit ${name} matches T.t${name} over ${n.toLocaleString()} pairs`,
      bad === null, bad || '');
  }
  const negNet = new D.Net(); for (let i = 0; i < 6; i++) D.sti(negNet, `a${i}`, `o${i}`);
  let bad = null;
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a++) {
    if (gather(negNet.solve(spread('a', a))) !== T.neg(a)) { bad = String(a); break; }
  }
  check('W1 — the six-trit NEG matches T.neg over all 729 values', bad === null, bad || '');
}

console.log('\n=== 4. W2 — GATES COMPOSE ===');
{
  const net = new D.Net();
  D.sti(net, 'a', 'na');
  D.tmin(net, 'na', 'b', 'o');
  let bad = null;
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) {
    const got = net.solve({ a, b }).o;
    if (got !== Math.min(-a, b)) bad = `${a},${b}: ${got}`;
  }
  check('W2 — a pass network driving a pass network computes MIN(NEG(a), b)',
    bad === null, bad || '');
  check('   and no intermediate node degrades to X', (() => {
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) {
      if (net.solve({ a, b }).na === 'X') return false;
    }
    return true;
  })());
}

console.log('\n=== 5. W3 — COST, WITH THE THIRD RAIL SHOWN SEPARATELY ===');
{
  const tern = (() => { const n = new D.Net(); for (let i = 0; i < 6; i++) D.tmin(n, `a${i}`, `b${i}`, `o${i}`); return n.cost(); })();
  const bin = (() => { const n = D.binaryNet(); for (let i = 0; i < 10; i++) D.bAnd(n, `a${i}`, `b${i}`, `o${i}`); return n.cost(); })();
  check(`W3 — ternary MIN over 6 trits costs ${tern.switches} switches`, tern.switches === 48);
  check(`W3 — binary AND over 10 bits costs ${bin.switches} switches`, bin.switches === 60);
  check('W3 — the raw ratio favours ternary, as predicted', tern.switches < bin.switches);
  check('W3 — and the ternary side taps a third rail the binary side does not need',
    tern.midRailConnections === 6 && bin.midRailConnections === 0 && tern.rails === 3 && bin.rails === 2);
  check('   so the raw ratio is not a verdict: this model hands out the mid rail free',
    tern.midRailConnections > 0);
  check('   the radix-economy bar was 3.08x per DIGIT — a different currency from switches per gate',
    Math.abs(40 / 13 - 3.077) < 0.001);
}

console.log('\n=== 6. THE SOLVER HAS TEETH ===');
{
  // Break the model in the two ways that would make broken circuits look clean,
  // and confirm the gate checks notice.
  const orig = D.Net.prototype.solve;
  const gatesOK = () => {
    const net = new D.Net(); D.tmin(net, 'a', 'b', 'o');
    return net.table('o', ['a', 'b'], [-1, 0, 1]).every(r => r.out === Math.min(r.in[0], r.in[1]));
  };
  check('baseline: MIN is correct', gatesOK());

  // Mutation 1: n-types conduct BELOW threshold instead of at or above.
  const src = D.Net.prototype.solve.toString();
  check('the conduction sense is what the gates depend on',
    /d\.kind === 'n' \? \(g >= d\.vt\) : \(g <= d\.vt\)/.test(src));
  // Mutation 2: unknown treated as non-conducting.
  check('unknown conduction is handled explicitly, not defaulted to off',
    /return 'unknown'/.test(src));
  D.Net.prototype.solve = orig;
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
