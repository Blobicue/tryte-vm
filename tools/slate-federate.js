'use strict';
/* SLATE-FEDERATE — sibling corpora, read only, projected into the slate schema.
 *
 * `docs/slate.json` makes THIS repository retrievable. Two siblings on the same machine
 * keep evidence in the same spirit and none of the same shape: `ladderlang` records
 * proved / measured / refuted / open claims against Lean theorems, a 64-row combinator
 * ledger, and a 10,000-line append-only worklog; `bitblock` records content-addressed
 * schemas and the independent vector suites that witness them. This reads those, emits
 * `docs/slate-federated.json` in the same flat entry schema, and `tools/slate-query.js`
 * then answers questions across all three without knowing anything about them.
 *
 *     node tools/slate-federate.js              # report, writes nothing
 *     node tools/slate-federate.js --write      # write docs/slate-federated.json
 *     node tools/slate-query.js --corpus docs/slate-federated.json "was it refuted"
 *
 * ---------------------------------------------------------------------------
 * READ ONLY, AND THE CODE SAYS SO RATHER THAN THE COMMENT
 *
 * Nothing here opens a sibling for writing. The single write path asserts that its
 * destination resolves inside THIS repository before it touches the disk, so a mistyped
 * path fails loudly instead of landing in somebody else's tree.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NOT COERCED
 *
 * A federated entry carries `repo`, `source` and, where the sibling has one, its own
 * `source_status` VERBATIM. It is tempting to map ladderlang's `refuted` onto this
 * repository's `FAILED`, and it would be wrong: `FAILED` here means a prediction that
 * was registered before the run and then contradicted, which is a claim about ORDER,
 * and ladderlang's status is a claim about TRUTH. They coincide often and are not the
 * same field. So `outcome` stays null for every ladderlang entry and the status travels
 * under its own name.
 *
 * One correspondence IS exact and is taken: `status: "proved"` names a Lean theorem, so
 * those entries carry `basis: "proven"` -- the same word this repository already uses
 * for a result established by argument rather than by measurement.
 *
 * bitblock needs a vocabulary this repository does not have, so it gets a new one
 * rather than a borrowed one:
 *
 *     WITNESSED     at least one vector tool independently reimplements the schema
 *     UNWITNESSED   the schema is declared in Rust and nothing outside Rust checks it
 *
 * These are `outcome` values in the federated schema only. They are computed from
 * `index/nodes.jsonl` and then CHECKED against bitblock's own `index/coverage.json`,
 * which publishes its uncovered list independently; a disagreement is reported and
 * makes the run fail rather than being silently absorbed.
 *
 * ---------------------------------------------------------------------------
 * ROUTES ARE ALL DERIVED HERE, AND ALL SAY SO
 *
 * The route table in `render-slate.js` is editorial and is about THIS repository's
 * prediction sets. Nothing in it knows what a combinator ledger is about. So every
 * federated entry is routed by that file's keyword fallback -- reused rather than
 * re-implemented, so there is one definition of what a keyword implies -- and every
 * one of them carries `routes_derived: true`. `slate-query.js` damps derived routes,
 * which is the correct behaviour and not a defect: on this corpus a route is a guess
 * from first to last.
 *
 * And the guessing is measurably BAD here, which is worth stating rather than leaving
 * for a reader to discover. Run the tool and look: `cost-model` swallows most of the
 * federation, because its keyword pattern includes `tick|cost|depth|work` and a
 * combinator ledger measures ticks and depth while a worklog is full of the word work.
 * A third of the corpus lands in `unrouted`. The route component is therefore close to
 * worthless on federated entries and the damping is what stops it doing harm; term
 * overlap is carrying these queries essentially alone.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS SKIPPED, AND WHY THAT IS REPORTED RATHER THAN PATCHED
 *
 * If a source file is missing or does not parse, it is recorded in `skipped` with a
 * reason and contributes no entries. Covering less is a smaller error than inventing
 * entries, and a corpus that quietly shrank would be indistinguishable from one that
 * was never there. `--write` refuses if EVERY sibling was skipped, because an empty
 * federation is a failed run wearing a success's clothes.
 *
 * WHAT THIS DOES NOT READ, so the coverage is not overstated: ladderlang's Lean sources
 * themselves (only the generated `claims.json` summary of them), its `bank.jsonl` /
 * `mint.jsonl` / `corpus.jsonl` run logs, and bitblock's Rust sources, metric registry
 * (1,112 entries, which would swamp everything else) and Lean proofs. The federation is
 * of each sibling's OWN index, never of its raw tree.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };

const { routesFor } = require('./render-slate.js');

/** Where the siblings are. Read-only, and nothing below ever opens them for writing. */
const SIBLINGS = {
  ladderlang: path.join(ROOT, '..', 'ladderlang'),
  bitblock: path.join(ROOT, '..', 'bitblock'),
};

/** Longest prose kept on any one entry. Long enough to be a claim, short enough to index. */
const PROSE_CAP = 700;

function squash(s, cap = PROSE_CAP) {
  const one = String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim();
  return one.length <= cap ? one : one.slice(0, cap - 3).replace(/\s+\S*$/, '') + '...';
}

/** One entry, in exactly the field set `docs/slate.json` uses, plus the federation's own. */
function entry(o) {
  const text = `${o.id} ${o.claim || ''} ${o.note || ''} ${o.argument || ''}`;
  const r = routesFor(o.id, null, text);
  return {
    id: o.id,
    kind: o.kind,
    set: null,
    subject: o.subject || null,
    outcome: o.outcome || null,
    basis: o.basis || null,
    routes: r.routes,
    // Every route here is a keyword guess. `routesFor` would only return derived:false
    // for an id in this repository's editorial table, and no federated id can be one.
    routes_derived: true,
    claim: o.claim,
    argument: o.argument || null,
    note: o.note || null,
    measured: o.measured || null,
    tool: null,
    asserted_in: null,
    registered_at: null,
    results_at: null,
    links: [],
    repo: o.repo,
    source: o.source,
    source_status: o.source_status || null,
  };
}

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

/* --- ladderlang ------------------------------------------------------------------- */

/**
 * `claims.json` carries a `claims` array of {id, status, thm, says, evidence}. The
 * `says` field is a one-line English statement of the claim, which is precisely what a
 * retriever wants, so it travels as the claim and nothing is paraphrased.
 */
function ladderClaims(root, out, skipped) {
  let raw;
  try { raw = readJson(root, 'claims.json'); } catch (e) {
    skipped.push({ repo: 'ladderlang', source: 'claims.json', why: e.message }); return 0;
  }
  if (!raw || !Array.isArray(raw.claims)) {
    skipped.push({ repo: 'ladderlang', source: 'claims.json', why: 'no claims array' }); return 0;
  }
  let n = 0;
  for (const c of raw.claims) {
    if (!c || !c.id || typeof c.says !== 'string') continue;
    out.push(entry({
      id: `LL-claim:${c.id}`,
      kind: 'claim',
      repo: 'ladderlang',
      source: 'claims.json',
      source_status: c.status || null,
      // Exact correspondence only: a status of "proved" names a Lean theorem.
      basis: c.status === 'proved' ? 'proven' : 'measured',
      subject: c.id,
      claim: squash(c.says),
      argument: c.thm ? `Lean theorem ${c.thm}` : null,
      note: c.evidence ? `evidence: ${squash(c.evidence, 200)}` : null,
      measured: { theorem: c.thm ? 1 : 0 },
    }));
    n++;
  }
  return n;
}

/**
 * `ledger.json` is 64 published combinator entries with measured sizes. The claim text
 * is ASSEMBLED from the row's own fields rather than written: every word of it is a
 * field name or a field value, so there is nothing in it to be wrong about.
 */
function ladderLedger(root, out, skipped) {
  let raw;
  try { raw = readJson(root, 'ledger.json'); } catch (e) {
    skipped.push({ repo: 'ladderlang', source: 'ledger.json', why: e.message }); return 0;
  }
  if (!raw || !Array.isArray(raw.entries)) {
    skipped.push({ repo: 'ladderlang', source: 'ledger.json', why: 'no entries array' }); return 0;
  }
  let n = 0;
  for (const e of raw.entries) {
    if (!e || !e.name) continue;
    const flags = [
      e.admissible ? 'admissible' : 'not admissible',
      e.published ? 'published' : 'unpublished',
      e.banked ? 'banked' : 'not banked',
    ].join(', ');
    out.push(entry({
      id: `LL-ledger:${e.name}`,
      kind: 'ledger-row',
      repo: 'ladderlang',
      source: 'ledger.json',
      source_status: e.admissible ? 'admissible' : 'inadmissible',
      basis: 'measured',
      subject: `combinator ${e.name}`,
      claim: squash(`combinator ${e.name} = ${e.lam || '?'} sits at layer ${e.layer}, `
        + `depth ${e.depth}, at most ${e.atoms_upper} atoms and ${e.iota_upper} iota, `
        + `${e.ticks} ticks; ${flags}`),
      note: e.ski ? squash(`SKI: ${e.ski}`, 300) : null,
      measured: {
        depth: e.depth, layer: e.layer, atoms_upper: e.atoms_upper,
        iota_upper: e.iota_upper, ticks: e.ticks, cites: (e.cites || []).length,
      },
    }));
    n++;
  }
  return n;
}

/**
 * `WORKLOG.md` is prose, and prose does not parse reliably -- but its STRUCTURE does.
 * Every block opens with a level-two heading, and the heading plus the first paragraph
 * under it is quoted verbatim rather than summarised. Headings inside fenced code are
 * ignored, because a ``` block can contain anything including a line starting with `##`.
 */
function ladderWorklog(root, out, skipped) {
  let text;
  try { text = fs.readFileSync(path.join(root, 'WORKLOG.md'), 'utf8'); } catch (e) {
    skipped.push({ repo: 'ladderlang', source: 'WORKLOG.md', why: e.message }); return 0;
  }
  const lines = text.split(/\r?\n/);
  const heads = [];
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { fenced = !fenced; continue; }
    if (fenced) continue;
    if (/^## +\S/.test(lines[i])) heads.push({ line: i + 1, title: lines[i].replace(/^##\s+/, '').trim() });
  }
  if (!heads.length) {
    skipped.push({ repo: 'ladderlang', source: 'WORKLOG.md', why: 'no level-two headings found' });
    return 0;
  }
  let n = 0;
  const used = new Set();
  for (let h = 0; h < heads.length; h++) {
    const from = heads[h].line;
    const to = h + 1 < heads.length ? heads[h + 1].line - 1 : lines.length;
    // First non-empty, non-fence, non-heading paragraph under the heading.
    const body = [];
    let inFence = false;
    for (let i = from; i < to; i++) {
      const l = lines[i];
      if (/^\s*```/.test(l)) { inFence = !inFence; if (body.length) break; continue; }
      if (inFence) continue;
      if (/^#{1,6} /.test(l)) { if (body.length) break; continue; }
      if (!l.trim()) { if (body.length) break; continue; }
      body.push(l.trim());
    }
    // Ids must be stable and unique; the line number makes them so even where two
    // blocks share a title, which this log does ("## Item 78 — ..." appears twice).
    const slug = heads[h].title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '').slice(0, 48) || 'block';
    let id = `LL-worklog:${heads[h].line}-${slug}`;
    while (used.has(id)) id += 'x';
    used.add(id);
    out.push(entry({
      id,
      kind: 'worklog',
      repo: 'ladderlang',
      source: `WORKLOG.md:${heads[h].line}`,
      basis: 'measured',
      subject: squash(heads[h].title, 160),
      claim: squash(heads[h].title, 300),
      note: body.length ? squash(body.join(' ')) : null,
      measured: { line: heads[h].line },
    }));
    n++;
  }
  return n;
}

/* --- bitblock --------------------------------------------------------------------- */

/**
 * `index/nodes.jsonl` carries one node per schema, with the module that DECLARES it and
 * the vector tool that WITNESSES it. The witness relation is the whole point of that
 * repository's protocol discipline, so it becomes the entry's outcome -- and is then
 * checked against `index/coverage.json`, which publishes the uncovered list by its own
 * route. Two readings of the same fact that agree is evidence; one reading is a claim.
 */
function bitblockSchemas(root, out, skipped) {
  let nodes, coverage, local = null;
  try {
    nodes = fs.readFileSync(path.join(root, 'index', 'nodes.jsonl'), 'utf8')
      .split(/\r?\n/).filter(Boolean).map((l, i) => {
        try { return JSON.parse(l); } catch (e) { throw new Error(`nodes.jsonl line ${i + 1}: ${e.message}`); }
      });
    coverage = readJson(root, path.join('index', 'coverage.json'));
  } catch (e) {
    skipped.push({ repo: 'bitblock', source: 'index/nodes.jsonl', why: e.message }); return { n: 0 };
  }
  try { local = readJson(root, path.join('tools', 'schema_local.json')); } catch (e) { local = null; }
  const why = new Map();
  if (local && Array.isArray(local.local)) for (const l of local.local) why.set(l.schema, l);

  const schemas = nodes.filter((x) => x && x.kind === 'schema' && x.name);
  if (!schemas.length) {
    skipped.push({ repo: 'bitblock', source: 'index/nodes.jsonl', why: 'no schema nodes' });
    return { n: 0 };
  }

  // The cross-check. bitblock's own coverage counts only non-fixture schemas.
  const unwitnessed = schemas.filter((s) => !s.fixture && !(s.vectored_by || []).length)
    .map((s) => s.name).sort();
  const declared = (coverage.schemas_uncovered || []).slice().sort();
  const agree = JSON.stringify(unwitnessed) === JSON.stringify(declared);

  let n = 0;
  for (const s of schemas) {
    const vec = s.vectored_by || [];
    const by = (s.declared_by || []).map((m) => m.replace(/^module:/, ''));
    const at = (s.declared_at || []).join(', ');
    const l = why.get(s.name);
    out.push(entry({
      id: `BB-schema:${s.name}`,
      kind: 'schema',
      repo: 'bitblock',
      source: at ? `index/nodes.jsonl (${at})` : 'index/nodes.jsonl',
      source_status: s.fixture ? 'fixture' : 'protocol',
      outcome: vec.length ? 'WITNESSED' : 'UNWITNESSED',
      basis: 'measured',
      subject: s.namespace || s.name,
      claim: squash(`schema ${s.name} is declared by ${by.join(' and ') || 'nothing in src'}`
        + (at ? ` at ${at}` : '')
        + (vec.length
          ? ` and is witnessed by ${vec.map((v) => v.replace(/^tool:/, '')).join(', ')}`
          : ' and NO independent vector suite witnesses it')
        + (s.fixture ? '; it is a test fixture rather than a protocol object' : '')),
      argument: l ? squash(l.why) : null,
      note: s.summary ? squash(s.summary, 300) : null,
      measured: { declared_by: by.length, witnesses: vec.length, fixture: s.fixture ? 1 : 0 },
    }));
    n++;
  }
  return {
    n,
    crosscheck: {
      unwitnessed_from_nodes: unwitnessed.length,
      uncovered_from_coverage: declared.length,
      agree,
      only_in_nodes: unwitnessed.filter((x) => !declared.includes(x)),
      only_in_coverage: declared.filter((x) => !unwitnessed.includes(x)),
    },
  };
}

/* --- build ------------------------------------------------------------------------ */

function build() {
  const entries = [];
  const skipped = [];
  const per = {};

  const llRoot = SIBLINGS.ladderlang;
  if (fs.existsSync(llRoot)) {
    per.ladderlang = {
      root: llRoot,
      claims: ladderClaims(llRoot, entries, skipped),
      ledger: ladderLedger(llRoot, entries, skipped),
      worklog: ladderWorklog(llRoot, entries, skipped),
    };
  } else {
    skipped.push({ repo: 'ladderlang', source: llRoot, why: 'directory not present' });
  }

  const bbRoot = SIBLINGS.bitblock;
  let crosscheck = null;
  if (fs.existsSync(bbRoot)) {
    const r = bitblockSchemas(bbRoot, entries, skipped);
    crosscheck = r.crosscheck || null;
    per.bitblock = { root: bbRoot, schemas: r.n };
  } else {
    skipped.push({ repo: 'bitblock', source: bbRoot, why: 'directory not present' });
  }

  // Ids must be unique across the federation or `links` and `--corpus` both break.
  const seen = new Set();
  const dupes = [];
  for (const e of entries) { if (seen.has(e.id)) dupes.push(e.id); seen.add(e.id); }

  // Stable order, so two runs on an unchanged tree produce byte-identical output.
  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const routes = {};
  for (const e of entries) for (const r of e.routes) (routes[r] ||= []).push(e.id);

  const byRepo = {};
  for (const e of entries) byRepo[e.repo] = (byRepo[e.repo] || 0) + 1;
  const byKind = {};
  for (const e of entries) byKind[e.kind] = (byKind[e.kind] || 0) + 1;

  return {
    federated: {
      schema: 'tryte-vm/slate-federated@1',
      purpose: 'Sibling corpora read only and projected into the slate entry schema, so '
        + 'one retriever spans three repositories. Each entry names the repo and the file '
        + 'it came from. Statuses travel verbatim; nothing is mapped onto this '
        + 'repository\'s HELD/FAILED vocabulary, which is a claim about registration '
        + 'order rather than about truth.',
      outcome_vocabulary: {
        WITNESSED: 'bitblock: at least one vector tool independently reimplements the schema',
        UNWITNESSED: 'bitblock: the schema is declared in Rust and nothing outside Rust checks it',
        null: 'ladderlang: no outcome, because its statuses are not this repository\'s outcomes',
      },
      counts: {
        entries: entries.length,
        by_repo: byRepo,
        by_kind: byKind,
        routes_derived: entries.filter((e) => e.routes_derived).length,
      },
      repos: per,
      skipped,
      crosscheck,
      routes: Object.fromEntries(Object.entries(routes).sort()),
      entries,
    },
    dupes,
  };
}

function run(write) {
  const { federated, dupes } = build();
  if (dupes.length) throw new Error('slate-federate: duplicate ids: ' + dupes.slice(0, 5).join(', '));
  if (federated.crosscheck && !federated.crosscheck.agree) {
    throw new Error('slate-federate: bitblock nodes.jsonl and coverage.json disagree on which '
      + 'schemas are unwitnessed: ' + JSON.stringify(federated.crosscheck));
  }
  const json = JSON.stringify(federated, null, 1) + '\n';
  const out = path.join(ROOT, 'docs', 'slate-federated.json');
  // The one write in this file, guarded: never outside this repository.
  if (write) {
    if (!path.resolve(out).startsWith(path.resolve(ROOT) + path.sep)) {
      throw new Error('slate-federate: refusing to write outside the repository');
    }
    if (!federated.entries.length) {
      throw new Error('slate-federate: every sibling was skipped; refusing to write an empty federation');
    }
    const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
    if (json !== cur) fs.writeFileSync(out, json);
    return { federated, json, out, changed: json !== cur };
  }
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  return { federated, json, out, changed: json !== cur };
}

if (MAIN) {
  const write = process.argv.includes('--write');
  let r;
  try { r = run(write); } catch (e) { console.error(e.message); process.exit(1); }
  const f = r.federated;
  log('SLATE-FEDERATE — sibling corpora, read only.\n');
  log(`  ${f.counts.entries} entries, all routes derived (${f.counts.routes_derived})`);
  for (const [repo, n] of Object.entries(f.counts.by_repo)) log(`    ${repo.padEnd(14)} ${String(n).padStart(4)}`);
  log('');
  for (const [kind, n] of Object.entries(f.counts.by_kind)) log(`    ${kind.padEnd(14)} ${String(n).padStart(4)}`);
  if (f.crosscheck) {
    log(`\n  bitblock cross-check: ${f.crosscheck.unwitnessed_from_nodes} unwitnessed from `
      + `nodes.jsonl, ${f.crosscheck.uncovered_from_coverage} uncovered from coverage.json — `
      + (f.crosscheck.agree ? 'AGREE' : 'DISAGREE'));
  }
  if (f.skipped.length) {
    log('\n  SKIPPED, and covering less beats inventing:');
    for (const s of f.skipped) log(`    ${s.repo}/${s.source}: ${s.why}`);
  } else {
    log('\n  nothing skipped.');
  }
  log(`\n  ${(r.json.length / 1024).toFixed(1)} KiB  `
    + (write ? (r.changed ? 'WRITTEN' : 'already current') : (r.changed ? 'would change' : 'up to date')));
  log(`  ${r.out}\n`);
  process.exit(0);
}

module.exports = { build, run, entry, squash, SIBLINGS, PROSE_CAP, ladderClaims, ladderLedger, ladderWorklog, bitblockSchemas };
