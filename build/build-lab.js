'use strict';
/* build-lab.js — inline the switch-level source into docs/tryte-lab.html.
 *
 * The second entry point beside `build-artifact.js`, and it carries the same gate
 * for the same reason. That one re-runs the demo programs through the BUNDLED code
 * and through the module code and refuses to write on a divergence. This one runs a
 * real switch-level sweep both ways: the page's own R2 instance, emitted from the
 * bundled `wasm-emit.js` and driven over a network packed by the bundled
 * `netpack.js`, against `src/netpack.js` required normally — and, on a sample,
 * against `src/device.js` itself, so the page is never compared only to R1.
 *
 * A SECOND IMPLEMENTATION THAT IS NEVER COMPARED IS JUST AN UNCHECKED CLAIM. The
 * page is a second copy of every one of those five files. It is allowed to exist
 * because this gate holds it against the first copy on every build.
 *
 *   node build/build-lab.js            build the page, gate first
 *   node build/build-lab.js --check    gate, then compare against the committed
 *                                      page and write nothing
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildLabBundle, LAB_BEGIN, LAB_END, ROOT, read } = require('./bundle.js');

const T = require(path.join(ROOT, 'src/ternary.js'));
const D = require(path.join(ROOT, 'src/device.js'));
const NP = require(path.join(ROOT, 'src/netpack.js'));

const OUT = path.join(ROOT, 'docs', 'tryte-lab.html');
const CHECK = process.argv.includes('--check');

/* --- render --------------------------------------------------------------- */

function render() {
  const bundle = buildLabBundle();
  const html = read('build/lab-template.html')
    .replace('/*__LAB_BUNDLE__*/', () => bundle);
  if (html.indexOf(LAB_BEGIN) < 0 || html.indexOf(LAB_END) < 0) {
    throw new Error('the lab template lost its bundle markers');
  }
  return html;
}

/**
 * Run the page's script with no DOM at all, and hand back what it exported.
 *
 * `TextEncoder` and `WebAssembly` are passed in because a `vm` context gets the
 * ECMAScript intrinsics and nothing else — both are globals in a browser, which is
 * the environment this page is actually for. There is no `document`, so the page's
 * UI block declines and only `__LAB_EXPORT__` is left, which is the point: a sweep
 * that can only be driven by clicking is a sweep nobody can hold against `src/`.
 */
function loadPage(html) {
  const script = html.split('<script>')[1].split('</script>')[0];
  const sandbox = { console, TextEncoder, WebAssembly };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  if (!sandbox.__LAB_EXPORT__) throw new Error('the page exported nothing');
  return sandbox.__LAB_EXPORT__;
}

/* --- the anti-divergence gate --------------------------------------------- */

/** Operand codes for a block of pairs, in the order the page sweeps them. */
function codesFor(L, values, cin) {
  const w = L.WIDTH, ic = L.INPUT_NAMES.length, axis = values.length;
  const codes = new Uint8Array(axis * axis * ic);
  for (let i = 0; i < axis * axis; i++) {
    const ta = T.toTrits(values[(i / axis) | 0], w);
    const tb = T.toTrits(values[i % axis], w);
    for (let j = 0; j < w; j++) {
      codes[i * ic + j] = ta[j] + 3;
      codes[i * ic + w + j] = tb[j] + 3;
    }
    codes[i * ic + 2 * w] = cin + 3;
  }
  return codes;
}

/** The module-side network, built from `src/` rather than from the page's copy. */
function moduleNet(spec, L) {
  const net = new D.Net();
  const opts = { restore: spec.restore };
  if (spec.family === 'decoded') D.dRippleAdder(net, L.WIDTH, opts);
  else D.tRippleAdder(net, L.WIDTH, opts);
  return net;
}

const STRIDE = 37;          // 20 values an axis, 400 pairs, the whole range covered

async function gate(L, report) {
  const bad = [];
  const say = m => { bad.push(m); };
  const inst = await L.instrument();
  const values = L.operandValues(STRIDE);
  const axis = values.length;
  const pairCount = axis * axis;
  const ic = L.INPUT_NAMES.length, oc = L.OUTPUT_NAMES.length;

  let sweeps = 0, pairsCompared = 0, r0Solves = 0;

  for (const [family] of L.FAMILIES) {
    for (const [restore] of L.RESTORES) {
      for (const cin of L.CARRY_INS) {
        const spec = { family, restore, cin, stride: STRIDE };
        const label = `${family}/${restore} cin=${cin}`;
        const codes = codesFor(L, values, cin);

        /* (a) THE BYTES. The page's R2, emitted by the bundled emitter and driven
         * over a network the bundled packer built, against R1 out of `src/`. */
        const Ppage = L.NP.pack(L.buildNetwork(spec), L.INPUT_NAMES);
        const net = moduleNet(spec, L);
        const Pmod = NP.pack(net, L.INPUT_NAMES);
        if (Ppage.nodeCount !== Pmod.nodeCount || Ppage.deviceCount !== Pmod.deviceCount) {
          say(`${label}: the bundled builder made a different network`
            + ` (${Ppage.nodeCount}/${Ppage.deviceCount} vs ${Pmod.nodeCount}/${Pmod.deviceCount})`);
          continue;
        }
        const idsPage = Int32Array.from(L.OUTPUT_NAMES.map(nm => L.NP.nodeId(Ppage, nm)));
        const idsMod = Int32Array.from(L.OUTPUT_NAMES.map(nm => NP.nodeId(Pmod, nm)));
        const outPage = new Uint8Array(pairCount * oc);
        const outMod = new Uint8Array(pairCount * oc);
        const unPage = inst.sweep(Ppage, codes, pairCount, idsPage, outPage, L.CAP);
        const unMod = NP.sweepPacked(Pmod, codes, pairCount, idsMod, outMod, L.CAP);
        if (unPage !== unMod) say(`${label}: ${unPage} unsettled in the page, ${unMod} in the modules`);
        for (let i = 0; i < outPage.length; i++) {
          if (outPage[i] !== outMod[i]) { say(`${label}: output byte ${i} differs`); break; }
        }
        sweeps++;
        pairsCompared += pairCount;

        /* (b) AND R0, so the page is not compared only against R1. Four pairs
         * through `src/device.js` itself — the oracle, string keys and all. */
        for (const i of [0, 1, (pairCount / 2) | 0, pairCount - 1]) {
          const inputs = {};
          for (let j = 0; j < ic; j++) inputs[L.INPUT_NAMES[j]] = codes[i * ic + j] - 3;
          let sol = null;
          try { sol = net.solve(inputs, L.CAP); } catch (e) { sol = null; }
          if (sol === null) { if (unMod === 0) say(`${label}: R0 did not settle where R1 did`); continue; }
          r0Solves++;
          for (let j = 0; j < oc; j++) {
            const want = sol[L.OUTPUT_NAMES[j]];
            const code = want === 'Z' ? 0 : want === 'X' ? 1 : want + 3;
            if (outPage[i * oc + j] !== code) {
              say(`${label}: R0 says ${JSON.stringify(want)} for ${L.OUTPUT_NAMES[j]} on pair ${i}`);
            }
          }
        }
      }
    }
  }

  /* (c) THE REPORT, which is the layer the byte comparison above cannot see: the
   * page's own oracle arithmetic and its pass-count histogram. */
  {
    const spec = { family: 'decoded', restore: 'none', cin: 1, stride: STRIDE };
    const r = await L.runSweep(spec, { instrument: inst, yieldNow: () => Promise.resolve() });
    if (r.wrongSum || r.wrongCarry || r.unresolved || r.unsettled) {
      say(`the page's own sweep reports ${r.wrongSum} wrong sums, ${r.wrongCarry} wrong`
        + ` carries, ${r.unresolved} unresolved, ${r.unsettled} unsettled: ${r.first}`);
    }
    if (r.compared !== r.pairCount) say(`the page compared ${r.compared} of ${r.pairCount} pairs`);

    // The same oracle agreement, recomputed here out of src/ rather than taken on
    // the page's word: R1's outputs against T.add, pair by pair.
    const net = moduleNet(spec, L);
    const P = NP.pack(net, L.INPUT_NAMES);
    const codes = codesFor(L, values, spec.cin);
    const ids = Int32Array.from(L.OUTPUT_NAMES.map(nm => NP.nodeId(P, nm)));
    const out = new Uint8Array(pairCount * oc);
    NP.sweepPacked(P, codes, pairCount, ids, out, L.CAP);
    let wrong = 0;
    for (let i = 0; i < pairCount; i++) {
      const a = values[(i / axis) | 0], b = values[i % axis];
      const sum = T.add(T.add(a, b), spec.cin);
      const carry = (a + b + spec.cin - sum) / T.TRYTE_STATES;
      const trits = [];
      for (let j = 0; j < L.WIDTH; j++) trits.push(out[i * oc + j] - 3);
      if (T.fromTrits(trits) !== sum || out[i * oc + L.WIDTH] - 3 !== carry) wrong++;
    }
    if (wrong) say(`${wrong} pairs disagree with T.add when recomputed out of src/`);

    const mine = passHistogram(P, codes, ic, Object.keys(r.passes).map(Number), L.CAP, pairCount);
    for (const problem of mine.problems) say(problem);
    if (JSON.stringify(mine.hist) !== JSON.stringify(r.passes)) {
      say(`pass histograms differ: page ${JSON.stringify(r.passes)},`
        + ` R1 ${JSON.stringify(mine.hist)}`);
    }
    report.histogram = r.passes;
  }

  /* (d) CHUNK-SIZE INVARIANCE. The sweep is chunked so a browser tab stays alive,
   * and a chunk boundary that leaked seeding state would be invisible in any single
   * run. Two chunk sizes over the same domain must give the same report. */
  {
    const spec = { family: 'tree', restore: 'mid', cin: -1, stride: STRIDE };
    const opts = { instrument: inst, yieldNow: () => Promise.resolve() };
    const big = await L.runSweep(spec, Object.assign({ chunk: 1 << 12 }, opts));
    const small = await L.runSweep(spec, Object.assign({ chunk: 7 }, opts));
    const shape = r => JSON.stringify([r.compared, r.wrongSum, r.wrongCarry,
      r.unresolved, r.unsettled, r.passes]);
    if (shape(big) !== shape(small)) {
      say(`chunking changes the answer: ${shape(big)} at 4096, ${shape(small)} at 7`);
    }
  }

  report.sweeps = sweeps;
  report.pairsCompared = pairsCompared;
  report.r0Solves = r0Solves;
  return bad;
}

/**
 * R1's own pass-count histogram over the same block, built INDEPENDENTLY of the
 * page's counts and then compared against them.
 *
 * The pass count is CONFIRMED, not searched for. Scanning k upward from 1 costs up
 * to k solves per pair and is `T-SEARCH-WHERE-A-CHECK-WOULD-DO` exactly; instead
 * this takes the candidate values as a set — the buckets the page claims exist —
 * finds the smallest candidate the pair settles at, and then checks that it does
 * NOT settle one pass earlier, which pins the count.
 *
 * The page cannot hide a wrong answer inside the candidate set. A bucket that is
 * not there at all leaves some pair settling at no candidate, and that pair is
 * re-solved at the cap to tell "the page's set is short" apart from "this pair
 * genuinely never settles". A bucket with the wrong COUNT changes this histogram
 * and not the page's, so the two stop matching.
 */
function passHistogram(P, codes, ic, candidates, cap, pairCount) {
  const ks = candidates.filter(k => k > 0).sort((a, b) => a - b);
  const hist = {};
  const problems = [];
  for (let i = 0; i < pairCount; i++) {
    let k = 0;
    for (const cand of ks) {
      NP.seedCodes(P, codes, i * ic);
      if (NP.run(P, cand)) { k = cand; break; }
    }
    if (k === 0) {
      NP.seedCodes(P, codes, i * ic);
      if (NP.run(P, cap)) {
        problems.push(`pair ${i} settles inside the cap at a pass count the page's`
          + ` histogram has no bucket for (${ks.join(', ')})`);
        continue;
      }
    } else {
      NP.seedCodes(P, codes, i * ic);
      if (NP.run(P, k - 1)) problems.push(`pair ${i} settles at ${k - 1}, not ${k}`);
    }
    hist[k] = (hist[k] || 0) + 1;
  }
  return { hist, problems };
}

/* --- run ------------------------------------------------------------------ */

async function main() {
  const html = render();
  const L = loadPage(html);
  const report = {};
  const bad = await gate(L, report);
  if (bad.length) {
    console.error('DIVERGENCE between the bundled page and src/:');
    for (const b of bad.slice(0, 10)) console.error(`  ${b}`);
    process.exit(1);
  }
  console.log(`gate: ${report.sweeps} sweeps, ${report.pairsCompared.toLocaleString()} pairs`
    + ` compared byte for byte against src/, ${report.r0Solves} of them against R0 too`);
  console.log(`      pass-count buckets: ${JSON.stringify(report.histogram)}`);

  if (CHECK) {
    const committed = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
    if (committed === null) { console.error(`${path.relative(ROOT, OUT)} does not exist`); process.exit(1); }
    if (committed !== html) {
      console.error(`${path.relative(ROOT, OUT)} is stale — run \`npm run build:lab\``);
      process.exit(1);
    }
    console.log(`      ${path.relative(ROOT, OUT)} matches the template and src/`);
    return;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  console.log(`wrote ${path.relative(ROOT, OUT)}  (${(html.length / 1024).toFixed(1)} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
