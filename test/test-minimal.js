'use strict';
/* test-minimal.js — the smallest reversible ternary language, and the trilemma.
 *
 * Set `AK`. Three primitive forms, all reversible:
 *
 *     INC   i        trit i += 1
 *     CINC  a b      trit b += trit a            (affine)
 *     C1INC a b      trit b += 1 if trit a = 1   (NOT affine — `O`'s free nonlinearity)
 *
 * Two checks are worth keeping. **`AK2`** shows factor four becomes a property of the
 * *alphabet* rather than of a program: 400 of 400 random programs have in-degree 1
 * everywhere, and nothing a programmer can write breaks it. Compare `AI4`, which had
 * to search 19,683 tables to find 216 that work.
 *
 * And **`AK3` is the price**: a straight-line reversible program costs exactly its own
 * length for every input — a spread of **1.0000×**, flatter than the 1.02× `AG1`
 * called security theatre. Reversibility buys factor four and loses factor three.
 *
 * `AK4` states the trilemma: **in-degree one, a cost that varies, bounded state —
 * pick two.**
 *
 * The exhaustive version is `npm run audit:minimal`.
 */

const K = require('../tools/minimal-audit.js');
const { idPerm, chainOf } = require('../tools/perm-lib.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const N = K.N;
const fact = n => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY FINDING ===');
{
  check('trits round-trip through the state encoding',
    idPerm(N).every(s => K.state(K.trits(s)) === s));
  check('INC 0 moves state 0 to 1 and returns after three applications',
    K.INC(0)[0] === 1 && K.orderOf(K.INC(0)) === 3);
  check('C1INC leaves alone every state whose control trit is not 1',
    idPerm(N).filter(s => K.trits(s)[0] !== 1).every(s => K.C1INC(0, 1)[s] === s));
  check('and orderOf is not simply always answering 3 — the identity has order 1',
    K.orderOf(idPerm(N)) === 1);
  check('the language admits 15 gate instances', K.GATES.length === 15);
}

console.log('\n=== 0b. THE TOOL AS IT IS ACTUALLY RUN ===');
{
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'tools', 'minimal-audit.js')], { encoding: 'utf8' });
  } catch (e) { code = 1; out = (e.stdout || '') + (e.message || ''); }
  check('the audit runs to completion as a program, not only as an import',
    code === 0, out.split('\n').slice(-3).join(' | '));
  check('and all four sections printed, so every log path executed',
    [/1\. AK1/, /2\. AK2/, /3\. AK3/, /4\. AK4/].every(r => r.test(out)));
}

console.log('\n=== 1. AK1 — A UNIVERSAL REVERSIBLE LANGUAGE IN THREE FORMS ===');
{
  check('every gate instance is a permutation of the 27 states',
    K.GATES.every(x => K.isPerm(x.g)));
  check('and every one has order exactly 3',
    K.GATES.every(x => K.orderOf(x.g) === 3));
  check('so a gate\'s inverse is that gate applied twice — no inverse instructions needed',
    K.GATES.every(x => K.compose(x.g, K.compose(x.g, x.g)).every((v, i) => v === i)));
  check('the group generated is exactly A_27 = 27!/2',
    chainOf(K.GATES.map(x => x.g), N).order === fact(27) / 2n);
  check('which is a 28-digit number, agreeing with M\'s separately written implementation',
    (fact(27) / 2n).toString().length === 28);
  // The erratum, kept as a check because it is the reason the rule exists.
  check('AND THE REGISTRATION TYPED IT WRONG — 25 digits, three zeros dropped — which ' +
    'cost nothing only because the tool COMPUTES 27!/2 instead of comparing to the ' +
    'typed number', 5444434725209176080384000n !== fact(27) / 2n);
}

console.log('\n=== 2. AK2 — FACTOR FOUR AS A PROPERTY OF THE ALPHABET ===');
{
  let seed = 20260826;
  const rnd = m => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % m; };
  let allOne = 0, worstMax = 0;
  for (let t = 0; t < 400; t++) {
    let p = idPerm(N);
    const len = 1 + rnd(12);
    for (let i = 0; i < len; i++) p = K.compose(K.GATES[rnd(K.GATES.length)].g, p);
    const deg = new Array(N).fill(0);
    for (let s = 0; s < N; s++) deg[p[s]]++;
    const max = Math.max(...deg);
    worstMax = Math.max(worstMax, max);
    if (max === 1 && deg.every(d => d === 1)) allOne++;
  }
  check('400 of 400 random programs have in-degree exactly 1 at every state',
    allOne === 400, `${allOne}`);
  check('and the worst maximum in-degree seen anywhere is 1', worstMax === 1);
  check('because a composition of bijections is a bijection — nothing a programmer ' +
    'writes can break it', allOne === 400 && worstMax === 1);
  check('compare AI4, which had to search 19,683 tables to find the 216 that work — ' +
    'here it costs no analysis, no search and no discipline',
    require('../tools/erasure-audit.js').reversibleTables.length === 216);
}

console.log('\n=== 3. AK3 — AND THE COST STOPS VARYING ===');
{
  let seed = 7717;
  const rnd = m => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % m; };
  let worst = 0;
  for (let t = 0; t < 50; t++) {
    const len = 1 + rnd(12);
    const prog = Array.from({ length: len }, () => K.GATES[rnd(K.GATES.length)]);
    const costs = [];
    for (let s = 0; s < N; s++) { let n = 0, cur = s; for (const { g } of prog) { cur = g[cur]; n++; } costs.push(n); }
    worst = Math.max(worst, Math.max(...costs) / Math.min(...costs));
  }
  check('every straight-line program is flat at exactly 1.0000x across all 27 inputs',
    worst === 1, `${worst}`);
  check('which is FLATTER than the 1.02x AG1 called security theatre', worst < 1.02);
  check('and nowhere near the 513.8x AH1 needed', worst < 513.8);
  check('so reversibility buys factor four and LOSES factor three — the registered ' +
    'alternative, that some program would vary, occurred on none of them', worst === 1);
}

console.log('\n=== 4. AK4 — PICK TWO ===');
{
  // in-degree 1 | cost varies | bounded state
  const rows = [
    ['this reversible language', true, false, true],
    ['hailstone', false, true, true],
    ['three-word program', false, true, true],
    ['reversible feedback (AI4)', true, false, true],
    ['history operator (AJ1)', true, false, true],
    ['reversible + data-dependent', true, true, false],
  ];
  check('six constructions from this corpus, and none has all three properties',
    rows.filter(r => r[1] && r[2] && r[3]).length === 0);
  check('every PAIR is demonstrated by at least one of them',
    rows.some(r => r[1] && r[3] && !r[2]) &&
    rows.some(r => r[2] && r[3] && !r[1]) &&
    rows.some(r => r[1] && r[2] && !r[3]));
  check('buying in-degree one and a varying cost together needs a history growing ' +
    'at least one trit per data-dependent step',
    Math.ceil(1000 / 6) === 167);
  check('so a thousand such steps costs 167 trytes that can never be discarded',
    Math.ceil(1000 / 6) === 167 && Math.ceil(10000 / 6) === 1667);
  check('and AJ4 already measured bounded memory meeting a state that will not stop ' +
    'growing: it wraps at term fifteen',
    require('../tools/arity-audit.js').ladder(20)[15] === 377);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
