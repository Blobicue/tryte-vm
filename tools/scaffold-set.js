'use strict';
/* SCAFFOLD-SET — emit the paperwork a new prediction set needs, so the only thing
 * left to write is the thinking.
 *
 * The pre-registration protocol has a fixed shape and the shape is the point: a
 * `PREDICTED OUTCOMES` block in the tool, a manifest entry whose `results_at` reads
 * `PENDING` until the run happens, and a test that opens with an instrument section
 * and a subprocess check. None of that is where the judgement lives, and all of it
 * has been retyped forty times.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not invent predictions, and it does not
 * touch `FINDINGS.json`. A registration commit must contain no measurement, and a
 * manifest entry written before the tool exists would be a claim about a run that has
 * not happened. The manifest entry is PRINTED for you to paste once the tool is real.
 *
 * THE TWO ANTIBODIES IT CARRIES FORWARD, because both were learned the hard way:
 *
 *   T-TOOL-CHECKED-ONLY-BY-IMPORT   importing a tool sets MAIN false, so every log
 *       line is skipped and a fault in the report path stays invisible. `log` once
 *       rewrote its own body into infinite recursion and all 46 suites stayed green.
 *       Every scaffolded test therefore spawns the tool as a subprocess.
 *
 *   T-INSTRUMENT-FALSE-VERDICT      sixteen bites and counting. Every scaffolded test
 *       opens with an instrument section, because a verdict from an unchecked
 *       instrument is a fact about the instrument.
 *
 *     node tools/scaffold-set.js AO "does X cost anything?"          # print
 *     node tools/scaffold-set.js AO "does X cost anything?" --write  # create files
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };

/** The next unused set id, in this project's scheme: A..T, then AA, AB, ... */
function nextId(used) {
  const seq = [];
  for (let c = 65; c <= 90; c++) seq.push(String.fromCharCode(c));
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    seq.push(String.fromCharCode(a) + String.fromCharCode(b));
  }
  const taken = new Set(used);
  const free = seq.find(s => !taken.has(s));
  if (!free) throw new Error('scaffold-set: ran out of set ids');
  return free;
}

function toolSource(id, subject, slug) {
  return `'use strict';
/* ${slug.toUpperCase()} AUDIT — ${subject}
 *
 * Set \`${id}\`. Say here what question this asks that no earlier set answers, and why
 * the existing corpus does not already settle it. That paragraph is what stops a set
 * from re-measuring something the project already knows.
 *
 * ------------------------------------------------------------------------------
 * THE CONSTRUCTION, WHICH IS DESIGN AND NOT PREDICTION.
 *
 * Everything fixed before the run and not at risk goes here, so that what IS at risk
 * is unambiguous. Widths, corpora, seeds, and any null model — a null model is
 * arithmetic and may be computed before the registration, but say that it was.
 *
 * ------------------------------------------------------------------------------
 * PREDICTED OUTCOMES — registered BEFORE the run, in their own commit, per AGENTS.md.
 *
 * EVERY PREDICTION CARRIES AN \`AT RISK\` LINE AND THE SUITE FAILS WITHOUT ONE. A
 * read-only audit of the first 181 predictions scored 25 of them decorative —
 * computable from the registration's own text before the run — and every one of the 25
 * HELD, because a fact that was never at risk cannot fail. The one set that had written
 * these lines is the one set that scored zero decorative. The test is: could the run
 * have come out the other way, over quantities somebody else fixed?
 *
 *   ${id}1 STATE THE CLAIM IN CAPITALS, THEN THE NUMBER. Predicted <quantity> lands
 *       <where>, measured <how>. Register the alternative too: say what result would
 *       refute this rather than merely disappoint it.
 *       AT RISK: it comes out the other way if <the thing that would refute it>, and
 *       here is what I have on paper pointing each way.
 *
 *   ${id}2 ONE CLAIM PER PREDICTION. A compound prediction with one failing leg is a
 *       failed prediction, and the manifest note then has to explain which leg —
 *       so split them here instead if they can genuinely differ.
 *       AT RISK: <how>. If the answer and the arithmetic that produces it both sit in
 *       this block, over quantities this set stipulated, it is decoration — move it to
 *       the NOT REGISTERED section rather than counting it as a prediction.
 *
 *   ${id}3 PREDICT SOMETHING THAT COULD EMBARRASS YOU. The useful results in this
 *       corpus came from predictions that were wrong. A set of four safe claims
 *       produces four held predictions and no knowledge.
 *       AT RISK: <how>, and say which way your own hand evidence points. Registering
 *       against your own sample is the choice that can embarrass you.
 *
 *   ${id}4 AND SAY WHAT THE MEASUREMENT CANNOT SHOW. Scope belongs in the
 *       registration, not in the write-up — T-SCOPE-DECIDES-THE-VERDICT has bitten
 *       four times, every time by a correct computation scored against the wrong
 *       question.
 *       AT RISK: <how>.
 * ------------------------------------------------------------------------------
 * Run:  npm run audit:${slug}
 */

const MAIN = require.main === module;
const log = (...a) => { if (MAIN) console.log(...a); };
const line = '='.repeat(78);

// ---------------------------------------------------------------- the measurement

function report() {
  log('${slug.toUpperCase()} AUDIT — ${subject}');
  log(line);

  log('\\n--- 0. THE INSTRUMENT, BEFORE ANY VERDICT ---');
  // Check the tool against something whose answer is already known. AD2 memoised only
  // terminating values and reported the attacker as 300x WORSE -- in the flattering
  // direction, which is the direction nothing catches by being surprised.

  log('\\n--- ${id}1 ---');
  log('\\n' + line);
}

if (MAIN) report();

module.exports = { report };
`;
}

function testSource(id, subject, slug) {
  return `'use strict';
/* test-${slug}.js — ${subject}
 *
 * Set \`${id}\`. Say which check here is the one worth keeping, and why — usually the
 * prediction that failed, because that is where this corpus has learned most.
 *
 * The exhaustive version is \`npm run audit:${slug}\`.
 */

const A = require('../tools/${slug}-audit.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(\`  [PASS] \${name}\`); }
  else { fails.push(name); console.log(\`  [FAIL] \${name}  \${detail}\`); }
};

console.log('\\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  // 0a. The construction is the one the registration described. A set whose subject
  // is not the subject it cites is measuring something nobody registered.

  // 0b. THE TOOL AS IT IS ACTUALLY RUN. T-TOOL-CHECKED-ONLY-BY-IMPORT: importing a
  // tool sets MAIN false, so every log line is skipped and a fault in the report path
  // stays invisible to a suite that only imports. Run the real thing.
  const out = execFileSync(process.execPath,
    [path.join(__dirname, '..', 'tools', '${slug}-audit.js')],
    { encoding: 'utf8', timeout: 300000 });
  check('the audit runs as a program and prints its own report',
    out.includes('${slug.toUpperCase()} AUDIT') && out.includes('${id}1'));

  // 0c. Check the pipeline against a case whose answer is known independently.
}

console.log('\\n=== 1. ${id}1 ===');
{
  check('${id}1 ...', false, 'not yet measured');
}

console.log(\`\\n\${'='.repeat(64)}\`);
console.log(fails.length ? \`\${fails.length} CHECK(S) FAILED:\\n  \${fails.join('\\n  ')}\` : \`ALL \${pass} CHECKS PASSED\`);
process.exit(fails.length ? 1 : 0);
`;
}

function manifestEntry(id, subject, slug) {
  return JSON.stringify({
    id,
    subject,
    tool: `tools/${slug}-audit.js`,
    registered_at: '<registration commit sha>',
    results_at: 'PENDING',
    asserted_in: `test/test-${slug}.js`,
    predictions: [1, 2, 3, 4].map(n => ({
      id: `${id}${n}`,
      claim: '<the claim, in the words it was registered in>',
      outcome: 'HELD',
      basis: 'measured',
      // Three legal values, declared in the manifest's own `at_risk_values`. The
      // default is 'AT RISK'; carry the registered route across after a colon. A
      // prediction with no annotation fails test/test-findings.js, and so does a set
      // whose registration block states no risk for one of its predictions.
      // The placeholder below is DELIBERATELY not a legal value, for the same reason
      // the scaffolded test fails until you measure: a placeholder that passes is a
      // set reporting success for work nobody did.
      at_risk: '<AT RISK: the registered route by which this could have come out the '
        + 'other way>',
      measured: {},
      note: '<what the number means, and what it does not>',
    })),
  }, null, 2);
}

function scaffold(id, subject, slug) {
  return {
    id, subject, slug,
    files: [
      { path: `tools/${slug}-audit.js`, body: toolSource(id, subject, slug) },
      { path: `test/test-${slug}.js`, body: testSource(id, subject, slug) },
    ],
    manifest: manifestEntry(id, subject, slug),
    script: [`audit:${slug}`, `node tools/${slug}-audit.js`],
    suite: `test-${slug}.js`,
  };
}

if (MAIN) {
  const args = process.argv.slice(2).filter(a => a !== '--write');
  const write = process.argv.includes('--write');
  const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'FINDINGS.json'), 'utf8'));
  const id = (args[0] || nextId(M.prediction_sets.map(s => s.id))).toUpperCase();
  const subject = args[1] || '<one line: the question this set asks>';
  const slug = (args[2] || id.toLowerCase());

  if (M.prediction_sets.some(s => s.id === id)) {
    console.error(`scaffold-set: set ${id} already exists in the manifest.`);
    process.exit(1);
  }
  const s = scaffold(id, subject, slug);
  log(`SCAFFOLD-SET — set ${id}, "${subject}"\n`);
  for (const f of s.files) {
    const p = path.join(ROOT, f.path);
    if (fs.existsSync(p)) { log(`  EXISTS, not touched   ${f.path}`); continue; }
    if (write) { fs.writeFileSync(p, f.body); log(`  wrote                 ${f.path}`); }
    else log(`  would write           ${f.path}   (${f.body.split('\n').length} lines)`);
  }
  log(`\n  then, by hand:`);
  log(`    package.json      "${s.script[0]}": "${s.script[1]}"`);
  log(`    test/run-all.js   add '${s.suite}' to SUITES`);
  log(`\n  and AFTER the run, paste into FINDINGS.json prediction_sets:\n`);
  log(s.manifest.split('\n').map(l => '    ' + l).join('\n'));
  log(`\n  The manifest entry is printed rather than written because a registration`);
  log(`  commit must contain no measurement, and results_at stays PENDING until the`);
  log(`  results commit exists to point at.`);
  if (!write) log(`\n  Nothing was written. Pass --write to create the two files.`);
}

module.exports = { nextId, scaffold, toolSource, testSource, manifestEntry };
