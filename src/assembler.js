'use strict';
/* assembler.js — text mnemonics -> tryte cells. Two passes: resolve labels, then emit.
 *
 * Syntax
 *   label:  LOADI 42          ; comment
 *           BR3   choose
 *   choose: .table neg, zero, pos     ; 3 cells; the label names the MIDDLE one
 *   value:  .word 17, -3, t+-0++0     ; raw data cells ('t' prefix = trit literal)
 *   BASE:   .equ  200                 ; a named constant; occupies no memory
 *           .org  -100                ; continue assembling at this address
 */

const T = require('./ternary.js');
const { OPS } = require('./isa.js');

function parseNumber(tok, labels, where) {
  tok = tok.trim();
  if (/^t[+\-0]+$/i.test(tok)) return T.parseTritString(tok.slice(1));
  if (/^[+-]?\d+$/.test(tok)) return parseInt(tok, 10);
  const m = tok.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*([+-])\s*(\d+)$/);
  if (m) {
    if (!(m[1] in labels)) throw new Error(`unknown label '${m[1]}' (${where})`);
    return labels[m[1]] + (m[2] === '+' ? 1 : -1) * parseInt(m[3], 10);
  }
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) {
    if (!(tok in labels)) throw new Error(`unknown label '${tok}' (${where})`);
    return labels[tok];
  }
  throw new Error(`cannot parse operand '${tok}' (${where})`);
}

function tokenize(src) {
  return src.split(/\r?\n/).map((raw, i) => {
    const line = raw.replace(/[;#].*$/, '').trim();
    if (!line) return null;
    let label = null, rest = line;
    const lm = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (lm) { label = lm[1]; rest = lm[2].trim(); }
    const parts = rest ? rest.split(/\s+/) : [];
    const mnemonic = parts.length ? parts[0].toUpperCase() : null;
    const argText = parts.slice(1).join(' ');
    const args = argText ? argText.split(',').map(s => s.trim()).filter(Boolean) : [];
    return { lineNo: i + 1, raw, label, mnemonic, args };
  }).filter(Boolean);
}

function assemble(src, origin = 0) {
  const lines = tokenize(src);
  const labels = {};

  // --- pass 1: sizes and label addresses -----------------------------------
  let pc = origin;
  for (const L of lines) {
    if (L.mnemonic === '.ORG') { pc = parseNumber(L.args[0], labels, `line ${L.lineNo}`); if (L.label) labels[L.label] = pc; continue; }
    if (L.mnemonic === '.EQU') {
      if (!L.label) throw new Error(`.equ needs a label (line ${L.lineNo})`);
      labels[L.label] = parseNumber(L.args[0], labels, `line ${L.lineNo}`);
      continue;                                  // occupies no memory
    }
    if (L.label) labels[L.label] = (L.mnemonic === '.TABLE') ? pc + 1 : pc;
    if (!L.mnemonic) continue;
    if (L.mnemonic === '.WORD') pc += L.args.length;
    else if (L.mnemonic === '.TABLE') {
      if (L.args.length !== 3) throw new Error(`.table needs exactly 3 targets (line ${L.lineNo})`);
      pc += 3;
    } else {
      if (!(L.mnemonic in OPS)) throw new Error(`unknown instruction '${L.mnemonic}' (line ${L.lineNo})`);
      pc += 2;
    }
  }

  // --- pass 2: emit --------------------------------------------------------
  const cells = new Map();
  const lineOf = new Map();          // address -> source line number, for listings
  pc = origin;
  let curLine = 0;
  const emit = v => { cells.set(T.wrap(pc), T.wrap(v)); lineOf.set(T.wrap(pc), curLine); pc = T.wrap(pc + 1); };

  for (const L of lines) {
    const where = `line ${L.lineNo}: ${L.raw.trim()}`;
    curLine = L.lineNo;
    if (L.mnemonic === '.ORG') { pc = parseNumber(L.args[0], labels, where); continue; }
    if (L.mnemonic === '.EQU') continue;
    if (!L.mnemonic) continue;
    if (L.mnemonic === '.WORD') { L.args.forEach(a => emit(parseNumber(a, labels, where))); continue; }
    if (L.mnemonic === '.TABLE') { L.args.forEach(a => emit(parseNumber(a, labels, where))); continue; }

    const spec = OPS[L.mnemonic];
    emit(spec.code);
    if (spec.operand === 'none') {
      if (L.args.length) throw new Error(`${L.mnemonic} takes no operand (${where})`);
      emit(0);
    } else {
      if (L.args.length !== 1) throw new Error(`${L.mnemonic} needs exactly one operand (${where})`);
      emit(parseNumber(L.args[0], labels, where));
    }
  }

  return { cells, labels, origin, lineOf };
}

/** Assemble and load straight into a VM instance. */
function loadInto(vm, src, origin = 0) {
  const { cells, labels, lineOf } = assemble(src, origin);
  for (const [addr, val] of cells) vm.write(addr, val);
  vm.PC = origin;
  vm.labels = labels;
  vm.lineOf = lineOf;
  return vm;
}

module.exports = { assemble, loadInto, tokenize };
