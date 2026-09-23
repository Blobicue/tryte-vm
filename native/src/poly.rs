//! High-Performance Polynomial Ring Engine over Z_729[X] / (X^N ± 1)
//! Accelerated with SIMD vector additions/subtractions.

use crate::simd::portable::{vec_poly_add, vec_poly_sub};
use crate::ternary::wrap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RingMode {
    Cyclic,     // X^N - 1 (NTRU)
    Negacyclic, // X^N + 1 (Ring-LWE)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TernaryPoly {
    pub coeffs: Vec<i16>,
    pub n: usize,
    pub mode: RingMode,
}

impl TernaryPoly {
    pub fn zero(n: usize, mode: RingMode) -> Self {
        Self {
            coeffs: vec![0; n],
            n,
            mode,
        }
    }

    pub fn from_coeffs(coeffs: &[i16], mode: RingMode) -> Self {
        let n = coeffs.len();
        let wrapped = coeffs.iter().map(|&c| wrap(c as i32)).collect();
        Self {
            coeffs: wrapped,
            n,
            mode,
        }
    }

    pub fn from_trits(trits: &[i8], mode: RingMode) -> Self {
        let coeffs = trits.iter().map(|&t| wrap(t as i32)).collect();
        Self {
            coeffs,
            n: trits.len(),
            mode,
        }
    }

    #[inline(always)]
    pub fn infinity_norm(&self) -> i16 {
        self.coeffs
            .iter()
            .map(|&c| c.abs())
            .max()
            .unwrap_or(0)
    }

    pub fn add(&self, other: &Self) -> Self {
        assert_eq!(self.n, other.n);
        assert_eq!(self.mode, other.mode);
        let mut out = vec![0i16; self.n];
        vec_poly_add(&self.coeffs, &other.coeffs, &mut out);
        Self {
            coeffs: out,
            n: self.n,
            mode: self.mode,
        }
    }

    pub fn sub(&self, other: &Self) -> Self {
        assert_eq!(self.n, other.n);
        assert_eq!(self.mode, other.mode);
        let mut out = vec![0i16; self.n];
        vec_poly_sub(&self.coeffs, &other.coeffs, &mut out);
        Self {
            coeffs: out,
            n: self.n,
            mode: self.mode,
        }
    }

    pub fn neg(&self) -> Self {
        let coeffs = self.coeffs.iter().map(|&c| wrap(-(c as i32))).collect();
        Self {
            coeffs,
            n: self.n,
            mode: self.mode,
        }
    }

    pub fn scalar_mul(&self, k: i32) -> Self {
        let coeffs = self
            .coeffs
            .iter()
            .map(|&c| wrap(c as i32 * k))
            .collect();
        Self {
            coeffs,
            n: self.n,
            mode: self.mode,
        }
    }

    /// Full polynomial multiplication in R_q = Z_729[X] / (X^N ± 1)
    pub fn mul(&self, other: &Self) -> Self {
        assert_eq!(self.n, other.n);
        assert_eq!(self.mode, other.mode);
        let n = self.n;
        let mut res = vec![0i32; n];

        match self.mode {
            RingMode::Cyclic => {
                for i in 0..n {
                    let a_i = self.coeffs[i] as i32;
                    if a_i == 0 {
                        continue;
                    }
                    for j in 0..n {
                        let b_j = other.coeffs[j] as i32;
                        if b_j == 0 {
                            continue;
                        }
                        let k = (i + j) % n;
                        res[k] += a_i * b_j;
                    }
                }
            }
            RingMode::Negacyclic => {
                for i in 0..n {
                    let a_i = self.coeffs[i] as i32;
                    if a_i == 0 {
                        continue;
                    }
                    for j in 0..n {
                        let b_j = other.coeffs[j] as i32;
                        if b_j == 0 {
                            continue;
                        }
                        let sum_idx = i + j;
                        if sum_idx < n {
                            res[sum_idx] += a_i * b_j;
                        } else {
                            res[sum_idx - n] -= a_i * b_j;
                        }
                    }
                }
            }
        }

        let out = res.into_iter().map(wrap).collect();
        Self {
            coeffs: out,
            n,
            mode: self.mode,
        }
    }

    /// Fast multiplication when multiplying by a ternary polynomial {-1, 0, 1}.
    /// Avoids general multiplications: uses only additions, subtractions, and index shifts.
    pub fn mul_ternary(&self, ternary: &Self) -> Self {
        assert_eq!(self.n, ternary.n);
        assert_eq!(self.mode, ternary.mode);
        let n = self.n;
        let mut res = vec![0i32; n];

        match self.mode {
            RingMode::Cyclic => {
                for j in 0..n {
                    let t_j = ternary.coeffs[j];
                    if t_j == 0 {
                        continue;
                    }
                    if t_j == 1 {
                        for i in 0..n {
                            let a_i = self.coeffs[i] as i32;
                            if a_i == 0 {
                                continue;
                            }
                            let k = (i + j) % n;
                            res[k] += a_i;
                        }
                    } else if t_j == -1 {
                        for i in 0..n {
                            let a_i = self.coeffs[i] as i32;
                            if a_i == 0 {
                                continue;
                            }
                            let k = (i + j) % n;
                            res[k] -= a_i;
                        }
                    }
                }
            }
            RingMode::Negacyclic => {
                for j in 0..n {
                    let t_j = ternary.coeffs[j];
                    if t_j == 0 {
                        continue;
                    }
                    if t_j == 1 {
                        for i in 0..n {
                            let a_i = self.coeffs[i] as i32;
                            if a_i == 0 {
                                continue;
                            }
                            let sum_idx = i + j;
                            if sum_idx < n {
                                res[sum_idx] += a_i;
                            } else {
                                res[sum_idx - n] -= a_i;
                            }
                        }
                    } else if t_j == -1 {
                        for i in 0..n {
                            let a_i = self.coeffs[i] as i32;
                            if a_i == 0 {
                                continue;
                            }
                            let sum_idx = i + j;
                            if sum_idx < n {
                                res[sum_idx] -= a_i;
                            } else {
                                res[sum_idx - n] += a_i;
                            }
                        }
                    }
                }
            }
        }

        let out = res.into_iter().map(wrap).collect();
        Self {
            coeffs: out,
            n,
            mode: self.mode,
        }
    }

    /// Closed-form Hensel polynomial inversion modulo 729:
    /// f = 1 + 3*F => f^-1 = sum_{k=0}^5 (-1)^k * 3^k * F^k (mod 729)
    pub fn hensel_inv(&self) -> Option<Self> {
        if self.mode != RingMode::Cyclic {
            return None;
        }
        let n = self.n;
        // Verify f(0) == 1 (mod 3)
        if ((self.coeffs[0] % 3) + 3) % 3 != 1 {
            return None;
        }

        // F = (f - 1) / 3
        let mut f_coeffs = self.coeffs.clone();
        f_coeffs[0] = wrap(f_coeffs[0] as i32 - 1);
        for c in &mut f_coeffs {
            *c = wrap((*c as i32) / 3);
        }
        let f_poly = Self::from_coeffs(&f_coeffs, RingMode::Cyclic);

        // Identity polynomial 1 (constant term 1, rest 0)
        let mut id_coeffs = vec![0i16; n];
        id_coeffs[0] = 1;
        let mut inv = Self::from_coeffs(&id_coeffs, RingMode::Cyclic);

        let mut current_pow = f_poly.clone();
        let mut sign_coeff = -3i32; // (-1)^1 * 3^1

        for _ in 1..=5 {
            let term = current_pow.scalar_mul(sign_coeff);
            inv = inv.add(&term);
            current_pow = current_pow.mul(&f_poly);
            sign_coeff = wrap(sign_coeff * -3) as i32;
        }

        Some(inv)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_poly_add_sub_cyclic() {
        let p1 = TernaryPoly::from_coeffs(&[10, 20, 30], RingMode::Cyclic);
        let p2 = TernaryPoly::from_coeffs(&[5, -5, 360], RingMode::Cyclic);

        let p_sum = p1.add(&p2);
        assert_eq!(p_sum.coeffs, vec![15, 15, wrap(30 + 360)]);

        let p_sub = p1.sub(&p2);
        assert_eq!(p_sub.coeffs, vec![5, 25, wrap(30 - 360)]);
    }

    #[test]
    fn test_poly_mul_cyclic() {
        // (1 + X) * (1 - X) = 1 - X^2 in degree 3
        let p1 = TernaryPoly::from_coeffs(&[1, 1, 0], RingMode::Cyclic);
        let p2 = TernaryPoly::from_coeffs(&[1, -1, 0], RingMode::Cyclic);
        let prod = p1.mul(&p2);
        assert_eq!(prod.coeffs, vec![1, 0, -1]);
    }

    #[test]
    fn test_mul_ternary_matches_mul() {
        let p1 = TernaryPoly::from_coeffs(&[45, -80, 120, -200, 300, 10, -50, 70, 0], RingMode::Cyclic);
        let t = TernaryPoly::from_trits(&[1, 0, -1, 1, -1, 0, 0, 1, -1], RingMode::Cyclic);

        let prod_gen = p1.mul(&t);
        let prod_tern = p1.mul_ternary(&t);

        assert_eq!(prod_gen, prod_tern);
    }

    #[test]
    fn test_hensel_inversion() {
        // f = 1 + 3*X
        let mut f_coeffs = vec![0i16; 9];
        f_coeffs[0] = 1;
        f_coeffs[1] = 3;
        let f = TernaryPoly::from_coeffs(&f_coeffs, RingMode::Cyclic);

        let f_inv = f.hensel_inv().expect("Hensel inversion failed");
        let prod = f.mul(&f_inv);

        // Product should be identically 1 (coeffs[0] == 1, rest == 0)
        let mut expected = vec![0i16; 9];
        expected[0] = 1;
        assert_eq!(prod.coeffs, expected);
    }
}
