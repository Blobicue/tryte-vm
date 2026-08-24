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
   */
  solve(inputs, maxIterations = 64) {
    const value = { ...this.rails };
    for (const [k, v] of Object.entries(inputs)) value[k] = v;
    const driven = new Set([...Object.keys(this.rails), ...Object.keys(inputs)]);

    // Every node the devices mention, minus the ones already fixed.
    const nodes = new Set();
    for (const d of this.devices) { nodes.add(d.a); nodes.add(d.b); nodes.add(d.gate); }
    for (const nm of nodes) if (!driven.has(nm)) value[nm] = 'Z';

    const conducts = d => {
      const g = value[d.gate];
      if (g === 'Z' || g === 'X' || g === undefined) return 'unknown';
      return d.kind === 'n' ? (g >= d.vt) : (g <= d.vt);
    };

    /** Nodes reachable from a rail, following edges the predicate accepts. */
    const reach = (rail, accept) => {
      const seen = new Set([rail]);
      const stack = [rail];
      while (stack.length) {
        const at = stack.pop();
        for (const d of this.devices) {
          if (!accept(d)) continue;
          const other = d.a === at ? d.b : d.b === at ? d.a : null;
          if (other !== null && !seen.has(other)) { seen.add(other); stack.push(other); }
        }
      }
      return seen;
    };

    for (let iter = 0; iter < maxIterations; iter++) {
      const definite = {}, possible = {};
      for (const rail of Object.keys(this.rails)) {
        definite[rail] = reach(rail, d => conducts(d) === true);
        possible[rail] = reach(rail, d => conducts(d) !== false);
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

/* ---------------------------------------------------------------- binary baseline
 * The same solver, two levels and two rails, so switch counts can be compared
 * without comparing across models. */

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

module.exports = {
  LOW, MID, HIGH, RAILS, BINARY_RAILS, Net,
  sti, nti, pti, tmin, tmax,
  binaryNet, bInv, bNand, bAnd,
};
