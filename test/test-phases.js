'use strict';
/* test-phases.js — where does R2 actually spend its time, across the three phases of a pass?
 *
 * Set `AX`. THE CHECK HERE WORTH KEEPING IS THE WRITE PROBE in section 0, and
 * specifically the mutant it catches. Three of the four modules this set times
 * compute a wrong answer by construction, so no gate can hold them against anything;
 * the only thing that makes their timings mean what they are reported to mean is that
 * each one really stopped doing the phase it was supposed to stop doing. A variant
 * that silently kept running a phase would be FASTER than the whole pass, would still
 * be slower than the other two, and would report a plausible share — a clean-looking
 * decomposition of a program nobody wrote. "C, R and U are each faster than WHOLE" is
 * no evidence at all, because timing is the thing being measured.
 *
 * So the probe poisons one state region, runs the variant, and reads back what
 * survived: a region the variant must not touch comes back byte-for-byte poisoned,
 * and a region it does write comes back RESTORED to what the full solve produced. It
 * is checked in both directions here — on a mutant that did not stop, which it
 * catches, and on the four real variants, which it passes. A tripwire shown only not
 * firing is a tripwire nobody has seen work.
 *
 * The LESSON worth keeping is that the three shares were never in danger from the
 * decomposition and were nearly lost to the CLOCK. At a fifth of the registered pass
 * block, conduction's share wandered across a range wider than its own distance to
 * the line it was predicted against, and the same machine returned 0.103 and 0.142 on
 * consecutive runs — a prediction graded either way by which run you read.
 * T-CRITERION-IN-THE-NOISE is on the record for exactly that, and the fix available
 * here was not to move the line, which is registered, but to lengthen the timed unit
 * until the line could not flip.
 *
 * The exhaustive version is `npm run audit:phases`.
 */

const A = require('../tools/phases-audit.js');
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
const AX = MANIFEST.prediction_sets.find(s => s.id === 'AX');
const of = id => (AX ? AX.predictions.find(p => p.id === id) : null);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function main() {

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // 0a. The construction is the one the registration described. A set whose subject
  // is not the subject it cites is measuring something nobody registered.
  const band = A.registeredBands();
  check('the bands are read out of the registration, never typed here — a band, a '
    + 'floor, a separation and a tolerance, all four recovered',
    Array.isArray(band.ax1) && band.ax1.length === 2 && band.ax1[0] < band.ax1[1]
    && typeof band.ax2 === 'number' && typeof band.ax3 === 'number'
    && typeof band.ax4 === 'number',
    JSON.stringify(band));

  const part = A.partitionSolve();
  check('   and `solve` really is three sequential phases plus an early exit, sliced '
    + 'out of the emitter\'s own statement tree by the loop variable each one opens',
    A.PHASE_SHAPE.map(x => x[0]).join(' ') === 'conduction reach update exit inc'
    && Object.keys(part.phase).join(' ') === 'conduction reach update exit inc',
    Object.keys(part.phase).join(' '));

  // 0b. THE HARNESS CAN REPORT A FAILURE, and the slicer refuses a shape it does not
  // recognise. `[4]` through `[6]` is the update loop today and something else after
  // the next edit to src/, silently — so the slice is matched, not indexed.
  // A suite whose check() only ever passes reads as coverage and is not. The probe
  // runs the REAL check() with a false condition, output captured so a green run
  // stays green-looking, and then takes the failure back off the list.
  const probed = (() => {
    const out = console.log;
    const lines = [];
    console.log = m => lines.push(m);
    const failsBefore = fails.length, passBefore = pass;
    check('deliberately false', false, 'captured, not printed');
    console.log = out;
    const ok = fails.length === failsBefore + 1 && pass === passBefore
      && /\[FAIL\]/.test(lines[0] || '');
    fails.pop();
    return ok;
  })();
  check('   the harness reports a false check as FAIL, counts it, and counts no pass '
    + 'for it', probed);

  const S = SW.FUNCS[1];
  const reshape = body => ({ ...S, body });
  const lb = S.body[S.body.length - 2].body[0].body;
  const swap = { k: 'block', label: S.body[S.body.length - 2].label,
    body: [{ k: 'loop', label: S.body[S.body.length - 2].body[0].label,
      body: [lb[0], lb[3], lb[4], lb[1], lb[2], ...lb.slice(5)] }] };
  const refuses = f => { try { A.partitionSolve(f); return null; } catch (e) { return e.message; } };
  const swapped = refuses(reshape([...S.body.slice(0, -2), swap, S.body[S.body.length - 1]]));
  const renamed = refuses({ ...S, name: 'notsolve' });
  const truncated = refuses(reshape(S.body.slice(0, -1)));
  check('   and it REFUSES a solve that is not that shape — phases swapped, function '
    + 'renamed, body truncated — rather than slicing whatever is there',
    swapped !== null && renamed !== null && truncated !== null
    && /opens r, not i/.test(swapped),
    `${swapped} | ${renamed} | ${truncated}`);

  // 0c. The four modules, and the claim that only the substituted function moved.
  const alg = A.byteAlgebra(part);
  check('the four modules come out of ONE IR: prologue and scaffolding are the empty '
    + 'variant exactly, so the phase byte-runs are an exact split of the body',
    alg.exact_split && alg.lcp + alg.lcs === alg.skeleton,
    `prologue ${alg.lcp} + scaffolding ${alg.lcs} = ${alg.skeleton}`);
  check('   and WHOLE is prologue + conduction + reach + update + scaffolding, byte '
    + 'for byte — no phase was re-encoded when it was timed on its own',
    alg.whole_is_c_r_u,
    JSON.stringify(alg.bytes));
  check('   and the stock `solve` is that same run with the early exit spliced in, '
    + 'which is what makes WHOLE the solver with one statement removed',
    alg.stock_is_c_r_u_exit && alg.stock_is_whole_with_exit);
  check('   the phase runs are disjoint and account for the whole body: the six '
    + 'lengths sum to the stock function\'s own length',
    Object.values(alg.bytes).reduce((a, b) => a + b, 0) === alg.body_bytes.WHOLE_EXIT,
    `${Object.values(alg.bytes).reduce((a, b) => a + b, 0)} vs ${alg.body_bytes.WHOLE_EXIT}`);

  const modules = {};
  for (const k of Object.keys(A.VARIANT_PHASES)) {
    if (k === 'SKELETON') continue;
    modules[k] = SW.moduleBytes(A.fnsFor(A.variantSolve(part, A.VARIANT_PHASES[k])));
  }
  const md = A.moduleDiff(modules);
  check('   and read back off the ASSEMBLED modules rather than off the emitter, only '
    + '`solve` moved: every other function is byte-identical in all four, and so is '
    + 'every section outside the code section',
    md.only_solve_moved
    && A.TIMED.filter(v => v !== 'WHOLE').every(v => md.rows[v].differs.join() === 'solve')
    && md.rows.WHOLE.differs.length === 0
    && md.section_ids_agree && md.non_code_sections_identical,
    JSON.stringify(md.rows.C));
  check('   which is not the same as saying nothing changed: each ablated variant\'s '
    + '`solve` DIFFERS from WHOLE\'s, so the substitution did something',
    A.TIMED.filter(v => v !== 'WHOLE').every(v => md.rows[v].differs.includes('solve')));

  // 0d. AV's four functions are untouched. `moduleBytes()` with no argument must still
  // emit what AV timed — test-solver.js pins that length, so a change here goes red
  // over there too, and this set would be timing a module nobody has measured.
  check('   the stock module is still byte-for-byte what AV timed, and WHOLE with its '
    + 'early exit restored IS that module',
    SW.FUNCS.length === 4
    && A.sameBytes(SW.moduleBytes(A.fnsFor(A.variantSolve(part, A.VARIANT_PHASES.WHOLE_EXIT))),
      SW.moduleBytes())
    && WebAssembly.Module.exports(new WebAssembly.Module(SW.moduleBytes()))
      .map(e => `${e.name}:${e.kind}`).sort().join(' ')
      === 'memory:memory seedCodes:function solve:function sweep:function',
    `${SW.moduleBytes().length} bytes`);

  // 0e. AV'S GATE, RE-RUN ON THIS BRANCH. Recomputed here rather than read out of the
  // manifest, because a number this set wrote down is not evidence about this set.
  const g = await A.gateWholeExit();
  const m = of('AX1') && of('AX1').measured;
  check('AV\'s gate, re-run here on WHOLE with its early exit restored: it still '
    + 'agrees with src/device.js everywhere, with ZERO divergences',
    g.divergences === 0 && g.networks > 0 && g.node_values > 0 && g.pass_never_settling > 0,
    `${g.divergences} divergences over ${g.networks} networks, ${g.node_values} node values`);
  check('   and it saw all five states, so it cannot have been clean by never meeting '
    + 'an X or a Z',
    g.states === '"X" "Z" -1 0 1', g.states);
  check('   and the manifest records the gate this run just reproduced',
    m && m.gate_divergences === g.divergences
    && m.gate_networks === g.networks && m.gate_node_values_compared === g.node_values,
    m && `${m.gate_networks}/${m.gate_node_values_compared}`);

  // 0f. THE WRITE PROBE, IN BOTH DIRECTIONS. This is the check the file exists for.
  const wrote = async ph => (await A.probeVariant(ph)).wrote.join(' ');
  const real = { C: await wrote(['conduction']), R: await wrote(['reach']),
    U: await wrote(['update']), WHOLE: await wrote(['conduction', 'reach', 'update']) };
  check('each ablated variant really STOPPED: poison one state region, run the '
    + 'variant, and only the phase\'s own output comes back written',
    real.C === 'cond' && real.R === 'reachDef reachPos' && real.U === 'value'
    && real.WHOLE === 'cond reachDef reachPos value',
    JSON.stringify(real));
  const mutant = await wrote(['conduction', 'reach']);
  const empty = await wrote([]);
  check('   and the probe CATCHES a variant that did not stop: a "conduction only" '
    + 'that still runs the walk is caught writing the reachability bitsets',
    mutant === 'cond reachDef reachPos' && mutant !== real.C,
    mutant);
  check('   and a variant with no phases at all writes nothing, so "wrote" is not '
    + 'something the probe reports for anything it is handed',
    empty === '', empty);
  // The negative control with real traffic: the four variants the audit actually
  // times are the corpus this tripwire must NOT fire on, and it does not.
  check('   the probe is quiet on the four variants the audit times, on BOTH networks '
    + '— the negative control the mutant above cannot supply',
    m && m.write_matrix_as_expected === true);

  // 0g. The seeded state, and the property the whole construction rests on.
  check('the seeded state is a FIXED POINT of every variant: over a full settling '
    + 'count not one byte of linear memory moves, so every pass is the same work',
    m && m.fixed_point_bytes_moved === 0
    && m.whole_recomputes_memory_exactly === true);
  check('   which is what licenses one long call instead of thousands of short ones, '
    + 'and the shares do not move when the pass block is doubled',
    m && m.pass_block_invariance < 0.05, m && String(m.pass_block_invariance));
  // The working set, recomputed from the layout rather than read back out of the
  // manifest: AX4's note leans on both variants and the whole pass fitting the same
  // level of cache, so the size that claim rests on is derived, not estimated.
  check('   and the size that claim rests on is derived from the layout, not estimated '
    + 'in a sentence: a whole loaded network is under twenty kilobytes either way',
    (() => {
      const D = require('../src/device.js'), NP = require('../src/netpack.js');
      const SA = require('../tools/solver-audit.js');
      const memOf = build => {
        const net = new D.Net(); build(net);
        return SW.layout(NP.pack(net, SA.ADDER_IN)).end;
      };
      return m && memOf(n => D.tRippleAdder(n, 6, false)) === m.linear_memory_bytes_tree
        && memOf(n => D.dRippleAdder(n, 6)) === m.linear_memory_bytes_decoded
        && m.linear_memory_bytes_tree < 20480 && m.linear_memory_bytes_decoded < 20480;
    })(),
    m && `${m.linear_memory_bytes_tree} / ${m.linear_memory_bytes_decoded} bytes`);
  check('   and the state is reported rather than assumed: at convergence no device '
    + 'is unknown, so the definite and possible walks traverse the same edges',
    m && m.definite_bitset_equals_possible === true);
  check('   and the pair it was captured from is AV\'s benchmark order rather than one '
    + 'chosen here, recomputed from the tool\'s own constant',
    (() => {
      const b = A.benchInputs(A.PAIR_INDEX);
      return m && m.benchmark_pair_index === A.PAIR_INDEX
        && b.a === m.operand_pair[0] && b.b === m.operand_pair[1];
    })(),
    m && `index ${m.benchmark_pair_index}, pair ${JSON.stringify(m.operand_pair)}`);

  // 0h. THE TOOL AS IT IS ACTUALLY RUN. T-TOOL-CHECKED-ONLY-BY-IMPORT: importing a
  // tool sets MAIN false, so every log line is skipped and a fault in the report path
  // stays invisible to a suite that only imports. Run the real thing.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'phases-audit.js'), '--quick'],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('PHASES AUDIT') && out.includes('AX1') && out.includes('AX4')
    && out.includes('DIVERGENCES: 0') && /QUICK MODE/.test(out));
}

console.log('\n=== 1. AX1  the reachability walk, as a share of the whole ===');
{
  const p = of('AX1'), m = p && p.measured;
  const band = A.registeredBands();
  check('AX1 is recorded, and it HELD', p && p.outcome === 'HELD');
  check('   the reachability walk is the majority of the pass, and its share of the '
    + 'whole lands inside the registered band',
    m && m.share_reach >= band.ax1[0] && m.share_reach <= band.ax1[1],
    m && `${m.share_reach} against [${band.ax1[0]}, ${band.ax1[1]}]`);
  check('   and the share is the ratio the registration fixed — reach\'s median over '
    + 'WHOLE\'s median, not over the sum of the parts',
    m && near(m.share_reach, m.seconds.R / m.seconds.WHOLE, 5e-4),
    m && `${m.share_reach} vs ${(m.seconds.R / m.seconds.WHOLE).toFixed(4)}`);
  check('   it is a majority on its own terms: reach costs more than conduction and '
    + 'the update loop together',
    m && m.seconds.R > m.seconds.C + m.seconds.U,
    m && `${m.seconds.R} vs ${(m.seconds.C + m.seconds.U).toFixed(5)}`);
  check('   and every one of the further runs of the whole audit, each in its own '
    + 'process, puts it in the same place — the verdict is not one run\'s luck',
    m && m.share_reach_further_runs.length >= 2
    && m.share_reach_all_runs.every(x => x >= band.ax1[0] && x <= band.ax1[1]),
    m && JSON.stringify(m.share_reach_all_runs));
  // T-CRITERION-IN-THE-NOISE, in the forward direction rather than after the fact.
  // The instrument came nearer to deciding this than the subject did, and the record
  // says so: the short-block runs are kept beside the registered ones.
  check('   AND THE SHORT BLOCK COULD HAVE FLIPPED IT: at a fifth of the registered '
    + 'pass block, one run put reach BELOW the band\'s floor, on the same machine from '
    + 'the same state — which is why the block is the length it is',
    m && m.short_block_runs_below_registered_floor > 0
    && Math.min(...m.short_block_share_reach) < band.ax1[0]
    && m.short_block_passes_per_run * 5 === m.passes_per_run,
    m && `${JSON.stringify(m.short_block_share_reach)} at ${m.short_block_passes_per_run}`);
  check('   and the block length changes the VARIANCE and not the value: on EVERY run, '
    + 'doubling the block moves all three shares by less than a twentieth',
    m && m.pass_block_invariance_all_runs.length === m.independent_runs
    && m.pass_block_invariance_all_runs.every(x => x < 0.05)
    && Math.min(...m.share_reach_all_runs) > Math.min(...m.short_block_share_reach),
    m && JSON.stringify(m.pass_block_invariance_all_runs));
}

console.log('\n=== 2. AX2  conduction, the phase nobody had counted ===');
{
  const p = of('AX2'), m = p && p.measured;
  const band = A.registeredBands();
  check('AX2 is recorded, and it HELD', p && p.outcome === 'HELD');
  check('   conduction is not negligible: its share of the whole clears the '
    + 'registered floor',
    m && m.share_conduction >= band.ax2,
    m && `${m.share_conduction} against ${band.ax2}`);
  check('   and it clears it on every independent run of the whole audit, and on the '
    + 'second network too',
    m && m.share_conduction_all_runs.length >= 3
    && m.share_conduction_all_runs.every(x => x >= band.ax2)
    && m.share_conduction_decoded >= band.ax2,
    m && JSON.stringify(m.share_conduction_all_runs));
  // The margin and the spread are recorded side by side because they are the same
  // order, and the manifest's note says to read the range and not the digit after it.
  // Asserting that the margin is SMALL would be a check that forbids a healthy state,
  // so what is asserted is that both numbers are on the record and agree with the runs.
  check('   the margin over the floor and the spread between runs are both recorded, '
    + 'and both are recomputable from the runs behind them',
    m && m.lowest_margin_over_floor
      === Number((Math.min(...m.share_conduction_all_runs) - band.ax2).toFixed(4))
    && m.spread_between_runs === Number((Math.max(...m.share_conduction_all_runs)
      - Math.min(...m.share_conduction_all_runs)).toFixed(4)),
    m && `margin ${m.lowest_margin_over_floor}, spread ${m.spread_between_runs}`);
  check('   and the short-block runs are kept beside them, so the reader can see what '
    + 'the clock was doing rather than take the medians on trust',
    m && m.short_block_share_conduction.length >= 5
    && m.short_block_passes_per_run * 5 === m.passes_per_run,
    m && JSON.stringify(m.short_block_share_conduction));
  check('   and conduction is the phase that scales with DEVICES: it is the cheapest '
    + 'of the three per pass and still not a rounding error',
    m && m.share_conduction < m.share_update && m.share_conduction < m.share_reach);
}

console.log('\n=== 3. AX3  the same split on a network of a different shape ===');
{
  const p = of('AX3'), m = p && p.measured;
  const band = A.registeredBands();
  check('AX3 is recorded, and it HELD', p && p.outcome === 'HELD');
  check('   the two networks really do differ in shape: the decoded adder does more '
    + 'conduction per node and fewer node updates per device',
    m && m.tree.devices / m.tree.nodes < m.decoded.devices / m.decoded.nodes
    && m.tree.switches !== m.decoded.switches,
    m && `${(m.tree.devices / m.tree.nodes).toFixed(3)} vs `
      + `${(m.decoded.devices / m.decoded.nodes).toFixed(3)} devices per node`);
  check('   and every one of the three shares moves by less than the registered '
    + 'separation between them',
    m && ['conduction', 'reach', 'update'].every(ph =>
      Math.abs(m.decoded[`share_${ph}`] - m.tree[`share_${ph}`]) < band.ax3),
    m && JSON.stringify(['conduction', 'reach', 'update'].map(ph =>
      Number(Math.abs(m.decoded[`share_${ph}`] - m.tree[`share_${ph}`]).toFixed(4)))));
  check('   the widest of those three is what AX3 is scored on, and it is the '
    + 'recorded value',
    m && near(m.widest_separation, Math.max(...['conduction', 'reach', 'update'].map(ph =>
      Math.abs(m.decoded[`share_${ph}`] - m.tree[`share_${ph}`]))), 5e-4)
    && m.widest_separation < band.ax3);
  check('   and the split survives a network whose settling count is different too, '
    + 'so it is not a property of running seven passes',
    m && m.tree.settling_passes !== m.decoded.settling_passes,
    m && `${m.tree.settling_passes} vs ${m.decoded.settling_passes} passes`);
}

console.log('\n=== 4. AX4  and whether the parts sum to the whole ===');
{
  const p = of('AX4'), m = p && p.measured;
  const band = A.registeredBands();
  check('AX4 is recorded, and it HELD', p && p.outcome === 'HELD');
  check('   the decomposition is honest: conduction plus reach plus update sums to '
    + 'within the registered tolerance of the whole pass',
    m && Math.abs(m.share_sum - 1) <= band.ax4,
    m && `${m.share_sum}, apart by ${Math.abs(m.share_sum - 1).toFixed(4)}`);
  check('   and the sum is the sum of the three shares AX1 to AX3 are quoted from, '
    + 'not a separate measurement',
    m && near(m.share_sum, m.share_conduction + m.share_reach + m.share_update, 5e-4));
  check('   it holds on the second network as well, so AX3\'s shares are shares of '
    + 'something that is also the whole there',
    m && Math.abs(m.share_sum_decoded - 1) <= band.ax4,
    m && String(m.share_sum_decoded));
  check('   and it could have failed in both directions and did not: the parts are '
    + 'neither slower in isolation nor faster than they are in situ, by more than '
    + 'the tolerance',
    m && m.share_sum > 1 - band.ax4 && m.share_sum < 1 + band.ax4);
  check('   every run agrees on that, on both networks, which is what a tolerance of '
    + 'this width needs beside it',
    m && m.share_sum_all_runs.every(x => Math.abs(x - 1) <= band.ax4)
    && m.share_sum_decoded_all_runs.every(x => Math.abs(x - 1) <= band.ax4)
    && m.furthest_from_the_whole
       === Number(Math.max(...m.share_sum_all_runs.map(x => Math.abs(x - 1))).toFixed(4)),
    m && JSON.stringify(m.share_sum_all_runs));
}

console.log('\n=== 5. WHAT THIS SET DOES NOT SAY ===');
{
  // The registration lists it under NOT REGISTERED and it stays there. AX1 is one
  // input to an arithmetic about a bitsliced R3; the arithmetic, and whatever it
  // implies, belong to the set that proposes R3.
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'phases-audit.js'), 'utf8');
  check('the tool still disclaims the inference this number invites — what any of '
    + 'this implies for a bitsliced solver belongs to the set that proposes one',
    /What any of this implies for a bitsliced R3/.test(src));
  check('   and no prediction here claims it', AX
    && AX.predictions.every(q => !/bitslic/i.test(q.claim)));
  check('   the four variants are not claimed to AGREE: three of them compute a wrong '
    + 'answer by construction, and only WHOLE-with-its-exit meets the oracle',
    Object.keys(A.WRITES).length === 4
    && A.WRITES.C.length === 1 && A.WRITES.R.length === 2 && A.WRITES.U.length === 1);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
