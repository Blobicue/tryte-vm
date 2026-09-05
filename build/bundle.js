'use strict';
/* bundle.js — turn src/*.js into one browser-ready scope.
 *
 * Extracted from build-artifact.js so the test suite can call it too: a test
 * that checks the built page is worthless if the page is allowed to lag src/,
 * and that is exactly the false pass this file exists to prevent.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** The names a module publishes, read off its `module.exports = { ... }` literal. */
function exportedNames(source) {
  const m = source.match(/module\.exports\s*=\s*\{([\s\S]*?)\};/);
  if (!m) throw new Error('no module.exports found');
  return m[1].split(',').map(x => x.split(':')[0].trim()).filter(Boolean);
}

/** Strip 'use strict', require() lines, and module.exports from a module. */
function strip(source, exposeAs) {
  let s = source
    .replace(/^'use strict';\s*$/m, '')
    .replace(/^const .*= require\(.*\);\s*$/gm, '')
    .replace(/^const \{[^}]*\} = require\(.*\);\s*$/gm, '');

  const names = exportedNames(s);
  s = s.replace(/module\.exports\s*=\s*\{[\s\S]*?\};/, '');
  // Only the ternary module is consumed through a namespace object (T.*).
  return exposeAs ? `${s}\nconst ${exposeAs} = { ${names.join(', ')} };\n` : s;
}

function buildBundle() {
  return [
    '/* --- src/ternary.js --- */',   strip(read('src/ternary.js'), 'T'),
    '/* --- src/isa.js --- */',       strip(read('src/isa.js')),
    '/* --- src/vm.js --- */',        strip(read('src/vm.js')),
    '/* --- src/assembler.js --- */', strip(read('src/assembler.js')),
    '/* --- src/selfhost.js --- */',  strip(read('src/selfhost.js')),
  ].join('\n');
}

/* --- the namespaced form ---------------------------------------------------
 *
 * `buildBundle()` concatenates its five modules into ONE flat scope, and that
 * works only because those five happen not to collide. The switch-level files do:
 * `add`, `sub` and `mul` are declared at top level in BOTH `src/ternary.js` and
 * `src/wasm-emit.js` — three collisions, and flat concatenation is a SyntaxError.
 *
 * Renaming them in `src/` would fix these three and leave the class open, so each
 * module is wrapped in an IIFE that returns its own exports instead. A module's
 * top-level names are then private to it, and the only thing it publishes is the
 * namespace const the wrapper binds. That is also what makes the dependency work:
 * `src/solver-wasm.js` reads `W.*` and `NP.*`, its two require() lines are stripped
 * like any other, and the outer consts those names now refer to are already bound
 * by the time its own IIFE runs — so declaration order IS the dependency order.
 */

/** One module, wrapped so its top-level names cannot reach another module's. */
function namespaced(rel, ns) {
  const source = read(rel);
  return `/* --- ${rel} --- */\nconst ${ns} = (function () {${strip(source)}\n`
    + `return { ${exportedNames(source).join(', ')} };\n})();`;
}

/**
 * The five files the lab page runs on, in dependency order, and the namespace each
 * is read through. `device.js` is here and is absent from `buildBundle()`'s list,
 * which is the reason the bundler needed parameterising rather than extending.
 */
const LAB_MODULES = [
  ['src/ternary.js', 'T'],
  ['src/device.js', 'D'],
  ['src/netpack.js', 'NP'],
  ['src/wasm-emit.js', 'W'],
  ['src/solver-wasm.js', 'SW'],
];

const LAB_BEGIN = '/* --- lab bundle begins --- */';
const LAB_END = '/* --- lab bundle ends --- */';

/** R0, R1, R2 and the emitter, as one browser scope. */
function buildLabBundle(modules = LAB_MODULES) {
  return modules.map(([rel, ns]) => namespaced(rel, ns)).join('\n');
}

function readPrograms() {
  const programs = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'programs'))) {
    if (f.endsWith('.tasm')) programs[f.replace(/\.tasm$/, '')] = read(path.join('programs', f));
  }
  return programs;
}

/** The bundle as it is currently embedded in the built page. */
function bundleInPage() {
  const html = read('docs/tryte-vm.html');
  const script = html.split('<script>')[1].split('</script>')[0];
  const start = script.indexOf('/* --- src/ternary.js --- */');
  const end = script.indexOf('const PROGRAMS =');
  if (start < 0 || end < 0) throw new Error('cannot locate the bundle inside the built page');
  return script.slice(start, end).trimEnd();
}

/**
 * The lab bundle as it is currently embedded in the built lab page.
 *
 * Its own markers, and deliberately not `bundleInPage()`'s: that one is hardwired
 * to `docs/tryte-vm.html`, keys off a `const PROGRAMS =` line the lab page does not
 * have, and is pinned in detail by `test-page.js`. Two pages, two recoveries.
 */
function labBundleInPage(rel = 'docs/tryte-lab.html') {
  const html = read(rel);
  const start = html.indexOf(LAB_BEGIN);
  const end = html.indexOf(LAB_END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`cannot locate the lab bundle inside ${rel}`);
  }
  return html.slice(start + LAB_BEGIN.length, end).trim();
}

module.exports = {
  strip, exportedNames, buildBundle, readPrograms, bundleInPage, ROOT, read,
  namespaced, LAB_MODULES, LAB_BEGIN, LAB_END, buildLabBundle, labBundleInPage,
};
