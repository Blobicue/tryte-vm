`timescale 1ns / 1ps

// ============================================================================
// Module: tryte_alu_4bit
// Description: 4-Bit Bit-Sliced Tryte ALU combining a 3-stage cascaded 
//              ripple-carry adder with an integrated Ternary Multiplexer (T-MUX).
// Control Trit Encoding (signed 2-bit):
//   2'sb11 (-1) : Channel A -> Bitwise XOR (Harvested from Adder Stages 1 & 2)
//   2'sb00 ( 0) : Channel B -> Bitwise AND (Harvested from Adder Stage 1)
//   2'sb01 (+1) : Channel C -> 4-Bit Full Addition (Full 3-Stage Pipeline)
// ============================================================================

module tryte_alu_4bit (
    input  wire [3:0]        x,         // 4-bit Input Bus X
    input  wire [3:0]        y,         // 4-bit Input Bus Y
    input  wire              c_in,      // Carry-In (Active for Addition)
    input  wire signed [1:0] s_trit,    // Control Trit (-1, 0, +1)
    output wire [3:0]        alu_out,   // 4-bit Output Bus
    output wire              c_out,     // Carry-Out Flag
    output wire              zero_flag  // Zero Detection Flag
);

    // ------------------------------------------------------------------------
    // Internal Bit-Sliced Stage Wires
    // ------------------------------------------------------------------------
    wire [3:0] stage1_or;      // Trit 1 (+1): X OR Y
    wire [3:0] stage1_and;     // Trit 2 ( 0): X AND Y (Bitwise AND Channel)
    wire [3:0] stage2_xor;     // Trit 2 ( 0): (X OR Y) AND NOT(X AND Y) -> Bitwise XOR Channel
    wire [3:0] stage3_sum;     // Stage 3    : Full Adder Sum Slices
    wire [4:0] ripple_carry;   // Ripple carry chain (c0 = c_in)

    assign ripple_carry[0] = c_in;

    // ------------------------------------------------------------------------
    // 3-Stage Cascaded Bit-Slices (4 Instances)
    // ------------------------------------------------------------------------
    genvar i;
    generate
        for (i = 0; i < 4; i = i + 1) begin : GEN_BIT_SLICES
            
            // STAGE 1: Tryte Vector [+1, 0] -> (OR, AND)
            assign stage1_or[i]  = x[i] | y[i];
            assign stage1_and[i] = x[i] & y[i];

            // STAGE 2: Tryte Vector [-1, 0] -> (NOT, AND) => Produces XOR
            // Formula: (X OR Y) AND NOT(X AND Y)
            assign stage2_xor[i] = stage1_or[i] & (~stage1_and[i]);

            // STAGE 3: Full-Adder Resolution with Carry Ripple
            // Sum bit: Intermediate XOR ^ Carry_in
            assign stage3_sum[i] = stage2_xor[i] ^ ripple_carry[i];
            
            // Carry-out bit: (X & Y) | (Intermediate XOR & Carry_in)
            assign ripple_carry[i+1] = stage1_and[i] | (stage2_xor[i] & ripple_carry[i]);
            
        end
    endgenerate

    // ------------------------------------------------------------------------
    // Dynamic Ternary Multiplexer (T-MUX)
    // Routes channels based on the Control Trit (S_ALU)
    // ------------------------------------------------------------------------
    reg [3:0] mux_out;
    reg       cout_reg;

    always @(*) begin
        case (s_trit)
            2'sb11: begin // -1 : Bitwise XOR
                mux_out  = stage2_xor;
                cout_reg = 1'b0;
            end
            2'sb00: begin //  0 : Bitwise AND
                mux_out  = stage1_and;
                cout_reg = 1'b0;
            end
            2'sb01: begin // +1 : Full Addition with Ripple Carry
                mux_out  = stage3_sum;
                cout_reg = ripple_carry[4];
            end
            default: begin // Safe fallback / NOP
                mux_out  = 4'b0000;
                cout_reg = 1'b0;
            end
        endcase
    end

    // ------------------------------------------------------------------------
    // Output Assignments & Status Flags
    // ------------------------------------------------------------------------
    assign alu_out   = mux_out;
    assign c_out     = cout_reg;
    assign zero_flag = (mux_out == 4'b0000) ? 1'b1 : 1'b0;

endmodule