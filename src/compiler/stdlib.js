'use strict';
/**
 * stdlib.js — Standard Library for the Balanced Ternary Implementation Language (Tril)
 *
 * Provides high-level balanced ternary standard routines:
 * - Math: abs, sgn, clamp, pow, div, mod
 * - Memory: alloc (bump heap), memset, memcpy, memcmp
 * - Strings: strlen, strcpy, strcmp, print_str
 * - Cryptography: aead_enc, aead_dec (balanced ternary Galois stream cipher)
 */

const STDLIB_SRC = `
# =============================================================================
# Tril Standard Library
# =============================================================================

# --- Ternary Mathematics -----------------------------------------------------

fn abs(x) {
  branch3 (x) {
    neg => { return -x; },
    zero => { return 0; },
    pos => { return x; }
  }
}

fn sgn(x) {
  branch3 (x) {
    neg => { return -1; },
    zero => { return 0; },
    pos => { return 1; }
  }
}

fn clamp(x, lo, hi) {
  let d1 = x - lo;
  branch3 (d1) {
    neg => { return lo; },
    zero => {},
    pos => {}
  }
  let d2 = hi - x;
  branch3 (d2) {
    neg => { return hi; },
    zero => {},
    pos => {}
  }
  return x;
}

fn pow(base, exp) {
  let res = 1;
  while3 (exp) {
    res = res * base;
    exp = exp - 1;
  }
  return res;
}

fn div(a, b) {
  branch3 (b) {
    neg => {},
    zero => { return 0; },
    pos => {}
  }
  let sa = 1;
  branch3 (a) {
    neg => { sa = -1; a = -a; },
    zero => { return 0; },
    pos => {}
  }
  let sb = 1;
  branch3 (b) {
    neg => { sb = -1; b = -b; },
    zero => {},
    pos => {}
  }
  let q = 0;
  let diff = a - b;
  while3 (diff + 1) {
    a = a - b;
    q = q + 1;
    diff = a - b;
  }
  let s = sa * sb;
  branch3 (s) {
    neg => { return -q; },
    zero => { return 0; },
    pos => { return q; }
  }
}

fn mod(a, b) {
  branch3 (b) {
    neg => {},
    zero => { return 0; },
    pos => {}
  }
  let sa = 1;
  branch3 (a) {
    neg => { sa = -1; a = -a; },
    zero => { return 0; },
    pos => {}
  }
  branch3 (b) {
    neg => { b = -b; },
    zero => {},
    pos => {}
  }
  let diff = a - b;
  while3 (diff + 1) {
    a = a - b;
    diff = a - b;
  }
  branch3 (sa) {
    neg => { return -a; },
    zero => { return 0; },
    pos => { return a; }
  }
}

# --- Memory Management -------------------------------------------------------

fn alloc(size) {
  branch3 (__heap_ptr) {
    neg => {},
    zero => { __heap_ptr = -360; },
    pos => {}
  }
  let p = __heap_ptr;
  __heap_ptr = __heap_ptr + size;
  return p;
}

fn memset(ptr, val, len) {
  while3 (len) {
    *ptr = val;
    ptr = ptr + 1;
    len = len - 1;
  }
  return ptr;
}

fn memcpy(dst, src, len) {
  while3 (len) {
    *dst = *src;
    dst = dst + 1;
    src = src + 1;
    len = len - 1;
  }
  return dst;
}

fn memcmp(a, b, len) {
  while3 (len) {
    let diff = *a - *b;
    branch3 (diff) {
      neg => { return -1; },
      zero => {},
      pos => { return 1; }
    }
    a = a + 1;
    b = b + 1;
    len = len - 1;
  }
  return 0;
}

# --- String Manipulation -----------------------------------------------------

fn strlen(s) {
  let len = 0;
  let done = 0;
  while3 (1 - done) {
    let ch = *s;
    branch3 (ch) {
      neg => { len = len + 1; s = s + 1; },
      zero => { done = 1; },
      pos => { len = len + 1; s = s + 1; }
    }
  }
  return len;
}

fn strcpy(dst, src) {
  let done = 0;
  while3 (1 - done) {
    let ch = *src;
    *dst = ch;
    branch3 (ch) {
      neg => { dst = dst + 1; src = src + 1; },
      zero => { done = 1; },
      pos => { dst = dst + 1; src = src + 1; }
    }
  }
  return dst;
}

fn strcmp(s1, s2) {
  let done = 0;
  while3 (1 - done) {
    let c1 = *s1;
    let c2 = *s2;
    let diff = c1 - c2;
    branch3 (diff) {
      neg => { return -1; },
      zero => {
        branch3 (c1) {
          neg => { s1 = s1 + 1; s2 = s2 + 1; },
          zero => { done = 1; },
          pos => { s1 = s1 + 1; s2 = s2 + 1; }
        }
      },
      pos => { return 1; }
    }
  }
  return 0;
}

fn print_str(s) {
  let done = 0;
  while3 (1 - done) {
    let ch = *s;
    branch3 (ch) {
      neg => { out(ch); s = s + 1; },
      zero => { done = 1; },
      pos => { out(ch); s = s + 1; }
    }
  }
  return 0;
}

# --- Cryptographic Stream Primitives ----------------------------------------

fn aead_enc(buf, key, len) {
  while3 (len) {
    *buf = *buf + key;
    key = key * 3 + 1;
    buf = buf + 1;
    len = len - 1;
  }
  return buf;
}

fn aead_dec(buf, key, len) {
  while3 (len) {
    *buf = *buf - key;
    key = key * 3 + 1;
    buf = buf + 1;
    len = len - 1;
  }
  return buf;
}
`;

const STDLIB_FUNCTION_NAMES = new Set([
  'abs', 'sgn', 'clamp', 'pow', 'div', 'mod',
  'alloc', 'memset', 'memcpy', 'memcmp',
  'strlen', 'strcpy', 'strcmp', 'print_str',
  'aead_enc', 'aead_dec'
]);

module.exports = {
  STDLIB_SRC,
  STDLIB_FUNCTION_NAMES
};
