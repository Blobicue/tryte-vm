'use strict';
/* test-style.js — the built page must stay readable in both themes.
 *
 * Written because two real defects shipped past inspection: a Cyrillic 'А' inside
 * a dark-mode hex literal, and two text/background pairs below WCAG AA (the zero
 * trit in light, white-on-teal in dark). Inspection missed all three; arithmetic
 * caught them. So the arithmetic runs on every build.
 */

const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'tryte-vm.html'), 'utf8');
const css = html.split('<style>')[1].split('</style>')[0];

const tokensIn = re => {
  const m = css.match(re); const o = {};
  if (m) for (const t of m[1].matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) o[t[1]] = t[2];
  return o;
};
const LIGHT = tokensIn(/^:root \{([\s\S]*?)\n\}/m);
const DARK  = tokensIn(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/);
const MEDIA = tokensIn(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)\n  \}/);

const lum = h => {
  const c = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/* Every pair where the page paints text on a background. */
const PAIRS = [
  ['body text',      '--ink',   '--paper',   4.5],
  ['muted text',     '--ink-2', '--surface', 4.5],
  ['faint labels',   '--ink-3', '--surface', 3.0],
  ['negative trit',  '--neg',   '--neg-bg',  4.5],
  ['positive trit',  '--pos',   '--pos-bg',  4.5],
  ['zero trit',      '--zero',  '--zero-bg', 3.0],
  ['text on panel',  '--ink',   '--surface', 4.5],
  ['text on sunken', '--ink',   '--sunken',  4.5],
];
const ON_ACCENT = [['Run button', '--pos'], ['NEG switch', '--neg'], ['ZERO switch', '--zero']];

console.log('\n=== 1. THEME STRUCTURE ===');
check('every token has a base :root definition', (() => {
  // Names only — not every token is a hex colour (--shadow is a box-shadow value).
  const rootBlock = css.match(/^:root \{([\s\S]*?)\n\}/m)[1];
  const baseNames = new Set([...rootBlock.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]));
  const allNames = new Set([...css.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]));
  const missing = [...allNames].filter(t => !baseNames.has(t));
  if (missing.length) console.log('        missing: ' + missing.join(', '));
  return missing.length === 0;
})());
check('every var() reference resolves to a defined token', (() => {
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]));
  return [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(m => m[1]))].every(t => defined.has(t));
})());
check('the media-query dark palette matches the [data-theme] one', (() => {
  const k = Object.keys(DARK);
  return k.length > 0 && k.length === Object.keys(MEDIA).length && k.every(t => MEDIA[t] === DARK[t]);
})());
check('body paints an explicit background (never borrows the host ground)',
  /body \{[^}]*background:\s*var\(--paper\)/.test(css));
check('no hex literal contains a non-ASCII character',
  !/#[0-9A-Fa-f]*[^\x00-\x7F][0-9A-Fa-f]*;/.test(css));
check('no bare #fff / #000 is painted on an accent fill',
  !/color:\s*#(fff|000)(fff|000)?\s*;/i.test(css));

for (const [themeName, pal] of [['LIGHT', LIGHT], ['DARK', DARK]]) {
  console.log(`\n=== ${themeName === 'LIGHT' ? '2' : '3'}. ${themeName} THEME CONTRAST ===`);
  for (const [label, fg, bg, min] of PAIRS) {
    const r = ratio(pal[fg], pal[bg]);
    check(`${label} — ${r.toFixed(2)}:1 (needs ${min})`, r >= min, `${pal[fg]} on ${pal[bg]}`);
  }
  for (const [label, acc] of ON_ACCENT) {
    const r = ratio(pal['--on-accent'], pal[acc]);
    check(`label on ${label} — ${r.toFixed(2)}:1 (needs 4.5)`, r >= 4.5, `${pal['--on-accent']} on ${pal[acc]}`);
  }
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
