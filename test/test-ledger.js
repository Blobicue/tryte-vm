'use strict';
/* test-ledger.js — detection is not inversion, and a mean is not a minimum.
 *
 * Two findings, neither registered, because both were measured before anything was
 * written down about them and inflating the registered set with facts that were never
 * at risk is what `N-arithmetic-is-not-prediction` names as the way this discipline
 * turns into decoration.
 *
 *   `F-FINDABILITY-NOT-COUNT`     the summed head accepts all 21,840 compensating
 *                                 edits and the mixer accepts 26, against 29.96
 *   `F-MIXER-HEAD-IS-NOT-FLAT`    N^(L-1) is an IDEAL hash's preimage count, and the
 *                                 concrete chain runs 629..851 rather than a flat 729
 *
 * The control is the load-bearing part. A single edit moves the total, so the summed
 * head has to catch every one of them: if it did not, the 100% acceptance above would
 * be measuring a broken accumulator rather than a forgeable one, and the whole
 * comparison would be an artifact. That is `T-SCOPE-DECIDES-THE-VERDICT`, which has
 * bitten four times.
 *
 * The last section is the anti-divergence gate. `docs/tick-argument.html` carries a
 * SECOND implementation of both heads so bench 08 can run in a browser, and a second
 * implementation that is never compared is an unchecked claim. The page computes in
 * INDEX space and this tool in VALUE space, so agreement is evidence rather than a
 * tautology.
 */

const A = require('../tools/ledger-audit.js');
const Q = require('../tools/puzzle-audit.js');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const { LEDGER, headSum, headHash, wrap, forge } = A;

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');

check('the ledger is the six entries the page and the manifest both name',
  LEDGER.join() === '12,-40,7,155,-3,88');
check('both heads land inside one tryte for the real ledger',
  Math.abs(headSum(LEDGER)) <= 364 && Math.abs(headHash(LEDGER)) <= 364,
  `${headSum(LEDGER)} ${headHash(LEDGER)}`);
check('the summed head is the wrapped total, computed a second way',
  headSum(LEDGER) === wrap(12 - 40 + 7 + 155 - 3 + 88));
// The chain is built from puzzle-audit's own feedforward candidate, so if this
// disagrees the two tools have drifted apart and every number below is suspect.
// CANDIDATES.feedforward takes VALUES and returns an INDEX, which is the asymmetry
// that made the gate call the page divergent during set AN. Dropping the val() here
// reported a real agreement as a disagreement -- the same bite, localised in one
// step this time because the sweep numbers above had already reproduced.
check('the chain step IS AN\'s feedforward candidate, entry by entry',
  (() => {
    let a = 0;
    for (const e of LEDGER) a = Q.val(Q.CANDIDATES.feedforward(a, wrap(e)));
    return a === headHash(LEDGER);
  })());
check('an empty ledger has the empty head, so length is not smuggled in',
  headSum([]) === 0 && headHash([]) === 0);
check('the head moves for SOME edit, so neither accumulator is constant',
  headSum([1]) !== headSum([2]) && headHash([1]) !== headHash([2]));

console.log('\n=== 1. F-FINDABILITY-NOT-COUNT — THE COMPENSATING PAIR ===');

const comp = A.sweepCompensating();
check('6 x 5 ordered pairs x 728 non-zero deltas = 21,840 forgeries', comp.tried === 21840);
check('the summed head accepts every single one of them', comp.sum === 21840,
  `accepted ${comp.sum}`);
check('   which is what "one linear equation" means, not a search', comp.sum / comp.tried === 1);
check('the hashed head accepts 26', comp.hash === 26, `accepted ${comp.hash}`);
check('   against a chance rate of 29.96, so it is doing nothing clever',
  Math.abs(comp.chance - 29.9588) < 1e-3 && comp.hash < 2 * comp.chance,
  `${comp.hash} vs ${comp.chance}`);
check('   and 26 of 21,840 is 0.12%, four orders below the sum',
  Math.round(1e4 * comp.hash / comp.tried) === 12);
// A forgery that changes the entries is the only kind worth counting. If `forge`
// ever returned the input unchanged the sum's 100% would be trivially true.
check('every forgery really differs from the ledger it forges',
  (() => {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      if (i === j) continue;
      for (const d of [1, -1, 364, -364, 200]) {
        const f = forge(LEDGER, i, j, d);
        if (f.join() === LEDGER.join()) return false;
      }
    }
    return true;
  })());

console.log('\n=== 2. THE CONTROL — SINGLE EDITS, WHICH MOVE THE TOTAL ===');

const one = A.sweepSingle();
check('6 entries x 728 non-zero deltas = 4,368 single edits', one.tried === 4368);
check('the summed head catches ALL of them, so it is not simply broken',
  one.sum === 0, `accepted ${one.sum}`);
check('the hashed head accepts 7, against a chance rate of 6',
  one.hash === 7 && Math.abs(one.chance - 5.9917) < 1e-3, `accepted ${one.hash}`);
check('   so the sum\'s 100% above is the COMPENSATING structure, not arithmetic',
  one.sum === 0 && comp.sum === comp.tried);

console.log('\n=== 3. F-MIXER-HEAD-IS-NOT-FLAT — THE PREIMAGE PROFILE ===');

const pre = A.preimageProfile(2);
check('all 531,441 two-entry ledgers enumerated, not sampled', pre.ledgers === 531441);
check('the summed head is EXACTLY flat at 729 preimages per head',
  pre.sum.flat && pre.sum.min === 729 && pre.sum.max === 729);
check('   and reaches every head, so no history is unrepresentable', pre.sum.zero === 0);
check('the mixer is NOT flat: 629 at the thinnest, 851 at the thickest',
  !pre.hash.flat && pre.hash.min === 629 && pre.hash.max === 851,
  `${pre.hash.min}..${pre.hash.max}`);
check('   which is 17% above ideal at the peak',
  Math.round(100 * (pre.hash.max / 729 - 1)) === 17);
check('   but it is still onto — no head is unreachable', pre.hash.zero === 0);
check('   and the two profiles sum to the same total, as any partition must',
  pre.sum.mean === 729);

console.log('\n=== 4. THE MANIFEST SAYS WHAT THIS FILE MEASURED ===');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'FINDINGS.json'), 'utf8'));
const F = id => M.unregistered_findings.find(f => f.id === id);
for (const id of ['F-FINDABILITY-NOT-COUNT', 'F-MIXER-HEAD-IS-NOT-FLAT']) {
  const f = F(id);
  check(`${id} is in the manifest, and names this file`,
    !!f && f.asserted_in === 'test/test-ledger.js');
  check(`   and is MEASURED_NOT_REGISTERED, because it was measured first`,
    !!f && f.outcome === 'MEASURED_NOT_REGISTERED' && f.basis === 'measured');
}
// Numbers in prose are the thing this repository keeps catching going stale, so the
// claims are read back and matched against the run rather than trusted.
const c1 = (F('F-FINDABILITY-NOT-COUNT') || {}).claim || '';
check('the findability claim quotes the numbers this run produced',
  c1.includes('21,840') && c1.includes(String(comp.hash)) && c1.includes('29.96')
  && c1.includes('4,368') && c1.includes(' 7 '));
const c2 = (F('F-MIXER-HEAD-IS-NOT-FLAT') || {}).claim || '';
check('the flatness claim quotes the numbers this run produced',
  c2.includes('531,441') && c2.includes('629') && c2.includes('851') && c2.includes('729'));
const note = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'slate-notes.json'), 'utf8'))
  .notes.find(n => n.id === 'N-findability-not-count');
check('the slate note walks back to both findings rather than asserting alone',
  !!note && note.links.includes('F-FINDABILITY-NOT-COUNT')
  && note.links.includes('F-MIXER-HEAD-IS-NOT-FLAT'));

console.log('\n=== 5. THE ANTI-DIVERGENCE GATE — THE PAGE\'S SECOND COPY ===');

const PAGE = path.join(__dirname, '..', 'docs', 'tick-argument.html');
if (!fs.existsSync(PAGE)) {
  check('docs/tick-argument.html is present', false, 'missing');
} else {
  const page = fs.readFileSync(PAGE, 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(page);
  check('the page ships one executable script block, and it can be found', script !== null);

  let P = null;
  const stub = {
    getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [], addEventListener: () => {},
  };
  const sandbox = {
    document: stub, window: {}, console,
    localStorage: { getItem: () => null, setItem: () => {} },
    performance: { now: () => 0 },
    __TICK_EXPORT__: (api) => { P = api; },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(script[1], sandbox, { timeout: 60000 });
  check('   and it runs with no DOM at all — bench 08 declines rather than throwing',
    P !== null && typeof P.headHash === 'function');

  if (P) {
    check('the page ledger is byte-for-byte the one this tool sweeps',
      P.LEDGER.join() === LEDGER.join());
    check('   and both page heads agree with the tool on the real ledger',
      P.headSum(LEDGER) === headSum(LEDGER) && P.headHash(LEDGER) === headHash(LEDGER),
      `${P.headSum(LEDGER)}/${P.headHash(LEDGER)} vs ${headSum(LEDGER)}/${headHash(LEDGER)}`);
    // Index space against value space over the whole forgery neighbourhood. If the
    // page had kept the stray length term its earlier draft carried, this is where
    // it would show, on the first ledger rather than the twenty-thousandth.
    let sameSum = true, sameHash = true, tried = 0;
    for (let i = 0; i < 6 && sameSum && sameHash; i++) {
      for (let j = 0; j < 6; j++) {
        if (i === j) continue;
        for (let d = -364; d <= 364; d += 7) {
          if (d === 0) continue;
          const f = forge(LEDGER, i, j, d);
          tried++;
          if (P.headSum(f) !== headSum(f)) { sameSum = false; break; }
          if (P.headHash(f) !== headHash(f)) { sameHash = false; break; }
        }
      }
    }
    check(`   and on ${tried} forged ledgers, the summed heads never differ`, sameSum);
    check(`   and on the same ${tried}, the hashed heads never differ`, sameHash);
    // Heads on ledgers of other lengths, so agreement is not an accident of six.
    let anyLen = true;
    for (let L = 0; L <= 9 && anyLen; L++) {
      const es = Array.from({ length: L }, (_, k) => wrap((k * 271 + L * 53) % 729 - 364));
      if (P.headSum(es) !== headSum(es) || P.headHash(es) !== headHash(es)) anyLen = false;
    }
    check('   and they agree at every length from zero to nine', anyLen);
  }

  console.log('\n=== 6. THE PAGE SAYS WHAT THE RUN SAYS ===');
  const embed = /<script type="application\/json" id="slate-data">([\s\S]*?)<\/script>/.exec(page);
  check('the page carries the generated slate index', embed !== null);
  if (embed) {
    let parsed = null;
    try { parsed = JSON.parse(embed[1]); } catch (e) { /* reported below */ }
    check('   and it is parseable JSON, so no claim broke the script tag', parsed !== null);
    if (parsed) {
      const R = require('../tools/render-slate.js');
      const { slate } = R.build();
      check('   and it is byte-identical to fresh output, so it cannot go stale',
        embed[1] === R.embed(slate));
      check('   and it carries every entry in the corpus',
        parsed.entries.length === slate.counts.entries);
      const ids = new Set(parsed.entries.map(e => e.id));
      check('   including both findings this file measured',
        ids.has('F-FINDABILITY-NOT-COUNT') && ids.has('F-MIXER-HEAD-IS-NOT-FLAT'));
      check('   and no raw < survives into the payload, which would kill the page',
        embed[1].indexOf('<') < 0);
    }
  }
  check('bench 08 quotes 21,840 on its own button, and the sweep produced 21,840',
    page.includes('21,840 compensating edits') && comp.tried === 21840);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
