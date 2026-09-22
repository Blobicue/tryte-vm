`ifndef TRYTE_TOP_SV
`define TRYTE_TOP_SV

`include "tryte_pkg.sv"
`include "tryte_ram.sv"
`include "tryte_cpu.sv"

module tryte_top #(
  parameter INIT_FILE = ""
) (
  input  logic        clk,
  input  logic        rst_n,

  // External I/O
  input  tryte_t      in_data,
  input  logic        in_valid,
  output logic        in_ready,

  output tryte_t      out_data,
  output logic        out_valid,

  output logic        halted,

  // Architecture register monitoring
  output tryte_t      reg_a,
  output tryte_t      reg_c,
  output tryte_t      reg_pc,

  // Testbench backdoor RAM write interface (active when tb_we = 1)
  input  logic        tb_we,
  input  logic [9:0]  tb_addr,
  input  tryte_t      tb_wdata
);

  // CPU - RAM bus
  logic [9:0] cpu_mem_addr;
  tryte_t     cpu_mem_wdata;
  logic       cpu_mem_we;
  tryte_t     mem_rdata;

  // Multiplexed RAM inputs
  logic [9:0] ram_addr;
  tryte_t     ram_wdata;
  logic       ram_we;

  assign ram_addr  = tb_we ? tb_addr  : cpu_mem_addr;
  assign ram_wdata = tb_we ? tb_wdata : cpu_mem_wdata;
  assign ram_we    = tb_we ? 1'b1     : cpu_mem_we;

  // Submodules
  tryte_cpu u_cpu (
    .clk        (clk),
    .rst_n      (rst_n),
    .mem_addr   (cpu_mem_addr),
    .mem_wdata  (cpu_mem_wdata),
    .mem_we     (cpu_mem_we),
    .mem_rdata  (mem_rdata),
    .in_data    (in_data),
    .in_valid   (in_valid),
    .in_ready   (in_ready),
    .out_data   (out_data),
    .out_valid  (out_valid),
    .halted     (halted),
    .reg_a_out  (reg_a),
    .reg_c_out  (reg_c),
    .reg_pc_out (reg_pc)
  );

  tryte_ram #(
    .INIT_FILE (INIT_FILE)
  ) u_ram (
    .clk   (clk),
    .we    (ram_we),
    .addr  (ram_addr),
    .wdata (ram_wdata),
    .rdata (mem_rdata)
  );

endmodule

`endif // TRYTE_TOP_SV
