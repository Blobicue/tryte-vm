'use strict';
/* MID-RAIL PRICE AUDIT — how much of this project rests on one free assumption?
 *
 * Set `O` ended on this: ternary's universal gate beats binary's by 1.2x, and the
 * entire margin is two mid-rail taps against zero. The device model's FIRST stated
 * limit is that `vmid` is free, and it calls that limit the largest of the four.
 *
 * ------------------------------------------------------------------------------
 * WHAT THIS PHASE CANNOT DO, and the framing invites the opposite reading.
 *
 * It cannot settle whether the assumption is TRUE. Whether generating a third
 * voltage level is cheap in real devices is a physical question, and `T5` says the
 * middle level cannot be made inside this model at all — a divider between the
 * outer rails is contention, and resolves to `X`. So the model is incapable of
 * pricing its own biggest assumption from the inside.
 *
 * What it CAN do is say how much rests on it: how many taps the corpus takes, how
 * many are forced rather than chosen, and which of this repository's published
 * comparisons flip when a tap stops being free. Pricing, not settling.
 *
 * NOTE ON IDS: set `N`. The NETWORK AXIOMS are also `N1`-`N8`; they are cited below
 * as "axiom `N4`" and predictions are written bare as `N1`. Same collision the `M`,
 * `C`, `A` and `D` letters each carried.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   N1  A TAP IS UNAVOIDABLE IFF SOME NODE MUST CARRY MID. Not "some output" —
 *       nodes. Two clauses, and the second is the one that is easy to miss:
 *
 *         (a) a trit-valued OUTPUT forces a tap, because by `T5` reachability
 *             starts at rails and only at rails, so a node that must take MID must
 *             reach `vmid`;
 *         (b) a gate that conducts ONLY at exactly MID — a series pair like
 *             `tmux`'s middle arm — forces a MID-valued node upstream, and by (a)
 *             that node forces a tap.
 *
 *       Predicted: sweeping every node of every builder, `sti`, `tmin`, `tmax`,
 *       `tBuffer`, both adder cells and the storage cell are unavoidable; `nti`,
 *       `pti`, `tmux` and `dmux` carry no tap of their own and need none.
 *
 *   N2  BUT THE DETECTOR'S TAP IS A CHOICE, NOT A NECESSITY. `isMid` outputs
 *       (LOW, MID, LOW) and costs one tap. Every consumer in the repository gates
 *       it at threshold MID — `dmux`'s middle arm, `dAdderCell`'s three detectors,
 *       the decoder nodes in `C` and in `A` — and a threshold at MID conducts for
 *       anything at or above it. So HIGH would serve equally.
 *
 *       Predicted: a variant outputting (LOW, HIGH, LOW) exists at the same four
 *       switches with ZERO mid taps, and drives every enumerated consumer
 *       identically — swept exhaustively, including the full six-trit decoded
 *       adder, because a detector that works in a rig and not in the machine is
 *       the `A4` lesson.
 *
 *   N3  THE BLAST RADIUS, DERIVED RATHER THAN ESTIMATED. Tap density is not
 *       uniform: the storage cell is 2 taps on 11 switches (18%), the decoded
 *       adder 186 on 540 (34%), and a `tmux` read tree none at all.
 *
 *       For the 27-word memory `C` actually built — 2,301 switches — derived:
 *       162 cells at 2 taps = 324, six `tBuffer`s at 2 = 12, three detectors at
 *       1 = 3, and nothing from the complement plane or the read tree.
 *       **Predicted 339 taps, a multiplier of 1.15x at a price of one — not the
 *       doubling that 34% on the adder would suggest.**
 *
 *       And two named comparisons this repository has published:
 *         - the decoded adder beats the tree adder at 540 against 624, and the
 *           decoded one is the MORE tap-hungry. Predicted crossover at a price of
 *           **4.67**: decoded wins below it, tree wins above.
 *         - the read-path decision from `B`. Predicted NOT to flip, for a reason
 *           worth stating: `tmux` was never the cheaper option — 960 against 736
 *           at 81 words — and `B` chose it on correctness, not cost. Pricing the
 *           rail makes the decision more expensive without making it wrong.
 *
 *   N4  AND ALMOST NONE OF IT CAN BE ENGINEERED AWAY. Of the 339 taps predicted
 *       above, `N2` removes the three detectors. The other 336 come from `sti`
 *       inverters and `tBuffer`s whose outputs are trit-valued, which clause (a)
 *       makes unavoidable. **Predicted: 99% of the built memory's mid taps are
 *       forced.**
 *
 *       If that holds, the terminus is honest and uncomfortable: the assumption
 *       cannot be designed around, only priced — so "ternary is optimal for general
 *       compute" reduces to one physical question this model is structurally unable
 *       to answer, with a number attached to how much depends on the answer.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

const line = '='.repeat(78);
console.log('MID-RAIL PRICE AUDIT — how much rests on one free assumption?\n');

const V = [D.LOW, D.MID, D.HIGH];
const cost = f => { const n = new D.Net(); f(n); return n.cost(); };
const cell = (net, tag, src, q, we, hold) => {
  D.sti(net, q, `${tag}qbraw`); D.sti(net, `${q}b`, `${tag}qraw`);
  net.n(hold, D.HIGH, `${tag}qbraw`, `${q}b`);
  net.n(hold, D.HIGH, `${tag}qraw`, q);
  net.n(we, D.HIGH, src, q);
};

console.log('--- N1  which taps are forced, and which are chosen ---');
{
  // Clause (b): a device that conducts ONLY at exactly MID is a series pair with
  // one n-type and one p-type both at threshold MID on the same gate.
  const consumesExactMid = net => {
    const byGate = new Map();
    for (const d of net.devices) {
      if (d.vt !== D.MID) continue;
      if (!byGate.has(d.gate)) byGate.set(d.gate, new Set());
      byGate.get(d.gate).add(d.kind);
    }
    return [...byGate.values()].some(k => k.has('n') && k.has('p'));
  };
  const builders = [
    ['sti', n => D.sti(n, 'a', 'o'), ['a'], ['o']],
    ['nti', n => D.nti(n, 'a', 'o'), ['a'], ['o']],
    ['pti', n => D.pti(n, 'a', 'o'), ['a'], ['o']],
    ['tmin', n => D.tmin(n, 'a', 'b', 'o'), ['a', 'b'], ['o']],
    ['tmax', n => D.tmax(n, 'a', 'b', 'o'), ['a', 'b'], ['o']],
    ['tBuffer', n => D.tBuffer(n, 'a', 'o', 'T'), ['a'], ['o']],
    ['isMid', n => D.isMid(n, 'a', 'o'), ['a'], ['o']],
    ['tmux', n => D.tmux(n, 's', 'vss', 'vmid', 'vdd', 'o'), ['s'], ['o']],
    ['dmux', n => { D.isMid(n, 's', 'sm'); D.dmux(n, 's', 'sm', 'vss', 'vmid', 'vdd', 'o'); }, ['s'], ['o']],
  ];
  console.log('      builder   sw  taps   output takes MID   consumes exact-MID   forced?');
  for (const [name, build, ins, outs] of builders) {
    const net = new D.Net(); build(net);
    const c = net.cost();
    const seen = new Set();
    const sweep = (i, inp) => {
      if (i === ins.length) { const s = net.solve(inp, 40); outs.forEach(o => seen.add(s[o])); return; }
      for (const v of V) sweep(i + 1, { ...inp, [ins[i]]: v });
    };
    sweep(0, {});
    const midOut = seen.has(D.MID), exact = consumesExactMid(net);
    const forced = midOut || exact;
    console.log(`      ${name.padEnd(9)} ${String(c.switches).padStart(2)} ${String(c.midRailConnections).padStart(5)}`
      + `   ${String(midOut).padEnd(17)}  ${String(exact).padEnd(19)}  ${forced ? 'FORCED' : 'chosen'}`);
  }
  const one = cost(n => cell(n, 'x', 'd', 'q', 'we', 'hold'));
  console.log(`      storage cell ${one.switches} sw, ${one.midRailConnections} taps — two sti inverters, both trit-valued: FORCED`);
  console.log('');
  console.log('      N1 FAILED, two ways, and the second is the interesting one.');
  console.log('');
  console.log('      (i)  tmux and dmux were predicted to "carry no tap of their own and');
  console.log('           need none". They show 1 and 2 — because this rig wires their');
  console.log('           SOURCES to vss/vmid/vdd, and the vmid source is the tap. With');
  console.log('           abstract sources they are 4 and 3 switches at zero taps. Both');
  console.log('           readings are true of different questions: a selector has no tap');
  console.log('           of its own, and acquires one the moment it must be able to pass');
  console.log('           MID. The prediction did not say which question it was asking.');
  console.log('');
  console.log('      (ii) isMid is scored FORCED and N2 proves it is not. The test asks');
  console.log('           "does THIS BUILD put MID on a node", which is not the registered');
  console.log('           rule — the rule was "must some node carry MID for the FUNCTION to');
  console.log('           compute". A circuit that happens to use the mid rail is not a');
  console.log('           circuit that needs it, and the counterexample was sitting in the');
  console.log('           next section the whole time. Distinguishing the two needs a search');
  console.log('           over equivalent circuits, which this test does not do.');
}

console.log('\n--- N2  a detector with no mid tap at all ---');
{
  /** (LOW, HIGH, LOW) instead of (LOW, MID, LOW). Same four switches, no vmid. */
  function isMidHigh(net, sel, out) {
    net.p(sel, D.LOW, 'vss', out);
    net.n(sel, D.HIGH, 'vss', out);
    const m = `${out}$m`;
    net.n(sel, D.MID, 'vdd', m);
    net.p(sel, D.MID, m, out);
    return net;
  }
  const a = cost(n => D.isMid(n, 's', 'o')), b = cost(n => isMidHigh(n, 's', 'o'));
  console.log(`      isMid      ${a.switches} switches, ${a.midRailConnections} mid tap`);
  console.log(`      variant    ${b.switches} switches, ${b.midRailConnections} mid taps`);
  const t1 = new D.Net(); D.isMid(t1, 's', 'o');
  const t2 = new D.Net(); isMidHigh(t2, 's', 'o');
  console.log('      truth tables: '
    + V.map(v => `${v}->${t1.solve({ s: v }, 40).o}`).join(' ') + '   vs   '
    + V.map(v => `${v}->${t2.solve({ s: v }, 40).o}`).join(' '));

  // Every consumer gates at threshold MID, so anything at or above MID conducts.
  let bad = 0;
  for (const sel of V) for (const lo of V) for (const mid of V) for (const hi of V) {
    const mk = det => {
      const n = new D.Net();
      det(n, 'sel', 'sm');
      D.dmux(n, 'sel', 'sm', 'L', 'M', 'H', 'out');
      return n.solve({ sel, L: lo, M: mid, H: hi }, 40).out;
    };
    if (mk(D.isMid) !== mk(isMidHigh)) bad++;
  }
  console.log(`      dmux driven by each, all ${3 ** 4} (select x three sources): ${bad} differences`);

  // The consumer PATTERNS, enumerated by reading every use of a detector output in
  // the repository. There are exactly two, and both gate at threshold MID:
  //   1. dmux's middle arm         n(selMid, MID, mid, out)
  //   2. the decoder route-in leg  n(am,     MID, in,  out)   (sets C and A)
  // Both are swept exhaustively. Nothing else reads a detector: the seeds in
  // terminal-audit and test-terminal SOLVE it rather than transcribe it, which was
  // the T-TRANSCRIBED-TABLE fix, so they adapt on their own.
  let dbad = 0;
  for (const sel of V) for (const inV of V) {
    const mk = det => {
      const n = new D.Net();
      det(n, 'sel', 'am');
      n.n('am', D.MID, 'src', 'out');
      n.n('sel', D.MID, 'vss', 'out');
      return n.solve({ sel, src: inV }, 40).out;
    };
    if (mk(D.isMid) !== mk(isMidHigh)) dbad++;
  }
  console.log(`      the decoder route-in leg, all ${3 ** 2} cases: ${dbad} differences`);
  console.log('      those are the only two consumer patterns in the repository, and the');
  console.log('      seeds that touch a detector SOLVE it rather than transcribe it.');
  console.log('');
  console.log('      NOT tested: a decoded adder rebuilt on the variant. dRippleAdder calls');
  console.log('      isMid internally and cannot be swapped without editing device.js. An');
  console.log('      earlier version of this section printed "the shipped decoded adder');
  console.log('      still checks out", which exercised the ORIGINAL detector and said');
  console.log('      nothing whatever about the variant — a check that could not fail for');
  console.log('      the reason it claimed.');
}
console.log('\n--- N3  the blast radius ---');
{
  const one = cost(n => cell(n, 'x', 'd', 'q', 'we', 'hold'));
  const dec = cost(n => D.dRippleAdder(n, 6)), tree = cost(n => D.tRippleAdder(n, 6));
  const buf = cost(n => D.tBuffer(n, 'a', 'o', 'T'));
  const det = cost(n => D.isMid(n, 's', 'o'));
  console.log('      part                    switches  taps   density');
  for (const [nm, c] of [['storage cell', one], ['tBuffer', buf], ['isMid', det],
    ['decoded 6-trit adder', dec], ['tree 6-trit adder', tree]]) {
    console.log(`      ${nm.padEnd(22)} ${String(c.switches).padStart(8)} ${String(c.midRailConnections).padStart(5)}`
      + `   ${(100 * c.midRailConnections / c.switches).toFixed(0)}%`);
  }
  const memTaps = 162 * one.midRailConnections + 6 * buf.midRailConnections + 3 * det.midRailConnections;
  const memSw = 2301;
  console.log(`\n      the 27-word memory C built: ${memSw} switches, ${memTaps} taps`
    + `   (${(100 * memTaps / memSw).toFixed(1)}%)`);
  console.log(`      multiplier at a price of one: ${((memSw + memTaps) / memSw).toFixed(2)}x`);

  console.log('\n      decoded vs tree adder, priced:');
  for (const p of [0, 2, 4, 5, 8]) {
    const d = dec.switches + p * dec.midRailConnections, t = tree.switches + p * tree.midRailConnections;
    console.log(`        price ${p}: decoded ${String(d).padStart(5)}  tree ${String(t).padStart(5)}`
      + `   ${d < t ? 'decoded' : d === t ? 'tie' : 'TREE'}`);
  }
  const cross = (tree.switches - dec.switches) / (dec.midRailConnections - tree.midRailConnections);
  console.log(`        crossover at ${cross.toFixed(2)}`);

  const W = 81, t4 = 4, nodes = (W - 1) / 2;
  const tm = 6 * 4 * nodes, dm = 6 * 3 * nodes + t4 * 4;
  console.log(`\n      the read-path decision from B, priced (81 words):`);
  for (const p of [0, 4, 8, 20]) {
    console.log(`        price ${p}: tmux ${tm} (0 taps)   dmux ${dm + t4 * p} (${t4} taps)`
      + `   -> ${tm < dm + t4 * p ? 'tmux' : 'dmux'} cheaper`);
  }
  console.log('        tmux was never the cheaper option. B chose it on correctness,');
  console.log('        so pricing the rail makes that decision dearer, not wrong.');
}

console.log('\n--- N4  how much of it is forced? ---');
{
  const one = cost(n => cell(n, 'x', 'd', 'q', 'we', 'hold'));
  const buf = cost(n => D.tBuffer(n, 'a', 'o', 'T'));
  const det = cost(n => D.isMid(n, 's', 'o'));
  const forced = 162 * one.midRailConnections + 6 * buf.midRailConnections;
  const chosen = 3 * det.midRailConnections;
  console.log(`      forced (trit-valued outputs): ${forced}`);
  console.log(`      chosen (detectors, removable by N2): ${chosen}`);
  console.log(`      -> ${(100 * forced / (forced + chosen)).toFixed(1)}% of the built memory's taps cannot be designed away`);
  console.log('');
  console.log('      T5: a level that is not some rail\'s cannot be made. The middle level');
  console.log('      has to be GIVEN. So the model cannot price its own largest assumption');
  console.log('      from the inside — only measure how much depends on it.');
}

console.log('\n' + line);
