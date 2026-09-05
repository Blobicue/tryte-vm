'use strict';
/* test-carryin.js — does the decoded adder's pass-count rule survive a non-zero carry-in, where position zero can save and F said the walk is a different one?
 *
 * Set `AW`. THE CHECK HERE WORTH KEEPING IS THE POSITION-1 CONTROL in section 5 —
 * that the arrival instrument, pointed one position up, DOES see a carry land a pass
 * early exactly on the digit-pairs `F`'s condition picks out. The headline measurement
 * is a zero: at position 0, none of the twelve qualifying combinations arrives early.
 * A zero is the cheapest thing in the world to produce by accident — an instrument
 * that cannot see an early arrival at all reports the same zero, and it reads as a
 * clean mechanistic finding either way. The control is what makes the zero mean
 * something, and it is why `AW1`'s failure can be reported as "the saving does not
 * happen" rather than the weaker "the pass count came out one higher".
 *
 * The LESSON worth keeping is that `F` wrote a scope line about its own blind spot
 * and guessed the wrong way. `F1` scoped itself "carry-in 0 throughout; with a
 * non-zero carry-in the bottom position can save as well (six of its nine digit-pairs
 * qualify) and the walk is a different one" — and the six qualifying digit-pairs are
 * real, the walk is different, and the bottom position still cannot save. `AW` was
 * registered to cross that scope line and found the rule needed no amendment at all:
 * position 0 is excluded because it is the BOUNDARY cell, not because `c_0` is zero.
 * A correct honest disclosure of a limit is not a prediction about what lies past it.
 *
 * The exhaustive version is `npm run audit:carryin`.
 */

const A = require('../tools/carryin-audit.js');
const D = require('../src/device.js');
const NP = require('../src/netpack.js');
const T = require('../src/ternary.js');
const SW = require('../src/solver-wasm.js');
const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'FINDINGS.json'), 'utf8'));
const AW = MANIFEST.prediction_sets.find(s => s.id === 'AW');
const of = id => (AW ? AW.predictions.find(p => p.id === id) : null);
const F = id => MANIFEST.unregistered_findings.find(f => f.id === id);

async function main() {
const inst = await A.instrument();

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // 0a. The construction is the one the registration described. A set whose subject
  // is not the subject it cites is measuring something nobody registered.
  const dec = new D.Net(); D.dRippleAdder(dec, 6);
  const decP = NP.pack(dec, A.TERN_IN);
  check('the subject is the decoded six-trit ripple the registration fixed — 540 '
    + 'switches, E2\'s number, recomputed from the builder',
    dec.cost().switches === 540 && decP.nodeCount === 208,
    `${dec.cost().switches} switches, ${decP.nodeCount} nodes`);
  check('   and all 531,441 pairs is 3^12, so "no stride anywhere in this set" is a '
    + 'claim about a domain this size',
    A.TERN_PAIRS === Math.pow(3, 12));

  // 0b. THE TOOL AS IT IS ACTUALLY RUN. T-TOOL-CHECKED-ONLY-BY-IMPORT: importing a
  // tool sets MAIN false, so every log line is skipped and a fault in the report path
  // stays invisible to a suite that only imports. Run the real thing.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'carryin-audit.js'), '--quick'],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('CARRY-IN AUDIT') && out.includes('AW1'));
  check('   and its quick mode says outright that nothing in it is a measurement',
    out.includes('NOTHING BELOW') && out.includes('IS A MEASUREMENT'));
  check('   and every one of the four verdicts reaches the print path',
    ['AW1', 'AW2', 'AW3', 'AW4'].every(id => new RegExp(`${id} (HELD|FAILED)`).test(out)));

  // 0c. Check the pipeline against a case whose answer is known independently.
  //
  // Two of them. The MATRIX is derived from the adder's own tables rather than read
  // off the registration — T-TRANSCRIBED-TABLE is on the record because a detector's
  // truth table was hand-copied once and inverted, and produced 36 clean failures in
  // exactly the mechanistic pattern real contention would give. And the WALK over it
  // must reproduce F3's 251,505, which is the case already on the record.
  check('F\'s transfer matrix, derived from the adder\'s tables, is the one the '
    + 'registration hardcoded as STEP',
    JSON.stringify(A.derivedMatrix()) === JSON.stringify([[2, 1, 0], [1, 7, 1], [0, 1, 2]])
    && JSON.stringify(A.STEP([1, 0, 0])) === JSON.stringify([2, 1, 0])
    && JSON.stringify(A.STEP([0, 1, 0])) === JSON.stringify([1, 7, 1])
    && JSON.stringify(A.STEP([0, 0, 1])) === JSON.stringify([0, 1, 2]));
  check('   and the walk over it reproduces F3\'s 251,505 from F\'s own start vector',
    A.CONTROL.full === 251505);
  check('   and a MUTANT matrix is caught: one cell changed and the control moves',
    (() => {
      const bad = v => [2 * v[0] + v[1], v[0] + 7 * v[1] + v[2], v[1] + 3 * v[2]];
      let x = [1, 7, 1];
      for (let i = 0; i < 4; i++) x = bad(x);
      return 9 * (x[0] + x[1] + x[2]) !== 251505;
    })());

  // 0d. The module. AV's four functions are untouched: this set appends a fifth and
  // exports it, and `moduleBytes()` with no argument must still emit AV's bytes —
  // test-solver.js pins that length, so a change here would go red over there.
  check('the stock module is byte-for-byte what AV timed, and exports the same three',
    SW.moduleBytes().length === 1386
    && WebAssembly.Module.exports(new WebAssembly.Module(SW.moduleBytes()))
      .map(e => `${e.name}:${e.kind}`).sort().join(' ')
      === 'memory:memory seedCodes:function solve:function sweep:function');
  check('   and the module this set sweeps with is that one plus a probe, not an edit '
    + 'to it',
    inst.bytes.length > SW.moduleBytes().length
    && typeof inst.exports.probe === 'function'
    && SW.FUNCS.length === 4);
}

console.log('\n=== 1. AW1  the rule, pair by pair ===');
{
  const p = of('AW1'), m = p && p.measured;
  check('AW1 is recorded, and it FAILED', p && p.outcome === 'FAILED');
  check('   the registered rule — position 0 admitted — is wrong on two thirds of '
    + 'every pair at both non-zero carry-ins',
    m && m.disagreements_registered_rule > 0
    && m.pairs_swept === 2 * 531441
    && Math.abs(m.disagreements_registered_rule / m.pairs_swept - 2 / 3) < 1e-6,
    m && `${m.disagreements_registered_rule} of ${m.pairs_swept}`);
  check('   and two thirds is exactly F\'s "six of its nine digit-pairs qualify": the '
    + 'six recomputed here, from the same condition',
    (() => {
      let q = 0;
      for (const cin of [1, -1]) {
        for (let a = -1; a <= 1; a++) {
          for (let b = -1; b <= 1; b++) if (T.shiftRight(a + b + cin, 1) === T.shiftRight(a + b, 1)) q++;
        }
      }
      return q === 12 && q / 18 === 2 / 3;
    })());
  check('   and every disagreement is by exactly one pass, in one direction',
    m && JSON.stringify(Object.keys(m.corrected_minus_registered).sort()) === '["0","1"]');
  // THE NUMBER THIS WHOLE SET TURNS ON, and it was recorded before it was asserted:
  // mutation-testing the section found this one silently unchecked while every other
  // figure was pinned. F's rule as F1 published it, with the carry-in seeded rather
  // than assumed zero, is exact over every pair at both carry-ins — which is why
  // AW1's amendment is the thing that failed and not the rule.
  check('   and F\'s rule UNCHANGED — position 0 excluded, carry-in seeded — disagrees '
    + 'with the solver on NO pair at either carry-in',
    m && m.disagreements_F_rule_unchanged === 0
    && m.pairs_swept === 1062882,
    m && `${m.disagreements_F_rule_unchanged} of ${m.pairs_swept}`);
  check('   and the oracle, not the packed solver, was asked about the disagreements — '
    + 'suspect the instrument first, T-INSTRUMENT-FALSE-VERDICT',
    m && Array.isArray(m.oracle_probed_disagreements)
    && m.oracle_probed_disagreements.length > 0
    && m.oracle_probed_disagreements.every(o =>
      o.oracle_k === o.corrected_k && o.oracle_k === o.registered_k + 1),
    m && JSON.stringify((m.oracle_probed_disagreements || [])[0]));

  // THE REPLICATION, at widths the suite can afford exhaustively. A rule fitted to six
  // trits rather than derived comes apart at the other widths — F4 is on the record for
  // exactly that shape, and this runs the same check at the carry-ins F never swept.
  {
    let widths = 0, disagreeF = 0, disagreeAW = 0, pairs = 0;
    for (let n = 2; n <= 4; n++) {
      const net = new D.Net(); D.dRippleAdder(net, n);
      const names = [...Array.from({ length: n }, (_, i) => `a${i}`),
        ...Array.from({ length: n }, (_, i) => `b${i}`), 'cin'];
      const P = NP.pack(net, names);
      const max = Math.pow(3, n), lo = -(max - 1) / 2, hi = (max - 1) / 2;
      const settles = (ins, k) => {
        try { inst.solveNamed(P, ins, k); return true; } catch (e) { return false; }
      };
      for (const cin of [1, -1]) {
        for (let a = lo; a <= hi; a++) {
          for (let b = lo; b <= hi; b++) {
            pairs++;
            const ins = { cin };
            T.toTrits(a, n).forEach((t, i) => { ins[`a${i}`] = t; });
            T.toTrits(b, n).forEach((t, i) => { ins[`b${i}`] = t; });
            const kF = A.passesUnder(a, b, n, cin, 1);
            const kAW = A.passesUnder(a, b, n, cin, 0);
            if (!(settles(ins, kF) && !settles(ins, kF - 1))) disagreeF++;
            if (!(settles(ins, kAW) && !settles(ins, kAW - 1))) disagreeAW++;
          }
        }
      }
      widths++;
    }
    check(`   REPLICATED at widths 2, 3 and 4, exhaustively, at both non-zero `
      + `carry-ins (${pairs.toLocaleString('en-US')} pairs): F's rule unchanged is wrong `
      + `on ${disagreeF}`,
      widths === 3 && disagreeF === 0, `${disagreeF} disagreements`);
    check('   and AW1\'s amendment is wrong at those widths too, so the failure is not '
      + 'a fact about six trits',
      disagreeAW > 0, `${disagreeAW} disagreements`);
  }
}

console.log('\n=== 2. AW2  the walk gives 46,899 ===');
{
  const p = of('AW2'), m = p && p.measured;
  check('AW2 is recorded, and it FAILED', p && p.outcome === 'FAILED');
  check('   the registered 46,899 is the walk this set derived, recomputed here',
    A.PLUS.full === 46899 && A.MINUS.full === 46899
    && m && m.registered === 46899);
  check('   and the measured count is the same at both carry-ins and is not 46,899',
    m && m.pairs_at_thirteen_passes_plus === m.pairs_at_thirteen_passes_minus
    && m.pairs_at_thirteen_passes_plus !== 46899);
  // The walk was not wrong; the START VECTOR was. Position 0 turns out to be free
  // rather than constrained, so it contributes a distribution over its nine pairs and
  // there are four applications, not five — which is F's own shape.
  check('   and the same walk from the start vector position 0 actually hands on, with '
    + 'four applications rather than five, gives the measured number exactly',
    m && A.walk(A.startVector(1), 4).full === m.pairs_at_thirteen_passes_plus
    && A.walk(A.startVector(-1), 4).full === m.pairs_at_thirteen_passes_minus,
    m && `walk ${A.walk(A.startVector(1), 4).full}, measured ${m.pairs_at_thirteen_passes_plus}`);
  check('   and the start vectors are (0, 6, 3) and (3, 6, 0), recomputed from the '
    + 'nine bottom digit-pairs rather than typed',
    JSON.stringify(A.startVector(1)) === '[0,6,3]'
    && JSON.stringify(A.startVector(-1)) === '[3,6,0]');
}

console.log('\n=== 3. AW3  the two carry-ins mirror ===');
{
  const p = of('AW3'), m = p && p.measured;
  check('AW3 is recorded, and it FAILED', p && p.outcome === 'FAILED');
  // BOTH READINGS ARE ON THE RECORD, because T-SCOPE-DECIDES-THE-VERDICT bit twice by
  // letting a measurement draw a boundary the prediction did not. The symmetry half —
  // which is what AW3's own AT RISK line names as refuting it, "any single bin
  // differing" — held exactly. The sentence also named two vectors, and those are
  // AW2's arithmetic and are wrong.
  check('   the symmetry half held exactly: every bin equal, the carry-state vectors '
    + 'reversed',
    m && m.same_distribution_bin_for_bin === true && m.carry_vectors_are_reverses === true);
  check('   the literal half did not: the two vectors it names are AW2\'s and AW2 failed',
    m && m.registered_vectors_hold === false
    && JSON.stringify(m.carry_vector_plus) !== JSON.stringify(A.PLUS.trail[5]));
  check('   and the verdict is scored on the literal reading, with the other recorded '
    + 'beside it rather than dropped',
    m && m.symmetry_reading === true && m.literal_reading === false
    && p.outcome === 'FAILED');
  check('   the measured vectors really are one another reversed, recomputed here',
    m && JSON.stringify(m.carry_vector_plus)
      === JSON.stringify([...m.carry_vector_minus].reverse()));
  // TWO UNITS, and the comparison is made in the registration's. The sweep bins PAIRS;
  // the registered vector counts the (a0..a4, b0..b4) prefixes that reach each carry
  // state, which is the same thing over the nine free choices of the top digit. Read
  // the wrong one and a factor of nine reads as a miss.
  check('   and the vector is compared in the registration\'s units — prefixes, not '
    + 'pairs — with the nine free top digits dividing exactly',
    m && m.top_digit_is_free === true
    && m.carry_vector_plus.every((v, i) => v * 9 === m.carry_vector_plus_in_pairs[i])
    && m.carry_vector_plus.reduce((x, y) => x + y, 0)
      === of('AW2').measured.pairs_at_thirteen_passes_plus / 9);
}

console.log('\n=== 4. AW4  the floor drops to eight ===');
{
  const p = of('AW4'), m = p && p.measured;
  check('AW4 is recorded, and it FAILED', p && p.outcome === 'FAILED');
  check('   the floor stays at nine at both non-zero carry-ins, which is the first of '
    + 'the two routes its own risk line named',
    m && m.floor_plus === 9 && m.floor_minus === 9 && m.registered_floor === 8);
  check('   and it did not drop below eight, so F2 is not overturned',
    m && m.floor_plus > 8 && m.floor_minus > 8);
  check('   and the carry-in-0 floor is nine, measured in THIS run rather than quoted '
    + 'from E4',
    m && m.floor_carry_in_0 === 9);
  check('   so the maximum saving is four positions, 1 through 4, and 13 - 4 = 9 is '
    + 'the floor the corrected rule implies',
    m && 13 - 4 === m.floor_plus);
}

console.log('\n=== 5. THE MECHANISM, AND THE CONTROL THAT GIVES IT POWER ===');
{
  // The zero is the headline and the control is what makes it a measurement. Run
  // here rather than read from the manifest: it costs a fraction of a second, and a
  // check that only compares two recorded numbers to each other cannot notice the
  // instrument breaking.
  const dec = new D.Net(); D.dRippleAdder(dec, 6);
  const P = NP.pack(dec, A.TERN_IN);
  const watch = ['c1', 'c2'];
  const ids = watch.map(nm => NP.nodeId(P, nm));
  const arrivalOf = (ins, nm) => A.arrivalProfile(P, ids, watch, ins)[nm];

  let q0 = 0, early0 = 0, at0 = new Set();
  for (const cin of [1, -1]) {
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const qualifies = T.shiftRight(a + b + cin, 1) === T.shiftRight(a + b, 1);
        const ins = A.ternInputs(0, 0, cin); ins.a0 = a; ins.b0 = b;
        const k = arrivalOf(ins, 'c1');
        at0.add(k);
        if (qualifies) { q0++; if (k < 2) early0++; }
      }
    }
  }
  check('at position 0, over the same eighteen combinations F2 used, twelve satisfy '
    + 'F\'s condition and c1 is determined at pass 2 in every one',
    q0 === 12 && at0.size === 1 && [...at0][0] === 2, `arrivals ${[...at0]}`);
  check('   so none of the twelve arrives early: the saving does not HAPPEN, rather '
    + 'than happening and costing nothing the way F2 found at the top position',
    early0 === 0);

  let q1 = 0, early1 = 0; const whenQ = new Set(), whenNot = new Set();
  for (const c1 of [1, -1]) {
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const qualifies = T.shiftRight(a + b + c1, 1) === T.shiftRight(a + b, 1);
        const ins = A.ternInputs(0, 0, 0);
        ins.a0 = c1; ins.b0 = c1; ins.a1 = a; ins.b1 = b;
        const k = arrivalOf(ins, 'c2');
        if (qualifies) { q1++; whenQ.add(k); if (k < 4) early1++; } else whenNot.add(k);
      }
    }
  }
  // THE CONTROL. Without it the zero above is a zero-power check: an instrument that
  // cannot see an early arrival anywhere reports exactly the same thing, and reads as
  // a clean mechanistic finding. This is that check pointed one position up, where the
  // rule says the saving IS real, and it has to MOVE.
  check('THE CONTROL: the same instrument one position up sees the saving — c2 arrives '
    + 'at pass 3 on all twelve qualifying combinations and at pass 4 on the six that '
    + 'do not',
    q1 === 12 && early1 === 12
    && JSON.stringify([...whenQ]) === '[3]' && JSON.stringify([...whenNot]) === '[4]',
    `qualifying ${[...whenQ]}, not ${[...whenNot]}`);
  check('   so the arrival instrument varies with the thing it is measuring, and the '
    + 'zero at position 0 is a fact about the boundary cell rather than about the check',
    early0 === 0 && early1 > 0);

  // AND THE QUANTITY THAT DECIDES IT, rather than the one that merely reports it. An
  // early leaf is usable only if the selectors above it — gated by the OPERAND
  // detectors — have already resolved, so what matters is the GAP between those and
  // the carry's own detector. It is 0 at the boundary and 2 one position up.
  const m1 = of('AW1') && of('AW1').measured;
  check('the mechanism is measured, not argued: the carry-in\'s detector resolves on the '
    + 'SAME pass as the operand detectors at position 0, and two passes after them at '
    + 'position 1',
    m1 && JSON.stringify(m1.position0_detector_gap) === '[0]'
    && JSON.stringify(m1.position1_detector_gap) === '[2]',
    m1 && `${JSON.stringify(m1.position0_detector_gap)} / ${JSON.stringify(m1.position1_detector_gap)}`);
  check('   and that gap is what the manifest records, recomputed here from the nodes',
    (() => {
      const names = ['cin$im', 'a0$im', 'b0$im', 'c1$im', 'a1$im', 'b1$im'];
      const nid = names.map(nm => NP.nodeId(P, nm));
      const at = A.arrivalProfile(P, nid, names, A.ternInputs(0, 0, 1));
      const ins1 = A.ternInputs(0, 0, 0); ins1.a0 = 1; ins1.b0 = 1;
      const at1 = A.arrivalProfile(P, nid, names, ins1);
      return at['cin$im'] - Math.max(at['a0$im'], at['b0$im']) === 0
        && at1['c1$im'] - Math.max(at1['a1$im'], at1['b1$im']) === 2;
    })());
}

console.log('\n=== 6. WHAT WAS MEASURED AND NOT REGISTERED ===');
{
  const ids = ['F-POSITION-ZERO-NEVER-SAVES', 'F-CARRY-IN-SWEEPS-CLOSED',
    'F-RESTORE-VARIANTS-EXHAUSTIVE', 'F-BINARY-ADDER-EXHAUSTIVE'];
  check('the four closures are recorded as MEASURED_NOT_REGISTERED, not folded into '
    + 'the registered set',
    ids.every(id => F(id) && F(id).outcome === 'MEASURED_NOT_REGISTERED'),
    ids.filter(id => !F(id)).join(' '));

  const closed = F('F-CARRY-IN-SWEEPS-CLOSED');
  check('   the sampled corners they close are named by the id that disclosed them, '
    + 'and every one of those samples is on the record as a sample',
    closed && /Y1/.test(closed.claim + closed.argument)
    && /E1/.test(closed.claim + closed.argument));
  check('   and the strides they replace are the ones those sets recorded — 11 for the '
    + 'ternary sweeps, 37 for the binary one, read from the manifest not typed here',
    (() => {
      const y1 = MANIFEST.prediction_sets.find(s => s.id === 'Y')
        .predictions.find(p => p.id === 'Y1').measured;
      const z4 = MANIFEST.prediction_sets.find(s => s.id === 'Z')
        .predictions.find(p => p.id === 'Z4').measured;
      return y1.sampling_stride === 11 && z4.sampling_stride_ternary === 11
        && z4.sampling_stride_binary === 37;
    })());

  const bin = F('F-BINARY-ADDER-EXHAUSTIVE');
  check('   the binary sweep really is every pair of a ten-bit adder',
    bin && bin.evidence && /1,048,576|1048576/.test(JSON.stringify(bin)));

  const zero = F('F-POSITION-ZERO-NEVER-SAVES');
  check('   and the repair AW1\'s failure taught is recorded as a finding rather than '
    + 'as a prediction of this set, because it is F\'s rule unchanged',
    zero && zero.outcome === 'MEASURED_NOT_REGISTERED'
    && /boundary/i.test(zero.claim + zero.argument)
    && /no amendment/i.test(zero.claim));
}

console.log('\n=== 7. THE MANIFEST AGAINST THE RUN ===');
{
  check('all four predictions are recorded, and all four failed',
    AW && AW.predictions.length === 4
    && AW.predictions.every(p => p.outcome === 'FAILED'));
  check('   and every one carries an at_risk line, since AW is bound by the convention',
    AW && AW.predictions.every(p => typeof p.at_risk === 'string' && p.at_risk.length > 60));
  check('   the tool and the test the manifest names are these files',
    AW && AW.tool === 'tools/carryin-audit.js' && AW.asserted_in === 'test/test-carryin.js');
  // Read defensively rather than dereferenced: between the results commit and the
  // manifest commit there is no `AW` entry, and a suite that CRASHES in that window
  // says nothing, where one that fails says exactly which step has not happened yet.
  const g = (of('AW1') || { measured: {} }).measured.gate;
  check('   and the gate AV built was re-run on this branch before any of it was read',
    !!g && g.networks === 128 && g.node_values === 313697 && g.divergences === 0);
  check('   including on the module that actually did the sweeping, not only the stock '
    + 'one — an instrument proved on one branch is not proved on this one, and a '
    + 'module with a fifth function in it is not the module without it',
    !!g && g.modules_gated === 2);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
