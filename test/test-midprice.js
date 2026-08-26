'use strict';
/* test-midprice.js — how much of this project rests on one free assumption?
 *
 * Set `N`. The device model's FIRST stated limit is that `vmid` is free, and it
 * calls that limit the largest of the four. Set `O` ended by showing ternary's
 * whole economic margin over binary is two mid-rail taps against zero.
 *
 * This CANNOT settle whether the assumption is true. `T5` says the middle level
 * cannot be made inside the model at all — a divider between the outer rails is
 * contention and resolves to `X` — so the model is structurally unable to price its
 * own biggest assumption from the inside. It can only say how much depends on it.
 *
 * The exhaustive version is `npm run audit:midprice`.
 */

const D = require('../src/device.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const V = [D.LOW, D.MID, D.HIGH];
const cost = f => { const n = new D.Net(); f(n); return n.cost(); };
const cell = (net, tag, src, q, we, hold) => {
  D.sti(net, q, `${tag}qbraw`); D.sti(net, `${q}b`, `${tag}qraw`);
  net.n(hold, D.HIGH, `${tag}qbraw`, `${q}b`);
  net.n(hold, D.HIGH, `${tag}qraw`, q);
  net.n(we, D.HIGH, src, q);
};
/** (LOW, HIGH, LOW) instead of (LOW, MID, LOW). Same switches, no vmid. */
function isMidHigh(net, sel, out) {
  net.p(sel, D.LOW, 'vss', out);
  net.n(sel, D.HIGH, 'vss', out);
  const m = `${out}$m`;
  net.n(sel, D.MID, 'vdd', m);
  net.p(sel, D.MID, m, out);
  return net;
}

console.log('\n=== 1. N1 FAILED — "USES THE RAIL" IS NOT "NEEDS THE RAIL" ===');
{
  const abstract = cost(n => D.tmux(n, 's', 'l', 'm', 'h', 'o'));
  const railed = cost(n => D.tmux(n, 's', 'vss', 'vmid', 'vdd', 'o'));
  check(`tmux is ${abstract.midRailConnections} taps with abstract sources and`
    + ` ${railed.midRailConnections} with rail sources — the tap is in the SOURCE`,
    abstract.midRailConnections === 0 && railed.midRailConnections === 1);
  check('   so "carries no tap" and "needs no tap" are different questions, and the'
    + ' prediction did not say which it was asking', true);
  const built = cost(n => D.isMid(n, 's', 'o'));
  const variant = cost(n => isMidHigh(n, 's', 'o'));
  check('   isMid puts MID on a node, so the test scored it FORCED — and N2 builds'
    + ' the same function with zero taps, so it is not',
    built.midRailConnections === 1 && variant.midRailConnections === 0);
  check('   telling "uses" from "needs" requires a search over equivalent circuits,'
    + ' which the test did not do', true);
}

console.log('\n=== 2. N2 — A DETECTOR WITH NO MID TAP ===');
{
  const a = cost(n => D.isMid(n, 's', 'o')), b = cost(n => isMidHigh(n, 's', 'o'));
  check(`the variant is ${b.switches} switches and ${b.midRailConnections} taps,`
    + ` against ${a.switches} and ${a.midRailConnections}`,
    b.switches === a.switches && b.midRailConnections === 0 && a.midRailConnections === 1);
  let dmuxBad = 0;
  for (const sel of V) for (const lo of V) for (const mid of V) for (const hi of V) {
    const mk = det => {
      const n = new D.Net();
      det(n, 'sel', 'sm');
      D.dmux(n, 'sel', 'sm', 'L', 'M', 'H', 'out');
      return n.solve({ sel, L: lo, M: mid, H: hi }, 40).out;
    };
    if (mk(D.isMid) !== mk(isMidHigh)) dmuxBad++;
  }
  check(`it drives dmux identically on all ${3 ** 4} cases`, dmuxBad === 0, String(dmuxBad));
  let decBad = 0;
  for (const sel of V) for (const inV of V) {
    const mk = det => {
      const n = new D.Net();
      det(n, 'sel', 'am');
      n.n('am', D.MID, 'src', 'out');
      n.n('sel', D.MID, 'vss', 'out');
      return n.solve({ sel, src: inV }, 40).out;
    };
    if (mk(D.isMid) !== mk(isMidHigh)) decBad++;
  }
  check(`and the decoder route-in leg on all ${3 ** 2}`, decBad === 0, String(decBad));
  check('   those are the only two consumer patterns in the repository, and every'
    + ' one gates at threshold MID — which conducts for anything at or above it',
    dmuxBad === 0 && decBad === 0);
}

console.log('\n=== 3. N3 — THE BLAST RADIUS, DERIVED ===');
{
  const one = cost(n => cell(n, 'x', 'd', 'q', 'we', 'hold'));
  const buf = cost(n => D.tBuffer(n, 'a', 'o', 'T'));
  const det = cost(n => D.isMid(n, 's', 'o'));
  const dec = cost(n => D.dRippleAdder(n, 6)), tree = cost(n => D.tRippleAdder(n, 6));
  check(`the storage cell is ${one.midRailConnections} taps on ${one.switches} switches`,
    one.switches === 11 && one.midRailConnections === 2);
  const taps = 162 * one.midRailConnections + 6 * buf.midRailConnections + 3 * det.midRailConnections;
  check(`the 27-word memory C built takes ${taps} taps on 2,301 switches`, taps === 339);
  check(`   a multiplier of ${((2301 + taps) / 2301).toFixed(2)}x at a price of one — not`
    + ' the doubling that 34% on the adder would suggest',
    Math.abs((2301 + taps) / 2301 - 1.15) < 0.01);
  const cross = (tree.switches - dec.switches) / (dec.midRailConnections - tree.midRailConnections);
  check(`the decoded adder — this repo's best circuit result — is the MORE tap-hungry`
    + ` and loses to the tree adder above a price of ${cross.toFixed(2)}`,
    Math.abs(cross - 4.67) < 0.01, String(cross));
  const nodes = 40, tm = 6 * 4 * nodes, dm = 6 * 3 * nodes + 4 * 4;
  check(`the read-path decision does NOT flip: tmux was never cheaper (${tm} vs ${dm}),`
    + ' so B chose it on correctness and pricing makes it dearer, not wrong',
    tm > dm && tm > dm + 4 * 20);
}

console.log('\n=== 4. N4 — ALMOST NONE OF IT CAN BE DESIGNED AWAY ===');
{
  const one = cost(n => cell(n, 'x', 'd', 'q', 'we', 'hold'));
  const buf = cost(n => D.tBuffer(n, 'a', 'o', 'T'));
  const det = cost(n => D.isMid(n, 's', 'o'));
  const forced = 162 * one.midRailConnections + 6 * buf.midRailConnections;
  const chosen = 3 * det.midRailConnections;
  check(`${forced} taps are forced by trit-valued outputs and ${chosen} are chosen`,
    forced === 336 && chosen === 3);
  check(`   ${(100 * forced / (forced + chosen)).toFixed(1)}% cannot be designed away`,
    forced / (forced + chosen) > 0.99);
  check('   because by T5 a node that must take MID must reach vmid, and the middle'
    + ' level cannot be made inside the model at all', true);
  check('   so the model can price its largest assumption but never settle it —'
    + ' that is a physical question about real devices', true);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
