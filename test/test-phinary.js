'use strict';
/* test-phinary.js — Comprehensive verification of phinary arithmetic,
 * Zeckendorf canonical coding, and 2D golden lattice memory coordinates.
 */

const P = require('../src/phinary.js');
const T = require('../src/ternary.js');

let pass = 0;
const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log(`  [PASS] ${name}`);
  } else {
    fails.push(name);
    console.log(`  [FAIL] ${name}  ${detail}`);
  }
};

console.log('\n=== 1. Z[phi] RING ARITHMETIC ===');
// Addition & Subtraction
const p1 = new P.PhiPair(2, 3);   // 2 + 3*phi
const p2 = new P.PhiPair(-1, 4);  // -1 + 4*phi
const sum = P.phiAdd(p1, p2);     // 1 + 7*phi
check('phiAdd computes exact ring sum', sum.a === 1 && sum.b === 7);

const diff = P.phiSub(p1, p2);    // 3 - 1*phi
check('phiSub computes exact ring difference', diff.a === 3 && diff.b === -1);

// Multiplication: (1 + phi)^2 = 1 + 2*phi + phi^2 = 2 + 3*phi
const onePlusPhi = new P.PhiPair(1, 1);
const sq = P.phiMul(onePlusPhi, onePlusPhi);
check('(1 + phi)^2 = 2 + 3*phi', sq.a === 2 && sq.b === 3);

// phi * phi = phi^2 = 1 + phi
const phi = new P.PhiPair(0, 1);
const phiSq = P.phiMul(phi, phi);
check('phi * phi = 1 + phi', phiSq.a === 1 && phiSq.b === 1);

// Scaling by phi and phi^-1
const scaled = P.phiScale(p1); // (2, 3) * phi = (3, 5)
check('phiScale (a,b)*phi = (b, a+b)', scaled.a === 3 && scaled.b === 5);

const unscaled = P.phiScaleInv(scaled); // (3, 5) * phi^-1 = (2, 3)
check('phiScaleInv inverts phiScale exactly', unscaled.equals(p1));

// Multiplicative property of norm: N(x * y) = N(x) * N(y)
const normP1 = P.phiNorm(p1); // 2^2 + 2*3 - 3^2 = 4 + 6 - 9 = 1
const normP2 = P.phiNorm(p2); // (-1)^2 + (-1)*4 - 4^2 = 1 - 4 - 16 = -19
const p1p2 = P.phiMul(p1, p2);
const normProd = P.phiNorm(p1p2);
check('algebraic norm is multiplicative: N(p1*p2) = N(p1)*N(p2)', normProd === normP1 * normP2);
check('norm of phi is -1', P.phiNorm(phi) === -1);
check('norm of phi^2 is +1', P.phiNorm(phiSq) === 1);


console.log('\n=== 2. 2D GOLDEN LATTICE COORDINATE RESOLVER ===');
// Exhaustive check across all 729 tryte addresses in [-364, +364]
let coordBijection = true;
let inBounds = true;
for (let addr = -364; addr <= 364; addr++) {
  const { u, v } = P.coordFromAddr(addr);
  if (u < -13 || u > 13 || v < -13 || v > 13) inBounds = false;
  const back = P.addrFromCoord(u, v);
  if (back !== addr) {
    coordBijection = false;
    break;
  }
}
check('all 729 addresses map bijectively to [-13, 13]^2 coordinates', coordBijection);
check('every resolved coordinate stays within [-13, 13] boundary', inBounds);

// Center and boundary anchors
const center = P.coordFromAddr(0);
check('address 0 maps to lattice center (0, 0)', center.u === 0 && center.v === 0);

const minCoord = P.coordFromAddr(-364);
check('address -364 maps to (-13, -13)', minCoord.u === -13 && minCoord.v === -13);

const maxCoord = P.coordFromAddr(364);
check('address +364 maps to (+13, +13)', maxCoord.u === 13 && maxCoord.v === 13);

let oobCaught = false;
try {
  P.addrFromCoord(14, 0);
} catch (e) {
  oobCaught = true;
}
check('out of bounds coordinate (> 13) throws error', oobCaught);


console.log('\n=== 3. ZECKENDORF CANONICAL CODING (NO CONSECUTIVE 1s) ===');
// Exhaustive test for non-negative range 0..728
let allCanonical = true;
let allRoundTrip = true;
for (let n = 0; n <= 728; n++) {
  const bits = P.toZeckendorf(n);
  if (!P.isCanonicalZeckendorf(bits)) {
    allCanonical = false;
    break;
  }
  const decoded = P.fromZeckendorf(bits);
  if (decoded !== n) {
    allRoundTrip = false;
    break;
  }
}
check('Zeckendorf decomposition satisfies c_i * c_{i+1} = 0 for all 0..728', allCanonical);
check('Zeckendorf round-trip fromZeckendorf(toZeckendorf(n)) == n for all 0..728', allRoundTrip);

// Specific known values:
// 1 = F_1 = [1]
// 2 = F_2 = [0, 1]
// 3 = F_3 = [0, 0, 1]
// 4 = F_3 + F_1 = 3 + 1 = [1, 0, 1]
check('4 = F_3 + F_1 = [1, 0, 1]', JSON.stringify(P.toZeckendorf(4)) === '[1,0,1]');
// 7 = F_4 + F_2 = 5 + 2 = [0, 1, 0, 1]
check('7 = F_4 + F_2 = [0, 1, 0, 1]', JSON.stringify(P.toZeckendorf(7)) === '[0,1,0,1]');

// Local rewrite rule 011_phi -> 100_phi
const nonCanonical = [1, 1]; // 1 + phi = phi^2 = [0, 0, 1]
const normalized = P.normalizePhinaryBits(nonCanonical);
check('normalizePhinaryBits transforms [1, 1] to [0, 0, 1]', JSON.stringify(normalized) === '[0,0,1]');


console.log('\n=== 4. PHICACHE ZERO-DISTANCE IN-CACHE SUBSYSTEM ===');
const cache = new P.PhiCache();
check('PhiCache memory buffer is exactly 1,458 bytes (1.45 KB)', cache.mem.byteLength === 1458);
check('PhiCache fits strictly within 32 KB CPU L1 cache', cache.mem.byteLength <= 32768);

// Write via lattice coordinate, read via address
cache.writeCoord(5, -2, 42);
check('readAddr reads back value written by writeCoord', cache.readAddr(27 * (-2) + 5) === 42);

// Write via address, read via lattice coordinate
cache.writeAddr(100, -77);
const c100 = P.coordFromAddr(100);
check('readCoord reads back value written by writeAddr', cache.readCoord(c100.u, c100.v) === -77);

// Active entries scan
const active = cache.activeEntries();
check('activeEntries finds exactly the 2 written cells', active.length === 2);

console.log('\n================================================================');
if (fails.length === 0) {
  console.log(`ALL ${pass} CHECKS PASSED`);
} else {
  console.log(`${fails.length} CHECKS FAILED out of ${pass + fails.length}`);
  process.exit(1);
}
