'use strict';
/* SLATE-QUERY — a plain-language question in, ranked corpus entries out.
 *
 * `docs/slate.json` is a retrieval-shaped projection of the manifest, and until now
 * nothing read it except the published page's filter buttons. A filter needs you to
 * already know the route. A question does not. This is the retriever.
 *
 *     node tools/slate-query.js "how much energy does erasing a bit cost"
 *     node tools/slate-query.js "can the ledger be forged" --json
 *     node tools/slate-query.js "what does a summary statistic hide" -n 10
 *     node tools/slate-query.js --corpus docs/slate-federated.json "declared schema"
 *     node tools/slate-query.js --vocab
 *
 * Exit status follows grep: 0 when something matched, 1 when nothing did, 2 on a
 * usage error. "Nothing matched" is an answer, not a failure, which is why it is
 * distinguishable from a crash rather than folded into it.
 *
 * ---------------------------------------------------------------------------
 * HOW A HIT IS SCORED, AND WHY EVERY HIT MUST SAY SO
 *
 * A ranking nobody can audit is exactly the kind of claim this repository does not
 * accept from a tool, so every hit carries the terms that carried it, their document
 * frequencies, and the route it landed on. `--json` carries the same payload as the
 * printout: an explanation that only humans can see is not an explanation a program
 * can check.
 *
 *   TERM COMPONENT   Weighted term frequency over the entry's own fields, times the
 *                    inverse document frequency of the term across the corpus. tf is
 *                    log-saturated (1 + ln tf) so a long note cannot win by bulk
 *                    alone. Fields are weighted: the id and the claim carry most,
 *                    the argument and note somewhat less, the structural fields
 *                    (set, tool, outcome, the KEYS of `measured`) least.
 *
 *   ROUTE COMPONENT  Routes are topic tags, and an entry can be about a subject
 *                    without using the query's words. For each route, the affinity to
 *                    the query is the idf-weighted share of that route's entries that
 *                    carry each query term -- derived from the corpus, not from a
 *                    hand-written topic lexicon, because a lexicon would be a second
 *                    editorial claim smuggled in beside the corpus's own. A direct
 *                    hit on the route's NAME counts too. The component is capped at
 *                    ROUTE_SHARE of one strong term, so route affinity can promote a
 *                    near-miss but can never be the whole reason for a hit.
 *
 *   DERIVED ROUTES   `render-slate.js` marks a route it GUESSED from keywords with
 *                    `routes_derived: true`, and this weights those at DERIVED_DAMP.
 *                    The damping applies to the route component only, because the
 *                    flag is a statement about the tag and not about the prose. Every
 *                    damped hit says `route derived, damped` in its explanation.
 *
 *   ANCHORING        A hit must be carried by at least one ANCHOR term: a query term
 *                    that occurs in the corpus in fewer than ANCHOR_DF_SHARE of its
 *                    entries. Terms too common to discriminate still contribute to the
 *                    score; they cannot, alone, cause a hit. Below the anchor rule
 *                    sits a relative floor -- an entry scoring under FLOOR_SHARE of
 *                    the best is dropped rather than padded into a top-N.
 *
 * A retriever that always answers is a retriever that cannot be wrong, which makes it
 * useless. The anchor rule is what lets this one return nothing.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS CANNOT FIND, so the silence is not read as coverage
 *
 * 1. IRREGULAR MORPHOLOGY. The stemmer strips suffixes; it does not know that "hide"
 *    and "hidden", or "is" and "was", are the same word. A query using an irregular
 *    form of a word the corpus spells regularly will miss on that term.
 * 2. SYNONYMS. There is no thesaurus, deliberately. "expensive" does not reach "cost",
 *    "trit" does not reach "ternary". Every match is a shared stem or a shared route.
 * 3. WEAK-BUT-REAL QUERIES. The anchor rule errs toward silence, and it does refuse
 *    real questions. "how many predictions failed" returns NOTHING on this corpus:
 *    `predict` and `fail` are each above the anchor ceiling, so neither discriminates
 *    and neither can anchor. That question is a filter rather than a retrieval --
 *    `--outcome FAILED` answers it -- but the tool does not say so, it just goes
 *    quiet. `--vocab` prints the whole non-anchoring vocabulary and its live counts;
 *    on the tryte-vm corpus it is a couple of dozen stems, and they are the
 *    repository's own house words -- measured, test, audit, tool, held, registered,
 *    predicted, failed, count. A question about the METHOD is therefore far likelier
 *    to hit this wall than a question about a RESULT. No count is quoted here on
 *    purpose: the corpus grows under this file, and `--vocab` is the live answer.
 * 4. NEGATION AND STRUCTURE. "predictions that FAILED about erasure" is scored as a
 *    bag of words; `failed` matches the outcome field as a token and nothing enforces
 *    it. `--outcome FAILED`, `--kind trap`, `--route erasure` and `--status refuted`
 *    are real filters and compose with a query; the query text alone cannot express
 *    any of them, and a status word in prose outranks the same word in the status
 *    FIELD, because the field is weighted as structure rather than as subject.
 * 5. LENGTH. tf is saturated but not normalised by entry length, so a long note still
 *    has more surface to match on than a one-line prediction. Notes rank high on broad
 *    questions partly for that reason, and partly because they are written to answer
 *    broad questions. This tool cannot separate the two.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAIN = require.main === module;

/* --- constants, in one place so the test can read them rather than restate them --- */

/** Field weights. The id and claim are what an entry IS; the rest supports them. */
const FIELD_WEIGHTS = {
  id: 3,
  claim: 3,
  subject: 2,
  argument: 1.5,
  note: 1.5,
  set: 1,
  tool: 0.75,
  asserted_in: 0.75,
  measured: 0.75,
  outcome: 0.5,
  basis: 0.5,
  repo: 2,          // federated corpora only
  source: 0.75,     // federated corpora only
  source_status: 1, // federated corpora only
};

/** Route affinity may contribute at most this share of the strongest query term. */
const ROUTE_SHARE = 0.30;
/** A guessed route is worth this much of an assigned one. */
const DERIVED_DAMP = 0.35;
/** A term occurring in more than this share of the corpus cannot anchor a hit. */
const ANCHOR_DF_SHARE = 0.25;
/** Entries scoring below this share of the best hit are dropped, not padded in. */
const FLOOR_SHARE = 0.10;
/** Default number of hits printed. */
const DEFAULT_N = 6;

/**
 * Words carrying no retrieval signal in English. Kept short and explicit: a long
 * stoplist is a hidden editorial claim about what a question can be about. Terms
 * dropped here are the ones that would otherwise anchor nothing anyway, and the
 * anchor rule below is what actually does the work.
 */
const STOPWORDS = new Set(('a an and are as at be been but by can could did do does doing '
  + 'for from had has have how i if in into is it its of on or over so than that the their '
  + 'them then there these they this to was were what when where which while who whom why '
  + 'will with would you your it\'s about any been being not no nor too very '
  // Quantifiers and pro-forms. These are rare enough in this corpus to pass the anchor
  // rule on document frequency alone while carrying no subject at all -- "much" sits in
  // 14 entries and would otherwise outrank "cost". Frequency is not the same as
  // aboutness, and this is the one place the tool says so by hand.
  + 'much many more most some such also only both each every other another '
  + 'thing things way ways get got make made').split(' '));

/* --- tokenising and stemming ------------------------------------------------------ */

/**
 * Suffixes stripped, longest first, to a fixpoint. Iterating to a fixpoint is not
 * cosmetic: a single pass stems "numbers" to "number" and "number" to "numb", so the
 * plural and the singular of the same word would land in different buckets. The test
 * asserts stem(stem(x)) === stem(x) across the whole corpus vocabulary for exactly
 * that reason.
 */
const SUFFIXES = [
  'ibility', 'ability', 'ization', 'ational', 'iveness', 'fulness', 'ousness',
  'ations', 'ities', 'ility', 'ement', 'ation', 'ingly', 'ously',
  'ible', 'able', 'ness', 'ment', 'ions', 'ives', 'ency', 'ancy', 'ery',
  'ing', 'ion', 'ies', 'ive', 'ity', 'ure', 'ous', 'est', 'ely', 'ers',
  'ed', 'es', 'ly', 'er', 'al', 'ur', 'e', 's',
];
/**
 * Below this length a strip is refused, so short words survive intact. The plural
 * gets a shorter floor because three-letter nouns are real here -- "bit", "tap",
 * "set" -- and a floor of four would leave "bits" and "bit" in different buckets.
 *
 * Four rather than three for everything else was chosen by MEASUREMENT, not taste: at
 * three, "reversible" and "revealed" both collapse to `rev`, and "min" -- an opcode in
 * this corpus -- collapses together with "mining". Both false merges disappear at
 * four, at the price of "mining" no longer meeting "mine". The stemmer errs toward
 * keeping distinct words distinct, because a false merge silently answers the wrong
 * question while a false split merely fails to answer.
 */
const MIN_STEM = 4;
const MIN_STEM_PLURAL = 3;

function stemOnce(w) {
  for (const suf of SUFFIXES) {
    if (w.length > suf.length && w.endsWith(suf)) {
      const cut = w.slice(0, w.length - suf.length);
      const floor = suf === 's' ? MIN_STEM_PLURAL : MIN_STEM;
      if (cut.length >= floor) {
        // "entries" -> "entry", not "entr", so it meets the singular.
        if (suf === 'ies') return cut + 'y';
        return cut;
      }
    }
  }
  return w;
}

/** Strip to a fixpoint. The loop is bounded by the word shrinking every iteration. */
function stem(w) {
  let cur = w;
  for (let i = 0; i < 12; i++) {
    const next = stemOnce(cur);
    if (next === cur || next.length >= cur.length) return next;
    cur = next;
  }
  return cur;
}

/**
 * Text to stems. Digit group separators are removed first, so the corpus's "21,840"
 * is one token and can be asked for as one. Everything else splits on non-alphanumeric.
 */
function tokenize(text) {
  if (text === null || text === undefined) return [];
  const flat = String(text).toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1');
  const out = [];
  for (const raw of flat.split(/[^a-z0-9]+/)) {
    if (!raw) continue;
    if (raw.length < 2) continue;
    if (STOPWORDS.has(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}

/** The same, but keeping the surface form beside the stem, for explanations. */
function tokenizeQuery(text) {
  const flat = String(text).toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1');
  const out = [];
  const seen = new Set();
  for (const raw of flat.split(/[^a-z0-9]+/)) {
    if (!raw || raw.length < 2 || STOPWORDS.has(raw)) continue;
    const s = stem(raw);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push({ surface: raw, stem: s });
  }
  return out;
}

/* --- the index -------------------------------------------------------------------- */

/** The text of one field, flattened. `measured` contributes its KEYS, not its values. */
function fieldText(entry, field) {
  const v = entry[field];
  if (v === null || v === undefined) return '';
  if (field === 'measured' && typeof v === 'object') return Object.keys(v).join(' ');
  if (Array.isArray(v)) return v.join(' ');
  if (typeof v === 'object') return Object.keys(v).join(' ');
  return String(v);
}

/**
 * Build the inverted index. Routes are deliberately NOT in an entry's own term bag:
 * they get their own component below, so a route match and a text match never get
 * silently added together under one name.
 */
function buildIndex(entries) {
  const docs = entries.map((e) => {
    const bag = new Map(); // stem -> { tf, fields:Set }
    for (const [field, w] of Object.entries(FIELD_WEIGHTS)) {
      const text = fieldText(e, field);
      if (!text) continue;
      for (const t of tokenize(text)) {
        let rec = bag.get(t);
        if (!rec) { rec = { tf: 0, fields: new Set() }; bag.set(t, rec); }
        rec.tf += w;
        rec.fields.add(field);
      }
    }
    return { entry: e, bag };
  });

  const N = docs.length;
  const df = new Map();
  for (const d of docs) for (const t of d.bag.keys()) df.set(t, (df.get(t) || 0) + 1);

  const idf = new Map();
  for (const [t, n] of df) idf.set(t, Math.log((N + 1) / (n + 0.5)));

  // Route profiles: for each route, how many of its entries carry each stem. Derived
  // from the corpus itself, so no second topic lexicon has to be trusted.
  const routeMembers = new Map(); // route -> doc indices
  docs.forEach((d, i) => {
    for (const r of (d.entry.routes || [])) {
      if (!routeMembers.has(r)) routeMembers.set(r, []);
      routeMembers.get(r).push(i);
    }
  });
  const routeDf = new Map(); // route -> Map(stem -> count)
  for (const [r, idxs] of routeMembers) {
    const m = new Map();
    for (const i of idxs) for (const t of docs[i].bag.keys()) m.set(t, (m.get(t) || 0) + 1);
    routeDf.set(r, m);
  }
  const routeNameStems = new Map();
  for (const r of routeMembers.keys()) routeNameStems.set(r, new Set(tokenize(r.replace(/-/g, ' '))));

  const anchorMaxDf = Math.max(1, Math.floor(N * ANCHOR_DF_SHARE));

  return { docs, N, df, idf, routeMembers, routeDf, routeNameStems, anchorMaxDf };
}

/* --- scoring ---------------------------------------------------------------------- */

/**
 * Route affinity for one route against one query, in [0, 1] before normalisation.
 * A route whose entries mostly carry the query's rare terms scores high; a route the
 * query merely NAMES also scores, because asking about "erasure" should reach the
 * erasure route whether or not the word is common inside it.
 */
function routeAffinities(index, qterms) {
  const aff = new Map();
  let best = 0;
  for (const [r, idxs] of index.routeMembers) {
    const m = index.routeDf.get(r);
    const names = index.routeNameStems.get(r);
    let s = 0;
    const why = [];
    for (const q of qterms) {
      const idf = index.idf.get(q.stem);
      if (idf === undefined) continue;
      const share = (m.get(q.stem) || 0) / idxs.length;
      if (share > 0) { s += idf * share; why.push(`${q.stem}:${(share * 100).toFixed(0)}%`); }
      if (names.has(q.stem)) { s += idf; why.push(`${q.stem}=name`); }
    }
    aff.set(r, { raw: s, why });
    if (s > best) best = s;
  }
  for (const v of aff.values()) v.norm = best > 0 ? v.raw / best : 0;
  return { aff, best };
}

/**
 * Rank the corpus against a question.
 *
 * Returns `{ query, terms, unknown, anchors, hits, considered, floor }`. `hits` is
 * empty when the question had no anchor -- deliberately, and see the header.
 */
function query(index, questionText, opts = {}) {
  const n = opts.n || DEFAULT_N;
  const qterms = tokenizeQuery(questionText);

  const known = qterms.filter((q) => index.idf.has(q.stem));
  const unknown = qterms.filter((q) => !index.idf.has(q.stem)).map((q) => q.surface);
  const anchors = known.filter((q) => index.df.get(q.stem) <= index.anchorMaxDf);

  const maxIdf = known.reduce((a, q) => Math.max(a, index.idf.get(q.stem)), 0);
  const routeCap = ROUTE_SHARE * maxIdf;
  const { aff } = routeAffinities(index, known);

  const scored = [];
  for (const d of index.docs) {
    const termWhy = [];
    let termScore = 0;
    let anchored = false;
    for (const q of known) {
      const rec = d.bag.get(q.stem);
      if (!rec) continue;
      const idf = index.idf.get(q.stem);
      const w = idf * (1 + Math.log(rec.tf));
      termScore += w;
      const dfv = index.df.get(q.stem);
      const isAnchor = dfv <= index.anchorMaxDf;
      if (isAnchor) anchored = true;
      termWhy.push({
        query: q.surface,
        term: q.stem,
        tf: Number(rec.tf.toFixed(2)),
        df: dfv,
        idf: Number(idf.toFixed(3)),
        weight: Number(w.toFixed(3)),
        anchor: isAnchor,
        fields: [...rec.fields].sort(),
      });
    }
    if (!anchored) continue;

    // Best route this entry sits on, damped if the route was a guess.
    let routeWhy = null;
    let routeScore = 0;
    for (const r of (d.entry.routes || [])) {
      const a = aff.get(r);
      if (!a) continue;
      const damp = d.entry.routes_derived ? DERIVED_DAMP : 1;
      const contrib = routeCap * a.norm * damp;
      if (contrib > routeScore || routeWhy === null) {
        routeScore = contrib;
        routeWhy = {
          route: r,
          affinity: Number(a.norm.toFixed(3)),
          contribution: Number(contrib.toFixed(3)),
          derived: !!d.entry.routes_derived,
          // Read off the multiplier that was actually applied, not off the flag that
          // was supposed to cause it. Restating the flag here would let the damping be
          // removed while the explanation went on claiming it -- which is what the
          // mutation run found, so this line is a repair rather than a preference.
          damped: damp !== 1 && a.norm > 0,
          because: a.why.slice(0, 4),
        };
      }
    }

    termWhy.sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));
    scored.push({
      id: d.entry.id,
      kind: d.entry.kind,
      outcome: d.entry.outcome || null,
      basis: d.entry.basis || null,
      routes: d.entry.routes || [],
      routes_derived: !!d.entry.routes_derived,
      repo: d.entry.repo || null,
      source: d.entry.source || null,
      source_status: d.entry.source_status || null,
      score: Number((termScore + routeScore).toFixed(4)),
      term_score: Number(termScore.toFixed(4)),
      route_score: Number(routeScore.toFixed(4)),
      why: { terms: termWhy, route: routeWhy },
      claim: d.entry.claim || null,
    });
  }

  // Deterministic: score descending, then id ascending. Never insertion order, so a
  // regenerated corpus that reorders entries cannot reorder the answer.
  scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const top = scored.length ? scored[0].score : 0;
  const floor = top * FLOOR_SHARE;
  let hits = scored.filter((h) => h.score >= floor);

  if (opts.outcome) hits = hits.filter((h) => h.outcome === opts.outcome);
  if (opts.kind) hits = hits.filter((h) => h.kind === opts.kind);
  if (opts.route) hits = hits.filter((h) => h.routes.includes(opts.route));
  if (opts.status) hits = hits.filter((h) => h.source_status === opts.status);

  return {
    query: questionText,
    terms: qterms.map((q) => q.surface),
    stems: qterms.map((q) => q.stem),
    unknown,
    anchors: anchors.map((q) => q.surface),
    anchor_max_df: index.anchorMaxDf,
    corpus_size: index.N,
    // The declared ceiling on the route component for THIS query, published so a
    // consumer can check the cap rather than re-derive it and disagree.
    route_cap: Number(routeCap.toFixed(4)),
    considered: scored.length,
    floor: Number(floor.toFixed(4)),
    hits: opts.all ? hits : hits.slice(0, n),
  };
}

/* --- loading ---------------------------------------------------------------------- */

function loadCorpus(file) {
  const p = path.isAbsolute(file) ? file : path.join(ROOT, file);
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!raw || !Array.isArray(raw.entries)) {
    throw new Error(`slate-query: ${file} has no entries array`);
  }
  return raw;
}

/** Terms too common to anchor anything. Printed by --vocab, so the gap is visible. */
function nonAnchoring(index) {
  const out = [];
  for (const [t, n] of index.df) if (n > index.anchorMaxDf) out.push({ term: t, df: n });
  out.sort((a, b) => b.df - a.df || a.term.localeCompare(b.term));
  return out;
}

/* --- printing --------------------------------------------------------------------- */

function clip(s, n) {
  if (!s) return '';
  const one = String(s).replace(/\s+/g, ' ').trim();
  return one.length <= n ? one : one.slice(0, n - 3) + '...';
}

function report(res) {
  const L = [];
  L.push(`\nSLATE-QUERY  "${res.query}"`);
  L.push(`  ${res.corpus_size} entries; terms ${res.stems.join(' ') || '(none)'}`);
  if (res.unknown.length) L.push(`  not in the corpus at all: ${res.unknown.join(', ')}`);
  L.push(`  anchors (df <= ${res.anchor_max_df}): ${res.anchors.join(', ') || 'NONE'}`);
  L.push('');
  if (!res.hits.length) {
    L.push(res.anchors.length
      ? '  no entry scored above the floor.'
      : '  NOTHING MATCHED. No query term is rare enough in this corpus to anchor a hit,');
    if (!res.anchors.length) {
      L.push('  so this returns nothing rather than the top of everything. Try a term the');
      L.push('  corpus actually discriminates on; `--vocab` lists the ones it does not.');
    }
    return L.join('\n');
  }
  let rank = 0;
  for (const h of res.hits) {
    rank++;
    const tag = [h.kind, h.outcome, h.source_status, h.basis === 'proven' ? 'proven' : null, h.repo]
      .filter(Boolean).join(' / ');
    L.push(`  ${String(rank).padStart(2)}. ${h.id}   ${h.score.toFixed(3)}   [${tag}]`);
    L.push(`      ${clip(h.claim, 150)}`);
    const terms = h.why.terms.slice(0, 5).map((t) => {
      const a = t.anchor ? '' : ' (common, cannot anchor)';
      return `${t.query}->${t.term} x${t.tf} df=${t.df} +${t.weight.toFixed(2)}${a} in ${t.fields.join('+')}`;
    });
    L.push(`      terms: ${terms.join('; ')}`);
    if (h.why.route && h.why.route.contribution > 0) {
      const r = h.why.route;
      L.push(`      route: ${r.route} affinity ${r.affinity} -> +${r.contribution.toFixed(3)}`
        + (r.derived ? `  [route DERIVED by keyword, damped x${DERIVED_DAMP}]` : '')
        + (r.because.length ? `  (${r.because.join(' ')})` : ''));
    } else if (h.routes_derived) {
      L.push(`      route: ${h.routes.join(',')}  [DERIVED by keyword, damped x${DERIVED_DAMP}; no affinity]`);
    }
    L.push('');
  }
  L.push(`  ${res.considered} entries were anchored; ${res.hits.length} shown above the `
    + `floor of ${res.floor.toFixed(3)}.`);
  return L.join('\n');
}

/* --- CLI -------------------------------------------------------------------------- */

function parseArgv(argv) {
  const o = { corpus: 'docs/slate.json', n: DEFAULT_N, json: false, all: false, vocab: false };
  const words = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--all') o.all = true;
    else if (a === '--vocab') o.vocab = true;
    else if (a === '-n' || a === '--top') o.n = parseInt(argv[++i], 10);
    else if (a === '--corpus') o.corpus = argv[++i];
    else if (a === '--outcome') o.outcome = argv[++i];
    else if (a === '--kind') o.kind = argv[++i];
    else if (a === '--route') o.route = argv[++i];
    else if (a === '--status') o.status = argv[++i];
    else if (a.startsWith('-')) { o.error = `unknown flag ${a}`; }
    else words.push(a);
  }
  o.question = words.join(' ');
  if (!o.n || o.n < 1) o.n = DEFAULT_N;
  return o;
}

function main(argv) {
  const o = parseArgv(argv);
  if (o.error) { console.error(`slate-query: ${o.error}`); return 2; }
  let corpus;
  try { corpus = loadCorpus(o.corpus); } catch (e) { console.error(`slate-query: ${e.message}`); return 2; }
  const index = buildIndex(corpus.entries);

  if (o.vocab) {
    const na = nonAnchoring(index);
    if (o.json) { console.log(JSON.stringify({ anchor_max_df: index.anchorMaxDf, corpus_size: index.N, non_anchoring: na }, null, 1)); return 0; }
    console.log(`\nSLATE-QUERY --vocab   ${index.N} entries, a term anchors only below df ${index.anchorMaxDf}\n`);
    console.log(`  ${na.length} of ${index.df.size} stems are too common to anchor a hit on their own:\n`);
    for (const t of na) console.log(`    ${t.term.padEnd(22)} df ${t.df}`);
    console.log('\n  A question built only from these returns nothing. That is the tool\'s'
      + '\n  silence, stated rather than discovered.\n');
    return 0;
  }

  if (!o.question) {
    console.error('usage: node tools/slate-query.js "a question" [-n N] [--json] [--corpus f] [--vocab]');
    return 2;
  }

  const res = query(index, o.question, o);
  if (o.json) console.log(JSON.stringify(res, null, 1));
  else console.log(report(res));
  return res.hits.length ? 0 : 1;
}

if (MAIN) process.exit(main(process.argv.slice(2)));

module.exports = {
  stem, stemOnce, tokenize, tokenizeQuery, buildIndex, query, loadCorpus,
  routeAffinities, nonAnchoring, report, parseArgv, main, fieldText,
  FIELD_WEIGHTS, ROUTE_SHARE, DERIVED_DAMP, ANCHOR_DF_SHARE, FLOOR_SHARE,
  STOPWORDS, SUFFIXES, MIN_STEM, DEFAULT_N,
};
