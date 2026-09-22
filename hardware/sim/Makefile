VERILATOR ?= verilator
VERILATOR_FLAGS ?= -sv -I../rtl --cc --exe --build -O3 -Wall -Wno-fatal

all: sim_tryte

sim_tryte: sim_main.cpp ../rtl/*.sv
	$(VERILATOR) $(VERILATOR_FLAGS) ../rtl/tryte_top.sv sim_main.cpp --Mdir obj_dir -o sim_tryte

test: sim_tryte hex
	./obj_dir/sim_tryte

hex:
	node ../../tools/tasm_to_hex.js ../../programs/threeway.tasm /tmp/threeway.hex
	node ../../tools/tasm_to_hex.js ../../programs/multiply.tasm /tmp/multiply.hex
	node ../../tools/tasm_to_hex.js ../../programs/tgate.tasm /tmp/tgate.hex
	node ../../tools/tasm_to_hex.js ../../programs/ntru.tasm /tmp/ntru.hex

clean:
	rm -rf obj_dir /tmp/*.hex

.PHONY: all test hex clean
