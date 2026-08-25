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
check('the failures are kept, not corrected away: P3, X2, Z2, E4, E5, H1 and J4',
  allPreds.filter(p => p.outcome === 'FAILED').map(p => p.id).join() === 'P3,X2,Z2,E4,E5,H1,J4');
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
    const block = src.slice(src.indexOf('PREDICTED OUTCOMES'), src.indexOf(' */'));
    for (const m of block.matchAll(/^ \*\s{3}([A-Z]\d+)\s{2}/gm)) found.add(m[1]);
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
    for (const s of M.prediction_sets) {
      let ok = false, why = '';
      try {
        run(['cat-file', '-e', `${s.registered_at}^{commit}`]);
        run(['cat-file', '-e', `${s.results_at}^{commit}`]);
        execFileSync('git', ['merge-base', '--is-ancestor', s.registered_at, s.results_at], { cwd: ROOT });
        ok = true;
      } catch (e) { why = e.message.split('\n')[0]; }
      check(`set ${s.id}: ${s.registered_at} precedes ${s.results_at}`, ok, why);
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
    const unnamed = M.prediction_sets.filter(s => !README.includes(`**${s.id}1`));
    check('the README names every prediction set in the manifest',
      unnamed.length === 0, `missing: ${unnamed.map(s => s.id).join(' ')}`);
    // One set per tool is checked above, so the audit count is the tool count.
    // It is written out in words in two places and had already drifted once.
    // Anchored on those two phrasings rather than on any mention of the word,
    // because the README also says the ceiling ladder took six audits, which is
    // a different and still-true number.
    const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
      'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
      'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
    const onDisk = fs.readdirSync(path.join(ROOT, 'tools')).filter(f => /-audit\.js$/.test(f));
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
    for (const [, word, noun] of lower.matchAll(/(\w+) (classes|sets)\b/g)) {
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
      for (const [, word, noun] of text.matchAll(/(\w+)[- ](classes|sets|occurrences|bites)\b/g)) {
        if (!WORDSET.has(word)) continue;
        const right = WORDS[COUNTED[noun]];
        if (right && word !== right.toLowerCase()) drifted.push(`${f}: "${word} ${noun}" -> "${right}"`);
      }
    }
    check('   and the doctree pillars that restate these counts agree as well',
      drifted.length === 0, drifted.join('; '));

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
      return [...doctored.matchAll(/(\w+) (classes|sets)\b/g)]
        .some(([, w, n]) => WORDSET.has(w)
          && w !== (n === 'classes' ? WORDS[M.traps_encountered.length]
            : WORDS[M.prediction_sets.length]).toLowerCase());
    })());
  }
  check('the one-point trap is recorded as having bitten three times',
    M.traps_encountered.find(t => t.id === 'T-ONE-POINT').count === 3);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
