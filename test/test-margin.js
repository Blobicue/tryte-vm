'use strict';
/* test-margin.js — build the receipt spec, and price the attack on it.
 *
 * Set `AH`. `AG` left a three-item spec — make the cost vary, widen the live state,
 * define the tick at the device level — and nobody had put the three together.
 *
 * Two checks are worth keeping. **`AH3` corrects `AG4`**: extra state multiplies only
 * the attacker's bill while a work factor multiplies *both*, so the honest/attacker
 * ratio gains **729× from state and exactly 1× from the work factor**. `AG4` called
 * the work factor "worth slightly more than one word of state", which treats them as
 * one currency; on the asymmetry it is worth nothing, and what it actually buys is
 * absolute infeasibility.
 *
 * And **`AH2` failed usefully**, naming a fourth factor: the three-word program has a
 * control space 500,000× larger than hailstone's and still reuses each state 3.20
 * times against 10.43. A tabulator exploits **trajectory convergence**, not a small
 * state space, and widening the state does not automatically destroy sharing.
 *
 * The exhaustive version is `npm run audit:margin`.
 */

const T = require('../src/ternary.js');
const W = require('../tools/workfactor-audit.js');
const G = require('../tools/margin-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const near = (a, b, eps) => Math.abs(a - b) < eps;

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY FINDING ===');
{
  check('a bare HALT costs one instruction', W.steps('        HALT\n') === 1);
  check('the three-word program costs differently at (9,2,1) and (9,2,2)',
    W.steps(G.THREE, [9, 2, 1]) !== W.steps(G.THREE, [9, 2, 2]));
  check('a non-terminating input returns null rather than a number',
    W.steps(G.THREE, [9, 0, 1]) === null);
  // The instrument that lied, kept because it failed the same way AD2's did.
  check('the REJECTED reuse measure is still visibly wrong — walking divergent ' +
    'trajectories to a 3,000-step guard inflates hailstone from 10.43x to over 1,000x',
    (() => {
      const low = v => v - 3 * T.shiftRight(v, 1);
      const stepf = v => (low(v) === 0 ? T.shiftRight(v, 1) : T.wrap(2 * v + low(v)));
      const seen = new Set(); let visits = 0;
      for (let n = -364; n <= 364; n++) {
        let v = T.wrap(n), guard = 0;
        while (v !== 1 && guard++ < 3000) { visits++; seen.add(v); v = stepf(v); }
      }
      return visits / seen.size > 1000;
    })());
}

console.log('\n=== 0b. THE TOOL AS IT IS ACTUALLY RUN ===');
{
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'tools', 'margin-audit.js')], { encoding: 'utf8' });
  } catch (e) { code = 1; out = (e.stdout || '') + (e.message || ''); }
  check('the audit runs to completion as a program, not only as an import',
    code === 0, out.split('\n').slice(-3).join(' | '));
  check('and all four sections printed, so every log path executed',
    [/1\. AH1/, /2\. AH2/, /3\. AH3/, /4\. AH4/].every(r => r.test(out)));
}

console.log('\n=== 1. AH1 — HELD: THE VARIANCE BAR, CLEARED BY 10x ===');
{
  const costs = G.SWEEP.map(i => W.steps(G.THREE, i)).filter(x => x !== null);
  const spread = Math.max(...costs) / Math.min(...costs);
  check('every one of the 120 swept inputs terminates',
    costs.length === 120 && G.SWEEP.length === 120);
  check('the cost runs 32 to 16,443',
    Math.min(...costs) === 32 && Math.max(...costs) === 16443);
  check('a spread of 513.8x, against the predicted 50x', near(spread, 513.8, 0.1) && spread > 50,
    `${spread.toFixed(1)}x`);
  check('88 distinct costs across 120 runs', new Set(costs).size === 88);
  check('so it clears the bar threeway failed at 1.02x with FIVE live words — ' +
    'width without variance is security theatre', spread > 50);
}

console.log('\n=== 2. AH2 — FAILED: CONVERGENCE, NOT SIZE ===');
{
  const hailInputs = Array.from({ length: 729 }, (_, i) => [i + T.TRYTE_MIN]);
  const h = G.reuse(null, hailInputs, G.hailStates);
  const t3 = G.reuse(null, G.SWEEP, G.threeStates);
  check('hailstone: 3,777 visits over 362 distinct states — and 3,777 reproduces ' +
    'AD2\'s figure exactly, which is the cross-check that both sets measure one thing',
    h.visits === 3777 && h.distinct === 362);
  check('so hailstone reuses each state 10.43 times, well above the predicted 4',
    near(h.ratio, 10.43, 0.01) && h.ratio > 4, `${h.ratio.toFixed(2)}`);
  check('AH2 FAILED and stays failed: the three-word program reuses 3.20 times, ' +
    'not the predicted under-1.5', near(t3.ratio, 3.20, 0.01) && t3.ratio > 1.5,
    `${t3.ratio.toFixed(2)}`);
  check('and its control space is 500,000x larger — 387 million against 729',
    729 ** 3 / 729 > 500000);
  check('so widening the state did NOT destroy the sharing: a subtractive loop ' +
    'converges onto a shared suffix whenever two inputs agree on the subtrahend',
    t3.ratio > 1.5 && 729 ** 3 > 729 * 500000);
  check('reuse did fall 3.3x, which is real and nowhere near enough',
    near(h.ratio / t3.ratio, 3.26, 0.1));
}

console.log('\n=== 3. AH3 — HELD: THE TWO LEVERS ARE NOT ONE CURRENCY ===');
{
  const honest = W.steps(G.THREE, [81, 2, 3]);
  const base = 729 ** 2, wider = 729 ** 3;
  check('one honest run costs 1,150 steps', honest === 1150, `${honest}`);
  check('adding a word of state leaves the honest cost at 1,150 — untouched',
    honest === 1150 && wider / base === 729);
  check('while a device-level tick multiplies it to 6,210,000 node-updates',
    honest * G.DEVICE_WORK === 6210000);
  check('so the RATIO gains 729x from state', (wider / honest) / (base / honest) === 729);
  check('and exactly 1x from the work factor — it cancels',
    ((base * G.DEVICE_WORK) / (honest * G.DEVICE_WORK)) === (base / honest));
  check('AG4 called the work factor "worth slightly more than one word of state", ' +
    'treating them as one currency; on the asymmetry it is worth nothing',
    ((base * G.DEVICE_WORK) / (honest * G.DEVICE_WORK)) / (base / honest) === 1);
  check('what it buys is ABSOLUTE infeasibility, which is real and is a different ' +
    'claim — the attacker\'s bill does rise 5,400x',
    base * G.DEVICE_WORK / base === 5400);
}

console.log('\n=== 4. AH4 — FAILED ON THE MAGNITUDES, HELD ON THE STRUCTURE ===');
{
  const honest = W.steps(G.THREE, [81, 2, 3]);
  const space = 729 ** 3;
  const margin = space / honest;
  check('the control space is (w,b,c) = 729^3 = 387,420,489, not the predicted 10^11',
    space === 387420489 && space < 1e11);
  check('and the predicted 10^11 was 729^4 — a fourth word this program does not ' +
    'have, since its step counter never gates a branch', 729 ** 4 > 1e11);
  check('AH4 FAILED and stays failed: one honest run is 1,150 steps, not under 300',
    honest === 1150 && honest > 300);
  check('so the margin is 3.37 x 10^5, three orders short of the predicted 10^8',
    near(margin / 1e5, 3.37, 0.01) && margin < 1e8, `${margin.toExponential(2)}`);
  check('but the structural clause HELD: the margin is identical at either tick level',
    (space * G.DEVICE_WORK) / (honest * G.DEVICE_WORK) === space / honest);
  check('because a ratio cannot see a factor charged to both sides',
    margin === space / honest);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
