`ifndef TRYTE_ALU_SV
`define TRYTE_ALU_SV

`include "tryte_pkg.sv"

module tryte_alu (

  input  logic [3:0]  alu_op,
  input  tryte_t      src_a,
  input  tryte_t      src_b,
  input  tryte_t      src_c,       // Control register C for TGATE
  output tryte_t      alu_res,
  output trit_t       res_sign     // Sign of result
);

  localparam logic [3:0] ALU_ADD   = 4'd0;
  localparam logic [3:0] ALU_SUB   = 4'd1;
  localparam logic [3:0] ALU_NEG   = 4'd2;
  localparam logic [3:0] ALU_MIN   = 4'd3;
  localparam logic [3:0] ALU_MAX   = 4'd4;
  localparam logic [3:0] ALU_CSUM  = 4'd5;
  localparam logic [3:0] ALU_TGATE = 4'd6;
  localparam logic [3:0] ALU_SHL   = 4'd7;
  localparam logic [3:0] ALU_SHR   = 4'd8;
  localparam logic [3:0] ALU_PASSA = 4'd9;
  localparam logic [3:0] ALU_PASSB = 4'd10;

  function automatic trit_t trit_min(input trit_t x, input trit_t y);
    trit_min[0] = x[0] & y[0];
    trit_min[1] = x[1] | y[1];
  endfunction

  function automatic trit_t trit_max(input trit_t x, input trit_t y);
    trit_max[0] = x[0] | y[0];
    trit_max[1] = x[1] & y[1];
  endfunction

  function automatic trit_t trit_csum(input trit_t x, input trit_t y);
    trit_csum[0] = (x[0] & ~y[1]) | (y[0] & ~x[1]);
    trit_csum[1] = (x[1] & ~y[0]) | (y[1] & ~x[0]);
  endfunction

  tryte_t res_comb;
  integer shift_amt;
  trit_t cur_c;

  always_comb begin
    cur_c     = TRIT_ZERO;
    shift_amt = tryte_to_int(src_b);
    case (alu_op)
      ALU_ADD:   res_comb = tryte_add(src_a, src_b);
      ALU_SUB:   res_comb = tryte_sub(src_a, src_b);
      ALU_NEG:   res_comb = tryte_neg(src_a);

      ALU_MIN: begin
        for (int i = 0; i < 6; i++) begin
          res_comb[2*i +: 2] = trit_min(src_a[2*i +: 2], src_b[2*i +: 2]);
        end
      end

      ALU_MAX: begin
        for (int i = 0; i < 6; i++) begin
          res_comb[2*i +: 2] = trit_max(src_a[2*i +: 2], src_b[2*i +: 2]);
        end
      end

      ALU_CSUM: begin
        for (int i = 0; i < 6; i++) begin
          res_comb[2*i +: 2] = trit_csum(src_a[2*i +: 2], src_b[2*i +: 2]);
        end
      end

      ALU_TGATE: begin
        for (int i = 0; i < 6; i++) begin
          cur_c = src_c[2*i +: 2];
          if (cur_c == TRIT_NEG) begin
            res_comb[2*i +: 2] = trit_neg(src_a[2*i +: 2]);
          end else if (cur_c == TRIT_POS) begin
            res_comb[2*i +: 2] = trit_max(src_a[2*i +: 2], src_b[2*i +: 2]);
          end else begin
            res_comb[2*i +: 2] = trit_min(src_a[2*i +: 2], src_b[2*i +: 2]);
          end
        end
      end

      ALU_SHL:   res_comb = do_shl(src_a, shift_amt);
      ALU_SHR:   res_comb = do_shr(src_a, shift_amt);
      ALU_PASSA: res_comb = src_a;
      ALU_PASSB: res_comb = src_b;
      default:   res_comb = TRYTE_ZERO_VAL;
    endcase
  end

  assign alu_res  = res_comb;
  assign res_sign = tryte_sign(res_comb);

endmodule

`endif // TRYTE_ALU_SV
