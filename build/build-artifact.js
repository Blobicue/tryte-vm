'use strict';
/* build-artifact.js — inline the real emulator source into a single HTML page.
 *
 * The page must never contain a second, hand-written copy of the arithmetic.
 * This script takes src/*.js verbatim (via build/bundle.js), strips the CommonJS
 * wiring, concatenates the result into one scope, and injects it into the
 * template. After building it re-runs the demo programs through the BUNDLED code
 * and compares against the module code, so a divergence fails the build instead
 * of shipping.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildBundle, readPrograms, ROOT, read } = require('./bundle.js');

const bundle = buildBundle();
const programs = readPrograms();

/* --- anti-divergence gate ------------------------------------------------ */
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(bundle + '\nglobalThis.__api = { T, TryteVM, loadInto };', sandbox);
const B = sandbox.__api;

const { TryteVM } = require(path.join(ROOT, 'src/vm.js'));
const { loadInto } = require(path.join(ROOT, 'src/assembler.js'));

const cases = [
  ['threeway', [7, -3, 0, 42, -100]],
  ['multiply', [-7, 5]],
  ['multiply', [13, 19]],
  ['tgate',    [123, -45]],
];
for (const [name, input] of cases) {
  const a = new TryteVM({ input: input.slice() });
  loadInto(a, programs[name], 0); a.run();
  const b = new B.TryteVM({ input: input.slice() });
  B.loadInto(b, programs[name], 0); b.run();
  if (a.output.join() !== b.output.join()) {
    console.error(`DIVERGENCE in ${name}: modules gave [${a.output}], bundle gave [${b.output}]`);
    process.exit(1);
  }
}
console.log(`bundle matches modules on ${cases.length} program runs`);

/* --- emit ---------------------------------------------------------------- */
const html = read('build/template.html')
  .replace('/*__BUNDLE__*/', () => bundle)
  .replace('/*__PROGRAMS__*/', () => `const PROGRAMS = ${JSON.stringify(programs, null, 2)};`);

const out = path.join(ROOT, 'docs', 'tryte-vm.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(ROOT, out)}  (${(html.length / 1024).toFixed(1)} KB)`);
