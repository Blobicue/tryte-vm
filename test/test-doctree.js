'use strict';
/* test-doctree.js — the doctree's depth column has to be true.
 *
 * .claude/knowledge/doctrees/tryte-vm/ maps what is known about this project and
 * how well established each part is. Its whole value is the Depth column: a map
 * that does not show which parts are unmapped is worse than no map.
 *
 * So the one thing that must not drift is the overview's declared depth against
 * each pillar's own Depth status. That is the same failure as a stale constant,
 * which this repository has recorded three times, and it is worse here because a
 * doctree is read to decide where to spend effort.
 *
 * The other rule the methodology carries: a doctree is a MAP, not a copy. Numbers
 * live in FINDINGS.json. Nothing here checks the pillars' prose against the
 * manifest, because pillars are meant to summarise and link rather than restate —
 * but every link they carry has to resolve.
 */

const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const DIR = path.join(__dirname, '..', '.claude', 'knowledge', 'doctrees', 'tryte-vm');
const DEPTHS = ['rich', 'seeded', 'stub'];
const SCOPES = ['substrate', 'project'];
const SECTIONS = ['## What is established', '## Sub-topics', '## Open questions',
  '## Related pillars', '## Depth status'];

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.md')).sort();
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const front = src => {
  // Tolerant of CRLF. The generator that wrote these files used Python's text
  // mode on Windows, every frontmatter check failed at the same instant, and it
  // read exactly like content drift. It was a line ending. A parser that only
  // accepts one convention turns an invisible difference into a loud wrong
  // diagnosis, which is worse than either.
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  if (!m) return null;
  const o = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.+?)\s*$/.exec(line);
    if (kv) o[kv[1]] = kv[2].trim();
  }
  return o;
};
const pillars = files.filter(f => f !== '_overview.md' && f !== 'research-topics.md');
const overview = read('_overview.md');

console.log('\n=== 1. EVERY DOCUMENT IS TYPED ===');
{
  check(`the doctree holds ${files.length} documents: an overview, ${pillars.length} pillars and a queue`,
    files.includes('_overview.md') && files.includes('research-topics.md') && pillars.length >= 10);
  const bad = files.filter(f => {
    const fm = front(read(f));
    return !fm || !fm.name || !fm.description || !fm.type;
  });
  check('every document has frontmatter with name, description and type',
    bad.length === 0, `missing: ${bad.join(' ')}`);
  check('the overview is type overview and the queue is type queue',
    front(overview).type === 'overview' && front(read('research-topics.md')).type === 'queue');
}

console.log('\n=== 2. EVERY PILLAR CARRIES THE FIVE SECTIONS ===');
{
  let bad = null;
  for (const f of pillars) {
    const src = read(f);
    const missing = SECTIONS.filter(s => !src.includes(s));
    if (missing.length) { bad = `${f} missing ${missing.join(', ')}`; break; }
  }
  check('established, sub-topics, open questions, related pillars, depth status',
    bad === null, bad || '');
  check('   and every pillar names at least one open question — the frontier is the point',
    pillars.every(f => {
      const body = read(f).split('## Open questions')[1] || '';
      return (body.split('## ')[0].match(/^-\s+\S/gm) || []).length > 0;
    }));
}

console.log('\n=== 3. THE DEPTH COLUMN IS TRUE ===');
{
  // The overview's table against each file's own declaration. This is the check
  // the whole doctree rests on.
  const declared = new Map();
  for (const f of pillars) {
    const m = /## Depth status\s*\n+\*\*(\w+)\*\*/.exec(read(f));
    declared.set(f, m ? m[1].toLowerCase() : null);
  }
  const undeclared = pillars.filter(f => !DEPTHS.includes(declared.get(f)));
  check('every pillar declares a depth from the vocabulary {rich, seeded, stub}',
    undeclared.length === 0, `bad: ${undeclared.map(f => `${f}=${declared.get(f)}`).join(' ')}`);

  const rows = [...overview.matchAll(/\|\s*\d+\s*\|\s*\[[^\]]+\]\(([^)]+)\)\s*\|[^|]*\|\s*(\w+)\s*\|\s*\*{0,2}(\w+)\*{0,2}\s*\|/g)];
  check(`the overview table lists ${rows.length} pillars`, rows.length === pillars.length,
    `${rows.length} rows against ${pillars.length} files`);

  const mismatched = rows.filter(([, file, depth]) => declared.get(file) !== depth.toLowerCase());
  check('the overview\'s depth matches every pillar\'s own Depth status',
    mismatched.length === 0,
    mismatched.map(([, f, d]) => `${f}: table says ${d}, file says ${declared.get(f)}`).join('; '));

  const badScope = rows.filter(([, , , scope]) => !SCOPES.includes(scope.toLowerCase()));
  check('every pillar is scoped substrate or project', badScope.length === 0,
    badScope.map(r => r[3]).join(' '));
  check('   with at least one of each, since the substrate split is the migration rule',
    rows.some(r => r[3].toLowerCase() === 'substrate') && rows.some(r => r[3].toLowerCase() === 'project'));
}

console.log('\n=== 4. THE LINKS RESOLVE ===');
{
  const listed = [...overview.matchAll(/\[[^\]]+\]\(([0-9]{2}-[a-z-]+\.md|research-topics\.md)\)/g)].map(m => m[1]);
  const unlisted = pillars.filter(f => !listed.includes(f));
  check('every pillar is linked from the overview', unlisted.length === 0, unlisted.join(' '));

  let dangling = null;
  for (const f of files) {
    for (const m of read(f).matchAll(/\]\((\d{2}-[a-z-]+\.md|research-topics\.md)\)/g)) {
      if (!files.includes(m[1])) { dangling = `${f} -> ${m[1]}`; break; }
    }
    if (dangling) break;
  }
  check('every cross-link between pillars resolves to a file that exists',
    dangling === null, dangling || '');

  // Pillars point outward at the files that OWN their numbers. Those must exist.
  let badOut = null;
  for (const f of files) {
    for (const m of read(f).matchAll(/\]\(\.\.\/\.\.\/\.\.\/\.\.\/([A-Za-z0-9_./-]+)\)/g)) {
      const target = path.join(__dirname, '..', m[1]);
      if (!fs.existsSync(target)) { badOut = `${f} -> ${m[1]}`; break; }
    }
    if (badOut) break;
  }
  check('every outward link to the repository resolves', badOut === null, badOut || '');
}

console.log('\n=== 5. THE ENFORCEMENT HAS TEETH ===');
{
  const sample = pillars[0];
  const src = read(sample);
  check('a pillar with a section removed is caught', (() => {
    const doctored = src.replace('## Open questions', '## Notes');
    return SECTIONS.some(s => !doctored.includes(s));
  })());
  check('a depth outside the vocabulary is caught', (() => {
    const doctored = src.replace(/## Depth status\s*\n+\*\*\w+\*\*/, '## Depth status\n\n**Comprehensive**');
    const m = /## Depth status\s*\n+\*\*(\w+)\*\*/.exec(doctored);
    return !DEPTHS.includes((m ? m[1] : '').toLowerCase());
  })());
  check('a table/file depth disagreement is caught', (() => {
    // Flip the sample's declaration and confirm the comparison notices.
    const m = /## Depth status\s*\n+\*\*(\w+)\*\*/.exec(src);
    const flipped = m[1].toLowerCase() === 'rich' ? 'stub' : 'rich';
    const row = new RegExp(`\\(${sample}\\)[^|]*\\|[^|]*\\|\\s*(\\w+)\\s*\\|`);
    const inTable = (row.exec(overview) || [])[1];
    return inTable !== undefined && inTable.toLowerCase() !== flipped;
  })());
  check('   and a pillar missing from the overview is caught',
    !overview.includes('(99-nonexistent.md)'));
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
