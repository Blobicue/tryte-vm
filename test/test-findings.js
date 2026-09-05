'use strict';
/* test-findings.js — FINDINGS.json must agree with the repository.
 *
 * The manifest exists so an agent can ingest every claim this repo makes without
 * reading 600 lines of prose. That is only worth anything if the manifest cannot
 * drift, so this checks four things:
 *
 *   1. COMPLETENESS   every prediction registered in a tool's docstring appears
 *                     in the manifest, and nothing appears that is not registered
 *   2. NUMBERS        the cheap measured values are recomputed from the same
 *                     library the suites use
 *   3. CHRONOLOGY     each registering commit really precedes its results commit,
 *                     which is what makes "registered before the run" checkable
 *   4. REFERENCES     each named test file exists and mentions the finding
 *
 * The expensive sweeps are NOT re-run here. test-monoid.js already pins them;
 * this checks the manifest agrees with the pinned constants.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'FINDINGS.json'), 'utf8'));
const allPreds = M.prediction_sets.flatMap(s => s.predictions.map(p => ({ ...p, set: s })));

console.log('\n=== 1. STRUCTURE ===');
check('the manifest declares its schema', M.schema === 'tryte-vm/findings@1');
check('every outcome is one of the three declared values',
  allPreds.every(p => p.outcome in M.outcome_values) &&
  M.unregistered_findings.every(f => f.outcome in M.outcome_values));
check('the three outcome values are HELD, FAILED and MEASURED_NOT_REGISTERED',
  ['HELD', 'FAILED', 'MEASURED_NOT_REGISTERED'].every(k => k in M.outcome_values));
// Derived, not hardcoded: this file exists to catch stale constants and had one.
check(`${allPreds.length} registered predictions across ${M.prediction_sets.length} sets`,
  allPreds.length > 0 && M.prediction_sets.length > 0 &&
  new Set(M.prediction_sets.map(s => s.tool)).size === M.prediction_sets.length,
  'one set per tool');
// The roll-call used to be a literal list and went stale the moment a new failure
// was recorded -- T-STALE-CONSTANT inside the suite that exists to catch it. What
// matters is not WHICH ids failed but that none of them quietly became HELD, so
// the check is now that the failed set only ever grows.
const FAILED_AS_OF_SET_A = ['P3', 'X2', 'Z2', 'E4', 'E5', 'H1', 'J4', 'A2'];
{
  const failedNow = allPreds.filter(p => p.outcome === 'FAILED').map(p => p.id);
  const vanished = FAILED_AS_OF_SET_A.filter(id => !failedNow.includes(id));
  check(`the failures are kept, not corrected away (${failedNow.length}: ${failedNow.join(', ')})`,
    vanished.length === 0, `no longer FAILED: ${vanished.join(' ')}`);
}
// Two ids were duplicated in this manifest and nothing noticed, because nothing
// looked. F-GATES-FROM-SWITCHES appeared twice identically and
// T-SOURCE-NOT-TERMINAL twice with two words different -- a merge artifact that
// would have gone on inflating the trap count.
check('no id appears twice — not in the sets, the findings, or the traps', (() => {
  const groups = [allPreds.map(p => p.id), M.prediction_sets.map(s => s.id),
    M.unregistered_findings.map(f => f.id), M.traps_encountered.map(t => t.id)];
  return groups.every(g => new Set(g).size === g.length);
})(), 'duplicate id');
check('unregistered findings are listed separately, not counted as predictions',
  M.unregistered_findings.length > 0 &&
  M.unregistered_findings.every(f => f.outcome === 'MEASURED_NOT_REGISTERED'));

console.log('\n=== 2. COMPLETENESS AGAINST THE TOOLS ===');
{
  // Read the ids straight out of each tool's registration block. If a prediction
  // is added to a tool and not to the manifest, or vice versa, this fails.
  const found = new Set();
  for (const s of M.prediction_sets) {
    const src = fs.readFileSync(path.join(ROOT, s.tool), 'utf8');
    // Tools are no longer all JavaScript. A training harness has to live where the
    // GPU is, so bench/grok.py registers its predictions in a Python docstring —
    // same discipline, different comment syntax. A checker that knows only one
    // language reports the set as inventing predictions when the set is fine and
    // the checker cannot read it, which is what happened the moment AM landed.
    const py = s.tool.endsWith('.py');
    const from = src.indexOf('PREDICTED OUTCOMES');
    const to = py ? src.indexOf('"""', from) : src.indexOf(' */');
    const block = src.slice(from, to === -1 ? undefined : to);
    // Ids may carry a lowercase suffix — `B1a`/`B1b` are two conditions of one
    // claim, registered separately because they were predicted to differ. The
    // original pattern matched `[A-Z]\d+` followed by exactly two spaces, so it
    // silently could not see a suffixed id at all: the manifest looked as though it
    // had invented predictions no tool registered. A checker that cannot parse a
    // legal id reports the corpus as wrong rather than itself.
    // (A first attempt at widening this added a `(?=[A-Z])` lookahead, which
    // assumed every claim opens with a capital. Several do not, and fifteen older
    // ids vanished from the corpus at once — the fix broke more than the bug.)
    // Set ids run out of single letters at `T`. After that the scheme continues
    // `AA`, `AB`, `AC`, … — two letters, which collide with nothing, because no
    // design document uses a two-letter option prefix. This is where that was
    // pre-announced, one set in advance, rather than arriving as a rider.
    const pat = py ? /^\s{2}([A-Z]{1,2}\d+[a-z]?)\s/gm : /^ \*\s{3}([A-Z]{1,2}\d+[a-z]?)\s/gm;
    for (const m of block.matchAll(pat)) found.add(m[1]);
  }
  const declared = new Set(allPreds.map(p => p.id));
  const missing = [...found].filter(id => !declared.has(id));
  const extra = [...declared].filter(id => !found.has(id));
  check(`every id registered in a tool is in the manifest (${found.size} found)`,
    missing.length === 0, `missing: ${missing.join(' ')}`);
  check('the manifest invents no predictions the tools never registered',
    extra.length === 0, `extra: ${extra.join(' ')}`);
}

console.log('\n=== 3. THE NUMBERS, RECOMPUTED ===');
{
  const { arena, audit, reach, reachByLaw, vocabularies, topSinglePos, topFixed, addTable } =
    require('../tools/monoid-lib.js');
  const T = require('../src/ternary.js');
  const { interpSize, maxDepth } = require('../src/selfhost.js');
  const get = id => allPreds.find(p => p.id === id).measured;

  check('P2 — TGATE reach at widths 1..3', (() => {
    const m = get('P2');
    return reach('all', 1).total === m.reach_w1 && reach('all', 2).total === m.reach_w2
      && reach('all', 3).total === m.reach_w3;
  })());
  check('P3 — the failure is still a failure', (() => {
    const m = get('P3');
    return reach('all', 2).total === m.actual_w2 && m.actual_w2 !== m.predicted_w2;
  })());
  check('P5 — width-6 reach is 77,687 and the claim was 531,441', (() => {
    const m = get('P5');
    return reachByLaw(6) === m.actual && m.claimed_by_source_conversation === 531441;
  })());
  check('Q1 — pinned TOP reaches 27 at every width', (() => {
    const m = get('Q1');
    return [1, 2, 3].every(w => audit(topFixed(arena(w)), arena(w).N).total === m.reach_any_width);
  })());
  check('Q3 — free TOP reaches 27^w', (() => {
    const m = get('Q3');
    return [['reach_w1', 1], ['reach_w2', 2], ['reach_w3', 3]]
      .every(([k, w]) => audit(topSinglePos(arena(w)), arena(w).N).total === m[k]);
  })());
  check('Q5 — the width-6 positionwise ceiling', get('Q5').ceiling === 27 ** 6);
  check('R2 — 27 more positionwise generators buy nothing', (() => {
    const A = arena(2), m = get('R2');
    return audit(topSinglePos(A).concat(topFixed(A)), A.N).total === m.reach_w2 && m.elements_bought === 0;
  })());
  check('R4 — one shift reaches 801', (() => {
    const A = arena(2), m = get('R4');
    const shl = Array.from({ length: A.N }, (_, i) => A.idx(A.val(i) * 3));
    return audit(topSinglePos(A).concat([shl]), A.N).total === m.reach_w2;
  })());
  check('R3 and U2 agree on 251,505', get('R3').reach_w2 === get('U2').reach_w2);
  check('V3 — 531,441, matching the constant test-monoid pins',
    get('V3').reach_w2 === 531441 && 531441 === 9 ** 6);
  check('U1 — 81 tables match ADD at one input pair', (() => {
    let c = 0;
    for (let i = 0; i < 19683; i++) {
      const tbl = []; let n = i;
      for (let k = 0; k < 9; k++) { tbl.push((n % 3) - 1); n = Math.floor(n / 3); }
      if (T.ttable(tbl, 123, -45) === T.add(123, -45)) c++;
    }
    return c === get('U1').tables_matching_at_one_input_pair;
  })());
  check('U3 — the core interpreter cell count', get('U3').core_cells === interpSize('core'));
  check('   and the core still reaches depth 4', maxDepth('core') === 4);
  check('F-ADD-IS-A-TABLE — ADD really is TOPC with the addition table', (() => {
    const t = T.addCarryTable();
    for (let x = T.TRYTE_MIN; x <= T.TRYTE_MAX; x += 13) {
      for (let y = T.TRYTE_MIN; y <= T.TRYTE_MAX; y += 17) {
        if (T.ttableC(t, x, y) !== T.add(x, y)) return false;
      }
    }
    return true;
  })());
}

console.log('\n=== 4. CHRONOLOGY — registration really came first ===');
{
  let git = true;
  const run = a => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
  try { run(['rev-parse', '--git-dir']); } catch { git = false; }
  if (!git) {
    check('git history unavailable, chronology unchecked (not a pass)', false, 'no .git');
  } else {
    // PENDING is the manifest's own word for 'the results commit exists, the commit
    // that pins its hash does not yet' -- the reachability check below already skips
    // it and this one never learned to, so a results commit could not be cut without
    // failing its own suite. Skipped here, and bounded by the check underneath so it
    // cannot quietly become a permanent hole.
    for (const s of M.prediction_sets) {
      if (s.results_at === 'PENDING') continue;
      let ok = false, why = '';
      try {
        run(['cat-file', '-e', `${s.registered_at}^{commit}`]);
        run(['cat-file', '-e', `${s.results_at}^{commit}`]);
        execFileSync('git', ['merge-base', '--is-ancestor', s.registered_at, s.results_at], { cwd: ROOT });
        ok = true;
      } catch (e) { why = e.message.split('\n')[0]; }
      check(`set ${s.id}: ${s.registered_at} precedes ${s.results_at}`, ok, why);
    }
    {
      const pending = M.prediction_sets.filter(s => s.results_at === 'PENDING');
      const last = M.prediction_sets[M.prediction_sets.length - 1];
      check('an unpinned results_at is allowed only on the newest set, and only one of them',
        pending.length === 0 || (pending.length === 1 && pending[0] === last),
        pending.map(s => s.id).join(' ') || '');
    }
    check('no registration commit contains its own result', (() => {
      // The registering commit for the P set must not mention the number it went
      // on to measure; that is what "no measurement in this commit" means.
      const body = run(['show', '-s', '--format=%B', M.prediction_sets[0].registered_at]);
      return !/77,?687/.test(body);
    })());
  }
}

console.log('\n=== 5. REFERENCES ===');
{
  const targets = [...M.prediction_sets.map(s => [s.id, s.asserted_in, s.tool]),
    ...M.unregistered_findings.map(f => [f.id, f.asserted_in, null])];
  let missingFile = null, missingMention = null;
  for (const [id, file, tool] of targets) {
    if (!fs.existsSync(path.join(ROOT, file))) { missingFile = `${id} -> ${file}`; break; }
    if (tool && !fs.existsSync(path.join(ROOT, tool))) { missingFile = `${id} -> ${tool}`; break; }
  }
  check('every asserted_in and tool path exists', missingFile === null, missingFile || '');
  for (const s of M.prediction_sets) {
    const body = fs.readFileSync(path.join(ROOT, s.asserted_in), 'utf8');
    const absent = s.predictions.filter(p => !body.includes(p.id));
    if (absent.length) { missingMention = `${s.id}: ${absent.map(p => p.id).join(' ')} not mentioned in ${s.asserted_in}`; break; }
  }
  check('every prediction id is mentioned in the test that asserts it',
    missingMention === null, missingMention || '');
  check('every trap has a description and a count',
    M.traps_encountered.every(t => t.id && t.description && typeof t.count === 'number'));

  // Every recorded hash must be REACHABLE FROM HEAD, not merely present in the
  // object store. Set B's results_at was written as the results commit's hash and
  // that commit was then amended, so the recorded hash became a dangling object:
  // `git cat-file -e` still found it locally and the chronology check passed, while
  // on any fresh clone the hash does not exist and the suite fails. A check that
  // passes only in the working copy that created the record is worse than none.
  {
    const unreachable = [];
    for (const s of M.prediction_sets) {
      for (const [field, hash] of [['registered_at', s.registered_at], ['results_at', s.results_at]]) {
        if (!hash || hash === 'PENDING') continue;
        try { execFileSync('git', ['merge-base', '--is-ancestor', hash, 'HEAD'], { cwd: ROOT, stdio: 'pipe' }); }
        catch (e) { unreachable.push(`${s.id}.${field}=${hash}`); }
      }
    }
    check(`every recorded commit is an ancestor of HEAD, not just present locally`,
      unreachable.length === 0, `unreachable: ${unreachable.join(' ')}`);
    check('   and a hash that is not an ancestor would be caught', (() => {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor',
          '0000000000000000000000000000000000000000', 'HEAD'], { cwd: ROOT, stdio: 'pipe' });
        return false;
      } catch (e) { return true; }
    })());
  }

  // The manifest is the ledger; AGENTS.md is the version an agent actually reads
  // before working here. They drifted: four classes sat in the ledger and were
  // never written up, so the operational document was a phase and a half behind the
  // record. A trap nobody is warned about is not an antibody. Each paragraph in
  // AGENTS.md now carries its id, which is what makes this checkable at all.
  //
  // One-directional on purpose: AGENTS.md may carry traps with no manifest entry —
  // the build-artifact one has never been a registered prediction's failure — but
  // it may not omit one the manifest has.
  {
    const AGENTS = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
    const unwritten = M.traps_encountered.filter(t => !AGENTS.includes('`' + t.id + '`'));
    check(`all ${M.traps_encountered.length} trap classes are written up in AGENTS.md`,
      unwritten.length === 0, `no prose for: ${unwritten.map(t => t.id).join(' ')}`);
    // Teeth: run the actual filter over the manifest plus a class that is not
    // written up, and assert it comes back non-empty. The first version asserted
    // `!AGENTS.includes('T-NOT-A-REAL-TRAP')`, which is true of any file that does
    // not happen to contain that string — it demonstrated nothing about whether the
    // detector fires on a real omission.
    check('   and a class in the ledger with no paragraph would be caught', (() => {
      const withGap = [...M.traps_encountered, { id: 'T-NOT-A-REAL-TRAP' }];
      return withGap.filter(t => !AGENTS.includes('`' + t.id + '`')).length === 1;
    })());
  }

  // The README's summary of this manifest went stale, twice. Derive it instead.
  // The total check count is checked in run-all.js, which is the only place the
  // sum of all suites exists.
  {
    const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const held = allPreds.filter(p => p.outcome === 'HELD').length;
    const failedCount = allPreds.filter(p => p.outcome === 'FAILED').length;
    const stated = /\*\*(\d+) held, (\d+) failed\*\*/.exec(README);
    check(`the README's tally matches the manifest: ${held} held, ${failedCount} failed`,
      stated !== null && Number(stated[1]) === held && Number(stated[2]) === failedCount,
      stated ? `README says ${stated[1]} held, ${stated[2]} failed` : 'README states no tally');
    // A set's first prediction is not always numbered 1: set `M` opens with `M0`,
    // the instrument check, deliberately numbered zero because it must pass before
    // any claim may rest on it. This assumed `**<id>1` and reported the README as
    // missing a set it names in full.
    const unnamed = M.prediction_sets.filter(s =>
      !s.predictions.some(p => README.includes(`**${p.id}`)));
    check('the README names every prediction set in the manifest',
      unnamed.length === 0, `missing: ${unnamed.map(s => s.id).join(' ')}`);
    // One set per tool is checked above, so the audit count is the tool count.
    // It is written out in words in two places and had already drifted once.
    // Anchored on those two phrasings rather than on any mention of the word,
    // because the README also says the ceiling ladder took six audits, which is
    // a different and still-true number.
    // ONE spelling table, imported rather than copied. This file kept its own and it
    // stopped at fifty; the manifest reached fifty-one unregistered findings and the
    // check began asserting that METHOD.md says "undefined findings". T-STALE-CONSTANT,
    // inside the suite that exists to catch it, for the second time -- and a second copy
    // of a fact is a second thing to disagree, which is why render-docs owns it.
    // Note the SHAPE of the failure: the check did not go quiet, it started demanding a
    // sentence nothing could ever write. A guard that fails CLOSED is the survivable
    // version of this defect and it is why the drift was visible at all.
    // MUTATION-TESTED after the change, because a check just edited is a check nobody
    // has seen fail: replacing METHOD.md's 'Fifty-one findings' with 'Fifty' turns this
    // red with the expected string quoted, and restoring it turns it green.
    const { WORDS } = require('../tools/render-docs.js');
    // An audit is a tool a set names, wherever it lives. This globbed tools/*-audit.js
    // until a set's tool had to live beside the GPU it runs on -- bench/grok.py --
    // at which point the count read one short and the check reported the corpus as
    // wrong rather than its own assumption about where a tool may sit. Count the
    // tools/ files AND anything else the manifest names, so the number is the number
    // of audits rather than the number in one directory.
    const inTools = fs.readdirSync(path.join(ROOT, 'tools')).filter(f => /-audit\.js$/.test(f));
    const elsewhere = [...new Set(M.prediction_sets.map(x => x.tool))]
      .filter(t => !t.startsWith('tools/')).map(t => path.basename(t));
    const onDisk = [...inTools, ...elsewhere];
    // Sets must all have tools; tools need not yet have sets. Between registering
    // a tool's predictions and recording its results the counts differ by one on
    // purpose, and that gap is exactly what a registration commit IS. This check
    // fired on that gap the first time it met one, which was right of it -- what
    // was wrong was demanding equality. The pending tool is named instead.
    const claimed = new Set(M.prediction_sets.map(x => path.basename(x.tool)));
    const pending = onDisk.filter(f => !claimed.has(f));
    check(`tools/ holds ${onDisk.length} audits; ${M.prediction_sets.length} have results`
      + `${pending.length ? `, awaiting ${pending.join(' ')}` : ''}`,
      onDisk.length >= M.prediction_sets.length
      && [...claimed].every(f => onDisk.includes(f)),
      `${onDisk.length} files, ${M.prediction_sets.length} sets`);
    const word = WORDS[onDisk.length];
    check(`the README calls it "${word} audits" in both places that state the count`,
      README.includes(`${word} audits establishing`)
      && README.includes(`the ${word} audits, each with its registered predictions`),
      'one of the two mentions has drifted');

    // METHOD.md describes the loop that produced all of this, and quotes its own
    // totals to argue that the failures were worth more than the successes. A
    // document about not letting numbers drift is the last place a number should
    // drift, so its figures are checked against the manifest too.
    const METHOD = fs.readFileSync(path.join(ROOT, 'METHOD.md'), 'utf8');
    const failedIds = allPreds.filter(p => p.outcome === 'FAILED').map(p => p.id);
    const bites = M.traps_encountered.reduce((a, t) => a + t.count, 0);
    const claims = [
      [`${allPreds.length} registered predictions, ${held} held, ${failedCount} failed`, 'the tally'],
      [`${WORDS[M.prediction_sets.length]} prediction sets`, 'the set count'],
      [`**${bites} times**`, 'the total trap bites'],
      [`${WORDS[M.unregistered_findings.length]} findings measured but never registered`,
        'the unregistered count'],
    ];
    // Case-insensitive, and whitespace-normalised: prose wraps, and a claim
    // straddling a line break is still the claim.
    const lower = METHOD.toLowerCase().replace(/\s+/g, ' ');
    const missing = claims.filter(([text]) => !lower.includes(text.toLowerCase()));
    check('METHOD.md quotes the manifest correctly, or the build fails',
      missing.length === 0, missing.map(([t, why]) => `${why}: expected "${t}"`).join('; '));
    // Plain substring, not a regex: the first version built one out of `\*\*`,
    // which in a JS string is just `**` — an invalid pattern, and it threw.
    const named = id => METHOD.includes(`**${id}**`);
    check('   and it names every failed prediction, since its argument rests on them',
      failedIds.every(named), `missing: ${failedIds.filter(id => !named(id)).join(' ')}`);
    check('   and it counts the trap classes the manifest actually holds',
      lower.includes(`${WORDS[M.traps_encountered.length]} distinct failure classes`),
      `expected ${WORDS[M.traps_encountered.length]}`);

    // The check above pinned ONE phrasing of the trap count. METHOD.md stated the
    // same number twice more, in different words, and both went stale — "the twelve
    // classes that actually bit" and "trace the twelve sets" survived four phases
    // of growth while the pinned sentence stayed correct. T-STALE-CONSTANT, and the
    // lesson is specifically that pinning one wording licenses the others to drift.
    // So: no number-word may precede "classes" or "sets" unless it is the right one.
    const WORDSET = new Set(WORDS.map(w => w && w.toLowerCase()).filter(Boolean));
    const wrong = [];
    for (const [, word, noun] of lower.matchAll(/([\w-]+) (classes|sets)\b/g)) {
      if (!WORDSET.has(word)) continue;                 // not a count, just prose
      const right = noun === 'classes'
        ? WORDS[M.traps_encountered.length] : WORDS[M.prediction_sets.length];
      if (word !== right.toLowerCase()) wrong.push(`"${word} ${noun}" should be "${right} ${noun}"`);
    }
    check('   and every OTHER restatement of those counts agrees too',
      wrong.length === 0, wrong.join('; '));

    // A count can be the right WORD over the wrong LIST. METHOD.md's catalogue says
    // "the fourteen classes that actually bit" and then tabulates them; the sweep
    // above would happily pass if the table held twelve rows. Count the list.
    const section = /## The failure catalogue[\s\S]*?(?=\n## )/.exec(METHOD);
    const rows = section ? (section[0].match(/^\| \*\*/gm) || []).length : -1;
    check(`   and the catalogue TABLE holds ${rows} rows, matching the ${M.traps_encountered.length} classes`,
      rows === M.traps_encountered.length, `${rows} rows vs ${M.traps_encountered.length} classes`);

    // The same drift, one directory over. The doctree's own doctrine is "pillars
    // link, they do not copy" — and pillar 11 copied, then went stale in FIVE
    // places at once while every doctree check passed, because those checks test
    // structure (depth vocabulary, required sections) and not arithmetic. Any
    // document that restates a manifest count is subject to the same sweep.
    const DOCTREE = path.join(ROOT, '.claude', 'knowledge', 'doctrees', 'tryte-vm');
    const COUNTED = { classes: M.traps_encountered.length, sets: M.prediction_sets.length,
      occurrences: bites, bites };
    const drifted = [];
    for (const f of ['11-failure-catalogue.md', '_overview.md', '09-unbuilt-machine.md']) {
      const text = fs.readFileSync(path.join(DOCTREE, f), 'utf8')
        .toLowerCase().replace(/\s+/g, ' ');
      for (const [, word, noun] of text.matchAll(/([\w-]+?)[- ](classes|sets|occurrences|bites)\b/g)) {
        if (!WORDSET.has(word)) continue;
        const right = WORDS[COUNTED[noun]];
        if (right && word !== right.toLowerCase()) drifted.push(`${f}: "${word} ${noun}" -> "${right}"`);
      }
    }
    check('   and the doctree pillars that restate these counts agree as well',
      drifted.length === 0, drifted.join('; '));

    // AND THE ONE FAMILY OF DOCUMENTS THIS SWEEP HAD NEVER REACHED: results/ topic
    // files. Set `AU` put two corpus tallies into a topic file -- "the nineteen
    // classes", "21 recorded bites" -- inside a paragraph arguing that the corpus's own
    // counting is unreliable, and asserted in a commit message that this sweep guarded
    // them. It did not: nothing in test/ or tools/ reads results/06-economics.md, and
    // render-docs's TARGETS does not list it. The numbers were right and unguarded.
    //
    // THE DISTINCTION IS NOT GUARDED VERSUS UNGUARDED, IT IS FROZEN VERSUS ROTTING.
    // Every number in every topic file is unguarded and almost all of them should be:
    // a MEASURED value in prose cannot rot -- 0.4642 is what the fit gave and always
    // will be. A CORPUS TALLY rots by construction, because the corpus grows.
    //
    // So this cannot be the sweep above with a longer file list. Run that way it fires
    // on "six sets", "four sets" and "two sets" in three topic files, which are
    // SUB-COUNTS -- a file owning six sets, a pair of sets being two -- and every one is
    // correct. That is T-CHECK-FORBIDS-HEALTHY-STATE, and it is why this class had no
    // check rather than an oversight: in a topic file a number before "sets" is usually
    // a legitimate subset. The discriminator is not the noun, it is TOTALITY -- a claim
    // about every member of a corpus collection is a restatement of its count and
    // nothing else.
    const TOTAL_RE =
      /(?:every one of the|all of the|each of the|the whole)\s+([\w-]+)\s+(classes|sets|occurrences|bites|findings)\b/g;
    const COUNTED_ALL = Object.assign({ findings: M.unregistered_findings.length }, COUNTED);
    const topics = fs.readdirSync(path.join(ROOT, 'results'))
      .filter(f => f.endsWith('.md'))
      .filter(f => /kind: results-topic/.test(
        fs.readFileSync(path.join(ROOT, 'results', f), 'utf8')));
    const scan = (text) => {
      const out = [];
      for (const [, word, noun] of text.toLowerCase().replace(/\s+/g, ' ').matchAll(TOTAL_RE)) {
        if (!WORDSET.has(word)) continue;
        const right = WORDS[COUNTED_ALL[noun]];
        if (right && word !== right.toLowerCase()) out.push(`"${word} ${noun}" -> "${right}"`);
      }
      return out;
    };
    const rotted = [];
    for (const f of topics) {
      for (const bad of scan(fs.readFileSync(path.join(ROOT, 'results', f), 'utf8'))) {
        rotted.push(`${f}: ${bad}`);
      }
    }
    check(`   and no results/ topic file states a corpus TOTAL that has gone stale `
      + `(${topics.length} topic files swept)`,
      rotted.length === 0 && topics.length >= 9, rotted.join('; '));
    // A TRIPWIRE WITH NOTHING CURRENTLY UNDER IT IS STILL A TRIPWIRE, but only if it is
    // shown to fire -- "a test that cannot fail is worse than no test, because it reads
    // as coverage". The offending sentence was removed at 3529655, so the positive
    // control carries it instead, with the count one short.
    check('      and that sweep FIRES on the sentence AU removed, with a stale count, '
      + 'while leaving legitimate sub-counts alone',
      scan(`if it holds, every one of the ${WORDS[M.traps_encountered.length - 1]} classes undercounts`).length === 1
      && scan('this file owns six sets, and AS and AT are two sets').length === 0
      && scan(`every one of the ${WORDS[M.traps_encountered.length]} classes`).length === 0);
    // AND THE NEGATIVE CONTROL IS NOT THAT STRING -- IT IS ALREADY IN THE CORPUS. The
    // topic files carry real sub-counts today ("six sets", "four sets", "two sets"), and
    // a tripwire with real traffic under it that it correctly ignores is worth more than
    // one with nothing under it. Pinned as the DISCRIMINATOR rather than as a tally,
    // because how many sub-counts the corpus happens to contain is exactly the kind of
    // number that rots: the naive noun-based sweep must fire on the swept files and the
    // totality sweep must not. That also guards the narrowing itself. The comment above
    // says this check cannot be the doctree sweep with a longer file list; this is what
    // fails if someone widens it anyway and reintroduces the false positives.
    const naive = (text) => {
      const out = [];
      for (const [, word, noun] of text.toLowerCase().replace(/\s+/g, ' ')
        .matchAll(/([\w-]+?)[- ](classes|sets|occurrences|bites)\b/g)) {
        if (!WORDSET.has(word)) continue;
        const right = WORDS[COUNTED_ALL[noun]];
        if (right && word !== right.toLowerCase()) out.push(`"${word} ${noun}"`);
      }
      return out;
    };
    const naiveHits = topics.flatMap(f =>
      naive(fs.readFileSync(path.join(ROOT, 'results', f), 'utf8')).map(h => `${f}: ${h}`));
    check('      and the corpus supplies the negative control the string cannot: the NAIVE '
      + `noun-based sweep flags ${naiveHits.length} legitimate sub-count(s) in these same `
      + 'files, every one correct, and the totality sweep flags none of them',
      naiveHits.length > 0 && rotted.length === 0,
      naiveHits.join('; '));

    // The sweep above needs the noun ("thirteen classes"). Run against pillar 11's
    // actual stale text it caught two of five: "about nine of the thirteen",
    // "whether the thirteen really are one" and "the nine-of-thirteen reduction"
    // all name the count with no noun attached, and all three survived.
    //
    // That file is the one document here whose subject IS a manifest count, so it
    // gets the stricter rule rather than a cleverer regex: inside it, a number-word
    // introduced by "the" or joined by "-of-" refers to the class count and must
    // equal it. Bare numbers elsewhere in the prose ("about nine of...") stay free,
    // because they are sub-counts and genuinely differ.
    const cat = fs.readFileSync(path.join(DOCTREE, '11-failure-catalogue.md'), 'utf8')
      .toLowerCase().replace(/\s+/g, ' ');
    const right = WORDS[M.traps_encountered.length].toLowerCase();
    const bare = [...cat.matchAll(/(?:\bthe (?!\w+-of-)|-of-)(\w+)\b/g)]
      .map(m => m[1]).filter(w => WORDSET.has(w) && w !== right);
    check(`   and bare references in the catalogue pillar all say "${right}"`,
      bare.length === 0, `stale: ${[...new Set(bare)].join(' ')}`);
    check('      (and that stricter rule catches what the noun sweep missed)', (() => {
      const old = 'about nine of the thirteen reduce; the nine-of-thirteen reduction';
      return [...old.matchAll(/(?:\bthe (?!\w+-of-)|-of-)(\w+)\b/g)]
        .map(m => m[1]).filter(w => WORDSET.has(w) && w !== right).length === 2;
    })());
    check('      (and that sweep would catch a wrong one)', (() => {
      const doctored = 'trace the two sets and the two classes';
      return [...doctored.matchAll(/([\w-]+) (classes|sets)\b/g)]
        .some(([, w, n]) => WORDSET.has(w)
          && w !== (n === 'classes' ? WORDS[M.traps_encountered.length]
            : WORDS[M.prediction_sets.length]).toLowerCase());
    })());
  }
  check('the one-point trap is recorded as having bitten three times',
    M.traps_encountered.find(t => t.id === 'T-ONE-POINT').count === 3);
}

console.log('\n=== 6. BASIS: MEASURED AT ONE WIDTH, OR ARGUED AT EVERY WIDTH ===');
{
  // A second axis, orthogonal to `outcome`. HELD/FAILED is the prediction against the
  // run. `basis` is the SCOPE of the claim: swept at the width it was swept at, or
  // argued for all of them. The corpus already contained proofs -- D2's lcm argument,
  // M1's counting of AGL(2,2), AK2's composition of bijections -- and simply had no
  // way to say so, which left a theorem indistinguishable from a lucky exhaustion.
  const BASES = ['measured', 'proven'];
  check('every prediction declares a basis, and it is one of the two',
    allPreds.every(p => BASES.includes(p.basis)),
    allPreds.filter(p => !BASES.includes(p.basis)).map(p => p.id).join(' '));

  const proven = allPreds.filter(p => p.basis === 'proven');
  // A label that costs nothing gets applied to everything. Claiming a proof requires
  // writing the argument down, and the argument has to be an argument rather than a
  // restatement of the claim.
  check(`${proven.length} of ${allPreds.length} predictions are proven, and each carries `
    + 'its argument in the manifest',
    proven.length > 0 && proven.every(p => typeof p.argument === 'string' && p.argument.length > 80),
    proven.filter(p => !(p.argument || '').length).map(p => p.id).join(' '));
  check('   and a proof does not excuse a measurement — every proven claim was still run',
    proven.every(p => p.measured && Object.keys(p.measured).length > 0),
    proven.filter(p => !p.measured || !Object.keys(p.measured).length).map(p => p.id).join(' '));
  check('   and the argument does not just repeat the claim back',
    proven.every(p => p.argument.toLowerCase() !== p.claim.toLowerCase()));
  // Adding the axis must not quietly relabel a result. The failed set is checked above
  // for shrinkage; this pins the other direction — basis is additive, never corrective.
  check('   and no proven claim is a failed one, because an argument that survived a '
    + 'refutation would be an argument with a hole in it',
    proven.every(p => p.outcome !== 'FAILED'),
    proven.filter(p => p.outcome === 'FAILED').map(p => p.id).join(' '));

  const provenFindings = M.unregistered_findings.filter(f => f.basis === 'proven');
  check(`   and ${provenFindings.length} unregistered finding(s) carry it too, argument included`,
    provenFindings.every(f => typeof f.argument === 'string' && f.argument.length > 40));
  check('   the reversibility corollary among them, since it is derivable rather than '
    + 'discovered and registering it would have been decoration',
    M.unregistered_findings.some(f => f.id === 'F-REVERSIBLE-CANNOT-DESTROY'
      && f.basis === 'proven'));
}

console.log('\n=== 7. THE SCAFFOLD PRODUCES PAPERWORK THIS FILE CAN READ ===');
{
  // tools/scaffold-set.js emits the fixed shape a new set needs. A generator whose
  // output this validator cannot parse would hand every future set a registration
  // reported here as inventing predictions -- so the loop is closed: the scaffold's
  // PREDICTED OUTCOMES block is read back with the SAME pattern used above on the
  // real tools, and must yield exactly the four ids it claims.
  const S = require('../tools/scaffold-set.js');
  const used = M.prediction_sets.map(s => s.id);
  check('the next set id is derived from the manifest, not typed',
    !used.includes(S.nextId(used)) && S.nextId(used).length <= 2);
  check('   and it fills a gap rather than always appending',
    S.nextId(['A', 'B', 'D']) === 'C');

  const demo = S.scaffold('ZZ', 'a question', 'demo');
  const vmod = require('vm');
  for (const f of demo.files) {
    check(`   and its ${f.path.split('/')[0]}/ output is syntactically valid JavaScript`,
      (() => { try { new vmod.Script(f.body); return true; } catch (e) { return false; } })());
  }
  const tool = demo.files.find(f => f.path.startsWith('tools/')).body;
  const at = tool.indexOf('PREDICTED OUTCOMES');
  const block = tool.slice(at, tool.indexOf(' */', at));
  const ids = [...block.matchAll(/^ \*\s{3}([A-Z]{1,2}\d+[a-z]?)\s/gm)].map(m => m[1]);
  check('   and the registration block it writes parses to exactly ZZ1..ZZ4',
    ids.join(' ') === 'ZZ1 ZZ2 ZZ3 ZZ4', ids.join(' '));
  check('   and the manifest entry it prints leaves results_at PENDING, because a '
    + 'registration commit carries no measurement',
    JSON.parse(demo.manifest).results_at === 'PENDING');
  // A new set must be born compliant with section 8, or the annotation is compulsory
  // only for whoever happens to have been told about it -- which is how the first
  // forty-three sets went unannotated while AGENTS.md described the defect exactly.
  check('   and every prediction in the block it writes carries an AT RISK line',
    (() => {
      const r = require('../tools/at-risk.js').registrationRisk(tool);
      return r && ids.length > 0 && ids.every(id => typeof r[id] === 'string');
    })());
  check('   and the manifest entry it prints carries an at_risk field per prediction',
    JSON.parse(demo.manifest).predictions.every(p => typeof p.at_risk === 'string'));
  check('   and the test it writes spawns the tool as a subprocess — the antibody '
    + 'for T-TOOL-CHECKED-ONLY-BY-IMPORT',
    demo.files.find(f => f.path.startsWith('test/')).body.includes('execFileSync'));
}

console.log('\n=== 8. AT RISK: COULD THE RUN HAVE REFUTED IT AT ALL? ===');
{
  // The THIRD axis, and the one the first forty-three sets had no way to state.
  // `outcome` is the prediction against the run. `basis` is the scope of the claim.
  // `at_risk` is whether the run could have contradicted it in the first place.
  //
  // A read-only audit of all 181 predictions registered as of `1acfeee` scored 25 of
  // them DECORATIVE -- the answer and the derivation that produces it both standing in
  // the registration's own text, over quantities the registrant stipulated -- and 7 it
  // could not call. Every one of the 25 HELD and none of the 32 failures was among
  // them: a fact that was never at risk cannot fail. `AGENTS.md` had named the defect
  // from the start and nothing measured it for forty-three sets, because the annotation
  // was advisory. It is compulsory here. `F-REGISTRATION-IS-NOT-RISK` records the
  // audit; `tools/at-risk.js` owns the vocabulary, so the manifest, the ledger and the
  // doc generator cannot disagree about what a value means.
  const R = require('../tools/at-risk.js');

  const bad = allPreds.filter(p => R.classify(p.at_risk) === null);
  check(`all ${allPreds.length} predictions declare whether the run could have refuted them`,
    bad.length === 0, `no usable at_risk: ${bad.map(p => p.id).join(' ')}`);
  check('   and the three values are declared in the manifest beside outcome_values, '
    + 'not assumed by this file',
    ['AT RISK', 'NOT AT RISK', 'UNCALLED'].every(k => k in (M.at_risk_values || {})));
  // Teeth, run through the SAME classifier the check above uses rather than asserting
  // something true of any object: a prediction with no annotation, one with an empty
  // reason, and one with a sentinel nobody declared must all come back unusable.
  check('   and a prediction with no annotation, or a malformed one, would be caught',
    [{ id: 'X' }, { id: 'Y', at_risk: 'NOT AT RISK: ' }, { id: 'Z', at_risk: 'PROBABLY' },
      { id: 'W', at_risk: true }].every(p => R.classify(p.at_risk) === null)
    && R.classify('AT RISK') === 'at-risk');

  const marked = allPreds.filter(p => ['not-at-risk', 'uncalled'].includes(R.classify(p.at_risk)));
  check(`${marked.length} predictions are marked otherwise, and every one says why`,
    marked.length > 0 && marked.every(p => R.reason(p.at_risk).length > 40),
    marked.filter(p => R.reason(p.at_risk).length <= 40).map(p => p.id).join(' '));

  // The audit's verdicts, frozen the way the failed set is frozen above. The scoring
  // read each registration as `git show <registered_at>:<tool>` returned it, so
  // re-scoring from the current files would read edited wording and is not the same
  // measurement. These lists may not shrink; a later set is free to add its own.
  const DECORATIVE_AT_1ACFEEE = ['Q4', 'Q5', 'R5', 'S3', 'V4', 'Z1', 'F3', 'G1', 'G3', 'I4',
    'A4', 'D2', 'M1', 'M3', 'O4', 'AE2', 'AI2', 'AI3', 'AJ4', 'AK2', 'AK3', 'AL1', 'AL2',
    'AP3', 'AP4'];
  const UNCALLED_AT_1ACFEEE = ['Q2', 'R1', 'R2', 'L2', 'V1', 'AE1', 'AD3'];
  //
  // STICKY, NOT IMMUTABLE. Six of the 25 are contestable on the auditor's own reading,
  // and a list that could never move would make the CORPUS wrong on the day somebody
  // demonstrated one of them was genuinely at risk -- the only way back to green being
  // to leave a known-false annotation standing. A check that can only be satisfied by
  // lying is the failure mode this project already has a name for.
  //
  // So the lists are the BASELINE and `reaudits` is where a departure from it is
  // argued: id, direction, the registered wording it meets, the argument, and the
  // commit carrying it. Absent a record, nothing moves. And a re-audit must meet the
  // original on the original's terms -- the baseline was scored against the
  // registration text as `git show <registered_at>:<tool>` returns it, so an appeal to
  // a tool's CURRENT wording is an appeal to text that may have been edited since.
  const baseline = id =>
    (DECORATIVE_AT_1ACFEEE.includes(id) ? 'not-at-risk'
      : UNCALLED_AT_1ACFEEE.includes(id) ? 'uncalled' : null);
  const VALID_REAUDIT = r =>
    !!r && typeof r.id === 'string'
    && ['at-risk', 'not-at-risk', 'uncalled'].includes(r.to)
    && r.from === baseline(r.id) && r.to !== r.from
    && typeof r.registered_wording === 'string' && r.registered_wording.length > 20
    && typeof r.at === 'string' && r.at.length >= 7
    && typeof r.argument === 'string' && r.argument.length > 80;
  {
    const kind = id => R.classify((allPreds.find(p => p.id === id) || {}).at_risk);
    const moved = new Map((M.reaudits || []).filter(VALID_REAUDIT).map(r => [r.id, r]));
    const undocumented = id => kind(id) !== baseline(id)
      && !(moved.has(id) && moved.get(id).to === kind(id));
    const slipped = DECORATIVE_AT_1ACFEEE.filter(undocumented);
    const forced = UNCALLED_AT_1ACFEEE.filter(undocumented);
    check(`the ${DECORATIVE_AT_1ACFEEE.length} scored decorative at 1acfeee still are, or a `
      + `\`reaudits\` entry argues otherwise (${(M.reaudits || []).length} re-audit(s) on record)`,
      slipped.length === 0, `changed with no record: ${slipped.join(' ')}`);
    check(`   and the ${UNCALLED_AT_1ACFEEE.length} the audit could not call are still uncalled, `
      + 'rather than forced into whichever bucket flatters the rate',
      forced.length === 0, `changed with no record: ${forced.join(' ')}`);
    // Teeth on the door itself: a record that names no wording, cites no commit, argues
    // nothing, or claims a direction the baseline never had must not open it.
    check('   and a re-audit missing its wording, its commit, its argument or its direction '
      + 'does not open the door',
      [{ id: 'Q4', from: 'not-at-risk', to: 'at-risk' },
        { id: 'Q4', from: 'not-at-risk', to: 'at-risk', registered_wording: 'x'.repeat(30) },
        { id: 'Q4', from: 'not-at-risk', to: 'at-risk', registered_wording: 'x'.repeat(30),
          at: '1acfeee', argument: 'too short' },
        { id: 'Q4', from: 'uncalled', to: 'at-risk', registered_wording: 'x'.repeat(30),
          at: '1acfeee', argument: 'y'.repeat(90) }].every(r => !VALID_REAUDIT(r))
      && VALID_REAUDIT({ id: 'Q4', from: 'not-at-risk', to: 'at-risk',
        registered_wording: 'x'.repeat(30), at: '1acfeee', argument: 'y'.repeat(90) }));
    check('   and every re-audit actually on record is well-formed and matches the '
      + 'prediction it names',
      (M.reaudits || []).every(r => VALID_REAUDIT(r) && kind(r.id) === r.to),
      (M.reaudits || []).filter(r => !VALID_REAUDIT(r)).map(r => r.id).join(' '));
    // The six the audit would concede are named where a reader meets them, so nobody
    // has to re-derive which judgements are softest.
    const CONTESTABLE = ['Q4', 'R5', 'G1', 'AJ4', 'AE2', 'AL2'];
    check(`   and the ${CONTESTABLE.length} the audit called contestable say so on their own `
      + 'entries, not only in the finding',
      CONTESTABLE.every(id => /CONTESTABLE:/
        .test((allPreds.find(p => p.id === id) || {}).at_risk || '')),
      CONTESTABLE.filter(id => !/CONTESTABLE:/
        .test((allPreds.find(p => p.id === id) || {}).at_risk || '')).join(' '));
  }

  // The annotation belongs to the REGISTRATION, which is why this reads the tool
  // rather than the manifest: a set that only fills in `at_risk` at results time is
  // grading itself. Note honestly what THIS FIRST CHECK reads -- the tool AS IT
  // STANDS, which is enough for the question it asks (is there an annotation at all,
  // and does it say something), because a line that exists at HEAD and not at
  // `registered_at` is caught below and a line that exists at neither is caught here.
  // The two drift checks underneath do read `registered_at`, through the shared
  // recovery in `tools/at-risk.js`. (The completeness check in section 2 still reads
  // current tools for the prediction ids themselves. Moving that one to the
  // registration commit is a separate change and not a patch for this one.)
  //
  // The rule cannot be applied backwards -- a commit that is already history cannot
  // grow an AT RISK line -- so it binds from `AQ`, the first set that wrote them, and
  // everything appended after it is bound automatically. Position in the manifest
  // rather than a literal list of the forty-two grandfathered sets: T-STALE-CONSTANT is
  // the most-recurring defect in this repository.
  const CONVENTION_STARTS_AT = 'AQ';
  {
    const at = M.prediction_sets.findIndex(s => s.id === CONVENTION_STARTS_AT);
    const bound = at === -1 ? [] : M.prediction_sets.slice(at);
    const offenders = [];
    const empty = [];
    for (const s of bound) {
      const file = path.join(ROOT, s.tool);
      if (!fs.existsSync(file)) { offenders.push(`${s.id}: no ${s.tool}`); continue; }
      const lines = R.registrationRisk(fs.readFileSync(file, 'utf8'), s.tool.endsWith('.py'));
      if (!lines) { offenders.push(`${s.id}: no PREDICTED OUTCOMES block`); continue; }
      const silent = s.predictions.filter(p => typeof lines[p.id] !== 'string');
      if (silent.length) offenders.push(`${s.id}: ${silent.map(p => p.id).join(' ')}`);
      const hollow = s.predictions.filter(p => typeof lines[p.id] === 'string'
        && R.vacuous(lines[p.id]));
      if (hollow.length) empty.push(`${s.id}: ${hollow.map(p => p.id).join(' ')}`);
    }
    check(`every set from \`${CONVENTION_STARTS_AT}\` on registers an AT RISK line per prediction `
      + `(${bound.length} set(s) bound)`,
      bound.length > 0 && offenders.length === 0, `no AT RISK line for: ${offenders.join('; ')}`);
    // A FLOOR, AND SAID TO BE ONLY A FLOOR. Nothing here can tell whether an annotation
    // is true, or even whether it names the right observation -- only that it names
    // something. The way this antibody fails is by the line decaying into the words
    // "genuinely at risk" as prose: green check, disciplined-looking corpus, nothing at
    // risk. That is the form a reader has to catch, and the standard for a reader is
    // what `AR1` actually wrote -- "it comes out the other way if ONE leaf count
    // anywhere in [2, 8192] has a factorisation that leaves the constant optimiser
    // worse stranded than N = 11 did", with the hand evidence beside it.
    check('   and the line names something rather than restating the label — a floor '
      + 'only: this cannot check that an annotation is TRUE',
      empty.length === 0, `says nothing: ${empty.join('; ')}`);
    // AND THE MANIFEST MUST NOT PARAPHRASE THE REGISTRATION. The floor above guards
    // the line in the TOOL, which is the copy that sits in the registration commit and
    // cannot be back-filled. But the manifest carries its own `at_risk`, and that is
    // the copy the ledger renders and the published page shows -- so until this check
    // existed, a reader could be shown an annotation nobody ever registered.
    //
    // It was not hypothetical. `AQ`'s four manifest entries carried the bare label and
    // no reason at all while its tool held 281, 175, 362 and 253 characters of one;
    // `AR`'s were abridged paraphrases of lines up to 805 characters. A fabricated
    // annotation -- "it comes out the other way if the moon is made of cheese" --
    // passed all 125 checks.
    //
    // This repository's answer to a second copy of the truth is always the same: keep
    // it if it is useful, and make the suite fail when it drifts. The manifest keeps
    // its copy because renderers want a self-contained record; the copy is now the
    // registered line, byte for byte after whitespace normalisation.
    //
    // AND "REGISTERED" MEANS AT registered_at, NOT AT HEAD. This check read the
    // WORKING TREE for every set it bound, which quietly gave away the only thing it
    // was for.
    // The point of binding the manifest to the registration is that the registration
    // is fixed by a commit; compared against the tree, an editor who changes a tool's
    // AT RISK line and changes the manifest to match passes, and the drift from what
    // was actually registered is invisible in the one place that was supposed to see
    // it. Section 10 states the general rule after a sweep fell into it -- A GUARD
    // OVER REGISTRATION TEXT MUST READ EACH SET'S OWN registered_at, NEVER THE WORKING
    // TREE -- and this was the guard still standing on the wrong side of it. The
    // recovery is section 10's, moved into `tools/at-risk.js` so there is one of it.
    //
    // FAIL CLOSED. A set whose `registered_at` will not resolve is an OFFENDER, not a
    // skip: the old loop `continue`d past a tool it could not read, so the way to
    // silence it was to make it unreadable. `results_at` is deliberately never
    // consulted -- it is legitimately `PENDING` for a set mid-flight (section 4 says
    // so), and a set that has registered but not yet reported still has a registration
    // to be held to. The binding is to `registered_at`, which is known the moment the
    // registration lands and can never afterwards be `PENDING`.
    const flat = t => String(t || '').replace(/^AT RISK:\s*/i, '').replace(/\s+/g, ' ').trim();
    const clip = t => { const s = flat(t); return s.length > 80 ? `${s.slice(0, 80)}...` : s; };
    // ONE COMPARATOR, so the synthetic control below runs through the same code the
    // real checks run through rather than through something true of any object.
    // `srcOf` supplies the text to be quoted FROM, `lineOf` the text doing the
    // quoting; every row it returns is a disagreement it could name.
    const driftAgainst = (sets, srcOf, lineOf) => {
      const rows = [];
      for (const s of sets) {
        const src = srcOf(s);
        if (typeof src !== 'string' || src === '') {
          rows.push(`${s.id}: no source at ${s.registered_at}`); continue;
        }
        const reg = R.registrationRisk(src, s.tool.endsWith('.py'));
        if (!reg) { rows.push(`${s.id}: no registration block at ${s.registered_at}`); continue; }
        for (const p of s.predictions) {
          const there = reg[p.id];
          if (typeof there !== 'string') { rows.push(`${p.id}: not annotated where it was registered`); continue; }
          const here = lineOf(s, p);
          if (flat(here) !== flat(there)) {
            rows.push(`${p.id}: registered "${clip(there)}" / found "${clip(here) || '(nothing)'}"`);
          }
        }
      }
      return rows;
    };
    const registeredSrc = s => R.registeredSources(M.prediction_sets, ROOT)
      .get(`${s.registered_at}:${s.tool}`);
    const treeLines = new Map();
    const treeLine = (s, p) => {
      if (!treeLines.has(s.id)) {
        const f = path.join(ROOT, s.tool);
        treeLines.set(s.id, fs.existsSync(f)
          ? R.registrationRisk(fs.readFileSync(f, 'utf8'), s.tool.endsWith('.py')) : null);
      }
      const l = treeLines.get(s.id);
      return l ? l[p.id] : undefined;
    };

    const drift = driftAgainst(bound, registeredSrc, (s, p) => p.at_risk);
    check('   and the manifest quotes the line AS REGISTERED — recovered at each set\'s '
      + 'own `registered_at`, never read off the working tree',
      drift.length === 0, `manifest and registration differ — ${drift.join(' | ')}`);

    // THE WORKING-TREE READ IS KEPT, AS ITS OWN CHECK, BECAUSE IT NOW ASSERTS SOMETHING
    // THE OTHER ONE CANNOT. Given the manifest quotes the registered line, comparing
    // the manifest to the tree adds exactly one fact: that the tree still says what was
    // registered. So it is asserted as that fact directly, tree against registration,
    // and its failure detail names the real defect -- a registration block edited after
    // the run it was supposed to precede, which `AGENTS.md` forbids outright -- instead
    // of blaming the manifest for a tool someone rewrote. Same coverage, truer
    // diagnosis. Dropping it would have lost the only check that watches for that edit.
    //
    // PER AT RISK LINE, NOT WHOLE BLOCK, and that restriction is load-bearing rather
    // than lazy: `AQ`'s header was normalised from `REGISTERED PREDICTIONS` at some
    // later commit, so a whole-block comparison fires on an edit that has already
    // landed and cannot be un-landed. A check that forbids a state the repository is
    // already legitimately in is T-CHECK-FORBIDS-HEALTHY-STATE, and this is where it
    // would have bitten.
    const edited = driftAgainst(bound, registeredSrc, treeLine);
    check('   and no bound set\'s AT RISK line has been EDITED since it was registered — '
      + 'the tool at HEAD against the tool at its own `registered_at`',
      edited.length === 0, `edited after registration — ${edited.join(' | ')}`);

    // TEETH ON THE REPAIR ITSELF, and specifically on the difference between the two
    // sources -- a control that cannot separate them would leave the old check in
    // place under a new name. The failure constructed here is the exact one the
    // working-tree read could not see: a manifest line that MATCHES the tool as it
    // stands and does not match the tool as it was registered. Fed to the same
    // comparator both ways, it must fire against the registered source and stay silent
    // against the current one -- that silence being exactly what the suite used to
    // report, and it was demonstrated live on a clone before this landed.
    // The three fail-closed shapes go through it too, because "cannot read it" and
    // "read it and it agreed" must not produce the same answer.
    check('   and that comparison FIRES on a manifest line matching the CURRENT tool '
      + 'and not the REGISTERED one — the drift the working-tree read could not see — '
      + 'and fails closed on a source it cannot recover',
      (() => {
        const mk = body => [' * PREDICTED OUTCOMES', ' *', ' *   ZZ1  a claim.',
          ` *        AT RISK: ${body}`, ' */'].join('\n');
        const WAS = 'this comes out the other way if any leaf count in [2, 8192] '
          + 'factorises into three levels more cheaply than into two.';
        const NOW = 'this comes out the other way if the moon is made of cheese, which '
          + 'is an annotation nobody ever registered and the tree now carries.';
        const set = {
          id: 'ZZ', tool: 'tools/zz-audit.js', registered_at: 'deadbee',
          results_at: 'PENDING', predictions: [{ id: 'ZZ1', at_risk: `AT RISK: ${NOW}` }],
        };
        const m = (src, s = set) => driftAgainst([s], () => src, (_s, p) => p.at_risk);
        const honest = { ...set, predictions: [{ id: 'ZZ1', at_risk: `AT RISK: ${WAS}` }] };
        return m(mk(WAS)).length === 1                     // against the registration: caught
          && /registered "this comes out/.test(m(mk(WAS))[0])   // and it says which text is which
          && m(mk(NOW)).length === 0                       // against the tree: invisible
          && m(mk(WAS), honest).length === 0               // a manifest that does quote it
          && m(null).length === 1                          // unrecoverable is not a pass
          && m('a tool carrying no registration at all').length === 1
          && m([' * PREDICTED OUTCOMES', ' *', ' *   ZZ1  a claim, unannotated.',
            ' */'].join('\n')).length === 1;               // registered without an AT RISK line
      })());
    // The decision about `PENDING` said out loud rather than left to be inferred from
    // which field the code happens to read. A set that has registered and not yet
    // reported is exactly the set most able to quietly edit its own registration, so
    // exempting it would put the hole where it is cheapest to use.
    check('   and a set whose `results_at` is still PENDING is compared anyway — the '
      + 'binding is to `registered_at`, and a set mid-flight is not exempt from quoting '
      + 'its own registration',
      (() => {
        const mid = {
          id: 'ZZ', tool: 'tools/zz-audit.js', registered_at: 'deadbee',
          results_at: 'PENDING',
          predictions: [{ id: 'ZZ1', at_risk: 'AT RISK: a paraphrase of the registered line.' }],
        };
        const src = [' * PREDICTED OUTCOMES', ' *', ' *   ZZ1  a claim.',
          ' *        AT RISK: the registered line itself, which the manifest above does '
          + 'not quote.', ' */'].join('\n');
        return driftAgainst([mid], () => src, (_s, p) => p.at_risk).length === 1;
      })());
    // AND THE NEGATIVE CONTROL IS THE REAL CORPUS, with real traffic under it: the two
    // checks above run this same comparator over every bound set against both sources
    // and report nothing, which is what says the discriminator separates drift from
    // agreement rather than flagging everything it reads. That control is those two
    // checks passing -- restating it as a third assertion would add a line that can
    // only ever fail with them, which reads as coverage and is none.
    check('   and both halves of that would be caught, on a real registered line and a '
      + 'hollow one',
      (() => {
        const block = [' * PREDICTED OUTCOMES', ' *', ' *   ZZ1  a claim.',
          ' *        AT RISK: this comes out the other way if ONE leaf count anywhere in',
          ' *        [2, 8192] has a factorisation that leaves the constant optimiser',
          ' *        worse stranded than N = 11 did.',
          ' *        CANNOT SHOW: this bounds the improvement.', ' *',
          ' *   ZZ2  a second claim, with nothing that could refute it.', ' *',
          ' *   ZZ3  a third, with a line that says nothing.',
          ' *        AT RISK: genuinely at risk.', ' */'].join('\n');
        const seen2 = R.registrationRisk(block);
        return seen2 && typeof seen2.ZZ1 === 'string' && !R.vacuous(seen2.ZZ1)
          && !/CANNOT SHOW/.test(seen2.ZZ1)
          && seen2.ZZ2 === null
          && typeof seen2.ZZ3 === 'string' && R.vacuous(seen2.ZZ3);
      })());
  }

  // WHY THIS IS A FLAG AND NOT A LAW, and the reason is written down because someone
  // will otherwise tighten it. Zero of the 33 failures are marked as never having been
  // at risk, and that is real evidence the scoring rule tracks something -- but it is a
  // property that currently holds, not one that cannot stop. A derivable prediction
  // fails whenever the registrant derives it WRONGLY: `AK1`'s registration typed a
  // group order at 25 digits where the true value has 28, and it survived only because
  // the claim named the group rather than the numeral. A check that made the
  // combination illegal would, on the day it fired, be telling someone their honest
  // annotation is forbidden, and the cheapest way out would be to relabel the
  // prediction as at-risk -- which is exactly the corruption this field exists to
  // prevent. So the combination is legal and must carry its explanation.
  {
    const t = R.tally(allPreds);
    const unexplained = t.failedNotAtRisk
      .map(id => allPreds.find(p => p.id === id))
      .filter(p => !(p.note && p.note.length > 40));
    check(`${t.failedNotAtRisk.length} of ${t.failed} failures are marked as never at risk, and any `
      + 'such prediction explains which premise was wrong',
      unexplained.length === 0, `unexplained: ${unexplained.map(p => p.id).join(' ')}`);

    // `basis` looks as though it should have caught the decoration and does not. The
    // two axes are independent in BOTH directions, and that is asserted structurally
    // rather than as a pair of counts, because the counts move as the corpus grows.
    const proven = allPreds.filter(p => p.basis === 'proven');
    check('`basis` and `at_risk` are independent axes, and neither may be derived from '
      + 'the other',
      proven.some(p => R.classify(p.at_risk) === 'at-risk')
      && proven.some(p => R.classify(p.at_risk) === 'not-at-risk')
      && marked.some(p => p.basis === 'measured'),
      'one direction of the independence has collapsed');

    check(`published ${t.failed} of ${t.total} = ${t.rateRaw}%; corrected ${t.failedAtRisk} of `
      + `${t.atRisk} at risk = ${t.rateCorrected}%, and the raw counts are not lowered`,
      t.atRisk + t.notAtRisk + t.uncalled === t.total
      && t.total === allPreds.length && t.rateCorrected > t.rateRaw);
    check('   and the audit that produced those numbers is in the manifest, not only in a '
      + 'commit message',
      M.unregistered_findings.some(f => f.id === 'F-REGISTRATION-IS-NOT-RISK'));
  }

  // The PUBLISHED table is a claim about a COMMIT, so it is checked against that
  // commit rather than against whatever this file happens to have typed. Both triples
  // are parsed back out of the finding's own prose and recomputed from
  // `git show 1acfeee:FINDINGS.json` plus the two frozen lists -- which also proves
  // every scored id existed there and that all 32 of them HELD, the fact the whole
  // rule rests on. Not lowering the raw counts is only meaningful if the raw counts
  // are still checkable.
  {
    const F = M.unregistered_findings.find(f => f.id === 'F-REGISTRATION-IS-NOT-RISK');
    const pub = /PUBLISHED: (\d+) registered, (\d+) held, (\d+) failed, a ([\d.]+)%/
      .exec(F ? F.claim : '');
    const cor = /CORRECTED[^:]*: (\d+) registered, (\d+) held, (\d+) failed, ([\d.]+)%/
      .exec(F ? F.claim : '');
    let then = null, why = '';
    try {
      const raw = execFileSync('git', ['show', '1acfeee:FINDINGS.json'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      then = JSON.parse(raw).prediction_sets.flatMap(s => s.predictions);
    } catch (e) { why = e.message.split('\n')[0]; }
    if (!then) {
      check('the audit commit is reachable, so its published table can be recomputed',
        false, why);
    } else {
      const scored = [...DECORATIVE_AT_1ACFEEE, ...UNCALLED_AT_1ACFEEE];
      const thenById = new Map(then.map(p => [p.id, p]));
      const absent = scored.filter(id => !thenById.has(id));
      const notHeld = scored.filter(id => (thenById.get(id) || {}).outcome !== 'HELD');
      check(`all ${scored.length} scored ids existed at 1acfeee and every one of them HELD `
        + '— a fact that was never at risk cannot fail',
        absent.length === 0 && notHeld.length === 0,
        `absent: ${absent.join(' ')}  not held: ${notHeld.join(' ')}`);
      const held = then.filter(p => p.outcome === 'HELD').length;
      const failed = then.filter(p => p.outcome === 'FAILED').length;
      const atRisk = then.length - scored.length;
      const pct = (a, b) => Math.round((a / b) * 1000) / 10;
      check(`the published table is what 1acfeee actually held: ${then.length} registered, `
        + `${held} held, ${failed} failed, ${pct(failed, then.length)}%`,
        pub !== null && Number(pub[1]) === then.length && Number(pub[2]) === held
        && Number(pub[3]) === failed && Number(pub[4]) === pct(failed, then.length),
        pub ? pub.slice(1).join(' ') : 'the finding states no published table');
      check(`   and the corrected one follows from the frozen lists: ${atRisk} at risk, `
        + `${atRisk - failed} held, ${failed} failed, ${pct(failed, atRisk)}%`,
        cor !== null && Number(cor[1]) === atRisk && Number(cor[2]) === atRisk - failed
        && Number(cor[3]) === failed && Number(cor[4]) === pct(failed, atRisk),
        cor ? cor.slice(1).join(' ') : 'the finding states no corrected table');
    }
  }
}

// ===========================================================================
console.log('\n=== 9. WAS THE CRITERION DISCRIMINATING? ===');
// Section 8 asks whether the RUN could have refuted a prediction. This asks the
// narrower and worse question: could the NULL have produced the verdict anyway? A line
// placed where the null clears it routinely is not evidence, whichever side it lands
// on, and unlike a wrong claim it leaves no mark -- a verdict is a verdict whether or
// not anything was at stake.
//
// NOTHING HERE RE-SCORES ANYTHING. Every `outcome` and every `at_risk` value stands as
// its results commit left it; that ordering is the only property of this record a later
// edit cannot fake. What is frozen below is what a criterion was WORTH. The lists are
// literals for the same reason the decoration audit's are: so they cannot be quietly
// unmarked, and so the arithmetic over them is checked rather than asserted.
{
  // Leg -> the LEG'S OWN verdict, which is not always its prediction's: AU2 failed on
  // (c) while (a) and (b) held, and bucketing legs by their prediction's outcome is the
  // unit error that moved this sweep's own headline from 37.5% to 27.9% before it was
  // caught.
  const NOT_DISCRIMINATING = {
    'H1(a)': 'FAILED', 'H2(a)': 'HELD', 'D4': 'FAILED', 'AM2': 'FAILED',
    'AO1(a)': 'FAILED', 'AO4': 'HELD', 'AR1': 'HELD', 'AR2': 'HELD',
    'AT1(b)': 'HELD', 'AT2(d)': 'FAILED', 'AT3(a)': 'FAILED', 'AU1(a)': 'HELD',
    'AU1(c)': 'HELD', 'AU2(b)': 'HELD', 'AU2(c)': 'FAILED', 'AU3(c)': 'HELD',
  };
  const CANNOT_GO_OTHER_WAY = {
    'AP2(a)': 'HELD', 'AP2(b)': 'HELD', 'AP2(c)': 'HELD', 'AR4': 'FAILED',
  };
  const UNDETERMINED = { 'AR3': 'HELD' };
  // The seven recorded FAILURES that rest ENTIRELY on a criterion that was not evidence.
  const AFFECTED_FAILURES = ['AO1', 'AT2', 'AT3', 'AU2', 'AM2', 'D4', 'AR4'];
  // A line, and no null anyone could draw without inventing the chance model. Listed,
  // and nothing is asserted about how they came out: the class boundary was drawn with
  // the outcomes visible, so its outcome distribution is the statistic the finding
  // retracts, and a check is a published number.
  const NO_DRAWABLE_NULL = ['AH1', 'AH2', 'AH4', 'AC3', 'AC4', 'AE3', 'AE4', 'AG2',
    'AG3', 'AG4', 'AJ2', 'AL4', 'R3', 'G2', 'H4', 'N4', 'AD2', 'AM3'];
  const SCORED_PARENTS = ['H1', 'H2', 'D1', 'D3', 'D4', 'AM1', 'AM2', 'AM4', 'AN1',
    'AN2', 'AN3', 'AN4', 'AO1', 'AO4', 'AP2', 'AR1', 'AR2', 'AR3', 'AR4', 'AS1', 'AS2',
    'AS3', 'AS4', 'AT1', 'AT2', 'AT3', 'AT4', 'AU1', 'AU2', 'AU3', 'AU4'];
  // Line-bearing, null drawable, NOBODY HAS DRAWN IT. A gap, not a result, and it must
  // not be counted into the 55 legs as though it had been scored.
  const UNSCORED_LINE_BEARING = ['AQ4'];
  const TOTAL_LEGS = 55;

  // The vocabulary has exactly one owner, here as everywhere: a second parser is a
  // second thing to disagree.
  const R = require('../tools/at-risk.js');
  const byId = new Map();
  for (const s of M.prediction_sets) for (const p of s.predictions) byId.set(p.id, p);
  const parentOf = leg => leg.replace(/\(.\)$/, '');

  const nd = Object.entries(NOT_DISCRIMINATING);
  const ndHeld = nd.filter(([, v]) => v === 'HELD');
  const ndFailed = nd.filter(([, v]) => v === 'FAILED');
  check(`${nd.length} legs are recorded NOT DISCRIMINATING — the null crosses the `
    + `registered line between 5% and 95% of the time — ${ndHeld.length} held and `
    + `${ndFailed.length} failed`,
    nd.length === 16 && ndHeld.length === 9 && ndFailed.length === 7,
    `${nd.length} / ${ndHeld.length} held / ${ndFailed.length} failed`);

  const all = [...nd, ...Object.entries(CANNOT_GO_OTHER_WAY), ...Object.entries(UNDETERMINED)];
  const unknown = all.map(([leg]) => parentOf(leg)).filter(id => !byId.has(id));
  check('   and every scored leg names a prediction that exists', unknown.length === 0,
    unknown.join(' '));

  const cg = Object.entries(CANNOT_GO_OTHER_WAY);
  check(`   and ${cg.length} more could not have gone the other way at all, at `
    + `P(recorded verdict | null) at or above 0.99, with ${Object.keys(UNDETERMINED).length} undetermined`,
    cg.length === 4 && cg.filter(([, v]) => v === 'HELD').length === 3
    && Object.keys(UNDETERMINED).length === 1);

  // What would catch a verdict being moved underneath the audit: a failed leg forces
  // its prediction failed, and the seven affected are all still FAILED.
  const inconsistent = all.filter(([leg, v]) =>
    v === 'FAILED' && (byId.get(parentOf(leg)) || {}).outcome !== 'FAILED').map(([leg]) => leg);
  const notFailed = AFFECTED_FAILURES.filter(id => (byId.get(id) || {}).outcome !== 'FAILED');
  check('   and no outcome moved: every prediction carrying a failed non-evidence leg is '
    + 'still recorded FAILED, all seven affected included',
    inconsistent.length === 0 && notFailed.length === 0 && AFFECTED_FAILURES.length === 7,
    `${inconsistent.join(' ')} ${notFailed.join(' ')}`);

  // THE TWO SEVENS ARE DIFFERENT SETS OF THE SAME SIZE, and a reader who takes them for
  // one list gets both wrong. H1 also failed on leg (b), which is discriminating at some
  // five standard deviations, so H1's FAILED is carried by a leg the null could not have
  // produced. AR4 is not a noise line at all -- the null clears it with probability one
  // -- so it is not a failed ND leg, but its single leg is the whole of its verdict.
  const failedNDparents = [...new Set(ndFailed.map(([leg]) => parentOf(leg)))];
  const onlyLegs = failedNDparents.filter(id => !AFFECTED_FAILURES.includes(id));
  const onlyAffected = AFFECTED_FAILURES.filter(id => !failedNDparents.includes(id));
  check('the seven failed NON-DISCRIMINATING LEGS and the seven AFFECTED FAILURES are '
    + 'different sets of equal size, differing by exactly {H1} and {AR4}',
    failedNDparents.length === 7 && onlyLegs.length === 1 && onlyLegs[0] === 'H1'
    && onlyAffected.length === 1 && onlyAffected[0] === 'AR4',
    `only among legs: ${onlyLegs.join(' ')}; only among failures: ${onlyAffected.join(' ')}`);

  // A reader of one entry must not have to find a summary to learn what its criterion
  // was worth. Disclosure in the finding alone is the defect this audit is about.
  const undisclosed = AFFECTED_FAILURES.filter(id =>
    !/CRITERION AUDIT/.test((byId.get(id) || {}).note || ''));
  check('   and each of the seven discloses it in its OWN entry, not only in the finding',
    undisclosed.length === 0, undisclosed.join(' '));

  const missing = NO_DRAWABLE_NULL.filter(id => !byId.has(id));
  const notAtRisk = NO_DRAWABLE_NULL.filter(id =>
    byId.has(id) && R.classify(byId.get(id).at_risk) !== 'at-risk');
  const straddle = NO_DRAWABLE_NULL.filter(id =>
    SCORED_PARENTS.includes(id) || UNSCORED_LINE_BEARING.includes(id));
  check(`${NO_DRAWABLE_NULL.length} line-bearing predictions have NO null anyone could `
    + 'draw without inventing the chance model — unmeasured, not clear — and none of them '
    + 'straddles the drawable class',
    NO_DRAWABLE_NULL.length === 18 && missing.length === 0 && notAtRisk.length === 0
    && straddle.length === 0,
    `absent: ${missing.join(' ')}  not at risk: ${notAtRisk.join(' ')}  straddling: ${straddle.join(' ')}`);

  // SIZES ONLY. The outcome breakdown of the middle class is deliberately not asserted
  // anywhere, because the boundary was drawn with the outcomes visible.
  //
  // THE CLASSIFIED COUNT IS PINNED; THE CORPUS TOTAL IS NOT, and the difference is the
  // point. The three lists above are a criterion audit's own classification, frozen, and
  // 50 is how many predictions it reached — that number cannot move without someone
  // editing the lists, and pinning it is what makes them a record rather than a
  // suggestion. The AT-RISK TOTAL is a different kind of number: it grows every time a
  // set is registered, which is the corpus working. Pinned at 165 it went red on the
  // next set for doing nothing wrong, which is T-CHECK-FORBIDS-HEALTHY-STATE — the same
  // shape as the check that demanded the tool count and the set count be equal and so
  // failed during every registration. So the residual is DERIVED and what is asserted
  // instead is the partition: the audit's classes are disjoint, every member is still
  // at risk, and none has slipped out of the at-risk population it was drawn from.
  // Pin the discriminator, never the tally.
  const atRiskNow = M.prediction_sets.flatMap(s => s.predictions)
    .filter(p => R.classify(p.at_risk) === 'at-risk');
  const atRiskIds = new Set(atRiskNow.map(p => p.id));
  const classified = [...NO_DRAWABLE_NULL, ...SCORED_PARENTS, ...UNSCORED_LINE_BEARING];
  const lineBearing = NO_DRAWABLE_NULL.length + SCORED_PARENTS.length + UNSCORED_LINE_BEARING.length;
  const escaped = classified.filter(id => !atRiskIds.has(id));
  check(`the three classes reconcile to the at-risk total: ${atRiskNow.length - lineBearing} `
    + `carry no line, ${NO_DRAWABLE_NULL.length} a line and no drawable null, `
    + `${SCORED_PARENTS.length + UNSCORED_LINE_BEARING.length} both — summing to ${atRiskNow.length}`,
    lineBearing === 50 && new Set(classified).size === 50
    && escaped.length === 0 && atRiskNow.length >= lineBearing,
    `no longer at risk: ${escaped.join(' ')}`);
  check('   and that reconciliation still fires when a classified prediction leaves the '
    + 'at-risk population, or when the audit\'s own classes start overlapping',
    (() => {
      const ids = new Set([...atRiskIds].filter(id => id !== classified[0]));
      const wouldFail = classified.filter(id => !ids.has(id)).length !== 0;
      const overlap = new Set([...classified, SCORED_PARENTS[0]]).size !== 51;
      return wouldFail && overlap;
    })());

  check(`   and the ${TOTAL_LEGS} legs come from the ${SCORED_PARENTS.length} SCORED `
    + 'predictions only — AQ4 is line-bearing with a drawable null nobody has drawn, and '
    + 'is counted as a gap rather than as a leg',
    SCORED_PARENTS.length === 31 && UNSCORED_LINE_BEARING.length === 1
    && !SCORED_PARENTS.includes('AQ4') && TOTAL_LEGS === 55);

  // A test that cannot fail is worse than no test. Broken deliberately: a leg pointing at
  // a prediction that does not exist, a held leg relabelled failed, and a silence id
  // smuggled into the scored class -- each is the shape of a real edit somebody could make.
  const plus = (o, k, v) => Object.assign({}, o, { [k]: v });
  check('   and all three of those would be caught — a leg naming a prediction that does '
    + 'not exist, a held leg relabelled FAILED, and a silence id also listed as scored',
    Object.keys(plus(NOT_DISCRIMINATING, 'ZZ9(a)', 'HELD')).map(parentOf)
      .filter(id => !byId.has(id)).length === 1
    && Object.values(plus(NOT_DISCRIMINATING, 'AO4', 'FAILED'))
      .filter(v => v === 'FAILED').length === ndFailed.length + 1
    && [...NO_DRAWABLE_NULL, 'AT1'].filter(id => SCORED_PARENTS.includes(id)).length === 1);
}

// ===========================================================================
console.log('\n=== 10. AN INSTRUMENT THAT READS HISTORY ===');
// AN INSTRUMENT THAT READS HISTORY CAN BE BROKEN BY HISTORY IN A WAY NO CHECK AT HEAD
// CAN SEE, and that is a class this corpus did not have until a sweep fell into it.
//
// The criterion audit located each set's registered predictions by recovering
// `git show <registered_at>:<tool>` and searching it for `PREDICTED OUTCOMES`. Set AQ's
// tool said `REGISTERED PREDICTIONS` when it was registered. No match, a silent fallback
// to the manifest's one-line summary, and AQ became the one set in the corpus whose
// REGISTERED CRITERIA WERE NEVER READ -- and the set whose classification was then found
// wrong on all three of its predictions.
//
// THE HEADER WAS NORMALISED AT SOME LATER COMMIT, so at HEAD every tool carries the
// current spelling and a grep over `tools/` reports all 47 fine and always fine. The
// evidence of the fault has been edited out of the only place anyone would look. The
// antibody is the general rule: A GUARD OVER REGISTRATION TEXT MUST READ EACH SET'S OWN
// registered_at, NEVER THE WORKING TREE, and its recognised vocabulary must be the union
// over history rather than the spelling that happens to be current.
//
// And per the sibling defect in the same thread -- a harness that compared a classifier's
// return value against a constant it can never equal, filtered its population to empty,
// and printed four rows of plausible p-values off no data -- THE RECOVERY IS ASSERTED TO
// HAVE MATCHED, set by set, rather than reporting over whatever it happened to find.
{
  const HEADERS = ['PREDICTED OUTCOMES', 'REGISTERED PREDICTIONS'];
  // THE RECOVERY MOVED INTO THE INSTRUMENT, for the reason this section already gives
  // about the vocabulary: it was this section's private knowledge, and section 8's
  // drift check -- which is a guard over registration text and therefore bound by the
  // rule stated above -- read the working tree instead. One spawn and one recovery for
  // both, memoised on the spec list, so the two cannot disagree about what "the
  // registration" is. The batch parse itself is unchanged; it was validated against
  // the slow `git show` path when it was written, byte-identical on a five-set sample.
  // `AR` is required here rather than reached for -- the module is memoised, and a
  // second binding of the same module is not a second parser.
  const AR = require('../tools/at-risk.js');
  const srcs = AR.registeredSources(M.prediction_sets, ROOT);
  const rows = M.prediction_sets.map(s => [s.id, srcs.get(`${s.registered_at}:${s.tool}`)]);
  const matched = rows.filter(([, src]) => src && HEADERS.some(h => src.includes(h)));
  const legacy = matched.filter(([, src]) => !src.includes(HEADERS[0])).map(([id]) => id);
  const noHeader = rows.filter(([, src]) => !src || !HEADERS.some(h => src.includes(h)))
    .map(([id]) => id);
  check(`all ${matched.length} of ${M.prediction_sets.length} registrations were RECOVERED `
    + `AND MATCHED at their own registered_at, over ${HEADERS.length} header spellings `
    + `— ${legacy.length} using the older one (${legacy.join(', ') || 'none'})`,
    M.prediction_sets.length > 0 && matched.length === M.prediction_sets.length
    && noHeader.length === 0,
    `no recognised header: ${noHeader.join(' ')}`);

  const narrowed = rows.filter(([, src]) => !src || !src.includes(HEADERS[0])).map(([id]) => id);
  check('   and it FIRES when the vocabulary is narrowed to the spelling the tree now '
    + 'uses: exactly one set drops out, and it is AQ — which is how the audit missed it',
    narrowed.length === 1 && narrowed[0] === 'AQ', narrowed.join(' '));

  const atTree = M.prediction_sets.filter(s => {
    const f = path.join(ROOT, s.tool);
    return !fs.existsSync(f) || !fs.readFileSync(f, 'utf8').includes(HEADERS[0]);
  }).map(s => s.id);
  check('   and that same narrow check reports NOTHING against the working tree, which is '
    + 'the whole class: the fault is in what the tree used to say',
    atTree.length === 0, atTree.join(' '));

  // THE GUARD ABOVE WAS THE ONLY THING THAT KNEW. It searches both spellings itself,
  // while `tools/at-risk.js` -- the parser every other caller reaches for, including the
  // convention check further up this file -- carried the current spelling alone. So the
  // class was guarded in one place and open everywhere else, and the next caller would
  // have fallen into it silently, because no check reads a caller's assumptions. A
  // workaround in the checker is not a fix in the instrument. These three assert the
  // instrument, not this section's private copy of the knowledge.
  check(`   and the SHARED parser recovers a block at registered_at for all `
    + `${M.prediction_sets.length} sets, so a caller outside this file cannot fall in`,
    rows.every(([, src]) => src && AR.registrationRisk(src, false) !== null),
    rows.filter(([, src]) => !src || AR.registrationRisk(src, false) === null)
      .map(([id]) => id).join(' '));
  check(`   and its vocabulary is the UNION over history, ${AR.REGISTRATION_HEADERS.length} `
    + 'spellings, not the one the tree happens to use',
    Array.isArray(AR.REGISTRATION_HEADERS)
    && AR.REGISTRATION_HEADERS.length >= 2
    && AR.REGISTRATION_HEADERS[0] === HEADERS[0],
    JSON.stringify(AR.REGISTRATION_HEADERS));
  // The older spelling is load-bearing rather than decorative: exactly the set the audit
  // lost is the set that needs it, and it needs it because its registered tool never had
  // the other one. Delete the entry and this fails, which is why it is asserted.
  {
    const aq = (rows.find(([id]) => id === 'AQ') || [])[1];
    check('   and the older spelling is LOAD-BEARING — AQ parses only because of it, its '
      + 'registered tool contains no other, and all four of its ids come back',
      !!aq && !aq.includes(HEADERS[0]) && aq.includes(HEADERS[1])
      && Object.keys(AR.registrationRisk(aq, false) || {}).length === 4,
      aq ? 'AQ source recovered' : 'AQ source missing');
  }
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
