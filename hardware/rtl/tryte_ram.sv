`ifndef TRYTE_RAM_SV
`define TRYTE_RAM_SV

`include "tryte_pkg.sv"

module tryte_ram #(
  parameter INIT_FILE = ""
) (
  input  logic        clk,
  input  logic        we,
  input  logic [9:0]  addr,
  input  tryte_t      wdata,
  output tryte_t      rdata
);

  // 729-word balanced ternary memory storage (12 bits per word)
  // Physical index [0..728] corresponds to balanced tryte addresses [-364..+364]
  tryte_t mem [0:TRYTE_STATES-1];

  initial begin
    if (INIT_FILE != "") begin
      $readmemh(INIT_FILE, mem);
    end else begin
      for (int i = 0; i < TRYTE_STATES; i++) begin
        mem[i] = TRYTE_ZERO_VAL;
      end
    end
  end

  always_ff @(posedge clk) begin
    if (we && addr < 10'd729) begin
      mem[addr] <= wdata;
    end
    if (addr < 10'd729) begin
      rdata <= mem[addr];
    end else begin
      rdata <= TRYTE_ZERO_VAL;
    end
  end

endmodule

`endif // TRYTE_RAM_SV
