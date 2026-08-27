'use strict';
/* SELFREF AUDIT — what self-reference actually buys, and what buys the thing it is
 * being asked to buy.
 *
 * WHY THIS SET EXISTS
 * -------------------
 * The proposal is that "full self-reference" is what would give a tick currency its
 * layer-one security, and the concrete version offered is to write the history
 * operator in the language its own ladder produces.
 *
 * Half the answer is already in the Ladder itself and it is a negative. Coda III
 * proves that NO SYSTEM CLOSES OVER ITS OWN SEMANTICS: internalise the observer and
 * you have written a new term, reduced by someone with a budget it cannot see, and
 * the regress terminates at an axiom rather than at nothing. Its nf(t) returns HOLD,
 * GREW or RAN, and TWO OF THE THREE VERDICTS ARE NOT IN THE TERM. So full
 * self-reference in the strong sense is unavailable by the artifact's own theorem,
 * three separate derivations of it.
 *
 * The weak sense -- self-hosting, the operator expressible in the language it
 * generates -- is available, and programs/ladder.tasm now does it.
 *
 * But this set exists because there is a better answer than either, and it fell out
 * of AI4. What a receipt needs is a state map with in-degree one everywhere. The
 * history operator delivers that, and NOT because it is self-referential:
 *
 *     H is built entirely out of ADDITION, and AB2 measured ADD as erasing
 *     exactly zero bits -- a permutation of the whole 531,441-pair datapath.
 *
 * A map made of reversible parts is reversible. That is the property, and it has
 * nothing to do with self-reference. This set measures it, and then measures what it
 * costs to implement, which is where the answer stops being comfortable.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered before the run, per AGENTS.md.
 *
 *   AJ1 the ladder's state map is INJECTIVE, and addition is why. Carrying the
 *       operator in two words -- sum = SUM L(0..n-1) and lag = L(n) -- the step is
 *       (sum, lag) -> (sum + lag, sum + 1) once past the genesis. Predicted an
 *       exhaustive in-degree census over all 531,441 states gives a maximum
 *       in-degree of exactly 1 and zero unreachable states, meeting AI4's bijection
 *       criterion WITHOUT any special feedback table. Predicted this holds because
 *       every component is ADD, which AB2 measured at zero bits erased -- so the
 *       property is reversibility and not self-reference, and a forgetful two-word
 *       implementation has it just as much as an append-only one.
 *
 *   AJ2 but H AS A VALUE MAP erases heavily, and the reversibility lives in the
 *       state rather than in what comes out. H takes a whole history to one number.
 *       Predicted that over all histories of length 4 drawn from the three trit
 *       values, H collapses them onto far fewer outputs, erasing more than 3 bits by
 *       the AB measure. Registered with the consequence: anyone reading only the
 *       emitted number is reading an erasing channel, whatever the state map does.
 *
 *   AJ3 the operator runs in the machine that would price it, and the implementation
 *       ERASES even though the mathematics does not. programs/ladder.tasm carries
 *       the operator in two words and emits the ladder. Predicted it reproduces
 *       0, 0, 1, 1, 2, 3, 5, 8, 13 exactly against an independent implementation,
 *       and predicted its measured erasure is NONZERO -- above 4 bits per executed
 *       instruction -- because STORE destroys the word it overwrites (AB2), so a
 *       reversible map implemented on an erasing machine still erases. Self-hosting
 *       does not inherit the reversibility of the thing hosted.
 *
 *   AJ4 and never forgetting is unaffordable, which is why real machines erase. The
 *       ladder grows like phi^n while a tryte holds -364..+364. Predicted the
 *       sequence exceeds a tryte at term 15, where 377 > 364, so the append-only
 *       form runs out of representable range after fourteen terms and the machine's
 *       own version wraps rather than growing. The price of a trajectory graph that
 *       cannot converge is a state that cannot be bounded.
 *
 * ------------------------------------------------------------------------------
 * Run: node tools/selfref-audit.js
 */

const T = require('../src/ternary.js');
const A = require('./arity-audit.js');
const E = require('./erasure-audit.js');
const W = require('./workfactor-audit.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto } = require('../src/assembler.js');
const fs = require('fs');
const path = require('path');

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);
const N = T.TRYTE_STATES;
const val = i => i + T.TRYTE_MIN;
const ix = v => T.wrap(v) - T.TRYTE_MIN;
const SRC = fs.readFileSync(path.join(__dirname, '..', 'programs', 'ladder.tasm'), 'utf8');

log('SELFREF AUDIT — what self-reference buys, and what buys the thing asked for\n');

/* ============================================================================
 * 0. INSTRUMENT CHECK
 * ========================================================================== */
log(line);
log('0. INSTRUMENT CHECK');
log(line);
{
  log(`  the JS reference gives 0,0,1,1,2,3,5,8,13: ${A.ladder(9).join(',') === '0,0,1,1,2,3,5,8,13'}`);
  log(`  ADD erases zero bits on the pair datapath (AB2): ` +
    `${E.erasureOf(E.datapathMap('ADD', 0).img, N * N) === 0}`);
  log(`  STORE erases the maximum (AB2): ` +
    `${Math.abs(E.erasureOf(E.datapathMap('STORE', 0).img, N * N) - Math.log2(N)) < 1e-9}`);
  log(`  a bare HALT costs one instruction: ${W.steps('        HALT\n') === 1}`);
}

/* ============================================================================
 * 1. AJ1 — is the state map injective, and why?
 * ========================================================================== */
log('\n' + line);
log('1. AJ1 — the ladder step, as a map on two words');
log(line);
let AJ1 = null;
{
  // (sum, lag) -> (sum + lag, sum + 1), the step once the history is non-empty.
  AJ1 = A.inDegrees((sum, lag) => T.add(sum, lag));   // first component only...
  // ...but the real map is two-dimensional, so census it properly.
  const deg = new Int32Array(N * N);
  for (let s = 0; s < N; s++)
    for (let l = 0; l < N; l++)
      deg[ix(T.add(val(s), val(l))) * N + ix(T.add(val(s), 1))]++;
  let max = 0, unreachable = 0, ones = 0;
  for (let i = 0; i < deg.length; i++) {
    if (deg[i] > max) max = deg[i];
    if (deg[i] === 0) unreachable++;
    if (deg[i] === 1) ones++;
  }
  AJ1 = { max, unreachable, ones, total: deg.length, allOne: ones === deg.length };
  log(`  state space (sum, lag): ${AJ1.total.toLocaleString()}`);
  log(`  maximum in-degree: ${AJ1.max}`);
  log(`  unreachable states: ${AJ1.unreachable}`);
  log(`  every state at in-degree exactly 1: ${AJ1.allOne}`);
  log('');
  log(`  and the reason is not self-reference. Every component is ADD, which AB2`);
  log(`  measured at zero bits erased. A map built of reversible parts is reversible,`);
  log(`  so a FORGETFUL two-word carry has the property just as much as an`);
  log(`  append-only history would. AI4 needed a special table; this needs nothing.`);
  log('');
  log(`  running it backwards, to show the inverse is explicit rather than abstract:`);
  const fwd = (s, l) => [T.add(s, l), T.add(s, 1)];
  const back = (s2, l2) => { const s = T.wrap(l2 - 1); return [s, T.wrap(s2 - s)]; };
  let ok = 0;
  for (const [s, l] of [[0, 0], [1, 1], [8, 13], [-40, 121], [364, -364]]) {
    const [a, b] = fwd(s, l); const [rs, rl] = back(a, b);
    if (rs === T.wrap(s) && rl === T.wrap(l)) ok++;
    log(`    (${s},${l}) -> (${a},${b}) -> (${rs},${rl})   ${rs === T.wrap(s) && rl === T.wrap(l) ? 'recovered' : 'LOST'}`);
  }
  log(`  recovered ${ok} of 5`);
}

/* ============================================================================
 * 2. AJ2 — H as a value map.
 * ========================================================================== */
log('\n' + line);
log('2. AJ2 — the number that comes out is not reversible');
log(line);
let AJ2 = null;
{
  // Every history of length 4 over the three trit values, mapped by H.
  const hist = [];
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1]) for (const d of [-1, 0, 1]) hist.push([a, b, c, d]);
  const H = h => h.reduce((x, y) => x + y, 0) + (h.length ? 1 : 0);
  const counts = new Map();
  for (const h of hist) { const v = H(h); counts.set(v, (counts.get(v) || 0) + 1); }
  const total = hist.length;
  let bits = 0;
  for (const n of counts.values()) bits += (n / total) * Math.log2(n);
  AJ2 = { histories: total, outputs: counts.size, bits };
  log(`  histories of length 4 over three values: ${total}`);
  log(`  distinct H outputs: ${counts.size}`);
  log(`  bits erased, by the AB measure: ${bits.toFixed(4)}`);
  log(`  above 3: ${bits > 3}`);
  log('');
  log(`  So the operator's reversibility lives in the STATE it carries, not in the`);
  log(`  number it emits. Anyone reading only the emitted value is reading an erasing`);
  log(`  channel however well-behaved the state map is.`);
}

/* ============================================================================
 * 3. AJ3 — self-hosting, and what it costs.
 * ========================================================================== */
log('\n' + line);
log('3. AJ3 — the operator, running in the machine that would price it');
log(line);
let AJ3 = null;
{
  const run = k => {
    const vm = new TryteVM({ input: [k], maxSteps: 60000 });
    loadInto(vm, SRC);
    let steps = 0;
    try { while (!vm.halted) { steps++; if (!vm.step()) break; } } catch (e) { return null; }
    return { out: vm.output.slice(), steps };
  };
  const r = run(9);
  const ref = A.ladder(9);
  log(`  machine : ${r.out.join(', ')}`);
  log(`  JS ref  : ${ref.join(', ')}`);
  log(`  agree   : ${r.out.join() === ref.join()}`);
  log(`  cost    : ${r.steps} instructions for 9 terms`);

  // Erasure along the trace, in the same currency AB and AC use.
  const { BY_CODE } = require('../src/isa.js');
  const vm = new TryteVM({ input: [9], maxSteps: 60000 });
  loadInto(vm, SRC);
  let bits = 0, priced = 0, skipped = 0;
  try {
    while (!vm.halted) {
      const op = BY_CODE[vm.read(vm.PC)];
      if (!op) break;
      const operand = vm.read(vm.PC + 1);
      const v = op.operand === 'addr' ? vm.read(operand) : operand;
      const e = E.erasureAt(op.name, v);
      if (e === null) skipped++; else { bits += e; priced++; }
      if (!vm.step()) break;
    }
  } catch (e) { /* fuel */ }
  const perStep = bits / priced;
  AJ3 = { agree: r.out.join() === ref.join(), steps: r.steps, bits, priced, perStep };
  log('');
  log(`  bits erased along the trace: ${bits.toFixed(2)} over ${priced} priced instructions`);
  log(`  per instruction: ${perStep.toFixed(4)} bits`);
  log(`  above 4: ${perStep > 4}`);
  log('');
  log(`  The mathematics is reversible and the implementation is not. STORE destroys`);
  log(`  the word it overwrites, and this program calls STORE on every turn of the`);
  log(`  loop. SELF-HOSTING DOES NOT INHERIT THE REVERSIBILITY OF THE THING HOSTED.`);
}

/* ============================================================================
 * 4. AJ4 — the price of never forgetting.
 * ========================================================================== */
log('\n' + line);
log('4. AJ4 — where a tryte runs out');
log(line);
let AJ4 = null;
{
  const seq = A.ladder(20);
  const first = seq.findIndex(v => v > T.TRYTE_MAX);
  AJ4 = { first, value: seq[first], max: T.TRYTE_MAX };
  log(`  a tryte holds ${T.TRYTE_MIN} .. ${T.TRYTE_MAX}`);
  log(`  the ladder: ${seq.slice(0, 17).join(', ')}`);
  log(`  first term above ${T.TRYTE_MAX}: term ${first}, value ${seq[first]}`);
  log(`  so fourteen terms fit and the fifteenth does not: ${first === 15}`);
  const vm = new TryteVM({ input: [18], maxSteps: 60000 });
  loadInto(vm, SRC);
  try { while (vm.step()); } catch (e) { /* */ }
  log('');
  log(`  the machine asked for 18 terms emits: ${vm.output.join(', ')}`);
  log(`  it wraps rather than growing, which is the only thing bounded memory can do`);
  log('');
  log(`  The price of a trajectory graph that cannot converge is a state that cannot`);
  log(`  be bounded. Every real machine erases for exactly this reason, and that is`);
  log(`  the trade an implied receipt has to buy its way out of rather than assume.`);
}

log('\n' + line);
log('Registered predictions AJ1-AJ4 are in this file\'s docstring. Outcomes go to');
log('FINDINGS.json and are asserted in test/test-selfref.js.');
log(line);

module.exports = { SRC, AJ1, AJ2, AJ3, AJ4 };
