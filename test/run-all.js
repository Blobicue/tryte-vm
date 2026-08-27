'use strict';
/* run-all.js — every suite, plus the one number no single suite can check.
 *
 * The README's headline check count has gone stale twice. It is not a constant
 * any suite owns, because it is the SUM of all of them — so it is checked here,
 * where the sum is already in hand. T-STALE-CONSTANT, third occurrence.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SUITES = ['test-device.js', 'test-axioms.js', 'test-adder.js', 'test-midrail.js', 'test-decoded.js', 'test-passcount.js', 'test-collision.js', 'test-design.js', 'test-doctree.js', 'test-headroom.js', 'test-detector.js', 'test-register.js', 'test-msregister.js', 'test-accumulator.js', 'test-budget.js', 'test-terminal.js', 'test-memory.js', 'test-interconnect.js', 'test-iterhash.js', 'test-reversible.js', 'test-nonlinearity.js', 'test-midprice.js', 'test-decode.js', 'test-sequencer.js', 'test-erasure.js', 'test-predict.js', 'test-hailstone.js', 'test-setclass.js', 'test-tuning.js', 'test-workfactor.js', 'test-margin.js', 'test-arity.js', 'test-selfref.js', 'test-minimal.js', 'test-grok.js', 'test-puzzle.js', 'test-wipe.js', 'test-results.js', 'test-core.js', 'test-vm.js',
  'test-selfhost.js', 'test-bench.js', 'test-logic.js', 'test-monoid.js',
  'test-fold.js', 'test-page.js', 'test-style.js', 'test-findings.js'];

let failed = false;
let total = 0;
const unparsed = [];
for (const suite of SUITES) {
  console.log(`\n########## ${suite} ##########`);
  let out;
  try { out = execFileSync(process.execPath, [path.join(__dirname, suite)], { encoding: 'utf8' }); }
  catch (e) { failed = true; out = e.stdout || e.message; }
  console.log(out);
  const m = /ALL (\d+) CHECKS PASSED/.exec(out);
  if (m) total += Number(m[1]); else unparsed.push(suite);
}

console.log('########## totals ##########');
if (unparsed.length) {
  // A suite whose count could not be read must not be silently dropped from the
  // sum — that would let the README claim a number nothing added up to.
  failed = true;
  console.log(`  [FAIL] no check count found in: ${unparsed.join(', ')}`);
} else {
  const README = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  // The count crossed a thousand and the README groups its digits. Match the grouped
  // form and strip the separators, rather than forcing the prose to read "1027".
  const claimed = /\*\*([\d,]+) checks\*\*/.exec(README);
  // This number is the one thing here a manifest cannot supply: it exists only once
  // every suite has run. `render-docs.js` owns the counts derived from FINDINGS.json
  // and never touches this one; --write stamps it from the run that produced it.
  // Typed by hand it needed bumping twice in a single session, once for a new suite
  // and once for the check that suite's own pinning added.
  const grouped = String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Files carrying a `<!--g:checks-->` / `<!--g:suites-->` region. render-docs.js
  // owns every other region and steps over these two, so the two writers never
  // contend for the same bytes.
  const STAMPED = [path.join('docs', 'tick-argument.html')];
  const region = (src, key, value) =>
    src.replace(new RegExp(`(<!--g:${key}-->)[\\s\\S]*?(<!--/g-->)`), `$1${value}$2`);
  if (process.argv.includes('--write')) {
    if (!claimed) { failed = true; console.log('  [FAIL] the README states no check count to stamp'); }
    else {
      fs.writeFileSync(path.join(__dirname, '..', 'README.md'),
        README.replace(claimed[0], `**${grouped} checks**`));
      let n = 1;
      for (const rel of STAMPED) {
        const p = path.join(__dirname, '..', rel);
        const before = fs.readFileSync(p, 'utf8');
        const after = region(region(before, 'checks', grouped), 'suites', String(SUITES.length));
        if (after !== before) { fs.writeFileSync(p, after); n++; }
      }
      console.log(`  [WROTE] ${grouped} checks across ${SUITES.length} suites, into ${n} file(s)`);
    }
  } else if (!claimed) { failed = true; console.log('  [FAIL] the README states no check count'); }
  else if (Number(claimed[1].replace(/,/g, '')) !== total) {
    failed = true;
    console.log(`  [FAIL] the README says ${claimed[1]} checks; the suites ran ${total}`
      + ' — run `npm run counts` to stamp it');
  } else {
    // A writer with no reader just relocates the drift. Every stamped region has to
    // agree too, or the published page quietly falls behind the way it already did.
    const stale = [];
    for (const rel of STAMPED) {
      const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
      const got = k => (new RegExp(`<!--g:${k}-->([\\s\\S]*?)<!--/g-->`).exec(src) || [, null])[1];
      if (got('checks') !== grouped) stale.push(`${rel} says ${got('checks')} checks`);
      if (got('suites') !== String(SUITES.length)) stale.push(`${rel} says ${got('suites')} suites`);
    }
    if (stale.length) {
      failed = true;
      console.log(`  [FAIL] ${stale.join('; ')} — run \`npm run counts\` to stamp it`);
    } else {
      console.log(`  [PASS] ${total} checks across ${SUITES.length} suites, in the README`
        + ` and ${STAMPED.length} stamped file(s)`);
    }
  }
}

console.log(failed ? '\n>>> SUITE FAILED' : '\n>>> ALL SUITES PASSED');
process.exit(failed ? 1 : 0);
