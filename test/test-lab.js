'use strict';
/* test-lab.js — the browser lab page: its glue, its module, and its palette.
 *
 * `docs/tryte-lab.html` runs switch-level sweeps on R2 in a browser, and it emits
 * its own WebAssembly at load time rather than shipping any. That makes it a second
 * copy of five files in `src/` plus a driver nothing else runs, and this repository's
 * standing rule is that a second implementation nobody compares is an unchecked
 * claim. `build/build-lab.js` carries the comparison and refuses to write the page
 * when it fails; this suite runs that gate as a subprocess so the check cannot be
 * skipped by not rebuilding, and then covers the three things the gate cannot see:
 *
 *   - the CONTROLS, against a DOM shim, in the shape `test-page.js` uses. The gate
 *     loads the page with no DOM at all, so every line inside its UI block is
 *     invisible to it — including the cost table, which is the page's whole
 *     comparison and is drawn nowhere else.
 *   - the DERIVATION. The page's pass counter is `solve`'s own body with one node
 *     replaced. That the substitution happened exactly once, and that it left the
 *     module `test-solver.js` pins alone, are properties of the page and not of any
 *     sweep it runs.
 *   - the PALETTE. Every published page here carries its own contrast arithmetic:
 *     `test-style.js` for `tryte-vm.html`, `test-artstyle.js` for
 *     `tick-argument.html`, and the second exists because the second page shipped
 *     without one. The maths is `test/theme.js`, shared, because two copies of a
 *     checker are two checkers that can disagree.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const { ratio, structure } = require('./theme.js');
const B = require('../build/bundle.js');
const T = require('../src/ternary.js');
const D = require('../src/device.js');
const NP = require('../src/netpack.js');
const SW = require('../src/solver-wasm.js');
const W = require('../src/wasm-emit.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const PAGE = path.join(__dirname, '..', 'docs', 'tryte-lab.html');
const html = fs.readFileSync(PAGE, 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];

/* --- a DOM just big enough -------------------------------------------------
 * The same shape `test-page.js` uses, minus the innerHTML parser: this page
 * builds every row with createElement and appendChild, so nothing here has to
 * parse markup. `textContent = ''` is how it clears a table body, which drops
 * children in a real DOM and here. */
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = []; this.parent = null;
    this._text = ''; this.className = ''; this.dataset = {};
    this.attrs = {}; this.style = {}; this.listeners = {};
    this.value = ''; this.id = ''; this.disabled = false;
  }
  get textContent() {
    return this.children.length ? this.children.map(c => c.textContent).join('') : this._text;
  }
  set textContent(v) { this._text = String(v); this.children = []; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  dispatch(ev, target = this) {
    (this.listeners[ev] || []).forEach(fn => fn({ target }));
    if (this.parent) this.parent.dispatch(ev, target);
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  get classList() {
    const self = this;
    return { add: c => { self.className += ' ' + c; },
      contains: c => self.className.split(/\s+/).includes(c) };
  }
}

/** Every id the page reaches for, with the element type it expects. */
const IDS = {
  lab: 'section',
  'i-bytes': 'dd', 'i-exports': 'dd', 'i-derived': 'dd',
  'c-family': 'select', 'c-restore': 'select', 'c-cin': 'select', 'c-stride': 'select',
  'cost-body': 'tbody',
  'b-run': 'button', 'b-stop': 'button', 's-tag': 'span',
  'bar-fill': 'div', 's-progress': 'p', 's-domain': 'p',
  'r-pairs': 'dd', 'r-sum': 'dd', 'r-carry': 'dd', 'r-unresolved': 'dd',
  'r-unsettled': 'dd', 'r-first': 'p',
  'hist-body': 'tbody', 'hist-verdict': 'p',
};

function loadPage({ withDom }) {
  const byId = {};
  const sandbox = { console, TextEncoder, WebAssembly };
  if (withDom) {
    const root = new El('body');
    for (const [id, tag] of Object.entries(IDS)) {
      const e = new El(tag); e.id = id; byId[id] = e; root.appendChild(e);
    }
    sandbox.document = {
      getElementById: id => byId[id],
      createElement: tag => new El(tag),
      body: root,
    };
    // The page chunks on requestAnimationFrame. A shim that ran the callback
    // synchronously would recurse a chunk deep per pair; a task queue is what a
    // frame actually is.
    sandbox.requestAnimationFrame = cb => setTimeout(() => cb(0), 0);
  }
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return { L: sandbox.__LAB_EXPORT__, byId, sandbox };
}

/** Operand codes for a block of pairs, in the order the page sweeps them. */
function codesFor(L, values, cin) {
  const w = L.WIDTH, ic = L.INPUT_NAMES.length, axis = values.length;
  const codes = new Uint8Array(axis * axis * ic);
  for (let i = 0; i < axis * axis; i++) {
    const ta = T.toTrits(values[(i / axis) | 0], w), tb = T.toTrits(values[i % axis], w);
    for (let j = 0; j < w; j++) { codes[i * ic + j] = ta[j] + 3; codes[i * ic + w + j] = tb[j] + 3; }
    codes[i * ic + 2 * w] = cin + 3;
  }
  return codes;
}

async function main() {

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // The harness can report a failure. A suite whose check() only ever passes is a
  // suite that reads as coverage and is not. The probe runs the REAL check() with
  // a false condition, with its output captured so a green run stays green-looking,
  // and then takes the failure back off the list.
  const probed = (() => {
    const log = console.log;
    const lines = [];
    console.log = m => lines.push(m);
    const failsBefore = fails.length, passBefore = pass;
    check('deliberately false', false, 'captured, not printed');
    console.log = log;
    const ok = fails.length === failsBefore + 1 && pass === passBefore
      && /\[FAIL\]/.test(lines[0] || '');
    fails.pop();
    return ok;
  })();
  check('the harness reports a false check as FAIL, counts it, and counts no pass for it',
    probed);

  // The contrast arithmetic, against two values computable by hand.
  check('the contrast instrument gives 21.00 for black on white and 1.00 for grey on itself',
    Math.abs(ratio('#000000', '#FFFFFF') - 21) < 1e-9 && ratio('#808080', '#808080') === 1);

  // The page's own arithmetic oracle, against a case that needs no solver: the
  // largest tryte plus one wraps to the smallest, and the carry it drops is +1.
  const { L } = loadPage({ withDom: false });
  const o = L.oracle(T.TRYTE_MAX, 1, 0);
  check('the page\'s oracle wraps 364 + 1 to -364 and reports the dropped carry',
    o.sum === T.TRYTE_MIN && o.carry === 1, JSON.stringify(o));
  check('   and it is T.add underneath, not a second addition written on the page',
    [[7, 5, 0], [-100, -300, 1], [0, 0, -1], [364, 364, 1]]
      .every(([a, b, c]) => L.oracle(a, b, c).sum === T.add(T.add(a, b), c)));
}

console.log('\n=== 1. THE PAGE IS THE ONE THE BUILD PRODUCES ===');
{
  // Trusting a build artifact that was not rebuilt is on the trap list, and the
  // bundle slice is not the whole exposure here: this page's script is the bundle
  // AND a driver that lives in the template. Editing the template without
  // rebuilding leaves the bundle check green and the page stale, so the whole file
  // is compared and not just the inlined part.
  const rendered = fs.readFileSync(path.join(__dirname, '..', 'build', 'lab-template.html'), 'utf8')
    .replace('/*__LAB_BUNDLE__*/', () => B.buildLabBundle());
  check('the published page is exactly template + current src/ (rebuild with `npm run build:lab`)',
    rendered === html);
  check('   and the bundle recovered through the page\'s own markers is the current one',
    B.labBundleInPage() === B.buildLabBundle());
  check('   and recovering it from a file without those markers refuses rather than guessing',
    (() => { try { B.labBundleInPage('docs/tryte-vm.html'); return false; }
      catch (e) { return /cannot locate the lab bundle/.test(e.message); } })());

  // T-TOOL-CHECKED-ONLY-BY-IMPORT: the gate has a run path and an import path, and
  // only the run path is the one that fails a build. Spawn it.
  let out = '', gateFailed = null;
  try {
    out = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'build', 'build-lab.js'), '--check'],
      { encoding: 'utf8', timeout: 600000 });
  } catch (e) {
    // A gate that exits non-zero is a FAILED CHECK, not a crashed suite: the rest
    // of this file still has things to say about the page it was handed.
    gateFailed = ((e.stdout || '') + (e.stderr || '')).trim() || e.message;
  }
  check('the build gate runs as a program, compares the page against src/, and passes',
    gateFailed === null && /gate: \d+ sweeps/.test(out) && /matches the template and src\//.test(out),
    gateFailed || out.trim());
  check('   and it reports what it compared rather than only that it agreed',
    /pairs compared byte for byte against src\//.test(out) && /against R0 too/.test(out));
  const buckets = /buckets: (\{.*\})/.exec(out);
  check('   and it found a pass-count histogram with more than one bucket, so the '
    + 'histogram path was exercised on a network whose settling depends on the data',
    buckets !== null && Object.keys(JSON.parse(buckets[1])).length > 1,
    buckets ? buckets[1] : 'no histogram line');
}

console.log('\n=== 2. NOTHING THE PAGE NEEDS COMES FROM OUTSIDE THE FILE ===');
{
  // Each of these is a way the page would work in a dev server and fail from a
  // file:// URL, which is the only way most readers will ever open it.
  const body = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('no instantiateStreaming — there is no Response to stream and it fails on file://',
    !/instantiateStreaming/.test(body));
  check('no Web Worker — unreliable from file://, so the chunking is on requestAnimationFrame',
    !/\bnew\s+Worker\b/.test(body) && /requestAnimationFrame/.test(body));
  check('no SharedArrayBuffer — it needs COOP and COEP headers a local file cannot send',
    !/SharedArrayBuffer/.test(body));
  check('no fetch and no XMLHttpRequest anywhere in the page',
    !/\bfetch\s*\(/.test(body) && !/XMLHttpRequest/.test(body));
  check('no committed WebAssembly: no .wasm beside the page and no base64 blob inside it',
    !fs.existsSync(path.join(__dirname, '..', 'docs', 'solver.wasm'))
    && !/atob\s*\(/.test(body) && !/[A-Za-z0-9+/]{200,}={0,2}/.test(body));
  check('the emitter is what produces the bytes, and the page calls it',
    /emitModule/.test(script) && /WebAssembly\.instantiate\(/.test(script));
}

console.log('\n=== 3. THE MODULE THE PAGE EMITS ===');
{
  const { L } = loadPage({ withDom: false });
  check('the page derived its pass counter by substituting exactly one node',
    L.substitutions() === 1, String(L.substitutions()));
  check('   and the substitution COPIED: the module src/solver-wasm.js pins is untouched',
    Buffer.compare(Buffer.from(L.SW.moduleBytes()), Buffer.from(SW.moduleBytes())) === 0);
  check('   and the page\'s copy of that module is byte-identical to the required one',
    L.SW.moduleBytes().length === SW.moduleBytes().length);

  // The derived function is `solve` with one node different. Compared structurally
  // rather than by eye, because "one node different" is the whole claim.
  const solveFn = L.SW.FUNCS.filter(f => f.name === 'solve')[0];
  /** How many subtrees differ, counted at the HIGHEST point where they differ, so
   *  one replaced node scores one however deep the replacement is. */
  const diff = (a, b) => {
    if (Array.isArray(a) && Array.isArray(b)) {
      const n = Math.min(a.length, b.length);
      let s = Math.abs(a.length - b.length);
      for (let i = 0; i < n; i++) s += diff(a[i], b[i]);
      return s;
    }
    const objA = !!a && typeof a === 'object', objB = !!b && typeof b === 'object';
    if (objA !== objB) return 1;
    if (objA) {
      if (Object.keys(a).sort().join() !== Object.keys(b).sort().join()) return 1;
      return Object.keys(a).reduce((s, k) => s + diff(a[k], b[k]), 0);
    }
    return a === b ? 0 : 1;
  };
  check('solvePasses is solve\'s body with one subtree replaced and nothing else moved',
    diff(solveFn.body, L.solvePassesFn.body) === 1 &&
    L.solvePassesFn.params.join() === solveFn.params.join() &&
    L.solvePassesFn.locals.join() === solveFn.locals.join(),
    String(diff(solveFn.body, L.solvePassesFn.body)));
  // The negative control on that instrument: a counter stuck at 1 would report
  // "one subtree replaced" for two bodies that share nothing.
  check('   and the differ is not stuck at one — two unrelated bodies differ by more',
    diff(solveFn.body, L.passSweepFn.body) > 1 && diff(solveFn.body, solveFn.body) === 0,
    String(diff(solveFn.body, L.passSweepFn.body)));

  const inst = await L.instrument();
  check('the emitted module validates and exports passSweep beside AV\'s three',
    WebAssembly.validate(inst.bytes) &&
    WebAssembly.Module.exports(new WebAssembly.Module(inst.bytes))
      .map(e => `${e.name}:${e.kind}`).sort().join(' ')
      === 'memory:memory passSweep:function seedCodes:function solve:function sweep:function');
  check('   and it is AV\'s four functions plus two, not an edit to the four',
    L.LAB_FUNCS.length === L.SW.FUNCS.length + 2 &&
    L.SW.FUNCS.every((f, i) => L.LAB_FUNCS[i] === f));
}

console.log('\n=== 4. THE SWEEP AGREES WITH src/, AND THE COMPARISON CAN FAIL ===');
{
  const { L } = loadPage({ withDom: false });
  const inst = await L.instrument();
  const STRIDE = 37;
  const values = L.operandValues(STRIDE);
  const axis = values.length, pairCount = axis * axis;
  const ic = L.INPUT_NAMES.length, oc = L.OUTPUT_NAMES.length;
  const spec = { family: 'tree', restore: 'none', cin: 0, stride: STRIDE };
  const codes = codesFor(L, values, spec.cin);

  const Ppage = L.NP.pack(L.buildNetwork(spec), L.INPUT_NAMES);
  const net = D.tRippleAdder(new D.Net(), L.WIDTH, { restore: 'none' });
  const Pmod = NP.pack(net, L.INPUT_NAMES);
  const idsPage = Int32Array.from(L.OUTPUT_NAMES.map(nm => L.NP.nodeId(Ppage, nm)));
  const idsMod = Int32Array.from(L.OUTPUT_NAMES.map(nm => NP.nodeId(Pmod, nm)));
  const outPage = new Uint8Array(pairCount * oc), outMod = new Uint8Array(pairCount * oc);
  inst.sweep(Ppage, codes, pairCount, idsPage, outPage, L.CAP);
  NP.sweepPacked(Pmod, codes, pairCount, idsMod, outMod, L.CAP);
  check(`the page's solver and src/netpack.js agree byte for byte over ${pairCount} pairs`,
    outPage.every((v, i) => v === outMod[i]));

  // The mutation control for that comparison: move one operand trit and it must
  // stop agreeing. A comparison that cannot fail is not a comparison.
  const shifted = Uint8Array.from(codes);
  shifted[0] = shifted[0] === 4 ? 2 : shifted[0] + 1;
  const outShift = new Uint8Array(pairCount * oc);
  inst.sweep(Ppage, shifted, pairCount, idsPage, outShift, L.CAP);
  check('   and it notices when one operand trit of one pair is moved',
    outShift.some((v, i) => v !== outMod[i]));

  // The report layer, and its own mutation control. `passSweep` reads its pass
  // count out of the derived solver; hand it a solver that does NOT count and the
  // histogram collapses to a single bucket at 1, which is exactly the shape a
  // silently-wrong pass counter takes.
  const r = await L.runSweep(spec, { instrument: inst, yieldNow: () => Promise.resolve() });
  check('the page\'s own sweep finds no disagreement with T.add anywhere in the block',
    r.wrongSum === 0 && r.wrongCarry === 0 && r.unresolved === 0 && r.unsettled === 0
    && r.compared === pairCount, JSON.stringify([r.wrongSum, r.wrongCarry, r.unresolved, r.unsettled]));

  const truth = {};
  for (let i = 0; i < pairCount; i++) {
    let k = 0;
    for (const cand of Object.keys(r.passes).map(Number).filter(x => x > 0).sort((a, b) => a - b)) {
      NP.seedCodes(Pmod, codes, i * ic);
      if (NP.run(Pmod, cand)) { k = cand; break; }
    }
    if (k > 0) { NP.seedCodes(Pmod, codes, i * ic); if (NP.run(Pmod, k - 1)) k = -1; }
    truth[k] = (truth[k] || 0) + 1;
  }
  check('   and every pass count it reports is confirmed by R1 at k and refuted at k-1',
    JSON.stringify(truth) === JSON.stringify(r.passes),
    `R1 ${JSON.stringify(truth)} vs page ${JSON.stringify(r.passes)}`);

  const blind = W.fn('solvePasses', {
    params: L.solvePassesFn.params, locals: L.solvePassesFn.locals,
    results: L.solvePassesFn.results,
    body: [W.ret(W.konst(1))],
  });
  const mutant = await L.SW.makeR2({
    fns: L.SW.FUNCS.concat([blind, L.passSweepFn]),
    exports: L.LAB_EXPORTS,
  });
  const rm = await L.runSweep(spec, { instrument: mutant, yieldNow: () => Promise.resolve() });
  check('a solver that answers "settled" without counting is caught by that confirmation',
    JSON.stringify(rm.passes) !== JSON.stringify(r.passes)
    && Object.keys(rm.passes).join() === '1', JSON.stringify(rm.passes));

  // Chunk-size invariance. The sweep is cut into blocks so a tab stays alive, and a
  // block boundary that leaked seeding state would be invisible in any single run:
  // every pair would still be seeded, just from the wrong place, and the answer
  // would look like a finding about the network.
  const opts = { instrument: inst, yieldNow: () => Promise.resolve() };
  const small = await L.runSweep(spec, Object.assign({ chunk: 7 }, opts));
  const shape = x => JSON.stringify([x.compared, x.wrongSum, x.wrongCarry,
    x.unresolved, x.unsettled, x.passes]);
  check('cutting the same sweep into chunks of 7 instead of 4096 changes nothing',
    shape(small) === shape(r), `${shape(small)} vs ${shape(r)}`);
}

console.log('\n=== 5. THE CONTROLS ===');
{
  const { L, byId } = loadPage({ withDom: true });
  await L.ready();
  check('the page script runs against a DOM and emits its module at load, not on click',
    /bytes, emitted here at load time/.test(byId['i-bytes'].textContent),
    byId['i-bytes'].textContent);
  check('   and it says how many nodes the pass counter substituted',
    /^1 node substituted into solve/.test(byId['i-derived'].textContent),
    byId['i-derived'].textContent);

  // The selectors are populated from the page's own lists, so this cannot pass
  // against a page that offers fewer designs than it defines.
  check('every selector offers exactly what the page defines',
    byId['c-family'].children.length === L.FAMILIES.length &&
    byId['c-restore'].children.length === L.RESTORES.length &&
    byId['c-cin'].children.length === L.CARRY_INS.length &&
    byId['c-stride'].children.length === L.STRIDES.length);

  // The cost table is the page's comparison, and it is drawn nowhere else.
  const rows = () => byId['cost-body'].children.map(tr => tr.children.map(td => td.textContent));
  const defined = L.costRows();
  check('the cost table has a row for every design plus the binary one it is read against',
    rows().length === defined.length && rows().length === L.FAMILIES.length * L.RESTORES.length + 1,
    String(rows().length));
  check('   and its numbers are the builders\' own cost(), not transcribed',
    rows().every((row, i) => row[1].replace(/,/g, '') === String(defined[i].switches)
      && row[2].replace(/,/g, '') === String(defined[i].midRail)));
  check('the mid-rail taps are their own column and are never the switch count',
    defined.every(r => r.midRail !== r.switches) &&
    rows().every(row => row.length === 4));
  const bin = defined[defined.length - 1];
  check('the binary row taps the mid rail zero times and every ternary row taps it',
    bin.midRail === 0 && bin.rails === 2 &&
    defined.slice(0, -1).every(r => r.midRail > 0 && r.rails === 3),
    JSON.stringify(defined.map(r => r.midRail)));
  check('   and it is the narrowest binary adder covering the same state count',
    L.BINARY_BITS === Math.ceil(Math.log2(T.TRYTE_STATES)) &&
    Math.pow(2, L.BINARY_BITS) >= T.TRYTE_STATES &&
    Math.pow(2, L.BINARY_BITS - 1) < T.TRYTE_STATES);
  check('the selected design is the marked row, and marking follows the control',
    byId['cost-body'].children[0].className === 'here');
  byId['c-family'].value = 'decoded';
  byId['c-family'].dispatch('change');
  check('   switching to the decoded selector moves the mark to its row',
    byId['cost-body'].children[0].className !== 'here' &&
    byId['cost-body'].children.filter(tr => tr.className === 'here').length === 1);

  // A sample must not read as a sweep.
  byId['c-stride'].value = '1';
  byId['c-stride'].dispatch('change');
  check('at stride 1 the page says the domain is exhaustive and names its size',
    /^Exhaustive: all 531,441 operand pairs/.test(byId['s-domain'].textContent),
    byId['s-domain'].textContent);
  byId['c-stride'].value = '37';
  byId['c-stride'].dispatch('change');
  check('   and at any other stride it says outright that it is a sample',
    /^Sampled, and said so: 400 of 531,441 pairs, one in 1369/.test(byId['s-domain'].textContent),
    byId['s-domain'].textContent);
}

console.log('\n=== 6. RUNNING A SWEEP FROM THE PAGE ===');
{
  const { L, byId } = loadPage({ withDom: true });
  await L.ready();
  byId['c-family'].value = 'decoded';
  byId['c-restore'].value = 'none';
  byId['c-cin'].value = '1';
  byId['c-stride'].value = '37';
  byId['c-family'].dispatch('change');

  check('nothing has run yet', byId['r-pairs'].textContent === '');
  byId['b-run'].dispatch('click');
  // The click starts an async chunked sweep; drain the frame queue it schedules.
  for (let i = 0; i < 200 && byId['b-run'].disabled; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  check('Run drives a sweep to completion and re-enables itself',
    byId['b-run'].disabled === false && byId['b-stop'].disabled === true);
  check('   the progress line reports every pair of the sampled domain',
    /^400 \/ 400 pairs   100\.0%/.test(byId['s-progress'].textContent),
    byId['s-progress'].textContent);
  check('   and the bar is full', byId['bar-fill'].style.width === '100.0%',
    byId['bar-fill'].style.width);
  check('the page reports agreement with T.add and says so in the tag',
    byId['s-tag'].textContent === 'agrees with T.add' &&
    byId['r-sum'].textContent === '0' && byId['r-carry'].textContent === '0' &&
    byId['r-unresolved'].textContent === '0' && byId['r-unsettled'].textContent === '0',
    byId['s-tag'].textContent);
  check('   and the count it agreed over is the whole block, not a survivor set',
    byId['r-pairs'].textContent === '400 of 400', byId['r-pairs'].textContent);

  // The histogram, against the same networks solved here.
  const hist = byId['hist-body'].children.map(tr =>
    [tr.children[0].textContent, Number(tr.children[1].textContent.replace(/,/g, ''))]);
  check('the histogram has a row per bucket and the rows sum to the pairs swept',
    hist.length > 1 && hist.reduce((s, r) => s + r[1], 0) === 400,
    JSON.stringify(hist));
  check('   and it says that this network\'s settling time depends on the operands',
    /^More than one bucket: settling time depends on the operands, from \d+ passes to \d+\.$/
      .test(byId['hist-verdict'].textContent), byId['hist-verdict'].textContent);
  check('   and every bar got a width, so the column is drawn and not blank',
    byId['hist-body'].children.every(tr =>
      /^\d+%$/.test(tr.children[2].children[0].style.width)));

  // The tree adder is the other case: one bucket, and the page must say the
  // opposite thing rather than the same thing.
  byId['c-family'].value = 'tree';
  byId['c-cin'].value = '0';
  byId['c-family'].dispatch('change');
  byId['b-run'].dispatch('click');
  for (let i = 0; i < 200 && byId['b-run'].disabled; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  check('the tree adder gives one bucket, and the page reports independence rather '
    + 'than repeating the dependent wording',
    byId['hist-body'].children.length === 1 &&
    /^One bucket: every pair took the same \d+ passes/.test(byId['hist-verdict'].textContent),
    byId['hist-verdict'].textContent);
}

console.log('\n=== 7. THEME STRUCTURE ===');
const css = html.split('<style>')[1].split('</style>')[0];
const S = structure(css);
{
  check('the page defines a dark palette at all', S.hasDark);
  check('every token has a base :root definition, so the un-stamped default resolves',
    S.orphanTokens.length === 0, S.orphanTokens.join(', '));
  check('every bare var() reference resolves to a token that exists',
    S.danglingVars.length === 0, S.danglingVars.join(', '));
  check('the media-query dark palette matches the [data-theme="dark"] one exactly',
    S.themesDisagree.length === 0, S.themesDisagree.join(', '));
  check('body paints an explicit background, so it never borrows the host ground',
    /body\s*\{[^}]*background:\s*var\(--paper\)/.test(css));
  check('no hex literal contains a non-ASCII character', !S.nonAsciiHex);
  check('color-scheme is declared in all three states, so form controls follow',
    (css.match(/\bcolor-scheme:\s*(light|dark)\s*;/g) || []).length === 3,
    String((css.match(/\bcolor-scheme:\s*(light|dark)\s*;/g) || []).length));
  check('no bare #fff / #000 is painted on an accent fill',
    !/color:\s*#(fff|000)(fff|000)?\s*;/i.test(css));
}

/* Every place this page paints text on a background. The header and the closing
 * note sit on --paper rather than on a panel, which is a pair neither existing
 * theme suite covers. */
const PAIRS = [
  ['body text on the ground',       '--ink',       '--paper',    4.5],
  ['the lede on the ground',        '--ink-2',     '--paper',    4.5],
  ['a note on the ground',          '--ink-3',     '--paper',    3.0],
  ['body text on a panel',          '--ink',       '--surface',  4.5],
  ['a section heading',             '--ink-2',     '--surface',  4.5],
  ['a note inside a panel',         '--ink-3',     '--surface',  3.0],
  ['a fact label',                  '--ink-3',     '--surface',  3.0],
  ['a table head',                  '--ink-3',     '--surface',  3.0],
  ['a control',                     '--ink',       '--sunken',   4.5],
  ['the Run button',                '--on-accent', '--pos',      4.5],
  ['the selected design row',       '--pos',       '--pos-bg',   4.5],
  ['the mid-rail column',           '--zero',      '--zero-bg',  3.0],
  ['the agrees tag',                '--pos',       '--pos-bg',   4.5],
  ['the diverged tag',              '--neg',       '--neg-bg',   4.5],
  ['the idle tag',                  '--zero',      '--zero-bg',  3.0],
];

for (const [label, pal] of [['LIGHT', S.light], ['DARK', S.dark]]) {
  console.log(`\n=== ${label === 'LIGHT' ? '8' : '9'}. ${label} THEME CONTRAST ===`);
  for (const [what, fg, bg, min] of PAIRS) {
    const a = pal[fg], b = pal[bg];
    if (!a || !b) { check(`${what} — both tokens exist`, false, `${fg} ${bg}`); continue; }
    const r = ratio(a, b);
    check(`${what} — ${r.toFixed(2)}:1 (needs ${min})`, r >= min, `${a} on ${b}`);
  }
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
