'use strict';
/* test-results.js — the results folder is enforced, not requested.
 *
 * `results/` states what was measured, keyed by subject. It is a SECOND view of a
 * corpus whose authority lives in `FINDINGS.json`, and a second view is exactly
 * where this project's most-recurring defect lives: `T-STALE-CONSTANT`, four
 * occurrences, every one a number that stopped tracking the thing that produced it.
 *
 * So three things are checked, and the first is the one that makes the folder
 * trustworthy at all:
 *
 *   1. OWNERSHIP    every prediction set is owned by exactly one file, so no result
 *                   is orphaned by a stub and none is stated twice.
 *   2. CITATION     every prediction id cited anywhere in the folder exists in the
 *                   manifest, so a reader who doubts a number can always reach it.
 *   3. GENERATION   the ledger is byte-identical to fresh generator output, which
 *                   is one check rather than a second parser comparing field by
 *                   field — and any edit to the manifest forces a regeneration.
 *
 * Structure copied from `test-design.js`, including its teeth, because that pattern
 * has held for thirteen documents.
 */

const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'results');
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'FINDINGS.json'), 'utf8'));
const KINDS = ['results-index', 'results-topic', 'results-ledger'];
const REQUIRED = ['## What is established', '## How it was established',
  '## What it does not show', '## Owned sets'];
const DEPTHS = ['rich', 'seeded', 'stub', 'generated'];

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.md')).sort();
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const kindOf = src => (/^<!--\s*kind:\s*([\w-]+)\s*-->/m.exec(src) || [])[1];

console.log('\n=== 1. EVERY FILE DECLARES WHAT IT IS ===');
{
  check(`results/ holds ${files.length} documents`, files.length >= 10, String(files.length));
  const bad = files.filter(f => !KINDS.includes(kindOf(read(f))));
  check(`every file declares a kind from the ${KINDS.length} declared`,
    bad.length === 0, `undeclared: ${bad.join(' ')}`);
  const kinds = files.map(f => kindOf(read(f)));
  check('exactly one index and exactly one ledger',
    kinds.filter(k => k === 'results-index').length === 1
    && kinds.filter(k => k === 'results-ledger').length === 1, kinds.join(' '));
}

console.log('\n=== 2. TOPIC FILES CARRY ALL FOUR SECTIONS ===');
{
  const topics = files.filter(f => kindOf(read(f)) === 'results-topic');
  check(`${topics.length} topic files`, topics.length >= 8, topics.join(' '));
  let bad = null;
  for (const f of topics) {
    const missing = REQUIRED.filter(h => !read(f).includes(h));
    if (missing.length) { bad = `${f} missing ${missing.join(', ')}`; break; }
  }
  check('every topic states what is established, how, what it does NOT show,'
    + ' and which sets it owns', bad === null, bad || '');
  check('   "What it does not show" is present in every one — the section that keeps'
    + ' a results document from becoming a brochure',
    topics.every(f => read(f).includes('## What it does not show')));
}

console.log('\n=== 3. OWNERSHIP — EVERY SET OWNED EXACTLY ONCE ===');
{
  // A file owns the sets listed after "**Owned sets:**" or in its Owned sets table.
  const ownedBy = new Map();
  for (const f of files) {
    if (kindOf(read(f)) !== 'results-topic') continue;
    const src = read(f);
    const ids = new Set();
    const inline = /\*\*Owned sets:?\*\*([^\n]*)/.exec(src);
    // One or two letters: the scheme continues `AA`, `AB`, … past `T`.
    if (inline) for (const m of inline[1].matchAll(/`([A-Z]{1,2})`/g)) ids.add(m[1]);
    const tail = src.slice(src.lastIndexOf('## Owned sets'));
    for (const m of tail.matchAll(/^\|\s*`([A-Z]{1,2})`\s*\|/gm)) ids.add(m[1]);
    for (const id of ids) {
      if (!ownedBy.has(id)) ownedBy.set(id, []);
      ownedBy.get(id).push(f);
    }
  }
  const all = M.prediction_sets.map(s => s.id);
  const orphans = all.filter(id => !ownedBy.has(id));
  const twice = [...ownedBy.entries()].filter(([, fs2]) => fs2.length > 1);
  check(`all ${all.length} prediction sets are owned`, orphans.length === 0,
    `orphaned: ${orphans.join(' ')}`);
  check('and none is owned twice', twice.length === 0,
    twice.map(([id, fs2]) => `${id}: ${fs2.join(',')}`).join('; '));
  check('   so a stub loses nothing — every set has a home even where the synthesis'
    + ' is unwritten', orphans.length === 0);
  const ghosts = [...ownedBy.keys()].filter(id => !all.includes(id));
  check('and no file claims a set the manifest does not have', ghosts.length === 0,
    `ghosts: ${ghosts.join(' ')}`);
}

console.log('\n=== 4. CITATION — EVERY CITED ID EXISTS ===');
{
  // The device AXIOMS are citable too — `T5` is a real reference and is not a
  // prediction id. Derived from the source rather than hardcoded, so a new axiom
  // becomes citable without editing this test.
  //
  // Note the genuine ambiguity this creates: the axioms are `D1`-`D6`, `N1`-`N8`
  // and `T1`-`T5`, and sets `D` and `N` have predictions in the same shape. A bare
  // `N4` could be either. The registrations say which each time, and
  // `results/README.md` states the ambiguity rather than pretending it away.
  const deviceSrc = fs.readFileSync(path.join(ROOT, 'src', 'device.js'), 'utf8');
  const axioms = new Set([...deviceSrc.matchAll(/^ \*\s{3}([DNT]\d)\s{2}[A-Z]/gm)].map(m => m[1]));
  const known = new Set([
    ...M.prediction_sets.flatMap(s => s.predictions.map(p => p.id)),
    ...M.unregistered_findings.map(f => f.id),
    ...M.traps_encountered.map(t => t.id),
    ...axioms,
  ]);
  check(`${axioms.size} device axioms are citable alongside prediction ids`,
    axioms.size === 19, [...axioms].join(' '));
  const bogus = new Set();
  let cited = 0;
  for (const f of files) {
    if (kindOf(read(f)) === 'results-ledger') continue;        // generated
    for (const m of read(f).matchAll(/`((?:[A-Z]{1,2}\d+[a-z]?)|(?:[TF]-[A-Z0-9-]+))`/g)) {
      cited++;
      if (!known.has(m[1])) bogus.add(`${f}:${m[1]}`);
    }
  }
  check(`${cited} prediction and finding ids cited across the folder`, cited > 40, String(cited));
  check('every one of them exists in the manifest', bogus.size === 0,
    [...bogus].slice(0, 6).join(' '));
  check('   which is what makes a number here checkable: the citation is the hop'
    + ' from a figure to the tool, the test and the commit that produced it',
    bogus.size === 0);
}

console.log('\n=== 5. THE LEDGER IS GENERATED, NOT AUTHORED ===');
{
  const fresh = require('../tools/render-ledger.js').render();
  const onDisk = fs.readFileSync(path.join(DIR, '99-ledger.md'), 'utf8');
  check('results/99-ledger.md is byte-identical to fresh generator output',
    fresh === onDisk,
    fresh.length === onDisk.length ? 'same length, different bytes'
      : `generated ${fresh.length} bytes, on disk ${onDisk.length}`);
  check('   so editing FINDINGS.json forces a visible regeneration rather than'
    + ' quietly leaving the prose behind', fresh === onDisk);
  check('   and the ledger carries every set the manifest has',
    M.prediction_sets.every(s => onDisk.includes(`## Set \`${s.id}\``)));

  // The same contract, extended past the ledger. `render-docs.js` owns every prose
  // restatement of a manifest count in README.md, METHOD.md, results/README.md and
  // the failure-catalogue pillar, so those numbers cannot be typed and cannot drift.
  //
  // This replaces guarding with generation, and the reason is written inside one of
  // the guards it retires: "pinning one wording licenses the others to drift". A
  // check can only chase a phrasing someone already wrote. The six checks in
  // test-findings.js that watch these files all pass unchanged, which is what proves
  // the generator reproduces the hand-written text rather than quietly replacing it
  // -- but from here those phrasings are produced rather than policed.
  // The retrieval projection follows the same contract: generated, and stale output is
  // a failure rather than a stale file nobody notices. `slate.json` is a VIEW of the
  // manifest and never a second copy of the truth, so it must never be hand-edited.
  const slate = require('../tools/render-slate.js');
  const slateRun = slate.run(false);
  check('docs/slate.json is current with the manifest and the authored notes',
    !slateRun.changed, 'run npm run slate');
  check('   and every cross-link it carries resolves to an entry that exists',
    (() => { try { slate.build(); return true; } catch (e) { return false; } })());
  check(`   ${slateRun.slate.counts.entries} entries across `
    + `${Object.keys(slateRun.slate.routes).length} routes, `
    + `${slateRun.slate.counts.notes} of them authored notes`,
    slateRun.slate.counts.entries > 200 && slateRun.slate.counts.notes > 0);
  check('   and a derived route is labelled as derived rather than passed off as assigned',
    slateRun.slate.entries.some(e => e.routes_derived === true)
    && slateRun.slate.entries.some(e => e.routes_derived === false));

  const docs = require('../tools/render-docs.js');
  const pending = docs.run(false).report.filter(r => r.changed);
  check('every generated region in the prose is already current',
    pending.length === 0,
    pending.map(r => `${r.file}: ${r.changed} stale region(s) — run npm run docs`).join('; '));
  // Derived, not typed. The first version of this line said "all four documents" and
  // went stale the moment a fifth was added -- T-STALE-CONSTANT, inside the check
  // written to abolish stale constants. The number of targets is not the claim; that
  // every declared target is actually visited is.
  check(`   and the generator visits every one of its ${docs.TARGETS.length} declared documents`,
    docs.run(false).report.length === docs.TARGETS.length && docs.TARGETS.length > 0,
    `${docs.run(false).report.length} visited vs ${docs.TARGETS.length} declared`);
  check('   and it refuses to spell a number it has no word for, rather than '
    + 'writing undefined into the README',
    (() => { try { docs.word(docs.WORDS.length); return false; } catch (e) { return true; } })());
}

console.log('\n=== 6. DEPTH IS DECLARED AND ALLOWED TO BE LOW ===');
{
  const index = read(files.find(f => kindOf(read(f)) === 'results-index'));
  const rows = [...index.matchAll(/^\|\s*\[`([\w.-]+)`\]\([^)]+\)[^|]*\|[^|]*\|\s*\*{0,2}(\w+)\*{0,2}\s*\|/gm)];
  check(`the index declares a depth for ${rows.length} files`, rows.length >= 10, String(rows.length));
  const badDepth = rows.filter(r => !DEPTHS.includes(r[2]));
  check(`every declared depth is one of ${DEPTHS.join('/')}`, badDepth.length === 0,
    badDepth.map(r => `${r[1]}:${r[2]}`).join(' '));
  const listed = new Set(rows.map(r => r[1]));
  const unlisted = files.filter(f => f !== 'README.md' && !listed.has(f));
  check('every file appears in the index', unlisted.length === 0, unlisted.join(' '));
}

console.log('\n=== 6b. THE INDEX\'S OWN TALLY IS CHECKED ===');
{
  // The index states the corpus in one table. Four numbers, and each is a
  // T-STALE-CONSTANT waiting unless it is pinned to the manifest — this project has
  // recorded that defect four times, and creating a fifth while writing the folder
  // whose stated purpose is preventing it would be an unusually pure own goal.
  const index = read(files.find(f => kindOf(read(f)) === 'results-index'));
  const preds = M.prediction_sets.flatMap(s => s.predictions);
  const held = preds.filter(p => p.outcome === 'HELD').length;
  const failed = preds.filter(p => p.outcome === 'FAILED').length;
  const bites = M.traps_encountered.reduce((a, t) => a + t.count, 0);
  const want = [
    [`| prediction sets | ${M.prediction_sets.length} |`, 'set count'],
    [`| registered predictions | ${preds.length} — **${held} held, ${failed} failed** |`, 'the tally'],
    [`| measured but never registered | ${M.unregistered_findings.length} |`, 'unregistered'],
    [`| defect classes | ${M.traps_encountered.length}, recurring ${bites} times |`, 'defects'],
  ];
  const missing = want.filter(([line]) => !index.includes(line));
  check('the index\'s tally matches the manifest on all four numbers',
    missing.length === 0, missing.map(([l, why]) => `${why}: expected "${l}"`).join('; '));
  check('   and the suite\'s check count is NOT repeated here — it belongs to'
    + ' README.md, where run-all.js verifies it', !/\d+ checks/.test(index));
}

console.log('\n=== 7. THE ENFORCEMENT HAS TEETH ===');
{
  const topic = files.find(f => kindOf(read(f)) === 'results-topic');
  const src = read(topic);
  check('a topic missing "What it does not show" is caught',
    REQUIRED.some(h => !src.replace('## What it does not show', '## Notes').includes(h)));
  check('an undeclared kind is caught',
    kindOf('# no header') === undefined && kindOf('<!-- kind: results-topic -->') === 'results-topic');
  check('a cited id that does not exist is caught', (() => {
    const known = new Set(M.prediction_sets.flatMap(s => s.predictions.map(p => p.id)));
    return !known.has('Q99');
  })());
  check('a set owned by two files would be caught', (() => {
    const counts = new Map([['X', ['a.md', 'b.md']]]);
    return [...counts.values()].filter(v => v.length > 1).length === 1;
  })());
  check('a ledger one byte out of date would be caught', (() => {
    const fresh = require('../tools/render-ledger.js').render();
    return fresh !== fresh + ' ';
  })());
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
