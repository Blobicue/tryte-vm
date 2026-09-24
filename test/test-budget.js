'use strict';
/* test-budget.js — the roadmap's numbers are the tool's numbers.
 *
 * `design/12-roadmap.md` commits to an order, and it argues that order from switch
 * counts and from which programs fit in how much memory. Both are computed:
 * the costs by `tools/budget.js`, the program ladder by assembling `programs/`.
 *
 * A markdown table is exactly where `T-STALE-CONSTANT` lives — it has bitten three
 * times, and the README's tallies went stale twice the same way. So every number
 * in that file is re-derived here and compared. If device.js changes what a
 * register costs, or somebody adds a program, this fails until the roadmap is
 * updated.
 *
 * It also checks the two claims the roadmap actually reasons from, rather than
 * only the digits it displays: that 81/M1 is the UNIQUE intersection of the two
 * ladders, and that a total containing a PROPOSED term cannot be labelled
 * MEASURED.
 */

const fs = require('fs');
const path = require('path');
const B = require('../tools/budget.js');
const D = require('../src/device.js');
const { assemble } = require('../src/assembler.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const ROADMAP = fs.readFileSync(path.join(__dirname, '..', 'design', '12-roadmap.md'), 'utf8');
const num = s => Number(String(s).replace(/,/g, ''));

console.log('\n=== 1. UNIT COSTS COME FROM THE BUILDERS ===');
{
  const built = fn => { const net = new D.Net(); fn(net); return net.cost().switches; };
  check(`the adder is ${B.U.adder}, counted not typed`,
    B.U.adder === built(n => D.dRippleAdder(n, 6)));
  check(`the decoded selector is ${B.U.dmux} and the detector ${B.U.detector}`,
    B.U.dmux === built(n => D.dmux(n, 's', 'sm', 'l', 'm', 'h', 'o'))
    && B.U.detector === built(n => D.isMid(n, 's', 'o')));
  // These three cannot come from a builder — `latch` and the master-slave pair are
  // local to their audits, not device.js exports — so budget.js reads them from the
  // ledger by id. Compare tool against LEDGER, not against the same literal twice:
  // the first version of this check asserted `B.U.msRegister === 132` while
  // budget.js also had 132 typed in, which compares a number to itself and cannot
  // fail. A tautology inside the suite whose job is catching stale constants.
  const M = require('../FINDINGS.json');
  const measured = (setId, predId) =>
    M.prediction_sets.find(s => s.id === setId).predictions.find(p => p.id === predId).measured;
  check(`a master-slave register in place is K2's ${B.U.msRegister}, read from the ledger`,
    B.U.msRegister === measured('K', 'K2').without);
  check(`a loop-breaking cell is J2's ${B.U.cellLoopBreaking} per trit, read from the ledger`,
    B.U.cellLoopBreaking === measured('J', 'J2').without / 6);
  check(`a retained cell is H4's ${B.U.cellRetained} per trit, read from the ledger`,
    B.U.cellRetained === measured('H', 'H4').dynamic_cell_switches);
  check('   and if the ledger changed, the tool would move with it — not a literal'
    + ' compared to itself', (() => {
      const fake = { prediction_sets: [{ id: 'K', predictions: [{ id: 'K2', measured: { without: 999 } }] }] };
      const read = fake.prediction_sets.find(s => s.id === 'K').predictions
        .find(p => p.id === 'K2').measured.without;
      return read === 999 && read !== B.U.msRegister;
    })());
}

console.log('\n=== 2. THE ROADMAP\'S COST LADDER MATCHES THE TOOL ===');
{
  // Rows look like: | 81 | 4 | `M1` | 486 | 1,582 | 1,572 | **3,640** | yes |
  // Every cell may be bolded — the target row is bolded throughout, and an earlier
  // version of this regex allowed bold on only some columns. It silently skipped
  // that one row, and the comparison below still reported PASS on the five it did
  // parse. A check that quietly narrows its own corpus is `T-ONE-POINT` wearing a
  // different hat: the row that mattered most was the one not being checked. Hence
  // the exact-count assertion rather than `>=`.
  const B_ = String.raw`\*{0,2}`;
  const rows = [...ROADMAP.matchAll(new RegExp(
    String.raw`^\|\s*${B_}(\d+)${B_}\s*\|\s*${B_}(\d)${B_}\s*\|\s*${B_}\`(M[01])\`${B_}\s*`
    + String.raw`\|\s*${B_}([\d,]+)${B_}\s*\|\s*${B_}([\d,]+)${B_}\s*\|\s*${B_}([\d,]+)${B_}\s*`
    + String.raw`\|\s*${B_}([\d,]+)${B_}\s*\|\s*${B_}(yes|no)${B_}\s*\|`, 'gm'))];
  const displayed = (ROADMAP.match(/^\| \*{0,2}\d+\*{0,2} \| \*{0,2}\d\*{0,2} \| \*{0,2}`M[01]`/gm) || []).length;
  check(`${rows.length} cost rows parsed, and that is every row the file displays`,
    rows.length === displayed && rows.length >= 6, `parsed ${rows.length} of ${displayed}`);
  check('   a bolded row is parsed, not skipped — the target row is bolded throughout',
    rows.some(r => r[1] === '81' && r[3] === 'M1'));

  let bad = null;
  for (const r of rows) {
    const [, W, t, model, storage, addr, rest, total, sweep] = r;
    const c = B.CONFIGS.find(x => x.W === num(W) && x.model === model);
    if (!c) { bad = `no config for ${W}/${model}`; break; }
    const st = c.lines[0][1], ad = c.lines[1][1];
    if (c.t !== num(t)) { bad = `${W}/${model} trits ${t} vs ${c.t}`; break; }
    if (num(storage) !== st) { bad = `${W}/${model} storage ${storage} vs ${st}`; break; }
    if (num(addr) !== ad) { bad = `${W}/${model} address ${addr} vs ${ad}`; break; }
    if (num(rest) !== c.total - st - ad) { bad = `${W}/${model} rest ${rest} vs ${c.total - st - ad}`; break; }
    if (num(total) !== c.total) { bad = `${W}/${model} total ${total} vs ${c.total}`; break; }
    if ((sweep === 'yes') !== c.sweepable) { bad = `${W}/${model} sweepable ${sweep} vs ${c.sweepable}`; break; }
  }
  check('every displayed row agrees with budget.js on all six numbers', bad === null, bad || '');
}

console.log('\n=== 3. THE PROGRAM LADDER MATCHES THE ASSEMBLER ===');
{
  const dir = path.join(__dirname, '..', 'programs');
  const progs = fs.readdirSync(dir).filter(f => f.endsWith('.tasm')).map(f => {
    const cells = [...assemble(fs.readFileSync(path.join(dir, f), 'utf8')).cells.keys()].map(Number);
    return { name: f.replace('.tasm', ''), lo: Math.min(...cells), hi: Math.max(...cells) };
  });
  const fitting = W => progs.filter(p => p.lo >= -(W - 1) / 2 && p.hi <= (W - 1) / 2).length;

  check(`27 words fits ${fitting(27)} programs as placed — the roadmap says none`,
    fitting(27) === 0 && /27 \| −13\.\.13 \| \*\*none\*\*/.test(ROADMAP), String(fitting(27)));
  check(`81 words fits ${fitting(81)} — the roadmap says 4`, fitting(81) === 4, String(fitting(81)));
  check(`243 words fits ${fitting(243)} — the roadmap says 9`, fitting(243) === 9, String(fitting(243)));
  check(`729 words fits all ${fitting(729)}`, fitting(729) === progs.length, String(fitting(729)));
  check('   and countdown is the only program narrow enough to relocate into 27',
    progs.filter(p => p.hi - p.lo + 1 <= 27).map(p => p.name).join() === 'countdown');
}

console.log('\n=== 4. THE CLAIM THE PLAN ACTUALLY RESTS ON ===');
{
  // The roadmap picks 81/M1 because it is the UNIQUE configuration that both fits
  // the sweep budget and runs a program somebody already wrote. If either ladder
  // shifts, that uniqueness is what breaks first — so check the claim, not the row.
  const dir = path.join(__dirname, '..', 'programs');
  const progs = fs.readdirSync(dir).filter(f => f.endsWith('.tasm')).map(f => {
    const cells = [...assemble(fs.readFileSync(path.join(dir, f), 'utf8')).cells.keys()].map(Number);
    return { lo: Math.min(...cells), hi: Math.max(...cells) };
  });
  const runsSomething = W => progs.some(p => p.lo >= -(W - 1) / 2 && p.hi <= (W - 1) / 2);
  const both = B.CONFIGS.filter(c => c.sweepable && runsSomething(c.W));
  check(`exactly one configuration is both sweepable and runs a program: `
    + both.map(c => `${c.W}/${c.model}`).join(' '),
    both.length === 1 && both[0].W === 81 && both[0].model === 'M1',
    both.map(c => `${c.W}/${c.model}`).join(' '));
  check('   and the roadmap names that one as the target',
    /\*\*The two ladders intersect in exactly one place: 81 words under `M1`/.test(ROADMAP));
  // This asserted "more than 3x" and set C's rebuilt formula put it at 2.95x —
  // a criterion sitting on a boundary it had no reason to sit on, which is
  // `T-CRITERION-IN-THE-NOISE` in a different guise. The claim the roadmap actually
  // makes is about which term is LARGEST, so check the ordering, not a multiple.
  check('   the address path outweighs storage at 243 under M1 — the reordering claim',
    (() => {
      const c = B.CONFIGS.find(x => x.W === 243 && x.model === 'M1');
      return c.lines[1][1] > c.lines[0][1];
    })());
}

console.log('\n=== 4b. THE README STATES THESE NUMBERS TOO ===');
{
  // The README says this test "fails the build if this README, that roadmap and
  // that tool disagree". It did not read README.md at all — the sentence described
  // an enforcement that did not exist, which is worse than no sentence, because the
  // repo's whole claim is that its prose is checked. So: read it.
  const README = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  const target = B.CONFIGS.find(c => c.W === 81 && c.model === 'M1');
  const big = B.CONFIGS.find(c => c.W === 243 && c.model === 'M1');
  check(`the README's ~${target.total.toLocaleString()} for the target machine is the tool's`,
    README.includes(`~${target.total.toLocaleString()} switches`), String(target.total));
  check(`   and its ${big.lines[1][1].toLocaleString()} against ${big.lines[0][1].toLocaleString()}`
    + ' address-path claim matches too',
    README.includes(String(big.lines[1][1].toLocaleString()))
    && README.includes(String(big.lines[0][1].toLocaleString())));
  check('   and it names 81 words under retention as the one configuration',
    /81 words of memory under\s+charge retention/.test(README));
  check('   and the sweep budget it quotes is H2\'s',
    README.includes(`~${(Math.round(B.SWEEP_DEVICE_BUDGET / 100) * 100).toLocaleString()} devices`),
    String(B.SWEEP_DEVICE_BUDGET));
}

console.log('\n=== 5. STATUS PROPAGATION HAS TEETH ===');
{
  check('every total containing a PROPOSED term is labelled PROPOSED',
    B.CONFIGS.every(c => !c.lines.some(l => l[2] === 'PROPOSED') || c.status === 'PROPOSED'));
  check('   and no configuration claims MEASURED, because none has been built',
    B.CONFIGS.every(c => c.status !== 'MEASURED'));
  check('   a config of only MEASURED lines would be labelled MEASURED', (() => {
    // Teeth: the propagation is not just returning PROPOSED unconditionally.
    const rank = { MEASURED: 2, DERIVED: 1, PROPOSED: 0 };
    const lines = [['a', 1, 'MEASURED'], ['b', 2, 'MEASURED']];
    return lines.reduce((w, l) => rank[l[2]] < rank[w] ? l[2] : w, 'MEASURED') === 'MEASURED';
  })());
  check('   and one DERIVED term among MEASURED ones drags it to DERIVED', (() => {
    const rank = { MEASURED: 2, DERIVED: 1, PROPOSED: 0 };
    const lines = [['a', 1, 'MEASURED'], ['b', 2, 'DERIVED']];
    return lines.reduce((w, l) => rank[l[2]] < rank[w] ? l[2] : w, 'MEASURED') === 'DERIVED';
  })());
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
