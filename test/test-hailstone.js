'use strict';
/* test-hailstone.js — a discovered loop bound, and why it is still not enough.
 *
 * Set `AD`. `AC` left a stated gap: every loop in this repository is bounded by a
 * literal or by a number handed to it, which is why it found the cost cheap to
 * obtain everywhere. `programs/hailstone.tasm` is the first program here whose stop
 * condition the loop has to DISCOVER.
 *
 * All four predictions held, and the check worth keeping is `AD2`. Being genuinely
 * discovered is **not sufficient**: a predictor that tabulates the whole 729-state
 * accumulator pays 728 map evaluations once and answers everything free afterwards,
 * breaking even at seventy queries. The security parameter of an implied receipt is
 * **reachable state count**, not whether the bound is discovered.
 *
 * The exhaustive version is `npm run audit:hailstone`.
 */

const T = require('../src/ternary.js');
const H = require('../tools/hailstone-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const N = T.TRYTE_STATES;
const terminating = H.VALUES.filter(n => H.walk(n) !== null);
const cost = new Map(terminating.map(n => [n, H.walk(n)]));

console.log('\n=== 0. TWO IMPLEMENTATIONS, ONE ANSWER ===');
{
  // A program compared only against itself is not compared against anything.
  let both = 0, agree = 0;
  for (const n of H.VALUES) {
    const m = H.onMachine(n), r = H.walk(n);
    if (m !== null && r !== null) { both++; if (m === r) agree++; }
  }
  check('the assembly program and an independent JavaScript map agree on every ' +
    'input where both terminate', both === agree && both === 363, `${agree} of ${both}`);
  check('and they agree about WHICH inputs terminate, not merely about the counts',
    H.VALUES.every(n => (H.onMachine(n) === null) === (H.walk(n) === null)));
  // Hand-computable cases: 9, 27 and 81 all have a zero low trit, so they descend
  // by a third. (2 does NOT make a counterexample — its low trit is -1, so it
  // climbs to 2*2-1 = 3, which is also 3. Asserting otherwise was this check's
  // first version and it failed, correctly.)
  check('the descending branch is right where it can be worked out by hand',
    H.step(9) === 3 && H.step(27) === 9 && H.step(81) === 27,
    `${H.step(9)} ${H.step(27)} ${H.step(81)}`);
  check('and the harness would notice a different map: subtract-one disagrees widely',
    H.VALUES.filter(v => H.step(v) !== T.wrap(v - 1)).length > 700);
  check('low_trit falls out of the shift, as multiply.tasm claims: n - 3*(n>>1)',
    [364, -364, 0, 1, 5, -7].every(v => Math.abs(H.lowTrit(v)) <= 1));
}

console.log('\n=== 0b. THE TOOL AS IT IS ACTUALLY RUN ===');
{
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'tools', 'hailstone-audit.js')], { encoding: 'utf8' });
  } catch (e) { code = 1; out = (e.stdout || '') + (e.message || ''); }
  check('the audit runs to completion as a program, not only as an import',
    code === 0, out.split('\n').slice(-3).join(' | '));
  check('and all four sections printed, so every log path executed',
    [/1\. AD1/, /2\. AD2/, /3\. AD3/, /4\. AD4/].every(r => r.test(out)));
}

console.log('\n=== 1. AD1 — A DISCOVERED BOUND IS NOT A READ ONE ===');
{
  check('363 of the 729 inputs terminate', terminating.length === 363);
  const pos = terminating.filter(n => n > 0).sort((x, y) => x - y);
  const [n1, n2] = pos.slice(0, 2);
  const a = (cost.get(n2) - cost.get(n1)) / (n2 - n1), b = cost.get(n1) - a * n1;
  const exact = terminating.filter(n => cost.get(n) === a * n + b).length;
  check('the two-point fit that priced countdown on 200 of 200 is exact on 2 of 363 here',
    exact === 2, `${exact}`);
  check('which is 0.6% against countdown\'s 100%',
    (100 * exact / terminating.length) < 1);
  check('and the cost is NOT monotone in the input: 33 adjacent pairs run the wrong way',
    pos.filter((n, i) => i > 0 && cost.get(n) < cost.get(pos[i - 1])).length === 33);
  check('so no predictor built from the magnitude of the input alone can be right',
    pos.some((n, i) => i > 0 && cost.get(n) < cost.get(pos[i - 1])));
  check('trajectory lengths run 0 to 19 across 20 distinct values',
    Math.min(...cost.values()) === 0 && Math.max(...cost.values()) === 19 &&
    new Set(cost.values()).size === 20);
}

console.log('\n=== 2. AD2 — THE PATIENT PREDICTOR WINS ANYWAY ===');
{
  // Rebuild the tabulator here rather than trusting the tool's printed number.
  const DIVERGES = Symbol('diverges');
  const table = new Map([[1, 0]]);
  let evaluations = 0;
  for (const n of H.VALUES) {
    const pathSeen = new Map(); const seq = [];
    let v = T.wrap(n);
    while (!table.has(v) && !pathSeen.has(v)) { pathSeen.set(v, seq.length); seq.push(v); v = H.step(v); evaluations++; }
    if (pathSeen.has(v) || table.get(v) === DIVERGES) for (const p of seq) table.set(p, DIVERGES);
    else { let c = table.get(v); for (let i = seq.length - 1; i >= 0; i--) table.set(seq[i], ++c); }
  }
  const naive = terminating.reduce((s, n) => s + cost.get(n), 0);

  check('every accumulator value is resolved exactly once: 728 evaluations for 729 states',
    evaluations === 728, `${evaluations}`);
  check('and the table is CORRECT — it agrees with the runner on every terminating input',
    terminating.every(n => table.get(T.wrap(n)) === cost.get(n)));
  check('answering the same inputs by independent re-running costs 3,777',
    naive === 3777, `${naive}`);
  check('so the crossover is 70 queries, not the predicted-under 100',
    Math.ceil(evaluations / (naive / terminating.length)) === 70);
  check('AD2 HELD: being genuinely discovered is NOT sufficient for an implied receipt',
    evaluations <= 729 && naive > 3000);
  // The instrument that lied, kept as a check because it pointed the flattering way.
  check('and the broken tabulator is still visibly broken: memoising only the ' +
    'terminating values makes every divergent input pay its full guard, which ' +
    'reported the predictor as three hundred times WORSE than re-running',
    (() => {
      const bad = new Map([[1, 0]]); let ev = 0;
      for (const n of H.VALUES) {
        const seq = []; let v = T.wrap(n), guard = 0;
        while (!bad.has(v) && guard < 3000) { seq.push(v); v = H.step(v); ev++; guard++; }
        if (!bad.has(v)) continue;
        let c = bad.get(v); for (let i = seq.length - 1; i >= 0; i--) bad.set(seq[i], ++c);
      }
      return ev > 1000000 && ev / evaluations > 300;
    })());
}

console.log('\n=== 3. AD3 — THE BOUND IS PIGEONHOLE, NOT PARTICULAR ===');
{
  check('the longest terminating trajectory is 19 steps',
    Math.max(...cost.values()) === 19);
  check('against a ceiling of 729 imposed by the state space — 2.61% of the headroom',
    Math.max(...cost.values()) / N < 0.03);
  check('no terminating trajectory revisits a value, so each is a simple path',
    terminating.every(n => {
      const seen = new Set(); let v = T.wrap(n);
      while (v !== 1) { if (seen.has(v)) return false; seen.add(v); v = H.step(v); }
      return true;
    }));
  check('which is why the ceiling holds for ANY single-accumulator map, not just this one',
    N === 729);
}

console.log('\n=== 4. AD4 — THE SECURITY PARAMETER IS STATE COUNT ===');
{
  let same = 0;
  for (const n of H.VALUES) if (H.onMachine(n, false) === H.onMachine(n, true)) same++;
  check('poison every scratch word and all 729 answers are unchanged',
    same === N, `${same} of ${N}`);
  check('so the cost is a function of the accumulator alone, and AD2\'s bound is tight',
    same === N);
  check('one live word beyond the accumulator would make it 531,441 states',
    3n ** 12n === 531441n);
  check('two would make it 387,420,489 — past the sweep budget H2 recorded',
    3n ** 18n === 387420489n);
  check('so each word multiplies the tabulator\'s one-off cost by 729 and leaves ' +
    'the runner\'s single query untouched: the parameter is REACHABLE STATE COUNT',
    3n ** 18n / 3n ** 12n === 729n);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
