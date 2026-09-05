'use strict';
/* theme.js — the arithmetic behind both theme suites.
 *
 * `test-style.js` was written because three real defects shipped past inspection: a
 * Cyrillic 'A' inside a dark-mode hex literal, and two text-on-background pairs below
 * WCAG AA. Inspection missed all three and arithmetic caught them. When the same
 * arithmetic was wanted for a second document the honest options were to copy it or
 * to share it, and a copied instrument is two instruments that can disagree -- which
 * is the one thing this repository will not have in a checker.
 *
 * So the maths lives here once. The PAIRS a page must satisfy stay in that page's
 * suite, because which text sits on which background is a fact about the page.
 */

/** WCAG relative luminance of a #rrggbb literal. */
const lum = h => {
  const c = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

/** Contrast ratio, lighter over darker, so argument order cannot change a verdict. */
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** The hex tokens declared inside one CSS block. */
const tokens = block => {
  const o = {};
  if (block) for (const t of block.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) o[t[1]] = t[2];
  return o;
};

/** The first capture of `re` against the stylesheet, or '' when it does not match. */
const blockOf = (css, re) => { const m = css.match(re); return m ? m[1] : ''; };

/**
 * The structural rules that hold for ANY themed page, returned rather than asserted
 * so each suite can name them in its own voice.
 *
 *   orphanTokens   declared in a theme block but never in bare :root, so the
 *                  un-stamped default state has no value for them at all
 *   danglingVars   var(--x) with no definition and no fallback
 *   themesDisagree tokens where the media query and the [data-theme] block differ
 */
function structure(css) {
  const base = blockOf(css, /^[ \t]*:root\s*\{([\s\S]*?)\n[ \t]*\}/m);
  const dark = blockOf(css, /:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n[ \t]*\}/);
  const media = blockOf(css, /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[\s\S]*?:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\n\s*\}/);

  const names = b => new Set([...b.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]));
  const baseNames = names(base);
  const allNames = names(css);
  const orphanTokens = [...allNames].filter(t => !baseNames.has(t));

  // var(--x, fallback) is defined by its fallback, so only the bare form can dangle.
  const bare = [...css.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)].map(m => m[1]);
  const danglingVars = [...new Set(bare)].filter(t => !allNames.has(t));

  const D = tokens(dark), M = tokens(media);
  const themesDisagree = Object.keys(D).filter(t => M[t] !== D[t])
    .concat(Object.keys(M).filter(t => D[t] === undefined));

  if (!base.trim()) throw new Error('theme: no bare :root block found -- the parse failed, not the palette');

  return {
    light: tokens(base), dark: D, media: M,
    orphanTokens, danglingVars, themesDisagree: [...new Set(themesDisagree)],
    hasDark: Object.keys(D).length > 0,
    nonAsciiHex: /#[0-9A-Fa-f]*[^\x00-\x7F][0-9A-Fa-f]*\s*[;}]/.test(css),
  };
}

/**
 * The document preamble, which every published page here had been shipping without.
 *
 * Not a palette question, but it lives beside one because it is the same defect class
 * and the same three documents: something arithmetic catches and inspection does not.
 * All three pages opened straight at `<title>`, and a browser given that has to guess
 * twice.
 *
 *   NO DOCTYPE  puts the page in QUIRKS MODE. `document.compatMode` reads
 *               `BackCompat`, and the box model, line-height and table sizing stop
 *               being the ones the stylesheet above was written against.
 *   NO CHARSET  makes the encoding a property of how the page was DELIVERED rather
 *               than of the page. Served without one in the header -- which is what
 *               a plain static server and `file://` both do -- Chrome falls back to
 *               a locale default, resolved to `windows-1252` when this was measured,
 *               and every em-dash in the prose rendered as three characters.
 *
 * Both were found by opening the page in a browser, which no check here does. These
 * two lines are what a check can do instead.
 */
function preamble(html) {
  const head = html.slice(0, 1024);            // the charset must land inside 1024 bytes
  return {
    hasDoctype: /^\s*<!doctype html>/i.test(html),
    hasCharset: /<meta\s+charset\s*=\s*["']?utf-8["']?\s*>/i.test(head),
    // A charset declaration after 1024 bytes is ignored by the parser, so a page that
    // has one further down is not saved by it -- that is the failure worth naming.
    charsetLate: !/<meta\s+charset/i.test(head) && /<meta\s+charset/i.test(html),
  };
}

module.exports = { lum, ratio, tokens, blockOf, structure, preamble };
