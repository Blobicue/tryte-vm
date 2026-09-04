'use strict';
/* SOLVER AUDIT — what does the packed representation buy a switch-level solver, and
 * what does WebAssembly buy on top of it?
 *
 * Set `AV`. Every earlier set measures the MACHINE. This one measures the
 * INSTRUMENT, because the instrument has started to bound what the corpus may
 * claim: `Y1` swept all 531,441 operand pairs at carry-in 0 and then sampled
 * carry-in +1 and -1 at one pair in 121, `E1` did the same, and every restored
 * variant in `Z` is sampled at that stride on networks up to 1,776 switches. Those
 * are disclosed samples, and the reason each one is a sample is `Net.solve()`
 * rather than the question being asked.
 *
 * WHAT THIS SET DELIBERATELY DOES NOT DO: it does not run those sweeps. An
 * instrument that has not been held against the oracle produces facts about the
 * instrument -- T-INSTRUMENT-FALSE-VERDICT, sixteen bites and counting -- so the
 * sweeps belong to a later set, registered once R1 and R2 have been proved against
 * `src/device.js` and not before. This set asks only what building them costs and
 * what each layer of the rewrite is worth.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * THREE IMPLEMENTATIONS, because two cannot separate the two effects.
 *
 *   R0  `src/device.js` as it stands. The oracle. Never optimised, never replaced.
 *   R1  the SAME ALGORITHM over a packed representation: dense integer node ids,
 *       parallel typed arrays for the device table, CSR adjacency, word-packed
 *       reachability, and rail and driven masks computed once per network.
 *   R2  the same algorithm again, emitted as WebAssembly by JavaScript in `src/`,
 *       over the same packed form.
 *
 * R1 is a NEGATIVE CONTROL, not a stepping stone. Same fixed-point loop, same six
 * traversals per pass (three rails x definite/possible), same termination test,
 * same `init` and `driven` semantics, same throw-at-the-cap behaviour. No
 * incremental recomputation and no fusing the two walks. Without R1 the comparison
 * measures a data-structure rewrite and reports it as WebAssembly.
 *
 * FIXED BEFORE THE RUN, and not at risk:
 *   - The benchmark network for AV2 and AV3 is the unrestored six-trit tree ripple
 *     adder, `tRippleAdder(net, 6, false)`: 624 switches, 328 nodes, seven passes.
 *   - The second network for AV4 is the same adder at `restore: 'leafmid'`: 1,776
 *     switches, thirty-one passes. Both are Z3's, already on the record; this set
 *     does not re-measure them. Its node count is not on the record and is listed
 *     under NOT REGISTERED below rather than used to carry an argument here.
 *   - The sample is the first 20,000 operand pairs of the carry-in-0 sweep in
 *     the audit's own iteration order, one solve per pair, no pass-count probe.
 *   - ALL THREE ARE TIMED IN ONE PROCESS ON ONE MACHINE, interleaved rather than
 *     run back to back. The seconds recorded in `Y1` (1,170) and `E1` (1,420) are
 *     from other hardware and are NOT a baseline for anything here; a ratio taken
 *     against them would be measuring the machine.
 *   - Wall-clock median of five repetitions, discarding the first as warm-up.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AV1 THE COST IS IN THE UPDATE LOOP, NOT THE TRAVERSAL. More than half of R0's
 *       per-solve wall-clock is spent in the per-node update that closes each pass,
 *       and not in the six reachability walks. Measured by ablation: a copy of R0
 *       with only the update loop's allocation removed -- the two
 *       `Object.keys(this.rails).filter(...)` calls per node per pass replaced by a
 *       preallocated scan producing identical values -- recovers more than half the
 *       gap between R0 and R1. Refuted if it recovers half or less.
 *       AT RISK: my own count points the OTHER WAY and I am registering against it.
 *       One solve on this network is about 26,000 edge visits (seven passes, six
 *       walks, 624 edges) against about 4,600 array allocations and 13,800 `Set`
 *       lookups in the update loop (328 nodes, seven passes, two filters each).
 *       Edge visits outnumber update operations five to one, so the traversal is
 *       the larger term BY COUNT. The prediction is that allocation is expensive
 *       enough per operation to invert that, and if allocation is cheap under a
 *       generational nursery it will not, and this fails.
 *
 *   AV2 THE REPRESENTATION IS WORTH MORE THAN AN ORDER OF MAGNITUDE. The R1-over-R0
 *       median wall-clock ratio on the benchmark lands in [15, 40]. Below 15 or
 *       above 40 refutes it.
 *       AT RISK: both bounds have a route, and the band is deliberately narrow
 *       enough to be reachable from either side. The anchor is R0 at roughly 75
 *       nanoseconds per edge visit, measured while planning this set; a packed walk
 *       that gets an edge visit into the low single-digit nanoseconds lands near the
 *       middle of the band, and that is the whole of the derivation.
 *       BELOW 15 -- R0's `Set`-based `seen` can abandon a traversal early where a
 *       bitset walk still has to finish the frontier, so R1 may do strictly MORE
 *       work per pass than R0 does, and V8's inline caches handle a monomorphic
 *       `Map`-to-array walk better than the object-churn description suggests.
 *       ABOVE 40 -- this is where AV1 and AV2 are IN TENSION BY CONSTRUCTION, which
 *       is registered here rather than reconciled later. If AV1 holds and allocation
 *       is the dominant term, then removing every allocation from the update loop
 *       AND the six fresh `Set`s per pass should compound past 40 and break this.
 *       Both cannot comfortably hold at the top of their ranges, and I am
 *       registering both rather than hedging one against the other.
 *
 *   AV3 WEBASSEMBLY BUYS LESS THAN THE REWRITE DID, AND LESS THAN A FACTOR OF TWO.
 *       The R2-over-R1 median ratio on the same benchmark lands in [1.0, 2.0].
 *       AT RISK: BELOW 1.0 refutes it, and that is the outcome I would least like
 *       and cannot rule out -- a hand-rolled emitter does no register allocation and
 *       no strength reduction, TurboFan does both, and wasm losing outright to
 *       optimised typed-array JavaScript on a pointer-chasing loop is a real
 *       result rather than a formality. ABOVE 2.0 refutes it the other way, and the
 *       route is bounds-checking: every `Uint32Array` index in R1 is checked and
 *       every `i32.load` into R2's single linear memory is not. I am registering
 *       the answer that makes step 4 of `design/13-instrument.md` dead weight.
 *
 *   AV4 AND THE ADVANTAGE IS A CONSTANT, NOT A FUNCTION OF SIZE. The R2-over-R1
 *       ratio on the `leafmid` adder (1,776 switches, thirty-one passes) differs
 *       from the same ratio on the unrestored adder (624 switches, seven passes) by
 *       less than 0.5 in absolute terms. Refuted if the two separate by 0.5 or more.
 *       AT RISK: and WEAK BY CONSTRUCTION, which is registered here rather than
 *       discovered in the write-up. `leafmid` is 2.85x the switches of the
 *       unrestored adder and its node count grows by close to the same factor, so
 *       the traversal term and the update term grow at nearly the same rate between
 *       these two and this pair cannot separate them. What it can still catch is a
 *       working set falling out of cache on one side and not the other -- both
 *       reachability bitsets are small enough to sit in L1 on both networks, so I
 *       predict no separation, and any separation at all refutes it. A pair chosen
 *       to vary switches and nodes independently would be the better instrument and
 *       this set does not build one.
 *
 * NOT REGISTERED — computable before the run, or already on the record, and listed
 * here so the registered set is not inflated with facts that were never at risk:
 *   - Switch and pass counts for every network above. All `Z3`, already measured,
 *     and the pass counts were derived by hand from gate-dependency depth before
 *     that run. This set does not re-measure them.
 *   - NODE counts, which are NOT on the record: 328 for the unrestored tree adder,
 *     904 for `leafmid`, 208 for the decoded adder. Counted while planning this set
 *     by walking `net.devices` and collecting `a`, `b` and `gate`. They are
 *     structure, they are arithmetic over a network nobody chose for this purpose,
 *     and they were known before any prediction here was written -- so they are
 *     recorded as measured-not-registered rather than counted as findings.
 *   - That pass counts are independent of the operand data. `Y2` derived it and
 *     `Z3` measured `pairs_differing_by_data: 0`.
 *   - That R1 and R2 agree with R0. That is the anti-divergence GATE, not a
 *     prediction: if it fails there is no instrument and nothing to report.
 *   - The 26,000 / 4,600 / 13,800 operation counts quoted in AV1's risk line, which
 *     are arithmetic over structure this set stipulated.
 * ------------------------------------------------------------------------------
 * Run:  npm run audit:solver
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

// ---------------------------------------------------------------- the measurement

function report() {
  log('SOLVER AUDIT — what the packed representation buys, and what WebAssembly buys on top.');
  log(line);

  log('\n--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  // R1 and R2 are held against R0 here, exhaustively on every small builder and on
  // all 27 input triples of both adder cells, BEFORE any timing is reported. A
  // ratio between two solvers that disagree is a fact about neither.
  // AD2 memoised only terminating values and reported the attacker as 300x WORSE --
  // in the flattering direction, which is the direction nothing catches by surprise.

  log('\n--- AV1  where R0 spends its time: the ablation ---');
  log('\n--- AV2  R1 over R0: what the representation buys ---');
  log('\n--- AV3  R2 over R1: what WebAssembly buys ---');
  log('\n--- AV4  the same ratio at 2.8x the size ---');
  log('\n' + line);
}

if (MAIN) report();

module.exports = { report };
