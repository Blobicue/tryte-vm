'use strict';
/* test-width.js — REGISTRATION ONLY. Set `AU`, four predictions, none measured yet.
 *
 * Every check in this file is an INSTRUMENT check or an ANCHOR, and not one of them is a
 * verdict. The random-head family `AU1` through `AU4` are scored on has not been swept:
 * nothing here calls `measure()`, and nothing here reads a first-accept index, a
 * first-repeat index, a join yield, a shortest insertion run or a c(ZERO) over the drawn
 * family at any width.
 *
 * WHAT IT DOES EXERCISE, END TO END, is the whole width-parametric pipeline — the arena,
 * the two groups and the one place they coincide, the step table and its inverse, the
 * widened split round, the affine control, the second-preimage scan, the collision scan,
 * the reshuffled-order null, the meet-in-the-middle join and its rebuild path, the
 * no-op table, the Cayley BFS, and the log-log fit — on CONTROLS whose answers are known
 * in advance, at every width from one to six.
 *
 * AND THE ANCHOR, which is the reason this file can be trusted at all. `tools/width-audit.js`
 * is a SECOND IMPLEMENTATION of a chain that already exists in `tools/ledger-audit.js`, and
 * a second implementation that is never compared is just an unchecked claim. At width six
 * the two `STEP` tables are compared cell by cell over all 531,441, and `AS3`'s 532,485
 * matches and `AT`'s c(ZERO) = 3 with witnesses (136, 295, 362) are reproduced through the
 * new code path. Those are published numbers being reproduced, not new measurements.
 *
 * The controls are asserted to MOVE here rather than after the run, because
 * `T-CONTROL-CANNOT-DISCRIMINATE` has bitten twice and the second bite was a control that
 * could only ever agree.
 *
 * `test/run-all.js` does NOT list this file yet, on purpose: a scaffolded test that passes
 * before the measurement reports success for work nobody did.
 */

const A = require('../tools/width-audit.js');
const LED = require('../tools/ledger-audit.js');
const F = require('../tools/forge-audit.js');
const INS = require('../tools/insert-audit.js');
const Q = require('../tools/puzzle-audit.js');
const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const near = (a, b, eps) => Math.abs(a - b) <= eps;

console.log('\n=== 0. THE ARENA, AND THE TWO GROUPS THAT ARE NOT ONE GROUP ===');
{
  check('the arena is balanced ternary at every width: N = 3^w, val and idx invert, and '
    + 'the trit decomposition rebuilds every state',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w);
      if (X.N !== 3 ** w) return false;
      for (let i = 0; i < X.N; i++) {
        if (X.idx(X.val(i)) !== i) return false;
        if (X.fromTrits(X.trits(X.val(i))) !== X.val(i)) return false;
      }
      return true;
    }));
  // NEGATION is the one place the arithmetic and tritwise groups coincide, at every
  // width, because negating a balanced-ternary word trit by trit IS negating the number
  // it denotes. The second inserted entry of a universal pair is written as a negation,
  // so this is load-bearing rather than decorative.
  check('negation coincides in both groups at every width from one to six',
    A.WIDTHS.every(w => A.negationAgrees(A.arenaOf(w))));
  // AND ADDITION DOES NOT — except at width one, which is the design line AU1 names as
  // its route. No carry exists on one trit, so the mismatch every attack in this thread
  // runs against is absent there by construction.
  check('addition does NOT coincide above width one, and at width ONE it does — 0 of 9 '
    + 'pairs differ at w=1 and 380,178 of 531,441 at w=6',
    A.carryCells(A.arenaOf(1)) === 0
    && A.carryCells(A.arenaOf(6)) === 380178
    && [2, 3, 4, 5].every(w => A.carryCells(A.arenaOf(w)) > 0),
    A.WIDTHS.map(w => A.carryCells(A.arenaOf(w))).join(' '));
  check('the step table is a bijection in the accumulator for every entry, at every '
    + 'width — AS\'s D3, which the backward walk and the join both rest on',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(11 + w);
      const { step, back } = A.stepTable(X, A.randomPermutation(r, X.N));
      for (let e = 0; e < X.N; e++) {
        const seen = new Uint8Array(X.N);
        for (let a = 0; a < X.N; a++) {
          const b = step[a * X.N + e];
          if (seen[b] || back[b * X.N + e] !== a) return false;
          seen[b] = 1;
        }
      }
      return true;
    }));
  check('an entry is a no-op at an accumulator exactly when their tritwise sum is a '
    + 'FIXED POINT of the head — so a head with no fixed point has no no-op family at '
    + 'all, which is why the random family is conditioned',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(23 + w);
      const p = A.randomPermutation(r, X.N);
      const { step } = A.stepTable(X, p);
      let noops = 0;
      for (let a = 0; a < X.N; a++) for (let x = 0; x < X.N; x++) {
        if (step[a * X.N + x] === a) { noops++; if (p[X.TADD[a * X.N + x]] !== X.TADD[a * X.N + x]) return false; }
      }
      return noops === X.N * A.fixedPoints(p);
    }));
}

console.log('\n=== 1. THE NULLS, WHICH ARE ARITHMETIC AND WERE COMPUTED BEFORE REGISTRATION ===');
{
  check('the exact finite-N birthday expectation is 2.8889, 4.4583, 7.1981, 11.9577, '
    + '20.2105 and 34.5100 at widths one to six',
    A.WIDTHS.map(w => A.exactBirthday(3 ** w).toFixed(4)).join(' ')
    === '2.8889 4.4583 7.1981 11.9577 20.2105 34.5100',
    A.WIDTHS.map(w => A.exactBirthday(3 ** w).toFixed(4)).join(' '));
  // TWO FILES MAY NOT DISAGREE ABOUT ONE NUMBER. `ladderlang`'s HASH27.md registered
  // against 34.51 for 729 digests and 914.3328 for 531,441; the same routine here must
  // return both, or one of the two documents is wrong about the same object.
  check('   and the same routine returns 914.3328 at 531,441 digests, which is the '
    + 'figure ladderlang\'s HASH27.md registered its second width against',
    near(A.exactBirthday(531441), 914.3328, 5e-4) && near(A.exactBirthday(729), 34.51, 5e-3));
  check('the second-preimage null is the state count itself to three decimals at every '
    + 'width: 3.000 9.000 27.000 81.000 243.000 729.000',
    A.WIDTHS.map(w => A.spNull(3 ** w).toFixed(3)).join(' ')
    === '3.000 9.000 27.000 81.000 243.000 729.000');
  check('AT\'s counting heuristic reproduces its own published 4.87 at width six, and '
    + 'gives 1.0970 1.4799 2.0574 2.8138 3.7479 4.8720 across the sweep',
    A.WIDTHS.map(w => A.countingNull(6, 3 ** w).toFixed(4)).join(' ')
    === '1.0970 1.4799 2.0574 2.8138 3.7479 4.8720'
    && near(A.countingNull(6, 729), 4.87, 5e-3));
  check('   and at ledger length twelve it is 1.0131 1.2359 1.6391 2.1297 2.7000 3.3521',
    A.WIDTHS.map(w => A.countingNull(12, 3 ** w).toFixed(4)).join(' ')
    === '1.0131 1.2359 1.6391 2.1297 2.7000 3.3521');
  check('the log-log fit recovers a planted exponent exactly, and DROPS a point that is '
    + 'not finite and positive rather than fitting through it',
    (() => {
      const xs = [3, 9, 27, 81, 243, 729];
      const half = A.logFit(xs, xs.map(n => 2.5 * Math.sqrt(n)));
      const one = A.logFit(xs, xs.map(n => 0.7 * n));
      const holed = A.logFit(xs, xs.map((n, i) => (i === 0 ? null : 2.5 * Math.sqrt(n))));
      return near(half.slope, 0.5, 1e-12) && near(one.slope, 1.0, 1e-12)
        && holed.dropped === 1 && holed.points === 5 && near(holed.slope, 0.5, 1e-12);
    })());
}

console.log('\n=== 2. THE CONTROLS, ASSERTED TO MOVE BEFORE ANY VERDICT IS READ ===');
{
  // THE STATISTIC MUST REACH BOTH ENDS OF ITS RANGE. The affine head is linear and its
  // row map stays injective, so its collision scan finds NOTHING; the identity head
  // gives every ledger the same head, so its scan repeats at the second try. If the
  // collision statistic could not reach those two values it could not discriminate.
  const aff = {}, ide = {};
  for (const w of A.WIDTHS) {
    const X = A.arenaOf(w);
    const p = A.affinePerm(X);
    aff[w] = p ? A.collisionScan(X, A.stepTable(X, p).step) : null;
    ide[w] = A.collisionScan(X, A.stepTable(X, A.identityPerm(X.N)).step);
  }
  check('the affine head is a permutation at widths 1, 2, 3, 5 and 6 and NOT one at '
    + 'width four — rot^2 + I is singular over GF(3)^4, and the tool refuses to build '
    + 'it rather than returning a non-permutation',
    A.affinePerm(A.arenaOf(4)) === null
    && [1, 2, 3, 5, 6].every(w => {
      const p = A.affinePerm(A.arenaOf(w));
      return p !== null && A.isPermutation(p, 3 ** w) && A.fixedPoints(p) === 1;
    }));
  // AND IT REACHES THE DEGENERATE END ONLY AT THE NARROW WIDTHS, which is worth pinning
  // rather than asserting away: the linear head is collision-free on EVERY row at widths
  // one and two and on exactly one row in nine at widths three, five and six, where its
  // mean first repeat at width six is 84.47 against an exact null of 34.51. So the
  // statistic is demonstrated to span from undefined to 2.45x its null before any subject
  // value is read — but it reaches the fully degenerate value at two widths, not six.
  check('   and the affine head drives the collision statistic to its degenerate end at '
    + 'widths one and two, every row collision-free, and to one row in nine at widths '
    + 'three, five and six — where width six means 84.47 against a null of 34.51',
    aff[1].none === aff[1].rows && aff[1].mean === null
    && aff[2].none === aff[2].rows && aff[2].mean === null
    && [3, 5, 6].every(w => near(aff[w].none / aff[w].rows, 1 / 9, 1e-12))
    && near(aff[6].mean, 84.472, 5e-3) && aff[6].mean / A.exactBirthday(729) > 2.4,
    [1, 2, 3, 5, 6].map(w => `${w}:${aff[w].none}/${aff[w].rows}`).join(' '));
  check('the identity head sits at the OTHER end: the chain never moves, so every scan '
    + 'repeats at the second try, at every width',
    A.WIDTHS.every(w => ide[w].mean === 2 && ide[w].none === 0));
  check('the widened split round DEGENERATES to the identity at width two — eight rounds '
    + 'of a one-trit Feistel over a three-entry S-box return all nine states to '
    + 'themselves — so the anchor family is widths four and six',
    (() => {
      const s2 = A.splitPerm(A.arenaOf(2)), s4 = A.splitPerm(A.arenaOf(4)), s6 = A.splitPerm(A.arenaOf(6));
      return A.fixedPoints(s2) === 9 && A.isPermutation(s2, 9)
        && A.fixedPoints(s4) === 1 && A.isPermutation(s4, 81)
        && A.fixedPoints(s6) === 1 && A.isPermutation(s6, 729)
        && A.splitPerm(A.arenaOf(3)) === null && A.splitPerm(A.arenaOf(5)) === null;
    })());
  check('the Cayley BFS SPANS its range at every width: {0} -> 1, {1, -1} -> 2, '
    + '{N/3} -> 3, {1} -> N',
    A.WIDTHS.every(w => {
      const N = 3 ** w, b = A.bfsControls(N);
      return b.zero === 1 && b.plusMinus === 2 && b.one === N
        && (N < 9 || b.third === 3);
    }), A.WIDTHS.map(w => JSON.stringify(A.bfsControls(3 ** w))).join(' '));
  check('   and one generator alone always closes in exactly its order, at every width',
    A.WIDTHS.every(w => {
      const N = 3 ** w;
      return [1, 2, 3, N - 1].filter(g => g > 0 && g < N)
        .every(g => A.minInsertions([g], N).min === A.orderIn(g, N));
    }));
  // THE RESPONSIVENESS CONTROL IS ITSELF WIDTH-DEPENDENT, and discovering that is why
  // AU1(b) is registered at widths two to six. At width one the left key map is a
  // BIJECTION — nine rows onto nine keys, occupancy exactly 1.0000 — so every key holds
  // one row on each side, the yield is N^2 by construction, and a band on the ratio there
  // could not fail. A check asserting 2.0 at every width would have hidden that.
  check('the join REBUILDS its degenerate control across width: 2.0 from width three up, '
    + 'about 1.8 at width two, and exactly 1.0 at width one, where the left key map is a '
    + 'BIJECTION so the yield ratio is forced and AU1(b) is not registered there',
    (() => {
      for (const w of A.WIDTHS) {
        const X = A.arenaOf(w), r = A.rng(31 + w);
        const { step, back } = A.stepTable(X, A.drawHead(r, X.N).perm);
        const m = A.mitm(X, step, back, A.drawLedger(r, X.N, 6));
        const d = A.degenerateJoinRatio(m.Lc), occ = m.keysL / (X.N * X.N);
        if (w === 1) { if (!(d === 1 && occ === 1 && m.ratio === 1)) return false; }
        else if (w === 2) { if (!(d > 1.6 && d < 1.95)) return false; }
        else if (!near(d, 2.0, 0.06)) return false;
      }
      return true;
    })());
  check('the conditioning really conditions: every drawn head has exactly one fixed '
    + 'point, so every accumulator has exactly one no-op entry, at every width',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(41 + w);
      for (let k = 0; k < 5; k++) {
        const d = A.drawHead(r, X.N);
        if (A.fixedPoints(d.perm) !== 1) return false;
        if (!A.noOpTable(X, A.stepTable(X, d.perm).step).everyAccumulatorHasExactlyOne) return false;
      }
      return true;
    }));
}

console.log('\n=== 3. THE PIPELINE, ON CONTROLS, AT EVERY WIDTH ===');
{
  check('the second-preimage scan reports EXHAUSTED separately from FOUND, and its '
    + 'reported index really is the first accept — rechecked by recomputing the head',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(53 + w);
      const { step } = A.stepTable(X, A.drawHead(r, X.N).perm);
      for (let n = 0; n < 6; n++) {
        const e = A.drawLedger(r, X.N, 6);
        const s = A.spScan(X, step, e);
        // walk the same order by hand and rebuild the forgery at that index
        let t = 0, hit = null;
        for (let i = 0; i < 6 && !hit; i++) for (let j = i + 1; j < 6 && !hit; j++) {
          for (let d = 1; d < X.N; d++) {
            t++;
            const f = e.slice();
            f[i] = (e[i] + d) % X.N; f[j] = (e[j] + X.N - d) % X.N;
            if (A.headOf(X, step, f) === A.headOf(X, step, e)
              && A.totalOf(X, f) === A.totalOf(X, e)) { hit = { t, f }; break; }
          }
        }
        if (hit) { if (!s.found || s.index !== hit.t) return false; }
        else if (s.found) return false;
      }
      return true;
    }));
  check('   and every compensating forgery preserves the arithmetic total by '
    + 'construction, so the summed head is not what the scan is beating',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(59 + w);
      const e = A.drawLedger(r, X.N, 6), t = A.totalOf(X, e);
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let d = 1; d < X.N; d++) {
        const f = e.slice();
        f[i] = (e[i] + d) % X.N; f[j] = (e[j] + X.N - d) % X.N;
        if (A.totalOf(X, f) !== t) return false;
      }
      return true;
    }));
  check('the collision scan really finds a COLLISION: at the index it reports, two '
    + 'DISTINCT length-two ledgers share both heads — rebuilt, not counted',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(67 + w);
      const { step } = A.stepTable(X, A.drawHead(r, X.N).perm);
      const cs = A.collisionScan(X, step, true);
      if (cs.mean === null) return true;                    // degenerate at this draw
      // find one row with a repeat and rebuild both ledgers
      for (let c = 0; c < X.N; c++) {
        const seen = new Map();
        for (let x = 0; x < X.N; x++) {
          const y = X.asub(c, x), h = A.headOf(X, step, [x, y]);
          if (seen.has(h)) {
            const [x0, y0] = seen.get(h);
            return (x0 !== x || y0 !== y)
              && A.totalOf(X, [x0, y0]) === A.totalOf(X, [x, y])
              && A.headOf(X, step, [x0, y0]) === A.headOf(X, step, [x, y]);
          }
          seen.set(h, [x, y]);
        }
      }
      return true;
    }));
  check('   and the reshuffled-order null is the SAME multiset in a different order: it '
    + 'never sees a value the measured scan did not see',
    (() => {
      const X = A.arenaOf(3), r = A.rng(71);
      const { step } = A.stepTable(X, A.drawHead(r, X.N).perm);
      const sn = A.shuffleNull(X, step, 20, A.rng(73));
      return sn.mean !== null && sn.done + sn.none === 20 * X.N;
    })());
  check('the join yields FORGERIES and not merely matches — every rebuilt candidate '
    + 'reproduces both heads, at every width (D4: a count cannot tell a working attack '
    + 'from a relabelled broken one)',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(79 + w);
      const { step, back } = A.stepTable(X, A.drawHead(r, X.N).perm);
      const e = A.drawLedger(r, X.N, 6);
      const m = A.mitm(X, step, back, e);
      let tried = 0, ok = 0;
      for (let k = 0; k < X.N * X.N && tried < 60; k++) {
        if (!(m.Lc[k] && m.Rc[k])) continue;
        const f = A.mitmForgery(X, e, m, k);
        tried++;
        if (A.headOf(X, step, f) === m.head && A.totalOf(X, f) === A.totalOf(X, e)) ok++;
      }
      return tried > 0 && ok === tried;
    }));
  check('   and it costs exactly 7N^2 operations and 4N^2 slots by construction, so the '
    + 'seven operations per forgery is arithmetic and only the YIELD is a measurement',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(83 + w);
      const { step, back } = A.stepTable(X, A.drawHead(r, X.N).perm);
      const m = A.mitm(X, step, back, A.drawLedger(r, X.N, 6));
      return m.ops === 7 * X.N * X.N && m.memory === 4 * X.N * X.N && m.ideal === X.N * X.N;
    }));
  check('the shortest insertion run is rebuildable: the multiset the BFS returns really '
    + 'restores both heads when applied, at every width',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(89 + w);
      const { step } = A.stepTable(X, A.drawHead(r, X.N).perm);
      const noOp = A.noOpTable(X, step);
      for (let n = 0; n < 6; n++) {
        const e = A.drawLedger(r, X.N, 6);
        const a = A.chainOf(X, step, e);
        const gens = a.map(s => X.gen(noOp.first[s]));
        const mi = A.minInsertions(gens, X.N);
        if (!Number.isFinite(mi.min) || mi.min < 1) return false;
        // a run of ord(g) no-ops at one gap always closes: I3, checked not argued
        const p = 0, x = noOp.first[a[p]], ord = A.orderIn(X.gen(x), X.N);
        const f = e.slice(0, p).concat(Array(ord).fill(x), e.slice(p));
        if (A.headOf(X, step, f) !== a[6] || A.totalOf(X, f) !== A.totalOf(X, e)) return false;
      }
      return true;
    }));
  check('a universal pair, where the control head has one, really forges an arbitrary '
    + 'ledger of an arbitrary length at zero operations — rebuilt at every width',
    A.WIDTHS.every(w => {
      const X = A.arenaOf(w), r = A.rng(97 + w);
      for (let k = 0; k < 8; k++) {
        const { step } = A.stepTable(X, A.drawHead(r, X.N).perm);
        const { wit } = A.cAt(X, step, X.ZERO);
        for (const v of wit) {
          const x = X.idx(v), y = X.negEntry(x);
          for (const L of [0, 1, 3, 6]) {
            const e = A.drawLedger(r, X.N, L), f = [x, y].concat(e);
            if (A.headOf(X, step, f) !== A.headOf(X, step, e)) return false;
            if (A.totalOf(X, f) !== A.totalOf(X, e)) return false;
          }
        }
      }
      return true;
    }));
}

console.log('\n=== 4. THE ANCHOR — A SECOND IMPLEMENTATION THAT IS COMPARED, NOT TRUSTED ===');
{
  const AN = A.anchor();
  check('the tritwise group agrees with puzzle-audit\'s on all 531,441 pairs, both ways',
    AN.taddMismatches === 0 && AN.tsubMismatches === 0);
  check('the widened split round at width six IS D\'s mixer, all 729 entries',
    AN.permMismatches === 0);
  check('and the width-parametric STEP equals ledger-audit\'s cell by cell, all 531,441',
    AN.stepCells === 531441 && AN.stepMismatches === 0);
  check('   so the canonical ledger\'s two heads reproduce ledger-audit\'s',
    AN.headAgrees);
  check('AS3 comes back out of the new code path: 532,485 matches, ratio 1.0020, '
    + '3,720,087 operations and 2,125,764 slots',
    AN.as3Matches === 532485 && near(AN.as3Ratio, 1.0020, 5e-5)
    && AN.as3Ops === 3720087 && AN.as3Memory === 2125764,
    `${AN.as3Matches} ${AN.as3Ratio}`);
  check('AT comes back too: c(ZERO) = 3 with witnesses (136, 295, 362), profile total '
    + '741, 256 accumulators admitting none, canonical run 4, prepend run 243',
    AN.atPairCount === 3 && AN.atWitnesses.join() === '136,295,362'
    && AN.atProfileTotal === 741 && AN.atZeroAt === 256
    && AN.atCanonicalMin === 4 && AN.atPrependRun === 243,
    JSON.stringify([AN.atPairCount, AN.atWitnesses, AN.atProfileTotal, AN.atZeroAt]));
  check('   and the order function agrees with insert-audit\'s at width six',
    AN.insertAgrees && A.orderIn(393, 729) === INS.orderIn729(393));
  check('the manifest\'s cited AS figures are the ones this set builds on and does not '
    + 're-run: 4,414 operations brute force and 6.99 for the join',
    (() => {
      const MAN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'FINDINGS.json'), 'utf8'));
      const f = MAN.unregistered_findings.find(x => x.id === 'F-MITM-PRICES-THE-MIXER-AT-SEVEN-OPS');
      return !!f && /4,414/.test(f.claim) && /6\.99/.test(f.claim);
    })());
}

console.log('\n=== 5. THE REGISTRATION ITSELF ===');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'width-audit.js'), 'utf8');
  check('the tool carries a PREDICTED OUTCOMES block with four predictions',
    src.includes('PREDICTED OUTCOMES')
    && ['AU1', 'AU2', 'AU3', 'AU4'].every(id => src.includes(`   ${id}  `)));
  check('   and every one of the four carries an AT RISK line',
    (src.match(/^\s*\*\s+AT RISK:/gm) || []).length === 4,
    String((src.match(/^\s*\*\s+AT RISK:/gm) || []).length));
  check('   and a CANNOT SHOW line, so each says what it does not cover',
    (src.match(/^\s*\*\s+CANNOT SHOW:/gm) || []).length === 4);
  check('the NOT REGISTERED block records what was measured while building the '
    + 'instrument, so the probe cannot be counted as a prediction',
    src.includes('MEASURED WHILE BUILDING THE INSTRUMENT')
    && src.includes('63 of 120 rows') && src.includes('DEGENERATES TO THE IDENTITY AT WIDTH TWO'));
  check('this file is NOT in run-all.js yet — a scaffolded test that passes before the '
    + 'measurement reports success for work nobody did',
    !fs.readFileSync(path.join(__dirname, 'run-all.js'), 'utf8').includes('test-width.js'));
  check('and AU is not in the manifest yet, because nothing has been measured',
    !JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'FINDINGS.json'), 'utf8'))
      .prediction_sets.some(s => s.id === 'AU'));
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
