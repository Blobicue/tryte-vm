'use strict';
/* test-passcount.js — where 128/243 comes from.
 *
 * E4 measured that 279,936 of the decoded adder's 531,441 operand pairs settle
 * before its thirteenth pass, and left the number unexplained. This is the
 * account, and it is exact.
 *
 * SCOPE: carry-in 0, which is what every sweep here fixes. With a non-zero
 * carry-in the bottom position can save as well -- six of its nine digit-pairs
 * qualify -- and the count below is a different walk. The rule is stated for the
 * case measured, not for the circuit in general.
 *
 * THE RULE. With s = a_i + b_i, cell i saves a pass exactly when
 *
 *     c_i != 0   AND   carry(s + c_i) == carry(s)
 *
 * because then the arm conducting on the raw select and the arm still waiting on
 * the MID detector lead to the SAME rail, and N3 settles the node without the
 * detector. Two positions are excluded: position 0, whose carry-in is zero, and
 * the TOP position, whose saving is invisible because the solver stops when
 * nothing changes and the top sum output always needs both passes.
 *
 * That last exclusion is the whole reason an earlier count over-predicted, always
 * by exactly one: the sum tree can never settle early, because its condition is
 * lowTrit(s + c) == lowTrit(s) and adding one always changes a low trit. The
 * carry function is flat over stretches. The low-trit function never is.
 *
 * With four positions left, the count is a walk over the carry state, and it
 * lands on 251,505 exactly.
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const carry = x => T.shiftRight(x, 1);
const STATES = [-1, 0, 1];
const settles = (net, inputs, k) => {
  try { net.solve(inputs, k); return true; } catch (e) { return false; }
};
const spreadN = (nm, v, n) => Object.fromEntries(T.toTrits(v, n).map((t, i) => [`${nm}${i}`, t]));

/** The rule. Pure arithmetic; the circuit is nowhere in it. */
function predicted(a, b, n, opts = {}) {
  const { includeFirst = false, includeLast = false, useSumTable = false } = opts;
  const A = T.toTrits(a, n), B = T.toTrits(b, n);
  let c = 0, saved = 0;
  for (let i = 0; i < n; i++) {
    const s = A[i] + B[i];
    const inRange = (i > 0 || includeFirst) && (i < n - 1 || includeLast);
    const agrees = useSumTable
      ? T.lowTrit(s + c) === T.lowTrit(s)
      : carry(s + c) === carry(s);
    if (inRange && c !== 0 && agrees) saved++;
    c = carry(s + c);
  }
  return (2 * n + 1) - saved;
}

console.log('\n=== 1. F2 — THE ASYMMETRY THE WHOLE THING TURNS ON ===');
{
  const t = D.adderTables();
  let sumAgree = 0, carryAgree = 0, rows = 0;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const c of [-1, 1]) {
    rows++;
    if (t.sum[D.cellIndex(a, b, c)] === t.sum[D.cellIndex(a, b, 0)]) sumAgree++;
    if (t.carry[D.cellIndex(a, b, c)] === t.carry[D.cellIndex(a, b, 0)]) carryAgree++;
  }
  check('F2 — the sum tree agrees with its MID cell on 0 of 18 combinations',
    rows === 18 && sumAgree === 0, `${sumAgree} of ${rows}`);
  check('F2 — the carry tree agrees on 12 of 18, six per sign of the carry',
    carryAgree === 12);
  check('F2 — and the reason is arithmetic, not tabular: adding one always moves a low trit',
    [-3, -2, -1, 0, 1, 2].every(x => T.lowTrit(x + 1) !== T.lowTrit(x))
    && [-2, -1, 0, 1, 2, 3].every(x => T.lowTrit(x - 1) !== T.lowTrit(x)));
  check('   whereas the carry function is flat over stretches — that is the whole asymmetry',
    carry(-1) === carry(0) && carry(0) === carry(1) && carry(-3) === carry(-2) && carry(2) === carry(3));
}

console.log('\n=== 2. F3 — THE WALK OVER THE CARRY STATE ===');
const VECTORS = [[1, 7, 1], [9, 51, 9], [69, 375, 69], [513, 2763, 513], [3789, 20367, 3789]];
{
  // The matrix is DERIVED from the adder's own tables, not written down.
  const M = STATES.map(c => {
    const row = { '-1': 0, 0: 0, 1: 0 };
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const s = a + b;
      if (c !== 0 && carry(s + c) === carry(s)) continue;      // this pair would save
      row[carry(s + c)] += 1;
    }
    return STATES.map(x => row[x]);
  });
  check('F3 — the transfer matrix comes out as 9 from the middle state and 3 from each end',
    JSON.stringify(M) === JSON.stringify([[2, 1, 0], [1, 7, 1], [0, 1, 2]]), JSON.stringify(M));
  const v0 = STATES.map(target => {
    let k = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (carry(a + b) === target) k++;
    return k;
  });
  const step = v => STATES.map((_, j) => v.reduce((acc, x, i) => acc + x * M[i][j], 0));
  const sum = v => v.reduce((x, y) => x + y, 0);
  const seen = [v0];
  for (let k = 1; k <= 4; k++) seen.push(step(seen[k - 1]));
  check('F3 — the five vectors are (1,7,1) (9,51,9) (69,375,69) (513,2763,513) (3789,20367,3789)',
    JSON.stringify(seen) === JSON.stringify(VECTORS), JSON.stringify(seen));
  check('F3 — nine times the last one is 251,505, the measured exactly-13 count',
    9 * sum(seen[4]) === 251505, String(9 * sum(seen[4])));
  check('F3 — so 279,936 settle early, which is 128/243 exactly', (() => {
    const early = 531441 - 9 * sum(seen[4]);
    const g = (x, y) => (y ? g(y, x % y) : x);
    const d = g(early, 531441);
    return early === 279936 && early / d === 128 && 531441 / d === 243;
  })());
  check('F4 — and the same walk gives 81, 621, 4,617, 34,101, 251,505 at widths two to six',
    JSON.stringify([2, 3, 4, 5, 6].map(n => 9 * sum(seen[n - 2])))
    === JSON.stringify([81, 621, 4617, 34101, 251505]));
  check('   the 3^5 in the denominator is four constrained positions plus one free digit',
    Math.pow(3, 5) === 243 && seen.length - 1 === 4);
}

console.log('\n=== 3. F1 — THE RULE AGAINST THE CIRCUIT, PAIR BY PAIR ===');
{
  for (const n of [2, 3]) {                       // exhaustive; the tool does 4, 5 and 6
    const net = new D.Net(); D.dRippleAdder(net, n);
    const hi = (Math.pow(3, n) - 1) / 2;
    let pairs = 0, wrong = 0, first = '';
    for (let a = -hi; a <= hi; a++) for (let b = -hi; b <= hi; b++) {
      pairs++;
      const want = predicted(a, b, n);
      const inputs = { ...spreadN('a', a, n), ...spreadN('b', b, n), cin: 0 };
      if (!(settles(net, inputs, want) && !settles(net, inputs, want - 1))) {
        wrong++; if (!first) first = `${a}+${b}`;
      }
    }
    check(`F1 — exact on all ${pairs.toLocaleString()} pairs at width ${n}`, wrong === 0, first);
  }
  const net6 = new D.Net(); D.dRippleAdder(net6, 6);
  let n6 = 0, wrong6 = 0, first6 = '';
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += 37) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += 37) {
      n6++;
      const want = predicted(a, b, 6);
      const inputs = { ...spreadN('a', a, 6), ...spreadN('b', b, 6), cin: 0 };
      if (!(settles(net6, inputs, want) && !settles(net6, inputs, want - 1))) {
        wrong6++; if (!first6) first6 = `${a}+${b}`;
      }
    }
  }
  check(`F1 — and on all ${n6} sampled pairs at six trits, where the tool sweeps every one`,
    wrong6 === 0, first6);
  check('F1 — the rule reproduces the measured total exhaustively, by pure arithmetic', (() => {
    let exact = 0;
    for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a++) {
      for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b++) if (predicted(a, b, 6) === 13) exact++;
    }
    return exact === 251505;
  })());
}

console.log('\n=== 4. WRAP VERSUS STEP — WHY THE TWO TREES SAVE IN DIFFERENT CURRENCIES ===');
{
  /* The same fact about balanced-ternary addition turned up twice in this
   * repository wearing different clothes. Y3 found that sharing identical leaf
   * selectors collapses the SUM tree from nine leaves to three and the carry tree
   * only to five — an area saving. F2 finds that the CARRY tree settles early on
   * twelve of eighteen combinations and the sum tree on none — a timing effect.
   * They are one asymmetry seen from two sides, and exactly complementary. */
  const t = D.adderTables();
  const distinctRows = table => {
    const seen = new Set();
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      seen.add([-1, 0, 1].map(c => table[D.cellIndex(a, b, c)]).join(','));
    }
    return seen.size;
  };
  const inRowAgreements = table => {
    let k = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const c of [-1, 1]) {
      if (table[D.cellIndex(a, b, c)] === table[D.cellIndex(a, b, 0)]) k++;
    }
    return k;
  };
  check('the sum tree shares rows (3 of 9) and never settles early (0 of 18)',
    distinctRows(t.sum) === 3 && inRowAgreements(t.sum) === 0);
  check('the carry tree shares nothing (5 of 9) and settles early constantly (12 of 18)',
    distinctRows(t.carry) === 5 && inRowAgreements(t.carry) === 12);
  check('   because the low trit WRAPS: rows repeat across operand sums, cells never agree',
    [-2, -1, 0].every(s => T.lowTrit(s + 3) === T.lowTrit(s))
    && [-2, -1, 0, 1, 2].every(s => T.lowTrit(s + 1) !== T.lowTrit(s)));
  check('   and the carry STEPS: rows never repeat, but it is flat over stretches',
    [-3, -2, -1, 0, 1, 2].every(x => carry(x + 1) >= carry(x))
    && carry(-1) === carry(1) && distinctRows(t.carry) === 5);
  check('so wrapping buys area and stepping buys time, and neither buys both', (() => {
    // Y3's 38% saving is mostly the sum tree collapsing; E4's early settling is
    // entirely the carry tree. Exactly one currency each.
    const shared = new D.Net(); D.tRippleAdder(shared, 6, true);
    const plain = new D.Net(); D.tRippleAdder(plain, 6);
    return distinctRows(t.sum) < distinctRows(t.carry)          // the sum tree shares more
      && inRowAgreements(t.sum) < inRowAgreements(t.carry)      // the carry tree is early more
      && shared.cost().switches < plain.cost().switches;        // and the sharing is real
  })());
}

console.log('\n=== 5. THE RULE HAS TEETH — EACH CLAUSE IS LOAD-BEARING ===');
{
  const net = new D.Net(); D.dRippleAdder(net, 4);
  const hi = 40;
  const STRIDE = 3;                     // ~730 pairs per variant; the tool is exhaustive
  const disagreements = opts => {
    let k = 0;
    for (let a = -hi; a <= hi; a += STRIDE) for (let b = -hi; b <= hi; b += STRIDE) {
      const want = predicted(a, b, 4, opts);
      const inputs = { ...spreadN('a', a, 4), ...spreadN('b', b, 4), cin: 0 };
      if (!(settles(net, inputs, want) && !settles(net, inputs, want - 1))) k++;
    }
    return k;
  };
  check('baseline: the rule as stated disagrees with the circuit nowhere', disagreements({}) === 0);
  check('   counting the TOP position breaks it — the exclusion is not decoration',
    disagreements({ includeLast: true }) > 0);
  check('   counting position 0 does not, because its carry-in is zero and it can never save',
    disagreements({ includeFirst: true }) === 0);
  check('   and using the sum table instead of the carry table breaks it',
    disagreements({ useSumTable: true }) > 0);
  check('the earlier over-prediction is accounted for exactly: it counted the top position', (() => {
    // The naive rule and the correct one differ on precisely the pairs where the
    // top position would have saved. Not "roughly" -- on exactly those.
    let differ = 0, topWouldSave = 0;
    for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a += 3) {
      for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b += 3) {
        const naive = predicted(a, b, 6, { includeLast: true });
        const right = predicted(a, b, 6);
        const A = T.toTrits(a), B = T.toTrits(b);
        let c = 0;
        for (let i = 0; i < 5; i++) c = carry(A[i] + B[i] + c);
        const s5 = A[5] + B[5];
        const saves = c !== 0 && carry(s5 + c) === carry(s5);
        if (naive !== right) differ++;
        if (saves) topWouldSave++;
        if ((naive !== right) !== saves) return false;      // must agree case by case
      }
    }
    return differ > 0 && differ === topWouldSave;
  })());
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
