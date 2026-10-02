//! tryte-simd — Blazing Fast Native SIMD & Post-Quantum Lattice Crypto Engine for TryteVM

pub mod crypto;
pub mod poly;
pub mod simd;
pub mod ternary;
pub mod vm;

pub use crypto::{NtruKeyPair, NtruPreset, TernaryNtru};
pub use poly::{RingMode, TernaryPoly};
pub use simd::TritVec64;
pub use ternary::wrap;
pub use vm::TryteVM;
