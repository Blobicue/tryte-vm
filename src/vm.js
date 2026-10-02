'use strict';
/* vm.js — the machine.
 *
 * Three registers, all trytes: A (accumulator), C (gate control), PC.
 * One instruction is two cells. Nothing here is binary. */

const T = require('./ternary.js');
const { BY_CODE, EXT_BY_CODE } = require('./isa.js');
const P = require('./phinary.js');

const CELLS = T.TRYTE_STATES;              // 729
const idx = addr => T.wrap(addr) - T.TRYTE_MIN;   // tryte address -> array slot

class TryteVM {
  constructor(opts = {}) {
    this.mem = new Int16Array(CELLS);
    this.A = 0; this.C = 0; this.PC = 0;
    this.output = [];
    this.input = (opts.input || []).slice();
    this.halted = false;
    this.steps = 0;
    this.maxSteps = opts.maxSteps || 200000;
    this.trace = [];
    this.tracing = !!opts.trace;
    // Kept whole for extensions (isa.js), which read their own settings from it. The core
    // reads only the fields above, so it grows no option named for something it does not own.
    this.opts = opts;
  }

  read(addr) { return this.mem[idx(addr)]; }
  write(addr, v) { this.mem[idx(addr)] = T.wrap(v); }

  readCoord(u, v) { return this.read(27 * v + u); }
  writeCoord(u, v, val) { this.write(27 * v + u, val); }

  /** Load assembled cells at a starting address. */
  loadImage(cells, start = 0) {
    cells.forEach((v, i) => this.write(start + i, v));
    this.PC = start;
    return this;
  }

  /** Execute one instruction. Returns false once halted. */
  step() {
    if (this.halted) return false;
    if (this.steps++ >= this.maxSteps) throw new Error('step limit exceeded (runaway program?)');

    const pcBefore = this.PC;
    const opcode = this.read(this.PC);
    const operand = this.read(this.PC + 1);
    const op = BY_CODE[opcode] || P.PHINARY_BY_CODE[opcode] || EXT_BY_CODE[opcode];
    if (!op) throw new Error(`illegal opcode ${opcode} at address ${pcBefore}`);

    let nextPC = T.wrap(this.PC + 2);

    switch (op.name) {
      case 'HALT':  this.halted = true; break;
      case 'LOADI': this.A = T.wrap(operand); break;
      case 'LOAD':  this.A = this.read(operand); break;
      case 'STORE': this.write(operand, this.A); break;
      case 'ADD':   this.A = T.add(this.A, this.read(operand)); break;
      case 'ADDI':  this.A = T.add(this.A, operand); break;
      case 'SUB':   this.A = T.sub(this.A, this.read(operand)); break;
      case 'NEG':   this.A = T.neg(this.A); break;
      case 'MIN':   this.A = T.tMIN(this.A, this.read(operand)); break;
      case 'MAX':   this.A = T.tMAX(this.A, this.read(operand)); break;
      case 'CSUM':  this.A = T.tCLAMPSUM(this.A, this.read(operand)); break;
      case 'SETC':  this.C = T.wrap(operand); break;
      case 'TGATE': this.A = T.tgate(this.C, this.A, this.read(operand)); break;
      case 'SHL':   this.A = T.shiftLeft(this.A, operand); break;
      case 'SHR':   this.A = T.shiftRight(this.A, operand); break;
      case 'JMP':   nextPC = T.wrap(operand); break;
      // The signature instruction: one test, three destinations, no flags register.
      case 'BR3':   nextPC = this.read(T.wrap(operand + T.sign(this.A))); break;
      case 'OUT':   this.output.push(this.A); break;
      case 'IN':    this.A = this.input.length ? T.wrap(this.input.shift()) : 0; break;
      // Indirect forms: the operand names a cell that HOLDS the address.
      case 'LOADX':  this.A = this.read(this.read(operand)); break;
      case 'STOREX': this.write(this.read(operand), this.A); break;
      case 'JMPX':   nextPC = T.wrap(this.read(operand)); break;
      case 'LDC':    this.C = this.read(operand); break;
      // C addresses a nine-entry truth table; the operand is the second input.
      case 'TOP': {
        const tbl = [];
        for (let i = 0; i < 9; i++) tbl.push(this.read(T.wrap(this.C + i)));
        this.A = T.ttable(tbl, this.A, this.read(operand));
        break;
      }
      // 27 rows, each packing an output trit and a carry trit into one cell.
      case 'TOPC': {
        const tbl = [];
        for (let i = 0; i < 27; i++) tbl.push(this.read(T.wrap(this.C + i)));
        this.A = T.ttableC(tbl, this.A, this.read(operand));
        break;
      }
      // --- phinary memory & arithmetic opcodes (PM0) -------------------------
      case 'PHINORM': {
        const sign = this.A < 0 ? -1 : 1;
        const mag = Math.abs(this.A);
        this.A = T.wrap(sign * P.fromZeckendorf(P.toZeckendorf(mag)));
        break;
      }
      case 'PHIMUL': {
        const pair = new P.PhiPair(this.A, this.C);
        const res = operand >= 0 ? P.phiScale(pair) : P.phiScaleInv(pair);
        this.A = T.wrap(res.a);
        this.C = T.wrap(res.b);
        break;
      }
      case 'PHILOAD': {
        const v = this.read(operand);
        const u = this.A;
        this.A = this.read(27 * v + u);
        break;
      }
      case 'PHISTORE': {
        const v = this.read(operand);
        const u = this.C;
        this.write(27 * v + u, this.A);
        break;
      }
      default:
        // An extension (isa.js) carries its own execution; the core only dispatches to it.
        if (op.exec) { op.exec(this, operand, { pc: pcBefore }); break; }
        throw new Error(`unimplemented op ${op.name}`);
    }

    if (this.tracing) {
      this.trace.push({ pc: pcBefore, op: op.name, operand, A: this.A, C: this.C, next: nextPC });
    }
    this.PC = nextPC;
    return !this.halted;
  }

  run() { while (this.step()); return this; }
}

module.exports = { TryteVM, CELLS };
