'use strict';
/* INSERT AUDIT -- what a forger who may LENGTHEN the ledger actually pays.
 *
 * Set `AT`. Set `AS` attacked `D`'s split-round mixer as a ledger head and priced it:
 * a meet-in-the-middle join enumerates 532,485 forgeries of one six-entry ledger at
 * 6.99 ops each against a brute-force 4,414, so the mixer is worth a factor of SEVEN
 * over a plain summed head rather than the 840 a per-try collision rate suggests, and
 * the enabling property is the head's WIDTH -- nine and a half bits -- not its mixing.
 * Those numbers are `AS`'s and are cited here, never re-run as if they were this set's.
 *
 * `AS` then measured one thing and deliberately did not attack it, recording it as
 * `F-EVERY-ACCUMULATOR-HAS-A-NO-OP-ENTRY`: `P` has exactly one fixed point, so from
 * every one of the 729 accumulators there is EXACTLY ONE ENTRY VALUE THAT LEAVES THE
 * MIXER HEAD UNCHANGED -- verified at all 729 rather than argued. Every forgery in
 * `AS` keeps the ledger at six entries, so not one of them can use it.
 *
 * A FORGER WHO MAY INSERT HAS A FREE MOVE AT EVERY POSITION OF EVERY LEDGER AND
 * NOBODY HAS PRICED IT. That is this set.
 *
 * ------------------------------------------------------------------------------
 * THE FORGER, STATED PLAINLY, AND HOW MUCH LARGER THIS CLASS IS THAN `AS`'s.
 *
 * THE LEDGER PUBLISHES TWO HEADS and a forgery must reproduce both:
 *
 *     summed    a' = a + e            arithmetic, carrying, wrapped to one tryte
 *     hashed    a' = P(a + e) - e     `D`'s split-round mixer, fed forward
 *
 * A ledger carrying only the mixer head is broken by ONE insertion and a ledger
 * carrying only the sum is broken by one compensating pair, so neither is the object
 * worth attacking. `AS` never said this out loud because its family preserved the
 * total by construction; here it is load-bearing and it is said.
 *
 *   `AS`'s forger  edits entries in place. Length fixed at six. Every member of its
 *                  family preserves the arithmetic total by construction, so the
 *                  mixer was the only thing to beat. Family size 10,920, finite.
 *
 *   this forger    may INSERT at any of the L + 1 gaps, DELETE any subset, and
 *                  REARRANGE. Length is not fixed, so THE FAMILY IS UNBOUNDED. That
 *                  is the qualitative difference and it is why the cost model needs
 *                  a second currency: "how many forgeries" is not a question this
 *                  class has a finite answer to.
 *
 *   both know      the whole ledger, both heads, the mixer's tables, and may
 *                  precompute without limit provided the precomputation is charged
 *                  and reported rather than amortised silently.
 *
 * THE PRECONDITION, WHICH IS NOT A COST. This forger exists only where the verifier
 * does NOT authenticate the ledger's LENGTH. If the length is signed or counted,
 * every insertion-only forgery below is dead on arrival and what survives is the
 * length-preserving corner -- `AT4`'s rearrangements, and `AS`'s edits. Saying which
 * families die under which verifier is half of what this set is for.
 *
 * THE COST MODEL, STATED BEFORE ANY ATTACK RUNS, in TWO CURRENCIES.
 *
 *   ops       one lookup into a precomputed table (the 531,441-entry `STEP`, its
 *             inverse `BACK`, the 729-entry no-op table) or one index arithmetic
 *             operation. Exactly `AS`'s unit, so the two sets are comparable.
 *             Precomputation is charged separately and printed.
 *   growth    entries added to the ledger. NEW HERE, and it is not convertible into
 *             ops by anything in this repository. A forgery costing zero ops and 500
 *             inserted entries is not obviously better than one costing 4,414 ops
 *             and none. BOTH ARE REPORTED AND NO EXCHANGE RATE IS INVENTED --
 *             `AQ` swept an invented one and its control could not discriminate.
 *
 * THE ALGEBRA, WHICH IS DESIGN AND NOT PREDICTION. Everything in this section
 * follows from `AS`'s D1 and D3 plus the fixed-point count, is derivable on paper,
 * and is checked exhaustively by the tool rather than trusted -- `T-TRANSCRIBED-TABLE`.
 *
 *   I1  THE INSERTED VALUE IS FORCED. Inserting entry x at gap p replaces the
 *       accumulator a_p by STEP[a_p][x] and leaves every later entry alone; the map
 *       from the accumulator at that gap to the head is a bijection (D3), so the
 *       head survives exactly when STEP[a_p][x] = a_p. By D1 that is g(a_p + x) = 0,
 *       and `P` has one fixed point u*, so x = u* - a_p. ONE VALUE PER GAP, NO CHOICE.
 *
 *   I2  A NO-OP INSERTION CHANGES NO ACCUMULATOR AT ALL, so the forced value at every
 *       other gap is unchanged and insertions at different gaps commute. Inserting
 *       k_p copies at gap p, for p = 0..L, therefore determines the forged ledger
 *       from the MULTISET alone, and the arithmetic total moves by
 *
 *              sum_p  k_p * val(x_p)   (mod 729).
 *
 *       So an insertion-only forgery is exactly A NON-EMPTY MULTISET OF THE L + 1
 *       FORCED VALUES SUMMING TO ZERO IN Z_729 -- a shortest-cycle problem on a
 *       Cayley graph with 729 nodes, which is a breadth-first search and not a search
 *       over forgeries. `T-SEARCH-WHERE-A-CHECK-WOULD-DO`.
 *
 *   I3  THE FAMILY IS NEVER EMPTY. Every element of Z_729 has order dividing 729, so
 *       ord(val(x_p)) insertions at ANY single gap p restore both heads. The minimum
 *       is therefore at most min_p ord(val(x_p)), which is at most 729.
 *
 *   I4  THE GAP-0 GENERATOR IS LEDGER-INDEPENDENT. The accumulator before the first
 *       entry is the tritwise identity on every ledger, so the forced prepend value
 *       is the constant val(u*) and a run of ord(val(u*)) prepends is A UNIVERSAL
 *       FORGERY: it needs no knowledge of the ledger, and no search at all.
 *
 *   I5  A REARRANGEMENT PRESERVES THE ARITHMETIC TOTAL EXACTLY, because the multiset
 *       of entries is unchanged. THE SUMMED HEAD IS BLIND TO EVERY REORDERING, and
 *       the mixer is the only thing standing on that family. A deletion and a
 *       re-insertion of the same value elsewhere -- the length-preserving move a
 *       length-checking verifier still faces -- is a rearrangement.
 *
 *   I6  DELETION HAS NO FREE PARAMETER. The entries are given, so a deletion-only
 *       forgery must satisfy both conservation laws by luck over 2^L - 1 subsets,
 *       where an insertion buys 729 candidate values per inserted entry. That
 *       asymmetry, not the mixer, is what `AT3` measures.
 *
 * THE SYMMETRIES, CHECKED BEFORE ANY COUNT IS REPORTED. `T-INSTRUMENT-FALSE-VERDICT`
 * has bitten 21 times and most recently in `AS`'s own thread, where a sweep
 * enumerated every compensating forgery twice because forge(E,i,j,d) and
 * forge(E,j,i,-d) are the same edit. Three places here can do the same thing:
 *
 *   - the multiset-to-ledger map is NOT injective when an entry is itself the no-op
 *     for its own gap (then a_{k+1} = a_k, the forced values at gaps k and k+1 are
 *     equal, and inserting at either gives the same ledger). Measured and reported.
 *   - two free insertions at gaps (p, q) with p = q are ORDERED, and different
 *     (p, q, x) triples can land on the same forged ledger.
 *   - rearrangements of a ledger with a repeated entry are not 720 distinct
 *     sequences, and the identity rearrangement is not a forgery.
 *
 * Every count below is over DISTINCT FORGED LEDGERS, rebuilt and compared, and the
 * enumerated total is printed beside it so a reader can see the gap.
 *
 * THE CONTROLS, each asserted to MOVE before its verdict is read, because
 * `T-CONTROL-CANNOT-DISCRIMINATE` has bitten twice and the fix for the first bite was
 * not enough for the second:
 *
 *   - THE TWO HEADS AGAINST EACH OTHER. The summed head must accept 100% of
 *     rearrangements (I5) and reject essentially all single no-op insertions; the
 *     mixer must do the exact opposite. A control that only ever agreed would show
 *     nothing, and this pair is asserted to disagree in both directions.
 *   - A CHAIN BUILT ON A FRESH RANDOM PERMUTATION with exactly one fixed point, run
 *     through the identical census. If the split round is doing anything, this is
 *     where it shows.
 *   - THE BFS ITSELF, on hand-computable generator sets: {0} must give 1, {1} must
 *     give 729, {1, -1} must give 2, {243} must give 3, {3} must give 243. The
 *     statistic is therefore known to span its whole range before it is read.
 *   - A UNIFORM-GENERATOR NULL for the minimum, drawn 2,000 times per length rather
 *     than once. `AR`'s control was a single frozen object where the claim needed a
 *     distribution, and `AO1` had already established that and it did not transfer.
 *
 * THE RANDOMNESS. mulberry32 through `>>> 0`, seed 20260829, reusing `AS`'s generator
 * rather than writing a second one -- `T-FAKE-RANDOM` was a 31-bit overflow that made
 * four hundred trials into four hundred repetitions. The tool asserts the draw visited
 * every one of the 729 entry values before any verdict is read.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES -- registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AT1  INSERTION IS PAID FOR IN LENGTH, AND THE LENGTH IS SINGLE DIGITS. Over
 *        2,000 independently drawn six-entry ledgers, with the minimum number of
 *        forced no-op insertions that restores BOTH heads computed exactly by
 *        breadth-first search over Z_729 on that ledger's seven forced generators,
 *        predicted: the mean lies in [4.0, 6.0], and no single ledger of the 2,000
 *        needs more than 12. So the free move is not free -- it costs about five
 *        entries -- and it costs nothing like the 729 that a worst-case single-gap
 *        run would cost.
 *        AT RISK: the counting heuristic that puts this at 4.87 -- 791 non-empty
 *        multisets of size at most five against 729 residues -- assumes the seven
 *        forced values behave like seven independent uniform draws, and they are
 *        seven reads of ONE map v(a) = val(u* - a) at seven accumulators of one
 *        chain. Two observations already on the record say that assumption is
 *        doubtful in the same direction. The accumulator after the first entry is
 *        a_0 + g(a_0 + e_1), and `AS` measured g's image at 465 of 729, so a_1 can
 *        take only 465 values rather than 729; and `F-MIXER-HEAD-IS-NOT-FLAT`
 *        measured this same chain at 629 to 851 preimages against a flat 729 at
 *        length two. If that shortfall compounds along the chain the seven
 *        generators are drawn from a shrinking support with repeats, the reachable
 *        sums are fewer than the heuristic assumes, and the mean climbs past 6.0
 *        while the maximum climbs past 12. In the other direction, the gap-0
 *        generator is the same on all 2,000 ledgers -- the accumulator before the
 *        first entry is the tritwise identity, so the prepend value is the constant
 *        val(u*) -- and if its order in Z_729 is 1 or 3, which is the three values
 *        0 and plus or minus 243 of the 729 it could be, then a fixed run of at most
 *        three prepends forges every ledger, the minimum is bounded by three
 *        everywhere and the mean falls below 4.0. I have not computed val(u*): this
 *        repository records that `P` has one fixed point and nowhere records which
 *        one, and `AS` measured the no-op's EXISTENCE at all 729 accumulators and
 *        its value at none of them.
 *        CANNOT SHOW: length six, and no-op insertions only. A forger who inserts
 *        values that are not no-ops has a free parameter per insertion and is priced
 *        by `AT3`; three or more free-value insertions are not attacked at all.
 *
 *   AT2  AND THAT IS NOT A PROPERTY OF LENGTH SIX. Over ledger lengths 2 through 12,
 *        with 2,000 independently drawn ledgers at each length, predicted: the mean
 *        minimum insertion count is STRICTLY DECREASING at every one of the ten
 *        steps, lies above 9.0 at length two and below 4.5 at length twelve, and no
 *        single ledger at any length needs more than 100 insertions. A longer ledger
 *        is CHEAPER to forge by insertion, because every entry adds a gap and every
 *        gap adds a generator.
 *        AT RISK: the tightest predicted gap is the last one, 3.49 against 3.35,
 *        which at 2,000 ledgers a length is about five standard errors -- so noise
 *        cannot flip a step but structure can, and two routes would. If val(u*) has
 *        order at most 3 the gap-0 generator alone bounds the minimum at EVERY
 *        length, the curve is flat rather than decreasing and length two's mean
 *        falls under 9.0, so the monotone leg and the endpoint leg fail together. If
 *        instead long chains revisit accumulators more often than birthday chance --
 *        thirteen gaps on 729 states collide with probability about 10% if the chain
 *        is flat, and `F-MIXER-HEAD-IS-NOT-FLAT` says it is not -- then a repeated
 *        accumulator contributes a DUPLICATE generator rather than a new one, the
 *        added gaps stop paying at the long end and a step breaks there. A maximum
 *        past 100 refutes the third leg and would mean some drawn ledger's forced
 *        values all lie in a proper subgroup of Z_729.
 *        CANNOT SHOW: uniformly drawn entries only. A real ledger of small mints and
 *        burns walks the accumulator differently, and nothing here sweeps a
 *        structured entry distribution.
 *
 *   AT3  INSERTION HAS FREE PARAMETERS AND DELETION HAS NONE, AND THE ACCEPT COUNTS
 *        SHOW IT AT FIVE ORDERS OF MAGNITUDE. Over 2,000 drawn six-entry ledgers,
 *        predicted both halves. (a) The TWO FREE INSERTIONS family -- 28 gap pairs
 *        p <= q, the first value free over all 729 and the second forced by the
 *        arithmetic total, so 20,412 candidates and a chance yield of 28.0 -- accepts
 *        with a mean within 2.0 of 28.0 and a variance-to-mean ratio in [0.80, 1.25].
 *        (b) At most 3 of the 2,000 ledgers admit ANY deletion-only forgery over all
 *        63 non-empty subsets of their entries, against a chance expectation of 0.237
 *        ledgers.
 *        AT RISK: half (a) can fail LOW and that is not a noise story. Fix a gap pair
 *        and let the free value run over all 729; the second value is then forced, so
 *        that pair's accept count is the number of preimages of one target under one
 *        map on 729 points. If that map is a PERMUTATION the count is exactly one for
 *        every pair on every ledger, the total is exactly 28 with variance ZERO, and
 *        the ratio fails at the bottom of its band rather than the top. The map is
 *        x -> STEP[push(STEP[a_p][x])][-x], whose first factor is a_p + g(a_p + x)
 *        and g is not injective -- its image is 465 of 729 -- so I expect
 *        random-function behaviour and a ratio near one. But `AN1` registered this
 *        same mixer's hit variance as binomial and it came in LOW at two
 *        difficulties, MORE UNIFORM THAN CHANCE, which is exactly the direction that
 *        drives this ratio to zero, and I am registering against that observation.
 *        Half (b) fails if the two conservation laws correlate on a deletion rather
 *        than being independent: for a single deletion the sum needs the entry to be
 *        arithmetically zero and the mixer needs the accumulator before it to be the
 *        fixed point, and if those coincide more often than one in 729 squared the
 *        count rises. Four or more ledgers is a one-in-ten-thousand event under
 *        Poisson(0.237), so that line can only fire on structure.
 *        CANNOT SHOW: two insertions and whole-subset deletions of a six-entry
 *        ledger. Hybrid families -- insert and edit, insert and delete a DIFFERENT
 *        value -- are not swept, and three or more free-value insertions are a
 *        729-squared-parameter family that an `AS3`-style join would price and this
 *        set does not build.
 *
 *   AT4  THE TWO HEADS HAVE COMPLEMENTARY BLIND SPOTS, AND REORDERING IS THE SUM'S.
 *        Every rearrangement of a ledger's entries preserves the arithmetic total
 *        exactly, so the summed head accepts all of them and the mixer is alone on
 *        this family. Predicted that the mixer catches them at chance and no better:
 *        over 2,000 drawn six-entry ledgers, sweeping all 720 permutations of each
 *        exhaustively, the total number of accepted DISTINCT non-identity
 *        rearrangements is within 15% of the exact chance expectation -- the count of
 *        distinct non-identity rearrangements divided by 729, summed over ledgers,
 *        which is about 1,972 -- with a variance-to-mean ratio in [0.80, 1.25] and no
 *        single ledger accepting more than 10.
 *        AT RISK: `AS` proved this chain's head is a COMMUTATIVE SUM. D2 says
 *        head = g(u_1) + ... + g(u_L) in the reparametrised variable u_k = a_{k-1} +
 *        e_k (`F-LEDGER-CHAIN-IS-A-SUM-IN-U`), and a commutative sum is precisely the
 *        object that does not care what order its terms arrive in. If that
 *        commutativity reaches the ENTRIES rather than stopping at the u's, all 719
 *        rearrangements of every ledger are accepted, the count is 1,438,000 rather
 *        than 1,972, and the mixer is no better than the sum on the one family the
 *        sum cannot see at all. The change of variable is triangular, which is my
 *        reason for expecting it not to, and triangularity is doing the entire job --
 *        nothing in `AS` or here has yet evaluated that head on a PERMUTED ledger.
 *        Failing low is live too: an adjacent transposition changes exactly two of
 *        the u's, so its accept condition is a collision in a SUM OF TWO g-values
 *        rather than in one, and if sums of two g-values collide less often than
 *        chance the ratio drops under 0.85.
 *        CANNOT SHOW: rearrangements of SIX entries, which is the largest length
 *        whose permutations can be swept exhaustively at this ledger count. A longer
 *        ledger has more rearrangements than this sweep visits and nothing here
 *        samples them.
 * ------------------------------------------------------------------------------
 * NOT REGISTERED, because each is derivable from the construction above before the
 * run, or is a cost that follows once the registered quantities are in hand. A fact
 * that was never at risk cannot fail. All are checked anyway, and the checking is the
 * point: I1 through I6 are what every attack here rests on.
 *
 *   - I1 through I6, and in particular that the multiset determines the forged ledger
 *     and that a rearrangement is invisible to the summed head.
 *   - The universal prepend: its existence, and the exact number of prepends it needs.
 *   - THE COST LADDER, in both currencies, against `AS`'s cited figures. This is what
 *     the set is for and no prediction claims it, because it follows from `AT1` and
 *     the model.
 *   - The rate at which the multiset-to-ledger map collides, and the enumerated
 *     versus distinct counts in every family.
 *   - The distribution of forced-value orders in Z_729, whose null is exactly
 *     486 / 162 / 54 / 18 / 6 / 2 / 1 over orders 729 / 243 / 81 / 27 / 9 / 3 / 1.
 *   - What this set did NOT attack, measured rather than named.
 * ------------------------------------------------------------------------------
 * Run:  npm run audit:insert        INSERT_LEDGERS=25 npm run audit:insert  (capped)
 */

const Q = require('./puzzle-audit.js');
const LED = require('./ledger-audit.js');
const F = require('./forge-audit.js');

const { idx, val } = Q;
const { STEP, LEDGER, wrap, headHash, headSum } = LED;
const { N, OFF, ZERO, TADD, TSUB, asum, rng, randInt, randomPermutation, stepTableFor } = F;

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

/** How many ledgers each census draws. Capped for the suite's spawn check. */
const LEDGERS = Number(process.env.INSERT_LEDGERS || 2000);
const SEED = 20260829;
/** The registered length sweep, and the canonical length inside it. */
const LENGTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const L6 = 6;
/** Gap pairs p <= q over L + 1 gaps, and the two-insertion family's chance yield. */
const gapPairs = L => ((L + 1) * (L + 2)) / 2;
const twoInsertFamily = L => gapPairs(L) * N;
const twoInsertChance = L => gapPairs(L);

// ---------------------------------------------------------------- index-space algebra
/**
 * `gen(x)` is the amount, in Z_729, that an entry of INDEX x adds to the arithmetic
 * total. The index/value boundary produced two false verdicts in this corpus, so the
 * conversion lives here and never inside a sweep. `negEntry` is the entry whose
 * generator is the negation, which is what the arithmetic constraint forces.
 */
const gen = x => (x - OFF + N) % N;
const negEntry = x => (2 * OFF - x + N) % N;

/** A chain of accumulators under an arbitrary step table. a[0] is the identity. */
function chain(e, step = STEP) {
  const a = new Array(e.length + 1);
  a[0] = ZERO;
  for (let k = 0; k < e.length; k++) a[k + 1] = step[a[k] * N + e[k]];
  return a;
}
const headOf = (e, step = STEP) => chain(e, step)[e.length];
const totalOf = e => e.reduce((s, x) => asum(s, x), ZERO);

/**
 * I1, TABULATED RATHER THAN ARGUED. For each accumulator, every entry x with
 * step[a][x] = a. This is built by scanning the table, so it makes no assumption at
 * all about `g` or about how many fixed points `P` has -- which is what lets the same
 * function serve the random-permutation control, where the count is whatever the draw
 * happened to give.
 */
function noOpTable(step = STEP) {
  const first = new Int16Array(N).fill(-1);
  const counts = new Int16Array(N);
  for (let a = 0; a < N; a++) {
    for (let x = 0; x < N; x++) {
      if (step[a * N + x] === a) { if (first[a] < 0) first[a] = x; counts[a]++; }
    }
  }
  let min = N, max = 0, unique = 0;
  for (let a = 0; a < N; a++) {
    if (counts[a] < min) min = counts[a];
    if (counts[a] > max) max = counts[a];
    if (counts[a] === 1) unique++;
  }
  return { first, counts, min, max, unique, everyAccumulatorHasExactlyOne: min === 1 && max === 1 };
}

/** The order of an element of Z_729: 729 / gcd(v, 729). */
function orderIn729(v) {
  let a = v % N, b = N;
  while (a) { const t = b % a; b = a; a = t; }
  return N / b;                                   // gcd(0, 729) = 729, so order 1
}

// ---------------------------------------------------------------- I2, the shortest run
/**
 * The minimum non-empty multiset of `gens` summing to zero in Z_729, exactly, by
 * breadth-first search on the Cayley graph -- `T-SEARCH-WHERE-A-CHECK-WOULD-DO`. BFS
 * from 0 gives dist[t], the fewest generators summing to t; the answer is then
 * min over i of dist[-g_i] + 1, which is at least one by construction.
 *
 * Non-negative combinations of a finite abelian group's elements reach the same
 * subgroup full combinations do, since -g = (ord(g) - 1) * g, so dist[-g_i] is always
 * finite and the answer always exists. That is I3 and it is asserted, not assumed.
 */
function minInsertions(gens) {
  const m = gens.length;
  const dist = new Int32Array(N).fill(-1);
  const via = new Int32Array(N).fill(-1);
  const prev = new Int32Array(N).fill(-1);
  const queue = new Int32Array(N);
  let head = 0, tail = 0, ops = 0;
  dist[0] = 0; queue[tail++] = 0;
  while (head < tail) {
    const s = queue[head++];
    for (let i = 0; i < m; i++) {
      const t = (s + gens[i]) % N; ops++;
      if (dist[t] < 0) { dist[t] = dist[s] + 1; via[t] = i; prev[t] = s; queue[tail++] = t; }
    }
  }
  let best = Infinity, bestI = -1;
  for (let i = 0; i < m; i++) {
    const need = (N - gens[i]) % N;
    if (dist[need] >= 0 && dist[need] + 1 < best) { best = dist[need] + 1; bestI = i; }
  }
  const k = new Int32Array(m);
  if (bestI >= 0) {
    k[bestI]++;
    let s = (N - gens[bestI]) % N;
    while (s !== 0) { k[via[s]]++; s = prev[s]; }
  }
  return { min: best, multiset: k, ops, reached: dist.filter(d => d >= 0).length };
}

/** The forged ledger from a multiset of no-op insertions. I2: order does not matter. */
function applyNoOps(e, noop, k) {
  const out = [];
  for (let p = 0; p <= e.length; p++) {
    for (let c = 0; c < k[p]; c++) out.push(noop[p]);
    if (p < e.length) out.push(e[p]);
  }
  return out;
}

/** The L + 1 forced values at a ledger's gaps, and their generators in Z_729. */
function forcedAtGaps(a, noOp) {
  const x = a.map(s => noOp.first[s]);
  return { values: x, gens: x.map(gen) };
}

/**
 * THE BRUTE-FORCE CHECK ON THE BFS, because a minimum reported by a search that is
 * subtly wrong is exactly `T-INSTRUMENT-FALSE-VERDICT`. Enumerates every multiset of
 * size at most `cap` directly and returns the smallest that sums to zero, or null.
 */
function minInsertionsBrute(gens, cap = 4) {
  const m = gens.length;
  let best = null;
  const k = new Int32Array(m);
  const walk = (i, left, sum, used) => {
    if (best !== null && used >= best) return;
    if (used > 0 && sum % N === 0) { best = used; return; }
    if (i === m || left === 0) return;
    for (let c = left; c >= 0; c--) {
      k[i] = c;
      walk(i + 1, left - c, (sum + c * gens[i]) % N, used + c);
      k[i] = 0;
    }
  };
  for (let ell = 1; ell <= cap && best === null; ell++) walk(0, ell, 0, 0);
  return best;
}

// ------------------------------------------------------- AT3(a), two free insertions
/**
 * Two insertions at gaps p <= q. The first value is free over all 729; the arithmetic
 * total then FORCES the second to be its negation, so the family is 28 * 729 = 20,412
 * candidates on a six-entry ledger and its chance yield is 28.
 *
 * The head is compared at gap q rather than at the end, which is D3 -- everything
 * after gap q is untouched and the map from that accumulator to the head is a
 * bijection. `checkTruncationAgrees` verifies that against a full recomputation
 * rather than trusting it, because AS's mutation 1 showed a merge point off by one
 * produces a statistically identical process.
 */
function twoInsertSweep(e, a, step = STEP) {
  const L = e.length;
  let tried = 0, accepted = 0;
  const rows = [];
  for (let p = 0; p <= L; p++) {
    for (let q = p; q <= L; q++) {
      const target = a[q];
      for (let x = 0; x < N; x++) {
        const y = negEntry(x);
        let b = step[a[p] * N + x];
        for (let r = p; r < q; r++) b = step[b * N + e[r]];
        tried++;
        if (step[b * N + y] === target) { accepted++; rows.push([p, q, x, y]); }
      }
    }
  }
  return { tried, accepted, rows };
}
/** The forged ledger from one two-insertion row, so a match can be rebuilt, not trusted. */
function applyTwoInsert(e, [p, q, x, y]) {
  const out = [];
  for (let r = 0; r <= e.length; r++) {
    if (r === p) out.push(x);
    if (r === q) out.push(y);
    if (r < e.length) out.push(e[r]);
  }
  return out;
}

// ------------------------------------------------------------- AT3(b), deletions
/** Every non-empty subset of a ledger's entries, deleted, both heads recomputed. */
function deletionSweep(e, step = STEP) {
  const L = e.length, h = headOf(e, step), t = totalOf(e);
  let tried = 0, headOnly = 0, sumOnly = 0, both = 0;
  const rows = [];
  for (let mask = 1; mask < (1 << L); mask++) {
    const f = [];
    for (let i = 0; i < L; i++) if (!(mask & (1 << i))) f.push(e[i]);
    tried++;
    const okH = headOf(f, step) === h, okS = totalOf(f) === t;
    if (okH) headOnly++;
    if (okS) sumOnly++;
    if (okH && okS) { both++; rows.push(mask); }
  }
  return { tried, headOnly, sumOnly, both, rows };
}

// ------------------------------------------------------------- AT4, rearrangements
/** Heap's algorithm, materialised once: all 720 permutations of six positions. */
function permutationsOf(n) {
  const out = [], a = Array.from({ length: n }, (_, i) => i), c = new Array(n).fill(0);
  out.push(a.slice());
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const j = i % 2 ? c[i] : 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
      out.push(a.slice());
      c[i]++; i = 0;
    } else { c[i] = 0; i++; }
  }
  return out;
}
const PERMS6 = permutationsOf(6);

/**
 * Every rearrangement of one ledger. I5 says the summed head accepts all of them, and
 * that is CHECKED here rather than assumed, because it is the control that makes the
 * mixer's rate readable. Distinct forged SEQUENCES only: a ledger with a repeated
 * entry has fewer than 720, and the identity is not a forgery.
 */
function rearrangementSweep(e, step = STEP, perms = PERMS6) {
  const L = e.length, h = headOf(e, step), t = totalOf(e), key = e.join(',');
  const allDistinct = new Set(e).size === L;
  const seen = allDistinct ? null : new Set();
  let distinct = 0, accepted = 0, sumAccepted = 0;
  const rows = [];
  for (const perm of perms) {
    const f = perm.map(i => e[i]);
    const s = f.join(',');
    if (s === key) continue;
    if (seen) { if (seen.has(s)) continue; seen.add(s); }
    distinct++;
    if (totalOf(f) === t) sumAccepted++;
    if (headOf(f, step) === h) { accepted++; rows.push(perm); }
  }
  return { distinct, accepted, sumAccepted, chance: distinct / N, rows };
}

/**
 * The length-preserving corner, and the one a verifier that COUNTS entries still
 * faces: delete one entry and re-insert its value at another gap. Every such move is
 * a rearrangement, so it is reported as a sub-family rather than measured twice.
 */
function moveSweep(e, step = STEP) {
  const L = e.length, h = headOf(e, step), key = e.join(',');
  const seen = new Set();
  let distinct = 0, accepted = 0;
  for (let k = 0; k < L; k++) {
    const rest = e.filter((_, i) => i !== k);
    for (let p = 0; p <= L - 1; p++) {
      const f = rest.slice(0, p).concat([e[k]], rest.slice(p));
      const s = f.join(',');
      if (s === key || seen.has(s)) continue;
      seen.add(s); distinct++;
      if (headOf(f, step) === h) accepted++;
    }
  }
  return { distinct, accepted, chance: distinct / N };
}

// ---------------------------------------------------------------- the control chain
/**
 * A chain built on a fresh random permutation with EXACTLY ONE fixed point, so it has
 * the same no-op structure the subject has and differs only in being structureless.
 * Drawn until the fixed-point count is one; the number of draws is reported, because
 * a control silently retried until it agrees is not a control.
 */
function controlChain(seed = SEED ^ 0x5bf03635) {
  const r = rng(seed);
  for (let draws = 1; draws <= 200; draws++) {
    const perm = randomPermutation(r);
    let fixed = 0;
    for (let u = 0; u < N; u++) if (perm[u] === u) fixed++;
    if (fixed !== 1) continue;
    const { step, back } = stepTableFor(perm);
    const noOp = noOpTable(step);
    if (!noOp.everyAccumulatorHasExactlyOne) continue;
    return { perm, step, back, noOp, draws };
  }
  throw new Error('insert-audit: no control permutation with one fixed point in 200 draws');
}

// ---------------------------------------------------------------- the census
const drawLedgerOfLength = (r, L) => Array.from({ length: L }, () => randInt(r, N));

/**
 * One census: `ledgers` drawn ledgers of length `L`, every family measured on the same
 * draws so the four verdicts describe one population rather than four. `full` runs the
 * families that only exist at the registered length; the length sweep needs the
 * minimum alone and says so.
 */
function census(ledgers, seed, L, step, noOp, full = true) {
  const r = rng(seed);
  const seenEntry = new Uint8Array(N);
  const mins = new Int32Array(ledgers);
  const orderTally = new Map();
  let minOps = 0, degenerateGapPairs = 0, ledgersWithDegenerateGap = 0;
  let rebuiltOk = 0, rebuiltTried = 0;
  // two insertions
  let tiTried = 0, tiEnumerated = 0, tiDistinct = 0;
  const tiCounts = new Int32Array(ledgers);
  // deletions
  let delTried = 0, delHead = 0, delSum = 0, delBoth = 0, delLedgers = 0;
  // rearrangements
  let reDistinct = 0, reAccepted = 0, reSumAccepted = 0, reChance = 0, reMax = 0;
  const reCounts = new Int32Array(ledgers);
  let mvDistinct = 0, mvAccepted = 0, mvChance = 0;
  // the summed head, run beside the mixer on the insertion family
  let sumRejectedInsertions = 0, sumTriedInsertions = 0;
  const perms = full ? permutationsOf(L) : null;

  for (let n = 0; n < ledgers; n++) {
    const e = drawLedgerOfLength(r, L);
    for (const x of e) seenEntry[x] = 1;
    const a = chain(e, step);
    const { values, gens } = forcedAtGaps(a, noOp);
    for (const g of gens) {
      const o = orderIn729(g);
      orderTally.set(o, (orderTally.get(o) || 0) + 1);
    }
    // I2's symmetry: an entry that is its own gap's no-op makes two gaps interchangeable.
    let degen = 0;
    for (let k = 0; k < L; k++) if (a[k + 1] === a[k]) degen++;
    if (degen) { degenerateGapPairs += degen; ledgersWithDegenerateGap++; }
    // a single no-op insertion: free for the mixer, and what the sum sees.
    for (let p = 0; p <= L; p++) {
      sumTriedInsertions++;
      if (gens[p] !== 0) sumRejectedInsertions++;
    }
    const m = minInsertions(gens);
    mins[n] = m.min; minOps += m.ops;
    // Rebuilt and both heads recomputed from scratch, on a sample. A count cannot tell
    // a working attack from a relabelled broken one -- AS's mutation 3.
    if (n < 200) {
      rebuiltTried++;
      const f = applyNoOps(e, values, m.multiset);
      if (f.length === L + m.min && headOf(f, step) === a[L] && totalOf(f) === totalOf(e)) {
        rebuiltOk++;
      }
    }
    if (!full) continue;

    const ti = twoInsertSweep(e, a, step);
    tiTried += ti.tried; tiEnumerated += ti.accepted;
    const tiSeen = new Set();
    for (const row of ti.rows) tiSeen.add(applyTwoInsert(e, row).join(','));
    tiCounts[n] = tiSeen.size; tiDistinct += tiSeen.size;

    const del = deletionSweep(e, step);
    delTried += del.tried; delHead += del.headOnly; delSum += del.sumOnly; delBoth += del.both;
    if (del.both) delLedgers++;

    const re = rearrangementSweep(e, step, perms);
    reDistinct += re.distinct; reAccepted += re.accepted; reSumAccepted += re.sumAccepted;
    reChance += re.chance; reCounts[n] = re.accepted;
    if (re.accepted > reMax) reMax = re.accepted;

    const mv = moveSweep(e, step);
    mvDistinct += mv.distinct; mvAccepted += mv.accepted; mvChance += mv.chance;
  }

  const stat = arr => {
    let tot = 0, min = Infinity, max = -1;
    for (const v of arr) { tot += v; if (v < min) min = v; if (v > max) max = v; }
    const mean = tot / arr.length;
    let ss = 0; for (const v of arr) ss += (v - mean) ** 2;
    const variance = ss / (arr.length - 1 || 1);
    return { mean, variance, varOverMean: mean ? variance / mean : null, min, max, total: tot };
  };
  let coverage = 0; for (let i = 0; i < N; i++) if (seenEntry[i]) coverage++;
  const out = {
    ledgers, length: L, coverage,
    min: stat(mins), minOps: minOps / ledgers,
    orders: [...orderTally.entries()].sort((x, y) => x[0] - y[0]),
    degenerateGapPairs, ledgersWithDegenerateGap,
    rebuilt: { ok: rebuiltOk, tried: rebuiltTried },
    summedOnInsertions: { tried: sumTriedInsertions, rejected: sumRejectedInsertions },
  };
  if (!full) return out;
  out.twoInsert = {
    ...stat(tiCounts), tried: tiTried, enumerated: tiEnumerated, distinct: tiDistinct,
    chance: twoInsertChance(L), family: twoInsertFamily(L),
  };
  out.deletion = { tried: delTried, headOnly: delHead, sumOnly: delSum, both: delBoth,
    ledgersWithOne: delLedgers, chanceLedgers: ledgers * ((1 << L) - 1) / (N * N) };
  out.rearrange = { ...stat(reCounts), distinct: reDistinct, accepted: reAccepted,
    sumAccepted: reSumAccepted, chance: reChance, max: reMax,
    ratio: reAccepted / reChance };
  out.move = { distinct: mvDistinct, accepted: mvAccepted, chance: mvChance,
    ratio: mvChance ? mvAccepted / mvChance : null };
  return out;
}

/**
 * THE NULL FOR `AT1` AND `AT2`, drawn rather than argued and reported as a
 * distribution. Seven -- or L + 1 -- generators uniform on Z_729, INCLUDING the gap-0
 * one, which is exactly the assumption the counting heuristic makes and the one the
 * subject may violate.
 */
function uniformGeneratorNull(ledgers, seed, L) {
  const r = rng(seed);
  const mins = new Int32Array(ledgers);
  for (let n = 0; n < ledgers; n++) {
    const gens = Array.from({ length: L + 1 }, () => randInt(r, N));
    mins[n] = minInsertions(gens).min;
  }
  let tot = 0, max = -1; for (const v of mins) { tot += v; if (v > max) max = v; }
  const mean = tot / ledgers;
  let ss = 0; for (const v of mins) ss += (v - mean) ** 2;
  return { length: L, ledgers, mean, sd: Math.sqrt(ss / (ledgers - 1 || 1)), max,
    se: Math.sqrt(ss / (ledgers - 1 || 1)) / Math.sqrt(ledgers) };
}

// ------------------------------------------------------------- instrument checks
/** D3 in the insertion direction: the truncated verdict equals the full one. */
function checkTruncationAgrees(ledgers = 20, seed = 3, step = STEP) {
  const r = rng(seed);
  let agree = 0, disagree = 0, accepts = 0;
  for (let n = 0; n < ledgers; n++) {
    const e = drawLedgerOfLength(r, L6), a = chain(e, step), h = a[L6];
    const ti = twoInsertSweep(e, a, step);
    const acc = new Set(ti.rows.map(x => x.join(':')));
    for (let p = 0; p <= L6; p++) for (let q = p; q <= L6; q++) for (let x = 0; x < N; x++) {
      const y = negEntry(x);
      const full = headOf(applyTwoInsert(e, [p, q, x, y]), step) === h;
      const trunc = acc.has([p, q, x, y].join(':'));
      if (full === trunc) agree++; else disagree++;
      if (full) accepts++;
    }
  }
  return { agree, disagree, accepts, ok: disagree === 0 };
}
/** I1 at every gap of every drawn ledger, by full head recomputation. */
function checkNoOpIsFree(ledgers = 200, seed = 5, step = STEP, noOp = null) {
  const table = noOp || noOpTable(step);
  const r = rng(seed);
  let tried = 0, headHeld = 0, totalMoved = 0;
  for (let n = 0; n < ledgers; n++) {
    const e = drawLedgerOfLength(r, L6), a = chain(e, step), h = a[L6], t = totalOf(e);
    for (let p = 0; p <= L6; p++) {
      const x = table.first[a[p]];
      const f = e.slice(0, p).concat([x], e.slice(p));
      tried++;
      if (headOf(f, step) === h) headHeld++;
      if (totalOf(f) !== t) totalMoved++;
    }
  }
  return { tried, headHeld, totalMoved, ok: headHeld === tried };
}
/** I3: a run at one gap always works, checked by rebuilding it. */
function checkSingleGapRun(ledgers = 40, seed = 7, step = STEP, noOp = null) {
  const table = noOp || noOpTable(step);
  const r = rng(seed);
  let tried = 0, ok = 0, lengths = [];
  for (let n = 0; n < ledgers; n++) {
    const e = drawLedgerOfLength(r, L6), a = chain(e, step), h = a[L6], t = totalOf(e);
    const p = randInt(r, L6 + 1);
    const x = table.first[a[p]], ord = orderIn729(gen(x));
    if (ord > 300) continue;                        // rebuilding a 729-run costs nothing to skip
    const f = e.slice(0, p).concat(Array(ord).fill(x), e.slice(p));
    tried++; lengths.push(ord);
    if (headOf(f, step) === h && totalOf(f) === t) ok++;
  }
  return { tried, ok, lengths: lengths.sort((x, y) => x - y), allHeld: tried > 0 && ok === tried };
}
/** The BFS on hand-computable generator sets. It must span 1 to 729 before it is read. */
function bfsControls() {
  return {
    zero: minInsertions([0]).min,                       // 1
    one: minInsertions([1]).min,                        // 729
    plusMinus: minInsertions([1, N - 1]).min,           // 2
    third: minInsertions([243]).min,                    // 3
    ninth: minInsertions([3]).min,                      // 243
    two: minInsertions([2]).min,                        // 729, since gcd(2, 729) = 1
  };
}

// ----------------------------------------------------- I4, the universal forgery
/**
 * The gap-0 generator is the same on every ledger, so ONE fixed run of prepends is a
 * forgery of every ledger of every length -- no search, no knowledge of the entries.
 * Verified by rebuilding it on drawn ledgers of several lengths rather than argued.
 */
function universalPrepend(step = STEP, noOp = null, seed = 11) {
  const table = noOp || noOpTable(step);
  const x = table.first[ZERO];
  const runs = orderIn729(gen(x));
  const r = rng(seed);
  let tried = 0, ok = 0;
  for (const L of [1, 2, 3, 6, 9, 12]) {
    for (let n = 0; n < 40; n++) {
      const e = drawLedgerOfLength(r, L);
      const f = Array(runs).fill(x).concat(e);
      tried++;
      if (headOf(f, step) === headOf(e, step) && totalOf(f) === totalOf(e)) ok++;
    }
  }
  return { entry: x, entryValue: val(x), generator: gen(x), runs, tried, ok,
    universal: tried > 0 && ok === tried };
}

// ------------------------------------------------- WHAT THIS SET DID NOT ATTACK, MEASURED
/**
 * `AS` left this set's route open by NAMING it and measuring the object it rests on,
 * and the same courtesy is what makes the next set possible. The surface here is the
 * HYBRID: an insertion pays for itself with an EDIT rather than with another
 * insertion. One insertion at gap p moves the total by a forced amount, and a
 * compensating edit of one existing entry by the negation of that amount restores it
 * -- so the family is (L + 1) * L candidates with NO free parameter left, and its
 * chance yield is (L + 1) * L / 729. Measured here so the silence is a number.
 *
 * What is named and NOT measured: three or more free-value insertions, which is a
 * 729^(k-1)-parameter family an `AS3`-style meet-in-the-middle would price and this
 * set does not build; and insertion against a ledger whose entries are structured
 * rather than uniform.
 */
function hybridInsertEdit(ledgers, seed, step = STEP, noOp = null) {
  const table = noOp || noOpTable(step);
  const r = rng(seed);
  let tried = 0, accepted = 0, ledgersWithOne = 0;
  for (let n = 0; n < ledgers; n++) {
    const e = drawLedgerOfLength(r, L6), a = chain(e, step), h = a[L6], t = totalOf(e);
    let hit = 0;
    for (let p = 0; p <= L6; p++) {
      const x = table.first[a[p]], d = gen(x);
      if (d === 0) continue;                       // the insertion is already free; not a hybrid
      for (let j = 0; j < L6; j++) {
        const f = e.slice(0, p).concat([x], e.slice(p));
        const at = j < p ? j : j + 1;
        f[at] = (f[at] + N - d) % N;               // the edit the arithmetic total forces
        tried++;
        if (headOf(f, step) === h && totalOf(f) === t) { accepted++; hit++; }
      }
    }
    if (hit) ledgersWithOne++;
  }
  return { tried, accepted, ledgersWithOne, chance: tried / N,
    rateXChance: tried ? (accepted / tried) * N : null };
}

// ---------------------------------------------------------------- the cost ladder
/**
 * NOT REGISTERED. Both currencies, for every attack in this set, against `AS`'s
 * figures CITED rather than re-run. Ops are counted by the sweeps themselves; growth
 * is the number of entries added.
 */
function costLadder(M) {
  const c = M.census;
  const perLedgerOps = L6 + (L6 + 1) + c.minOps;       // chain, forced values, BFS
  return {
    universalPrepend: { ops: 0, growth: M.universal.runs, knowledge: 'none',
      note: 'one fixed value, valid on every ledger of every length' },
    noOpRun: { ops: perLedgerOps, growth: c.min.mean,
      note: 'exact minimum, certain rather than found' },
    twoFreeInsert: { ops: c.twoInsert.tried * 3.5 / Math.max(1, c.twoInsert.distinct),
      opsTotal: c.twoInsert.tried * 3.5, growth: 2,
      yield: c.twoInsert.mean },
    asBrute: { ops: 4413.9, growth: 0, cited: 'AS, F-MITM-PRICES-THE-MIXER-AT-SEVEN-OPS' },
    asJoin: { ops: 6.986, growth: 0, memory: 2125764, cited: 'AS3' },
    summedHead: { ops: 1, growth: 0, note: 'a compensating pair is a forgery by construction' },
  };
}

// ---------------------------------------------------------------- report
let CACHE = null;
function measure() {
  if (CACHE) return CACHE;
  const noOp = noOpTable(STEP);
  const ctrl = controlChain();
  const ledgerIx = LEDGER.map(v => idx(wrap(v)));
  const M = {
    noOp,
    ctrlDraws: ctrl.draws,
    instrument: {
      headAgrees: headOf(ledgerIx) === idx(headHash(LEDGER))
        && totalOf(ledgerIx) === idx(headSum(LEDGER)),
      noOpFree: checkNoOpIsFree(Math.min(LEDGERS, 200), 5, STEP, noOp),
      singleGapRun: checkSingleGapRun(40, 7, STEP, noOp),
      truncation: checkTruncationAgrees(LEDGERS >= 500 ? 20 : 4),
      bfs: bfsControls(),
      bruteAgrees: null,
    },
    universal: universalPrepend(STEP, noOp),
    census: census(LEDGERS, SEED, L6, STEP, noOp, true),
    control: census(Math.min(LEDGERS, 500), SEED ^ 0x27d4eb2f, L6, ctrl.step, ctrl.noOp, true),
    lengths: LENGTHS.map(L =>
      census(LEDGERS, SEED ^ (L * 0x9e3779b9), L, STEP, noOp, false)),
    nulls: LENGTHS.map(L => uniformGeneratorNull(LEDGERS, SEED ^ (L * 0x85ebca6b), L)),
    canonical: null,
    hybrid: hybridInsertEdit(Math.min(LEDGERS, 500), SEED ^ 0x165667b1, STEP, noOp),
  };
  // The BFS against direct enumeration, on real ledgers rather than on synthetic gens.
  {
    const r = rng(23);
    let agree = 0, disagree = 0;
    for (let n = 0; n < 60; n++) {
      const e = drawLedgerOfLength(r, L6);
      const { gens } = forcedAtGaps(chain(e), noOp);
      const bfs = minInsertions(gens).min;
      const brute = minInsertionsBrute(gens, 4);
      const ok = brute === null ? bfs > 4 : brute === bfs;
      if (ok) agree++; else disagree++;
    }
    M.instrument.bruteAgrees = { agree, disagree, ok: disagree === 0 };
  }
  // The canonical ledger, so this set has a figure a reader can hold.
  {
    const a = chain(ledgerIx);
    const { values, gens } = forcedAtGaps(a, noOp);
    const m = minInsertions(gens);
    const f = applyNoOps(ledgerIx, values, m.multiset);
    M.canonical = { ledger: ledgerIx, gens, orders: gens.map(orderIn729),
      min: m.min, multiset: Array.from(m.multiset), forged: f,
      verified: headOf(f) === a[L6] && totalOf(f) === totalOf(ledgerIx),
      grew: f.length - ledgerIx.length };
  }
  M.cost = costLadder(M);
  CACHE = M;
  return CACHE;
}

function report() {
  const M = measure();
  log('INSERT AUDIT -- what a forger who may LENGTHEN the ledger actually pays.');
  log(line);

  log('\n--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  const I = M.instrument;
  log(`      the canonical ledger's two heads reproduce ledger-audit's: ${I.headAgrees}`);
  log(`      I1  every accumulator has exactly one no-op entry (scanned, not argued):`
    + ` ${M.noOp.everyAccumulatorHasExactlyOne}   counts min ${M.noOp.min} max ${M.noOp.max}`);
  log(`      I1  inserting it at every gap leaves the mixer head unchanged:`
    + ` ${I.noOpFree.headHeld} of ${I.noOpFree.tried}`);
  log(`          and moves the arithmetic total in ${I.noOpFree.totalMoved} of ${I.noOpFree.tried}`);
  log(`      I3  a run of ord(v) insertions at one gap restores both heads:`
    + ` ${I.singleGapRun.ok} of ${I.singleGapRun.tried} rebuilt`
    + `  (run lengths ${I.singleGapRun.lengths.join(' ')})`);
  log(`      D3  the truncated two-insertion verdict equals the full one:`
    + ` ${I.truncation.agree.toLocaleString('en-US')} agree, ${I.truncation.disagree} disagree,`
    + ` ${I.truncation.accepts} accepts so it is not vacuous`);
  log(`      the BFS against direct enumeration on 60 real ledgers:`
    + ` ${I.bruteAgrees.agree} agree, ${I.bruteAgrees.disagree} disagree`);
  log(`      the BFS SPANS its range: {0} -> ${I.bfs.zero}, {1,-1} -> ${I.bfs.plusMinus},`
    + ` {243} -> ${I.bfs.third}, {3} -> ${I.bfs.ninth}, {1} -> ${I.bfs.one},`
    + ` {2} -> ${I.bfs.two}`);
  log(`      the draw visited ${M.census.coverage} of ${N} entry values`);
  const SI = M.census.summedOnInsertions;
  log(`      the two heads DISAGREE, which is what makes either readable:`);
  log(`        a single no-op insertion -- mixer accepts all ${SI.tried.toLocaleString('en-US')},`
    + ` the sum rejects ${SI.rejected.toLocaleString('en-US')}`);
  log(`        a rearrangement -- the sum accepts all`
    + ` ${M.census.rearrange.sumAccepted.toLocaleString('en-US')} of`
    + ` ${M.census.rearrange.distinct.toLocaleString('en-US')}, the mixer`
    + ` ${M.census.rearrange.accepted.toLocaleString('en-US')}`);
  log(`      the control chain took ${M.ctrlDraws} draw(s) to find a permutation with one`
    + ' fixed point');

  log('\n--- NOT REGISTERED: I4, the universal prepend ---');
  const U = M.universal;
  log(`      the gap-0 forced value is the constant val(u*) = ${U.entryValue},`
    + ` generator ${U.generator} in Z_729, order ${U.runs}`);
  log(`      so ${U.runs} prepend(s) of that one value forge ANY ledger:`
    + ` ${U.ok} of ${U.tried} rebuilt across six lengths -- ${U.universal}`);
  log('      no search, no knowledge of the entries, and the same value every time.');

  log('\n--- AT1  the shortest insertion-only forgery, at length six ---');
  const C = M.census;
  log(`      ${C.ledgers.toLocaleString('en-US')} drawn ledgers, exact minimum by BFS over Z_729`);
  log(`      mean ${C.min.mean.toFixed(4)}   sd ${Math.sqrt(C.min.variance).toFixed(4)}`
    + `   min ${C.min.min}   max ${C.min.max}`);
  log(`      the uniform-generator null at this length: mean`
    + ` ${M.nulls[LENGTHS.indexOf(L6)].mean.toFixed(4)}`
    + ` (sd ${M.nulls[LENGTHS.indexOf(L6)].sd.toFixed(3)}, max ${M.nulls[LENGTHS.indexOf(L6)].max})`);
  log(`      the control chain, a random permutation: mean ${M.control.min.mean.toFixed(4)}`
    + `   max ${M.control.min.max}`);
  log(`      forced-value orders over ${C.ledgers * (L6 + 1)} gaps`
    + '   (null 486/162/54/18/6/2/1 per 729)');
  log('      order      seen     per 729');
  for (const [o, k] of C.orders) {
    log(`      ${String(o).padStart(5)}  ${String(k).padStart(9)}   `
      + `${(k / (C.ledgers * (L6 + 1)) * N).toFixed(2)}`);
  }
  log(`      rebuilt and both heads recomputed: ${C.rebuilt.ok} of ${C.rebuilt.tried}`);
  log(`      T-INSTRUMENT-FALSE-VERDICT: ${C.ledgersWithDegenerateGap} ledger(s) have an entry`
    + ` that is its own gap's no-op, giving ${C.degenerateGapPairs} interchangeable gap pair(s)`);

  log('\n--- AT2  the same statistic across ledger lengths ---');
  log('       L    gaps      mean     sd     min   max      null mean   null max');
  for (let i = 0; i < LENGTHS.length; i++) {
    const c = M.lengths[i], nu = M.nulls[i];
    log(`      ${String(c.length).padStart(2)}   ${String(c.length + 1).padStart(4)}  `
      + `${c.min.mean.toFixed(4).padStart(8)}  ${Math.sqrt(c.min.variance).toFixed(3).padStart(6)}`
      + `  ${String(c.min.min).padStart(4)}  ${String(c.min.max).padStart(4)}   `
      + `${nu.mean.toFixed(4).padStart(10)}   ${String(nu.max).padStart(8)}`);
  }
  const means = M.lengths.map(c => c.min.mean);
  let strictly = true;
  for (let i = 1; i < means.length; i++) if (!(means[i] < means[i - 1])) strictly = false;
  log(`      strictly decreasing at every one of the ${means.length - 1} steps: ${strictly}`);
  log(`      worst single ledger at any length: ${Math.max(...M.lengths.map(c => c.min.max))}`);

  log('\n--- AT3  two free insertions, and deletion ---');
  const T = M.census.twoInsert, D = M.census.deletion;
  log(`      family ${T.family.toLocaleString('en-US')} candidates per ledger`
    + ` (${gapPairs(L6)} gap pairs x 729 free values, the second value forced)`);
  log(`      accepts per ledger   mean ${T.mean.toFixed(4)}   chance ${T.chance.toFixed(3)}`
    + `   variance ${T.variance.toFixed(3)}   variance/mean ${T.varOverMean.toFixed(4)}`);
  log(`      min ${T.min}   max ${T.max}`);
  log(`      enumerated ${T.enumerated.toLocaleString('en-US')} accepts,`
    + ` ${T.distinct.toLocaleString('en-US')} DISTINCT forged ledgers`
    + ` -- ${(T.enumerated - T.distinct).toLocaleString('en-US')} collisions`);
  log(`      control chain: mean ${M.control.twoInsert.mean.toFixed(4)},`
    + ` variance/mean ${M.control.twoInsert.varOverMean.toFixed(4)}`);
  log(`      deletions: ${D.tried.toLocaleString('en-US')} subsets tried,`
    + ` ${D.headOnly} preserve the mixer head, ${D.sumOnly} the total,`
    + ` ${D.both} BOTH`);
  log(`        on ${D.ledgersWithOne} ledger(s), against a chance expectation of`
    + ` ${D.chanceLedgers.toFixed(3)}`);

  log('\n--- AT4  rearrangement, which the summed head cannot see at all ---');
  const R = M.census.rearrange, V = M.census.move;
  log(`      ${R.distinct.toLocaleString('en-US')} distinct non-identity rearrangements swept`);
  log(`      the summed head accepts ${R.sumAccepted.toLocaleString('en-US')} of them`
    + ` -- ${(100 * R.sumAccepted / R.distinct).toFixed(2)}%`);
  log(`      the mixer accepts ${R.accepted.toLocaleString('en-US')} against a chance of`
    + ` ${R.chance.toFixed(2)}   ratio ${R.ratio.toFixed(4)}`);
  log(`      per ledger: mean ${R.mean.toFixed(4)}   variance/mean ${R.varOverMean.toFixed(4)}`
    + `   max ${R.max}`);
  log(`      control chain ratio ${M.control.rearrange.ratio.toFixed(4)}`);
  log(`      the length-preserving sub-family (delete one, re-insert its value elsewhere):`);
  log(`        ${V.distinct.toLocaleString('en-US')} distinct moves,`
    + ` ${V.accepted.toLocaleString('en-US')} accepted, chance ${V.chance.toFixed(2)},`
    + ` ratio ${V.ratio === null ? 'n/a' : V.ratio.toFixed(4)}`);

  log('\n--- NOT REGISTERED: what a forger actually pays, in BOTH currencies ---');
  const K = M.cost, CA = M.canonical;
  log('      attack                          ops        growth   knowledge needed');
  log(`      universal prepend (I4)          ${String(K.universalPrepend.ops).padStart(9)}`
    + `  ${String(K.universalPrepend.growth).padStart(8)}   none at all`);
  log(`      shortest no-op run (AT1)        ${K.noOpRun.ops.toFixed(0).padStart(9)}`
    + `  ${K.noOpRun.growth.toFixed(2).padStart(8)}   the ledger's accumulators`);
  log(`      two free insertions (AT3)       ${K.twoFreeInsert.ops.toFixed(0).padStart(9)}`
    + `  ${String(K.twoFreeInsert.growth).padStart(8)}   the whole ledger`);
  log(`      AS brute force, edits only      ${K.asBrute.ops.toFixed(0).padStart(9)}`
    + `  ${String(K.asBrute.growth).padStart(8)}   the whole ledger        [cited]`);
  log(`      AS meet in the middle           ${K.asJoin.ops.toFixed(2).padStart(9)}`
    + `  ${String(K.asJoin.growth).padStart(8)}   + 2,125,764 slots       [cited]`);
  log(`      the SUMMED head, edits only     ${String(K.summedHead.ops).padStart(9)}`
    + `  ${String(K.summedHead.growth).padStart(8)}   a compensating pair is free`);
  log(`      the canonical ledger: forced generators ${CA.gens.join(' ')}`);
  log(`        orders ${CA.orders.join(' ')}, minimum ${CA.min} insertion(s),`
    + ` multiset ${CA.multiset.join(',')}, rebuilt ${CA.verified}`);
  log(`        six entries become ${CA.forged.length}`);

  log('\n--- WHAT THIS SET DID NOT ATTACK, measured rather than left as silence ---');
  const H = M.hybrid;
  log(`      the HYBRID: one insertion paid for by one compensating EDIT. No free`);
  log(`      parameter is left, so the family is ${L6 * (L6 + 1)} candidates per ledger.`);
  log(`        ${H.tried.toLocaleString('en-US')} tried, ${H.accepted} accepted`
    + ` (${H.rateXChance === null ? 'n/a' : H.rateXChance.toFixed(3)}x chance),`
    + ` on ${H.ledgersWithOne} of ${Math.min(LEDGERS, 500)} ledgers`);
  log('      NAMED AND NOT MEASURED: three or more free-value insertions, which is a');
  log('      729^(k-1)-parameter family an AS3-style join would price and this set does');
  log('      not build; insertion against structured rather than uniform entries; and');
  log('      any family that also EDITS more than one entry.');
  log('\n' + line);
  return M;
}

if (MAIN) report();

module.exports = {
  N, ZERO, OFF, LEDGERS, SEED, LENGTHS, L6, gapPairs, twoInsertFamily, twoInsertChance,
  gen, negEntry, chain, headOf, totalOf, noOpTable, orderIn729,
  minInsertions, minInsertionsBrute, applyNoOps, forcedAtGaps,
  twoInsertSweep, applyTwoInsert, deletionSweep, permutationsOf, PERMS6,
  rearrangementSweep, moveSweep, controlChain, drawLedgerOfLength, census,
  uniformGeneratorNull, checkTruncationAgrees, checkNoOpIsFree, checkSingleGapRun,
  bfsControls, universalPrepend, hybridInsertEdit, costLadder, measure, report,
};
