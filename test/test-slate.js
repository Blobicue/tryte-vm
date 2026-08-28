'use strict';
/* test-slate.js — the page's three newest components, driven rather than read.
 *
 * `test-ledger.js` proves the page's ARITHMETIC matches the audit. This proves the
 * layer underneath that claim: that bench 08 and bench 09 render, that their controls
 * are wired to the maths rather than to nothing, that pinning reaches the notes panel,
 * and that the slate filters the embedded index instead of merely displaying it.
 *
 * There is no jsdom here. `test-page.js` set the precedent with a DOM shim sized to
 * exactly the surface its page touches; this is a second one, sized to this page's,
 * with the attribute selectors that shim never needed. Elements the page CREATES are
 * real shim nodes and are clicked for real. Elements it writes with `innerHTML` are
 * kept as text and asserted as text, which is honest about what a shim can see: the
 * page's own markup is checked as a string, and its behaviour is checked by driving
 * the handlers that produce it.
 *
 * WHAT THIS CANNOT SEE, so the silence is not read as evidence: layout, styling, and
 * whether the browser's real parser accepts the markup. `test-ledger.js` covers the
 * one parser failure that would be fatal and invisible -- a claim carrying `</script`
 * into the embedded index -- by asserting no raw `<` survives into the payload.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};

/* --- a DOM just big enough, with attribute selectors ------------------------- */

/** One compound selector: `button.rt`, `[data-group="route"]`, `.entry-head`. */
function matchOne(el, part) {
  const attr = /\[([a-z-]+)(?:="([^"]*)")?\]/g;
  let m, ok = true;
  while ((m = attr.exec(part))) {
    const have = el.getAttribute(m[1]);
    if (have === undefined || have === null) { ok = false; break; }
    if (m[2] !== undefined && have !== m[2]) { ok = false; break; }
  }
  if (!ok) return false;
  const head = part.split('[')[0];
  for (const cls of head.split('.').slice(1)) {
    if (!el.className.split(/\s+/).includes(cls)) return false;
  }
  const tag = head.split('.')[0];
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  return true;
}
/** Descendant selectors only, which is all this page writes. */
function matches(el, sel) {
  const parts = sel.trim().split(/\s+(?![^[]*\])/);
  if (!matchOne(el, parts[parts.length - 1])) return false;
  for (let i = parts.length - 2; i >= 0; i--) {
    let n = el.parent, found = false;
    while (n) { if (matchOne(n, parts[i])) { found = true; break; } n = n.parent; }
    if (!found) return false;
  }
  return true;
}

class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = []; this.parent = null;
    this._text = ''; this._html = null; this.className = '';
    this.attrs = {}; this.listeners = {}; this.value = ''; this.id = '';
    this.disabled = false; this.hidden = false;
  }
  get textContent() {
    if (this._html !== null) return this._html.replace(/<[^>]*>/g, '');
    return this.children.length ? this.children.map(c => c.textContent).join('') : this._text;
  }
  set textContent(v) { this._text = String(v); this._html = null; this.children = []; }
  // The page writes rich markup here. Keeping it as text is the honest shim: the
  // string is asserted directly, and behaviour is driven through the handlers.
  set innerHTML(h) { this._html = String(h); this.children = []; }
  get innerHTML() { return this._html === null ? this.textContent : this._html; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  fire(ev, target) { (this.listeners[ev] || []).forEach(fn => fn({ currentTarget: this, target: target || this, key: 'x', preventDefault() {} })); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  get classList() {
    const self = this;
    const has = c => self.className.split(/\s+/).includes(c);
    return {
      contains: has,
      add: c => { if (!has(c)) self.className = (self.className + ' ' + c).trim(); },
      remove: c => { self.className = self.className.split(/\s+/).filter(x => x !== c).join(' '); },
      toggle: c => { if (has(c)) { self.className = self.className.split(/\s+/).filter(x => x !== c).join(' '); return false; } self.className = (self.className + ' ' + c).trim(); return true; },
    };
  }
  all() { return this.children.flatMap(c => [c, ...c.all()]); }
  querySelectorAll(sel) { return this.all().filter(e => matches(e, sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { let n = this; while (n) { if (matches(n, sel)) return n; n = n.parent; } return null; }
  scrollIntoView() {}
}

const byId = {};
const body = new El('body');
function node(id, tag, attrs, parent) {
  const e = new El(tag || 'div');
  if (id) { e.id = id; byId[id] = e; }
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  (parent || body).appendChild(e);
  return e;
}
const doc = {
  body,
  getElementById: id => byId[id] || null,
  createElement: tag => new El(tag),
  querySelector: sel => body.querySelector(sel),
  querySelectorAll: sel => body.querySelectorAll(sel),
  addEventListener: () => {},
};

/* --- the page's own markup, reduced to the hooks its script reaches for ------ */
const PAGE = path.join(__dirname, '..', 'docs', 'tick-argument.html');
const html = fs.readFileSync(PAGE, 'utf8');

const embed = /<script type="application\/json" id="slate-data">([\s\S]*?)<\/script>/.exec(html);
const slateData = node('slate-data', 'script');
slateData.textContent = embed ? embed[1] : '{"entries":[]}';

const forge = node('b-forge', 'div');
const fIn = {};
for (const [k, tag] of [['data-i', 'input'], ['data-j', 'input'], ['data-d', 'input'],
  ['data-iv', 'span'], ['data-jv', 'span'], ['data-dv', 'span'], ['data-work', 'p'],
  ['data-allv', 'span'], ['data-roll', 'button'], ['data-all', 'button'], ['data-pin', 'button']]) {
  fIn[k] = node(null, tag, { [k]: '' }, forge);
}
fIn['data-i'].value = '0'; fIn['data-j'].value = '3'; fIn['data-d'].value = '40';

const land = node('b-landauer', 'div');
const lIn = {};
for (const [k, tag] of [['data-bits', 'input'], ['data-t', 'input'], ['data-bitsv', 'span'],
  ['data-tv', 'span'], ['data-work', 'p'], ['data-pin', 'button']]) {
  lIn[k] = node(null, tag, { [k]: '' }, land);
}
lIn['data-bits'].value = '512'; lIn['data-t'].value = '300';

const navStrip = node(null, 'nav', {}, body);
navStrip.className = 'jump';
const navLinks = {};
for (const id of ['b-forge', 'b-landauer', 'slate']) {
  navLinks[id] = node(null, 'a', { href: '#' + id }, navStrip);
}
navLinks['x-dead'] = node(null, 'a', { href: '#no-such-section' }, navStrip);

const slate = node('slate', 'div');
const rowRoute = node(null, 'div', { 'data-group': 'route' }, slate);
const rowKind = node(null, 'div', { 'data-group': 'kind' }, slate);
const rowFlag = node(null, 'div', { 'data-group': 'flag' }, slate);
const qEl = node(null, 'input', { 'data-q': '' }, slate);
const clearBtn = node(null, 'button', { 'data-slate-clear': '' }, slate);
const countEl = node(null, 'p', { 'data-count': '' }, slate);
const listEl = node(null, 'div', { 'data-list': '' }, slate);

// The notes panel, so `pin` has somewhere to land rather than silently declining.
node('x-notes', 'aside', { 'data-notes': '' });
const notesList = node(null, 'ol', { 'data-notes-list': '' }, byId['x-notes']);
const notesCount = node(null, 'span', { 'data-notes-count': '' }, byId['x-notes']);
node(null, 'button', { 'data-notes-open': '' }, byId['x-notes']);

const store = {};
const sandbox = {
  document: doc, console,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
  performance: { now: () => 0 },
  // The sweep defers so the button can repaint first. Running it inline is what lets
  // this suite see the result at all, and it changes nothing about what is computed.
  setTimeout: fn => fn(),
  Date, Math, JSON,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
const script = /<script>([\s\S]*?)<\/script>/.exec(html);
vm.runInContext(script[1], sandbox, { timeout: 60000 });

console.log('\n=== 0. THE SHIM IS NOT LYING ABOUT WHAT IT FOUND ===');
check('the page script ran against the shim with no exception', true);
check('the embedded slate index was found and is non-trivial',
  embed !== null && embed[1].length > 50000, `${embed ? embed[1].length : 0} bytes`);
check('the shim resolves attribute selectors, or every check below is vacuous',
  slate.querySelectorAll('[data-group="route"]').length === 1
  && slate.querySelector('[data-list]') === listEl);

console.log('\n=== 1. BENCH 08 RENDERS AND IS WIRED TO THE MATHS ===');
const A = require('../tools/ledger-audit.js');
const work8 = () => fIn['data-work'].innerHTML;
check('the bench drew itself on load rather than waiting for a click',
  work8().includes('true ledger') && work8().includes('forged'));
check('   and it prints the same two heads the audit computes',
  work8().includes(String(A.headSum(A.LEDGER))) && work8().includes(String(A.headHash(A.LEDGER))),
  work8().slice(0, 200));
check('   and the default forgery leaves the summed head UNCHANGED', work8().includes('UNCHANGED'));
check('   and the labels track the sliders', fIn['data-iv'].textContent === 'entry 0'
  && fIn['data-jv'].textContent === 'entry 3' && fIn['data-dv'].textContent === '40');

fIn['data-d'].value = '0';
fIn['data-d'].fire('input');
check('a zero delta says so instead of pretending an edit happened',
  work8().includes('nothing was actually edited'));
fIn['data-d'].value = '117';
fIn['data-d'].fire('input');
check('   and moving the delta redraws with the new one', fIn['data-dv'].textContent === '117');
check('   and the summed head is still UNCHANGED, which is the whole point',
  work8().includes('UNCHANGED'));

fIn['data-all'].fire('click');
const swept = fIn['data-allv'].innerHTML;
check('the full sweep runs in the page and reproduces the audit exactly',
  swept.includes('10,920 of 10,920') && swept.includes('hashed accepts 13'), swept);
check('   and quotes the chance rate rather than leaving 13 unanchored',
  swept.includes('15.0'));
// The page counted each forgery twice until set AS caught it, and so did this check.
// The doubled figures must not come back through either.
check('   and neither the doubled count nor the doubled accepts survives in the page',
  !swept.includes('21,840') && !swept.includes('accepts 26'), swept);

fIn['data-pin'].fire('click');
check('pinning reaches the notes panel', notesCount.textContent === '1');
check('   and the pinned line names the bench and the verdict',
  (store['tick-argument-notes-v1'] || '').includes('bench 08')
  && (store['tick-argument-notes-v1'] || '').includes('UNCHANGED'));

console.log('\n=== 2. BENCH 09 RENDERS AND MOVES WITH ITS SLIDERS ===');
const work9 = () => lIn['data-work'].innerHTML;
check('the bench drew itself, with the floor and the hardware side by side',
  work9().includes('kT ln 2') && work9().includes('above the floor'));
const at512 = work9();
check('   and 512 bits at 300 K gives 2.940e-18 J an attempt', at512.includes('2.940e-18'),
  at512.slice(0, 400));
check('   and reports the headroom, not just the floor', at512.includes('6.'));
lIn['data-bits'].value = '256';
lIn['data-bits'].fire('input');
check('halving the bits halves the floor', work9().includes('1.470e-18'));
check('   and the label follows', lIn['data-bitsv'].textContent === '256 bits');
lIn['data-t'].value = '1';
lIn['data-t'].fire('input');
check('a colder machine has a lower floor, so temperature is really in the sum',
  !work9().includes('1.470e-18') && lIn['data-tv'].textContent === '1 K');

console.log('\n=== 3. THE SLATE IS AN INDEX, NOT A DISPLAY ===');
const R = require('../tools/render-slate.js');
const { slate: built } = R.build();
const total = built.counts.entries;
const routes = Object.keys(built.routes);

check(`one chip per route, ${routes.length} of them, built from the data not typed`,
  rowRoute.children.length === routes.length);
check('   and four kind chips and three status chips',
  rowKind.children.length === 4 && rowFlag.children.length === 3);
check(`the list opens on all ${total} entries`,
  countEl.innerHTML.includes(`<b>${total}</b> of ${total} entries`), countEl.innerHTML);
check('   and pages rather than dumping every entry into the DOM',
  (listEl.innerHTML.match(/class="entry"/g) || []).length === 60);
check('   and offers the rest behind a control', listEl.innerHTML.includes('data-more'));

const ledgerChip = rowRoute.children.find(c => c.textContent === 'ledger');
ledgerChip.fire('click');
const nLedger = built.routes.ledger.length;
check(`clicking "ledger" narrows to its ${nLedger} entries`,
  countEl.innerHTML.includes(`<b>${nLedger}</b> of ${total}`), countEl.innerHTML);
check('   and the chip reads as pressed', ledgerChip.getAttribute('aria-pressed') === 'true');
check('   and every rendered entry really carries that route',
  (listEl.innerHTML.match(/class="entry"/g) || []).length === nLedger
  && listEl.innerHTML.includes('F-FINDABILITY-NOT-COUNT'));
ledgerChip.fire('click');
check('   and clicking it again clears it', countEl.innerHTML.includes(`<b>${total}</b> of ${total}`));

const failedChip = rowFlag.children.find(c => c.textContent === 'failed');
failedChip.fire('click');
check(`the "failed" filter finds exactly the ${built.counts.failed} failures`,
  countEl.innerHTML.includes(`<b>${built.counts.failed}</b> of ${total}`), countEl.innerHTML);
failedChip.fire('click');
const provenChip = rowFlag.children.find(c => c.textContent === 'proven');
provenChip.fire('click');
check(`   and "proven" finds the ${built.counts.proven} argued at every width`,
  countEl.innerHTML.includes(`<b>${built.counts.proven}</b> of ${total}`));
provenChip.fire('click');
const derivedChip = rowFlag.children.find(c => c.textContent === 'derived');
derivedChip.fire('click');
const nDerived = built.entries.filter(e => e.routes_derived).length;
check(`   and "derived" surfaces the ${nDerived} routes no set assigned`,
  countEl.innerHTML.includes(`<b>${nDerived}</b> of ${total}`), countEl.innerHTML);
derivedChip.fire('click');

qEl.value = 'Landauer';
qEl.fire('input');
const nHits = built.entries.filter(e =>
  (e.id + ' ' + e.claim + ' ' + [e.argument, e.note].filter(Boolean).join(' ')).toLowerCase()
    .includes('landauer')).length;
check('search reaches the claim text, not only the ids',
  /<b>[1-9]\d*<\/b> of /.test(countEl.innerHTML) && nHits > 0, countEl.innerHTML);
qEl.value = 'zzzz-no-such-thing';
qEl.fire('input');
check('   and an empty result says so rather than rendering nothing at all',
  listEl.innerHTML.includes('Nothing matches that'));
clearBtn.fire('click');
check('   and "clear every filter" restores the whole index',
  countEl.innerHTML.includes(`<b>${total}</b> of ${total}`) && qEl.value === '');

// Cross-links are the part that makes this an index rather than a list. Following
// one is a delegated click, so it is driven through the handler with the target the
// browser would hand it.
const synth = attr => ({ closest: sel => (sel === `[${attr}]` ? { getAttribute: () => 'AK4' } : null) });
rowKind.children.find(c => c.textContent === 'note').fire('click');   // a filter stuck on
listEl.fire('click', synth('data-goto'));
// AK4 is a prediction, so with the "note" chip still pressed this used to land on
// "Nothing matches that" -- a link that walks back to nothing is worse than no link.
check('following a cross-link searches for the entry it names, filters and all,',
  qEl.value === 'AK4' && listEl.innerHTML.includes('AK4')
  && countEl.innerHTML.includes('<b>1</b> of '), countEl.innerHTML);
check('   and the search box echoes what was typed, not the lowercased key',
  countEl.innerHTML.includes('AK4'), countEl.innerHTML);
clearBtn.fire('click');

console.log('\n=== 4. THE JUMP STRIP POINTS AT THINGS THAT EXIST ===');

// A navigation strip is a set of hand-typed constants pointing at other hand-typed
// constants, which is the shape this repository keeps catching going stale. So its
// links are read back out of the page and resolved against it rather than trusted.
const strip = /<nav class="jump"[\s\S]*?<\/nav>/.exec(html);
check('the strip is present', strip !== null);
const hrefs = strip ? [...strip[0].matchAll(/href="#([a-z0-9-]+)"/g)].map(x => x[1]) : [];
const ids = new Set([...html.matchAll(/\bid="([a-z0-9-]+)"/g)].map(m => m[1]));
const dead = hrefs.filter(h => !ids.has(h));
check(`   and all ${hrefs.length} of its links resolve to ids really in the page`,
  hrefs.length > 0 && dead.length === 0, dead.join(' '));
const benchIds = [...html.matchAll(/class="bench" id="([a-z0-9-]+)"/g)].map(m => m[1]);
const missing = benchIds.filter(b => hrefs.indexOf(b) < 0);
check(`   and none of the ${benchIds.length} benches is missing from it`,
  missing.length === 0, missing.join(' '));
check('   and the slate is on it too, since it is the reason the strip exists',
  hrefs.indexOf('slate') >= 0);
// The numbering in the strip is prose ABOUT the benches, so it is checked against
// the benches' own labels rather than against itself.
const labelled = [...html.matchAll(/class="bench" id="([a-z0-9-]+)"[\s\S]{0,220}?bench (\d\d)</g)];
const wrong = labelled.filter(m => !new RegExp(`href="#${m[1]}">${m[2]} `).test(html));
check(`   and all ${labelled.length} bench numbers on it match the benches they name`,
  labelled.length === benchIds.length && wrong.length === 0,
  wrong.map(m => m[1] + '/' + m[2]).join(' '));

// The strip resolves its own targets rather than trusting fragment navigation, so
// what is checked is that it really does the resolving.
let scrolled = null, prevented = 0;
for (const el of Object.values(navLinks)) el.scrollIntoView = () => { scrolled = el; };
for (const id of ['b-forge', 'b-landauer', 'slate']) {
  byId[id].scrollIntoView = () => { scrolled = id; };
}
const linkEvent = (a) => ({ target: a, currentTarget: navStrip, preventDefault() { prevented++; } });
navStrip.listeners.click.forEach(fn => fn(linkEvent(navLinks['slate'])));
check('the strip resolves its own target instead of trusting fragment navigation',
  scrolled === 'slate' && prevented === 1, `${scrolled} ${prevented}`);
scrolled = null;
navStrip.listeners.click.forEach(fn => fn(linkEvent(navLinks['x-dead'])));
check('   and a link to nothing is left alone rather than silently swallowed',
  scrolled === null && prevented === 1, `${scrolled} ${prevented}`);

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
