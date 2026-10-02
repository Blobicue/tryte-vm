`ifndef TRYTE_CPU_SV
`define TRYTE_CPU_SV

`include "tryte_pkg.sv"
`include "tryte_alu.sv"

module tryte_cpu (

  input  logic        clk,
  input  logic        rst_n,

  // Memory interface
  output logic [9:0]  mem_addr,
  output tryte_t      mem_wdata,
  output logic        mem_we,
  input  tryte_t      mem_rdata,

  // I/O streams
  input  tryte_t      in_data,
  input  logic        in_valid,
  output logic        in_ready,

  output tryte_t      out_data,
  output logic        out_valid,

  // Execution status
  output logic        halted,
  output tryte_t      reg_a_out,
  output tryte_t      reg_c_out,
  output tryte_t      reg_pc_out
);

  // CPU Registers
  tryte_t reg_a;
  tryte_t reg_c;
  tryte_t reg_pc;
  tryte_t reg_opcode;
  tryte_t reg_operand;
  tryte_t reg_tmp;
  tryte_t reg_res;
  trit_t  topc_carry;
  logic [2:0] sub_idx;
  integer op_code_int;

  assign reg_a_out  = reg_a;
  assign reg_c_out  = reg_c;
  assign reg_pc_out = reg_pc;

  typedef enum logic [5:0] {
    ST_RESET,
    ST_FETCH_OP,
    ST_FETCH_OPERAND,
    ST_DECODE,
    ST_LOAD_REQ,
    ST_LOAD_WAIT,
    ST_STORE,
    ST_ALU_REQ,
    ST_ALU_WAIT,
    ST_BR3_REQ,
    ST_BR3_WAIT,
    ST_LOADX_PTR_REQ,
    ST_LOADX_PTR_WAIT,
    ST_LOADX_DATA_REQ,
    ST_LOADX_DATA_WAIT,
    ST_STOREX_PTR_REQ,
    ST_STOREX_PTR_WAIT,
    ST_STOREX_WRITE,
    ST_JMPX_REQ,
    ST_JMPX_WAIT,
    ST_LDC_REQ,
    ST_LDC_WAIT,
    ST_TOP_READ_Y_REQ,
    ST_TOP_READ_Y_WAIT,
    ST_TOP_LOOP_REQ,
    ST_TOP_LOOP_WAIT,
    ST_TOPC_READ_Y_REQ,
    ST_TOPC_READ_Y_WAIT,
    ST_TOPC_LOOP_REQ,
    ST_TOPC_LOOP_WAIT,
    ST_OUT,
    ST_IN,
    ST_HALTED
  } state_t;

  state_t state;

  // Helper to compute TOP row index for trit i
  function automatic integer calc_top_row(input trit_t x, input trit_t y);
    integer xi, yi;
    xi = trit_to_int(x);
    yi = trit_to_int(y);
    calc_top_row = (xi + 1) * 3 + (yi + 1);
  endfunction

  // Helper to compute TOPC row index for trit i
  function automatic integer calc_topc_row(input trit_t x, input trit_t y, input trit_t c);
    integer xi, yi, ci;
    xi = trit_to_int(x);
    yi = trit_to_int(y);
    ci = trit_to_int(c);
    calc_topc_row = (xi + 1) * 9 + (yi + 1) * 3 + (ci + 1);
  endfunction

  // Low trit of a tryte word
  function automatic trit_t low_trit(input tryte_t t);
    low_trit = t[1:0];
  endfunction

  // Second trit (carry trit) of a tryte word
  function automatic trit_t second_trit(input tryte_t t);
    second_trit = t[3:2];
  endfunction

  // Combinational memory address and write control
  trit_t  comb_br_sign;
  tryte_t comb_br_addr;

  always_comb begin
    mem_addr  = 10'd0;
    mem_wdata = reg_a;
    mem_we    = 1'b0;

    comb_br_sign = tryte_sign(reg_a);
    comb_br_addr = tryte_add(reg_operand, { 10'b0, comb_br_sign });

    case (state)
      ST_RESET: begin
        mem_addr = tryte_to_phys(TRYTE_ZERO_VAL);
      end

      ST_FETCH_OP: begin
        mem_addr = tryte_to_phys(reg_pc);
      end

      ST_FETCH_OPERAND: begin
        mem_addr = tryte_to_phys(reg_pc);
      end

      ST_LOAD_REQ: begin
        mem_addr = tryte_to_phys(reg_operand);
      end

      ST_STORE: begin
        mem_addr  = tryte_to_phys(reg_operand);
        mem_wdata = reg_a;
        mem_we    = 1'b1;
      end

      ST_ALU_REQ: begin
        mem_addr = tryte_to_phys(reg_operand);
      end

      ST_BR3_REQ: begin
        mem_addr = tryte_to_phys(comb_br_addr);
      end

      ST_LOADX_PTR_REQ: begin
        mem_addr = tryte_to_phys(reg_operand);
      end

      ST_LOADX_DATA_REQ: begin
        mem_addr = tryte_to_phys(reg_tmp);
      end

      ST_STOREX_PTR_REQ: begin
        mem_addr = tryte_to_phys(reg_operand);
      end

      ST_STOREX_WRITE: begin
        mem_addr  = tryte_to_phys(reg_tmp);
        mem_wdata = reg_a;
        mem_we    = 1'b1;
      end

      ST_JMPX_REQ: begin
        mem_addr = tryte_to_phys(reg_operand);
      end

      ST_LDC_REQ: begin
        mem_addr = tryte_to_phys(reg_operand);
      end

      ST_TOP_READ_Y_REQ: begin
        mem_addr = tryte_to_phys(reg_operand);
      end

      ST_TOP_LOOP_REQ: begin
        mem_addr = tryte_to_phys(tryte_add(reg_c, int_to_tryte(calc_top_row(reg_a[2*sub_idx +: 2], reg_tmp[2*sub_idx +: 2]))));
      end

      ST_TOPC_READ_Y_REQ: begin
        mem_addr = tryte_to_phys(reg_operand);
      end

      ST_TOPC_LOOP_REQ: begin
        mem_addr = tryte_to_phys(tryte_add(reg_c, int_to_tryte(calc_topc_row(reg_a[2*sub_idx +: 2], reg_tmp[2*sub_idx +: 2], topc_carry))));
      end

      default: begin
        mem_addr  = tryte_to_phys(reg_pc);
        mem_wdata = reg_a;
        mem_we    = 1'b0;
      end
    endcase
  end

  // Sequential state machine
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      state       <= ST_RESET;
      reg_a       <= TRYTE_ZERO_VAL;
      reg_c       <= TRYTE_ZERO_VAL;
      reg_pc      <= TRYTE_ZERO_VAL;
      reg_opcode  <= TRYTE_ZERO_VAL;
      reg_operand <= TRYTE_ZERO_VAL;
      reg_tmp     <= TRYTE_ZERO_VAL;
      reg_res     <= TRYTE_ZERO_VAL;
      topc_carry  <= TRIT_ZERO;
      sub_idx     <= 3'd0;
      in_ready    <= 1'b0;
      out_valid   <= 1'b0;
      out_data    <= TRYTE_ZERO_VAL;
      halted      <= 1'b0;
      op_code_int <= 0;
    end else begin
      out_valid <= 1'b0;
      in_ready  <= 1'b0;

      case (state)
        ST_RESET: begin
          reg_a    <= TRYTE_ZERO_VAL;
          reg_c    <= TRYTE_ZERO_VAL;
          reg_pc   <= TRYTE_ZERO_VAL;
          halted   <= 1'b0;
          state    <= ST_FETCH_OP;
        end

        ST_FETCH_OP: begin
          // mem_addr is reg_pc. On next edge, mem_rdata is opcode
          reg_pc <= tryte_add(reg_pc, int_to_tryte(1));
          state  <= ST_FETCH_OPERAND;
        end

        ST_FETCH_OPERAND: begin
          // mem_rdata contains opcode!
          reg_opcode  <= mem_rdata;
          op_code_int <= tryte_to_int(mem_rdata);
          // mem_addr is reg_pc (operand). On next edge, mem_rdata is operand
          reg_pc      <= tryte_add(reg_pc, int_to_tryte(1));
          state       <= ST_DECODE;
        end

        ST_DECODE: begin
          // mem_rdata contains operand!
          reg_operand <= mem_rdata;

          case (op_code_int)
            0: begin // HALT
              halted <= 1'b1;
              state  <= ST_HALTED;
            end

            1: begin // LOADI
              reg_a <= mem_rdata;
              state <= ST_FETCH_OP;
            end

            2: begin // LOAD
              state <= ST_LOAD_REQ;
            end

            3: begin // STORE
              state <= ST_STORE;
            end

            4: begin // ADD
              state <= ST_ALU_REQ;
            end

            5: begin // ADDI
              reg_a <= tryte_add(reg_a, mem_rdata);
              state <= ST_FETCH_OP;
            end

            6: begin // SUB
              state <= ST_ALU_REQ;
            end

            7: begin // NEG
              reg_a <= tryte_neg(reg_a);
              state <= ST_FETCH_OP;
            end

            8: begin // MIN
              state <= ST_ALU_REQ;
            end

            9: begin // MAX
              state <= ST_ALU_REQ;
            end

            10: begin // CSUM
              state <= ST_ALU_REQ;
            end

            11: begin // SETC
              reg_c <= mem_rdata;
              state <= ST_FETCH_OP;
            end

            12: begin // TGATE
              state <= ST_ALU_REQ;
            end

            13: begin // SHL
              reg_a <= do_shl(reg_a, tryte_to_int(mem_rdata));
              state <= ST_FETCH_OP;
            end

            14: begin // SHR
              reg_a <= do_shr(reg_a, tryte_to_int(mem_rdata));
              state <= ST_FETCH_OP;
            end

            15: begin // JMP
              reg_pc <= mem_rdata;
              state  <= ST_FETCH_OP;
            end

            16: begin // BR3
              state <= ST_BR3_REQ;
            end

            17: begin // OUT
              out_data  <= reg_a;
              out_valid <= 1'b1;
              state     <= ST_OUT;
            end

            18: begin // IN
              in_ready <= 1'b1;
              state    <= ST_IN;
            end

            19: begin // LOADX
              state <= ST_LOADX_PTR_REQ;
            end

            20: begin // STOREX
              state <= ST_STOREX_PTR_REQ;
            end

            21: begin // JMPX
              state <= ST_JMPX_REQ;
            end

            22: begin // LDC
              state <= ST_LDC_REQ;
            end

            23: begin // TOP
              state <= ST_TOP_READ_Y_REQ;
            end

            24: begin // TOPC
              state <= ST_TOPC_READ_Y_REQ;
            end

            25: begin // QEXEC
              state <= ST_FETCH_OP;
            end

            default: begin
              halted <= 1'b1;
              state  <= ST_HALTED;
            end
          endcase
        end

        ST_LOAD_REQ: begin
          state <= ST_LOAD_WAIT;
        end

        ST_LOAD_WAIT: begin
          reg_a <= mem_rdata;
          state <= ST_FETCH_OP;
        end

        ST_STORE: begin
          state <= ST_FETCH_OP;
        end

        ST_ALU_REQ: begin
          state <= ST_ALU_WAIT;
        end

        ST_ALU_WAIT: begin
          case (op_code_int)
            4: reg_a <= tryte_add(reg_a, mem_rdata);
            6: reg_a <= tryte_sub(reg_a, mem_rdata);
            8: begin
              for (int i = 0; i < 6; i++) begin
                reg_a[2*i]   <= reg_a[2*i] & mem_rdata[2*i];
                reg_a[2*i+1] <= reg_a[2*i+1] | mem_rdata[2*i+1];
              end
            end
            9: begin
              for (int i = 0; i < 6; i++) begin
                reg_a[2*i]   <= reg_a[2*i] | mem_rdata[2*i];
                reg_a[2*i+1] <= reg_a[2*i+1] & mem_rdata[2*i+1];
              end
            end
            10: begin
              for (int i = 0; i < 6; i++) begin
                reg_a[2*i]   <= (reg_a[2*i] & ~mem_rdata[2*i+1]) | (mem_rdata[2*i] & ~reg_a[2*i+1]);
                reg_a[2*i+1] <= (reg_a[2*i+1] & ~mem_rdata[2*i])   | (mem_rdata[2*i+1] & ~reg_a[2*i]);
              end
            end
            12: begin
              for (int i = 0; i < 6; i++) begin
                if (reg_c[2*i+1]) begin // NEG
                  reg_a[2*i]   <= reg_a[2*i+1];
                  reg_a[2*i+1] <= reg_a[2*i];
                end else if (reg_c[2*i]) begin // MAX
                  reg_a[2*i]   <= reg_a[2*i] | mem_rdata[2*i];
                  reg_a[2*i+1] <= reg_a[2*i+1] & mem_rdata[2*i+1];
                end else begin // MIN
                  reg_a[2*i]   <= reg_a[2*i] & mem_rdata[2*i];
                  reg_a[2*i+1] <= reg_a[2*i+1] | mem_rdata[2*i+1];
                end
              end
            end
            default: ;
          endcase
          state <= ST_FETCH_OP;
        end

        ST_BR3_REQ: begin
          state <= ST_BR3_WAIT;
        end

        ST_BR3_WAIT: begin
          reg_pc <= mem_rdata;
          state  <= ST_FETCH_OP;
        end

        ST_LOADX_PTR_REQ: begin
          state <= ST_LOADX_PTR_WAIT;
        end

        ST_LOADX_PTR_WAIT: begin
          reg_tmp <= mem_rdata; // target address
          state   <= ST_LOADX_DATA_REQ;
        end

        ST_LOADX_DATA_REQ: begin
          state <= ST_LOADX_DATA_WAIT;
        end

        ST_LOADX_DATA_WAIT: begin
          reg_a <= mem_rdata;
          state <= ST_FETCH_OP;
        end

        ST_STOREX_PTR_REQ: begin
          state <= ST_STOREX_PTR_WAIT;
        end

        ST_STOREX_PTR_WAIT: begin
          reg_tmp <= mem_rdata; // target address
          state   <= ST_STOREX_WRITE;
        end

        ST_STOREX_WRITE: begin
          state <= ST_FETCH_OP;
        end

        ST_JMPX_REQ: begin
          state <= ST_JMPX_WAIT;
        end

        ST_JMPX_WAIT: begin
          reg_pc <= mem_rdata;
          state  <= ST_FETCH_OP;
        end

        ST_LDC_REQ: begin
          state <= ST_LDC_WAIT;
        end

        ST_LDC_WAIT: begin
          reg_c <= mem_rdata;
          state <= ST_FETCH_OP;
        end

        ST_TOP_READ_Y_REQ: begin
          state <= ST_TOP_READ_Y_WAIT;
        end

        ST_TOP_READ_Y_WAIT: begin
          reg_tmp <= mem_rdata; // Y operand
          sub_idx <= 3'd0;
          state   <= ST_TOP_LOOP_REQ;
        end

        ST_TOP_LOOP_REQ: begin
          state <= ST_TOP_LOOP_WAIT;
        end

        ST_TOP_LOOP_WAIT: begin
          reg_res[2*sub_idx +: 2] <= low_trit(mem_rdata);
          if (sub_idx == 3'd5) begin
            reg_a <= {low_trit(mem_rdata), reg_res[9:0]};
            state <= ST_FETCH_OP;
          end else begin
            sub_idx <= sub_idx + 3'd1;
            state   <= ST_TOP_LOOP_REQ;
          end
        end

        ST_TOPC_READ_Y_REQ: begin
          state <= ST_TOPC_READ_Y_WAIT;
        end

        ST_TOPC_READ_Y_WAIT: begin
          reg_tmp    <= mem_rdata; // Y operand
          sub_idx    <= 3'd0;
          topc_carry <= TRIT_ZERO;
          state      <= ST_TOPC_LOOP_REQ;
        end

        ST_TOPC_LOOP_REQ: begin
          state <= ST_TOPC_LOOP_WAIT;
        end

        ST_TOPC_LOOP_WAIT: begin
          reg_res[2*sub_idx +: 2] <= low_trit(mem_rdata);
          topc_carry              <= second_trit(mem_rdata);
          if (sub_idx == 3'd5) begin
            reg_a <= {low_trit(mem_rdata), reg_res[9:0]};
            state <= ST_FETCH_OP;
          end else begin
            sub_idx <= sub_idx + 3'd1;
            state   <= ST_TOPC_LOOP_REQ;
          end
        end

        ST_OUT: begin
          state <= ST_FETCH_OP;
        end

        ST_IN: begin
          if (in_valid) begin
            reg_a    <= in_data;
            in_ready <= 1'b0;
            state    <= ST_FETCH_OP;
          end else begin
            in_ready <= 1'b1;
            state    <= ST_IN;
          end
        end

        ST_HALTED: begin
          halted <= 1'b1;
          state  <= ST_HALTED;
        end

        default: begin
          state <= ST_RESET;
        end
      endcase
    end
  end

endmodule

`endif // TRYTE_CPU_SV
