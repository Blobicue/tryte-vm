'use strict';
/* HAILSTONE AUDIT — a loop bound the program has to discover, and why it is still
 * not enough.
 *
 * WHY THIS SET EXISTS
 * -------------------
 * AC measured whether a program's cost can be learned without running it, and the
 * answer was "cheaply, everywhere" -- five of eight programs cost a constant and
 * the one that varied was priced exactly by two runs. But AC's corpus had a gap it
 * stated: every loop in it is bounded either by a literal or by a number handed to
 * it. The class that matters was missing.
 *
 * The refinement that names the class: a stop condition being DATA-DEPENDENT is not
 * enough, because countdown's bound is data-dependent and is simply read off the
 * input. The condition has to be DISCOVERED -- produced by the loop's own work --
 * so that the only way to learn the count is to perform the iterations.
 *
 * `programs/hailstone.tasm` is the first such program here. Its stop condition,
 * n = 1, is reached by a trajectory the loop generates.
 *
 * THE QUESTION THIS SET ACTUALLY ASKS
 * -----------------------------------
 * Not "is hailstone data-dependent" -- it is, by construction, and registering that
 * would be registering a fact that was never at risk. The question is whether being
 * genuinely discovered is SUFFICIENT: is running it the cheapest way to learn its
 * cost? A predictor is not obliged to be clever. It is allowed to be patient, and
 * an accumulator has only 729 states.
 *
 * ------------------------------------------------------------------------------
 * MEASURED DURING DESIGN, NOT PREDICTED — recorded here so the registered set is
 * not inflated with facts that were never at risk. While choosing the growth rule,
 * five candidates were swept over all 729 inputs. `3n + 1` terminated on exactly
 * six of them (the powers of three), because multiplying by three always zeroes the
 * low trit, so the climb can never become divisible again. `2n + low_trit`
 * terminates on 363. Those counts, and the trajectory lengths that came with them,
 * are design measurements and appear under unregistered_findings.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered before the run, per AGENTS.md.
 *
 *   AD1 the cheap predictor that priced countdown exactly FAILS here. Fit
 *       steps = a*N + b from two inputs, as AC2 did, and predicted it is wrong on
 *       more than 90% of the terminating inputs. Predicted further that the step
 *       count is NOT MONOTONE in the input -- there exist n < m whose costs run the
 *       other way -- which is the property that rules out any predictor built from
 *       the magnitude of the input alone.
 *
 *   AD2 and yet a patient predictor still wins, because the state space is small. A
 *       memoised traversal prices EVERY input by walking each accumulator value at
 *       most once. Predicted: building the complete cost table for all 729 inputs
 *       costs at most 729 map evaluations, while answering the same inputs by
 *       independent re-running costs more than 3,000. Predicted the crossover --
 *       the number of queries after which tabulating has already paid for itself --
 *       is UNDER 100.
 *
 *   AD3 so no single-accumulator program on this machine can be tier three, and the
 *       bound is pigeonhole rather than particular. Predicted: no trajectory
 *       exceeds 729 steps, for this map or any other single-accumulator map,
 *       because a longer one would have to revisit a state and would never
 *       terminate. Predicted the observed maximum is far below that ceiling.
 *
 *   AD4 the escape is STATE, not loop shape. Predicted: hailstone's cost depends
 *       only on the accumulator value -- poison every scratch word before the run
 *       and the step count is unchanged for all 729 inputs -- so its state space is
 *       exactly 729 and AD2's bound is tight rather than generous. It follows
 *       (DERIVED, arithmetic over that) that k tryte words of live control state
 *       give 3^(6(k+1)) states, multiplying the tabulation cost by 729 per word,
 *       so the security parameter of an implied receipt is REACHABLE STATE COUNT
 *       and not whether the loop bound is discovered.
 *
 * ------------------------------------------------------------------------------
 * Run: node tools/hailstone-audit.js
 */

const T = require('../src/ternary.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto } = require('../src/assembler.js');
const fs = require('fs');
const path = require('path');

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);
const SRC = fs.readFileSync(path.join(__dirname, '..', 'programs', 'hailstone.tasm'), 'utf8');
const N = T.TRYTE_STATES;
const VALUES = Array.from({ length: N }, (_, i) => i + T.TRYTE_MIN);

log('HAILSTONE AUDIT — a discovered loop bound, and why it is still not enough\n');

/** The map the program implements, in JavaScript, as an independent reference. */
const lowTrit = v => v - 3 * T.shiftRight(v, 1);
const step = v => (lowTrit(v) === 0 ? T.shiftRight(v, 1) : T.wrap(2 * v + lowTrit(v)));

/** Run the real program. Returns its emitted step count, or null if it never stops. */
function onMachine(n, poison = false) {
  const vm = new TryteVM({ input: [n], maxSteps: 60000 });
  loadInto(vm, SRC);
  if (poison) for (let a = -10; a <= -1; a++) vm.write(a, T.wrap(a * 37 + 5));
  try { while (vm.step()); } catch (e) { return null; }
  return vm.output.length ? vm.output[0] : null;
}

/** Walk the map directly, counting steps. The runner's cost for one query. */
function walk(n, cap = 3000) {
  let v = T.wrap(n), s = 0;
  while (v !== 1 && s < cap) { v = step(v); s++; }
  return v === 1 ? s : null;
}

/* ============================================================================
 * 0. INSTRUMENT CHECK — the program and the reference must be the same map.
 * ========================================================================== */
log(line);
log('0. INSTRUMENT CHECK');
log(line);
{
  let onBoth = 0, agree = 0, disagree = [];
  for (const n of VALUES) {
    const m = onMachine(n), r = walk(n);
    if (m !== null && r !== null) { onBoth++; if (m === r) agree++; else disagree.push(n); }
    else if ((m === null) !== (r === null)) disagree.push(n);
  }
  log(`  inputs where both the machine and the reference terminate: ${onBoth}`);
  log(`  step counts agreeing: ${agree}   disagreeing: ${disagree.length}`);
  log(`  a program checked only against itself is not checked: ${agree === onBoth && disagree.length === 0 ? 'two independent implementations, one answer' : 'THEY DISAGREE — stop'}`);
  log(`  and the reference is falsifiable: a deliberately wrong map disagrees on ` +
    `${VALUES.filter(n => walk(n) !== null && walk(n) !== (() => { let v = T.wrap(n), s = 0; while (v !== 1 && s < 3000) { v = T.wrap(v - 1); s++; } return v === 1 ? s : null; })()).length} inputs`);
}

/* ============================================================================
 * 1. AD1 — the cheap predictor fails.
 * ========================================================================== */
log('\n' + line);
log('1. AD1 — the two-point fit that priced countdown exactly');
log(line);

const terminating = VALUES.filter(n => walk(n) !== null);
const cost = new Map(terminating.map(n => [n, walk(n)]));
{
  // Same procedure AC2 used, applied to a discovered bound instead of a read one.
  const [n1, n2] = terminating.filter(n => n > 0).slice(0, 2);
  const s1 = cost.get(n1), s2 = cost.get(n2);
  const a = (s2 - s1) / (n2 - n1), b = s1 - a * n1;
  let exact = 0;
  for (const n of terminating) if (cost.get(n) === a * n + b) exact++;
  log(`  terminating inputs: ${terminating.length} of ${N}`);
  log(`  fitted from N=${n1} (${s1}) and N=${n2} (${s2}):  steps = ${a}*N + ${b}`);
  log(`  exact on ${exact} of ${terminating.length}  (${(100 * exact / terminating.length).toFixed(1)}%)`);
  log(`  countdown, for comparison, was exact on 100%`);

  // Monotonicity: if cost rose with the input, magnitude alone would price it.
  const pos = terminating.filter(n => n > 0).sort((x, y) => x - y);
  const inversions = pos.filter((n, i) => i > 0 && cost.get(n) < cost.get(pos[i - 1])).length;
  log(`  inversions in cost as the input grows: ${inversions} of ${pos.length - 1} adjacent pairs`);
  log(`  so the cost is ${inversions > 0 ? 'NOT monotone' : 'monotone'} in the input`);
  const lens = terminating.map(n => cost.get(n));
  log(`  observed lengths: min ${Math.min(...lens)}, max ${Math.max(...lens)}, distinct ${new Set(lens).size}`);
}

/* ============================================================================
 * 2. AD2 — the patient predictor.
 * ========================================================================== */
log('\n' + line);
log('2. AD2 — tabulate once, answer free');
log(line);
{
  /*
   * Memoised traversal: every accumulator value is resolved at most once, because
   * once a value's answer is known every trajectory reaching it stops there.
   *
   * INSTRUMENT REPAIR, recorded rather than quietly fixed. The first version
   * memoised only TERMINATING values. A divergent input therefore walked its full
   * 3,000-step guard, learned nothing, and the next divergent input did it again --
   * 366 of them, for 1,098,362 evaluations to price 729 inputs. It reported the
   * tabulator as three hundred times WORSE than simply re-running, which is the
   * answer that would have made AD2 fail and the implied receipt look sound. A
   * wrong instrument pointing toward the hypothesis is the dangerous direction.
   *
   * Non-termination is an answer too, and a correct tabulator records it. Walking
   * until the path meets either a known value or ITSELF resolves every state once.
   */
  const DIVERGES = Symbol('never terminates');
  const table = new Map([[1, 0]]);
  let evaluations = 0;
  for (const n of VALUES) {
    const path = [];
    const onPath = new Map();
    let v = T.wrap(n);
    while (!table.has(v) && !onPath.has(v)) {
      onPath.set(v, path.length); path.push(v);
      v = step(v); evaluations++;
    }
    if (onPath.has(v) || table.get(v) === DIVERGES) {
      for (const p of path) table.set(p, DIVERGES);     // the whole path diverges
    } else {
      let c = table.get(v);
      for (let i = path.length - 1; i >= 0; i--) table.set(path[i], ++c);
    }
  }
  const naive = terminating.reduce((a, n) => a + cost.get(n), 0);
  log(`  memoised tabulation: ${evaluations} map evaluations to price all ${N} inputs`);
  log(`  answering the same inputs by independent re-running: ${naive} map evaluations`);
  log(`  the table agrees with the runner on every terminating input: ` +
    `${terminating.every(n => table.get(T.wrap(n)) === cost.get(n))}`);

  const mean = naive / terminating.length;
  const crossover = Math.ceil(evaluations / mean);
  log(`\n  mean cost of one query by running: ${mean.toFixed(2)} evaluations`);
  log(`  queries after which tabulating has paid for itself: ${crossover}`);
  log(`  so a predictor that expects more than ${crossover} questions should tabulate,`);
  log(`  and from then on every answer is free.`);
}

/* ============================================================================
 * 3. AD3 — the bound is pigeonhole, not particular.
 * ========================================================================== */
log('\n' + line);
log('3. AD3 — no single-accumulator trajectory can outrun the state space');
log(line);
{
  const lens = terminating.map(n => cost.get(n));
  const max = Math.max(...lens);
  log(`  longest terminating trajectory: ${max} steps`);
  log(`  ceiling imposed by 729 accumulator states: ${N}`);
  log(`  headroom used: ${(100 * max / N).toFixed(2)}%`);
  // Demonstrate the pigeonhole directly rather than asserting it: a trajectory
  // longer than the state space would have to repeat a value, and a repeat means
  // it never terminates.
  let repeats = 0;
  for (const n of terminating) {
    const seen = new Set(); let v = T.wrap(n);
    while (v !== 1) { if (seen.has(v)) { repeats++; break; } seen.add(v); v = step(v); }
  }
  log(`  terminating trajectories that revisit a value: ${repeats}  (must be 0)`);
  log(`  so every terminating trajectory is a simple path and cannot exceed ${N} steps,`);
  log(`  whatever the map -- this is a property of the state space, not of hailstone.`);
}

/* ============================================================================
 * 4. AD4 — the state is the accumulator, and that is the whole security parameter.
 * ========================================================================== */
log('\n' + line);
log('4. AD4 — what the cost actually depends on');
log(line);
{
  let same = 0, differ = [];
  for (const n of VALUES) {
    const clean = onMachine(n, false), dirty = onMachine(n, true);
    if (clean === dirty) same++; else differ.push(n);
  }
  log(`  scratch memory poisoned before the run; inputs giving an identical answer: ${same} of ${N}`);
  log(`  inputs whose cost changed: ${differ.length}`);
  log(`  so the cost is a function of the accumulator alone, and the tabulation`);
  log(`  bound of ${N} is tight rather than generous.`);

  log('\n  DERIVED, arithmetic over that:');
  for (let k = 0; k <= 3; k++) {
    const states = 3n ** BigInt(6 * (k + 1));
    log(`    ${k} live word${k === 1 ? ' ' : 's'} of state beyond the accumulator: ${states} states to tabulate`);
  }
  log(`  each word multiplies the tabulator's one-off cost by ${N}, and leaves the`);
  log(`  runner's cost for a single query unchanged. The security parameter of an`);
  log(`  implied receipt is REACHABLE STATE COUNT, not whether the bound is discovered.`);
}

log('\n' + line);
log('Registered predictions AD1-AD4 are in this file\'s docstring. Outcomes go to');
log('FINDINGS.json and are asserted in test/test-hailstone.js.');
log(line);

module.exports = { step, lowTrit, walk, onMachine, VALUES, SRC };
