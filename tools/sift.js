'use strict';
/* SIFT — a population you measure over must be a population you know is there.
 *
 * WHY THIS EXISTS, and it is a defect of mine rather than one I found in someone
 * else's work. A harness in this repository filtered its comparator population by
 * comparing a classifier's return value against a constant the classifier can never
 * return -- `classify()` yields `'at-risk'`, the exported constant is `'AT RISK'`.
 * Nothing matched. The filtered array was empty. And instead of failing, every
 * statistic downstream divided into that emptiness and printed four rows of
 * plausible, uniformly non-significant p-values. Had the finding gone the other way
 * that clean table would have been read as clearance.
 *
 * The same shape, in a different costume, is how the criteria audit lost set `AQ`:
 * an extractor searched for a header spelling that set never used, recovered nothing,
 * and silently fell back to a one-line summary. Both produced confident output from
 * no data at all.
 *
 *     ZERO IS THE ONE CARDINALITY THAT MAKES A BROKEN FILTER LOOK LIKE A CLEAN
 *     RESULT. Every other wrong count produces a wrong number, which someone
 *     eventually re-derives. An empty population produces NaN -- or worse, a
 *     perfectly typeset absence of signal.
 *
 * So a filter that defines something you are about to measure must assert it caught
 * something, and a mean must refuse an empty sample. Not because empty is always an
 * error: because empty must be a DECLARED FACT rather than an accident. `allowEmpty`
 * exists and takes a reason, so "there were none" can be recorded as a finding
 * instead of arriving as a silence.
 *
 * WHAT THIS IS NOT. It does not check that the predicate is CORRECT -- my predicate
 * was well-formed JavaScript comparing two strings, and it was wrong. Nothing here
 * would have told me the constant was unequal to the classifier's output. It would
 * have told me, loudly, that the population I was about to run a test over did not
 * exist, which is the part that let the error reach a published claim.
 *
 *     node tools/sift.js          lists the divide-by-population sites still unguarded
 */

const fs = require('fs');
const path = require('path');

const MAIN = require.main === module;
const ROOT = path.join(__dirname, '..');

class EmptyPopulation extends Error {
  constructor(label, of, extra) {
    super(`empty population: ${label}${of ? ` (sifted from ${of} candidate(s))` : ''}`
      + `${extra ? ` -- ${extra}` : ''}`
      + '\n  A filter that catches nothing must raise, not report. If zero is the real'
      + '\n  answer, pass { allowEmpty: "<why zero is meaningful here>" } and it becomes'
      + '\n  a recorded fact rather than a silence.');
    this.name = 'EmptyPopulation';
    this.label = label;
  }
}

/** `arr.filter(pred)`, except that catching nothing is an error rather than a result. */
function sift(label, arr, pred, opts = {}) {
  if (!Array.isArray(arr)) throw new TypeError(`sift(${label}): not an array`);
  const out = arr.filter(pred);
  if (out.length === 0 && !opts.allowEmpty) throw new EmptyPopulation(label, arr.length);
  return out;
}

/**
 * The mean of `arr` under `f`, refusing an empty sample. This is the guard that
 * matters most: `total / arr.length` on an empty array is NaN, and NaN formatted to
 * two decimal places has been mistaken for a measurement in this repository before.
 */
function meanOf(label, arr, f = x => x, opts = {}) {
  if (!Array.isArray(arr)) throw new TypeError(`meanOf(${label}): not an array`);
  if (arr.length === 0) {
    if (!opts.allowEmpty) throw new EmptyPopulation(label, null, 'nothing to average');
    return null;                       // null, never NaN -- a hole you can see
  }
  let t = 0;
  for (const x of arr) {
    const v = f(x);
    if (!Number.isFinite(v)) throw new TypeError(`meanOf(${label}): non-finite term ${v}`);
    t += v;
  }
  return t / arr.length;
}

/** `hit / of`, refusing an empty denominator. The rate that cannot be 0/0. */
function fracOf(label, hit, of, opts = {}) {
  if (of === 0 && !opts.allowEmpty) throw new EmptyPopulation(label, null, 'empty denominator');
  return of === 0 ? null : hit / of;
}

/* ---------------------------------------------------------------- the ratchet
 *
 * A number of sites in `tools/` divide by a population's length without going through
 * `meanOf`. Retrofitting all of them in one pass would be a large diff over working
 * code for no measured defect, so they are frozen as a list instead -- and the list
 * is a LIST rather than a COUNT deliberately, for two reasons.
 *
 * A bare ceiling cannot say which site is new, and it silently absorbs one fix paying
 * for one regression. A frozen list names every member, so an arrival is reported by
 * name and a departure is reported as staleness rather than banked.
 *
 * And the numeral is absent from this sentence on purpose. The first draft of this
 * comment said "eighteen", taken from a grep that returned eighteen LINES; there are
 * fifteen distinct sites, because one file can divide by the same population on four
 * lines. That is `T-UNIT-SLIP-ACROSS-A-RATIO` -- lines counted, sites reported --
 * arriving inside the antibody written for it, which is the most honest possible
 * demonstration that the class does not care how alert you are. `AGENTS.md`'s rule
 * applies: generate a count that is reported, delete the numeral when the count is a
 * premise. `KNOWN_UNGUARDED.length` is the count, and it is never typed.
 *
 * Keyed by file and the identifier being divided, not by line, because line numbers
 * move and the check would then fail for edits that changed nothing.
 */
const KNOWN_UNGUARDED = [
  'arity-audit.js:deg', 'forge-audit.js:ratios', 'forge-audit.js:counts',
  'hailstone-audit.js:terminating', 'insert-audit.js:arr', 'puzzle-audit.js:mineable',
  'radix-audit.js:row', 'radix-audit.js:gains', 'slate-query.js:idxs',
  'tasks-audit.js:ALL', 'width-audit.js:counts', 'width-audit.js:arr',
  'width-audit.js:spIdx', 'wipe-audit.js:Es', 'wipe-audit.js:exp',
];

/**
 * Every `/ <name>.length` in `tools/` that does not go through `meanOf`. Returns
 * `file:identifier` keys so the result is stable under edits that move lines.
 */
function unguarded(dir = path.join(ROOT, 'tools')) {
  const found = new Set();
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.js')).sort()) {
    if (f === 'sift.js') continue;                    // the guard is not its own debt
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const line of src.split('\n')) {
      if (line.includes('meanOf') || line.includes('fracOf')) continue;
      const m = line.match(/\/\s*([A-Za-z_$][\w$]*)\.length/g) || [];
      for (const hit of m) {
        const id = hit.match(/([A-Za-z_$][\w$]*)\.length/)[1];
        found.add(`${f}:${id}`);
      }
    }
  }
  return [...found].sort();
}

/** What the ratchet says right now: arrivals are failures, departures are staleness. */
function ratchet() {
  const now = unguarded();
  const known = new Set(KNOWN_UNGUARDED);
  return {
    now,
    arrived: now.filter(k => !known.has(k)),
    departed: KNOWN_UNGUARDED.filter(k => !now.includes(k)),
  };
}

if (MAIN) {
  const r = ratchet();
  console.log(`unguarded divide-by-population sites in tools/: ${r.now.length}`);
  for (const k of r.now) console.log(`  ${KNOWN_UNGUARDED.includes(k) ? ' ' : '+'} ${k}`);
  if (r.arrived.length) console.log(`\nNEW, not on the frozen list: ${r.arrived.join(' ')}`);
  if (r.departed.length) console.log(`\nFIXED, remove from KNOWN_UNGUARDED: ${r.departed.join(' ')}`);
}

module.exports = { sift, meanOf, fracOf, EmptyPopulation, unguarded, ratchet, KNOWN_UNGUARDED };
