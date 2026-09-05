/* PHASES AUDIT — where R2 actually spends its time.
 *
 * Set `AX`. `AV1` decomposed the ORACLE by ablation and found the answer its own
 * operation count had argued against: allocation in the update loop is 11.1% of the
 * gap to R1, not the majority. Nothing has ever decomposed R2, and R2 is the solver
 * everything now runs on.
 *
 * The reason to do it before anything else is that it BOUNDS what a faster solver can
 * be worth. A bitsliced R3 would parallelise across operand pairs, and the phase that
 * resists slicing is the reachability walk -- its worklist is a per-lane gather. If
 * that walk is a minority of R2, the ceiling on R3 is set before a single lane is
 * filled. Nobody knows which it is, and a set that measured R3 without this number
 * would be unable to say whether a disappointing result was the technique or the
 * headroom.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * THREE PHASES, NOT TWO. Earlier discussion of this framed it as "reach against the
 * update loop", and reading `solveFn` says otherwise. One pass is three sequential
 * loops with three different trip counts:
 *
 *   CONDUCTION  once per DEVICE. Reads `value`, writes `cond`.
 *   REACH       railCount x 2 calls, each a walk over the CSR. Reads `cond`,
 *               writes `reachDef` / `reachPos`.
 *   UPDATE      once per NODE, each scanning railCount rails twice. Reads the
 *               reachability bitsets, writes `value`, sets `changed`.
 *
 * Conduction has never been named as a cost at all, and it is the one phase that
 * scales with devices rather than nodes.
 *
 * THE ABLATION `AV1` USED DOES NOT TRANSFER, and this is the whole design problem.
 * Removing a phase from R2 corrupts the input of the next: ablate conduction and
 * `cond` goes stale, so REACH traverses a different graph and its cost moves; ablate
 * reach and the bitsets go stale, so UPDATE takes different branches. A subtractive
 * decomposition would measure each phase against a perturbed neighbour and report the
 * perturbation as the phase.
 *
 * SO THE DECOMPOSITION IS ADDITIVE. Four modules are emitted from the same IR by
 * substituting into `FUNCS`, which `solver-wasm.js` exports as a list for exactly this
 * purpose:
 *
 *   WHOLE  all three phases, early exit removed.
 *   C      the conduction loop alone.
 *   R      the reach calls alone.
 *   U      the update loop alone.
 *
 * Each variant is seeded to the SAME realistic state -- captured after a full solve of
 * a real operand pair, so `value`, `cond` and the bitsets all hold values the network
 * actually produces -- and then run for a fixed pass count over that fixed state. No
 * phase evolves the state another phase reads, because each variant is timed in
 * isolation and re-seeded. That is what makes the three numbers comparable.
 *
 * THE EARLY EXIT IS REMOVED FROM EVERY VARIANT INCLUDING WHOLE. `solve` returns as
 * soon as a pass changes nothing, so a variant that never writes `value` would exit on
 * pass one and be timed over a different amount of work. Every variant runs exactly
 * the registered number of passes.
 *
 * FIXED, and not at risk:
 *   - The benchmark is `AV`'s: the unrestored six-trit tree ripple adder,
 *     `tRippleAdder(net, 6, false)`, 624 switches, seven passes. `AX3`'s second
 *     network is the decoded adder, 540 switches, whose node-to-device ratio differs.
 *   - Fixed pass count per timed run, early exit removed, state re-seeded per run.
 *   - Wall-clock median of five repetitions after a discarded warm-up, all variants
 *     interleaved in one process on one machine, as `AV` did. `AV`'s recorded seconds
 *     are from other hardware and are not a baseline for anything here.
 *   - Shares are reported as a fraction of WHOLE, not of the sum of the parts. Which
 *     of those two denominators is used decides `AX4`, so it is fixed here.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 *   AX1 THE REACHABILITY WALK IS THE MAJORITY OF R2, AND ITS SHARE LANDS IN [0.55,
 *       0.80] of WHOLE on the benchmark. Below 0.55 or above 0.80 refutes it.
 *       AT RISK: the band comes from an operation count, and an operation count is
 *       exactly what misled `AV1`. Per pass this network does about 3,744 directed
 *       edge visits across six walks, against 624 device evaluations and 328 node
 *       updates of six bitset tests each -- so reach is around 70% BY COUNT, and `AV1`
 *       registered a majority on that kind of reasoning and failed at 11.1%. The route
 *       below 0.55 is that a bitset walk is a load, a test, a set and a conditional
 *       push over a CSR that fits in L1, while the update loop's inner rail scan
 *       recomputes a word offset by multiply per rail per node; cheap-looking work
 *       repeated 328 times can outweigh expensive-looking work repeated 3,744 times,
 *       and that is the same shape as the thing `AV1` got wrong. The route above 0.80
 *       is the stack traffic and the unpredictable branch on `seen`.
 *
 *   AX2 CONDUCTION IS NOT NEGLIGIBLE: its share of WHOLE is at least 0.10.
 *       AT RISK: and this is the prediction that does NOT depend on `AX1`, which is
 *       deliberate -- `AW` registered four predictions resting on one premise and they
 *       failed together, and `AV1` and `AV2` did the same one set earlier. Conduction
 *       is the simplest phase, it is branch-heavy but allocation-free and perfectly
 *       sequential, and 624 iterations against reach's 3,744 edge visits could put it
 *       well under a tenth. It has also never been counted, so there is no prior
 *       measurement pointing either way.
 *
 *   AX3 THE SPLIT IS A PROPERTY OF THE ALGORITHM, NOT OF THE NETWORK. Each of the
 *       three shares on the decoded adder is within 0.10 absolute of the same share on
 *       the tree adder.
 *       AT RISK: the two networks have deliberately different shapes -- 540 devices
 *       over 208 nodes against 624 over 328, so the decoded adder does proportionally
 *       more conduction per node and fewer node updates per device. If the shares
 *       track those ratios rather than staying put, this fails, and it fails in a way
 *       that would make `AX1`'s single number useless for predicting any other
 *       network. `AV4` asked a size question and found no separation, but it varied
 *       total size while holding shape roughly constant; this varies shape.
 *
 *   AX4 AND THE DECOMPOSITION IS HONEST: C + R + U sums to within 0.15 of WHOLE.
 *       AT RISK: this is the instrument checking itself and it can fail in both
 *       directions. Over 1.15 means the isolated variants are slower than the phases
 *       are in situ -- each variant re-reads state that the whole pass keeps warm, so
 *       three separate passes over the same arrays can cost more than one. Under 0.85
 *       means the parts are faster in isolation than together, which is what happens
 *       if the whole pass exceeds a cache level the individual phases fit inside. If
 *       this fails, `AX1` through `AX3` are shares of something that is not the whole,
 *       and the honest report is that the method does not decompose this program --
 *       which is a result, and is why this is registered rather than checked quietly.
 *
 * NOT REGISTERED — derivable, already recorded, or measured while building the
 * instrument, and listed so the registered set is not inflated:
 *   - The trip counts. 624 devices, 328 nodes, 3 rails, 7 passes are `Z3`'s and `Y2`'s,
 *     and the 3,744 edge visits are multiplication over them.
 *   - That R2 is about 22x R0. That is the product of two numbers already in the
 *     manifest, and the composite has never been registered by anyone.
 *   - What any of this implies for a bitsliced R3. That is arithmetic over `AX1`
 *     once `AX1` exists, and belongs to whatever set proposes R3 rather than here.
 *   - That the four variants agree with each other on anything. They deliberately do
 *     not: three of them compute a wrong answer by construction, and this set times
 *     them rather than trusting them. The gate that matters here is that WHOLE with
 *     its early exit restored still agrees with R0, which is `AV`'s gate re-run.
 *
 * Run:  npm run audit:phases
 */

const fs = require('fs');
const os = require('os');

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

const D = require('../src/device.js');
const NP = require('../src/netpack.js');
const SW = require('../src/solver-wasm.js');
const W = require('../src/wasm-emit.js');
const T = require('../src/ternary.js');
const SA = require('./solver-audit.js');

/* ======================================================== THE BANDS, AS REGISTERED
 *
 * Read out of the registration block above rather than typed again here, exactly as
 * `solver-audit.js` does and for the same reason: a threshold transcribed by hand is
 * a threshold that can be transcribed wrongly, and T-TRANSCRIBED-TABLE is on the
 * record for a table copied out of a comment that came back inverted and read as a
 * clean headline finding. If a regex below stops matching, this throws rather than
 * scoring against a default.
 */
function registeredBands() {
  const src = fs.readFileSync(__filename, 'utf8');
  const flat = src.slice(0, src.indexOf('Run:  npm run audit:phases'))
    .replace(/^ \* ?/gm, '').replace(/\s+/g, ' ');
  const grab = (re, what) => {
    const m = re.exec(flat);
    if (!m) throw new Error(`the registration no longer states ${what}`);
    return m.slice(1).map(Number);
  };
  const [lo1, hi1] = grab(/SHARE LANDS IN \[([\d.]+), ([\d.]+)\] of WHOLE/, "AX1's band");
  const [floor2] = grab(/its share of WHOLE is at least (\d+\.\d+)/, "AX2's floor");
  const [sep3] = grab(/within (\d+\.\d+) absolute of the same share on the tree adder/,
    "AX3's separation");
  const [tol4] = grab(/C \+ R \+ U sums to within (\d+\.\d+) of WHOLE/, "AX4's tolerance");
  return { ax1: [lo1, hi1], ax2: floor2, ax3: sep3, ax4: tol4 };
}

/* ================================================= THE FOUR MODULES, FROM ONE IR
 *
 * `solver-wasm.js` exports `FUNCS` so a set can substitute ONE function and rebuild.
 * This set substitutes `solve` -- and it does not write a second copy of the solver
 * to do it. The variants are assembled from `solveFn`'s OWN statement nodes, sliced
 * out of the pass loop, so every phase in every variant is the same object graph the
 * stock module is emitted from. A hand-copied solve loop here would be
 * T-TRANSCRIBED-TABLE with four chances to bite instead of one, and the three
 * ablated variants compute a wrong answer BY CONSTRUCTION, so no gate would catch a
 * transcription error in them.
 *
 * THE SLICE IS BY SHAPE, NOT BY INDEX. `[4]` through `[6]` is the update loop today
 * and something else after the next edit to `src/`, silently. Each phase is matched
 * against the statement kinds and the loop variable it opens, and anything else
 * raises -- an audit that quietly measured the wrong three statements would report a
 * clean decomposition of a program nobody wrote.
 */
const PHASE_SHAPE = [
  ['conduction', [['set', 'i'], ['block', null]]],
  ['reach', [['set', 'r'], ['block', null]]],
  ['update', [['set', 'changed'], ['set', 'n'], ['block', null]]],
  ['exit', [['if', null]]],
  ['inc', [['set', 'iter']]],
];

/** Slice `solve` into its phases, refusing anything that is not the shape above. */
function partitionSolve(S = SW.FUNCS[1]) {
  const bad = why => { throw new Error(`solve is not the shape this set slices: ${why}`); };
  if (!S || S.name !== 'solve') bad('FUNCS[1] is not named solve');
  const n = S.body.length;
  if (S.body.filter(s => s.k === 'block').length !== 1) bad('not exactly one top-level block');
  const blk = S.body[n - 2];
  if (blk.k !== 'block') bad('the pass loop is not the second-to-last statement');
  if (S.body[n - 1].k !== 'return') bad('the body does not end in a return');
  if (blk.body.length !== 1 || blk.body[0].k !== 'loop') bad('the block does not hold one loop');
  const lp = blk.body[0], lb = lp.body;
  if (lb[0].k !== 'brIf') bad('the loop does not open with its exit test');
  if (lb[lb.length - 1].k !== 'br') bad('the loop does not close with its back edge');
  const mid = lb.slice(1, lb.length - 1);
  const phase = {};
  let at = 0;
  for (const [name, spec] of PHASE_SHAPE) {
    const got = mid.slice(at, at + spec.length);
    if (got.length !== spec.length) bad(`${name} runs off the end of the pass loop`);
    spec.forEach(([kind, local], j) => {
      if (got[j].k !== kind) bad(`${name}[${j}] is ${got[j].k}, not ${kind}`);
      if (local !== null && got[j].i !== local) bad(`${name}[${j}] opens ${got[j].i}, not ${local}`);
    });
    phase[name] = got;
    at += spec.length;
  }
  if (at !== mid.length) bad('the pass loop holds statements no phase claims');
  const ex = phase.exit[0];
  if (!(ex.body.length === 1 && ex.body[0].k === 'return' && ex.otherwise === null)) {
    bad('the early exit is not a lone conditional return');
  }
  return { S, pre: S.body.slice(0, n - 2), blk, lp, brIf: lb[0], br: lb[lb.length - 1],
    tail: S.body[n - 1], phase };
}

/** The variants, by which phases they keep. WHOLE_EXIT is the stock function. */
const VARIANT_PHASES = {
  WHOLE_EXIT: ['conduction', 'reach', 'update', 'exit'],
  WHOLE: ['conduction', 'reach', 'update'],
  C: ['conduction'],
  R: ['reach'],
  U: ['update'],
  SKELETON: [],
};
const TIMED = ['WHOLE', 'C', 'R', 'U'];

/**
 * One variant of `solve`: the same prologue, the same pass loop, the same locals and
 * therefore the same slot indices, and only the chosen phases inside the loop.
 *
 * The early exit is absent unless it is asked for, because `solve` returns as soon as
 * a pass changes nothing and a variant that never writes `value` would exit on pass
 * one and be timed over a different amount of work.
 */
function variantSolve(part, names) {
  const body = [...part.pre,
    { k: 'block',
      label: part.blk.label,
      body: [{ k: 'loop',
        label: part.lp.label,
        body: [part.brIf, ...names.flatMap(p => part.phase[p]), ...part.phase.inc, part.br] }] },
    part.tail];
  return W.fn('solve', { params: part.S.params, locals: part.S.locals,
    results: part.S.results, body });
}

const fnsFor = v => [SW.FUNCS[0], v, SW.FUNCS[2], SW.FUNCS[3]];
const FUNC_INDEX = new Map(SW.FUNCS.map((f, i) => [f.name, i]));

/** A compiled function's payload, past the byte count `sized()` puts in front of it. */
function bodyBytes(fn) {
  const c = W.compile(fn, FUNC_INDEX);
  let i = 0, b;
  do { b = c[i++]; } while (b & 0x80);
  return c.slice(i);
}

/* ---------------------------------------------------------- reading a module back
 *
 * The byte algebra below is over what the EMITTER produces. This walks what the
 * module actually IS, which is a different computation over the same claim, and it
 * is the one that answers the question in the form it was asked: do the variants
 * differ from WHOLE only in the region the substituted function occupies?
 */
function sectionsOf(bytes) {
  let i = 8;                                        // past the magic and the version
  const uleb = () => { let n = 0, s = 0, b; do { b = bytes[i++]; n |= (b & 0x7f) << s; s += 7; } while (b & 0x80); return n; };
  const out = [];
  while (i < bytes.length) { const id = bytes[i++]; const len = uleb(); out.push({ id, at: i, len }); i += len; }
  return out;
}

/** Every function body in a module, in index order, as the code section holds them. */
function codeBodies(bytes) {
  const sec = sectionsOf(bytes).find(s => s.id === 10);
  if (!sec) throw new Error('the module has no code section');
  let i = sec.at;
  const uleb = () => { let n = 0, s = 0, b; do { b = bytes[i++]; n |= (b & 0x7f) << s; s += 7; } while (b & 0x80); return n; };
  const count = uleb();
  const out = [];
  for (let k = 0; k < count; k++) { const len = uleb(); out.push(bytes.slice(i, i + len)); i += len; }
  return out;
}

const sameBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const cat = (...xs) => [].concat(...xs.map(x => Array.from(x)));

/**
 * THE DECOMPOSITION, AT THE BYTE LEVEL.
 *
 * Every variant's body is the same prologue P and the same loop scaffolding S with a
 * different run of phase bytes between them, so the whole family satisfies one
 * identity: WHOLE is P + C + R + U + S and the stock function is that with the early
 * exit spliced in before S. `|P| + |S| = |SKELETON|` is what makes the split exact --
 * a common prefix that ran on past the insertion point could not also sum.
 *
 * WHAT THIS DOES AND DOES NOT PROVE. It proves each variant carries EXACTLY its
 * slice, byte for byte, encoded the way that slice is encoded inside WHOLE -- so no
 * substitution perturbed a neighbour and no phase was recompiled into something
 * cheaper in isolation. It does NOT prove the slice boundaries are the semantic
 * phases; the boundaries come from the shape match above, and that they really are
 * where conduction stops and reach starts is what the write-set matrix shows.
 */
function byteAlgebra(part) {
  const bb = {};
  for (const k of Object.keys(VARIANT_PHASES)) bb[k] = bodyBytes(variantSolve(part, VARIANT_PHASES[k]));
  const stock = bodyBytes(part.S);
  const all = [...Object.values(bb), stock];
  const at = (a, i) => a[i];
  let lcp = 0;
  while (all.every(a => lcp < a.length && at(a, lcp) === at(all[0], lcp))) lcp++;
  let lcs = 0;
  while (all.every(a => lcs < a.length && at(a, a.length - 1 - lcs) === at(all[0], all[0].length - 1 - lcs))) lcs++;
  const cut = k => bb[k].slice(lcp, bb[k].length - lcs);
  const P = bb.SKELETON.slice(0, lcp), S = bb.SKELETON.slice(lcp);
  const b = { C: cut('C'), R: cut('R'), U: cut('U') };
  const exitAt = lcp + b.C.length + b.R.length + b.U.length;
  const bE = bb.WHOLE_EXIT.slice(exitAt, bb.WHOLE_EXIT.length - lcs);
  return {
    lcp, lcs, skeleton: bb.SKELETON.length,
    exact_split: lcp + lcs === bb.SKELETON.length,
    stock_is_whole_with_exit: sameBytes(bb.WHOLE_EXIT, stock),
    whole_is_c_r_u: sameBytes(bb.WHOLE, cat(P, b.C, b.R, b.U, S)),
    stock_is_c_r_u_exit: sameBytes(bb.WHOLE_EXIT, cat(P, b.C, b.R, b.U, bE, S)),
    bytes: { prologue: P.length, conduction: b.C.length, reach: b.R.length,
      update: b.U.length, exit: bE.length, scaffolding: S.length },
    body_bytes: Object.fromEntries(Object.entries(bb).map(([k, v]) => [k, v.length])),
  };
}

/**
 * The same claim read off the assembled modules: only function index 1 moved.
 *
 * Length is not identity, so the OTHER functions are compared byte for byte and
 * `solve` is required to DIFFER -- a substitution that silently did nothing would
 * otherwise pass every check in this section and report three shares of one.
 */
function moduleDiff(modules) {
  const base = codeBodies(modules.WHOLE);
  const names = SW.FUNCS.map(f => f.name);
  const rows = {};
  for (const k of TIMED.concat(['WHOLE_EXIT'])) {
    const got = codeBodies(modules[k]);
    if (got.length !== base.length) throw new Error(`${k} has a different function count`);
    rows[k] = {
      untouched: names.filter((nm, i) => i !== 1 && sameBytes(got[i], base[i])),
      differs: names.filter((nm, i) => !sameBytes(got[i], base[i])),
    };
  }
  // Everything OUTSIDE the code section too, byte for byte and not merely by id: the
  // type, function, memory and export sections say what the module IS, and a variant
  // that had quietly grown a function or dropped an export would still pass a check
  // that only compared which sections are present.
  const sec = k => sectionsOf(modules[k]).map(s => s.id).join(',');
  const nonCode = k => sectionsOf(modules[k]).filter(s => s.id !== 10)
    .map(s => `${s.id}:${Array.from(modules[k].slice(s.at, s.at + s.len)).join(',')}`).join('|');
  const others = TIMED.concat(['WHOLE_EXIT']);
  const nonCodeIdentical = others.every(k => nonCode(k) === nonCode('WHOLE'));
  return { functions: names, rows, section_ids: sec('WHOLE'),
    section_ids_agree: others.every(k => sec(k) === sec('WHOLE')),
    non_code_sections_identical: nonCodeIdentical,
    only_solve_moved: nonCodeIdentical && TIMED.every(k =>
      rows[k].untouched.length === names.length - 1
      && (k === 'WHOLE' ? rows[k].differs.length === 0 : rows[k].differs.join() === 'solve')) };
}

/* ============================================================= THE TWO NETWORKS */

const PAIR_INDEX = 10000;                  // the middle of AV's 20,000-pair benchmark
const POISON = 0xee;                       // no state code and no conduction code

const NETWORKS = [
  { key: 'tree', label: 'unrestored six-trit tree ripple adder',
    build: net => D.tRippleAdder(net, 6, false) },
  { key: 'decoded', label: 'decoded six-trit ripple adder',
    build: net => D.dRippleAdder(net, 6) },
];

/** The operand pair, taken from AV's benchmark order rather than chosen here. */
function benchInputs(index) {
  const [a, b] = SA.benchPairs(index + 1)[index];
  const ins = { cin: 0 };
  const ta = T.toTrits(a, 6), tb = T.toTrits(b, 6);
  for (let j = 0; j < 6; j++) { ins[`a${j}`] = ta[j]; ins[`b${j}`] = tb[j]; }
  return { a, b, inputs: ins };
}

/** The four state regions a pass reads and writes, in the order a pass touches them. */
const REGIONS = ['cond', 'reachDef', 'reachPos', 'value'];

/** Those four as byte ranges into linear memory. */
function regionsOf(P, L) {
  const bits = 4 * P.railCount * P.words;
  return {
    cond: [L.cond, L.cond + P.deviceCount],
    reachDef: [L.reachDef, L.reachDef + bits],
    reachPos: [L.reachPos, L.reachPos + bits],
    value: [L.value, L.value + P.nodeCount],
  };
}

/** Which regions each variant is supposed to write. The matrix below tests this. */
const WRITES = {
  WHOLE: ['cond', 'reachDef', 'reachPos', 'value'],
  C: ['cond'],
  R: ['reachDef', 'reachPos'],
  U: ['value'],
};

const checksum = (u8, regions) => {
  let s = 0;
  for (const [lo, hi] of Object.values(regions)) for (let i = lo; i < hi; i++) s = (s * 31 + u8[i]) | 0;
  return s;
};

/**
 * Fill one region with a byte that is neither a state code nor a conduction code, run
 * the variant, and report what came back. `writes` is the list of regions the variant
 * is supposed to write; leave it out to ask the question rather than score it.
 *
 * A region the variant must not touch has to come back byte-for-byte poisoned. A
 * region it does write has to come back with no poison left in it -- and, wherever
 * the phase's own inputs were left clean, RESTORED to the value the full solve
 * produced, which is a far stronger statement than "something wrote here". Only the
 * writable indices are scored: the update loop never writes a driven node, so the
 * poison it leaves in those is evidence rather than a miss.
 */
function writeProbe(instance, P, SNAP, L, passes, writes = null) {
  const R = regionsOf(P, L);
  const out = {};
  for (const rn of REGIONS) {
    instance.layoutOf(P);
    const u8 = new Uint8Array(instance.memory().buffer);
    u8.set(SNAP, 0);
    const [lo, hi] = R[rn];
    u8.fill(POISON, lo, hi);
    instance.exports.solve(passes);
    const idx = [];
    if (rn === 'value') { for (let i = 0; i < P.nodeCount; i++) if (!P.driven[i]) idx.push(lo + i); }
    else for (let i = lo; i < hi; i++) idx.push(i);
    const poisoned = idx.filter(i => u8[i] === POISON).length;
    const restored = idx.filter(i => u8[i] === SNAP[i]).length;
    let survived = true;
    for (let i = lo; i < hi; i++) if (u8[i] !== POISON) { survived = false; break; }
    const cell = { writable: idx.length, poison_left: poisoned, restored,
      survived_whole_region: survived, wrote: poisoned === 0 };
    if (writes) cell.as_expected = writes.includes(rn) ? cell.wrote : cell.survived_whole_region;
    out[rn] = cell;
  }
  return out;
}

/**
 * The same probe over an ARBITRARY set of phases, so a test can ask what a variant
 * nobody built would write. A tripwire that has only ever been shown not firing is a
 * tripwire nobody has seen work: this is how the write matrix gets a mutant to catch.
 */
async function probeVariant(phaseNames, netKey = 'tree') {
  const part = partitionSolve();
  const spec = NETWORKS.find(n => n.key === netKey);
  const net = new D.Net();
  spec.build(net);
  const P = NP.pack(net, SA.ADDER_IN);
  const { inputs } = benchInputs(PAIR_INDEX);
  const ref = await SW.makeR2({ fns: fnsFor(variantSolve(part, VARIANT_PHASES.WHOLE_EXIT)) });
  let k = null;
  for (let i = 1; i <= 64 && k === null; i++) {
    try { ref.solveNamed(P, inputs, i); k = i; } catch (e) { /* not yet */ }
  }
  const L = ref.layoutOf(P);
  ref.solveNamed(P, inputs, 64);
  const SNAP = new Uint8Array(ref.memory().buffer).slice(0, L.end);
  const inst = await SW.makeR2({ fns: fnsFor(variantSolve(part, phaseNames)) });
  const regions = writeProbe(inst, P, SNAP, L, k);
  return { passes: k, regions, wrote: REGIONS.filter(rn => regions[rn].wrote) };
}

/* ============================================================= THE MEASUREMENT */

/**
 * Passes per timed run, the same for every variant, both networks and every
 * repetition.
 *
 * IT IS A PARAMETER OF THE INSTRUMENT AND IT WAS CHOSEN, WHICH IS DISCLOSED RATHER
 * THAN BURIED. At a fifth of this length the cheapest variant's timed unit is tens of
 * milliseconds, and on a machine with other work on it the median of five such units
 * straddled a line this set is graded against -- one run in five put the reachability
 * walk below AX1's registered floor. That is T-CRITERION-IN-THE-NOISE arriving before
 * the verdict rather than after it. The line is registered and cannot move; the block
 * can, and lengthening it lowers the VARIANCE of the estimate without moving what is
 * being estimated -- which is not assumed, it is the pass-block invariance check
 * below. Runs at both lengths are in the manifest, and the shorter ones came first.
 */
const PASS_BLOCK = 300000;
const REPS = 6;                  // five kept, the first discarded as warm-up

/**
 * Everything one network contributes: the seeded state, what it is made of, the two
 * instrument demonstrations over it, and the four timings.
 *
 * WHY ONE CALL RATHER THAN MANY. The seeded state is a FIXED POINT of all four
 * variants -- conduction rewrites `cond` from a `value` nothing changed, reach
 * rewrites the bitsets from a `cond` nothing changed, and the update loop rewrites
 * `value` to what it already held -- so a run of `passes` passes is exactly that many
 * back-to-back solves of the network's settling count over the registered state, and
 * one boundary crossing rather than thousands keeps a JavaScript-to-WebAssembly call
 * out of the cheapest variant's measurement. That the state IS a fixed point is not
 * assumed: it is checked below, over the whole of linear memory, for every variant.
 */
async function measureNetwork(spec, inst, opts) {
  const { passes, reps } = opts;
  const net = new D.Net();
  spec.build(net);
  const P = NP.pack(net, SA.ADDER_IN);
  const { a, b, inputs } = benchInputs(PAIR_INDEX);

  // The settling count, found once and then checked twice: settles at k, does not
  // settle at k-1. T-SEARCH-WHERE-A-CHECK-WOULD-DO.
  let k = null;
  for (let i = 1; i <= 64 && k === null; i++) {
    try { inst.WHOLE_EXIT.solveNamed(P, inputs, i); k = i; } catch (e) { /* not yet */ }
  }
  let settles = false, settlesEarlier = true;
  try { inst.WHOLE_EXIT.solveNamed(P, inputs, k); settles = true; } catch (e) { /* */ }
  try { inst.WHOLE_EXIT.solveNamed(P, inputs, k - 1); } catch (e) { settlesEarlier = false; }

  const L = inst.WHOLE_EXIT.layoutOf(P);
  inst.WHOLE_EXIT.solveNamed(P, inputs, 64);
  const SNAP = new Uint8Array(inst.WHOLE_EXIT.memory().buffer).slice(0, L.end);
  const R = regionsOf(P, L);

  const install = v => {
    inst[v].layoutOf(P);
    const u8 = new Uint8Array(inst[v].memory().buffer);
    u8.set(SNAP, 0);
    return u8;
  };

  /* --- what the state is made of, reported rather than predicted --------------- */
  const tally = (lo, hi) => {
    const m = {};
    for (let i = lo; i < hi; i++) m[SNAP[i]] = (m[SNAP[i]] || 0) + 1;
    return m;
  };
  const rd = SNAP.slice(...R.reachDef), rp = SNAP.slice(...R.reachPos);
  const state = {
    cond_codes: tally(...R.cond),
    value_codes: tally(...R.value),
    definite_equals_possible: sameBytes(rd, rp),
    driven_nodes: P.driven.reduce((s, x) => s + (x ? 1 : 0), 0),
  };

  /* --- the state is a fixed point of every variant ----------------------------- */
  const fixedPoint = {};
  for (const v of TIMED) {
    const u8 = install(v);
    inst[v].exports.solve(k);
    let diff = 0;
    for (let i = 0; i < L.end; i++) if (u8[i] !== SNAP[i]) diff++;
    fixedPoint[v] = diff;
  }
  // And the strongest single form of it: poison everything the pass computes, leave
  // the input state alone, and one pass of WHOLE must put the whole of linear memory
  // back exactly as it was.
  {
    const u8 = install('WHOLE');
    for (const rn of ['cond', 'reachDef', 'reachPos']) u8.fill(POISON, ...R[rn]);
    inst.WHOLE.exports.solve(1);
    let diff = 0;
    for (let i = 0; i < L.end; i++) if (u8[i] !== SNAP[i]) diff++;
    fixedPoint.whole_recomputes_memory_exactly = diff === 0;
  }

  /* --- WHICH REGIONS EACH VARIANT ACTUALLY WRITES ------------------------------
   *
   * The hard part of an additive decomposition is not building the variants, it is
   * showing that the ones with a phase removed really stopped doing it. A variant
   * that silently still ran a phase would report a share of zero for it and read as
   * a clean finding, and "C, R and U are each faster than WHOLE" is no answer at all
   * -- that is a timing inequality, and timing is the thing being measured.
   *
   * So: fill one region with a byte that is neither a state code nor a conduction
   * code, run the variant over the registered pass count, and look at what came back.
   * A region the variant must not touch has to come back byte-for-byte poisoned. A
   * region it does write has to come back with no poison left in it -- and, wherever
   * the phase's own inputs were left clean, RESTORED to the value the full solve
   * produced, which is a far stronger statement than "something wrote here".
   *
   * The one cell where restoration is not expected is WHOLE over `value`: `value` is
   * conduction's input as well as the update loop's output, so poisoning it feeds the
   * pass a different state and the pass is entitled to answer differently. The write
   * is still visible, because no poison survives.
   */
  const matrix = {};
  let matrixOk = true;
  for (const v of TIMED) {
    const cells = writeProbe(inst[v], P, SNAP, L, k, WRITES[v]);
    for (const rn of REGIONS) {
      matrix[`${v}/${rn}`] = cells[rn];
      if (!cells[rn].as_expected) matrixOk = false;
    }
  }
  // The one cell that is not about writing at all: the update loop must leave driven
  // nodes alone, and the poison it does NOT clear from them is the evidence.
  const drivenHeld = (() => {
    const u8 = install('U');
    u8.fill(POISON, ...R.value);
    inst.U.exports.solve(k);
    let held = 0;
    for (let i = 0; i < P.nodeCount; i++) if (P.driven[i] && u8[R.value[0] + i] === POISON) held++;
    return held;
  })();

  /* --- the timings -------------------------------------------------------------- */
  for (const v of TIMED) install(v);
  const subjects = TIMED.map(v => ({
    name: v,
    run: () => {
      const u8 = new Uint8Array(inst[v].memory().buffer);
      u8.set(SNAP, 0);
      inst[v].exports.solve(passes);
      return checksum(u8, R);
    },
  }));
  const t = SA.interleaved(subjects, reps);
  const share = v => t[v].median / t.WHOLE.median;
  const shares = { C: share('C'), R: share('R'), U: share('U') };
  shares.sum = shares.C + shares.R + shares.U;

  return {
    key: spec.key, label: spec.label, linear_memory_bytes: L.end,
    switches: net.cost().switches, nodes: P.nodeCount, devices: P.deviceCount,
    rails: P.railCount, words: P.words,
    pair: [a, b], settling_passes: k, settles_at_k: settles,
    settles_at_k_minus_one: settlesEarlier,
    passes_per_run: passes, state, fixed_point: fixedPoint,
    write_matrix: matrix, write_matrix_as_expected: matrixOk,
    driven_nodes_update_left_alone: drivenHeld,
    seconds: Object.fromEntries(TIMED.map(v => [v, t[v].median])),
    all_seconds: Object.fromEntries(TIMED.map(v => [v, t[v].all])),
    checksums: Object.fromEntries(TIMED.map(v => [v, t[v].checksum])),
    ns_per_pass: Object.fromEntries(TIMED.map(v => [v, t[v].median / passes * 1e9])),
    shares,
  };
}

/**
 * AV's gate, re-run here, over WHOLE with its early exit restored.
 *
 * The other three variants compute a wrong answer BY CONSTRUCTION and are timed, not
 * trusted -- so this is the one place the construction touches the oracle, and a
 * module that no longer agrees with `src/device.js` is not a variant of the solver.
 * Exported so the suite can re-run it rather than read a number this tool wrote down.
 */
function gateOver(instance) {
  const solve = (net, names, inputs, cap, init) =>
    instance.solveNamed(SA.packedFor(net, names), inputs, cap, init);
  const g = SA.runGate(solve), p = SA.passAgreement(solve);
  return { networks: g.groups, rows: g.rows, node_values: g.values,
    refusals_matched: g.threwBoth, pass_cases: p.checked, pass_settling: p.settles,
    pass_never_settling: p.never, divergences: g.diffs.length + p.bad.length,
    states: [...g.coverage].map(x => JSON.stringify(x)).sort().join(' '),
    diffs: [...g.diffs.slice(0, 5), ...p.bad.slice(0, 5)] };
}

/** That gate, over a module this function builds, for a caller that has no instance. */
async function gateWholeExit() {
  const part = partitionSolve();
  return gateOver(await SW.makeR2({ fns: fnsFor(variantSolve(part, VARIANT_PHASES.WHOLE_EXIT)) }));
}

/* ---------------------------------------------------------------- the measurement */

/**
 * The instrument, then the two networks, then the four verdicts. Returns them rather
 * than only printing them, so the record and the report are the same computation.
 */
async function runAudit({ passes = PASS_BLOCK, reps = REPS, quick = false } = {}) {
  const part = partitionSolve();
  const fn = {}, modules = {}, inst = {};
  for (const k of Object.keys(VARIANT_PHASES)) {
    if (k === 'SKELETON') continue;
    fn[k] = variantSolve(part, VARIANT_PHASES[k]);
    modules[k] = SW.moduleBytes(fnsFor(fn[k]));
    inst[k] = await SW.makeR2({ fns: fnsFor(fn[k]) });
  }

  const A = { quick, machine: os.cpus()[0].model, node_version: process.version,
    passes_per_run: passes, repetitions: reps };

  /* --- 0. the instrument ------------------------------------------------------- */
  A.algebra = byteAlgebra(part);
  A.modules = moduleDiff(modules);
  A.stock = {
    module_bytes: SW.moduleBytes().length,
    variant_module_bytes: modules.WHOLE_EXIT.length,
    identical_to_stock: sameBytes(Array.from(modules.WHOLE_EXIT), Array.from(SW.moduleBytes())),
    exports: WebAssembly.Module.exports(new WebAssembly.Module(SW.moduleBytes()))
      .map(e => `${e.name}:${e.kind}`).sort().join(' '),
    funcs: SW.FUNCS.length,
  };

  A.gate = gateOver(inst.WHOLE_EXIT);

  /* --- the two networks -------------------------------------------------------- */
  A.net = {};
  for (const spec of NETWORKS) A.net[spec.key] = await measureNetwork(spec, inst, { passes, reps });

  // Shares are ratios over a state every pass reproduces, so they should not depend
  // on how many passes a run does. Reported, not registered -- but a decomposition
  // whose answer moved with the block length would be measuring the block length.
  const doubled = await measureNetwork(NETWORKS[0], inst, { passes: passes * 2, reps: 2 });
  A.pass_count_invariance = {
    passes: doubled.passes_per_run,
    shares: doubled.shares,
    max_share_shift: Math.max(...['C', 'R', 'U'].map(v =>
      Math.abs(doubled.shares[v] - A.net.tree.shares[v]))),
  };

  /* --- the verdicts ------------------------------------------------------------- */
  const band = registeredBands();
  const tree = A.net.tree.shares, dec = A.net.decoded.shares;
  const ax1 = tree.R;
  const ax2 = tree.C;
  const ax3 = Math.max(...['C', 'R', 'U'].map(v => Math.abs(dec[v] - tree[v])));
  const ax4 = Math.abs(tree.sum - 1);
  A.band = band;
  A.value = { ax1, ax2, ax3, ax4, ax4_decoded: Math.abs(dec.sum - 1) };
  A.verdict = {
    AX1: ax1 >= band.ax1[0] && ax1 <= band.ax1[1] ? 'HELD' : 'FAILED',
    AX2: ax2 >= band.ax2 ? 'HELD' : 'FAILED',
    AX3: ax3 < band.ax3 ? 'HELD' : 'FAILED',
    AX4: ax4 <= band.ax4 ? 'HELD' : 'FAILED',
  };
  return A;
}

/* ------------------------------------------------------------------- the report */

const pc = x => `${(100 * x).toFixed(1)}%`;
const sec = x => `${x.toFixed(4)}s`;

function report(argv = []) {
  const quick = argv.includes('--quick');
  return runAudit(quick ? { passes: 10000, reps: 2 } : {}).then(A => {
    log('PHASES AUDIT: where R2 actually spends its time.');
    log(line);
    if (quick) {
      log('QUICK MODE — every print path runs, the pass block is a fraction of the');
      log('registered one, and NOTHING BELOW IS A MEASUREMENT. `npm run audit:phases`');
      log('is the audit.');
    }

    log('');
    log('--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
    // AV's gate re-run here, on WHOLE with its early exit restored: a variant of the
    // module that no longer agrees with the oracle is not a variant of the solver.
    // The other three compute a wrong answer BY CONSTRUCTION and are timed, not
    // trusted -- so what has to be shown is that the substitution machinery changed
    // only the phase it was aimed at, and that each ablated variant really did stop
    // doing the work it was supposed to stop doing.
    // AD2 memoised only terminating values and reported the attacker as 300x WORSE --
    // in the flattering direction, which is the direction nothing catches by surprise.
    log(`      machine ${A.machine}, node ${A.node_version}`);
    log('');
    log('  0a. the four modules come out of one IR, and the algebra is exact');
    log(`      solve's body splits into prologue ${A.algebra.bytes.prologue}`
      + ` + conduction ${A.algebra.bytes.conduction} + reach ${A.algebra.bytes.reach}`
      + ` + update ${A.algebra.bytes.update} + exit ${A.algebra.bytes.exit}`
      + ` + scaffolding ${A.algebra.bytes.scaffolding} bytes`);
    log(`      prologue + scaffolding is the empty variant exactly: ${A.algebra.exact_split}`);
    log(`      WHOLE is prologue + C + R + U + scaffolding: ${A.algebra.whole_is_c_r_u}`);
    log(`      and the stock function is that with the exit spliced in: ${A.algebra.stock_is_c_r_u_exit}`);
    log('');
    log('  0b. and only `solve` moved, read back off the assembled modules');
    for (const k of TIMED) {
      log(`      ${k.padEnd(5)} untouched: ${A.modules.rows[k].untouched.join(' ') || '(none)'}`
        + `   differs: ${A.modules.rows[k].differs.join(' ') || '(none)'}`);
    }
    log(`      every section outside the code section is byte-identical across every`
      + ` variant: ${A.modules.non_code_sections_identical}   (${A.modules.section_ids})`);
    log(`      the stock module is still what AV timed: ${A.stock.module_bytes} bytes,`
      + ` exports ${A.stock.exports}`);
    log(`      and WHOLE-with-its-exit is that module byte for byte: ${A.stock.identical_to_stock}`);
    log('');
    log('  0c. AV\'s gate, on this branch, on WHOLE with its early exit restored');
    log(`      ${A.gate.networks} networks, ${A.gate.rows} rows, ${A.gate.node_values} node values,`
      + ` ${A.gate.refusals_matched} refusals matched`);
    log(`      ${A.gate.pass_cases} pass-count cases (${A.gate.pass_never_settling} that never settle),`
      + ` states seen ${A.gate.states}`);
    log(`      DIVERGENCES: ${A.gate.divergences}`);
    if (A.gate.diffs.length) for (const d of A.gate.diffs) log(`        ${d}`);
    log('');
    log('  0d. the seeded state is a fixed point of every variant');
    for (const key of Object.keys(A.net)) {
      const N = A.net[key];
      log(`      ${key}: bytes of linear memory that move over ${N.settling_passes} passes — `
        + TIMED.map(v => `${v} ${N.fixed_point[v]}`).join(', '));
      log(`         and poisoning everything a pass computes, one pass puts all of memory`
        + ` back: ${N.fixed_point.whole_recomputes_memory_exactly}`);
      log(`         state: cond ${JSON.stringify(N.state.cond_codes)},`
        + ` value ${JSON.stringify(N.state.value_codes)},`
        + ` definite bitset equals possible: ${N.state.definite_equals_possible}`);
    }
    log('');
    log('  0e. and each ablated variant really stopped: what each one writes');
    for (const key of Object.keys(A.net)) {
      const N = A.net[key];
      log(`      ${key}:`);
      for (const v of TIMED) {
        const row = REGIONS.map(rn => {
          const c = N.write_matrix[`${v}/${rn}`];
          return `${rn} ${c.poison_left === 0 ? `WROTE${c.restored === c.writable ? '/restored' : ''}` : 'untouched'}`;
        });
        log(`        ${v.padEnd(5)} ${row.join('   ')}`);
      }
      log(`        every cell as the construction requires: ${N.write_matrix_as_expected}`
        + `;  driven nodes the update loop left poisoned: ${N.driven_nodes_update_left_alone}`);
    }
    log('');
    log(`      pass-block invariance: shares at ${A.pass_count_invariance.passes} passes move by at`
      + ` most ${A.pass_count_invariance.max_share_shift.toFixed(4)} from the registered block`);

    const tree = A.net.tree, dec = A.net.decoded;
    log('');
    log(`--- the benchmark: ${tree.label}, ${tree.switches} switches, ${tree.nodes} nodes,`
      + ` ${tree.settling_passes} passes ---`);
    log(`      ${tree.passes_per_run} passes per timed run, ${A.repetitions} repetitions,`
      + ' first discarded, all four interleaved');
    for (const v of TIMED) {
      log(`      ${v.padEnd(5)} ${sec(tree.seconds[v])}   ${tree.ns_per_pass[v].toFixed(0)} ns/pass`
        + (v === 'WHOLE' ? '' : `   ${pc(tree.shares[v])} of WHOLE`));
    }

    log('');
    log('--- AX1  the reachability walk, as a share of the whole ---');
    log(`      reach is ${pc(A.value.ax1)} of WHOLE, against a registered band of`
      + ` [${A.band.ax1[0]}, ${A.band.ax1[1]}]`);
    log(`      AX1 ${A.verdict.AX1}`);

    log('');
    log('--- AX2  conduction, the phase nobody had counted ---');
    log(`      conduction is ${pc(A.value.ax2)} of WHOLE, against a registered floor of`
      + ` ${A.band.ax2}`);
    log(`      AX2 ${A.verdict.AX2}`);

    log('');
    log('--- AX3  the same split on a network of a different shape ---');
    log(`      ${dec.label}: ${dec.switches} switches, ${dec.nodes} nodes,`
      + ` ${dec.settling_passes} passes`);
    for (const v of TIMED) {
      log(`      ${v.padEnd(5)} ${sec(dec.seconds[v])}`
        + (v === 'WHOLE' ? '' : `   ${pc(dec.shares[v])} of WHOLE`
          + `   (tree ${pc(tree.shares[v])}, apart by ${Math.abs(dec.shares[v] - tree.shares[v]).toFixed(4)})`));
    }
    log(`      the widest separation is ${A.value.ax3.toFixed(4)}, against a registered`
      + ` ${A.band.ax3}`);
    log(`      AX3 ${A.verdict.AX3}`);

    log('');
    log('--- AX4  and whether the parts sum to the whole ---');
    log(`      C + R + U is ${pc(tree.shares.sum)} of WHOLE on the benchmark`
      + ` (${pc(dec.shares.sum)} on the decoded adder)`);
    log(`      apart from the whole by ${A.value.ax4.toFixed(4)}, against a registered`
      + ` ${A.band.ax4}`);
    log(`      AX4 ${A.verdict.AX4}`);

    log('');
    log(line);
    // A VERDICT PRINTED IN QUICK MODE IS NOT A VERDICT, and the banner that says so is
    // by now far off the top of the screen. Both AX2 and AX3 have been seen to flip
    // here -- AX3 scores the DIFFERENCE of two noisy ratios and inherits both errors,
    // and AX2's margin over its floor is the same order as the spread between runs --
    // so this summary can disagree with the manifest. That is a reader walking away
    // with the wrong outcome rather than a measurement problem, and the fix belongs on
    // the line that can be misread, not only at the top of the page.
    const mark = quick ? '   (quick mode: NOT a measurement)' : '';
    for (const id of ['AX1', 'AX2', 'AX3', 'AX4']) log(`  ${id}  ${A.verdict[id]}${mark}`);
    if (quick) {
      log('');
      log('  Nothing above is a measurement. `npm run audit:phases` is the audit, and');
      log('  `FINDINGS.json` carries the outcomes that were recorded from it.');
    }
    log(line);
    return A;
  });
}

/**
 * What the manifest records. Every number `FINDINGS.json` carries for this set is
 * lifted from here rather than retyped, so a value in the record and a value in the
 * report are the same computation.
 */
function summary(A) {
  const common = {
    machine: A.machine, node_version: A.node_version,
    passes_per_run: A.passes_per_run, repetitions: A.repetitions,
    repetitions_kept: A.repetitions - 1,
    gate_networks: A.gate.networks, gate_node_values_compared: A.gate.node_values,
    gate_divergences: A.gate.divergences,
    module_bytes_stock: A.stock.module_bytes,
    whole_with_exit_is_stock_module: A.stock.identical_to_stock,
    byte_algebra_exact: A.algebra.exact_split && A.algebra.whole_is_c_r_u
      && A.algebra.stock_is_c_r_u_exit,
    only_solve_differs_between_modules: A.modules.only_solve_moved,
    write_matrix_as_expected: Object.values(A.net).every(n => n.write_matrix_as_expected),
  };
  const per = key => {
    const N = A.net[key];
    const spread = v => {
      const k = [...N.all_seconds[v]].slice(1).sort((x, y) => x - y);
      return Number(((k[k.length - 1] - k[0]) / N.seconds[v]).toFixed(4));
    };
    return {
      switches: N.switches, nodes: N.nodes, devices: N.devices, operand_pair: N.pair,
      settling_passes: N.settling_passes, linear_memory_bytes: N.linear_memory_bytes,
      relative_spread: Object.fromEntries(TIMED.map(v => [v, spread(v)])),
      seconds: Object.fromEntries(TIMED.map(v => [v, Number(N.seconds[v].toFixed(5))])),
      all_seconds: Object.fromEntries(TIMED.map(v =>
        [v, N.all_seconds[v].map(x => Number(x.toFixed(5)))])),
      share_conduction: Number(N.shares.C.toFixed(4)),
      share_reach: Number(N.shares.R.toFixed(4)),
      share_update: Number(N.shares.U.toFixed(4)),
      share_sum: Number(N.shares.sum.toFixed(4)),
    };
  };
  return {
    common,
    benchmark_pair_index: PAIR_INDEX,
    tree: per('tree'),
    decoded: per('decoded'),
    band: A.band,
    value: Object.fromEntries(Object.entries(A.value).map(([k, v]) => [k, Number(v.toFixed(4))])),
    verdict: A.verdict,
    pass_block_invariance: Number(A.pass_count_invariance.max_share_shift.toFixed(4)),
    state: Object.fromEntries(Object.keys(A.net).map(k => [k, A.net[k].state])),
  };
}

if (MAIN) {
  report(process.argv.slice(2)).then(A => {
    if (process.argv.includes('--json')) console.log(JSON.stringify(summary(A), null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}

module.exports = {
  report, runAudit, summary, registeredBands, partitionSolve, variantSolve, byteAlgebra,
  moduleDiff, bodyBytes, codeBodies, sectionsOf, fnsFor, regionsOf, benchInputs,
  writeProbe, probeVariant, gateOver, gateWholeExit,
  VARIANT_PHASES, PHASE_SHAPE, TIMED, WRITES, REGIONS, NETWORKS, PASS_BLOCK, REPS,
  PAIR_INDEX, POISON, sameBytes,
};
