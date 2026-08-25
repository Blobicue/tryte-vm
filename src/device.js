'use strict';
/* device.js — a SWITCH-LEVEL simulator for multi-valued logic.
 *
 * THIS IS NOT SPICE. There are no currents, capacitances, delays or continuous
 * voltages here. A transistor is a switch that conducts or does not, according to
 * its gate's discrete level against a threshold, and a node takes the level of
 * whichever rail it is connected to. This is IRSIM's model with a third rail. It
 * can tell you a network computes the wrong function; it cannot tell you whether
 * the network would work in silicon.
 *
 * STATED LIMITS — the things this model assumes away, listed because they are
 * exactly the hard parts of building a real ternary device:
 *
 *   1. VMID IS A FREE RAIL. Real ternary logic must GENERATE its middle level —
 *      resistive dividers that burn static power, or dual-supply schemes. Here it
 *      is simply available, which is the single largest thing this model hides.
 *      Switch counts therefore report VMID connections in a SEPARATE column: a
 *      binary circuit needs no third rail, and a comparison that folds that
 *      dependency into one number is not a comparison.
 *   2. No level restoration or gain. A node driven through a chain of pass
 *      devices is assumed to arrive at full level. Real pass networks degrade,
 *      which is why real designs interleave restoring inverters.
 *   3. No noise margins, and three levels have thinner ones than two.
 *   4. Multi-threshold devices are counted as one switch each, though they are
 *      not equally manufacturable.
 *
 * LEVELS. -1 LOW, 0 MID, +1 HIGH, matching this project's trits. Two further
 * node states exist and are not levels:
 *   'Z'  floating — connected to no rail
 *   'X'  unresolved — contended between rails, or dependent on an unknown
 *
 *
 * ------------------------------------------------------------------------------
 * AXIOMS. Everything above this layer rests on these, so they are stated here and
 * PROVED in test/test-axioms.js — exhaustively, since the domains are tiny. That
 * test also checks completeness: every id below must have a proof, and every
 * proof must name an id here, so neither list can drift from the other.
 *
 * THE DEVICE — one switch, in isolation.
 *
 *   D1  DETERMINISM. Conduction is a function of the gate's level alone. No
 *       history, no hysteresis, no dependence on the terminals.
 *   D2  MONOTONICITY. An n-type's conduction is non-decreasing in gate level; a
 *       p-type's is non-increasing. This is what makes it a THRESHOLD device
 *       rather than an arbitrary one, and it is the property the gate designs
 *       actually exploit.
 *   D3  INCLUSIVE THRESHOLD. n(t) conducts AT t as well as above it; p(t) conducts
 *       AT t as well as below. The two therefore overlap at exactly g = t — and
 *       that overlap is load-bearing, not incidental: it is the only way this
 *       model isolates the middle level. See X1.
 *   D4  BIDIRECTIONALITY. The two terminals are interchangeable; a switch passes
 *       signal either way, as a pass transistor does and a logic gate does not.
 *   D5  GATE ISOLATION. The gate is read, never driven through. It draws nothing,
 *       and in every builder this module exports no node is both a device's
 *       control and one of its terminals. A NETWORK may still wire one that way,
 *       and the self-inverter used to prove N7 and N8 does exactly that.
 *   D6  UNKNOWN IS NOT OFF. An undetermined gate yields undetermined conduction.
 *       Treating it as non-conducting is the classic switch-simulator bug: it
 *       makes broken circuits look clean.
 *
 * THE NETWORK — how node levels are resolved.
 *
 *   N1  RAILS ARE FIXED. Nothing in the network changes a rail's level.
 *   N2  SOURCES ARE TERMINALS. A path stops at any driven node. Signal does not
 *       pass THROUGH a rail or an input. Violating this makes correct circuits
 *       resolve to X, which is a bug this model actually had.
 *   N3  ONE RAIL DETERMINES. A node connected to exactly one rail, with no other
 *       rail even possibly reaching it, takes that rail's level.
 *   N4  CONTENTION IS X. Two or more rails reaching a node leaves it unresolved.
 *   N5  ISOLATION IS Z. No rail reaching a node leaves it floating.
 *   N6  UNKNOWNS ONLY SUBTRACT. An unknown conduction can make a node less
 *       determined, never more. The solver never claims a level it cannot justify.
 *   N7  TERMINATION FROM THE DEFAULT START. Nodes firm up in gate-dependency
 *       order, and may pass THROUGH X on the way: in a chain, the far end is still
 *       unresolved on the pass that gives its gate a level, and takes a level on
 *       the pass after. A node on a gate CYCLE never gets a determined gate at
 *       all, so it lands on X and stays there — which is why the all-Z start
 *       always reaches a fixed point rather than oscillating.
 *
 *       That is a property of THAT START, not of the iteration. Seeded at a level
 *       the self-inverter runs -1 -> +1 -> -1 forever and solve() throws rather
 *       than hand back a half-settled state. Some seeds do settle; none is
 *       guaranteed to. The audit found this — the axiom used to say oscillation
 *       was impossible, full stop. See X2.
 *   N8  JUSTIFIED, NOT MERELY CONSISTENT. A level is assigned only when a
 *       conducting path from exactly one rail justifies it FROM THE CURRENT
 *       STATE. Fixed points are NOT unique, and the solver does not find the most
 *       determined one: a self-latching node has consistent, fully determined
 *       assignments it will not invent. The standard ternary inverter wired to
 *       its own input holds at MID — check the conduction rule and see — and the
 *       solver returns X for it. The initial state is therefore part of the
 *       semantics, which is why solve() takes one. See X2.
 *
 * THEOREMS — what a circuit built on the above may rely on.
 *
 *   T1  TOTALITY. A well-formed gate produces a level for every input. Never X,
 *       never Z.
 *   T2  NO SNEAK PATHS. For every input, exactly one rail is definitely connected
 *       to the output — never none, never two.
 *   T3  COMPOSITION. Wiring one gate's output to another's input computes the
 *       composition of their functions.
 *   T4  SLICE INDEPENDENCE. Gates sharing only rails do not interact, so a
 *       six-trit datapath is six copies of a one-trit gate.
 *   T5  ONLY RAIL LEVELS EXIST. A non-driven node can take a level only from a
 *       rail, and that has two consequences this model needs stated rather than
 *       assumed.
 *
 *       A level that is not some rail's CANNOT BE MADE. A divider between vss and
 *       vdd — two conducting devices, one to each — is contention, and resolves
 *       to X. So the middle level cannot be generated inside the model; it has to
 *       be given. That is why limit 1 at the top of this file is the largest one:
 *       vmid being free is not a convenience, it is a thing this vocabulary is
 *       incapable of pricing.
 *
 *       And an INPUT DOES NOT SOURCE. It gates, and it terminates a path, but a
 *       conducting device between an input and a node transfers nothing — the
 *       node is Z, not the input's level. Reachability starts at rails and only
 *       at rails. Every circuit here uses inputs purely as gates, so this has
 *       never bitten anything; it is stated so that it cannot.
 * ------------------------------------------------------------------------------
 *
 * CONDUCTION. An n-type conducts when its gate is at or above its threshold; a
 * p-type when at or below. If the gate is Z or X the conduction is UNKNOWN, and
 * unknown conduction poisons whatever it could reach. Treating unknown as "off"
 * is the classic switch-simulator bug: it makes broken circuits look clean.
 */

const LOW = -1, MID = 0, HIGH = 1;
const RAILS = { vss: LOW, vmid: MID, vdd: HIGH };
const BINARY_RAILS = { vss: LOW, vdd: HIGH };

class Net {
  /** @param {object} rails name -> level. Use BINARY_RAILS for a two-level net. */
  constructor(rails = RAILS) {
    this.rails = { ...rails };
    this.devices = [];
    this.inputs = {};
  }

  /** An n-type: conducts when value(gate) >= vt. */
  n(gate, vt, a, b) { this.devices.push({ kind: 'n', gate, vt, a, b }); return this; }
  /** A p-type: conducts when value(gate) <= vt. */
  p(gate, vt, a, b) { this.devices.push({ kind: 'p', gate, vt, a, b }); return this; }

  /** Switch count, and how many of those switches touch the mid rail. */
  cost() {
    const total = this.devices.length;
    const viaMid = this.devices.filter(d => d.a === 'vmid' || d.b === 'vmid').length;
    return { switches: total, midRailConnections: viaMid, rails: Object.keys(this.rails).length };
  }

  /**
   * Resolve every node, given input levels. Returns a map of node -> level|'Z'|'X'.
   * Throws rather than returning a half-settled state if it does not converge.
   *
   * `init` seeds non-driven nodes; anything it omits starts at Z. This is not a
   * test seam. N8 says the starting state is part of the semantics — the fixed
   * point is not unique — so a solver that hid its initial state would be hiding
   * half of what it means. Naming a driven or unknown node here throws.
   */
  solve(inputs, maxIterations = 64, init = {}) {
    const value = { ...this.rails };
    for (const [k, v] of Object.entries(inputs)) value[k] = v;
    const driven = new Set([...Object.keys(this.rails), ...Object.keys(inputs)]);

    // Every node the devices mention, minus the ones already fixed.
    const nodes = new Set();
    for (const d of this.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
    for (const nm of nodes) if (!driven.has(nm)) value[nm] = 'Z';
    for (const [nm, v] of Object.entries(init)) {
      if (driven.has(nm)) throw new Error(`init names a driven node: ${nm}`);
      if (!nodes.has(nm)) throw new Error(`init names a node no device mentions: ${nm}`);
      value[nm] = v;
    }

    const conducts = d => {
      const g = value[d.gate];
      if (g === 'Z' || g === 'X' || g === undefined) return 'unknown';
      return d.kind === 'n' ? (g >= d.vt) : (g <= d.vt);
    };

    /**
     * Which devices touch each node. Built once per solve, so a walk follows a
     * node's own edges instead of rescanning every device in the network. Pure
     * bookkeeping: the reachable set is the same either way, and the differential
     * test in test/test-device.js holds the two implementations against each
     * other on random networks.
     */
    const adj = new Map();
    const link = (from, to, i) => {
      let list = adj.get(from);
      if (!list) { list = []; adj.set(from, list); }
      list.push({ i, other: to });
    };
    this.devices.forEach((d, i) => { link(d.a, d.b, i); link(d.b, d.a, i); });

    /**
     * Nodes reachable from a rail, following edges the predicate accepts.
     *
     * DRIVEN NODES ARE TERMINALS. A rail or an input is an ideal source: signal
     * stops there, it does not pass through. Without this, a path from vmid that
     * happens to touch vss and then continues out of vss makes every node vss
     * drives look contended with vmid, and correct circuits resolve to X. That
     * was a real bug here, and the composition test is what caught it.
     */
    const reach = (rail, accept) => {
      const seen = new Set([rail]);
      const stack = [rail];
      while (stack.length) {
        const at = stack.pop();
        const edges = adj.get(at);
        if (edges === undefined) continue;
        for (const e of edges) {
          if (!accept(e.i)) continue;
          const other = e.other;
          if (seen.has(other)) continue;
          seen.add(other);
          if (!driven.has(other)) stack.push(other);       // do not expand through a source
        }
      }
      return seen;
    };

    for (let iter = 0; iter < maxIterations; iter++) {
      // Conduction is a function of the current state (D1), so it is fixed for
      // the whole pass. Evaluating it once per device beats once per edge walk.
      const cond = this.devices.map(conducts);
      const definite = {}, possible = {};
      for (const rail of Object.keys(this.rails)) {
        definite[rail] = reach(rail, i => cond[i] === true);
        possible[rail] = reach(rail, i => cond[i] !== false);
      }
      let changed = false;
      for (const nm of nodes) {
        if (driven.has(nm)) continue;
        const def = Object.keys(this.rails).filter(r => definite[r].has(nm));
        const pos = Object.keys(this.rails).filter(r => possible[r].has(nm));
        let next;
        if (pos.length === 0) next = 'Z';                       // nothing can reach it
        else if (def.length === 1 && pos.length === 1) next = this.rails[def[0]];
        else next = 'X';                                        // contended, or unknown
        if (value[nm] !== next) { value[nm] = next; changed = true; }
      }
      if (!changed) return value;
    }
    throw new Error('switch-level network did not settle — oscillation or a cycle');
  }

  /**
   * How many conducting switches each node's level arrived through, counted from
   * the rail that drives it. This is the quantity a real pass network degrades
   * with, and the one this model otherwise cannot see (stated limit 2: no level
   * restoration).
   *
   * PARALLEL PATHS TAKE THE SHORTEST. In a real pass network a node driven by two
   * routes from the same rail degrades no worse than its best route, so the
   * shortest conducting path is the honest bound. Taking the longest would
   * overstate every fan-in structure in the repository.
   *
   * Nodes that settle to Z or X have no depth and are omitted: nothing arrived.
   */
  depths(inputs, maxIterations = 64) {
    const value = this.solve(inputs, maxIterations);
    const driven = new Set([...Object.keys(this.rails), ...Object.keys(inputs)]);
    const on = d => {
      const g = value[d.gate];
      if (g === 'Z' || g === 'X' || g === undefined) return false;
      return d.kind === 'n' ? (g >= d.vt) : (g <= d.vt);
    };
    const adj = new Map();
    const link = (from, to) => {
      let l = adj.get(from);
      if (!l) { l = []; adj.set(from, l); }
      l.push(to);
    };
    for (const d of this.devices) if (on(d)) { link(d.a, d.b); link(d.b, d.a); }

    const depth = {};
    for (const rail of Object.keys(this.rails)) {
      const dist = new Map([[rail, 0]]);
      const queue = [rail];
      while (queue.length) {
        const at = queue.shift();
        if (at !== rail && driven.has(at)) continue;      // a source terminates a path (N2)
        for (const next of adj.get(at) || []) {
          if (dist.has(next)) continue;
          dist.set(next, dist.get(at) + 1);
          queue.push(next);
        }
      }
      for (const [nm, hops] of dist) {
        if (driven.has(nm)) continue;
        if (value[nm] !== this.rails[rail]) continue;     // only the rail that drives it
        if (depth[nm] === undefined || hops < depth[nm]) depth[nm] = hops;
      }
    }
    return depth;
  }

  /**
   * The deepest any node that something READS sits, over a list of inputs.
   *
   * "Read" means the node gates a device or is a named output. That restriction
   * is the whole definition, and it is not cosmetic: a pass network is full of
   * internal nodes reachable backwards from an output through an off-path branch,
   * and taking the maximum over ALL nodes reports those instead. MIN's helper
   * node reads as depth 4 that way and 2 this way, and the 4 describes nothing —
   * no device's behaviour depends on that node's level.
   */
  readDepth(inputList, outputs = []) {
    const read = new Set(outputs);
    for (const d of this.devices) read.add(d.gate);
    let worst = 0, where = null;
    for (const inputs of inputList) {
      const driven = new Set([...Object.keys(this.rails), ...Object.keys(inputs)]);
      const depth = this.depths(inputs);
      for (const nm of read) {
        if (driven.has(nm)) continue;
        const d = depth[nm];
        if (d !== undefined && d > worst) { worst = d; where = nm; }
      }
    }
    return { depth: worst, node: where };
  }

  /** Evaluate one output node over a list of input assignments. */
  table(outName, inputNames, levels) {
    const rows = [];
    const rec = (pre) => {
      if (pre.length === inputNames.length) {
        const inputs = {};
        inputNames.forEach((n, i) => { inputs[n] = pre[i]; });
        rows.push({ in: pre.slice(), out: this.solve(inputs)[outName] });
        return;
      }
      for (const l of levels) rec(pre.concat([l]));
    };
    rec([]);
    return rows;
  }
}

/* ---------------------------------------------------------------- ternary gates
 * The three ternary inverters are standard multi-valued-logic parts. Written
 * here as switch networks so their behaviour is derived, not asserted. */

/** Standard ternary inverter: -1 -> +1, 0 -> 0, +1 -> -1. This is NEG. */
function sti(net, inp, out) {
  net.p(inp, LOW, 'vdd', out);            // only when in is LOW
  net.n(inp, HIGH, 'vss', out);           // only when in is HIGH
  const m = `${out}$mid`;                 // series pair: conducts only when in is MID
  net.n(inp, MID, 'vmid', m);
  net.p(inp, MID, m, out);
  return net;
}

/** Negative ternary inverter: -1 -> +1, 0 -> -1, +1 -> -1. */
function nti(net, inp, out) {
  net.p(inp, LOW, 'vdd', out);
  net.n(inp, MID, 'vss', out);
  return net;
}

/** Positive ternary inverter: -1 -> +1, 0 -> +1, +1 -> -1. */
function pti(net, inp, out) {
  net.p(inp, MID, 'vdd', out);
  net.n(inp, HIGH, 'vss', out);
  return net;
}

/**
 * MIN(a, b), the AND-analogue.
 *   LOW  when either input is LOW          — p-types in parallel to vss
 *   HIGH when both inputs are HIGH         — n-types in series to vdd
 *   MID  when min is neither, i.e. min = 0 — both >= MID AND either <= MID
 */
function tmin(net, a, b, out) {
  net.p(a, LOW, 'vss', out);
  net.p(b, LOW, 'vss', out);
  const s = `${out}$hi`;
  net.n(a, HIGH, 'vdd', s);
  net.n(b, HIGH, s, out);
  const m1 = `${out}$m1`, m2 = `${out}$m2`;
  net.n(a, MID, 'vmid', m1);
  net.n(b, MID, m1, m2);                  // both at or above MID
  net.p(a, MID, m2, out);
  net.p(b, MID, m2, out);                 // either at or below MID
  return net;
}

/** MAX(a, b), the OR-analogue. The dual of MIN throughout. */
function tmax(net, a, b, out) {
  net.n(a, HIGH, 'vdd', out);
  net.n(b, HIGH, 'vdd', out);
  const s = `${out}$lo`;
  net.p(a, LOW, 'vss', s);
  net.p(b, LOW, s, out);
  const m1 = `${out}$m1`, m2 = `${out}$m2`;
  net.p(a, MID, 'vmid', m1);
  net.p(b, MID, m1, m2);                  // both at or below MID
  net.n(a, MID, m2, out);
  net.n(b, MID, m2, out);                 // either at or above MID
  return net;
}

/* ------------------------------------------------------------- selectors, tables
 * The repository's monoid audits ended by making the truth table DATA: TOPC reads
 * a 27-cell table and the carry falls out of it. These build the same idea in
 * switches. A table becomes a tree of selectors, and any three-input trit
 * function is then a circuit without anyone designing one. */

/**
 * 1-of-3 selector. Exactly one path conducts, for each of the three select
 * levels — the LOW and HIGH arms are one switch each, and the MID arm is a series
 * pair, for the same reason the standard ternary inverter's is (X4).
 * Four switches.
 */
function tmux(net, sel, lo, mid, hi, out) {
  net.p(sel, LOW, lo, out);               // sel <= LOW, i.e. sel is LOW
  net.n(sel, HIGH, hi, out);              // sel >= HIGH, i.e. sel is HIGH
  const s = `${out}$s`;
  net.n(sel, MID, mid, s);                // series: sel >= MID AND sel <= MID
  net.p(sel, MID, s, out);
  return net;
}

/**
 * A restoring buffer: two standard ternary inverters in series, so the level is
 * re-driven from the rails and the pass depth downstream restarts at zero. Two,
 * not one, because one inverts — a single STI would restore the level and negate
 * the value. Eight switches.
 */
function tBuffer(net, inp, out, tag) {
  const mid = `${tag}$bi`;
  sti(net, inp, mid);
  sti(net, mid, out);
  return net;
}

/**
 * Options for the table builders. A bare boolean is still accepted and means
 * `share`, because every existing call site passes one that way and silently
 * reading `true.share` as undefined would have built the wrong circuit.
 */
const asOpts = o => (typeof o === 'boolean' ? { share: o } : (o || {}));

const RAIL_FOR = { '-1': 'vss', 0: 'vmid', 1: 'vdd' };
/** Cell index for a 27-entry table, matching ternary.js's ttableC convention. */
const cellIndex = (a, b, c) => (a + 1) * 9 + (b + 1) * 3 + (c + 1);

/**
 * Any three-input trit function, from its 27 cells: nine leaf selectors driven by
 * c off the rails, three selected by b, one by a. Thirteen selectors, 52 switches.
 * `share` merges leaf selectors whose three cells are identical, which is the
 * hash-consing `tableKey` does on tables, done to the circuit instead.
 */
function ttable3(net, a, b, c, cells, out, tag, opts = false) {
  const { share = false, restore = 'none' } = asOpts(opts);
  const bufLeaf = restore === 'leafmid';
  const bufMid = restore === 'mid' || restore === 'leafmid';
  const leafCache = new Map();
  const mids = [];
  for (let av = -1; av <= 1; av++) {
    const leaves = [];
    for (let bv = -1; bv <= 1; bv++) {
      const rails = [-1, 0, 1].map(cv => RAIL_FOR[cells[cellIndex(av, bv, cv)]]);
      const key = rails.join(',');
      let leaf = share ? leafCache.get(key) : undefined;
      if (leaf === undefined) {
        leaf = `${tag}$l${share ? leafCache.size : `${av}_${bv}`}`;
        tmux(net, c, rails[0], rails[1], rails[2], leaf);
        if (bufLeaf) { const r = `${leaf}r`; tBuffer(net, leaf, r, r); leaf = r; }
        if (share) leafCache.set(key, leaf);   // cache the BUFFERED name, or it is rebuffered
      }
      leaves.push(leaf);
    }
    let mid = `${tag}$m${av}`;
    tmux(net, b, leaves[0], leaves[1], leaves[2], mid);
    if (bufMid) { const r = `${mid}r`; tBuffer(net, mid, r, r); mid = r; }
    mids.push(mid);
  }
  tmux(net, a, mids[0], mids[1], mids[2], out);
  return net;
}

/** The two trit tables of a balanced-ternary full adder, from the raw sum. */
function adderTables() {
  const sum = [], carry = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
    const s = a + b + c;                          // -3 .. +3
    const cy = Math.sign(s) * Math.round(Math.abs(s) / 3);
    sum.push(s - 3 * cy);
    carry.push(cy);
  }
  return { sum, carry };
}

/** One full-adder cell: sum and carry-out, each a table realised as a tree. */
function tAdderCell(net, a, b, cin, sum, cout, tag, opts = false) {
  const t = adderTables();
  ttable3(net, a, b, cin, t.sum, sum, `${tag}S`, opts);
  ttable3(net, a, b, cin, t.carry, cout, `${tag}C`, opts);
  return net;
}

/**
 * An n-trit ripple adder. Nodes: a0..a{n-1}, b0..b{n-1}, cin in; s0..s{n-1} and
 * c{n} out. The carry out of the top trit is the overflow, so this is an adder
 * rather than a mod-3^n unit.
 */
function tRippleAdder(net, n = 6, opts = false) {
  for (let i = 0; i < n; i++) {
    tAdderCell(net, `a${i}`, `b${i}`, i === 0 ? 'cin' : `c${i}`, `s${i}`, `c${i + 1}`, `A${i}`, opts);
  }
  return net;
}

/* ---------------------------------------------------------------- binary baseline
 * The same solver, two levels and two rails, so switch counts can be compared
 * without comparing across models. The selector and table builders are repeated
 * here rather than shared, because a two-level selector is genuinely a different
 * circuit — two switches, no series arm — and pretending otherwise would put the
 * ternary mid-rail cost on the binary side by accident. */

function binaryNet() { return new Net(BINARY_RAILS); }

function bInv(net, inp, out) {
  net.p(inp, LOW, 'vdd', out);
  net.n(inp, HIGH, 'vss', out);
  return net;
}

function bNand(net, a, b, out) {
  net.p(a, LOW, 'vdd', out);
  net.p(b, LOW, 'vdd', out);
  const s = `${out}$s`;
  net.n(a, HIGH, 'vss', s);
  net.n(b, HIGH, s, out);
  return net;
}

function bAnd(net, a, b, out) {
  const t = `${out}$n`;
  bNand(net, a, b, t);
  return bInv(net, t, out);
}

/** 1-of-2 selector. Two switches: no series arm, because there is no middle. */
function bmux(net, sel, lo, hi, out) {
  net.p(sel, LOW, lo, out);
  net.n(sel, HIGH, hi, out);
  return net;
}

const BRAIL_FOR = { '-1': 'vss', 1: 'vdd' };
const bCellIndex = (a, b, c) => ((a + 1) / 2) * 4 + ((b + 1) / 2) * 2 + (c + 1) / 2;

/** Any three-input bit function from its 8 cells. Seven selectors, 14 switches. */
function bBuffer(net, inp, out, tag) {
  const mid = `${tag}$bi`;
  bInv(net, inp, mid);
  bInv(net, mid, out);
  return net;
}

function btable3(net, a, b, c, cells, out, tag, opts = false) {
  const { share = false, restore = 'none' } = asOpts(opts);
  const bufLeaf = restore === 'leafmid';
  const bufMid = restore === 'mid' || restore === 'leafmid';
  const leafCache = new Map();
  const mids = [];
  for (const av of [-1, 1]) {
    const leaves = [];
    for (const bv of [-1, 1]) {
      const rails = [-1, 1].map(cv => BRAIL_FOR[cells[bCellIndex(av, bv, cv)]]);
      const key = rails.join(',');
      let leaf = share ? leafCache.get(key) : undefined;
      if (leaf === undefined) {
        leaf = `${tag}$l${share ? leafCache.size : `${av}_${bv}`}`;
        bmux(net, c, rails[0], rails[1], leaf);
        if (bufLeaf) { const r = `${leaf}r`; bBuffer(net, leaf, r, r); leaf = r; }
        if (share) leafCache.set(key, leaf);
      }
      leaves.push(leaf);
    }
    let mid = `${tag}$m${av}`;
    bmux(net, b, leaves[0], leaves[1], mid);
    if (bufMid) { const r = `${mid}r`; bBuffer(net, mid, r, r); mid = r; }
    mids.push(mid);
  }
  bmux(net, a, mids[0], mids[1], out);
  return net;
}

/** Sum and carry tables of a binary full adder, in the same -1/+1 encoding. */
function bAdderTables() {
  const sum = [], carry = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) {
    const ones = [a, b, c].filter(v => v === 1).length;
    sum.push(ones % 2 === 1 ? 1 : -1);
    carry.push(ones >= 2 ? 1 : -1);
  }
  return { sum, carry };
}

/** An n-bit binary ripple adder, built exactly as the ternary one is. */
function bRippleAdder(net, n = 10, opts = false) {
  const t = bAdderTables();
  for (let i = 0; i < n; i++) {
    const cin = i === 0 ? 'cin' : `c${i}`;
    btable3(net, `a${i}`, `b${i}`, cin, t.sum, `s${i}`, `A${i}S`, opts);
    btable3(net, `a${i}`, `b${i}`, cin, t.carry, `c${i + 1}`, `A${i}C`, opts);
  }
  return net;
}

module.exports = {
  LOW, MID, HIGH, RAILS, BINARY_RAILS, Net,
  sti, nti, pti, tmin, tmax,
  tmux, ttable3, cellIndex, adderTables, tAdderCell, tRippleAdder, tBuffer, asOpts,
  binaryNet, bInv, bNand, bAnd,
  bmux, btable3, bAdderTables, bRippleAdder, bBuffer,
};
