'use strict';
/* test-solver.js — what does the packed representation buy a switch-level solver,
 * and what does WebAssembly buy on top of it?
 *
 * Set `AV`. Say which check here is the one worth keeping, and why — usually the
 * prediction that failed, because that is where this corpus has learned most.
 *
 * SECTION 0 IS NOT OPTIONAL HERE. This set times three solvers against each other,
 * and a ratio between two solvers that disagree is a fact about neither. R1 and R2
 * must be held against R0 — exhaustively on every small builder, on all 27 input
 * triples of both adder cells, and on a network that does NOT settle, so the
 * throw-at-the-cap bound is compared and not just the levels — before any number
 * below is read as a measurement.
 *
 * The exhaustive version is `npm run audit:solver`.
 */

const A = require('../tools/solver-audit.js');
const D = require('../src/device.js');
const NP = require('../src/netpack.js');
const W = require('../src/wasm-emit.js');
const SW = require('../src/solver-wasm.js');
const T = require('../src/ternary.js');
const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

// R2 is a WebAssembly module and `WebAssembly.instantiate` is a promise, so the
// suite is one async function rather than a script. Nothing below awaits anything
// per solve: the instance is built once, up here, and every adapter over it is
// synchronous.
async function main() {
await A.makeR2();

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // 0a. The construction is the one the registration described. A set whose subject
  // is not the subject it cites is measuring something nobody registered.
  //
  // Read out of the registration TEXT rather than typed here, so the benchmark and
  // the sentence that fixed it cannot drift apart: the docstring is frozen, and a
  // constant below it that stopped matching would be a set measuring one thing and
  // claiming another.
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'tools', 'solver-audit.js'), 'utf8');
  const registered = SRC.slice(0, SRC.indexOf(' * Run:  npm run audit:solver'));
  const sampleSize = Number(/first ([\d,]+) operand pairs/.exec(registered)[1].replace(/,/g, ''));
  check('the benchmark is the sample size the registration fixed',
    A.BENCH_PAIRS === sampleSize, `tool ${A.BENCH_PAIRS}, registration ${sampleSize}`);
  check('   and the repetition count is "median of five, discarding the first"',
    /median of five repetitions, discarding the first/.test(registered) && A.BENCH_REPS === 6,
    `BENCH_REPS is ${A.BENCH_REPS}; five kept plus one warm-up is six`);
  check('   and the benchmark network is the one the registration named',
    /tRippleAdder\(net, 6, false\)/.test(registered)
    && A.ADDER_IN.join(',') === 'a0,a1,a2,a3,a4,a5,b0,b1,b2,b3,b4,b5,cin');
  // The registration promises three implementations and all three now exist.
  check('   R1 is src/netpack.js and R2 is src/solver-wasm.js, both present',
    typeof NP.solvePacked === 'function' && typeof SW.makeR2 === 'function'
    && typeof A.R2 === 'function');
  // AND R0 IS UNTOUCHED, which is a claim about the DIFF and not about the file
  // existing. `design/13-instrument.md` says the oracle is never optimised: a
  // faster solver that edits the thing it is checked against has removed its own
  // check. Asked of git rather than asserted, and fail-closed -- a git error is a
  // failure here, not a pass, because an unanswerable question is not a yes.
  {
    let verdict = 'git did not answer';
    try {
      const base = execFileSync('git', ['merge-base', 'main', 'HEAD'],
        { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim();
      const changed = execFileSync('git', ['diff', '--name-only', base, '--', 'src/device.js'],
        { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim();
      verdict = changed === '' ? true : `this branch edited ${changed}`;
    } catch (e) { verdict = `git: ${e.message.split(String.fromCharCode(10))[0]}`; }
    check('   and R0 is src/device.js UNCHANGED by this branch, asked of git',
      verdict === true, String(verdict));
  }
  // The oracle also does not depend on what it certifies. A device.js that
  // imported the packed solver would be checking one implementation against
  // itself, and nothing about the file's mtime would show it.
  check('   and the oracle imports neither of the solvers it certifies',
    !/require\(['"]\.\/(netpack|solver-wasm)/.test(
      fs.readFileSync(path.join(__dirname, '..', 'src', 'device.js'), 'utf8')));

  // 0b. THE TOOL AS IT IS ACTUALLY RUN. T-TOOL-CHECKED-ONLY-BY-IMPORT: importing a
  // tool sets MAIN false, so every log line is skipped and a fault in the report path
  // stays invisible to a suite that only imports. Run the real thing.
  //
  // `--quick` shrinks the SAMPLE and nothing else: every print path below runs,
  // including the four verdict sections, so the run path is covered without this
  // check costing the audit's own minutes. The tool says so in its first four lines.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'solver-audit.js'), '--quick'],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('SOLVER AUDIT') && out.includes('AV1'));
  check('   and its four verdict sections all print, not just the first',
    ['AV1', 'AV2', 'AV3', 'AV4'].every(id => out.includes(`--- ${id} `)));
  check('   and a quick run says on its face that it is not a measurement',
    /QUICK MODE/.test(out) && /NOTHING BELOW IS A MEASUREMENT/.test(out));

  // 0c. Check the pipeline against a case whose answer is known independently.
  //
  // HAND-COMPUTED FIRST. `tmin` builds eight devices over nine nodes: three rails,
  // two inputs, and the four nodes the builder names (`o`, `o$hi`, `o$m1`, `o$m2`).
  // If the packer disagrees with that count it is not lowering the network it was
  // handed, and every comparison below would be between two different circuits.
  {
    const net = new D.Net(); D.tmin(net, 'a', 'b', 'o');
    const P = NP.pack(net, ['a', 'b']);
    check('the packer lowers tmin to 9 nodes and 8 devices, counted by hand',
      P.nodeCount === 9 && P.deviceCount === 8, `${P.nodeCount} nodes, ${P.deviceCount} devices`);
    check('   with the three rails driven, the two inputs driven, and the other four not',
      [...P.driven].join('') === '111110000'
      && P.railNames.join(',') === 'vss,vmid,vdd');
    // The adjacency is the same edge set R0 walks, counted the same way: two
    // directed edges per device.
    check('   and CSR adjacency holds two directed edges per device',
      P.adjNode.length === 2 * P.deviceCount
      && P.adjStart[P.nodeCount] === 2 * P.deviceCount);
  }
  // AND AGAINST AN ANSWER FROM OUTSIDE THE SWITCH MODEL. The adder cell's 27 rows
  // are `T.add`'s, which is where every other arithmetic check in this repository
  // is written. This is one CELL, not the six-trit sweep: the exhaustive sweeps are
  // the later set and running them here would be measuring with an instrument this
  // section has not finished calibrating.
  {
    const net = new D.Net(); D.tAdderCell(net, 'a', 'b', 'cin', 's', 'co', 'A');
    const P = NP.pack(net, ['a', 'b', 'cin']);
    let wrong = 0;
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const cin of [-1, 0, 1]) {
      const v = NP.solveNamed(P, { a, b, cin });
      const raw = a + b + cin;
      const carry = Math.sign(raw) * Math.round(Math.abs(raw) / 3);
      if (v.s !== raw - 3 * carry || v.co !== carry) wrong++;
    }
    check('R1 computes the full-adder cell T.add says it should, on all 27 triples',
      wrong === 0, `${wrong} of 27 wrong`);
  }

  // 0d. AND THE COMPARATOR HAS TO BE ABLE TO FAIL. Five mutants, each breaking a
  // DIFFERENT channel the gate is supposed to watch, because a gate that only ever
  // compared levels would pass a solver that never refuses, and a gate that never
  // seeded would pass one that ignores `init` — and both of those are ports this
  // plan explicitly warned about.
  {
    const caught = {};
    const bust = (name, solve) => {
      const g = A.runGate(solve, { stopAfterDiffs: 1 });
      caught[name] = g.diffs.length;
    };
    // one value wrong, everything else right
    bust('a single node value', (net, ins, inputs, cap, init) => {
      const v = A.R1(net, ins, inputs, cap, init);
      const k = Object.keys(v).find(n => v[n] === 'Z' || v[n] === 'X' || v[n] === 0);
      if (k !== undefined) v[k] = v[k] === 1 ? -1 : 1;
      return v;
    });
    // never refuses: hands back the half-settled state instead of the bound
    bust('a solver that never refuses', (net, ins, inputs, cap, init) => {
      try { return A.R1(net, ins, inputs, cap, init); } catch (e) { return A.R1(net, ins, inputs, 4096, init); }
    });
    // drops the seed, which is the port this design doc warned about by name
    bust('a solver that ignores init', (net, ins, inputs, cap, init) => A.R1(net, ins, inputs, cap, {}));
    // accepts a seed R0 refuses
    bust('a solver that accepts an illegal init', (net, ins, inputs, cap, init) => {
      try { return A.R1(net, ins, inputs, cap, init); } catch (e) {
        if (/^init names/.test(e.message)) return A.R1(net, ins, inputs, cap, {});
        throw e;
      }
    });
    // a genuinely different circuit: one device's threshold moved
    {
      const clones = new Map();
      bust('a circuit with one threshold moved', (net, ins, inputs, cap, init) => {
        let c = clones.get(net);
        if (!c) {
          c = new D.Net(net.rails);
          c.devices = net.devices.map((d, i) => (i === 0 ? { ...d, vt: d.vt === 1 ? -1 : d.vt + 1 } : d));
          clones.set(net, c);
        }
        return A.R1(c, ins, inputs, cap, init);
      });
    }
    for (const [what, n] of Object.entries(caught)) {
      check(`   the gate catches ${what}`, n > 0, 'the mutant passed');
    }
  }

  // 0d2. THE EMITTER, BEFORE THE SOLVER IT EMITS. A validation error inside a
  // four-hundred-line function says nothing about where the fault is, so the
  // encoder is checked against hand-computed bytes and a two-line module first.
  //
  // THE TRAP THIS IS WATCHING: sizes, indices and local counts are UNSIGNED
  // LEB128 and `i32.const` is SIGNED. The two agree from 0 to 63 and diverge at
  // 64, so a module correct on every small constant fails on the first one past
  // 63 — and fails as a validation error far from the constant that caused it.
  {
    const hex = a => a.map(b => b.toString(16).padStart(2, '0')).join(' ');
    const U = { 0: '00', 63: '3f', 64: '40', 127: '7f', 128: '80 01', 300: 'ac 02' };
    const S = { 0: '00', 63: '3f', 64: 'c0 00', 127: 'ff 00', '-1': '7f', '-64': '40', '-65': 'bf 7f' };
    check('unsigned LEB128 matches hand-computed bytes either side of every boundary',
      Object.entries(U).every(([n, want]) => hex(W.uleb(Number(n))) === want),
      Object.keys(U).map(n => `${n}=${hex(W.uleb(Number(n)))}`).join(' '));
    check('   and signed LEB128 does too, including the negatives that only it can spell',
      Object.entries(S).every(([n, want]) => hex(W.sleb(Number(n))) === want),
      Object.keys(S).map(n => `${n}=${hex(W.sleb(Number(n)))}`).join(' '));
    check('   and the two AGREE below 64 and DIVERGE at it, which is the whole trap',
      [0, 1, 62, 63].every(n => hex(W.uleb(n)) === hex(W.sleb(n)))
      && hex(W.uleb(64)) !== hex(W.sleb(64)) && hex(W.uleb(127)) !== hex(W.sleb(127)));
    const demo = W.demoAddModule();
    check('the emitter produces a module that validates and computes a known answer',
      WebAssembly.validate(demo));
    const inst = new WebAssembly.Instance(new WebAssembly.Module(demo), {});
    check('   add(2, 3) is 5, and a constant either side of the LEB boundary survives',
      inst.exports.add(2, 3) === 5 && inst.exports.boundaries(0) === 136
      && inst.exports.boundaries(-136) === 0);
    check('the solver module validates before anything is asked of it',
      WebAssembly.validate(SW.moduleBytes()));
    // No committed binary, no base64, no toolchain: the bytes are built here.
    check('   and its bytes are emitted at run time rather than read from disk',
      SW.moduleBytes().length > 0 && !fs.existsSync(path.join(__dirname, '..', 'src', 'solver.wasm')));
    check('   and R2 answers through WebAssembly rather than through a fallback',
      (await A.makeR2()).exports.solve instanceof Function
      && WebAssembly.Module.exports(new WebAssembly.Module(SW.moduleBytes()))
        .map(e => `${e.name}:${e.kind}`).sort().join(' ')
        === 'memory:memory seedCodes:function solve:function sweep:function');
  }

  // 0d3. AND A MUTANT MODULE, so the gate's power over R2 is demonstrated on the
  // MODULE and not only on the JavaScript adapter over it. The substitution is one
  // function of the four: a `solve` that always answers "settled". That is the
  // exact port `design/13-instrument.md` warns about — one that returns a
  // half-settled state instead of reporting the bound, and that "agrees with it on
  // the easy cases". Every level in the corpus still matches; the bound does not.
  {
    const fns = SW.FUNCS.map(f => (f.name === 'solve'
      ? W.fn('solve', { params: ['maxIter'], results: ['i32'], body: [W.ret(W.konst(1))] })
      : f));
    const broken = await SW.makeR2({ fns });
    const solve = (net, ins, inputs, cap, init) =>
      broken.solveNamed(A.packedFor(net, ins), inputs, cap, init);
    const g = A.runGate(solve, { stopAfterDiffs: 1 });
    check('   the gate catches a MODULE that never reports the cap',
      g.diffs.length > 0, 'the mutant module passed');
    const p = A.passAgreement(solve);
    check('   and the pass-count comparison catches it too, independently',
      p.bad.length > 0, 'the mutant module matched every pass count');
  }

  // 0e. THE GATE ITSELF. R1 and R2 against R0 over every network the corpus
  // builds, and the AV1 ablation against R0 over the same corpus — an ablation
  // nobody held against the oracle would put AV1's number on a solver that
  // computes something else.
  const gates = {};
  for (const [name, solve] of [['R0abl', A.R0ABL], ['R1', A.R1], ['R2', A.R2]]) {
    gates[name] = A.runGate(solve);
  }
  for (const name of ['R0abl', 'R1', 'R2']) {
    const g = gates[name];
    check(`${name} agrees with R0 on every node value in the corpus`,
      g.diffs.length === 0, g.diffs.slice(0, 3).join(' | '));
  }
  // and the corpus is big enough and varied enough to mean something
  {
    const g = gates.R1;
    check('   over more than a hundred networks and a hundred thousand node values',
      g.groups > 100 && g.values > 100000, `${g.groups} networks, ${g.values} values`);
    // A GATE THAT NEVER SAW AN X CANNOT HAVE CHECKED HOW X IS HANDLED. Unknown
    // conduction poisoning what it reaches (D6) and isolation reading Z (N5) are
    // the two rules a port drops silently, and both are invisible to a corpus of
    // well-behaved gates whose every node lands on a level.
    check('   and R0 produced all five node states along the way, not just the three levels',
      ['Z', 'X', -1, 0, 1].every(s => g.coverage.has(s)),
      `saw ${[...g.coverage].map(s => JSON.stringify(s)).join(' ')}`);
    check('   and both of R0\'s refusals about init were reproduced, not just its answers',
      g.threwBoth > 0, `${g.threwBoth} refusals matched`);
  }

  // 0f. THE BOUND, NOT JUST THE LEVELS. `fullSweep` learns a pass count by solving
  // at k, solving again at k-1 and catching the throw, so "did not settle within k"
  // is a measurement this instrument has to reproduce exactly. R0 finds each k ONCE;
  // the subject is then checked at k and at k-1 (T-SEARCH-WHERE-A-CHECK-WOULD-DO).
  for (const [name, solve] of [['R0abl', A.R0ABL], ['R1', A.R1], ['R2', A.R2]]) {
    const p = A.passAgreement(solve);
    check(`${name} stops on exactly the pass R0 stops on, and not one earlier`,
      p.bad.length === 0, p.bad.slice(0, 3).join(' | '));
    if (name === 'R2') {
      check('   including networks that NEVER settle, compared at the cap rather than by level',
        p.never >= 2 && p.settles > 100, `${p.never} never-settling, ${p.settles} settling`);
    }
  }

  // 0f2. AND THE SWEEP, WHICH IS A SECOND ENTRY INTO THE SAME LOOP. R2's gate
  // above seeds through `netpack.js` and copies the state in, so it never touches
  // the module's own `seedCodes` — and `seedCodes` is what every timed pair goes
  // through. An entry point the gate does not reach is an entry point nobody
  // checked, and it is the one the benchmark measures.
  {
    const nets = [
      ['tRippleAdder n=6', () => D.tRippleAdder(new D.Net(), 6, false), 6],
      ['tRippleAdder n=6 leafmid', () => D.tRippleAdder(new D.Net(), 6, { restore: 'leafmid' }), 6],
      ['tRippleAdder n=2', () => D.tRippleAdder(new D.Net(), 2), 2],
    ];
    const inst = await A.makeR2();
    const bad = [];
    for (const [label, make, width] of nets) {
      const names = [...Array.from({ length: width }, (_, i) => `a${i}`),
        ...Array.from({ length: width }, (_, i) => `b${i}`), 'cin'];
      const P = NP.pack(make(), names);
      const lim = Math.pow(3, width) >> 1;
      const pairs = [];
      for (let a = -lim; a <= lim; a += 37) for (let b = -lim; b <= lim; b += 53) pairs.push([a, b]);
      const codes = A.pairCodes(P, pairs);
      const outIds = Int32Array.from(A.OUTS.slice(0, width).concat([`c${width}`])
        .map(nm => NP.nodeId(P, nm)));
      const o1 = new Uint8Array(pairs.length * outIds.length);
      const o2 = new Uint8Array(pairs.length * outIds.length);
      const u1 = NP.sweepPacked(P, codes, pairs.length, outIds, o1, 64);
      const u2 = inst.sweep(P, codes, pairs.length, outIds, o2, 64);
      if (u1 !== 0 || u2 !== 0) bad.push(`${label}: ${u1}/${u2} pairs did not settle`);
      for (let i = 0; i < o1.length; i++) if (o1[i] !== o2[i]) { bad.push(`${label}: byte ${i}`); break; }
      // and one solve against R0 on the same block, so neither sweep is being
      // compared only against the other
      const r0 = make().solve(Object.fromEntries(names.map((nm, j) =>
        [nm, codes[j] - 3])), 64);
      for (let j = 0; j < outIds.length; j++) {
        const want = r0[P.names[outIds[j]]];
        if (o1[j] !== (want === 'Z' ? 0 : want === 'X' ? 1 : want + 3)) bad.push(`${label}: R0 disagrees at out ${j}`);
      }
    }
    check('R2\'s in-module sweep agrees with R1\'s, and both with R0, on three networks',
      bad.length === 0, bad.slice(0, 3).join(' | '));
    // the mutation control: a sweep whose codes are shifted must NOT agree
    {
      const P = NP.pack(D.tRippleAdder(new D.Net(), 2), A.ADDER_IN.slice(0, 2)
        .concat(A.ADDER_IN.slice(6, 8), ['cin']));
      const pairs = [[-4, 3], [0, 0], [4, -2]];
      const codes = A.pairCodes(P, pairs);
      const outIds = Int32Array.from(['s0', 's1', 'c2'].map(nm => NP.nodeId(P, nm)));
      const o1 = new Uint8Array(pairs.length * 3), o2 = new Uint8Array(pairs.length * 3);
      NP.sweepPacked(P, codes, pairs.length, outIds, o1, 64);
      const shifted = Uint8Array.from(codes); shifted[0] = shifted[0] === 4 ? 2 : shifted[0] + 1;
      inst.sweep(P, shifted, pairs.length, outIds, o2, 64);
      check('   and the comparison notices when one operand trit is moved',
        o1.some((v, i) => v !== o2[i]));
    }
  }

  // 0g. N8 EXPLICITLY, because the design doc names it as the way a packed form
  // silently drops an axiom. The initial state is part of the semantics: the
  // self-inverter holds at MID when seeded there, oscillates forever when seeded at
  // a level, and lands on X from the all-Z start — three different answers from one
  // circuit, and a representation that cannot seed an arbitrary non-driven node to
  // an arbitrary one of the five states cannot tell them apart.
  {
    const net = new D.Net(); D.sti(net, 'o', 'o');
    const P = NP.pack(net, []);
    const seeded = seed => {
      try { return NP.solveNamed(P, {}, 64, seed).o; } catch (e) { return 'REFUSED'; }
    };
    check('R1 reproduces all three of the self-inverter\'s outcomes, seed by seed',
      seeded({}) === 'X'
      && seeded({ o: 0, 'o$mid': 'Z' }) === 0
      && seeded({ o: -1, 'o$mid': 'Z' }) === 'REFUSED'
      && seeded({ o: 1, 'o$mid': 'Z' }) === 'REFUSED');
    check('   and the packed form can seed a non-driven node to any of the five states',
      ['Z', 'X', -1, 0, 1].every(s => {
        try { NP.solveNamed(P, {}, 64, { o: s, 'o$mid': 'Z' }); return true; }
        catch (e) { return /did not settle/.test(e.message); }
      }));
    // and it refuses what R0 refuses, for the reason R0 gives
    const refuse = init => { try { NP.solveNamed(P, {}, 64, init); return null; } catch (e) { return e.message; } };
    check('   and it refuses a seed on a rail and a seed on a name no device mentions',
      /^init names a driven node: vss$/.test(refuse({ vss: 1 }))
      && /^init names a node no device mentions: nope$/.test(refuse({ nope: 0 })));
    // R2 answers the same three, through its own path. It inherits the seeding and
    // the refusals from `netpack.js` deliberately -- a second implementation of
    // them would be a second thing to disagree -- and that inheritance is the
    // claim being checked, not assumed.
    const inst = await A.makeR2();
    const wasm = seed => {
      try { return inst.solveNamed(P, {}, 64, seed).o; } catch (e) { return 'REFUSED'; }
    };
    check('   and R2 gives the same three answers to the same three seeds',
      wasm({}) === 'X' && wasm({ o: 0, 'o$mid': 'Z' }) === 0
      && wasm({ o: -1, 'o$mid': 'Z' }) === 'REFUSED'
      && wasm({ o: 1, 'o$mid': 'Z' }) === 'REFUSED');
  }

  // 0h. The packed form is stricter than R0 in exactly one way, and it says so
  // rather than resolving a solve against a driven mask built for other names.
  {
    const net = new D.Net(); D.tmin(net, 'a', 'b', 'o');
    const P = NP.pack(net, ['a', 'b']);
    let threw = false;
    try { NP.solvePacked(P, { a: 1 }); } catch (e) { threw = /packed for inputs/.test(e.message); }
    check('a packed net refuses a solve whose input names are not the ones it was packed for',
      threw);
  }

  // 0i. AND THE PLAN'S OWN TABLE, PINNED. `design/13-instrument.md` opens with the
  // five networks this instrument exists to afford, and it lists the last thing
  // that could stop it as "a number in this file rots": those switch and pass
  // counts are recomputable and nothing recomputed them. `test-budget.js` pins
  // `12-roadmap.md` the same way, and the roadmap has not drifted since.
  //
  // The counts are read OUT of the document and recomputed here, so this fails on
  // the document changing as well as on the builders changing. Pass counts are
  // CHECKED, never searched: the table supplies k, and the network is solved twice
  // — at k, where it must settle, and at k-1, where it must not.
  {
    const doc = fs.readFileSync(path.join(__dirname, '..', 'design', '13-instrument.md'), 'utf8');
    const BUILD = {
      '6-trit ripple adder, tree (`restore: none`)':
        [() => D.tRippleAdder(new D.Net(), 6, false), 6, [-1, 0, 1]],
      '6-trit ripple adder, decoded':
        [() => D.dRippleAdder(new D.Net(), 6), 6, [-1, 0, 1]],
      '6-trit ripple adder, `restore: mid`':
        [() => D.tRippleAdder(new D.Net(), 6, { restore: 'mid' }), 6, [-1, 0, 1]],
      '6-trit ripple adder, `restore: leafmid`':
        [() => D.tRippleAdder(new D.Net(), 6, { restore: 'leafmid' }), 6, [-1, 0, 1]],
      '10-bit binary ripple adder':
        [() => D.bRippleAdder(D.binaryNet(), 10), 10, [-1, 1]],
    };
    const rows = [...doc.matchAll(/^\| (.+?) \| (\d+) \| (\d+|—) \|/gm)]
      .map(m => [m[1], Number(m[2]), m[3] === '—' ? null : Number(m[3])]);
    check('the plan\'s table has a row for each of the five networks it names',
      rows.length === 5 && rows.every(r => BUILD[r[0]] !== undefined),
      rows.map(r => r[0]).join(' / '));
    const wrongCost = [], wrongPasses = [];
    for (const [label, switches, passes] of rows) {
      const [make, width, levels] = BUILD[label] || [];
      if (!make) continue;
      const net = make();
      if (net.cost().switches !== switches) wrongCost.push(`${label}: ${net.cost().switches} not ${switches}`);
      if (passes === null) continue;
      // Two operand pairs, not one: no carry at all, and a carry that crosses every
      // position. `Z5` measured these counts independent of the data and this would
      // notice if that stopped being true here.
      const at = (v, k) => Object.fromEntries(Array.from({ length: width },
        (_, i) => [v + i, levels.length === 3 ? T.toTrits(k, width)[i] : (((k >> i) & 1) ? 1 : -1)]));
      const pairs = levels.length === 3
        ? [{ ...at('a', 0), ...at('b', 0), cin: 0 }, { ...at('a', 364), ...at('b', 1), cin: 0 }]
        : [{ ...at('a', 0), ...at('b', 0), cin: -1 }, { ...at('a', 1023), ...at('b', 1), cin: -1 }];
      for (const inputs of pairs) {
        const settles = k => { try { net.solve(inputs, k); return true; } catch (e) { return false; } };
        if (!settles(passes) || settles(passes - 1)) {
          wrongPasses.push(`${label}: not exactly ${passes}`);
        }
      }
    }
    check('   and every switch count in it is what the builder actually builds',
      wrongCost.length === 0, wrongCost.join(' | '));
    check('   and every pass count in it is reached at k and not at k-1, on two operand pairs',
      wrongPasses.length === 0, wrongPasses.join(' | '));
  }
}

console.log('\n=== 1. AV1  where R0 spends its time ===');
{
  check('AV1 ...', false, 'not yet measured');
}

console.log('\n=== 2. AV2  R1 over R0: what the representation buys ===');
{
  check('AV2 ...', false, 'not yet measured');
}

console.log('\n=== 3. AV3  R2 over R1: what WebAssembly buys ===');
{
  check('AV3 ...', false, 'not yet measured');
}

console.log('\n=== 4. AV4  the same ratio at 2.8x the size ===');
{
  check('AV4 ...', false, 'not yet measured');
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
}

// A rejected promise in a test that exits 0 is a suite reporting success for
// checks that never ran, which is the same defect as a placeholder that passes.
main().catch(e => { console.error(e); process.exit(1); });
