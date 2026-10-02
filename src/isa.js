'use strict';
/* isa.js — instruction set for the tryte VM.
 *
 * Every instruction is two memory cells: [opcode, operand].
 * Memory is addressed by balanced tryte, so addresses run -364 .. +364 and
 * address 0 is the CENTRE of memory, not one end. Programs are assembled
 * upward from 0; data conventionally sits below it. */

// phinary's table is consulted only to refuse an extension that would collide with it
const P = require('./phinary.js');

const OPS = {
  HALT:  { code:  0, operand: 'none', doc: 'stop the machine' },
  LOADI: { code:  1, operand: 'imm',  doc: 'A = immediate' },
  LOAD:  { code:  2, operand: 'addr', doc: 'A = mem[addr]' },
  STORE: { code:  3, operand: 'addr', doc: 'mem[addr] = A' },
  ADD:   { code:  4, operand: 'addr', doc: 'A = A + mem[addr]' },
  ADDI:  { code:  5, operand: 'imm',  doc: 'A = A + immediate' },
  SUB:   { code:  6, operand: 'addr', doc: 'A = A - mem[addr]' },
  NEG:   { code:  7, operand: 'none', doc: 'A = -A, by flipping every trit' },
  MIN:   { code:  8, operand: 'addr', doc: 'A = tritwise MIN(A, mem[addr])' },
  MAX:   { code:  9, operand: 'addr', doc: 'A = tritwise MAX(A, mem[addr])' },
  CSUM:  { code: 10, operand: 'addr', doc: 'A = tritwise clamped sum' },
  SETC:  { code: 11, operand: 'imm',  doc: 'C = immediate (TGATE control tryte)' },
  TGATE: { code: 12, operand: 'addr', doc: 'A = TGATE(C, A, mem[addr])' },
  SHL:   { code: 13, operand: 'imm',  doc: 'A = A shifted left n trits (x 3^n)' },
  SHR:   { code: 14, operand: 'imm',  doc: 'A = A shifted right n trits (rounds to nearest)' },
  JMP:   { code: 15, operand: 'addr', doc: 'PC = addr' },
  BR3:   { code: 16, operand: 'addr', doc: 'three-way branch: PC = mem[addr + sign(A)]' },
  OUT:   { code: 17, operand: 'none', doc: 'emit A to output' },
  IN:    { code: 18, operand: 'none', doc: 'A = next input value' },

  // --- indirect addressing -------------------------------------------------
  // Added because writing an interpreter for this machine is impossible without
  // it: an interpreter must read memory at an address it COMPUTES, and every
  // instruction above bakes its address in at assembly time. Indirection goes
  // through a pointer CELL rather than an index register, so one instruction
  // does one access instead of two.
  LOADX:  { code: 19, operand: 'addr', doc: 'A = mem[mem[addr]]  (load through a pointer cell)' },
  STOREX: { code: 20, operand: 'addr', doc: 'mem[mem[addr]] = A  (store through a pointer cell)' },
  JMPX:   { code: 21, operand: 'addr', doc: 'PC = mem[addr]      (computed jump)' },
  LDC:    { code: 22, operand: 'addr', doc: 'C = mem[addr]       (SETC takes an immediate; this takes a variable)' },

  // --- the table-driven operation ------------------------------------------
  // TGATE offers three choices per trit. TOP offers all 3^9 = 19,683 two-input
  // trit functions, because the function is DATA: C holds the address of a nine
  // entry truth table and TOP applies it tritwise. Every TGATE mode is one
  // particular table, so this generalises it rather than sitting beside it.
  TOP:    { code: 23, operand: 'addr', doc: 'A = truth table at C applied tritwise to (A, mem[addr])' },

  // Every operation above computes each output trit from its own position alone,
  // which caps the whole family at 27^w however many tables it owns. TOPC takes a
  // third input -- the carry out of the position below -- and emits one upward, so
  // a single instruction can express functions no positionwise table can. ADD is
  // one particular TOPC table.
  TOPC:   { code: 24, operand: 'addr', doc: 'A = carry-chained table at C applied to (A, mem[addr])' },
};

const BY_CODE = {};
for (const [name, spec] of Object.entries(OPS)) BY_CODE[spec.code] = { name, ...spec };

/* ---------------------------------------------------------------- extensions
 * Instructions defined OUTSIDE the core, registered at runtime by the code that owns them.
 * The core instruction set above is what every finding in this repository rests on; an
 * extension executes on the same machine without being part of it.
 *
 * This exists because the quantum line put QEXEC into OPS and its execution into vm.js,
 * which made the core require a quantum compiler to load. An extension carries its own
 * `exec(vm, operand, ctx)`, so the core names nothing it does not own. The assembler and
 * the VM consult this table at assemble and step time, never at load, because registration
 * happens after the core has loaded.
 *
 * A registration that claims a code or a mnemonic already in use -- in OPS, in phinary's
 * table, or by another extension -- is refused: two tables once both claimed opcode 25,
 * and the VM silently ran a quantum braid where a normalisation was asked for. Registering
 * the identical spec twice is a no-op, so load order among the modules that register it
 * cannot matter. */
const EXTENSIONS = {};       // name -> spec
const EXT_BY_CODE = {};      // code -> { name, ...spec }

function registerExtension(name, spec) {
  if (!/^[A-Z][A-Z0-9]*$/.test(name)) throw new Error(`extension mnemonic must be upper case: '${name}'`);
  if (!Number.isInteger(spec.code)) throw new Error(`extension ${name} needs an integer code`);
  if (!['none', 'imm', 'addr'].includes(spec.operand)) throw new Error(`extension ${name}: operand must be none, imm or addr`);
  if (typeof spec.exec !== 'function') throw new Error(`extension ${name} needs an exec(vm, operand, ctx) function`);
  const prior = EXTENSIONS[name];
  if (prior) {
    if (prior.code === spec.code && prior.exec === spec.exec) return EXT_BY_CODE[spec.code];
    throw new Error(`extension ${name} is already registered with a different definition`);
  }
  const taken = { ...OPS, ...P.PHINARY_OPS, ...EXTENSIONS };
  if (name in taken) throw new Error(`mnemonic ${name} is already in use`);
  const owner = Object.entries(taken).find(([, s]) => s.code === spec.code);
  if (owner) throw new Error(`opcode ${spec.code} is already ${owner[0]}'s; ${name} cannot have it`);
  EXTENSIONS[name] = { ...spec };
  EXT_BY_CODE[spec.code] = { name, ...spec };
  return EXT_BY_CODE[spec.code];
}

module.exports = { OPS, BY_CODE, EXTENSIONS, EXT_BY_CODE, registerExtension };
