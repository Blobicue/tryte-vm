'use strict';
/* MINIMAL AUDIT — the smallest reversible ternary language, and what it costs.
 *
 * WHY THIS SET EXISTS
 * -------------------
 * The design question is now concrete: if every primitive of a language is
 * reversible then every program written in it has in-degree one by construction, and
 * AH2's fourth factor is free for everything with no per-program analysis. That is a
 * language design decision with a measurable consequence, and the pieces are already
 * in the corpus:
 *
 *   M   the named ternary reversible gate set generates exactly A_27 on a three-trit
 *       register -- reversible universality at TWO operands, which binary provably
 *       cannot reach
 *   O   the simplest one-control conditional is NON-AFFINE over GF(3) and always
 *       affine over GF(2), so ternary gets its nonlinearity from the same primitive
 *   AB2 eleven of this machine's twenty-five opcodes erase nothing
 *   AI4 a reversible feedback gives in-degree one everywhere
 *   AJ1 and the property comes from the parts being reversible, not from memory
 *
 * So the candidate language is three primitive forms, all reversible:
 *
 *     INC   i        trit i += 1
 *     CINC  a b      trit b += trit a            (affine)
 *     C1INC a b      trit b += 1 if trit a = 1   (NOT affine -- O's free nonlinearity)
 *
 * Every one of them has order three over GF(3), so the inverse of any gate is that
 * gate applied twice and the language needs no inverse instructions at all.
 *
 * THE WORRY, STATED BEFORE MEASURING IT
 * -------------------------------------
 * AG1 found that a receipt needs the COST TO VARY, and a wide state with a flat cost
 * is security theatre. A straight-line reversible program is a fixed sequence of
 * gates. Nothing in it depends on the data, because branching on data means testing
 * data, and a test that throws its answer away is erasing. If that is right, going
 * fully reversible BUYS factor four and LOSES factor three, and the two cannot be had
 * together without paying somewhere else.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered before the run, per AGENTS.md.
 *
 *   AK1 the three forms are a language, and it is universal. Predicted every gate
 *       instance is a permutation of the 27 states and every one has order exactly 3,
 *       so a program's inverse is that program with each gate applied twice more and
 *       no inverse instruction set is needed. Predicted the group they generate is
 *       exactly A_27 = 27!/2 = 5,444,434,725,209,176,080,384,000 -- reproducing M's
 *       recorded figure from an implementation written independently of M's, which is
 *       the only way a re-implementation is worth anything.
 *
 *   AK2 reversibility is inherited by composition, so factor four is free for EVERY
 *       program with no analysis. Predicted that over a sample of random programs of
 *       random length in this language, 100% have in-degree exactly 1 at every one of
 *       the 27 states, and zero unreachable -- because a composition of bijections is
 *       a bijection and there is nothing a programmer can write that breaks it.
 *
 *   AK3 BUT THE COST STOPS VARYING, and that is factor three lost. Predicted a
 *       straight-line program in this language costs exactly its own length in gates
 *       for every input, so the cost spread over all 27 starting states is EXACTLY
 *       1.00 -- against the 513.8x AH1 needed and the 1.02x AG1 called security
 *       theatre. Registered with the alternative: if any straight-line reversible
 *       program shows a spread above 1.00, the worry is unfounded and reversibility
 *       is free after all.
 *
 *   AK4 so there is a TRILEMMA, and only two of three are available at once:
 *       in-degree one, a cost that varies, and bounded state. Predicted that
 *       demonstrations of each PAIR exist in this corpus while no construction here
 *       has all three -- reversible straight-line code has one and three, hailstone
 *       and the three-word program have two and three, and buying one and two
 *       together requires keeping a history whose size grows with the step count,
 *       which is AJ4's unbounded state. Predicted the history needed grows at least
 *       linearly in steps, so bounded memory forces either a fixed cost or erasure.
 *
 * ------------------------------------------------------------------------------
 * Run: node tools/minimal-audit.js
 */

const { idPerm, chainOf } = require('./perm-lib.js');

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);
const N = 27;                                   // three trits, states 0..26

log('MINIMAL AUDIT — the smallest reversible ternary language\n');

/* --- the language ----------------------------------------------------------
 * Written from the definitions rather than copied from reversible-audit.js, so
 * that reproducing M's group order is a CHECK on both implementations instead of
 * a restatement of one. If they agree on a 25-digit number, neither is a typo.
 */
const trits = s => [s % 3, Math.floor(s / 3) % 3, Math.floor(s / 9) % 3];
const state = t => t[0] + 3 * t[1] + 9 * t[2];

const INC = i => idPerm(N).map(s => { const t = trits(s); t[i] = (t[i] + 1) % 3; return state(t); });
const CINC = (a, b) => idPerm(N).map(s => { const t = trits(s); t[b] = (t[b] + t[a]) % 3; return state(t); });
const C1INC = (a, b) => idPerm(N).map(s => { const t = trits(s); if (t[a] === 1) t[b] = (t[b] + 1) % 3; return state(t); });

const compose = (g, h) => h.map(x => g[x]);     // (g*h)(x) = g(h(x))
const isId = g => g.every((v, i) => v === i);
const orderOf = g => { let k = 1, p = g; while (!isId(p)) { p = compose(g, p); k++; if (k > 100) return null; } return k; };
const isPerm = g => new Set(g).size === g.length;

/** Every gate instance the language admits on three trits. */
function allGates() {
  const gs = [];
  for (let i = 0; i < 3; i++) gs.push({ name: `INC ${i}`, g: INC(i) });
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) {
    gs.push({ name: `CINC ${a} ${b}`, g: CINC(a, b) });
    gs.push({ name: `C1INC ${a} ${b}`, g: C1INC(a, b) });
  }
  return gs;
}
const GATES = allGates();

/* ============================================================================
 * 0. INSTRUMENT CHECK
 * ========================================================================== */
log(line);
log('0. INSTRUMENT CHECK');
log(line);
{
  log(`  the register has ${N} states, and trits round-trip: ` +
    `${idPerm(N).every(s => state(trits(s)) === s)}`);
  log(`  INC 0 moves state 0 to 1: ${INC(0)[0] === 1}`);
  log(`  and applied three times returns everything: ${isId(compose(INC(0), compose(INC(0), INC(0))))}`);
  log(`  C1INC 0 1 leaves states whose trit 0 is not 1 alone: ` +
    `${idPerm(N).filter(s => trits(s)[0] !== 1).every(s => C1INC(0, 1)[s] === s)}`);
  log(`  the identity has order 1, so orderOf is not always answering 3: ${orderOf(idPerm(N)) === 1}`);
  log(`  gate instances in the language: ${GATES.length}`);
}

/* ============================================================================
 * 1. AK1 — is it a language, and is it universal?
 * ========================================================================== */
log('\n' + line);
log('1. AK1 — every gate a permutation of order three, and what they generate');
log(line);
let AK1 = null;
{
  const perms = GATES.filter(x => isPerm(x.g)).length;
  const orders = GATES.map(x => orderOf(x.g));
  const allThree = orders.every(o => o === 3);
  log('   gate            permutation   order');
  log('  ' + '-'.repeat(42));
  for (const { name, g } of GATES.slice(0, 5))
    log(`   ${name.padEnd(14)} ${(isPerm(g) ? 'yes' : 'NO').padStart(11)}   ${String(orderOf(g)).padStart(5)}`);
  log(`   ... ${GATES.length - 5} more`);
  log('');
  log(`  every instance a permutation: ${perms === GATES.length}  (${perms}/${GATES.length})`);
  log(`  every instance of order exactly 3: ${allThree}`);
  log(`  so g inverse = g applied twice, and the language needs NO inverse instructions`);

  const fact = n => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
  const A27 = fact(27) / 2n;
  const order = chainOf(GATES.map(x => x.g), N).order;
  AK1 = { perms, total: GATES.length, allThree, order, A27, isA27: order === A27 };
  log('');
  log(`  group generated: ${order}`);
  log(`  A_27 = 27!/2     : ${A27}`);
  log(`  equal: ${AK1.isA27}`);
  log(`  M recorded the same figure from a separately written implementation, so two`);
  log(`  independent codings agree on a ${A27.toString().length}-digit number.`);
}

/* ============================================================================
 * 2. AK2 — is factor four free for every program?
 * ========================================================================== */
log('\n' + line);
log('2. AK2 — in-degree, over programs a programmer might actually write');
log(line);
let AK2 = null;
{
  let seed = 20260826;
  const rnd = m => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % m; };
  let checked = 0, allOne = 0, worstMax = 0, worstUnreachable = 0;
  for (let trial = 0; trial < 400; trial++) {
    const len = 1 + rnd(12);
    let p = idPerm(N);
    for (let i = 0; i < len; i++) p = compose(GATES[rnd(GATES.length)].g, p);
    const deg = new Array(N).fill(0);
    for (let s = 0; s < N; s++) deg[p[s]]++;
    const max = Math.max(...deg), un = deg.filter(d => d === 0).length;
    checked++;
    if (max === 1 && un === 0) allOne++;
    worstMax = Math.max(worstMax, max);
    worstUnreachable = Math.max(worstUnreachable, un);
  }
  AK2 = { checked, allOne, worstMax, worstUnreachable, frac: allOne / checked };
  log(`  random programs checked: ${checked}   lengths 1 to 12 gates`);
  log(`  with in-degree exactly 1 at every state: ${allOne}  (${(100 * AK2.frac).toFixed(1)}%)`);
  log(`  worst maximum in-degree seen: ${worstMax}`);
  log(`  worst unreachable count seen: ${worstUnreachable}`);
  log('');
  log(`  A composition of bijections is a bijection, so there is nothing a programmer`);
  log(`  can write in this language that breaks it. Factor four costs no analysis,`);
  log(`  no search over 19,683 tables, and no discipline.`);
}

/* ============================================================================
 * 3. AK3 — but does the cost vary?
 * ========================================================================== */
log('\n' + line);
log('3. AK3 — what a straight-line reversible program costs');
log(line);
let AK3 = null;
{
  // Cost of running a program = one step per gate, whatever the data does.
  let seed = 7717;
  const rnd = m => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % m; };
  const spreads = [];
  for (let trial = 0; trial < 50; trial++) {
    const len = 1 + rnd(12);
    const prog = Array.from({ length: len }, () => GATES[rnd(GATES.length)]);
    const costs = [];
    for (let s = 0; s < N; s++) {
      let steps = 0, cur = s;
      for (const { g } of prog) { cur = g[cur]; steps++; }
      costs.push(steps);
    }
    spreads.push(Math.max(...costs) / Math.min(...costs));
  }
  const worst = Math.max(...spreads);
  AK3 = { programs: spreads.length, worstSpread: worst, allFlat: worst === 1 };
  log(`  straight-line programs measured: ${AK3.programs}`);
  log(`  largest cost spread across all 27 starting states: ${worst.toFixed(4)}x`);
  log(`  every program flat at exactly 1.00: ${AK3.allFlat}`);
  log('');
  log(`  for comparison, from earlier sets:`);
  log(`    AH1's three-word program   513.80x   the bar a receipt has to clear`);
  log(`    countdown                   25.38x`);
  log(`    threeway                     1.02x   AG1 called this security theatre`);
  log(`    this language                ${worst.toFixed(2)}x   ${AK3.allFlat ? 'flatter than the theatre' : ''}`);
  log('');
  log(`  Nothing here depends on the data, because branching on data means testing`);
  log(`  data, and a test that discards its answer is erasing. FACTOR THREE IS LOST.`);
}

/* ============================================================================
 * 4. AK4 — the trilemma.
 * ========================================================================== */
log('\n' + line);
log('4. AK4 — pick two');
log(line);
{
  log('   construction                  in-degree 1   cost varies   bounded state');
  log('  ' + '-'.repeat(74));
  const row = (n, a, b, c) => log(`   ${n.padEnd(28)} ${(a ? 'yes' : 'no').padStart(11)}   ${(b ? 'yes' : 'no').padStart(11)}   ${(c ? 'yes' : 'no').padStart(13)}`);
  row('this reversible language', true, false, true);
  row('hailstone (AD)', false, true, true);
  row('three-word program (AH)', false, true, true);
  row('reversible feedback (AI4)', true, false, true);
  row('history operator (AJ1)', true, false, true);
  row('reversible + data-dependent', true, true, false);
  log('');
  log(`  Nothing in this corpus has all three. The last row is Bennett's construction:`);
  log(`  a reversible machine CAN branch on data, but only by keeping the record of`);
  log(`  which way it went, so the history grows with the step count.`);

  // How fast does that history grow? One trit per branch, at least.
  log('');
  log('   steps    branch records to keep    trits    trytes');
  log('  ' + '-'.repeat(58));
  for (const k of [10, 100, 1000, 10000]) {
    log(`   ${String(k).padStart(6)}   ${String(k).padStart(22)}   ${String(k).padStart(6)}   ${String(Math.ceil(k / 6)).padStart(6)}`);
  }
  log('');
  log(`  A tryte holds six trits, so a thousand data-dependent steps costs 167 trytes`);
  log(`  of history that can never be discarded -- and AJ4 already measured what`);
  log(`  happens when bounded memory meets a state that will not stop growing.`);
  log('');
  log(`  So: IN-DEGREE ONE, A COST THAT VARIES, BOUNDED STATE. Pick two.`);
}

log('\n' + line);
log('Registered predictions AK1-AK4 are in this file\'s docstring. Outcomes go to');
log('FINDINGS.json and are asserted in test/test-minimal.js.');
log(line);

module.exports = { INC, CINC, C1INC, GATES, compose, orderOf, isPerm, trits, state, N, AK1, AK2, AK3 };
