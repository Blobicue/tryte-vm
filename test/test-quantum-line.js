'use strict';
/* test-quantum-line.js — runs the fenced quantum line's suites, and tests whether its
 * batteries can find anything at all.
 *
 * The quantum, cryptography and toolchain line (FENCE.md) brought sixteen suites of its
 * own. None reports in this repository's format, so run-all could not count them, and
 * none had ever been run here. This harness is the boundary between the two regimes:
 *
 *   1. It runs the seven that pass with Node alone, reading each one's OWN summary --
 *      five different shapes -- and checking it for internal consistency where it gives
 *      enough to check.
 *   2. The three batteries that report no count at all ("ZERO DEFECTS FOUND") get a
 *      seeded bug each, planted by test/quantum-seed.js. A battery that reports zero
 *      defects is only evidence if it can report one; these checks show which of its
 *      checks can.
 *   3. Three of the batteries' checks CANNOT fire, and that is asserted rather than
 *      dropped: a seed aimed squarely at each one reaches the code and the battery still
 *      reports zero. If anyone repairs one of them, its check here goes red on purpose --
 *      move it to the FIRES table and say so in the commit.
 *   4. The other nine are listed in UNRUN with the reason each cannot pass here, and every
 *      fenced suite must be in exactly one list.
 *
 * ACCOUNTING. Only this harness's own checks count toward the README's total. The fenced
 * suites' self-reported counts are printed and NOT added: the headline number is checks
 * this repository stands behind, and FENCE.md says it does not stand behind these.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SEED = path.join(__dirname, 'quantum-seed.js');

let pass = 0; const fails = [];
let quiet = false;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; if (!quiet) console.log(`  [PASS] ${name}`); }
  else { fails.push(name); if (!quiet) console.log(`  [FAIL] ${name}  ${detail}`); }
};

/** Run a fenced suite, optionally with a seed planted. Never throws. */
function run(suite, seed) {
  const args = seed ? ['-r', SEED, path.join('test', suite)] : [path.join('test', suite)];
  const env = { ...process.env };
  if (seed) env.TVM_SEED = seed; else delete env.TVM_SEED;
  const r = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const h = /^\[seed\] \S+ intercepted (\d+) calls$/m.exec(out);
  return { code: r.status, out, hits: h ? Number(h[1]) : null };
}

/* Each suite's own summary shape. `count` is what it claims; `ok` is whether the claim
 * is a clean pass; `ticks` says whether its count should equal its printed ✓ lines. */
const SHAPES = {
  completed: { re: /Tests Completed: (\d+) passed, (\d+) failed\./, ok: m => m[2] === '0', count: m => +m[1], ticks: true },
  allN:      { re: /ALL (\d+) [A-Z -]*CHECKS PASSED!/,             ok: () => true,          count: m => +m[1], ticks: true },
  gaps:      { re: /ASSAULT COMPLETE: (\d+) GAPS/,                  ok: m => m[1] === '0',   count: () => null, ticks: false },
  json:      { re: /^AUDIT_SUMMARY_JSON:(.*)$/m,                    ok: m => fuzzClean(m[1]), count: () => null, ticks: false },
};

/** adversarial_fuzz.js's summary is JSON; clean means every failure tally is zero. */
function fuzzClean(text) {
  let j; try { j = JSON.parse(text); } catch (e) { return false; }
  return j.boundaryChecks.failed === 0 && j.bigIntFuzz.failed === 0 && j.tasmExecutionFuzz.failed === 0
    && j.cascadeAttacks.failed === 0 && j.exhaustiveTASMCarry.errors === 0
    && j.labelCollision.detected === false && j.dagCompilerBugs.length === 0;
}

const RUN = {
  'adversarial_fuzz.js': 'json',
  'test-arsenal.js': 'completed',
  'test-lattice-crypto.js': 'allN',
  'test-microkernel.js': 'completed',
  'test-secure-channel.js': 'allN',
  'wave2_adversarial_assault.js': 'gaps',
  'wave3_chaos_adversarial_battery.js': 'gaps',
};

const UNRUN = {
  'test-certifier.js': 'every check shells out to `lean` (Lean 4), which no environment here has',
  'test-crypto-arsenal.js': 'one check shells out to `lean`',
  'test-dag-compiler.js': 'one check imports Python numpy through research/export_to_tasm.py',
  'test-hybrid-co-processor.js': 'one check shells out to `lean`',
  'test-jit.js': 'one check imports Python numpy through research/arsenal/arsenal_manager.py',
  'test-native-simd.js': 'compares against a Rust binary built by `cargo build --release` in native/; without it every native output is empty',
  'test-topc-multiprecision.js': 'one check shells out to `lean`',
  'test-tril-compiler.js': 'one check needs the native Rust binary -- and its summary then claims that all of 30 out of 31 checks passed, while it exits 1',
  'test-tril-stdlib.js': 'spawns cargo at a path hardcoded into another writer\'s home directory, so it cannot pass on any other machine',
};

/* Seeds each battery must catch: [battery, seed, what its report must name]. */
const FIRES = [
  ['wave2_adversarial_assault.js', 'mp-add-off-by-one', /Asymmetric addWide exactValue mismatch/],
  ['wave2_adversarial_assault.js', 'hash-constant', /Hash bucket -?1 had zero hits/],
  ['wave2_adversarial_assault.js', 'kernel-boot-silent', /Microkernel boot did not report status/],
  ['wave2_adversarial_assault.js', 'vm-host-fault', /TOP failed across boundary wrap/],
  ['wave3_chaos_adversarial_battery.js', 'mp-add-off-by-one', /Asymmetric addWide exactValue failure/],
  ['wave3_chaos_adversarial_battery.js', 'sbox-constant', /High differential uniformity in S-box/],
  ['wave3_chaos_adversarial_battery.js', 'vm-host-fault', /Unexpected VM crash on random bytecode/],
  ['adversarial_fuzz.js', 'mp-low-word-off-by-one', /Cascade & Cancellation Attacks: 0 passed, \d+ failed/],
];

/* Seeds aimed at a check that cannot fire: [battery, seed, why, evidence the seed bit]. */
const SILENT = [
  ['wave2_adversarial_assault.js', 'sbox-identity',
    'the fixed-point check counts points where out === x AND out === y, which needs x === y: at most two non-zero points exist, and it alarms only above two',
    /0 GAPS/],
  ['wave3_chaos_adversarial_battery.js', 'vm-never-halts',
    'the scheduling stress counts halted runs and prints the count, but never records a finding -- it runs one unchanging program a thousand times besides',
    /\b0 \/ 1,000 runs cleanly halted/],
  ['wave3_chaos_adversarial_battery.js', 'mp-low-word-off-by-one',
    'the arithmetic fuzz compares only exactValue, so a wrong sum word passes every trial',
    /10000 \/ 10,000 passed/],
];

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
{
  check('the harness reports a false check as FAIL', (() => {
    const before = [fails.length, pass];
    quiet = true; check('deliberately false', false); quiet = false;
    const caught = fails.length === before[0] + 1 && pass === before[1];
    fails.pop(); return caught;
  })());
  // Every shape must read a pass AND refuse a failure, or it cannot tell them apart.
  const sample = {
    completed: ['Arsenal Tests Completed: 12 passed, 0 failed.', 'X Tests Completed: 3 passed, 1 failed.'],
    allN: ['ALL 25 POST-QUANTUM LATTICE CRYPTO CHECKS PASSED!', 'nothing here'],
    gaps: ['WAVE 2 ASSAULT COMPLETE: 0 GAPS / VULNERABILITIES IDENTIFIED', 'WAVE 2 ASSAULT COMPLETE: 3 GAPS / V'],
    json: [
      'AUDIT_SUMMARY_JSON:' + JSON.stringify({ boundaryChecks: { failed: 0 }, bigIntFuzz: { failed: 0 }, tasmExecutionFuzz: { failed: 0 }, cascadeAttacks: { failed: 0 }, exhaustiveTASMCarry: { errors: 0 }, labelCollision: { detected: false }, dagCompilerBugs: [] }),
      'AUDIT_SUMMARY_JSON:' + JSON.stringify({ boundaryChecks: { failed: 0 }, bigIntFuzz: { failed: 0 }, tasmExecutionFuzz: { failed: 0 }, cascadeAttacks: { failed: 6 }, exhaustiveTASMCarry: { errors: 0 }, labelCollision: { detected: false }, dagCompilerBugs: [] }),
    ],
  };
  for (const [name, S] of Object.entries(SHAPES)) {
    const good = S.re.exec(sample[name][0]); const bad = S.re.exec(sample[name][1]);
    check(`the '${name}' reader accepts a pass and refuses a failure`,
      !!good && S.ok(good) && !(bad && S.ok(bad)));
  }
  check('every suite this harness runs has a reader', Object.values(RUN).every(s => SHAPES[s]));
  // The seed must be inert without TVM_SEED, and must refuse a name it does not know --
  // a typo that silently planted nothing would read as a battery that caught nothing.
  const inert = run('wave2_adversarial_assault.js', null);
  check('the seed module is absent from an unseeded run', inert.hits === null);
  const typo = spawnSync(process.execPath, ['-r', SEED, '-e', ''],
    { cwd: ROOT, env: { ...process.env, TVM_SEED: 'no-such-seed' }, encoding: 'utf8' });
  check('   and an unknown seed name is refused, not ignored', typo.status === 97);
  const known = require('./quantum-seed.js').SEEDS;
  const used = [...FIRES, ...SILENT].map(r => r[1]);
  check('   and every seed this harness plants exists', used.every(s => known.includes(s)),
    used.filter(s => !known.includes(s)).join(' '));
}

console.log('\n=== 1. THE SEVEN THAT RUN WITH NODE ALONE ===');
const reported = [];
for (const [suite, shape] of Object.entries(RUN)) {
  const S = SHAPES[shape]; const r = run(suite, null); const m = S.re.exec(r.out);
  check(`${suite} exits cleanly and its own summary reports a pass`,
    r.code === 0 && !!m && S.ok(m), `exit=${r.code} summary=${m ? m[0].slice(0, 60) : 'none'}`);
  if (m && S.count(m) !== null) {
    const ticks = (r.out.match(/✓/g) || []).length;
    if (S.ticks) check(`   its claimed ${S.count(m)} equals the ${ticks} checks it printed`, ticks === S.count(m));
    reported.push(`${suite}: ${S.count(m)}`);
  } else reported.push(`${suite}: no count`);
}
console.log(`  (self-reported, NOT added to this suite's total: ${reported.join('; ')})`);

console.log('\n=== 2. THE BATTERIES CATCH A PLANTED BUG ===');
for (const [battery, seed, names] of FIRES) {
  const r = run(battery, seed);
  check(`${battery} catches '${seed}'`,
    r.hits > 0 && r.code !== 0 && names.test(r.out), `hits=${r.hits} exit=${r.code}`);
}

console.log('\n=== 3. AND THREE OF THEIR CHECKS CANNOT ===');
for (const [battery, seed, why, bit] of SILENT) {
  const r = run(battery, seed);
  // The seed must have reached the code AND left its mark, and the battery must still
  // have reported a clean run: that is a check unable to fire, not a seed that missed.
  check(`${battery} reports zero defects with '${seed}' planted -- ${why}`,
    r.hits > 0 && r.code === 0 && /ASSAULT COMPLETE: 0 GAPS/.test(r.out) && bit.test(r.out),
    `hits=${r.hits} exit=${r.code}`);
}

console.log('\n=== 4. EVERY FENCED SUITE IS RUN OR SAYS WHY NOT ===');
{
  const fenceMd = fs.readFileSync(path.join(ROOT, 'FENCE.md'), 'utf8');
  const quantum = fenceMd.split('### The phinary subsystem')[0];
  const fenced = [...quantum.matchAll(/^- `test\/([^`]+\.js)`\s*$/gm)].map(m => m[1]);
  check('FENCE.md fences the quantum line\'s suites', fenced.length > 0);
  const listed = [...Object.keys(RUN), ...Object.keys(UNRUN)];
  check('   each is either run here or listed as unrun',
    fenced.every(f => listed.includes(f)), fenced.filter(f => !listed.includes(f)).join(' '));
  check('   never both', Object.keys(RUN).every(f => !(f in UNRUN)));
  check('   and nothing is listed that the fence does not hold', listed.every(f => fenced.includes(f)),
    listed.filter(f => !fenced.includes(f)).join(' '));
  check('   and every unrun suite exists and has a stated reason',
    Object.entries(UNRUN).every(([f, why]) => fs.existsSync(path.join(__dirname, f)) && why.length > 20));
  for (const [f, why] of Object.entries(UNRUN)) console.log(`  (unrun) ${f} -- ${why}`);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
