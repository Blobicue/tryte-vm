`ifndef TRYTE_PKG_SV
`define TRYTE_PKG_SV

  localparam int TRITS_PER_TRYTE = 6;
  localparam int TRYTE_STATES    = 729;
  localparam int TRYTE_MAX       = 364;
  localparam int TRYTE_MIN       = -364;

  // Dual-rail trit: bit 1 is negative rail (n), bit 0 is positive rail (p)
  // 2'b00: 0
  // 2'b01: +1 (p=1, n=0)
  // 2'b10: -1 (p=0, n=1)
  // 2'b11: ILLEGAL_FAULT
  typedef logic [1:0] trit_t;

  // 6-trit balanced tryte word (12 bits)
  // bits [1:0] is trit 0 (LSB), bits [11:10] is trit 5 (MSB)
  typedef logic [11:0] tryte_t;

  localparam trit_t TRIT_ZERO  = 2'b00;
  localparam trit_t TRIT_POS   = 2'b01;
  localparam trit_t TRIT_NEG   = 2'b10;
  localparam trit_t TRIT_FAULT = 2'b11;

  localparam tryte_t TRYTE_ZERO_VAL = 12'b000000000000;

  // Extract trit i (0..5) from tryte
  function automatic trit_t get_trit(input tryte_t t, input integer i);
    get_trit = t[2*i +: 2];
  endfunction

  // Convert an integer in [-1..1] to trit_t
  function automatic trit_t int_to_trit(input integer v);
    if (v > 0) int_to_trit = TRIT_POS;
    else if (v < 0) int_to_trit = TRIT_NEG;
    else int_to_trit = TRIT_ZERO;
  endfunction

  // Convert trit_t to integer in [-1..1]
  function automatic integer trit_to_int(input trit_t t);
    if (t[0] && !t[1]) trit_to_int = 1;
    else if (t[1] && !t[0]) trit_to_int = -1;
    else trit_to_int = 0;
  endfunction

  // Negation of a single trit: swap rails (zero gates)
  function automatic trit_t trit_neg(input trit_t t);
    trit_neg[0] = t[1];
    trit_neg[1] = t[0];
  endfunction

  // Negation of a 6-trit tryte: swap rails across all trits (zero gates)
  function automatic tryte_t tryte_neg(input tryte_t t);
    for (int i = 0; i < 6; i++) begin
      tryte_neg[2*i]   = t[2*i+1];
      tryte_neg[2*i+1] = t[2*i];
    end
  endfunction

  // Sign of a tryte: sign of the leading (most significant) non-zero trit
  // Returns TRIT_POS (+1), TRIT_NEG (-1), or TRIT_ZERO (0)
  function automatic trit_t tryte_sign(input tryte_t t);
    if (t[11:10] != TRIT_ZERO) tryte_sign = t[11:10];
    else if (t[9:8] != TRIT_ZERO) tryte_sign = t[9:8];
    else if (t[7:6] != TRIT_ZERO) tryte_sign = t[7:6];
    else if (t[5:4] != TRIT_ZERO) tryte_sign = t[5:4];
    else if (t[3:2] != TRIT_ZERO) tryte_sign = t[3:2];
    else if (t[1:0] != TRIT_ZERO) tryte_sign = t[1:0];
    else tryte_sign = TRIT_ZERO;
  endfunction

  // Bijective mapping from balanced tryte [-364..+364] to physical address [0..728]
  // addr_phys = sum_{i=0..5} (t_i + 1) * 3^i
  function automatic [9:0] tryte_to_phys(input tryte_t t);
    logic [9:0] u0, u1, u2, u3, u4, u5;
    u0 = t[0] ? 10'd2 : (t[1] ? 10'd0 : 10'd1);
    u1 = t[2] ? 10'd2 : (t[3] ? 10'd0 : 10'd1);
    u2 = t[4] ? 10'd2 : (t[5] ? 10'd0 : 10'd1);
    u3 = t[6] ? 10'd2 : (t[7] ? 10'd0 : 10'd1);
    u4 = t[8] ? 10'd2 : (t[9] ? 10'd0 : 10'd1);
    u5 = t[10] ? 10'd2 : (t[11] ? 10'd0 : 10'd1);
    tryte_to_phys = u0 + 10'd3 * u1 + 10'd9 * u2 + 10'd27 * u3 + 10'd81 * u4 + 10'd243 * u5;
  endfunction

  // Bijective mapping from physical address [0..728] to balanced tryte [-364..+364]
  function automatic tryte_t phys_to_tryte(input [9:0] phys);
    logic [9:0] rem;
    logic [1:0] digit;
    rem = phys;
    for (int i = 0; i < 6; i++) begin
      digit = rem % 10'd3;
      rem   = rem / 10'd3;
      if (digit == 2'd2)      phys_to_tryte[2*i +: 2] = TRIT_POS;
      else if (digit == 2'd0) phys_to_tryte[2*i +: 2] = TRIT_NEG;
      else                    phys_to_tryte[2*i +: 2] = TRIT_ZERO;
    end
  endfunction

  // Convert signed integer in [-364..364] to tryte_t
  function automatic tryte_t int_to_tryte(input integer val);
    integer w;
    logic [9:0] phys;
    // Wrap to [-364..364]
    w = ((((val - TRYTE_MIN) % TRYTE_STATES) + TRYTE_STATES) % TRYTE_STATES) + TRYTE_MIN;
    phys = w + 364;
    int_to_tryte = phys_to_tryte(phys);
  endfunction

  // Convert tryte_t to signed integer in [-364..364]
  function automatic integer tryte_to_int(input tryte_t t);
    logic [9:0] phys;
    integer iphys;
    phys = tryte_to_phys(t);
    iphys = phys;
    tryte_to_int = iphys - 364;
  endfunction

  // 1-trit balanced full adder: 3*cout + sum = x + y + cin
  function automatic void trit_full_add(
    input  trit_t x,
    input  trit_t y,
    input  trit_t cin,
    output trit_t cout,
    output trit_t sum
  );
    integer sx, sy, sc, s;
    sx = trit_to_int(x);
    sy = trit_to_int(y);
    sc = trit_to_int(cin);
    s  = sx + sy + sc;
    case (s)
       3: begin cout = TRIT_POS;  sum = TRIT_ZERO; end
       2: begin cout = TRIT_POS;  sum = TRIT_NEG;  end
       1: begin cout = TRIT_ZERO; sum = TRIT_POS;  end
       0: begin cout = TRIT_ZERO; sum = TRIT_ZERO; end
      -1: begin cout = TRIT_ZERO; sum = TRIT_NEG;  end
      -2: begin cout = TRIT_NEG;  sum = TRIT_POS;  end
      -3: begin cout = TRIT_NEG;  sum = TRIT_ZERO; end
      default: begin cout = TRIT_ZERO; sum = TRIT_ZERO; end
    endcase
  endfunction

  // Shift right n trits (rounds to nearest in balanced ternary)
  function automatic tryte_t do_shr(input tryte_t val, input integer n);
    case (n)
       0: do_shr = val;
       1: do_shr = {2'b00, val[11:2]};
       2: do_shr = {4'b0000, val[11:4]};
       3: do_shr = {6'b000000, val[11:6]};
       4: do_shr = {8'b00000000, val[11:8]};
       5: do_shr = {10'b0000000000, val[11:10]};
      -1: do_shr = {val[9:0], 2'b00};
      -2: do_shr = {val[7:0], 4'b0000};
      -3: do_shr = {val[5:0], 6'b000000};
      -4: do_shr = {val[3:0], 8'b00000000};
      -5: do_shr = {val[1:0], 10'b0000000000};
      default: do_shr = TRYTE_ZERO_VAL;
    endcase
  endfunction

  // Shift left n trits (multiplies by 3^n, wrapping)
  function automatic tryte_t do_shl(input tryte_t val, input integer n);
    case (n)
       0: do_shl = val;
       1: do_shl = {val[9:0], 2'b00};
       2: do_shl = {val[7:0], 4'b0000};
       3: do_shl = {val[5:0], 6'b000000};
       4: do_shl = {val[3:0], 8'b00000000};
       5: do_shl = {val[1:0], 10'b0000000000};
      -1: do_shl = {2'b00, val[11:2]};
      -2: do_shl = {4'b0000, val[11:4]};
      -3: do_shl = {6'b000000, val[11:6]};
      -4: do_shl = {8'b00000000, val[11:8]};
      -5: do_shl = {10'b0000000000, val[11:10]};
      default: do_shl = TRYTE_ZERO_VAL;
    endcase
  endfunction

  // 6-trit balanced ripple adder with wrapped carry (drops cout_5)
  function automatic tryte_t tryte_add(input tryte_t a, input tryte_t b);
    trit_t c, nxt_c, s;
    c = TRIT_ZERO;
    for (int i = 0; i < 6; i++) begin
      trit_full_add(a[2*i +: 2], b[2*i +: 2], c, nxt_c, s);
      tryte_add[2*i +: 2] = s;
      c = nxt_c;
    end
  endfunction

  // 6-trit balanced subtraction: a - b = a + neg(b)
  function automatic tryte_t tryte_sub(input tryte_t a, input tryte_t b);
    tryte_sub = tryte_add(a, tryte_neg(b));
  endfunction

`endif // TRYTE_PKG_SV
