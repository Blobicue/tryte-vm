'use strict';
/* PASS-COUNT AUDIT — where 128/243 comes from.
 *
 * E4 failed by predicting a fixed pass count for the decoded adder. The count is
 * not fixed: it ranges 9 to 13 and depends on the operands, and exactly 279,936
 * of the 531,441 pairs settle early. That number was measured and left
 * unexplained, with a note saying the six agreeing carry-table leaves ENABLE
 * early settling without accounting for the count. This accounts for it.
 *
 * THE RULE. Write s_i = a_i + b_i and let carry(x) = shiftRight(x, 1). Cell i
 * produces its carry one pass early when the leaf its operands select is already
 * determined before the MID detector resolves — which happens exactly when
 *
 *     c_i != 0   AND   carry(s_i + c_i) == carry(s_i)
 *
 * because then the arm conducting on the raw select and the arm still waiting on
 * the detector lead to the SAME rail, so N3 settles the node regardless.
 *
 * TWO CORRECTIONS to the obvious version of that, and both matter:
 *
 *   Position 0 can never save, because the carry-in is 0 and the condition needs
 *   a non-zero carry.
 *
 *   Position 5's saving buys NOTHING. The solver stops when nothing changes, and
 *   the top SUM output always needs the full two passes — the sum tree's leaf
 *   condition is lowTrit(s + c) == lowTrit(s), which is false for every entry,
 *   because adding one to a value always changes its low trit. So the sum tree
 *   never settles early and the last cell's sum is always the last thing to move.
 *
 * That leaves four positions that can save, which is where 3^4... no: the carry
 * STATE at those four positions plus one free digit is what gives 3^5 = 243.
 *
 * THE COUNT. The rule makes the pass count a walk over the carry state. From each
 * state, the nine digit-pairs split by weight into the states they lead to, with
 * the disallowed ones (the ones that would save) removed:
 *
 *        from     -> -1    -> 0    -> +1     total
 *          0         1        7        1        9
 *         -1         2        1        0        3
 *         +1         0        1        2        3
 *
 * Start at (1, 7, 1) — position 0's nine pairs sorted by the carry they produce —
 * apply the matrix once per constrained position, and multiply by 9 for the free
 * top digit.
 *
 * ------------------------------------------------------------------------------
 * NOT REGISTERED. Already measured, and what this exists to explain:
 *
 *   - the decoded six-trit adder settles in 9 to 13 passes, never more;
 *   - 279,936 pairs settle in fewer than 13, 251,505 in exactly 13, 0 in more;
 *   - the carry table has 6 of 9 leaves whose LOW and MID cells agree, the sum
 *     table 0 of 9;
 *   - counting saving positions naively over-predicts, always by exactly one.
 *
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit. Everything
 * below is DERIVED BY HAND from the rule above; the run checks the derivation.
 *
 *   F1  THE RULE IS EXACT, PAIR BY PAIR. For all 531,441 operand pairs at
 *       carry-in 0, the solver's pass count equals 13 minus the number of
 *       positions i in 1..4 satisfying the condition. Not the aggregate — every
 *       individual pair. At risk: reproducing a total is much weaker than
 *       reproducing it term by term, and an aggregate can come out right while
 *       the per-pair story is wrong in compensating directions.
 *
 *   F2  THE SUM TREE CAN NEVER SETTLE EARLY. For all nine operand-digit pairs and
 *       both non-zero carries, lowTrit(s + c) != lowTrit(s) — eighteen of
 *       eighteen. This is the asymmetry the whole result turns on: the carry
 *       function is flat over stretches and the low-trit function never is.
 *
 *   F3  THE MATRIX GIVES 251,505 EXACTLY. Starting vector (1, 7, 1), four
 *       applications, times 9. Hand-computed intermediates, registered so the
 *       arithmetic is on the record and not just the answer:
 *
 *         v0 = (1, 7, 1)              sum 9
 *         v1 = (9, 51, 9)             sum 69
 *         v2 = (69, 375, 69)          sum 513
 *         v3 = (513, 2763, 513)       sum 3789
 *         v4 = (3789, 20367, 3789)    sum 27945
 *
 *       9 x 27945 = 251,505, so 531,441 - 251,505 = 279,936 settle early, which
 *       is 128/243 of the domain. Predicted to the digit.
 *
 *   F4  AND IT PREDICTS THE OTHER WIDTHS. The same walk with fewer steps gives
 *       the exactly-(2n+1)-pass count at width n. Hand-derived:
 *
 *         n = 2:  9 x 9      =     81 of      81   (no position can save)
 *         n = 3:  9 x 69     =    621 of     729
 *         n = 4:  9 x 513    =  4,617 of   6,561
 *         n = 5:  9 x 3789   = 34,101 of  59,049
 *         n = 6:  9 x 27945  = 251,505 of 531,441
 *
 *       Checked against the actual circuit exhaustively at every one of those
 *       widths, since the small ones are cheap. If the rule were fitted to six
 *       trits rather than derived, this is where it would come apart.
 * ------------------------------------------------------------------------------
 */

const T = require('../src/ternary.js');
const D = require('../src/device.js');

const line = '='.repeat(78);
console.log('PASS-COUNT AUDIT — accounting for 128/243.\n');

/** The rule, as stated above. Pure arithmetic; no circuit involved. */
function predictedPasses(a, b, n) {
  const A = T.toTrits(a, n), B = T.toTrits(b, n);
  let c = 0, saved = 0;
  for (let i = 0; i < n; i++) {
    const s = A[i] + B[i];
    // Position 0 cannot save (c is 0) and position n-1's saving is invisible,
    // because the top sum output always needs the full two passes.
    if (i > 0 && i < n - 1 && c !== 0
      && T.shiftRight(s + c, 1) === T.shiftRight(s, 1)) saved++;
    c = T.shiftRight(s + c, 1);
  }
  return (2 * n + 1) - saved;
}

const settles = (net, inputs, k) => {
  try { net.solve(inputs, k); return true; } catch (e) { return false; }
};
const spreadN = (nm, v, n) => Object.fromEntries(T.toTrits(v, n).map((t, i) => [`${nm}${i}`, t]));

console.log('--- F2  can the sum tree ever settle early? ---');
{
  const t = D.adderTables();
  let sumAgree = 0, carryAgree = 0, rows = 0;
  const detail = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    for (const c of [-1, 1]) {
      rows++;
      if (t.sum[D.cellIndex(a, b, c)] === t.sum[D.cellIndex(a, b, 0)]) sumAgree++;
      if (t.carry[D.cellIndex(a, b, c)] === t.carry[D.cellIndex(a, b, 0)]) carryAgree++;
    }
  }
  console.log(`      over ${rows} (digit-pair, non-zero carry) combinations:`);
  console.log(`        sum tree agrees with its MID cell:   ${sumAgree}   (predicted 0)`);
  console.log(`        carry tree agrees with its MID cell: ${carryAgree}`);
  console.log('      the carry function is flat over stretches; the low trit never is.');
  console.log('      That asymmetry is the whole result: only the carry tree can be early,');
  console.log('      and the last cell\'s SUM is therefore always the last node to move.');
}

console.log('\n--- F3  the walk over the carry state ---');
{
  // Weights out of each carry state, derived from the nine digit-pairs, with the
  // saving ones removed. Built here rather than hardcoded, so the matrix itself
  // is derived from the adder's own tables.
  const carry = x => T.shiftRight(x, 1);
  const STATES = [-1, 0, 1];
  const M = STATES.map(c => {
    const row = { '-1': 0, 0: 0, 1: 0 };
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const s = a + b;
      if (c !== 0 && carry(s + c) === carry(s)) continue;    // this pair would save
      row[carry(s + c)] += 1;
    }
    return STATES.map(x => row[x]);
  });
  console.log('      from     -> -1    -> 0    -> +1     total');
  STATES.forEach((c, i) => {
    console.log(`      ${String(c).padStart(4)}     ${M[i].map(x => String(x).padStart(5)).join('   ')}`
      + `     ${M[i].reduce((x, y) => x + y, 0)}`);
  });

  // Position 0's nine pairs, sorted by the carry they produce.
  const v0 = STATES.map(target => {
    let n = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (carry(a + b) === target) n++;
    return n;
  });
  const step = v => STATES.map((_, j) => v.reduce((acc, x, i) => acc + x * M[i][j], 0));
  const sum = v => v.reduce((x, y) => x + y, 0);

  let v = v0;
  const seen = [v0];
  console.log(`      v0 = (${v0.join(', ')})   sum ${sum(v0)}`);
  for (let k = 1; k <= 4; k++) {
    v = step(v);
    seen.push(v);
    console.log(`      v${k} = (${v.join(', ')})   sum ${sum(v)}`);
  }
  const zero = 9 * sum(v);
  console.log(`      9 x ${sum(v)} = ${zero.toLocaleString()}`
    + `   (predicted 251,505)`);
  console.log(`      early = 531,441 - ${zero.toLocaleString()} = ${(531441 - zero).toLocaleString()}`
    + `   = ${(531441 - zero)}/531441`);
  const g = (x, y) => (y ? g(y, x % y) : x);
  const num = 531441 - zero, den = 531441, d = g(num, den);
  console.log(`      in lowest terms: ${num / d}/${den / d}   (predicted 128/243)`);

  console.log('\n--- F4  the same walk at every width ---');
  console.log('      n    exactly 2n+1 passes    of        predicted');
  const PREDICTED = { 2: 81, 3: 621, 4: 4617, 5: 34101, 6: 251505 };
  for (let n = 2; n <= 6; n++) {
    const zeroN = 9 * sum(seen[n - 2]);
    console.log(`      ${n}    ${String(zeroN).padStart(18)}    ${String(Math.pow(9, n)).padStart(7)}`
      + `   ${String(PREDICTED[n]).padStart(8)}`
      + `   ${zeroN === PREDICTED[n] ? 'as derived' : 'MISMATCH'}`);
  }
}

console.log('\n--- F1, F4  the rule against the actual circuit ---');
{
  // Small widths exhaustively: the circuit is cheap there and the rule has
  // nowhere to hide.
  for (let n = 2; n <= 5; n++) {
    const net = new D.Net(); D.dRippleAdder(net, n);
    const max = Math.pow(3, n), lo = -(max - 1) / 2, hi = (max - 1) / 2;
    let pairs = 0, wrong = 0, exact = 0, first = '';
    const t0 = process.hrtime.bigint();
    for (let a = lo; a <= hi; a++) {
      for (let b = lo; b <= hi; b++) {
        pairs++;
        const want = predictedPasses(a, b, n);
        const inputs = { ...spreadN('a', a, n), ...spreadN('b', b, n), cin: 0 };
        if (!(settles(net, inputs, want) && !settles(net, inputs, want - 1))) {
          wrong++; if (!first) first = `${a}+${b} at n=${n}`;
        }
        if (want === 2 * n + 1) exact++;
      }
    }
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;
    console.log(`      n=${n}: ${pairs.toLocaleString()} pairs in ${secs.toFixed(1)}s`
      + `   rule wrong on ${wrong}`
      + `   taking exactly ${2 * n + 1}: ${exact.toLocaleString()}`);
    if (first) console.log(`        first divergence: ${first}`);
  }

  // Six trits, exhaustively. Two solves per pair; this is the long one.
  const net = new D.Net(); D.dRippleAdder(net, 6);
  const t0 = process.hrtime.bigint();
  let pairs = 0, wrong = 0, exact = 0, first = '';
  const dist = new Map();
  for (let a = T.TRYTE_MIN; a <= T.TRYTE_MAX; a++) {
    for (let b = T.TRYTE_MIN; b <= T.TRYTE_MAX; b++) {
      pairs++;
      const want = predictedPasses(a, b, 6);
      dist.set(want, (dist.get(want) || 0) + 1);
      if (want === 13) exact++;
      const inputs = { ...spread6(a, b) };
      if (!(settles(net, inputs, want) && !settles(net, inputs, want - 1))) {
        wrong++; if (!first) first = `${a}+${b}`;
      }
    }
  }
  const secs = Number(process.hrtime.bigint() - t0) / 1e9;
  console.log(`      n=6: ${pairs.toLocaleString()} pairs in ${secs.toFixed(0)}s`
    + `   rule wrong on ${wrong}   (predicted 0)`);
  if (first) console.log(`        first divergence: ${first}`);
  console.log(`      taking exactly 13: ${exact.toLocaleString()}   (predicted 251,505)`);
  console.log('      distribution the rule predicts: '
    + [...dist.keys()].sort((x, y) => x - y).map(k => `${k}:${dist.get(k).toLocaleString()}`).join('  '));
}

function spread6(a, b) {
  return { ...spreadN('a', a, 6), ...spreadN('b', b, 6), cin: 0 };
}

console.log('\n' + line);
