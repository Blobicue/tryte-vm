'use strict';
/* test-fence.js — the line between what this repository verifies and what it does not.
 *
 * The README promises that every claim was registered before it was measured and every
 * number is recomputed by a check. Two lines of work were merged in without passing
 * through that protocol: the quantum, cryptography and toolchain line, and the phinary
 * subsystem. FENCE.md lists every path they added, so that neither promise is read as
 * covering them. This suite keeps that list honest in BOTH directions:
 *
 *   - every file those lines added, DERIVED FROM GIT rather than typed, must be fenced --
 *     so a fence written from memory cannot quietly miss one;
 *   - every fenced path must exist -- so the fence cannot point at nothing;
 *   - the README must point at the fence, and the instruction counts it states must be
 *     the counts the code has. Those counts went stale once already: the quantum line
 *     added an opcode and shrank the interpreter, and the README kept saying 25 opcodes
 *     and 358 cells for weeks with nothing to object.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { OPS } = require('../src/isa.js');
const { assemble } = require('../src/assembler.js');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0; const fails = [];
let quiet = false;                     // set only while the harness checks itself
const check = (name, cond, detail = '') => {
  if (cond) { pass++; if (!quiet) console.log(`  [PASS] ${name}`); }
  else { fails.push(name); if (!quiet) console.log(`  [FAIL] ${name}  ${detail}`); }
};

/* The lines and the commit ranges they arrived in. FROM is the commit the line was built
 * on; TO is its last commit before it met this repository. The files each range ADDED
 * are what must be fenced. */
const LINES = [
  { name: 'quantum, cryptography and toolchain', from: 'a7b452f', to: '80a07c8' },
  { name: 'phinary', from: '35a0c81', to: '1506225' },
];

/** Paths listed under every "Fenced paths:" heading in FENCE.md. */
function fencedPaths(md) {
  const out = [];
  const blocks = md.split(/^Fenced paths:\s*$/m).slice(1);
  for (const b of blocks) {
    for (const line of b.split('\n')) {
      const m = /^- `([^`]+)`\s*$/.exec(line.trim());
      if (m) out.push(m[1]);
      else if (line.trim() && !line.trim().startsWith('-')) break;    // the list ended
    }
  }
  return out;
}

/** A file is covered if a fenced entry names it exactly, or is a directory containing it. */
const covers = (fence, file) =>
  fence.some(f => (f.endsWith('/') ? file.startsWith(f) : file === f));

/** Files a commit range added, or null if git cannot answer. */
function addedBy(from, to) {
  try {
    return execFileSync('git', ['diff', '--name-only', '--diff-filter=A', from, to],
      { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) { return null; }
}

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  check('the harness reports a false check as FAIL', (() => {
    const before = [fails.length, pass];
    quiet = true; check('deliberately false', false); quiet = false;
    const caught = fails.length === before[0] + 1 && pass === before[1];
    fails.pop(); return caught;
  })());
  // The coverage rule must catch an unfenced file and must not over-match: a directory
  // entry covers what is inside it, and nothing that merely shares its prefix.
  check('an unlisted file is not covered',
    !covers(['quantum/', 'src/kernel.js'], 'src/scheduler.js'));
  check('   a directory entry covers what it contains',
    covers(['quantum/'], 'quantum/src/unified-compiler.js'));
  check('   and does not cover a sibling that merely shares its name as a prefix',
    !covers(['quantum/'], 'quantum-notes.md') && !covers(['src/kernel.js'], 'src/kernel.jsx'));
  // The parser must read every list, and stop at the end of each.
  const sample = 'x\n\nFenced paths:\n\n- `a/`\n- `b.js`\n\nprose after\n\nFenced paths:\n\n- `c.js`\n';
  check('the fence parser reads every list and stops at the end of each',
    JSON.stringify(fencedPaths(sample)) === JSON.stringify(['a/', 'b.js', 'c.js']));
}

const md = read('FENCE.md');
const fence = fencedPaths(md);

console.log('\n=== 1. EVERYTHING THE OUTSIDE LINES ADDED IS FENCED ===');
{
  check('FENCE.md lists fenced paths at all', fence.length > 0, String(fence.length));
  for (const L of LINES) {
    check(`FENCE.md names both ends of the ${L.name} line`,
      md.includes(L.from) && md.includes(L.to));
    const added = addedBy(L.from, L.to);
    // Fail closed: a history that cannot be read is not a fence that holds.
    check(`   git can say what the ${L.name} line added`, added !== null && added.length > 0);
    const missed = (added || []).filter(f => !covers(fence, f));
    check(`   every file the ${L.name} line added is fenced`,
      added !== null && missed.length === 0, `unfenced: ${missed.slice(0, 8).join(' ')}`);
  }
}

console.log('\n=== 2. THE FENCE POINTS AT THINGS THAT EXIST ===');
{
  const dangling = fence.filter(f => !fs.existsSync(path.join(ROOT, f)));
  check('every fenced path exists in the tree', dangling.length === 0, dangling.join(' '));
  const dupes = fence.filter((f, i) => fence.indexOf(f) !== i);
  check('   and none is listed twice', dupes.length === 0, dupes.join(' '));
  // Nothing inside the regime may be fenced. The core files the outside lines EDITED
  // stay inside: their changes are checked by the suite and named in FENCE.md's prose.
  const CORE = ['src/ternary.js', 'src/isa.js', 'src/vm.js', 'src/assembler.js',
    'src/selfhost.js', 'src/device.js', 'FINDINGS.json', 'test/run-all.js'];
  check('   and no core file is fenced', CORE.every(c => !covers(fence, c)));
}

console.log('\n=== 3. THE README POINTS HERE, AND ITS COUNTS ARE THE CODE\'S ===');
{
  const readme = read('README.md');
  check('the README links FENCE.md', readme.includes('(FENCE.md)'));

  // The core instruction set is the ISA without its extension. Derived, not typed.
  const core = Object.keys(OPS).filter(n => n !== 'QEXEC').length;
  const all = Object.keys(OPS).length;
  check(`the README calls it a ${core}-instruction core machine`,
    readme.includes(`a ${core}-instruction core machine`));
  check(`   and its machine table says ${core} core instructions`,
    readme.includes(`| Instructions | ${core} core (`));

  // The self-hosting section's claims about the full interpreter.
  const cells = assemble(read('programs/interp.tasm')).cells.size;
  check(`the self-hosting claim covers all ${all} opcodes the ISA has`,
    readme.includes(`asserted for all ${all} opcodes`));
  check(`   and the interpreter table says ${all} opcodes`,
    readme.includes(`| Opcodes | ${all} |`));
  check(`   and ${cells} cells, which is what interp.tasm assembles to`,
    readme.includes(`| Size | ${cells} cells |`));
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
