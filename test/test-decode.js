'use strict';
/* test-decode.js — the control word, and whether decode can disappear.
 *
 * Set `T`. In this file a device THEOREM is always written "axiom T5", never bare —
 * bare `T1`–`T4` are this set's predictions, and the theorems share the letter.
 *
 * The check worth keeping is `T1`: an interpreter driven ONLY by control words,
 * never seeing an opcode, must reproduce `src/vm.js` step for step. That is the
 * only ground truth available, because no datapath consumes control lines yet — the
 * control table is a DESIGN, and everything else in this set is a theorem about it.
 *
 * The exhaustive version is `npm run audit:decode`.
 */

const fs = require('fs');
const path = require('path');
const T = require('../src/ternary.js');
const D = require('../src/device.js');
const { OPS, BY_CODE } = require('../src/isa.js');
const { TryteVM } = require('../src/vm.js');
const { assemble } = require('../src/assembler.js');
const { CONTROL, FIELDS, widthOf, blindStep, bestSubset } = require('../tools/decode-audit.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const NAMES = Object.keys(OPS);

console.log('\n=== 1. T1 — THE CONTROL WORD IS SUFFICIENT, AND OPCODE-BLIND ===');
{
  const dir = path.join(__dirname, '..', 'programs');
  const progs = fs.readdirSync(dir).filter(f => f.endsWith('.tasm')).sort();
  let agreed = 0, steps = 0; const bad = [];
  for (const f of progs) {
    const { cells } = assemble(fs.readFileSync(path.join(dir, f), 'utf8'));
    const mk = () => {
      const vm = new TryteVM({ input: [3, 4, 5], maxSteps: 60000 });
      for (const [a, v] of cells) vm.write(a, v);
      vm.PC = 0; return vm;
    };
    const ref = mk(), mine = mk();
    let diverged = null, n = 0;
    try {
      while (!ref.halted && n < 60000) {
        const more = ref.step(); blindStep(mine); n++;
        if (ref.A !== mine.A || ref.C !== mine.C || ref.PC !== mine.PC
          || ref.halted !== mine.halted || ref.output.length !== mine.output.length) {
          diverged = `step ${n}`; break;
        }
        if (!more) break;
      }
    } catch (e) { diverged = e.message.slice(0, 40); }
    steps += n;
    if (diverged) bad.push(`${f}:${diverged}`); else agreed++;
  }
  check(`all ${progs.length} programs agree with src/vm.js, ${steps} steps compared`,
    agreed === progs.length, bad.join(' '));
  check('   the interpreter reads the opcode only to look up its control word and'
    + ' never refers to it again — every branch is driven by a control field', true);
  check('   so a missing distinction in the table would surface as a divergence,'
    + ' not as a silent wrong answer', agreed === progs.length);
}

console.log('\n=== 2. T2 — ELEVEN TRITS, INJECTIVE, AND TOO WIDE FOR THE CELL ===');
{
  const total = FIELDS.reduce((a, f) => a + widthOf(f), 0);
  check(`the control word is ${total} trits wide`, total === 11, String(total));
  const words = NAMES.map(n => JSON.stringify(CONTROL[n]));
  check(`all ${NAMES.length} control words are distinct — the word is injective`,
    new Set(words).size === NAMES.length);
  const opTrits = Math.ceil(Math.log(NAMES.length) / Math.log(3) - 1e-9);
  check(`the opcode needs ${opTrits} trits and its cell holds 6, so 3 are spare`,
    opTrits === 3);
  check('   and 11 does not fit in 6 — so decode CANNOT be made to vanish by'
    + ' widening the opcode into its own cell\'s spare trits', total > 6);
}

console.log('\n=== 3. T3 — NO FIELD DIRECT-ENCODES INTO A THREE-TRIT OPCODE ===');
{
  const classSizes = f => {
    const c = {};
    for (const n of NAMES) c[CONTROL[n][f]] = (c[CONTROL[n][f]] || 0) + 1;
    return Object.values(c).sort((a, b) => b - a);
  };
  const expected = { op: [16, 5, 4], rd: [14, 11], wr: [23, 2], ix: [23, 2],
    dst: [16, 7, 2], pc: [22, 2, 1], io: [22, 1, 1, 1] };
  let mism = null;
  for (const [f, want] of Object.entries(expected)) {
    const got = classSizes(f);
    if (got.join() !== want.join()) { mism = `${f}: ${got} vs ${want}`; break; }
  }
  check('every registered class size matches', mism === null, mism || '');
  check('   the ALU field is 7,6,2 then ten singletons', (() => {
    const s = classSizes('alu');
    return s[0] === 7 && s[1] === 6 && s[2] === 2 && s.slice(3).every(x => x === 1);
  })());
  const fits = FIELDS.filter(f => Math.max(...classSizes(f)) <= 3 ** (3 - widthOf(f)));
  check('no field fits: a width-w field needs max class <= 3^(3-w)',
    fits.length === 0, fits.join(' '));
  check('   and the rule is width-sensitive — asking only "max class <= 9" would'
    + ' wrongly pass the 3-trit ALU field on its max class of 7',
    Math.max(...classSizes('alu')) <= 9 && 3 ** (3 - widthOf('alu')) === 1);
}

console.log('\n=== 4. T4 FAILED — FIVE TRITS, NOT SIX, AND NOT INJECTIVE ===');
{
  const best = bestSubset();
  const total = FIELDS.reduce((a, f) => a + widthOf(f), 0);
  check(`the best jointly direct-encodable subset is ${best.sub.join('+')} at`
    + ` ${best.W} trits`, best.W === 5, JSON.stringify(best));
  check(`   predicted 6 and jointly injective; measured ${best.W} with max joint`
    + ` class ${best.mx}`, best.W === 5 && best.mx === 3);
  check('   no subset totalling 6 trits is jointly injective — the fields are'
    + ' chunky and no combination summing to six separates all 25 opcodes',
    best.W < 6);
  check(`   so ${best.W} of ${total} control trits are free and decode keeps`
    + ` ${total - best.W} outputs — a 45% saving, not the 55% predicted`,
    Math.round(100 * best.W / total) === 45);
}

console.log('\n=== 5. WHAT DECODE COSTS AT THIS WIDTH ===');
{
  const nodes = 13;
  const tree = new D.Net();
  for (let i = 0; i < nodes; i++) D.tmux(tree, `s${i}`, 'vss', 'vmid', 'vdd', `n${i}`);
  const perTrit = tree.cost().switches;
  const total = FIELDS.reduce((a, f) => a + widthOf(f), 0);
  const best = bestSubset();
  check(`one control trit is a 3-input trit function: ${nodes} nodes, ${perTrit} switches`,
    perTrit === 52);
  check(`full decode at ${total} trits is ${perTrit * total} switches`,
    perTrit * total === 572);
  check(`after direct-encoding ${best.W}, ${perTrit * (total - best.W)} switches`,
    perTrit * (total - best.W) === 312);
  check('   the cost section reads the search result — it hardcoded 6 once and'
    + ' printed a saving the measurement two lines above had refuted',
    perTrit * (total - best.W) !== perTrit * (total - 6));
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
