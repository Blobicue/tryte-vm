'use strict';
/* test-page.js — verify the published page's own glue code.
 *
 * The arithmetic in docs/tryte-vm.html is the real emulator source (build-artifact.js
 * already fails the build if it diverges). What this file checks is the layer the
 * build cannot: that the controls are wired to it correctly — that pressing Run
 * really runs the program, that Negate really negates, and that the trit strips
 * render the value they claim to.
 *
 * There is no jsdom here, so the page runs against a small DOM shim that
 * implements exactly the surface the page uses.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

/* --- a DOM just big enough -------------------------------------------------- */
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = []; this.parent = null;
    this._text = ''; this.className = ''; this.dataset = {};
    this.attrs = {}; this.style = {}; this.listeners = {};
    this.value = ''; this.type = ''; this.id = '';
  }
  get textContent() {
    return this.children.length ? this.children.map(c => c.textContent).join('') : this._text;
  }
  set textContent(v) { this._text = String(v); this.children = []; }
  set innerHTML(html) {
    this.children = [];
    this._text = '';
    // The page only ever injects simple <span>text</span> runs.
    const re = /<(\w+)[^>]*class="([^"]*)"[^>]*>([^<]*)<\/\1>/g;
    let m, any = false;
    while ((m = re.exec(html))) {
      any = true;
      const c = new El(m[1]); c.className = m[2]; c.textContent = m[3];
      this.appendChild(c);
    }
    if (!any) this._text = html.replace(/<[^>]*>/g, '');
  }
  get innerHTML() { return this.textContent; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  /** Bubbles, so delegated handlers (the execution-mode control) are exercised. */
  dispatch(ev, target = this) {
    (this.listeners[ev] || []).forEach(fn => fn({ target }));
    if (this.parent) this.parent.dispatch(ev, target);
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  get classList() {
    const self = this;
    return { add: c => { self.className += ' ' + c; }, contains: c => self.className.split(/\s+/).includes(c) };
  }
  _all() { return this.children.flatMap(c => [c, ...c._all()]); }
  querySelectorAll(sel) {
    const last = sel.trim().split(/\s+/).pop();          // only descendant selectors are used
    const isClass = last.startsWith('.');
    const needle = isClass ? last.slice(1) : last.toUpperCase();
    return this._all().filter(e =>
      isClass ? e.className.split(/\s+/).includes(needle) : e.tagName === needle);
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) {
    const isClass = sel.startsWith('.');
    const needle = isClass ? sel.slice(1) : sel.toUpperCase();
    let n = this;
    while (n) {
      if (isClass ? n.className.split(/\s+/).includes(needle) : n.tagName === needle) return n;
      n = n.parent;
    }
    return null;
  }
  scrollIntoView() {}
}

function makeDocument() {
  const byId = {};
  const root = new El('body');
  const doc = {
    getElementById: id => byId[id],
    createElement: tag => new El(tag),
    querySelectorAll: sel => root.querySelectorAll(sel),
    querySelector: sel => root.querySelector(sel),
    body: root,
    _register(id, tag) { const e = new El(tag); e.id = id; byId[id] = e; root.appendChild(e); return e; },
  };
  return { doc, byId };
}

/* --- load the built page ----------------------------------------------------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'tryte-vm.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];

// Every id the page touches, with the right element type.
const IDS = {
  'num-input': 'input', 'num-strip': 'div', 'r-val': 'dd', 'r-trits': 'dd', 'r-mirror': 'dd',
  'r-sign': 'dd', 'r-explain': 'p', 'b-neg': 'button', 'b-x3': 'button', 'b-d3': 'button',
  'prog-select': 'select', 'prog-input': 'input', 'b-run': 'button', 'b-step': 'button',
  'b-reset': 'button', 'reg-a': 'div', 'reg-c': 'div', 'reg-a-val': 'span', 'reg-c-val': 'span',
  'reg-pc': 'dd', 'reg-steps': 'dd', 'reg-state': 'dd', 'out-tape': 'div', 'listing': 'pre',
  'tg-switches': 'div', 'tg-x': 'input', 'tg-y': 'input', 'tg-out': 'div', 'tg-out-val': 'span',
  'tg-explain': 'p', 'ops-body': 'tbody', 'exec-mode': 'div', 'exec-note': 'p',
};
const { doc, byId } = makeDocument();
for (const [id, tag] of Object.entries(IDS)) doc._register(id, tag);
for (const d of ['1', '2', '3']) {
  const b = new El('button'); b.dataset.depth = d;
  b.setAttribute('aria-pressed', String(d === '1'));
  byId['exec-mode'].appendChild(b);
}
byId['num-input'].value = '123';
byId['prog-input'].value = '7, 5';
byId['tg-x'].value = '123';
byId['tg-y'].value = '-45';

const sandbox = { document: doc, console, performance: { now: () => 0 } };
vm.createContext(sandbox);
vm.runInContext(html.split('<script>')[1].split('</script>')[0] + '\nglobalThis.__T = T;', sandbox);
const T = sandbox.__T;

console.log('\n=== 0. THE BUILT PAGE IS NOT STALE ===');
{
  // Without this, every check below can pass against a page built from an older
  // src/. That is not hypothetical: adding LOADX/STOREX/JMPX left the page on the
  // previous 19-opcode ISA and the whole suite stayed green.
  const { buildBundle, bundleInPage, readPrograms } = require('../build/bundle.js');
  check('the page embeds the CURRENT src/ (rebuild with `npm run build` if this fails)',
    bundleInPage() === buildBundle().trimEnd());
  const inPage = html.split('const PROGRAMS = ')[1].split('\n};')[0] + '\n}';
  check('the page embeds the CURRENT programs/', (() => {
    try { return JSON.stringify(JSON.parse(inPage)) === JSON.stringify(readPrograms()); }
    catch { return false; }
  })());
}

console.log('\n=== 1. THE PAGE LOADS AND WIRES UP ===');
const { OPS } = require('../src/isa.js');
check('the page script runs without throwing', true);
check('the number strip renders six trits', byId['num-strip'].children.length === 6);
check(`the instruction table lists every opcode (${Object.keys(OPS).length})`,
  byId['ops-body'].children.length === Object.keys(OPS).length,
  `page has ${byId['ops-body'].children.length}`);
check('the TGATE panel builds six three-state switches', byId['tg-switches'].children.length === 6);
check('the program picker offers every demo program but not the interpreter', (() => {
  const { readPrograms } = require('../build/bundle.js');
  const expected = Object.keys(readPrograms()).filter(n => n !== 'interp');
  const offered = byId['prog-select'].children.map(o => o.value);
  return offered.length === expected.length && expected.every(n => offered.includes(n));
})(), byId['prog-select'].children.map(o => o.value).join(','));

console.log('\n=== 2. THE NUMBER EXPLORER ===');
check('123 renders as +----0', byId['r-trits'].textContent === '+----0');
check('...and its mirror as -++++0', byId['r-mirror'].textContent === '-++++0');
check('the strip colours match the trits', (() => {
  const cls = byId['num-strip'].children.map(c => c.className.trim().replace('trit ', ''));
  return cls.join(',') === 'pos,neg,neg,neg,neg,zero';
})());
byId['b-neg'].dispatch('click');
check('Negate flips the value to -123', Number(byId['num-input'].value) === -123);
check('...and the readout follows', byId['r-trits'].textContent === '-++++0');
byId['b-neg'].dispatch('click');
byId['b-x3'].dispatch('click');
check('Shift left multiplies by 3 (123 -> 369 wraps to -360)',
  Number(byId['num-input'].value) === T.shiftLeft(123, 1));
byId['num-input'].value = '5';
byId['num-input'].dispatch('input');
byId['b-d3'].dispatch('click');
check('Shift right rounds to nearest (5 -> 2, not 1)', Number(byId['num-input'].value) === 2);

console.log('\n=== 3. THE MACHINE PANEL ===');
for (const d of ['1', '2', '3']) {
  const b = new El('button'); b.dataset.depth = d;
  b.setAttribute('aria-pressed', String(d === '1'));
  byId['exec-mode'].appendChild(b);
}
byId['num-input'].value = '123'; byId['num-input'].dispatch('input');
check('a program is loaded and the listing is populated', byId['listing'].children.length > 20);
check('nothing has run yet', byId['reg-steps'].textContent === '0');
byId['b-run'].dispatch('click');
check('Run executes the program', Number(byId['reg-steps'].textContent) > 0);
check('multiply.tasm 7 x 5 emits 35 on the tape',
  byId['out-tape'].children.some(c => c.textContent.startsWith('35 ')), byId['out-tape'].textContent);
check('the machine reports itself halted', byId['reg-state'].textContent === 'halted');
byId['b-reset'].dispatch('click');
check('Reset clears the run', byId['reg-steps'].textContent === '0' && byId['out-tape'].textContent.includes('nothing'));
byId['b-step'].dispatch('click');
check('Step advances exactly one instruction', byId['reg-steps'].textContent === '1');

byId['prog-select'].value = 'threeway';
byId['prog-select'].dispatch('change');
byId['prog-input'].value = '7, -3, 0, 42, -100';
byId['b-reset'].dispatch('click');
byId['b-run'].dispatch('click');
check('switching to threeway.tasm classifies all five inputs',
  byId['out-tape'].children.map(c => c.textContent.split(' ')[0]).join(',') === '1,-1,0,1,-1',
  byId['out-tape'].textContent);

console.log('\n=== 4. THE RECONFIGURABLE UNIT ===');
const readOut = () => Number(byId['tg-out-val'].textContent.split(' ')[0]);
check('the default mixed control matches tgate(+0-+0-, 123, -45)',
  readOut() === T.tgate(T.parseTritString('+0-+0-'), 123, -45), byId['tg-out-val'].textContent);
const setAll = mode => byId['tg-switches'].children.forEach(sw =>
  sw.querySelectorAll('button').filter(b => b.dataset.m === String(mode))[0].dispatch('click'));
setAll(0);
check('setting every switch to MIN collapses the unit to MIN', readOut() === T.tMIN(123, -45));
setAll(1);
check('setting every switch to MAX collapses the unit to MAX', readOut() === T.tMAX(123, -45));
setAll(-1);
check('setting every switch to NEG collapses the unit to NEG', readOut() === T.neg(123));
check('the explanation reports the collapse', /collapses to a plain NEG/.test(byId['tg-explain'].textContent),
  byId['tg-explain'].textContent);
byId['tg-x'].value = '200'; byId['tg-x'].dispatch('input');
check('editing the data re-runs the unit', readOut() === T.neg(200));

console.log('\n=== 5. RUNNING INSIDE THE EMULATOR, FROM THE PAGE ===');
{
  const modeBtn = d => byId['exec-mode'].children.filter(b => b.dataset.depth === String(d))[0];
  const outputs = () => byId['out-tape'].children.map(c => c.textContent.split(' ')[0]).join(',');

  byId['prog-select'].value = 'multiply';
  byId['prog-select'].dispatch('change');
  byId['prog-input'].value = '7, 5';
  byId['b-reset'].dispatch('click');
  byId['b-run'].dispatch('click');
  const nativeOut = outputs();
  const nativeSteps = Number(byId['reg-steps'].textContent);
  check('native run of multiply gives 35', nativeOut === '35', nativeOut);

  modeBtn(2).dispatch('click');
  check('the mode control marks emulated as selected',
    modeBtn(2).getAttribute('aria-pressed') === 'true' &&
    modeBtn(1).getAttribute('aria-pressed') === 'false');
  check('stepping is disabled while emulating', byId['b-step'].disabled === true);

  byId['prog-input'].value = '7, 5';
  byId['b-run'].dispatch('click');
  check('the emulated run produces the same output', outputs() === nativeOut, outputs());
  const hostedSteps = Number(byId['reg-steps'].textContent);
  check('it takes many more host instructions to do it',
    hostedSteps > nativeSteps * 5, `${hostedSteps} vs ${nativeSteps}`);
  check('the readout reports the ratio and confirms the match',
    /host instructions ran/.test(byId['exec-note'].textContent) &&
    /Output is identical to the native run\./.test(byId['exec-note'].textContent),
    byId['exec-note'].textContent);
  check('the registers shown are the EMULATED machine’s, not the host’s',
    Number(byId['reg-pc'].textContent) < 200);

  // Depth 3: an interpreter inside an interpreter, driven from the page.
  byId['prog-select'].value = 'threeway';
  byId['prog-select'].dispatch('change');
  byId['prog-input'].value = '7, -3, 0, 42, -100';
  modeBtn(1).dispatch('click');
  byId['b-run'].dispatch('click');
  const nativeThree = outputs();
  modeBtn(3).dispatch('click');
  byId['prog-input'].value = '7, -3, 0, 42, -100';
  byId['b-run'].dispatch('click');
  check('threeway at depth 3 matches the native run', outputs() === nativeThree,
    `${outputs()} vs ${nativeThree}`);
  check('the readout names two nested interpreters',
    /through 2 nested interpreters/.test(byId['exec-note'].textContent),
    byId['exec-note'].textContent);

  // A program that cannot fit two levels down must say so, not fail silently.
  byId['prog-select'].value = 'multiply';
  byId['prog-select'].dispatch('change');
  byId['prog-input'].value = '7, 5';
  byId['b-run'].dispatch('click');
  check('a program too big for depth 3 reports why',
    /outside the emulated machine's memory/.test(byId['exec-note'].textContent),
    byId['exec-note'].textContent);

  modeBtn(1).dispatch('click');
  check('switching back to native re-enables stepping', byId['b-step'].disabled === false);
}

console.log('\n' + '='.repeat(64));
console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(', ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
