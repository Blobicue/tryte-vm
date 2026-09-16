#!/usr/bin/env node
'use strict';

// Planning infrastructure, not an empirical audit or a scheduler. Declarations of
// evidence remain declarations: this tool does not certify their contents.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GRAPH_PATH = path.join(ROOT, 'design', 'compute-horizon.json');
const DOC_PATH = path.join(ROOT, 'design', '13-compute-horizon.md');
const START = '<!-- horizon:generated:start -->';
const END = '<!-- horizon:generated:end -->';
const SCHEMA = 'ternary-compute-horizon/v1';
const PORTS = ['assessment', 'capability'];
const KINDS = ['specification', 'implementation', 'experiment', 'gate', 'synthesis'];
const OUTCOMES = ['supported', 'refuted', 'inconclusive', 'invalid'];
const HASH = /^[a-f0-9]{64}$/;
const COMMIT = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const ID = /^[A-Za-z][A-Za-z0-9._-]*$/;
const LIMITATIONS = [
  'Advisory dependency readiness only; no scheduling, admission, or claims are written.',
  'Receipt, tree, and registration hash declarations are not checked against files or git.',
  'Registration chronology, scientific validity, coverage, and actual reviewer independence are not certified.',
  'Append-only attempt history is not verified against a prior snapshot; the coordinator must review historical preservation.',
  'Claims reserve nothing atomically; a coordinator must resolve overlapping writes/resources and release expired leases.',
  'Conflicting current supported/refuted results withhold capability until reviewed and resolved through a revised contract.'
];

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function contractHash(unit) {
  const contract = Object.fromEntries(Object.entries(unit).filter(([key]) => key !== 'attempts' && key !== 'claim'));
  return crypto.createHash('sha256').update(canonical(contract)).digest('hex');
}

function validUtc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().replace('.000Z', 'Z') === value.replace('.000Z', 'Z');
}

function dependencyRefs(unit) {
  const refs = [];
  for (const input of Array.isArray(unit.requires) ? unit.requires : []) if (object(input)) refs.push({ ...input, mode: 'work' });
  for (const input of Array.isArray(unit.capability_requires) ? unit.capability_requires : []) if (object(input)) refs.push({ ...input, mode: 'capability-all' });
  for (const choice of Array.isArray(unit.capability_choices) ? unit.capability_choices : []) {
    if (!object(choice) || !Array.isArray(choice.options)) continue;
    for (const input of choice.options) if (object(input)) refs.push({ ...input, mode: 'capability-choice', choice: choice.name });
  }
  return refs;
}

function validateGraph(graph) {
  const errors = [];
  const fail = (where, message) => errors.push(where + ': ' + message);
  const string = (value, where) => { if (!nonempty(value)) fail(where, 'must be a nonempty string'); };
  const hash = (value, where) => { if (typeof value !== 'string' || !HASH.test(value)) fail(where, 'must be a lowercase SHA-256 hex digest'); };
  const commit = (value, where) => { if (typeof value !== 'string' || !COMMIT.test(value)) fail(where, 'must be a full lowercase git commit hash'); };
  const strings = (value, where, minimum = 0) => {
    if (!Array.isArray(value)) return fail(where, 'must be an array');
    if (value.length < minimum) fail(where, 'must not be empty');
    value.forEach((entry, i) => string(entry, where + '[' + i + ']'));
    if (new Set(value).size !== value.length) fail(where, 'contains duplicates');
  };
  const identifier = (value, where) => { if (typeof value !== 'string' || !ID.test(value)) fail(where, 'must be a stable identifier'); };
  const receipt = (value, where, registered = false) => {
    if (!object(value)) return fail(where, 'must be an object');
    string(value.path, where + '.path');
    hash(value.sha256, where + '.sha256');
    if (registered) commit(value.commit, where + '.commit');
  };
  const references = (value, where, ports, optional = false) => {
    if (optional && value === undefined) return;
    if (!Array.isArray(value)) return fail(where, 'must be an array');
    const seen = new Set();
    value.forEach((input, i) => {
      const at = where + '[' + i + ']';
      if (!object(input)) return fail(at, 'must be an object');
      identifier(input.unit, at + '.unit');
      if (!ports.includes(input.port)) fail(at + '.port', 'unknown or disallowed output port');
      for (const key of Object.keys(input)) if (!['unit', 'port'].includes(key)) fail(at + '.' + key, 'unknown reference field');
      const key = input.unit + ':' + input.port;
      if (seen.has(key)) fail(at, 'duplicate dependency');
      seen.add(key);
    });
  };
  const bindings = (value, where, ports, optional = false) => {
    if (optional && value === undefined) return;
    if (!Array.isArray(value)) return fail(where, 'must be an array');
    const seen = new Set();
    value.forEach((input, i) => {
      const at = where + '[' + i + ']';
      if (!object(input)) return fail(at, 'must be an object');
      identifier(input.unit, at + '.unit');
      identifier(input.attempt, at + '.attempt');
      if (!ports.includes(input.port)) fail(at + '.port', 'unknown or disallowed output port');
      hash(input.receipt_sha256, at + '.receipt_sha256');
      for (const key of Object.keys(input)) if (!['unit', 'port', 'attempt', 'receipt_sha256'].includes(key)) fail(at + '.' + key, 'unknown binding field; choice coverage is inferred from declared option refs');
      const key = input.unit + ':' + input.port;
      if (seen.has(key)) fail(at, 'duplicate input binding');
      seen.add(key);
    });
  };
  if (!object(graph)) return { valid: false, errors: ['graph: must be an object'], order: [] };
  if (graph.schema !== SCHEMA) fail('schema', 'unsupported schema');
  if (!object(graph.program)) fail('program', 'must be an object');
  else {
    identifier(graph.program.id, 'program.id');
    string(graph.program.title, 'program.title');
    string(graph.program.goal, 'program.goal');
    if (graph.program.standing !== 'PROPOSED') fail('program.standing', 'must be PROPOSED; this graph is not a claim ledger');
  }
  if (!Array.isArray(graph.sources)) fail('sources', 'must be an array');
  else {
    const seen = new Set();
    graph.sources.forEach((source, i) => {
      const at = 'sources[' + i + ']';
      if (!object(source)) return fail(at, 'must be an object');
      identifier(source.id, at + '.id');
      if (seen.has(source.id)) fail(at, 'duplicate source ID');
      seen.add(source.id);
      string(source.path, at + '.path');
      string(source.note, at + '.note');
    });
  }
  if (!Array.isArray(graph.units) || graph.units.length === 0) return { valid: false, errors: [...errors, 'units: must be a nonempty array'], order: [] };
  const units = new Map();
  graph.units.forEach((unit, i) => {
    const at = 'units[' + i + ']';
    if (!object(unit)) return fail(at, 'must be an object');
    identifier(unit.id, at + '.id');
    if (units.has(unit.id)) fail(at, 'duplicate unit ID ' + unit.id);
    units.set(unit.id, unit);
    for (const key of ['title', 'lane', 'question', 'falsifier']) string(unit[key], at + '.' + key);
    if (!KINDS.includes(unit.kind)) fail(at + '.kind', 'unknown kind');
    references(unit.requires, at + '.requires', PORTS);
    references(unit.capability_requires, at + '.capability_requires', ['capability'], true);
    if (unit.capability_choices !== undefined) {
      if (!Array.isArray(unit.capability_choices)) fail(at + '.capability_choices', 'must be an array');
      else {
        const names = new Set();
        unit.capability_choices.forEach((choice, j) => {
          const here = at + '.capability_choices[' + j + ']';
          if (!object(choice)) return fail(here, 'must be an object');
          identifier(choice.name, here + '.name');
          if (names.has(choice.name)) fail(here + '.name', 'duplicate choice name');
          names.add(choice.name);
          for (const key of Object.keys(choice)) if (!['name', 'options'].includes(key)) fail(here + '.' + key, 'unknown choice field');
          references(choice.options, here + '.options', ['capability']);
          if (Array.isArray(choice.options) && choice.options.length === 0) fail(here + '.options', 'choice must contain an option');
        });
      }
    }
    const qualificationRefs = dependencyRefs(unit).filter(input => input.mode !== 'work');
    const qualificationKeys = qualificationRefs.map(input => input.unit + ':' + input.port);
    if (new Set(qualificationKeys).size !== qualificationKeys.length) fail(at, 'duplicate qualification ref across fixed requirements or choice groups');
    if (!object(unit.outputs)) fail(at + '.outputs', 'must declare output ports');
    else {
      for (const port of PORTS) string(unit.outputs[port], at + '.outputs.' + port);
      for (const port of Object.keys(unit.outputs)) if (!PORTS.includes(port)) fail(at + '.outputs.' + port, 'unknown output port');
    }
    strings(unit.acceptance, at + '.acceptance', 1);
    strings(unit.alternatives, at + '.alternatives', 1);
    if (!object(unit.scope)) fail(at + '.scope', 'must be an object');
    else for (const key of ['repo', 'write_root', 'resources']) string(unit.scope[key], at + '.scope.' + key);
    if (unit.claim !== null) {
      if (!object(unit.claim)) fail(at + '.claim', 'must be null or a lease object');
      else {
        string(unit.claim.owner, at + '.claim.owner');
        identifier(unit.claim.attempt, at + '.claim.attempt');
        if (!validUtc(unit.claim.expires_utc)) fail(at + '.claim.expires_utc', 'must be an exact UTC timestamp');
        strings(unit.claim.write_paths, at + '.claim.write_paths', 1);
        strings(unit.claim.resources, at + '.claim.resources', 1);
      }
    }
    if (!Array.isArray(unit.attempts)) return fail(at + '.attempts', 'must be an append-only array');
    const attemptIds = new Set();
    unit.attempts.forEach((attempt, j) => {
      const here = at + '.attempts[' + j + ']';
      if (!object(attempt)) return fail(here, 'must be an object');
      identifier(attempt.id, here + '.id');
      if (attemptIds.has(attempt.id)) fail(here, 'duplicate attempt ID');
      attemptIds.add(attempt.id);
      if (!OUTCOMES.includes(attempt.outcome)) fail(here + '.outcome', 'unknown outcome');
      string(attempt.producer, here + '.producer');
      string(attempt.reviewer, here + '.reviewer');
      if (nonempty(attempt.producer) && nonempty(attempt.reviewer) && attempt.producer.trim().toLowerCase() === attempt.reviewer.trim().toLowerCase()) fail(here, 'reviewer must be named independently of producer');
      hash(attempt.contract_sha256, here + '.contract_sha256');
      if (!object(attempt.source)) fail(here + '.source', 'must be an object');
      else {
        commit(attempt.source.commit, here + '.source.commit');
        hash(attempt.source.tree_sha256, here + '.source.tree_sha256');
      }
      if (attempt.registration !== null) receipt(attempt.registration, here + '.registration', true);
      if (unit.kind === 'experiment' && attempt.outcome !== 'invalid' && attempt.registration === null) fail(here + '.registration', 'empirical attempts require preregistration metadata');
      receipt(attempt.receipt, here + '.receipt');
      strings(attempt.commands, here + '.commands', 1);
      string(attempt.coverage, here + '.coverage');
      strings(attempt.limitations, here + '.limitations');
      if (!Array.isArray(attempt.emits)) fail(here + '.emits', 'must be an array');
      else {
        if (new Set(attempt.emits).size !== attempt.emits.length) fail(here + '.emits', 'contains duplicates');
        for (const port of attempt.emits) if (!PORTS.includes(port)) fail(here + '.emits', 'unknown output port');
        if (attempt.emits.includes('capability') && attempt.outcome !== 'supported') fail(here + '.emits', 'only a supported attempt may emit capability');
        if (attempt.outcome === 'invalid' && attempt.emits.length) fail(here + '.emits', 'invalid attempts emit nothing');
      }
      bindings(attempt.inputs, here + '.inputs', PORTS);
      bindings(attempt.capability_inputs, here + '.capability_inputs', ['capability'], true);
      // Old contracts may name qualification refs removed by a later revision.
      // Preserve those declarations as history; only current extras are malformed.
      if (attempt.contract_sha256 === contractHash(unit) && Array.isArray(attempt.capability_inputs)) {
        for (const input of attempt.capability_inputs) if (object(input) && !qualificationKeys.includes(input.unit + ':' + input.port)) fail(here + '.capability_inputs', 'undeclared qualification ref ' + input.unit + ':' + input.port);
      }
    });
  });
  for (const [id, unit] of units) {
    for (const input of dependencyRefs(unit)) {
      const source = units.get(input.unit);
      if (!source) fail(id + '.' + input.mode, 'missing unit ' + input.unit);
      else if (!object(source.outputs) || !Object.hasOwn(source.outputs, input.port)) fail(id + '.' + input.mode, 'missing output ' + input.unit + ':' + input.port);
    }
    if (!Array.isArray(unit.attempts)) continue;
    for (const attempt of unit.attempts) {
      if (!object(attempt)) continue;
      const allInputs = [...(Array.isArray(attempt.inputs) ? attempt.inputs : []), ...(Array.isArray(attempt.capability_inputs) ? attempt.capability_inputs : [])];
      for (const input of allInputs) {
        if (!object(input)) continue;
        const source = units.get(input.unit);
        if (!source) fail(id + '/' + attempt.id, 'input names missing unit ' + input.unit);
        else if (!Array.isArray(source.attempts) || !source.attempts.some(entry => object(entry) && entry.id === input.attempt)) fail(id + '/' + attempt.id, 'input names missing attempt ' + input.unit + '/' + input.attempt);
      }
    }
  }
  const order = [];
  const visited = new Set();
  const visiting = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) return fail(id, 'dependency cycle');
    visiting.add(id);
    const unit = units.get(id);
    for (const input of dependencyRefs(unit)) if (units.has(input.unit)) visit(input.unit);
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }
  for (const id of units.keys()) visit(id);
  return { valid: errors.length === 0, errors, order };
}

function requireValid(graph) {
  const checked = validateGraph(graph);
  if (!checked.valid) throw new Error('Invalid horizon graph:\n' + checked.errors.map(error => '- ' + error).join('\n'));
  return checked;
}

function analyzeGraph(graph) {
  const checked = requireValid(graph);
  const units = new Map(graph.units.map(unit => [unit.id, unit]));
  const analyses = new Map();
  const pinnedReasons = input => {
    const upstream = analyses.get(input.unit);
    const evidence = upstream && upstream.attempts.find(entry => entry.id === input.attempt);
    const reasons = [];
    if (!evidence || !evidence.available_ports.includes(input.port)) reasons.push('unavailable pinned input ' + input.unit + ':' + input.port + '/' + input.attempt);
    if (!evidence || evidence.receipt_sha256 !== input.receipt_sha256) reasons.push('receipt mismatch for ' + input.unit + '/' + input.attempt);
    return reasons;
  };
  for (const id of checked.order) {
    const unit = units.get(id);
    const expected = contractHash(unit);
    const attempts = unit.attempts.map(attempt => {
      const reasons = [];
      const capabilityReasons = [];
      if (attempt.contract_sha256 !== expected) reasons.push('stale contract');
      if (attempt.outcome === 'invalid') reasons.push('invalid outcome');
      const needed = unit.requires.map(input => input.unit + ':' + input.port).sort();
      const bound = attempt.inputs.map(input => input.unit + ':' + input.port).sort();
      if (canonical(needed) !== canonical(bound)) reasons.push('input bindings do not match the complete current join');
      // Historical bindings can predate the current dependency graph. They stay
      // recorded but are not traversed as if they were current evidence.
      if (reasons.length === 0) for (const input of attempt.inputs) reasons.push(...pinnedReasons(input));
      if (reasons.length === 0 && attempt.emits.includes('capability')) {
        const selected = attempt.capability_inputs || [];
        const selectedKeys = new Set(selected.map(input => input.unit + ':' + input.port));
        for (const required of unit.capability_requires || []) {
          if (!selectedKeys.has(required.unit + ':' + required.port)) capabilityReasons.push('missing fixed qualification ' + required.unit + ':' + required.port);
        }
        for (const choice of unit.capability_choices || []) {
          if (!choice.options.some(input => selectedKeys.has(input.unit + ':' + input.port))) capabilityReasons.push('missing selection for capability choice ' + choice.name);
        }
        for (const input of selected) capabilityReasons.push(...pinnedReasons(input));
      }
      return {
        id: attempt.id, outcome: attempt.outcome, receipt_sha256: attempt.receipt.sha256,
        available_ports: reasons.length ? [] : attempt.emits.filter(port => port !== 'capability' || capabilityReasons.length === 0),
        reasons, capability_reasons: capabilityReasons
      };
    });
    const current = attempts.filter(attempt => attempt.reasons.length === 0);
    const disputed = current.some(attempt => attempt.outcome === 'refuted') && current.some(attempt => attempt.available_ports.includes('capability'));
    if (disputed) for (const attempt of attempts) attempt.available_ports = attempt.available_ports.filter(port => port !== 'capability');
    const available = Object.fromEntries(PORTS.map(port => [port, attempts.filter(attempt => attempt.available_ports.includes(port)).map(attempt => attempt.id)]));
    const missing = unit.requires.filter(input => analyses.get(input.unit).available[input.port].length === 0);
    const status = unit.claim ? 'claimed' : disputed ? 'disputed' : available.capability.length ? 'qualified' : available.assessment.length ? 'assessed' : missing.length ? 'blocked' : 'ready';
    analyses.set(id, { id, status, contract_sha256: expected, available, missing, disputed, claim: unit.claim, attempts });
  }
  return { order: checked.order, units: Object.fromEntries(analyses) };
}

function markdown(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;').replace(/\r?\n/g, ' ');
}

function mermaid(value) {
  return markdown(value).replace(/"/g, '&quot;').replace(/`/g, '&#96;').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
}

function deriveReverseLinks(graph) {
  const checked = requireValid(graph);
  const links = Object.fromEntries(graph.units.map(unit => [unit.id, { direct_consumers: [], reachable_endpoints: [] }]));
  for (const unit of graph.units) for (const input of dependencyRefs(unit)) {
    links[input.unit].direct_consumers.push({ unit: unit.id, port: input.port, mode: input.mode, ...(input.choice ? { choice: input.choice } : {}) });
  }
  for (const id of [...checked.order].reverse()) {
    const link = links[id];
    // Reachability describes the planned graph, not qualified evidence. A terminal
    // unit reaches itself by the empty path; reconverging paths yield one endpoint.
    link.reachable_endpoints = link.direct_consumers.length
      ? [...new Set(link.direct_consumers.flatMap(consumer => links[consumer.unit].reachable_endpoints))].sort()
      : [id];
  }
  return links;
}

function renderGenerated(graph) {
  const analysis = analyzeGraph(graph);
  const reverse = deriveReverseLinks(graph);
  const ready = graph.units.filter(unit => analysis.units[unit.id].status === 'ready');
  const lines = [
    '## Generated work frontier', '',
    'This region is generated from `compute-horizon.json`. Readiness is advisory and depends on the ordinary work-input AND-join. Capability qualification additionally requires all fixed qualification inputs and pinned selections covering every choice group.', '',
    'Ready, unclaimed units: ' + (ready.length ? ready.map(unit => '`' + unit.id + '`').join(', ') : 'none') + '.', '',
    'A finished assessment does not imply a capability. Expired claims remain claimed until a coordinator releases them. No worker has been launched by this document.', '',
    'Direct consumers and reachable endpoints are derived from all planned dependencies, including possible choices, not promises of successful work. Solid arrows are work inputs; dashed arrows are capability-only qualifications. A terminal unit has no consumers and includes itself in its reachable endpoints.', '',
    '### Dependency DAG', '', '```mermaid', 'flowchart TD'
  ];
  for (const unit of graph.units) lines.push('  ' + unit.id + '["' + unit.id + ': ' + mermaid(unit.title) + '"]');
  for (const unit of graph.units) for (const input of dependencyRefs(unit)) {
    if (input.mode === 'work') lines.push('  ' + input.unit + ' -->|' + input.port + '| ' + unit.id);
    else lines.push('  ' + input.unit + ' -.->|' + (input.mode === 'capability-all' ? 'capability-all' : 'choice: ' + mermaid(input.choice)) + '| ' + unit.id);
  }
  lines.push('```', '', '### Unit index', '', '| Unit | Transition / skill | Lane | Work inputs (all; qualification in card) | State |', '|---|---|---|---|---|');
  for (const unit of graph.units) lines.push('| [' + unit.id + '](#' + unit.id.toLowerCase() + ') | ' + markdown(unit.title) + ' | ' + markdown(unit.lane) + ' | ' + (unit.requires.map(input => input.unit + ':' + input.port).join(', ') || 'none') + ' | ' + analysis.units[unit.id].status + ' |');
  lines.push('', '### Portable work cards', '');
  for (const unit of graph.units) {
    const inspected = analysis.units[unit.id];
    lines.push('<a id="' + unit.id.toLowerCase() + '"></a>', '', '#### ' + unit.id + ' — ' + markdown(unit.title), '',
      '- Lane / kind: ' + markdown(unit.lane) + ' / `' + unit.kind + '`.',
      '- Question: ' + markdown(unit.question),
      '- Work inputs (all): ' + (unit.requires.map(input => '`' + input.unit + ':' + input.port + '`').join(', ') || 'none') + '.',
      '- Capability-only fixed inputs (all): ' + ((unit.capability_requires || []).map(input => '`' + input.unit + ':' + input.port + '`').join(', ') || 'none') + '.',
      '- Capability-only choices (select one or more per group): ' + ((unit.capability_choices || []).map(choice => '`' + choice.name + '` from ' + choice.options.map(input => '`' + input.unit + ':' + input.port + '`').join(' / ')).join('; ') || 'none') + '.',
      '- Direct consumers: ' + (reverse[unit.id].direct_consumers.map(consumer => '`' + consumer.unit + '` via `' + consumer.port + '` (' + consumer.mode + (consumer.choice ? ': ' + consumer.choice : '') + ')').join(', ') || 'none (terminal unit)') + '.',
      '- Reachable endpoints: ' + reverse[unit.id].reachable_endpoints.map(id => '`' + id + '`').join(', ') + '.',
      '- Assessment output: ' + markdown(unit.outputs.assessment),
      '- Capability output: ' + markdown(unit.outputs.capability),
      '- State: `' + inspected.status + '`; attempts recorded: ' + unit.attempts.length + '.',
      '- Contract SHA-256: `' + inspected.contract_sha256 + '`.', '', 'Acceptance:', '');
    for (const acceptance of unit.acceptance) lines.push('- ' + markdown(acceptance));
    lines.push('', 'Falsifier: ' + markdown(unit.falsifier), '', 'Alternatives:', '');
    for (const alternative of unit.alternatives) lines.push('- ' + markdown(alternative));
    lines.push('', 'Scope:', '',
      '- Repository: `' + unit.scope.repo.replace(/`/g, '') + '`.',
      '- Write root: `' + unit.scope.write_root.replace(/`/g, '') + '`.',
      '- Resources: ' + markdown(unit.scope.resources), '',
      'Portable dispatch: `node tools/compute-horizon.js --node ' + unit.id + '`.', '');
    if (inspected.disputed) lines.push('Capability is withheld because current supported and refuted results coexist.', '');
    for (const attempt of inspected.attempts) lines.push('- Attempt `' + attempt.id + '` / `' + attempt.outcome + '`: ' + (attempt.available_ports.length ? 'available ' + attempt.available_ports.join(', ') : 'no available ports') + (attempt.reasons.length ? '; ' + attempt.reasons.join('; ') : '') + (attempt.capability_reasons.length ? '; capability withheld: ' + attempt.capability_reasons.join('; ') : '') + '.');
    if (inspected.attempts.length) lines.push('');
  }
  return '\n' + lines.join('\n').trimEnd() + '\n';
}

function region(document) {
  const start = document.indexOf(START);
  const end = document.indexOf(END);
  if (start < 0 || end < 0 || end < start || document.indexOf(START, start + START.length) >= 0 || document.indexOf(END, end + END.length) >= 0) throw new Error('Document must contain exactly one ordered generated region.');
  return { start: start + START.length, end };
}

function replaceGenerated(document, generated) {
  const bounds = region(document);
  return document.slice(0, bounds.start) + generated + document.slice(bounds.end);
}

function checkDocument(graph, document) {
  const bounds = region(document);
  const actual = document.slice(bounds.start, bounds.end).replace(/\r\n/g, '\n');
  if (actual !== renderGenerated(graph)) throw new Error('Generated horizon region is stale. Run node tools/compute-horizon.js --render.');
  return true;
}

function portableNode(graph, id) {
  const unit = graph.units.find(entry => entry.id === id);
  if (!unit) throw new Error('Unknown unit: ' + id);
  const analysis = analyzeGraph(graph);
  const reverse = deriveReverseLinks(graph);
  return {
    schema: graph.schema, program: graph.program, sources: graph.sources,
    unit, readiness: analysis.units[id],
    ...reverse[id],
    reachability_note: 'All planned dependency paths including potential choices, not qualification; a terminal unit includes itself by the empty path.',
    dependencies: dependencyRefs(unit).map(input => ({ ...input, outputs: graph.units.find(entry => entry.id === input.unit).outputs, evidence: analysis.units[input.unit] })),
    limitations: LIMITATIONS
  };
}

function readyReport(graph) {
  const analysis = analyzeGraph(graph);
  const report = { advisory: true, ready: [], claimed: [], qualified: [], assessed: [], blocked: [], disputed: [], excluded_attempts: [], withheld_capabilities: [], limitations: LIMITATIONS };
  for (const unit of graph.units) {
    const state = analysis.units[unit.id];
    report[state.status].push({ id: unit.id, title: unit.title, scope: unit.scope, missing: state.missing, claim: state.claim });
    for (const attempt of state.attempts) if (attempt.reasons.length) report.excluded_attempts.push({ unit: unit.id, ...attempt });
    for (const attempt of state.attempts) if (attempt.capability_reasons.length) report.withheld_capabilities.push({ unit: unit.id, ...attempt });
  }
  return report;
}

function selfTest() {
  let checks = 0;
  const test = (name, body) => { try { body(); checks++; } catch (error) { throw new Error('Self-test ' + name + ': ' + error.message); } };
  const copy = value => JSON.parse(JSON.stringify(value));
  const fixtureUnit = (id, requires = []) => ({
    id, title: id + ' fixture', lane: 'test', kind: 'specification', question: 'Does the declared gate hold?', requires,
    outputs: { assessment: 'A bounded assessment.', capability: 'A qualified fixture capability.' }, acceptance: ['The fixture gate passes.'],
    falsifier: 'A failing fixture.', alternatives: ['Reject this route.'], scope: { repo: 'fixture', write_root: 'fixture/', resources: 'none' }, claim: null, attempts: []
  });
  const fixture = () => ({ schema: SCHEMA, program: { id: 'fixture', title: 'Fixture', goal: 'Check the checker.', standing: 'PROPOSED' }, sources: [], units: [fixtureUnit('H00'), fixtureUnit('H01'), fixtureUnit('H02', [{ unit: 'H00', port: 'capability' }, { unit: 'H01', port: 'capability' }]), fixtureUnit('H03', [{ unit: 'H02', port: 'capability' }])] });
  const makeAttempt = (unit, inputs = [], outcome = 'supported') => ({
    id: 'attempt-' + unit.attempts.length, outcome, producer: 'producer', reviewer: 'reviewer', contract_sha256: contractHash(unit),
    source: { commit: 'a'.repeat(40), tree_sha256: 'b'.repeat(64) }, registration: null,
    receipt: { path: 'fixture/' + unit.id + '.json', sha256: crypto.createHash('sha256').update(unit.id + '/' + unit.attempts.length).digest('hex') },
    inputs, commands: ['fixture command'], coverage: 'Synthetic graph only.', limitations: ['No empirical result.'], emits: outcome === 'supported' ? [...PORTS] : outcome === 'invalid' ? [] : ['assessment']
  });
  const bind = (unit, port = 'capability') => ({ unit: unit.id, port, attempt: unit.attempts[0].id, receipt_sha256: unit.attempts[0].receipt.sha256 });
  const supported = () => {
    const graph = fixture();
    for (const unit of graph.units) unit.attempts.push(makeAttempt(unit, unit.requires.map(input => bind(graph.units.find(entry => entry.id === input.unit), input.port))));
    return graph;
  };
  const qualificationFixture = (selected = ['H08'], outcomes = {}) => {
    const candidates = ['H07', 'H08', 'H09'].map(id => fixtureUnit(id));
    const selector = fixtureUnit('H10', candidates.map(unit => ({ unit: unit.id, port: 'assessment' })));
    selector.capability_choices = [{ name: 'backend', options: candidates.map(unit => ({ unit: unit.id, port: 'capability' })) }];
    const consumer = fixtureUnit('H11', [{ unit: 'H10', port: 'capability' }]);
    // Deliberately not topological array order: conditional refs determine order.
    const graph = { ...fixture(), units: [selector, consumer, ...candidates] };
    for (const unit of candidates) unit.attempts.push(makeAttempt(unit, [], outcomes[unit.id] || 'supported'));
    const attempt = makeAttempt(selector, candidates.map(unit => bind(unit, 'assessment')));
    attempt.capability_inputs = selected.map(id => bind(candidates.find(unit => unit.id === id)));
    selector.attempts.push(attempt);
    consumer.attempts.push(makeAttempt(consumer, [bind(selector)]));
    return graph;
  };
  const invalid = (name, mutate) => test(name, () => { const graph = supported(); mutate(graph); assert.strictEqual(validateGraph(graph).valid, false); });
  test('healthy empty frontier', () => { const graph = fixture(); assert(validateGraph(graph).valid); assert.deepStrictEqual(readyReport(graph).ready.map(unit => unit.id), ['H00', 'H01']); });
  test('healthy transitive joins', () => { const graph = supported(); assert(validateGraph(graph).valid); assert.strictEqual(analyzeGraph(graph).units.H03.status, 'qualified'); });
  test('unresolved AND join', () => { const graph = fixture(); graph.units[0].attempts.push(makeAttempt(graph.units[0])); assert.strictEqual(analyzeGraph(graph).units.H02.status, 'blocked'); });
  invalid('duplicate IDs', graph => graph.units.push(copy(graph.units[0])));
  invalid('missing dependency', graph => graph.units[0].requires.push({ unit: 'absent', port: 'capability' }));
  invalid('cycle', graph => graph.units[0].requires.push({ unit: 'H03', port: 'capability' }));
  invalid('missing output', graph => delete graph.units[0].outputs.capability);
  invalid('unknown port', graph => { graph.units[2].requires[0].port = 'finished'; });
  invalid('refuted capability', graph => { graph.units[0].attempts[0].outcome = 'refuted'; });
  invalid('invalid emitted assessment', graph => { graph.units[0].attempts[0].outcome = 'invalid'; graph.units[0].attempts[0].emits = ['assessment']; });
  invalid('malformed digest', graph => { graph.units[0].attempts[0].receipt.sha256 = 'not-a-hash'; });
  invalid('absent independent review', graph => { graph.units[0].attempts[0].reviewer = ' PRODUCER '; });
  invalid('missing registration', graph => { graph.units[0].kind = 'experiment'; });
  invalid('missing receipt', graph => { delete graph.units[0].attempts[0].receipt; });
  invalid('missing bound attempt', graph => { graph.units[2].attempts[0].inputs[0].attempt = 'absent'; });
  invalid('malformed lease', graph => { graph.units[0].claim = { owner: 'worker', attempt: 'test', expires_utc: 'yesterday', write_paths: ['fixture/'], resources: ['local'] }; });
  test('stale contracts preserve history and invalidate transitive ports', () => { const graph = supported(); graph.units[0].question += ' Revised.'; assert(validateGraph(graph).valid); const states = analyzeGraph(graph).units; assert.deepStrictEqual(states.H00.available.capability, []); assert.deepStrictEqual(states.H03.available.capability, []); assert.strictEqual(graph.units[0].attempts.length, 1); });
  test('receipt mismatches exclude dependent evidence', () => { const graph = supported(); graph.units[2].attempts[0].inputs[0].receipt_sha256 = 'f'.repeat(64); assert(validateGraph(graph).valid); assert.deepStrictEqual(analyzeGraph(graph).units.H03.available.capability, []); });
  test('exact dependency binding', () => { const graph = supported(); graph.units[2].attempts[0].inputs.pop(); assert.deepStrictEqual(analyzeGraph(graph).units.H02.available.capability, []); });
  test('invalid history cannot be consumed', () => { const graph = supported(); graph.units[0].attempts[0].outcome = 'invalid'; graph.units[0].attempts[0].emits = []; assert(validateGraph(graph).valid); assert.deepStrictEqual(analyzeGraph(graph).units.H03.available.capability, []); });
  test('refutation is an assessment, not a capability', () => { const graph = fixture(); const unit = graph.units[0]; unit.attempts.push(makeAttempt(unit, [], 'refuted')); const state = analyzeGraph(graph).units.H00; assert.strictEqual(state.available.assessment.length, 1); assert.strictEqual(state.available.capability.length, 0); });
  test('conflicts withhold capability but preserve assessments', () => { const graph = supported(); graph.units[0].attempts.push(makeAttempt(graph.units[0], [], 'refuted')); const states = analyzeGraph(graph).units; assert.strictEqual(states.H00.status, 'disputed'); assert.strictEqual(states.H00.available.assessment.length, 2); assert.deepStrictEqual(states.H03.available.capability, []); });
  test('expired claims are not stolen', () => { const graph = fixture(); graph.units[0].claim = { owner: 'worker', attempt: 'lease', expires_utc: '2000-01-01T00:00:00Z', write_paths: ['fixture/'], resources: ['local'] }; assert(validateGraph(graph).valid); assert(!readyReport(graph).ready.some(unit => unit.id === 'H00')); assert.strictEqual(analyzeGraph(graph).units.H00.status, 'claimed'); });
  test('canonical key order and claim exclusion', () => { const unit = fixture().units[0]; const reversed = Object.fromEntries(Object.entries(unit).reverse()); assert.strictEqual(contractHash(unit), contractHash(reversed)); reversed.claim = { owner: 'someone' }; reversed.attempts = [42]; assert.strictEqual(contractHash(unit), contractHash(reversed)); });
  test('render scope and LF freshness', () => { const graph = fixture(); const document = 'prefix\r\n' + START + '\r\nstale\r\n' + END + '\r\nsuffix'; const rendered = replaceGenerated(document, renderGenerated(graph)); assert(rendered.startsWith('prefix\r\n' + START)); assert(rendered.endsWith(END + '\r\nsuffix')); assert(checkDocument(graph, rendered)); assert(checkDocument(graph, rendered.replace(/\r?\n/g, '\r\n'))); assert.throws(() => checkDocument(graph, rendered.replace('Generated work frontier', 'stale frontier')), /stale/); });
  test('ambiguous document markers refused', () => { assert.throws(() => replaceGenerated(START + END + START, 'x'), /exactly one/); });
  test('portable contract retains prerequisites', () => { const graph = fixture(); const exported = portableNode(graph, 'H02'); assert.deepStrictEqual(exported.unit.requires, graph.units[2].requires); assert.strictEqual(exported.dependencies.length, graph.units[2].requires.length); });
  test('derived consumers preserve ports and deduplicate converging endpoints', () => {
    const graph = fixture();
    graph.units.push(fixtureUnit('H04', [{ unit: 'H00', port: 'assessment' }, { unit: 'H02', port: 'capability' }]));
    const reverse = deriveReverseLinks(graph);
    assert.deepStrictEqual(reverse.H00.direct_consumers, [{ unit: 'H02', port: 'capability', mode: 'work' }, { unit: 'H04', port: 'assessment', mode: 'work' }]);
    assert.deepStrictEqual(reverse.H00.reachable_endpoints, ['H03', 'H04']);
    assert.deepStrictEqual(reverse.H01.reachable_endpoints, ['H03', 'H04']);
    assert.deepStrictEqual(reverse.H03, { direct_consumers: [], reachable_endpoints: ['H03'] });
    assert.deepStrictEqual(portableNode(graph, 'H00').reachable_endpoints, reverse.H00.reachable_endpoints);
    assert(renderGenerated(graph).includes('- Direct consumers: `H02` via `capability` (work), `H04` via `assessment` (work).'));
  });
  test('reverse links follow dependency mutations instead of stored edges', () => {
    const graph = fixture();
    graph.units[2].requires = [{ unit: 'H00', port: 'assessment' }];
    const reverse = deriveReverseLinks(graph);
    assert.deepStrictEqual(reverse.H00.direct_consumers, [{ unit: 'H02', port: 'assessment', mode: 'work' }]);
    assert.deepStrictEqual(reverse.H01, { direct_consumers: [], reachable_endpoints: ['H01'] });
    assert.deepStrictEqual(reverse.H00.reachable_endpoints, ['H03']);
  });
  test('choice qualification accepts either backend or their pinned union', () => {
    for (const selected of [['H07'], ['H08'], ['H07', 'H08']]) {
      const graph = qualificationFixture(selected);
      assert(validateGraph(graph).valid);
      const states = analyzeGraph(graph).units;
      assert.strictEqual(states.H10.status, 'qualified');
      assert.strictEqual(states.H11.status, 'qualified');
    }
  });
  test('all failed candidates can still be assessed', () => {
    const graph = qualificationFixture([], { H07: 'refuted', H08: 'refuted', H09: 'refuted' });
    const selector = graph.units.find(unit => unit.id === 'H10');
    selector.attempts[0].outcome = 'refuted';
    selector.attempts[0].emits = ['assessment'];
    const states = analyzeGraph(graph).units;
    assert.strictEqual(states.H10.available.assessment.length, 1);
    assert.deepStrictEqual(states.H10.available.capability, []);
    selector.attempts = [];
    graph.units.find(unit => unit.id === 'H11').attempts = [];
    assert(readyReport(graph).ready.some(unit => unit.id === 'H10'));
  });
  test('missing or unqualified selection withholds only capability', () => {
    for (const graph of [qualificationFixture([]), qualificationFixture(['H08'], { H08: 'refuted' })]) {
      const states = analyzeGraph(graph).units;
      assert.strictEqual(states.H10.available.assessment.length, 1);
      assert.deepStrictEqual(states.H10.available.capability, []);
      assert.deepStrictEqual(states.H11.available.capability, []);
      assert(states.H10.attempts[0].capability_reasons.length > 0);
    }
    const graph = qualificationFixture();
    delete graph.units[0].attempts[0].capability_inputs;
    assert.deepStrictEqual(analyzeGraph(graph).units.H10.available.capability, []);
  });
  test('selected backend dispute revokes downstream capability but keeps selector assessment', () => {
    const graph = qualificationFixture();
    const selected = graph.units.find(unit => unit.id === 'H08');
    selected.attempts.push(makeAttempt(selected, [], 'refuted'));
    const states = analyzeGraph(graph).units;
    assert.strictEqual(states.H08.status, 'disputed');
    assert.strictEqual(states.H10.available.assessment.length, 1);
    assert.deepStrictEqual(states.H10.available.capability, []);
    assert.deepStrictEqual(states.H11.available.capability, []);
  });
  test('unselected backend refutation does not revoke selection', () => {
    const graph = qualificationFixture();
    const unselected = graph.units.find(unit => unit.id === 'H07');
    unselected.attempts.push(makeAttempt(unselected, [], 'refuted'));
    const states = analyzeGraph(graph).units;
    assert.strictEqual(states.H07.status, 'disputed');
    assert.strictEqual(states.H10.status, 'qualified');
    assert.strictEqual(states.H11.status, 'qualified');
  });
  test('qualification receipt pin is exact and assessment survives mismatch', () => {
    const graph = qualificationFixture();
    graph.units[0].attempts[0].capability_inputs[0].receipt_sha256 = 'f'.repeat(64);
    const states = analyzeGraph(graph).units;
    assert.strictEqual(states.H10.available.assessment.length, 1);
    assert.deepStrictEqual(states.H10.available.capability, []);
    assert(states.H10.attempts[0].capability_reasons.some(reason => reason.includes('receipt mismatch')));
  });
  test('fixed conditional inputs affect capability but not assessment or work readiness', () => {
    const graph = qualificationFixture();
    const extra = fixtureUnit('H12');
    const fixed = fixtureUnit('H14', [{ unit: 'H10', port: 'assessment' }]);
    fixed.capability_requires = [{ unit: 'H11', port: 'capability' }, { unit: 'H12', port: 'capability' }];
    graph.units.push(fixed, extra);
    assert(readyReport(graph).ready.some(unit => unit.id === 'H14'));
    const attempt = makeAttempt(fixed, [bind(graph.units.find(unit => unit.id === 'H10'), 'assessment')]);
    attempt.capability_inputs = [bind(graph.units.find(unit => unit.id === 'H11'))];
    fixed.attempts.push(attempt);
    let state = analyzeGraph(graph).units.H14;
    assert.strictEqual(state.available.assessment.length, 1);
    assert.deepStrictEqual(state.available.capability, []);
    extra.attempts.push(makeAttempt(extra));
    attempt.capability_inputs.push(bind(extra));
    assert.strictEqual(analyzeGraph(graph).units.H14.status, 'qualified');
    extra.question += ' Changed contract.';
    state = analyzeGraph(graph).units.H14;
    assert.strictEqual(state.available.assessment.length, 1);
    assert.deepStrictEqual(state.available.capability, []);
  });
  test('every qualification choice group needs a selection', () => {
    const graph = qualificationFixture();
    const extra = fixtureUnit('H06');
    extra.attempts.push(makeAttempt(extra));
    graph.units.push(extra);
    const selector = graph.units[0];
    selector.capability_choices.push({ name: 'model', options: [{ unit: 'H06', port: 'capability' }] });
    selector.attempts[0].contract_sha256 = contractHash(selector);
    assert.deepStrictEqual(analyzeGraph(graph).units.H10.available.capability, []);
    selector.attempts[0].capability_inputs.push(bind(extra));
    assert.strictEqual(analyzeGraph(graph).units.H10.status, 'qualified');
  });
  test('qualification ref revision preserves stale attempt history', () => {
    const graph = qualificationFixture();
    graph.units[0].capability_choices[0].options = [{ unit: 'H07', port: 'capability' }];
    assert(validateGraph(graph).valid);
    assert.deepStrictEqual(analyzeGraph(graph).units.H10.available.capability, []);
    assert.strictEqual(graph.units[0].attempts[0].capability_inputs[0].unit, 'H08');
  });
  const invalidQualification = (name, mutate) => test(name, () => { const graph = qualificationFixture(); mutate(graph); assert.strictEqual(validateGraph(graph).valid, false); });
  invalidQualification('undeclared qualification binding is rejected', graph => graph.units[0].attempts[0].capability_inputs.push(bind(graph.units[1])));
  invalidQualification('duplicate qualification binding is rejected', graph => graph.units[0].attempts[0].capability_inputs.push(copy(graph.units[0].attempts[0].capability_inputs[0])));
  invalidQualification('unknown choice annotation is rejected', graph => { graph.units[0].attempts[0].capability_inputs[0].choice = 'unknown'; });
  invalidQualification('duplicate choice names are rejected', graph => graph.units[0].capability_choices.push(copy(graph.units[0].capability_choices[0])));
  invalidQualification('empty choice is rejected', graph => { graph.units[0].capability_choices[0].options = []; });
  invalidQualification('qualification assessment port is rejected', graph => { graph.units[0].capability_choices[0].options[0].port = 'assessment'; });
  invalidQualification('qualification cycle is rejected', graph => { graph.units.find(unit => unit.id === 'H07').capability_requires = [{ unit: 'H11', port: 'capability' }]; });
  test('conditional reverse links and rendering distinguish all dependency modes', () => {
    const graph = qualificationFixture();
    graph.units[1].capability_requires = [{ unit: 'H07', port: 'capability' }];
    const links = deriveReverseLinks(graph).H07.direct_consumers;
    assert(links.some(link => link.unit === 'H10' && link.mode === 'work'));
    assert(links.some(link => link.unit === 'H10' && link.mode === 'capability-choice' && link.choice === 'backend'));
    assert(links.some(link => link.unit === 'H11' && link.mode === 'capability-all'));
    assert(renderGenerated(graph).includes('H07 -.->|choice: backend| H10'));
    assert(renderGenerated(graph).includes('H07 -.->|capability-all| H11'));
    assert(portableNode(graph, 'H10').dependencies.some(input => input.mode === 'capability-choice'));
  });
  test('CLI run path', () => { const child = spawnSync(process.execPath, [__filename, '--help'], { encoding: 'utf8', timeout: 10000 }); assert.strictEqual(child.status, 0, child.stderr); assert(child.stdout.includes('--check')); });
  test('CLI rejects unknown command', () => { const child = spawnSync(process.execPath, [__filename, '--unknown'], { encoding: 'utf8', timeout: 10000 }); assert.notStrictEqual(child.status, 0); assert(child.stderr.includes('Unknown command')); });
  test('import is silent and exports production checker', () => { const script = 'const tool = require(process.argv[1]); if (typeof tool.validateGraph !== "function" || typeof tool.analyzeGraph !== "function") process.exit(2);'; const child = spawnSync(process.execPath, ['-e', script, __filename], { encoding: 'utf8', timeout: 10000 }); assert.strictEqual(child.status, 0, child.stderr); assert.strictEqual(child.stdout, ''); });
  return checks;
}

function main(args = process.argv.slice(2)) {
  const [command, id] = args;
  const help = 'Usage: node tools/compute-horizon.js --check | --ready | --node ID | --contract ID | --render | --self-test';
  if (command === '--help' && args.length === 1) { console.log(help); return; }
  if (!['--check', '--ready', '--node', '--contract', '--render', '--self-test'].includes(command)) throw new Error('Unknown command. ' + help);
  if (args.length !== (['--node', '--contract'].includes(command) ? 2 : 1)) throw new Error(help);
  if (command === '--self-test') { console.log('compute-horizon self-test: ' + selfTest() + ' checks passed (synthetic qualification tests, not scientific validation).'); return; }
  const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
  requireValid(graph);
  if (command === '--node') { console.log(JSON.stringify(portableNode(graph, id), null, 2)); return; }
  if (command === '--contract') {
    const unit = graph.units.find(entry => entry.id === id);
    if (!unit) throw new Error('Unknown unit: ' + id);
    console.log(contractHash(unit)); return;
  }
  if (command === '--ready') { console.log(JSON.stringify(readyReport(graph), null, 2)); return; }
  const document = fs.readFileSync(DOC_PATH, 'utf8');
  if (command === '--render') {
    const updated = replaceGenerated(document, renderGenerated(graph));
    if (updated !== document) fs.writeFileSync(DOC_PATH, updated, 'utf8');
    console.log('Rendered only the generated horizon region.'); return;
  }
  checkDocument(graph, document);
  const analysis = analyzeGraph(graph);
  const excluded = Object.values(analysis.units).flatMap(unit => unit.attempts).filter(attempt => attempt.reasons.length);
  console.log('Horizon graph and generated region are structurally current. Excluded historical attempts: ' + excluded.length + '.');
  console.log('This does not verify receipt contents, scientific claims, actual independence, or registration chronology.');
}

module.exports = { validateGraph, analyzeGraph, deriveReverseLinks, dependencyRefs, contractHash, canonical, renderGenerated, replaceGenerated, checkDocument, portableNode, readyReport, selfTest, main };

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
