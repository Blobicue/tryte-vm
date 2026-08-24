'use strict';
/* isa.js — instruction set for the tryte VM.
 *
 * Every instruction is two memory cells: [opcode, operand].
 * Memory is addressed by balanced tryte, so addresses run -364 .. +364 and
 * address 0 is the CENTRE of memory, not one end. Programs are assembled
 * upward from 0; data conventionally sits below it. */

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
};

const BY_CODE = {};
for (const [name, spec] of Object.entries(OPS)) BY_CODE[spec.code] = { name, ...spec };

module.exports = { OPS, BY_CODE };
