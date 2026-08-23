# 1. Analyze Design and CLA Submodules
ghdl -a cla_generator_4bit.vhd
ghdl -a tryte_alu_16bit_cla.vhd

# 2. Analyze Testbench
ghdl -a tb_tryte_alu_16bit_cla.vhd

# 3. Elaborate and Run Simulation
ghdl -e tb_tryte_alu_16bit_cla
ghdl -r tb_tryte_alu_16bit_cla --vcd=tryte_cla_waveform.vcd