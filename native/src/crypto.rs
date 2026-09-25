//! Experimental Ternary Lattice Polynomial Arithmetic & Research Prototype
//!
//! NOTE: This module is an algebraic research prototype demonstrating polynomial
//! ring convolution and ternary modular reduction over Z_q[X]/(X^N - 1).
//! It is NOT a production-hardened Post-Quantum KEM and must NOT be used to generate
//! security-critical cryptographic keys. Key sampling uses deterministic xorshift
//! for reproducibility, which is not constant-time or side-channel resistant.

use crate::poly::{RingMode, TernaryPoly};
use crate::ternary::wrap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NtruPreset {
    Toy,         // N = 3
    Embedded9,   // N = 9
    Embedded27,  // N = 27
    Medium81,    // N = 81
    Research243, // N = 243 (algebraic research dimension)
    Research729, // N = 729 (algebraic research dimension)
}

impl NtruPreset {
    pub fn params(&self) -> (usize, usize) {
        match self {
            NtruPreset::Toy => (3, 1),
            NtruPreset::Embedded9 => (9, 2),
            NtruPreset::Embedded27 => (27, 5),
            NtruPreset::Medium81 => (81, 14),
            NtruPreset::Research243 => (243, 40),
            NtruPreset::Research729 => (729, 120),
        }
    }
}


pub struct NtruKeyPair {
    pub pub_key: TernaryPoly,
    pub priv_f: TernaryPoly,
    pub priv_f_inv: TernaryPoly,
    pub preset: NtruPreset,
}

/// Simple fast PRNG (LCG / xorshift) for deterministic testing and reproducible key generation
pub struct LcgRng {
    state: u64,
}

impl LcgRng {
    pub fn new(seed: u64) -> Self {
        Self {
            state: seed.wrapping_add(0x9e3779b97f4a7c15),
        }
    }

    #[inline(always)]
    pub fn next_u32(&mut self) -> u32 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 7;
        self.state ^= self.state << 17;
        self.state as u32
    }

    pub fn random_trit(&mut self) -> i8 {
        match self.next_u32() % 3 {
            0 => 0,
            1 => 1,
            _ => -1,
        }
    }

    pub fn random_ternary_poly(&mut self, n: usize, mode: RingMode) -> TernaryPoly {
        let mut trits = Vec::with_capacity(n);
        for _ in 0..n {
            trits.push(self.random_trit());
        }
        TernaryPoly::from_trits(&trits, mode)
    }

    pub fn random_fixed_weight_poly(&mut self, n: usize, d: usize, mode: RingMode) -> TernaryPoly {
        let mut coeffs = vec![0i16; n];
        let mut count_pos = 0;
        let mut count_neg = 0;

        while count_pos < d {
            let idx = (self.next_u32() as usize) % n;
            if coeffs[idx] == 0 {
                coeffs[idx] = 1;
                count_pos += 1;
            }
        }
        while count_neg < d {
            let idx = (self.next_u32() as usize) % n;
            if coeffs[idx] == 0 {
                coeffs[idx] = -1;
                count_neg += 1;
            }
        }
        TernaryPoly::from_coeffs(&coeffs, mode)
    }
}

pub struct TernaryNtru;

impl TernaryNtru {
    /// Generate NTRU Key Pair for a given preset
    pub fn keygen(preset: NtruPreset, seed: u64) -> NtruKeyPair {
        let (n, d) = preset.params();
        let mut rng = LcgRng::new(seed);

        loop {
            // Sample F ternary with fixed weight d
            let mut f_coeffs = vec![0i16; n];
            let f_poly_tern = rng.random_fixed_weight_poly(n, d, RingMode::Cyclic);

            // f = 1 + 3*F
            f_coeffs[0] = 1;
            for i in 0..n {
                f_coeffs[i] = wrap(f_coeffs[i] as i32 + 3 * f_poly_tern.coeffs[i] as i32);
            }
            let priv_f = TernaryPoly::from_coeffs(&f_coeffs, RingMode::Cyclic);

            if let Some(priv_f_inv) = priv_f.hensel_inv() {
                let g = rng.random_fixed_weight_poly(n, d, RingMode::Cyclic);
                // h = 3 * f_inv * g (mod 729)
                let f_inv_g = priv_f_inv.mul_ternary(&g);
                let pub_key = f_inv_g.scalar_mul(3);

                return NtruKeyPair {
                    pub_key,
                    priv_f,
                    priv_f_inv,
                    preset,
                };
            }
        }
    }

    /// Encrypt a ternary message m in {-1, 0, 1}^N
    pub fn encrypt(pub_key: &TernaryPoly, msg: &[i8], seed: u64) -> TernaryPoly {
        let n = pub_key.n;
        let (_, d) = match n {
            3 => NtruPreset::Toy.params(),
            9 => NtruPreset::Embedded9.params(),
            27 => NtruPreset::Embedded27.params(),
            81 => NtruPreset::Medium81.params(),
            243 => NtruPreset::Research243.params(),
            _ => NtruPreset::Research729.params(),
        };

        let mut rng = LcgRng::new(seed);
        let r = rng.random_fixed_weight_poly(n, d, RingMode::Cyclic);
        let m = TernaryPoly::from_trits(msg, RingMode::Cyclic);

        // e = h * r + m (mod 729)
        let hr = pub_key.mul_ternary(&r);
        hr.add(&m)
    }

    /// Decrypt ciphertext to recover ternary message m in {-1, 0, 1}^N
    pub fn decrypt(key_pair: &NtruKeyPair, ciphertext: &TernaryPoly) -> Vec<i8> {
        let n = key_pair.pub_key.n;
        // a = f * e (mod 729)
        let a = key_pair.priv_f.mul(ciphertext);

        // m = a mod 3
        let mut m = Vec::with_capacity(n);
        for &coeff in &a.coeffs {
            let r = ((coeff % 3) + 3) % 3;
            let trit = match r {
                0 => 0,
                1 => 1,
                _ => -1,
            };
            m.push(trit);
        }
        m
    }
}

// ---------------------------------------------------------------------------
// Ternary Ring-LWE KEM (Negacyclic Ring X^N + 1)
// ---------------------------------------------------------------------------

pub struct RingLweKem;

impl RingLweKem {
    /// Shared key exchange over negacyclic ring
    pub fn exchange(n: usize, seed: u64) -> (Vec<i8>, Vec<i8>) {
        let mut rng = LcgRng::new(seed);
        // Shared random polynomial a in R_q
        let a = rng.random_fixed_weight_poly(n, n / 4, RingMode::Negacyclic);

        // Alice secret s_a and error e_a
        let s_a = rng.random_fixed_weight_poly(n, n / 6, RingMode::Negacyclic);
        let e_a = rng.random_fixed_weight_poly(n, n / 6, RingMode::Negacyclic);
        // p_a = a * s_a + 3 * e_a (mod 729)
        let p_a = a.mul_ternary(&s_a).add(&e_a.scalar_mul(3));

        // Bob secret s_b and error e_b
        let s_b = rng.random_fixed_weight_poly(n, n / 6, RingMode::Negacyclic);
        let e_b = rng.random_fixed_weight_poly(n, n / 6, RingMode::Negacyclic);
        // p_b = a * s_b + 3 * e_b (mod 729)
        let p_b = a.mul_ternary(&s_b).add(&e_b.scalar_mul(3));

        // Alice computes key_a = p_b * s_a = a*s_b*s_a + 3*e_b*s_a
        let key_a_poly = p_b.mul_ternary(&s_a);
        // Bob computes key_b = p_a * s_b = a*s_a*s_b + 3*e_a*s_b
        let key_b_poly = p_a.mul_ternary(&s_b);

        // Reduce modulo 3 to eliminate multiple of 3 error term
        let mut key_a = Vec::with_capacity(n);
        let mut key_b = Vec::with_capacity(n);
        for i in 0..n {
            let ra = ((key_a_poly.coeffs[i] % 3) + 3) % 3;
            let rb = ((key_b_poly.coeffs[i] % 3) + 3) % 3;
            key_a.push(if ra == 1 { 1 } else if ra == 2 { -1 } else { 0 });
            key_b.push(if rb == 1 { 1 } else if rb == 2 { -1 } else { 0 });
        }

        (key_a, key_b)
    }
}

// ---------------------------------------------------------------------------
// Non-Linear KDF & 9-Lane MAC Authentication Digest
// ---------------------------------------------------------------------------

pub const SBOX_9: [i8; 9] = [1, -1, 0, 0, 1, -1, -1, 0, 1];

/// Non-linear Rule 110 evolution step for balanced ternary trits
#[inline(always)]
pub fn rule110_step(l: i8, c: i8, r: i8) -> i8 {
    let pat = (l + 1) * 9 + (c + 1) * 3 + (r + 1);
    match pat {
        0 => 0,  // --- -> 0
        1 => 1,  // --0 -> +
        2 => -1, // --+ -> -
        3 => 1,  // -0- -> +
        4 => 0,  // -00 -> 0
        5 => 1,  // -0+ -> +
        6 => -1, // -+- -> -
        7 => 1,  // -+0 -> +
        8 => 0,  // -++ -> 0
        9 => 0, 10 => -1, 11 => 1, 12 => 1, 13 => 0, 14 => -1, 15 => 0, 16 => 1, 17 => -1,
        18 => 1, 19 => 0, 20 => -1, 21 => -1, 22 => 1, 23 => 0, 24 => 0, 25 => -1, 26 => 1,
        _ => 0,
    }
}

/// 9-lane ternary MAC digest function
pub fn hash_ternary_9(data: &[i8]) -> [i8; 9] {
    let mut state = [0i8; 9];
    for (idx, &t) in data.iter().enumerate() {
        let lane = idx % 9;
        let sbox_val = SBOX_9[((t + state[lane] + 2).rem_euclid(9)) as usize];
        state[lane] = rule110_step(state[(lane + 8) % 9], state[lane], sbox_val);
    }
    state
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ntru_toy_roundtrip() {
        let kp = TernaryNtru::keygen(NtruPreset::Toy, 42);
        let msg = vec![1, -1, 0];
        let ct = TernaryNtru::encrypt(&kp.pub_key, &msg, 100);
        let dec = TernaryNtru::decrypt(&kp, &ct);
        assert_eq!(dec, msg);
    }

    #[test]
    fn test_ntru_embedded27_roundtrip() {
        let kp = TernaryNtru::keygen(NtruPreset::Embedded27, 1337);
        let mut msg = vec![0i8; 27];
        msg[0] = 1;
        msg[1] = -1;
        msg[2] = 1;
        msg[10] = -1;
        msg[26] = 1;

        let ct = TernaryNtru::encrypt(&kp.pub_key, &msg, 9999);
        let dec = TernaryNtru::decrypt(&kp, &ct);
        assert_eq!(dec, msg);
    }

    #[test]
    fn test_ring_lwe_exchange() {
        let (k_a, k_b) = RingLweKem::exchange(9, 777);
        assert_eq!(k_a, k_b);
    }

    #[test]
    fn test_hash_ternary_deterministic() {
        let d = vec![1, -1, 0, 1, 1, 0, -1];
        let h1 = hash_ternary_9(&d);
        let h2 = hash_ternary_9(&d);
        assert_eq!(h1, h2);
    }
}
