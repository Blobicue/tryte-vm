"""Independent verification of the Google AI Mode 'tryte ALU' conversation.
Nothing here reuses Google's code. Gates are primitives; everything else is built from them.
"""
import itertools, sys

FAIL = []
def check(name, cond, detail=""):
    (print(f"  [PASS] {name}") if cond else (FAIL.append(name), print(f"  [FAIL] {name}  {detail}")))

# ---------------------------------------------------------------- 0. INSTRUMENT CHECK
print("\n=== 0. INSTRUMENT SELF-TEST (hand-computed values) ===")
def NOT(a): return 1 - a
def AND(a, b): return 1 if (a == 1 and b == 1) else 0
def OR(a, b):  return 1 if (a == 1 or  b == 1) else 0
check("NOT(0)=1", NOT(0) == 1)
check("AND(1,0)=0", AND(1, 0) == 0)
check("OR(1,0)=1", OR(1, 0) == 1)
check("harness catches a wrong claim", (lambda: AND(1,1) == 0)() is False)

# ---------------------------------------------------------------- 1. TRIT -> GATE MAP
print("\n=== 1. TRIT->GATE MAPPING (-1=NOT, 0=AND, +1=OR) ===")
def trit_gate(t, x, y):
    if t == -1: return NOT(x)          # ignores y
    if t ==  0: return AND(x, y)
    if t == +1: return OR(x, y)
    raise ValueError(t)
# turn-5 table rows published in the transcript
pub = [(-1,0,1,1), (-1,1,0,0), (0,0,0,0), (0,1,1,1), (1,0,1,1), (1,1,0,1)]
check("all 6 published trit-gate rows reproduce",
      all(trit_gate(t,x,y) == o for t,x,y,o in pub))

# ---------------------------------------------------------------- 2. XOR IDENTITY
print("\n=== 2. XOR IDENTITY  (X OR Y) AND NOT(X AND Y) ===")
def xor_from_gates(x, y): return AND(OR(x, y), NOT(AND(x, y)))
check("equals X^Y for all 4 inputs",
      all(xor_from_gates(x,y) == (x ^ y) for x,y in itertools.product((0,1),repeat=2)))

# ---------------------------------------------------------------- 3. HALF ADDER
print("\n=== 3. HALF-ADDER via 2-tryte pipeline [+1,0] then [-1,0] ===")
def half_adder(x, y):
    t1_1 = trit_gate(+1, x, y)            # OR
    t1_2 = trit_gate( 0, x, y)            # AND  -> CARRY
    t2_1 = trit_gate(-1, t1_2, 0)         # NOT
    t2_2 = trit_gate( 0, t1_1, t2_1)      # AND  -> SUM
    return t2_2, t1_2
ok = True
for x, y in itertools.product((0,1), repeat=2):
    s, c = half_adder(x, y)
    if (s, c) != ((x + y) & 1, (x + y) >> 1): ok = False
check("Sum/Carry match integer addition, all 4 cases", ok)

# ---------------------------------------------------------------- 4. FULL ADDER
print("\n=== 4. FULL-ADDER, 3-stage chain, all 8 permutations ===")
def full_adder(x, y, cin):
    s1, c1 = half_adder(x, y)
    s2, c2 = half_adder(s1, cin)
    return s2, trit_gate(+1, c1, c2)      # OR of the two carries
ok = True
for x, y, c in itertools.product((0,1), repeat=3):
    s, co = full_adder(x, y, c)
    if (s, co) != ((x+y+c) & 1, (x+y+c) >> 1): ok = False
check("Sum/Cout match integer addition, all 8 cases", ok)

# ---------------------------------------------------------------- 5. 4-BIT ALU
print("\n=== 5. 4-BIT TRYTE ALU vs ground truth (1536 cases) ===")
def alu4(x, y, cin, s):
    """Built ONLY from NOT/AND/OR. x,y are ints 0..15."""
    xb = [(x >> i) & 1 for i in range(4)]
    yb = [(y >> i) & 1 for i in range(4)]
    carry, out = cin, 0
    for i in range(4):                                     # LSB -> MSB
        st1_or  = trit_gate(+1, xb[i], yb[i])
        st1_and = trit_gate( 0, xb[i], yb[i])
        st2_xor = trit_gate( 0, st1_or, trit_gate(-1, st1_and, 0))
        st3_sum = xor_from_gates(st2_xor, carry)
        cout    = trit_gate(+1, st1_and, trit_gate(0, st2_xor, carry))
        bit = {-1: st2_xor, 0: st1_and, 1: st3_sum}[s]
        out |= bit << i
        carry = cout
    return out, (carry if s == 1 else 0), (1 if out == 0 else 0)

bad = []
for x, y, cin, s in itertools.product(range(16), range(16), (0,1), (-1,0,1)):
    o, co, z = alu4(x, y, cin, s)
    if s == -1: exp_o, exp_c = x ^ y, 0
    elif s == 0: exp_o, exp_c = x & y, 0
    else:        t = x + y + cin; exp_o, exp_c = t & 15, t >> 4
    if (o, co, z) != (exp_o, exp_c, 1 if exp_o == 0 else 0):
        bad.append((x, y, cin, s, o, exp_o))
check(f"all {16*16*2*3} cases match x^y / x&y / x+y+cin", not bad, str(bad[:3]))

# ---------------------------------------------------------------- 6. GOOGLE'S 6 CLAIMS
print("\n=== 6. GOOGLE'S SIX PUBLISHED TEST ROWS ===")
rows = [("Bitwise XOR",5,3,0,-1,0b0110,0,0), ("Bitwise AND",5,3,0,0,0b0001,0,0),
        ("4-Bit Addition",5,3,0,1,0b1000,0,0), ("Addition Overflow",13,5,0,1,0b0010,1,0),
        ("Addition with Cin",7,8,1,1,0b0000,1,1), ("Zero Flag Match",5,5,0,-1,0b0000,0,1)]
for n,x,y,c,s,eo,ec,ez in rows:
    got = alu4(x,y,c,s)
    check(f"{n}: {x},{y},cin={c},S={s:+d} -> {eo:04b} C={ec} Z={ez}", got == (eo,ec,ez), f"got {got}")

# ---------------------------------------------------------------- 7. VERILOG RTL SEMANTICS
print("\n=== 7. VERILOG RTL (transcribed from extracted module) ===")
def verilog_alu(x, y, c_in, s_trit):
    st1_or  = [( (x>>i)&1 ) | ( (y>>i)&1 ) for i in range(4)]
    st1_and = [( (x>>i)&1 ) & ( (y>>i)&1 ) for i in range(4)]
    st2_xor = [st1_or[i] & (~st1_and[i] & 1) for i in range(4)]
    rc = [c_in] + [0]*4
    st3 = []
    for i in range(4):
        st3.append(st2_xor[i] ^ rc[i])
        rc[i+1] = st1_and[i] | (st2_xor[i] & rc[i])
    def pack(b): return sum(v << i for i, v in enumerate(b))
    mux, cout = {-1:(pack(st2_xor),0), 0:(pack(st1_and),0), 1:(pack(st3),rc[4])}[s_trit]
    return mux, cout, (1 if mux == 0 else 0)
check("Verilog RTL == my primitive model, all 1536 cases",
      all(verilog_alu(x,y,c,s) == alu4(x,y,c,s)
          for x,y,c,s in itertools.product(range(16),range(16),(0,1),(-1,0,1))))

# ---------------------------------------------------------------- 8. COUNTING CLAIMS
print("\n=== 8. COUNTING CLAIMS ===")
check("6-trit tryte = 729 values (3^6); byte = 256 (2^8)", 3**6 == 729 and 2**8 == 256)
check("3-trit tryte = 27 configurations", 3**3 == 27)
check("729 x 729 = 531,441 (arithmetic)", 729*729 == 531441)
# do configurations equal DISTINCT functions once cascaded?
def cascade(t1, t2, x, y): return trit_gate(t2, trit_gate(t1, x, y), y)
funcs = {tuple(cascade(a,b,x,y) for x,y in itertools.product((0,1),repeat=2))
         for a in (-1,0,1) for b in (-1,0,1)}
print(f"    -> 2-stage 1-trit cascade: 9 configurations collapse to {len(funcs)} distinct functions")
check("'unique networks' overcounts distinct behaviour", len(funcs) < 9)

# ---------------------------------------------------------------- 9. VHDL TESTBENCH VECTORS
print("\n=== 9. VHDL TESTBENCH VECTORS (16-bit, signed flags) ===")
def flags16(a, b, cin=0):
    t = a + b + cin; r = t & 0xFFFF
    sa, sb, sr = (a>>15)&1, (b>>15)&1, (r>>15)&1
    return r, (t >> 16) & 1, sr, (1 if sa == sb and sr != sa else 0)
r,c,n,v = flags16(0xFFFF, 0x0001)
check("0xFFFF + 0x0001 = 0x0000 with C=1 (max carry propagation)", (r,c) == (0x0000,1), f"{r:04X} C={c}")
check("0x01A0 AND 0x00F0 = 0x00A0", (0x01A0 & 0x00F0) == 0x00A0)
r,c,n,v = flags16(0x7000, 0x2000)
check("0x7000 + 0x2000 = 0x9000 with V=1, N=1", (r,n,v) == (0x9000,1,1), f"{r:04X} N={n} V={v}")
r,c,n,v = flags16(0x7FFF, 0x0001)
check("0x7FFF + 0x0001 overflows signed (V=1, N=1)", (v,n) == (1,1))

print("\n" + "="*60)
print(f"RESULT: {'ALL CHECKS PASSED' if not FAIL else str(len(FAIL)) + ' FAILED: ' + ', '.join(FAIL)}")
print("="*60)
sys.exit(1 if FAIL else 0)
