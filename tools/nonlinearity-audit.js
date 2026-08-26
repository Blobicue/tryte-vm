'use strict';
/* NONLINEARITY AUDIT — what does a born-nonlinear conditional actually cost?
 *
 * Set `M` established that ternary reaches reversible universality at two operands
 * and binary cannot at any width. This asks the question that was explicitly left
 * open there: **is that structural advantage worth anything in switches?**
 *
 * THE ROOT FACT, stated narrowly on purpose. Take one control digit and one
 * conditional: "act if the control equals a specific value".
 *
 *   In GF(2), the indicator of a single value of one digit is AFFINE — the
 *   indicator of `x = 1` is `x` itself, and of `x = 0` is `1 + x`.
 *   In GF(3), no single-value indicator of one digit is affine. A function taking
 *   (0,1,0) on (0,1,2) would need `b = 0`, then `a = 1`, then `2a = 0` — impossible.
 *
 * So the simplest possible conditional is LINEAR in binary and NONLINEAR in
 * ternary. That is the whole of `M2`'s advantage traced to its root.
 *
 * WHAT THIS IS NOT CLAIMING: that binary nonlinearity is expensive in general. It
 * is not — `bAnd` is six switches. The claim is restricted to ONE-CONTROL
 * conditionals, which is exactly the case that decides gate width, and it is not
 * evidence about anything wider.
 *
 * NOTE ON IDS: set `O`, predictions written `O1`-style and always backticked so
 * they do not read as `01`.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   O1  ONE-CONTROL INDICATORS: AFFINE IN BINARY, NEVER IN TERNARY. Exhaustive
 *       over one variable in both fields: all 2 single-value indicators over GF(2)
 *       are affine, and all 3 over GF(3) are not. Restricted to one control digit
 *       and registered that way, because the indicator of a single POINT of two
 *       binary digits is quadratic too — `x AND y` — and the general claim would
 *       be false.
 *
 *   O2  THE CHEAPEST NON-AFFINE TRIGGER IS AN OUTER STATE, NOT THE MIDDLE. "Equals
 *       HIGH" is `>= HIGH`, one threshold, one switch. "Equals MID" is an interval
 *       and needs two, which is the same asymmetry `C2` measured in the decoder's
 *       pull-downs where "not MID" cost two where "not LOW" and "not HIGH" cost one
 *       each. Predicted: triggering on an outer state is strictly cheaper per gate,
 *       and both triggers give non-affine gates.
 *
 *       CAVEAT REGISTERED: this is the PER-GATE marginal cost. `E`/`I` established
 *       that a MID detector amortises across every selector sharing the control, so
 *       in a machine that already pays for one the difference may be a wash. The
 *       claim is about one gate in isolation and is not evidence about a machine.
 *
 *   O3  AND THE OPERAND ADVANTAGE DOES NOT BECOME A SWITCH ADVANTAGE. Both gates
 *       built in the SAME pass-network idiom, both obeying `T5` — every source
 *       terminal rail-driven, buffers counted on both sides, no trick used on one
 *       side and withheld from the other.
 *
 *         ternary  `C1INC`, 2 trits, 9 states: a rail-sourced identity table and a
 *                  rail-sourced increment table, selected by one threshold on the
 *                  control. Derived: 4 + 4 + 2 = **10 switches, 2 mid-rail taps**.
 *         binary   Toffoli, 3 bits, 8 states: invert the target, buffer it back,
 *                  AND the two controls, select between the two with the AND.
 *                  Derived: 2 + 2 + 6 + 2 = **12 switches, 0 mid-rail taps**.
 *
 *       Predicted: the ratio lands between 1.0 and 1.5 — NOT the three-or-more that
 *       "two operands instead of three" invites. An earlier estimate of ~22 for the
 *       binary side was a strawman built by not extending the pass-network idiom
 *       across the comparison, and it is recorded here so the correction is visible
 *       rather than silent.
 *
 *   O4  AND WHAT MARGIN THERE IS RESTS ENTIRELY ON THE FREE MID RAIL. The device
 *       model's own first stated limit is that `vmid` is free, and it is called the
 *       largest of the four. The ternary gate takes 2 mid-rail taps and the binary
 *       gate takes none. Predicted: price a mid tap at the cost of one switch and
 *       the two gates TIE at 12; price it any higher and ternary loses outright.
 *
 *       If that holds, the honest statement is not "ternary is cheaper". It is:
 *       **ternary's advantage is structural, not economic, and the entire economic
 *       margin sits on the one assumption this model flags as its biggest.**
 * ------------------------------------------------------------------------------
 */

const D = require('../src/device.js');

const line = '='.repeat(78);
console.log('NONLINEARITY AUDIT — what a born-nonlinear conditional costs.\n');

console.log('--- O1  one-control indicators, exhaustively, in both fields ---');
{
  const report = (q, name) => {
    const rows = [];
    for (let a = 0; a < q; a++) {
      // indicator of "x == a": the function f(x) = 1 if x == a else 0
      const f = x => (x === a ? 1 : 0);
      // affine over GF(q) means f(x) = m*x + c for some m, c
      let affine = false;
      for (let m = 0; m < q && !affine; m++) {
        for (let c = 0; c < q && !affine; c++) {
          if ([...Array(q).keys()].every(x => (m * x + c) % q === f(x))) affine = true;
        }
      }
      rows.push({ a, affine });
    }
    const nAff = rows.filter(r => r.affine).length;
    console.log(`      GF(${q}) ${name.padEnd(9)} ${rows.length} single-value indicators,`
      + ` ${nAff} affine, ${rows.length - nAff} not`
      + `   ${rows.map(r => `[x=${r.a}]:${r.affine ? 'affine' : 'NOT'}`).join('  ')}`);
    return nAff === rows.length;
  };
  const binAllAffine = report(2, '(bits)');
  const terAllAffine = report(3, '(trits)');
  console.log(`      -> binary: every one-control indicator is affine (${binAllAffine}).`);
  console.log(`         ternary: not one of them is (${!terAllAffine}).`);
  console.log('         So the simplest conditional is LINEAR in binary, NONLINEAR in ternary.');
}

console.log('\n--- O2  is an outer trigger cheaper than a middle one? ---');
{
  // "control == HIGH" is a single threshold. "control == MID" is an interval.
  const outer = new D.Net();
  outer.n('a', D.HIGH, 'src', 'out');                       // a >= HIGH
  const middle = new D.Net();
  D.isMid(middle, 'a', 'am');                               // the interval, built
  middle.n('am', D.MID, 'src', 'out');
  console.log(`      trigger on an OUTER state: ${outer.cost().switches} switch`);
  console.log(`      trigger on the MIDDLE:      ${middle.cost().switches} switches`
    + ` (${middle.cost().midRailConnections} mid tap), because "equals MID" is an interval`);
  console.log('      the same asymmetry C2 found in the decoder: "not MID" cost two');
  console.log('      pull-downs where "not LOW" and "not HIGH" cost one each.');
  console.log('      CAVEAT: per gate. E/I showed a MID detector amortises across every');
  console.log('      selector sharing the control, so in a machine this may be a wash.');
}

console.log('\n--- O3  both universal gates, same idiom, T5 obeyed on both sides ---');
{
  // TERNARY: C1INC on (a,b) -> (a, b + [a == HIGH]). `a` passes through as a wire.
  // Both selector sources are rail-driven tables, so T5 is satisfied without an
  // extra buffer: a tmux over three rails IS the re-drive.
  const tern = new D.Net();
  D.tmux(tern, 'b', 'vss', 'vmid', 'vdd', 'idb');           // identity table
  D.tmux(tern, 'b', 'vmid', 'vdd', 'vss', 'incb');          // increment table
  tern.n('a', D.HIGH, 'incb', 'out');                       // a == HIGH  -> incremented
  tern.p('a', D.MID, 'idb', 'out');                         // otherwise  -> unchanged
  const tc = tern.cost();

  // BINARY: Toffoli on (a,b,c) -> (a,b,c XOR (a AND b)). Same idiom: rail-driven
  // sources, a two-way pass select, buffers counted.
  const bin = D.binaryNet();
  D.bInv(bin, 'c', 'notc');                                 // rail-driven
  D.bInv(bin, 'notc', 'bufc');                              // rail-driven re-drive of c
  D.bAnd(bin, 'a', 'b', 'ab');                              // rail-driven
  D.bmux(bin, 'ab', 'bufc', 'notc', 'out');                 // ab ? NOT c : c
  const bc = bin.cost();

  console.log(`      ternary C1INC   2 trits, 9 states   ${String(tc.switches).padStart(3)} switches`
    + `   ${tc.midRailConnections} mid taps`);
  console.log(`      binary  Toffoli 3 bits,  8 states   ${String(bc.switches).padStart(3)} switches`
    + `   ${bc.midRailConnections} mid taps`);
  console.log(`      ratio ${(bc.switches / tc.switches).toFixed(2)}x in ternary's favour`);
  console.log('      (an earlier estimate put the binary side at ~22 by not extending the');
  console.log('       pass-network idiom across the comparison. That was a strawman.)');

  // Correctness, exhaustively, or the counts mean nothing.
  const V = [D.LOW, D.MID, D.HIGH];
  const incT = t => (t === D.LOW ? D.MID : t === D.MID ? D.HIGH : D.LOW);
  let tbad = 0;
  for (const a of V) for (const b of V) {
    const got = tern.solve({ a, b }, 40).out;
    const want = a === D.HIGH ? incT(b) : b;
    if (got !== want) tbad++;
  }
  let bbad = 0;
  for (const a of [D.LOW, D.HIGH]) for (const b of [D.LOW, D.HIGH]) for (const c of [D.LOW, D.HIGH]) {
    const got = bin.solve({ a, b, c }, 40).out;
    const and = (a === D.HIGH && b === D.HIGH);
    const want = and ? (c === D.HIGH ? D.LOW : D.HIGH) : c;
    if (got !== want) bbad++;
  }
  console.log(`      correctness: ternary wrong on ${tbad}/9, binary wrong on ${bbad}/8`);
  console.log(`      non-affine:  the ternary gate triggers on one control value, which O1`);
  console.log(`                   shows cannot be affine over GF(3).`);
}

console.log('\n--- O4  what happens when the mid rail is not free? ---');
{
  const tern = new D.Net();
  D.tmux(tern, 'b', 'vss', 'vmid', 'vdd', 'idb');
  D.tmux(tern, 'b', 'vmid', 'vdd', 'vss', 'incb');
  tern.n('a', D.HIGH, 'incb', 'out');
  tern.p('a', D.MID, 'idb', 'out');
  const t = tern.cost();
  const bin = D.binaryNet();
  D.bInv(bin, 'c', 'notc'); D.bInv(bin, 'notc', 'bufc');
  D.bAnd(bin, 'a', 'b', 'ab'); D.bmux(bin, 'ab', 'bufc', 'notc', 'out');
  const b = bin.cost();
  console.log('      price of a mid tap   ternary total   binary total   winner');
  for (const price of [0, 1, 2, 4]) {
    const tt = t.switches + price * t.midRailConnections;
    const bb = b.switches + price * b.midRailConnections;
    console.log(`      ${String(price).padStart(14)}   ${String(tt).padStart(13)}`
      + `   ${String(bb).padStart(12)}   ${tt < bb ? 'ternary' : tt === bb ? 'tie' : 'BINARY'}`);
  }
  console.log('\n      The device model\'s first stated limit is that vmid is free, and it');
  console.log('      calls that the largest of the four. Every switch of ternary\'s margin');
  console.log('      here is borrowed from it.');
}

console.log('\n' + line);
