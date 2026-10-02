'use strict';
/* test-opcodes.js — no two opcode tables may claim the same code or the same name.
 *
 * Written because it happened, and nothing noticed. The instruction set is split across
 * two tables -- `OPS` in src/isa.js and `PHINARY_OPS` in src/phinary.js -- and two lines
 * of work that forked from one commit each added an opcode numbered 25: QEXEC in the
 * first table, PHINORM in the second. They live in different files, so the merge that
 * brought them together raised no conflict at all. And vm.js resolves an opcode as
 * `BY_CODE[code] || PHINARY_BY_CODE[code]`, so after that merge every PHINORM would have
 * executed QEXEC: no error, no warning, a quantum braid where a normalisation was asked
 * for. PHINARY_OPS was renumbered to clear it. This suite is what makes the next one
 * fail a check instead of a program.
 */

const fs = require('fs');
const path = require('path');
const { OPS, BY_CODE, EXTENSIONS, EXT_BY_CODE, registerExtension } = require('../src/isa.js');
const P = require('../src/phinary.js');
const { assemble, loadInto } = require('../src/assembler.js');
const { TryteVM } = require('../src/vm.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

/** Every code or name claimed by more than one entry across the given tables. */
function clashes(tables) {
  const byCode = new Map(), byName = new Map();
  for (const [tname, table] of Object.entries(tables)) {
    for (const [op, spec] of Object.entries(table)) {
      (byCode.get(spec.code) || byCode.set(spec.code, []).get(spec.code)).push(`${tname}.${op}`);
      (byName.get(op) || byName.set(op, []).get(op)).push(tname);
    }
  }
  return {
    codes: [...byCode].filter(([, who]) => who.length > 1),
    names: [...byName].filter(([, who]) => who.length > 1),
  };
}

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  check('the harness reports a false check as FAIL', (() => {
    const before = fails.length; check('deliberately false', false);
    const caught = fails.length === before + 1; fails.pop(); return caught;
  })());
  // The check must FIRE on the exact collision that shipped. A detector that cannot see
  // the bug it exists for is coverage in appearance only.
  const shipped = clashes({ OPS: { QEXEC: { code: 25 } }, PHINARY_OPS: { PHINORM: { code: 25 } } });
  check('the clash detector fires on the collision that actually happened: 25 claimed twice',
    shipped.codes.length === 1 && shipped.codes[0][0] === 25);
  check('   and on a mnemonic claimed by two tables',
    clashes({ a: { X: { code: 1 } }, b: { X: { code: 2 } } }).names.length === 1);
  check('   and stays silent on two tables that genuinely do not overlap',
    (() => { const c = clashes({ a: { X: { code: 1 } }, b: { Y: { code: 2 } } });
      return c.codes.length === 0 && c.names.length === 0; })());
}

console.log('\n=== 1. THE TABLES DO NOT COLLIDE ===');
{
  // The tables are the ones the ASSEMBLER merges, read out of its source rather than
  // listed here -- so a third table added to the assembler but not to this suite fails
  // instead of going unchecked.
  const asm = fs.readFileSync(path.join(__dirname, '..', 'src', 'assembler.js'), 'utf8');
  const merged = /function opTable\(\) \{ return \{([^}]*)\}/.exec(asm);
  const spreads = merged ? [...merged[1].matchAll(/\.\.\.([\w.]+)/g)].map(m => m[1]) : [];
  const KNOWN = { OPS, 'P.PHINARY_OPS': P.PHINARY_OPS, EXTENSIONS };
  check('the assembler merges exactly the tables this suite knows how to check',
    spreads.length > 0 && spreads.every(s => s in KNOWN)
    && Object.keys(KNOWN).every(k => spreads.includes(k)),
    `assembler spreads ${spreads.join(', ')}`);

  const c = clashes({ OPS, PHINARY_OPS: P.PHINARY_OPS, EXTENSIONS });
  check('no opcode number is claimed by two entries',
    c.codes.length === 0, JSON.stringify(c.codes));
  check('no mnemonic is claimed by two tables',
    c.names.length === 0, JSON.stringify(c.names));
}

console.log('\n=== 2. EVERY OPCODE DISPATCHES TO ITSELF ===');
{
  // Uniqueness is necessary and not sufficient. What matters is that the VM's lookup --
  // BY_CODE first, PHINARY_BY_CODE second -- resolves every code to the instruction that
  // owns it, which is the thing that was silently false.
  const all = { ...OPS, ...P.PHINARY_OPS, ...EXTENSIONS };
  const wrong = Object.entries(all).filter(([name, spec]) => {
    const got = BY_CODE[spec.code] || P.PHINARY_BY_CODE[spec.code] || EXT_BY_CODE[spec.code];
    return !got || got.name !== name;
  }).map(([n]) => n);
  check(`all ${Object.keys(all).length} opcodes resolve to themselves through the VM's own lookup`,
    wrong.length === 0, `misrouted: ${wrong.join(' ')}`);

  // And the assembler agrees: assembling each mnemonic emits its table's code.
  const misassembled = Object.entries(all).filter(([name, spec]) => {
    const operand = spec.operand === 'none' ? '' : ' 0';
    // `cells` is a Map keyed by address, not an array -- reading `cells[0]` returned
    // undefined and failed every opcode, which was this check's own first bug.
    try { const r = assemble(`${name}${operand}\nHALT`); return r.cells.get(r.origin) !== spec.code; }
    catch (e) { return true; }
  }).map(([n]) => n);
  check('   and assembling each mnemonic emits exactly its own code',
    misassembled.length === 0, `misassembled: ${misassembled.join(' ')}`);
}

console.log('\n=== 3. AND THE ONE THAT WAS BROKEN, RUN ===');
{
  // Behaviourally, not just by table lookup. Under the collision, this program's PHINORM
  // dispatched as QEXEC, which reads a braid length from memory and throws on the first
  // invalid generator. Here it must execute as PHINORM: no throw, and the trace names it.
  const vm = new TryteVM({ trace: true });
  loadInto(vm, 'LOADI 5\nPHINORM\nOUT\nHALT', 0);
  let threw = null;
  try { vm.run(); } catch (e) { threw = e.message; }
  check('a program using PHINORM runs to completion', threw === null, threw || '');
  check('   and the instruction the VM executed was PHINORM, not QEXEC',
    vm.trace.some(t => t.op === 'PHINORM') && !vm.trace.some(t => t.op === 'QEXEC'),
    vm.trace.map(t => t.op).join(' '));
}

console.log('\n=== 4. THE EXTENSION HOOK REFUSES WHAT WOULD COLLIDE ===');
{
  // Extensions register at runtime (isa.js), so the collision that put two instructions on
  // opcode 25 must be refused at registration, not discovered by a sweep afterwards. Every
  // code and name here is derived from the live tables, never typed.
  const taken = { ...OPS, ...P.PHINARY_OPS, ...EXTENSIONS };
  const used = new Set(Object.values(taken).map(s => s.code));
  let free = Math.max(...used) + 1; while (used.has(free)) free++;
  const core = Object.entries(OPS)[4], phin = Object.entries(P.PHINARY_OPS)[0];
  const refuses = (name, spec, why) => {
    try { registerExtension(name, spec); return false; } catch (e) { return why.test(e.message); }
  };
  const exec = () => {};
  check(`registering a core opcode's code (${core[1].code}, ${core[0]}'s) is refused, naming the owner`,
    refuses('XA', { code: core[1].code, operand: 'none', exec }, new RegExp(`already ${core[0]}'s`)));
  check(`   and phinary's (${phin[1].code}, ${phin[0]}'s) likewise`,
    refuses('XB', { code: phin[1].code, operand: 'none', exec }, new RegExp(`already ${phin[0]}'s`)));
  check(`   and a core mnemonic (${core[0]}) on a free code`,
    refuses(core[0], { code: free, operand: 'none', exec }, /already in use/));
  check('   and nothing refused was half-registered',
    !('XA' in EXTENSIONS) && !('XB' in EXTENSIONS) && !(free in EXT_BY_CODE));

  // Before registration the mnemonic does not exist: the assembler must refuse it.
  let unknown = false;
  try { assemble('XPROBE 0\nHALT'); } catch (e) { unknown = /unknown instruction 'XPROBE'/.test(e.message); }
  check('an extension nobody registered is an unknown instruction to the assembler', unknown);

  const seen = [];
  const probe = { code: free, operand: 'addr', doc: 'test probe',
    exec: (vm, operand, ctx) => { seen.push([operand, ctx.pc]); vm.A = 7; } };
  registerExtension('XPROBE', probe);
  check('   and once registered, re-registering the identical spec is a no-op',
    (() => { try { registerExtension('XPROBE', probe); return true; } catch (e) { return false; } })());
  check('   while a different definition under the same name is refused',
    refuses('XPROBE', { ...probe, exec: () => {} }, /different definition/));
  const vm = new TryteVM({ trace: true });
  loadInto(vm, 'XPROBE 5\nOUT\nHALT', 0);
  vm.run();
  check('the VM dispatches to the extension\'s own exec, with its operand and its address, and traces it by name',
    seen.length === 1 && seen[0][0] === 5 && seen[0][1] === 0 && vm.output[0] === 7
    && vm.trace[0].op === 'XPROBE', JSON.stringify({ seen, out: vm.output }));
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
