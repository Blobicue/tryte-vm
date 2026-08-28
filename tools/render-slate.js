'use strict';
/* RENDER-SLATE — the corpus as a retrievable index.
 *
 * `FINDINGS.json` is the authority and `results/99-ledger.md` is it rendered for
 * reading. Neither is shaped for RETRIEVAL: the manifest nests predictions inside sets
 * inside a document, and the ledger is prose. A retriever wants flat, addressable
 * chunks with stable ids, typed fields, topic routes and cross-links.
 *
 * This emits that projection. Every prediction, every unregistered finding, every
 * defect class and every authored note becomes ONE entry with:
 *
 *     id        stable, and the same id the manifest and the tests already use
 *     kind      prediction | finding | trap | note
 *     outcome   HELD | FAILED | MEASURED_NOT_REGISTERED   (predictions and findings)
 *     basis     measured | proven                          (where the manifest carries it)
 *     routes    topic tags, so a question lands on every entry that bears on it
 *     links     other entry ids, so a claim walks back to the runs underneath it
 *     text      the claim and its note, unabridged
 *
 * ROUTES ARE EDITORIAL FIRST AND DERIVED ONLY AS A FALLBACK, AND EVERY ENTRY SAYS
 * WHICH IT GOT. They are assigned per set below, overridden per entry where a set spans
 * two subjects, and only where neither names one does a keyword pass guess -- setting
 * `routes_derived: true` when it does. A route is a claim about what a finding is
 * ABOUT, which is exactly the kind of claim this project does not let a tool make
 * silently, so a guess is labelled as a guess and a retriever can weight it lower.
 * Anything the keywords cannot place stays `unrouted` rather than being filed
 * plausibly.
 *
 * The notes are hand-authored in `docs/slate-notes.json` and are marginalia rather
 * than results: each one names the entries it generalises over, and carries no
 * outcome, because a note was never registered and never at risk.
 *
 *     node tools/render-slate.js            # report
 *     node tools/render-slate.js --write    # write docs/slate.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };

/** Topic routes per set. Editorial, and the only hand-assigned field here. */
const SET_ROUTES = {
  P: ['reach'], Q: ['reach'], R: ['reach'], S: ['reach'], U: ['device'], V: ['device'],
  W: ['device'], X: ['device'], Y: ['device'], Z: ['device'], E: ['device'],
  F: ['device'], G: ['device'], H: ['device'], I: ['device'], J: ['device'],
  K: ['device'], B: ['memory'], C: ['memory'], A: ['memory'], D: ['hashing'],
  M: ['algebra', 'ternary-vs-binary'], O: ['algebra', 'ternary-vs-binary'],
  N: ['cost-model'], T: ['device'], AA: ['device'], AB: ['erasure'],
  AC: ['cost-model'], AD: ['cost-model'], AE: ['music'], AF: ['music'],
  AG: ['cost-model'], AH: ['cost-model'], AI: ['reversibility', 'algebra'],
  AJ: ['reversibility'], AK: ['reversibility', 'cost-model'],
  AL: ['algebra', 'learning'], AM: ['learning'], AN: ['puzzle', 'summary-statistics'],
  AO: ['erasure', 'summary-statistics'], AP: ['keys', 'ternary-vs-binary'],
  L: ['device'],
};

/** Per-entry overrides, where one prediction sits in a different subject to its set. */
const ENTRY_ROUTES = {
  D4: ['hashing', 'summary-statistics'],
  AN1: ['puzzle', 'summary-statistics', 'instrument'],
  AN2: ['puzzle', 'reversibility', 'algebra'],
  AN3: ['puzzle', 'erasure'],
  AO1: ['erasure', 'summary-statistics', 'instrument'],
  AO2: ['erasure', 'hashing'],
  AK4: ['cost-model', 'reversibility'],
  AP3: ['keys', 'ternary-vs-binary', 'method'],
  AP4: ['keys', 'erasure', 'method'],
  'F-REVERSIBLE-CANNOT-DESTROY': ['reversibility', 'erasure', 'keys'],
  'F-LAMPORT-BASE-ADVANTAGE-IS-NOT-PER-SIZE': ['keys', 'ternary-vs-binary', 'method'],
  'F-FINDABILITY-NOT-COUNT': ['ledger', 'hashing', 'summary-statistics'],
  'F-MIXER-HEAD-IS-NOT-FLAT': ['ledger', 'hashing'],
};

/**
 * Keyword fallback for entries no editorial route names -- chiefly the unregistered
 * findings, which belong to no set. A derived route is marked as derived on the entry
 * rather than passed off as an assignment, because a route is a claim about what a
 * finding is ABOUT and this project does not let a tool make that claim silently.
 */
const DERIVED = [
  [/eras|destroy|wipe|bits? destroyed|preimage/i, 'erasure'],
  [/reversib|bijecti|in-degree|injectiv|invert/i, 'reversibility'],
  [/affine|GF\(3\)|orthomorph|alternating|A_27|group/i, 'algebra'],
  [/hash|mix|collision|truncat/i, 'hashing'],
  [/tick|cost|switch|tap|cycle|depth|work/i, 'cost-model'],
  [/binary|ternary|trit|bit/i, 'ternary-vs-binary'],
  [/instrument|tool|checker|memois/i, 'instrument'],
  [/register|predict|scope|decoration/i, 'method'],
];

function routesFor(id, setId, text) {
  if (ENTRY_ROUTES[id]) return { routes: ENTRY_ROUTES[id], derived: false };
  if (SET_ROUTES[setId]) return { routes: SET_ROUTES[setId], derived: false };
  const hits = DERIVED.filter(([re]) => re.test(text || '')).map(([, r]) => r);
  return hits.length
    ? { routes: [...new Set(hits)].slice(0, 3), derived: true }
    : { routes: ['unrouted'], derived: true };
}

/** Ids this corpus uses, so `links` can be validated rather than trusted. */
function build() {
  const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'FINDINGS.json'), 'utf8'));
  const NOTES = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'slate-notes.json'), 'utf8'));
  const entries = [];

  for (const set of M.prediction_sets) {
    for (const p of set.predictions) {
      const r = routesFor(p.id, set.id, `${p.claim} ${p.note || ''}`);
      entries.push({
        id: p.id,
        kind: 'prediction',
        set: set.id,
        subject: set.subject,
        outcome: p.outcome,
        basis: p.basis || 'measured',
        routes: r.routes,
        routes_derived: r.derived,
        claim: p.claim,
        argument: p.argument || null,
        note: p.note || null,
        measured: p.measured || null,
        tool: set.tool,
        asserted_in: set.asserted_in,
        registered_at: set.registered_at,
        results_at: set.results_at,
        links: [],
      });
    }
  }
  for (const f of M.unregistered_findings) {
    const r = routesFor(f.id, null, `${f.id} ${f.claim}`);
    entries.push({
      id: f.id, kind: 'finding', set: null, subject: null,
      outcome: f.outcome, basis: f.basis || 'measured',
      routes: r.routes, routes_derived: r.derived,
      claim: f.claim, argument: f.argument || null, note: null, measured: null,
      tool: null, asserted_in: f.asserted_in || null,
      registered_at: null, results_at: null, links: [],
    });
  }
  for (const t of M.traps_encountered) {
    entries.push({
      id: t.id, kind: 'trap', set: null, subject: null,
      outcome: null, basis: 'measured', routes: ['instrument', 'method'],
      routes_derived: false,
      claim: t.description, argument: null, note: null,
      measured: { bites: t.count }, tool: null, asserted_in: null,
      registered_at: null, results_at: null, links: [],
    });
  }
  for (const n of NOTES.notes) {
    entries.push({
      id: n.id, kind: 'note', set: null, subject: n.title,
      outcome: null, basis: null, routes: n.routes, routes_derived: false,
      claim: n.title, argument: null, note: n.text, measured: null,
      tool: null, asserted_in: null, registered_at: null, results_at: null,
      links: n.links,
    });
  }

  // Links are validated, not trusted: a note that cites an id this corpus does not
  // carry is a dangling pointer, and a retriever following it lands nowhere.
  const known = new Set(entries.map(e => e.id));
  const dangling = [];
  for (const e of entries) {
    for (const l of e.links) if (!known.has(l)) dangling.push(`${e.id} -> ${l}`);
  }

  const routes = {};
  for (const e of entries) for (const r of e.routes) (routes[r] ||= []).push(e.id);

  return {
    slate: {
      schema: 'tryte-vm/slate@1',
      purpose: 'A retrieval-shaped projection of FINDINGS.json plus authored marginalia. '
        + 'Flat, addressable entries with stable ids, topic routes and validated cross-links. '
        + 'The manifest remains the authority; this is a view of it and never a second copy '
        + 'of the truth.',
      counts: {
        entries: entries.length,
        predictions: entries.filter(e => e.kind === 'prediction').length,
        findings: entries.filter(e => e.kind === 'finding').length,
        traps: entries.filter(e => e.kind === 'trap').length,
        notes: entries.filter(e => e.kind === 'note').length,
        proven: entries.filter(e => e.basis === 'proven').length,
        failed: entries.filter(e => e.outcome === 'FAILED').length,
      },
      routes: Object.fromEntries(Object.entries(routes).sort()),
      entries,
    },
    dangling,
  };
}

/**
 * The page-side projection. `docs/slate.json` is the full record and is what a
 * retriever should read; the published page carries a SMALLER one, because every byte
 * of it ships inside the HTML. Same ids, same routes, shortened prose, and fields
 * omitted rather than sent empty.
 *
 * This lives here, next to the record it projects, so `npm run counts` refreshes the
 * embedded copy along with everything else. A hand-pasted embed would be the one
 * artifact in this repository that its own generation tooling could not regenerate.
 */
const CAP = 480;
function clip(t) {
  if (!t || t.length <= CAP) return t;
  const cut = t.slice(0, CAP - 4);
  const sp = cut.lastIndexOf(' ');
  return (sp > CAP - 80 ? cut.slice(0, sp) : cut) + '...';
}

function compact(slate) {
  return slate.entries.map(e => {
    const body = [e.argument, e.note].filter(Boolean).join(' -- ');
    const o = { id: e.id, k: e.kind, c: e.claim, r: e.routes };
    if (body) o.n = clip(body);
    if (e.outcome) o.o = e.outcome;
    if (e.basis === 'proven') o.b = 'proven';
    if (e.routes_derived) o.d = 1;
    if (e.links && e.links.length) o.l = e.links;
    return o;
  });
}

/**
 * The payload as it goes into the page: one JSON string with every `<` written as a
 * unicode escape. That escape is lossless through `JSON.parse` and it is the only
 * thing standing between a claim containing a script close-tag and a silently dead
 * page -- a failure no Node-side check of this file could ever see, because the
 * damage happens in the browser's parser rather than in the data.
 */
const U_LT = String.fromCharCode(92) + 'u003c';

function embed(slate) {
  const s = JSON.stringify({ counts: slate.counts, entries: compact(slate) })
    .split('<').join(U_LT);
  if (s.indexOf('<') >= 0) throw new Error('render-slate: embed still carries a raw <');
  return s;
}

function run(write) {
  const { slate, dangling } = build();
  if (dangling.length) {
    throw new Error('render-slate: dangling links: ' + dangling.join(', '));
  }
  const json = JSON.stringify(slate, null, 1) + '\n';
  const out = path.join(ROOT, 'docs', 'slate.json');
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (write && json !== current) fs.writeFileSync(out, json);
  return { slate, json, changed: json !== current, out };
}

if (MAIN) {
  const write = process.argv.includes('--write');
  const { slate, json, changed } = run(write);
  const c = slate.counts;
  log('RENDER-SLATE — the corpus as a retrievable index.\n');
  log(`  ${c.entries} entries: ${c.predictions} predictions, ${c.findings} findings, `
    + `${c.traps} defect classes, ${c.notes} notes`);
  log(`  ${c.proven} proven, ${c.failed} failed\n`);
  log('  routes:');
  for (const [r, ids] of Object.entries(slate.routes)) {
    log(`    ${r.padEnd(20)} ${String(ids.length).padStart(3)} entries`);
  }
  log(`\n  ${(json.length / 1024).toFixed(1)} KiB, page embed ${(embed(slate).length / 1024).toFixed(1)} KiB  `
    + (write ? (changed ? 'WRITTEN' : 'already current') : (changed ? 'would change' : 'up to date')));
}

module.exports = { build, run, compact, embed, clip, CAP, SET_ROUTES, ENTRY_ROUTES, routesFor };
