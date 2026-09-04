'use strict';
/* CARRY-IN AUDIT — the pass-count rule off its own scope line.
 *
 * Set `AW`. `F` derived where the decoded adder's 128/243 comes from and checked it
 * exhaustively, and its measured record carries a scope clause in its own words:
 *
 *     "scope: carry-in 0 throughout; with a non-zero carry-in the bottom position
 *      can save as well (six of its nine digit-pairs qualify) and the walk is a
 *      different one"
 *
 * So `F` named this set's question and declined to answer it. `Y1` and `E1` sampled
 * carry-in +1 and -1 at stride 11 -- one pair in 121 -- and every restored variant in
 * `Z` is sampled at that stride too. The reason was never the question: at the oracle's
 * speed the six sweeps below are most of a day. `AV` built and proved a solver that
 * does them in about an hour, and then deliberately did not spend it. This spends it.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * THE RULE, as `F` states it. Write s_i = a_i + b_i and carry(x) = shiftRight(x, 1).
 * Cell i produces its carry one pass early exactly when
 *
 *     c_i != 0   AND   carry(s_i + c_i) == carry(s_i)
 *
 * At carry-in 0, position 0 can never satisfy it, because c_0 = 0. Position 5's saving
 * buys nothing, because the sum tree never settles early (`F2`, checked over both
 * non-zero carries already). That leaves positions 1..4 constrained, a start vector of
 * (1, 7, 1) for position 0's nine unconstrained pairs, four applications of the
 * transfer matrix, and a factor of nine for the free top digit: 251,505.
 *
 * WHAT A NON-ZERO CARRY-IN CHANGES, and it is one thing. Position 0's carry is no
 * longer 0, so position 0 becomes a CONSTRAINED position like any other. The walk
 * therefore starts from the single determined state c_0 = cin rather than from a
 * distribution over nine pairs, and runs FIVE applications rather than four. Nothing
 * else moves: the matrix is `F`'s, unchanged, and the factor of nine for position 5 is
 * unchanged.
 *
 * THE MATRIX IS `F`'s, restated so this set is readable on its own:
 *
 *        from     -> -1    -> 0    -> +1     total
 *          0         1        7        1        9
 *         -1         2        1        0        3
 *         +1         0        1        2        3
 *
 * THE WALK, HAND-COMPUTED BEFORE THE RUN. Carry-in +1 starts at (0, 0, 1):
 *
 *     w0 = (0, 0, 1)            sum 1
 *     w1 = (0, 1, 2)            sum 3
 *     w2 = (1, 9, 5)            sum 15
 *     w3 = (11, 69, 19)         sum 99
 *     w4 = (91, 513, 107)       sum 711
 *     w5 = (695, 3789, 727)     sum 5211
 *
 * and 9 x 5211 = 46,899. Carry-in -1 starts at (1, 0, 0) and gives the reverse of
 * every vector, the same sums, and the same 46,899.
 *
 * THE METHOD WAS CONTROLLED BEFORE IT WAS EXTENDED. Run on `F`'s own starting vector
 * it returns 251,505, which is `F3`'s measured number. A derivation that could not
 * reproduce the case already on the record would not be worth registering on the case
 * that is not.
 *
 * FIXED, and not at risk:
 *   - The subject is `dRippleAdder(net, 6)`, the decoded adder, 540 switches. `E1`
 *     swept it exhaustively at carry-in 0; this sweeps the two carry-ins it sampled.
 *   - The pass count of a pair is the smallest k at which `solve` settles, probed as
 *     every pass count in `results/` was: solve at k, and again at k-1, which must
 *     throw. Two solves per pair.
 *   - R2 from `AV` is the instrument, and the gate `AV` built is re-run here before
 *     any count below is read. An instrument proved on one branch is not proved on
 *     this one.
 *   - All 531,441 pairs at each carry-in. No stride anywhere in this set.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 * Everything below is DERIVED BY HAND from the rule above; the run checks the
 * derivation, exactly as `F1` through `F4` were checked.
 *
 *   AW1 THE RULE SURVIVES, WITH POSITION 0 ADMITTED AND NOTHING ELSE CHANGED. For all
 *       531,441 pairs at carry-in +1 and all 531,441 at carry-in -1, the solver's pass
 *       count equals 13 minus the number of positions i in 0..4 satisfying `F`'s
 *       condition. Pair by pair, not in aggregate.
 *       AT RISK: `F` established the rule only where position 0 is inert, so this
 *       moves it onto the one position whose behaviour was never exercised. Position 0
 *       is the boundary cell -- its carry comes from outside the adder rather than from
 *       another cell -- and if the carry-in arrives already determined while an
 *       internal carry does not, the detector timing that the whole rule turns on is
 *       different there and the condition can hold while the saving does not happen.
 *       `E4` already failed once by predicting a pass count for this adder. Refuted by
 *       a single disagreeing pair.
 *
 *   AW2 AND THE WALK GIVES 46,899. Exactly 46,899 of the 531,441 pairs take the full
 *       13 passes at carry-in +1, and exactly 46,899 at carry-in -1.
 *       AT RISK: this is one number from five matrix applications and it is refuted by
 *       being off by one. It is not implied by AW1 -- AW1 could hold pair by pair while
 *       this is wrong, if the number of constrained positions is four rather than five
 *       because position 0's saving is real but does not cost a pass. That is the
 *       likeliest way to be wrong and it lands here rather than on AW1.
 *
 *   AW3 THE TWO CARRY-INS ARE EXACT MIRRORS. The pass-count distribution at carry-in
 *       -1 is identical to the one at carry-in +1, bin for bin, and the carry-state
 *       vectors are reverses: (695, 3789, 727) against (727, 3789, 695).
 *       AT RISK: negating both operands and the carry-in maps one sweep onto the other
 *       and balanced ternary has no sign bit, so the symmetry ought to be exact -- but
 *       it is a claim about the DEVICE, not about the arithmetic. `sti` is four
 *       switches and `nti`/`pti` are two, the n-type and p-type thresholds are not
 *       placed symmetrically about MID, and the decoded selector's detector pulls LOW
 *       and HIGH both to vss. A device model asymmetric in the sign is the ordinary
 *       case, not the exotic one, and any single bin differing refutes this.
 *
 *   AW4 AND THE FLOOR DROPS BY ONE. The minimum pass count over the sweep is 8 at both
 *       non-zero carry-ins, against 9 at carry-in 0, because a fifth position can now
 *       save; and at least one pair attains it.
 *       AT RISK: refuted if the floor stays at 9, which is what happens if position 0's
 *       saving is unrealisable in the device for the reason AW1's risk line describes,
 *       and refuted equally if the floor drops below 8, which is what happens if
 *       position 5 can save after all at a non-zero carry-in -- `F2` checked eighteen
 *       of eighteen digit-pairs and both non-zero carries, so that would overturn `F2`
 *       rather than merely surprise this set.
 *
 * NOT REGISTERED — derivable, already on the record, or measured while building the
 * instrument, and listed so the registered set is not inflated:
 *   - That the decoded adder still computes `T.add` at both non-zero carry-ins. `E1`
 *     proved the cell exhaustively over all 27 input triples and the ripple chains
 *     cells, so correctness follows by induction; the sweep reports it and it is not a
 *     prediction. The same applies to the tree adder and to every restored variant.
 *   - That the tree adder's pass count stays 7 at a non-zero carry-in. `Y2` derived it
 *     from gate-dependency depth, which does not mention the data.
 *   - 251,505 at carry-in 0. That is `F3`, reproduced here only as a control on the
 *     method before it was extended.
 *   - The wall-clock of the sweeps. `AV` priced the instrument; this set spends it.
 *
 * Run:  npm run audit:carryin
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

/* ---------------------------------------------------------------- the derivation
 *
 * F's transfer matrix, and the walk over it. This is arithmetic, not measurement:
 * it is the content of AW2 and AW3 and it runs before anything is solved. Kept as
 * code rather than as a comment so the registered numbers and the numbers the run
 * is checked against cannot drift apart.
 */
const STEP = v => [
  2 * v[0] + 1 * v[1] + 0 * v[2],
  1 * v[0] + 7 * v[1] + 1 * v[2],
  0 * v[0] + 1 * v[1] + 2 * v[2],
];
const SUM = v => v[0] + v[1] + v[2];

/** The walk. `start` is the carry state before position 0; `n` applications. */
function walk(start, n) {
  const trail = [start];
  let v = start;
  for (let i = 0; i < n; i++) { v = STEP(v); trail.push(v); }
  return { trail, full: SUM(v) * 9 };
}

/* Carry-in 0 is F's own case and is the CONTROL: position 0 is unconstrained, so the
 * walk starts from its nine pairs sorted by the carry they produce and runs four
 * times. It must return F3's measured 251,505. */
const CONTROL = walk([1, 7, 1], 4);

/* A non-zero carry-in makes position 0 constrained like any other, so the walk starts
 * from the single determined state and runs five times. */
const PLUS = walk([0, 0, 1], 5);
const MINUS = walk([1, 0, 0], 5);

// ---------------------------------------------------------------- the measurement

function report() {
  log('CARRY-IN AUDIT: the pass-count rule off its own scope line.');
  log(line);

  log('');
  log('--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  // AV's gate, re-run on THIS branch. An instrument proved elsewhere is not proved
  // here, and every count below is R2's rather than the oracle's.
  //
  // AND THE DERIVATION IS CONTROLLED BEFORE IT IS USED: the same walk, run on F's
  // starting vector, must return F3's 251,505. A method that cannot reproduce the
  // case already on the record is not evidence about the case that is not.
  // AD2 memoised only terminating values and reported the attacker as 300x WORSE --
  // in the flattering direction, which is the direction nothing catches by surprise.
  log(`      control: F's walk reproduces ${CONTROL.full.toLocaleString('en-US')}`
    + `  (F3 measured 251,505)`);
  log(`      derived: carry-in +1 gives ${PLUS.full.toLocaleString('en-US')},`
    + ` carry-in -1 gives ${MINUS.full.toLocaleString('en-US')}`);

  log('');
  log('--- AW1  the rule, pair by pair, at both non-zero carry-ins ---');
  log('');
  log('--- AW2  the walk: 46,899 at the full thirteen passes ---');
  log('');
  log('--- AW3  the two carry-ins as exact mirrors ---');
  log('');
  log('--- AW4  the floor, at eight rather than nine ---');
  log('');
  log(line);
}

if (MAIN) report();

module.exports = { report, walk, STEP, SUM, CONTROL, PLUS, MINUS };
