'use strict';
/* test-fence.js — the line between what this repository verifies and what it does not.
 *
 * The README promises that every claim was registered before it was measured and every
 * number is recomputed by a check. Two lines of work were merged in without passing
 * through that protocol. FENCE.md records what happened to each, and this suite holds it
 * to git history, deriving every file list from git rather than trusting a typed one:
 *
 *   - the quantum line MOVED OUT: every file it added must be ABSENT from this tree. A
 *     re-add -- a merge from its repository, an agent restoring a "missing" file -- turns
 *     this red rather than slipping back inside the regime unannounced;
 *   - the phinary line is FENCED: every file it added must be listed in FENCE.md and
 *     exist, and nothing listed may be a core file;
 *   - the core changes the quantum line left behind were each decided when it moved out,
 *     and the decisions are pinned here, so a later edit cannot quietly undo one;
 *   - the README points at FENCE.md, and the instruction counts it states are the code's.
 *     Those went stale once: the README said 25 opcodes and 358 cells for weeks after the
 *     quantum line made it 26 and 325.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const T = require('../src/ternary.js');
const { OPS, EXTENSIONS } = require('../src/isa.js');
const { assemble } = require('../src/assembler.js');
const { TryteVM } = require('../src/vm.js');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0; const fails = [];
let quiet = false;                     // set only while the harness checks itself
const check = (name, cond, detail = '') => {
  if (cond) { pass++; if (!quiet) console.log(`  [PASS] ${name}`); }
  else { fails.push(name); if (!quiet) console.log(`  [FAIL] ${name}  ${detail}`); }
};

/* The lines and the commit ranges they arrived in. FROM is the commit the line was built
 * on; TO is its last commit before it met this repository. */
const QUANTUM = { name: 'quantum, cryptography and toolchain', from: 'a7b452f', to: '80a07c8' };
const PHINARY = { name: 'phinary', from: '35a0c81', to: '1506225' };

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

/** Is a path tracked in this tree? Untracked build debris (an ignored .olean) is not a re-add. */
function tracked(file) {
  try {
    return execFileSync('git', ['ls-files', '--error-unmatch', file],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) !== '';
  } catch (e) { return false; }
}

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  check('the harness reports a false check as FAIL', (() => {
    const before = [fails.length, pass];
    quiet = true; check('deliberately false', false); quiet = false;
    const caught = fails.length === before[0] + 1 && pass === before[1];
    fails.pop(); return caught;
  })());
  check('an unlisted file is not covered',
    !covers(['quantum/', 'src/phinary.js'], 'src/scheduler.js'));
  check('   a directory entry covers what it contains',
    covers(['quantum/'], 'quantum/src/unified-compiler.js'));
  check('   and does not cover a sibling that merely shares its name as a prefix',
    !covers(['quantum/'], 'quantum-notes.md') && !covers(['src/phinary.js'], 'src/phinary.jsx'));
  const sample = 'x\n\nFenced paths:\n\n- `a/`\n- `b.js`\n\nprose after\n\nFenced paths:\n\n- `c.js`\n';
  check('the fence parser reads every list and stops at the end of each',
    JSON.stringify(fencedPaths(sample)) === JSON.stringify(['a/', 'b.js', 'c.js']));
  // The absence check must be able to see presence, or "absent" below is vacuous.
  check('the tracked-file probe sees a file that is tracked, and not one that is not',
    tracked('src/vm.js') && !tracked('src/no-such-file.js'));
}

const md = read('FENCE.md');
const fence = fencedPaths(md);

console.log('\n=== 1. THE QUANTUM LINE MOVED OUT, AND STAYS OUT ===');
{
  check('FENCE.md names both ends of the quantum line', md.includes(QUANTUM.from) && md.includes(QUANTUM.to));
  const added = addedBy(QUANTUM.from, QUANTUM.to);
  // Fail closed: a history that cannot be read is not a boundary that holds.
  check('   git can say what the quantum line added', added !== null && added.length > 0);
  const back = (added || []).filter(tracked);
  check('   and not one of those files is tracked in this tree',
    added !== null && back.length === 0, `re-added: ${back.slice(0, 8).join(' ')}`);
  const stated = /all (\d+)\s+files it added left this tree/.exec(md);
  check(`   and FENCE.md's count of them is the derived one (${added && added.length})`,
    stated !== null && added !== null && Number(stated[1]) === added.length,
    stated ? stated[1] : 'no count found');
  check('   and FENCE.md lists none of them as fenced, because they are gone',
    (added || []).every(f => !covers(fence, f)));
  // QEXEC was the line's foothold in the core; the core must not know it any more.
  check('the core instruction table has no QEXEC, and nothing in this process registered one',
    !('QEXEC' in OPS) && !('QEXEC' in EXTENSIONS));
  const coreSrc = ['src/vm.js', 'src/isa.js', 'src/assembler.js', 'src/selfhost.js'].map(read).join('\n');
  check('   and no core file requires anything under quantum/',
    !/require\(['"][^'"]*quantum\//.test(coreSrc));
}

console.log('\n=== 2. THE CORE CHANGES IT LEFT BEHIND, AS DECIDED ===');
{
  // Reverted: the oracle propagates a missing value instead of masking it as 0.
  check('wrap(undefined) and wrap(NaN) propagate as NaN -- the masking guard stays reverted',
    Number.isNaN(T.wrap(undefined)) && Number.isNaN(T.wrap(NaN)));
  // ... because with the guard, a write through a missing address landed on cell 0.
  const vm = new TryteVM();
  vm.write(0, 5); vm.write(undefined, 9);
  check('   so a write through an address that does not exist leaves cell 0 alone',
    vm.read(0) === 5, `cell 0 = ${vm.read(0)}`);
  // ... and the place T-SILENT-NAN is actually stopped is the assembler.
  let refused = false;
  try { assemble('LOAD nowhere\nHALT'); } catch (e) { refused = /unknown label 'nowhere'/.test(e.message); }
  check('   and the assembler refuses an unknown label, which is where that trap is caught', refused);
  // Kept: shifts by a negative or oversized count are defined, and interp.tasm relies on it.
  check('kept: a negative shift count shifts the other way, an oversized one gives 0',
    T.shiftLeft(5, -1) === T.shiftRight(5, 1) && T.shiftRight(-5, -1) === T.shiftLeft(-5, 1)
    && T.shiftLeft(5, 9) === 0 && T.shiftRight(5, 9) === 0);
  // Kept: duplicate labels are refused.
  let dup = false;
  try { assemble('a: HALT\na: HALT'); } catch (e) { dup = /duplicate label 'a'/.test(e.message); }
  check('kept: the assembler refuses a duplicate label', dup);
  // Restored: interp-core is byte-identical to the form its recorded 224 was measured in.
  let pre = null;
  try { pre = execFileSync('git', ['show', `${QUANTUM.from}:programs/interp-core.tasm`], { cwd: ROOT, encoding: 'utf8' }); } catch (e) { /* fail below */ }
  check('restored: programs/interp-core.tasm is byte-identical to its pre-merge content',
    pre !== null && pre.replace(/\r\n/g, '\n') === read('programs/interp-core.tasm').replace(/\r\n/g, '\n'));
}

console.log('\n=== 3. PHINARY IS FENCED, AND THE FENCE POINTS AT THINGS THAT EXIST ===');
{
  check('FENCE.md lists fenced paths', fence.length > 0, String(fence.length));
  check('FENCE.md names both ends of the phinary line', md.includes(PHINARY.from) && md.includes(PHINARY.to));
  const added = addedBy(PHINARY.from, PHINARY.to);
  check('   git can say what the phinary line added', added !== null && added.length > 0);
  const missed = (added || []).filter(f => !covers(fence, f));
  check('   every file the phinary line added is fenced',
    added !== null && missed.length === 0, `unfenced: ${missed.slice(0, 8).join(' ')}`);
  const dangling = fence.filter(f => !fs.existsSync(path.join(ROOT, f)));
  check('every fenced path exists in the tree', dangling.length === 0, dangling.join(' '));
  const dupes = fence.filter((f, i) => fence.indexOf(f) !== i);
  check('   and none is listed twice', dupes.length === 0, dupes.join(' '));
  const CORE = ['src/ternary.js', 'src/isa.js', 'src/vm.js', 'src/assembler.js',
    'src/selfhost.js', 'src/device.js', 'FINDINGS.json', 'test/run-all.js'];
  check('   and no core file is fenced', CORE.every(c => !covers(fence, c)));
}

console.log('\n=== 4. THE README POINTS HERE, AND ITS COUNTS ARE THE CODE\'S ===');
{
  const readme = read('README.md');
  check('the README links FENCE.md', readme.includes('(FENCE.md)'));

  // The instruction set is OPS. Extensions register into a separate table and are never
  // part of it. Derived, not typed.
  const core = Object.keys(OPS).length;
  // every opcode the machine knows: the core, plus any extension registered in this process
  const all = Object.keys(OPS).length + Object.keys(EXTENSIONS).length;
  check(`the README calls it a ${core}-instruction core machine`,
    readme.includes(`a ${core}-instruction core machine`));
  check(`   and its machine table says ${core} instructions`,
    readme.includes(`| Instructions | ${core} (`));

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
