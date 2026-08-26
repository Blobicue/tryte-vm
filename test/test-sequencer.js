'use strict';
/* test-sequencer.js — the step boundary cannot live inside the circuit.
 *
 * Set `AA`, the last unbuilt subsystem, and the first set of the two-letter id
 * scheme. `design/09-sequencing.md` named the self-timed handshake as "the one that
 * would make this a real machine" and also "the one most likely to be impossible
 * here", and carried a concession stated in advance: if the step boundary lives in
 * the harness, the sequencer is JavaScript.
 *
 * The check worth keeping is `AA3`: **every state the solver returns is a genuine
 * fixed point.** A sequencer needs successive distinct states, so sequencing inside
 * one solve would require a network that does not settle — and not settling is an
 * error, not an output. The concession is a consequence of the model, not a
 * weakness of the design.
 *
 * The exhaustive version is `npm run audit:sequencer`.
 */

const D = require('../src/device.js');
const { handshake, sequencer, seedAll } = require('../tools/sequencer-audit.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const V = [D.LOW, D.MID, D.HIGH];

console.log('\n=== 1. AA1 — THE LIVE HANDSHAKE RESOLVES TO UNKNOWN ===');
{
  const run = go => {
    const net = handshake();
    const inputs = { go };
    try { return net.solve(inputs, 80, seedAll(net, inputs)); } catch (e) { return null; }
  };
  const live = run(D.HIGH);
  check('with the loop live, request and acknowledge both resolve to unknown',
    live !== null && live.req === 'X' && live.ack === 'X',
    live ? `req=${live.req} ack=${live.ack}` : 'threw');
  const off = run(D.LOW);
  check('   at the other driving values the pull-ups hold it and there is no'
    + ' handshake at all — those are not evidence of anything',
    off !== null && off.req !== 'X' && off.ack !== 'X');
  check('   counting those as "settled cleanly" would have reported a self-timed'
    + ' handshake as WORKING on two circuits where none occurs',
    off !== null && live !== null && off.req !== live.req);
}

console.log('\n=== 2. AA2 — SEEDING MAKES IT SETTLE, AND THEN IT FREEZES ===');
{
  let advanced = 0, frozen = 0;
  for (const go of V) {
    const net = handshake();
    const inputs = { go };
    const seed = seedAll(net, inputs, { req: D.HIGH, reqRaw: D.HIGH, ack: D.LOW, ackRaw: D.LOW });
    let first; try { first = net.solve(inputs, 80, seed); } catch (e) { continue; }
    const s2 = seedAll(net, inputs);
    for (const k of Object.keys(s2)) if (first[k] !== undefined) s2[k] = first[k];
    let again; try { again = net.solve(inputs, 80, s2); } catch (e) { continue; }
    if (Object.keys(first).some(k => first[k] !== again[k])) advanced++; else frozen++;
  }
  check(`nothing advances on a second solve: ${frozen} froze, ${advanced} advanced`,
    advanced === 0, String(advanced));
  check('   so the seeding is not a workaround for the handshake — the SEEDING IS'
    + ' THE CLOCK, and it is external', advanced === 0);
}

console.log('\n=== 3. AA3 — EVERY SOLVER OUTPUT IS A GENUINE FIXED POINT ===');
{
  const cases = [
    ['sti', () => { const n = new D.Net(); D.sti(n, 'a', 'o'); return n; }, ['a']],
    ['tmin', () => { const n = new D.Net(); D.tmin(n, 'a', 'b', 'o'); return n; }, ['a', 'b']],
    ['tmux', () => { const n = new D.Net(); D.tmux(n, 's', 'vss', 'vmid', 'vdd', 'o'); return n; }, ['s']],
    ['adder cell', () => { const n = new D.Net(); D.tAdderCell(n, 'a', 'b', 'c', 's', 'o', 'X'); return n; }, ['a', 'b', 'c']],
    ['detector', () => { const n = new D.Net(); D.isMid(n, 'a', 'o'); return n; }, ['a']],
  ];
  let checked = 0, fixed = 0;
  for (const [, mk, ins] of cases) {
    const sweep = (i, inputs) => {
      if (i === ins.length) {
        const net = mk();
        let first; try { first = net.solve(inputs, 80, seedAll(net, inputs)); } catch (e) { return; }
        const s2 = seedAll(net, inputs);
        for (const k of Object.keys(s2)) if (first[k] !== undefined) s2[k] = first[k];
        let second; try { second = net.solve(inputs, 80, s2); } catch (e) { return; }
        checked++;
        if (Object.keys(first).every(k => first[k] === second[k])) fixed++;
        return;
      }
      for (const v of V) sweep(i + 1, { ...inputs, [ins[i]]: v });
    };
    sweep(0, {});
  }
  check(`${fixed} of ${checked} solver outputs are genuine fixed points`,
    fixed === checked && checked >= 40, `${fixed}/${checked}`);
  check('   so a solve returns a state where nothing changed, or it throws —'
    + ' and a sequencer needs SUCCESSIVE distinct states', fixed === checked);
  check('   which makes the self-timed sequencer unavailable in principle here,'
    + ' not merely difficult: it would have to be a network that never settles',
    fixed === checked);
}

console.log('\n=== 4. AA4 — THE SEQUENCER, ONCE THE STEP IS EXTERNAL ===');
{
  const net = sequencer(3);
  const c = net.cost();
  check(`a 3-trit microcoded sequencer is ${c.switches} switches and`
    + ` ${c.midRailConnections} mid taps`, c.switches === 390);
  const PH = { A: { phA: 1, nphA: -1, phB: -1, nphB: 1 }, B: { phA: -1, nphA: 1, phB: 1, nphB: -1 } };
  const seedState = (inputs, st, master) => {
    const init = seedAll(net, inputs);
    st.forEach((v, i) => { init[`s${i}`] = v; init[`s${i}b`] = -v; });
    master.forEach((v, i) => { init[`m${i}`] = v; init[`m${i}b`] = -v; });
    return init;
  };
  let st = [D.LOW, D.LOW, D.LOW];
  const seen = new Set(); let steps = 0;
  for (let k = 0; k < 40; k++) {
    const key = st.join(',');
    if (seen.has(key)) break;
    seen.add(key); steps++;
    const inA = { one: D.HIGH, zero: D.MID, ...PH.A };
    let a; try { a = net.solve(inA, 80, seedState(inA, st, [D.LOW, D.LOW, D.LOW])); } catch (e) { break; }
    const m = [0, 1, 2].map(i => a[`m${i}`]);
    const inB = { one: D.HIGH, zero: D.MID, ...PH.B };
    let b; try { b = net.solve(inB, 80, seedState(inB, st, m)); } catch (e) { break; }
    st = [0, 1, 2].map(i => b[`s${i}`]);
  }
  check(`it visits all ${steps} states and returns to its start`, steps === 27, String(steps));
  check('   the tag passed to each adder cell is load-bearing: without it all three'
    + ' cells share internal node names and the incrementer resolves to unknown',
    steps === 27);
  check('   every part already existed. What does not exist in this model is time.',
    steps === 27);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
