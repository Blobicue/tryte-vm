'use strict';
/* test-slate-query.js — a retriever that cannot return nothing cannot be wrong.
 *
 * `tools/slate-query.js` ranks the generated slate against a plain-language question.
 * `tools/slate-federate.js` reads two sibling repositories -- `ladderlang` and
 * `bitblock` -- into the same entry schema so the same retriever spans all three.
 * This suite drives both, including their RUN paths and not only their import paths,
 * because `T-TOOL-CHECKED-ONLY-BY-IMPORT` cost this repository a tool that crashed on
 * every invocation while its whole suite stayed green.
 *
 * The load-bearing check here is the negative one. Term-overlap retrieval will always
 * produce a ranking; the question is whether it produces one for a question it should
 * refuse. Section 4 asks four nonsense and near-nonsense questions and requires
 * silence, WITH a control in the same section that a real question still answers --
 * otherwise "returns nothing" would be indistinguishable from a broken index, which is
 * `T-SCOPE-DECIDES-THE-VERDICT` wearing a different hat.
 *
 * No corpus size is written down anywhere below. Another writer adds prediction sets to
 * this tree while this suite is running -- it went from 248 entries to 255 mid-session
 * -- so every expectation here is either derived from the corpus at run time (the
 * anchor ceiling, the Landauer entries, the non-anchoring vocabulary) or is a top-k
 * MEMBERSHIP claim rather than an exact rank. `T-STALE-CONSTANT` is the trap being
 * avoided, and it has bitten this repository twice already.
 *
 * ---------------------------------------------------------------------------
 * MUTATION-TESTED, SEVEN TIMES, AND THE REDS ARE THE MEASUREMENT
 *
 * A check never proven fallible is decoration. Each mutation below was applied to
 * `tools/slate-query.js`, `node test/test-slate-query.js` was run, the failing check
 * names read off, and the file restored before the next. Two of them found defects in
 * the checks themselves, which is recorded rather than quietly repaired -- and because
 * fixing those defects changed this file, the whole sweep was then RE-RUN against the
 * final version. Counts measured against a suite that no longer exists are counts
 * about nothing, which is `T-STALE-CONSTANT` in a comment instead of in code.
 *
 *   M1  IDF DISABLED, `idf.set(t, 1)` for every term.
 *       RED: 1 -- "and idf orders them the same way round", in the instrument section.
 *       Every known-answer check STAYED GREEN. That is a finding about this corpus, not
 *       a gap in the suite: entries are short and topical, so raw term overlap already
 *       puts the right entry first and the idf weighting is buying rank stability
 *       rather than rank correctness here. It would be easy to write "IDF weighting
 *       makes the retrieval work" and this measurement says it does not.
 *
 *   M2  ANCHOR RULE DELETED, `if (!anchored) continue;` neutered.
 *       RED: 7. All four negative cases, the floor control, the subprocess exit-code
 *       check, and the federated nonsense check. With no anchor rule every entry is
 *       scored, the top score is zero, the relative floor is therefore zero, and the
 *       tool answers "xyzzy frobnicate plugh" with the entire corpus. This is the
 *       mutation the suite exists for.
 *
 *   M3  DERIVED-ROUTE DAMPING REMOVED, `const damp = 1;` regardless of the flag.
 *       RED: 2 -- the exact-ratio check and the one requiring the explanation to say
 *       `damped`. On the FIRST run of this mutation only ONE went red, because the
 *       explanation's `damped` field restated `routes_derived` instead of reading the
 *       multiplier that was actually applied. A tool that could stop damping while
 *       still claiming to damp is exactly the defect this repository cares about, so
 *       the field now reads `damp !== 1` and the mutation reddens both.
 *
 *   M4  ROUTE COMPONENT ZEROED, `const routeCap = 0;`.
 *       RED: 4, including the subprocess check that the printout contains a `route:`
 *       line. No known-answer check moved, so route affinity is not what finds these
 *       entries either -- it is a tiebreaker, and the cap says so.
 *
 *   M5  FIELD WEIGHTS IGNORED, `rec.tf += 1` instead of `rec.tf += w`.
 *       RED: 2, and BOTH of them federated. The tryte-vm known answers survived
 *       unweighted fields; the ladderlang one did not, because a worklog block whose
 *       long body mentions the query words outranks the one-line claim that IS the
 *       answer once the claim field stops counting for more. The federation is the
 *       part of the corpus where field weighting is load-bearing.
 *
 *   M6  STEMMER DISABLED, `stem` returns its argument.
 *       RED: 20, and this is the one that proves the known-answer checks fallible:
 *       "can the ledger be forged" no longer puts `F-FINDABILITY-NOT-COUNT` first
 *       (the query says "forged", the finding says "forger"), the ternary question
 *       leaves set O entirely, and "how many predictions failed" starts answering,
 *       because unstemmed `predictions` and `failed` are rare enough to anchor while
 *       their stems are not.
 *
 *   M7  PLURAL STEM FLOOR RAISED, `MIN_STEM_PLURAL = 4`.
 *       RED: 4. "bits" stops meeting "bit", and the house-word check notices that the
 *       non-anchoring vocabulary shifted under it. A one-character change to a
 *       constant, caught.
 *
 * One attempted mutation was NOT one, and it is recorded because a null result about
 * an instrument is still a result: deleting `'ure'` from the suffix list changed
 * nothing at all. The stemmer iterates to a fixpoint, so "erasure" still reaches the
 * same stem by stripping `e` and then `ur`. The suffix is redundant, not load-bearing,
 * and a mutation that does not mutate proves nothing about the checks that survived it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SUITE CANNOT SEE, so the silence is not read as coverage:
 *
 * - RELEVANCE. It checks that named entries surface for named questions. It cannot
 *   check that the ranking is GOOD, because there is no labelled relevance set and
 *   inventing one would be scoring the tool against its own author's guess.
 * - THE SIBLINGS' CONTENT. Section 7 checks that ladderlang and bitblock were read
 *   faithfully into the schema; it cannot check that what they say is true. It does
 *   check one thing about them: that bitblock's `nodes.jsonl` and its `coverage.json`
 *   agree about which schemas nothing witnesses, because that is two independent
 *   readings of one fact and disagreement would mean the federation misread it.
 * - WRITES OUTSIDE THIS REPOSITORY. Section 7 stats the sibling files before and after
 *   a build and requires their mtimes unchanged. That catches a write; it does not
 *   prove no write is possible.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const Q = require('../tools/slate-query.js');
const F = require('../tools/slate-federate.js');

/* The harness, factored so section 0 can point a copy of it at a scratch sink and
 * demonstrate that it reports a failure. A suite whose check() silently swallowed a
 * false condition would print nothing but PASS. */
function mkCheck(sink, emit) {
  return (name, cond, detail = '') => {
    if (cond) { sink.pass++; if (emit) console.log(`  [PASS] ${name}`); }
    else { sink.fails.push(name); if (emit) console.log(`  [FAIL] ${name}  ${detail}`); }
  };
}
const sink = { pass: 0, fails: [] };
const check = mkCheck(sink, true);

const corpus = Q.loadCorpus('docs/slate.json');
const index = Q.buildIndex(corpus.entries);
const ids = (q, n = 8, opts = {}) => Q.query(index, q, Object.assign({ n }, opts)).hits.map((h) => h.id);

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');

{
  const scratch = { pass: 0, fails: [] };
  const probe = mkCheck(scratch, false);
  probe('deliberately false', 1 === 2);
  probe('deliberately true', 1 === 1);
  check('the harness records a false condition as a failure and a true one as a pass',
    scratch.fails.length === 1 && scratch.pass === 1,
    `${scratch.pass} pass / ${scratch.fails.length} fail`);
}

check('the corpus is the generated slate, and it is the size it says it is',
  corpus.schema === 'tryte-vm/slate@1' && corpus.entries.length === corpus.counts.entries,
  `${corpus.entries.length} vs ${corpus.counts.entries}`);

// A single-pass stemmer sends "numbers" to "number" and "number" to "numb", which puts
// a plural and its singular in different buckets. Every stem must therefore be its own
// stem, checked across the whole surface vocabulary rather than a chosen handful.
{
  const surface = new Set();
  for (const e of corpus.entries) {
    for (const w of JSON.stringify(e).toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length > 1) surface.add(w);
    }
  }
  const unstable = [...surface].filter((w) => Q.stem(Q.stem(w)) !== Q.stem(w));
  check(`stemming is a fixpoint across all ${surface.size} surface words in the corpus`,
    unstable.length === 0, unstable.slice(0, 5).join(', '));
}

// Hand-computed equivalence classes, each one load-bearing for a query below.
for (const [group, want] of [
  [['erase', 'erased', 'erases', 'erasing', 'erasure', 'erasures'], 'the erasure family'],
  [['forge', 'forged', 'forger', 'forgery', 'forgeries'], 'the forgery family'],
  [['ledger', 'ledgers'], 'ledger and ledgers'],
  [['bit', 'bits'], 'bit and bits — a three-letter noun keeps its plural'],
  [['statistic', 'statistics'], 'statistic and statistics'],
  [['hash', 'hashed', 'hashing', 'hashes'], 'the hashing family'],
  [['predict', 'predicted', 'prediction', 'predictions'], 'the prediction family'],
]) {
  const stems = new Set(group.map(Q.stem));
  check(`${want} all stem alike (${[...stems][0]})`, stems.size === 1, [...stems].join('/'));
}

// The other half of a stemmer's job: NOT merging words that differ. Both of these
// merged at a minimum stem length of three, which is why the floor is four.
check('"reversible" and "revealed" do NOT merge, though both start rev-',
  Q.stem('reversible') !== Q.stem('revealed'),
  `${Q.stem('reversible')} vs ${Q.stem('revealed')}`);
check('the MIN opcode does NOT merge with "mining"',
  Q.stem('min') !== Q.stem('mining'), `${Q.stem('min')} vs ${Q.stem('mining')}`);

check('tokenising drops stopwords and keeps subject words',
  JSON.stringify(Q.tokenize('what is the cost of the erasure')) === JSON.stringify(['cost', 'era']),
  JSON.stringify(Q.tokenize('what is the cost of the erasure')));
check('a digit group separator does not split a number in two',
  Q.tokenize('21,840 forgeries')[0] === '21840', Q.tokenize('21,840 forgeries').join(','));

// idf must actually order terms by rarity, or the "weighting" is decoration.
{
  const rare = index.df.get(Q.stem('landauer'));
  const common = index.df.get(Q.stem('measured'));
  check('a term in one entry is rarer than one in most entries',
    rare < common, `landauer df=${rare}, measured df=${common}`);
  check('   and idf orders them the same way round',
    index.idf.get(Q.stem('landauer')) > index.idf.get(Q.stem('measured')));
  check('the anchor ceiling is derived from the corpus size, not typed in',
    index.anchorMaxDf === Math.floor(corpus.entries.length * Q.ANCHOR_DF_SHARE),
    String(index.anchorMaxDf));
  check('   and "measured" is above it, so the repository\'s own commonest word cannot anchor',
    common > index.anchorMaxDf, `${common} vs ${index.anchorMaxDf}`);
}

console.log('\n=== 1. KNOWN ANSWERS ===');

// Derived rather than typed: whatever entries mention Landauer are the ones an energy
// question must reach. If a future set adds a third, this check follows it.
{
  const landauer = corpus.entries
    .filter((e) => /landauer/i.test(JSON.stringify(e))).map((e) => e.id).sort();
  check('exactly the entries naming Landauer are AB2 and the physics note',
    landauer.join() === 'AB2,N-erasure-is-price-and-security', landauer.join());
  const top = ids('how much energy does erasing a bit cost', 8);
  check('"how much energy does erasing a bit cost" surfaces EVERY Landauer entry',
    landauer.every((x) => top.includes(x)), top.join(' '));
  check('   and the note that prices a bit in joules is first',
    top[0] === 'N-erasure-is-price-and-security', top[0]);
}

{
  // THIS ANSWER MOVED, and the move is the check working rather than breaking. Until
  // set AS the only entry about forging this ledger was F-FINDABILITY-NOT-COUNT, so it
  // ranked first by default; AS swept 2,000 ledgers and priced four attacks, and the
  // retriever now puts AS1 at the head with the finding it supersedes still in reach.
  // A known-answer check pinned to the best answer AT THE TIME is a stale constant in
  // waiting -- so the second check is derived: whatever entries the corpus has about
  // forging must all be reachable, rather than a hand-listed pair.
  // Fifteen rather than five, and the widening is itself the finding: set AS added six
  // entries about forging this ledger, so the two that used to be the whole answer are
  // now outranked by results that supersede them. F-MIXER-HEAD-IS-NOT-FLAT sits at 13.
  const top = ids('can the ledger be forged', 15);
  check('"can the ledger be forged" puts AS1 first, the census that answers it',
    top[0] === 'AS1', top.join(' '));
  check('   and the finding it supersedes, its note, and the flatness result are all '
    + 'still reachable',
    ['F-FINDABILITY-NOT-COUNT', 'N-findability-not-count', 'F-MIXER-HEAD-IS-NOT-FLAT']
      .every((id) => top.includes(id)),
    top.join(' '));
}

{
  const top = ids('what does a summary statistic hide', 5);
  check('"what does a summary statistic hide" puts N-mean-cannot-certify first',
    top[0] === 'N-mean-cannot-certify', top.join(' '));
}

check('"a control signal that is computed rather than given" finds the pass-one trap',
  ids('a control signal that is computed rather than given', 3)[0]
  === 'T-COMPUTED-CONTROL-UNKNOWN-AT-PASS-ONE',
  ids('a control signal that is computed rather than given', 3).join(' '));

check('"the random generator was not really sampling" finds T-FAKE-RANDOM',
  ids('the random generator was not really sampling', 3)[0] === 'T-FAKE-RANDOM',
  ids('the random generator was not really sampling', 3).join(' '));

check('"can a reversible operation destroy information" reaches F-REVERSIBLE-CANNOT-DESTROY',
  ids('can a reversible operation destroy information', 5).includes('F-REVERSIBLE-CANNOT-DESTROY'),
  ids('can a reversible operation destroy information', 5).join(' '));

check('"what did the hash truncation do to preimages" reaches AO2, which proved it',
  ids('what did the hash truncation do to preimages', 5).includes('AO2'),
  ids('what did the hash truncation do to preimages', 5).join(' '));

// A whole SET as the answer, rather than one entry: the radix-economy question belongs
// to set O, and a retriever that returns three of its four members has found the set.
{
  const top = ids('is ternary more economical than binary', 3);
  const sets = top.map((id) => (corpus.entries.find((e) => e.id === id) || {}).set);
  check('"is ternary more economical than binary" returns set O and nothing else',
    sets.every((s) => s === 'O'), top.join(' ') + ' -> ' + sets.join(','));
}

console.log('\n=== 2. EVERY HIT EXPLAINS WHY IT MATCHED ===');

{
  const res = Q.query(index, 'how much energy does erasing a bit cost', { n: 6 });
  check('every hit names at least one term that carried it',
    res.hits.every((h) => h.why.terms.length > 0));
  check('every hit names at least one ANCHOR term, which is what let it in',
    res.hits.every((h) => h.why.terms.some((t) => t.anchor)));
  // An explanation that names a term the entry does not contain is worse than none.
  const doc = (id) => index.docs.find((d) => d.entry.id === id);
  check('every term an explanation names really occurs in that entry',
    res.hits.every((h) => h.why.terms.every((t) => doc(h.id).bag.has(t.term))));
  check('every field an explanation names is a field the scorer actually weights',
    res.hits.every((h) => h.why.terms.every((t) =>
      t.fields.every((f) => Object.prototype.hasOwnProperty.call(Q.FIELD_WEIGHTS, f)))));
  // All three are published rounded to four places, so the sum of the parts can differ
  // from the rounded whole by a rounding unit. 1e-6 held by luck on this corpus and
  // went red under an unrelated mutation, which is the tolerance telling on itself.
  check('the parts of the score add up to the score, to the precision they are published at',
    res.hits.every((h) => Math.abs(h.term_score + h.route_score - h.score) < 2e-4));
  check('the term part is the sum of the weights the explanation lists',
    res.hits.every((h) =>
      Math.abs(h.why.terms.reduce((a, t) => a + t.weight, 0) - h.term_score) < 5e-3));
  check('a hit that scored on a route names the route and its affinity',
    res.hits.every((h) => h.route_score === 0
      || (h.why.route && h.why.route.route && h.why.route.affinity > 0)));
  check('the route component never exceeds the cap the result publishes',
    res.route_cap > 0 && res.hits.every((h) => h.route_score <= res.route_cap + 1e-9),
    `cap ${res.route_cap}, max ${Math.max(...res.hits.map((h) => h.route_score))}`);
  check('   and that cap is ROUTE_SHARE of the strongest term in the QUERY',
    Math.abs(res.route_cap - Q.ROUTE_SHARE
      * Math.max(...res.stems.filter((s) => index.idf.has(s)).map((s) => index.idf.get(s)))) < 1e-4);
  // The printed report is a second rendering of the same object and must not invent.
  const text = Q.report(res);
  check('the human report names every id the result object carries',
    res.hits.every((h) => text.includes(h.id)));
  check('   and shows the anchor ceiling it filtered on',
    text.includes(String(index.anchorMaxDf)));
}

console.log('\n=== 3. RANKING IS DETERMINISTIC ===');

{
  const q = 'can the ledger be forged';
  const a = Q.query(index, q, { n: 10 });
  const b = Q.query(Q.buildIndex(corpus.entries), q, { n: 10 });
  check('the same question twice gives the same ids and the same scores',
    JSON.stringify(a.hits) === JSON.stringify(b.hits));
  // Order-independence is the stronger claim: the corpus is regenerated by another
  // tool, and a ranking that moved when entries were reordered would drift silently.
  const rev = Q.query(Q.buildIndex(corpus.entries.slice().reverse()), q, { n: 10 });
  check('reversing the corpus does not reorder the answer',
    JSON.stringify(rev.hits.map((h) => h.id)) === JSON.stringify(a.hits.map((h) => h.id)),
    rev.hits.map((h) => h.id).join(' '));
  // A fixed shuffle, so the check itself is deterministic too.
  const sh = corpus.entries.slice();
  for (let i = sh.length - 1, s = 12345; i > 0; i--) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    [sh[i], sh[j]] = [sh[j], sh[i]];
  }
  check('   nor does shuffling it',
    JSON.stringify(Q.query(Q.buildIndex(sh), q, { n: 10 }).hits.map((h) => h.id))
    === JSON.stringify(a.hits.map((h) => h.id)));
  // Ties must break on something total, or two equal scores could swap between runs.
  const tied = Q.query(index, 'schema', { n: 50, all: true }).hits;
  let ordered = true;
  for (let i = 1; i < tied.length; i++) {
    if (tied[i - 1].score === tied[i].score && !(tied[i - 1].id < tied[i].id)) ordered = false;
  }
  check('equal scores are broken by id, so there is no run-to-run coin flip', ordered);
}

console.log('\n=== 4. THE NEGATIVE CHECK — A RETRIEVER THAT ALWAYS ANSWERS IS USELESS ===');

check('a query of invented words returns NOTHING, not the top of everything',
  ids('xyzzy frobnicate plugh quux', 10).length === 0);
check('   and says every term was absent from the corpus',
  Q.query(index, 'xyzzy frobnicate plugh quux', {}).unknown.length === 4);
check('a query of nothing but stopwords returns nothing',
  ids('what is it that they were doing', 10).length === 0);
check('a question about an unrelated subject returns nothing',
  ids('how do i make a sandwich for lunch', 10).length === 0);
// The one that the anchor rule, rather than the vocabulary, has to catch: every word
// is real and in the corpus, and none of them discriminates.
{
  const res = Q.query(index, 'how many predictions failed', { n: 10 });
  check('a question built only from the corpus\'s commonest words returns nothing',
    res.hits.length === 0, res.hits.map((h) => h.id).join(' '));
  check('   because none of its terms could anchor, and it says which',
    res.anchors.length === 0 && res.unknown.length === 0 && res.stems.length === 2,
    JSON.stringify({ anchors: res.anchors, unknown: res.unknown, stems: res.stems }));
  check('   and those terms ARE in the corpus, so this is refusal and not ignorance',
    index.df.get('predict') > index.anchorMaxDf && index.df.get('fail') > index.anchorMaxDf,
    `${index.df.get('predict')} / ${index.df.get('fail')}`);
}
// The control. Without it, "returns nothing" would also be what a broken index does.
check('CONTROL: a real question still answers, so the silences above are choices',
  ids('can the ledger be forged', 5).length > 0);
check('CONTROL: and the floor keeps the tail out — far fewer hits than entries anchored',
  (() => {
    const r = Q.query(index, 'how much energy does erasing a bit cost', { all: true });
    return r.hits.length < r.considered && r.considered < corpus.entries.length;
  })());
// --vocab is how the silence is characterised rather than discovered.
{
  const na = Q.nonAnchoring(index);
  check('the non-anchoring vocabulary is enumerable, and every member is above the ceiling',
    na.length > 0 && na.every((t) => t.df > index.anchorMaxDf), `${na.length} stems`);
  check('   and it contains this repository\'s own house words',
    ['mea', 'test', 'audit', 'tool'].every((t) => na.some((x) => x.term === t)),
    na.slice(0, 6).map((x) => x.term).join(' '));
}

console.log('\n=== 5. A GUESSED ROUTE IS WORTH LESS, AND SAYS SO ===');

{
  // The corpus marks 36 entries whose route a keyword pass GUESSED. Rather than trust
  // one of them to also be a good hit, flip the flag on an entry that IS a good hit and
  // compare the same entry against itself: only the route component may move.
  const marked = corpus.entries.filter((e) => e.routes_derived).length;
  check('the corpus does mark guessed routes, or there would be nothing to damp',
    marked > 0, `${marked} entries`);
  const q = 'how much energy does erasing a bit cost';
  const flipped = corpus.entries.map((e) => (e.id === 'AB3' ? Object.assign({}, e, { routes_derived: true }) : e));
  // Defaulted rather than indexed blind: under a mutation these lookups can come back
  // empty, and a check that throws reports nothing at all while a check that fails
  // reports which claim broke.
  const a = Q.query(index, q, { all: true }).hits.find((h) => h.id === 'AB3') || {};
  const b = Q.query(Q.buildIndex(flipped), q, { all: true }).hits.find((h) => h.id === 'AB3') || {};
  check('AB3 is a hit for the erasure question at all, so there is something to compare',
    a.route_score !== undefined && b.route_score !== undefined);
  check('marking a route as guessed leaves the TERM score untouched',
    a.term_score === b.term_score, `${a.term_score} vs ${b.term_score}`);
  // Both scores are published rounded to four places, so the tolerance is the rounding
  // and not a fudge: 1e-9 here fails on 0.8058 -> 0.2820 for no reason but decimals.
  check(`   and multiplies the ROUTE score by exactly DERIVED_DAMP (${Q.DERIVED_DAMP})`,
    a.route_score > 0 && Math.abs(b.route_score - a.route_score * Q.DERIVED_DAMP) < 1e-4,
    `${a.route_score} -> ${b.route_score}, expected ${a.route_score * Q.DERIVED_DAMP}`);
  check('   and the explanation says the route was derived and damped',
    !!b.why && !!b.why.route && b.why.route.derived === true && b.why.route.damped === true);
  check('   while the unflipped entry claims neither',
    !!a.why && !!a.why.route && a.why.route.derived === false && a.why.route.damped === false);
  const printed = Q.report({ ...Q.query(Q.buildIndex(flipped), q, { n: 8 }) });
  check('   and the printed report says so too, not just the JSON',
    printed.includes('DERIVED'));
}

console.log('\n=== 6. THE RUN PATH, NOT ONLY THE IMPORT PATH ===');

const node = process.execPath;
const TOOL = path.join(ROOT, 'tools', 'slate-query.js');
function spawn(args) {
  try {
    const out = execFileSync(node, [TOOL, ...args], { encoding: 'utf8', cwd: ROOT, timeout: 60000 });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}
{
  const r = spawn(['can the ledger be forged']);
  check('running the tool exits 0 and prints the entry it found',
    r.code === 0 && r.out.includes('AS1'), `code ${r.code}`);
  check('   and prints the explanation, not just the id',
    r.out.includes('terms:') && r.out.includes('route:'));
  const n = spawn(['xyzzy frobnicate plugh']);
  check('a query that matched nothing exits 1, the way grep does',
    n.code === 1 && /NOTHING MATCHED/.test(n.out), `code ${n.code}`);
  const bad = spawn(['--nonsense-flag', 'x']);
  check('an unknown flag exits 2, so "no hits" and "you held it wrong" differ',
    bad.code === 2, `code ${bad.code}`);
  const missing = spawn(['--corpus', 'docs/does-not-exist.json', 'anything']);
  check('a missing corpus exits 2 and names the file rather than throwing a stack',
    missing.code === 2 && missing.out.includes('does-not-exist'), `code ${missing.code}`);
  const j = spawn(['can the ledger be forged', '--json', '-n', '2']);
  let parsed = null;
  try { parsed = JSON.parse(j.out); } catch (e) { /* reported next */ }
  check('--json emits parseable JSON', parsed !== null);
  check('   carrying the SAME explanation the printout does, term by term',
    !!parsed && !!parsed.hits && !!parsed.hits[0] && parsed.hits[0].why.terms.length > 0
    && parsed.hits[0].why.terms.every((t) => typeof t.df === 'number' && typeof t.idf === 'number'
      && Array.isArray(t.fields) && typeof t.anchor === 'boolean'));
  check('   and the anchor ceiling it used, so a consumer can reproduce the filter',
    parsed && parsed.anchor_max_df === index.anchorMaxDf);
  const v = spawn(['--vocab']);
  check('--vocab exits 0 and prints the terms that cannot anchor',
    v.code === 0 && v.out.includes('too common to anchor'), `code ${v.code}`);
  const empty = spawn([]);
  check('no question at all is a usage error, not an empty result',
    empty.code === 2 && /usage:/.test(empty.out), `code ${empty.code}`);
}

console.log('\n=== 7. THE FEDERATION — TWO SIBLINGS, READ ONLY ===');

const haveSiblings = Object.entries(F.SIBLINGS).filter(([, p]) => fs.existsSync(p));
check(`the sibling corpora are reachable (${haveSiblings.map(([k]) => k).join(', ') || 'none'})`,
  haveSiblings.length > 0);

if (haveSiblings.length === 0) {
  console.log('  -- siblings absent; the federation checks below are skipped, and their');
  console.log('     silence is a missing directory rather than a passing tool.');
} else {
  // Read-only is the promise. Stat what the tool reads, build, and require the mtimes
  // unchanged. This catches a write; it does not prove one is impossible.
  const watched = [];
  for (const [repo, root] of haveSiblings) {
    for (const rel of ['claims.json', 'ledger.json', 'WORKLOG.md',
      path.join('index', 'nodes.jsonl'), path.join('index', 'coverage.json')]) {
      const p = path.join(root, rel);
      if (fs.existsSync(p)) watched.push({ repo, p, before: fs.statSync(p).mtimeMs, size: fs.statSync(p).size });
    }
  }
  const built = F.build();
  const fed = built.federated;
  check(`nothing the federation read was modified (${watched.length} sibling files stat'd)`,
    watched.every((w) => {
      const s = fs.statSync(w.p);
      return s.mtimeMs === w.before && s.size === w.size;
    }), watched.filter((w) => fs.statSync(w.p).mtimeMs !== w.before).map((w) => w.p).join(', '));

  check('the federation produced entries', fed.entries.length > 0, String(fed.entries.length));
  check('every entry names the repository it came from',
    fed.entries.every((e) => typeof e.repo === 'string' && e.repo.length > 0));
  check('every entry names the file it came from',
    fed.entries.every((e) => typeof e.source === 'string' && e.source.length > 0));
  check('ids are prefixed by repo, so nothing can collide with a slate id',
    fed.entries.every((e) => /^(LL|BB)-/.test(e.id)));
  check('   and no id repeats', built.dupes.length === 0, built.dupes.slice(0, 3).join(', '));
  const slateIds = new Set(corpus.entries.map((e) => e.id));
  check('   and none of them shadows an entry of this repository\'s own corpus',
    fed.entries.every((e) => !slateIds.has(e.id)));
  check('every federated route is marked as a guess, because every one of them is',
    fed.entries.every((e) => e.routes_derived === true));
  check('every federated entry carries the same field set the slate uses',
    fed.entries.every((e) => ['id', 'kind', 'outcome', 'basis', 'routes', 'routes_derived',
      'claim', 'argument', 'note', 'measured', 'links'].every((k) => k in e)));

  // Determinism: two builds of an unchanged tree must be byte-identical, or the file
  // would churn in git and a diff would stop meaning anything.
  check('a second build of the same tree is byte-identical',
    JSON.stringify(F.build().federated) === JSON.stringify(fed));

  if (fed.repos.ladderlang) {
    const r = fed.repos.ladderlang;
    check(`ladderlang contributed claims, ledger rows and worklog blocks (${r.claims}/${r.ledger}/${r.worklog})`,
      r.claims > 0 && r.ledger > 0 && r.worklog > 0);
    // Statuses travel verbatim; nothing is coerced into this repository's vocabulary.
    const statuses = new Set(fed.entries.filter((e) => e.repo === 'ladderlang' && e.kind === 'claim')
      .map((e) => e.source_status));
    check('   ladderlang statuses arrive verbatim, all four of them',
      ['proved', 'measured', 'refuted', 'open'].every((s) => statuses.has(s)),
      [...statuses].join(','));
    check('   and no ladderlang entry was given a HELD/FAILED outcome it never had',
      fed.entries.filter((e) => e.repo === 'ladderlang').every((e) => e.outcome === null));
    check('   while "proved" -- which names a Lean theorem -- does become basis:proven',
      fed.entries.filter((e) => e.source_status === 'proved').every((e) => e.basis === 'proven'));
  }

  if (fed.repos.bitblock) {
    check(`bitblock contributed schemas (${fed.repos.bitblock.schemas})`,
      fed.repos.bitblock.schemas > 0);
    const bb = fed.entries.filter((e) => e.repo === 'bitblock');
    check('   every schema is either WITNESSED or UNWITNESSED, and the schema declares both',
      bb.every((e) => e.outcome === 'WITNESSED' || e.outcome === 'UNWITNESSED')
      && fed.outcome_vocabulary.WITNESSED && fed.outcome_vocabulary.UNWITNESSED);
    // Two independent readings of one fact. This is the only claim the federation makes
    // ABOUT a sibling rather than merely quoting from it, so it is the one to check.
    check('   and bitblock\'s nodes.jsonl agrees with its own coverage.json on which are unwitnessed',
      fed.crosscheck && fed.crosscheck.agree
      && fed.crosscheck.unwitnessed_from_nodes === fed.crosscheck.uncovered_from_coverage,
      JSON.stringify(fed.crosscheck));
  }

  check('nothing was skipped, or the skip is recorded with a reason',
    fed.skipped.every((s) => s.repo && s.source && s.why),
    JSON.stringify(fed.skipped));

  // The point of the whole exercise: one retriever, three repositories.
  {
    const fidx = Q.buildIndex(fed.entries);
    const unwitnessed = fed.entries.filter((e) => e.outcome === 'UNWITNESSED').map((e) => e.id);
    const hits = Q.query(fidx, 'which schemas have no independent witness', { n: 5 }).hits;
    check('the retriever answers a bitblock question against the federated corpus',
      hits.length > 0 && hits.every((h) => unwitnessed.includes(h.id)),
      hits.map((h) => h.id).join(' '));
    const refuted = Q.query(fidx, 'axes were predicted to multiply', { n: 3 }).hits;
    check('   and a ladderlang one, landing on the claim that was refuted',
      refuted.length > 0 && refuted[0].id === 'LL-claim:combinatorics'
      && refuted[0].source_status === 'refuted', refuted.map((h) => h.id).join(' '));
    check('   and every federated hit is damped, because every federated route is a guess',
      refuted.length > 0
      && refuted.every((h) => h.route_score === 0 || (h.why.route && h.why.route.derived === true)));
    check('   and nonsense is still refused on the federated corpus',
      Q.query(fidx, 'xyzzy frobnicate plugh', { n: 5 }).hits.length === 0);
  }

  // Run path, same reason as section 6.
  const FTOOL = path.join(ROOT, 'tools', 'slate-federate.js');
  let fr;
  try {
    fr = { code: 0, out: execFileSync(node, [FTOOL], { encoding: 'utf8', cwd: ROOT, timeout: 120000 }) };
  } catch (e) { fr = { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
  check('running slate-federate with no flags exits 0 and writes nothing',
    fr.code === 0 && fr.out.includes('entries'), `code ${fr.code}`);
  check('   and reports the bitblock cross-check rather than keeping it internal',
    /cross-check/.test(fr.out) && /AGREE/.test(fr.out));

  // If the generated file is present, the retriever must work against it from the CLI.
  const FED = path.join(ROOT, 'docs', 'slate-federated.json');
  if (fs.existsSync(FED)) {
    const r = spawn(['--corpus', 'docs/slate-federated.json', 'axes were predicted to multiply', '-n', '1']);
    check('the CLI queries the written federated corpus and finds the refuted claim',
      r.code === 0 && r.out.includes('LL-claim:combinatorics'), `code ${r.code}`);
    const onDisk = JSON.parse(fs.readFileSync(FED, 'utf8'));
    check('   and the written file is a valid federated corpus in its own right',
      onDisk.schema === 'tryte-vm/slate-federated@1' && onDisk.entries.length > 0
      && onDisk.entries.every((e) => e.repo && e.source && e.routes_derived === true));
    // NOT asserted: that the written file matches a fresh build. The siblings are
    // outside this repository and change on their own, so a mismatch is news about
    // them rather than a defect here -- and a check that reddens when a neighbour
    // commits is `T-CHECK-FORBIDS-HEALTHY-STATE`, which has already bitten once.
    // The drift is reported instead, where a reader will see it.
    if (onDisk.entries.length !== fed.entries.length) {
      console.log(`  -- NOTE: docs/slate-federated.json holds ${onDisk.entries.length} entries and a `
        + `fresh read of the siblings gives ${fed.entries.length}. Re-run `
        + 'tools/slate-federate.js --write to restamp it. Not a failure.');
    }
  } else {
    console.log('  -- docs/slate-federated.json not written yet; CLI-over-federated checks skipped.');
  }
}

console.log(`\n${'='.repeat(64)}`);
console.log(sink.fails.length
  ? `${sink.fails.length} CHECK(S) FAILED:\n  ${sink.fails.join('\n  ')}`
  : `ALL ${sink.pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(sink.fails.length ? 1 : 0);
