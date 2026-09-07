/* RELAXATION AUDIT — the price of the traversal, before any lane is added.
 *
 * Set `AY`. This set exists to be able to kill a larger one cheaply.
 *
 * THE LARGER ONE. A bitsliced solver would run many operand pairs at once in the bits
 * of a machine word. `AX` measured where a solver pass goes -- reach 0.6167, update
 * 0.2877, conduction 0.1131 -- and the update loop and the conduction loop both slice
 * without argument: each is a flat scan over an array with no data-dependent
 * addressing. `reach` does not. It is a stack-based depth-first walk, and its worklist
 * -- pop a node, read `adjStart[at]`, push its unseen neighbours -- is a PER-LANE
 * GATHER. Sixty-four lanes would each want a different node at the top of the stack,
 * and there is no word-parallel way to serve them.
 *
 * The escape is to stop walking. Frontier relaxation computes the same reachable set
 * by sweeping EVERY edge repeatedly and propagating the bit until nothing changes,
 * which is branch-free, gather-free, and slices perfectly -- every lane sweeps the
 * same edges in the same order and only the bits differ.
 *
 * AND THAT IS AN ALGORITHM CHANGE, WHICH THIS REPOSITORY ALREADY KNOWS HOW TO PRICE.
 * `design/13-instrument.md` fixed the rule when R1 was built: "If R1 changes the
 * algorithm, R1-against-R0 measures algorithm and representation together and the
 * split stops isolating anything." A bitsliced R3 would change the traversal AND add
 * lanes at once, and a single ratio against R2 could not say which had bought what.
 * So the traversal change is priced first, on its own, at one lane.
 *
 * IT CAN KILL R3 HERE, WHICH IS THE POINT. Relaxation does more work than the walk it
 * replaces: the walk touches the edges incident to the reachable set once, while
 * relaxation sweeps all edges once per level of frontier depth. If that costs a factor
 * this set cannot name in advance, the lanes have to win it back before they buy
 * anything, and R3 should be argued against a measured number rather than built and
 * then explained.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * TWO SOLVERS, ONE LANE EACH.
 *
 *   R2   `src/solver-wasm.js` as it stands. The stack walk. `AV` built it, `AV`'s
 *        gate proved it, `AW` spent it, `AX` decomposed it.
 *   R2f  the same module with `reachFn` replaced by frontier relaxation, and
 *        NOTHING else altered. Same header, same layout, same conduction loop, same
 *        update loop, same fixed-point loop, same early exit.
 *
 * R2f IS NOT AN OPTIMISATION AND MUST NOT BE ALLOWED TO BECOME ONE. It exists to
 * isolate one variable. Any improvement to conduction or to the update loop that ships
 * inside R2f puts that improvement into `AY1`'s ratio and calls it the traversal.
 *
 * WHAT RELAXATION IS, precisely, so a reader can tell it from a walk. Seed the rail's
 * bit. Then repeat: sweep the whole edge array; for each edge whose device conducts
 * (definite) or is not known not to conduct (possible), OR the bit from each endpoint
 * into the other, except that a DRIVEN node never propagates outward -- axiom `N2`,
 * sources are terminals, the same rule the walk enforces by not pushing them. Stop
 * when a sweep changes no bit. The fixed point is identical to the walk's; only the
 * order of arrival differs.
 *
 * FIXED, and not at risk:
 *   - The benchmark is `AV`'s and `AX`'s: the unrestored six-trit tree ripple adder,
 *     `tRippleAdder(net, 6, false)`. `AY3`'s second network is the decoded adder,
 *     whose node-to-device ratio differs.
 *   - THE STATE SET IS SIXTY-FOUR STATES, NOT ONE. `AX` timed a single converged
 *     state, which was right for a decomposition and is wrong here: a walk's cost
 *     depends on how much of the graph is reachable and relaxation's depends on how
 *     deep the frontier goes, so one state could flatter either. The states are the
 *     converged states of the operand pairs at indices 0, 8192, 16384, ... of `AV`'s
 *     benchmark order, and every timing below is the total over all sixty-four.
 *   - PASS BLOCK AND REPETITIONS ARE FIXED HERE AS NUMBERS, because `AX` left the
 *     block free and it had to be chosen after the fact: 20,000 passes per timed run,
 *     median of five kept repetitions of six, R2 and R2f interleaved in one process on
 *     one machine. `AX`'s seconds are not a baseline for anything here.
 *   - Ratios are R2f over R2, so a number BELOW one means relaxation is slower.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AY1 RELAXATION IS SLOWER AT ONE LANE, AND THE RATIO R2f/R2 LANDS IN [0.35, 0.75].
 *       Above 0.75 refutes it -- relaxation would be within a third of the walk, or
 *       faster. Below 0.35 refutes it the other way, at worse than a factor of three.
 *       AT RISK: the band is drawn from an edge count and from ONE unrecorded number.
 *       Scratch code written while planning R3 put the mean frontier depth at about
 *       3.16 and the maximum at 5 on the decoded adder; that is not in the corpus, it
 *       is not a finding of this set, and it is quoted here only because a reader is
 *       owed the provenance of the band. Take reach at `AX`'s 0.6167 and multiply its
 *       edge work by three and the whole lands near 0.43, so the band is centred a
 *       little above pure edge counting on the argument that relaxation's edge scan is
 *       CHEAPER than the walk's -- no stack traffic and no unpredictable branch on
 *       `seen`. That argument is exactly the kind that failed in `AV1`, where the
 *       operation count and the clock disagreed, and it could fail the same way here
 *       in either direction: above 0.75 if branch-freedom is worth more than the extra
 *       sweeps, below 0.35 if sweeping the whole edge array evicts what the walk kept
 *       resident.
 *
 *   AY2 AND THE CHANGE IS LOCAL. Conduction and the update loop cost the same in R2f
 *       as in R2: each phase's absolute seconds, measured by `AX`'s additive method,
 *       differ by less than 0.10 relative between the two solvers.
 *       AT RISK: independent of `AY1` by construction, and registered that way because
 *       `AV1` and `AV2` failed on a premise they shared and `AW`'s four did it again.
 *       It can fail while `AY1` holds and it can hold while `AY1` fails. The route to
 *       failure is that relaxation writes the reachability bitsets in a different
 *       ORDER and leaves them in a different cache state, so the update loop that
 *       reads them next pays differently -- a phase can be slowed by its neighbour
 *       without a line of its own code changing, and if that happens then `AY1`'s
 *       ratio is not the traversal alone and this set has not isolated what it claims.
 *
 *   AY3 THE PRICE IS A PROPERTY OF THE ALGORITHM, NOT OF THE NETWORK. The R2f/R2 ratio
 *       on the decoded adder is within 0.15 absolute of the ratio on the tree adder.
 *       AT RISK: the two differ in the ratio the change is sensitive to. Relaxation
 *       sweeps EDGES and the walk visits REACHABLE NODES, and the decoded adder packs
 *       540 devices over 208 nodes against the tree adder's 624 over 328 -- so the
 *       decoded network has markedly more edges per node, which is precisely the axis
 *       that should separate the two costs if anything does. `AX3` found the phase
 *       shares stable across these same two networks; this asks the harder version of
 *       that question about a quantity built to be sensitive to their difference.
 *
 *   AY4 AND RELAXATION'S OWN DEPTH IS SMALL AND DATA-DEPENDENT. Over the sixty-four
 *       states on both networks, the number of sweeps a single reachability
 *       computation needs to reach its fixed point never exceeds 6, and is not the
 *       same for every state.
 *       AT RISK: both halves can fail and they fail in opposite directions. The bound
 *       fails if any state needs 7 or more, which is what a long conducting chain
 *       would produce and which the scratch maximum of 5 was measured over 656 pairs
 *       on one network only. The variability half fails if the depth is CONSTANT --
 *       and that is not the safe half to assume, because `Y2` established that this
 *       machine's solver pass count is structural and independent of the data, and
 *       depth could inherit the same property from the same gate-dependency argument.
 *       It matters beyond this set: constant depth means lanes never diverge and a
 *       bitsliced sweep costs the same per lane as one, while variable depth means
 *       every lane pays the deepest one in its word.
 *
 * NOT REGISTERED — derivable, already recorded, or measured elsewhere, and listed so
 * the registered set is not inflated:
 *   - The phase shares. `AX1` through `AX4`, measured, and used here as inputs.
 *   - Device, node and pass counts. `Z3`'s and `Y2`'s.
 *   - That relaxation computes the same reachable set as the walk. That is the GATE,
 *     not a prediction: if it does not, there is no R2f and nothing to time.
 *   - What any of this implies for a bitsliced R3 -- the break-even lane count is
 *     arithmetic over `AY1` once `AY1` exists, and belongs to the set that proposes
 *     R3. This set deliberately adds no lanes.
 *   - The 3.16 and the 5 quoted in `AY1`'s risk line. Scratch measurements made while
 *     planning, on one network, never committed, and recorded here as provenance for
 *     a registered band rather than as results.
 *
 * Run:  npm run audit:relax
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

/* Fixed here as numbers rather than left to the runner, because AX left its pass
 * block free and it had to be chosen after a short block was seen to straddle a
 * registered line. A free parameter of an instrument is a decision somebody makes
 * later, with the verdicts already in view. */
const PASS_BLOCK = 20000;
const REPS = 6;                    // five kept, the first discarded as warm-up
const STATES = 64;                 // converged states, strided through AV's order

const NP = require('../src/netpack.js');
const ON = 0 + 1, OFF = 0;         // netpack's conduction codes; the third is UNKNOWN

/* ========================================================== THE REFERENCE
 *
 * Frontier relaxation over the packed form, in plain JavaScript, computing the same
 * reachable set as `NP.reach` computes by walking a stack.
 *
 * IT IS HERE TO BE AN ORACLE, NOT TO BE TIMED. `AY1` prices the traversal change in
 * WEBASSEMBLY, and nothing below times this function. It exists because the emitter's
 * own docstring warns that a type or arity mistake surfaces as a validation error far
 * from its cause, and porting an algorithm into that IR without a correct reference to
 * differ against is how two attempts at this set were spent. Write the answer down in
 * a language that can be debugged, prove it equals the walk, and then the wasm either
 * matches this or is wrong in a way that can be located.
 *
 * TWO RULES CARRIED OVER FROM THE WALK, both easy to lose and both load-bearing:
 *
 *   `definite` accepts only a conducting device; `possible` accepts anything not
 *   known to be off. Collapsing those two gives a solver that agrees with the oracle
 *   on most networks and quietly disagrees wherever a gate is undetermined.
 *
 *   A DRIVEN NODE TAKES THE BIT AND DOES NOT PASS IT ON -- axiom `N2`, sources are
 *   terminals, which the walk enforces by not pushing them. The SEED rail is the
 *   exception: the walk pushes it unconditionally, so it propagates outward even
 *   though it is itself driven. A relaxation that treats the seed like any other
 *   driven node computes nothing; one that lets every driven node propagate lets a
 *   path run THROUGH a rail, which is the bug `src/device.js` records having had, and
 *   which makes correct circuits resolve to X.
 *
 * Returns the number of sweeps taken, the last of which changed nothing.
 */
function relaxReach(P, railIdx, bits, definite) {
  const { adjStart, adjNode, adjDev, cond, driven, words, nodeCount } = P;
  const base = railIdx * words;
  for (let w = 0; w < words; w++) bits[base + w] = 0;
  const start = P.railId[railIdx];
  bits[base + (start >>> 5)] |= (1 << (start & 31));

  let sweeps = 0, changed = true;
  while (changed) {
    changed = false;
    sweeps++;
    for (let at = 0; at < nodeCount; at++) {
      if (at !== start && driven[at]) continue;
      if (!(bits[base + (at >>> 5)] & (1 << (at & 31)))) continue;
      const end = adjStart[at + 1];
      for (let e = adjStart[at]; e < end; e++) {
        const c = cond[adjDev[e]];
        if (definite ? c !== ON : c === OFF) continue;
        const other = adjNode[e];
        const w = base + (other >>> 5), bit = 1 << (other & 31);
        if (bits[w] & bit) continue;
        bits[w] |= bit;
        changed = true;
      }
    }
  }
  return sweeps;
}

// ---------------------------------------------------------------- the measurement

function report() {
  log('RELAXATION AUDIT: the price of the traversal, before any lane is added.');
  log(line);

  log('');
  log('--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  // THE GATE IS NOT OPTIONAL AND IT IS DIFFERENT FROM AX'S. AX timed four variants
  // that computed a wrong answer by construction and were never meant to agree with
  // anything. R2f is a SOLVER: it must reach the same fixed point as R2 and as the
  // oracle, or there is nothing here to time. AV's gate is re-run on it whole --
  // every network, every state, both refusals, the pass count at k and k-1 -- and
  // the reachability bitsets are additionally compared set-for-set against the
  // walk's, because two solvers can agree on every node value while disagreeing
  // about which rails could reach what, and it is the bitsets this set changed.
  //
  // AND THE SUBSTITUTION MUST BE THE ONLY CHANGE: every function but `reach`
  // byte-identical between the two modules, and `moduleBytes()` with no argument
  // still emitting exactly what AV timed.
  //
  // AD2 memoised only terminating values and reported the attacker as 300x WORSE --
  // in the flattering direction, which is the direction nothing catches by surprise.

  log('');
  log('--- AY1  what the traversal change costs at one lane ---');
  log('');
  log('--- AY2  whether the change stayed inside the phase it was made in ---');
  log('');
  log('--- AY3  the same price on a network with more edges per node ---');
  log('');
  log('--- AY4  how deep the frontier goes, and whether it varies ---');
  log('');
  log(line);
}

if (MAIN) report();

/* ====================================================== R2f's REACH, IN THE IR
 *
 * `relaxReach` above, expressed in the emitter's statement and expression layer, so
 * that substituting it into `FUNCS` yields R2f: R2 with the walk replaced and nothing
 * else touched. It takes `reach`'s NAME and ARITY, because `solveFn` calls it by name
 * three rails at a time and that call site is one of the things this set must not
 * change.
 *
 * SIMPLER THAN THE FUNCTION IT REPLACES, which is worth saying because the emitter's
 * docstring makes writing anything in this IR sound forbidding: relaxation needs no
 * stack, so there is no push, no pop and no stack pointer. It is a `changed` flag
 * around a scan over nodes around a scan over each node's adjacency slice.
 *
 * THE IR HAS NO `continue`, so the two guards `relaxReach` writes as early exits --
 * the node must be the seed or undriven, and must already hold the bit -- become one
 * `ifThen` wrapping the whole body. That is the only structural difference between the
 * two, and it is why they are worth differing against each other rather than eyeballing.
 */
const W = require('../src/wasm-emit.js');
const SW = require('../src/solver-wasm.js');

const hdr = nm => W.load32(W.konst(SW.FIELD[nm]));
const at4 = (base, i) => W.add(W.get(base), W.shl(i, W.konst(2)));
const at1 = (base, i) => W.add(W.get(base), i);
/** The word holding node `n`'s bit, and the bit itself. */
const wordOf = n => W.add(W.get('base'), W.shl(W.shrU(n, W.konst(5)), W.konst(2)));
const bitOf = n => W.shl(W.konst(1), W.and(n, W.konst(31)));

const relaxFn = W.fn('reach', {
  params: ['rail', 'bitsPtr', 'definite'],
  locals: ['words', 'base', 'start', 'w', 'at', 'e', 'endE', 'c', 'acc', 'other',
    'wp', 'bit', 'cur', 'changed', 'nodeCount',
    'adjStartP', 'adjNodeP', 'adjDevP', 'condP', 'drivenP', 'railIdP'],
  body: [
    W.set('words', hdr('words')),
    W.set('nodeCount', hdr('nodeCount')),
    W.set('base', W.add(W.get('bitsPtr'),
      W.shl(W.mul(W.get('rail'), W.get('words')), W.konst(2)))),
    ...W.forUpTo('w', W.konst(0), W.get('words'),
      [W.store32(at4('base', W.get('w')), W.konst(0))]),
    W.set('railIdP', hdr('railId')),
    W.set('start', W.load32(at4('railIdP', W.get('rail')))),
    W.set('wp', wordOf(W.get('start'))),
    W.store32(W.get('wp'), W.or(W.load32(W.get('wp')), bitOf(W.get('start')))),
    W.set('adjStartP', hdr('adjStart')),
    W.set('adjNodeP', hdr('adjNode')),
    W.set('adjDevP', hdr('adjDev')),
    W.set('condP', hdr('cond')),
    W.set('drivenP', hdr('driven')),
    W.set('changed', W.konst(1)),
    W.whileLoop(W.ne(W.get('changed'), W.konst(0)), [
      W.set('changed', W.konst(0)),
      ...W.forUpTo('at', W.konst(0), W.get('nodeCount'), [
        // The seed rail propagates though it is driven; every other driven node takes
        // the bit and stops (N2). And a node with no bit has nothing to pass on.
        W.ifThen(
          W.and(
            W.or(W.eq(W.get('at'), W.get('start')),
              W.eqz(W.load8u(at1('drivenP', W.get('at'))))),
            W.ne(W.and(W.load32(wordOf(W.get('at'))), bitOf(W.get('at'))), W.konst(0))),
          [
            W.set('e', W.load32(at4('adjStartP', W.get('at')))),
            W.set('endE', W.load32(at4('adjStartP', W.add(W.get('at'), W.konst(1))))),
            W.whileLoop(W.ltS(W.get('e'), W.get('endE')), [
              W.set('c', W.load8u(at1('condP', W.load32(at4('adjDevP', W.get('e')))))),
              // definite: the edge conducts. possible: it is not known NOT to conduct.
              W.ifElse(W.ne(W.get('definite'), W.konst(0)),
                [W.set('acc', W.eq(W.get('c'), W.konst(1)))],
                [W.set('acc', W.ne(W.get('c'), W.konst(0)))]),
              W.ifThen(W.get('acc'), [
                W.set('other', W.load32(at4('adjNodeP', W.get('e')))),
                W.set('wp', wordOf(W.get('other'))),
                W.set('bit', bitOf(W.get('other'))),
                W.set('cur', W.load32(W.get('wp'))),
                W.ifThen(W.eq(W.and(W.get('cur'), W.get('bit')), W.konst(0)), [
                  W.store32(W.get('wp'), W.or(W.get('cur'), W.get('bit'))),
                  W.set('changed', W.konst(1)),
                ]),
              ]),
              W.set('e', W.add(W.get('e'), W.konst(1))),
            ]),
          ]),
      ]),
    ]),
  ],
});

/** R2f's function list: `AV`'s four with the walk swapped for relaxation. */
const RELAX_FUNCS = [relaxFn, ...SW.FUNCS.slice(1)];

module.exports = {
  report, relaxReach, relaxFn, RELAX_FUNCS, PASS_BLOCK, REPS, STATES,
};
