//! Blazing Fast SIMD Engine
//! 1. 64-Trit Bit-Sliced Dual-Rail SWAR Vector ALU (64 trits per cycle)
//! 2. ARM NEON / Portable 128-bit Vector Polynomial Accelerator

/// Bit-sliced 64-trit dual-rail vector.
/// Represents 64 parallel trits in {-1, 0, 1} across two 64-bit integer registers:
/// - bit i of `p` is 1 if trit i is +1
/// - bit i of `n` is 1 if trit i is -1
/// - bit i of both is 0 if trit i is 0
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TritVec64 {
    pub p: u64,
    pub n: u64,
}

impl TritVec64 {
    pub const ZERO: Self = TritVec64 { p: 0, n: 0 };
    pub const ALL_POS: Self = TritVec64 { p: !0, n: 0 };
    pub const ALL_NEG: Self = TritVec64 { p: 0, n: !0 };

    #[inline(always)]
    pub fn new(p: u64, n: u64) -> Self {
        Self { p, n }
    }

    /// Convert a slice of trits in {-1, 0, 1} (up to 64) into bit-sliced dual-rail format
    pub fn from_slice(trits: &[i8]) -> Self {
        let mut p: u64 = 0;
        let mut n: u64 = 0;
        for (i, &t) in trits.iter().take(64).enumerate() {
            if t == 1 {
                p |= 1u64 << i;
            } else if t == -1 {
                n |= 1u64 << i;
            }
        }
        Self { p, n }
    }

    /// Unpack bit-sliced dual-rail trits back into a vector of signed trits in {-1, 0, 1}
    pub fn to_vec(&self, len: usize) -> Vec<i8> {
        let count = len.min(64);
        let mut out = Vec::with_capacity(count);
        for i in 0..count {
            let is_p = (self.p >> i) & 1 != 0;
            let is_n = (self.n >> i) & 1 != 0;
            let val = if is_p && !is_n {
                1
            } else if is_n && !is_p {
                -1
            } else {
                0
            };
            out.push(val);
        }
        out
    }

    /// Physical zero-gate negation across all 64 trits: register swap p <-> n
    #[inline(always)]
    pub fn neg(&self) -> Self {
        Self {
            p: self.n,
            n: self.p,
        }
    }

    /// Parallel 64-trit MIN (AND-like lattice op):
    /// p = a.p & b.p, n = a.n | b.n
    #[inline(always)]
    pub fn min(&self, other: &Self) -> Self {
        Self {
            p: self.p & other.p,
            n: self.n | other.n,
        }
    }

    /// Parallel 64-trit MAX (OR-like lattice op):
    /// p = a.p | b.p, n = a.n & b.n
    #[inline(always)]
    pub fn max(&self, other: &Self) -> Self {
        Self {
            p: self.p | other.p,
            n: self.n & other.n,
        }
    }

    /// Parallel 64-trit clamped sum (CSUM):
    /// p = (a.p & !b.n) | (b.p & !a.n)
    /// n = (a.n & !b.p) | (b.n & !a.p)
    #[inline(always)]
    pub fn csum(&self, other: &Self) -> Self {
        Self {
            p: (self.p & !other.n) | (other.p & !self.n),
            n: (self.n & !other.p) | (other.n & !self.p),
        }
    }

    /// Parallel 64-trit addition modulo 3 over Abelian group Z_3:
    /// (+1) + (+1) = -1
    /// (-1) + (-1) = +1
    /// (+1) + (-1) = 0
    /// 0 + x = x
    #[inline(always)]
    pub fn add_mod_3(&self, other: &Self) -> Self {
        let z_a = !(self.p | self.n);
        let z_b = !(other.p | other.n);
        let res_p = (self.p & z_b) | (z_a & other.p) | (self.n & other.n);
        let res_n = (self.n & z_b) | (z_a & other.n) | (self.p & other.p);
        Self {
            p: res_p,
            n: res_n,
        }
    }

    /// Parallel 64-trit subtraction modulo 3 over Z_3: a - b = a + neg(b)
    #[inline(always)]
    pub fn sub_mod_3(&self, other: &Self) -> Self {
        self.add_mod_3(&other.neg())
    }

    /// Parallel 64-trit multiplication over Z_3:
    /// 0 * x = 0
    /// (+1) * x = x
    /// (-1) * x = -x
    #[inline(always)]
    pub fn mul_mod_3(&self, other: &Self) -> Self {
        let res_p = (self.p & other.p) | (self.n & other.n);
        let res_n = (self.p & other.n) | (self.n & other.p);
        Self {
            p: res_p,
            n: res_n,
        }
    }

    /// Parallel 64-trit Reconfigurable TGATE:
    /// When ctrl[i] == -1: neg(a[i])
    /// When ctrl[i] == +1: max(a[i], b[i])
    /// When ctrl[i] ==  0: min(a[i], b[i])
    #[inline(always)]
    pub fn tgate(&self, other: &Self, ctrl: &Self) -> Self {
        let m_neg = ctrl.n;
        let m_pos = ctrl.p;
        let m_zero = !(m_neg | m_pos);

        let v_neg = self.neg();
        let v_max = self.max(other);
        let v_min = self.min(other);

        let res_p = (v_neg.p & m_neg) | (v_max.p & m_pos) | (v_min.p & m_zero);
        let res_n = (v_neg.n & m_neg) | (v_max.n & m_pos) | (v_min.n & m_zero);
        Self {
            p: res_p,
            n: res_n,
        }
    }
}

// ---------------------------------------------------------------------------
// ARM NEON & Portable 128-bit Vector Polynomial Acceleration
// ---------------------------------------------------------------------------

#[cfg(target_arch = "aarch64")]
pub mod neon {
    use core::arch::aarch64::*;

    /// Vectorized addition of 8 polynomial coefficients (128-bit NEON)
    #[inline(always)]
    pub unsafe fn vadd_8x16(a: *const i16, b: *const i16, out: *mut i16) {
        let va = vld1q_s16(a);
        let vb = vld1q_s16(b);
        let vres = vaddq_s16(va, vb);
        vst1q_s16(out, vres);
    }

    /// Vectorized subtraction of 8 polynomial coefficients (128-bit NEON)
    #[inline(always)]
    pub unsafe fn vsub_8x16(a: *const i16, b: *const i16, out: *mut i16) {
        let va = vld1q_s16(a);
        let vb = vld1q_s16(b);
        let vres = vsubq_s16(va, vb);
        vst1q_s16(out, vres);
    }
}

/// Portable fallback / vector chunk processor for polynomial coefficients
pub mod portable {
    use crate::ternary::wrap;

    /// Vectorized polynomial addition modulo 729
    pub fn vec_poly_add(a: &[i16], b: &[i16], out: &mut [i16]) {
        assert_eq!(a.len(), b.len());
        assert_eq!(a.len(), out.len());

        let len = a.len();
        let chunks = len / 8;

        for c in 0..chunks {
            let base = c * 8;
            for i in 0..8 {
                out[base + i] = wrap(a[base + i] as i32 + b[base + i] as i32);
            }
        }
        for i in (chunks * 8)..len {
            out[i] = wrap(a[i] as i32 + b[i] as i32);
        }
    }

    /// Vectorized polynomial subtraction modulo 729
    pub fn vec_poly_sub(a: &[i16], b: &[i16], out: &mut [i16]) {
        assert_eq!(a.len(), b.len());
        assert_eq!(a.len(), out.len());

        let len = a.len();
        let chunks = len / 8;

        for c in 0..chunks {
            let base = c * 8;
            for i in 0..8 {
                out[base + i] = wrap(a[base + i] as i32 - b[base + i] as i32);
            }
        }
        for i in (chunks * 8)..len {
            out[i] = wrap(a[i] as i32 - b[i] as i32);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tritvec64_min_max_neg() {
        let t1 = vec![1, -1, 0, 1, -1, 0, 1, 1];
        let t2 = vec![-1, -1, 0, 0, 1, 1, -1, 0];

        let v1 = TritVec64::from_slice(&t1);
        let v2 = TritVec64::from_slice(&t2);

        let v_min = v1.min(&v2).to_vec(8);
        let v_max = v1.max(&v2).to_vec(8);
        let v_neg = v1.neg().to_vec(8);

        for i in 0..8 {
            assert_eq!(v_min[i], t1[i].min(t2[i]));
            assert_eq!(v_max[i], t1[i].max(t2[i]));
            assert_eq!(v_neg[i], -t1[i]);
        }
    }

    #[test]
    fn test_tritvec64_csum() {
        let t1 = vec![1, -1, 0, 1, -1, 0];
        let t2 = vec![1, -1, 0, -1, 1, 1];

        let v1 = TritVec64::from_slice(&t1);
        let v2 = TritVec64::from_slice(&t2);

        let v_csum = v1.csum(&v2).to_vec(6);
        for i in 0..6 {
            assert_eq!(v_csum[i], (t1[i] + t2[i]).clamp(-1, 1));
        }
    }

    #[test]
    fn test_tritvec64_add_sub_mod_3() {
        let t1 = vec![1, 1, -1, -1, 0, 1, -1];
        let t2 = vec![1, -1, 1, -1, 0, 0, 0];

        let v1 = TritVec64::from_slice(&t1);
        let v2 = TritVec64::from_slice(&t2);

        let v_add = v1.add_mod_3(&v2).to_vec(7);
        let _v_sub = v1.sub_mod_3(&v2).to_vec(7);

        // Check inverse property: (a + b) - b = a over Z_3
        let v_rec = TritVec64::from_slice(&v_add).sub_mod_3(&v2).to_vec(7);
        assert_eq!(v_rec, t1);
    }

    #[test]
    fn test_tritvec64_tgate() {
        let t1 = vec![1, 1, 1, 1];
        let t2 = vec![-1, -1, -1, -1];
        let c = vec![-1, 0, 1, 0]; // NEG, MIN, MAX, MIN

        let v1 = TritVec64::from_slice(&t1);
        let v2 = TritVec64::from_slice(&t2);
        let vc = TritVec64::from_slice(&c);

        let res = v1.tgate(&v2, &vc).to_vec(4);
        assert_eq!(res[0], -1); // NEG(1) = -1
        assert_eq!(res[1], -1); // MIN(1, -1) = -1
        assert_eq!(res[2], 1);  // MAX(1, -1) = 1
        assert_eq!(res[3], -1); // MIN(1, -1) = -1
    }
}
