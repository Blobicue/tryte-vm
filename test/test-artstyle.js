'use strict';
/* test-artstyle.js — the published argument must be readable in both themes.
 *
 * `test-style.js` runs this arithmetic on `docs/tryte-vm.html` and has done since
 * three real defects shipped past inspection. `docs/tick-argument.html` had no such
 * check at all, which mattered more once the page grew a slate whose whole surface is
 * small text on tinted pills -- exactly the shape the earlier defects took. And the
 * repository already carries a light-mode FALSE VERDICT on the record: a browser
 * reported dark-on-dark for pre-existing controls while a freshly created one
 * resolved correctly, because the styles it read were stale. Arithmetic over the
 * stylesheet cannot go stale that way, which is the reason to prefer it here.
 *
 * The maths is shared with `test-style.js` through `test/theme.js` -- one instrument,
 * two documents, because two copies of a checker are two checkers that can disagree.
 */

const fs = require('fs');
const path = require('path');
const { ratio, structure, preamble } = require('./theme.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'tick-argument.html'), 'utf8');
const css = html.split('<style>')[1].split('</style>')[0];
const S = structure(css);

/** Every place this page paints text on a background. The slate and the jump strip
 *  are the newest and the smallest, so they carry the tightest of these. */
const PAIRS = [
  ['body text on the ground',      '--ink',       '--ground',    4.5],
  ['body text on a panel',         '--ink',       '--panel',     4.5],
  ['an entry claim',               '--ink-soft',  '--panel-2',   4.5],
  ['an entry body',                '--ink-soft',  '--panel',     4.5],
  ['a slate label',                '--ink-faint', '--panel',     3.0],
  ['a jump-strip link',            '--ink-soft',  '--panel',     4.5],
  ['a jump-strip link, hovered',   '--build',     '--panel',     4.5],
  ['a held pill',                  '--build',     '--build-bg',  4.5],
  ['a failed pill',                '--burn',      '--burn-bg',   4.5],
  ['a finding pill, unregistered', '--ink-faint', '--panel',     3.0],
  ['the count line',               '--ink-faint', '--panel-2',   3.0],
  ['a bench verdict, built',       '--build',     '--panel-2',   4.5],
  ['a bench verdict, burnt',       '--burn',      '--panel-2',   4.5],
];

console.log('\n=== 0. THE DOCUMENT PREAMBLE ===');
{
  // Both of these shipped broken on all three published pages, and both were found by
  // opening one in a browser rather than by any check here. See `preamble` in
  // test/theme.js for what each one costs.
  const P = preamble(html);
  check('the page opens with a doctype, so it is not parsed in quirks mode',
    P.hasDoctype);
  check('   and declares utf-8 inside the first 1024 bytes, so its encoding is a '
    + 'property of the page rather than of how it was served',
    P.hasCharset);
  check('   and does not declare one too late in the file to be read',
    !P.charsetLate);
}

console.log('\n=== 1. THEME STRUCTURE ===');
check('the page defines a dark palette at all', S.hasDark);
check('every token has a base :root definition, so the un-stamped default resolves',
  S.orphanTokens.length === 0, S.orphanTokens.join(', '));
check('every bare var() reference resolves to a token that exists',
  S.danglingVars.length === 0, S.danglingVars.join(', '));
check('the media-query dark palette matches the [data-theme="dark"] one exactly',
  S.themesDisagree.length === 0, S.themesDisagree.join(', '));
check('body paints an explicit background, so it never borrows the host ground',
  /body\s*\{[^}]*background:\s*var\(--ground\)/.test(css));
check('no hex literal contains a non-ASCII character',
  !S.nonAsciiHex);
check('color-scheme is declared in all three states, so form controls follow',
  (css.match(/color-scheme:/g) || []).length >= 3);

for (const [label, pal] of [['LIGHT', S.light], ['DARK', S.dark]]) {
  console.log(`\n=== ${label === 'LIGHT' ? '2' : '3'}. ${label} THEME CONTRAST ===`);
  for (const [what, fg, bg, min] of PAIRS) {
    const a = pal[fg], b = pal[bg];
    if (!a || !b) { check(`${what} — both tokens exist`, false, `${fg} ${bg}`); continue; }
    const r = ratio(a, b);
    check(`${what} — ${r.toFixed(2)}:1 (needs ${min})`, r >= min, `${a} on ${b}`);
  }
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
