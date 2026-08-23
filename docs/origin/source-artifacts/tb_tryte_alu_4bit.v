`timescale 1ns / 1ps

module tb_tryte_alu_4bit;

    reg  [3:0]        x;
    reg  [3:0]        y;
    reg               c_in;
    reg  signed [1:0] s_trit;
    wire [3:0]        alu_out;
    wire              c_out;
    wire              zero_flag;

    // Instantiate Unit Under Test (UUT)
    tryte_alu_4bit uut (
        .x(x),
        .y(y),
        .c_in(c_in),
        .s_trit(s_trit),
        .alu_out(alu_out),
        .c_out(c_out),
        .zero_flag(zero_flag)
    );

    initial begin
        $display("=== STARTING 4-BIT TRYTE ALU TESTBENCH ===");

        // TEST 1: Bitwise XOR (S = -1) -> 4'b0101 ^ 4'b0011 = 4'b0110 (6)
        x = 4'b0101; y = 4'b0011; c_in = 1'b0; s_trit = -2'sd1;
        #10;
        if (alu_out !== 4'b0110 || c_out !== 1'b0 || zero_flag !== 1'b0)
            $error("TEST 1 FAILED: Expected 0110, Got %b", alu_out);
        else
            $display("[PASS] TEST 1: XOR Mode (5 ^ 3 = %0d)", alu_out);

        // TEST 2: Bitwise AND (S = 0) -> 4'b0101 & 4'b0011 = 4'b0001 (1)
        s_trit = 2'sd0;
        #10;
        if (alu_out !== 4'b0001 || c_out !== 1'b0 || zero_flag !== 1'b0)
            $error("TEST 2 FAILED: Expected 0001, Got %b", alu_out);
        else
            $display("[PASS] TEST 2: AND Mode (5 & 3 = %0d)", alu_out);

        // TEST 3: Full Addition (S = +1) -> 5 + 3 = 8 (4'b1000)
        s_trit = 2'sd1;
        #10;
        if (alu_out !== 4'b1000 || c_out !== 1'b0 || zero_flag !== 1'b0)
            $error("TEST 3 FAILED: Expected 1000, Got %b", alu_out);
        else
            $display("[PASS] TEST 3: ADD Mode (5 + 3 = %0d, Cout = %0b)", alu_out, c_out);

        // TEST 4: Addition with Overflow -> 13 + 5 = 18 -> Out = 2 (4'b0010), Cout = 1
        x = 4'd13; y = 4'd5; c_in = 1'b0; s_trit = 2'sd1;
        #10;
        if (alu_out !== 4'b0010 || c_out !== 1'b1)
            $error("TEST 4 FAILED: Expected 0010 with Cout=1, Got %b Cout=%b", alu_out, c_out);
        else
            $display("[PASS] TEST 4: ADD Overflow (13 + 5 = %0d with Cout=%0b)", alu_out, c_out);

        // TEST 5: Zero Flag Detection on Matching XOR -> 5 ^ 5 = 0
        x = 4'b0101; y = 4'b0101; s_trit = -2'sd1;
        #10;
        if (alu_out !== 4'b0000 || zero_flag !== 1'b1)
            $error("TEST 5 FAILED: Zero flag not asserted");
        else
            $display("[PASS] TEST 5: Zero Flag Verified (5 ^ 5 = 0, Z=%0b)", zero_flag);

        $display("=== ALL VERILOG SIMULATION TESTS COMPLETED SUCCESSFULLY ===");
        $finish;
    end

endmodule