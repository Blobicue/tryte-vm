#include "Vtryte_top.h"
#include "verilated.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <cassert>
#include <iomanip>

// Balanced ternary conversion helpers
uint16_t tryte_to_dualrail(int val) {
    int w = ((((val - (-364)) % 729) + 729) % 729) + (-364);
    int x = w;
    uint16_t bits = 0;
    for (int i = 0; i < 6; i++) {
        int r = ((x % 3) + 3) % 3;
        if (r == 2) r = -1;
        if (r == 1) bits |= (1 << (2 * i));
        else if (r == -1) bits |= (2 << (2 * i));
        x = (x - r) / 3;
    }
    return bits;
}

int dualrail_to_tryte(uint16_t bits) {
    int val = 0;
    int weight = 1;
    for (int i = 0; i < 6; i++) {
        int p = (bits >> (2 * i)) & 1;
        int n = (bits >> (2 * i + 1)) & 1;
        int t = (p && !n) ? 1 : ((n && !p) ? -1 : 0);
        val += t * weight;
        weight *= 3;
    }
    return val;
}

int tmin(int a, int b) {
    uint16_t da = tryte_to_dualrail(a);
    uint16_t db = tryte_to_dualrail(b);
    uint16_t res = 0;
    for (int i = 0; i < 6; i++) {
        int ap = (da >> (2*i)) & 1, an = (da >> (2*i+1)) & 1;
        int bp = (db >> (2*i)) & 1, bn = (db >> (2*i+1)) & 1;
        int rp = ap & bp;
        int rn = an | bn;
        res |= (rp << (2*i)) | (rn << (2*i+1));
    }
    return dualrail_to_tryte(res);
}

int tmax(int a, int b) {
    uint16_t da = tryte_to_dualrail(a);
    uint16_t db = tryte_to_dualrail(b);
    uint16_t res = 0;
    for (int i = 0; i < 6; i++) {
        int ap = (da >> (2*i)) & 1, an = (da >> (2*i+1)) & 1;
        int bp = (db >> (2*i)) & 1, bn = (db >> (2*i+1)) & 1;
        int rp = ap | bp;
        int rn = an & bn;
        res |= (rp << (2*i)) | (rn << (2*i+1));
    }
    return dualrail_to_tryte(res);
}

int tcsum(int a, int b) {
    uint16_t da = tryte_to_dualrail(a);
    uint16_t db = tryte_to_dualrail(b);
    uint16_t res = 0;
    for (int i = 0; i < 6; i++) {
        int ap = (da >> (2*i)) & 1, an = (da >> (2*i+1)) & 1;
        int bp = (db >> (2*i)) & 1, bn = (db >> (2*i+1)) & 1;
        int rp = (ap & !bn) | (bp & !an);
        int rn = (an & !bp) | (bn & !ap);
        res |= (rp << (2*i)) | (rn << (2*i+1));
    }
    return dualrail_to_tryte(res);
}

int tgate_func(int c, int x, int y) {
    uint16_t dc = tryte_to_dualrail(c);
    uint16_t dx = tryte_to_dualrail(x);
    uint16_t dy = tryte_to_dualrail(y);
    uint16_t res = 0;
    for (int i = 0; i < 6; i++) {
        int cp = (dc >> (2*i)) & 1, cn = (dc >> (2*i+1)) & 1;
        int xp = (dx >> (2*i)) & 1, xn = (dx >> (2*i+1)) & 1;
        int yp = (dy >> (2*i)) & 1, yn = (dy >> (2*i+1)) & 1;
        int rp, rn;
        if (cn) { // -1 => NEG
            rp = xn; rn = xp;
        } else if (cp) { // +1 => MAX
            rp = xp | yp; rn = xn & yn;
        } else { // 0 => MIN
            rp = xp & yp; rn = xn | yn;
        }
        res |= (rp << (2*i)) | (rn << (2*i+1));
    }
    return dualrail_to_tryte(res);
}

struct SimEnv {
    Vtryte_top* top;
    uint64_t cycles;
    std::vector<int> output;

    SimEnv() {
        top = new Vtryte_top;
        cycles = 0;
        top->clk = 0;
        top->rst_n = 1;
        top->tb_we = 0;
        top->tb_addr = 0;
        top->tb_wdata = 0;
        top->in_data = 0;
        top->in_valid = 0;
    }

    ~SimEnv() {
        delete top;
    }

    void tick() {
        top->clk = 0;
        top->eval();
        top->clk = 1;
        top->eval();
        cycles++;
    }

    void reset() {
        top->rst_n = 0;
        top->tb_we = 0;
        top->in_valid = 0;
        output.clear();
        for (int i = 0; i < 5; i++) tick();
        top->rst_n = 1;
        tick();
    }

    void clear_ram() {
        top->tb_we = 1;
        for (int i = 0; i < 729; i++) {
            top->tb_addr = i;
            top->tb_wdata = 0;
            tick();
        }
        top->tb_we = 0;
    }

    void write_cell(int balanced_addr, int value) {
        top->tb_we = 1;
        top->tb_addr = balanced_addr + 364;
        top->tb_wdata = tryte_to_dualrail(value);
        tick();
        top->tb_we = 0;
    }

    void load_hex(const std::string& path) {
        std::ifstream f(path);
        if (!f.is_open()) {
            std::cerr << "Error opening file: " << path << std::endl;
            exit(1);
        }
        std::string line;
        int phys = 0;
        top->tb_we = 1;
        while (std::getline(f, line) && phys < 729) {
            if (line.empty() || line[0] == '#') continue;
            uint16_t val = (uint16_t)std::stoul(line, nullptr, 16);
            top->tb_addr = phys++;
            top->tb_wdata = val;
            tick();
        }
        top->tb_we = 0;
    }

    bool run(const std::vector<int>& inputs = {}, uint64_t max_cycles = 1000000) {
        size_t in_idx = 0;
        uint64_t start_cycle = cycles;
        while (!top->halted && (cycles - start_cycle) < max_cycles) {
            bool will_transfer = false;
            if (top->in_ready && in_idx < inputs.size()) {
                top->in_data = tryte_to_dualrail(inputs[in_idx]);
                top->in_valid = 1;
                will_transfer = true;
            } else {
                top->in_valid = 0;
            }
            tick();
            if (will_transfer) {
                in_idx++;
            }
            if (top->out_valid) {
                output.push_back(dualrail_to_tryte(top->out_data));
            }
        }
        return top->halted;
    }
};

int total_passed = 0;
int total_failed = 0;

void check(const std::string& name, bool cond, const std::string& detail = "") {
    if (cond) {
        total_passed++;
        std::cout << "  [PASS] " << name << std::endl;
    } else {
        total_failed++;
        std::cout << "  [FAIL] " << name << " " << detail << std::endl;
    }
}

int main(int argc, char** argv) {
    Verilated::commandArgs(argc, argv);
    SimEnv sim;

    std::cout << "\n================================================================" << std::endl;
    std::cout << "TRYTEVM SYNTHESIZABLE SILICON HARDWARE CORE VERIFICATION" << std::endl;
    std::cout << "Verilator C++ Cycle-Accurate Testbench & ISA Compliance Suite" << std::endl;
    std::cout << "================================================================" << std::endl;

    // --- Suite 1: Fundamental ISA Operations ---
    std::cout << "\n=== 1. FUNDAMENTAL INSTRUCTION SET ARCHITECTURE (ISA) ===" << std::endl;
    {
        // Test LOADI / OUT
        sim.clear_ram();
        sim.write_cell(0, 1);   // LOADI
        sim.write_cell(1, -42); // imm -42
        sim.write_cell(2, 17);  // OUT
        sim.write_cell(3, 0);   // none
        sim.write_cell(4, 0);   // HALT
        sim.write_cell(5, 0);
        sim.reset();
        sim.run();
        check("LOADI / OUT round-trip", sim.output.size() == 1 && sim.output[0] == -42);
    }
    {
        // Test LOAD / STORE
        sim.clear_ram();
        sim.write_cell(0, 1);   // LOADI 99
        sim.write_cell(1, 99);
        sim.write_cell(2, 3);   // STORE -3
        sim.write_cell(3, -3);
        sim.write_cell(4, 1);   // LOADI 0
        sim.write_cell(5, 0);
        sim.write_cell(6, 2);   // LOAD -3
        sim.write_cell(7, -3);
        sim.write_cell(8, 17);  // OUT
        sim.write_cell(9, 0);
        sim.write_cell(10, 0);  // HALT
        sim.write_cell(11, 0);
        sim.reset();
        sim.run();
        check("LOAD / STORE round-trip", sim.output.size() == 1 && sim.output[0] == 99);
    }
    {
        // Test ADD / ADDI / SUB
        sim.clear_ram();
        sim.write_cell(0, 1);   // LOADI 10
        sim.write_cell(1, 10);
        sim.write_cell(2, 5);   // ADDI 5
        sim.write_cell(3, 5);
        sim.write_cell(4, 3);   // STORE -3
        sim.write_cell(5, -3);
        sim.write_cell(6, 1);   // LOADI 100
        sim.write_cell(7, 100);
        sim.write_cell(8, 6);   // SUB -3 (100 - 15 = 85)
        sim.write_cell(9, -3);
        sim.write_cell(10, 17); // OUT
        sim.write_cell(11, 0);
        sim.write_cell(12, 0);  // HALT
        sim.write_cell(13, 0);
        sim.reset();
        sim.run();
        check("ADD / ADDI / SUB sequence", sim.output.size() == 1 && sim.output[0] == 85);
    }
    {
        // Test NEG flips every trit
        sim.clear_ram();
        sim.write_cell(0, 1);   // LOADI 123
        sim.write_cell(1, 123);
        sim.write_cell(2, 7);   // NEG
        sim.write_cell(3, 0);
        sim.write_cell(4, 17);  // OUT
        sim.write_cell(5, 0);
        sim.write_cell(6, 0);   // HALT
        sim.write_cell(7, 0);
        sim.reset();
        sim.run();
        check("NEG flips every trit (zero gate logic)", sim.output.size() == 1 && sim.output[0] == -123);
    }
    {
        // Test SHL / SHR
        sim.clear_ram();
        sim.write_cell(0, 1);   // LOADI 7
        sim.write_cell(1, 7);
        sim.write_cell(2, 13);  // SHL 2 (7 * 9 = 63)
        sim.write_cell(3, 2);
        sim.write_cell(4, 17);  // OUT
        sim.write_cell(5, 0);
        sim.write_cell(6, 1);   // LOADI 5
        sim.write_cell(7, 5);
        sim.write_cell(8, 14);  // SHR 1 (5 / 3 = 2 rounded to nearest)
        sim.write_cell(9, 1);
        sim.write_cell(10, 17); // OUT
        sim.write_cell(11, 0);
        sim.write_cell(12, 0);  // HALT
        sim.write_cell(13, 0);
        sim.reset();
        sim.run();
        check("SHL multiplies by 3^n, SHR rounds to nearest", sim.output.size() == 2 && sim.output[0] == 63 && sim.output[1] == 2);
    }
    {
        // Test MIN / MAX / CSUM
        sim.clear_ram();
        sim.write_cell(0, 1);   // LOADI 123
        sim.write_cell(1, 123);
        sim.write_cell(2, 3);   // STORE -3
        sim.write_cell(3, -3);
        sim.write_cell(4, 1);   // LOADI -45
        sim.write_cell(5, -45);
        sim.write_cell(6, 8);   // MIN -3
        sim.write_cell(7, -3);
        sim.write_cell(8, 17);  // OUT
        sim.write_cell(9, 0);
        sim.write_cell(10, 1);  // LOADI -45
        sim.write_cell(11, -45);
        sim.write_cell(12, 9);  // MAX -3
        sim.write_cell(13, -3);
        sim.write_cell(14, 17); // OUT
        sim.write_cell(15, 0);
        sim.write_cell(16, 1);  // LOADI -45
        sim.write_cell(17, -45);
        sim.write_cell(18, 10); // CSUM -3
        sim.write_cell(19, -3);
        sim.write_cell(20, 17); // OUT
        sim.write_cell(21, 0);
        sim.write_cell(22, 0);  // HALT
        sim.write_cell(23, 0);
        sim.reset();
        sim.run();
        int exp_min = tmin(-45, 123);
        int exp_max = tmax(-45, 123);
        int exp_csum = tcsum(-45, 123);
        check("MIN / MAX / CSUM tritwise ALU operations", sim.output.size() == 3 && sim.output[0] == exp_min && sim.output[1] == exp_max && sim.output[2] == exp_csum);
    }
    {
        // Test JMP transfers control
        sim.clear_ram();
        sim.write_cell(0, 15);  // JMP 6
        sim.write_cell(1, 6);
        sim.write_cell(2, 1);   // LOADI 1
        sim.write_cell(3, 1);
        sim.write_cell(4, 17);  // OUT
        sim.write_cell(5, 0);
        sim.write_cell(6, 1);   // LOADI 2
        sim.write_cell(7, 2);
        sim.write_cell(8, 17);  // OUT
        sim.write_cell(9, 0);
        sim.write_cell(10, 0);  // HALT
        sim.write_cell(11, 0);
        sim.reset();
        sim.run();
        check("JMP transfers execution control", sim.output.size() == 1 && sim.output[0] == 2);
    }
    {
        // Test IN input queue
        sim.clear_ram();
        sim.write_cell(0, 18);  // IN
        sim.write_cell(1, 0);
        sim.write_cell(2, 17);  // OUT
        sim.write_cell(3, 0);
        sim.write_cell(4, 18);  // IN
        sim.write_cell(5, 0);
        sim.write_cell(6, 17);  // OUT
        sim.write_cell(7, 0);
        sim.write_cell(8, 0);   // HALT
        sim.write_cell(9, 0);
        sim.reset();
        sim.run({4, 9});
        check("IN consumes input FIFO stream in order", sim.output.size() == 2 && sim.output[0] == 4 && sim.output[1] == 9);
    }
    {
        // Test modulo 729 boundary wrap
        sim.clear_ram();
        sim.write_cell(0, 1);   // LOADI 364
        sim.write_cell(1, 364);
        sim.write_cell(2, 5);   // ADDI 1
        sim.write_cell(3, 1);
        sim.write_cell(4, 17);  // OUT
        sim.write_cell(5, 0);
        sim.write_cell(6, 0);   // HALT
        sim.write_cell(7, 0);
        sim.reset();
        sim.run();
        check("Arithmetic wraps modulo 729 at tryte boundary (364 + 1 = -364)", sim.output.size() == 1 && sim.output[0] == -364);
    }

    // --- Suite 2: Indirect Addressing ---
    std::cout << "\n=== 2. INDIRECT ADDRESSING (LOADX, STOREX, JMPX, LDC) ===" << std::endl;
    {
        // LOADX reads through a pointer cell
        sim.clear_ram();
        sim.write_cell(0, 1);   // LOADI 42
        sim.write_cell(1, 42);
        sim.write_cell(2, 3);   // STORE -3 (cell)
        sim.write_cell(3, -3);
        sim.write_cell(4, 1);   // LOADI 0
        sim.write_cell(5, 0);
        sim.write_cell(6, 19);  // LOADX -4 (ptr)
        sim.write_cell(7, -4);
        sim.write_cell(8, 17);  // OUT
        sim.write_cell(9, 0);
        sim.write_cell(10, 0);  // HALT
        sim.write_cell(11, 0);
        sim.write_cell(-4, -3); // ptr: .word cell
        sim.write_cell(-3, 0);  // cell: .word 0
        sim.reset();
        sim.run();
        check("LOADX reads through a pointer cell", sim.output.size() == 1 && sim.output[0] == 42);
    }
    {
        // STOREX writes through a pointer cell
        sim.clear_ram();
        sim.write_cell(0, 1);   // LOADI 99
        sim.write_cell(1, 99);
        sim.write_cell(2, 20);  // STOREX -4 (ptr)
        sim.write_cell(3, -4);
        sim.write_cell(4, 1);   // LOADI 0
        sim.write_cell(5, 0);
        sim.write_cell(6, 2);   // LOAD -3 (cell)
        sim.write_cell(7, -3);
        sim.write_cell(8, 17);  // OUT
        sim.write_cell(9, 0);
        sim.write_cell(10, 0);  // HALT
        sim.write_cell(11, 0);
        sim.write_cell(-4, -3); // ptr: .word cell
        sim.write_cell(-3, 0);  // cell: .word 0
        sim.reset();
        sim.run();
        check("STOREX writes through a pointer cell", sim.output.size() == 1 && sim.output[0] == 99);
    }
    {
        // JMPX jumps to computed target
        sim.clear_ram();
        sim.write_cell(0, 21);  // JMPX -4 (tgt)
        sim.write_cell(1, -4);
        sim.write_cell(2, 1);   // LOADI 1
        sim.write_cell(3, 1);
        sim.write_cell(4, 17);  // OUT
        sim.write_cell(5, 0);
        sim.write_cell(6, 0);   // HALT
        sim.write_cell(7, 0);
        sim.write_cell(8, 1);   // late: LOADI 7
        sim.write_cell(9, 7);
        sim.write_cell(10, 17); // OUT
        sim.write_cell(11, 0);
        sim.write_cell(12, 0);  // HALT
        sim.write_cell(13, 0);
        sim.write_cell(-4, 8);  // tgt: .word late
        sim.reset();
        sim.run();
        check("JMPX jumps to computed address", sim.output.size() == 1 && sim.output[0] == 7);
    }

    // --- Suite 3: Signature 3-Way Branch (BR3) Across All 729 Values ---
    std::cout << "\n=== 3. THREE-WAY CONDITIONAL BRANCH ENGINE (BR3) ===" << std::endl;
    {
        // Program layout:
        // 0: IN (cells 0, 1)
        // 2: BR3 5 (cells 2, 3: opcode 16, operand 5)
        // 4: target_neg = 7
        // 5: target_zero = 11
        // 6: target_pos = 15
        // 7:  LOADI -1, JMP 19 (cells 7, 8, 9, 10)
        // 11: LOADI 0,  JMP 19 (cells 11, 12, 13, 14)
        // 15: LOADI 1,  JMP 19 (cells 15, 16, 17, 18)
        // 19: OUT, HALT (cells 19, 20, 21, 22)
        sim.clear_ram();
        sim.write_cell(0, 18); sim.write_cell(1, 0);  // IN
        sim.write_cell(2, 16); sim.write_cell(3, 5);  // BR3 5
        sim.write_cell(4, 7);                         // table neg target (5 - 1 = 4)
        sim.write_cell(5, 11);                        // table zero target (5 + 0 = 5)
        sim.write_cell(6, 15);                        // table pos target (5 + 1 = 6)
        sim.write_cell(7, 1);  sim.write_cell(8, -1); // n: LOADI -1
        sim.write_cell(9, 15); sim.write_cell(10, 19);// JMP 19
        sim.write_cell(11, 1); sim.write_cell(12, 0); // z: LOADI 0
        sim.write_cell(13, 15);sim.write_cell(14, 19);// JMP 19
        sim.write_cell(15, 1); sim.write_cell(16, 1); // p: LOADI 1
        sim.write_cell(17, 15);sim.write_cell(18, 19);// JMP 19
        sim.write_cell(19, 17);sim.write_cell(20, 0); // OUT
        sim.write_cell(21, 0); sim.write_cell(22, 0); // HALT

        bool all_br3_pass = true;
        for (int v = -364; v <= 364; v++) {
            sim.reset();
            sim.run({v});
            int expected_sign = (v > 0) ? 1 : ((v < 0) ? -1 : 0);
            if (sim.output.empty() || sim.output[0] != expected_sign) {
                all_br3_pass = false;
                std::cerr << "BR3 failed on value: " << v << " got: " << (sim.output.empty() ? -999 : sim.output[0]) << std::endl;
                break;
            }
        }
        check("BR3 classifies all 729 accumulator states (-364..+364) with 100% exactness", all_br3_pass);
    }

    // --- Suite 4: Demo Programs Execution on Silicon RTL ---
    std::cout << "\n=== 4. DEMO PROGRAMS EXECUTION ===" << std::endl;
    {
        // Execute threeway.hex
        sim.clear_ram();
        sim.load_hex("/tmp/threeway.hex");
        sim.reset();
        sim.run({7, -3, 0, 42, -100});
        bool threeway_ok = (sim.output.size() == 5 &&
                            sim.output[0] == 1 &&
                            sim.output[1] == -1 &&
                            sim.output[2] == 0 &&
                            sim.output[3] == 1 &&
                            sim.output[4] == -1);
        check("threeway.tasm hardware run correctly classifies 5 inputs [1, -1, 0, 1, -1]", threeway_ok);
    }
    {
        // Execute multiply.hex for test vectors
        sim.clear_ram();
        sim.load_hex("/tmp/multiply.hex");
        
        std::vector<std::pair<int, int>> mul_cases = {
            {7, 5},
            {-7, 5},
            {-7, -5},
            {12, -8},
            {19, 19},
            {0, 42},
            {-19, 19}
        };
        bool all_mul_ok = true;
        for (auto& p : mul_cases) {
            sim.reset();
            sim.run({p.first, p.second});
            if (sim.output.empty() || sim.output[0] != (p.first * p.second)) {
                all_mul_ok = false;
                std::cerr << "Multiply failed: " << p.first << "*" << p.second 
                          << " got: " << (sim.output.empty() ? -999 : sim.output[0]) 
                          << " expected: " << (p.first * p.second) << std::endl;
                break;
            }
        }
        check("multiply.tasm hardware run exact across test vectors", all_mul_ok);
    }
    {
        // Execute tgate.hex with control modes
        sim.clear_ram();
        sim.load_hex("/tmp/tgate.hex");
        sim.reset();
        sim.run({123, -45});
        std::cout << "TGATE output size: " << sim.output.size() << " vals: ";
        for (int v : sim.output) std::cout << v << " ";
        std::cout << std::endl;
        bool tgate_ok = (sim.output.size() == 4 &&
                         sim.output[0] == -120 &&
                         sim.output[1] == 198 &&
                         sim.output[2] == -123 &&
                         sim.output[3] == 195);
        check("tgate.tasm hardware run exercises all 4 gate modes", tgate_ok);
    }

    // --- Suite 5: Truth Table Engine (TOP & TOPC) ---
    std::cout << "\n=== 5. TRUTH TABLE ENGINE (TOP & TOPC) ===" << std::endl;
    {
        // Test TOP with MIN table
        // Address -30 holds 9 table entries for MIN
        sim.clear_ram();
        sim.write_cell(0, 11);  // SETC -30
        sim.write_cell(1, -30);
        sim.write_cell(2, 1);   // LOADI 123
        sim.write_cell(3, 123);
        sim.write_cell(4, 23);  // TOP -3
        sim.write_cell(5, -3);
        sim.write_cell(6, 17);  // OUT
        sim.write_cell(7, 0);
        sim.write_cell(8, 0);   // HALT
        sim.write_cell(9, 0);
        sim.write_cell(-3, -45); // y operand

        // Write MIN table at -30: (x+1)*3 + (y+1)
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                int row = (x + 1) * 3 + (y + 1);
                sim.write_cell(-30 + row, std::min(x, y));
            }
        }
        sim.reset();
        sim.run();
        check("TOP instruction applies 9-entry truth table tritwise", sim.output.size() == 1 && sim.output[0] == tmin(123, -45));
    }
    {
        // Test TOPC with addition carry table (27 rows at C = -50)
        // Computes exact wrapped balanced addition via carry chain
        sim.clear_ram();
        sim.write_cell(0, 11);  // SETC -50
        sim.write_cell(1, -50);
        sim.write_cell(2, 1);   // LOADI 45
        sim.write_cell(3, 45);
        sim.write_cell(4, 24);  // TOPC -3
        sim.write_cell(5, -3);
        sim.write_cell(6, 17);  // OUT
        sim.write_cell(7, 0);
        sim.write_cell(8, 0);   // HALT
        sim.write_cell(9, 0);
        sim.write_cell(-3, 85); // y operand

        // 27 rows: index = (x+1)*9 + (y+1)*3 + (c+1)
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                for (int c = -1; c <= 1; c++) {
                    int s = x + y + c;
                    int cout = (s > 1) ? 1 : ((s < -1) ? -1 : 0);
                    int sout = s - 3 * cout;
                    // Low trit is sout, second trit is cout
                    int cell_val = sout + 3 * cout;
                    int row = (x + 1) * 9 + (y + 1) * 3 + (c + 1);
                    sim.write_cell(-50 + row, cell_val);
                }
            }
        }
        sim.reset();
        sim.run();
        check("TOPC instruction executes 27-row carry-chained table (45 + 85 = 130)", sim.output.size() == 1 && sim.output[0] == 130);
    }

    // --- Suite 6: Post-Quantum Lattice Cryptography (Ternary NTRU) ---
    std::cout << "\n=== 6. POST-QUANTUM LATTICE CRYPTOGRAPHY (NTRU) ===" << std::endl;
    {
        // Execute ntru.hex on RTL hardware
        sim.clear_ram();
        sim.load_hex("/tmp/ntru.hex");
        sim.reset();
        // Test vector: h=[156, 312, 261], msg=[1, -1, 1], r=[-1, 0, 1], F=[0, 1, -1]
        std::vector<int> ntru_input = {156, 312, 261, 1, -1, 1, -1, 0, 1, 0, 1, -1};
        sim.run(ntru_input, 2000000);
        bool ntru_ok = (sim.output.size() >= 3 &&
                        sim.output[0] == 1 &&
                        sim.output[1] == -1 &&
                        sim.output[2] == 1);
        check("Native Post-Quantum NTRU TASM executes and decrypts message [1, -1, 1] on RTL Silicon Core", ntru_ok);
    }

    std::cout << "\n" << std::string(64, '=') << std::endl;
    if (total_failed == 0) {
        std::cout << "ALL " << total_passed << " HARDWARE VERIFICATION CHECKS PASSED SUCCESSFULLY!" << std::endl;
    } else {
        std::cout << "FAILED: " << total_failed << " checks failed!" << std::endl;
    }
    std::cout << std::string(64, '=') << std::endl;

    return (total_failed == 0) ? 0 : 1;
}
