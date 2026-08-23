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

/** Strip 'use strict', require() lines, and module.exports from a module. */
function strip(source, exposeAs) {
  let s = source
    .replace(/^'use strict';\s*$/m, '')
    .replace(/^const .*= require\(.*\);\s*$/gm, '')
    .replace(/^const \{[^}]*\} = require\(.*\);\s*$/gm, '');

  const m = s.match(/module\.exports\s*=\s*\{([\s\S]*?)\};/);
  if (!m) throw new Error('no module.exports found');
  const names = m[1].split(',').map(x => x.split(':')[0].trim()).filter(Boolean);
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
  ].join('\n');
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

module.exports = { strip, buildBundle, readPrograms, bundleInPage, ROOT, read };
