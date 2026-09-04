'use strict';
/* netpack.js — the same solver, over a representation instead of a name space.
 *
 * `src/device.js` is R0: the oracle, and it stays the oracle. It keys nodes by
 * string, holds levels in a plain object, rebuilds a `Map` of arrays of objects
 * for adjacency on every solve, and allocates a fresh `Set` per rail per mode per
 * pass. Everything it computes is right; the cost of computing it is bookkeeping.
 *
 * This file is R1. It lowers a `Net` to dense integer node ids, parallel typed
 * arrays for the device table, CSR adjacency, and rail and driven masks computed
 * ONCE PER NETWORK rather than once per solve — and then runs R0's algorithm over
 * that, unchanged.
 *
 * R1 IS A NEGATIVE CONTROL, NOT A FASTER SOLVER. It exists to price the
 * REPRESENTATION, so that the WebAssembly layer above it is measured against a
 * JavaScript baseline that has already had every data-structure win taken out of
 * it. Concretely, and these are constraints rather than notes:
 *
 *   - Same fixed-point loop, same termination test, same throw at the cap.
 *   - Conduction evaluated once per device per pass, from the state at the START
 *     of the pass (D1), and read by both walks.
 *   - Six traversals per pass on a three-rail net — three rails times
 *     definite/possible — and FOUR on a two-rail one, because the count is
 *     `rails x 2` and not the constant six. Never fused: the possible walk is not
 *     derived from the definite one.
 *   - No incremental recomputation. Every node is re-derived every pass from the
 *     reachability sets, exactly as R0 does, even where nothing near it moved.
 *   - Jacobi, not Gauss-Seidel: the update reads the pass's reachability sets and
 *     never a value another node wrote in the same pass, so node order is free.
 *
 * If R1 improves the algorithm, R1-against-R0 measures algorithm and
 * representation together, R2-against-R1 stops isolating WebAssembly, and the
 * three-way split this whole instrument is built on measures nothing.
 *
 * WHAT IS DELIBERATELY STRICTER THAN R0. R0 takes its input NAMES fresh on every
 * solve, so its `driven` set is per-solve. The packed form computes the driven
 * mask once per network, which means the input names have to be declared at pack
 * time: `pack(net, ['a0', 'b0', 'cin'])`. A solve whose input keys are not exactly
 * that list throws rather than resolving against a mask built for other names.
 * That is a narrower contract than R0's, it is the only difference in what the
 * two accept, and every case the anti-divergence gate compares is one both accept.
 *
 * STATE CODES. R0's node values are `-1 | 0 | 1 | 'Z' | 'X'`. Five states, so the
 * packed form carries five codes and not three: a representation that could not
 * express Z and X would have dropped N5 and N4 on the floor.
 *
 *   Z = 0   floating, and the initial state of every non-driven node
 *   X = 1   contended, or dependent on an unknown
 *   L = 2   LOW (-1)      M = 3   MID (0)      H = 4   HIGH (+1)
 *
 * so `code - 3` is the level and `code >= 2` is "is a level". `init` seeds any
 * of the five on any non-driven node, because N8 makes the starting state part of
 * the semantics — the self-inverter has fixed points this solver will not invent,
 * and a packed form that could only start at Z would be a different model.
 */

const CODE_Z = 0, CODE_X = 1, CODE_LOW = 2, CODE_MID = 3, CODE_HIGH = 4;
/** Device conduction, one per device per pass. Unknown is not off (D6). */
const OFF = 0, ON = 1, UNKNOWN = 2;

/** R0's `-1 | 0 | 1 | 'Z' | 'X'` to a code. Throws on anything else. */
function encodeState(v) {
  if (v === 'Z') return CODE_Z;
  if (v === 'X') return CODE_X;
  if (v === -1) return CODE_LOW;
  if (v === 0) return CODE_MID;
  if (v === 1) return CODE_HIGH;
  throw new Error(`not a node state: ${JSON.stringify(v)}`);
}

/** A code back to R0's spelling, so the two can be compared without a translator. */
function decodeState(c) {
  if (c === CODE_Z) return 'Z';
  if (c === CODE_X) return 'X';
  return c - 3;
}

/**
 * Lower a `Net` to the packed form. Everything here is per-NETWORK: the device
 * table, the adjacency, the rail levels and the driven mask are built once and
 * read by every solve, which is the whole of what R1 changes.
 *
 * Node ids are assigned rails first, then the declared inputs, then every node the
 * devices mention, in device order — dense, so a node is an index into typed
 * arrays rather than a key into an object.
 */
function pack(net, inputNames = []) {
  const index = new Map();
  const names = [];
  const id = nm => {
    let k = index.get(nm);
    if (k === undefined) { k = names.length; index.set(nm, k); names.push(nm); }
    return k;
  };

  // Rails first, and their LEVELS, because R0 assigns `this.rails[def[0]]` — the
  // rail's declared level, which an input of the same name can shadow in `value`
  // without changing what a definite reach to that rail assigns.
  const railNames = Object.keys(net.rails);
  const railId = new Int32Array(railNames.length);
  const railLevel = new Int8Array(railNames.length);
  railNames.forEach((nm, r) => {
    railId[r] = id(nm);
    const lv = net.rails[nm];
    if (lv !== -1 && lv !== 0 && lv !== 1) {
      throw new Error(`rail ${nm} is at ${JSON.stringify(lv)}, and only -1, 0 and 1 are levels`);
    }
    railLevel[r] = lv;
  });

  const inputId = new Int32Array(inputNames.length);
  inputNames.forEach((nm, i) => { inputId[i] = id(nm); });

  const m = net.devices.length;
  const devA = new Int32Array(m), devB = new Int32Array(m), devGate = new Int32Array(m);
  const devIsN = new Uint8Array(m), devVt = new Int8Array(m);
  net.devices.forEach((d, i) => {
    devA[i] = id(d.a); devB[i] = id(d.b); devGate[i] = id(d.gate);
    devIsN[i] = d.kind === 'n' ? 1 : 0;
    devVt[i] = d.vt;
  });

  const nodeCount = names.length;

  // `mentioned` is what R0's `nodes` set holds: the nodes some device names. It is
  // NOT the node list, because a rail or an input no device touches is still in
  // R0's returned value — and `init` rejects a name outside `mentioned` even when
  // the network has a node by that id.
  const mentioned = new Uint8Array(nodeCount);
  for (let i = 0; i < m; i++) {
    mentioned[devA[i]] = 1; mentioned[devB[i]] = 1; mentioned[devGate[i]] = 1;
  }

  const driven = new Uint8Array(nodeCount);
  for (let r = 0; r < railId.length; r++) driven[railId[r]] = 1;
  for (let i = 0; i < inputId.length; i++) driven[inputId[i]] = 1;

  // CSR adjacency over the 2m directed edges, in R0's link order: device i
  // contributes a->b then b->a. Counting sort, so the build is linear.
  const adjStart = new Int32Array(nodeCount + 1);
  for (let i = 0; i < m; i++) { adjStart[devA[i] + 1]++; adjStart[devB[i] + 1]++; }
  for (let n = 0; n < nodeCount; n++) adjStart[n + 1] += adjStart[n];
  const cursor = Int32Array.from(adjStart.subarray(0, nodeCount));
  const adjNode = new Int32Array(2 * m), adjDev = new Int32Array(2 * m);
  for (let i = 0; i < m; i++) {
    let at = cursor[devA[i]]++; adjNode[at] = devB[i]; adjDev[at] = i;
    at = cursor[devB[i]]++; adjNode[at] = devA[i]; adjDev[at] = i;
  }

  const words = (nodeCount + 31) >>> 5;
  return {
    names, index, nodeCount, deviceCount: m,
    railNames, railId, railLevel, railCount: railNames.length,
    inputNames: inputNames.slice(), inputId,
    devA, devB, devGate, devIsN, devVt,
    mentioned, driven, adjStart, adjNode, adjDev, words,
    // Scratch, allocated once per network rather than once per pass. R0 builds a
    // fresh `Set` per rail per mode per pass; these are those same sets, reused.
    value: new Uint8Array(nodeCount),
    cond: new Uint8Array(m),
    reachDef: new Uint32Array(railNames.length * words),
    reachPos: new Uint32Array(railNames.length * words),
    stack: new Int32Array(nodeCount + 1),
  };
}

/**
 * Seed the value array: rails at their declared levels, inputs at theirs, every
 * other node at Z, then `init` on top. The two throws are R0's, word for word —
 * a driven node cannot be seeded, and a name no device mentions is not a node —
 * because the gate compares refusals as well as answers.
 */
function seed(P, inputs, init) {
  const keys = Object.keys(inputs);
  if (keys.length !== P.inputNames.length) {
    throw new Error(`packed for inputs [${P.inputNames}], solved with [${keys}]`);
  }
  const v = P.value;
  for (let n = 0; n < P.nodeCount; n++) v[n] = CODE_Z;
  for (let r = 0; r < P.railCount; r++) v[P.railId[r]] = encodeState(P.railLevel[r]);
  for (const k of keys) {
    const n = P.index.get(k);
    if (n === undefined || P.inputNames.indexOf(k) === -1) {
      throw new Error(`packed for inputs [${P.inputNames}], solved with [${keys}]`);
    }
    v[n] = encodeState(inputs[k]);
  }
  for (const k of Object.keys(init)) {
    const n = P.index.get(k);
    if (n !== undefined && P.driven[n]) throw new Error(`init names a driven node: ${k}`);
    if (n === undefined || !P.mentioned[n]) {
      throw new Error(`init names a node no device mentions: ${k}`);
    }
    v[n] = encodeState(init[k]);
  }
}

/**
 * Nodes reachable from a rail, following edges the mode accepts, into one of the
 * preallocated bitsets.
 *
 * DRIVEN NODES ARE TERMINALS (N2). A rail or an input is an ideal source: it is
 * marked reached and it is NOT expanded through. R0's comment on this names the
 * bug it fixes; the packed form inherits the bug if it drops the guard, and the
 * gate would then see every correct circuit resolve to X.
 */
function reach(P, railIdx, bits, definite) {
  const { adjStart, adjNode, adjDev, cond, driven, stack, words } = P;
  const base = railIdx * words;
  for (let w = 0; w < words; w++) bits[base + w] = 0;
  const start = P.railId[railIdx];
  bits[base + (start >>> 5)] |= (1 << (start & 31));
  stack[0] = start;
  let sp = 1;
  while (sp > 0) {
    const at = stack[--sp];
    const end = adjStart[at + 1];
    for (let e = adjStart[at]; e < end; e++) {
      const c = cond[adjDev[e]];
      // definite: the edge conducts. possible: it is not known NOT to conduct.
      if (definite ? c !== ON : c === OFF) continue;
      const other = adjNode[e];
      const w = base + (other >>> 5), bit = 1 << (other & 31);
      if (bits[w] & bit) continue;
      bits[w] |= bit;
      if (!driven[other]) stack[sp++] = other;      // do not expand through a source
    }
  }
}

const CAP_MESSAGE = 'switch-level network did not settle — oscillation or a cycle';

/**
 * R0's `solve`, over the packed form. Returns the value array (owned by `P`, and
 * overwritten by the next solve) rather than a fresh object per call, because the
 * object R0 builds is part of what the representation costs and is exactly the
 * kind of thing this comparison exists to price.
 *
 * Throws rather than returning a half-settled state, with R0's message, because
 * "did not settle within k" is a MEASUREMENT — `fullSweep` probes the pass count
 * by solving at k and again at k-1 and catching the throw. A solver that handed
 * back the half-settled state would agree with R0 on every easy case and be a
 * different instrument.
 */
function solvePacked(P, inputs, maxIterations = 64, init = {}) {
  seed(P, inputs, init);
  if (run(P, maxIterations)) return P.value;
  throw new Error(CAP_MESSAGE);
}

/**
 * The fixed-point loop itself, over a value array something else has already
 * seeded. True if it reached a fixed point inside the cap, false if it ran out —
 * the caller turns the false into R0's throw, because a sweep wants to COUNT the
 * cases that did not settle rather than catch an exception per pair.
 *
 * Split out of `solvePacked` so the sweep driver and the single solve run the
 * same code and cannot drift apart. Nothing above this line is the algorithm.
 */
function run(P, maxIterations) {
  const { value, cond, devGate, devIsN, devVt, deviceCount, nodeCount,
    driven, railCount, railLevel, reachDef, reachPos, words } = P;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Conduction is a function of the current state (D1), so it is fixed for the
    // whole pass. Once per device, read by both walks — R0's `devices.map(conducts)`.
    for (let i = 0; i < deviceCount; i++) {
      const g = value[devGate[i]];
      if (g < CODE_LOW) { cond[i] = UNKNOWN; continue; }      // Z or X: unknown, not off
      const level = g - 3;
      cond[i] = (devIsN[i] ? (level >= devVt[i]) : (level <= devVt[i])) ? ON : OFF;
    }

    // Six traversals on a three-rail net, four on a two-rail one. Not fused.
    for (let r = 0; r < railCount; r++) {
      reach(P, r, reachDef, true);
      reach(P, r, reachPos, false);
    }

    let changed = false;
    for (let n = 0; n < nodeCount; n++) {
      if (driven[n]) continue;
      const w = n >>> 5, bit = 1 << (n & 31);
      let defCount = 0, defRail = -1, posCount = 0;
      for (let r = 0; r < railCount; r++) {
        const off = r * words + w;
        if (reachDef[off] & bit) { defCount++; defRail = r; }
        if (reachPos[off] & bit) posCount++;
      }
      let next;
      if (posCount === 0) next = CODE_Z;                             // nothing can reach it
      else if (defCount === 1 && posCount === 1) next = railLevel[defRail] + 3;
      else next = CODE_X;                                            // contended, or unknown
      if (value[n] !== next) { value[n] = next; changed = true; }
    }
    if (!changed) return true;
  }
  return false;
}

/**
 * Seed straight from state CODES, one per declared input, in the order they were
 * declared at pack time. This is the sweep's entry: no object per pair, no name
 * lookup per input, and no `init` — the same starting state R0 reaches through
 * `{...spread('a', a), ...spread('b', b), cin: 0}`, arrived at by index.
 */
function seedCodes(P, codes, at = 0) {
  const v = P.value;
  for (let n = 0; n < P.nodeCount; n++) v[n] = CODE_Z;
  for (let r = 0; r < P.railCount; r++) v[P.railId[r]] = P.railLevel[r] + 3;
  for (let i = 0; i < P.inputId.length; i++) v[P.inputId[i]] = codes[at + i];
}

/**
 * One solve per pair, over a block of operand codes, reading a fixed list of
 * output nodes out of each result. The shape R2's exported `sweep` has to match:
 * the driver is inside, and the caller crosses the boundary once per block rather
 * than once per pair.
 *
 * Returns how many pairs did not settle inside the cap. That count is a
 * MEASUREMENT — `fullSweep` learns the pass count from exactly this — so it is
 * returned rather than thrown, and a single solve still throws.
 */
function sweepPacked(P, codes, pairCount, outIds, out, maxIterations) {
  const k = outIds.length;
  let unsettled = 0;
  for (let i = 0; i < pairCount; i++) {
    seedCodes(P, codes, i * P.inputId.length);
    if (!run(P, maxIterations)) unsettled++;
    for (let j = 0; j < k; j++) out[i * k + j] = P.value[outIds[j]];
  }
  return unsettled;
}

/**
 * The same solve, returning R0's shape: a plain object from node name to
 * `-1 | 0 | 1 | 'Z' | 'X'`. This is what the anti-divergence gate compares, and
 * it is deliberately NOT what the benchmark calls — building the object is part
 * of R0's per-solve cost, and pricing it away silently would be the rewrite
 * laundering itself.
 */
function solveNamed(P, inputs, maxIterations = 64, init = {}) {
  const v = solvePacked(P, inputs, maxIterations, init);
  const out = {};
  for (let n = 0; n < P.nodeCount; n++) out[P.names[n]] = decodeState(v[n]);
  return out;
}

/** The dense id of a node, for reading one value out of the array by name. */
function nodeId(P, name) {
  const n = P.index.get(name);
  if (n === undefined) throw new Error(`no such node: ${name}`);
  return n;
}

module.exports = {
  CODE_Z, CODE_X, CODE_LOW, CODE_MID, CODE_HIGH, OFF, ON, UNKNOWN, CAP_MESSAGE,
  encodeState, decodeState, pack, seed, seedCodes, reach, run, solvePacked,
  sweepPacked, solveNamed, nodeId,
};
