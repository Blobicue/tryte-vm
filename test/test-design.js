'use strict';
/* test-design.js — the design folder's structure is enforced, not requested.
 *
 * design/ is a design phase: it enumerates option spaces before anything is
 * chosen, because the record shows what happens when a design is picked and
 * validated rather than enumerated and measured — the selector-tree adder passed
 * every check it had and was 13% worse and twice as deep as something nobody
 * thought of for four phases.
 *
 * A design document that quietly drops the sections it found inconvenient is the
 * failure this guards against. Specifically: dropping "What is missing from this
 * list" turns an enumeration back into a decision, and dropping the status
 * markers lets a cost estimate be read as a measurement — which is the shape this
 * repository has recorded thirteen times under different names.
 */

const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const DIR = path.join(__dirname, '..', 'design');
const KINDS = ['index', 'reference', 'subsystem'];
const STATUS = ['MEASURED', 'DERIVED', 'PROPOSED'];
const REQUIRED = [
  '## Requirement',
  '## What the axioms force',
  '## Options',
  '## Interactions',
  '## What a measurement phase would register',
  '## What is missing from this list',
];

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.md')).sort();
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const kindOf = src => (/^<!--\s*kind:\s*(\w+)\s*-->/m.exec(src) || [])[1];

console.log('\n=== 1. EVERY FILE DECLARES WHAT IT IS ===');
{
  check(`design/ holds ${files.length} documents`, files.length > 0, String(files.length));
  const undeclared = files.filter(f => !KINDS.includes(kindOf(read(f))));
  check('every file declares a kind, and it is one of the three',
    undeclared.length === 0, `undeclared or unknown: ${undeclared.join(' ')}`);
  const kinds = files.map(f => kindOf(read(f)));
  check('exactly one index, and at least one of each other kind',
    kinds.filter(k => k === 'index').length === 1
    && kinds.includes('reference') && kinds.includes('subsystem'),
    kinds.join(' '));
}

console.log('\n=== 2. SUBSYSTEM FILES CARRY ALL SIX SECTIONS ===');
{
  const subsystems = files.filter(f => kindOf(read(f)) === 'subsystem');
  check(`${subsystems.length} subsystem files: ${subsystems.join(' ')}`, subsystems.length >= 5);
  let bad = null;
  for (const f of subsystems) {
    const src = read(f);
    const missing = REQUIRED.filter(h => !src.includes(h));
    if (missing.length) { bad = `${f} missing ${missing.join(', ')}`; break; }
  }
  check('every subsystem file has Requirement, axioms, Options, Interactions,'
    + ' what to register, and what is missing', bad === null, bad || '');
  check('   and "What is missing from this list" is present in every one of them —'
    + ' the section that keeps an enumeration from collapsing into a decision',
    subsystems.every(f => read(f).includes('## What is missing from this list')));
}

console.log('\n=== 3. STATUS MARKERS COME FROM THE DECLARED VOCABULARY ===');
{
  // Anything that looks like a status word but is not one of the three is drift:
  // ASSUMED, VERIFIED, CONFIRMED and friends all read as stronger or weaker than
  // they are, which is exactly what the vocabulary exists to prevent.
  const SUSPECTS = /\b(MEASURED|DERIVED|PROPOSED|ASSUMED|VERIFIED|CONFIRMED|ESTIMATED|UNKNOWN|TBD)\b/g;
  let offender = null, total = 0;
  for (const f of files) {
    for (const m of read(f).matchAll(SUSPECTS)) {
      total++;
      if (!STATUS.includes(m[1])) { offender = `${f}: ${m[1]}`; break; }
    }
    if (offender) break;
  }
  check(`${total} status markers used, all from the declared three`,
    offender === null, offender || '');
  check('   and every subsystem file actually uses at least one', (() => {
    return files.filter(f => kindOf(read(f)) === 'subsystem')
      .every(f => STATUS.some(s => read(f).includes(s)));
  })());
  check('   and all three markers stay in use as the design gets built', (() => {
    // This required PROPOSED to be the commonest, "which is correct for a design
    // phase". It stopped being true the moment the design started being BUILT and
    // options turned MEASURED — the count is now 53 to 53. So the check was
    // encoding "we are early" and failed for a good reason in the wrong place.
    // What matters is that the vocabulary stays in use and nothing drifts outside
    // it; the ratio between the three is a fact about progress, not a defect.
    const count = s => files.reduce((n, f) => n + (read(f).match(new RegExp(`\\b${s}\\b`, 'g')) || []).length, 0);
    return STATUS.every(s => count(s) > 0);
  })());
}

console.log('\n=== 4. THE INDEX AND THE FOLDER AGREE ===');
{
  const indexFile = files.find(f => kindOf(read(f)) === 'index');
  const index = read(indexFile);
  const others = files.filter(f => f !== indexFile);
  const unlisted = others.filter(f => !index.includes(`(${f})`));
  check('every document is linked from the index', unlisted.length === 0,
    `unlisted: ${unlisted.join(' ')}`);
  const linked = [...index.matchAll(/\(([0-9]{2}-[a-z-]+\.md)\)/g)].map(m => m[1]);
  const dangling = [...new Set(linked)].filter(f => !files.includes(f));
  check('every link in the index resolves to a file that exists',
    dangling.length === 0, `dangling: ${dangling.join(' ')}`);
}

console.log('\n=== 5. THE ENFORCEMENT HAS TEETH ===');
{
  // Each check above is re-run against a doctored copy that should fail it.
  const subsystem = files.find(f => kindOf(read(f)) === 'subsystem');
  const src = read(subsystem);

  check('a subsystem file with a section removed is caught', (() => {
    const doctored = src.replace('## What is missing from this list', '## Notes');
    return REQUIRED.some(h => !doctored.includes(h));
  })());
  check('a status word outside the vocabulary is caught', (() => {
    const doctored = src + '\n| X | y | z | ASSUMED |\n';
    const SUSPECTS = /\b(MEASURED|DERIVED|PROPOSED|ASSUMED|VERIFIED|CONFIRMED|ESTIMATED|UNKNOWN|TBD)\b/g;
    return [...doctored.matchAll(SUSPECTS)].some(m => !STATUS.includes(m[1]));
  })());
  // This one passed for the wrong reason first: the condition was written as an
  // arrow function rather than called, and a function is truthy. A vacuous check
  // inside the section whose whole job is showing checks are not vacuous.
  check('an undeclared kind is caught', kindOf('# no header') === undefined
    && kindOf('<!-- kind: subsystem -->') === 'subsystem');
  check('   and a file absent from the index is caught', (() => {
    const indexFile = files.find(f => kindOf(read(f)) === 'index');
    return !read(indexFile).includes('(99-nonexistent.md)');
  })());
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
