'use strict';
/* test-axioms.js — the foundations of src/device.js, proved rather than asserted.
 *
 * src/device.js states eighteen things it depends on: six about a single switch
 * (D1-D6), eight about how a network resolves (N1-N8), and four theorems a circuit
 * built on those may rely on (T1-T4). Every one of them is proved here, and the
 * domains are small enough that "proved" means EXHAUSTIVELY, not by example.
 *
 * Two further sections keep the proofs honest.
 *
 *   COMPLETENESS parses the axiom ids out of src/device.js and checks them against
 *   the ids proved here, in both directions, so neither list can drift from the
 *   other. It then doctors the parsed list and confirms the check notices.
 *
 *   THE X SET pins what tools/axiom-audit.js measured, so those numbers cannot
 *   drift unnoticed. X2 is kept as a FAILED prediction: it assumed every seed of
 *   the self-inverter resolves to something, and two of the three do not.
 *
 *   TEETH breaks the solver three ways and requires the proofs to catch it. Every
 *   proof is written against a MODULE rather than against the import, so the whole
 *   suite can be re-run against a mutant. The expected failure sets are pinned,
 *   which makes this a map of what each axiom is actually holding up: a proof that
 *   fails for every mutation is not telling you which one it caught.
 *
 * WHAT THIS IS NOT. It does not show the model is physically realistic; see the
 * stated limits at the top of src/device.js, chiefly that the middle rail is free.
 * It shows the model is the model it says it is.
 *
 * tools/axiom-audit.js does the complementary job: it breaks the axioms on purpose
 * to find out which were load-bearing. N7 is worded the way it is because that
 * audit caught it claiming something false.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const D = require('../src/device.js');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

const L = [-1, 0, 1];
const isLevel = v => v === -1 || v === 0 || v === 1;
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);

/**
 * Everything a proof needs, bound to one copy of the device module. Proofs take
 * this rather than closing over the import, so the TEETH section can hand them a
 * deliberately broken module and see which of them notice.
 */
function harness(M) {
  const GATES = [
    { name: 'STI', arity: 1, build: M.sti, ref: a => -a },
    { name: 'NTI', arity: 1, build: M.nti, ref: a => (a === -1 ? 1 : -1) },
    { name: 'PTI', arity: 1, build: M.pti, ref: a => (a === 1 ? -1 : 1) },
    { name: 'MIN', arity: 2, build: M.tmin, ref: (a, b) => Math.min(a, b) },
    { name: 'MAX', arity: 2, build: M.tmax, ref: (a, b) => Math.max(a, b) },
  ];
  const gateNet = (g, rails) => {
    const net = new M.Net(rails || M.RAILS);
    if (g.arity === 1) g.build(net, 'a', 'o'); else g.build(net, 'a', 'b', 'o');
    return net;
  };
  /**
   * Recover the conduction predicate BEHAVIOURALLY, without reading the solver's
   * source. One device between a rail and an otherwise unreachable node: the node
   * is driven exactly when the device conducts.
   */
  const probe = (kind, vt, rail) => {
    const net = new M.Net();
    net[kind]('g', vt, rail, 'o');
    return L.map(g => net.solve({ g }).o !== 'Z');
  };
  const selfInverter = () => { const net = new M.Net(); M.sti(net, 'o', 'o'); return net; };
  const rowsOf = g => (g.arity === 1 ? L.map(a => ({ a })) : L.flatMap(a => L.map(b => ({ a, b }))));
  const want = (g, r) => (g.arity === 1 ? g.ref(r.a) : g.ref(r.a, r.b));
  const KINDS = [['n', -1], ['n', 0], ['n', 1], ['p', -1], ['p', 0], ['p', 1]];
  return { M, GATES, gateNet, probe, selfInverter, rowsOf, want, KINDS };
}

/* ------------------------------------------------------------------ the proofs */

const PROOFS = [
  { id: 'D1', name: 'conduction depends on the gate alone — same answer through any rail, every time',
    fn: ({ probe, KINDS }) => {
      for (const [kind, vt] of KINDS) {
        const viaVdd = probe(kind, vt, 'vdd');
        if (!eq(viaVdd, probe(kind, vt, 'vss'))) return false;      // not the terminals
        if (!eq(viaVdd, probe(kind, vt, 'vmid'))) return false;
        if (!eq(viaVdd, probe(kind, vt, 'vdd'))) return false;      // not the history
      }
      return true;
    } },

  { id: 'D2', name: 'thresholds are monotone — n non-decreasing in gate level, p non-increasing',
    fn: ({ probe, KINDS }) => {
      for (const [kind, vt] of KINDS) {
        const c = probe(kind, vt, 'vdd');
        for (let i = 1; i < c.length; i++) {
          if (kind === 'n' && c[i - 1] && !c[i]) return false;
          if (kind === 'p' && !c[i - 1] && c[i]) return false;
        }
      }
      return true;
    } },

  { id: 'D3', name: 'the threshold is inclusive — n(t) and p(t) conduct at t, and overlap only there',
    fn: ({ probe }) => {
      for (const vt of L) {
        const n = probe('n', vt, 'vdd'), p = probe('p', vt, 'vdd');
        const i = L.indexOf(vt);
        if (!n[i] || !p[i]) return false;                           // both conduct AT t
        if (!eq(L.filter((_, k) => n[k] && p[k]), [vt])) return false;   // and nowhere else
      }
      return true;
    } },

  { id: 'D4', name: 'terminals are interchangeable — every gate is unchanged by swapping a and b',
    fn: ({ M, GATES, gateNet, rowsOf }) => {
      for (const g of GATES) {
        const orig = gateNet(g);
        const flipped = new M.Net(orig.rails);
        flipped.devices = orig.devices.map(d => ({ ...d, a: d.b, b: d.a }));
        for (const r of rowsOf(g)) if (orig.solve(r).o !== flipped.solve(r).o) return false;
      }
      return true;
    } },

  { id: 'D5', name: 'the gate controls and does not conduct',
    fn: ({ M, GATES, gateNet }) => {
      // Structural: no gate design uses a node as both its own control and terminal.
      for (const g of GATES) {
        for (const d of gateNet(g).devices) if (d.gate === d.a || d.gate === d.b) return false;
      }
      // Behavioural: a node that is only ever a gate is never driven by being one.
      const net = new M.Net();
      net.n('g', M.MID, 'vdd', 'o');
      return net.solve({}).g === 'Z';
    } },

  { id: 'D6', name: 'an unknown gate gives unknown conduction — floating is not off, contended is not off',
    fn: ({ M }) => {
      // Floating gate. If Z read as "off", o would be Z; it must be X.
      const a = new M.Net();
      a.n('f', M.MID, 'vdd', 'o');
      if (a.solve({}).o !== 'X') return false;
      // Contended gate, built rather than assumed: c is pulled by two rails at once.
      const b = new M.Net();
      b.n('g', M.LOW, 'vdd', 'c'); b.n('g', M.LOW, 'vss', 'c');
      b.n('c', M.MID, 'vdd', 'o');
      const sol = b.solve({ g: M.HIGH });
      return sol.c === 'X' && sol.o === 'X';
    } },

  { id: 'N1', name: 'rails are fixed — a network cannot move one',
    fn: ({ M }) => {
      const net = new M.Net();
      net.n('g', M.LOW, 'vdd', 'vss');            // a dead short across the supply
      const sol = net.solve({ g: M.HIGH });
      return sol.vss === M.LOW && sol.vdd === M.HIGH && sol.vmid === M.MID;
    } },

  { id: 'N2', name: 'a driven node is a terminal — signal does not pass through a rail',
    fn: ({ M }) => {
      // vdd -- on -- vss -- on -- o.  If reachability ran THROUGH vss, o would look
      // contended between vdd and vss. It is driven by vss alone.
      const net = new M.Net();
      net.n('g', M.LOW, 'vdd', 'vss');
      net.n('g', M.LOW, 'vss', 'o');
      if (net.solve({ g: M.HIGH }).o !== M.LOW) return false;
      // And the case that first caught it: a gate output driving a gate input.
      const chain = new M.Net();
      M.sti(chain, 'a', 'na'); M.tmin(chain, 'na', 'b', 'o');
      return chain.solve({ a: 1, b: 1 }).na === -1;
    } },

  { id: 'N3', name: 'one rail determines — a node reachable from exactly one rail takes its level',
    fn: ({ M }) => {
      for (const [rail, level] of Object.entries(M.RAILS)) {
        const net = new M.Net();
        net.n('g', M.LOW, rail, 'o');
        if (net.solve({ g: M.HIGH }).o !== level) return false;
      }
      return true;
    } },

  { id: 'N4', name: 'two rails is X, for every pair',
    fn: ({ M }) => {
      const rails = Object.keys(M.RAILS);
      for (let i = 0; i < rails.length; i++) for (let j = i + 1; j < rails.length; j++) {
        const net = new M.Net();
        net.n('g', M.LOW, rails[i], 'o'); net.n('g', M.LOW, rails[j], 'o');
        if (net.solve({ g: M.HIGH }).o !== 'X') return false;
      }
      return true;
    } },

  { id: 'N5', name: 'no rail is Z — floating is distinguishable from every level and from X',
    fn: ({ M }) => {
      const net = new M.Net();
      net.n('g', M.HIGH, 'vdd', 'o');
      return net.solve({ g: M.LOW }).o === 'Z';
    } },

  { id: 'N6', name: 'unknowns only subtract — a possible extra path can lose determinacy, never gain it',
    fn: ({ M, GATES, gateNet, rowsOf }) => {
      // Add one device with a floating gate between vdd and each gate's output. The
      // output may only become LESS determined: a level may go to X, and nothing may
      // go from X to a level or from one level to another.
      for (const g of GATES) {
        for (const r of rowsOf(g)) {
          const before = gateNet(g).solve(r).o;
          const dirty = gateNet(g);
          dirty.n('floats', M.MID, 'vdd', 'o');
          const after = dirty.solve(r).o;
          if (after === before) continue;                  // unchanged is allowed
          if (after !== 'X') return false;                 // anything else is a gain
          if (!isLevel(before)) return false;              // and it must have LOST something
        }
      }
      return true;
    } },

  { id: 'N7', name: 'termination holds from the default start — and does not hold in general',
    fn: ({ GATES, gateNet, rowsOf, selfInverter }) => {
      // (a) From the all-Z start, everything settles, cycles included.
      for (const g of GATES) for (const r of rowsOf(g)) {
        if (gateNet(g).solve(r).o === undefined) return false;
      }
      const cyc = selfInverter();
      if (cyc.solve({}).o !== 'X') return false;
      // (b) Seeded at a level it oscillates and the solver refuses to answer. This is
      // the half the axiom used to deny; tools/axiom-audit.js X2 is what caught it.
      let threw = 0;
      for (const seed of [-1, 1]) {
        try { cyc.solve({}, 64, { o: seed, 'o$mid': 'Z' }); } catch (e) { threw++; }
      }
      return threw === 2;
    } },

  { id: 'N8', name: 'justified, not merely consistent — the fixed point is not unique',
    fn: ({ selfInverter }) => {
      const cyc = selfInverter();
      // Two fixed points. The solver reaches the one it can justify from the start.
      if (cyc.solve({}).o !== 'X') return false;
      if (cyc.solve({}, 64, { o: 0, 'o$mid': 'Z' }).o !== 0) return false;
      // And the initial state is checked, not trusted.
      let rejected = 0;
      try { cyc.solve({}, 64, { vss: 1 }); } catch (e) { rejected++; }
      try { cyc.solve({}, 64, { nosuchnode: 0 }); } catch (e) { rejected++; }
      return rejected === 2;
    } },

  { id: 'T1', name: 'totality — every gate gives a level on every input, never X, never Z',
    fn: ({ GATES, gateNet, rowsOf, want }) => {
      for (const g of GATES) for (const r of rowsOf(g)) {
        const out = gateNet(g).solve(r).o;
        if (!isLevel(out) || out !== want(g, r)) return false;
      }
      return true;
    } },

  { id: 'T2', name: 'no sneak paths — exactly one rail influences the output, on every input',
    fn: ({ M, GATES, gateNet, rowsOf }) => {
      // Independent of the solver's internal reachability: vary each rail's LEVEL and
      // see which one the output follows. A rail that drives the output moves it.
      for (const g of GATES) {
        for (const r of rowsOf(g)) {
          const influencing = [];
          for (const rail of Object.keys(M.RAILS)) {
            const seen = new Set(L.map(alt => gateNet(g, { ...M.RAILS, [rail]: alt }).solve(r).o));
            if (seen.size > 1) influencing.push(rail);
          }
          if (influencing.length !== 1) return false;
          if (gateNet(g).solve(r).o !== M.RAILS[influencing[0]]) return false;
        }
      }
      return true;
    } },

  { id: 'T3', name: 'composition — wiring output to input computes the composition, over every wiring',
    fn: ({ M, GATES }) => {
      const un = GATES.filter(g => g.arity === 1), bi = GATES.filter(g => g.arity === 2);
      const cases = [];
      for (const f of un) for (const h of un) cases.push({
        build: n => { f.build(n, 'a', 'm'); h.build(n, 'm', 'o'); },
        ins: L.map(a => ({ a })), ref: r => h.ref(f.ref(r.a)),
      });
      for (const f of un) for (const h of bi) for (const pos of [0, 1]) cases.push({
        build: n => { f.build(n, 'a', 'm'); if (pos === 0) h.build(n, 'm', 'b', 'o'); else h.build(n, 'b', 'm', 'o'); },
        ins: L.flatMap(a => L.map(b => ({ a, b }))),
        ref: r => (pos === 0 ? h.ref(f.ref(r.a), r.b) : h.ref(r.b, f.ref(r.a))),
      });
      for (const f of bi) for (const h of bi) cases.push({
        build: n => { f.build(n, 'a', 'b', 'm'); h.build(n, 'm', 'c', 'o'); },
        ins: L.flatMap(a => L.flatMap(b => L.map(c => ({ a, b, c })))),
        ref: r => h.ref(f.ref(r.a, r.b), r.c),
      });
      if (cases.length !== 25) return false;
      for (const c of cases) {
        const net = new M.Net(); c.build(net);
        for (const r of c.ins) {
          const sol = net.solve(r);
          if (sol.o !== c.ref(r)) return false;
          if (!isLevel(sol.m)) return false;          // the linking node must not degrade
        }
      }
      return true;
    } },

  { id: 'T4', name: 'slice independence — gates sharing only rails do not interact',
    fn: ({ M, GATES }) => {
      for (const g of GATES.filter(x => x.arity === 2)) {
        const both = new M.Net();
        g.build(both, 'a1', 'b1', 'o1'); g.build(both, 'a2', 'b2', 'o2');
        for (const a1 of L) for (const b1 of L) for (const a2 of L) for (const b2 of L) {
          const sol = both.solve({ a1, b1, a2, b2 });
          if (sol.o1 !== g.ref(a1, b1) || sol.o2 !== g.ref(a2, b2)) return false;
        }
      }
      return true;
    } },
];

/** Run one proof against a harness. A proof that throws has not proved anything. */
const run = (p, H) => { try { return p.fn(H) === true; } catch (e) { return false; } };

const HOME = harness(D);
let section = '';
for (const p of PROOFS) {
  const s = p.id[0] === 'D' ? '=== D1-D6  THE DEVICE ==='
    : p.id[0] === 'N' ? '=== N1-N8  THE NETWORK ==='
      : '=== T1-T4  WHAT A CIRCUIT MAY RELY ON ===';
  if (s !== section) { console.log(`\n${s}`); section = s; }
  check(`${p.id}  ${p.name}`, run(p, HOME));
}

check('   and the T4 check can fail — two gates forced to share an internal node do interact', (() => {
  // Same two MINs, except the second one's mid node is renamed onto the first's.
  // If the check above could not tell the difference it would prove nothing.
  const net = new D.Net();
  D.tmin(net, 'a1', 'b1', 'o1'); D.tmin(net, 'a2', 'b2', 'o2');
  net.devices = net.devices.map(d => ({
    ...d,
    a: d.a === 'o2$m1' ? 'o1$m1' : d.a,
    b: d.b === 'o2$m1' ? 'o1$m1' : d.b,
  }));
  for (const a1 of L) for (const b1 of L) for (const a2 of L) for (const b2 of L) {
    const sol = net.solve({ a1, b1, a2, b2 });
    if (sol.o1 !== Math.min(a1, b1) || sol.o2 !== Math.min(a2, b2)) return true;   // interacted
  }
  return false;
})());

console.log('\n=== COMPLETENESS — the two lists must be the same list ===');
const DEVICE_PATH = path.join(__dirname, '..', 'src', 'device.js');
const SRC = fs.readFileSync(DEVICE_PATH, 'utf8');
{
  const stated = [...SRC.matchAll(/^ \*   ([DNT]\d+)  /gm)].map(m => m[1]);
  const statedSet = new Set(stated);
  const proved = PROOFS.map(p => p.id);

  check(`src/device.js states ${stated.length} axioms, and states each of them once`,
    stated.length === statedSet.size && stated.length > 0, stated.join(' '));
  check('every axiom stated in src/device.js is proved here',
    stated.every(id => proved.includes(id)),
    `unproved: ${stated.filter(id => !proved.includes(id)).join(', ')}`);
  check('every proof here names an axiom src/device.js states',
    proved.every(id => statedSet.has(id)),
    `not stated: ${proved.filter(id => !statedSet.has(id)).join(', ')}`);

  // The completeness check has to be able to fail, or it is decoration.
  const agree = list => list.every(id => proved.includes(id)) && proved.every(id => list.includes(id));
  check('   and the completeness check can fail — a doctored list is caught',
    agree(stated) && !agree(stated.concat(['D99'])) && !agree(stated.slice(1)));
}

console.log('\n=== TEETH — break the solver, and the right proofs must notice ===');
{
  /* Each mutation is a real defect this model could plausibly have had; two of
   * them it DID have. The expected sets are pinned because which axioms a defect
   * trips is the interesting part — a proof that fails for everything is not
   * telling you what it caught. */
  const MUTATIONS = [
    { tag: 'thresholds made strict',
      from: "d.kind === 'n' ? (g >= d.vt) : (g <= d.vt)",
      to: "d.kind === 'n' ? (g > d.vt) : (g < d.vt)",
      expect: ['D3', 'N2', 'N6', 'N7', 'N8', 'T1', 'T2', 'T3', 'T4'] },
    { tag: 'unknown conduction treated as off',
      from: "if (g === 'Z' || g === 'X' || g === undefined) return 'unknown';",
      to: "if (g === 'Z' || g === 'X' || g === undefined) return false;",
      expect: ['D6', 'N7', 'N8'] },
    { tag: 'reachability runs through rails',
      from: '      if (!driven.has(other)) stack.push(other);',
      to: '      stack.push(other);',
      expect: ['N2', 'T3'] },
  ];

  for (const m of MUTATIONS) {
    const mutated = SRC.replace(m.from, m.to);
    if (mutated === SRC) { check(`mutation target still exists: ${m.tag}`, false, m.from); continue; }
    const file = path.join(os.tmpdir(), `tryte-device-mutant-${process.pid}-${m.tag.replace(/\W+/g, '-')}.js`);
    fs.writeFileSync(file, mutated);
    let caught;
    try {
      const H = harness(require(file));
      caught = PROOFS.filter(p => !run(p, H)).map(p => p.id);
    } finally {
      delete require.cache[require.resolve(file)];
      fs.unlinkSync(file);
    }
    check(`"${m.tag}" is caught by exactly ${m.expect.join(' ')}`,
      eq(caught, m.expect), `got ${caught.join(' ') || 'nothing — the proofs are blind to this'}`);
  }
}

console.log('\n=== THE X SET — what tools/axiom-audit.js measured, pinned ===');
{
  const { GATES, gateNet, rowsOf, want, selfInverter } = HOME;

  /* X1 — strict thresholds, as a transformation of the device list. On this
   * integer domain strict n(t) is inclusive n(t+1), and a device that can never
   * conduct is indistinguishable from one that is not there. */
  const strictify = (net, which) => {
    const out = new D.Net(net.rails);
    for (const d of net.devices) {
      if (!(which === 'both' || which === d.kind)) { out.devices.push({ ...d }); continue; }
      const vt = d.kind === 'n' ? d.vt + 1 : d.vt - 1;
      if (vt > D.HIGH || vt < D.LOW) continue;
      out.devices.push({ ...d, vt });
    }
    return out;
  };
  const x1 = which => {
    let correct = 0, levels = 0;
    for (const g of GATES) {
      const net = strictify(gateNet(g), which);
      let ok = true;
      for (const r of rowsOf(g)) {
        const got = net.solve(r).o;
        if (isLevel(got)) levels++;
        if (got !== want(g, r)) ok = false;
      }
      if (ok) correct++;
    }
    return { correct, levels };
  };
  check('X1 — strict thresholds break every gate: 0 of 5 survive, in all three mutations',
    ['n', 'p', 'both'].every(w => x1(w).correct === 0));
  check('X1 — and leave 11, 11 and 2 of 27 output rows still carrying a level',
    eq([x1('n').levels, x1('p').levels, x1('both').levels], [11, 11, 2]),
    `got ${[x1('n').levels, x1('p').levels, x1('both').levels].join(' ')}`);

  /* X2 — FAILED, and kept. It predicted which seeds of the self-inverter are
   * self-consistent, assuming each of them resolves at all. Two do not: seeded at
   * a level the network oscillates forever. That is what reworded N7. */
  const cyc = selfInverter();
  const seedResult = seed => {
    try { return cyc.solve({}, 64, { o: seed, 'o$mid': 'Z' }).o; } catch (e) { return 'NEVER SETTLES'; }
  };
  check('X2 FAILED on its premise — it assumed every seed resolves; -1 and +1 never settle',
    seedResult(-1) === 'NEVER SETTLES' && seedResult(1) === 'NEVER SETTLES' && seedResult(0) === 0);
  check('X2 — its second half held: an all-X start is indistinguishable from all-Z, 0 of 27 rows differ',
    (() => {
      for (const g of GATES) {
        const nodes = new Set();
        for (const d of gateNet(g).devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
        for (const r of rowsOf(g)) {
          const net = gateNet(g);
          const driven = new Set([...Object.keys(net.rails), ...Object.keys(r)]);
          const init = Object.fromEntries([...nodes].filter(n => !driven.has(n)).map(n => [n, 'X']));
          if (net.solve(r).o !== net.solve(r, 64, init).o) return false;
        }
      }
      return true;
    })());

  /* X3 is T3 above: 25 of 25 composites, no linking node degraded. */
  check('X3 HELD — proved above as T3, over all 25 wirings',
    run(PROOFS.find(p => p.id === 'T3'), HOME));

  /* X4 — the series mid path of the standard ternary inverter is not redundant. */
  {
    const oneDevice = (kind, vt, flip) => {
      const net = new D.Net();
      net.p('a', D.LOW, 'vdd', 'o');
      net.n('a', D.HIGH, 'vss', 'o');
      const [x, y] = flip ? ['o', 'vmid'] : ['vmid', 'o'];
      net[kind]('a', vt, x, y);
      return net;
    };
    const tableOf = net => L.map(a => net.solve({ a }).o).join(' ');
    const neg = L.map(a => -a).join(' ');
    let works = 0, agree = 0;
    for (const kind of ['n', 'p']) for (const vt of L) {
      const t0 = tableOf(oneDevice(kind, vt, false)), t1 = tableOf(oneDevice(kind, vt, true));
      if (t0 === t1) agree++;
      if (t0 === neg) works++;
    }
    check('X4 HELD — 0 of 6 single-device mid paths compute NEG, so the series pair is load-bearing',
      works === 0);
    check('X4 HELD — and 6 of 6 terminal orders agree, which is D4 showing up as a halved search',
      agree === 6);
  }

  /* X5 — exhaustive minimality. Rail-to-rail devices are excluded from the space
   * because reachability stops at driven nodes, so they cannot change any value. */
  {
    const NODES = ['vss', 'vmid', 'vdd', 'out', 'm'];
    const RAIL = new Set(['vss', 'vmid', 'vdd']);
    const SPACE = [];
    for (const kind of ['n', 'p']) for (const vt of L) {
      for (let i = 0; i < NODES.length; i++) for (let j = i + 1; j < NODES.length; j++) {
        if (RAIL.has(NODES[i]) && RAIL.has(NODES[j])) continue;
        SPACE.push({ kind, gate: 'in', vt, a: NODES[i], b: NODES[j] });
      }
    }
    // Terminals are interchangeable (D4), so the key must not care about their order.
    const key = d => { const [x, y] = [d.a, d.b].sort(); return `${d.kind}${d.vt}:${x}-${y}`; };
    const show = devs => devs.map(key).sort().join('  ');
    const NEG = L.map(a => -a);
    const computesNeg = devs => {
      if (!devs.some(d => d.a === 'out' || d.b === 'out')) return false;
      const net = new D.Net(); net.devices = devs;
      try { return L.every((a, i) => net.solve({ in: a }).out === NEG[i]); } catch (e) { return false; }
    };
    const search = k => {
      const found = []; const pick = [];
      const rec = start => {
        if (pick.length === k) { if (computesNeg(pick)) found.push(show(pick)); return; }
        for (let i = start; i < SPACE.length; i++) { pick.push(SPACE[i]); rec(i); pick.pop(); }
      };
      rec(0);
      return found;
    };
    check('X5 HELD — no network of 1, 2 or 3 switches computes NEG, over 42 device types',
      [1, 2, 3].every(k => search(k).length === 0));
    const four = search(4);
    const stiKey = show([
      { kind: 'p', vt: D.LOW, a: 'vdd', b: 'out' },
      { kind: 'n', vt: D.HIGH, a: 'vss', b: 'out' },
      { kind: 'n', vt: D.MID, a: 'vmid', b: 'm' },
      { kind: 'p', vt: D.MID, a: 'm', b: 'out' },
    ]);
    check('X5 HELD — the positive control finds 4 networks at 4 switches, the standard inverter among them',
      four.length === 4 && four.includes(stiKey), `found ${four.length}`);
  }
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
