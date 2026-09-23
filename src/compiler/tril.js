'use strict';
/**
 * tril.js — Compiler for the Balanced Ternary Implementation Language (Tril)
 *
 * Translates high-level balanced ternary code into verified Tryte Assembly (TASM)
 * that executes on TryteVM, the Native Rust SIMD Engine, and Silicon RTL.
 *
 * Supported features:
 * - Functions: `fn <name>() { ... }`
 * - Variables: `let x = <expr>;`, `x = <expr>;`
 * - 3-Way Ternary Branching: `branch3 (<expr>) { neg => { ... }, zero => { ... }, pos => { ... } }`
 * - Structured Ternary Loops: `while3 (<expr>) { ... }`
 * - I/O primitives: `out(<expr>);`, `in()`
 * - Native ternary operators: `+`, `-`, `*`, `min`, `max`, `csum`, `neg`, `tgate`, `<<`, `>>`
 * - Literals: decimal integers (`-364..364`), trit literals (`t+0-`, `t++++++`)
 * - Machine control: `halt();`
 */

const T = require('../ternary.js');
const { TryteVM } = require('../vm.js');
const { assemble, loadInto } = require('../assembler.js');
const { OPS } = require('../isa.js');

// ---------------------------------------------------------------------------
// Lexer / Tokenizer
// ---------------------------------------------------------------------------

const KEYWORDS = new Set([
  'fn', 'let', 'branch3', 'while3', 'neg', 'zero', 'pos',
  'out', 'in', 'halt', 'return', 'min', 'max', 'csum', 'tgate',
  'shl', 'shr'
]);

function tokenize(src) {
  const tokens = [];
  const lines = src.split(/\r?\n/);

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    let line = lines[lineNo].replace(/(#|\/\/).*$/, '').trim();
    if (!line) continue;

    let col = 0;
    while (col < line.length) {
      const ch = line[col];

      // Whitespace
      if (/\s/.test(ch)) {
        col++;
        continue;
      }

      // Multi-char operators / punctuation
      if (line.startsWith('=>', col)) {
        tokens.push({ type: 'ARROW', value: '=>', line: lineNo + 1 });
        col += 2;
        continue;
      }
      if (line.startsWith('<<', col)) {
        tokens.push({ type: 'OP', value: '<<', line: lineNo + 1 });
        col += 2;
        continue;
      }
      if (line.startsWith('>>', col)) {
        tokens.push({ type: 'OP', value: '>>', line: lineNo + 1 });
        col += 2;
        continue;
      }

      // Single-char punctuation
      if ('{}();,=,'.includes(ch)) {
        tokens.push({ type: ch, value: ch, line: lineNo + 1 });
        col++;
        continue;
      }

      // Single-char operators (+, -, *)
      if ('+*'.includes(ch)) {
        tokens.push({ type: 'OP', value: ch, line: lineNo + 1 });
        col++;
        continue;
      }

      // Minus sign: could be operator or negative number
      if (ch === '-') {
        // If followed by digits, it's a negative number
        if (col + 1 < line.length && /\d/.test(line[col + 1])) {
          let numStr = '-';
          col++;
          while (col < line.length && /\d/.test(line[col])) {
            numStr += line[col];
            col++;
          }
          tokens.push({ type: 'NUMBER', value: parseInt(numStr, 10), line: lineNo + 1 });
          continue;
        } else {
          tokens.push({ type: 'OP', value: '-', line: lineNo + 1 });
          col++;
          continue;
        }
      }

      // Trit literals: t+0-, t+-+, etc.
      if (ch === 't' && col + 1 < line.length && /[+\-0]/.test(line[col + 1])) {
        let tStr = '';
        col++; // skip 't'
        while (col < line.length && /[+\-0]/.test(line[col])) {
          tStr += line[col];
          col++;
        }
        const val = T.parseTritString(tStr);
        tokens.push({ type: 'NUMBER', value: val, line: lineNo + 1 });
        continue;
      }

      // Numbers
      if (/\d/.test(ch)) {
        let numStr = '';
        while (col < line.length && /\d/.test(line[col])) {
          numStr += line[col];
          col++;
        }
        tokens.push({ type: 'NUMBER', value: parseInt(numStr, 10), line: lineNo + 1 });
        continue;
      }

      // Identifiers / keywords
      if (/[A-Za-z_]/.test(ch)) {
        let id = '';
        while (col < line.length && /[A-Za-z0-9_]/.test(line[col])) {
          id += line[col];
          col++;
        }
        if (KEYWORDS.has(id)) {
          tokens.push({ type: 'KEYWORD', value: id, line: lineNo + 1 });
        } else {
          tokens.push({ type: 'IDENT', value: id, line: lineNo + 1 });
        }
        continue;
      }

      throw new Error(`Unexpected character '${ch}' at line ${lineNo + 1}, col ${col + 1}`);
    }
  }

  tokens.push({ type: 'EOF', value: null, line: lines.length });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume(expectedType = null, expectedValue = null) {
    const tok = this.tokens[this.pos];
    if (expectedType && tok.type !== expectedType) {
      throw new Error(`Expected token type '${expectedType}', got '${tok.type}' (${tok.value}) at line ${tok.line}`);
    }
    if (expectedValue && tok.value !== expectedValue) {
      throw new Error(`Expected token value '${expectedValue}', got '${tok.value}' at line ${tok.line}`);
    }
    this.pos++;
    return tok;
  }

  match(type, value = null) {
    const tok = this.peek();
    if (!tok || tok.type !== type) return false;
    if (value !== null && tok.value !== value) return false;
    this.pos++;
    return true;
  }

  parseProgram() {
    const functions = [];
    while (this.peek().type !== 'EOF') {
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'fn') {
        functions.push(this.parseFunction());
      } else {
        // Top-level statements wrapped in main
        const stmts = [];
        while (this.peek().type !== 'EOF' && !(this.peek().type === 'KEYWORD' && this.peek().value === 'fn')) {
          stmts.push(this.parseStatement());
        }
        functions.push({
          type: 'Function',
          name: 'main',
          params: [],
          body: stmts
        });
      }
    }
    return { type: 'Program', functions };
  }

  parseFunction() {
    this.consume('KEYWORD', 'fn');
    const nameTok = this.consume('IDENT');
    this.consume('(');
    const params = [];
    if (this.peek().type !== ')') {
      params.push(this.consume('IDENT').value);
      while (this.match(',')) {
        params.push(this.consume('IDENT').value);
      }
    }
    this.consume(')');
    this.consume('{');
    const body = [];
    while (this.peek().type !== '}') {
      body.push(this.parseStatement());
    }
    this.consume('}');
    return {
      type: 'Function',
      name: nameTok.value,
      params,
      body
    };
  }

  parseStatement() {
    const tok = this.peek();

    // 1. Variable declaration: let x = expr;
    if (tok.type === 'KEYWORD' && tok.value === 'let') {
      this.consume('KEYWORD', 'let');
      const name = this.consume('IDENT').value;
      this.consume('=');
      const expr = this.parseExpression();
      this.consume(';');
      return { type: 'Let', name, expr };
    }

    // 2. Halt: halt();
    if (tok.type === 'KEYWORD' && tok.value === 'halt') {
      this.consume('KEYWORD', 'halt');
      this.consume('(');
      this.consume(')');
      this.consume(';');
      return { type: 'Halt' };
    }

    // 3. Out: out(expr);
    if (tok.type === 'KEYWORD' && tok.value === 'out') {
      this.consume('KEYWORD', 'out');
      this.consume('(');
      const expr = this.parseExpression();
      this.consume(')');
      this.consume(';');
      return { type: 'Out', expr };
    }

    // 4. Branch3: branch3 (expr) { neg => { ... }, zero => { ... }, pos => { ... } }
    if (tok.type === 'KEYWORD' && tok.value === 'branch3') {
      this.consume('KEYWORD', 'branch3');
      this.consume('(');
      const cond = this.parseExpression();
      this.consume(')');
      this.consume('{');

      let negBranch = null;
      let zeroBranch = null;
      let posBranch = null;

      while (this.peek().type !== '}') {
        const armTok = this.consume('KEYWORD');
        const arm = armTok.value;
        this.consume('ARROW', '=>');
        this.consume('{');
        const armBody = [];
        while (this.peek().type !== '}') {
          armBody.push(this.parseStatement());
        }
        this.consume('}');
        this.match(','); // optional comma

        if (arm === 'neg') negBranch = armBody;
        else if (arm === 'zero') zeroBranch = armBody;
        else if (arm === 'pos') posBranch = armBody;
        else throw new Error(`Invalid branch3 arm '${arm}' at line ${armTok.line}. Expected 'neg', 'zero', or 'pos'`);
      }
      this.consume('}');

      return {
        type: 'Branch3',
        cond,
        negBranch: negBranch || [],
        zeroBranch: zeroBranch || [],
        posBranch: posBranch || []
      };
    }

    // 5. While3: while3 (cond) { body }
    if (tok.type === 'KEYWORD' && tok.value === 'while3') {
      this.consume('KEYWORD', 'while3');
      this.consume('(');
      const cond = this.parseExpression();
      this.consume(')');
      this.consume('{');
      const body = [];
      while (this.peek().type !== '}') {
        body.push(this.parseStatement());
      }
      this.consume('}');
      return { type: 'While3', cond, body };
    }

    // 6. Assignment or Expression statement: x = expr;
    if (tok.type === 'IDENT') {
      const nextTok = this.tokens[this.pos + 1];
      if (nextTok && nextTok.type === '=') {
        const name = this.consume('IDENT').value;
        this.consume('=');
        const expr = this.parseExpression();
        this.consume(';');
        return { type: 'Assign', name, expr };
      }
    }

    // Default: expression as statement
    const expr = this.parseExpression();
    this.consume(';');
    return { type: 'ExprStmt', expr };
  }

  parseExpression() {
    return this.parseBinary(0);
  }

  // Operator precedence climbing
  getPrecedence(op) {
    switch (op) {
      case '<<':
      case '>>':
        return 1;
      case '+':
      case '-':
        return 2;
      case '*':
        return 3;
      default:
        return 0;
    }
  }

  parseBinary(minPrec) {
    let left = this.parsePrimary();

    while (this.peek().type === 'OP') {
      const op = this.peek().value;
      const prec = this.getPrecedence(op);
      if (prec < minPrec) break;

      this.consume('OP');
      const right = this.parseBinary(prec + 1);
      left = { type: 'BinaryOp', op, left, right };
    }

    return left;
  }

  parsePrimary() {
    const tok = this.peek();

    // Parentheses
    if (this.match('(')) {
      const expr = this.parseExpression();
      this.consume(')');
      return expr;
    }

    // Unary minus
    if (tok.type === 'OP' && tok.value === '-') {
      this.consume('OP', '-');
      const expr = this.parsePrimary();
      return { type: 'UnaryOp', op: 'neg', expr };
    }

    // Number literal
    if (tok.type === 'NUMBER') {
      this.consume('NUMBER');
      return { type: 'Literal', value: tok.value };
    }

    // Builtin in(): in()
    if (tok.type === 'KEYWORD' && tok.value === 'in') {
      this.consume('KEYWORD', 'in');
      this.consume('(');
      this.consume(')');
      return { type: 'In' };
    }

    // Builtins: min, max, csum, neg, tgate
    if (tok.type === 'KEYWORD' && ['min', 'max', 'csum', 'neg', 'tgate', 'shl', 'shr'].includes(tok.value)) {
      const fn = this.consume('KEYWORD').value;
      this.consume('(');
      const args = [];
      if (this.peek().type !== ')') {
        args.push(this.parseExpression());
        while (this.match(',')) {
          args.push(this.parseExpression());
        }
      }
      this.consume(')');
      return { type: 'BuiltinCall', fn, args };
    }

    // Identifier / Variable
    if (tok.type === 'IDENT') {
      const name = this.consume('IDENT').value;
      return { type: 'Variable', name };
    }

    throw new Error(`Unexpected token '${tok.value}' (${tok.type}) in expression at line ${tok.line}`);
  }
}

// ---------------------------------------------------------------------------
// TASM Code Generator
// ---------------------------------------------------------------------------

class CodeGenerator {
  constructor(options = {}) {
    this.options = options;
    this.instructions = [];
    this.variables = new Map(); // name -> negative memory address
    this.varOffset = -1;
    this.labelCounter = 0;
    this.tables = []; // { name, neg, zero, pos }
    this.needsMultiplier = false;
  }

  freshLabel(prefix) {
    this.labelCounter++;
    return `_${prefix}_${this.labelCounter}`;
  }

  allocVar(name) {
    if (!this.variables.has(name)) {
      this.variables.set(name, this.varOffset);
      this.varOffset--;
      if (this.varOffset < -364) {
        throw new Error('Memory overflow: variables exceeded 364 cells');
      }
    }
    return this.variables.get(name);
  }

  emit(instruction) {
    this.instructions.push(instruction);
  }

  compile(ast) {
    // Collect all functions
    for (const fn of ast.functions) {
      if (fn.name === 'main') {
        this.compileMain(fn);
      }
    }

    // Emit halt if not already ended
    this.emit('        HALT');

    // If multiplication was used, emit shift-and-add multiplier routine
    if (this.needsMultiplier) {
      this.emitMultiplierSubroutine();
    }

    // Emit branch3 jump tables
    for (const tbl of this.tables) {
      this.emit(`${tbl.name}: .table ${tbl.neg}, ${tbl.zero}, ${tbl.pos}`);
    }

    // Emit variable memory definitions (.org -N)
    if (this.variables.size > 0) {
      const minAddr = this.varOffset + 1;
      this.emit(`        .org  ${minAddr}`);
      // Sort by address
      const sorted = Array.from(this.variables.entries()).sort((a, b) => a[1] - b[1]);
      for (const [name, addr] of sorted) {
        this.emit(`${name}: .word 0  ; addr ${addr}`);
      }
    }

    return this.instructions.join('\n');
  }

  compileMain(fn) {
    for (const stmt of fn.body) {
      this.compileStatement(stmt);
    }
  }

  compileStatement(stmt) {
    switch (stmt.type) {
      case 'Let': {
        this.allocVar(stmt.name);
        this.compileExpression(stmt.expr);
        this.emit(`        STORE ${stmt.name}`);
        break;
      }
      case 'Assign': {
        this.allocVar(stmt.name);
        this.compileExpression(stmt.expr);
        this.emit(`        STORE ${stmt.name}`);
        break;
      }
      case 'Out': {
        this.compileExpression(stmt.expr);
        this.emit('        OUT');
        break;
      }
      case 'Halt': {
        this.emit('        HALT');
        break;
      }
      case 'ExprStmt': {
        this.compileExpression(stmt.expr);
        break;
      }
      case 'Branch3': {
        const tblLabel = this.freshLabel('br_tbl');
        const negLabel = this.freshLabel('br_neg');
        const zeroLabel = this.freshLabel('br_zero');
        const posLabel = this.freshLabel('br_pos');
        const endLabel = this.freshLabel('br_end');

        // 1. Evaluate condition into Accumulator
        this.compileExpression(stmt.cond);

        // 2. Hardware 3-way conditional branch
        this.emit(`        BR3   ${tblLabel}`);
        this.tables.push({
          name: tblLabel,
          neg: negLabel,
          zero: zeroLabel,
          pos: posLabel
        });

        // 3. Neg branch
        this.emit(`${negLabel}:`);
        for (const s of stmt.negBranch) this.compileStatement(s);
        this.emit(`        JMP   ${endLabel}`);

        // 4. Zero branch
        this.emit(`${zeroLabel}:`);
        for (const s of stmt.zeroBranch) this.compileStatement(s);
        this.emit(`        JMP   ${endLabel}`);

        // 5. Pos branch
        this.emit(`${posLabel}:`);
        for (const s of stmt.posBranch) this.compileStatement(s);

        // 6. End label
        this.emit(`${endLabel}:`);
        break;
      }
      case 'While3': {
        const loopLabel = this.freshLabel('while_loop');
        const tblLabel = this.freshLabel('while_tbl');
        const bodyLabel = this.freshLabel('while_body');
        const endLabel = this.freshLabel('while_end');

        this.emit(`${loopLabel}:`);
        this.compileExpression(stmt.cond);
        this.emit(`        BR3   ${tblLabel}`);

        // Loop continues only while positive (>0)
        this.tables.push({
          name: tblLabel,
          neg: endLabel,
          zero: endLabel,
          pos: bodyLabel
        });

        this.emit(`${bodyLabel}:`);
        for (const s of stmt.body) this.compileStatement(s);
        this.emit(`        JMP   ${loopLabel}`);
        this.emit(`${endLabel}:`);
        break;
      }
      default:
        throw new Error(`Unknown statement type '${stmt.type}'`);
    }
  }

  compileExpression(expr) {
    switch (expr.type) {
      case 'Literal': {
        this.emit(`        LOADI ${expr.value}`);
        break;
      }
      case 'Variable': {
        this.allocVar(expr.name);
        this.emit(`        LOAD  ${expr.name}`);
        break;
      }
      case 'In': {
        this.emit('        IN');
        break;
      }
      case 'UnaryOp': {
        if (expr.op === 'neg') {
          this.compileExpression(expr.expr);
          this.emit('        NEG');
        } else {
          throw new Error(`Unknown unary operator '${expr.op}'`);
        }
        break;
      }
      case 'BinaryOp': {
        this.compileBinaryOp(expr);
        break;
      }
      case 'BuiltinCall': {
        this.compileBuiltin(expr);
        break;
      }
      default:
        throw new Error(`Unknown expression type '${expr.type}'`);
    }
  }

  compileBinaryOp(expr) {
    const { op, left, right } = expr;

    // Optimization: if right operand is a literal integer for ADD or SUB
    if (right.type === 'Literal') {
      if (op === '+') {
        this.compileExpression(left);
        this.emit(`        ADDI  ${right.value}`);
        return;
      }
      if (op === '-') {
        this.compileExpression(left);
        this.emit(`        ADDI  ${-right.value}`);
        return;
      }
      if (op === '<<') {
        this.compileExpression(left);
        this.emit(`        SHL   ${right.value}`);
        return;
      }
      if (op === '>>') {
        this.compileExpression(left);
        this.emit(`        SHR   ${right.value}`);
        return;
      }
    }

    // Optimization: if right operand is a variable
    if (right.type === 'Variable') {
      this.allocVar(right.name);
      if (op === '+') {
        this.compileExpression(left);
        this.emit(`        ADD   ${right.name}`);
        return;
      }
      if (op === '-') {
        this.compileExpression(left);
        this.emit(`        SUB   ${right.name}`);
        return;
      }
    }

    // General case: evaluate left, store to temporary, evaluate right, apply op
    const tmp = this.allocVar(this.freshLabel('__tmp'));
    this.compileExpression(left);
    this.emit(`        STORE ${this.getVarName(tmp)}`);
    this.compileExpression(right);

    // Now Accumulator has right, memory has left
    if (op === '+') {
      this.emit(`        ADD   ${this.getVarName(tmp)}`);
    } else if (op === '-') {
      // We need left - right. Accumulator has right.
      // NEG gives -right. ADD left gives left - right!
      this.emit('        NEG');
      this.emit(`        ADD   ${this.getVarName(tmp)}`);
    } else if (op === '*') {
      this.needsMultiplier = true;
      const tmpRight = this.allocVar(this.freshLabel('__mul_r'));
      this.emit(`        STORE ${this.getVarName(tmpRight)}`);
      this.emit(`        LOAD  ${this.getVarName(tmp)}`);
      this.emit('        STORE __mul_a');
      this.emit(`        LOAD  ${this.getVarName(tmpRight)}`);
      this.emit('        STORE __mul_b');
      const retLabel = this.freshLabel('mul_done');
      this.emit(`        LOADI ${retLabel}`);
      this.emit('        STORE __mul_ret');
      this.emit('        JMP   __mul_entry');
      this.emit(`${retLabel}:`);
    } else {
      throw new Error(`Unsupported binary operator '${op}'`);
    }
  }

  compileBuiltin(call) {
    const { fn, args } = call;
    if (fn === 'min') {
      if (args.length !== 2) throw new Error('min() requires 2 arguments');
      const tmp = this.allocVar(this.freshLabel('__min_tmp'));
      this.compileExpression(args[1]);
      this.emit(`        STORE ${this.getVarName(tmp)}`);
      this.compileExpression(args[0]);
      this.emit(`        MIN   ${this.getVarName(tmp)}`);
    } else if (fn === 'max') {
      if (args.length !== 2) throw new Error('max() requires 2 arguments');
      const tmp = this.allocVar(this.freshLabel('__max_tmp'));
      this.compileExpression(args[1]);
      this.emit(`        STORE ${this.getVarName(tmp)}`);
      this.compileExpression(args[0]);
      this.emit(`        MAX   ${this.getVarName(tmp)}`);
    } else if (fn === 'csum') {
      if (args.length !== 2) throw new Error('csum() requires 2 arguments');
      const tmp = this.allocVar(this.freshLabel('__csum_tmp'));
      this.compileExpression(args[1]);
      this.emit(`        STORE ${this.getVarName(tmp)}`);
      this.compileExpression(args[0]);
      this.emit(`        CSUM  ${this.getVarName(tmp)}`);
    } else if (fn === 'neg') {
      if (args.length !== 1) throw new Error('neg() requires 1 argument');
      this.compileExpression(args[0]);
      this.emit('        NEG');
    } else if (fn === 'shl') {
      if (args.length !== 2) throw new Error('shl() requires 2 arguments');
      this.compileExpression(args[0]);
      if (args[1].type !== 'Literal') throw new Error('shl() second argument must be literal');
      this.emit(`        SHL   ${args[1].value}`);
    } else if (fn === 'shr') {
      if (args.length !== 2) throw new Error('shr() requires 2 arguments');
      this.compileExpression(args[0]);
      if (args[1].type !== 'Literal') throw new Error('shr() second argument must be literal');
      this.emit(`        SHR   ${args[1].value}`);
    } else if (fn === 'tgate') {
      if (args.length !== 3) throw new Error('tgate() requires 3 arguments: (a, b, ctrl)');
      // args[0] is a, args[1] is b, args[2] is ctrl
      const tmpCtrl = this.allocVar(this.freshLabel('__tg_c'));
      const tmpB = this.allocVar(this.freshLabel('__tg_b'));

      this.compileExpression(args[2]);
      this.emit(`        STORE ${this.getVarName(tmpCtrl)}`);
      this.emit(`        LDC   ${this.getVarName(tmpCtrl)}`);

      this.compileExpression(args[1]);
      this.emit(`        STORE ${this.getVarName(tmpB)}`);

      this.compileExpression(args[0]);
      this.emit(`        TGATE ${this.getVarName(tmpB)}`);
    } else {
      throw new Error(`Unknown builtin function '${fn}'`);
    }
  }

  getVarName(addr) {
    for (const [name, a] of this.variables.entries()) {
      if (a === addr) return name;
    }
    return `var_${addr}`;
  }

  emitMultiplierSubroutine() {
    this.allocVar('__mul_a');
    this.allocVar('__mul_b');
    this.allocVar('__mul_res');
    this.allocVar('__mul_cnt');
    this.allocVar('__mul_hi');
    this.allocVar('__mul_tmp');
    this.allocVar('__mul_ret');

    this.emit('; --- Balanced Ternary Shift-and-Add Multiplier Subroutine ---');
    this.emit('__mul_entry:');
    this.emit('        LOADI 0');
    this.emit('        STORE __mul_res');
    this.emit('        LOADI 6');
    this.emit('        STORE __mul_cnt');
    this.emit('__mul_lp: LOAD  __mul_b');
    this.emit('        SHR   1');
    this.emit('        STORE __mul_hi');
    this.emit('        SHL   1');
    this.emit('        STORE __mul_tmp');
    this.emit('        LOAD  __mul_b');
    this.emit('        SUB   __mul_tmp');
    this.emit('        BR3   __mul_br');
    this.tables.push({
      name: '__mul_br',
      neg: '__mul_sub',
      zero: '__mul_nxt',
      pos: '__mul_add'
    });
    this.emit('__mul_add: LOAD __mul_res');
    this.emit('        ADD   __mul_a');
    this.emit('        STORE __mul_res');
    this.emit('        JMP   __mul_nxt');
    this.emit('__mul_sub: LOAD __mul_res');
    this.emit('        SUB   __mul_a');
    this.emit('        STORE __mul_res');
    this.emit('        JMP   __mul_nxt');
    this.emit('__mul_nxt: LOAD __mul_a');
    this.emit('        SHL   1');
    this.emit('        STORE __mul_a');
    this.emit('        LOAD  __mul_hi');
    this.emit('        STORE __mul_b');
    this.emit('        LOAD  __mul_cnt');
    this.emit('        ADDI  -1');
    this.emit('        STORE __mul_cnt');
    this.emit('        BR3   __mul_chk');
    this.tables.push({
      name: '__mul_chk',
      neg: '__mul_fin',
      zero: '__mul_fin',
      pos: '__mul_lp'
    });
    this.emit('__mul_fin: LOAD __mul_res');
    this.emit('        JMPX  __mul_ret');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compiles Tril source code into TASM assembly string.
 */
function compile(source, options = {}) {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  const ast = parser.parseProgram();
  const generator = new CodeGenerator(options);
  return generator.compile(ast);
}

/**
 * Compiles Tril source code and assembles into TryteVM cells.
 */
function compileAndAssemble(source, origin = 0) {
  const tasm = compile(source);
  return assemble(tasm, origin);
}

/**
 * Compiles Tril source code, loads into TryteVM, and executes with given inputs.
 */
function compileAndRun(source, inputs = [], maxSteps = 100000) {
  const tasm = compile(source);
  const vm = new TryteVM({ input: inputs, maxSteps });
  loadInto(vm, tasm, 0);
  vm.run();
  return vm;
}

/**
 * Compiles Tril source code directly to 12-bit dual-rail hex for Verilog & Rust SIMD.
 */
function compileToHex(source) {
  const { cells } = compileAndAssemble(source);
  const lines = [];
  for (let phys = 0; phys < 729; phys++) {
    const balancedAddr = phys - 364;
    const val = cells.has(balancedAddr) ? cells.get(balancedAddr) : 0;
    const trits = T.toTrits(val);
    let bits = 0;
    for (let i = 0; i < 6; i++) {
      const t = trits[i];
      if (t === 1) bits |= (1 << (2 * i));
      else if (t === -1) bits |= (2 << (2 * i));
    }
    lines.push(bits.toString(16).padStart(3, '0'));
  }
  return lines.join('\n');
}

module.exports = {
  tokenize,
  Parser,
  CodeGenerator,
  compile,
  compileAndAssemble,
  compileAndRun,
  compileToHex
};
