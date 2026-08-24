'use strict';
/* DEVICE AUDIT — does the machine's arithmetic hold up when built from switches?
 *
 * Everything else in this repository starts at src/ternary.js and works upward.
 * This works DOWNWARD from it: builds MIN, MAX and NEG out of threshold switches
 * in src/device.js, assembles them into six-trit datapaths, and checks the result
 * against the same functions the other 414 tests are written against.
 *
 * SWITCH-LEVEL, NOT SPICE. See the header of src/device.js for what this model
 * assumes away — chiefly that the middle rail is free, which is the single
 * largest thing a real ternary device has to pay for.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED, because it was established while designing the gates and
 * registering it now would be backdating: the standard ternary inverter computes
 * NEG on all three inputs, MIN and MAX are correct on all nine rows, and the
 * switch counts are STI 4, NTI 2, PTI 2, MIN 8, MAX 8.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   W1  Six per-trit gates wired side by side compute the six-trit function.
 *       Exhaustively: the assembled MIN and MAX agree with T.tMIN and T.tMAX over
 *       all 531,441 operand pairs, and the assembled NEG with T.neg over all 729
 *       values. At risk because nothing about a correct one-trit gate guarantees
 *       a correct assembly — shared node names and rail contention between slices
 *       are exactly the sort of thing that works per-gate and fails in parallel.
 *
 *   W2  Gates compose. The output of one pass network drives the input of the
 *       next without degrading: STI feeding MIN computes MIN(NEG(a), b) on all
 *       nine inputs. Genuinely at risk — pass-network output driving pass-network
 *       input is where switch-level models produce half-driven nodes, and this
 *       model has no restoration to hide behind.
 *
 *   W3  At equal representable range the naive switch count will FAVOUR ternary,
 *       and that number should not be believed. Six trits hold 729 values and
 *       need ten bits to match, so the ternary datapath gets fewer, wider slices.
 *       The prediction is that the raw ratio comes out below 1.0 — and that the
 *       mid-rail column, reported separately, is where the cost this model hands
 *       out for free actually sits. If the raw ratio favours ternary while the
 *       mid-rail count is non-zero, the honest reading is that the comparison is
 *       incomplete, not that ternary wins.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

const line = '='.repeat(78);
console.log('DEVICE AUDIT — switch-level. Not SPICE. The mid rail is free here, and is not free in silicon.\n');

/* --- assemblies ------------------------------------------------------------- */

/** Six per-trit gates side by side, one per position, sharing only the rails. */
function wideBinaryGate(build) {
  const net = new D.Net();
  for (let i = 0; i < 6; i++) build(net, `a${i}`, `b${i}`, `o${i}`);
  return net;
}
function wideUnaryGate(build) {
  const net = new D.Net();
  for (let i = 0; i < 6; i++) build(net, `a${i}`, `o${i}`);
  return net;
}
const spread = (name, v) => Object.fromEntries(T.toTrits(v).map((t, i) => [`${name}${i}`, t]));
const gather = sol => T.fromTrits(Array.from({ length: 6 }, (_, i) => sol[`o${i}`]));

console.log('--- W1  six slices compute the six-trit function ---');
{
  const cases = [['MIN', D.tmin, T.tMIN], ['MAX', D.tmax, T.tMAX]];
  for (const [name, build, ref] of cases) {
    const net = wideBinaryGate(build);
    let bad = null, n = 0;
    for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX && !bad; a++) {
      for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b++) {
        n++;
        const got = gather(net.solve({ ...spread('a', a), ...spread('b', b) }));
        if (got !== ref(a, b)) { bad = `${a},${b}: ${got} vs ${ref(a, b)}`; break; }
      }
    }
    console.log(`      ${name} over ${n.toLocaleString()} pairs: ${bad ? 'FAILS ' + bad : 'exact'}`);
  }
  const negNet = wideUnaryGate(D.sti);
  let bad = null;
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a++) {
    const got = gather(negNet.solve(spread('a', a)));
    if (got !== T.neg(a)) { bad = `${a}: ${got} vs ${T.neg(a)}`; break; }
  }
  console.log(`      NEG over 729 values: ${bad ? 'FAILS ' + bad : 'exact'}`);
}

console.log('\n--- W2  gates compose without degrading ---');
{
  const net = new D.Net();
  D.sti(net, 'a', 'na');            // NEG(a)
  D.tmin(net, 'na', 'b', 'o');      // MIN(NEG(a), b)
  let bad = null;
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) {
    const got = net.solve({ a, b }).o;
    const want = Math.min(-a, b);
    if (got !== want) bad = `${a},${b}: ${got} vs ${want}`;
  }
  console.log(`      STI -> MIN on all nine inputs: ${bad ? 'FAILS ' + bad : 'exact'}`);
  console.log(`      chain cost: ${JSON.stringify(net.cost())}`);
}

console.log('\n--- W3  switch count at equal representable range ---');
{
  const tern = wideBinaryGate(D.tmin).cost();
  // Ten bits hold 1024 values, the smallest power of two at or above 729.
  const bin = (() => {
    const net = D.binaryNet();
    for (let i = 0; i < 10; i++) D.bAnd(net, `a${i}`, `b${i}`, `o${i}`);
    return net.cost();
  })();
  console.log(`      ternary MIN, 6 trits  (729 values):  ${tern.switches} switches,`
    + ` ${tern.midRailConnections} mid-rail connections, ${tern.rails} rails`);
  console.log(`      binary  AND, 10 bits (1024 values):  ${bin.switches} switches,`
    + ` ${bin.midRailConnections} mid-rail connections, ${bin.rails} rails`);
  const ratio = tern.switches / bin.switches;
  console.log(`      raw ratio ${ratio.toFixed(2)}   ${ratio < 1 ? 'favours ternary, as predicted' : 'favours binary'}`);
  console.log(`      W3 also predicted this number should not be believed:`);
  console.log(`      the ternary side needs ${tern.midRailConnections} taps on a rail this model`);
  console.log(`      hands out free, and the binary side needs none. The earlier radix-economy`);
  console.log(`      bar was 3.08x per DIGIT; switch count per gate is a different currency and`);
  console.log(`      does not settle it.`);
}
console.log(line);
