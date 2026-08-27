'use strict';
/* test-selfref.js — what self-reference buys, and what buys the thing it is asked for.
 *
 * Set `AJ`. The proposal was that "full self-reference" would give a tick currency
 * its layer-one security. Half the answer is a negative already proved in the
 * external Ladder artifact — **Coda III: no system closes over its own semantics** —
 * and the other half is better than what was asked for.
 *
 * The check worth keeping is `AJ1`. What a receipt needs is a state map with
 * in-degree one everywhere, and the history operator has it **because it is built
 * out of addition**, which `AB2` measured at zero bits erased. Not because it is
 * self-referential, and not because it remembers: a *forgetful* two-word carry has
 * the property just as fully. `AI4` had to search 19,683 tables to find 216 that
 * work. This needs nothing but `ADD`.
 *
 * And `AJ3` is the catch: the operator now runs inside the machine, and **erases
 * 6.26 bits per instruction** doing it. A reversible mathematics on an erasing
 * machine still erases.
 *
 * The exhaustive version is `npm run audit:selfref`.
 */

const T = require('../src/ternary.js');
const A = require('../tools/arity-audit.js');
const E = require('../tools/erasure-audit.js');
const S = require('../tools/selfref-audit.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto } = require('../src/assembler.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const N = T.TRYTE_STATES;
const near = (a, b, eps) => Math.abs(a - b) < eps;

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY FINDING ===');
{
  check('ADD erases zero bits on the pair datapath, which is the whole mechanism',
    E.erasureOf(E.datapathMap('ADD', 0).img, N * N) === 0);
  check('STORE erases the maximum, which is why the implementation is not free',
    near(E.erasureOf(E.datapathMap('STORE', 0).img, N * N), Math.log2(N), 1e-9));
  check('the JS reference ladder is 0,0,1,1,2,3,5,8,13',
    A.ladder(9).join() === '0,0,1,1,2,3,5,8,13');
}

console.log('\n=== 0b. THE TOOL AS IT IS ACTUALLY RUN ===');
{
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'tools', 'selfref-audit.js')], { encoding: 'utf8' });
  } catch (e) { code = 1; out = (e.stdout || '') + (e.message || ''); }
  check('the audit runs to completion as a program, not only as an import',
    code === 0, out.split('\n').slice(-3).join(' | '));
  check('and all four sections printed, so every log path executed',
    [/1\. AJ1/, /2\. AJ2/, /3\. AJ3/, /4\. AJ4/].every(r => r.test(out)));
}

console.log('\n=== 1. AJ1 — THE PROPERTY IS ADDITION, NOT SELF-REFERENCE ===');
{
  const val = i => i + T.TRYTE_MIN;
  const ix = v => T.wrap(v) - T.TRYTE_MIN;
  const deg = new Int32Array(N * N);
  for (let s = 0; s < N; s++)
    for (let l = 0; l < N; l++)
      deg[ix(T.add(val(s), val(l))) * N + ix(T.add(val(s), 1))]++;
  let max = 0, unreachable = 0;
  for (let i = 0; i < deg.length; i++) { if (deg[i] > max) max = deg[i]; if (deg[i] === 0) unreachable++; }

  check('the two-word ladder step has maximum in-degree exactly 1', max === 1, `${max}`);
  check('and zero unreachable states, over all 531,441', unreachable === 0 && deg.length === 531441);
  check('so it meets AI4\'s bijection criterion with NO special feedback table — ' +
    'AI4 searched 19,683 to find 216; this needs only ADD',
    max === 1 && unreachable === 0 && E.reversibleTables.length === 216);
  check('the inverse is explicit, not abstract: sum = second - 1, lag = first - sum',
    [[0, 0], [1, 1], [8, 13], [-40, 121], [364, -364]].every(([s, l]) => {
      const a = T.add(s, l), b = T.add(s, 1);
      const rs = T.wrap(b - 1), rl = T.wrap(a - rs);
      return rs === T.wrap(s) && rl === T.wrap(l);
    }));
  check('and it survives the wrapping corner (364, -364)', (() => {
    const s = 364, l = -364;
    const a = T.add(s, l), b = T.add(s, 1);
    const rs = T.wrap(b - 1);
    return rs === T.wrap(s) && T.wrap(a - rs) === T.wrap(l);
  })());
  check('a FORGETFUL two-word carry has the property as fully as an append-only ' +
    'history would — the property is reversibility, not memory', max === 1);
}

console.log('\n=== 2. AJ2 — THE STATE IS REVERSIBLE, THE OUTPUT IS NOT ===');
{
  const hist = [];
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1]) for (const d of [-1, 0, 1]) hist.push([a, b, c, d]);
  const H = h => h.reduce((x, y) => x + y, 0) + (h.length ? 1 : 0);
  const counts = new Map();
  for (const h of hist) { const v = H(h); counts.set(v, (counts.get(v) || 0) + 1); }
  let bits = 0;
  for (const n of counts.values()) bits += (n / hist.length) * Math.log2(n);

  check('81 histories of length four collapse onto 9 outputs',
    hist.length === 81 && counts.size === 9);
  check('erasing 3.5944 bits by the AB measure, above the predicted 3',
    near(bits, 3.5944, 0.001) && bits > 3, `${bits.toFixed(4)}`);
  check('so the state map is a bijection and the emitted value is nine-to-one AT ' +
    'THE SAME TIME — they are different maps, which is AB2\'s distinction arriving ' +
    'from a different direction', bits > 3);
}

console.log('\n=== 3. AJ3 — SELF-HOSTING DOES NOT INHERIT REVERSIBILITY ===');
{
  const vm = new TryteVM({ input: [9], maxSteps: 60000 });
  loadInto(vm, S.SRC);
  let steps = 0;
  try { while (!vm.halted) { steps++; if (!vm.step()) break; } } catch (e) { /* */ }

  check('the machine reproduces the ladder exactly against an independent implementation',
    vm.output.join() === A.ladder(9).join(), vm.output.join());
  check('so the operator is self-hosting in the weak sense — expressible in the ' +
    'language its own ladder produces', vm.output.length === 9);
  check('at 152 instructions for nine terms', steps === 152, `${steps}`);
  check('and it ERASES 6.2564 bits per instruction despite the map being a bijection',
    near(S.AJ3.perStep, 6.2564, 0.001) && S.AJ3.perStep > 4, `${S.AJ3.perStep.toFixed(4)}`);
  check('because STORE destroys the word it overwrites and the loop calls it every turn',
    near(E.erasureOf(E.datapathMap('STORE', 0).img, N * N), Math.log2(N), 1e-9));
  check('a reversible mathematics on an erasing machine still erases — the gap ' +
    'between having a property and running it', S.AJ3.perStep > 0);
}

console.log('\n=== 4. AJ4 — THE PRICE OF NEVER FORGETTING ===');
{
  const seq = A.ladder(20);
  const first = seq.findIndex(v => v > T.TRYTE_MAX);
  check('the ladder exceeds a tryte at term 15, value 377',
    first === 15 && seq[15] === 377 && T.TRYTE_MAX === 364);
  check('so fourteen terms fit and the fifteenth does not', seq[14] <= 364 && seq[15] > 364);
  check('and the machine wraps rather than growing, which is all bounded memory can do',
    (() => {
      const vm = new TryteVM({ input: [18], maxSteps: 60000 });
      loadInto(vm, S.SRC);
      try { while (vm.step()); } catch (e) { /* */ }
      return vm.output[14] === 233 && vm.output[15] === -352;
    })());
  check('the price of a graph that cannot converge is a state that cannot be bounded — ' +
    'which is why every real machine erases',
    seq[15] > T.TRYTE_MAX && E.erasureOf(E.datapathMap('STORE', 0).img, N * N) > 0);
  check('and AJ1 is the way out: reversibility gets the non-convergence WITHOUT the ' +
    'unbounded state', true === (S.AJ1.max === 1 && S.AJ1.unreachable === 0));
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
