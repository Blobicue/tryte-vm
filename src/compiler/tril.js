'use strict';
/**
 * tril.js — Compiler for the Balanced Ternary Implementation Language (Tril)
 *
 * Translates high-level balanced ternary code into verified Tryte Assembly (TASM)
 * that executes on TryteVM, the Native Rust SIMD Engine, and Silicon RTL.
 *
 * Supported features:
 * - Functions: `fn <name>(<params>) { ... }`, `return <expr>;`
 * - Standard Library: auto-linking of math, memory, string, and crypto routines
 * - Arrays & Pointers: `array name[size]`, `name[i]`, `*ptr`, `*ptr = val`
 * - Variables: `let x = <expr>;`, `x = <expr>;`
 * - 3-Way Ternary Branching: `branch3 (<expr>) { neg => { ... }, zero => { ... }, pos => { ... } }`
 * - Structured Ternary Loops: `while3 (<expr>) { ... }`
 * - I/O primitives: `out(<expr>);`, `in()`
 * - Native ternary operators: `+`, `-`, `*`, `min`, `max`, `csum`, `neg`, `tgate`, `<<`, `>>`
 * - Literals: decimal integers (`-364..364`), trit literals (`t+0-`), strings (`"..."`), chars (`'A'`)
 * - Machine control: `halt();`
 */

const T = require('../ternary.js');
const { TryteVM } = require('../vm.js');
const { assemble, loadInto } = require('../assembler.js');
const { OPS } = require('../isa.js');
const { STDLIB_SRC, STDLIB_FUNCTION_NAMES } = require('./stdlib.js');

// ---------------------------------------------------------------------------
// Lexer / Tokenizer
// ---------------------------------------------------------------------------

const KEYWORDS = new Set([
  'fn', 'let', 'array', 'branch3', 'while3', 'neg', 'zero', 'pos',
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

      // Single-char punctuation (including brackets [ and ])
      if ('{}();,=,[]'.includes(ch)) {
        tokens.push({ type: ch, value: ch, line: lineNo + 1 });
        col++;
        continue;
      }

      // String literals: "hello"
      if (ch === '"') {
        let str = '';
        col++; // skip opening quote
        while (col < line.length && line[col] !== '"') {
          if (line[col] === '\\' && col + 1 < line.length) {
            col++;
            if (line[col] === 'n') str += '\n';
            else if (line[col] === 't') str += '\t';
            else if (line[col] === '0') str += '\0';
            else str += line[col];
          } else {
            str += line[col];
          }
          col++;
        }
        if (col >= line.length) {
          throw new Error(`Unterminated string literal at line ${lineNo + 1}`);
        }
        col++; // skip closing quote
        tokens.push({ type: 'STRING', value: str, line: lineNo + 1 });
        continue;
      }

      // Character literals: 'A'
      if (ch === "'") {
        col++;
        let charVal = 0;
        if (line[col] === '\\' && col + 1 < line.length) {
          col++;
          if (line[col] === 'n') charVal = 10;
          else if (line[col] === 't') charVal = 9;
          else if (line[col] === '0') charVal = 0;
          else charVal = line.charCodeAt(col);
        } else {
          charVal = line.charCodeAt(col);
        }
        col++;
        if (line[col] !== "'") {
          throw new Error(`Unterminated character literal at line ${lineNo + 1}`);
        }
        col++;
        tokens.push({ type: 'NUMBER', value: charVal, line: lineNo + 1 });
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
    const topLevelStmts = [];

    while (this.peek().type !== 'EOF') {
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'fn') {
        functions.push(this.parseFunction());
      } else {
        topLevelStmts.push(this.parseStatement());
      }
    }

    if (topLevelStmts.length > 0) {
      let mainFn = functions.find(f => f.name === 'main');
      if (mainFn) {
        mainFn.body = topLevelStmts.concat(mainFn.body);
      } else {
        functions.unshift({
          type: 'Function',
          name: 'main',
          params: [],
          body: topLevelStmts
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

    // 1. Array declaration: array name[size]; or array name[size] = ...;
    if (tok.type === 'KEYWORD' && tok.value === 'array') {
      this.consume('KEYWORD', 'array');
      const name = this.consume('IDENT').value;
      this.consume('[');
      const sizeTok = this.consume('NUMBER');
      this.consume(']');
      let init = null;
      if (this.match('=')) {
        if (this.peek().type === 'STRING') {
          init = this.consume('STRING').value;
        } else if (this.match('[')) {
          init = [];
          if (this.peek().type !== ']') {
            init.push(this.parseExpression());
            while (this.match(',')) {
              init.push(this.parseExpression());
            }
          }
          this.consume(']');
        } else {
          throw new Error(`Expected array initializer at line ${this.peek().line}`);
        }
      }
      this.consume(';');
      return { type: 'ArrayDecl', name, size: sizeTok.value, init };
    }

    // 2. Variable declaration: let x = expr;
    if (tok.type === 'KEYWORD' && tok.value === 'let') {
      this.consume('KEYWORD', 'let');
      const name = this.consume('IDENT').value;
      this.consume('=');
      const expr = this.parseExpression();
      this.consume(';');
      return { type: 'Let', name, expr };
    }

    // 3. Return: return expr; or return;
    if (tok.type === 'KEYWORD' && tok.value === 'return') {
      this.consume('KEYWORD', 'return');
      let expr = null;
      if (this.peek().type !== ';') {
        expr = this.parseExpression();
      }
      this.consume(';');
      return { type: 'Return', expr };
    }

    // 4. Halt: halt();
    if (tok.type === 'KEYWORD' && tok.value === 'halt') {
      this.consume('KEYWORD', 'halt');
      this.consume('(');
      this.consume(')');
      this.consume(';');
      return { type: 'Halt' };
    }

    // 5. Out: out(expr);
    if (tok.type === 'KEYWORD' && tok.value === 'out') {
      this.consume('KEYWORD', 'out');
      this.consume('(');
      const expr = this.parseExpression();
      this.consume(')');
      this.consume(';');
      return { type: 'Out', expr };
    }

    // 6. Branch3: branch3 (expr) { neg => { ... }, zero => { ... }, pos => { ... } }
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

    // 7. While3: while3 (cond) { body }
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

    // 8. Pointer dereference assignment: *ptr = expr;
    if (tok.type === 'OP' && tok.value === '*') {
      this.consume('OP', '*');
      const target = this.parsePrimary();
      this.consume('=');
      const expr = this.parseExpression();
      this.consume(';');
      return { type: 'DerefAssign', target, expr };
    }

    // 9. Assignment, indexed assignment, or expression statement starting with IDENT
    if (tok.type === 'IDENT') {
      const nextTok = this.tokens[this.pos + 1];
      if (nextTok && nextTok.type === '=') {
        const name = this.consume('IDENT').value;
        this.consume('=');
        const expr = this.parseExpression();
        this.consume(';');
        return { type: 'Assign', name, expr };
      }
      if (nextTok && nextTok.type === '[') {
        const name = this.consume('IDENT').value;
        this.consume('[');
        const index = this.parseExpression();
        this.consume(']');
        if (this.match('=')) {
          const expr = this.parseExpression();
          this.consume(';');
          return { type: 'IndexAssign', name, index, expr };
        } else {
          // It was an expression like name[i] + ...;
          let left = { type: 'Index', name, index };
          while (this.peek().type === 'OP') {
            const op = this.consume('OP').value;
            const right = this.parseBinary(this.getPrecedence(op) + 1);
            left = { type: 'BinaryOp', op, left, right };
          }
          this.consume(';');
          return { type: 'ExprStmt', expr: left };
        }
      }
    }

    // Default: expression statement
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

    // String literal
    if (tok.type === 'STRING') {
      this.consume('STRING');
      return { type: 'StringLiteral', value: tok.value };
    }

    // Pointer dereference: *expr
    if (tok.type === 'OP' && tok.value === '*') {
      this.consume('OP', '*');
      const expr = this.parsePrimary();
      return { type: 'Deref', expr };
    }

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

    // Builtins: min, max, csum, neg, tgate, shl, shr
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

    // Identifier: function call, array index, or variable
    if (tok.type === 'IDENT') {
      const name = this.consume('IDENT').value;
      // Function call: name(args)
      if (this.match('(')) {
        const args = [];
        if (this.peek().type !== ')') {
          args.push(this.parseExpression());
          while (this.match(',')) {
            args.push(this.parseExpression());
          }
        }
        this.consume(')');
        return { type: 'Call', name, args };
      }
      // Array indexing: name[index]
      if (this.match('[')) {
        const index = this.parseExpression();
        this.consume(']');
        return { type: 'Index', name, index };
      }
      // Variable
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
    this.arrays = new Map();    // name -> { addr, size, initValues }
    this.functions = new Map(); // name -> Function AST node
    this.currentFunction = null;
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

  allocArray(name, size, init = null) {
    if (this.arrays.has(name)) {
      throw new Error(`Array '${name}' already declared`);
    }
    const base = this.varOffset - (size - 1);
    this.varOffset -= size;
    if (this.varOffset < -364) {
      throw new Error('Memory overflow: arrays/variables exceeded 364 cells');
    }

    let initValues = [];
    if (typeof init === 'string') {
      initValues = Array.from(init).map(c => c.charCodeAt(0)).concat([0]);
    } else if (Array.isArray(init)) {
      initValues = init.map(e => (typeof e === 'number' ? e : (e && e.type === 'Literal' ? e.value : 0)));
    }
    while (initValues.length < size) initValues.push(0);
    if (initValues.length > size) initValues.length = size;

    this.arrays.set(name, { addr: base, size, initValues });
    return base;
  }

  declareVar(name) {
    if (this.currentFunction) {
      const scoped = `_fn_${this.currentFunction.name}_${name}`;
      this.allocVar(scoped);
      return scoped;
    } else {
      this.allocVar(name);
      return name;
    }
  }

  resolveVar(name) {
    if (this.currentFunction) {
      const scoped = `_fn_${this.currentFunction.name}_${name}`;
      if (this.currentFunction.params.includes(name) || this.variables.has(scoped)) {
        this.allocVar(scoped);
        return scoped;
      }
    }
    if (this.arrays.has(name)) return name;
    if (this.variables.has(name) || name.startsWith('__') || !this.currentFunction) {
      this.allocVar(name);
      return name;
    }
    if (this.currentFunction) {
      const scoped = `_fn_${this.currentFunction.name}_${name}`;
      this.allocVar(scoped);
      return scoped;
    }
    this.allocVar(name);
    return name;
  }

  emit(instruction) {
    this.instructions.push(instruction);
  }

  compile(ast) {
    // 1. Register all functions
    for (const fn of ast.functions) {
      this.functions.set(fn.name, fn);
    }

    // 2. Pre-allocate all static arrays across AST for stable memory addressing
    for (const fn of ast.functions) {
      for (const stmt of fn.body) {
        if (stmt.type === 'ArrayDecl') {
          this.allocArray(stmt.name, stmt.size, stmt.init);
        }
      }
    }

    // 3. Auto-link Standard Library functions if enabled
    if (this.options.includeStdlib !== false) {
      this.autoLinkStdlib(ast);
    }

    // 3. Find and compile main function
    const mainFn = this.functions.get('main');
    if (mainFn) {
      this.compileMain(mainFn);
    }

    // 4. Emit halt after main if not already halted
    if (!this.instructions[this.instructions.length - 1]?.trim().startsWith('HALT')) {
      this.emit('        HALT');
    }

    // 5. Compile all non-main functions
    for (const fn of this.functions.values()) {
      if (fn.name !== 'main') {
        this.compileFunction(fn);
      }
    }

    // 6. Emit multiplier subroutine if required
    if (this.needsMultiplier) {
      this.emitMultiplierSubroutine();
    }

    // 7. Emit branch3 jump tables
    for (const tbl of this.tables) {
      this.emit(`${tbl.name}: .table ${tbl.neg}, ${tbl.zero}, ${tbl.pos}`);
    }

    // 8. Emit memory segment (.org minAddr) for variables and arrays
    if (this.variables.size > 0 || this.arrays.size > 0) {
      const minAddr = this.varOffset + 1;
      this.emit(`        .org  ${minAddr}`);

      const items = [];
      for (const [name, addr] of this.variables.entries()) {
        items.push({ addr, name, isArray: false });
      }
      for (const [name, info] of this.arrays.entries()) {
        items.push({ addr: info.addr, name, isArray: true, size: info.size, initValues: info.initValues });
      }

      items.sort((a, b) => a.addr - b.addr);

      for (const item of items) {
        if (item.isArray) {
          this.emit(`${item.name}: .word ${item.initValues.join(', ')}  ; addr ${item.addr}..${item.addr + item.size - 1}`);
        } else {
          this.emit(`${item.name}: .word 0  ; addr ${item.addr}`);
        }
      }
    }

    return this.instructions.join('\n');
  }

  autoLinkStdlib(ast) {
    const stdlibTokens = tokenize(STDLIB_SRC);
    const stdlibParser = new Parser(stdlibTokens);
    const stdlibAst = stdlibParser.parseProgram();
    const stdlibFnMap = new Map();
    for (const fn of stdlibAst.functions) {
      stdlibFnMap.set(fn.name, fn);
    }

    // Find all called functions in user code
    const needed = new Set();
    const visited = new Set();

    const scanExpr = (expr) => {
      if (!expr) return;
      if (expr.type === 'Call') {
        if (STDLIB_FUNCTION_NAMES.has(expr.name) && !this.functions.has(expr.name)) {
          needed.add(expr.name);
        }
        for (const a of expr.args) scanExpr(a);
      } else if (expr.type === 'BinaryOp') {
        scanExpr(expr.left);
        scanExpr(expr.right);
      } else if (expr.type === 'UnaryOp') {
        scanExpr(expr.expr);
      } else if (expr.type === 'Index') {
        scanExpr(expr.index);
      } else if (expr.type === 'Deref') {
        scanExpr(expr.expr);
      } else if (expr.type === 'BuiltinCall') {
        for (const a of expr.args) scanExpr(a);
      }
    };

    const scanStmt = (stmt) => {
      if (!stmt) return;
      switch (stmt.type) {
        case 'Let':
        case 'Assign':
        case 'Out':
        case 'Return':
        case 'ExprStmt':
          scanExpr(stmt.expr);
          break;
        case 'IndexAssign':
          scanExpr(stmt.index);
          scanExpr(stmt.expr);
          break;
        case 'DerefAssign':
          scanExpr(stmt.target);
          scanExpr(stmt.expr);
          break;
        case 'Branch3':
          scanExpr(stmt.cond);
          for (const s of stmt.negBranch) scanStmt(s);
          for (const s of stmt.zeroBranch) scanStmt(s);
          for (const s of stmt.posBranch) scanStmt(s);
          break;
        case 'While3':
          scanExpr(stmt.cond);
          for (const s of stmt.body) scanStmt(s);
          break;
      }
    };

    for (const fn of ast.functions) {
      for (const s of fn.body) scanStmt(s);
    }

    // Recursively link needed stdlib functions
    while (needed.size > 0) {
      const fnName = needed.values().next().value;
      needed.delete(fnName);
      if (visited.has(fnName)) continue;
      visited.add(fnName);

      const stdlibFn = stdlibFnMap.get(fnName);
      if (stdlibFn && !this.functions.has(fnName)) {
        this.functions.set(fnName, stdlibFn);
        ast.functions.push(stdlibFn);
        for (const s of stdlibFn.body) scanStmt(s);
      }
    }
  }

  compileMain(fn) {
    this.currentFunction = null;
    for (const stmt of fn.body) {
      this.compileStatement(stmt);
    }
  }

  compileFunction(fn) {
    this.currentFunction = fn;
    const entryLabel = `_fn_${fn.name}`;
    this.emit(`\n; --- Function ${fn.name} ---`);
    this.emit(`${entryLabel}:`);

    for (const p of fn.params) {
      this.allocVar(`_fn_${fn.name}_${p}`);
    }
    const retVar = `_fn_${fn.name}_ret`;
    this.allocVar(retVar);

    for (const stmt of fn.body) {
      this.compileStatement(stmt);
    }

    if (!this.instructions[this.instructions.length - 1]?.trim().startsWith(`JMPX  ${retVar}`)) {
      this.emit(`        JMPX  ${retVar}`);
    }
    this.currentFunction = null;
  }

  compileStatement(stmt) {
    switch (stmt.type) {
      case 'ArrayDecl': {
        if (!this.arrays.has(stmt.name)) {
          this.allocArray(stmt.name, stmt.size, stmt.init);
        }
        break;
      }
      case 'Let': {
        const vName = this.declareVar(stmt.name);
        this.compileExpression(stmt.expr);
        this.emit(`        STORE ${vName}`);
        break;
      }
      case 'Assign': {
        const vName = this.resolveVar(stmt.name);
        this.compileExpression(stmt.expr);
        this.emit(`        STORE ${vName}`);
        break;
      }
      case 'IndexAssign': {
        this.compileExpression(stmt.expr);
        const valTmp = this.allocVar('__val_tmp');
        this.emit(`        STORE ${this.getVarName(valTmp)}`);

        this.compileExpression(stmt.index);
        if (this.currentFunction && this.currentFunction.params.includes(stmt.name)) {
          const vName = this.resolveVar(stmt.name);
          this.emit(`        ADD   ${vName}`);
        } else if (this.arrays.has(stmt.name)) {
          this.emit(`        ADDI  ${stmt.name}`);
        } else {
          const vName = this.resolveVar(stmt.name);
          this.emit(`        ADD   ${vName}`);
        }
        const ptrTmp = this.allocVar('__ptr_tmp');
        this.emit(`        STORE ${this.getVarName(ptrTmp)}`);

        this.emit(`        LOAD  ${this.getVarName(valTmp)}`);
        this.emit(`        STOREX ${this.getVarName(ptrTmp)}`);
        break;
      }
      case 'DerefAssign': {
        this.compileExpression(stmt.expr);
        const valTmp = this.allocVar('__val_tmp');
        this.emit(`        STORE ${this.getVarName(valTmp)}`);

        this.compileExpression(stmt.target);
        const ptrTmp = this.allocVar('__ptr_tmp');
        this.emit(`        STORE ${this.getVarName(ptrTmp)}`);

        this.emit(`        LOAD  ${this.getVarName(valTmp)}`);
        this.emit(`        STOREX ${this.getVarName(ptrTmp)}`);
        break;
      }
      case 'Return': {
        if (stmt.expr) {
          this.compileExpression(stmt.expr);
        }
        if (this.currentFunction) {
          const retVar = `_fn_${this.currentFunction.name}_ret`;
          this.emit(`        JMPX  ${retVar}`);
        } else {
          this.emit('        HALT');
        }
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

        this.compileExpression(stmt.cond);
        this.emit(`        BR3   ${tblLabel}`);
        this.tables.push({
          name: tblLabel,
          neg: negLabel,
          zero: zeroLabel,
          pos: posLabel
        });

        this.emit(`${negLabel}:`);
        for (const s of stmt.negBranch) this.compileStatement(s);
        const negRet = stmt.negBranch.length > 0 && stmt.negBranch[stmt.negBranch.length - 1].type === 'Return';
        if (!negRet) this.emit(`        JMP   ${endLabel}`);

        this.emit(`${zeroLabel}:`);
        for (const s of stmt.zeroBranch) this.compileStatement(s);
        const zeroRet = stmt.zeroBranch.length > 0 && stmt.zeroBranch[stmt.zeroBranch.length - 1].type === 'Return';
        if (!zeroRet) this.emit(`        JMP   ${endLabel}`);

        this.emit(`${posLabel}:`);
        for (const s of stmt.posBranch) this.compileStatement(s);
        const posRet = stmt.posBranch.length > 0 && stmt.posBranch[stmt.posBranch.length - 1].type === 'Return';
        if (!posRet && !negRet && !zeroRet) {
          this.emit(`${endLabel}:`);
        } else if (!negRet || !zeroRet) {
          this.emit(`${endLabel}:`);
        }
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
      case 'StringLiteral': {
        const strLabel = this.freshLabel('__str');
        const rawVals = Array.from(expr.value).map(c => c.charCodeAt(0)).concat([0]);
        this.allocArray(strLabel, rawVals.length, rawVals);
        this.emit(`        LOADI ${strLabel}`);
        break;
      }
      case 'Variable': {
        if (this.currentFunction && this.currentFunction.params.includes(expr.name)) {
          const vName = this.resolveVar(expr.name);
          this.emit(`        LOAD  ${vName}`);
        } else if (this.arrays.has(expr.name)) {
          this.emit(`        LOADI ${expr.name}`);
        } else {
          const vName = this.resolveVar(expr.name);
          this.emit(`        LOAD  ${vName}`);
        }
        break;
      }
      case 'Index': {
        this.compileExpression(expr.index);
        if (this.currentFunction && this.currentFunction.params.includes(expr.name)) {
          const vName = this.resolveVar(expr.name);
          this.emit(`        ADD   ${vName}`);
        } else if (this.arrays.has(expr.name)) {
          this.emit(`        ADDI  ${expr.name}`);
        } else {
          const vName = this.resolveVar(expr.name);
          this.emit(`        ADD   ${vName}`);
        }
        const ptrTmp = this.allocVar('__ptr_tmp');
        this.emit(`        STORE ${this.getVarName(ptrTmp)}`);
        this.emit(`        LOADX ${this.getVarName(ptrTmp)}`);
        break;
      }
      case 'Deref': {
        this.compileExpression(expr.expr);
        const ptrTmp = this.allocVar('__ptr_tmp');
        this.emit(`        STORE ${this.getVarName(ptrTmp)}`);
        this.emit(`        LOADX ${this.getVarName(ptrTmp)}`);
        break;
      }
      case 'Call': {
        const fnName = expr.name;
        if (['min', 'max', 'csum', 'neg', 'tgate', 'shl', 'shr'].includes(fnName)) {
          this.compileBuiltin({ fn: fnName, args: expr.args });
          return;
        }

        const targetFn = this.functions.get(fnName);
        if (!targetFn) {
          throw new Error(`Undefined function '${fnName}' called`);
        }

        if (expr.args.length !== targetFn.params.length) {
          throw new Error(`Function '${fnName}' expects ${targetFn.params.length} arguments, got ${expr.args.length}`);
        }

        // Evaluate each argument directly into parameter variable
        for (let i = 0; i < expr.args.length; i++) {
          this.compileExpression(expr.args[i]);
          const paramName = `_fn_${fnName}_${targetFn.params[i]}`;
          this.allocVar(paramName);
          this.emit(`        STORE ${paramName}`);
        }

        // Return linkage
        const retLabel = this.freshLabel(`call_${fnName}_ret`);
        const retVar = `_fn_${fnName}_ret`;
        this.allocVar(retVar);
        this.emit(`        LOADI ${retLabel}`);
        this.emit(`        STORE ${retVar}`);

        this.emit(`        JMP   _fn_${fnName}`);
        this.emit(`${retLabel}:`);
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
    let { op, left, right } = expr;
    if (op === '*' && left.type === 'Literal' && right.type !== 'Literal') {
      const t = left; left = right; right = t;
    }

    // Optimization: literal on right
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
      if (op === '*') {
        if (right.value === 0) {
          this.emit('        LOADI 0');
          return;
        }
        if (right.value === 1) {
          this.compileExpression(left);
          return;
        }
        if (right.value === -1) {
          this.compileExpression(left);
          this.emit('        NEG');
          return;
        }
        if (right.value === 3) {
          this.compileExpression(left);
          this.emit('        SHL   1');
          return;
        }
        if (right.value === 9) {
          this.compileExpression(left);
          this.emit('        SHL   2');
          return;
        }
        if (right.value === 27) {
          this.compileExpression(left);
          this.emit('        SHL   3');
          return;
        }
      }
    }

    // Optimization: variable on right
    if (right.type === 'Variable') {
      if (this.currentFunction && this.currentFunction.params.includes(right.name)) {
        const vName = this.resolveVar(right.name);
        if (op === '+') {
          this.compileExpression(left);
          this.emit(`        ADD   ${vName}`);
          return;
        }
        if (op === '-') {
          this.compileExpression(left);
          this.emit(`        SUB   ${vName}`);
          return;
        }
      } else if (this.arrays.has(right.name)) {
        if (op === '+') {
          this.compileExpression(left);
          this.emit(`        ADDI  ${right.name}`);
          return;
        }
      } else {
        const vName = this.resolveVar(right.name);
        if (op === '+') {
          this.compileExpression(left);
          this.emit(`        ADD   ${vName}`);
          return;
        }
        if (op === '-') {
          this.compileExpression(left);
          this.emit(`        SUB   ${vName}`);
          return;
        }
      }
    }

    // General case: evaluate left, store to temporary, evaluate right, apply op
    const tmp = this.allocVar(this.freshLabel('__tmp'));
    this.compileExpression(left);
    this.emit(`        STORE ${this.getVarName(tmp)}`);
    this.compileExpression(right);

    if (op === '+') {
      this.emit(`        ADD   ${this.getVarName(tmp)}`);
    } else if (op === '-') {
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

    this.emit('\n; --- Balanced Ternary Shift-and-Add Multiplier Subroutine ---');
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
function compileAndAssemble(source, origin = 0, options = {}) {
  const tasm = compile(source, options);
  return assemble(tasm, origin);
}

/**
 * Compiles Tril source code, loads into TryteVM, and executes with given inputs.
 */
function compileAndRun(source, inputs = [], maxSteps = 100000, options = {}) {
  const tasm = compile(source, options);
  const vm = new TryteVM({ input: inputs, maxSteps });
  loadInto(vm, tasm, 0);
  vm.run();
  return vm;
}

/**
 * Compiles Tril source code directly to 12-bit dual-rail hex for Verilog & Rust SIMD.
 */
function compileToHex(source, options = {}) {
  const { cells } = compileAndAssemble(source, 0, options);
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
