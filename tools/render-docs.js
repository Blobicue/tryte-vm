'use strict';
/* RENDER-DOCS — every prose restatement of a manifest count, generated.
 *
 * `render-ledger.js` already owns `results/99-ledger.md`: it renders the file from
 * `FINDINGS.json` and a test asserts the committed copy is byte-identical to fresh
 * output, so the prose cannot disagree with the manifest. This does the same job for
 * the counts that appear in HAND-WRITTEN documents, which until now were typed and
 * then guarded.
 *
 * WHY GENERATION RATHER THAN MORE GUARDS. The suite carries seven checks whose only
 * purpose is catching a hand-typed number going stale, and four of them fired during
 * set `AN` alone. The repository had already found the deeper problem and written it
 * down inside one of those checks:
 *
 *     "pinning one wording licenses the others to drift"
 *
 * -- `METHOD.md` stated the trap count three ways, one was pinned by a check, and the
 * other two went stale for four phases. The response then was a cleverer sweep. But a
 * guard can only chase phrasings a human already wrote, and prose keeps inventing new
 * ones. Generating the phrase removes it from human hands, which is the only version
 * of the fix that does not need to be repeated.
 *
 * WHAT THIS DOES NOT OWN. The suite's check count and suite count are produced by
 * RUNNING the suites, not by reading the manifest, so `test/run-all.js --write` stamps
 * those and this tool never touches them. Two writers, disjoint regions.
 *
 * HOW IT MARKS. A region is an HTML comment pair, invisible in rendered Markdown:
 *
 *     <!--g:readme-tally-->Forty prediction sets ...<!--/g-->
 *
 * The region wraps a WHOLE phrase rather than a bare number, because several of the
 * guards match a phrase as a contiguous substring; splitting one with a comment would
 * break the very checks that prove this tool correct.
 *
 *     node tools/render-docs.js            # report what would change
 *     node tools/render-docs.js --write    # write it
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two',
  'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven',
  'twenty-eight', 'twenty-nine', 'thirty', 'thirty-one', 'thirty-two', 'thirty-three',
  'thirty-four', 'thirty-five', 'thirty-six', 'thirty-seven', 'thirty-eight',
  'thirty-nine', 'forty', 'forty-one', 'forty-two', 'forty-three', 'forty-four',
  'forty-five', 'forty-six', 'forty-seven', 'forty-eight', 'forty-nine', 'fifty',
  'fifty-one', 'fifty-two', 'fifty-three', 'fifty-four', 'fifty-five', 'fifty-six',
  'fifty-seven', 'fifty-eight', 'fifty-nine', 'sixty'];

/**
 * A number this tool cannot spell is a number it must not write. Silently emitting
 * `undefined` into the README is precisely the defect class this tool exists to kill,
 * so running off the end of the table is fatal rather than quiet.
 */
function word(n) {
  if (!Number.isInteger(n) || n < 0 || n >= WORDS.length) {
    throw new Error(`render-docs: no word for ${n}. Extend WORDS past ${WORDS.length - 1}.`);
  }
  return WORDS[n];
}
const Word = n => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };

/** Everything derivable from the manifest and the tree, in one object. */
function facts() {
  const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'FINDINGS.json'), 'utf8'));
  const preds = M.prediction_sets.flatMap(s => s.predictions);
  // An audit is a tool a set names, wherever it lives -- the same rule test-findings
  // uses, because a set's tool had to move next to the GPU it runs on.
  const inTools = fs.readdirSync(path.join(ROOT, 'tools')).filter(f => /-audit\.js$/.test(f));
  const elsewhere = [...new Set(M.prediction_sets.map(x => x.tool))]
    .filter(t => !t.startsWith('tools/')).map(t => path.basename(t));
  return {
    sets: M.prediction_sets.length,
    predictions: preds.length,
    held: preds.filter(p => p.outcome === 'HELD').length,
    failed: preds.filter(p => p.outcome === 'FAILED').length,
    unregistered: M.unregistered_findings.length,
    trapClasses: M.traps_encountered.length,
    bites: M.traps_encountered.reduce((a, t) => a + t.count, 0),
    audits: inTools.length + elsewhere.length,
    // The published page counts this one class specifically, because its argument
    // rests on it: the instrument, not the subject, producing the verdict.
    instrumentBites: (M.traps_encountered
      .find(t => t.id === 'T-INSTRUMENT-FALSE-VERDICT') || { count: 0 }).count,
  };
}

/**
 * One template per marked region. Each returns the exact text that belongs between
 * its markers -- including line breaks, which several guards normalise but the
 * byte-identity check does not.
 */
const TEMPLATES = {
  'readme-audits-lede': f => `${word(f.audits)} audits establishing`,
  'readme-audits-badge': f => `${word(f.audits)} audits`,
  'readme-audits-tree': f => `the ${word(f.audits)} audits, each with its registered predictions`,
  'readme-tally': f =>
    `${Word(f.sets)} prediction sets, registered before their runs. **${f.held} held, ${f.failed} failed**`,

  'method-tally': f =>
    `${Word(f.sets)} prediction sets, **${f.predictions} registered predictions, ` +
    `${f.held} held, ${f.failed} failed.** ${Word(f.trapClasses)}\n` +
    `distinct failure classes, which bit **${f.bites} times** between them. ${Word(f.unregistered)} findings\n` +
    `measured but never registered`,
  'method-trace': f => `the ${word(f.sets)} sets`,

  'results-table': f =>
    `| prediction sets | ${f.sets} |\n` +
    `| registered predictions | ${f.predictions} — **${f.held} held, ${f.failed} failed** |\n` +
    `| measured but never registered | ${f.unregistered} |\n` +
    `| defect classes | ${f.trapClasses}, recurring ${f.bites} times |`,

  'doctree-desc': f => `${Word(f.trapClasses)} defect classes, ${word(f.bites)} bites`,
  'doctree-lede': f => `${Word(f.trapClasses)} classes, ${word(f.bites)} occurrences`,

  // The published page. Its masthead was the last surface here where a manifest
  // number was typed by hand and nothing checked it -- it had already drifted three
  // checks behind by the time it moved into the repository.
  // These carry their own markup, because the region wraps the whole rendered
  // element: a template returning a bare number would silently strip the <b>.
  'art-predictions': f => `<b>${f.predictions}</b>`,
  'art-held': f => `<b>${f.held}</b>`,
  'art-failed': f => `<b>${f.failed}</b>`,
  'art-failed-tally': f => `${Word(f.failed)} of ${f.predictions} predictions failed`,
  'art-instrument-bites': f => `${Word(f.instrumentBites)} instrument failures`,
};

const TARGETS = [
  'README.md',
  'METHOD.md',
  'results/README.md',
  path.join('.claude', 'knowledge', 'doctrees', 'tryte-vm', '11-failure-catalogue.md'),
  path.join('docs', 'tick-argument.html'),
];

const RE = /<!--g:([a-z0-9-]+)-->([\s\S]*?)<!--\/g-->/g;

/**
 * Keys owned by the OTHER writer. The suite's check count and suite count exist only
 * once every suite has run, so `test/run-all.js --write` stamps them and this tool
 * steps over them rather than failing on a region it is not responsible for.
 */
const RUN_KEYS = new Set(['checks', 'suites']);

/** Render one file's regions. Returns {text, seen, changed}. */
function renderText(src, f) {
  const seen = [];
  let changed = 0;
  const out = src.replace(RE, (whole, key, body) => {
    if (RUN_KEYS.has(key)) return whole;              // not ours; leave it alone
    seen.push(key);
    const t = TEMPLATES[key];
    if (!t) throw new Error(`render-docs: no template for region "${key}"`);
    const next = t(f);
    if (next !== body) changed++;
    return `<!--g:${key}-->${next}<!--/g-->`;
  });
  return { text: out, seen, changed };
}

function run(write) {
  const f = facts();
  const report = [];
  const used = new Set();
  for (const rel of TARGETS) {
    const p = path.join(ROOT, rel);
    const src = fs.readFileSync(p, 'utf8');
    const { text, seen, changed } = renderText(src, f);
    seen.forEach(k => used.add(k));
    if (changed && write) fs.writeFileSync(p, text);
    report.push({ file: rel, regions: seen.length, changed });
  }
  // Every template must be reachable. A region renamed in a document but left in this
  // table is a template that silently stops running, which is the same failure as a
  // stale number wearing different clothes.
  const orphans = Object.keys(TEMPLATES).filter(k => !used.has(k));
  if (orphans.length) throw new Error(`render-docs: templates never used: ${orphans.join(' ')}`);
  return { facts: f, report, write };
}

if (MAIN) {
  const write = process.argv.includes('--write');
  const { facts: f, report } = run(write);
  log('RENDER-DOCS — manifest counts, written rather than guarded.\n');
  log(`  sets ${f.sets}   predictions ${f.predictions} (${f.held} held, ${f.failed} failed)`);
  log(`  unregistered ${f.unregistered}   trap classes ${f.trapClasses}   bites ${f.bites}   audits ${f.audits}\n`);
  let total = 0;
  for (const r of report) {
    total += r.changed;
    log(`  ${r.file.padEnd(56)} ${String(r.regions).padStart(2)} region(s)` +
      (r.changed ? `   ${r.changed} REWRITTEN` : '   up to date'));
  }
  log(write
    ? `\n  wrote ${total} region(s).`
    : `\n  ${total} region(s) would change. Pass --write to apply.`);
}

module.exports = { WORDS, word, Word, facts, TEMPLATES, TARGETS, renderText, run, RE };
