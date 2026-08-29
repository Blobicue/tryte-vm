'use strict';
/* test-sift.js — the guard against a statistic computed over nothing.
 *
 * `tools/sift.js` exists because of a defect of mine: a comparator population
 * filtered to empty, and every test downstream dividing into that emptiness and
 * printing plausible non-significant p-values rather than failing. This suite has to
 * do the thing that harness did not, which is prove it can FAIL. A guard asserted and
 * never fired is the same class of claim as a criterion in the noise.
 *
 * Three kinds of check here, and the second and third are the ones that matter:
 *
 *   POSITIVE   the guards raise on empty, with the label in the message
 *   NEGATIVE   they do NOT raise on real corpus traffic -- populations drawn from
 *              FINDINGS.json that are legitimately non-empty. A tripwire with real
 *              traffic under it that it correctly ignores is worth more than one with
 *              nothing under it (`AGENTS.md`, Tests).
 *   RATCHET    the frozen list of unguarded divide-by-population sites is neither
 *              short by an arrival nor long by a departure.
 */

const fs = require('fs');
const path = require('path');
const S = require('../tools/sift.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
/** Did `f` raise an EmptyPopulation naming `label`? */
const raises = (f, label) => {
  try { f(); return false; }
  catch (e) { return e instanceof S.EmptyPopulation && e.label === label; }
};

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'FINDINGS.json'), 'utf8'));
const preds = M.prediction_sets.flatMap(s => s.predictions || []);

console.log('\n=== 1. THE GUARDS RAISE ON EMPTY ===');
check('sift raises when the predicate catches nothing, naming the population',
  raises(() => S.sift('at-risk failures', [1, 2, 3], x => x > 99), 'at-risk failures'));
check('   and the message says how many candidates it sifted, so the miss is diagnosable',
  (() => { try { S.sift('p', [1, 2, 3], x => x > 99); return false; }
    catch (e) { return /3 candidate/.test(e.message); } })());
check('meanOf raises on an empty sample rather than returning NaN',
  raises(() => S.meanOf('slopes', []), 'slopes'));
check('fracOf raises on an empty denominator rather than returning 0/0',
  raises(() => S.fracOf('crossing rate', 0, 0), 'crossing rate'));
// The specific failure this module was written for: a filter comparing against a
// constant its own classifier can never return. The predicate is well-formed and
// wrong, and only the emptiness is detectable.
check('   and the exact shape that caused it -- a filter on a constant that never '
  + 'matches -- is caught',
  raises(() => S.sift('classified at-risk',
    preds.map(p => ({ k: 'at-risk' })), p => p.k === 'AT RISK'), 'classified at-risk'));

console.log('\n=== 2. EMPTY IS ALLOWED ONLY AS A DECLARED FACT ===');
check('allowEmpty lets zero through, so "there were none" can be a finding',
  S.sift('malformed', preds, p => p.at_risk === undefined,
    { allowEmpty: 'zero malformed annotations is the result, not a miss' }).length === 0);
check('   and an allowed-empty mean is null, never NaN -- a hole you can see',
  S.meanOf('empty', [], x => x, { allowEmpty: 'none' }) === null);
check('   and a non-finite term is refused even when the sample is non-empty',
  (() => { try { S.meanOf('bad', [1, NaN, 3]); return false; }
    catch (e) { return e instanceof TypeError; } })());

console.log('\n=== 3. THE NEGATIVE CONTROL — REAL TRAFFIC IT MUST NOT FIRE ON ===');
// Not an invented array: four populations from the live corpus that are genuinely
// non-empty. If the guard fired on these it would be forbidding a healthy state,
// which this repository has recorded twice as `T-CHECK-FORBIDS-HEALTHY-STATE`.
const traffic = [
  ['every prediction', preds, p => !!p.id],
  ['at-risk predictions', preds, p => /^AT RISK/.test(String(p.at_risk || ''))],
  ['failures', preds, p => p.outcome === 'FAILED'],
  ['sets with a registered_at', M.prediction_sets, s => !!s.registered_at],
];
for (const [label, arr, pred] of traffic) {
  let n = -1, threw = false;
  try { n = S.sift(label, arr, pred).length; } catch { threw = true; }
  check(`   ${label}: guard stays silent over ${n} real member(s)`, !threw && n > 0,
    threw ? 'RAISED on a healthy population' : `n=${n}`);
}
check('   and meanOf agrees with plain arithmetic on real traffic',
  (() => {
    const ids = preds.map(p => String(p.id).length);
    return S.meanOf('id lengths', ids) === ids.reduce((a, b) => a + b, 0) / ids.length;
  })());

console.log('\n=== 4. THE RATCHET — WHAT IS STILL UNGUARDED, BY NAME ===');
const r = S.ratchet();
check(`the frozen list has ${S.KNOWN_UNGUARDED.length} site(s) and no duplicates`,
  new Set(S.KNOWN_UNGUARDED).size === S.KNOWN_UNGUARDED.length);
check('no NEW divide-by-population site has appeared in tools/',
  r.arrived.length === 0, `arrived: ${r.arrived.join(' ')}`);
// A frozen list that has quietly become wrong in the other direction is the defect
// `test-findings.js` guards for its own pinned exception: a debt entry outliving the
// debt claims a problem the repository no longer has.
check('no listed site has been fixed without the list being updated',
  r.departed.length === 0, `departed: ${r.departed.join(' ')}`);
check('   and the scanner actually finds something, so an empty scan cannot pass as clean',
  r.now.length > 0, String(r.now.length));
check('   and it does not count its own guard as debt',
  !r.now.some(k => k.startsWith('sift.js:')));

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
