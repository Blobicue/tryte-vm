'use strict';
/* WIDTH AUDIT -- what does the WIDTH of a ledger head buy a forger, and what does it not?
 *
 * Set `AU`. Two sets have now measured the accumulator's MIXING and both found it worth
 * approximately nothing. Their figures are CITED here and never re-run as if they were
 * this set's.
 *
 *   `AS`  priced a meet-in-the-middle join against `D`'s split-round chain: 532,485
 *         forgeries of one six-entry ledger at 6.99 operations each against a
 *         brute-force 4,414 (`F-MITM-PRICES-THE-MIXER-AT-SEVEN-OPS`). So the mixer is
 *         worth a factor of SEVEN over a plain summed head, not the 840 a per-try
 *         collision rate suggested -- and the attack NEVER LOOKS INSIDE THE MIXER. What
 *         it exploits is that the head is nine and a half bits wide.
 *
 *   `AT`  removed even the seven. Three pairs of entry values -- (136, -136),
 *         (295, -295), (362, -362) -- prepended to any ledger of any length leave both
 *         heads unchanged at zero operations, because the accumulator before the first
 *         entry is ONE FIXED POINT EVERY LEDGER STANDS ON
 *         (`F-A-UNIVERSAL-TWO-ENTRY-INSERTION-FORGERY`).
 *
 * THE REMAINING LEVER IS WIDTH AND NOBODY HAS MEASURED WHAT IT BUYS. That is this set.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * Everything in this section is fixed before the run, is derivable on paper, or is a
 * null model computed before the registration. NONE OF IT IS AT RISK. It is written
 * down so that what IS at risk is unambiguous, and every identity below is checked
 * exhaustively by the tool rather than trusted -- `T-TRANSCRIBED-TABLE`.
 *
 * THE FAMILY OF HEADS, AND WHY IT IS DRAWN RATHER THAN DERIVED. `D`'s mixer `P` is
 * defined on 729 states and nothing narrower or wider exists; a width sweep therefore
 * needs a FAMILY, and choosing one is a design decision.
 *
 *   the arena     width w in 1..6 trits, N = 3^w states = 3, 9, 27, 81, 243, 729. The
 *                 ledger's ENTRIES, its arithmetic total and its mixer head all narrow
 *                 together, which is the natural object; a wide-entry / narrow-head
 *                 COMPRESSING family is a different one and is not swept.
 *   the step      a' = perm(a (+) e) (-) e, with (+) and (-) TRITWISE over GF(3)^w and
 *                 the summed head ARITHMETIC with carries over Z_(3^w). Exactly `AS`'s
 *                 D1 at every width. The two groups are not the same group above width
 *                 one, and NEGATION is the one place they coincide at every width,
 *                 because balanced-ternary negation is tritwise -- checked, since the
 *                 second inserted entry is written as a negation.
 *   `random`      perm drawn uniformly at random (mulberry32 + Fisher-Yates), CONDITIONED
 *                 ON EXACTLY ONE FIXED POINT. The conditioning is not cosmetic: an entry
 *                 x is a no-op at accumulator a exactly when a (+) x is a fixed point of
 *                 perm, so a head with no fixed point has NO no-op insertion anywhere and
 *                 `AT`'s whole family is empty for it, while a head with three has three
 *                 forced values per gap. `D`'s `P` has exactly one. The acceptance rate
 *                 of the conditioning is reported, and the UNCONDITIONED family is run
 *                 beside it for the one statistic that does not need a no-op.
 *   `split`       `D`'s split round widened: halves of w/2 trits, an S-box of 3^(w/2)
 *                 entries from `D`'s own LCG at seed 98765, eight rounds. Even widths
 *                 only. At w = 6 it must reproduce `D`'s 729-entry table and the whole
 *                 531,441-cell `STEP` of `ledger-audit.js` EXACTLY, which is the gate
 *                 that stops this file being a second implementation nobody compared.
 *   `affine`      `AN`'s A = rot^2 + I, linear over GF(3)^w. The control that must
 *                 DEGENERATE, so the statistics are known to span their range.
 *
 * WHY A RANDOM PERMUTATION IS THE RIGHT NULL FAMILY, stated because it is the whole
 * design. `AS` and `AT` between them ran five statistics against a random-permutation
 * control at 729 states and the split round was indistinguishable on every one: the
 * differential table's maximum 8 against a control running 7 to 9; the join's yield
 * 1.0020 against 1.0000; the rearrangement rate 0.9746 against 1.0262; the insertion
 * minimum 4.934 against 4.911; the same-gap fixed-point total 741 against 735. A family
 * of random heads therefore isolates WIDTH as the only varying parameter, which is what
 * the question needs. `T-CLAIM-NARROWED-BY-A-DESIGN` has bitten five times, so the
 * limit is stated too: what is fitted below is a law about a family of permutation-based
 * heads of this shape, and the split anchor at widths 4 and 6 is what says it is not
 * merely a law about my generator.
 *
 * WIDTH ONE IS A DEGENERATE POINT BY CONSTRUCTION and is reported rather than silently
 * fitted. At one trit there is no carry, so ARITHMETIC AND TRITWISE ADDITION ARE THE
 * SAME OPERATION -- the two-group mismatch that every attack in this thread runs against
 * is absent. Any departure at width one is that, not a width law.
 *
 * THE TWO ATTACK GOALS, WHICH ARE NOT THE SAME QUESTION AND ARE PRICED SEPARATELY.
 * The birthday law is about COLLISIONS. A ledger forger is usually handed a ledger and
 * must produce a SECOND PREIMAGE. Both are implemented.
 *
 *   SECOND PREIMAGE  the ledger is given. `AS`'s compensating family -- +d at entry i,
 *                    -d at entry j -- preserves the arithmetic total by construction, so
 *                    only the mixer head has to be hit. Scanned in a fixed order
 *                    (i < j, then d ascending); the statistic is the INDEX of the first
 *                    accepted forgery.
 *   COLLISION        the forger chooses BOTH ledgers. Fix an arithmetic total c and
 *                    enumerate the length-two ledgers (x, c - x) for x ascending; the
 *                    statistic is the index of the first REPEATED mixer head. Every row
 *                    shares one total, so a repeat is a collision on both heads at once.
 *   IN BULK          `AS`'s meet-in-the-middle join, generalised: modify entries 1, 2, 5
 *                    and 6, key both halves on (accumulator, arithmetic partial sum),
 *                    and join. Ideal yield N^2 forgeries for 7N^2 operations.
 *
 * THE COST MODEL is `AS`'s and `AT`'s verbatim, so all three sets are comparable. One OP
 * is one lookup into a precomputed table or one index arithmetic operation.
 * Precomputation is charged and printed, never amortised silently. GROWTH is entries
 * added, and nothing here converts growth into ops -- `AT` refused that exchange rate
 * and so does this.
 *
 * THE NULL MODELS, all computed BEFORE this commit because a null model is arithmetic.
 *
 *   SECOND PREIMAGE. The family is F = 15 (N - 1) forgeries at a per-try rate of 1/N, so
 *   the first-accept index scored as min(T, F + 1) has expectation
 *   N (1 - (1 - 1/N)^(F+1)), which is 3.000, 9.000, 27.000, 81.000, 243.000 and 729.000
 *   at widths 1..6 -- the state count itself, to three decimals, at every width.
 *
 *   COLLISION. The EXACT finite-N birthday expectation, 1 + sum_k prod_{i<k}(1 - i/N),
 *   not the asymptote: 2.8889, 4.4583, 7.1981, 11.9577, 20.2105 and 34.5100. The last
 *   agrees with the 34.51 `ladderlang`'s `HASH27.md` registered against for the same
 *   729 digests, and the same routine returns 914.3328 at 531,441 digests, which is that
 *   document's own figure for its second width. Two files may not disagree about one
 *   number, and now they cannot.
 *
 *   GROWTH. `AT`'s counting heuristic, exactly: the shortest non-empty multiset of the
 *   L + 1 forced values summing to zero has E[k] = sum_j exp(-(C(L+1+j, j) - 1)/N),
 *   which at L = 6 gives 1.0970, 1.4799, 2.0574, 2.8138, 3.7479 and 4.8720 at widths
 *   1..6 -- the last being the 4.87 `AT1` registered against and measured at 4.934 --
 *   and at L = 12 gives 1.0131, 1.2359, 1.6391, 2.1297, 2.7000 and 3.3521.
 *
 *   THE UNIVERSAL PAIR. `a -> STEP[STEP[a][x]][-x]` is a permutation of the accumulators
 *   for every x (`AS`'s D3, two bijections composed), so the number of x fixing a given
 *   accumulator has mean one over the accumulators, and under a Poisson(1) model the
 *   fraction admitting NONE is e^-1 = 0.36788 and the fraction admitting at least one is
 *   0.63212. `AT` measured 256 of 729 = 0.35117 at width six, which is already 4.5% off
 *   that closed form; whether that gap holds, shrinks or grows as the head narrows is
 *   what `AU4` is about. THE CLOSED FORM IS NOT THE PREDICTION -- predicting e^-1 from a
 *   Poisson model stated two lines above it would be arithmetic over quantities this
 *   registration fixed itself, which is the decoration `F-REGISTRATION-IS-NOT-RISK`
 *   names. What is registered is the MEASURED fraction, in a band placed before the run.
 *
 * THE RANDOMNESS. mulberry32 with every step forced through `>>> 0`, seed 20260830,
 * reusing `AS`'s generator rather than writing a third one -- `T-FAKE-RANDOM` was a
 * 31-bit overflow that turned four hundred trials into four hundred repetitions. The
 * tool asserts the draw visited every entry value at every width before any verdict.
 *
 * THE CONTROLS, each asserted to MOVE before its verdict is read, because
 * `T-CONTROL-CANNOT-DISCRIMINATE` has bitten twice and the fix for the first bite was
 * not enough for the second:
 *
 *   - THE AFFINE HEAD. Linear, so its length-two row map stays injective and its
 *     collision scan finds NOTHING -- the statistic is asserted to reach its degenerate
 *     value rather than assumed to be able to.
 *   - THE IDENTITY HEAD. The chain never moves, so every ledger has the same head and
 *     the collision scan returns 2 everywhere. The other end of the same range.
 *   - THE DEGENERATE JOIN, `AS`'s: a join whose two halves are identical must return
 *     exactly 2.0 times ideal, at every width.
 *   - THE BFS SPAN, `AT`'s, made width-parametric: {0} must give 1, {1, -1} must give 2,
 *     {1} must give N, {N/3} must give 3.
 *   - AND THE ANCHOR, which is the strongest control here: at width six this file's
 *     `STEP` is compared against `ledger-audit.js`'s cell by cell over all 531,441, and
 *     `AS3`'s 532,485 matches and `AT`'s c(ZERO) = 3 with witnesses 136, 295 and 362 are
 *     reproduced through THIS code path. A second implementation that is never compared
 *     is just an unchecked claim.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES -- registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AU1  THE OPS CURRENCY IS LINEAR IN THE STATE COUNT AND WIDTH BUYS THE FORGER'S
 *        MEMORY, NOT HIS TIME. Over the six widths with 24 random heads each, predicted:
 *        (a) the mean index of the first accepted compensating forgery, divided by the
 *        exact finite-family null above, lies in [0.93, 1.07] at EVERY width from 1 to 6
 *        -- including width one, where no carry exists; (b) the meet-in-the-middle
 *        join's yield ratio has a mean within 0.03 of 1.0 at every width, so the 6.99
 *        operations per forgery `AS` measured at width six is seven operations per
 *        forgery at EVERY width, and what grows with width is the 4N^2 table slots the
 *        join needs; (c) the split-round head at widths 4 and 6 lies inside the random
 *        family's min-to-max range on both statistics. (b) is registered at widths 2 to 6
 *        and NOT at width one, because at width one the join's left key map is a
 *        BIJECTION -- nine rows onto nine keys, occupancy 1.0000, measured while building
 *        the instrument and recorded below -- so every key holds exactly one row on each
 *        side, the yield is N^2 by construction and the ratio cannot be anything but
 *        exactly 1. A band that cannot fail is decoration and it is removed rather than
 *        collected.
 *        AT RISK: width one is the route and I am registering it INSIDE the band rather
 *        than outside. At one trit the compensating family collapses -- d runs over two
 *        values, F is 30 rather than 10,920, and the tritwise difference EQUALS the
 *        arithmetic delta at every entry, so `AS`'s four-cell carry partition (which ran
 *        0.989 to 1.042 times chance at width six) has one cell and the mismatch that
 *        every attack in this thread runs against is gone. I have one observation
 *        pointing that way and it is about this set's OTHER cost statistic: a 40-head
 *        probe of the collision scan at width one, run while building the instrument and
 *        recorded below, found 63 of 120 rows with NO collision at all and a mean of
 *        2.000 against an exact null of 2.889 -- a 31% miss. So width one is already
 *        known to break one of this set's two cost laws, and (a) predicts it does not
 *        break this one. For (b), `AS3`'s registered failure route was that the join's
 *        two half-tables might have coinciding key sets, which returns the sum of squared
 *        counts rather than the product of means -- 2.0 times ideal, and the tool
 *        measures 2.0003 for the degenerate case at width six. That did not fire at
 *        531,441 keys; at width TWO the join has 81 keys and 81 rows a side with about
 *        two thirds of the keys occupied, which is where the Poisson approximation behind
 *        "the mean is one" is weakest among the widths (b) covers, and a mean ratio past
 *        1.03 at any of widths 2 to 6 refutes it. The responsiveness control is itself
 *        width-dependent and that is on the record below: a join whose halves are
 *        identical returns 1.0000 at width one, about 1.8 at width two and 2.00 from
 *        width three up, so at width two the control's own span is 1.0 to 1.8.
 *        CANNOT SHOW: one ledger length for the scan (six), one join split, and heads
 *        conditioned on exactly one fixed point. Nothing here prices a forger who may
 *        modify more than four entries, and the join is one meet point of one family.
 *
 *   AU2  THE COLLISION LAW IS THE ONLY SQUARE ROOT IN THIS THREAD, AND IT HAS A FLOOR.
 *        The forger who may choose BOTH ledgers pays the birthday price and the forger
 *        handed one pays the state count, so the two goals separate by exactly one square
 *        root. Predicted: (a) the mean first-repeat index divided by the exact birthday
 *        null lies in [0.95, 1.06] at widths 4, 5 and 6, and no row anywhere at those
 *        three widths is collision-free; (b) the least-squares slope of log mean against
 *        log N over widths 2..6 lies in [0.45, 0.55] for the collision scan and in
 *        [0.95, 1.05] for the second-preimage scan, so the separation is a measured half
 *        exponent and not an assumed one; (c) the shortfall at the narrow end is a
 *        MULTIPLICITY effect and not an ordering one -- at widths 1, 2 and 3 the measured
 *        mean divided by the mean over 200 random reshuffles of each row's own multiset
 *        of head values lies in [0.95, 1.05] at each of the three.
 *        AT RISK: (a) can fail by the scan being EMPTY, which is not hypothetical.
 *        `ladderlang`'s `HASH27.md` measured this exact head shape read one-headed --
 *        h_old(a, b) = P(a + b) - b -- and found the fixed-b orientation has NO COLLISION
 *        IN ANY ROW, at 6 trits and again at 162, because that map is a bijection. My row
 *        map is x -> STEP[g(x)][c - x], whose first factor is g and therefore not
 *        injective at width six, where `AS` measured g's image at 465 of 729; if the
 *        image fraction climbs toward 1 as the head narrows the rows go collision-free
 *        and (a) fails at width four the way the probe says it already fails at width
 *        one. (c) can fail in the other direction: the scan runs x in ASCENDING index
 *        order, which is not a random order, and if the head correlates a repeat with
 *        small |x| the measured mean falls below the reshuffled one and the ratio drops
 *        under 0.95 -- that would be a structural finding rather than a width law, and it
 *        is why (c) is registered separately from (a).
 *        CANNOT SHOW: length-two collisions with a fixed total, which is the cheapest
 *        form. A forger willing to spend more entries has a larger family and this set
 *        does not sweep it, and nothing here is a claim about collisions in the mixer
 *        alone -- both heads move together throughout.
 *
 *   AU3  GROWTH IS NEARLY FREE OF WIDTH, AND LENGTH BEATS WIDTH. `AT1` measured the
 *        shortest insertion-only forgery at 4.934 entries at width six. Predicted over
 *        the six widths with 24 heads and 400 drawn six-entry ledgers each: (a) the mean
 *        minimum tracks the counting null above to within 0.30 at EVERY width from 1 to
 *        6; (b) the least-squares slope of log mean against log N over widths 1..6 is
 *        under 0.32 -- against 0.5 for the birthday law and 1.0 for `AU1`'s ops law -- so
 *        five more trits of head multiply the growth cost by under 4.5 while multiplying
 *        the state count by 243; (c) the same slope measured at ledger length TWELVE is
 *        at least 0.05 smaller than at length six, so adding gaps defeats width faster
 *        than width defends against gaps.
 *        AT RISK: the counting null assumes the L + 1 forced values are L + 1 independent
 *        uniform draws on Z_N, and they are L + 1 reads of ONE bijection -- the forced
 *        value at accumulator a is u* (-) a, so DISTINCT GENERATORS ARE EXACTLY DISTINCT
 *        ACCUMULATORS VISITED. At width one a seven-gap chain walks three states, so at
 *        most three of the seven generators can differ, and at width six seven gaps on
 *        729 states essentially never repeat. `AT2` registered exactly this route -- "a
 *        repeated accumulator contributes a DUPLICATE generator rather than a new one" --
 *        and it did not fire at 729; this set runs it at the width where it must be
 *        largest. If duplication costs the forger anything the measured mean at width one
 *        or two exceeds its null by more than 0.30 and (a) fails at the narrow end, which
 *        would also push (b)'s slope down and make (b) hold for the wrong reason. In the
 *        other direction (b) fails if the shortfall at the narrow end is so severe that
 *        the curve is steeper than a cube root. For (c) the hazard is that at length
 *        twelve the null is nearly flat across these widths -- 1.0131 to 3.3521 -- so the
 *        slope is small, and a gap of 0.05 between two small slopes is the kind of line
 *        `T-CRITERION-IN-THE-NOISE` has fired on four times; the seed-to-seed spread of
 *        both slopes is therefore reported beside them and the band is placed at four
 *        times the null spread of the difference rather than at a round number.
 *        CANNOT SHOW: uniformly drawn entries, no-op insertions only, and lengths six and
 *        twelve. A ledger of small mints and burns walks the accumulator differently, and
 *        `AT3`'s free-value insertions are not swept across width here.
 *
 *   AU4  NO WIDTH IN THIS SWEEP EXTINGUISHES THE ZERO-OPERATION FORGERY. `AT` found
 *        three universal pairs at 729 states and said in its own results that "the
 *        universal pair is a property of `D`'s permutation, not of narrow iterated heads
 *        in general" -- on a control sample of ONE. Over 400 random heads at each of the
 *        six widths, predicted: (a) the measured fraction of heads admitting at least one
 *        universal pair lies in [0.56, 0.70] at every width from 2 to 6; (b) that
 *        fraction at width 6 is not the smallest of those five, so there is no monotone
 *        width trend; (c) pooled over heads, the measured fraction of ACCUMULATORS
 *        admitting no pair lies in [0.335, 0.395] at every width from 2 to 6 -- a band
 *        placed around `AT`'s own measured 0.35117 rather than around the Poisson closed
 *        form 0.36788, because the subject is already 4.5% below the closed form and the
 *        band has to be able to distinguish those two.
 *        AT RISK: the accumulator this whole statistic hangs on is DISTINGUISHED, and
 *        `AT`'s closing sentence is that gap zero is never a random accumulator. At the
 *        tritwise identity the accept condition collapses from a generic equation to
 *        P(P(x) (+) x) = -x, a self-composition of the head rather than an independent
 *        draw, and a self-composition is exactly the shape whose fixed-point count is not
 *        Poisson(1): for a uniform permutation the expected number of fixed points of
 *        sigma^2 is 2, not 1. If that excess propagates, (a) fails high at several widths
 *        at once. The narrow end is where a distributional claim goes to die -- at width
 *        one there are THREE accumulators and three values of x, and a Poisson argument
 *        has no business being trusted there, which is why widths 2..6 are the registered
 *        range and width one is reported. What I have pointing the other way is one
 *        measured total: `AT` reports 741 fixed points summed over the 729 accumulators
 *        against a random-permutation control's 735 and a random-function step table's
 *        751, so the excess over N at width six is 12 on a spread of about 27 and is 0.4
 *        standard deviations. That is the arithmetic saying the effect is not there; (a)
 *        and (c) are the measurement asking whether it is there at widths nobody has run.
 *        CANNOT SHOW: the universal PAIR, at the identity accumulator, on heads
 *        conditioned to have one fixed point. `AT`'s longer universal PREPEND RUN --
 *        ord(val(u*)) insertions of one value, 243 at width six -- is a different object
 *        and its width law is reported, not registered.
 * ------------------------------------------------------------------------------
 * NOT REGISTERED, because each was derivable before the run, is a cost that follows once
 * the registered quantities are in hand, or WAS MEASURED WHILE BUILDING THE INSTRUMENT.
 * A fact that was never at risk cannot fail, and a fact measured during design is not a
 * prediction -- `AGENTS.md` requires it be recorded here rather than inflating the set.
 *
 *   MEASURED WHILE BUILDING THE INSTRUMENT, in a 40-head probe at widths 1, 2 and 3 and
 *   on `D`'s own head at width 6, and therefore not at risk anywhere above:
 *     - the collision scan at width ONE is degenerate: 63 of 120 rows had no collision at
 *       all and the mean over the rest was 2.000 against an exact null of 2.889;
 *     - at widths 2 and 3 no row was collision-free, and the means were 4.172 and 7.281
 *       against nulls 4.4583 and 7.1981, ratios 0.936 and 1.011;
 *     - the mean of c(ZERO) over 40 unconditioned random heads was 0.975, 1.100 and 0.850
 *       at widths 1, 2 and 3;
 *     - `D`'s head at width six scans to 34.9246 against the exact null 34.5100.
 *   THE PROBE IS WHY `AU2`(a) IS REGISTERED AT WIDTHS 4, 5 AND 6 AND NOT AT 2 AND 3, and
 *   why `AU1`(a) names width one as its route.
 *
 *   ALSO MEASURED WHILE BUILDING THE INSTRUMENT, and both are structural rather than
 *   statistical:
 *     - THE WIDENED SPLIT ROUND DEGENERATES TO THE IDENTITY AT WIDTH TWO. Eight rounds of
 *       a one-trit Feistel over a 3-entry S-box returns every one of the nine states to
 *       itself, so the anchor family is widths 4 and 6 and width 2 is a control rather
 *       than a subject. This is exactly the failure `ladderlang`'s widening warned about
 *       -- a structural invariant that holds at the endpoints and not in between -- and
 *       it is checked at every even width rather than at the one that was expected to
 *       work.
 *     - `AN`'s AFFINE MAP IS NOT A PERMUTATION AT WIDTH FOUR. rot^2 + I is singular over
 *       GF(3)^4, so the affine control exists at widths 1, 2, 3, 5 and 6 and the tool
 *       refuses to build it at width 4 rather than silently returning a non-permutation.
 *     - AND WHERE IT DOES EXIST IT REACHES THE DEGENERATE END ONLY AT THE NARROW WIDTHS.
 *       The affine head's collision scan is collision-free on EVERY row at widths 1 and 2
 *       and on exactly one row in nine at widths 3, 5 and 6, where its mean first repeat
 *       at width six is 84.47 against an exact null of 34.51. So the collision statistic
 *       is demonstrated to span from "undefined everywhere" to 2.45 times its null before
 *       any subject value is read, which is what `T-CONTROL-CANNOT-DISCRIMINATE` asks for
 *       -- but the fully degenerate value is reached at two widths and not at six, and
 *       saying which is the point of writing it down.
 *     - THE JOIN'S LEFT KEY MAP IS A BIJECTION AT WIDTH ONE. Nine rows onto nine keys,
 *       occupancy exactly 1.0000, so every key holds one row on each side and the yield
 *       ratio is exactly 1 whatever the head is. `AS`'s degenerate-halves control returns
 *       1.0000 there rather than 2.0, about 1.8 at width two, and 2.00 from width three
 *       up. This is why `AU1`(b) is registered at widths 2 to 6.
 *
 *   DERIVABLE BEFORE THE RUN:
 *     - the join costs 7N^2 operations for N^2 forgeries by construction, so 7 operations
 *       per forgery is arithmetic and only the YIELD is a measurement;
 *     - an entry x is a no-op at accumulator a exactly when a (+) x is a fixed point of
 *       the head, so a head with no fixed point has no no-op insertion family at all --
 *       which is why the random family is conditioned;
 *     - the cost ladder in both currencies, extended across width, against `AS`'s and
 *       `AT`'s figures cited rather than re-run;
 *     - what a stated operation target implies for width under each of the two laws, and
 *       how far `ladderlang`'s H27 is from anything measured here.
 * ------------------------------------------------------------------------------
 * Run:  npm run audit:width        WIDTH_HEADS=2 npm run audit:width   (capped)
 */

const Q = require('./puzzle-audit.js');
const LED = require('./ledger-audit.js');
const F = require('./forge-audit.js');
const INS = require('./insert-audit.js');

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

const WIDTHS = [1, 2, 3, 4, 5, 6];
/** Heads per width for the expensive statistics. Capped for the suite's spawn check. */
const HEADS = Number(process.env.WIDTH_HEADS || 24);
/** Heads per width for c(ZERO), which costs O(N) rather than O(N^2). */
const CZERO_HEADS = Number(process.env.WIDTH_CZERO_HEADS || 400);
/** Drawn ledgers per head for the growth census, and for the first-accept scan. */
const LEDGERS = Number(process.env.WIDTH_LEDGERS || 400);
const SCAN_LEDGERS = Number(process.env.WIDTH_SCAN_LEDGERS || 40);
const SEED = 20260830;
const L6 = 6, L12 = 12;

// ---------------------------------------------------------------- the arena
/**
 * Width-parametric balanced ternary. `TADD`/`TSUB` are the TRITWISE group and `asum`
 * the ARITHMETIC one; they are not the same group above width one and the index/value
 * boundary between them has produced two false verdicts in this corpus, so every
 * conversion lives here and never inside a sweep.
 */
function arena(w) {
  const N = 3 ** w, half = (N - 1) / 2;
  const val = i => i - half;
  const idx = v => (((v + half) % N) + N) % N;
  const trits = v => {
    const t = []; let x = v;
    for (let k = 0; k < w; k++) { let r = ((x % 3) + 3) % 3; if (r === 2) r = -1; t.push(r); x = (x - r) / 3; }
    return t;
  };
  const fromTrits = t => t.reduceRight((a, x) => a * 3 + x, 0);
  const TADD = new Int32Array(N * N), TSUB = new Int32Array(N * N);
  const TR = Array.from({ length: N }, (_, i) => trits(val(i)));
  for (let a = 0; a < N; a++) {
    const ta = TR[a];
    for (let b = 0; b < N; b++) {
      const tb = TR[b], s = new Array(w), d = new Array(w);
      for (let k = 0; k < w; k++) { s[k] = ((ta[k] + tb[k] + 4) % 3) - 1; d[k] = ((ta[k] - tb[k] + 4) % 3) - 1; }
      TADD[a * N + b] = idx(fromTrits(s));
      TSUB[a * N + b] = idx(fromTrits(d));
    }
  }
  return {
    w, N, half, val, idx, trits, fromTrits, TADD, TSUB,
    ZERO: idx(0), OFF: half,
    asum: (a, b) => (a + b - half + N) % N,
    asub: (a, b) => ((a - b + half) % N + N) % N,
    gen: x => (x - half + N) % N,
    negEntry: x => (2 * half - x + N) % N,
  };
}
const ARENA = {};
const arenaOf = w => (ARENA[w] || (ARENA[w] = arena(w)));

/** The chain step and its inverse, as N x N tables over accumulator indices. */
function stepTable(A, perm) {
  const { N, TADD, TSUB } = A;
  const step = new Int32Array(N * N), back = new Int32Array(N * N).fill(-1);
  for (let a = 0; a < N; a++) {
    for (let e = 0; e < N; e++) {
      const nx = TSUB[perm[TADD[a * N + e]] * N + e];
      step[a * N + e] = nx; back[nx * N + e] = a;
    }
  }
  return { step, back };
}
const chainOf = (A, step, e) => {
  const a = new Array(e.length + 1); a[0] = A.ZERO;
  for (let k = 0; k < e.length; k++) a[k + 1] = step[a[k] * A.N + e[k]];
  return a;
};
const headOf = (A, step, e) => chainOf(A, step, e)[e.length];
const totalOf = (A, e) => e.reduce((s, x) => A.asum(s, x), A.ZERO);

// ---------------------------------------------------------------- the head families
/** mulberry32, `AS`'s generator. Every step through `>>> 0`: T-FAKE-RANDOM. */
const rng = F.rng, randInt = F.randInt;

function randomPermutation(r, N) {
  const p = Int32Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = randInt(r, i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; }
  return p;
}
const fixedPoints = perm => { let f = 0; for (let i = 0; i < perm.length; i++) if (perm[i] === i) f++; return f; };
const isPermutation = (perm, N) => {
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) { if (perm[i] < 0 || perm[i] >= N || seen[perm[i]]) return false; seen[perm[i]] = 1; }
  return true;
};
/**
 * A random head with EXACTLY ONE fixed point, matching `D`'s `P`. The draw count is
 * returned rather than hidden -- a control silently retried until it agrees is not a
 * control, and here the retry is a stated design choice with a reason.
 */
function drawHead(r, N, wantFixed = 1) {
  for (let draws = 1; draws <= 2000; draws++) {
    const p = randomPermutation(r, N);
    if (fixedPoints(p) === wantFixed) return { perm: p, draws };
  }
  throw new Error('width-audit: no permutation with the wanted fixed-point count in 2,000 draws');
}

/** `D`'s LCG, seed and shuffle, at an arbitrary table size. At size 27 it is `D`'s S27. */
function roundTable(seed, size) {
  let s = seed;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const a = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
/** `D`'s split round widened to w/2-trit halves. Even widths only; null otherwise. */
function splitPerm(A, rounds = 8) {
  const { w, N, val, idx, trits, fromTrits } = A;
  if (w % 2) return null;
  const h = w / 2, M = 3 ** h, S = roundTable(98765, M);
  const half = (v, off) => { const t = trits(v); let s = 0; for (let k = h - 1; k >= 0; k--) s = s * 3 + (t[k + off] + 1); return s; };
  const pack = (L, R) => {
    const t = new Array(w);
    for (let k = 0; k < h; k++) { t[k] = (Math.floor(L / 3 ** k) % 3) - 1; t[k + h] = (Math.floor(R / 3 ** k) % 3) - 1; }
    return fromTrits(t);
  };
  const one = v => pack(half(v, h), (half(v, 0) + S[half(v, h)]) % M);
  return Int32Array.from({ length: N }, (_, i) => { let s = val(i); for (let r = 0; r < rounds; r++) s = one(s); return idx(s); });
}
/** `AN`'s affine map A = rot^2 + I. Singular at width four, where this returns null. */
function affinePerm(A) {
  const { w, N, val, idx, trits, fromTrits } = A;
  const rot2 = v => { const t = trits(v); const k = 2 % w; return fromTrits([...t.slice(k), ...t.slice(0, k)]); };
  const p = Int32Array.from({ length: N }, (_, i) => {
    const x = trits(rot2(val(i))), y = trits(val(i));
    return idx(fromTrits(Array.from({ length: w }, (_, k) => ((x[k] + y[k] + 4) % 3) - 1)));
  });
  return isPermutation(p, N) ? p : null;
}
const identityPerm = N => Int32Array.from({ length: N }, (_, i) => i);

// ---------------------------------------------------------------- the exact nulls
/** E[index of the first repeat] for a uniform random function into N values, exactly. */
function exactBirthday(N) {
  let e = 1, p = 1;
  for (let k = 1; k <= N; k++) { e += p; p *= (1 - k / N); if (p <= 0) break; }
  return e;
}
/** E[min(T, F+1)] for T geometric at rate 1/N over a family of F forgeries. */
const spNull = (N, L = L6) => {
  const Fam = (L * (L - 1) / 2) * (N - 1);
  return N * (1 - Math.pow(1 - 1 / N, Fam + 1));
};
/** `AT`'s counting heuristic for the shortest zero-sum multiset of L+1 generators. */
function countingNull(L, N) {
  const m = L + 1;
  let e = 0;
  for (let k = 0; k < 600; k++) {
    let c = 1;
    for (let i = 1; i <= k; i++) c = c * (m + i) / i;          // C(m+k, k)
    const t = Math.exp(-(c - 1) / N);
    e += t;
    if (t < 1e-12) break;
  }
  return e;
}

// ---------------------------------------------------------------- attack 1: second preimage
/**
 * `AS`'s compensating family, scanned in a FIXED order until the first accept. The
 * arithmetic total is preserved by construction, so only the mixer head has to be hit;
 * a scan that exhausts the family without an accept is scored F + 1 and counted, because
 * `T-EXHAUSTED-NOT-CLOSED` says exhausted and closed are different outcomes.
 */
function spScan(A, step, e) {
  const { N } = A;
  const a = chainOf(A, step, e);
  const L = e.length;
  let tries = 0, ops = 0;
  for (let i = 0; i < L; i++) {
    for (let j = i + 1; j < L; j++) {
      const target = a[j + 1];
      for (let d = 1; d < N; d++) {
        tries++;
        let x = step[a[i] * N + (e[i] + d) % N]; ops++;
        for (let k = i + 1; k < j; k++) { x = step[x * N + e[k]]; ops++; }
        x = step[x * N + (e[j] + N - d) % N]; ops++;
        if (x === target) return { index: tries, ops, found: true };
      }
    }
  }
  return { index: tries + 1, ops, found: false };
}

// ---------------------------------------------------------------- attack 2: collision
/**
 * The forger chooses BOTH ledgers. Fix an arithmetic total c and walk x upward over the
 * length-two ledgers (x, c - x); every row shares one total, so the first repeated mixer
 * head is a collision on BOTH heads. Rows with no repeat are counted, never averaged in
 * -- a scan that ran out is not a scan that finished.
 */
function collisionScan(A, step, wantProfile = false) {
  const { N, ZERO, asub } = A;
  const seen = new Int32Array(N).fill(-1);
  let tot = 0, done = 0, none = 0, r2 = 0;
  const counts = wantProfile ? new Int32Array(N) : null;
  for (let c = 0; c < N; c++) {
    let hit = 0;
    if (counts) counts.fill(0);
    for (let x = 0; x < N; x++) {
      const h = step[step[ZERO * N + x] * N + asub(c, x)];
      if (counts) counts[h]++;
      if (!hit && seen[h] === c) hit = x + 1;
      seen[h] = c;
      if (hit && !counts) break;
    }
    if (hit) { tot += hit; done++; } else none++;
    if (counts) { let s = 0; for (let j = 0; j < N; j++) s += counts[j] * counts[j]; r2 += s / (N * N); }
  }
  return { mean: done ? tot / done : null, rows: N, done, none, r2: wantProfile ? r2 / N : null };
}
/**
 * THE NULL FOR THE SCAN'S ORDER, not for its multiplicities. Each row's own multiset of
 * head values is reshuffled and the first repeat found again, so the difference between
 * this and `collisionScan` is exactly the ORDER x is walked in. Only run where N is small
 * enough that 200 reshuffles a row costs nothing.
 */
function shuffleNull(A, step, shuffles, r) {
  const { N, ZERO, asub } = A;
  const row = new Int32Array(N), seen = new Int32Array(N).fill(-1);
  let tot = 0, done = 0, none = 0, tag = 0;
  for (let c = 0; c < N; c++) {
    for (let x = 0; x < N; x++) row[x] = step[step[ZERO * N + x] * N + asub(c, x)];
    for (let s = 0; s < shuffles; s++) {
      for (let i = N - 1; i > 0; i--) { const j = randInt(r, i + 1); const t = row[i]; row[i] = row[j]; row[j] = t; }
      tag++;
      let hit = 0;
      for (let x = 0; x < N; x++) { if (seen[row[x]] === tag) { hit = x + 1; break; } seen[row[x]] = tag; }
      if (hit) { tot += hit; done++; } else none++;
    }
  }
  return { mean: done ? tot / done : null, done, none };
}

// ---------------------------------------------------------------- attack 3: the join
/**
 * `AS`'s meet in the middle, width-parametric. Entries 1, 2, 5 and 6 move; 3 and 4 do
 * not. The left half is pushed forward, the right half pulled BACKWARDS through `back`,
 * and both are keyed on (accumulator, arithmetic partial sum). 7N^2 ops, N^2 ideal.
 */
function mitm(A, step, back, e) {
  const { N, ZERO, asum, asub } = A;
  let head = ZERO;
  for (const x of e) head = step[head * N + x];
  const S4 = asum(asum(e[0], e[1]), asum(e[4], e[5]));
  const Lc = new Int32Array(N * N), Rc = new Int32Array(N * N);
  const Lr = new Int32Array(N * N).fill(-1), Rr = new Int32Array(N * N).fill(-1);
  let ops = 0;
  for (let x = 0; x < N; x++) {
    const a1 = step[ZERO * N + x];
    for (let y = 0; y < N; y++) {
      const a2 = step[a1 * N + y];
      const a4 = step[step[a2 * N + e[2]] * N + e[3]];
      ops += 4;
      const key = a4 * N + asum(x, y);
      Lc[key]++; if (Lr[key] < 0) Lr[key] = x * N + y;
    }
  }
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const need = back[back[head * N + y] * N + x];
      ops += 2;
      const key = need * N + asub(S4, asum(x, y));
      Rc[key]++; if (Rr[key] < 0) Rr[key] = x * N + y;
    }
  }
  let matches = 0, keysL = 0, keysR = 0, keysBoth = 0;
  for (let k = 0; k < N * N; k++) {
    ops++;
    if (Lc[k]) keysL++;
    if (Rc[k]) keysR++;
    if (Lc[k] && Rc[k]) { keysBoth++; matches += Lc[k] * Rc[k]; }
  }
  return { matches, ideal: N * N, ratio: matches / (N * N), ops, keysL, keysR, keysBoth,
    memory: 4 * N * N, Lc, Rc, Lr, Rr, head, S4 };
}
/** Rebuild one joined forgery, so a match is checked and not trusted -- `D4`. */
function mitmForgery(A, e, m, key) {
  if (!(m.Lc[key] && m.Rc[key])) return null;
  const f = e.slice();
  f[0] = Math.floor(m.Lr[key] / A.N); f[1] = m.Lr[key] % A.N;
  f[4] = Math.floor(m.Rr[key] / A.N); f[5] = m.Rr[key] % A.N;
  return f;
}
/** `AS`'s responsiveness control: a join whose halves are identical must return 2.0. */
function degenerateJoinRatio(counts) {
  let sq = 0, tot = 0;
  for (const c of counts) { sq += c * c; tot += c; }
  return sq / (tot * tot / counts.length);
}

// ---------------------------------------------------------------- attack 4: growth
/** For each accumulator, the entry that leaves it unchanged, and how many there are. */
function noOpTable(A, step) {
  const { N } = A;
  const first = new Int32Array(N).fill(-1), counts = new Int32Array(N);
  for (let a = 0; a < N; a++) {
    for (let x = 0; x < N; x++) if (step[a * N + x] === a) { if (first[a] < 0) first[a] = x; counts[a]++; }
  }
  let min = N, max = 0;
  for (let a = 0; a < N; a++) { if (counts[a] < min) min = counts[a]; if (counts[a] > max) max = counts[a]; }
  return { first, counts, min, max, everyAccumulatorHasExactlyOne: min === 1 && max === 1 };
}
/** `AT`'s BFS on the Cayley graph of Z_N: the shortest zero-sum multiset of `gens`. */
function minInsertions(gens, N) {
  const m = gens.length;
  const dist = new Int32Array(N).fill(-1), queue = new Int32Array(N);
  let head = 0, tail = 0, ops = 0;
  dist[0] = 0; queue[tail++] = 0;
  while (head < tail) {
    const s = queue[head++];
    for (let i = 0; i < m; i++) {
      const t = (s + gens[i]) % N; ops++;
      if (dist[t] < 0) { dist[t] = dist[s] + 1; queue[tail++] = t; }
    }
  }
  let best = Infinity;
  for (let i = 0; i < m; i++) {
    const need = (N - gens[i]) % N;
    if (dist[need] >= 0 && dist[need] + 1 < best) best = dist[need] + 1;
  }
  return { min: best, ops };
}
const orderIn = (v, N) => { let a = v % N, b = N; while (a) { const t = b % a; b = a; a = t; } return N / b; };

// ---------------------------------------------------------------- attack 5: the universal pair
/**
 * `AT`'s object. `a -> STEP[STEP[a][x]][-x]` is a permutation for every x, so counting
 * the x that fix a given accumulator counts the PAIRS of entries that, prepended there,
 * restore both heads at zero operations. At the tritwise identity -- the one accumulator
 * every ledger stands on -- that count is the number of universal forgeries of the head.
 */
function cAt(A, step, a) {
  const { N, negEntry } = A;
  let c = 0; const wit = [];
  for (let x = 0; x < N; x++) if (step[step[a * N + x] * N + negEntry(x)] === a) { c++; wit.push(A.val(x)); }
  return { c, wit };
}
function pairProfile(A, step) {
  const { N, ZERO } = A;
  let total = 0, max = 0, zeroAt = 0;
  for (let a = 0; a < N; a++) {
    const c = cAt(A, step, a).c;
    total += c; if (c > max) max = c; if (!c) zeroAt++;
  }
  return { total, mean: total / N, max, zeroAt, zeroFraction: zeroAt / N, atIdentity: cAt(A, step, ZERO) };
}

// ---------------------------------------------------------------- fitting
/**
 * Least-squares slope and intercept of log y on log x. No library, so it is auditable.
 * Points that are not finite and positive are DROPPED and counted, never fitted through
 * -- a width whose statistic is undefined is a fact about that width, and quietly
 * treating it as zero would put the undefined case into the law.
 */
function logFit(xs, ys) {
  const X = [], Y = [];
  let dropped = 0;
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(ys[i]) && ys[i] > 0 && Number.isFinite(xs[i]) && xs[i] > 0) {
      X.push(Math.log(xs[i])); Y.push(Math.log(ys[i]));
    } else dropped++;
  }
  const n = X.length;
  if (n < 2) return { slope: null, intercept: null, points: n, dropped };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += X[i]; sy += Y[i]; sxx += X[i] * X[i]; sxy += X[i] * Y[i]; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return { slope, intercept: (sy - slope * sx) / n, points: n, dropped };
}
/** Printing helper: an undefined statistic prints as `n/a` rather than crashing a report. */
const fx = (v, d = 4) => (v === null || v === undefined || !Number.isFinite(v) ? 'n/a' : v.toFixed(d));
const stat = arr => {
  let tot = 0, min = Infinity, max = -Infinity;
  for (const v of arr) { tot += v; if (v < min) min = v; if (v > max) max = v; }
  const mean = tot / arr.length;
  let ss = 0; for (const v of arr) ss += (v - mean) ** 2;
  const variance = ss / (arr.length - 1 || 1);
  return { mean, sd: Math.sqrt(variance), variance, min, max, n: arr.length };
};

// ---------------------------------------------------------------- one head, every statistic
const drawLedger = (r, N, L) => Array.from({ length: L }, () => randInt(r, N));

function measureHead(A, perm, opts = {}) {
  const { N } = A;
  const { step, back } = stepTable(A, perm);
  const r = rng(opts.seed >>> 0 || 1);
  const out = { N, width: A.w };

  // second preimage: the first accepted compensating forgery, over drawn ledgers
  const spIdx = [];
  let spExhausted = 0, spOps = 0;
  for (let n = 0; n < (opts.scanLedgers || SCAN_LEDGERS); n++) {
    const e = drawLedger(r, N, L6);
    const s = spScan(A, step, e);
    spIdx.push(s.index); spOps += s.ops;
    if (!s.found) spExhausted++;
  }
  out.sp = { ...stat(spIdx), exhausted: spExhausted, opsPerScan: spOps / spIdx.length };

  // collision
  out.collision = collisionScan(A, step, !!opts.wantProfile);

  // the join, on one drawn ledger
  const je = drawLedger(r, N, L6);
  const m = mitm(A, step, back, je);
  out.join = { matches: m.matches, ideal: m.ideal, ratio: m.ratio, ops: m.ops,
    keysL: m.keysL, keysR: m.keysR, keysBoth: m.keysBoth, memory: m.memory,
    opsPerForgery: m.matches ? m.ops / m.matches : null,
    degenerate: degenerateJoinRatio(m.Lc) };
  // T-INSTRUMENT-FALSE-VERDICT / D4: a yield count cannot tell a working attack from a
  // relabelled broken one. Rebuild joined forgeries and recompute both heads.
  {
    let tried = 0, ok = 0;
    for (let k = 0; k < N * N && tried < 200; k++) {
      if (!(m.Lc[k] && m.Rc[k])) continue;
      const f = mitmForgery(A, je, m, k);
      tried++;
      if (headOf(A, step, f) === m.head && totalOf(A, f) === totalOf(A, je)) ok++;
    }
    out.join.rebuilt = { tried, ok };
  }

  // growth, at both registered lengths
  const noOp = noOpTable(A, step);
  out.noOp = { min: noOp.min, max: noOp.max, ok: noOp.everyAccumulatorHasExactlyOne };
  const growth = L => {
    const mins = [], distinct = [];
    let ops = 0;
    const nl = L === L6 ? (opts.ledgers || LEDGERS) : Math.max(1, Math.round((opts.ledgers || LEDGERS) / 2));
    for (let n = 0; n < nl; n++) {
      const e = drawLedger(r, N, L);
      const a = chainOf(A, step, e);
      const gens = a.map(s => A.gen(noOp.first[s]));
      const mi = minInsertions(gens, N);
      mins.push(mi.min); ops += mi.ops;
      distinct.push(new Set(gens).size);
    }
    return { ...stat(mins), distinctGens: stat(distinct).mean, bfsOps: ops / nl, ledgers: nl };
  };
  out.growth6 = growth(L6);
  out.growth12 = growth(L12);
  // `AT`'s longer universal object: the prepend RUN, whose length is the order of the
  // gap-zero generator. Reported across width, not registered.
  out.prependRun = orderIn(A.gen(noOp.first[A.ZERO]), N);

  // the universal pair
  out.pair = pairProfile(A, step);
  return out;
}

// ---------------------------------------------------------------- the instrument
/**
 * THE ANCHOR. At width six this file's `STEP` must equal `ledger-audit.js`'s cell by
 * cell over all 531,441, the widened split round must equal `D`'s `P` over all 729, and
 * `AS3`'s and `AT`'s headline numbers must come back out of THIS code path. A second
 * implementation that is never compared is just an unchecked claim.
 */
function anchor() {
  const A = arenaOf(6), N = A.N;
  let tadd = 0, tsub = 0;
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
    if (A.TADD[a * N + b] !== Q.idx(Q.tadd(Q.val(a), Q.val(b)))) tadd++;
    if (A.TSUB[a * N + b] !== Q.idx(Q.tsub(Q.val(a), Q.val(b)))) tsub++;
  }
  const P6 = splitPerm(A);
  let permDiff = 0;
  for (let i = 0; i < N; i++) if (P6[i] !== Q.idx(Q.P(Q.val(i)))) permDiff++;
  const { step, back } = stepTable(A, P6);
  let stepDiff = 0;
  for (let i = 0; i < N * N; i++) if (step[i] !== LED.STEP[i]) stepDiff++;
  const ledgerIx = LED.LEDGER.map(v => Q.idx(LED.wrap(v)));
  const m = mitm(A, step, back, ledgerIx);
  const prof = pairProfile(A, step);
  const noOp = noOpTable(A, step);
  const a = chainOf(A, step, ledgerIx);
  const gens = a.map(s => A.gen(noOp.first[s]));
  return {
    taddMismatches: tadd, tsubMismatches: tsub, permMismatches: permDiff,
    stepCells: N * N, stepMismatches: stepDiff,
    headAgrees: headOf(A, step, ledgerIx) === Q.idx(LED.headHash(LED.LEDGER))
      && totalOf(A, ledgerIx) === Q.idx(LED.headSum(LED.LEDGER)),
    as3Matches: m.matches, as3Ratio: m.ratio, as3Ops: m.ops, as3Memory: m.memory,
    atPairCount: prof.atIdentity.c, atWitnesses: prof.atIdentity.wit,
    atProfileTotal: prof.total, atZeroAt: prof.zeroAt,
    atCanonicalMin: minInsertions(gens, N).min,
    atPrependRun: orderIn(A.gen(noOp.first[A.ZERO]), N),
    insertAgrees: INS.orderIn729(393) === orderIn(393, N),
  };
}
/** The BFS control, width-parametric: it must span 1 to N before its verdict is read. */
function bfsControls(N) {
  return {
    zero: minInsertions([0], N).min,                    // 1
    plusMinus: minInsertions([1, N - 1], N).min,        // 2
    third: N >= 9 ? minInsertions([N / 3], N).min : null, // 3
    one: minInsertions([1], N).min,                     // N
  };
}
/** Negation is the one place the two groups coincide, at every width. Checked. */
function negationAgrees(A) {
  const { N, TSUB, ZERO, negEntry, gen } = A;
  for (let x = 0; x < N; x++) {
    if (negEntry(x) !== TSUB[ZERO * N + x]) return false;
    if ((gen(x) + gen(negEntry(x))) % N !== 0) return false;
  }
  return true;
}
/** And addition does NOT coincide -- except at width one, where no carry exists. */
function carryCells(A) {
  const { N, TADD, asum } = A;
  let differ = 0;
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) if (asum(a, b) !== TADD[a * N + b]) differ++;
  return differ;
}

// ---------------------------------------------------------------- the sweep
let CACHE = null;
function measure() {
  if (CACHE) return CACHE;
  const M = { widths: [], anchor: anchor(), heads: HEADS, czeroHeads: CZERO_HEADS,
    ledgers: LEDGERS, scanLedgers: SCAN_LEDGERS, seed: SEED, nulls: {} };
  M.nulls.birthday = WIDTHS.map(w => exactBirthday(3 ** w));
  M.nulls.sp = WIDTHS.map(w => spNull(3 ** w));
  M.nulls.counting6 = WIDTHS.map(w => countingNull(L6, 3 ** w));
  M.nulls.counting12 = WIDTHS.map(w => countingNull(L12, 3 ** w));
  M.nulls.birthdayAtHash27 = exactBirthday(531441);

  for (const w of WIDTHS) {
    const A = arenaOf(w), N = A.N;
    const r = rng((SEED ^ (w * 0x9e3779b9)) >>> 0);
    const rows = [];
    let draws = 0;
    const seen = new Uint8Array(N);
    for (let h = 0; h < HEADS; h++) {
      const d = drawHead(r, N);
      draws += d.draws;
      for (let i = 0; i < N; i++) seen[d.perm[i]] = 1;
      rows.push(measureHead(A, d.perm, { seed: (SEED ^ (w * 7919) ^ (h * 104729)) >>> 0,
        wantProfile: true }));
    }
    let coverage = 0; for (let i = 0; i < N; i++) if (seen[i]) coverage++;

    // c(ZERO) over many more heads, conditioned and unconditioned. O(N) each.
    const cz = { cond: [], uncond: [] };
    const rc = rng((SEED ^ (w * 0x85ebca6b)) >>> 0);
    for (let h = 0; h < CZERO_HEADS; h++) {
      const p = drawHead(rc, N).perm;
      const { step } = stepTable(A, p);
      cz.cond.push(cAt(A, step, A.ZERO).c);
      const q = randomPermutation(rc, N);
      const s2 = stepTable(A, q).step;
      cz.uncond.push(cAt(A, s2, A.ZERO).c);
    }
    // and the pooled per-accumulator profile, over the expensive heads
    const zf = rows.map(x => x.pair.zeroFraction);
    const pm = rows.map(x => x.pair.mean);

    // the controls, at this width
    const ctl = {};
    const sp = splitPerm(A);
    if (sp) {
      ctl.split = { isPermutation: isPermutation(sp, N), fixedPoints: fixedPoints(sp),
        degenerate: fixedPoints(sp) === N };
      if (!ctl.split.degenerate) {
        ctl.split.row = measureHead(A, sp, { seed: (SEED ^ 0x2545f491 ^ w) >>> 0, wantProfile: true });
      }
    }
    const af = affinePerm(A);
    ctl.affine = af ? (() => {
      const { step } = stepTable(A, af);
      return { exists: true, collision: collisionScan(A, step, false), fixedPoints: fixedPoints(af) };
    })() : { exists: false, reason: 'rot^2 + I is singular over GF(3)^' + w };
    {
      const { step } = stepTable(A, identityPerm(N));
      ctl.identity = { collision: collisionScan(A, step, false) };
    }
    ctl.bfs = bfsControls(N);
    ctl.negation = negationAgrees(A);
    ctl.carryCells = carryCells(A);

    // the shuffle null, only where N is small enough to be free
    let shuf = null;
    if (N <= 27) {
      const rs = rng((SEED ^ (w * 0x27d4eb2f)) >>> 0);
      shuf = { perHead: [] };
      // The SAME heads the census used, redrawn from the same seed, so the measured and
      // reshuffled means are two readings of one population rather than two draws.
      const r2 = rng((SEED ^ (w * 0x9e3779b9)) >>> 0);
      for (let h = 0; h < HEADS; h++) {
        const d = drawHead(r2, N);
        const { step } = stepTable(A, d.perm);
        const sn = shuffleNull(A, step, 200, rs);
        const cs = collisionScan(A, step, false);
        shuf.perHead.push({ measured: cs.mean, shuffled: sn.mean, none: cs.none, shufNone: sn.none });
      }
      const ok = shuf.perHead.filter(x => x.measured !== null && x.shuffled !== null);
      shuf.ratio = ok.length
        ? ok.reduce((s, x) => s + x.measured, 0) / ok.reduce((s, x) => s + x.shuffled, 0) : null;
      shuf.measuredMean = ok.length ? stat(ok.map(x => x.measured)).mean : null;
      shuf.shuffledMean = ok.length ? stat(ok.map(x => x.shuffled)).mean : null;
    }

    M.widths.push({
      w, N, heads: HEADS, permDraws: draws, coverage,
      sp: stat(rows.map(x => x.sp.mean)),
      spRatio: stat(rows.map(x => x.sp.mean / spNull(N))),
      spExhausted: rows.reduce((s, x) => s + x.sp.exhausted, 0),
      collision: stat(rows.filter(x => x.collision.mean !== null).map(x => x.collision.mean)),
      collisionRatio: stat(rows.filter(x => x.collision.mean !== null)
        .map(x => x.collision.mean / exactBirthday(N))),
      collisionNoneRows: rows.reduce((s, x) => s + x.collision.none, 0),
      collisionRows: rows.reduce((s, x) => s + x.collision.rows, 0),
      r2: stat(rows.map(x => x.collision.r2)),
      join: stat(rows.map(x => x.join.ratio)),
      joinOpsPerForgery: stat(rows.filter(x => x.join.opsPerForgery !== null).map(x => x.join.opsPerForgery)),
      joinMemory: 4 * N * N,
      joinDegenerate: stat(rows.map(x => x.join.degenerate)),
      joinRebuilt: rows.reduce((s, x) => s + x.join.rebuilt.ok, 0),
      joinRebuiltTried: rows.reduce((s, x) => s + x.join.rebuilt.tried, 0),
      growth6: stat(rows.map(x => x.growth6.mean)),
      growth12: stat(rows.map(x => x.growth12.mean)),
      distinctGens6: stat(rows.map(x => x.growth6.distinctGens)),
      prependRun: stat(rows.map(x => x.prependRun)),
      noOpOk: rows.every(x => x.noOp.ok),
      pairZeroFraction: stat(zf),
      pairMean: stat(pm),
      pairTotal: stat(rows.map(x => x.pair.total)),
      cZeroCond: stat(cz.cond),
      cZeroUncond: stat(cz.uncond),
      cZeroCondAny: cz.cond.filter(v => v > 0).length / cz.cond.length,
      cZeroUncondAny: cz.uncond.filter(v => v > 0).length / cz.uncond.length,
      shuffle: shuf,
      control: ctl,
    });
  }

  // the fits
  const idx = ws => ws.map(w => M.widths.findIndex(x => x.w === w));
  const pick = (ws, f) => idx(ws).map(i => f(M.widths[i]));
  M.fits = {
    sp: logFit(pick([2, 3, 4, 5, 6], x => x.N), pick([2, 3, 4, 5, 6], x => x.sp.mean)),
    collision: logFit(pick([2, 3, 4, 5, 6], x => x.N), pick([2, 3, 4, 5, 6], x => x.collision.mean)),
    growth6: logFit(pick(WIDTHS, x => x.N), pick(WIDTHS, x => x.growth6.mean)),
    growth12: logFit(pick(WIDTHS, x => x.N), pick(WIDTHS, x => x.growth12.mean)),
  };
  M.fits.growthGap = M.fits.growth6.slope - M.fits.growth12.slope;
  CACHE = M;
  return CACHE;
}

/**
 * POST HOC, DECLARED, AND SCORING NOTHING. `AR`'s control was one frozen object where the
 * claim needed a distribution. The two growth slopes are re-fitted at further seeds so a
 * reader can see whether `AU3`(c)'s gap sits inside the seed-to-seed spread.
 */
function slopeSpread(seeds) {
  return seeds.map(s => {
    const g6 = [], g12 = [], ns = [];
    for (const w of WIDTHS) {
      const A = arenaOf(w), N = A.N, r = rng((s ^ (w * 0x9e3779b9)) >>> 0);
      const m6 = [], m12 = [];
      for (let h = 0; h < Math.max(2, Math.round(HEADS / 4)); h++) {
        const d = drawHead(r, N);
        const row = measureHead(A, d.perm, { seed: (s ^ (w * 7919) ^ (h * 104729)) >>> 0,
          ledgers: Math.max(20, Math.round(LEDGERS / 4)), scanLedgers: 1 });
        m6.push(row.growth6.mean); m12.push(row.growth12.mean);
      }
      ns.push(N); g6.push(stat(m6).mean); g12.push(stat(m12).mean);
    }
    const a = logFit(ns, g6).slope, b = logFit(ns, g12).slope;
    return { seed: s, growth6: a, growth12: b, gap: a - b };
  });
}

// ---------------------------------------------------------------- report
function report() {
  const M = measure();
  const A6 = M.anchor;
  log('WIDTH AUDIT -- what does the WIDTH of a ledger head buy a forger, and what does it not?');
  log(line);

  log('\n--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  log('      THE ANCHOR. This file re-implements the chain width-parametrically, so it is a');
  log('      SECOND IMPLEMENTATION and is compared cell by cell rather than trusted.');
  log(`      tritwise add/sub against puzzle-audit, all ${(729 * 729).toLocaleString('en-US')} pairs:`
    + ` ${A6.taddMismatches} / ${A6.tsubMismatches} mismatches`);
  log(`      the widened split round at w=6 against D's P, all 729: ${A6.permMismatches} mismatches`);
  log(`      STEP against ledger-audit's, all ${A6.stepCells.toLocaleString('en-US')} cells:`
    + ` ${A6.stepMismatches} mismatches`);
  log(`      the canonical ledger's two heads reproduce ledger-audit's: ${A6.headAgrees}`);
  log(`      AS3 reproduced through THIS code path: ${A6.as3Matches.toLocaleString('en-US')} matches,`
    + ` ratio ${A6.as3Ratio.toFixed(4)}, ${A6.as3Ops.toLocaleString('en-US')} ops   (AS published 532,485 / 1.0020)`);
  log(`      AT reproduced: c(ZERO) = ${A6.atPairCount}, witnesses ${A6.atWitnesses.join(', ')},`
    + ` profile total ${A6.atProfileTotal}, ${A6.atZeroAt} accumulators admit none`);
  log(`      AT's canonical shortest insertion run: ${A6.atCanonicalMin}, prepend run ${A6.atPrependRun}`
    + `   (AT published 4 and 243)`);

  log('\n      THE EXACT NULLS, computed before the registration commit');
  log('       w      N     birthday   second-preimage   counting L=6   counting L=12');
  for (let i = 0; i < WIDTHS.length; i++) {
    log(`      ${String(WIDTHS[i]).padStart(2)}  ${String(3 ** WIDTHS[i]).padStart(5)}`
      + `   ${M.nulls.birthday[i].toFixed(4).padStart(9)}   ${M.nulls.sp[i].toFixed(3).padStart(15)}`
      + `   ${M.nulls.counting6[i].toFixed(4).padStart(12)}   ${M.nulls.counting12[i].toFixed(4).padStart(13)}`);
  }
  log(`      and the same birthday routine at 531,441 digests returns`
    + ` ${M.nulls.birthdayAtHash27.toFixed(4)} -- ladderlang's HASH27.md registered against 914.3328`);

  log('\n      THE CONTROLS, asserted to MOVE before any verdict is read');
  for (const row of M.widths) {
    const c = row.control;
    const aff = c.affine.exists
      ? `collision-free rows ${c.affine.collision.none}/${c.affine.collision.rows}`
      : 'NOT A PERMUTATION (rot^2 + I singular)';
    log(`      w=${row.w}  affine: ${aff}`);
    log(`            identity head: mean first repeat ${c.identity.collision.mean}`
      + `   BFS spans {0}->${c.bfs.zero} {1,-1}->${c.bfs.plusMinus}`
      + `${c.bfs.third !== null ? ` {N/3}->${c.bfs.third}` : ''} {1}->${c.bfs.one}`);
    log(`            negation coincides in both groups: ${c.negation};`
      + ` arithmetic and tritwise add differ on ${c.carryCells.toLocaleString('en-US')} of`
      + ` ${(row.N * row.N).toLocaleString('en-US')} pairs`);
    if (c.split) {
      log(`            the widened split round: permutation ${c.split.isPermutation},`
        + ` ${c.split.fixedPoints} fixed point(s)`
        + `${c.split.degenerate ? '  -- DEGENERATE, it is the identity' : ''}`);
    }
    log(`            ${row.permDraws} draws for ${row.heads} heads with one fixed point;`
      + ` the draw covered ${row.coverage} of ${row.N} states`);
    log(`            the join's degenerate control returns ${fx(row.joinDegenerate.mean)}`
      + ` and ${row.joinRebuilt} of ${row.joinRebuiltTried} rebuilt forgeries verify`);
  }

  log('\n--- AU1  the ops currency: the second preimage, and the join ---');
  log('       w      N   first-accept index   null     ratio [min, max]   exhausted');
  for (const row of M.widths) {
    log(`      ${String(row.w).padStart(2)}  ${String(row.N).padStart(5)}`
      + `   ${row.sp.mean.toFixed(3).padStart(17)}   ${spNull(row.N).toFixed(3).padStart(7)}`
      + `   ${row.spRatio.mean.toFixed(4)} [${row.spRatio.min.toFixed(4)}, ${row.spRatio.max.toFixed(4)}]`
      + `   ${row.spExhausted}`);
  }
  log('\n       w      N   join yield ratio   [min, max]         ops/forgery   memory slots');
  for (const row of M.widths) {
    log(`      ${String(row.w).padStart(2)}  ${String(row.N).padStart(5)}`
      + `   ${row.join.mean.toFixed(4).padStart(16)}   [${row.join.min.toFixed(4)}, ${row.join.max.toFixed(4)}]`
      + `   ${fx(row.joinOpsPerForgery.mean, 3).padStart(11)}   ${row.joinMemory.toLocaleString('en-US').padStart(12)}`);
  }
  for (const row of M.widths) {
    const s = row.control.split;
    if (s && s.row) {
      log(`      the split-round head at w=${row.w}: sp ratio ${fx(s.row.sp.mean / spNull(row.N))}`
        + ` (random family [${fx(row.spRatio.min)}, ${fx(row.spRatio.max)}]),`
        + ` join ${fx(s.row.join.ratio)}`
        + ` (random family [${fx(row.join.min)}, ${fx(row.join.max)}]),`
        + ` collision ${fx(s.row.collision.mean, 3)} against a null ${fx(exactBirthday(row.N))}`
        + ` and c(ZERO) ${s.row.pair.atIdentity.c}`);
    }
  }

  log('\n--- AU2  the collision law, and where it has a floor ---');
  log('       w      N   first-repeat index   exact null   ratio [min, max]   collision-free rows');
  for (const row of M.widths) {
    const mean = fx(row.collision.mean, 3);
    log(`      ${String(row.w).padStart(2)}  ${String(row.N).padStart(5)}`
      + `   ${String(mean).padStart(17)}   ${exactBirthday(row.N).toFixed(4).padStart(10)}`
      + `   ${row.collisionRatio.n ? `${fx(row.collisionRatio.mean)} [${fx(row.collisionRatio.min)}, ${fx(row.collisionRatio.max)}]` : 'n/a'}`
      + `   ${row.collisionNoneRows} of ${row.collisionRows.toLocaleString('en-US')}`);
  }
  log(`      slope of log(first-repeat) against log N over widths 2..6:`
    + ` ${fx(M.fits.collision.slope)}   (${M.fits.collision.points} points, ${M.fits.collision.dropped} dropped)`);
  log(`      slope of log(first-accept)  against log N over widths 2..6:`
    + ` ${fx(M.fits.sp.slope)}   (${M.fits.sp.points} points, ${M.fits.sp.dropped} dropped)`);
  log('\n      the ORDER null: each row\'s own multiset reshuffled 200 times, so the only');
  log('      difference from the measurement is the order x is walked in');
  for (const row of M.widths) {
    if (!row.shuffle) continue;
    log(`      w=${row.w}  measured ${fx(row.shuffle.measuredMean)}`
      + `   reshuffled ${fx(row.shuffle.shuffledMean)}   ratio ${fx(row.shuffle.ratio)}`
      + `   (rows with no repeat: measured ${row.shuffle.perHead.reduce((s, x) => s + x.none, 0)},`
      + ` reshuffled ${row.shuffle.perHead.reduce((s, x) => s + x.shufNone, 0)})`);
  }

  log('\n--- AU3  the growth currency: length beats width ---');
  log('       w      N   min insertions L=6   null    L=12    null    distinct gens of 7');
  for (const row of M.widths) {
    const i = WIDTHS.indexOf(row.w);
    log(`      ${String(row.w).padStart(2)}  ${String(row.N).padStart(5)}`
      + `   ${row.growth6.mean.toFixed(4).padStart(17)}   ${M.nulls.counting6[i].toFixed(4)}`
      + `   ${row.growth12.mean.toFixed(4).padStart(6)}  ${M.nulls.counting12[i].toFixed(4)}`
      + `   ${row.distinctGens6.mean.toFixed(3).padStart(8)}`);
  }
  log(`      slope of log(minimum) against log N, L=6:  ${fx(M.fits.growth6.slope)}`);
  log(`      slope of log(minimum) against log N, L=12: ${fx(M.fits.growth12.slope)}`);
  log(`      the gap: ${fx(M.fits.growthGap)}`);
  log(`      and AT's longer object, the universal prepend RUN, by width:`
    + ` ${M.widths.map(r => `${r.w}:${r.prependRun.mean.toFixed(1)}`).join('  ')}`);

  log('\n--- AU4  the zero-operation forgery, across width ---');
  log('       w      N   heads with a pair   mean c(ZERO)   accumulators with none   unconditioned');
  for (const row of M.widths) {
    log(`      ${String(row.w).padStart(2)}  ${String(row.N).padStart(5)}`
      + `   ${row.cZeroCondAny.toFixed(4).padStart(17)}   ${row.cZeroCond.mean.toFixed(4).padStart(12)}`
      + `   ${row.pairZeroFraction.mean.toFixed(5).padStart(21)}`
      + `   ${row.cZeroUncondAny.toFixed(4)} / ${row.cZeroUncond.mean.toFixed(4)}`);
  }
  log(`      the Poisson closed form is 0.63212 and 0.36788; AT's own head reads`
    + ` ${(A6.atZeroAt / 729).toFixed(5)} on the second`);

  log('\n--- NOT REGISTERED: what a forger pays, in both currencies, across width ---');
  log('      attack                              ops                growth   memory');
  for (const row of M.widths) {
    log(`      w=${row.w}  second preimage, scanned    ${row.sp.mean.toFixed(1).padStart(10)}`
      + `        ${String(0).padStart(6)}   ${String(1).padStart(9)}`);
  }
  log(`      the join, per forgery, at every width: ~7 ops and ${'4N^2'} slots -- 36 at width one`
    + ` and 2,125,764 at width six`);
  log('      the universal pair: 0 ops, +2 entries, no knowledge, wherever it exists');
  log('      CITED, never re-run: AS 4,414 ops brute force and 6.99 for the join at width six');
  log('      (F-MITM-PRICES-THE-MIXER-AT-SEVEN-OPS); AT 4.934 entries for the shortest run.');

  log('\n--- WHAT THIS SET DID NOT ATTACK, named rather than left as silence ---');
  log('      A WIDE-ENTRY, NARROW-HEAD family. Everything here narrows the entries, the');
  log('      arithmetic total and the mixer head together, so nothing here is a measurement');
  log('      of a COMPRESSING head, which is what a real digest is.');
  log('      Heads conditioned on exactly one fixed point; the unconditioned family is run');
  log('      only for c(ZERO). Ledger lengths six and twelve. One join split. And no');
  log('      multi-round differential across width -- AS2 read one table at one width.');
  log('\n' + line);
  return M;
}

if (MAIN) report();

module.exports = {
  WIDTHS, HEADS, CZERO_HEADS, LEDGERS, SCAN_LEDGERS, SEED, L6, L12,
  arena, arenaOf, stepTable, chainOf, headOf, totalOf,
  rng, randInt, randomPermutation, fixedPoints, isPermutation, drawHead,
  roundTable, splitPerm, affinePerm, identityPerm,
  exactBirthday, spNull, countingNull,
  spScan, collisionScan, shuffleNull, mitm, mitmForgery, degenerateJoinRatio,
  noOpTable, minInsertions, orderIn, cAt, pairProfile,
  logFit, stat, drawLedger, measureHead, anchor, bfsControls, negationAgrees, carryCells,
  slopeSpread, measure, report,
};
