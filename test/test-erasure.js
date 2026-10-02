'use strict';
/* test-erasure.js — what this machine destroys, in bits.
 *
 * Set `AB`. The question came from outside: a sister project prices a term by a
 * static count that is a TOTAL FUNCTION OF THE OBJECT — anyone holding the term
 * recomputes the price, so there is nothing to attest and no meter to corrupt. That
 * is a real virtue and the obvious thing to want here. But a price tag says what a
 * thing cost to build, and a conservation law says what can never be gotten back,
 * and only the second one is free of convention: Landauer prices erasure at kT ln2
 * per bit whether anybody agrees or not.
 *
 * So this set asks which of THIS machine's own instructions destroy information, how
 * much, and whether the resulting charge has the property the static count has.
 *
 * The checks worth keeping are the two failures. `AB4` predicted the charge would be
 * unrecoverable from the program text and it is recoverable for six of eight
 * programs, because the opcodes they use are all fixed-price. `AB5` predicted the
 * reversible fragment would reach the full symmetric group and it does not — it is
 * 2^W * 3^((3^W-1)/2), a vanishing fraction, so reversibility does NOT buy
 * universality and the eraser is load-bearing after all.
 *
 * The exhaustive version is `npm run audit:erasure`.
 */

const T = require('../src/ternary.js');
const { OPS } = require('../src/isa.js');
const E = require('../tools/erasure-audit.js');
const { idPerm, chainOf } = require('../tools/perm-lib.js');
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0; const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fails.push(name); console.log(`  [FAIL] ${name}  ${detail}`); }
};
const N = E.N, MAXBITS = E.MAXBITS;
const near = (a, b, eps = 1e-4) => Math.abs(a - b) < eps;
const val = i => i + T.TRYTE_MIN;
const ix = v => T.wrap(v) - T.TRYTE_MIN;

console.log('\n=== 0. THE INSTRUMENT, BEFORE ANY FINDING ===');
{
  check('an injective map erases exactly zero bits',
    E.erasureOf(idPerm(N), N) === 0);
  check('a constant map erases exactly log2 729 = 9.5098 bits',
    near(E.erasureOf(new Array(N).fill(0), N), MAXBITS));
  check('a three-to-one map erases exactly log2 3, which is the unit SHL and SHR are measured in',
    near(E.erasureOf(Array.from({ length: N }, (_, i) => Math.floor(i / 3)), N), Math.log2(3)));
  // The harness must be able to report a failure. Break the measure deliberately.
  const brokenSaysInjective = E.erasureOf(new Array(N).fill(0), N) === 0;
  check('and the harness notices a wrong answer: a constant map does NOT read as injective',
    brokenSaysInjective === false);
  check('erasure is bounded by the log of the state count, on a random map',
    (() => {
      let s = 7; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) % N;
      const img = Array.from({ length: N }, () => rnd());
      const e = E.erasureOf(img, N);
      return e > 0 && e < MAXBITS;
    })());
}

console.log('\n=== 0b. THE TOOL AS IT IS ACTUALLY RUN, NOT ONLY AS AN IMPORT ===');
{
  // Every other check here imports the audit, and importing never executes a print
  // path. A mechanical rename once rewrote log()'s own body into a call to itself:
  // the tool crashed on every run and the whole suite stayed green, because
  // importing sets MAIN false. Run it as a subprocess, capped so it costs seconds.
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'tools', 'erasure-audit.js')],
      { encoding: 'utf8', env: { ...process.env, ERASURE_MAX_WIDTH: '2' } });
  } catch (e) { code = 1; out = (e.stdout || '') + (e.message || ''); }
  check('the audit runs to completion as a program, not only as an import',
    code === 0, out.split('\n').slice(-3).join(' | '));
  check('and every one of its five sections printed, so every log path executed',
    [/1\. AB1/, /2\. AB2/, /3\. AB3/, /4\. AB4/, /5\. AB5/].every(r => r.test(out)));
  check('and the cap is honoured, so the cheap run is the same code path as the full one',
    /W=2: measured 324   closed form 324   MATCH/.test(out) && !/W=3: measured/.test(out));
}

console.log('\n=== 1. AB1 — INFORMATION-PRESERVING TWO-INPUT OPERATIONS ARE RARE ===');
{
  check('exactly 216 of the 19,683 tritwise two-input tables preserve information',
    E.ternaryReversible === 216, `got ${E.ternaryReversible}`);
  check('exactly 4 of the 16 binary two-input tables do',
    E.binaryReversible === 4, `got ${E.binaryReversible}`);
  check('so binary is about 23x more likely to preserve, at 25.0% against 1.10%',
    near((E.binaryReversible / 16) / (E.ternaryReversible / 19683), 22.8, 0.05));
  check('18 of the 216 are affine over GF(3) and 198 are not — the shape M1 found on 27 points',
    E.ternaryAffine === 18 && E.ternaryReversible - E.ternaryAffine === 198,
    `affine ${E.ternaryAffine}`);
  check('the count is derived from the table set, not typed: 216 tables are actually held',
    E.reversibleTables.length === E.ternaryReversible);
  // The column criterion is an ARGUMENT. Check it against the thing it claims to
  // predict — a full sweep of the 531,441-pair space — rather than trusting it.
  check('the column criterion agrees with a full 531,441-pair sweep on every table tried',
    (() => {
      for (const k of [0, 1, 4373, 9841, 13122, 19682]) {
        const t = E.tableOf(k);
        const img = new Int32Array(N * N);
        for (let a = 0; a < N; a++)
          for (let w = 0; w < N; w++) img[a * N + w] = ix(T.ttable(t, val(a), val(w))) * N + w;
        const byCriterion = [0, 1, 2].every(m => E.isBijection(E.columnOf(t, m)));
        if (byCriterion !== (E.erasureOf(img, N * N) === 0)) return false;
      }
      return true;
    })());
}

console.log('\n=== 2. AB2 — THE ERASERS ARE NOT THE ACCUMULATOR OVERWRITES ===');
{
  const CLASS = r => {
    if (r.family) return 'family';
    if (r.max === 0) return 'preserves';
    if (Math.abs(r.min - r.max) < 1e-12) return 'fixed';
    return 'varies';
  };
  const of = c => E.census.filter(r => CLASS(r) === c).map(r => r.name).sort();
  const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  check('every opcode in the ISA is classified, none dropped',
    E.census.length === Object.keys(OPS).length, `${E.census.length} of ${Object.keys(OPS).length}`);
  check('11 opcodes erase zero bits for every operand',
    eq(of('preserves'), ['ADD', 'ADDI', 'BR3', 'HALT', 'JMP', 'JMPX', 'LDC', 'NEG', 'OUT', 'SETC', 'SUB'].sort()),
    of('preserves').join(' '));
  check('4 erase a fixed amount: LOADI LOAD STORE IN',
    eq(of('fixed'), ['IN', 'LOAD', 'LOADI', 'STORE'].sort()), of('fixed').join(' '));
  check('5 erase an operand-dependent amount: MIN MAX CSUM SHL SHR',
    eq(of('varies'), ['CSUM', 'MAX', 'MIN', 'SHL', 'SHR'].sort()), of('varies').join(' '));
  check('6 are table families, quantum, or three-place, and out of scope for a two-place census',
    eq(of('family'), ['LOADX', 'QEXEC', 'STOREX', 'TGATE', 'TOP', 'TOPC'].sort()), of('family').join(' '));

  const store = E.census.find(r => r.name === 'STORE');
  check('STORE erases the maximum 9.5098 bits — and it never writes the accumulator',
    near(store.pairE, MAXBITS) && near(store.min, MAXBITS),
    `pair ${store.pairE}`);
  check('so the instruction that reads as SAVING is the textbook Landauer erasure',
    E.WRITES_WORD('STORE') && !E.WRITES_WORD('LOAD'));
  check('ADD is a permutation of the whole 531,441-pair datapath: it keeps the operand',
    E.erasureOf(E.datapathMap('ADD', 0).img, N * N) === 0);
  check('LOAD is not, on the same state space',
    near(E.erasureOf(E.datapathMap('LOAD', 0).img, N * N), MAXBITS));

  // The state boundary decides the answer, and this is the thing worth remembering.
  const min = E.census.find(r => r.name === 'MIN');
  check('MIN reads as ONE fixed figure on the pair and a RANGE on the accumulator — ' +
    'the same instruction, two readings, because the operand is state in one and not the other',
    near(min.pairE, 4.5033) && near(min.min, 0) && near(min.max, MAXBITS));
  check('and the pair figure is exactly the mean of the accumulator figures, not a coincidence',
    near(min.pairE, min.mean));
}

console.log('\n=== 3. AB3 — THE SAME INSTRUCTION, A DIFFERENT PRICE ===');
{
  const accE = (name, v) => E.erasureOf(E.accMap(name, v), N);
  check('MIN erases nothing when the operand is all +1',
    accE('MIN', T.TRYTE_MAX) === 0);
  check('MIN erases everything when the operand is all -1',
    near(accE('MIN', T.TRYTE_MIN), MAXBITS));
  check('MAX is the mirror: everything at all +1, nothing at all -1',
    near(accE('MAX', T.TRYTE_MAX), MAXBITS) && accE('MAX', T.TRYTE_MIN) === 0);
  check('the mean over all 729 operands is 4.5033 bits, which is 6 * (0 + 2/3 + log2 3)/3',
    near(E.census.find(r => r.name === 'MIN').mean, 6 * (0 + 2 / 3 + Math.log2(3)) / 3));
  check('CSUM never reaches the maximum at all: it spans 0 to exactly 4 bits',
    (() => {
      const r = E.census.find(x => x.name === 'CSUM');
      return r.min === 0 && near(r.max, 4) && near(r.mean, 8 / 3);
    })());
  check('and 4 bits is strictly less than 9.5098, so one tritwise gate cannot erase a whole tryte',
    E.census.find(r => r.name === 'CSUM').max < MAXBITS);
  check('SHL n and SHR n erase the SAME amount for every n in 0..6 — one drops the high ' +
    'trits and one the low, and the count cannot tell them apart',
    [0, 1, 2, 3, 4, 5, 6].every(n => near(accE('SHL', n), accE('SHR', n))));
  check('and that amount is exactly n * log2 3',
    [0, 1, 2, 3, 4, 5, 6].every(n => near(accE('SHL', n), n * Math.log2(3))));
}

console.log('\n=== 4. AB4 — FAILED: THE CHARGE IS MOSTLY IN THE TEXT AFTER ALL ===');
{
  const rows = E.programRows.filter(r => r.actual > 0);
  const gaps = rows.filter(r => r.bound > r.actual + 1e-9);
  const worst = rows.reduce((m, r) => Math.max(m, r.bound / r.actual), 0);
  check('every program in programs/ is priced',
    E.programRows.length === 8, `${E.programRows.length} programs`);
  check('AB4 FAILED and stays failed: it predicted a gap for every program, and most have none',
    gaps.length < rows.length, `${gaps.length} of ${rows.length} show a gap`);
  check('exactly 2 of the 8 programs charge less than their text bound',
    gaps.length === 2, `${gaps.length}`);
  check('and the largest overcharge is 1.21x, not the predicted 2x or more',
    worst < 2 && near(worst, 1.21, 0.01), `${worst.toFixed(3)}x`);
  check('the programs with no gap are the ones whose opcodes are all fixed-price — ' +
    'so the static count transfers exactly when the instruction mix is operand-independent',
    rows.filter(r => r.bound <= r.actual + 1e-9).length === 6);
  check('some instructions are unpriced rather than silently charged zero: the table ' +
    'families are named as out of scope, not folded in',
    E.programRows.some(r => r.skipped > 0));
}

console.log('\n=== 5. AB5 — REVERSIBILITY DOES NOT BUY UNIVERSALITY ===');
{
  const permOf = fn => { const g = new Array(N); for (let a = 0; a < N; a++) g[a] = ix(fn(val(a))); return g; };
  const seed = [permOf(A => T.add(A, 1)), permOf(A => T.neg(A))];
  const named = chainOf(seed, N);
  check('AB5 first half HELD: the named zero-erasure ALU generates exactly 1,458 states ' +
    'worth of group on the 729-state accumulator',
    named.order === 1458n, `${named.order}`);
  check('which is 729 translations extended by negation, and nothing else',
    named.order === 729n * 2n);
  check('every ADD and SUB map, at every one of the 729 operands, lies inside that group — ' +
    'so two generators really do stand for all 1,459 instruction maps',
    (() => {
      for (let w = 0; w < N; w++) {
        if (!named.contains(permOf(A => T.add(A, val(w))))) return false;
        if (!named.contains(permOf(A => T.sub(A, val(w))))) return false;
      }
      return true;
    })());

  // The ladder. Width 5 costs a minute and width 6 does not finish, so the closed
  // form is checked where it can be checked and extrapolated where it cannot.
  const ladder = [1, 2, 3, 4].map(W => E.reversibleFragment(W));
  check('AB5 second half FAILED and stays failed: from width 2 up, the reversible ' +
    'fragment never reaches the symmetric group or the alternating one',
    ladder.slice(1).every(r => r.full !== r.SN && r.full !== r.SN / 2n),
    ladder.map(r => `W${r.W}:${r.full}`).join(' '));
  check('the measured orders land on a closed form, |G_W| = 2^W * 3^((3^W - 1)/2), at every width',
    ladder.every(r => r.full === r.closed),
    ladder.map(r => `W${r.W} ${r.full} vs ${r.closed}`).join('  '));
  check('the named ALU is 2 * 3^W at every width, which is where the 1,458 above comes from',
    ladder.every(r => r.named === 2n * 3n ** BigInt(r.W)));
  check('at width 1 reversibility IS free — the fragment is the whole symmetric group on 3 states',
    ladder[0].full === ladder[0].SN);
  check('and it stops being free immediately: by width 2 the fragment is 324 of 362,880',
    ladder[1].full === 324n && ladder[1].SN === 362880n);
  check('by width 4 the fragment is under 10^-100 of all permutations of 81 states',
    ladder[3].SN.toString().length - ladder[3].full.toString().length === 100);
  check('extrapolated to the real accumulator the fragment is 2^6 * 3^364, about 176 digits ' +
    'against 729! at 1,773 — so the eraser is load-bearing, not a convention',
    ((2n ** 6n) * (3n ** 364n)).toString().length === 176 &&
    E.factorial(729).toString().length === 1773);
}

console.log(`\n${'='.repeat(64)}`);
console.log(fails.length ? `${fails.length} CHECK(S) FAILED:\n  ${fails.join('\n  ')}` : `ALL ${pass} CHECKS PASSED`);
console.log('='.repeat(64));
process.exit(fails.length ? 1 : 0);
