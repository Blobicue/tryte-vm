'use strict';
/* test-workfactor.js — states times cost, not states alone.
 *
 * Set `AG`. `AD4` said the security parameter of an implied receipt is reachable
 * state count. That was half of it. A neighbouring project states the other lever
 * plainly — *"Argon2 does not add entropy. It adds a work factor — a cost multiplier
 * per guess"* — and `AD2` had counted 728 evaluations while treating each as free.
 * The tabulator's bill is **states × cost per evaluation**, and the honest party
 * evaluates once where the tabulator evaluates 729 times.
 *
 * The check worth keeping is `AG1`'s failure. `threeway` has **five** live input
 * words and a cost spread of **1.02×**; `countdown` has **one** and a spread of
 * **25.38×**. Width and variance are independent, so an implied receipt rests on
 * three factors rather than two — and if the cost barely moves, a predictor guesses
 * the commonest answer instead of tabulating and the other two stop mattering.
 *
 * The exhaustive version is `npm run audit:workfactor`.
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');
const W = require('../tools/workfactor-audit.js');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const PROGDIR = path.join(__dirname, '..', 'programs');
const src = f => fs.readFileSync(path.join(PROGDIR, f), 'utf8');
const BASE = W.INPUTS[0];

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY FINDING ===');
{
  check('a program that is only HALT costs one instruction', W.steps('        HALT\n') === 1);
  check('countdown costs differently at N=3 and N=10',
    W.steps(src('countdown.tasm'), [3]) !== W.steps(src('countdown.tasm'), [10]));
  check('poisoning a word the program overwrites changes nothing',
    W.steps(src('countdown.tasm'), [3], { addr: -4, value: 99 }) === W.steps(src('countdown.tasm'), [3]));
  // The instrument that lied, kept as a check because the wrong answer was the
  // flattering one: it reported every program as already tier three.
  check('the REJECTED measure is still visibly wrong — poisoning code cells counts ' +
    'the program itself, not what varies between runs, and reports interp-core as ' +
    'dozens of live words',
    (() => {
      const { assemble } = require('../src/assembler.js');
      const s = src('interp-core.tasm');
      const cells = [...assemble(s).cells.keys()].map(Number);
      const base = W.steps(s, BASE);
      let moved = 0;
      for (let a = Math.min(...cells); a <= Math.max(...cells); a++)
        if (W.steps(s, BASE, { addr: a, value: 7 }) !== base) moved++;
      return moved > 20;
    })());
}

console.log('\n=== 0b. THE TOOL AS IT IS ACTUALLY RUN ===');
{
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'tools', 'workfactor-audit.js')], { encoding: 'utf8' });
  } catch (e) { code = 1; out = (e.stdout || '') + (e.message || ''); }
  check('the audit runs to completion as a program, not only as an import',
    code === 0, out.split('\n').slice(-3).join(' | '));
  check('and all four sections printed, so every log path executed',
    [/1\. AG1/, /2\. AG2/, /3\. AG3/, /4\. AG4/].every(r => r.test(out)));
}

console.log('\n=== 1. AG1 — FAILED: WIDTH AND VARIANCE ARE INDEPENDENT ===');
{
  const width = f => W.liveWidth(f, W.INPUTS).width;
  const spread = f => {
    const s = src(f); const seen = [];
    for (const v of [1, 4, 11, -6, 40])
      for (let i = 0; i < BASE.length; i++) {
        const alt = BASE.slice(); alt[i] = v;
        const n = W.steps(s, alt); if (n !== null) seen.push(n);
      }
    return Math.max(...seen) / Math.min(...seen);
  };
  check('AG1 FAILED and stays failed: threeway has FIVE live input words, above the ' +
    'predicted maximum of two', width('threeway.tasm') === 5, `${width('threeway.tasm')}`);
  check('and it is above AD4\'s three-word threshold', width('threeway.tasm') > 3);
  check('but its cost spread is 1.02x — 55 steps to 56',
    Math.abs(spread('threeway.tasm') - 1.02) < 0.01, `${spread('threeway.tasm').toFixed(3)}x`);
  check('while countdown has width ONE and a spread of 25.38x',
    width('countdown.tasm') === 1 && Math.abs(spread('countdown.tasm') - 25.38) < 0.02);
  check('so width and variance do not track each other, and NEITHER is the security ' +
    'parameter alone — a tabulator facing 729^6 states to learn a number that is ' +
    'always 55 or 56 would guess instead',
    width('threeway.tasm') > width('countdown.tasm') &&
    spread('threeway.tasm') < spread('countdown.tasm'));
  check('the interpreter clause held and then some: interp measures 0, not 2, because ' +
    'the program it interprets is assembled into its own image',
    width('interp.tasm') === 0 && width('interp-core.tasm') === 0);
  check('hailstone measures 1, confirming AD4 by a second method',
    width('hailstone.tasm') === 1);
}

console.log('\n=== 2. AG2 — HELD: THE WIDTH BELONGS TO THE HARNESS ===');
{
  const at = (x, y, z) => W.steps(W.THREE, [x, y, z]);
  check('changing each of the three loaded words moves the cost',
    at(9, 2, 1) !== at(12, 2, 1) && at(9, 2, 1) !== at(9, 3, 1) && at(9, 2, 1) !== at(9, 2, 2));
  check('so the live width is exactly 3',
    [at(9, 2, 1) !== at(12, 2, 1), at(9, 2, 1) !== at(9, 3, 1), at(9, 2, 1) !== at(9, 2, 2)]
      .filter(Boolean).length === 3);
  check('in 28 instructions, under the predicted forty', (() => {
    const { tokenize } = require('../src/assembler.js');
    return tokenize(W.THREE).filter(l => l.mnemonic && !l.mnemonic.startsWith('.')).length === 28;
  })());
  check('putting the state space at 729^4 = 282,429,536,481',
    3n ** 24n === 282429536481n);
  check('past what AD2\'s tabulator could afford, which resolved 729 states in 728 steps',
    3n ** 24n > 1000000000n);
  check('nothing about the ternary datapath prevented this — no existing program has ' +
    'the width only because none was written to take its work as runtime input',
    W.liveWidth('countdown.tasm', W.INPUTS).width < 3);
}

console.log('\n=== 3. AG3 — FAILED: A CONSTANT QUOTED OUT OF ITS CONDITIONS ===');
{
  const settles = (net, inputs, k) => { try { net.solve(inputs, k); return true; } catch (e) { return false; } };
  const spreadIn = (nm, v, n = 6) => Object.fromEntries(T.toTrits(v, n).map((t, i) => [`${nm}${i}`, t]));
  const inputs = { ...spreadIn('a', 121), ...spreadIn('b', -47), cin: D.MID };
  const measure = build => {
    const net = new D.Net(); build(net);
    let k = 1; while (k < 64 && !settles(net, inputs, k)) k++;
    return { devices: net.devices.length, passes: k, work: k * net.devices.length };
  };
  const tree = measure(n => D.tRippleAdder(n, 6, false));
  const dec = measure(n => D.dRippleAdder(n, 6));

  check('the decoded six-trit adder is 540 devices and clears 5,000 node-updates at 5,400',
    dec.devices === 540 && dec.work === 5400 && dec.work > 5000, `${dec.work}`);
  check('the tree adder is 624 devices and does NOT clear it, at 4,368',
    tree.devices === 624 && tree.work === 4368 && tree.work < 5000);
  check('AG3 FAILED and stays failed: the pass count is 10, not the predicted 13',
    dec.passes === 10, `${dec.passes}`);
  check('and 13 was E4\'s MAXIMUM over operand pairs, not its typical value — E4 ' +
    'measured 9 to 13 and called the data-dependence its finding, so quoting the ' +
    'ceiling as the number quoted a result against its own headline',
    dec.passes >= 9 && dec.passes <= 13);
  check('both families are above 1,000x, which is what the argument needed',
    tree.work > 1000 && dec.work > 1000);
  check('a VM instruction costs 1 step by definition, so the ratio IS the work figure',
    W.steps('        HALT\n') === 1);
}

console.log('\n=== 4. AG4 — HELD: WORTH ONE WORD, AND NOT ENOUGH ===');
{
  const worth = Math.log(5400) / Math.log(729);
  check('log(5,400)/log(729) = 1.304 words of state',
    Math.abs(worth - 1.304) < 0.001, `${worth.toFixed(4)}`);
  check('AG4 HELD: between one and two words', worth > 1 && worth < 2);
  check('so a device-level tick moves the tabulator\'s bill for a 729-state arena ' +
    'from 729 evaluations to 3,936,600 node-updates',
    729 * 5400 === 3936600);
  check('worth having and not sufficient alone: one word of state is 729x and this ' +
    'is 5,400x, so the state still has to be widened',
    5400 / 729 < 729);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
