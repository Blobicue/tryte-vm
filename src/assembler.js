'use strict';
/* assembler.js — text mnemonics -> tryte cells. Two passes: resolve labels, then emit.
 *
 * Syntax
 *   label:  LOADI 42          ; comment
 *           BR3   choose
 *   choose: .table neg, zero, pos     ; 3 cells; the label names the MIDDLE one
 *   value:  .word 17, -3, t+-0++0     ; raw data cells ('t' prefix = trit literal)
 *   BASE:   .equ  200                 ; a named constant; occupies no memory
 *   both:   .fold  minT, negT          ; the 9 cells of minT composed with negT
 *           .org  -100                ; continue assembling at this address
 */

const T = require('./ternary.js');
const { OPS } = require('./isa.js');
const P = require('./phinary.js');
const ALL_OPS = { ...OPS, ...P.PHINARY_OPS };

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

/* A label like `t0` or `t+-` is also valid trit-literal syntax, so `LOADI t0`
 * would silently assemble as the VALUE zero rather than the ADDRESS of t0. That
 * is a wrong program with no diagnostic, so such names are refused outright
 * rather than resolved by precedence, which would only move the surprise. */
const TRIT_LITERAL = /^t[+\-0]+$/i;
function checkLabelName(name, lineNo) {
  if (TRIT_LITERAL.test(name)) {
    throw new Error(
      `label '${name}' (line ${lineNo}) is also trit-literal syntax, so uses of it ` +
      `would assemble as a value instead of an address; rename it`);
  }
  return name;
}

function assemble(src, origin = 0) {
  const lines = tokenize(src);
  const labels = {};
  const span = {};                       // label -> cells emitted for its datum

  // --- pass 1: sizes and label addresses -----------------------------------
  let pc = origin;
  for (const L of lines) {
    if (L.label) checkLabelName(L.label, L.lineNo);
    // How many cells the labelled datum spans, so .fold can refuse a table that
    // is too short. Without this a 2-cell .word silently borrows the seven cells
    // that happen to follow it, and the fold succeeds with the wrong table.
    if (L.label && L.mnemonic) {
      span[L.label] = L.mnemonic === '.WORD' ? L.args.length
        : L.mnemonic === '.FOLD' ? 9
          : L.mnemonic === '.TABLE' ? 3
            : L.mnemonic.startsWith('.') ? 0 : 2;
    }
    if (L.mnemonic === '.ORG') { pc = parseNumber(L.args[0], labels, `line ${L.lineNo}`); if (L.label) labels[L.label] = pc; continue; }
    if (L.mnemonic === '.EQU') {
      if (!L.label) throw new Error(`.equ needs a label (line ${L.lineNo})`);
      labels[L.label] = parseNumber(L.args[0], labels, `line ${L.lineNo}`);
      continue;                                  // occupies no memory
    }
    if (L.label) labels[L.label] = (L.mnemonic === '.TABLE') ? pc + 1 : pc;
    if (!L.mnemonic) continue;
    if (L.mnemonic === '.WORD') pc += L.args.length;
    else if (L.mnemonic === '.FOLD') pc += 9;         // one composed truth table
    else if (L.mnemonic === '.TABLE') {
      if (L.args.length !== 3) throw new Error(`.table needs exactly 3 targets (line ${L.lineNo})`);
      pc += 3;
    } else {
      if (!(L.mnemonic in ALL_OPS)) throw new Error(`unknown instruction '${L.mnemonic}' (line ${L.lineNo})`);
      pc += 2;
    }
  }

  // --- pass 2: emit --------------------------------------------------------
  const cells = new Map();
  const folds = [];
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
    if (L.mnemonic === '.FOLD') {
      if (L.args.length < 2) throw new Error(`.fold needs at least two tables (${where})`);
      folds.push({ at: T.wrap(pc), args: L.args, where });
      for (let i = 0; i < 9; i++) emit(0);            // filled in once every table exists
      continue;
    }
    if (L.mnemonic === '.TABLE') { L.args.forEach(a => emit(parseNumber(a, labels, where))); continue; }

    const spec = ALL_OPS[L.mnemonic];
    emit(spec.code);
    if (spec.operand === 'none') {
      if (L.args.length) throw new Error(`${L.mnemonic} takes no operand (${where})`);
      emit(0);
    } else {
      if (L.args.length !== 1) throw new Error(`${L.mnemonic} needs exactly one operand (${where})`);
      emit(parseNumber(L.args[0], labels, where));
    }
  }

  /* --- pass 3: resolve .fold ----------------------------------------------
   * Deferred to its own pass so a fold may name tables declared after it. The
   * composite is computed from the emitted CELLS, not from the source text, so
   * a fold of a fold works with no special case. */
  for (const f of folds) {
    const tables = f.args.map(a => {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(a) && span[a] !== undefined && span[a] < 9) {
        throw new Error(
          `.fold: '${a}' spans ${span[a]} cells, not 9 — a truth table needs nine ` +
          `entries, and reading past it would silently pick up whatever follows (${f.where})`);
      }
      const base = parseNumber(a, labels, f.where);
      const t = [];
      for (let i = 0; i < 9; i++) {
        const v = cells.get(T.wrap(base + i));
        if (v === undefined) {
          throw new Error(`.fold: '${a}' does not name 9 emitted cells (${f.where})`);
        }
        t.push(v);
      }
      return t;
    });
    const composed = T.foldTables(...tables);
    composed.forEach((v, i) => cells.set(T.wrap(f.at + i), v));
  }

  return { cells, labels, origin, lineOf, folds: folds.length };
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
