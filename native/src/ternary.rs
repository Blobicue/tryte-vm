//! Balanced Ternary Arithmetic & Logic Primitives
//! 100% mathematical parity with `src/ternary.js` and Lean 4 `TryteArsenal.lean`.

pub const RADIX: i32 = 3;
pub const TRITS_PER_TRYTE: usize = 6;
pub const TRYTE_STATES: i32 = 729;
pub const TRYTE_MIN: i32 = -364;
pub const TRYTE_MAX: i32 = 364;

/// Wrap integer into balanced tryte range [-364..+364]
#[inline(always)]
pub fn wrap(val: i32) -> i16 {
    let shifted = val - TRYTE_MIN;
    let rem = ((shifted % TRYTE_STATES) + TRYTE_STATES) % TRYTE_STATES;
    (rem + TRYTE_MIN) as i16
}

/// Convert integer to 6 balanced trits in {-1, 0, 1}, least-significant first.
pub fn to_trits(val: i16) -> [i8; 6] {
    let mut w = wrap(val as i32) as i32;
    let mut out = [0i8; 6];
    for i in 0..6 {
        let rem = ((w % 3) + 3) % 3;
        match rem {
            0 => {
                out[i] = 0;
                w /= 3;
            }
            1 => {
                out[i] = 1;
                w = (w - 1) / 3;
            }
            2 => {
                out[i] = -1;
                w = (w + 1) / 3;
            }
            _ => unreachable!(),
        }
    }
    out
}

/// Convert slice of balanced trits in {-1, 0, 1} to integer.
pub fn from_trits(trits: &[i8]) -> i16 {
    let mut sum: i32 = 0;
    let mut power: i32 = 1;
    for &t in trits.iter().take(6) {
        sum += (t as i32) * power;
        power *= 3;
    }
    wrap(sum)
}

#[inline(always)]
pub fn add(a: i16, b: i16) -> i16 {
    wrap(a as i32 + b as i32)
}

#[inline(always)]
pub fn sub(a: i16, b: i16) -> i16 {
    wrap(a as i32 - b as i32)
}

#[inline(always)]
pub fn mul(a: i16, b: i16) -> i16 {
    wrap(a as i32 * b as i32)
}

#[inline(always)]
pub fn neg(a: i16) -> i16 {
    wrap(-(a as i32))
}

/// Sign of tryte: determined by the leading non-zero trit
#[inline(always)]
pub fn sign(a: i16) -> i8 {
    let trits = to_trits(a);
    for &t in trits.iter().rev() {
        if t != 0 {
            return t;
        }
    }
    0
}

/// Shift left n trits (multiply by 3^n, wrapping)
pub fn shift_left(a: i16, n: i32) -> i16 {
    if n < 0 {
        return shift_right(a, -n);
    }
    if n >= 6 {
        return 0;
    }
    if n == 0 {
        return wrap(a as i32);
    }
    let p = 3i32.pow(n as u32);
    wrap(wrap(a as i32) as i32 * p)
}

/// Shift right n trits (drops low trits, nearest rounding)
pub fn shift_right(a: i16, n: i32) -> i16 {
    if n < 0 {
        return shift_left(a, -n);
    }
    if n >= 6 {
        return 0;
    }
    if n == 0 {
        return wrap(a as i32);
    }
    let t = to_trits(a);
    let mut kept = [0i8; 6];
    let n_idx = n as usize;
    for i in 0..(6 - n_idx) {
        kept[i] = t[i + n_idx];
    }
    from_trits(&kept)
}

/// 1-trit MIN (AND-like lattice op)
#[inline(always)]
pub fn trit_min(x: i8, y: i8) -> i8 {
    x.min(y)
}

/// 1-trit MAX (OR-like lattice op)
#[inline(always)]
pub fn trit_max(x: i8, y: i8) -> i8 {
    x.max(y)
}

/// 1-trit clamped sum
#[inline(always)]
pub fn trit_csum(x: i8, y: i8) -> i8 {
    (x + y).clamp(-1, 1)
}

/// 6-trit bitwise MIN
pub fn t_min(a: i16, b: i16) -> i16 {
    let ta = to_trits(a);
    let tb = to_trits(b);
    let mut out = [0i8; 6];
    for i in 0..6 {
        out[i] = trit_min(ta[i], tb[i]);
    }
    from_trits(&out)
}

/// 6-trit bitwise MAX
pub fn t_max(a: i16, b: i16) -> i16 {
    let ta = to_trits(a);
    let tb = to_trits(b);
    let mut out = [0i8; 6];
    for i in 0..6 {
        out[i] = trit_max(ta[i], tb[i]);
    }
    from_trits(&out)
}

/// 6-trit bitwise clamped sum
pub fn t_csum(a: i16, b: i16) -> i16 {
    let ta = to_trits(a);
    let tb = to_trits(b);
    let mut out = [0i8; 6];
    for i in 0..6 {
        out[i] = trit_csum(ta[i], tb[i]);
    }
    from_trits(&out)
}

/// Reconfigurable ternary gate TGATE:
/// Control trit = -1: NEG(a)
/// Control trit =  0: MIN(a, b)
/// Control trit = +1: MAX(a, b)
pub fn t_gate(a: i16, b: i16, c: i16) -> i16 {
    let ta = to_trits(a);
    let tb = to_trits(b);
    let tc = to_trits(c);
    let mut out = [0i8; 6];
    for i in 0..6 {
        out[i] = match tc[i] {
            -1 => -ta[i],
            1 => trit_max(ta[i], tb[i]),
            _ => trit_min(ta[i], tb[i]),
        };
    }
    from_trits(&out)
}

/// 9-entry truth table evaluation matching TOP instruction
pub fn t_table(tbl: &[i16], a: i16, b: i16) -> i16 {
    let ta = to_trits(a);
    let tb = to_trits(b);
    let mut out = [0i8; 6];
    for i in 0..6 {
        let idx = (ta[i] + 1) * 3 + (tb[i] + 1);
        let cell = tbl.get(idx as usize).copied().unwrap_or(0);
        let entry_trits = to_trits(cell);
        out[i] = entry_trits[0]; // Lowest trit of table entry
    }
    from_trits(&out)
}

/// 27-entry truth table evaluation with carry ripple matching TOPC instruction
pub fn t_table_c(tbl: &[i16], a: i16, b: i16) -> i16 {
    let ta = to_trits(a);
    let tb = to_trits(b);
    let mut out = [0i8; 6];
    let mut c: i8 = 0;
    for i in 0..6 {
        let idx = ((ta[i] as i32 + 1) * 9 + (tb[i] as i32 + 1) * 3 + (c as i32 + 1)) as usize;
        let cell = tbl.get(idx).copied().unwrap_or(0);
        let cell_trits = to_trits(wrap(cell as i32));
        out[i] = cell_trits[0];
        c = cell_trits[1];
    }
    from_trits(&out)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wrap_bounds() {
        assert_eq!(wrap(0), 0);
        assert_eq!(wrap(364), 364);
        assert_eq!(wrap(-364), -364);
        assert_eq!(wrap(365), -364);
        assert_eq!(wrap(-365), 364);
        assert_eq!(wrap(729), 0);
    }

    #[test]
    fn test_trits_roundtrip() {
        for v in -364..=364 {
            let trits = to_trits(v as i16);
            let recovered = from_trits(&trits);
            assert_eq!(recovered, v as i16, "Mismatch at {}", v);
        }
    }

    #[test]
    fn test_arithmetic_ops() {
        assert_eq!(add(10, 20), 30);
        assert_eq!(add(364, 1), -364);
        assert_eq!(sub(10, 20), -10);
        assert_eq!(sub(-364, 1), 364);
        assert_eq!(mul(10, 20), 200);
        assert_eq!(neg(45), -45);
        assert_eq!(neg(-45), 45);
    }

    #[test]
    fn test_sign() {
        assert_eq!(sign(0), 0);
        assert_eq!(sign(1), 1);
        assert_eq!(sign(-1), -1);
        assert_eq!(sign(364), 1);
        assert_eq!(sign(-364), -1);
    }

    #[test]
    fn test_shifts() {
        assert_eq!(shift_left(1, 1), 3);
        assert_eq!(shift_left(1, 2), 9);
        assert_eq!(shift_right(9, 1), 3);
        assert_eq!(shift_right(3, 1), 1);
        assert_eq!(shift_left(1, 6), 0);
        assert_eq!(shift_right(1, 6), 0);
    }

    #[test]
    fn test_tgate_modes() {
        assert_eq!(t_gate(10, 20, 0), t_min(10, 20));
        assert_eq!(t_gate(10, 20, 364), t_max(10, 20)); // all trits +1
        assert_eq!(t_gate(10, 20, -364), neg(10));      // all trits -1
    }
}
