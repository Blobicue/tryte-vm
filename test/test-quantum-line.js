'use strict';
/* test-quantum-line.js — the one record of the quantum line that stays here after it moved out.
 *
 * The quantum, cryptography and toolchain line left this repository (FENCE.md); its code,
 * its suites and the harness that ran them with seeded bugs now live in tryte-quantum.
 * One finding about it stays on this record: F-QUTRIT-HYPERNET-NOTHING-TO-LEARN. Its
 * "true ternary quantum hypernetwork" lets a ternary controller choose among 729
 * two-qutrit circuits, and the perfect ones are exactly those whose braids reduce to
 * phases -- the hardwired entangler already computes the task.
 *
 * The assertion survives the code leaving because it never needed the code: the circuit
 * is re-implemented below in exact arithmetic. What it does need from the original -- the
 * Python circuit, the session log of the training run, and the enumerator that runs the
 * Python circuit for the cross-check -- is read out of THIS repository's history at the
 * commit the finding was made in, so nothing here depends on another repository existing.
 * With Python and torch present the Node circuit is held against the Python one; without
 * them those two checks are SKIPPED, never counted as passed.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
// The commit F-QUTRIT-HYPERNET-NOTHING-TO-LEARN was recorded in; everything below was on disk then.
const AT = 'c3c9b21';
const FROM_HISTORY = {
  circuit: 'research/quantum_grokking/ternary_qutrit_circuit.py',
  log: 'research/grokking/results/agent-session-logs/step1342-ternary-quantum-hypernet-mod3.txt',
  enumerate: 'test/qutrit-enumerate.py',
};

let pass = 0; const fails = [];
let quiet = false;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; if (!quiet) console.log(`  [PASS] ${name}`); }
  else { fails.push(name); if (!quiet) console.log(`  [FAIL] ${name}  ${detail}`); }
};

/** A file as it stood at commit AT, or null if git cannot produce it. */
function atCommit(rel) {
  try {
    return execFileSync('git', ['show', `${AT}:${rel}`],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY VERDICT ===');
check('the harness reports a false check as FAIL', (() => {
  const before = [fails.length, pass];
  quiet = true; check('deliberately false', false); quiet = false;
  const caught = fails.length === before[0] + 1 && pass === before[1];
  fails.pop(); return caught;
})());
const SRC = {};
for (const [k, rel] of Object.entries(FROM_HISTORY)) SRC[k] = atCommit(rel);
// Fail closed: a shallow clone without this commit cannot see the evidence, and must say so.
check(`the original circuit, session log and enumerator are readable from history at ${AT}`,
  Object.values(SRC).every(s => typeof s === 'string' && s.length > 0),
  Object.entries(SRC).filter(([, s]) => !s).map(([k]) => k).join(' '));
check('   and the probe would notice a path that history does not hold',
  atCommit('research/no-such-file.py') === null);
// The Python cross-check runs the enumerator against the circuit in a scratch tree laid out
// as the repository was, because the enumerator finds the circuit relative to itself.
const STAGE = fs.mkdtempSync(path.join(os.tmpdir(), 'qutrit-'));
for (const [k, rel] of Object.entries(FROM_HISTORY)) {
  if (!SRC[k]) continue;
  fs.mkdirSync(path.dirname(path.join(STAGE, rel)), { recursive: true });
  fs.writeFileSync(path.join(STAGE, rel), SRC[k]);
}
process.on('exit', () => { try { fs.rmSync(STAGE, { recursive: true, force: true }); } catch (e) { /* best effort */ } });

console.log('\n=== 1. F-QUTRIT-HYPERNET-NOTHING-TO-LEARN ===');
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
  const m = /Qutrit A: \[([^\]]+)\] \| Qutrit B: \[([^\]]+)\]/.exec(SRC.log || '');
  const learned = m ? [...m[1].split(','), ...m[2].split(',')].map(Number) : null;
  const learnedScore = learned && learned.length === 6 ? score(learned) : null;
  check(`   the recorded training run ended on a word that wins ${learnedScore && learnedScore.right} of 9 outright`
    + ` (${learnedScore && learnedScore.tied} tied) -- not one of the perfect 81, which a random word hits one time in nine`,
    learnedScore !== null && learnedScore.right < 9, `parsed ${JSON.stringify(learned)}`);

  // The docstring lists a qutrit Hadamard among the circuit's parts; the forward pass
  // never applies it. Read from the source, so this goes red if someone wires it in.
  const src = SRC.circuit || '';
  const body = src.slice(src.indexOf('def forward_state'));
  check('   the qutrit Hadamard the docstring lists is built but never applied',
    /self\.h3 = build_qutrit_hadamard\(\)/.test(src) && !/self\.h3/.test(body));

  // Cross-check against the Python original. Skipped -- never passed -- without torch.
  let ref = null;
  for (const py of ['python3', 'python']) {
    const r = spawnSync(py, [path.join(STAGE, 'test', 'qutrit-enumerate.py')], { cwd: STAGE, encoding: 'utf8', timeout: 300000 });
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
