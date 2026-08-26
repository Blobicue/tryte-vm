'use strict';
/* test-nonlinearity.js — ternary is born nonlinear, and it does not pay off.
 *
 * Set `O`. Set `M` showed ternary reaches reversible universality at two operands
 * where binary needs three, and left open whether that is worth anything in
 * switches. It is worth 1.2x — and all of it is borrowed from the free mid rail.
 *
 * The check worth keeping is `O4`: price a mid-rail tap at one switch and the two
 * gates TIE. The device model's first stated limit is that `vmid` is free, and it
 * calls that limit the largest of the four. Every switch of ternary's margin here
 * rests on it.
 *
 * The exhaustive version is `npm run audit:nonlinearity`.
 */

const D = require('../src/device.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const indicatorsAffine = q => {
  const out = [];
  for (let a = 0; a < q; a++) {
    const f = x => (x === a ? 1 : 0);
    let affine = false;
    for (let m = 0; m < q && !affine; m++) {
      for (let c = 0; c < q && !affine; c++) {
        if ([...Array(q).keys()].every(x => (m * x + c) % q === f(x))) affine = true;
      }
    }
    out.push(affine);
  }
  return out;
};

/** The two gates, built in one idiom: rail-driven sources, buffers counted. */
function ternaryC1INC() {
  const net = new D.Net();
  D.tmux(net, 'b', 'vss', 'vmid', 'vdd', 'idb');
  D.tmux(net, 'b', 'vmid', 'vdd', 'vss', 'incb');
  net.n('a', D.HIGH, 'incb', 'out');
  net.p('a', D.MID, 'idb', 'out');
  return net;
}
function binaryToffoli() {
  const net = D.binaryNet();
  D.bInv(net, 'c', 'notc');
  D.bInv(net, 'notc', 'bufc');
  D.bAnd(net, 'a', 'b', 'ab');
  D.bmux(net, 'ab', 'bufc', 'notc', 'out');
  return net;
}

console.log('\n=== 1. O1 — THE ROOT: BORN NONLINEAR AT ONE CONTROL ===');
{
  const bin = indicatorsAffine(2), ter = indicatorsAffine(3);
  check(`all ${bin.length} one-control indicators over GF(2) are affine`,
    bin.every(Boolean), JSON.stringify(bin));
  check(`and none of the ${ter.length} over GF(3) is`, ter.every(x => !x), JSON.stringify(ter));
  check('   so the simplest conditional — act if the control equals a value — is'
    + ' LINEAR in binary and NONLINEAR in ternary', bin.every(Boolean) && ter.every(x => !x));
  check('   restricted to ONE control digit on purpose: the indicator of a single'
    + ' POINT of two binary digits is quadratic too, which is what AND is', (() => {
      // f(x,y) = 1 iff x=1 and y=1 is not affine over GF(2).
      for (let m1 = 0; m1 < 2; m1++) for (let m2 = 0; m2 < 2; m2++) for (let c = 0; c < 2; c++) {
        let ok = true;
        for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
          if ((m1 * x + m2 * y + c) % 2 !== (x === 1 && y === 1 ? 1 : 0)) ok = false;
        }
        if (ok) return false;
      }
      return true;
    })());
}

console.log('\n=== 2. O2 — THE CHEAP TRIGGER IS AN OUTER STATE ===');
{
  const outer = new D.Net(); outer.n('a', D.HIGH, 'src', 'out');
  const middle = new D.Net(); D.isMid(middle, 'a', 'am'); middle.n('am', D.MID, 'src', 'out');
  check(`triggering on an outer state costs ${outer.cost().switches} switch;`
    + ` on the middle, ${middle.cost().switches}`,
    outer.cost().switches === 1 && middle.cost().switches === 5);
  check('   the registration said "two", counting threshold comparisons — the'
    + ' switch cost is five, because the interval needs the whole detector',
    middle.cost().switches === 5);
  check('   same asymmetry C2 found in the decoder: "not MID" cost two pull-downs'
    + ' where "not LOW" and "not HIGH" cost one each', middle.cost().switches > outer.cost().switches);
}

console.log('\n=== 3. O3 — BOTH GATES, ONE IDIOM, T5 ON BOTH SIDES ===');
{
  const t = ternaryC1INC(), b = binaryToffoli();
  const tc = t.cost(), bc = b.cost();
  check(`ternary C1INC is ${tc.switches} switches and ${tc.midRailConnections} mid taps`,
    tc.switches === 10 && tc.midRailConnections === 2, JSON.stringify(tc));
  check(`binary Toffoli is ${bc.switches} switches and ${bc.midRailConnections} mid taps`,
    bc.switches === 12 && bc.midRailConnections === 0, JSON.stringify(bc));
  check(`   ratio ${(bc.switches / tc.switches).toFixed(2)}x — not the 3x that "two`
    + ' operands instead of three" invites', bc.switches / tc.switches < 1.5);

  const V = [D.LOW, D.MID, D.HIGH];
  const incT = x => (x === D.LOW ? D.MID : x === D.MID ? D.HIGH : D.LOW);
  let tbad = 0;
  for (const a of V) for (const bb of V) {
    const want = a === D.HIGH ? incT(bb) : bb;
    if (t.solve({ a, b: bb }, 40).out !== want) tbad++;
  }
  let bbad = 0;
  for (const a of [D.LOW, D.HIGH]) for (const bb of [D.LOW, D.HIGH]) for (const c of [D.LOW, D.HIGH]) {
    const want = (a === D.HIGH && bb === D.HIGH) ? (c === D.HIGH ? D.LOW : D.HIGH) : c;
    if (b.solve({ a, b: bb, c }, 40).out !== want) bbad++;
  }
  check('   and both are correct exhaustively — 9 of 9 and 8 of 8',
    tbad === 0 && bbad === 0, `${tbad} / ${bbad} wrong`);
}

console.log('\n=== 4. O4 — THE MARGIN IS BORROWED FROM THE FREE MID RAIL ===');
{
  const t = ternaryC1INC().cost(), b = binaryToffoli().cost();
  const total = (c, price) => c.switches + price * c.midRailConnections;
  check(`at a mid-tap price of 0, ternary wins ${total(t, 0)} to ${total(b, 0)}`,
    total(t, 0) < total(b, 0));
  check(`at a price of 1 they TIE at ${total(t, 1)}`, total(t, 1) === total(b, 1));
  check(`at a price of 2 binary wins ${total(b, 2)} to ${total(t, 2)}`,
    total(t, 2) > total(b, 2));
  check('   so the advantage is STRUCTURAL, not economic — every switch of the'
    + ' margin rests on the model\'s own largest stated limit', total(t, 1) === total(b, 1));
  check('F-BORN-NONLINEAR — the design intuition inverts: in ternary linearity is'
    + ' the special case you must work for, not the default', (() => {
      // t_b += t_a is affine and had to be chosen; "if t_a == 1" is not and is free.
      const ter = indicatorsAffine(3);
      return ter.every(x => !x);
    })());
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
