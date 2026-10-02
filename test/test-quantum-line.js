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

console.log('\n=== 5. F-QUTRIT-HYPERNET-NOTHING-TO-LEARN ===');
/* research/quantum_grokking's "true ternary quantum hypernetwork" trains a ternary-weight
 * network to emit six braid trits for a two-qutrit circuit, on (a+b) mod 3. Six trits is
 * 3^6 = 729 circuits, so instead of trusting a training run this enumerates all of them.
 *
 * The circuit is re-implemented here in exact double-precision complex arithmetic,
 * from ternary_qutrit_circuit.py: B4 generators sigma_i = A*I + A^-1*e_i in the
 * Temperley-Lieb representation with A = exp(2*pi*i/5), each qutrit evolved by
 * sigma_3^t3 * sigma_2^t2 * sigma_1^t1, the pair joined as |a> (x) |b>, then the
 * controlled shift CX3 = diag(I, X3, X3^2), then qutrit B read by the Born rule. A second
 * implementation that is never compared is an unchecked claim, so it is held against the
 * Python original whenever torch is present -- and reported SKIPPED, not passed, when not. */
{
  const PHI = (1 + Math.sqrt(5)) / 2;
  const c = (re, im = 0) => [re, im];
  const add = (x, y) => [x[0] + y[0], x[1] + y[1]];
  const mul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
  const conj = x => [x[0], -x[1]];
  const mm = (X, Y) => X.map((row, i) => Y[0].map((_, j) =>
    row.reduce((s, _, k) => add(s, mul(X[i][k], Y[k][j])), c(0))));
  const real = R => R.map(row => row.map(v => c(v)));
  const dagger = X => X[0].map((_, j) => X.map(row => conj(row[j])));
  const eye = n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => c(i === j ? 1 : 0)));
  const close = (X, Y) => X.every((row, i) => row.every((v, j) =>
    Math.abs(v[0] - Y[i][j][0]) < 1e-12 && Math.abs(v[1] - Y[i][j][1]) < 1e-12));
  const scale = (X, s) => X.map(row => row.map(v => mul(v, s)));
  const plus = (X, Y) => X.map((row, i) => row.map((v, j) => add(v, Y[i][j])));

  const iP = 1 / PHI, iP2 = iP * iP, iP32 = Math.pow(PHI, -1.5);
  const E = {
    1: real([[PHI, 0, 0], [0, 0, 0], [0, 0, 0]]),
    2: real([[iP, iP32, iP], [iP32, iP2, iP32], [iP, iP32, iP]]),
    3: real([[0, 0, 0], [0, 0, 0], [0, 0, PHI]]),
  };
  const A = c(Math.cos(2 * Math.PI / 5), Math.sin(2 * Math.PI / 5));
  const SIGMA = {};
  for (const g of [1, 2, 3]) {
    SIGMA[g] = plus(scale(eye(3), A), scale(E[g], conj(A)));
    SIGMA[-g] = dagger(SIGMA[g]);
  }
  SIGMA[0] = eye(3);

  // The instrument, checked against the algebra before any verdict: the Temperley-Lieb
  // relations with loop value phi, unitarity, and the loop value Fibonacci anyons need.
  check('the generators satisfy e_i^2 = phi*e_i and e_i e_j e_i = e_i, so this is the TL representation',
    [1, 2, 3].every(g => close(mm(E[g], E[g]), scale(E[g], c(PHI))))
    && close(mm(mm(E[1], E[2]), E[1]), E[1]) && close(mm(mm(E[2], E[1]), E[2]), E[2])
    && close(mm(mm(E[2], E[3]), E[2]), E[2]) && close(mm(mm(E[3], E[2]), E[3]), E[3]));
  check('   every braid generator is unitary',
    [1, 2, 3].every(g => close(mm(SIGMA[g], dagger(SIGMA[g])), eye(3))));
  const loop = add(mul(mul(A, A), c(-1)), mul(mul(conj(A), conj(A)), c(-1)));
  check('   and the loop value -A^2 - A^-2 is phi, as Fibonacci anyons require',
    Math.abs(loop[0] - PHI) < 1e-12 && Math.abs(loop[1]) < 1e-12);

  /** Score one six-trit braid word on all 9 inputs, three ways: inputs where the right
   * answer is the unique most probable outcome (`right`), inputs where it ties for most
   * probable (`tied`), and the rest. Ties are EXACT in this circuit and common, and an
   * argmax over a tie is decided by rounding -- float32 in the Python original. The first
   * enumeration scored ties that way and reported a spread of 3 to 8 out of 9 that was
   * rounding noise; `right` is the part of a score that survives exact arithmetic. */
  const TIE = 1e-9;
  function score(word) {
    const U = trits => [0, 1, 2].reduce((u, i) => mm(SIGMA[trits[i] * (i + 1)], u), eye(3));
    const UA = U(word.slice(0, 3)), UB = U(word.slice(3));
    let right = 0, tied = 0;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const pa = UA.map(row => row[a]), pb = UB.map(row => row[b]);   // column = U|basis>
      const prob = [0, 0, 0];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const amp = mul(pa[i], pb[j]);
        prob[(j + i) % 3] += amp[0] * amp[0] + amp[1] * amp[1];   // CX3 then trace out A
      }
      const top = Math.max(...prob);
      const atTop = prob.filter(p => top - p < TIE).length;
      if (top - prob[(a + b) % 3] < TIE) { if (atTop === 1) right++; else tied++; }
    }
    return { right, tied };
  }
  check('   and with every braid at identity it computes (a+b) mod 3 on all 9 inputs, by CX3 alone',
    score([0, 0, 0, 0, 0, 0]).right === 9);
  // The tie detector must be able to see a tie, or "no ties" below would be vacuous.
  check('   and the tie detector sees ties where they exist (the sigma_2-on words have them)',
    score([0, 1, 0, 0, 0, 0]).tied > 0);

  const words = [];
  const T3 = [-1, 0, 1];
  for (let n = 0; n < 729; n++) {
    const w = []; let k = n;
    for (let i = 5; i >= 0; i--) { w[i] = T3[k % 3]; k = Math.floor(k / 3); }
    words.push(w);
  }
  const scored = words.map(score);
  const perfect = words.filter((w, i) => scored[i].right === 9);
  const dist = {}; for (const s of scored) dist[`${s.right}+${s.tied}`] = (dist[`${s.right}+${s.tied}`] || 0) + 1;
  console.log(`  (words by inputs won outright + inputs tied: ${JSON.stringify(dist)})`);

  check('F-QUTRIT-HYPERNET-NOTHING-TO-LEARN: the controller can emit exactly 729 distinct circuits',
    words.length === 729 && new Set(words.map(String)).size === 729);
  check('   81 of them compute the task perfectly, with no ties',
    perfect.length === 81 && perfect.every(w => score(w).tied === 0), String(perfect.length));
  check('   and they are exactly the words with sigma_2 off on both qutrits -- the braids reduce to phases',
    words.every((w, i) => (scored[i].right === 9) === (w[1] === 0 && w[4] === 0)));
  check('   every other word wins exactly 3 of the 9 inputs outright, and ties or loses the rest',
    scored.every(s => s.right === 9 || s.right === 3),
    JSON.stringify(dist));

  // The word the recorded training run ended on, read from its log rather than copied.
  const LOG = path.join(ROOT, 'research', 'grokking', 'results', 'agent-session-logs',
    'step1342-ternary-quantum-hypernet-mod3.txt');
  const m = /Qutrit A: \[([^\]]+)\] \| Qutrit B: \[([^\]]+)\]/.exec(fs.readFileSync(LOG, 'utf8'));
  const learned = m ? [...m[1].split(','), ...m[2].split(',')].map(Number) : null;
  const learnedScore = learned && learned.length === 6 ? score(learned) : null;
  check(`   the recorded training run ended on a word that wins ${learnedScore && learnedScore.right} of 9 outright`
    + ` (${learnedScore && learnedScore.tied} tied) -- not one of the perfect 81, which a random word hits one time in nine`,
    learnedScore !== null && learnedScore.right < 9, `parsed ${JSON.stringify(learned)}`);

  // The docstring lists a qutrit Hadamard among the circuit's parts; the forward pass
  // never applies it. Read from the source, so this goes red if someone wires it in.
  const src = fs.readFileSync(path.join(ROOT, 'research', 'quantum_grokking', 'ternary_qutrit_circuit.py'), 'utf8');
  const body = src.slice(src.indexOf('def forward_state'));
  check('   the qutrit Hadamard the docstring lists is built but never applied',
    /self\.h3 = build_qutrit_hadamard\(\)/.test(src) && !/self\.h3/.test(body));

  // Cross-check against the Python original. Skipped -- never passed -- without torch.
  let ref = null;
  for (const py of ['python3', 'python']) {
    const r = spawnSync(py, [path.join(__dirname, 'qutrit-enumerate.py')], { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
    if (r.status === 0) { try { ref = JSON.parse(r.stdout); break; } catch (e) { /* not this one */ } }
  }
  if (ref) {
    // Agreement means: the same words in the same order, the same 81 perfect, and every
    // float32 score inside [won outright, won outright + tied] -- the only freedom
    // rounding has is which way an exact tie falls.
    check('   and the Node circuit agrees with the Python original on every one of the 729 words',
      ref.words.length === 729 && ref.words.every((w, i) => String(w) === String(words[i])
        && (ref.scores[i] === 9) === (scored[i].right === 9)
        && ref.scores[i] >= scored[i].right && ref.scores[i] <= scored[i].right + scored[i].tied));
    check('   and float32 breaks some ties the right way, so its 3-to-8 spread is rounding, not learning',
      ref.scores.some((s, i) => s > scored[i].right));
  } else {
    console.log('  [SKIP] the two Python cross-checks -- no Python with torch here, so not asked and not counted');
  }
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
process.exit(fails.length ? 1 : 0);
