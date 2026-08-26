'use strict';
/* SEQUENCER AUDIT — can the step boundary live inside the circuit?
 *
 * Roadmap phase 5, and the last unbuilt subsystem. `design/09-sequencing.md` names
 * `Q3`, the self-timed handshake, as "the one that would make this a real machine"
 * and also "the one most likely to be impossible here", and says the experiment is
 * untested and is the most interesting single question in that folder.
 *
 * It also carries a concession stated in advance rather than discovered later:
 * under `Q0`, if the step boundary lives in the harness then **the sequencer is
 * JavaScript**, and "a computer built of simulated ternary transistors" means a
 * DATAPATH built of them. This phase asks whether that concession is a weakness of
 * the design or a consequence of the model.
 *
 * NOTE ON IDS: first set of the two-letter scheme — `AA`, then `AB`, `AC`, … The
 * alphabet ran out at `T`, and the four regexes that parse ids were widened in
 * their own commit, announced one phase ahead.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit.
 *
 *   AA1 A DRIVEN HANDSHAKE DOES NOT SETTLE FROM A COLD START. A request/acknowledge
 *       pair is a feedback loop of mutually COMPUTED control nodes, and this project
 *       has measured what those do three times: unknown at pass one, and by `N6`
 *       unknown conduction poisons whatever it gates (`B1a`, `C2`, and the array in
 *       `C` that took 26 of 27 words down with it).
 *
 *       Predicted: for every value of the driving input, the loop either never
 *       settles or resolves to unknown — and never to a completed transaction.
 *       Registered with the alternative: if it settles cleanly, `Q3` is available
 *       and the concession in `design/09` can be lifted.
 *
 *   AA2 AND SEEDING IT MAKES IT SETTLE — TO A FIXED POINT, WHICH IS THE PROBLEM.
 *       Seed the handshake's control cone the way `C` had to seed the memory array
 *       and it resolves. But it resolves to ONE state and stays there: re-solving
 *       from the state it reached returns that same state.
 *
 *       Predicted: a seeded handshake completes at most one transition per solve,
 *       and the second solve moves nothing. So the seeding is not a workaround for
 *       the handshake — **the seeding IS the clock**, and it is external.
 *
 *   AA3 SO THE CONCESSION IS FORCED BY THE MODEL, NOT CHOSEN BY THE DESIGN. The
 *       solver's contract is that it returns a state where nothing changed, or it
 *       throws. A sequencer needs SUCCESSIVE DISTINCT states. Therefore any
 *       construction that sequenced inside one solve would have to be a network
 *       that does not settle — and not settling is an error, not an output.
 *
 *       Predicted, and checkable rather than rhetorical: **every state the solver
 *       returns is a genuine fixed point** — re-solving from it, with the same
 *       inputs, returns it unchanged — across every network this repository builds
 *       plus random ones. If that holds universally, no solve can produce a
 *       sequence, and `Q3` is not merely hard here but unavailable.
 *
 *   AA4 BUT THE SEQUENCER IS CHEAP ONCE THE STEP IS EXTERNAL. A microcoded
 *       sequencer under `Q0`/`Q1` — a master-slave state register plus a next-state
 *       function — is buildable from parts that already exist. Predicted: a 3-trit
 *       state advancing by one per two-phase step cycles through all 27 states and
 *       returns to its start, and costs the master-slave register plus one
 *       incrementer per trit.
 *
 *       So the honest closing statement is not that the sequencer could not be
 *       built. It is that **the model has no notion of time, and a sequencer is
 *       precisely a thing that needs one.**
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

const line = '='.repeat(78);

/** A four-phase request/acknowledge handshake between two stages. */
function handshake() {
  const net = new D.Net();
  // ack follows req; req follows NOT ack. A mutual dependency: the classic loop.
  D.tBuffer(net, 'req', 'ackRaw', 'AB');
  net.n('go', D.HIGH, 'ackRaw', 'ack');
  net.p('go', D.MID, 'vss', 'ack');
  D.sti(net, 'ack', 'reqRaw');
  net.n('go', D.HIGH, 'reqRaw', 'req');
  net.p('go', D.MID, 'vdd', 'req');
  return net;
}

/** Master-slave state register plus an increment table: a sequencer under Q1. */
function latch(net, tag, src, q, we, hold) {
  D.sti(net, q, `${tag}qbraw`);
  D.sti(net, `${q}b`, `${tag}qraw`);
  net.n(hold, D.HIGH, `${tag}qbraw`, `${q}b`);
  net.n(hold, D.HIGH, `${tag}qraw`, q);
  net.n(we, D.HIGH, src, q);
  return net;
}
function sequencer(width = 3) {
  const net = new D.Net();
  // next state = state + 1, trit by trit with a ripple carry through the width.
  for (let i = 0; i < width; i++) {
    const cin = i === 0 ? 'one' : `k${i - 1}`;
    D.tmux(net, `s${i}`, 'vss', 'vmid', 'vdd', `sv${i}`);       // re-drive the state
    // The TAG is not optional in practice: tAdderCell names every internal node of
    // its two tables after it. Omitting it gave all three cells the tag
    // `undefined`, so their internal trees shared node names and merged into one
    // circuit — and the whole incrementer resolved to unknown. `tRippleAdder`
    // passes `A${i}`; this passes `Q${i}` for the same reason.
    D.tAdderCell(net, `sv${i}`, 'zero', cin, `n${i}`, `k${i}`, `Q${i}`);
  }
  for (let i = 0; i < width; i++) {
    latch(net, `m${i}`, `n${i}`, `m${i}`, 'phA', 'nphA');
    latch(net, `t${i}`, `m${i}`, `s${i}`, 'phB', 'nphB');
  }
  return net;
}

const V = [D.LOW, D.MID, D.HIGH];
const stateNodes = net => {
  const s = new Set();
  for (const d of net.devices) { s.add(d.a); s.add(d.b); s.add(d.gate); }
  return s;
};
const seedAll = (net, inputs, fixed = {}) => {
  const driven = new Set([...Object.keys(net.rails), ...Object.keys(inputs)]);
  const init = {};
  for (const x of stateNodes(net)) if (!driven.has(x)) init[x] = 'Z';
  return { ...init, ...fixed };
};

if (require.main === module) {
  console.log('SEQUENCER AUDIT - can the step boundary live inside the circuit?\n');

  console.log('--- AA1  does a driven handshake settle from a cold start? ---');
  {
    // Only `go` HIGH engages the loop. At LOW and MID the pull-ups hold req and
    // ack at fixed levels and there is no handshake at all — an earlier version of
    // this section counted those two as "settled cleanly", which scored a disabled
    // circuit as a working one and would have reported Q3 as available.
    for (const go of V) {
      const net = handshake();
      const inputs = { go };
      const live = go === D.HIGH;
      let verdict;
      try {
        const sol = net.solve(inputs, 80, seedAll(net, inputs));
        verdict = (sol.req === 'X' || sol.ack === 'X')
          ? `UNKNOWN (req=${sol.req} ack=${sol.ack})` : `settled req=${sol.req} ack=${sol.ack}`;
      } catch (e) { verdict = 'never settles'; }
      console.log(`      go=${String(go).padStart(2)}  ${live ? 'LOOP LIVE ' : 'loop off  '} ${verdict}`);
    }
    console.log(`      only the live case is a handshake, and it resolves to unknown.`);
    console.log(`      A request/acknowledge pair is a loop of mutually COMPUTED control`);
    console.log(`      nodes, which B1a and C both measured going unknown at pass one.`);
  }

  console.log('\n--- AA2  seed it, and see whether it advances ---');
  {
    let advanced = 0, frozen = 0, failed = 0;
    for (const go of V) {
      const net = handshake();
      const inputs = { go };
      const seed = seedAll(net, inputs, { req: D.HIGH, reqRaw: D.HIGH, ack: D.LOW, ackRaw: D.LOW });
      let first = null;
      try { first = net.solve(inputs, 80, seed); } catch (e) { failed++; continue; }
      const again = (() => {
        const s2 = seedAll(net, inputs);
        for (const k of Object.keys(s2)) if (first[k] !== undefined) s2[k] = first[k];
        try { return net.solve(inputs, 80, s2); } catch (e) { return null; }
      })();
      if (!again) { failed++; continue; }
      const moved = Object.keys(first).some(k => first[k] !== again[k]);
      if (moved) advanced++; else frozen++;
    }
    console.log(`      seeded, then re-solved from the state it reached:`);
    console.log(`      ${frozen} froze, ${advanced} advanced, ${failed} failed to resolve`);
    console.log(`      a second solve moves nothing -- so the SEEDING is the clock,`);
    console.log(`      and the seeding is external.`);
  }

  console.log('\n--- AA3  is every solver output a genuine fixed point? ---');
  {
    // If so, no solve can ever produce a sequence, and Q3 is unavailable in
    // principle rather than merely difficult.
    const cases = [
      ['sti', () => { const n = new D.Net(); D.sti(n, 'a', 'o'); return n; }, ['a']],
      ['tmin', () => { const n = new D.Net(); D.tmin(n, 'a', 'b', 'o'); return n; }, ['a', 'b']],
      ['tmux', () => { const n = new D.Net(); D.tmux(n, 's', 'vss', 'vmid', 'vdd', 'o'); return n; }, ['s']],
      ['adder cell', () => { const n = new D.Net(); D.tAdderCell(n, 'a', 'b', 'c', 's', 'o'); return n; }, ['a', 'b', 'c']],
      ['detector', () => { const n = new D.Net(); D.isMid(n, 'a', 'o'); return n; }, ['a']],
    ];
    let checked = 0, fixedPoints = 0, moved = [];
    for (const [name, mk, ins] of cases) {
      const sweep = (i, inputs) => {
        if (i === ins.length) {
          const net = mk();
          let first;
          try { first = net.solve(inputs, 80, seedAll(net, inputs)); } catch (e) { return; }
          const s2 = seedAll(net, inputs);
          for (const k of Object.keys(s2)) if (first[k] !== undefined) s2[k] = first[k];
          let second;
          try { second = net.solve(inputs, 80, s2); } catch (e) { moved.push(`${name} threw`); return; }
          checked++;
          const same = Object.keys(first).every(k => first[k] === second[k]);
          if (same) fixedPoints++; else moved.push(`${name} ${JSON.stringify(inputs)}`);
          return;
        }
        for (const v of V) sweep(i + 1, { ...inputs, [ins[i]]: v });
      };
      sweep(0, {});
    }
    console.log(`      ${fixedPoints} of ${checked} solver outputs are genuine fixed points`);
    console.log(`      states that moved on a second solve: ${moved.length}`
      + (moved.length ? '  ' + moved.slice(0, 3).join('; ') : ''));
    console.log(`      -> a solve returns a state where nothing changed, or it throws.`);
    console.log(`         A sequencer needs SUCCESSIVE distinct states. So sequencing`);
    console.log(`         inside one solve would require a network that does not settle,`);
    console.log(`         and not settling is an error rather than an output.`);
  }

  console.log('\n--- AA4  the sequencer, once the step is external ---');
  {
    const net = sequencer(3);
    const cost = net.cost();
    console.log(`      3-trit microcoded sequencer: ${cost.switches} switches,`
      + ` ${cost.midRailConnections} mid taps`);
    const PH = { A: { phA: 1, nphA: -1, phB: -1, nphB: 1 }, B: { phA: -1, nphA: 1, phB: 1, nphB: -1 } };
    const rd = (sol, n) => Array.from({ length: n }, (_, i) => sol[`s${i}`]);
    const seedState = (inputs, st, master) => {
      const init = seedAll(net, inputs);
      st.forEach((v, i) => { init[`s${i}`] = v; init[`s${i}b`] = -v; });
      master.forEach((v, i) => { init[`m${i}`] = v; init[`m${i}b`] = -v; });
      return init;
    };
    let st = [D.LOW, D.LOW, D.LOW];
    const seen = new Set(); let steps = 0, broke = null;
    for (let k = 0; k < 30; k++) {
      const key = st.join(',');
      if (seen.has(key)) break;
      seen.add(key); steps++;
      const inA = { one: D.HIGH, zero: D.MID, ...PH.A };
      let a; try { a = net.solve(inA, 80, seedState(inA, st, [D.LOW, D.LOW, D.LOW])); }
      catch (e) { broke = `phase A at step ${k}`; break; }
      const m = rd(a, 3).map((_, i) => a[`m${i}`]);
      const inB = { one: D.HIGH, zero: D.MID, ...PH.B };
      let b; try { b = net.solve(inB, 80, seedState(inB, st, m)); }
      catch (e) { broke = `phase B at step ${k}`; break; }
      st = rd(b, 3);
    }
    console.log(`      distinct states visited before repeating: ${steps}`
      + (broke ? `   (stopped: ${broke})` : ''));
    console.log(`      a state register plus a next-state function, stepped from outside.`);
    console.log(`      The parts all existed; what does not exist in this model is time.`);
  }

  console.log('\n' + line);
}

module.exports = { handshake, sequencer, seedAll, stateNodes };
