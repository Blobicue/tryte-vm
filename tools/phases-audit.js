/* PHASES AUDIT — where R2 actually spends its time.
 *
 * Set `AX`. `AV1` decomposed the ORACLE by ablation and found the answer its own
 * operation count had argued against: allocation in the update loop is 11.1% of the
 * gap to R1, not the majority. Nothing has ever decomposed R2, and R2 is the solver
 * everything now runs on.
 *
 * The reason to do it before anything else is that it BOUNDS what a faster solver can
 * be worth. A bitsliced R3 would parallelise across operand pairs, and the phase that
 * resists slicing is the reachability walk -- its worklist is a per-lane gather. If
 * that walk is a minority of R2, the ceiling on R3 is set before a single lane is
 * filled. Nobody knows which it is, and a set that measured R3 without this number
 * would be unable to say whether a disappointing result was the technique or the
 * headroom.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * THREE PHASES, NOT TWO. Earlier discussion of this framed it as "reach against the
 * update loop", and reading `solveFn` says otherwise. One pass is three sequential
 * loops with three different trip counts:
 *
 *   CONDUCTION  once per DEVICE. Reads `value`, writes `cond`.
 *   REACH       railCount x 2 calls, each a walk over the CSR. Reads `cond`,
 *               writes `reachDef` / `reachPos`.
 *   UPDATE      once per NODE, each scanning railCount rails twice. Reads the
 *               reachability bitsets, writes `value`, sets `changed`.
 *
 * Conduction has never been named as a cost at all, and it is the one phase that
 * scales with devices rather than nodes.
 *
 * THE ABLATION `AV1` USED DOES NOT TRANSFER, and this is the whole design problem.
 * Removing a phase from R2 corrupts the input of the next: ablate conduction and
 * `cond` goes stale, so REACH traverses a different graph and its cost moves; ablate
 * reach and the bitsets go stale, so UPDATE takes different branches. A subtractive
 * decomposition would measure each phase against a perturbed neighbour and report the
 * perturbation as the phase.
 *
 * SO THE DECOMPOSITION IS ADDITIVE. Four modules are emitted from the same IR by
 * substituting into `FUNCS`, which `solver-wasm.js` exports as a list for exactly this
 * purpose:
 *
 *   WHOLE  all three phases, early exit removed.
 *   C      the conduction loop alone.
 *   R      the reach calls alone.
 *   U      the update loop alone.
 *
 * Each variant is seeded to the SAME realistic state -- captured after a full solve of
 * a real operand pair, so `value`, `cond` and the bitsets all hold values the network
 * actually produces -- and then run for a fixed pass count over that fixed state. No
 * phase evolves the state another phase reads, because each variant is timed in
 * isolation and re-seeded. That is what makes the three numbers comparable.
 *
 * THE EARLY EXIT IS REMOVED FROM EVERY VARIANT INCLUDING WHOLE. `solve` returns as
 * soon as a pass changes nothing, so a variant that never writes `value` would exit on
 * pass one and be timed over a different amount of work. Every variant runs exactly
 * the registered number of passes.
 *
 * FIXED, and not at risk:
 *   - The benchmark is `AV`'s: the unrestored six-trit tree ripple adder,
 *     `tRippleAdder(net, 6, false)`, 624 switches, seven passes. `AX3`'s second
 *     network is the decoded adder, 540 switches, whose node-to-device ratio differs.
 *   - Fixed pass count per timed run, early exit removed, state re-seeded per run.
 *   - Wall-clock median of five repetitions after a discarded warm-up, all variants
 *     interleaved in one process on one machine, as `AV` did. `AV`'s recorded seconds
 *     are from other hardware and are not a baseline for anything here.
 *   - Shares are reported as a fraction of WHOLE, not of the sum of the parts. Which
 *     of those two denominators is used decides `AX4`, so it is fixed here.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AX1 THE REACHABILITY WALK IS THE MAJORITY OF R2, AND ITS SHARE LANDS IN [0.55,
 *       0.80] of WHOLE on the benchmark. Below 0.55 or above 0.80 refutes it.
 *       AT RISK: the band comes from an operation count, and an operation count is
 *       exactly what misled `AV1`. Per pass this network does about 3,744 directed
 *       edge visits across six walks, against 624 device evaluations and 328 node
 *       updates of six bitset tests each -- so reach is around 70% BY COUNT, and `AV1`
 *       registered a majority on that kind of reasoning and failed at 11.1%. The route
 *       below 0.55 is that a bitset walk is a load, a test, a set and a conditional
 *       push over a CSR that fits in L1, while the update loop's inner rail scan
 *       recomputes a word offset by multiply per rail per node; cheap-looking work
 *       repeated 328 times can outweigh expensive-looking work repeated 3,744 times,
 *       and that is the same shape as the thing `AV1` got wrong. The route above 0.80
 *       is the stack traffic and the unpredictable branch on `seen`.
 *
 *   AX2 CONDUCTION IS NOT NEGLIGIBLE: its share of WHOLE is at least 0.10.
 *       AT RISK: and this is the prediction that does NOT depend on `AX1`, which is
 *       deliberate -- `AW` registered four predictions resting on one premise and they
 *       failed together, and `AV1` and `AV2` did the same one set earlier. Conduction
 *       is the simplest phase, it is branch-heavy but allocation-free and perfectly
 *       sequential, and 624 iterations against reach's 3,744 edge visits could put it
 *       well under a tenth. It has also never been counted, so there is no prior
 *       measurement pointing either way.
 *
 *   AX3 THE SPLIT IS A PROPERTY OF THE ALGORITHM, NOT OF THE NETWORK. Each of the
 *       three shares on the decoded adder is within 0.10 absolute of the same share on
 *       the tree adder.
 *       AT RISK: the two networks have deliberately different shapes -- 540 devices
 *       over 208 nodes against 624 over 328, so the decoded adder does proportionally
 *       more conduction per node and fewer node updates per device. If the shares
 *       track those ratios rather than staying put, this fails, and it fails in a way
 *       that would make `AX1`'s single number useless for predicting any other
 *       network. `AV4` asked a size question and found no separation, but it varied
 *       total size while holding shape roughly constant; this varies shape.
 *
 *   AX4 AND THE DECOMPOSITION IS HONEST: C + R + U sums to within 0.15 of WHOLE.
 *       AT RISK: this is the instrument checking itself and it can fail in both
 *       directions. Over 1.15 means the isolated variants are slower than the phases
 *       are in situ -- each variant re-reads state that the whole pass keeps warm, so
 *       three separate passes over the same arrays can cost more than one. Under 0.85
 *       means the parts are faster in isolation than together, which is what happens
 *       if the whole pass exceeds a cache level the individual phases fit inside. If
 *       this fails, `AX1` through `AX3` are shares of something that is not the whole,
 *       and the honest report is that the method does not decompose this program --
 *       which is a result, and is why this is registered rather than checked quietly.
 *
 * NOT REGISTERED — derivable, already recorded, or measured while building the
 * instrument, and listed so the registered set is not inflated:
 *   - The trip counts. 624 devices, 328 nodes, 3 rails, 7 passes are `Z3`'s and `Y2`'s,
 *     and the 3,744 edge visits are multiplication over them.
 *   - That R2 is about 22x R0. That is the product of two numbers already in the
 *     manifest, and the composite has never been registered by anyone.
 *   - What any of this implies for a bitsliced R3. That is arithmetic over `AX1`
 *     once `AX1` exists, and belongs to whatever set proposes R3 rather than here.
 *   - That the four variants agree with each other on anything. They deliberately do
 *     not: three of them compute a wrong answer by construction, and this set times
 *     them rather than trusting them. The gate that matters here is that WHOLE with
 *     its early exit restored still agrees with R0, which is `AV`'s gate re-run.
 *
 * Run:  npm run audit:phases
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

// ---------------------------------------------------------------- the measurement

function report() {
  log('PHASES AUDIT: where R2 actually spends its time.');
  log(line);

  log('');
  log('--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  // AV's gate re-run here, on WHOLE with its early exit restored: a variant of the
  // module that no longer agrees with the oracle is not a variant of the solver.
  // The other three compute a wrong answer BY CONSTRUCTION and are timed, not
  // trusted -- so what has to be shown is that the substitution machinery changed
  // only the phase it was aimed at, and that each ablated variant really did stop
  // doing the work it was supposed to stop doing.
  // AD2 memoised only terminating values and reported the attacker as 300x WORSE --
  // in the flattering direction, which is the direction nothing catches by surprise.

  log('');
  log('--- AX1  the reachability walk, as a share of the whole ---');
  log('');
  log('--- AX2  conduction, the phase nobody had counted ---');
  log('');
  log('--- AX3  the same split on a network of a different shape ---');
  log('');
  log('--- AX4  and whether the parts sum to the whole ---');
  log('');
  log(line);
}

if (MAIN) report();

module.exports = { report };
